// 暖陽貓閣「🎁 管理者的禮物」：管理者在 admin/ 頁面送給玩家的錢（Chuck：只能送錢，不限金額）。
// 管理者自己的帳號另外可以「調整」任何數值（gift = {set:{...}}，Chuck：「最高管理者要調自己的什麼都可以」）。
// 禮物存在 Supabase 的 catloft_gifts（supabase/catloft_admin.sql）。開店時和每分鐘看一次有沒有新禮物，
// 先跟資料庫收下（catloft_claim_gifts 只回這次真的收到的），再放進存檔，所以兩台裝置同時開也不會收兩次。
// 用到 index.html 的全域：G、S、CLOUD、started、showPopup、saveProgress、toast、sfx、yen、cleanName、LV_EXP、MAX_LV、SHOP、OUTFITS、CHARMS、FURN、TOOLS、EXPANSIONS、maxTables、$。
(function () {
  const on = () => !!(CLOUD.sb && !CLOUD.db && CLOUD.uid);
  let busy = false;
  // only when nothing else is on screen, so the gift card doesn't cover a minigame or another popup
  const free = () => started && S && S.phase !== 'settle' && !S.cook && !S.reg && !S.mini && !S.uiPause && !S.out && $('phoneOv').hidden && $('chooseOv').hidden;

  // put one gift's money into G (and the day-start snapshot, so the save code matches); returns the amount
  function give(gift, g) {
    const cash = Math.floor(Number(gift.cash) || 0);
    if (cash > 0 && Number.isSafeInteger(cash)) { g.cash += cash; return cash; }
    return 0;
  }

  // admin's own account: overwrite values on G (and the day-start snapshot); returns what changed, as text lines
  function edit(set, g) {
    const out = [], n = v => Math.floor(Number(v)), ok = v => Number.isSafeInteger(n(v)) && n(v) >= 0;
    const put = (k, label, v) => { if (ok(v)) { g[k] = n(v); out.push(`${label}：${k === 'cash' || k === 'debt' || k === 'earned' ? yen(g[k]) : g[k].toLocaleString()}`); } };
    if ('cash' in set) put('cash', '現金', set.cash);
    if ('debt' in set) put('debt', '欠款', set.debt);
    if ('fans' in set) put('fans', '粉絲', set.fans);
    if ('day' in set && n(set.day) >= 1) put('day', '天數', set.day);
    if ('earned' in set) put('earned', '累計營收', set.earned);
    if ('lv' in set && n(set.lv) >= 1) { const l = Math.min(n(set.lv), MAX_LV); g.exp = LV_EXP[l - 1]; out.push(`店鋪等級：Lv.${l}`); }
    if ('stock' in set && ok(set.stock)) { for (const k of Object.keys(g.stock)) g.stock[k] = n(set.stock); out.push(`所有食材：各 ${n(set.stock)} 份`); }
    if (set.outfits) { for (const o of OUTFITS) if (!g.wardrobe.includes(o.id)) g.wardrobe.push(o.id); out.push('所有衣服'); }
    if (set.charms) { for (const id of Object.keys(CHARMS)) if (!g.acc.own.includes(id)) g.acc.own.push(id); out.push('所有飾品'); }
    if (set.furn) { for (const id of [...Object.keys(FURN), ...Object.keys(TOOLS).filter(t => TOOLS[t].keep)]) if (!g.furn.includes(id)) g.furn.push(id); out.push('所有傢俱'); }
    if (set.expand) { g.expand = EXPANSIONS.length; out.push('擴建全部完成'); }
    if (set.tables) { const e = G.expand; G.expand = g.expand; g.tables = maxTables(); G.expand = e; out.push(`桌子：${g.tables} 張`); }
    return out;
  }

  async function check() {
    if (busy || !on() || !free()) return;
    busy = true;
    try {
      const { data: list, error } = await CLOUD.sb.rpc('catloft_my_gifts');
      if (error || !list || !list.length || !free()) return;
      const { data: ids, error: e2 } = await CLOUD.sb.rpc('catloft_claim_gifts', { p_ids: list.map(x => x.id) });
      if (e2 || !ids || !ids.length) return;
      const mine = list.filter(x => ids.includes(x.id));
      let total = 0; const notes = [], changed = [];
      for (const x of mine) {
        if (x.gift && x.gift.set && typeof x.gift.set === 'object') {
          changed.push(...edit(x.gift.set, G));
          if (S.startG) edit(x.gift.set, S.startG);
          continue;
        }
        total += give(x.gift || {}, G);
        if (S.startG) give(x.gift || {}, S.startG);
        const t = cleanName(x.note, '', 60); if (t) notes.push(t);
      }
      saveProgress();
      sfx('delivery');
      if (total) showPopup(`<h2>🎁 收到管理者的禮物！</h2><p style="font-size:22px;font-weight:700;text-align:center">${yen(total)}</p>` + notes.map(t => `<p>「${t}」</p>`).join('') +
        (changed.length ? `<p>管理者也調整了：${changed.join('、')}</p>` : ''));
      else if (changed.length) showPopup(`<h2>🛠️ 管理者調整好了</h2><ul class="unl">${changed.map(l => `<li>${l}</li>`).join('')}</ul><p class="muted">傢俱、桌子和擴建明天開店時會擺好。</p>`);
    } catch {} finally { busy = false; }
  }
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 60000);
  // first look shortly after the shop opens
  const wait = setInterval(() => { if (started && on()) { clearInterval(wait); setTimeout(check, 3000); } }, 2000);
})();
