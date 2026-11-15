// 暖陽貓閣「📸 喵喵寫真館」：貓咪換裝、拍照、寫真集、店裡的抓拍時刻（Chuck 2026-11-15 看過提案說「好的，很可愛」）。
//   換裝：每隻貓可以戴一個頭飾（CHARMS slot 'chead'，買一次每隻貓都能戴）＋原本的項圈（slot 'cat'）。
//         頭飾是一張畫好的圖，照每種貓、每個姿勢的頭頂位置貼上去（HEAD），不重畫貓。小衣服之後的版本再做。
//   拍照：選貓、背景、姿勢、相框、貼紙，按快門。照片不存圖，只存「怎麼畫」（G.album.p），所以會跟著雲端存檔、換手機也看得到。
//   抓拍時刻：營業中偶爾有貓頭上冒出「📷✨」，只有幾秒，點到就拿到一張手繪的特別照片（MOMENTS），收進寫真集。
//   G.album = { m: { 抓拍id: { d: 第幾天, n: 當時的貓名 } }, p: [照片], got: [已領的獎勵], pd: [第幾天, 那天拍了幾張] }
// 用到 index.html 的全域：G、S、started、CHARMS、CAT_DEFS、BODIES、CATK、catImg、art、drawCatWorn、g、toast、sfx、saveProgress、
//   renderPhone、phoneApp、storeTab、yen、clamp、rand、pick、bondOf、catNameOf、coatPic、rrect、text、DFONT、FONT、INK、IG_SNAP、IG_CAPI、igToday、IG_PER_DAY、sayFor。
(function () {
  // ---------- 頭飾貼在頭上的位置 ----------
  // HEAD[品種][姿勢] = [頭頂中心 x%, 頭頂 y%, 兩耳距離（佔圖寬 %）, 傾斜角度]；姿勢 0 走路、1 坐著、3 撲撲（2 睡覺不戴）
  const HEAD = {
    orange: { 0: [88, 23, 16, 0], 1: [71, 8, 30, 0], 3: [68, 8, 26, 0] },
    tabby:  { 0: [89, 20, 16, 0], 1: [71, 8, 29, 0], 3: [68, 8, 18, -5] },
    gray:   { 0: [88, 8, 15, 0], 1: [74, 9, 24, 0], 3: [84, 9, 13, 0] },
    tux:    { 0: [90, 9, 15, 0], 1: [75, 7, 30, 0], 3: [71, 8, 20, 0] },
    fluffy: { 0: [88, 27, 15, 0], 1: [72, 9, 27, 0], 3: [70, 10, 20, 0] },
    calico: { 0: [86, 32, 15, 0], 1: [72, 7, 34, 0], 3: [63, 9, 24, -8] },
    milk:   { 0: [91, 10, 14, 0], 1: [80, 9, 23, 0], 3: [74, 8, 15, 0] },
  };
  // 每個頭飾：[寬度＝兩耳距離的幾倍, 圖的下面幾成蓋在頭頂下, 往後移多少（兩耳距離的幾倍）]
  const FIT = { hstraw: [1.25, .4, 0], hcrown: [1.05, .55, 0], hberet: [1, .45, 0], hribbon: [.7, .5, -.3], hberry: [1, .5, 0], hstar: [.5, .5, -.3] };
  function headOn(id, k, ci, pose, x, y, f) {
    const C = CHARMS[id], im = C && art(C.img), a = (HEAD[k.def.base] || HEAD.orange)[pose], fit = FIT[id] || [1, .5, 0];
    if (!im || !a) return;
    const w = ci.naturalWidth * CATK * k.size.sx, h = ci.naturalHeight * CATK * k.size.s;
    const span = a[2] / 100 * w, iw = span * fit[0], ih = iw * im.naturalHeight / im.naturalWidth;
    g.save(); g.translate(x, y); if (f < 0) g.scale(-1, 1);
    g.translate((a[0] / 100 - .5) * w + fit[2] * span, -h + a[1] / 100 * h); g.rotate(a[3] * Math.PI / 180);
    g.drawImage(im, -iw / 2, -ih * (1 - fit[1]), iw, ih); g.restore();
  }
  const headOf = id => { const h = G.acc.head && G.acc.head[id]; return CHARMS[h] ? h : ''; };
  function head(k, ci, pose, x, y, f) { const id = headOf(k.id); if (id) headOn(id, k, ci, pose, x, y, f); }

  // ---------- 圖片（拍照背景、抓拍照片） ----------
  const IMG = {};
  function img(n) {
    let im = IMG[n];
    if (!im) { im = IMG[n] = new Image(); im.onload = () => { if (!$('phoneOv').hidden && phoneApp === 'photo') renderPhone(); }; im.src = `assets/${n}.webp`; }
    return im.complete && im.naturalWidth ? im : null;
  }
  // art() (the game's loader) for the cat sprites and accessories; when one isn't there yet, try again shortly
  let again = 0;
  const later = () => { if (again) return; again = setTimeout(() => { again = 0; if (!$('phoneOv').hidden && phoneApp === 'photo') renderPhone(); }, 500); };

  // ---------- 抓拍時刻 ----------
  // base = 哪種貓比較會做這件事（照片裡畫的就是那種貓）；star = 稀有度；★★ 第 3 天起、★★★ 要一隻好感 250 以上的貓
  const MOMENTS = [
    { id: 'nap', img: 'mo_nap', base: 'orange', star: 2, t: n => `${n}和好朋友睡午覺`, hint: '曬得到太陽的墊子上…' },
    { id: 'yawn', img: 'mo_yawn', base: 'tux', star: 1, t: n => `${n}的大哈欠`, hint: '窗台上，有點睏…' },
    { id: 'box', img: 'mo_box', base: 'calico', star: 1, t: n => `紙箱裡的${n}`, hint: '紙箱裡好像有眼睛…' },
    { id: 'feather', img: 'mo_feather', base: 'milk', star: 1, t: n => `${n}抓到羽毛了！`, hint: '晃來晃去的羽毛…' },
    { id: 'wash', img: 'mo_wash', base: 'fluffy', star: 1, t: n => `${n}在洗臉`, hint: '舔舔小手…' },
    { id: 'bag', img: 'mo_bag', base: 'orange', star: 1, t: n => `${n}的頭卡進紙袋`, hint: '紙袋裡傳來沙沙聲…' },
    { id: 'rain', img: 'mo_rain', base: 'gray', star: 2, t: n => `${n}看著窗外下雨`, hint: '雨天的窗邊…' },
    { id: 'belly', img: 'mo_belly', base: 'tabby', star: 1, t: n => `${n}在書櫃上翻肚睡`, hint: '四腳朝天…' },
    { id: 'latte', img: 'mo_latte', base: 'calico', star: 2, t: n => `${n}偷聞拿鐵`, hint: '拉花好香…' },
    { id: 'yarn', img: 'mo_yarn', base: 'tux', star: 1, t: n => `${n}睡在毛線籃`, hint: '一籃軟軟的毛線…' },
    { id: 'loaf', img: 'mo_loaf', base: 'fluffy', star: 1, t: n => `樓梯上的${n}吐司`, hint: '手腳都收起來了…' },
    { id: 'kiss', img: 'mo_kiss', base: 'milk', star: 3, t: n => `${n}碰碰鼻子`, hint: '兩隻感情很好的貓…' },
  ];
  const MO = Object.fromEntries(MOMENTS.map(m => [m.id, m]));
  // the part of the floor on screen right now (phones only show about a third of it)
  const seen = () => { const a = Math.max(0, -V.tx / V.s), b = Math.min(fw(S.view), (cv.width / DPR - V.tx) / V.s); return [a, b]; };
  const LIFE = 6; // seconds the sparkle stays
  let M = null, cool = 150; // the sparkle now showing; game minutes until the next one may appear
  function pickMoment(k) {
    const have = alb().m, ok = m => (m.star < 2 || G.day >= 3) && (m.star < 3 || bondOf(k) >= 250);
    const fresh = MOMENTS.filter(m => !have[m.id] && ok(m));
    const mine = fresh.filter(m => m.base === k.def.base);
    if (mine.length) return pick(mine);
    if (fresh.length && Math.random() < .5) return pick(fresh);
    const again = MOMENTS.filter(m => m.base === k.def.base && ok(m)); // everything of this cat caught: a repeat is still a nice photo
    return again.length ? pick(again) : null;
  }
  function tick(rdt, gmin) {
    if (!started || !S || S.phase !== 'open' || S.out || S.mini || S.cook || S.reg) { M = null; return; }
    if (M) { M.t -= rdt; if (M.t <= 0 || M.k.floor !== S.view || M.k.hold || M.k.anim) { M = null; cool = rand(90, 170); } return; }
    cool -= gmin; if (cool > 0) return;
    cool = rand(30, 60); // nobody suitable right now: look again a little later
    const [v0, v1] = seen(), cats = S.cats.filter(k => k.floor === S.view && !k.hold && !k.anim && !k.hide && !k.jumpFrom && k.x > v0 + 40 && k.x < v1 - 40);
    if (!cats.length) return;
    const k = pick(cats), mo = pickMoment(k); if (!mo) return;
    M = { k, mo, t: LIFE }; sfx('notify');
  }
  function draw(f) {
    if (!M || M.k.floor !== f) return;
    const k = M.k, x = k.x, y = k.y - (k.onBed || k.state === 'sleep' ? 34 : 62), p = (S.t * 2) % 1, fade = Math.min(1, M.t);
    g.save(); g.globalAlpha = fade;
    g.beginPath(); g.arc(k.x, k.y - 22, 34 + p * 8, 0, Math.PI * 2); g.strokeStyle = `rgba(255,214,120,${.85 - p * .7})`; g.lineWidth = 4; g.stroke();
    const t = `📷✨ 快點${k.name}！`;
    g.font = `700 13px ${FONT}`; const w = g.measureText(t).width + 22, [v0, v1] = seen(), bx = clamp(x, v0 + w / 2 + 70, v1 - w / 2 - 70); // keep the bubble on screen (the side buttons take ~70 px)
    M.bx = bx; rrect(bx - w / 2, y - 30, w, 28, 13, '#FFFFFF', '#D9567A', 2); text(t, bx, y - 16, 13, '#D9567A', 'center', FONT, 700);
    g.fillStyle = '#D9567A'; g.beginPath(); g.moveTo(x - 7, y - 3); g.lineTo(x + 7, y - 3); g.lineTo(x, y + 6); g.fill();
    g.fillStyle = '#E8B04A'; g.fillRect(bx - w / 2 + 8, y - 6, (w - 16) * (M.t / LIFE), 3);
    g.restore();
  }
  function hit(f, x, y) {
    if (!M || M.k.floor !== f) return null;
    const k = M.k, by = k.y - (k.onBed || k.state === 'sleep' ? 34 : 62), bubX = M.bx || k.x;
    if (Math.hypot(x - k.x, y - (k.y - 22)) < 48 || (Math.abs(x - bubX) < 110 && y > by - 34 && y < by + 8)) return { act: catchIt };
    return null;
  }
  function catchIt() {
    if (!M) return;
    const { k, mo } = M; M = null; cool = rand(110, 200);
    const A = alb(), isNew = !A.m[mo.id];
    if (isNew) both(g2 => { albOf(g2).m[mo.id] = { d: G.day, n: k.name }; });
    const fans = isNew ? 2 + mo.star * 2 : 1;
    both(g2 => { g2.fans += fans; }); S.today.fans += fans;
    sfx(isNew ? 'badge' : 'fan'); saveProgress();
    VIEW = { mo: mo.id, fresh: isNew, n: k.name };
    TAB = 'album'; ATAB = 'mo';
    phoneApp = 'photo'; openPhone('photo');
    checkRewards();
  }
  // a guest who sits down next to a dressed-up cat says something about it
  function praise(c) {
    if (Math.random() > .45) return;
    const k = S.cats.filter(k => k.floor === c.floor && headOf(k.id) && Math.abs(k.x - c.x) < 220)[0]; if (!k) return;
    const nm = CHARMS[headOf(k.id)].name;
    sayFor(c, pick([`${k.name}戴${nm}好可愛！`, `那頂${nm}好適合牠`, `我要拍${k.name}的${nm}！`]));
  }

  // ---------- 存檔 ----------
  const fresh = () => ({ m: {}, p: [], got: [], pd: [0, 0] });
  const albOf = g2 => g2.album && typeof g2.album === 'object' ? g2.album : (g2.album = fresh());
  const alb = () => albOf(G);
  // put the same change on G and on the day-start snapshot, so photos aren't lost if the day is restarted
  const both = fn => { fn(G); if (S && S.startG && S.startG !== G) fn(S.startG); };
  const P_KEEP = 60, PER_DAY = 5;
  const BGS = [
    { id: 'pb_window', name: '☀ 窗邊陽光', foot: .8 }, { id: 'pb_garden', name: '🌿 庭院花叢', foot: .81 },
    { id: 'pb_halloween', name: '🎃 萬聖節', foot: .69 }, { id: 'pb_night', name: '🌙 晚安', foot: .71 },
  ];
  const POSES = [[1, '坐好'], [0, '散步'], [3, '撲撲'], [2, '睡覺']];
  const FRAMES = [
    { name: '白色拍立得', bg: '#FFFFFF', ink: '#6B4A34' }, { name: '原木框', bg: '#B98B5E', ink: '#FFF6E8' },
    { name: '粉紅點點', bg: '#F7D6DE', ink: '#A0485F', dots: '#FFFFFF' }, { name: '金色拍立得', bg: '#E9C877', ink: '#6B4A1E', need: 4 },
  ];
  const STICKERS = ['', '🌼', '🐾', '✨', '💕', '🎀', '⭐'];
  const int = (v, a, b, d) => typeof v === 'number' && isFinite(v) ? clamp(Math.floor(v), a, b) : d;
  function clean(o) {
    o = o && typeof o === 'object' ? o : {};
    const m = {};
    for (const [id, v] of Object.entries(o.m && typeof o.m === 'object' ? o.m : {})) if (MO[id]) m[id] = { d: int(v && v.d, 1, 99999, 1), n: String((v && v.n) || '').replace(/[<>&"'`\\]/g, '').slice(0, 8) };
    const p = (Array.isArray(o.p) ? o.p : []).filter(q => q && CAT_DEFS[q.c]).slice(0, P_KEEP).map(q => ({
      id: String(q.id || '').replace(/[^a-z0-9]/g, '').slice(0, 12) || Math.random().toString(36).slice(2, 10), c: q.c,
      b: int(q.b, 0, BGS.length - 1, 0), po: [0, 1, 2, 3].includes(q.po) ? q.po : 1, fr: int(q.fr, 0, FRAMES.length - 1, 0), st: int(q.st, 0, STICKERS.length - 1, 0),
      h: CHARMS[q.h] && CHARMS[q.h].slot === 'chead' ? q.h : '', n: CHARMS[q.n] && CHARMS[q.n].slot === 'cat' ? q.n : '',
      nm: String(q.nm || '').replace(/[<>&"'`\\]/g, '').slice(0, 8), d: int(q.d, 1, 99999, 1) }));
    const got = Array.isArray(o.got) ? [...new Set(o.got.filter(x => typeof x === 'string' && /^[a-z0-9:]{1,24}$/i.test(x)))] : [];
    const pd = Array.isArray(o.pd) ? [int(o.pd[0], 0, 99999, 0), int(o.pd[1], 0, PER_DAY, 0)] : [0, 0];
    return { m, p, got, pd };
  }
  const shotsToday = () => { const pd = alb().pd || [0, 0]; return pd[0] === G.day ? pd[1] : 0; };
  const caught = () => Object.keys(alb().m).length;

  // ---------- 畫照片 ----------
  // returns a canvas; r = { c: cat id, b, po, fr, st, h, n, nm, d } (b = -1: plain cream backdrop for the 換裝 preview)
  const PW = 640, PH = 356;
  function compose(r, frame = true) {
    const d = CAT_DEFS[r.c], fr = FRAMES[r.fr] || FRAMES[0], M2 = frame ? 18 : 0, BOT = frame ? 62 : 0;
    const c = document.createElement('canvas'); c.width = PW + M2 * 2; c.height = PH + M2 + BOT;
    const x = c.getContext('2d');
    if (frame) {
      x.fillStyle = fr.bg; x.fillRect(0, 0, c.width, c.height);
      if (fr.dots) { x.fillStyle = fr.dots; for (let i = 0; i < c.width; i += 22) for (let j = 0; j < c.height; j += 22) { x.beginPath(); x.arc(i + (j / 22 % 2) * 11, j, 3, 0, 7); x.fill(); } }
    }
    x.save(); x.translate(M2, M2); x.beginPath(); x.rect(0, 0, PW, PH); x.clip();
    const B = BGS[r.b], bg = B && img(B.id);
    if (bg) x.drawImage(bg, 0, 0, PW, PH);
    else { const gr = x.createRadialGradient(PW / 2, PH * .85, 10, PW / 2, PH * .7, PW * .6); gr.addColorStop(0, '#F3E3C9'); gr.addColorStop(1, '#FBF4E8'); x.fillStyle = gr; x.fillRect(0, 0, PW, PH); if (B) later(); }
    if (d) {
      const ci = catImg(d, r.po), b = BODIES[d.size] || BODIES[1];
      if (ci) {
        const tall = { 0: .5, 1: .62, 2: .3, 3: .6 }[r.po] * PH, base = 130; // a sitting cat is ~130 px tall in its sprite
        const sc = tall / base / CATK, k = { def: d, size: { s: sc * b.s, sx: sc * b.sx } };
        const foot = (B ? B.foot : .9) * PH, cx = PW / 2;
        const prev = g; g = x;
        try {
          const w = ci.naturalWidth * CATK * k.size.sx, h = ci.naturalHeight * CATK * k.size.s;
          x.drawImage(ci, cx - w / 2, foot - h + 3, w, h);
          if (d.real) {} // 真實店貓 are painted from photos: no anchors for accessories on them yet
          else if (r.po !== 2 && CHARMS[r.n] && art(CHARMS[r.n].img)) drawCatWorn(r.n, k, ci, r.po, cx, foot + 3, 1); else if (r.n) later();
          if (!d.real && r.po !== 2 && CHARMS[r.h]) { if (art(CHARMS[r.h].img)) headOn(r.h, k, ci, r.po, cx, foot + 3, 1); else later(); }
        } finally { g = prev; }
      } else later();
    }
    const st = STICKERS[r.st];
    if (st) { x.font = '44px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(st, 40, 38); x.font = '32px sans-serif'; x.fillText(st, PW - 36, 34); x.fillText(st, PW - 60, PH - 34); }
    x.restore();
    if (frame) {
      x.fillStyle = fr.ink; x.font = `700 24px ${DFONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(`${r.nm || (d ? catNameOf(r.c) : '')}・第 ${r.d || G.day} 天`, c.width / 2, PH + M2 + BOT / 2);
    }
    return c;
  }
  const CACHE = {};
  function photoUrl(r) {
    const key = JSON.stringify(r); if (CACHE[key]) return CACHE[key];
    const c = compose(r), u = c.toDataURL('image/jpeg', .85);
    if (!again) CACHE[key] = u; // drawn with everything loaded: keep it
    return u;
  }
  function momentCanvas(id) {
    const mo = MO[id], e = alb().m[id], im = img(mo.img); if (!im) { later(); return null; }
    const c = document.createElement('canvas'); c.width = 676; c.height = 470; const x = c.getContext('2d');
    x.fillStyle = '#FFFFFF'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 18, 18, 640, 376);
    x.fillStyle = '#6B4A34'; x.font = `700 24px ${DFONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(`${mo.t(e ? e.n : '貓咪')} ${'★'.repeat(mo.star)}`, c.width / 2, 432);
    return c;
  }

  // ---------- 分享 / 發到喵IG ----------
  async function share(c, name) {
    try {
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .9));
      const file = new File([blob], `${name}.jpg`, { type: 'image/jpeg' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: G.shopName, text: `${name}・${G.shopName}` }); return; }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name}.jpg`; document.body.appendChild(a); a.click(); a.remove();
      toast('照片存到這台裝置了');
    } catch (e) { if (e && e.name !== 'AbortError') toast('這台裝置沒辦法分享，可以長按照片存起來'); }
  }
  function toIg(c, catName, extra) {
    if (igToday() >= IG_PER_DAY) { toast('喵IG 今天已經發 3 篇了，明天再發'); return; }
    const tw = 360, th = Math.round(tw * c.height / c.width), s = document.createElement('canvas'); s.width = tw; s.height = th; s.getContext('2d').drawImage(c, 0, 0, tw, th);
    const pc = document.createElement('canvas'); pc.width = 300; pc.height = Math.round(300 * th / tw); pc.getContext('2d').drawImage(s, 0, 0, pc.width, pc.height);
    let pub = pc.toDataURL('image/jpeg', .62); if (pub.length > 58000) pub = pc.toDataURL('image/jpeg', .4);
    const likes = Math.round(18 + extra + Math.min(80, G.fans * .15) + rand(0, 10));
    const pool = [`${catName}也太可愛了吧😻`, `${catName}是我的本命`, '這張要存起來', '店長好會拍', '好想去店裡看本人', '收藏了，週末去！', `${G.shopName}是我最愛的店`, '寫真集等級的照片 📸'];
    const com = []; while (com.length < clamp(Math.round(likes / 15), 2, 6)) { const t = pick(pool); if (!com.some(q => q[1] === t)) com.push([pick(['貓奴小美', '肉球控', '橘貓後援會', 'yuyu_cat', '喵星人研究所', '甜點偵探']), t]); }
    IG_CAPI = 0;
    IG_SNAP = { img: s.toDataURL('image/jpeg', .72), pub, f: S.view, likes, fans: clamp(Math.round(likes / 12), 1, 15), com, cats: 1 };
    phoneApp = 'ig'; renderPhone();
  }

  // ---------- 獎勵 ----------
  const REWARDS = [
    { id: 'mo4', need: 4, txt: '解鎖相框「金色拍立得」', give: () => {} },
    { id: 'mo8', need: 8, txt: '獎金 ¥3,000', give: () => { both(g2 => { g2.cash += 3000; }); } },
    { id: 'mo12', need: 12, txt: '貓咪頭飾「小星星髮夾」', give: () => { both(g2 => { if (!g2.acc.own.includes('hstar')) g2.acc.own.push('hstar'); }); } },
  ];
  function checkRewards() {
    const A = alb(), n = caught(); let any = false;
    for (const r of REWARDS) if (n >= r.need && !A.got.includes(r.id)) { r.give(); both(g2 => { albOf(g2).got.push(r.id); }); toast(`📸 寫真集獎勵：${r.txt}！`); any = true; }
    // three photos of the same cat fill its page: +3 fans for that cat, once
    const per = {}; for (const p of A.p) per[p.c] = (per[p.c] || 0) + 1;
    for (const [c, k] of Object.entries(per)) if (k >= 3 && !A.got.includes('c:' + c)) { both(g2 => { albOf(g2).got.push('c:' + c); g2.fans += 3; }); toast(`📸 ${catNameOf(c)}的相簿頁拍滿了，粉絲 +3`); any = true; }
    if (any) { sfx('badge'); saveProgress(); }
  }

  // ---------- 手機 app ----------
  let TAB = 'dress', ATAB = 'mo', SEL = null, SLOT = 'chead', VIEW = null, AFIL = '';
  const SET = { b: 0, po: 1, fr: 0, st: 0 };
  const myCats = () => G.cats.map(c => c.id).filter(id => CAT_DEFS[id]);
  const selCat = () => (SEL && myCats().includes(SEL) ? SEL : (SEL = myCats()[0]));
  const thumb = id => { const src = coatPic(CAT_DEFS[id]); return src ? `<img src="${src}" alt="" style="height:40px;width:30px;object-fit:contain">` : '🐱'; };
  const chip = (on, attr, label) => `<button class="${on ? 'primary' : ''}" ${attr} style="padding:5px 9px;font-size:13px">${label}</button>`;
  const catRow = () => `<div style="display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px">${myCats().map(id => `<button data-phcat="${id}" title="${catNameOf(id)}" style="flex:none;padding:2px 4px;border-radius:12px;${id === selCat() ? 'border:2px solid #D9567A' : ''}">${thumb(id)}<div style="font-size:10px;line-height:1.2">${catNameOf(id)}</div></button>`).join('')}</div>`;
  const recipe = () => { const c = selCat(); return { c, b: SET.b, po: SET.po, fr: SET.fr, st: SET.st, h: headOf(c), n: CHARMS[G.acc.cats[c]] ? G.acc.cats[c] : '', nm: catNameOf(c), d: G.day }; };

  function dressPage() {
    const c = selCat(); if (!c) return '<p class="muted">還沒有貓咪。</p>';
    const wear = { c, b: -1, po: 1, fr: 0, st: 0, h: headOf(c), n: CHARMS[G.acc.cats[c]] ? G.acc.cats[c] : '' };
    const pv = compose(wear, false).toDataURL('image/png');
    const own = G.acc.own.filter(id => CHARMS[id] && CHARMS[id].slot === SLOT), now = SLOT === 'chead' ? headOf(c) : G.acc.cats[c] || '';
    const tile = (id, label, on) => `<button data-phwear="${id}" style="padding:4px;border-radius:12px;height:74px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;${on ? 'border:2px solid #D9567A;background:#FFF4F6' : ''}">${id ? `<img src="assets/${CHARMS[id].img}.webp" alt="" style="max-height:40px;max-width:60px">` : '<span style="font-size:20px">✕</span>'}<span style="font-size:11px">${label}</span></button>`;
    let h = catRow() + `<div style="border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#FBF4E8;position:relative"><img src="${pv}" alt="" style="width:100%;display:block">
      <div style="position:absolute;top:8px;left:10px;font-weight:700">${catNameOf(c)}<div class="sub" style="font-weight:400">好感 ❤ ${G.bond[c] || 0}</div></div></div>
      <div class="row" style="margin:8px 0 6px;gap:6px">${chip(SLOT === 'chead', 'data-phslot="chead"', '頭飾')}${chip(SLOT === 'cat', 'data-phslot="cat"', '項圈')}<button disabled style="padding:5px 9px;font-size:13px">小衣服（下一版）</button></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${tile('', '不戴', !now)}${own.map(id => tile(id, CHARMS[id].name, now === id)).join('')}</div>`;
    if (CAT_DEFS[c].real) h += '<p class="muted" style="margin:8px 0 0">真實店貓是照著照片畫的，暫時還不能戴飾品，可以直接拍照。</p>';
    else if (!own.length) h += `<p class="muted" style="margin:8px 0 0">還沒有${SLOT === 'chead' ? '頭飾' : '項圈'}。</p>`;
    h += `<div class="row" style="margin:8px 0 0"><button data-phshop="1">到商店買更多${SLOT === 'chead' ? '頭飾' : '項圈'}</button></div>
      <p class="muted" style="margin:6px 0 0">買一次每隻貓都可以戴。戴著頭飾的貓會在店裡走來走去，客人看到會誇獎，喵IG 的讚也會變多。</p>`;
    return h;
  }
  function shootPage() {
    const c = selCat(); if (!c) return '<p class="muted">還沒有貓咪。</p>';
    const left = PER_DAY - shotsToday(), url = photoUrl(recipe()), n = caught();
    const row = (label, list) => `<p class="kh" style="margin:8px 0 4px">${label}</p><div class="row" style="margin:0;gap:5px;flex-wrap:wrap">${list}</div>`;
    return catRow() + `<img src="${url}" alt="" style="width:100%;display:block;border-radius:6px;box-shadow:0 2px 8px rgba(80,50,30,.2)">` +
      row('背景', BGS.map((b, i) => chip(SET.b === i, `data-phset="b" data-v="${i}"`, b.name)).join('')) +
      row('姿勢', POSES.map(([p, nm]) => chip(SET.po === p, `data-phset="po" data-v="${p}"`, nm)).join('')) +
      row('相框', FRAMES.map((f, i) => f.need && n < f.need ? `<button disabled style="padding:5px 9px;font-size:13px">🔒 ${f.name}</button>` : chip(SET.fr === i, `data-phset="fr" data-v="${i}"`, f.name)).join('')) +
      row('貼紙', STICKERS.map((s, i) => chip(SET.st === i, `data-phset="st" data-v="${i}"`, s || '不貼')).join('')) +
      (SET.po === 2 && headOf(c) ? '<p class="muted" style="margin:6px 0 0">睡覺的時候不戴頭飾和項圈。</p>' : '') +
      `<div class="row" style="margin:12px 0 0;justify-content:center">${left > 0 ? `<button class="primary" id="phShoot" style="font-size:16px;padding:10px 26px">📷 拍下來（今天還有 ${left} 張）</button>` : '<button disabled>今天拍滿 5 張了，明天再拍</button>'}</div>`;
  }
  function albumPage() {
    const A = alb(), n = caught();
    let h = `<div class="row" style="margin:0 0 8px;gap:6px;flex-wrap:wrap">${chip(ATAB === 'mo', 'data-phatab="mo"', `抓拍時刻 ${n}/${MOMENTS.length}`)}${chip(ATAB === 'me', 'data-phatab="me"', `我拍的 ${A.p.length}`)}</div>`;
    const card = (src, label, attr) => `<button ${attr} style="padding:5px 5px 4px;background:#fff;border-radius:4px;box-shadow:0 2px 5px rgba(80,50,30,.18);border:none;display:block;width:100%">${src}<div style="font-size:11px;margin-top:3px;color:var(--wood-d,#6B4A34)">${label}</div></button>`;
    if (ATAB === 'mo') {
      h += `<div style="background:#F4E6CF;border-radius:12px;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">` + MOMENTS.map(m => {
        const e = A.m[m.id];
        return e ? card(`<img src="assets/${m.img}.webp" alt="" style="width:100%;aspect-ratio:800/470;object-fit:cover;display:block">`, `${m.t(e.n)} <b style="color:#D9A23A">${'★'.repeat(m.star)}</b>`, `data-phmo="${m.id}"`)
          : card(`<div style="width:100%;aspect-ratio:800/470;background:#E9DCC8;display:flex;align-items:center;justify-content:center;font-size:26px;color:#BDA98C">?</div>`, `${m.hint} <b style="color:#D9A23A">${'★'.repeat(m.star)}</b>`, 'disabled');
      }).join('') + '</div>';
      h += `<p class="muted" style="margin:8px 0 4px">營業中偶爾會有貓頭上冒出「📷✨」，只有幾秒，快點牠就能拍下來。</p>` +
        REWARDS.map(r => `<div class="item" style="margin:6px 0 0;padding:8px 10px;${A.got.includes(r.id) ? 'opacity:.6' : 'border:1px dashed #D9567A'}"><span>${A.got.includes(r.id) ? '✅' : '🎁'} 集到 ${r.need} 張：${r.txt}</span></div>`).join('');
    } else {
      if (!A.p.length) return h + '<p class="muted">還沒有照片。到「拍照」幫貓咪拍一張吧！</p>';
      const cats = [...new Set(A.p.map(p => p.c))];
      h += `<div class="row" style="margin:0 0 8px;gap:5px;flex-wrap:wrap">${chip(!AFIL, 'data-phfil=""', '全部')}${cats.map(c => chip(AFIL === c, `data-phfil="${c}"`, `${catNameOf(c)} ${A.p.filter(p => p.c === c).length}${A.got.includes('c:' + c) ? '✓' : ''}`)).join('')}</div>`;
      h += `<div style="background:#F4E6CF;border-radius:12px;padding:10px;display:grid;grid-template-columns:1fr 1fr;gap:10px">` +
        A.p.filter(p => !AFIL || p.c === AFIL).map(p => card(`<img src="${photoUrl(p)}" alt="" style="width:100%;display:block">`, `第 ${p.d} 天`, `data-phpic="${p.id}"`)).join('') + '</div>';
      h += '<p class="muted" style="margin:8px 0 0">同一隻貓拍滿 3 張，牠的相簿頁就完成了（粉絲 +3）。最多留 60 張，太多會從最舊的開始收起來。</p>';
    }
    return h;
  }
  function viewPage() {
    const v = VIEW; let url, title, sub;
    if (v.mo) { const c = momentCanvas(v.mo); if (!c) return '<p class="muted">照片載入中…</p>'; url = c.toDataURL('image/jpeg', .9); title = v.fresh ? '抓拍成功！<small class="tg" style="background:#D9A23A;color:#fff">新照片</small>' : '抓拍成功！'; sub = v.fresh ? `收進寫真集「抓拍時刻」${caught()} / ${MOMENTS.length}。這種瞬間只會出現幾秒，錯過要等下次喔。` : '這張已經收過了，不過還是很可愛（粉絲 +1）。'; }
    else { const p = alb().p.find(q => q.id === v.pic); if (!p) { VIEW = null; return albumPage(); } url = photoUrl(p); title = v.fresh ? '拍好了！' : `${p.nm || catNameOf(p.c)}・第 ${p.d} 天`; sub = v.fresh ? `收進寫真集「我拍的」。今天還可以拍 ${PER_DAY - shotsToday()} 張。` : ''; }
    return `<p class="nm" style="font-size:18px;margin:0 0 8px">${title}</p><img src="${url}" alt="" style="width:100%;display:block;border-radius:4px;box-shadow:0 3px 10px rgba(80,50,30,.25);transform:rotate(-1deg)">
      ${sub ? `<p style="margin:12px 0 0">${sub}</p>` : ''}
      <div class="row" style="margin:12px 0 0;flex-wrap:wrap"><button id="phBack">收進寫真集</button><button id="phIg">發到喵IG</button><button class="primary" id="phShare">分享給朋友</button>${v.pic && !v.fresh ? '<button id="phDel">刪掉這張</button>' : ''}</div>`;
  }
  function page() {
    if (!G.acc.head) G.acc.head = {};
    alb();
    if (VIEW) return viewPage();
    const tabs = [['dress', '換裝'], ['shoot', '拍照'], ['album', '寫真集']];
    return `<div class="stabs">${tabs.map(t => `<button class="${TAB === t[0] ? 'on' : ''}" data-phtab="${t[0]}">${t[1]}</button>`).join('')}</div>` +
      (TAB === 'dress' ? dressPage() : TAB === 'shoot' ? shootPage() : albumPage());
  }
  function bind(sc) {
    const on = (sel, fn) => sc.querySelectorAll(sel).forEach(b => b.onclick = () => fn(b));
    on('[data-phtab]', b => { TAB = b.dataset.phtab; renderPhone(); });
    on('[data-phatab]', b => { ATAB = b.dataset.phatab; renderPhone(); });
    on('[data-phfil]', b => { AFIL = b.dataset.phfil; renderPhone(); });
    on('[data-phcat]', b => { SEL = b.dataset.phcat; renderPhone(); });
    on('[data-phslot]', b => { SLOT = b.dataset.phslot; renderPhone(); });
    on('[data-phshop]', () => { storeTab = 'wear'; phoneApp = 'shop'; renderPhone(); });
    on('[data-phwear]', b => {
      const id = b.dataset.phwear, c = selCat(); if (id && !G.acc.own.includes(id)) return;
      both(g2 => { const box = SLOT === 'chead' ? (g2.acc.head || (g2.acc.head = {})) : g2.acc.cats; if (id) box[c] = id; else delete box[c]; });
      sfx('ui_click'); saveProgress(); renderPhone();
    });
    on('[data-phset]', b => { SET[b.dataset.phset] = +b.dataset.v; renderPhone(); });
    on('[data-phmo]', b => { VIEW = { mo: b.dataset.phmo }; renderPhone(); });
    on('[data-phpic]', b => { VIEW = { pic: b.dataset.phpic }; renderPhone(); });
    const q = s => sc.querySelector(s);
    if (q('#phShoot')) q('#phShoot').onclick = () => {
      if (shotsToday() >= PER_DAY) return;
      const r = { id: Date.now().toString(36), ...recipe() }, n = shotsToday() + 1;
      both(g2 => { const A = albOf(g2); A.p.unshift({ ...r }); A.p = A.p.slice(0, P_KEEP); A.pd = [G.day, n]; });
      sfx('notify'); saveProgress(); VIEW = { pic: r.id, fresh: true }; renderPhone(); checkRewards();
    };
    if (q('#phBack')) q('#phBack').onclick = () => { if (VIEW.pic) { TAB = 'album'; ATAB = 'me'; } VIEW = null; renderPhone(); };
    if (q('#phShare')) q('#phShare').onclick = () => { const v = VIEW, p = v.pic && alb().p.find(x => x.id === v.pic), c = v.mo ? momentCanvas(v.mo) : p && compose(p); if (c) share(c, v.mo ? MO[v.mo].t(alb().m[v.mo].n) : `${p.nm || catNameOf(p.c)}的寫真`); };
    if (q('#phIg')) q('#phIg').onclick = () => {
      const v = VIEW, p = v.pic && alb().p.find(x => x.id === v.pic);
      if (v.mo) { const c = momentCanvas(v.mo); if (c) { VIEW = null; toIg(c, alb().m[v.mo].n || '貓咪', 30 + MO[v.mo].star * 15); } }
      else if (p) { VIEW = null; toIg(compose(p), p.nm || catNameOf(p.c), 12 + (p.h ? 10 : 0) + (p.n ? 4 : 0) + (p.st ? 3 : 0) + (G.bond[p.c] || 0) / 5); }
    };
    if (q('#phDel')) q('#phDel').onclick = () => { const id = VIEW.pic; both(g2 => { const A = albOf(g2); A.p = A.p.filter(x => x.id !== id); }); VIEW = null; saveProgress(); renderPhone(); };
  }
  const sub = () => { if (!G) return ''; const n = caught(); return n ? `寫真集 ${n}/${MOMENTS.length}` : '換裝・拍照'; };

  window.PHOTO = { head, tick, draw, hit, praise, page, bind, sub, clean, MOMENTS, now: () => M };
})();
