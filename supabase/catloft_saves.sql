-- 暖陽貓閣 cloud save. Lives in the shared Supabase project next to the park_* tables;
-- everything this game owns is prefixed catloft_. One row per player (auth user).
create table if not exists public.catloft_saves (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  code       text not null check (length(code) < 400000),
  day        integer not null default 1,
  shop_name  text,
  updated_at timestamptz not null default now()
);

alter table public.catloft_saves enable row level security;

revoke all on public.catloft_saves from anon, authenticated;
grant select, insert, update on public.catloft_saves to authenticated;

drop policy if exists catloft_saves_select on public.catloft_saves;
drop policy if exists catloft_saves_insert on public.catloft_saves;
drop policy if exists catloft_saves_update on public.catloft_saves;
create policy catloft_saves_select on public.catloft_saves for select to authenticated using (user_id = (select auth.uid()));
create policy catloft_saves_insert on public.catloft_saves for insert to authenticated with check (user_id = (select auth.uid()));
create policy catloft_saves_update on public.catloft_saves for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
