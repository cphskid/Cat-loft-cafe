'use strict';
// ====================== first-day guide ======================
// Day 1 walks a new player through one whole business day, one short step at a time:
// a small card says what to do, a bouncing arrow points at the thing to tap (or the button to press).
// The clock and new guests wait until the first guest has been served. After the guided steps the
// card only pops up with a one-off hint when something needs attention. Uses the game's globals (G, S, ...).
(() => {
  const css = document.createElement('style');
  css.textContent = `
.coach{position:absolute;left:50%;transform:translateX(-50%);top:calc(58px + env(safe-area-inset-top));z-index:6;width:min(400px,calc(100% - 140px));box-sizing:border-box;
  background:rgba(253,251,247,.97);border:2px solid var(--accent);border-radius:16px;box-shadow:0 6px 18px rgba(60,40,30,.28);padding:8px 12px 8px 12px;
  font-size:15px;line-height:1.45;color:var(--ink);display:flex;flex-direction:column;gap:6px}
.coach .ct{font-family:var(--display);font-weight:700}
.coach .cr{display:flex;align-items:center;justify-content:space-between;gap:8px}
.coach .cn{font-size:12px;color:var(--muted)}
.coach .cskip{background:none;border:0;padding:2px 0;font-size:12px;color:var(--muted);text-decoration:underline;cursor:pointer}
.coach .cok{padding:6px 18px;border-radius:14px;font-size:15px}
.game.busy .coach{display:none}
.game.coaching #toasts{top:calc(150px + env(safe-area-inset-top))}
.tut-hl{outline:3px solid var(--accent)!important;outline-offset:3px;animation:tutGlow 1s ease-in-out infinite alternate}
@keyframes tutGlow{from{box-shadow:0 0 0 0 rgba(217,119,62,.55)}to{box-shadow:0 0 0 10px rgba(217,119,62,0)}}
.tut-done{background:#FFF4E6;border:2px solid var(--accent);border-radius:14px;padding:10px 14px;margin:0 0 12px}
.tut-done b{font-family:var(--display);font-size:17px}`;
  document.head.appendChild(css);
  const card = document.createElement('div');
  card.className = 'coach'; card.id = 'coach'; card.hidden = true; card.setAttribute('role', 'status');
  card.innerHTML = '<div class="ct" id="coachTxt"></div><div class="cr"><span class="cn" id="coachN"></span><span><button class="cskip" id="coachSkip">跳過教學</button> <button class="primary cok" id="coachOk" hidden>好</button></span></div>';
  $('game').appendChild(card);

  const OVEN = { f: 1, x: 365, y: 392 }, BAR = { f: 1, x: 540, y: 330 };
  const pets = () => G.cats.reduce((a, c) => a + c.pets, 0);
  const first = () => S.customers.find(c => c.special) || (S.tut.firstGone ? { gone: true } : null);
  const atFloor = (p, sel = '#floorBtn') => p.f === S.view ? { world: p } : { dom: sel };
  const phoneOpen = () => !$('phoneOv').hidden;
  // what the player still needs to buy, as a phone tap path
  function buyPath(id) {
    if (!phoneOpen()) return { dom: '#phoneBtn' };
    if (phoneApp === 'home') return { dom: '[data-app="shop"]' };
    if (phoneApp !== 'shop') return { dom: '#pBack' };
    if (storeTab !== 'stock') return { dom: '[data-stab="stock"]' };
    return { dom: `[data-buy="${id}"],[data-credit="${id}"]` };
  }
  // the cookies the first guest is waiting for: buy flour, then bake
  function needCookies() {
    if (dispTotal() > 0 || S.baking.cookie) return null;
    if (G.stock.flour <= 0) return { text: '展示櫃是空的，先用「手機」→「商店」買一袋麵粉。', target: buyPath('flour') };
    return { text: '展示櫃是空的，先點烤箱做一批貓掌餅乾。', target: atFloor(OVEN) };
  }

  // one guided step after another; a step is skipped as soon as its done() is true
  const STEPS = [
    { key: 'hi', ok: true, text: () => `歡迎來到${G.shopName}！今天我陪你開店一整天，跟著箭頭做就好。`, done: () => S.phase !== 'prep' && S.tut.i > 0 },
    { key: 'buy', text: () => '店裡還沒有材料。點「手機」→「商店」，買一袋麵粉和一包貓糧。',
      done: () => S.phase !== 'prep' || ((G.stock.flour > 0 || dispTotal() > 0) && (G.stock.catfood > 0 || G.bowl > 0)),
      target: () => buyPath(G.stock.flour > 0 || dispTotal() > 0 ? 'catfood' : 'flour') },
    { key: 'bake', text: () => '點樓梯旁的烤箱，選「貓掌奶油餅乾」，照畫面上的步驟做一批。',
      done: () => S.phase !== 'prep' || dispTotal() > 0, target: () => atFloor(OVEN) },
    { key: 'bowl', text: () => S.view === 2 ? '點貓碗，把貓糧倒進去。' : '貓咪也要吃早餐。按右上角「去 2F」，上樓點貓碗把貓糧倒進去。',
      done: () => S.phase !== 'prep' || G.bowl > 0 || G.stock.catfood <= 0, target: () => atFloor({ f: 2, x: BOWL.x, y: BOWL.y - 24 }) },
    { key: 'open', text: () => '都準備好了！按下面的「開店營業」。', done: () => S.phase !== 'prep', target: () => ({ dom: '#openBtn' }) },
    { key: 'order', hold: true,
      text: () => { const c = first(); return !c || c.path.length && c.state === 'queue' ? '開門囉！第一位客人正走進來…（客人沒點完餐前，時鐘會先暫停）' : '第一位客人在吧檯前等你。點吧檯幫她點餐，再照金額找錢。'; },
      done: () => { const c = first(); return !!c && (c.gone || c.state !== 'queue'); },
      target: () => { const c = first(); return c && !c.path.length ? atFloor(BAR) : null; } },
    { key: 'serve', hold: true,
      text: () => { const n = needCookies(); if (n) return n.text; const c = first(); return c && c.state === 'toTable' ? '她去找位子坐了，等她坐好…' : '她坐好在等餐了。點她，店長會把餅乾送過去。'; },
      done: () => { const c = first(); return !c || c.gone || !['toTable', 'waitFood'].includes(c.state) || !c.order?.dish; },
      target: () => { const n = needCookies(); if (n) return n.target; const c = first(); return c && c.state === 'waitFood' ? atFloor({ f: 1, x: c.x, y: c.y - 120 }) : null; } },
    { key: 'clear', text: () => S.tables.some(t => t.dirty) ? '客人吃完留下了髒盤子，點那張桌子收拾乾淨。' : '時間開始走囉！客人吃完會留下髒盤子，到時候點桌子收拾。',
      done: () => (S.tut.sawDirty && !S.tables.some(t => t.dirty)) || S.tut.t > 70,
      target: () => { const t = S.tables.find(t => t.dirty); return t ? atFloor({ f: 1, x: t.x - 16, y: t.y - 52 }) : null; } },
    { key: 'pet', text: () => '有空的時候摸摸貓咪，貓咪開心就會去陪客人玩。點一隻貓試試看。',
      done: () => pets() > S.tut.pets0 || S.tut.t > 60,
      target: () => { const k = S.cats.find(k => k.floor === S.view && !k.onBed) || S.cats.find(k => k.floor === S.view); return k ? { world: { f: k.floor, x: k.x, y: k.y - 52 } } : { dom: '#floorBtn' }; } },
    { key: 'solo', ok: true, text: () => '做得很好！接下來交給你顧店到 21:00 打烊，有狀況我會提醒你。', done: () => false },
  ];
  // after the guided steps: one-off reminders, each shown at most once on day 1
  const HINTS = [
    { key: 'empty', when: () => S.phase === 'open' && dispTotal() === 0 && !Object.values(S.baking).some(Boolean),
      text: () => G.stock.flour > 0 ? '展示櫃賣光了，再去烤箱做一批。' : '麵粉用完了，用手機「商店」買一袋，再去烤。',
      target: () => G.stock.flour > 0 ? atFloor(OVEN) : buyPath('flour') },
    { key: 'noon', when: () => S.time >= 600, text: () => '10:00 午間尖峰，客人會變多！忙不過來可以用手機「喵才獵人」雇員工。' },
    { key: 'wc', when: () => S.restroomDirt >= 3, text: () => '洗手間髒了，點洗手間去打掃。', target: () => atFloor({ f: 1, x: 808, y: 330 }) },
    { key: 'litter', when: () => G.litterDirt >= litterMax(), text: () => '2F 的貓砂盆滿了，上樓點貓砂盆清理。', target: () => atFloor({ f: 2, x: LITTER.x, y: LITTER.y - 30 }) },
    { key: 'bowl', when: () => G.bowl === 0 && S.cats.some(k => k.hunger > 70), text: () => '貓碗空了，貓咪肚子餓。上 2F 點貓碗補貓糧（沒貓糧就用手機買）。', target: () => atFloor({ f: 2, x: BOWL.x, y: BOWL.y - 24 }) },
    { key: 'pet', when: () => S.cats.some(k => k.wantPet), text: () => { const k = S.cats.find(k => k.wantPet); return `${k ? k.name : '貓咪'}頭上出現「摸摸我」，走過去摸摸牠吧。`; },
      target: () => { const k = S.cats.find(k => k.wantPet); return k ? atFloor({ f: k.floor, x: k.x, y: k.y - 52 }) : null; } },
    { key: 'late', when: () => S.time >= 1200, text: () => '20:00 了，再撐一下，21:00 打烊會結算今天的成績。' },
  ];

  // only the very first time on this device: a finished or skipped guide, or any save past day 1, means it has been seen
  let seen = false;
  try { const c = localStorage.getItem('catloft-save'); seen = !!localStorage.getItem('catloft-tut') || (!!c && decodeSave(c).day > 1); } catch {}
  const markSeen = () => { seen = true; try { localStorage.setItem('catloft-tut', '1'); } catch {} };
  const active = () => started && S && S.day === 1 && !seen && !G.tutDone && !S.tutOff;
  function state() {
    if (!S.tut) S.tut = { i: 0, t: 0, pets0: pets(), sawDirty: false, hints: {}, hint: null, okd: {}, firstGone: false };
    return S.tut;
  }
  // which step / hint is showing now: { text, target, ok, n }
  function current() {
    const T = state();
    while (T.i < STEPS.length) {
      const st = STEPS[T.i];
      if ((st.ok && T.okd[st.key]) || (!st.ok && st.done())) { T.i++; T.t = 0; continue; }
      if (st.ok && st.key === 'hi' && S.phase !== 'prep') { T.okd.hi = true; continue; }
      return { text: st.text(), target: st.target ? st.target() : null, ok: st.ok, n: `第一天教學 ${T.i + 1}/${STEPS.length}` };
    }
    if (S.phase !== 'open') return null;
    if (T.hint) {
      const h = HINTS.find(h => h.key === T.hint);
      if (T.hintT > 0 || (h.target && h.when())) return { text: h.text(), target: h.target ? h.target() : null, ok: true, n: '小提醒' };
      T.hint = null;
    }
    const h = HINTS.find(h => !T.hints[h.key] && h.when());
    if (h) { T.hints[h.key] = true; T.hint = h.key; T.hintT = 8; return current(); }
    return null;
  }
  let cur = null, lit = [];
  function highlight(sel) {
    const els = sel ? [...document.querySelectorAll(sel)].filter(e => e.offsetParent) : [];
    lit.forEach(e => { if (!els.includes(e)) e.classList.remove('tut-hl'); });
    els.forEach(e => e.classList.add('tut-hl')); lit = els;
  }
  function render() {
    if (!S) return;
    if (started && S.day > 1 && !seen) markSeen();
    if (S.phase === 'settle' && S.day === 1 && !seen && !G.tutDone && !S.tutOff) finishDay();
    cur = active() && S.phase !== 'settle' ? current() : null;
    card.hidden = !cur; $('game').classList.toggle('coaching', !!cur);
    highlight(cur && cur.target && cur.target.dom);
    if (!cur) return;
    if ($('coachTxt').textContent !== cur.text) $('coachTxt').textContent = cur.text;
    $('coachN').textContent = cur.n; $('coachOk').hidden = !cur.ok;
  }
  function finishDay() {
    G.tutDone = true; markSeen();
    const sc = $('settleCard');
    if (sc && !sc.querySelector('.tut-done')) sc.insertAdjacentHTML('afterbegin', '<div class="tut-done"><b>🎉 第一天完成了！</b><br>從明天開始就交給你經營囉。忘記怎麼做的話，左邊的「說明」都有寫。</div>');
  }
  $('coachOk').onclick = () => {
    const T = state();
    if (T.hint) { T.hint = null; T.hintT = 0; }
    else if (T.i < STEPS.length) T.okd[STEPS[T.i].key] = true;
    render();
  };
  $('coachSkip').onclick = () => { S.tutOff = true; G.tutDone = true; markSeen(); if (S.startG) S.startG.tutDone = true; toast('教學關掉了，「說明」裡有完整玩法'); render(); };

  // the clock and new guests wait while the first guest is being looked after
  function hold() {
    if (!active() || S.phase !== 'open') return false;
    const T = state(); return T.i < STEPS.length && !!STEPS[T.i].hold;
  }
  let last = performance.now();
  setInterval(() => {
    const now = performance.now(), dt = (now - last) / 1000; last = now;
    if (!active()) { if (!card.hidden || lit.length) render(); return; }
    const T = state();
    if (!S.paused && !S.uiPause) { T.t += dt; if (T.hintT > 0) T.hintT -= dt; }
    if (S.tables.some(t => t.dirty)) T.sawDirty = true;
    if (!T.firstGone && S.cid > 0 && !S.customers.some(c => c.special)) T.firstGone = true;
    if (hold()) { const c = S.customers.find(c => c.special); if (c) c.pat = c.maxPat; } // she waits patiently while you learn
    render();
  }, 200);

  // a bouncing arrow over the target (or at the screen edge pointing to it)
  function drawWorld(f) {
    const p = cur && cur.target && cur.target.world;
    if (!p || p.f !== f) return;
    const left = -V.tx / V.s, right = left + (cv.clientWidth || W) / V.s, bob = Math.sin(S.t * 6) * 6;
    g.save(); g.lineJoin = 'round';
    if (p.x < left + 16 || p.x > right - 16) {
      const r = p.x > right - 16, x = r ? right - 22 : left + 22, y = clamp(p.y, 120, H - 120), d = r ? 1 : -1, o = bob * d;
      g.beginPath(); g.moveTo(x + 14 * d + o, y); g.lineTo(x - 8 * d + o, y - 16); g.lineTo(x - 8 * d + o, y + 16); g.closePath();
    } else {
      ell(p.x, p.y + 30, 26 + bob, 8 + bob / 3, 'rgba(217,119,62,.18)', 'rgba(217,119,62,.7)', 2);
      const y = p.y - 8 + bob;
      g.beginPath(); g.moveTo(p.x, y); g.lineTo(p.x - 17, y - 22); g.lineTo(p.x - 7, y - 22); g.lineTo(p.x - 7, y - 44); g.lineTo(p.x + 7, y - 44); g.lineTo(p.x + 7, y - 22); g.lineTo(p.x + 17, y - 22); g.closePath();
    }
    g.fillStyle = '#D9773E'; g.fill(); g.strokeStyle = '#FFFFFF'; g.lineWidth = 3; g.stroke();
    g.restore();
  }
  const phase = () => '跟著教學・時鐘暫停';
  window.TUT = { render, hold, drawWorld, phase };
})();
