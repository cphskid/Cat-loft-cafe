// 暖陽貓閣「真實店貓」畫圖（2026-11-15，supabase/catloft_realcats.sql）。
// 管理者頁面按「畫」→ 這裡：
//   1. 確認呼叫的人是管理者（catloft_is_admin，用呼叫者自己的登入）
//   2. 從不公開的 catloft-realcat-photos 拿申請人的第一張照片
//   3. Gemini 文字模型先把貓的花色寫成一段英文（只寫花色、斑塊位置、眼睛顏色、體型），畫圖時花色才不會亂掉
//   4. Gemini 圖片模型照遊戲的水彩畫法（web/assets/realcat_ref.webp：橘子和黑豆的 5 個動作）畫這隻貓的 5 個動作
// 回傳 PNG（base64），切圖、挑上排或下排、上傳都在管理者網頁上做。
// 需要 Supabase secret GEMINI_API_KEY（網頁裡不放金鑰）。部署時 verify_jwt = false（新的 sb_publishable 金鑰下由這裡自己用 catloft_is_admin 檢查登入的人）。
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const ORIGINS = ['https://catloftcafe.ciyulab.com', 'https://cphskid.github.io', 'http://localhost:8000', 'http://127.0.0.1:8000'];
const REF_URL = Deno.env.get('REALCAT_REF_URL') || 'https://catloftcafe.ciyulab.com/assets/realcat_ref.webp';
const TEXT_MODEL = Deno.env.get('REALCAT_TEXT_MODEL') || 'gemini-flash-latest';
const IMAGE_MODEL = Deno.env.get('REALCAT_IMAGE_MODEL') || 'gemini-3-pro-image';
const API = 'https://generativelanguage.googleapis.com/v1beta/models/';

function b64(buf: ArrayBuffer) {
  const u = new Uint8Array(buf); let s = '';
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
  return btoa(s);
}

async function gemini(model: string, parts: unknown[], image: boolean) {
  const body: Record<string, unknown> = { contents: [{ parts }] };
  if (image) body.generationConfig = { responseModalities: ['IMAGE', 'TEXT'], imageConfig: { aspectRatio: '21:9', imageSize: '2K' } };
  const r = await fetch(API + model + ':generateContent', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': Deno.env.get('GEMINI_API_KEY')! }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error('gemini ' + r.status + ' ' + (await r.text()).slice(0, 200));
  const d = await r.json();
  return (d.candidates?.[0]?.content?.parts || []) as { text?: string; inlineData?: { data: string; mimeType: string } }[];
}

Deno.serve(async req => {
  const origin = req.headers.get('origin') || '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
  const reply = (o: Record<string, unknown>, code = 200) => new Response(JSON.stringify(o), { status: code, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply({ status: 'method' }, 405);
  if (!Deno.env.get('GEMINI_API_KEY')) return reply({ status: 'nokey' }, 500);

  let id = 0;
  try { id = Math.floor(Number((await req.json()).id)); } catch { return reply({ status: 'bad' }, 400); }
  if (!(id > 0)) return reply({ status: 'bad' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  const me = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') || '' } }, auth: { persistSession: false } });
  const { data: isAdmin } = await me.rpc('catloft_is_admin');
  if (isAdmin !== true) return reply({ status: 'notadmin' }, 403);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: row, error } = await admin.from('catloft_realcats').select('photos, photos_gone').eq('id', id).single();
  if (error || !row) return reply({ status: 'notfound' }, 404);
  if (row.photos_gone || !row.photos?.length) return reply({ status: 'nophoto' }, 410);

  try {
    const { data: file, error: fe } = await admin.storage.from('catloft-realcat-photos').download(row.photos[0]);
    if (fe || !file) return reply({ status: 'nophoto' }, 410);
    const photo = { inline_data: { mime_type: file.type || 'image/jpeg', data: b64(await file.arrayBuffer()) } };
    const refRes = await fetch(REF_URL);
    if (!refRes.ok) throw new Error('ref ' + refRes.status);
    const ref = { inline_data: { mime_type: 'image/webp', data: b64(await refRes.arrayBuffer()) } };

    const descParts = await gemini(TEXT_MODEL, [photo, { text:
      "Describe only this cat's appearance for an illustrator, in one compact English paragraph under 70 words: fur length, base colour, every patch/marking and exactly where it is (which side of face, ears, back, legs, tail), eye colour, body build. Use the cat's own left/right. No background, no mood. If there is no cat in the photo, reply exactly NOCAT." }], false);
    const desc = (descParts.map(p => p.text || '').join(' ').trim() || '').replace(/\s+/g, ' ').slice(0, 700);
    if (!desc || /^NOCAT/i.test(desc)) return reply({ status: 'nocat' });

    const prompt = 'Image 1 is a STYLE and POSE reference only: two different cartoon cats, each drawn in the same five poses, in a soft hand-drawn watercolor storybook style with thin warm-brown outlines on white. ' +
      'Image 2 is a photo of a real cat. Draw the cat from the photo in each of the five poses, left to right: 1 walking to the right, 2 sitting facing right, 3 curled up asleep, 4 standing on hind legs pawing up to the right, 5 lying on its back belly up. ' +
      'Copy the drawing style, line weight, proportions and simple cute face of image 1 exactly, but use ONLY the coat of the cat in the photo: ' + desc +
      ' Do not copy the stripes or colours of the reference cats. Pure white background, every figure clearly separated, no shadows, no text, no people, no furniture.';
    const parts = await gemini(IMAGE_MODEL, [ref, photo, { text: prompt }], true);
    const img = parts.find(p => p.inlineData)?.inlineData;
    if (!img) return reply({ status: 'noimage' }, 502);
    return reply({ status: 'ok', desc, mime: img.mimeType, image: img.data });
  } catch (e) {
    return reply({ status: 'error', detail: String(e).slice(0, 200) }, 502);
  }
});
