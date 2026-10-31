-- 暖陽貓閣「📢 公告」。
-- 2026-10-31 Chuck：「管理者那邊有一個新增公告可以直接自己打字新增上去，新增完畢之後玩家就看得到了」，
-- 女兒的企劃：「公告會有即將來到的活動和新消息，過了 7 天就會消失」。
-- 管理者在 web/admin/「📢 公告」分頁打字發布，預設 7 天後自動下架；玩家的手機「公告」App 和開店時的公告卡片會讀到。
--   catloft_news               玩家讀現在還在的公告（訪客、沒登入的也可以讀，公告本來就是給大家看的）
--   catloft_admin_news_add     發布一則公告
--   catloft_admin_news_list    管理者看最近的公告（包括已經過期、刪掉的）
--   catloft_admin_news_delete  提早下架
create table if not exists public.catloft_news (
  id         bigint generated always as identity primary key,
  title      text not null check (char_length(title) between 1 and 30),
  body       text not null default '' check (char_length(body) <= 300),
  author     uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz
);
create index if not exists catloft_news_live on public.catloft_news (expires_at) where deleted_at is null;
alter table public.catloft_news enable row level security;
revoke all on public.catloft_news from anon, authenticated;

create or replace function public.catloft_news()
returns table (id bigint, title text, body text, created_at timestamptz, expires_at timestamptz)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select n.id, n.title, n.body, n.created_at, n.expires_at from public.catloft_news n
       where n.deleted_at is null and n.expires_at > now() order by n.id desc limit 20 $$;

create or replace function public.catloft_admin_news_add(p_title text, p_body text, p_days integer)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_id bigint;
        v_title text := btrim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g'));
        v_body text := btrim(coalesce(p_body, ''));
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  if v_title = '' then raise exception '標題是空的'; end if;
  if char_length(v_title) > 30 then raise exception '標題 30 字以內'; end if;
  if char_length(v_body) > 300 then raise exception '內容 300 字以內'; end if;
  if p_days is null or p_days < 1 or p_days > 30 then raise exception '天數要在 1 到 30 天'; end if;
  insert into public.catloft_news (title, body, author, expires_at)
  values (v_title, v_body, auth.uid(), now() + make_interval(days => p_days))
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.catloft_admin_news_list()
returns table (id bigint, title text, body text, who text, created_at timestamptz, expires_at timestamptz, deleted_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  return query
    select n.id, n.title, n.body, nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), n.created_at, n.expires_at, n.deleted_at
      from public.catloft_news n left join auth.users u on u.id = n.author
     order by n.id desc limit 50;
end $$;

create or replace function public.catloft_admin_news_delete(p_id bigint)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  update public.catloft_news set deleted_at = now() where id = p_id and deleted_at is null;
end $$;

revoke all on function public.catloft_news(), public.catloft_admin_news_add(text, text, integer), public.catloft_admin_news_list(),
  public.catloft_admin_news_delete(bigint) from public;
grant execute on function public.catloft_news() to anon, authenticated;
revoke all on function public.catloft_admin_news_add(text, text, integer), public.catloft_admin_news_list(), public.catloft_admin_news_delete(bigint) from anon;
grant execute on function public.catloft_admin_news_add(text, text, integer), public.catloft_admin_news_list(), public.catloft_admin_news_delete(bigint) to authenticated;
