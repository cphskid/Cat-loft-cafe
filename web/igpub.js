// 暖陽貓閣「喵IG」大家的貼文：把拍的照片分享給其他玩家，大家可以看、按讚、留言。
// 資料在 Supabase（supabase/catloft_ig.sql），只能透過那邊的函式讀寫。
//   標題（index.html 的 IG_CAPS）和留言（下面的 PHRASES / STICKERS）都只能選固定的，存的是編號：清單只能往後加，順序不能動。
//   別人按的讚會變成粉絲（每個讚 +1，收回讚也不會扣，粉絲只加不減）。
// 用到 index.html 的全域：G、S、CLOUD、started、toast、sfx、renderPhone、phoneApp、cleanName、ensurePlayer、IG_CAPS、FRIENDS、$。
(function () {
  const PHRASES = ['好可愛！', '好想去你的店！', '貓咪好萌～', '照片好漂亮', '店好溫馨', '我也想摸摸', '好熱鬧喔', '拍得好棒！',
    '是我最愛的店', '一起加油！', '下次去拜訪', '晚安～'];
  const STICKERS = ['😺', '😻', '😹', '🐾', '❤️', '🎉', '👍', '☕', '🍰', '🌙'];
  const P = { list: null, err: false, at: 0, busy: false, more: true, open: null, coms: {}, mine: {}, mineAt: 0, sure: 0 };

  const css = document.createElement('style');
  css.textContent = `
  .ig-tabs{display:flex;gap:6px}.ig-tabs button{flex:1;padding:7px}.ig-tabs button.on{background:var(--wood-d,#6B4A35);color:#fff;border-color:transparent}
  .ig-acts{display:flex;align-items:center;gap:8px;margin:4px 0}.ig-acts button{padding:4px 10px}
  .ig-like.on{background:#FCE4E8;border-color:#E0566E;color:#C2384F}
  .ig-say{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:4px;margin-top:6px}.ig-say button{padding:5px 2px;font-size:12px}
  .ig-st{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}.ig-st button{font-size:20px;padding:1px 7px;line-height:1.2}`;
  document.head.appendChild(css);

  const on = () => !!(CLOUD.sb && !CLOUD.db);
  const nm = t => cleanName(t, '貓咪咖啡廳', 12);
  const rpc = async (fn, args) => { const { data, error } = await CLOUD.sb.rpc(fn, args); if (error) throw error; return data; };
  const say = c => c.kind === 1 ? STICKERS[c.n] || '' : PHRASES[c.n] || '';
  const redraw = () => { if (!$('phoneOv').hidden && phoneApp === 'ig') renderPhone(); };
  async function ready() { if (!CLOUD.uid) await ensurePlayer(); if (window.FRIENDS) await FRIENDS.sync(); }

  // share a photo that was just posted in the game; p = the post in G.ig (gets p.sid)
  async function share(cap, img, p) {
    if (!on()) return;
    try {
      await ready();
      const id = await rpc('catloft_ig_post', { p_cap: cap, p_img: img });
      if (!id) { toast('今天已經分享 3 篇給大家了，這篇只有你看得到'); return; }
      p.sid = Number(id); p.rl = 0; P.at = 0; P.mineAt = 0; toast('📷 已經分享給其他玩家了');
    } catch { toast('連不上網路，這篇沒有分享出去，只有你看得到'); }
    redraw();
  }

  async function load(more) {
    if (!on() || P.busy) return;
    P.busy = true;
    try {
      await ready();
      const before = more && P.list && P.list.length ? P.list[P.list.length - 1].id : null;
      const rows = await rpc('catloft_ig_feed', { p_before: before }) || [];
      P.list = more ? (P.list || []).concat(rows) : rows; P.more = rows.length === 12; P.err = false;
    } catch { P.err = true; }
    P.busy = false; P.at = Date.now(); redraw();
  }
  // likes from other players on my shared posts → fans (never taken back)
  async function loadMine() {
    if (!on() || !CLOUD.uid || !G.ig.some(p => p.sid)) return;
    P.mineAt = Date.now();
    try {
      const rows = await rpc('catloft_ig_mine') || [];
      P.mine = Object.fromEntries(rows.map(r => [Number(r.id), { likes: Number(r.likes) || 0, comments: Number(r.comments) || 0 }]));
      let add = 0;
      for (const p of G.ig) { const m = p.sid && P.mine[p.sid]; if (m && m.likes > (p.rl || 0)) { add += m.likes - (p.rl || 0); p.rl = m.likes; } }
      if (add && started) { G.fans += add; S.today.fans += add; sfx('fan'); toast(`📷 其他玩家幫你的貼文按了 ${add} 個讚，粉絲 +${add}`); }
      redraw();
    } catch {}
  }
  setInterval(() => { if (started && on() && CLOUD.uid && document.visibilityState === 'visible') loadMine(); }, 60000);

  // the "real players" line under one of my own posts
  function mineLine(p) {
    if (!p.sid) return '';
    const m = P.mine[p.sid];
    return `<div class="sub">🌏 已分享給大家${m ? `・玩家的讚 ${m.likes}・玩家留言 ${m.comments}` : ''}</div>`;
  }

  function feedHtml() {
    if (!on()) return '<p class="muted">要連上網路才看得到其他玩家的貼文。</p>';
    if (Date.now() - P.at > 30000) { P.at = Date.now(); load(false); }
    let h = `<p class="muted" style="margin:0">其他玩家分享的店裡照片，可以按讚、用固定的句子和貼圖留言。在「我的貼文」發文時勾「分享給大家看」，你的照片也會出現在這裡。</p>`;
    if (!P.list) return h + `<p class="muted">${P.err ? '連不上網路，等一下再試試' : '載入中…'}</p>`;
    if (!P.list.length) return h + '<p class="muted">還沒有人分享照片，當第一個吧！</p>';
    for (const r of P.list) {
      const id = Number(r.id), cs = P.coms[id];
      h += `<div class="item"><div class="top"><span class="nm">@${nm(r.shop_name)}${r.mine ? '（你）' : ''}</span><span class="sub">${new Date(r.at).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span></div>
        ${/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.img) ? `<img src="${r.img}" alt="" style="width:100%;max-height:240px;object-fit:cover;border-radius:10px;display:block;margin:4px 0">` : ''}
        <div>${IG_CAPS[r.cap] || ''}</div>
        <div class="ig-acts"><button class="ig-like${r.liked ? ' on' : ''}" data-igl="${id}">${r.liked ? '♥' : '♡'} ${Number(r.likes) || 0}</button><button data-igc="${id}">💬 ${Number(r.comments) || 0}</button>
          ${r.mine ? `<button data-igd="${id}" style="margin-left:auto">${P.sure === id ? '確定收回？' : '收回'}</button>` : ''}</div>`;
      if (P.open === id) {
        h += cs ? (cs.length ? cs.map(c => `<div class="sub"><b>${nm(c.shop_name)}${c.mine ? '（你）' : ''}</b> <span style="${c.kind === 1 ? 'font-size:20px' : ''}">${say(c)}</span></div>`).join('') : '<div class="sub">還沒有留言</div>') : '<div class="sub">載入中…</div>';
        h += `<div class="ig-say">${PHRASES.map((t, i) => `<button data-igs="${id}:0:${i}">${t}</button>`).join('')}</div><div class="ig-st">${STICKERS.map((t, i) => `<button data-igs="${id}:1:${i}">${t}</button>`).join('')}</div>`;
      }
      h += '</div>';
    }
    if (P.more) h += `<div class="row" style="margin:0;justify-content:center"><button id="igMore"${P.busy ? ' disabled' : ''}>看更多</button></div>`;
    return h;
  }

  async function comments(id) {
    try { P.coms[id] = await rpc('catloft_ig_comments_of', { p_id: id }) || []; } catch { P.coms[id] = P.coms[id] || []; toast('連不上網路，等一下再試試'); }
    redraw();
  }
  function bind(sc) {
    const row = id => (P.list || []).find(r => Number(r.id) === id);
    sc.querySelectorAll('[data-igl]').forEach(b => b.onclick = async () => {
      const id = +b.dataset.igl, r = row(id); if (!r) return;
      r.liked = !r.liked; r.likes = Number(r.likes) + (r.liked ? 1 : -1); if (r.liked) sfx('fan'); redraw();
      try { await ready(); r.likes = await rpc('catloft_ig_like', { p_id: id, p_on: r.liked }); } catch { toast('連不上網路，等一下再試試'); }
      redraw();
    });
    sc.querySelectorAll('[data-igc]').forEach(b => b.onclick = () => { const id = +b.dataset.igc; P.open = P.open === id ? null : id; if (P.open) comments(id); redraw(); });
    sc.querySelectorAll('[data-igs]').forEach(b => b.onclick = async () => {
      const [id, kind, n] = b.dataset.igs.split(':').map(Number);
      try {
        await ready();
        const ok = await rpc('catloft_ig_comment', { p_id: id, p_kind: kind, p_n: n });
        if (!ok) toast('這篇你已經留了 5 則了'); else { sfx('notify'); const r = row(id); if (r) r.comments = Number(r.comments) + 1; }
      } catch { toast('連不上網路，等一下再試試'); }
      comments(id);
    });
    sc.querySelectorAll('[data-igd]').forEach(b => b.onclick = async () => {
      const id = +b.dataset.igd; if (P.sure !== id) { P.sure = id; redraw(); return; }
      P.sure = 0;
      try { if (await rpc('catloft_ig_delete', { p_id: id })) { P.list = P.list.filter(r => Number(r.id) !== id); for (const p of G.ig) if (p.sid === id) delete p.sid; toast('已經收回這篇貼文'); } } catch { toast('連不上網路，等一下再試試'); }
      redraw();
    });
    const more = sc.querySelector('#igMore'); if (more) more.onclick = () => load(true);
  }

  window.IGPUB = {
    on, share, feedHtml, bind, mineLine, refresh: loadMine,
    mineHtml: () => { if (Date.now() - P.mineAt > 30000) loadMine(); return ''; },
  };
})();
