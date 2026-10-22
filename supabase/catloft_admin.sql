-- 暖陽貓閣「管理者」。
-- 2026-10-22 Chuck：「把最高管理者帳號設定成她跟我」= 遊戲帳號 chency0311（女兒）和 chuck（Chuck）。
-- 管理者頁面 web/admin/ 用遊戲帳號名稱 + 密碼登入（跟遊戲裡「用帳號登入」一樣，名稱轉成 u<hex>@catloft.player），
-- 是不是管理者在這裡比對登入的 auth user id。網頁和 repo 裡都沒有密碼，密碼由 Supabase 登入檢查。
-- （2026-10-18 到 10-22 用的是只輸入密碼的專用帳號 catloft-admin@catloft.player，auth user 43ac8a2b-…，現在已經不是管理者。）
--   catloft_is_admin        我是不是管理者
--   catloft_admin_players   所有玩家（從存檔讀出現金、粉絲、累計營收…）
--   catloft_admin_feedback  所有貓閣的問題回報（feedback 表裡 context.game = 'catloft' 的）
--   catloft_admin_gift      送錢給一位玩家
--   catloft_my_gifts / catloft_claim_gifts  玩家那邊：拿還沒收的禮物、收進存檔後標成已收

create or replace function public.catloft_is_admin() returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select coalesce(auth.uid() in ('82dee961-2afc-4e75-98ac-a10c3eecbac6'::uuid,   -- chency0311
                                      '6054179f-46b7-449c-a902-7701225c4a98'::uuid),  -- chuck
                     false) $$;

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

-- 2026-10-18 Chuck：「最高管理者要調自己的什麼都可以」。「自己」= 登入管理者頁面的那個遊戲帳號（chency0311 或 chuck）。
-- 調整也走禮物這條路（gift = {set:{...}}），遊戲開著的時候也會馬上收到，不會被遊戲裡舊的存檔蓋回去。
create or replace function public.catloft_admin_self() returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select case when public.catloft_is_admin() then auth.uid() end $$;

create or replace function public.catloft_admin_edit(p_set jsonb)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_id bigint;
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  if jsonb_typeof(p_set) <> 'object' or p_set = '{}'::jsonb then raise exception '沒有要改的東西'; end if;
  insert into public.catloft_gifts (to_id, gift, note)
  values (public.catloft_admin_self(), jsonb_build_object('set', p_set), '管理者調整')
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.catloft_admin_self(), public.catloft_admin_edit(jsonb) from public, anon;
grant execute on function public.catloft_admin_self(), public.catloft_admin_edit(jsonb) to authenticated;

-- 2026-10-22 Chuck：「問題回報在管理者那邊也要能做出回應，使用者那邊可以看到回應，參考時光冒險樂園」。
-- 跟樂園老師後台一樣：回覆寫進 feedback.reply / replied_at，處理狀態寫進 status / triaged_at（同一組狀態代碼）。
-- 玩家那邊 web/feedback.js 本來就用樂園的 my_feedback 讀，手機「問題回報 → 我的回報」會出現 💌 回覆和「新消息」。
-- 只能改貓閣的回報（context.game = 'catloft'），不會動到樂園學生的。
create or replace function public.catloft_admin_answer(p_id bigint, p_status text, p_reply text)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_reply text := nullif(btrim(coalesce(p_reply, '')), '');
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  if p_status not in ('new', 'bug', 'request', 'unclear', 'fixed', 'dup', 'wontfix') then raise exception '狀態不對'; end if;
  if char_length(v_reply) > 300 then raise exception '回覆寫太長了，300 字以內'; end if;
  update public.feedback
     set status = p_status,
         triaged_at = case when status is distinct from p_status then now() else triaged_at end,
         reply = v_reply,
         replied_at = case when v_reply is null then null
                           when reply is distinct from v_reply then now() else replied_at end
   where id = p_id and context ->> 'game' = 'catloft';
  if not found then raise exception '找不到這則回報'; end if;
end $$;

revoke all on function public.catloft_admin_answer(bigint, text, text) from public, anon;
grant execute on function public.catloft_admin_answer(bigint, text, text) to authenticated;
