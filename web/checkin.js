// 暖陽貓閣「📅 每日簽到」：真實世界的每一天可以簽到一次，七天一輪（Chuck 2026-10-29「新增每日簽到獎勵共七天」）。
// 用的是累計天數，不是連續天數：漏掉一天不會歸零，下次再來就領下一格（小朋友不會因為一天沒玩就前功盡棄）。
// 進度存在 G.sign = { n: 總共簽到幾次, last: 最後簽到的日期 'YYYY-MM-DD' }，跟著存檔一起上雲端，換裝置也接得上。
// 第 7 天的大獎：第一輪送「幸運草鈴鐺項圈」（貓咪），第二輪送「幸運草髮夾」（店長），之後換成現金。
// 現金獎勵跟著開了幾家店變多，不然開到第三家店時 ¥300 就沒感覺了。
// 用到 index.html 的全域：G、S、started、closeChoose、saveProgress、toast、sfx、yen、gainExp、CHARMS、renderPhone、$。
(function () {
  const pad = n => String(n).padStart(2, '0');
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
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

  function claim() {
    if (!can()) return null;
    const { k, r } = pos(), R = reward(k, r);
    R.give(G, true); if (S && S.startG) { R.give(S.startG, false); S.startG.sign = { n: st().n + 1, last: today() }; }
    G.sign = { n: st().n + 1, last: today() };
    saveProgress(); sfx(k === 6 ? 'badge' : 'wallet');
    return { k, R };
  }
  const doneText = ({ k, R }) => R.charm ? `簽到第 7 天！拿到${R.text}，${CHARMS[R.charm].slot === 'cat' ? '到手機「衣櫃」幫貓咪戴上吧' : '已經戴上了'}` : `簽到第 ${k + 1} 天：${R.text}`;

  // ---------- phone app ----------
  function page() {
    return grid() + `<div class="row" style="margin:8px 0 0;justify-content:center">${can() ? '<button class="primary" id="signGo">今天簽到</button>' : '<button disabled>今天簽到過了，明天再來</button>'}</div>` + note();
  }
  function bind(sc) {
    const b = sc.querySelector('#signGo'); if (!b) return;
    b.onclick = () => { const got = claim(); if (got) toast(doneText(got)); renderPhone(); };
  }
  const sub = () => can() ? '今天還沒簽到！' : `已簽到 ${st().n} 天`;

  // ---------- the card when the shop opens ----------
  const free = () => started && S && G.day > 1 && S.phase !== 'settle' && !S.cook && !S.reg && !S.mini && !S.uiPause && !S.out && $('phoneOv').hidden && $('chooseOv').hidden;
  function offer() {
    if (!can() || !free()) return;
    const c = $('chooseCard');
    c.innerHTML = `<h2>📅 每日簽到</h2>${grid()}<div class="row"><button id="signLater">等一下</button><button class="primary" id="signNow">簽到領獎勵</button></div>${note()}`;
    $('chooseOv').hidden = false; S.uiPause = true;
    $('signLater').onclick = closeChoose;
    $('signNow').onclick = () => {
      const got = claim(); if (!got) { closeChoose(); return; }
      c.innerHTML = `<h2>📅 簽到成功！</h2>${grid()}<p style="text-align:center;font-weight:700">${doneText(got)}</p><div class="row"><button class="primary" id="signOk">好！</button></div>`;
      $('signOk').onclick = closeChoose;
    };
  }
  // look a little after the shop opens (after the gift check), then every minute so a page left open past midnight offers the new day
  setInterval(() => { if (document.visibilityState === 'visible') offer(); }, 60000);
  const wait = setInterval(() => { if (started) { clearInterval(wait); setTimeout(offer, 6000); } }, 2000);

  window.CHECKIN = { page, bind, sub, can };
})();
