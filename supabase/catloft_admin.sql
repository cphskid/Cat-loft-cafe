-- 暖陽貓閣「管理者」（Chuck 2026-10-18：管理者只有他一個，不用帳號，輸入管理者密碼就能登入）。
-- 管理者頁面 web/admin/ 用這裡的函式看所有玩家、所有貓閣的問題回報，還能送錢給玩家（Chuck：只能送錢，不限金額）。
-- 這個 repo 是公開的，所以密碼不放在網頁或 repo 裡：管理者是一個專用的 Supabase auth user
-- （email catloft-admin@catloft.player，2026-10-18 建立），密碼由 Supabase 登入檢查；
-- 網頁只送「這個 email + 輸入的密碼」去登入，是不是管理者在這裡比對登入的 auth user id。
-- 遊戲帳號的 email 都是 u<hex>@catloft.player，不會撞到這個 email。
--   catloft_is_admin        我是不是管理者
--   catloft_admin_players   所有玩家（從存檔讀出現金、粉絲、累計營收…）
--   catloft_admin_feedback  所有貓閣的問題回報（feedback 表裡 context.game = 'catloft' 的）
--   catloft_admin_gift      送錢給一位玩家
--   catloft_my_gifts / catloft_claim_gifts  玩家那邊：拿還沒收的禮物、收進存檔後標成已收

create or replace function public.catloft_is_admin() returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select coalesce(auth.uid() = '43ac8a2b-fee8-4c7b-8529-4db15f9fc5a8'::uuid, false) $$;

-- 存檔碼 CAT-<base64 的 JSON>-<checksum>；壞掉的存檔回 null，不讓一筆壞資料拖垮整個列表
create or replace function public.catloft_save_json(p_code text) returns jsonb
language plpgsql immutable set search_path to 'public', 'pg_temp'
as $$
begin
  return convert_from(decode(substring(p_code from '^CAT-([A-Za-z0-9+/=]+)-\d+$'), 'base64'), 'UTF8')::jsonb;
exception when others then return null;
end $$;

create or replace function public.catloft_admin_players()
returns table (user_id uuid, account text, shop_name text, mgr_name text, day integer, cash numeric, debt numeric, fans numeric,
               earned numeric, cats integer, shops integer, friend_code text, lv integer, created_at timestamptz, updated_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  return query
    select s.user_id,
           nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
           s.shop_name, j ->> 'mgrName', s.day,
           (j ->> 'cash')::numeric, (j ->> 'debt')::numeric, (j ->> 'fans')::numeric, (j ->> 'earned')::numeric,
           case when jsonb_typeof(j -> 'cats') = 'array' then jsonb_array_length(j -> 'cats') end,
           case when jsonb_typeof(j -> 'owned') = 'array' then jsonb_array_length(j -> 'owned') else 1 end,
           p.code, p.lv, u.created_at, s.updated_at
      from public.catloft_saves s
      join auth.users u on u.id = s.user_id
      left join public.catloft_players p on p.user_id = s.user_id
      cross join lateral (select public.catloft_save_json(s.code) as j) x
     order by s.updated_at desc;
end $$;

create or replace function public.catloft_admin_feedback()
returns table (id bigint, created_at timestamptz, user_id uuid, who text, kind text, message text, screen text,
               context jsonb, status text, reply text, replied_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  return query
    select f.id, f.created_at, f.user_id, f.who, f.kind, f.message, f.screen, f.context, f.status, f.reply, f.replied_at
      from public.feedback f
     where f.context ->> 'game' = 'catloft' and f.hidden_at is null
     order by f.created_at desc
     limit 500;
end $$;

-- 禮物：管理者寫一筆，玩家下次開遊戲時收進存檔。只有錢：gift = {cash}
create table if not exists public.catloft_gifts (
  id         bigint generated always as identity primary key,
  to_id      uuid not null references auth.users (id) on delete cascade,
  gift       jsonb not null check (pg_column_size(gift) < 2000),
  note       text not null default '',
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists catloft_gifts_unclaimed on public.catloft_gifts (to_id) where claimed_at is null;
alter table public.catloft_gifts enable row level security;
revoke all on public.catloft_gifts from anon, authenticated;

create or replace function public.catloft_admin_gift(p_to uuid, p_gift jsonb, p_note text)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_id bigint; v_cash numeric;
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  if not exists (select 1 from public.catloft_saves where user_id = p_to) then raise exception '找不到這位玩家'; end if;
  begin v_cash := floor((p_gift ->> 'cash')::numeric); exception when others then v_cash := null; end;
  -- 不限金額，只擋掉 0、負數和遊戲裡數字存不下的大小（JavaScript 安全整數）
  if v_cash is null or v_cash <= 0 or v_cash > 9007199254740991 then raise exception '金額不對'; end if;
  insert into public.catloft_gifts (to_id, gift, note)
  values (p_to, jsonb_build_object('cash', v_cash), left(btrim(regexp_replace(coalesce(p_note, ''), '[<>&"''`\\]', '', 'g')), 60))
  returning id into v_id;
  return v_id;
end $$;

-- 管理者頁面也列出送過的禮物，看看收了沒
create or replace function public.catloft_admin_gifts()
returns table (id bigint, to_id uuid, gift jsonb, note text, created_at timestamptz, claimed_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  return query select g.id, g.to_id, g.gift, g.note, g.created_at, g.claimed_at from public.catloft_gifts g order by g.id desc limit 200;
end $$;

create or replace function public.catloft_my_gifts()
returns table (id bigint, gift jsonb, note text, created_at timestamptz)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select g.id, g.gift, g.note, g.created_at from public.catloft_gifts g
       where g.to_id = auth.uid() and g.claimed_at is null order by g.id $$;

-- 回傳真的這次才收下的 id，遊戲只把這些放進存檔（兩台裝置同時開也不會收兩次）
drop function if exists public.catloft_claim_gifts(bigint[]);
create or replace function public.catloft_claim_gifts(p_ids bigint[]) returns setof bigint
language sql security definer set search_path to 'public', 'pg_temp'
as $$ update public.catloft_gifts set claimed_at = now()
       where to_id = auth.uid() and claimed_at is null and id = any (p_ids) returning id $$;

revoke all on function public.catloft_is_admin(), public.catloft_save_json(text), public.catloft_admin_players(), public.catloft_admin_feedback(),
  public.catloft_admin_gift(uuid, jsonb, text), public.catloft_admin_gifts(), public.catloft_my_gifts(), public.catloft_claim_gifts(bigint[]) from public, anon;
grant execute on function public.catloft_is_admin(), public.catloft_admin_players(), public.catloft_admin_feedback(),
  public.catloft_admin_gift(uuid, jsonb, text), public.catloft_admin_gifts(), public.catloft_my_gifts(), public.catloft_claim_gifts(bigint[]) to authenticated;
