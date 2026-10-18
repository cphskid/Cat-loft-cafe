-- 暖陽貓閣「喵IG」：標題和留言開放自己打字（Chuck 2026-10-18：大人小孩都在玩，「不能罵髒話」）。
-- 接在 catloft_ig.sql 後面跑。固定的句子和貼圖還是留著；打的字一律先經過 catloft_ig_filter：
--   髒話換成＊＊、網址和 6 位數以上的數字（電話、帳號）也換掉，最多 30 個字。
--   web/igpub.js 的 BAD 清單跟這裡的 v_bad 要一起改（遊戲先在畫面上濾一次，伺服器這邊才算數）。

alter table public.catloft_ig_posts add column if not exists txt text check (txt is null or length(txt) <= 40);
alter table public.catloft_ig_comments add column if not exists txt text check (txt is null or length(txt) <= 40);
alter table public.catloft_ig_comments drop constraint if exists catloft_ig_comments_kind_check;
alter table public.catloft_ig_comments add constraint catloft_ig_comments_kind_check check (kind between 0 and 2); -- 2 = typed text in txt

create or replace function public.catloft_ig_filter(t text) returns text
language plpgsql immutable set search_path to 'public', 'pg_temp'
as $$
declare
  v text := left(btrim(regexp_replace(regexp_replace(coalesce(t, ''), '[<>&"''`\\]', '', 'g'), '\s+', ' ', 'g')), 30);
  v_bad text[] := array[
    '幹你娘', '幹妳娘', '操你媽', '操你', '你娘', '你媽的', '他媽的', '他媽', '她媽', '媽的', '靠北', '靠杯', '靠夭', '靠腰', '機掰', '雞掰', '機八', '雞八', '機巴', '雞巴',
    '屌', '白癡', '白痴', '智障', '低能', '腦殘', '弱智', '去死', '死全家', '廢物', '王八蛋', '王八', '混蛋', '賤', '婊', '妓女', '三小', '啥小', '洨', '尻', '淫', '色情', '狗屎', '屁眼', '北七', '肏',
    'fuck', 'fck', 'shit', 'bitch', 'asshole', 'bastard', 'dick', 'pussy', 'cunt', 'wtf', 'stfu', 'nigger', 'nigga', 'slut', 'whore'];
  w text;
begin
  v := regexp_replace(v, '(https?://|www\.)\S*', '＊＊', 'gi');
  v := regexp_replace(v, '[0-9０-９][0-9０-９ \-]{4,}[0-9０-９]', '＊＊', 'g');
  foreach w in array v_bad loop
    v := regexp_replace(v, w, repeat('＊', char_length(w)), 'gi');
  end loop;
  -- 幹 alone is a swear, but 幹嘛／能幹／幹部 are fine
  v := regexp_replace(v, '(?<![能才樹骨主苦])幹(?![嘛麼活部勁練線事掉什])', '＊', 'g');
  return nullif(btrim(v), '');
end $$;

-- share with a typed caption (null/empty = use the preset p_cap)
create or replace function public.catloft_ig_post(p_cap integer, p_img text, p_txt text)
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_id bigint := catloft_ig_post(p_cap, p_img);
begin
  if v_id is not null then update public.catloft_ig_posts set txt = catloft_ig_filter(p_txt) where id = v_id; end if;
  return v_id;
end $$;

-- typed comment; returns the filtered text, or null when the post is gone, the text is empty, or I already left 5 here
create or replace function public.catloft_ig_say(p_id bigint, p_txt text)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); v text := catloft_ig_filter(p_txt);
begin
  if me is null then raise exception 'not signed in'; end if;
  if v is null or not exists (select 1 from public.catloft_ig_posts where id = p_id) then return null; end if;
  if (select count(*) from public.catloft_ig_comments where post_id = p_id and user_id = me) >= 5 then return null; end if;
  insert into public.catloft_ig_comments (post_id, user_id, kind, n, txt) values (p_id, me, 2, 0, v);
  return v;
end $$;

drop function if exists public.catloft_ig_feed(bigint);
create function public.catloft_ig_feed(p_before bigint default null)
returns table (id bigint, shop_name text, cap smallint, img text, at timestamptz, likes bigint, comments bigint, liked boolean, mine boolean, txt text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select p.id, catloft_ig_shop(p.user_id), p.cap, p.img, p.created_at,
    (select count(*) from public.catloft_ig_likes l where l.post_id = p.id),
    (select count(*) from public.catloft_ig_comments c where c.post_id = p.id),
    exists (select 1 from public.catloft_ig_likes l where l.post_id = p.id and l.user_id = auth.uid()),
    p.user_id = auth.uid(), p.txt
  from public.catloft_ig_posts p
  where p_before is null or p.id < p_before
  order by p.id desc limit 12
$$;

drop function if exists public.catloft_ig_comments_of(bigint);
create function public.catloft_ig_comments_of(p_id bigint)
returns table (shop_name text, kind smallint, n smallint, at timestamptz, mine boolean, txt text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select catloft_ig_shop(c.user_id), c.kind, c.n, c.at, c.user_id = auth.uid(), c.txt
  from public.catloft_ig_comments c where c.post_id = p_id order by c.id limit 40
$$;

revoke all on function public.catloft_ig_filter(text) from public, anon;
grant execute on function public.catloft_ig_filter(text) to authenticated; -- the game previews a typed line with it
revoke all on function public.catloft_ig_post(integer, text, text), public.catloft_ig_say(bigint, text), public.catloft_ig_feed(bigint), public.catloft_ig_comments_of(bigint) from public, anon;
grant execute on function public.catloft_ig_post(integer, text, text), public.catloft_ig_say(bigint, text), public.catloft_ig_feed(bigint), public.catloft_ig_comments_of(bigint) to authenticated;
