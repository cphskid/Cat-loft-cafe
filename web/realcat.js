// 暖陽貓閣「真實店貓」（2026-11-15，supabase/catloft_realcats.sql）。
// Chuck：「現在有玩家是真的在開貓咪咖啡廳的，有什麼辦法可以更滿足他們？」→ 讓他們把自己店裡的貓放進遊戲。
//   - 手機 app「我的真實店貓」：上傳 1～3 張照片、名字、兩種個性、一句話介紹、店名、地址或 IG、要不要公開 → 管理者審核。
//   - 管理者畫好水彩圖、通過後，用「管理者的禮物」送來（offerGift，web/gifts.js 呼叫）：收下 → 從大門走進店裡。
//     自己的店貓不能送養；頭上（腳下）有「🏠 名字・店名」小牌子（index.html drawCat）。
//   - 喵喵家族「真實店貓」分頁：大家公開的店貓，¥1,200 領養，點店名打開地址或 IG。
// 貓咪資料存在存檔的 G.real（index.html readReal / regReal），圖片在 Supabase 公開儲存（REAL_ART）。
// 用到 index.html 的全域：G、S、CLOUD、PERSONAS、CAT_DEFS、REAL_PRICE、REAL_ART、REALTAG、readReal、regReal、welcomeCat、
//   catNameOf、yen、toast、sfx、saveProgress、renderPhone、closeChoose、cleanName、$。
(function () {
  const MAX_PHOTOS = 3;
  const IN = 'display:block;width:100%;box-sizing:border-box;margin-top:4px;font:inherit;font-size:15px;font-weight:400;padding:8px 10px;border:1.5px solid var(--wood-l);border-radius:10px;background:#fff;color:var(--ink)';
  const F = { name: '', pers: [], intro: '', shop: '', link: '', pub: true, agree: false, photos: [], sending: false };
  let mine = null, pub = null, loading = { mine: false, pub: false };
  const on = () => !!(CLOUD.sb && !CLOUD.db && CLOUD.uid);
  const key = id => 'r' + id;
  const href = l => /^https?:\/\//i.test(l) ? l : 'https://' + l;
  const persName = p => (p || []).map(n => PERSONAS[n] ? PERSONAS[n].name : '').filter(Boolean).join('・');
  const pic = (id, h = 70) => `<img src="${REAL_ART(id)}1.webp" alt="" style="width:${Math.round(h * .8)}px;height:${h}px;object-fit:contain;background:#FBF4EA;border-radius:10px;flex:none" onerror="this.style.visibility='hidden'">`;
  const clean = (v, n) => cleanName(v, '', n);

  async function loadMine() {
    if (!on() || loading.mine) return; loading.mine = true;
    try { const { data, error } = await CLOUD.sb.rpc('catloft_my_realcats'); if (!error) mine = data || []; } catch {}
    loading.mine = false; if (!$('phoneOv').hidden && phoneApp === 'realcat') renderPhone();
  }
  async function loadPub() {
    if (!on() || loading.pub) return; loading.pub = true;
    try { const { data, error } = await CLOUD.sb.rpc('catloft_realcats_public'); if (!error) pub = data || []; } catch {}
    loading.pub = false; if (!$('phoneOv').hidden && phoneApp === 'cats' && S.catTab === 'real') renderPhone();
  }

  // ---------- 手機 app 「我的真實店貓」 ----------
  function sub() {
    if (mine && mine.some(r => r.status === 'pending')) return '審核中';
    return '把你店裡的貓送進遊戲';
  }
  const STATUS = { pending: ['審核中', '#D9A23A'], approved: ['已通過', '#6E9B4E'], rejected: ['沒有通過', '#C65445'] };
  function appHtml() {
    if (mine == null) loadMine();
    let h = `<div class="item" style="background:#FBF4EA"><div class="sub" style="font-size:13px;line-height:1.6">你也有在開貓咪咖啡廳嗎？把店裡的貓咪送進遊戲吧！管理者看過照片後，會把牠畫成跟遊戲裡一樣的水彩貓，送到你的店裡。勾選公開的話，其他玩家在「喵喵家族 → 真實店貓」也看得到牠和你的店名。</div></div>`;
    if (mine && mine.length) h += '<p class="kh">我的申請</p>' + mine.map(r => { const [t, c] = STATUS[r.status] || STATUS.pending;
      return `<div class="item"><div style="display:flex;gap:10px;align-items:center">${r.status === 'approved' ? pic(r.id, 56) : ''}<div style="flex:1"><div class="top"><span class="nm">${clean(r.name, 6)}</span><b style="color:${c}">${t}</b></div>
        <div class="sub">${clean(r.shop, 20)}・${persName(r.pers)}${r.public ? '・公開' : '・不公開'}</div>${r.status === 'rejected' && r.reason ? `<div class="sub" style="color:#C65445">原因：${clean(r.reason, 100)}</div>` : ''}
        ${r.status === 'pending' ? '<div class="sub">通常 1～3 天內會有回覆，通過後貓咪會用「管理者的禮物」送來。</div>' : ''}</div></div></div>`; }).join('');
    const left = mine ? 5 - mine.filter(r => r.status !== 'rejected').length : 5;
    if (left <= 0) return h + '<p class="muted">一個帳號最多 5 隻真實店貓（審核中的也算）。</p>';
    h += `<p class="kh">申請一隻新的店貓</p>
      <label class="nm" style="font-size:13px">貓咪照片（1～3 張，只拍貓、不要拍到客人）</label>
      <div style="display:flex;gap:8px;flex-wrap:wrap">${F.photos.map((p, i) => `<div style="position:relative"><img src="${p.url}" alt="" style="width:76px;height:76px;object-fit:cover;border-radius:10px;border:1px solid var(--line)"><button data-rcdel="${i}" style="position:absolute;top:-6px;right:-6px;padding:0 6px;font-size:12px;border-radius:10px">✕</button></div>`).join('')}
        ${F.photos.length < MAX_PHOTOS ? `<label style="width:76px;height:76px;border-radius:10px;border:1px dashed var(--wood-l);display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px;background:#fff;cursor:pointer">＋ 加照片<input type="file" accept="image/*" id="rcFile" ${F.photos.length < MAX_PHOTOS - 1 ? 'multiple' : ''} hidden></label>` : ''}</div>
      <label class="nm" style="font-size:13px">貓咪名字<input id="rcName" maxlength="6" value="${F.name}" placeholder="例如：豆皮" style="${IN}"></label>
      <div><div class="nm" style="font-size:13px">個性（選 2 個）</div><div class="row" style="margin:4px 0 0;gap:6px;flex-wrap:wrap">${PERSONAS.map((p, i) => `<button data-rcpers="${i}" class="${F.pers.includes(i) ? 'primary' : ''}" style="padding:4px 10px" title="${p.desc}">${p.name}</button>`).join('')}</div></div>
      <label class="nm" style="font-size:13px">一句話介紹（30 字內）<input id="rcIntro" maxlength="30" value="${F.intro}" placeholder="例如：最愛趴在客人腿上打呼" style="${IN}"></label>
      <label class="nm" style="font-size:13px">你的店名<input id="rcShop" maxlength="20" value="${F.shop}" placeholder="例如：喵日子貓咖" style="${IN}"></label>
      <label class="nm" style="font-size:13px">地址或 IG／粉專連結（可不填）<input id="rcLink" maxlength="120" value="${F.link}" placeholder="例如：instagram.com/你的店" style="${IN}"></label>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px"><input type="checkbox" id="rcPub" ${F.pub ? 'checked' : ''}> 讓其他玩家也能在「喵喵家族」看到這隻貓和我的店名</label>
      <label style="display:flex;gap:8px;align-items:flex-start;font-size:13px"><input type="checkbox" id="rcAgree" ${F.agree ? 'checked' : ''}> 照片是我自己店裡的貓，我同意拿來做成遊戲角色</label>
      <button class="primary" id="rcSend" ${F.sending ? 'disabled' : ''}>${F.sending ? '送出中…' : '送出申請'}</button>
      <p class="muted" style="margin:0">原始照片只有管理者看得到，審核完 30 天後會刪掉，只留下畫好的水彩貓。</p>`;
    return h;
  }

  // shrink a photo to at most 1280 px on the long side, as JPEG (the bucket takes up to 1.5 MB)
  function shrink(file) {
    return new Promise((ok, no) => {
      const url = URL.createObjectURL(file), im = new Image();
      im.onload = () => {
        const s = Math.min(1, 1280 / Math.max(im.naturalWidth, im.naturalHeight)), c = document.createElement('canvas');
        c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        c.toBlob(b => b ? ok({ blob: b, url: c.toDataURL('image/jpeg', .7) }) : no(new Error('壞掉的圖片')), 'image/jpeg', .85);
      };
      im.onerror = () => { URL.revokeObjectURL(url); no(new Error('讀不到這張圖片')); };
      im.src = url;
    });
  }
  function keep(sc) {
    const v = id => sc.querySelector('#' + id);
    if (v('rcName')) { F.name = clean(v('rcName').value, 6); F.intro = clean(v('rcIntro').value, 30); F.shop = clean(v('rcShop').value, 20); F.link = clean(v('rcLink').value, 120); F.pub = v('rcPub').checked; F.agree = v('rcAgree').checked; }
  }
  async function send(sc) {
    keep(sc);
    const miss = !F.photos.length ? '請加至少一張貓咪照片' : !F.name ? '貓咪名字還沒填' : F.pers.length !== 2 ? '個性請選 2 個' : !F.shop ? '店名還沒填' : !F.agree ? '請勾選「照片是我自己店裡的貓」' : '';
    if (miss) { toast(miss); return; }
    if (!on()) { toast('要先登入帳號才能申請'); return; }
    F.sending = true; renderPhone();
    try {
      const paths = [];
      for (const p of F.photos) {
        const path = `${CLOUD.uid}/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await CLOUD.sb.storage.from('catloft-realcat-photos').upload(path, p.blob, { contentType: 'image/jpeg' });
        if (error) throw error; paths.push(path);
      }
      const { error } = await CLOUD.sb.rpc('catloft_realcat_apply', { p_name: F.name, p_pers: F.pers, p_intro: F.intro, p_shop: F.shop, p_link: F.link, p_public: F.pub, p_photos: paths });
      if (error) throw error;
      Object.assign(F, { name: '', pers: [], intro: '', link: '', agree: false, photos: [] }); // the shop name stays for the next cat
      sfx('delivery'); toast('申請送出了！管理者看過之後會回覆你');
      mine = null;
    } catch (e) { toast('送不出去：' + String(e.message || e).replace(/^.*?:\s*/, '').slice(0, 60)); }
    F.sending = false; renderPhone();
  }

  // ---------- 喵喵家族「真實店貓」分頁 ----------
  function tabHtml() {
    if (pub == null) { loadPub(); return '<p class="muted">讀取中…</p>'; }
    let h = '<p class="muted">這些貓咪真的住在各地的貓咪咖啡廳裡。可以點店名去看看牠們本人喔！領養要付現金。</p>';
    if (!pub.length) h += '<p class="muted">還沒有真實店貓。你也在開貓咖嗎？到手機「我的真實店貓」申請！</p>';
    for (const r of pub) {
      const k = key(r.id), have = G.cats.some(c => c.id === k);
      h += `<div class="item"><div style="display:flex;gap:10px;align-items:center">${pic(r.id, 70)}<div style="flex:1;min-width:0">
        <div class="top"><span class="nm">${clean(r.name, 6)}${REALTAG}</span><b>${have ? '' : yen(REAL_PRICE)}</b></div>
        <div class="sub">${persName(r.pers)}${r.intro ? `｜${clean(r.intro, 30)}` : ''}</div>
        <div class="row" style="margin:6px 0 0;flex-wrap:wrap">${r.link ? `<button data-rcopen="${r.id}">${clean(r.shop, 20)} ↗</button>` : `<span class="sub" style="align-self:center">${clean(r.shop, 20)}</span>`}
          ${have ? '<button disabled>已在店裡</button>' : G.cash < REAL_PRICE ? '<button disabled>現金不夠</button>' : `<button class="primary" data-rcadopt="${r.id}" ${S.phase === 'settle' ? 'disabled' : ''}>領養${clean(r.name, 6)}</button>`}</div></div></div></div>`;
    }
    return h + '<p class="muted" style="text-align:center">你也在開貓咖嗎？到手機「我的真實店貓」申請</p>';
  }
  const asReal = (r, m) => readReal({ [key(r.id)]: { n: r.name, p: (r.pers || []).map(Number), t: r.intro, s: r.shop, l: r.link, b: r.base, m } });
  function addReal(r, m) {
    const one = asReal(r, m); regReal(one);
    for (const t of [G, S && S.startG]) if (t) t.real = Object.assign(t.real || {}, one);
    return key(r.id);
  }
  function adopt(id) {
    const r = (pub || []).find(r => r.id === id); if (!r || S.phase === 'settle') return;
    const k = key(id); if (G.cats.some(c => c.id === k)) return;
    if (G.cash < REAL_PRICE) { toast('現金不夠'); return; }
    addReal(r, false);
    G.cash -= REAL_PRICE; S.today.spent += REAL_PRICE; G.stats.adopt++;
    welcomeCat(k, '🏠 ');
  }
  function openLink(l) { if (l) window.open(href(l), '_blank', 'noopener'); }

  function bind(sc) {
    if (phoneApp === 'realcat') {
      const f = sc.querySelector('#rcFile');
      if (f) f.onchange = async () => {
        keep(sc);
        for (const file of [...f.files].slice(0, MAX_PHOTOS - F.photos.length)) { try { F.photos.push(await shrink(file)); } catch (e) { toast(e.message); } }
        renderPhone();
      };
      sc.querySelectorAll('[data-rcdel]').forEach(b => b.onclick = () => { keep(sc); F.photos.splice(+b.dataset.rcdel, 1); renderPhone(); });
      sc.querySelectorAll('[data-rcpers]').forEach(b => b.onclick = () => {
        keep(sc); const i = +b.dataset.rcpers, at = F.pers.indexOf(i);
        if (at >= 0) F.pers.splice(at, 1); else { F.pers.push(i); if (F.pers.length > 2) F.pers.shift(); }
        renderPhone();
      });
      const s = sc.querySelector('#rcSend'); if (s) s.onclick = () => send(sc);
      return;
    }
    sc.querySelectorAll('[data-rcadopt]').forEach(b => b.onclick = () => { adopt(+b.dataset.rcadopt); renderPhone(); });
    sc.querySelectorAll('[data-rcopen]').forEach(b => b.onclick = () => { const r = (pub || []).find(r => r.id === +b.dataset.rcopen); if (r) openLink(r.link); });
    sc.querySelectorAll('[data-rclink]').forEach(b => b.onclick = () => { const d = CAT_DEFS[b.dataset.rclink]; if (d) openLink(d.link); });
  }

  // ---------- 管理者送來的店貓（gifts.js） ----------
  async function offerGift(x, card, rpc) {
    const id = Math.floor(Number(x.gift.realcat)) || 0;
    const { data, error } = await CLOUD.sb.rpc('catloft_realcat_get', { p_id: id });
    if (error) return; // try again next time
    const r = data && data[0];
    if (!r || G.cats.some(c => c.id === key(id))) { await rpc('catloft_claim_gifts', [x.id]); return; }
    // warm the sprites up while the card is showing
    for (let i = 0; i < 5; i++) { const im = new Image(); im.src = REAL_ART(id) + i + '.webp'; }
    const pick = await card(`<h2>🎁 管理者送來一隻真實店貓</h2>
      <div style="display:flex;gap:14px;align-items:center;margin:10px 0">${pic(id, 110)}<div style="line-height:1.7"><b style="font-size:20px">${clean(r.name, 6)}</b>${REALTAG}<br>
        ${r.mine ? '來自你的店' : '來自'}「${clean(r.shop, 20)}」<br><span class="muted">${persName(r.pers)}${r.intro ? `｜${clean(r.intro, 30)}` : ''}</span></div></div>
      <p>${r.mine ? `${clean(r.name, 6)}是你店裡的貓，不會被送養。` : ''}${r.mine && r.public ? '其他玩家在「喵喵家族 → 真實店貓」看到牠時，會看到你的店名。' : ''}</p>`,
      [{ label: '不要', v: 'no' }, { label: `歡迎${clean(r.name, 6)}！`, v: 'yes', main: true }]);
    if (pick === 'no') { await rpc('catloft_decline_gifts', [x.id]); return; }
    if (!(await rpc('catloft_claim_gifts', [x.id])).includes(x.id)) return;
    welcomeCat(addReal(r, !!r.mine), '🏠 ');
    mine = null;
  }

  window.REALCAT = { sub, appHtml, tabHtml, bind, offerGift, reload: () => { mine = null; pub = null; } };
})();
