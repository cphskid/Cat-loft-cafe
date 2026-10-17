-- 暖陽貓閣「今日排行榜」。每位玩家每個台灣日期一列，記下今天打烊過的最好一天營業額。
-- 表本身不開放直接讀寫（看得到別人的 user_id 不好），只能透過下面兩個函式：
--   catloft_board_submit  打烊時送出這一天的營業額，同一天只留最高的那一次
--   catloft_board_today   讀今天前 20 名，加上自己的名次（is_me）
create table if not exists public.catloft_board (
  user_id    uuid not null references auth.users (id) on delete cascade,
  play_date  date not null,
  shop_name  text not null,
  revenue    integer not null check (revenue between 0 and 1000000),
  day        integer not null default 1,
  lv         integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, play_date)
);
create index if not exists catloft_board_rank on public.catloft_board (play_date, revenue desc);

alter table public.catloft_board enable row level security;
revoke all on public.catloft_board from anon, authenticated;

create or replace function public.catloft_board_submit(p_revenue integer, p_day integer, p_lv integer, p_shop text)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_shop text := left(btrim(regexp_replace(coalesce(p_shop, ''), '[<>&"''`\\]', '', 'g')), 12);
        v_today date := (now() at time zone 'Asia/Taipei')::date;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if v_shop = '' then v_shop := '貓咪咖啡廳'; end if;
  insert into public.catloft_board (user_id, play_date, shop_name, revenue, day, lv)
  values (auth.uid(), v_today, v_shop, least(greatest(coalesce(p_revenue, 0), 0), 1000000), greatest(coalesce(p_day, 1), 1), least(greatest(coalesce(p_lv, 1), 1), 99))
  on conflict (user_id, play_date) do update
    set shop_name = excluded.shop_name, day = excluded.day, lv = excluded.lv, updated_at = now(),
        revenue = greatest(catloft_board.revenue, excluded.revenue);
end $$;

create or replace function public.catloft_board_today()
returns table (rank bigint, shop_name text, revenue integer, day integer, lv integer, is_me boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with r as (
    select row_number() over (order by b.revenue desc, b.updated_at) as rank, b.shop_name, b.revenue, b.day, b.lv,
           coalesce(b.user_id = auth.uid(), false) as is_me
    from public.catloft_board b
    where b.play_date = (now() at time zone 'Asia/Taipei')::date
  )
  select * from r where r.rank <= 20 or r.is_me order by r.rank;
$$;

revoke all on function public.catloft_board_submit(integer, integer, integer, text) from public, anon;
grant execute on function public.catloft_board_submit(integer, integer, integer, text) to authenticated;
revoke all on function public.catloft_board_today() from public;
grant execute on function public.catloft_board_today() to anon, authenticated;
