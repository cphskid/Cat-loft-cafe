-- 暖陽貓閣「邀請好友」：分享喵型圖卡的連結帶著自己的好友碼（/q/<喵型>/?r=好友碼），
-- 朋友從連結進來開新店就記成「被你邀請」，兩個人自動變成好友；
-- 朋友玩完第一天（雲端存檔到第 2 天）才算邀請成功，避免開新存檔刷獎勵。
-- 獎勵（暖陽好友套裝、之後的遊戲幣）由遊戲依「成功人數」發，這裡只負責算人數。
-- 用到 catloft_friends.sql 的 catloft_players / catloft_friends / catloft_uid / catloft_clean，以及 catloft_saves。

create table if not exists public.catloft_invites (
  invitee   uuid primary key references auth.users (id) on delete cascade, -- each player is invited at most once
  inviter   uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  done_at   timestamptz -- the invitee finished their first day
);
create index if not exists catloft_invites_inviter on public.catloft_invites (inviter);
alter table public.catloft_invites enable row level security;
revoke all on public.catloft_invites from anon, authenticated;

-- the inviting shop's name, for 「XX 邀請你來暖陽貓閣」 on the quiz page (no login there)
create or replace function public.catloft_invite_who(p_code text)
returns text
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select shop_name from public.catloft_players where code = upper(btrim(coalesce(p_code, ''))) $$;

-- a new player came in through a friend's link: 'ok' | 'none' | 'self' | 'again' (already invited) | 'old' (not a new shop)
create or replace function public.catloft_invite_join(p_code text)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null then raise exception 'not signed in'; end if;
  if them is null then return 'none'; end if;
  if them = me or exists (select 1 from public.catloft_invites where invitee = them and inviter = me) then return 'self'; end if;
  if exists (select 1 from public.catloft_invites where invitee = me) then return 'again'; end if;
  if coalesce((select day from public.catloft_saves where user_id = me), 1) > 2 then return 'old'; end if;
  insert into public.catloft_invites (invitee, inviter) values (me, them);
  insert into public.catloft_friends (from_id, to_id) values (me, them), (them, me) on conflict do nothing;
  return 'ok';
end $$;

-- the invitee closed their first day; counts once their cloud save has reached day 2
create or replace function public.catloft_invite_done()
returns boolean
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid();
begin
  if me is null then return false; end if;
  update public.catloft_invites set done_at = now()
  where invitee = me and done_at is null and coalesce((select day from public.catloft_saves where user_id = me), 1) >= 2;
  return found;
end $$;

-- how many friends I invited: done = finished their first day, waiting = not yet
create or replace function public.catloft_invite_stats()
returns table (done integer, waiting integer)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select count(*) filter (where done_at is not null)::int, count(*) filter (where done_at is null)::int
  from public.catloft_invites where inviter = auth.uid();
$$;

revoke all on function public.catloft_invite_who(text), public.catloft_invite_join(text), public.catloft_invite_done(), public.catloft_invite_stats() from public, anon, authenticated;
grant execute on function public.catloft_invite_who(text) to anon, authenticated;
grant execute on function public.catloft_invite_join(text), public.catloft_invite_done(), public.catloft_invite_stats() to authenticated;
