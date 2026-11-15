// 管理者頁面「🏠 真實店貓」分頁（supabase/catloft_realcats.sql、supabase/functions/catloft-realcat-draw）。
// 一筆申請：看照片 → 「畫」（Gemini 照遊戲水彩畫法畫 5 個動作，通常畫兩排）→ 挑一排 → 上傳成 5 張遊戲圖
// → 通過（送給申請人）或退回（寫原因，玩家會收到訊息）。審核完超過 30 天的原始照片，打開這頁時自動刪掉。
// 用到 index.html 的全域：sb、SB_URL、rpc、esc、toast、when、$。
(function () {
  const PERS = ['黏人', '貪吃', '愛睡', '活潑', '害羞', '好奇', '優雅', '調皮'];
  const BASES = [['orange', '橘貓'], ['tux', '賓士貓'], ['fluffy', '白色長毛'], ['calico', '三花'], ['gray', '藍灰貓'], ['tabby', '虎斑'], ['milk', '暹羅']];
  const POSE = ['走路', '坐著', '睡覺', '玩耍', '翻肚'];
  const ART = id => `${SB_URL}/storage/v1/object/public/catloft-realcats/${id}/`;
  let list = [], drafts = {}, busy = {}, photoUrl = {};

  async function load() {
    const box = $('rcList'); if (!box) return;
    try { list = await rpc('catloft_admin_realcats') || []; }
    catch (e) { box.innerHTML = `<p style="color:var(--bad)">讀不到：${esc(e.message || e)}（資料庫還沒有 supabase/catloft_realcats.sql？）</p>`; return; }
    const n = list.filter(r => r.status === 'pending').length;
    $('rcTabN').textContent = n ? ` (${n})` : '';
    // signed links for the private photos (10 minutes)
    const need = [...new Set(list.filter(r => !r.photos_gone).flatMap(r => r.photos || []).filter(p => !photoUrl[p]))];
    if (need.length) { const { data } = await sb.storage.from('catloft-realcat-photos').createSignedUrls(need, 600); for (const x of data || []) if (x.signedUrl) photoUrl[x.path] = x.signedUrl; }
    render(); purge();
  }

  // 審核完 30 天以上的原始照片刪掉，只留水彩圖
  async function purge() {
    const old = list.filter(r => r.status !== 'pending' && !r.photos_gone && r.decided_at && Date.now() - new Date(r.decided_at) > 30 * 864e5);
    for (const r of old) {
      const { error } = await sb.storage.from('catloft-realcat-photos').remove(r.photos || []);
      if (!error) try { await rpc('catloft_admin_realcat_photos_gone', { p_id: r.id }); } catch {}
    }
  }

  const stat = r => r.status === 'pending' ? '<span class="tag">審核中</span>' : r.status === 'approved' ? '<span class="tag idea">已通過</span>' : '<span class="tag bug">已退回</span>';
  function card(r) {
    const d = drafts[r.id], pend = r.status === 'pending';
    const photos = r.photos_gone ? '<span class="muted">原始照片已刪除</span>' : (r.photos || []).map(p => photoUrl[p] ? `<a href="${photoUrl[p]}" target="_blank" rel="noopener"><img src="${photoUrl[p]}" alt="" style="width:120px;height:110px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"></a>` : '').join('');
    let art = '';
    if (d && d.rows) {
      art = `<p class="muted" style="margin:8px 0 4px">AI 畫好了，挑一排用（每排 5 個動作：${POSE.join('、')}）。都不像就再畫一次。</p>` +
        d.rows.map((row, i) => `<div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid ${d.pick === i ? 'var(--accent)' : 'var(--line)'};border-radius:10px;padding:8px;margin:6px 0">
          ${row.map(c => `<img src="${c.toDataURL()}" alt="" style="height:70px">`).join('')}<span style="flex:1"></span><button data-rcpick="${r.id}:${i}" class="${d.pick === i ? 'primary' : ''}">${d.pick === i ? '✓ 用這排' : '用這排'}</button></div>`).join('') +
        (d.rows.length ? `<div class="row" style="justify-content:flex-start;margin-top:6px"><label class="muted">圖片沒載到時的替身貓 <select data-rcbase="${r.id}">${BASES.map(([k, n]) => `<option value="${k}" ${d.base === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <button class="primary" data-rcup="${r.id}" ${d.pick == null ? 'disabled' : ''}>上傳這排當遊戲圖</button></div>` : '<p style="color:var(--bad)">切不出 4～5 隻分開的貓，請再畫一次。</p>') +
        `<details style="margin-top:6px"><summary class="muted">看 AI 原圖</summary><img src="${d.src}" alt="" style="max-width:100%;border-radius:8px"></details>`;
    } else if (r.art) {
      art = `<div style="display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;background:#fff;border:1px solid var(--line);border-radius:10px;padding:8px;margin-top:8px">${POSE.map((_, i) => `<img src="${ART(r.id)}${i}.webp?t=${d?.t || ''}" alt="" style="height:70px" onerror="this.style.opacity=.2">`).join('')}<span class="muted">遊戲裡的樣子</span></div>`;
    }
    const drawBtn = pend && !r.photos_gone ? `<button data-rcdraw="${r.id}" ${busy[r.id] ? 'disabled' : ''}>${busy[r.id] ? '🎨 畫圖中…（約 1 分鐘）' : r.art || d ? '🎨 重畫一次' : '🎨 開始畫'}</button>` : '';
    return `<div class="fb" id="rc${r.id}"><div style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start">
      <div style="display:flex;gap:6px;flex-wrap:wrap">${photos}</div>
      <div style="flex:1;min-width:240px">${stat(r)}<b style="font-size:18px">${esc(r.name)}</b>
        <span class="muted">　申請人：${esc(r.account || '（訪客）')}${r.day ? `（第 ${r.day} 天）` : ''}・${when(r.created_at)}</span><br>
        店名：${esc(r.shop)}${r.link ? `　｜　<a href="${esc(/^https?:\/\//.test(r.link) ? r.link : 'https://' + r.link)}" target="_blank" rel="noopener">${esc(r.link)}</a>` : ''}<br>
        個性：${(r.pers || []).map(p => PERS[p]).join('・')}${r.intro ? `　｜　「${esc(r.intro)}」` : ''}<br>
        ${r.public ? '<span class="tag idea">公開給其他玩家</span>' : '<span class="tag">不公開，只放在自己店裡</span>'}${r.status === 'rejected' ? `<span class="muted">退回原因：${esc(r.reason)}</span>` : ''}
      </div></div>
      ${art}
      ${pend ? `<div class="ans"><input data-rcname="${r.id}" value="${esc(r.name)}" maxlength="6" style="width:90px" title="名字"><input data-rcintro="${r.id}" value="${esc(r.intro)}" maxlength="30" style="flex:1 1 200px" title="一句話介紹">
        <input data-rcwhy="${r.id}" maxlength="100" placeholder="退回原因（例如：照片拍到客人的臉）" style="flex:1 1 220px"></div>
        <div class="row" style="margin-top:8px">${drawBtn}<button data-rcno="${r.id}">退回</button><button class="primary" data-rcok="${r.id}" ${r.art ? '' : 'disabled title="要先上傳水彩圖"'}>通過，送給玩家</button></div>` : ''}
    </div>`;
  }

  function render() {
    const box = $('rcList');
    box.innerHTML = `<p class="muted" style="margin-top:0">真的在開貓咪咖啡廳的玩家，在手機「我的真實店貓」申請。照片有拍到人臉、不是貓、或看起來不是自己店裡的貓，就退回並寫原因。原始照片在審核完 30 天後自動刪除。</p>` +
      (list.length ? list.map(card).join('') : '<p class="muted">還沒有人申請。</p>');
    box.querySelectorAll('[data-rcdraw]').forEach(b => b.onclick = () => draw(+b.dataset.rcdraw));
    box.querySelectorAll('[data-rcpick]').forEach(b => b.onclick = () => { const [id, i] = b.dataset.rcpick.split(':').map(Number); drafts[id].pick = i; render(); });
    box.querySelectorAll('[data-rcbase]').forEach(s => s.onchange = () => { drafts[+s.dataset.rcbase].base = s.value; });
    box.querySelectorAll('[data-rcup]').forEach(b => b.onclick = () => upload(+b.dataset.rcup, b));
    box.querySelectorAll('[data-rcok]').forEach(b => b.onclick = () => decide(+b.dataset.rcok, true, b));
    box.querySelectorAll('[data-rcno]').forEach(b => b.onclick = () => decide(+b.dataset.rcno, false, b));
  }

  async function draw(id) {
    busy[id] = true; render();
    try {
      const { data, error } = await sb.functions.invoke('catloft-realcat-draw', { body: { id } });
      const st = data?.status || (error && (await error.context?.json?.().catch(() => null))?.status) || 'error';
      if (st !== 'ok') toast({ nokey: 'Supabase 還沒有 GEMINI_API_KEY', nocat: 'AI 說照片裡看不到貓', nophoto: '找不到照片', notadmin: '不是管理者' }[st] || '畫不出來，再試一次（' + st + '）');
      else {
        const src = `data:${data.mime || 'image/png'};base64,${data.image}`, im = await loadImg(src);
        drafts[id] = { src, rows: cutSheet(im), pick: null, base: guessBase(data.desc || '') };
        if (drafts[id].rows.length === 1) drafts[id].pick = 0;
      }
    } catch (e) { toast('畫不出來：' + (e.message || e)); }
    busy[id] = false; render();
  }

  // pick the stand-in painted cat from the AI's description of the coat
  function guessBase(t) {
    t = t.toLowerCase();
    if (/siamese|colou?rpoint|point/.test(t)) return 'milk';
    if (/calico|tortoise|tortie/.test(t)) return 'calico';
    if (/tuxedo|black and white|black-and-white/.test(t)) return 'tux';
    if (/tabby|stripe/.test(t) && /orange|ginger|red/.test(t)) return 'orange';
    if (/tabby|stripe/.test(t)) return 'tabby';
    if (/(grey|gray|blue)/.test(t) && !/white base|mostly white/.test(t)) return 'gray';
    if (/long/.test(t) || /white/.test(t)) return 'fluffy';
    return 'orange';
  }

  const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src; });

  // ---- cut the AI sheet (cats on white) into rows of 5 transparent sprites ----
  // ink = not paper-white; close small gaps in the outline (R px), fill the inside, then split into connected figures
  function cutSheet(im) {
    const W = im.naturalWidth, H = im.naturalHeight, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(im, 0, 0);
    const px = cx.getImageData(0, 0, W, H).data, N = W * H;
    let m = new Uint8Array(N);
    for (let i = 0; i < N; i++) m[i] = Math.min(px[i * 4], px[i * 4 + 1], px[i * 4 + 2]) < 238 ? 1 : 0;
    const R = Math.round(Math.max(W, H) / 300);
    m = erode(dilate(m, W, H, R), W, H, R);
    // everything not reachable from the border through empty paper is part of a figure
    const out = new Uint8Array(N), st = [];
    for (let x = 0; x < W; x++) { st.push(x, (H - 1) * W + x); } for (let y = 0; y < H; y++) { st.push(y * W, y * W + W - 1); }
    while (st.length) { const i = st.pop(); if (out[i] || m[i]) continue; out[i] = 1; const x = i % W;
      if (x > 0) st.push(i - 1); if (x < W - 1) st.push(i + 1); if (i >= W) st.push(i - W); if (i < N - W) st.push(i + W); }
    let fg = new Uint8Array(N); for (let i = 0; i < N; i++) fg[i] = out[i] ? 0 : 1;
    fg = erode(fg, W, H, 2);
    // connected figures
    const lab = new Int32Array(N), comps = [];
    for (let s = 0; s < N; s++) {
      if (!fg[s] || lab[s]) continue;
      const c = { id: comps.length + 1, n: 0, x0: W, y0: H, x1: 0, y1: 0 }; lab[s] = c.id; st.push(s);
      while (st.length) { const i = st.pop(), x = i % W, y = (i - x) / W; c.n++;
        if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) if (j >= 0 && j < N && fg[j] && !lab[j]) { lab[j] = c.id; st.push(j); } }
      comps.push(c);
    }
    const big = Math.max(0, ...comps.map(c => c.n)), figs = comps.filter(c => c.n > big * .12);
    // rows: sort by vertical centre, start a new row when a figure's centre is below the current row's bottom
    figs.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
    const rows = [];
    for (const f of figs) { const r = rows[rows.length - 1], cy = (f.y0 + f.y1) / 2;
      if (r && cy < Math.max(...r.map(g => g.y1))) r.push(f); else rows.push([f]); }
    return rows.filter(r => r.length >= 4).map(r => {
      r.sort((a, b) => a.x0 - b.x0); r = r.slice(0, 5);
      const sp = r.map(c => sprite(cx, lab, c, W));
      if (sp.length === 4) sp.push(sp[2]); // no belly-up pose: use the sleeping one
      return sp;
    });
  }
  function sprite(cx, lab, c, W) {
    const w = c.x1 - c.x0 + 1, h = c.y1 - c.y0 + 1, d = cx.getImageData(c.x0, c.y0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lab[(c.y0 + y) * W + c.x0 + x] !== c.id) d.data[(y * w + x) * 4 + 3] = 0;
    const o = document.createElement('canvas'); o.width = w; o.height = h; o.getContext('2d').putImageData(d, 0, 0);
    // soften the cut edge a little
    const s = document.createElement('canvas'); s.width = w; s.height = h; const sx = s.getContext('2d');
    sx.filter = 'blur(0.6px)'; sx.drawImage(o, 0, 0); sx.filter = 'none'; sx.globalCompositeOperation = 'source-atop'; sx.drawImage(o, 0, 0);
    return s;
  }
  // box dilate / erode with a summed-area table
  function boxAny(m, W, H, R, want) {
    const S = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y++) { let row = 0; for (let x = 0; x < W; x++) { row += m[y * W + x] === want ? 1 : 0; S[(y + 1) * (W + 1) + x + 1] = S[y * (W + 1) + x + 1] + row; } }
    const o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) { const ya = Math.max(0, y - R), yb = Math.min(H, y + R + 1);
      for (let x = 0; x < W; x++) { const xa = Math.max(0, x - R), xb = Math.min(W, x + R + 1);
        o[y * W + x] = S[yb * (W + 1) + xb] - S[ya * (W + 1) + xb] - S[yb * (W + 1) + xa] + S[ya * (W + 1) + xa] > 0 ? 1 : 0; } }
    return o;
  }
  const dilate = (m, W, H, R) => boxAny(m, W, H, R, 1);
  const erode = (m, W, H, R) => { const o = boxAny(m, W, H, R, 0); for (let i = 0; i < o.length; i++) o[i] = o[i] ? 0 : 1; return o; };

  // scale like the painted cats (walking pose 160 px wide), then upload 0..4.webp
  async function upload(id, btn) {
    const d = drafts[id]; if (!d || d.pick == null) return;
    btn.disabled = true; btn.textContent = '上傳中…';
    try {
      const row = d.rows[d.pick], s = 160 / row[0].width;
      for (let i = 0; i < 5; i++) {
        const c = row[i], o = document.createElement('canvas'); o.width = Math.round(c.width * s); o.height = Math.round(c.height * s);
        const ox = o.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(c, 0, 0, o.width, o.height);
        const blob = await new Promise(ok => o.toBlob(ok, 'image/webp', .9));
        const { error } = await sb.storage.from('catloft-realcats').upload(`${id}/${i}.webp`, blob, { upsert: true, contentType: blob.type, cacheControl: '300' });
        if (error) throw error;
      }
      await rpc('catloft_admin_realcat_art', { p_id: id, p_base: d.base });
      drafts[id] = { t: Date.now() }; // no rows any more: the card shows the uploaded pictures (cache-busted)
      toast('上傳好了，看一下沒問題就可以按「通過」');
      await load();
    } catch (e) { toast('上傳失敗：' + (e.message || e)); btn.disabled = false; btn.textContent = '上傳這排當遊戲圖'; }
  }

  async function decide(id, ok, btn) {
    const q = s => document.querySelector(`[data-rc${s}="${id}"]`)?.value ?? '';
    if (!ok && !q('why').trim()) { toast('退回要寫原因，玩家會看到'); document.querySelector(`[data-rcwhy="${id}"]`)?.focus(); return; }
    btn.disabled = true;
    try {
      await rpc('catloft_admin_realcat_decide', { p_id: id, p_ok: ok, p_reason: q('why'), p_name: q('name'), p_intro: q('intro') });
      toast(ok ? '通過了！玩家下次開遊戲會收到這隻店貓' : '已退回，玩家會收到原因');
      load();
    } catch (e) { toast('沒有成功：' + (e.message || e)); btn.disabled = false; }
  }

  window.REALCATS_ADMIN = { load };
})();
