// 暖陽貓閣「🎁 管理者的禮物」：管理者在 admin/ 頁面送給玩家的錢（不限金額）、店長衣服和訊息。
// 錢和衣服由玩家決定「收下」或「不要」（不要的記成 declined，管理者頁面看得到）。
// 管理者自己的帳號另外可以「調整」任何數值（gift = {set:{...}}，Chuck：「最高管理者要調自己的什麼都可以」）。
// 禮物存在 Supabase 的 catloft_gifts（supabase/catloft_admin.sql）。開店時和每分鐘看一次有沒有新禮物，
// 先跟資料庫收下（catloft_claim_gifts 只回這次真的收到的），再放進存檔，所以兩台裝置同時開也不會收兩次。
// 用到 index.html 的全域：G、S、CLOUD、started、closeChoose、saveProgress、toast、sfx、say、art、mgrSfx、outfitName、yen、cleanName、LV_EXP、MAX_LV、SHOP、OUTFITS、CHARMS、FURN、TOOLS、EXPANSIONS、maxTables、$。
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

  // money, clothes and messages wait for the player: Chuck 2026-10-24「讓玩家有自己權利可以決定要不要接受送錢和衣服」
  const card = (html, btns) => new Promise(done => {
    const c = $('chooseCard');
    c.innerHTML = html + `<div class="row">${btns.map((b, i) => `<button data-g="${i}"${b.main ? ' class="primary"' : ''}>${b.label}</button>`).join('')}</div>`;
    $('chooseOv').hidden = false; S.uiPause = true;
    c.querySelectorAll('[data-g]').forEach(el => el.onclick = () => { closeChoose(); done(btns[+el.dataset.g].v); });
  });
  const rpc = async (fn, ids) => { const { data, error } = await CLOUD.sb.rpc(fn, { p_ids: ids }); return error ? [] : data || []; };
  const noteHtml = x => { const t = cleanName(x.note, '', 200); return t ? `<p>管理者說：「${t}」</p>` : ''; };

  async function offer(x) {
    const g = x.gift || {};
    if (g.msg) {
      await card(`<h2>💌 管理者傳訊息給你</h2><p style="font-size:17px;white-space:pre-wrap">${cleanName(x.note, '', 200)}</p>`, [{ label: '知道了', v: 1, main: true }]);
      await rpc('catloft_claim_gifts', [x.id]); return;
    }
    if (g.outfit) {
      const o = OUTFITS.find(o => o.id === g.outfit);
      if (!o) { await rpc('catloft_decline_gifts', [x.id]); return; }
      const own = G.wardrobe.includes(o.id);
      const pick = await card(`<h2>🎁 管理者要送你一件衣服</h2><div style="display:flex;gap:12px;align-items:center"><img src="assets/${o.spr + mgrSfx()}_0.webp" alt="" style="height:110px;width:46px;object-fit:contain" onerror="this.remove()">
        <div><p style="font-size:18px;font-weight:700;margin:0">${outfitName(o)}</p><p class="muted" style="margin:4px 0 0">${(G.mgrSex === 'm' && o.descM) || o.desc}</p></div></div>${noteHtml(x)}${own ? '<p class="muted">你已經有這件衣服了。</p>' : ''}`,
        own ? [{ label: '知道了', v: 'no', main: true }] : [{ label: '不要', v: 'no' }, { label: '收下', v: 'keep' }, { label: '收下並穿上', v: 'wear', main: true }]);
      if (pick === 'no') { await rpc('catloft_decline_gifts', [x.id]); return; }
      if (!(await rpc('catloft_claim_gifts', [x.id])).includes(x.id)) return;
      for (const t of [G, S.startG]) if (t && !t.wardrobe.includes(o.id)) t.wardrobe.push(o.id);
      if (pick === 'wear') { G.outfit = o.id; for (let i = 0; i < 3; i++) art(`${o.spr}${mgrSfx()}_${i}`); say(S.mgr, '好看嗎？'); }
      else toast(`「${outfitName(o)}」放進衣櫃了，手機「衣櫃」可以換上`);
      saveProgress(); sfx('delivery'); return;
    }
    const cash = Math.floor(Number(g.cash) || 0);
    if (!(cash > 0 && Number.isSafeInteger(cash))) { await rpc('catloft_decline_gifts', [x.id]); return; }
    const pick = await card(`<h2>🎁 管理者要送你錢</h2><p style="font-size:24px;font-weight:700;text-align:center;margin:8px 0">${yen(cash)}</p>${noteHtml(x)}`,
      [{ label: '不要', v: 'no' }, { label: '收下', v: 'keep', main: true }]);
    if (pick === 'no') { await rpc('catloft_decline_gifts', [x.id]); toast('沒有收下這筆錢'); return; }
    if (!(await rpc('catloft_claim_gifts', [x.id])).includes(x.id)) return;
    give(g, G); if (S.startG) give(g, S.startG);
    saveProgress(); sfx('delivery'); toast(`收下 ${yen(cash)}！`);
  }

  async function check() {
    if (busy || !on() || !free()) return;
    busy = true;
    try {
      const { data: list, error } = await CLOUD.sb.rpc('catloft_my_gifts');
      if (error || !list || !list.length || !free()) return;
      // the admin's own adjustments go straight in
      const sets = list.filter(x => x.gift && x.gift.set && typeof x.gift.set === 'object');
      if (sets.length) {
        const ids = await rpc('catloft_claim_gifts', sets.map(x => x.id)), changed = [];
        for (const x of sets.filter(x => ids.includes(x.id))) { changed.push(...edit(x.gift.set, G)); if (S.startG) edit(x.gift.set, S.startG); }
        if (changed.length) { saveProgress(); sfx('delivery'); await card(`<h2>🛠️ 管理者調整好了</h2><ul class="unl">${changed.map(l => `<li>${l}</li>`).join('')}</ul><p class="muted">傢俱、桌子和擴建明天開店時會擺好。</p>`, [{ label: '好！', v: 1, main: true }]); }
      }
      for (const x of list) if (!sets.includes(x) && free()) await offer(x);
    } catch {} finally { busy = false; }
  }
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, 60000);
  // first look shortly after the shop opens
  const wait = setInterval(() => { if (started && on()) { clearInterval(wait); setTimeout(check, 3000); } }, 2000);
})();
