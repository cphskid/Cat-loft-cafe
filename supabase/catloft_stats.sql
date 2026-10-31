-- 暖陽貓閣「遊玩統計」（2026-10-31 Chuck：想知道大家哪幾天來玩、每天玩多久，用來看回流、決定要加強哪些功能）。
-- 遊戲每分鐘（和切走分頁時）送一次這段時間玩了幾秒、花在哪裡（act = {活動代號: 秒數}）。
-- 一位玩家每天（台灣日期）一筆，跟存檔分開，所以玩家按「重新開始」紀錄也不會被洗掉。
-- 只算畫面開在前面、兩分鐘內有操作的時間（跟存檔裡的 G.play 一樣）。

create table if not exists public.catloft_play_days (
  user_id    uuid not null references auth.users (id) on delete cascade,
  d          date not null,                  -- 台灣日期
  secs       numeric not null default 0,     -- 這天玩了幾秒
  gday       integer,                        -- 這天玩到遊戲裡的第幾天（最大的那個）
  act        jsonb not null default '{}',    -- 時間花在哪裡：{cook: 120, app_game: 300, s1f1: 600, ...}
  updated_at timestamptz not null default now(),
  primary key (user_id, d)
);
alter table public.catloft_play_days enable row level security;
revoke all on public.catloft_play_days from anon, authenticated;

-- 玩家那邊：加上一段遊玩時間。只收今天或昨天（跨午夜還沒送出的那段），一次最多 1 小時，一天最多 24 小時
create or replace function public.catloft_log_play(p_d date, p_secs numeric, p_gday integer, p_act jsonb)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare tw date := (now() at time zone 'Asia/Taipei')::date; v_act jsonb;
begin
  if auth.uid() is null or p_d is null or p_d < tw - 1 or p_d > tw then return; end if;
  p_secs := least(greatest(coalesce(p_secs, 0), 0), 3600);
  select coalesce(jsonb_object_agg(key, least(value::numeric, 3600)), '{}') into v_act
    from (select key, value from jsonb_each_text(case when jsonb_typeof(p_act) = 'object' then p_act else '{}' end)
           where key ~ '^[a-z0-9_]{1,24}$' and value ~ '^[0-9]{1,6}(\.[0-9]+)?$' limit 60) x;
  insert into public.catloft_play_days as t (user_id, d, secs, gday, act)
  values (auth.uid(), p_d, p_secs, greatest(least(p_gday, 100000), 1), v_act)
  on conflict (user_id, d) do update set
    secs = least(t.secs + excluded.secs, 86400),
    gday = greatest(coalesce(t.gday, 0), coalesce(excluded.gday, 0)),
    act = (select coalesce(jsonb_object_agg(k, s), '{}') from (
             select k, sum(v) s from (select key k, value::numeric v from jsonb_each_text(t.act)
                                      union all select key, value::numeric from jsonb_each_text(excluded.act)) a group by k) b),
    updated_at = now();
end $$;

-- 管理者：從某天起所有玩家每天的紀錄
create or replace function public.catloft_admin_play_days(p_from date)
returns table (user_id uuid, d date, secs numeric, gday integer, act jsonb)
language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  return query select p.user_id, p.d, p.secs, p.gday, p.act from public.catloft_play_days p where p.d >= p_from order by p.d;
end $$;

revoke all on function public.catloft_log_play(date, numeric, integer, jsonb), public.catloft_admin_play_days(date) from public, anon;
grant execute on function public.catloft_log_play(date, numeric, integer, jsonb), public.catloft_admin_play_days(date) to authenticated;
