// 暖陽貓閣「🏦 喵喵銀行」和「🏅 我的紀錄」。兩個都照真實世界的日期算（跟每日簽到一樣，用這台裝置的日期）。
// 銀行（Chuck 2026-10-31）：「連續存錢 16 天可以獲得一萬元」「存進去的錢無法領回來，每次存 $1000」「算真實世界的」。
//   每天可以存一次 ¥1,000；一定要連續，漏掉一天就重來，已經存的錢拿不回來。存滿 16 天拿獎勵，然後開始新的一輪。
//   本來還要送 20 寶石，遊戲還沒有寶石，先不送。存滿那天一次拿回 ¥30,000（Chuck：存進去的 ¥16,000 加獎勵，「改成 30,000 整比較好」）。
//   G.bank = { n: 這一輪存了幾天, last: 最後存錢的日期, sum: 這一輪存了多少, won: 存滿過幾輪 }
// 我的紀錄（Chuck 2026-10-31「連勝上線天數，還有玩家可以看得到自己遊玩的總時間，這樣會比較有成就感」）：
//   G.streak = { n: 連續幾天有上線, best: 最長連續, last: 最後上線的日期, days: 總共上線幾天 }；總遊玩時間是 G.play（只算畫面開著、兩分鐘內有操作）。
// 用到 index.html 的全域：G、S、started、saveProgress、toast、sfx、yen、renderPhone。
(function () {
  const DAYS = 16, PER = 1000, PAYOUT = 30000;
  const pad = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const yesterday = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); };
  // put the same change on G and on the day-start snapshot, so the save code agrees
  const both = fn => { fn(G); if (S && S.startG) fn(S.startG); };

  // ---------- 我的紀錄: the login streak ----------
  function touch() {
    if (!started || !G) return;
    const st = G.streak || (G.streak = { n: 0, best: 0, last: '', days: 0 }), t = today();
    if (st.last >= t) return; // already counted today (or the clock went back)
    const n = st.last === yesterday() ? st.n + 1 : 1;
    both(g => { g.streak = { n, best: Math.max(st.best, n), last: t, days: (st.days || 0) + 1 }; });
    if (n > 1) toast(`🔥 連續上線第 ${n} 天！`);
    saveProgress();
  }
  const hms = s => { s = Math.floor(s || 0); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} 小時 ${m} 分` : `${m} 分鐘`; };
  function recordPage() {
    const st = G.streak || { n: 0, best: 0, days: 0 };
    const box = (icon, big, label) => `<div class="item" style="text-align:center;margin:0;padding:12px 6px"><div style="font-size:26px">${icon}</div><div style="font-size:22px;font-weight:700">${big}</div><div class="sub">${label}</div></div>`;
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
      ${box('🔥', `${st.n} 天`, '連續上線')}${box('🏆', `${st.best} 天`, '最長連續上線')}
      ${box('⏱️', hms(G.play), '總遊玩時間')}${box('📅', `${st.days || 0} 天`, '總共上線')}
      ${box('☀️', `第 ${G.day} 天`, '店裡過了幾天')}${box('🚪', (G.stats.guests || 0).toLocaleString() + ' 位', '接待過的客人')}</div>
      <p class="muted" style="margin:8px 0 0">每天（真實世界的日期）打開遊戲就算上線一天，隔一天沒來連續天數會重新算。遊玩時間只算畫面開著、有在玩的時間，從 2026/10/31 開始算。</p>`;
  }

  // ---------- 喵喵銀行 ----------
  const bk = () => G.bank || (G.bank = { n: 0, last: '', sum: 0, won: 0 });
  // a round that skipped a day is broken: the money saved so far is gone
  function broken() { const b = bk(); return b.n > 0 && b.last < yesterday(); }
  function fixBroken() {
    if (!broken()) return false;
    const lost = bk().sum;
    both(g => { g.bank = { ...(g.bank || bk()), n: 0, sum: 0 }; });
    saveProgress(); toast(`🏦 有一天沒存錢，連續存錢斷掉了（存的 ${yen(lost)} 拿不回來），重新開始吧`);
    return true;
  }
  const canSave = () => !!G && today() > bk().last;
  function deposit() {
    fixBroken();
    if (!canSave()) { toast('今天已經存過了，明天再來'); return; }
    if (G.cash < PER) { toast(`現金不夠 ${yen(PER)}，先去賺錢吧`); return; }
    const b = bk(), n = b.n + 1, t = today();
    if (n >= DAYS) {
      const pay = PAYOUT;
      both(g => { g.cash += pay - PER; g.bank = { n: 0, last: t, sum: 0, won: ((g.bank && g.bank.won) || 0) + 1 }; });
      sfx('badge'); toast(`🏦 連續存錢 ${DAYS} 天完成！拿到 ${yen(pay)}`);
    } else {
      both(g => { g.cash -= PER; g.bank = { n, last: t, sum: b.sum + PER, won: b.won || 0 }; });
      sfx('wallet'); toast(`🏦 存了 ${yen(PER)}，連續第 ${n} 天`);
    }
    saveProgress(); renderPhone();
  }
  function bankPage() {
    fixBroken();
    const b = bk(), ok = canSave();
    const cells = Array.from({ length: DAYS }, (_, i) => `<div style="aspect-ratio:1;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:11px;
      ${i < b.n ? 'background:#E9C46A;color:#5D4037;font-weight:700' : i === DAYS - 1 ? 'background:#FFF4E5;border:2px dashed #E8873A;color:#B85F1E' : 'background:#F3EBE0;color:#B0A090'}">
      <span style="font-size:${i === DAYS - 1 ? 18 : 15}px">${i < b.n ? '🪙' : i === DAYS - 1 ? '🎁' : '·'}</span>第 ${i + 1} 天</div>`).join('');
    const prize = `存滿 ${DAYS} 天一次拿回 ${yen(PAYOUT)}（存的 ${yen(DAYS * PER)} 加獎勵）`;
    return `<div class="item" style="margin:0 0 8px"><div class="top"><span class="nm">這一輪已經存了</span><span class="nm">${yen(b.sum)}</span></div>
      <div class="sub">每天存 ${yen(PER)}，${prize}。一定要每天連續存，漏掉一天就重來，已經存的錢拿不回來喔！</div></div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">${cells}</div>
      <div class="row" style="margin:10px 0 0;justify-content:center">${ok ? `<button class="primary" id="bankGo">今天存 ${yen(PER)}</button>` : '<button disabled>今天存過了，明天再來</button>'}</div>
      ${b.won ? `<p class="muted" style="text-align:center;margin:6px 0 0">已經存滿過 ${b.won} 輪</p>` : ''}`;
  }
  function bind(sc) { const g = sc.querySelector('#bankGo'); if (g) g.onclick = deposit; }
  const sub = () => { if (!G) return ''; const b = bk(); return canSave() ? (b.n ? `第 ${b.n + 1} 天還沒存！` : '每天存 ¥1,000') : `連續 ${b.n || DAYS} 天`; };

  setInterval(() => { if (document.visibilityState === 'visible') touch(); }, 60000);
  const wait = setInterval(() => { if (started) { clearInterval(wait); touch(); } }, 2000);

  window.BANK = { page: bankPage, bind, sub, can: () => !!G && canSave() && bk().n > 0 && !broken() };
  window.RECORD = { page: recordPage, sub: () => G && G.streak && G.streak.n ? `連續上線 ${G.streak.n} 天` : '遊玩時間' };
})();
