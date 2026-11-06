// 暖陽貓閣「忘記密碼」寄信（2026-11-06）。
// 玩家在遊戲裡填帳號名稱 + 綁定的 email → 這裡呼叫 catloft_reset_issue（supabase/catloft_account.sql）拿一次性的重設碼，
// 再用 Resend 從 catloftcafe@ciyulab.com 寄出 https://catloftcafe.ciyulab.com/?reset=<重設碼>（30 分鐘內有效）。
// RESEND_API_KEY 跟時光冒險樂園的 send-mail 共用同一個 Supabase secret；ciyulab.com 網域已經在 Resend 驗證過。
// 部署時 verify_jwt = false（還沒登入的人也要能用）。
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const FROM = '暖陽貓閣 <catloftcafe@ciyulab.com>';
const REPLY_TO = 'timepark@ciyulab.com'; // catloftcafe@ 沒有收信箱；Chuck 2026-11-06：玩家回信先收到 timepark 的信箱
const SITE = 'https://catloftcafe.ciyulab.com/';
const ORIGINS = ['https://catloftcafe.ciyulab.com', 'https://cphskid.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const reply = (status: string, code = 200) => new Response(JSON.stringify({ status }), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply('method', 405);

  let name = '', email = '';
  try { const b = await req.json(); name = String(b.name || '').slice(0, 20); email = String(b.email || '').slice(0, 120); } catch { return reply('bad', 400); }
  if (!name.trim() || !email.trim()) return reply('nomatch');

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data, error } = await admin.rpc('catloft_reset_issue', { p_name: name, p_email: email });
  if (error) return reply('error', 500);
  if (data?.status !== 'ok') return reply(data?.status || 'nomatch');

  const link = SITE + '?reset=' + data.token;
  const acct = esc(String(data.account || name));
  const html = `<div style="font-family:sans-serif;max-width:480px;margin:auto;color:#4a3626;line-height:1.7">
  <h2 style="color:#8a5a3b">暖陽貓閣・重設密碼</h2>
  <p>有人（希望是你）幫帳號「<b>${acct}</b>」申請重設密碼。</p>
  <p><a href="${link}" style="display:inline-block;background:#e0894f;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">設定新密碼</a></p>
  <p style="font-size:13px;color:#8a7766">這個連結 30 分鐘內有效，只能用一次。如果不是你申請的，不用理這封信，密碼不會改變。<br>有問題可以直接回覆這封信。</p></div>`;
  const text = `暖陽貓閣・重設密碼\n\n帳號「${data.account || name}」申請重設密碼，請在 30 分鐘內打開下面的連結設定新密碼：\n${link}\n\n如果不是你申請的，不用理這封信，密碼不會改變。有問題可以直接回覆這封信。`;

  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [email.trim().toLowerCase()], subject: '暖陽貓閣：重設密碼的連結', html, text, reply_to: REPLY_TO }),
  });
  return reply(r.ok ? 'ok' : 'mailfail', r.ok ? 200 : 502);
});
