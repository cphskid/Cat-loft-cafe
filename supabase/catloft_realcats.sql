-- 暖陽貓閣「真實店貓」（2026-11-15）。
-- Chuck：「現在有玩家是真的在開貓咪咖啡廳的，有什麼辦法可以更滿足他們？」→ 讓他們把自己店裡的貓放進遊戲。
-- 流程：
--   1. 玩家在手機 app「我的真實店貓」上傳 1～3 張照片（catloft-realcat-photos/<自己的 uid>/…，不公開）、
--      填名字、兩種個性、一句話介紹、店名、地址或 IG，勾要不要公開 → catloft_realcat_apply。
--   2. 管理者頁面「真實店貓」分頁：Edge Function catloft-realcat-draw 用 Gemini 照遊戲的水彩畫法畫出 5 個動作，
--      管理者在網頁上切好、上傳到 catloft-realcats/<id>/0..4.webp（公開），再「通過」或「退回」→ catloft_admin_realcat_decide。
--   3. 通過時寫一筆禮物 {realcat: id} 給申請人（web/gifts.js 顯示「管理者送來一隻真實店貓」，玩家選收下或不要）；
--      退回時寫一則訊息禮物，附上原因。
--   4. 公開的店貓列在其他玩家的「喵喵家族 → 真實店貓」，¥1,200 領養，點店名可以打開地址或 IG。
-- 隱私：原始照片只有本人和管理者看得到；管理者頁面打開時會刪掉審核完超過 30 天的照片（photos_gone）。
-- 一個帳號同時最多 5 筆還沒被退回的申請。

create table if not exists public.catloft_realcats (
  id          bigint generated always as identity primary key,
  owner       uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 6),
  pers        smallint[] not null check (array_length(pers, 1) between 1 and 2),
  intro       text not null default '' check (char_length(intro) <= 30),
  shop        text not null check (char_length(shop) between 1 and 20),
  link        text not null default '' check (char_length(link) <= 120),
  public      boolean not null default true,
  photos      text[] not null default '{}',
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reason      text not null default '',
  base        text not null default 'orange',   -- 圖片沒載到時，遊戲用哪一隻畫好的貓當替身
  art         boolean not null default false,   -- 5 張水彩圖已經上傳了
  photos_gone boolean not null default false,
  created_at  timestamptz not null default now(),
  decided_at  timestamptz
);
create index if not exists catloft_realcats_owner on public.catloft_realcats (owner);
alter table public.catloft_realcats enable row level security;
revoke all on public.catloft_realcats from anon, authenticated;

-- 存儲：照片不公開（本人上傳到自己的資料夾、本人和管理者可以看），水彩圖公開（只有管理者能放）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catloft-realcat-photos', 'catloft-realcat-photos', false, 1500000, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catloft-realcats', 'catloft-realcats', true, 1500000, array['image/webp', 'image/png'])
on conflict (id) do nothing;

drop policy if exists "catloft realcat photos: upload own" on storage.objects;
create policy "catloft realcat photos: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'catloft-realcat-photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "catloft realcat photos: read own or admin" on storage.objects;
create policy "catloft realcat photos: read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'catloft-realcat-photos' and ((storage.foldername(name))[1] = auth.uid()::text or public.catloft_is_admin()));
drop policy if exists "catloft realcat photos: admin delete" on storage.objects;
create policy "catloft realcat photos: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'catloft-realcat-photos' and public.catloft_is_admin());
drop policy if exists "catloft realcats art: admin write" on storage.objects;
create policy "catloft realcats art: admin write" on storage.objects for insert to authenticated
  with check (bucket_id = 'catloft-realcats' and public.catloft_is_admin());
drop policy if exists "catloft realcats art: admin update" on storage.objects;
create policy "catloft realcats art: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'catloft-realcats' and public.catloft_is_admin());
drop policy if exists "catloft realcats art: admin read" on storage.objects;
create policy "catloft realcats art: admin read" on storage.objects for select to authenticated
  using (bucket_id = 'catloft-realcats' and public.catloft_is_admin());
drop policy if exists "catloft realcats art: admin delete" on storage.objects;
create policy "catloft realcats art: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'catloft-realcats' and public.catloft_is_admin());

-- 文字清理用現有的 catloft_clean(t, n)（supabase/catloft_friends.sql）：去掉 HTML 會用到的字元、頭尾空白、截長度

create or replace function public.catloft_realcat_apply(p_name text, p_pers int[], p_intro text, p_shop text, p_link text, p_public boolean, p_photos text[])
returns bigint
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare v_id bigint; v_name text := public.catloft_clean(p_name, 6); v_shop text := public.catloft_clean(p_shop, 20);
        v_pers smallint[]; v_photos text[];
begin
  if auth.uid() is null then raise exception '要先登入帳號'; end if;
  if not exists (select 1 from public.catloft_saves where user_id = auth.uid()) then raise exception '要先登入帳號'; end if;
  if v_name = '' then raise exception '貓咪名字還沒填'; end if;
  if v_shop = '' then raise exception '店名還沒填'; end if;
  select array_agg(distinct x)::smallint[] into v_pers from unnest(coalesce(p_pers, '{}')) x where x between 0 and 7;
  if v_pers is null or array_length(v_pers, 1) not between 1 and 2 then raise exception '個性要選 1～2 個'; end if;
  select array_agg(x) into v_photos from unnest(coalesce(p_photos, '{}')) x
   where x like auth.uid()::text || '/%' and x ~ '^[0-9a-f-]+/[A-Za-z0-9_.-]+$';
  if v_photos is null or array_length(v_photos, 1) not between 1 and 3 then raise exception '照片要 1～3 張'; end if;
  if (select count(*) from public.catloft_realcats where owner = auth.uid() and status <> 'rejected') >= 5 then
    raise exception '一個帳號最多 5 隻真實店貓（審核中的也算）';
  end if;
  insert into public.catloft_realcats (owner, name, pers, intro, shop, link, public, photos)
  values (auth.uid(), v_name, v_pers, public.catloft_clean(p_intro, 30), v_shop, public.catloft_clean(p_link, 120), coalesce(p_public, true), v_photos)
  returning id into v_id;
  return v_id;
end $$;

-- 我的申請（手機 app 顯示審核中／通過／退回和原因）
create or replace function public.catloft_my_realcats()
returns table (id bigint, name text, pers smallint[], intro text, shop text, link text, public boolean, status text, reason text, base text, created_at timestamptz)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select r.id, r.name, r.pers, r.intro, r.shop, r.link, r.public, r.status, r.reason, r.base, r.created_at
        from public.catloft_realcats r where r.owner = auth.uid() order by r.id desc $$;

-- 公開的店貓（喵喵家族 → 真實店貓），不含申請人是誰
create or replace function public.catloft_realcats_public()
returns table (id bigint, name text, pers smallint[], intro text, shop text, link text, base text)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select r.id, r.name, r.pers, r.intro, r.shop, r.link, r.base from public.catloft_realcats r
        where r.status = 'approved' and r.art and r.public order by r.decided_at desc limit 200 $$;

-- 收禮物時拿一隻通過的店貓（不公開的只有申請人自己拿得到）
create or replace function public.catloft_realcat_get(p_id bigint)
returns table (id bigint, name text, pers smallint[], intro text, shop text, link text, base text, mine boolean)
language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select r.id, r.name, r.pers, r.intro, r.shop, r.link, r.base, r.owner = auth.uid() from public.catloft_realcats r
        where r.id = p_id and r.status = 'approved' and r.art and (r.public or r.owner = auth.uid()) $$;

-- 管理者：所有申請
create or replace function public.catloft_admin_realcats()
returns table (id bigint, owner uuid, account text, day integer, name text, pers smallint[], intro text, shop text, link text, public boolean,
               photos text[], status text, reason text, base text, art boolean, photos_gone boolean, created_at timestamptz, decided_at timestamptz)
language plpgsql stable security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  return query
    select r.id, r.owner, nullif(btrim(u.raw_user_meta_data ->> 'name'), ''), s.day, r.name, r.pers, r.intro, r.shop, r.link, r.public,
           r.photos, r.status, r.reason, r.base, r.art, r.photos_gone, r.created_at, r.decided_at
      from public.catloft_realcats r
      join auth.users u on u.id = r.owner
      left join public.catloft_saves s on s.user_id = r.owner
     order by (r.status = 'pending') desc, r.id desc limit 300;
end $$;

-- 管理者：上傳完 5 張水彩圖之後標記，順便記下替身貓
create or replace function public.catloft_admin_realcat_art(p_id bigint, p_base text)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  if p_base not in ('orange', 'tux', 'fluffy', 'calico', 'gray', 'tabby', 'milk') then raise exception '替身貓不對'; end if;
  update public.catloft_realcats set art = true, base = p_base where id = p_id;
  if not found then raise exception '找不到這筆申請'; end if;
end $$;

-- 管理者：通過（可以順便改名字、介紹）或退回（要寫原因）
create or replace function public.catloft_admin_realcat_decide(p_id bigint, p_ok boolean, p_reason text, p_name text, p_intro text)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare r public.catloft_realcats; v_reason text := public.catloft_clean(p_reason, 100);
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  select * into r from public.catloft_realcats where id = p_id for update;
  if not found then raise exception '找不到這筆申請'; end if;
  if r.status <> 'pending' then raise exception '這筆已經處理過了'; end if;
  if p_ok then
    if not r.art then raise exception '還沒有上傳水彩圖'; end if;
    update public.catloft_realcats
       set status = 'approved', decided_at = now(), reason = '',
           name = coalesce(nullif(public.catloft_clean(p_name, 6), ''), name),
           intro = case when p_intro is null then intro else public.catloft_clean(p_intro, 30) end
     where id = p_id;
    insert into public.catloft_gifts (to_id, gift, note) values (r.owner, jsonb_build_object('realcat', p_id), '');
  else
    if v_reason = '' then raise exception '退回要寫原因'; end if;
    update public.catloft_realcats set status = 'rejected', decided_at = now(), reason = v_reason where id = p_id;
    insert into public.catloft_gifts (to_id, gift, note)
    values (r.owner, jsonb_build_object('msg', true), left('你申請的真實店貓「' || r.name || '」沒有通過：' || v_reason || '。可以到手機「我的真實店貓」重新申請。', 200));
  end if;
end $$;

-- 管理者：照片刪掉之後標記
create or replace function public.catloft_admin_realcat_photos_gone(p_id bigint)
returns void
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.catloft_is_admin() then raise exception 'not admin'; end if;
  update public.catloft_realcats set photos_gone = true where id = p_id;
end $$;

revoke all on function public.catloft_realcat_apply(text, int[], text, text, text, boolean, text[]), public.catloft_my_realcats(),
  public.catloft_realcats_public(), public.catloft_realcat_get(bigint), public.catloft_admin_realcats(), public.catloft_admin_realcat_art(bigint, text),
  public.catloft_admin_realcat_decide(bigint, boolean, text, text, text), public.catloft_admin_realcat_photos_gone(bigint) from public, anon;
grant execute on function public.catloft_realcat_apply(text, int[], text, text, text, boolean, text[]), public.catloft_my_realcats(),
  public.catloft_realcats_public(), public.catloft_realcat_get(bigint), public.catloft_admin_realcats(), public.catloft_admin_realcat_art(bigint, text),
  public.catloft_admin_realcat_decide(bigint, boolean, text, text, text), public.catloft_admin_realcat_photos_gone(bigint) to authenticated;
