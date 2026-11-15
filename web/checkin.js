// 暖陽貓閣「📅 每日簽到」：真實世界的每一天可以簽到一次，七天一輪（Chuck 2026-10-29「新增每日簽到獎勵共七天」）。
// 用的是累計天數，不是連續天數：漏掉一天不會歸零，下次再來就領下一格（小朋友不會因為一天沒玩就前功盡棄）。
// 進度存在 G.sign = { n: 總共簽到幾次, last: 最後簽到的日期 'YYYY-MM-DD' }，跟著存檔一起上雲端，換裝置也接得上。
// 第 7 天的大獎：第一輪送「幸運草鈴鐺項圈」（貓咪），第二輪送「幸運草髮夾」（店長），之後換成現金。
// 現金獎勵跟著開了幾家店變多，不然開到第三家店時 ¥300 就沒感覺了。
// 🔥 連勝火花（Chuck 2026-11-15「每天開始玩的時候手指點一下火花就會亮起，然後會出現你連勝幾天」）：
//   畫面左上角有一個火花，每天第一次是灰的，點一下就亮起來，顯示「連續 N 天」。點亮火花會一起簽到領獎勵（同一張卡）。
//   漏掉一天：守火貓幫你守住一次，連勝不斷；用掉之後再連續點亮 7 天守火貓才回來。漏掉兩天以上就從 1 天重新開始。
//   存在 G.streak = { n, best, last, days, guard }（「我的紀錄」也看這個），一樣用真實世界的日期。
// 用到 index.html 的全域：G、S、started、closeChoose、saveProgress、toast、sfx、yen、gainExp、CHARMS、renderPhone、$。
(function () {
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const ago = k => { const d = new Date(); d.setDate(d.getDate() - k); return ymd(d); };
  // put the same change on G and on the day-start snapshot, so the save code agrees
  const both = fn => { fn(G); if (S && S.startG) fn(S.startG); };
  const st = () => G.sign || (G.sign = { n: 0, last: '' });
  // 'YYYY-MM-DD' strings compare by date; a later `last` (the device clock went back) waits until that day has passed
  const can = () => !!(G && today() > st().last);
  const mul = () => [1, 1, 3, 10][Math.min(G.owned.length, 3)];
  const BIG = ['clover', 'cloverclip'];

  // the reward for the k-th square (0..6) of round r, as {icon, text, give(g)}; give() runs on G and on the day-start snapshot
  function reward(k, r) {
    const cash = n => ({ icon: '¥', text: yen(n * mul()), give: g => { g.cash += n * mul(); } });
    const stock = (list, icon, text) => ({ icon, text, give: g => { for (const [id, n] of list) g.stock[id] = (g.stock[id] || 0) + n; } });
    switch (k) {
      case 0: return cash(300);
      case 1: return stock([['treat', 10], ['catfood', 3]], '🐟', '肉泥 10 條、貓糧 3 包');
      case 2: return cash(500);
      case 3: return stock([['beans', 5], ['flour', 10]], '☕', '咖啡豆 5 包、麵粉 10 份');
      case 4: return cash(800);
      case 5: return { icon: '⭐', text: '店鋪經驗 +40', give: (g, main) => { if (main) gainExp(40); else g.exp += 40; } };
      default: {
        const id = BIG[r];
        if (id && CHARMS[id]) return { icon: '🍀', img: CHARMS[id].img, text: `限定「${CHARMS[id].name}」`, charm: id,
          give: g => { if (!g.acc.own.includes(id)) g.acc.own.push(id); if (CHARMS[id].slot !== 'cat' && !g.acc.mgr[CHARMS[id].slot]) g.acc.mgr[CHARMS[id].slot] = id; } };
        return { ...cash(2000), icon: '💰' };
      }
    }
  }
  const pos = () => { const n = st().n; return { k: n % 7, r: Math.floor(n / 7) }; };

  // the 7 squares of this round; `got` = already signed, `now` = the one to take today
  function grid() {
    const { k, r } = pos(), ok = can();
    // after signing day 7 the next round only shows tomorrow, so today still shows the full round as done
    const done7 = !ok && k === 0 && st().n > 0, row = done7 ? r - 1 : r, at = done7 ? 7 : k;
    return `<div class="signg">${[0, 1, 2, 3, 4, 5, 6].map(i => {
      const R = reward(i, row), got = i < at, now = ok && i === at;
      return `<div class="signd${got ? ' got' : ''}${now ? ' now' : ''}${i === 6 ? ' big' : ''}"><small>第 ${i + 1} 天</small>
        <span class="si">${R.img ? `<img src="assets/${R.img}.webp" alt="">` : R.icon}</span><span class="st">${R.text}</span>${got ? '<i>✓</i>' : ''}</div>`; }).join('')}</div>`;
  }
  const note = () => `<p class="muted" style="margin:6px 0 0">每天可以簽到一次，漏掉一天也不會歸零，下次來就領下一格。已經簽到 ${st().n} 天。</p>`;

  // ---------- 🔥 連勝火花 ----------
  const GUARD_BACK = 7;
  const fs = () => { const f = G.streak || (G.streak = { n: 0, best: 0, last: '', days: 0, guard: 1 }); if (f.guard !== 0) f.guard = 1; return f; };
  const lit = () => !!G && fs().last >= today();
  // what lighting today would do: keep going (yesterday), saved by the guard cat (missed exactly one day), or start over
  function plan() {
    const f = fs();
    if (f.last === ago(1)) return { n: f.n + 1, saved: false };
    if (f.n > 0 && f.last === ago(2) && f.guard) return { n: f.n + 1, saved: true };
    return { n: 1, saved: false, lost: f.n > 1 ? f.n : 0 };
  }
  // the number the unlit flame shows: the streak still alive (or 0 if it already went out)
  const alive = () => { const f = fs(); if (lit()) return f.n; const p = plan(); return p.n > 1 ? f.n : 0; };
  function light() {
    if (!G || lit()) return null;
    const f = fs(), p = plan();
    const guard = p.saved ? 0 : (f.guard || (p.n % GUARD_BACK === 0 ? 1 : 0));
    const back = !p.saved && !f.guard && guard === 1;
    both(g => { g.streak = { n: p.n, best: Math.max(f.best || 0, p.n), last: today(), days: (f.days || 0) + 1, guard }; });
    saveProgress(); paint();
    return { ...p, from: p.lost || p.n === 1 ? 0 : f.n, back };
  }
  const guardLine = () => fs().guard ? '🐱 守火貓待命中：漏一天也會幫你守住火花' : `🐱 守火貓休息中，再連續點亮 ${GUARD_BACK - fs().n % GUARD_BACK} 天就回來`;
  function paint() {
    const b = $('flameBtn'); if (!b) return;
    b.hidden = !started || !G; if (b.hidden) return;
    const on = lit();
    b.classList.toggle('off', !on);
    $('flameN').textContent = alive();
    b.setAttribute('aria-label', on ? `連勝火花：連續 ${fs().n} 天` : '連勝火花還沒點亮，點一下點亮');
  }

  function claim() {
    if (!can()) return null;
    const { k, r } = pos(), R = reward(k, r);
    R.give(G, true); if (S && S.startG) { R.give(S.startG, false); S.startG.sign = { n: st().n + 1, last: today() }; }
    G.sign = { n: st().n + 1, last: today() };
    const fire = light();
    saveProgress(); sfx(k === 6 ? 'badge' : 'wallet');
    return { k, R, fire };
  }
  const doneText = ({ k, R }) => R.charm ? `簽到第 7 天！拿到${R.text}，${CHARMS[R.charm].slot === 'cat' ? '到手機「衣櫃」幫貓咪戴上吧' : '已經戴上了'}` : `簽到第 ${k + 1} 天：${R.text}`;

  // ---------- phone app ----------
  function page() {
    return grid() + `<div class="row" style="margin:8px 0 0;justify-content:center">${can() ? '<button class="primary" id="signGo">今天簽到</button>' : '<button disabled>今天簽到過了，明天再來</button>'}</div>` + note();
  }
  function bind(sc) {
    const b = sc.querySelector('#signGo'); if (!b) return;
    b.onclick = () => { const got = claim(); if (got) { toast(doneText(got)); if (got.fire) toast(`🔥 火花點亮了！連續 ${got.fire.n} 天`); } renderPhone(); };
  }
  const sub = () => can() ? '今天還沒簽到！' : `已簽到 ${st().n} 天`;

  // ---------- the flame card: pops up when the shop opens, or when the flame at the top left is tapped ----------
  // lighting the flame also signs in for today (one card, not two popups)
  const free = () => started && S && S.phase !== 'settle' && !S.cook && !S.reg && !S.mini && !S.uiPause && !S.out && $('phoneOv').hidden && $('chooseOv').hidden;
  const need = () => !!G && (!lit() || can());
  const sparks = () => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => { const a = i / 10 * Math.PI * 2, r = 70 + (i % 3) * 12;
    return `<i style="--x:${Math.round(Math.cos(a) * r)}px;--y:${Math.round(Math.sin(a) * r)}px;animation-delay:${(i % 3) * 60}ms"></i>`; }).join('');
  function card() {
    const c = $('chooseCard'), on = lit(), f = fs(), p = on ? null : plan();
    let cap;
    if (on) cap = `<div class="n">連續 ${f.n} 天</div><div class="muted">最長紀錄 ${Math.max(f.best || 0, f.n)} 天・今天的火花已經點亮了</div>`;
    else cap = `<div class="hint">點一下火花，把它點亮！</div><div class="muted">${p.n > 1 ? `點亮就是連續 ${p.n} 天${p.saved ? '（昨天沒來，守火貓會幫你守住）' : ''}` : (p.lost ? `上次連續 ${p.lost} 天，火花熄掉了，今天重新點起來吧` : '每天來點一下，火花就會越燒越旺')}</div>`;
    const sign = can() ? `<p class="muted" style="text-align:center;margin:6px 0 0">${on ? '今天還沒簽到喔' : '點亮火花會一起簽到領今天的獎勵'}</p>${grid()}` : '';
    const btns = on ? (can() ? '<button id="flLater">等一下</button><button class="primary" id="flSign">簽到領獎勵</button>' : '<button class="primary" id="flLater">好！</button>') : '<button id="flLater">等一下</button>';
    c.innerHTML = `<h2>🔥 今天的火花</h2><button class="flamebig ${on ? 'lit' : 'off'}" id="flBig" aria-label="${on ? '火花亮著' : '點一下點亮火花'}"><span class="fl">🔥</span>${sparks()}</button>
      <div class="flamecap" id="flCap">${cap}</div><div class="flameguard">${guardLine()}</div><div id="flSignBox">${sign}</div><div class="row" id="flBtns">${btns}</div>`;
    $('chooseOv').hidden = false; S.uiPause = true;
    $('flLater').onclick = () => { closeChoose(); paint(); };
    const s2 = $('flSign'); if (s2) s2.onclick = () => { const got = claim(); done(null, got); };
    if (!on) $('flBig').onclick = () => {
      const fire = light(); if (!fire) return;
      const got = can() ? claim() : null;
      const b = $('flBig'); b.classList.remove('off'); b.classList.add('lit', 'go'); b.onclick = null;
      sfx('badge'); done(fire, got);
    };
  }
  // after lighting / signing: count the number up, then show what happened
  function done(fire, got) {
    const f = fs(), cap = $('flCap');
    let extra = '';
    if (fire && fire.saved) extra += '<div class="flamesave">昨天沒來，🐱 守火貓幫你守住了火花！</div>';
    if (fire && fire.back) extra += '<div class="flamesave">🐱 守火貓休息夠了，又回來幫你守火了！</div>';
    if (fire && fire.lost) extra += `<div class="muted">火花重新點起來了，明天再來就是連續 2 天！</div>`;
    cap.innerHTML = `<div class="n" id="flNum">連續 ${fire ? fire.from : f.n} 天</div><div class="muted">最長紀錄 ${f.best || f.n} 天</div>${extra}`;
    if (fire) { const a = fire.from, z = fire.n, t0 = performance.now();
      const step = t => { const k = Math.min(1, (t - t0) / 700), el = $('flNum'); if (!el) return; el.textContent = `連續 ${Math.round(a + (z - a) * k)} 天${k === 1 ? '！' : ''}`; if (k < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step); }
    $('flSignBox').innerHTML = got ? `${grid()}<p style="text-align:center;font-weight:700;margin:4px 0 0">${doneText(got)}</p>` : '';
    document.querySelector('#chooseCard .flameguard').textContent = guardLine();
    $('flBtns').innerHTML = '<button class="primary" id="flOk">好！</button>';
    $('flOk').onclick = () => { closeChoose(); paint(); };
    paint();
  }
  function offer() { paint(); if (G && G.day > 1 && need() && free()) card(); }
  function tap() {
    if (!started || !S) return;
    if (!$('chooseOv').hidden || !$('phoneOv').hidden || S.cook || S.reg || S.mini || S.phase === 'settle') { toast('等一下再來點火花喔'); return; }
    card();
  }
  const btn = document.getElementById('flameBtn'); if (btn) btn.onclick = tap;
  // look a little after the shop opens (after the gift check), then every minute so a page left open past midnight offers the new day
  setInterval(() => { if (document.visibilityState === 'visible') offer(); }, 60000);
  setInterval(paint, 3000);
  const wait = setInterval(() => { if (started) { clearInterval(wait); paint(); setTimeout(offer, 6000); } }, 2000);

  window.CHECKIN = { page, bind, sub, can, lit, light, paint, card };
})();
