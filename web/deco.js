// 佈置（Chuck 2026-11-15）：左邊「佈置」按鈕打開佈置模式，任何時間都可以（開店中遊戲會先暫停）。
// 按住傢俱拖到想放的地方：綠色可以放，紅色不行（樓梯、門口、櫃台、烤箱、飯碗、貓砂這些店員要走的地方，或疊到別的傢俱）。
// 靠牆的傢俱（貓跳台、書櫃、燈…）只能左右移，桌子和坐墊可以前後左右移，牆上的掛飾可以上下左右移。
// 收起來的傢俱沒有效果，擺出來才有。每件傢俱也可以左右翻轉（座位不行）、收起來、放回原位、換顏色（原色免費，其他顏色每次 ¥100 或 ¥200）。
// 三家店各自記在 G.place（每家店的存檔欄位），格式 { 傢俱: { dx, dy, flip, col, hide } }，位置是跟原本擺法差多少。
// 客人坐著的位子、還沒收的桌子不能搬；貓咪正在爬的傢俱一搬，貓就跳下來。
// 用到 index.html 的全域：G、S、W、V、CAM、DRAG、g、ctx、art、propArt、toast、sfx、yen、hasF、hid、flipped、plantSpot、seatSync、applyPlace、
// ownF、saveProgress、toCanvas、closeDrawer、setHudMore、floorsHere、fname、fw、PROP、SHOWCASE、MURAL、WALLWALK、BAR_SEATS、BEANBAG_SEATS、HAMMOCK_SEATS、
// CUSHION_EXTRA、CUSHION_POS、EXPANSIONS、TABLE_POS、TOYS、toysHere、LAYOUT、STAIRS、STAIR_BOTTOM、WELL_2F、QUEUE、COUNTER、MGR_COUNTER、
// CASHIER_SPOT、SERVER_PICK、OVEN_SPOT、KGATE、KGATE_L、WC、ROOM_DOOR2、ROOF_DOOR2、BOWL、LITTER、OUT_X、$。
(function () {
  const COLORS = {
    pink:    { name: '草莓粉',   rgb: [242, 156, 176] },
    mint:    { name: '薄荷綠',   rgb: [150, 208, 176] },
    sky:     { name: '天空藍',   rgb: [150, 192, 232] },
    lilac:   { name: '薰衣草紫', rgb: [192, 170, 228] },
    caramel: { name: '焦糖棕',   rgb: [176, 118, 70] },
  };
  const BIG = 200, SMALL = 100; // 換一次顏色的價錢（不分店）
  const FLOOR_Y = [502, 604], HANG_Y = [190, 470];

  // ---------- what can be moved in the shop you're in ----------
  // it: { key, f, name, ref (where it's drawn), refs (every position object that moves with it), calls() (its painted parts as propArt
  // would draw them), mode ('wall' = left/right only, 'floor', 'hang' = on the wall), seat, flip, price, bx/by (its spot before any move) }
  function items() {
    const L = [], add = o => L.push({ refs: [o.ref], seat: false, flip: true, price: SMALL, ...o, bx: o.bx ?? o.ref.bx, by: o.by ?? o.ref.by });
    const one = (key, f, name, n, w, price, more) => { const r = more && more.ref || (key === 'plant' ? plantSpot() : PROP[key]);
      add({ key, f, name, ref: r, calls: () => [{ n, x: r.x, y: r.y, w }], mode: r.by > 500 ? 'floor' : 'wall', price, ...more }); };
    // 1F
    TABLE_POS.slice(0, G.tables).forEach((p, i) => add({ key: 't' + i, f: 1, name: '原木矮桌', ref: p, mode: 'floor', seat: true, flip: false, price: BIG,
      calls: () => [{ n: 'table', x: p.x + 6, y: p.y + 1, w: 72 }, { n: 'cushion', x: p.x - 44, y: p.y + 8, w: 62 }] }));
    if (ownF('bar')) { const b = BAR_SEATS, v = { get x() { return (b[0].x + b[1].x) / 2 - 11; }, get y() { return b[0].y + 2; } };
      add({ key: 'bar', f: 1, name: '窗邊吧檯椅', ref: v, refs: b, bx: (b[0].bx + b[1].bx) / 2 - 11, by: b[0].by + 2, mode: 'wall', seat: true, flip: false, price: BIG,
        calls: () => [{ n: 'winbar', x: v.x, y: v.y, w: 100 }, ...b.map(s => ({ n: 'cushion', x: s.x - 44, y: s.y + 9, w: 62 }))] }); }
    if (ownF('showcase')) one('showcase', 1, '甜點展示櫃', 'showcase', 70, BIG, { ref: SHOWCASE });
    if (ownF('plant')) one('plant', 1, '綠意盆栽', 'plant', 44, SMALL, { bx: PROP.plant.bx, by: PROP.plant.by });
    if (ownF('lamp')) one('lamp', 1, '暖光立燈', 'lamp', 40, SMALL);
    if (ownF('chalk')) one('chalk', 1, '今日推薦黑板', 'chalkboard', 50, SMALL);
    if (ownF('record')) one('record', 1, '復古唱片機', 'record', 64, BIG);
    // 2F (and 3F/4F of the third shop)
    if (ownF('cattree')) one('cattree', 2, '豪華貓跳台', 'cattree', 92, BIG, { fun: true });
    if (ownF('books')) one('books', 2, '貓咪漫畫書櫃', 'bookshelf', 90, BIG, { fun: true });
    if (ownF('bed')) one('bed', 2, '暖暖貓窩', 'petbed', 60, SMALL, { fun: true });
    if (ownF('wallwalk')) one('wallwalk', 2, '貓咪壁掛步道', 'wallwalk', 140, BIG, { ref: WALLWALK, mode: 'hang', fun: true });
    if (ownF('mural')) one('mural', 2, '貓咪主題壁畫', 'mural', 60, BIG, { ref: MURAL, mode: 'hang' });
    const seat = (p, key, name, n, oy, w, f = 2) => add({ key, f, name, ref: p, mode: 'floor', seat: true, flip: false, calls: () => [{ n, x: p.x, y: p.y + oy, w }] });
    if (ownF('beanbag')) BEANBAG_SEATS.forEach((p, i) => seat(p, 'bb' + i, '懶骨頭沙發', 'beanbag', 6, 62));
    if (ownF('hammock')) HAMMOCK_SEATS.forEach((p, i) => seat(p, 'hm' + i, '藤編吊椅', 'eggchair', 4, 54));
    if (ownF('cushion')) CUSHION_EXTRA.forEach((p, i) => seat(p, 'ce' + i, '貓咪坐墊', 'cushion', 7, 62));
    EXPANSIONS.slice(0, G.expand).forEach((e, i) => e.cushions.forEach((p, j) => seat(p, 'xc' + i + '_' + j, '坐墊', 'cushion', 7, 62, p.f || 2)));
    if (G.at === 3) CUSHION_POS.forEach((p, i) => seat(p, 'c' + i, '坐墊', 'cushion', 7, 62, p.f || 2));
    for (const t of toysHere()) { const T = TOYS[t];
      add({ key: t, f: 2, name: T.name, ref: T, refs: [T, T.seat], mode: T.by > 500 ? 'floor' : 'wall', price: BIG, fun: true, calls: () => [{ n: T.img, x: T.x, y: T.y, w: T.w }] }); }
    return L;
  }
  let ITEMS = [];
  const rec = k => G.place[k] || {};
  const here = () => ITEMS.filter(it => it.f === S.view);

  // the painted box of a piece (from its images), for tapping and outlines
  function box(it, dx = 0, dy = 0) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const c of it.calls()) { const im = art(c.n), h = im ? c.w * im.naturalHeight / im.naturalWidth : c.w * .8;
      x0 = Math.min(x0, c.x - c.w / 2); x1 = Math.max(x1, c.x + c.w / 2); y0 = Math.min(y0, c.y - h); y1 = Math.max(y1, c.y); }
    return { x0: x0 + dx, x1: x1 + dx, y0: y0 + dy, y1: y1 + dy };
  }

  // ---------- where things may not go ----------
  function blockers(f) {
    const P = [], pt = (p, r = 40, why = '店員要走的路') => p && P.push({ x: p.x, y: p.y, r, why });
    const links = (LAYOUT.LINKS || []).flatMap(L => L.pts.filter(p => p.f === f));
    links.forEach(p => pt(p, 50, '樓梯口'));
    if (LAYOUT.ELEV && LAYOUT.ELEV[f]) pt(LAYOUT.ELEV[f], 46, '電梯門口');
    if (f === 1) {
      if (!LAYOUT.LINKS) { pt(STAIRS[1], 60, '樓梯口'); pt(STAIR_BOTTOM, 60, '樓梯口'); }
      QUEUE.forEach(q => pt(q, 30, '排隊的地方'));
      [MGR_COUNTER, CASHIER_SPOT, SERVER_PICK, OVEN_SPOT, KGATE, KGATE_L].forEach(p => pt(p, 38, '櫃台和烤箱'));
      if (G.at !== 3) pt(WC.door, 40, '廁所門口');
      pt({ x: 30, y: 560 }, 60, '大門口');
    }
    if (f === 2) {
      if (!LAYOUT.LINKS) { pt(STAIRS[2], 70, '樓梯口'); pt({ x: 150, y: 560 }, 70, '樓梯口'); }
      if (G.at !== 3) pt(ROOM_DOOR2, 46, '休息室門口');
      if (G.at === 2) pt(ROOF_DOOR2, 50, '頂樓樓梯');
      [BOWL, BOWL.staff, LITTER, LITTER.staff].forEach(p => pt(p, 34, '飯碗和貓砂'));
    }
    return P;
  }
  // can `it` stand at (x, y)? returns '' or why not
  function why(it, x, y) {
    const dx = x - it.ref.x, dy = y - it.ref.y, b = box(it, dx, dy);
    if (b.x0 < 4 || b.x1 > fw(it.f) - 4) return '超出店外了';
    if (it.mode !== 'hang') {
      for (const p of blockers(it.f)) { const ex = Math.max(0, b.x0 - p.x, p.x - b.x1); if (ex < p.r * .6 && Math.abs(p.y - y) < (it.mode === 'wall' ? 60 : 44)) return '這裡是' + p.why + '，不能擋住'; }
      if (it.f === 1 && y < COUNTER.front + 30 && b.x1 > COUNTER.x - 10 && b.x0 < COUNTER.x + COUNTER.w + 10) return '這裡是櫃台，不能擋住';
    }
    for (const o of here()) {
      if (o === it || o.f !== it.f || hid(o.refs[0]) || (o.mode === 'hang') !== (it.mode === 'hang')) continue;
      const ob = box(o), w = Math.min(b.x1 - b.x0, ob.x1 - ob.x0), over = Math.min(b.x1, ob.x1) - Math.max(b.x0, ob.x0);
      const near = it.mode === 'hang' ? Math.min(b.y1, ob.y1) - Math.max(b.y0, ob.y0) > 10 : Math.abs(o.ref.y - y) < 26;
      if (near && over > w * .3) return '會疊到「' + o.name + '」';
    }
    return '';
  }
  function busy(it) {
    if (!it.seat) return '';
    const pk = new Set(it.refs.map(r => r.pk)), list = it.key.startsWith('t') || it.key === 'bar' ? S.tables : S.cushions;
    const s = list.find(t => pk.has(t.pk) && (t.cust || t.dirty || t.busy));
    return s ? (s.cust ? '有客人坐著，等客人離開再搬' : '桌子還沒收乾淨') : '';
  }
  // cats climbing a piece that moves hop down to the floor
  function catsOff(it) {
    if (!it.fun) return;
    for (const k of S.cats) if ((k.fun && k.fun.spot.id === it.key) || (k.state === 'funBack' && k.floor === it.f)) {
      k.fun = null; k.lift = null; k.hide = false; k.path = []; k.state = 'idle'; k.t = 1; if (k.y < 505) k.y = 520;
    }
  }
  function moved(it) { applyPlace(); seatSync(); catsOff(it); }
  function clean(k) { const r = G.place[k]; if (r) { for (const f of ['dx', 'dy']) if (!r[f]) delete r[f]; if (!r.flip) delete r.flip; if (!r.hide) delete r.hide; if (!r.col) delete r.col; if (!Object.keys(r).length) delete G.place[k]; } }
  function place(it, x, y) { const r = G.place[it.key] = G.place[it.key] || {}; r.dx = Math.round(x - it.bx); r.dy = Math.round(y - it.by); clean(it.key); moved(it); }

  // ---------- recoloured images (pixel tint, so it works on every phone) ----------
  const TINT = {};
  function tinted(n, im, col) {
    const C = COLORS[col]; if (!C) return null;
    const k = n + ':' + col; if (TINT[k]) return TINT[k];
    try {
      const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(im, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), a = d.data, [tr, tg, tb] = C.rgb;
      for (let i = 0; i < a.length; i += 4) { if (!a[i + 3]) continue;
        const l = (a[i] * .3 + a[i + 1] * .59 + a[i + 2] * .11) / 255, m = Math.min(1.16, l * 1.2 + .04), s = .8;
        a[i] = Math.min(255, a[i] * (1 - s) + tr * m * s); a[i + 1] = Math.min(255, a[i + 1] * (1 - s) + tg * m * s); a[i + 2] = Math.min(255, a[i + 2] * (1 - s) + tb * m * s); }
      x.putImageData(d, 0, 0); return (TINT[k] = c);
    } catch { return null; }
  }
  // propArt looks up fx[name@x,y] to know a piece is recoloured or flipped
  const fx = {};
  function refresh() {
    if (!G || !G.place) return;
    ITEMS = items();
    for (const k in fx) delete fx[k];
    for (const it of ITEMS) { const r = rec(it.key); if (!r.col && !r.flip) continue;
      for (const c of it.calls()) fx[c.n + '@' + Math.round(c.x) + ',' + Math.round(c.y)] = { col: r.col, flip: r.flip && it.flip }; }
  }

  // ---------- the mode ----------
  let D = null; // the piece being dragged: { it, ox, oy, x, y, id, moved, err }
  function open() {
    if (!S || !started) return;
    if (S.phase === 'settle' || S.cook || S.reg || S.mini || S.out) { toast('現在不能佈置，等一下再試'); return; }
    if (!floorsHere().filter(f => f !== 4).includes(S.view)) S.view = S.mgr.floor === 4 || S.mgr.floor === 3 ? 2 : S.mgr.floor;
    closeDrawer(); setHudMore(false);
    G.place = G.place || {};
    refresh(); S.edit = { sel: null, colors: false }; S.uiPause = true; CAM.hold = 0;
    $('game').classList.add('deco'); $('decoUi').hidden = false; sfx('ui_click'); render();
  }
  function close() {
    if (!S || !S.edit) return;
    S.edit = null; D = null; S.uiPause = false; $('game').classList.remove('deco'); $('decoUi').hidden = true; CAM.snap = true; saveProgress();
  }
  function down(e) {
    const p = toCanvas(e);
    const hit = here().filter(it => !hid(it.refs[0])).sort((a, b) => b.ref.y - a.ref.y).find(it => { const b = box(it); return p.x > b.x0 - 6 && p.x < b.x1 + 6 && p.y > b.y0 - 6 && p.y < b.y1 + 8; });
    if (!hit) { if (S.edit.sel) { S.edit.sel = null; S.edit.colors = false; render(); } return false; }
    if (S.edit.sel !== hit.key) { S.edit.sel = hit.key; S.edit.colors = false; render(); }
    D = { it: hit, ox: p.x - hit.ref.x, oy: p.y - hit.ref.y, x: hit.ref.x, y: hit.ref.y, id: e.pointerId, moved: false, err: '', x0: e.clientX, y0: e.clientY };
    cv.setPointerCapture(e.pointerId); return true;
  }
  function move(e) {
    if (!D || D.id !== e.pointerId) return false;
    if (!D.moved && Math.hypot(e.clientX - D.x0, e.clientY - D.y0) < 6) return true;
    if (!D.moved) { const b = busy(D.it); if (b) { toast(b); D = null; return true; } D.moved = true; }
    D.ev = { clientX: e.clientX, clientY: e.clientY };
    const p = toCanvas(e), it = D.it;
    let x = Math.round(p.x - D.ox), y = Math.round(p.y - D.oy);
    if (it.mode === 'wall') y = it.ref.y;
    else if (it.mode === 'floor') y = Math.max(FLOOR_Y[0], Math.min(FLOOR_Y[1], y));
    else y = Math.max(HANG_Y[0], Math.min(HANG_Y[1], y));
    D.x = x; D.y = y; D.err = why(it, x, y); return true;
  }
  function up(e) {
    if (!D || D.id !== e.pointerId) return !!D;
    const d = D; D = null;
    if (!d.moved) return true;
    if (d.err) { toast(d.err); sfx('wrong'); return true; }
    place(d.it, d.x, d.y); sfx('build'); render(); return true;
  }
  const sel = () => S.edit && ITEMS.find(it => it.key === S.edit.sel);
  function act(kind) {
    const it = sel();
    if (kind === 'done') return close();
    if (kind === 'up' || kind === 'down') { const fl = floorsHere().filter(f => f !== 4), i = fl.indexOf(S.view); const n = fl[i + (kind === 'up' ? 1 : -1)]; if (n) { S.view = n; S.edit.sel = null; CAM.snap = true; render(); } return; }
    if (!it) return;
    const r = G.place[it.key] = G.place[it.key] || {};
    if (kind === 'flip') { if (!it.flip) { clean(it.key); return toast('座位不能翻轉'); } r.flip = !r.flip; clean(it.key); moved(it); }
    if (kind === 'hide') { const b = busy(it); if (b) { clean(it.key); return toast(b); } r.hide = true; clean(it.key); moved(it); S.edit.sel = null; toast(`「${it.name}」收起來了，收著的時候沒有效果，下面點它可以再拿出來`); }
    if (kind === 'reset') {
      const b = busy(it); if (b) { clean(it.key); return toast(b); }
      const old = { dx: r.dx, dy: r.dy, flip: r.flip }; delete r.dx; delete r.dy; delete r.flip; clean(it.key); applyPlace();
      const it2 = ITEMS.find(o => o.key === it.key), w = it2 && why(it2, it2.ref.x, it2.ref.y);
      if (w) { Object.assign(G.place[it.key] = G.place[it.key] || {}, old); clean(it.key); applyPlace(); return toast('原本的位置' + w.replace(/^這裡是/, '是') + '，先挪開旁邊的傢俱'); }
      moved(it2 || it);
    }
    if (kind === 'colors') S.edit.colors = !S.edit.colors;
    sfx('ui_click'); render();
  }
  function unhide(key) {
    const r = G.place[key]; if (!r) return;
    delete r.hide; clean(key); applyPlace();
    const it = ITEMS.find(o => o.key === key);
    if (it && why(it, it.ref.x, it.ref.y)) { // its last spot is taken now: try where it started
      const keep = { dx: r.dx, dy: r.dy }; delete r.dx; delete r.dy; clean(key); applyPlace();
      const it2 = ITEMS.find(o => o.key === key);
      if (it2 && why(it2, it2.ref.x, it2.ref.y)) { Object.assign(G.place[key] = G.place[key] || {}, keep, { hide: true }); clean(key); applyPlace(); return toast('放它的地方被別的傢俱擋住了，先挪開一點再拿出來'); }
    }
    moved(ITEMS.find(o => o.key === key) || it); S.edit.sel = key; sfx('build'); render();
  }
  function paint(col) {
    const it = sel(); if (!it) return;
    const r = G.place[it.key] = G.place[it.key] || {};
    if ((r.col || '') === col) return;
    const price = col ? it.price : 0;
    if (G.cash < price) { clean(it.key); return toast(`錢不夠，換顏色要 ${yen(price)}`); }
    G.cash -= price; if (S.today) S.today.spent = (S.today.spent || 0) + price;
    r.col = col || undefined; clean(it.key); refresh(); sfx(col ? 'coins' : 'ui_click');
    toast(col ? `「${it.name}」換成${COLORS[col].name}（${yen(price)}）` : `「${it.name}」換回原色`);
    $('cash').textContent = yen(G.cash);
    saveProgress(); render();
  }

  // ---------- the bar at the bottom ----------
  const swatch = (it, col) => { const c = it.calls()[0], im = art(c.n); if (!im) return '';
    try { return (col ? tinted(c.n, im, col) : (() => { const k = document.createElement('canvas'); k.width = im.naturalWidth; k.height = im.naturalHeight; k.getContext('2d').drawImage(im, 0, 0); return k; })()).toDataURL(); } catch { return ''; } };
  function render() {
    const ui = $('decoUi'); if (!ui || !S.edit) return;
    const it = sel(), fl = floorsHere().filter(f => f !== 4), i = fl.indexOf(S.view), r = it ? rec(it.key) : {};
    const away = here().filter(o => hid(o.refs[0]));
    $('decoTip').innerHTML = it ? `<b>${it.name}</b>　按住拖到綠色的地方` : `<b>佈置</b>　點一下傢俱選它，按住拖到想放的地方${S.phase === 'open' || S.phase === 'closing' ? '<small>遊戲暫停中</small>' : ''}`;
    $('decoBar').innerHTML = `
      <div class="dfl"><button data-d="up" ${fl[i + 1] ? '' : 'disabled'}>▲</button><b>${fname(S.view)}</b><button data-d="down" ${fl[i - 1] ? '' : 'disabled'}>▼</button></div>
      ${away.length ? `<div class="daway"><small>收起來的</small>${away.map(o => `<button data-un="${o.key}">${o.name}</button>`).join('')}</div>` : ''}
      <div class="dbtns">
        <button data-d="colors" ${it ? '' : 'disabled'} class="${S.edit.colors ? 'on' : ''}"><i>🎨</i>換顏色</button>
        <button data-d="flip" ${it && it.flip ? '' : 'disabled'}><i>↔️</i>翻轉</button>
        <button data-d="hide" ${it ? '' : 'disabled'}><i>📦</i>收起來</button>
        <button data-d="reset" ${it && (r.dx || r.dy || r.flip) ? '' : 'disabled'}><i>↩️</i>放回原位</button>
      </div>
      <button class="primary ddone" data-d="done">完成</button>`;
    const pal = $('decoPal');
    pal.hidden = !(it && S.edit.colors);
    if (!pal.hidden) pal.innerHTML = `<div class="dph"><b>${it.name}</b><small>原色免費，換其他顏色每次 ${yen(it.price)}・手上 ${yen(G.cash)}</small></div><div class="dsw">` +
      [['', '原色'], ...Object.entries(COLORS).map(([k, c]) => [k, c.name])].map(([k, nm]) =>
        `<button data-col="${k}" class="${(r.col || '') === k ? 'on' : ''}"><img src="${swatch(it, k)}" alt="">${nm}</button>`).join('') + '</div>';
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('#decoUi button'); if (!b || b.disabled) return;
    if (b.dataset.d) act(b.dataset.d); else if (b.dataset.un) unhide(b.dataset.un); else if (b.dataset.col !== undefined) paint(b.dataset.col);
  });
  // drawn over the scene while arranging: outlines, the red no-go spots and the piece being dragged
  function draw(f) {
    if (D && D.moved && D.ev) { // dragging to the screen's edge scrolls the shop along (phones show only part of a floor)
      const r = cv.getBoundingClientRect(), x = D.ev.clientX, dir = x < r.left + 48 ? -1 : x > r.right - 48 ? 1 : 0;
      if (dir) { CAM.x += dir * 7 / V.s; CAM.hold = 0; move({ pointerId: D.id, clientX: x, clientY: D.ev.clientY }); }
    }
    const list = here().filter(it => !hid(it.refs[0]));
    g.save();
    for (const it of list) { const b = box(it), on = S.edit.sel === it.key;
      g.setLineDash(on ? [] : [6, 5]); g.lineWidth = on ? 3 : 1.6; g.strokeStyle = on ? '#D9773E' : 'rgba(255,255,255,.9)';
      g.beginPath(); g.roundRect ? g.roundRect(b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8, 8) : g.rect(b.x0 - 4, b.y0 - 4, b.x1 - b.x0 + 8, b.y1 - b.y0 + 8); g.stroke(); }
    g.setLineDash([]);
    if (D && D.moved) {
      const it = D.it, dx = D.x - it.ref.x, dy = D.y - it.ref.y, b = box(it, dx, dy);
      if (it.mode !== 'hang') for (const p of blockers(f)) { g.fillStyle = 'rgba(205,70,55,.22)'; g.strokeStyle = 'rgba(190,60,50,.7)'; g.lineWidth = 1.5; g.beginPath(); g.ellipse(p.x, p.y, p.r, p.r * .45, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      const ob = box(it); g.fillStyle = 'rgba(60,40,25,.35)'; g.fillRect(ob.x0 - 4, ob.y0 - 4, ob.x1 - ob.x0 + 8, ob.y1 - ob.y0 + 8);
      g.fillStyle = D.err ? 'rgba(210,70,55,.45)' : 'rgba(90,190,100,.45)'; g.strokeStyle = D.err ? '#B8402F' : '#3C8C46'; g.lineWidth = 2;
      g.beginPath(); g.ellipse((b.x0 + b.x1) / 2, D.y + (it.mode === 'hang' ? 0 : 4), (b.x1 - b.x0) / 2 + 6, it.mode === 'hang' ? 6 : 12, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.globalAlpha = .88; g.translate(dx, dy); for (const c of it.calls()) propArt(c.n, c.x, c.y, c.w); g.translate(-dx, -dy); g.globalAlpha = 1;
      if (D.err) { g.font = `700 14px "Noto Sans TC",sans-serif`; const tw = g.measureText(D.err).width + 18, tx = Math.max(tw / 2 + 4, Math.min(W - tw / 2 - 4, (b.x0 + b.x1) / 2)), ty = Math.max(24, b.y0 - 16);
        g.fillStyle = 'rgba(255,250,242,.96)'; g.strokeStyle = '#B8402F'; g.beginPath(); g.roundRect ? g.roundRect(tx - tw / 2, ty - 13, tw, 26, 13) : g.rect(tx - tw / 2, ty - 13, tw, 26); g.fill(); g.stroke();
        g.fillStyle = '#9A3426'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(D.err, tx, ty + 1); }
    }
    g.restore();
  }

  // ---------- page bits ----------
  const css = document.createElement('style');
  css.textContent = `
  .game.deco .joy,.game.deco .actbtn,.game.deco .lbtns,.game.deco .rbtns,.game.deco .drawer,.game.deco .openbtn,.game.deco .falert,.game.deco #tutorial{display:none!important}
  #decoUi{position:absolute;inset:0;pointer-events:none;z-index:6;font-family:"Noto Sans TC",sans-serif;color:#4A3426}
  #decoTip{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translateX(-50%);background:rgba(253,248,238,.96);border:2px solid #D9773E;border-radius:999px;padding:5px 16px;font-size:14px;white-space:nowrap;box-shadow:0 4px 14px rgba(60,40,30,.25);max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}
  #decoTip b{font-family:"LXGW WenKai TC",serif;font-size:16px}#decoTip small{margin-left:8px;color:#8A6A52}
  #decoBar{position:absolute;left:calc(8px + env(safe-area-inset-left));right:calc(8px + env(safe-area-inset-right));bottom:calc(8px + env(safe-area-inset-bottom));pointer-events:auto;background:rgba(253,248,238,.97);border-radius:18px;box-shadow:0 6px 20px rgba(40,25,15,.35);display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px 10px}
  #decoBar button{font:inherit;font-weight:700;font-size:13px;border:2px solid #E2CFB3;background:#fff;border-radius:12px;color:#4A3426;padding:4px 8px;cursor:pointer}
  #decoBar button:disabled{opacity:.4;cursor:default}#decoBar button.on{border-color:#D9773E;background:#FFF1E2}
  #decoBar .dfl{display:flex;align-items:center;gap:6px}#decoBar .dfl b{min-width:44px;text-align:center;font-family:"LXGW WenKai TC",serif;font-size:16px}
  #decoBar .dbtns{display:flex;gap:6px;flex-wrap:wrap}#decoBar .dbtns button{display:flex;flex-direction:column;align-items:center;min-width:58px;line-height:1.2}#decoBar .dbtns i{font-style:normal;font-size:17px}
  #decoBar .daway{display:flex;gap:4px;align-items:center;flex-wrap:wrap;max-width:100%}#decoBar .daway small{color:#8A6A52;font-size:12px}#decoBar .daway button{background:#F3E6D2;font-size:12px}
  #decoBar .ddone{margin-left:auto;background:#D9773E;border-color:#D9773E;color:#fff;font-size:16px;padding:8px 20px}
  #decoPal{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(96px + env(safe-area-inset-bottom));pointer-events:auto;background:rgba(253,248,238,.98);border-radius:18px;box-shadow:0 8px 24px rgba(40,25,15,.4);padding:10px 12px;max-width:calc(100% - 16px)}
  #decoPal .dph{margin-bottom:6px;font-size:13px}#decoPal .dph b{font-family:"LXGW WenKai TC",serif;font-size:16px;margin-right:8px}#decoPal .dph small{color:#8A6A52}
  #decoPal .dsw{display:flex;gap:6px;overflow-x:auto}
  #decoPal .dsw button{font:inherit;font-size:12px;font-weight:700;color:#4A3426;border:2px solid transparent;background:#F3E6D2;border-radius:12px;padding:4px 4px 5px;width:68px;flex:none;display:flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer}
  #decoPal .dsw button.on{border-color:#D9773E;background:#FFF1E2}#decoPal .dsw img{height:44px;max-width:58px;object-fit:contain}
  @media (max-width:560px){#decoBar .dbtns button{min-width:52px;font-size:12px}#decoPal{bottom:calc(150px + env(safe-area-inset-bottom))}}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.id = 'decoUi'; ui.hidden = true;
  ui.innerHTML = '<div id="decoTip"></div><div id="decoPal" hidden></div><div id="decoBar"></div>';
  $('game').appendChild(ui);
  $('decoBtn').onclick = open;

  const barH = () => { const b = $('decoBar'); return b ? b.offsetHeight + 12 : 0; };
  window.DECO = { barH, fx, tinted, refresh, draw, down, move, up, open, close, COLORS };
})();
