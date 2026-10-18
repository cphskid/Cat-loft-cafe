-- 暖陽貓閣「喵IG」大家的貼文：玩家把拍的店裡照片分享出去，其他玩家可以看、按讚、留言。
-- 跟 catloft_friends.sql 一樣：表不開放直接讀寫，只能透過下面的函式；店名從 catloft_players 拿（先呼叫 catloft_me）。
--   照片：遊戲畫面縮圖（JPEG data URL，最多 60KB），存在表裡；每人只留最新 30 篇。
--   文字：小朋友也在玩，所以標題和留言都只能選固定的句子／貼圖，存的是編號（web/igpub.js 的清單只能往後加）。
--   一天最多分享 3 篇（台灣日期）；每人對每篇最多留 5 則；自己或管理者可以收回貼文。
-- 用到 catloft_friends.sql 的 catloft_players，catloft_admin.sql 的 catloft_is_admin()。

create table if not exists public.catloft_ig_posts (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  cap        smallint not null check (cap between 0 and 63),
  img        text not null check (length(img) <= 60000),
  created_at timestamptz not null default now()
);
create index if not exists catloft_ig_posts_user on public.catloft_ig_posts (user_id, id);
create table if not exists public.catloft_ig_likes (
  post_id bigint not null references public.catloft_ig_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  primary key (post_id, user_id)
);
create table if not exists public.catloft_ig_comments (
  id      bigint generated always as identity primary key,
  post_id bigint not null references public.catloft_ig_posts (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    smallint not null check (kind between 0 and 1), -- 0 = preset phrase, 1 = sticker
  n       smallint not null check (n between 0 and 63),
  at      timestamptz not null default now()
);
create index if not exists catloft_ig_comments_post on public.catloft_ig_comments (post_id, id);

alter table public.catloft_ig_posts enable row level security;
alter table public.catloft_ig_likes enable row level security;
alter table public.catloft_ig_comments enable row level security;
revoke all on public.catloft_ig_posts, public.catloft_ig_likes, public.catloft_ig_comments from anon, authenticated;

create or replace function public.catloft_ig_shop(u uuid) returns text
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select coalesce((select shop_name from public.catloft_players where user_id = u), '貓咪咖啡廳') $$;

-- share a photo: returns the new post id, or null when today's 3 are used up
create or replace function public.catloft_ig_post(p_cap integer, p_img text)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); v_id bigint; v_day date := (now() at time zone 'Asia/Taipei')::date;
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_cap is null or p_cap < 0 or p_cap > 63 then raise exception 'bad caption'; end if;
  if p_img is null or length(p_img) > 60000 or p_img !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+=*$' then raise exception 'bad image'; end if;
  if (select count(*) from public.catloft_ig_posts where user_id = me and (created_at at time zone 'Asia/Taipei')::date = v_day) >= 3 then return null; end if;
  insert into public.catloft_ig_posts (user_id, cap, img) values (me, p_cap, p_img) returning id into v_id;
  delete from public.catloft_ig_posts where user_id = me and id not in (select id from public.catloft_ig_posts where user_id = me order by id desc limit 30);
  return v_id;
end $$;

-- newest posts from everyone, 12 at a time (p_before = the smallest id already shown)
create or replace function public.catloft_ig_feed(p_before bigint default null)
returns table (id bigint, shop_name text, cap smallint, img text, at timestamptz, likes bigint, comments bigint, liked boolean, mine boolean)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select p.id, catloft_ig_shop(p.user_id), p.cap, p.img, p.created_at,
    (select count(*) from public.catloft_ig_likes l where l.post_id = p.id),
    (select count(*) from public.catloft_ig_comments c where c.post_id = p.id),
    exists (select 1 from public.catloft_ig_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.user_id = auth.uid()
  from public.catloft_ig_posts p
  where p_before is null or p.id < p_before
  order by p.id desc limit 12
$$;

-- my shared posts with their like/comment counts (the game turns new likes into fans)
create or replace function public.catloft_ig_mine()
returns table (id bigint, likes bigint, comments bigint)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select p.id, (select count(*) from public.catloft_ig_likes l where l.post_id = p.id),
    (select count(*) from public.catloft_ig_comments c where c.post_id = p.id)
  from public.catloft_ig_posts p where p.user_id = auth.uid() order by p.id desc
$$;

-- like (p_on true) or take it back; returns the like count now
create or replace function public.catloft_ig_like(p_id bigint, p_on boolean)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.catloft_ig_posts where id = p_id) then return 0; end if;
  if p_on then insert into public.catloft_ig_likes (post_id, user_id) values (p_id, me) on conflict do nothing;
  else delete from public.catloft_ig_likes where post_id = p_id and user_id = me; end if;
  return (select count(*) from public.catloft_ig_likes where post_id = p_id);
end $$;

-- leave a preset phrase or sticker; false when the post is gone or I already left 5 here
create or replace function public.catloft_ig_comment(p_id bigint, p_kind integer, p_n integer)
returns boolean
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not signed in'; end if;
  if p_kind not between 0 and 1 or p_n not between 0 and 63 then raise exception 'bad comment'; end if;
  if not exists (select 1 from public.catloft_ig_posts where id = p_id) then return false; end if;
  if (select count(*) from public.catloft_ig_comments where post_id = p_id and user_id = me) >= 5 then return false; end if;
  insert into public.catloft_ig_comments (post_id, user_id, kind, n) values (p_id, me, p_kind, p_n);
  return true;
end $$;

create or replace function public.catloft_ig_comments_of(p_id bigint)
returns table (shop_name text, kind smallint, n smallint, at timestamptz, mine boolean)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select catloft_ig_shop(c.user_id), c.kind, c.n, c.at, c.user_id = auth.uid()
  from public.catloft_ig_comments c where c.post_id = p_id order by c.id limit 40
$$;

-- take a post back (its owner, or the admin)
create or replace function public.catloft_ig_delete(p_id bigint)
returns boolean
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  delete from public.catloft_ig_posts where id = p_id and (user_id = auth.uid() or catloft_is_admin());
  return found;
end $$;

revoke all on function public.catloft_ig_shop(uuid) from public, anon, authenticated;
revoke all on function public.catloft_ig_post(integer, text), public.catloft_ig_feed(bigint), public.catloft_ig_mine(), public.catloft_ig_like(bigint, boolean),
  public.catloft_ig_comment(bigint, integer, integer), public.catloft_ig_comments_of(bigint), public.catloft_ig_delete(bigint) from public, anon;
grant execute on function public.catloft_ig_post(integer, text), public.catloft_ig_feed(bigint), public.catloft_ig_mine(), public.catloft_ig_like(bigint, boolean),
  public.catloft_ig_comment(bigint, integer, integer), public.catloft_ig_comments_of(bigint), public.catloft_ig_delete(bigint) to authenticated;
