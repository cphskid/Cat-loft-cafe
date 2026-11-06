-- 暖陽貓閣「帳號綁定 email」和「忘記密碼」（2026-11-06）。
-- 起因：玩家 jk070936 第 100–160 天的進度只存在一台裝置上，女兒在那台登入自己的帳號後被蓋掉。
-- Chuck：一定要有帳號才能玩、登入後綁定 email，沒綁定的要提醒「忘記密碼就沒辦法重設」。
-- 帳號在 Supabase 的 email 是假的 u<hex>@catloft.player（用帳號名稱登入），所以真的 email 另外存在這裡，
-- 不改 auth 的 email，也就不用寄確認信（這個 Supabase 專案沒有設定寄信服務）。
-- 忘記密碼：玩家填帳號名稱 + 綁定的 email → Edge Function catloft-reset（supabase/functions/catloft-reset）用 Resend
-- 從 catloftcafe@ciyulab.com 寄一封重設連結（30 分鐘內有效）→ 點進遊戲 /?reset=<token> 設新密碼。
--   catloft_set_email / catloft_my_email       玩家：綁定、查看自己的 email
--   catloft_reset_issue                         只有 Edge Function（service_role）：帳號名稱 + email 對得上就發一次性的重設碼
--   catloft_reset_password                      任何人：用重設碼設新密碼
--   catloft_admin_set_password                  管理者：幫玩家設新密碼（沒綁 email 的人只能靠這個）
-- 用到 catloft_admin.sql 的 catloft_is_admin()。

create table if not exists public.catloft_recovery (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  updated_at timestamptz not null default now()
);
alter table public.catloft_recovery enable row level security;
revoke all on public.catloft_recovery from anon, authenticated;

create table if not exists public.catloft_resets (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text not null,
  token_hash text not null unique,          -- sha256(重設碼)，重設碼本身只出現在信裡
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);
create index if not exists catloft_resets_user on public.catloft_resets (user_id, created_at);
alter table public.catloft_resets enable row level security;
revoke all on public.catloft_resets from anon, authenticated;

-- 帳號名稱 → 登入用的 email，跟網頁的 acctEmail() 一樣（去頭尾空白、小寫、UTF-8 轉 16 進位）
create or replace function public.catloft_acct_email(p_name text) returns text
language sql immutable set search_path to 'public', 'pg_temp'
as $$ select 'u' || encode(convert_to(lower(btrim(coalesce(p_name, ''))), 'UTF8'), 'hex') || '@catloft.player' $$;

create or replace function public.catloft_clean_email(p_email text) returns text
language sql immutable set search_path to 'public', 'pg_temp'
as $$ select case when lower(btrim(coalesce(p_email, ''))) ~ '^[^@\s<>"'']+@[^@\s<>"'']+\.[^@\s<>"'']+$' and length(btrim(p_email)) <= 120
                  then lower(btrim(p_email)) end $$;

-- 只有取了帳號名稱的帳號能綁（匿名帳號忘記也沒有密碼可以重設）；空字串 = 取消綁定
create or replace function public.catloft_set_email(p_email text) returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); e text := public.catloft_clean_email(p_email);
begin
  if me is null or not exists (select 1 from auth.users where id = me and email like '%@catloft.player') then return 'noacct'; end if;
  if btrim(coalesce(p_email, '')) = '' then delete from public.catloft_recovery where user_id = me; return 'cleared'; end if;
  if e is null then return 'bad'; end if;
  insert into public.catloft_recovery (user_id, email) values (me, e)
    on conflict (user_id) do update set email = excluded.email, updated_at = now();
  return 'ok';
end $$;

create or replace function public.catloft_my_email() returns text
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select email from public.catloft_recovery where user_id = auth.uid() $$;

-- 回傳 {status, token, account}：status 'ok' / 'nomatch'（帳號不存在、沒綁 email 或 email 不對）/ 'wait'（一小時內寄太多次）
create or replace function public.catloft_reset_issue(p_name text, p_email text) returns jsonb
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare uid uuid; nm text; e text := public.catloft_clean_email(p_email); tok text;
begin
  if e is null then return jsonb_build_object('status', 'nomatch'); end if;
  select u.id, coalesce(nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), btrim(p_name)) into uid, nm
    from auth.users u join public.catloft_recovery r on r.user_id = u.id
    where u.email = public.catloft_acct_email(p_name) and r.email = e;
  if uid is null then return jsonb_build_object('status', 'nomatch'); end if;
  if (select count(*) from public.catloft_resets where user_id = uid and created_at > now() - interval '1 hour') >= 3
    then return jsonb_build_object('status', 'wait'); end if;
  tok := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.catloft_resets (user_id, email, token_hash, expires_at)
    values (uid, e, encode(extensions.digest(tok, 'sha256'), 'hex'), now() + interval '30 minutes');
  return jsonb_build_object('status', 'ok', 'token', tok, 'account', nm);
end $$;

-- 回傳 'ok:<帳號名稱>' / 'short'（密碼太短）/ 'bad'（重設碼不對、過期或用過了）
create or replace function public.catloft_reset_password(p_token text, p_pass text) returns text
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $$
declare r record;
begin
  if length(coalesce(p_pass, '')) < 6 then return 'short'; end if;
  select * into r from public.catloft_resets
    where token_hash = encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') and used_at is null and expires_at > now();
  if r.id is null then return 'bad'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pass, extensions.gen_salt('bf')), updated_at = now()
    where id = r.user_id and email like '%@catloft.player';
  update public.catloft_resets set used_at = now() where user_id = r.user_id and used_at is null;
  return 'ok:' || coalesce((select nullif(btrim(raw_user_meta_data ->> 'name'), '') from auth.users where id = r.user_id), '');
end $$;

-- 只能改遊戲帳號（@catloft.player）的密碼；同時把這個人還沒處理的申請標成完成
create or replace function public.catloft_admin_set_password(p_user uuid, p_pass text) returns text
language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  if length(coalesce(p_pass, '')) < 6 then return 'short'; end if;
  update auth.users set encrypted_password = extensions.crypt(p_pass, extensions.gen_salt('bf')), updated_at = now()
    where id = p_user and email like '%@catloft.player';
  if not found then return 'nouser'; end if;
  update public.catloft_resets set used_at = now() where user_id = p_user and used_at is null;
  return 'ok';
end $$;

revoke all on function public.catloft_acct_email(text), public.catloft_clean_email(text), public.catloft_set_email(text), public.catloft_my_email(),
  public.catloft_reset_issue(text, text), public.catloft_reset_password(text, text), public.catloft_admin_set_password(uuid, text) from public, anon, authenticated;
grant execute on function public.catloft_set_email(text), public.catloft_my_email(), public.catloft_admin_set_password(uuid, text) to authenticated;
grant execute on function public.catloft_reset_password(text, text) to anon, authenticated;
grant execute on function public.catloft_reset_issue(text, text) to service_role;
