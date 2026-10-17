-- 暖陽貓閣「好友」：好友碼加好友、到朋友店裡的招待室聊天、跟朋友合作。
-- 跟其他遊戲共用同一個 Supabase 專案，所以這裡的東西都叫 catloft_*。
-- 表都不開放直接讀寫（不讓人看到別人的 user_id），只能透過下面的函式，用 6 碼好友碼認人。
--   加好友：A 送出邀請 → B 也加 A（按「同意」）才算朋友。
--   去招待室：先敲門 → 主人按「讓他進來」才進得去，同意後 1 小時內有效（Chuck：「別人要同意才能過去」）。
--   聊天：只能選固定的句子和貼圖（小朋友也在玩），存的是編號，不存打字內容。
--   合作：兩個人都選對方才算合作；只讓兩家店客人變多，營業額各算各的，排行榜上看得到。

create table if not exists public.catloft_players (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  code      text not null unique,
  shop_name text not null default '貓咪咖啡廳',
  lv        integer not null default 1,
  day       integer not null default 1,
  look      jsonb not null default '{}'::jsonb,
  coop_with uuid references auth.users (id) on delete set null,
  seen_at   timestamptz not null default now()
);
create table if not exists public.catloft_friends ( -- one row per direction; a friendship is both rows
  from_id    uuid not null references auth.users (id) on delete cascade,
  to_id      uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create table if not exists public.catloft_visits ( -- guest knocks on host's door; host lets them in
  guest_id uuid not null references auth.users (id) on delete cascade,
  host_id  uuid not null references auth.users (id) on delete cascade,
  asked_at timestamptz not null default now(),
  ok_at    timestamptz,
  primary key (guest_id, host_id)
);
create table if not exists public.catloft_chat (
  id      bigint generated always as identity primary key,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id   uuid not null references auth.users (id) on delete cascade,
  kind    smallint not null check (kind between 0 and 1), -- 0 = preset phrase, 1 = sticker
  n       smallint not null check (n between 0 and 63),
  at      timestamptz not null default now(),
  seen    boolean not null default false
);
create index if not exists catloft_chat_pair on public.catloft_chat (from_id, to_id, id);
create index if not exists catloft_chat_unseen on public.catloft_chat (to_id) where not seen;

alter table public.catloft_players enable row level security;
alter table public.catloft_friends enable row level security;
alter table public.catloft_visits enable row level security;
alter table public.catloft_chat enable row level security;
revoke all on public.catloft_players, public.catloft_friends, public.catloft_visits, public.catloft_chat from anon, authenticated;

create or replace function public.catloft_clean(t text, n integer) returns text
language sql immutable set search_path to 'public', 'pg_temp'
as $$ select left(btrim(regexp_replace(coalesce(t, ''), '[<>&"''`\\]', '', 'g')), n) $$;

create or replace function public.catloft_uid(p_code text) returns uuid
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select user_id from public.catloft_players where code = upper(btrim(coalesce(p_code, ''))) $$;

create or replace function public.catloft_are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select exists (select 1 from public.catloft_friends where from_id = a and to_id = b)
         and exists (select 1 from public.catloft_friends where from_id = b and to_id = a) $$;

-- a door is open for an hour after the host lets the guest in
create or replace function public.catloft_door_open(guest uuid, host uuid) returns boolean
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select exists (select 1 from public.catloft_visits where guest_id = guest and host_id = host and ok_at > now() - interval '1 hour') $$;

-- keep my shop card up to date (shop name, level, manager, cats on duty) and get my friend code
create or replace function public.catloft_me(p_shop text, p_lv integer, p_day integer, p_look jsonb)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); v_code text; v_look jsonb; v_cats jsonb := '[]'::jsonb; c jsonb; i integer := 0;
begin
  if me is null then raise exception 'not signed in'; end if;
  for c in select * from jsonb_array_elements(case when jsonb_typeof(p_look -> 'cats') = 'array' then p_look -> 'cats' else '[]'::jsonb end) loop
    exit when i >= 8;
    if coalesce(c ->> 'id', '') ~ '^[a-z0-9_]{1,20}$' then
      v_cats := v_cats || jsonb_build_array(jsonb_build_object('id', c ->> 'id', 'nm', catloft_clean(c ->> 'nm', 8)));
      i := i + 1;
    end if;
  end loop;
  v_look := jsonb_build_object('mgr', catloft_clean(p_look ->> 'mgr', 8),
    'sex', case when p_look ->> 'sex' = 'm' then 'm' else 'f' end,
    'spr', case when coalesce(p_look ->> 'spr', '') ~ '^[a-z0-9]{1,8}$' then p_look ->> 'spr' else 'mgr' end,
    'cats', v_cats);
  select code into v_code from public.catloft_players where user_id = me;
  if v_code is null then
    loop
      v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
      exit when not exists (select 1 from public.catloft_players where code = v_code);
    end loop;
  end if;
  insert into public.catloft_players (user_id, code, shop_name, lv, day, look, seen_at)
  values (me, v_code, coalesce(nullif(catloft_clean(p_shop, 12), ''), '貓咪咖啡廳'), least(greatest(coalesce(p_lv, 1), 1), 99), greatest(coalesce(p_day, 1), 1), v_look, now())
  on conflict (user_id) do update set shop_name = excluded.shop_name, lv = excluded.lv, day = excluded.day, look = excluded.look, seen_at = now();
  return v_code;
end $$;

-- add by friend code: 'self' | 'none' | 'full' | 'sent' (waiting for them) | 'friends' (they had asked me already)
create or replace function public.catloft_friend_add(p_code text)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null then raise exception 'not signed in'; end if;
  if them is null then return 'none'; end if;
  if them = me then return 'self'; end if;
  if (select count(*) from public.catloft_friends where from_id = me) >= 50 then return 'full'; end if;
  insert into public.catloft_friends (from_id, to_id) values (me, them) on conflict do nothing;
  return case when exists (select 1 from public.catloft_friends where from_id = them and to_id = me) then 'friends' else 'sent' end;
end $$;

-- unfriend, decline a request, or cancel mine: drops both directions, the door and any cooperation between us
create or replace function public.catloft_friend_remove(p_code text)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null or them is null then return; end if;
  delete from public.catloft_friends where (from_id = me and to_id = them) or (from_id = them and to_id = me);
  delete from public.catloft_visits where (guest_id = me and host_id = them) or (guest_id = them and host_id = me);
  update public.catloft_players set coop_with = null where (user_id = me and coop_with = them) or (user_id = them and coop_with = me);
end $$;

-- everyone I know: friends and requests both ways, with door and cooperation state and unread messages
create or replace function public.catloft_friend_list()
returns table (code text, shop_name text, lv integer, day integer, rel text, door_in text, door_out text, coop text, unread integer, seen_at timestamptz)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  with me as (select auth.uid() as id, (select coop_with from public.catloft_players where user_id = auth.uid()) as coop),
  people as (
    select f.to_id as id from public.catloft_friends f, me where f.from_id = me.id
    union select f.from_id from public.catloft_friends f, me where f.to_id = me.id
  )
  select p.code, p.shop_name, p.lv, p.day,
    case when out_f.from_id is not null and in_f.from_id is not null then 'friend' when out_f.from_id is not null then 'sent' else 'asks' end,
    -- door_in: them visiting me; door_out: me visiting them ('' | 'knock' = waiting | 'open')
    case when vi.ok_at > now() - interval '1 hour' then 'open' when vi.ok_at is null and vi.asked_at > now() - interval '1 day' then 'knock' else '' end,
    case when vo.ok_at > now() - interval '1 hour' then 'open' when vo.ok_at is null and vo.asked_at > now() - interval '1 day' then 'knock' else '' end,
    case when me.coop = p.user_id and p.coop_with = me.id then 'on' when me.coop = p.user_id then 'sent' when p.coop_with = me.id then 'asks' else '' end,
    (select count(*)::int from public.catloft_chat c where c.from_id = p.user_id and c.to_id = me.id and not c.seen),
    p.seen_at
  from people x join public.catloft_players p on p.user_id = x.id cross join me
  left join public.catloft_friends out_f on out_f.from_id = me.id and out_f.to_id = p.user_id
  left join public.catloft_friends in_f on in_f.from_id = p.user_id and in_f.to_id = me.id
  left join public.catloft_visits vi on vi.guest_id = p.user_id and vi.host_id = me.id
  left join public.catloft_visits vo on vo.guest_id = me.id and vo.host_id = p.user_id
  order by 5 desc, p.seen_at desc;
$$;

-- knock on a friend's door; they have to let me in
create or replace function public.catloft_knock(p_code text)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null or them is null or not catloft_are_friends(me, them) then return 'no'; end if;
  if catloft_door_open(me, them) then return 'open'; end if;
  insert into public.catloft_visits (guest_id, host_id) values (me, them)
  on conflict (guest_id, host_id) do update set asked_at = now(), ok_at = null;
  return 'knock';
end $$;

-- host answers a knock: let them in (door open for an hour) or not
create or replace function public.catloft_answer(p_code text, p_yes boolean)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null or them is null then return; end if;
  if p_yes and catloft_are_friends(me, them) then
    update public.catloft_visits set ok_at = now() where guest_id = them and host_id = me;
  else
    delete from public.catloft_visits where guest_id = them and host_id = me;
  end if;
end $$;

-- the friend's shop card, readable while we're friends (to draw the reception room)
create or replace function public.catloft_card(p_code text)
returns table (code text, shop_name text, lv integer, day integer, look jsonb)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  select p.code, p.shop_name, p.lv, p.day, p.look from public.catloft_players p
  where p.code = upper(btrim(coalesce(p_code, ''))) and (p.user_id = auth.uid() or catloft_are_friends(auth.uid(), p.user_id));
$$;

-- chat only while one of us is in the other's reception room
create or replace function public.catloft_say(p_code text, p_kind integer, p_n integer)
returns boolean
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null or them is null or not catloft_are_friends(me, them) then return false; end if;
  if not (catloft_door_open(me, them) or catloft_door_open(them, me)) then return false; end if;
  if p_kind not between 0 and 1 or p_n not between 0 and 63 then return false; end if;
  if (select count(*) from public.catloft_chat where from_id = me and at > now() - interval '1 minute') >= 20 then return false; end if;
  insert into public.catloft_chat (from_id, to_id, kind, n) values (me, them, p_kind, p_n);
  delete from public.catloft_chat where at < now() - interval '30 days' and (from_id = me or to_id = me);
  return true;
end $$;

-- the last 40 messages between us; reading marks theirs as seen
create or replace function public.catloft_chat_read(p_code text)
returns table (mine boolean, kind smallint, n smallint, at timestamptz)
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null or them is null or not catloft_are_friends(me, them) then return; end if;
  update public.catloft_chat c set seen = true where c.from_id = them and c.to_id = me and not c.seen;
  return query select * from (
    select c.from_id = me, c.kind, c.n, c.at from public.catloft_chat c
    where (c.from_id = me and c.to_id = them) or (c.from_id = them and c.to_id = me)
    order by c.id desc limit 40) t order by 4;
end $$;

-- cooperate with one friend at a time (null to stop); it's on once both picked each other
create or replace function public.catloft_coop(p_code text)
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); them uuid := catloft_uid(p_code);
begin
  if me is null then raise exception 'not signed in'; end if;
  if them is null or not catloft_are_friends(me, them) then
    update public.catloft_players set coop_with = null where user_id = me; return '';
  end if;
  update public.catloft_players set coop_with = them where user_id = me;
  return case when exists (select 1 from public.catloft_players where user_id = them and coop_with = me) then 'on' else 'sent' end;
end $$;

-- 今日排行榜 now also names the shop each player is cooperating with (both picked each other)
drop function if exists public.catloft_board_today();
create function public.catloft_board_today()
returns table (rank bigint, shop_name text, revenue integer, day integer, lv integer, is_me boolean, partner text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$
  with r as (
    select row_number() over (order by b.revenue desc, b.updated_at) as rank, b.shop_name, b.revenue, b.day, b.lv,
           coalesce(b.user_id = auth.uid(), false) as is_me,
           (select q.shop_name from public.catloft_players p join public.catloft_players q on q.user_id = p.coop_with and q.coop_with = p.user_id
            where p.user_id = b.user_id) as partner
    from public.catloft_board b
    where b.play_date = (now() at time zone 'Asia/Taipei')::date
  )
  select * from r where r.rank <= 20 or r.is_me order by r.rank;
$$;

revoke all on function public.catloft_clean(text, integer), public.catloft_uid(text), public.catloft_are_friends(uuid, uuid), public.catloft_door_open(uuid, uuid) from public, anon, authenticated;
revoke all on function public.catloft_me(text, integer, integer, jsonb), public.catloft_friend_add(text), public.catloft_friend_remove(text), public.catloft_friend_list(),
  public.catloft_knock(text), public.catloft_answer(text, boolean), public.catloft_card(text), public.catloft_say(text, integer, integer), public.catloft_chat_read(text), public.catloft_coop(text) from public, anon;
grant execute on function public.catloft_me(text, integer, integer, jsonb), public.catloft_friend_add(text), public.catloft_friend_remove(text), public.catloft_friend_list(),
  public.catloft_knock(text), public.catloft_answer(text, boolean), public.catloft_card(text), public.catloft_say(text, integer, integer), public.catloft_chat_read(text), public.catloft_coop(text) to authenticated;
revoke all on function public.catloft_board_today() from public;
grant execute on function public.catloft_board_today() to anon, authenticated;
