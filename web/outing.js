// 暖陽貓閣「🚪 店長外出」：營業時間走到 1F 門口按「出門走走」，一天一次，出去約 2 小時（遊戲時間）。
// 店長不在的時候，店員照平常的工作顧店（缺哪個職位，那份工作就等店長回來），營收照算。
//   聯名公司：親自去談合作（簽約打折），合作中就去拜訪（合作多幾天）。
//   公園：發傳單、坐長椅休息、隨便逛逛（遇到各種小事）。
//   市場：食材比手機叫貨便宜，每樣今天只能買一份。
// 回店時把沒用完的時間快轉過去，再跳出「店長不在的時候」報告。粉絲只會增加，不會減少。
// 用到 index.html 的全域：G、S、started、toast、sfx、say、later、pick、rand、yen、cost、clamp、collabNow、COLLABS、COLLAB_DAYS、
// SHOP、ROLES、roleName、mgrSpr、update、updateButtons、renderTasks、endTask、heldCat、showPopup、saveProgress、dispTotal、DISHES、DOOR、$。
(function () {
  const OUT_MIN = 120, LAST_START = 18 * 60 + 30; // 2 game hours; must leave by 18:30 to be back before last order
  const MARKET_OFF = .7; // market prices: 30% off the phone price
  const PLACES = {
    co:   { name: '聯名公司', img: 'out_co',   desc: '親自去談合作，簽約比較便宜' },
    park: { name: '公園',     img: 'out_park', desc: '散散步、發傳單、遇到有趣的事' },
    mkt:  { name: '市場',     img: 'out_mkt',  desc: '食材比手機叫貨便宜' },
  };
  const REP = { cloud: 'c3', paw: 'c7', tea: 'c11', mug: 'c5', plush: 'c9' }; // which guest sprite plays each company's contact person
  // 談合作 question: one answer the company likes best (picked at random each visit)
  const PITCH = [
    ['我們的貓咪很親人，客人都捨不得走', '貓咪'],
    ['我們的甜點都是每天現烤的', '甜點'],
    ['來的客人很多都是常客', '常客'],
  ];
  const PARK_EVENTS = [
    { t: '巷口的阿嬤在公園散步，聽說你開咖啡廳，送你一袋自己磨的麵粉。', fn: () => { G.stock.flour += 5; return '麵粉 +5'; } },
    { t: '一群小學生圍過來問「你是貓咪咖啡廳的店長嗎？」說放學要去店裡看貓。', fn: () => fans(3) },
    { t: '長椅底下有一隻橘色的流浪貓，你摸了摸牠，牠呼嚕呼嚕地蹭你的手。', fn: () => { S.mgr.boost = 240; return '心情變好了，今天走路變快'; } },
    { t: '在草地上撿到一個錢包，交給公園管理員，失主塞了謝禮給你。', fn: () => { G.cash += 120; return '謝禮 ¥120'; } },
    { t: '遇到一位在畫畫的姊姊，她說想畫你的店，畫好要掛在店裡。', fn: () => fans(4) },
  ];
  const O = { at: null, start: 0, base: null, log: [], got: [], bought: {}, pitch: 0, step: '' };

  const css = document.createElement('style');
  css.textContent = `
  #outOv .card{max-width:760px;padding:14px}
  .out-stage{position:relative;width:100%;aspect-ratio:16/9;background:#F6EBDD center/cover;border-radius:12px;overflow:hidden}
  .out-who{position:absolute;bottom:4%;height:66%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center}
  .out-who img{height:calc(100% - 18px)}.out-who .nm{font:700 12px/1.2 inherit;color:#6B4A35;background:rgba(255,250,240,.88);border-radius:8px;padding:1px 6px;margin-top:2px;white-space:nowrap}
  .out-who.flip img{transform:scaleX(-1)}
  .out-title{position:absolute;left:10px;top:8px;background:rgba(255,250,240,.9);border-radius:10px;padding:3px 10px;font-weight:700;color:#6B4A35;font-size:14px}
  .out-clock{position:absolute;right:10px;top:8px;background:rgba(255,250,240,.9);border-radius:10px;padding:3px 10px;font-size:13px;color:#6B4A35}
  .out-say{margin:10px 0 6px;padding:10px 12px;background:#FFFBF4;border:1.5px solid #4A3A30;border-radius:12px;font-size:15px;line-height:1.55;min-height:48px}
  .out-say b{color:#B0603A}
  .out-btns{display:flex;flex-wrap:wrap;gap:6px}.out-btns button{flex:1 1 180px}
  .out-pick{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:8px 0}
  .out-pick button{display:flex;flex-direction:column;gap:4px;padding:6px;text-align:left}
  .out-pick img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px}
  .out-pick .nm{font-weight:700}.out-pick .sub{font-size:12px;color:#8A6A55}
  .out-warn{font-size:13px;color:#B0603A;margin:4px 0}`;
  document.head.appendChild(css);

  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'outOv'; ov.hidden = true;
  ov.innerHTML = '<div class="card" id="outCard"></div>';
  document.body.appendChild(ov);

  const hhmm = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const fans = n => { G.fans += n; S.today.fans += n; return `粉絲 +${n}`; };
  const missing = () => Object.keys(ROLES).filter(r => !ROLES[r].only).filter(r => !S.staff.some(s => s.role === r && !s.away));
  const MISS_NOTE = { cashier: '客人點餐要排隊等你回來', cook: '點心賣完就沒有人補', server: '餐點要等客人自己來拿…其實是等你回來送', feeder: '貓碗和貓砂盆沒人顧', sitter: '睡著的貓沒人叫醒' };

  function can() {
    return started && S && S.phase === 'open' && !S.out && !S.today.outed && S.time <= LAST_START && !(window.TUT && TUT.hold()) && !heldCat();
  }
  // the door action (1F, by the front door); after the outing, or too late in the day, the door says why
  function door(add) {
    if (!S || S.phase !== 'open' || S.out) return;
    if (can()) add(70, 566, '出門走走', pickPlace);
    else if (S.today.outed) add(70, 566, '今天已經出門過了', () => toast('一天只能出門一次，明天再出去走走吧'));
    else if (S.time > LAST_START) add(70, 566, '出門走走', () => toast('太晚了，18:30 以後要留在店裡準備打烊'));
  }

  function pickPlace() {
    if (!can()) return;
    S.uiPause = true; ov.hidden = false;
    const miss = missing();
    $('outCard').innerHTML = `<h2 style="margin:0 0 4px">🚪 出門走走</h2>
      <p class="muted" style="margin:4px 0">出去大約 2 小時（${hhmm(S.time)} 到 ${hhmm(S.time + OUT_MIN)}），店員會幫忙顧店，營收照算。一天只能出門一次。</p>
      ${miss.length ? `<div class="out-warn">店裡現在沒有：${miss.map(r => `${ROLES[r].title}（${MISS_NOTE[r]}）`).join('、')}</div>` : '<div class="out-warn" style="color:#6E9B4E">店員都在，可以放心出門！</div>'}
      <div class="out-pick">${Object.entries(PLACES).map(([id, P]) => `<button data-out="${id}"><img src="assets/${P.img}.webp" alt=""><span class="nm">${P.name}</span><span class="sub">${P.desc}</span></button>`).join('')}</div>
      <div class="row"><button id="outNo">還是待在店裡</button></div>`;
    $('outNo').onclick = () => { ov.hidden = true; S.uiPause = false; };
    ov.querySelectorAll('[data-out]').forEach(b => b.onclick = () => go(b.dataset.out));
  }

  function go(at) {
    if (!can()) { ov.hidden = true; S.uiPause = false; return; }
    const m = S.mgr;
    if (m.task) endTask(m); S.tasks = []; renderTasks(); m.sitting = false; m.path = [];
    S.out = true; S.today.outed = true; S.uiPause = false; // the shop keeps running behind the outing
    Object.assign(O, { at, start: S.time, base: { earned: G.earned, cid: S.cid, angry: S.today.angry, fans: G.fans }, log: [], got: [], bought: {}, pitch: Math.floor(Math.random() * PITCH.length), step: '' });
    m.floor = 1; m.x = DOOR.x; m.y = DOOR.y; m.hidden = true; S.view = 1; updateButtons();
    sfx('notify'); say(m, '我出門一下，店裡交給大家囉！');
    const st = S.staff.find(s => !s.away && !s.hidden); if (st) later(1.2, () => say(st, '好～店長路上小心！'));
    scene(at === 'co' ? (collabNow() ? 'visit' : 'co') : at);
  }

  // ---- one screen of the outing: painted background, the manager (and whoever they meet), a line of dialogue, buttons ----
  function stage(title, line, who, btns) {
    const P = PLACES[O.at];
    const me = `<div class="out-who" style="left:30%"><img src="assets/${mgrSpr()}_0.webp" alt=""><span class="nm">${G.mgrName}</span></div>`;
    const them = who ? `<div class="out-who flip" style="left:68%"><img src="assets/${who.spr}_0.webp" alt="" onerror="this.remove()"><span class="nm">${who.name}</span></div>` : '';
    $('outCard').innerHTML = `<div class="out-stage" style="background-image:url(assets/${P.img}.webp)"><div class="out-title">${title}</div><div class="out-clock" id="outClock"></div>${me}${them}</div>
      <div class="out-say">${line}</div><div class="out-btns">${btns.map((b, i) => `<button class="${b.primary ? 'primary' : ''}" data-ob="${i}" ${b.off ? 'disabled' : ''}>${b.t}</button>`).join('')}</div>`;
    ov.querySelectorAll('[data-ob]').forEach(el => el.onclick = () => { const b = btns[+el.dataset.ob]; if (!b.off) b.fn(); });
    ov.hidden = false; clock();
  }
  const home = { t: '回店裡', primary: true, fn: () => back() };
  function clock() {
    const el = $('outClock'); if (!el || !S.out) return;
    const left = Math.max(0, Math.ceil(O.start + OUT_MIN - S.time));
    el.textContent = `店裡現在 ${hhmm(S.time)}・${left ? `再 ${left} 分鐘要回去` : '該回店裡了'}`;
  }

  function scene(step) {
    O.step = step;
    if (step === 'co') { // pick which company to visit
      stage('🏢 聯名公司', '要去哪一家公司談合作？親自去談，合作費會比在手機上簽便宜。', null,
        Object.entries(COLLABS).map(([id, C]) => ({ t: `${C.co}（${C.item}）${yen(C.fee)}`, fn: () => talk(id) })).concat([{ t: '只是路過看看，回店裡', fn: () => back() }]));
    } else if (step === 'visit') { // already partners: visit them
      const C = collabNow(), id = G.collab.id, rep = { spr: REP[id], name: C.co };
      if (G.collab.visit) return stage(`🏢 ${C.co}`, `「店長又來啦！${C.item}賣得很好喔，我們下次再一起想新點子。」`, rep, [{ t: '聊聊天（粉絲 +1）', fn: () => { done(fans(1)); stage(`🏢 ${C.co}`, '聊了好多店裡貓咪的事，大家都笑得好開心。', rep, [home]); } }]);
      const gift = dispTotal() > 0;
      stage(`🏢 ${C.co}`, `「歡迎歡迎！店長親自跑一趟，${C.item}在你們店裡賣得怎麼樣？」`, rep, [
        { t: gift ? '帶一份店裡的點心當伴手禮' : '帶點心當伴手禮（展示櫃沒點心了）', off: !gift, fn: () => {
          for (const d of DISHES) if (S.display[d] > 0) { S.display[d]--; break; }
          G.collab.until += 2; G.collab.visit = true; done('合作多 2 天');
          stage(`🏢 ${C.co}`, `「哇，好好吃！我們決定<b>合作再多 2 天</b>，周邊多送一批過去！」`, rep, [home]); } },
        { t: '聊聊最近賣得怎麼樣', fn: () => {
          G.collab.until += 1; G.collab.visit = true; done('合作多 1 天');
          stage(`🏢 ${C.co}`, `「聽起來很順利呢！那我們<b>合作多延長 1 天</b>吧。」`, rep, [home]); } },
      ]);
    } else if (step === 'park') {
      stage('🌳 公園', '陽光好舒服。要做什麼呢？', null, [
        { t: '發傳單（粉絲變多，今天客人多一點）', fn: () => { S.promoMul *= 1.15; done(fans(Math.round(rand(3, 6)))); done('今天客人變多'); stage('🌳 公園', '發完一疊傳單，好多人說「好可愛，下次去看看！」', null, [home]); } },
        { t: '坐在長椅上休息（今天走路變快）', fn: () => { S.mgr.boost = 300; done('今天走路變快'); stage('🌳 公園', '坐在大樹下吹吹風，整個人都充好電了。', null, [home]); } },
        { t: '隨便逛逛', fn: () => { const E = pick(PARK_EVENTS); done(E.fn()); stage('🌳 公園', E.t, null, [home]); } },
      ]);
    } else if (step === 'mkt') {
      const items = SHOP.filter(it => !it.shop || it.shop === G.at);
      const price = it => Math.round(cost(it.price) * MARKET_OFF);
      stage('🧺 市場', `市場的東西比手機叫貨便宜三成，每樣今天只剩一份喔！（現金 ${yen(G.cash)}）`, null,
        items.map(it => ({ t: O.bought[it.id] ? `✓ ${it.name}（買好了）` : `${it.name} ${it.amt}${it.unit} ${yen(price(it))}`, off: O.bought[it.id] || G.cash < price(it), fn: () => {
          const p = price(it); G.cash -= p; S.today.spent += p; G.stock[it.id] += it.amt; O.bought[it.id] = true; sfx('delivery');
          done(`${it.name} +${it.amt}${it.unit}`); scene('mkt'); } })).concat([home]));
    }
  }

  function talk(id) {
    const C = COLLABS[id], rep = { spr: REP[id], name: C.co }, best = PITCH[O.pitch];
    stage(`🏢 ${C.co}`, `「你好你好！聽說你們是貓咪咖啡廳？可以說說你們店最大的特色嗎？」`, rep,
      PITCH.map((p, i) => ({ t: `「${p[0]}」`, fn: () => {
        const off = i === O.pitch ? .8 : .9, fee = Math.round(C.fee * off / 10) * 10;
        const line = i === O.pitch ? `「${best[1]}！這正是我們想找的！合作費算你<b>八折</b>吧！」` : `「原來如此～親自來談很有誠意，合作費算你<b>九折</b>。」`;
        stage(`🏢 ${C.co}`, `${line}<br>合作 ${COLLAB_DAYS} 天：${C.item}放進菜單讓客人加購，客人也會變多。`, rep, [
          { t: G.cash < fee ? `現金不夠（還差 ${yen(fee - G.cash)}）` : `簽約 ${yen(fee)}（原價 ${yen(C.fee)}）`, primary: true, off: G.cash < fee || collabNow(), fn: () => {
            if (collabNow() || G.cash < fee) return;
            G.cash -= fee; S.today.spent += fee; G.collab = { id, until: G.day + COLLAB_DAYS - 1, visit: true }; sfx('delivery');
            done(`跟${C.co}簽約（省 ${yen(C.fee - fee)}）`);
            stage(`🏢 ${C.co}`, `「合作愉快！${C.item}今天就送到你們店裡。」`, rep, [home]); } },
          { t: '再想想，下次再說', fn: () => back() },
        ]); } })));
  }
  function done(t) { if (t) O.got.push(t); }

  // ---- coming home: fast-forward whatever is left of the 2 hours, then the report ----
  function back(forced) {
    if (!S.out) return;
    const end = Math.min(O.start + OUT_MIN, 1229);
    if (S.time < end && S.phase === 'open') {
      const mute = G.sfx; G.sfx = false;
      for (let i = 0; i < 4000 && S.time < end && S.phase === 'open'; i++) update(1 / 30);
      G.sfx = mute;
    }
    S.out = false; ov.hidden = true; S.uiPause = false;
    const m = S.mgr; m.floor = 1; m.x = 40; m.y = 570; m.path = []; m.face = 1; m.hidden = false; S.view = 1; updateButtons();
    const b = O.base, guests = S.cid - b.cid, earned = G.earned - b.earned, angry = S.today.angry - b.angry;
    const miss = missing(), lines = [];
    const by = r => S.staff.find(s => s.role === r && !s.away);
    if (angry && miss.includes('cashier')) lines.push(`排隊的客人等太久，有 ${angry} 位生氣走了…（店裡沒有櫃檯人員）`);
    else if (angry) lines.push(`有 ${angry} 位客人等太久生氣走了`);
    if (S.queue.length && !by('cashier')) lines.push(`還有 ${S.queue.length} 位客人在櫃檯排隊，等你回來點餐！`);
    if (by('cashier') && guests) lines.push(`${by('cashier').name}：「點餐都是我幫忙的喔！」`);
    if (by('cook')) lines.push(`${by('cook').name}：「展示櫃我有一直補！」`);
    if (by('server')) lines.push(`${by('server').name}：「桌子都收乾淨了～」`);
    if (!S.staff.some(s => !s.away)) lines.push('店裡一個店員都沒有，客人只能等你回來…');
    say(m, pick(['我回來了！', '大家辛苦了～', '外面好好玩，回來工作囉！']));
    sfx('notify');
    showPopup(`<h2 style="margin-top:0">🚪 ${G.mgrName}回來了！</h2>
      ${forced ? '<p class="muted">快要最後點餐了，趕快回店裡！</p>' : ''}
      <p><b>店長不在的時候</b>：來了 ${guests} 位客人，收入 ${yen(earned)}${angry ? `，${angry} 位等太久走了` : ''}。</p>
      ${lines.length ? `<ul style="margin:4px 0 8px;padding-left:20px">${lines.map(l => `<li>${l}</li>`).join('')}</ul>` : ''}
      ${O.got.length ? `<p style="margin:6px 0 2px"><b>這次出門</b></p><ul style="margin:0;padding-left:20px">${O.got.map(t => `<li>${t}</li>`).join('')}</ul>` : ''}`);
    saveProgress();
  }

  // the shop clock keeps running while the outing screen is open: tick the clock, and bring the manager home before last order
  let tipped = false; try { tipped = !!localStorage.getItem('catloft-outing-tip'); } catch {}
  setInterval(() => {
    if (!tipped && can()) { tipped = true; try { localStorage.setItem('catloft-outing-tip', '1'); } catch {} toast('新功能：營業時間走到 1F 門口，可以「出門走走」喔！'); }
    if (!S || !S.out) return;
    clock();
    if (S.phase !== 'open' || S.time >= 1215) back(true);
  }, 300);

  window.OUTING = { door, can, active: () => !!(S && S.out) };
})();
