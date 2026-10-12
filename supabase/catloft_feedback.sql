-- 暖陽貓閣「💬 問題回報」。
-- 跟時光冒險樂園一樣寫進同一張 feedback 表（樂園、守護異世界、島嶼開拓者共用），
-- 所以回報都在樂園老師後台 teacher.html#feedback 的同一個收件匣，context.game = 'catloft'。
-- 樂園的 submit_feedback 只收樂園的學生和老師；貓閣玩家是自己的帳號（匿名或帳號名稱），
-- 所以另外開 catloft_submit_feedback，身分記成 role = 'player'。
-- 讀「我的回報」和標成已讀直接用樂園原本的 my_feedback / seen_my_feedback（比對 user_id）。
-- 老師只看得到自己班學生（role = 'student'）的回報，貓閣玩家的回報只有管理員看得到。

alter table public.feedback drop constraint if exists feedback_role_check;
alter table public.feedback add constraint feedback_role_check
  check (role = any (array['student', 'teacher', 'admin', 'player']));

create or replace function public.catloft_submit_feedback(p_kind text, p_message text, p_screen text, p_context jsonb)
returns bigint
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_msg text := btrim(coalesce(p_message, ''));
        v_who text;
        v_id bigint;
begin
  if auth.uid() is null then raise exception '請先登入再回報'; end if;
  if v_msg = '' then raise exception '請寫一下發生什麼事'; end if;
  if char_length(v_msg) > 500 then raise exception '寫太長了，500 字以內'; end if;
  if p_kind not in ('bug', 'confusing', 'idea') then raise exception '分類不對'; end if;
  if (select count(*) from public.feedback f
       where f.user_id = auth.uid() and f.created_at > now() - interval '1 hour') >= 10 then
    raise exception '一小時最多回報 10 則，晚一點再試';
  end if;

  -- 有帳號名稱就用帳號名稱，匿名玩家記店名
  select nullif(btrim(u.raw_user_meta_data ->> 'name'), '') into v_who from auth.users u where u.id = auth.uid();
  v_who := coalesce(v_who, nullif(left(btrim(p_context ->> 'shop'), 20), ''), '貓閣玩家');

  insert into public.feedback (user_id, who, role, kind, message, screen, context)
  values (auth.uid(), left(v_who, 30), 'player', p_kind, v_msg,
          left(p_screen, 40),
          -- context 是前端送的，只是參考；限大小免得塞一大包進來；game 一定是 catloft
          (case when pg_column_size(p_context) <= 4000 then coalesce(p_context, '{}'::jsonb)
                else '{}'::jsonb end) || jsonb_build_object('game', 'catloft'))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.catloft_submit_feedback(text, text, text, jsonb) from public, anon;
grant execute on function public.catloft_submit_feedback(text, text, text, jsonb) to authenticated;
