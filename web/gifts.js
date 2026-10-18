// 暖陽貓閣「🎁 管理者的禮物」：管理者在 admin/ 頁面送給玩家的錢（Chuck：只能送錢，不限金額）。
// 禮物存在 Supabase 的 catloft_gifts（supabase/catloft_admin.sql）。開店時和每分鐘看一次有沒有新禮物，
// 先跟資料庫收下（catloft_claim_gifts 只回這次真的收到的），再放進存檔，所以兩台裝置同時開也不會收兩次。
// 用到 index.html 的全域：G、S、CLOUD、started、showPopup、saveProgress、toast、sfx、yen、cleanName、$。
(function () {
  const on = () => !!(CLOUD.sb && !CLOUD.db && CLOUD.uid);
  let busy = false;
  // only when nothing else is on screen, so the gift card doesn't cover a minigame or another popup
  const free = () => started && S && S.phase !== 'settle' && !S.cook && !S.reg && !S.mini && !S.uiPause && $('phoneOv').hidden && $('chooseOv').hidden;

  // put one gift's money into G (and the day-start snapshot, so the save code matches); returns the amount
  function give(gift, g) {
    const cash = Math.floor(Number(gift.cash) || 0);
    if (cash > 0 && Number.isSafeInteger(cash)) { g.cash += cash; return cash; }
    return 0;
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
      let total = 0; const notes = [];
      for (const x of mine) {
        total += give(x.gift || {}, G);
        if (S.startG) give(x.gift || {}, S.startG);
        const t = cleanName(x.note, '', 60); if (t) notes.push(t);
      }
      saveProgress();
      sfx('delivery');
      showPopup(`<h2>🎁 收到管理者的禮物！</h2><p style="font-size:22px;font-weight:700;text-align:center">${yen(total)}</p>` + notes.map(t => `<p>「${t}」</p>`).join(''));
    } catch {} finally { busy = false; }
  }
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 60000);
  // first look shortly after the shop opens
  const wait = setInterval(() => { if (started && on()) { clearInterval(wait); setTimeout(check, 3000); } }, 2000);
})();
