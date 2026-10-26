-- 喵型測驗網頁（/q/）拿玩家自己的好友碼，放進分享連結當邀請碼。
-- 只讀不改店的資料；還沒有好友碼的玩家先發一個（店名、天數從雲端存檔拿，其餘之後由遊戲的 catloft_me 補上）。
create or replace function public.catloft_my_code()
returns text
language plpgsql security definer set search_path to 'public', 'pg_temp'
as $$
declare me uuid := auth.uid(); v_code text; v_shop text; v_day integer;
begin
  if me is null then return null; end if;
  select code into v_code from public.catloft_players where user_id = me;
  if v_code is not null then return v_code; end if;
  select shop_name, day into v_shop, v_day from public.catloft_saves where user_id = me;
  if not found then return null; end if; -- never played: nothing to invite to
  loop
    v_code := (select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.catloft_players where code = v_code);
  end loop;
  insert into public.catloft_players (user_id, code, shop_name, lv, day, look, seen_at)
  values (me, v_code, coalesce(nullif(catloft_clean(v_shop, 12), ''), '貓咪咖啡廳'), 1, greatest(coalesce(v_day, 1), 1), '{}'::jsonb, now()) on conflict (user_id) do nothing;
  return (select code from public.catloft_players where user_id = me);
end $$;
revoke all on function public.catloft_my_code() from public;
grant execute on function public.catloft_my_code() to authenticated;
