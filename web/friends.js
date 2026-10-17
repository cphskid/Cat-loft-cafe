// 暖陽貓閣「👫 好友」：用 6 碼好友碼加其他玩家當朋友、去朋友店裡的招待室聊天、跟朋友合作。
// 資料都在 Supabase（supabase/catloft_friends.sql），只能透過那邊的函式讀寫，用好友碼認人。
//   加好友：送出邀請，對方按「同意」才算朋友。
//   招待室：先敲門，主人按「讓他進來」才進得去（同意後 1 小時內有效）。
//   聊天：只能選固定的句子和貼圖（小朋友也在玩）；要改句子只能往後加，編號不能動（存的是編號）。
//   合作：兩個人都選對方才算；兩家店客人都變多（COOP_GUESTS），營業額各算各的，排行榜上看得到。
// 用到 index.html 的全域：G、S、CLOUD、started、toast、sfx、renderPhone、phoneApp、closePhone、shopLv、mgrSpr、
// onDuty、catNameOf、CAT_DEFS、coatPic、cleanName、ensurePlayer、$。
(function () {
  const PHRASES = ['你好！', '歡迎光臨～', '你的店好可愛！', '貓咪好可愛！', '今天生意好嗎？', '生意超好的！', '今天有點忙…', '一起加油！',
    '要不要一起合作？', '謝謝你！', '請喝茶 ☕', '這隻貓叫什麼名字？', '我要回去開店了', '下次再來玩！', '晚安～', '好喔！'];
  const STICKERS = ['😺', '😻', '😹', '🙀', '😿', '🐾', '❤️', '🎉', '👍', '☕', '🍰', '🌙'];
  const COOP_GUESTS = 1.2; // 合作中，客人多 20%
  const F = { code: '', list: null, err: false, at: 0, busy: false, partner: '', known: null, sure: '', room: null, adding: false };

  const css = document.createElement('style');
  css.textContent = `
  .fr-code{font:700 26px/1 var(--display,inherit);letter-spacing:4px;color:var(--wood-d,#6B4A35)}
  .fr-btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}.fr-btns button{padding:6px 10px}
  .fr-dot{display:inline-block;min-width:18px;padding:0 5px;border-radius:9px;background:#D9534F;color:#fff;font-size:12px;text-align:center;margin-left:4px}
  #roomOv .card{max-width:760px;padding:14px}
  .rm-stage{position:relative;width:100%;aspect-ratio:16/9;background:#F6EBDD url(assets/room.webp) center/cover;border-radius:12px;overflow:hidden}
  .rm-who{position:absolute;bottom:6%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center}
  .rm-who img{height:52%;max-height:190px}.rm-who .nm{font:700 12px/1.2 inherit;color:#6B4A35;background:rgba(255,250,240,.85);border-radius:8px;padding:1px 6px;margin-top:2px;white-space:nowrap}
  .rm-mgr{height:64%;bottom:5%}.rm-mgr img{height:calc(100% - 18px);max-height:none}
  .rm-cat{height:24%}.rm-cat img{height:calc(100% - 18px);max-height:none}
  .rm-say{position:absolute;bottom:100%;margin-bottom:4px;background:#fff;border:1.5px solid #4A3A30;border-radius:12px;padding:3px 9px;font-size:14px;white-space:nowrap;animation:rmPop .25s}
  .rm-say.big{font-size:28px;padding:0 6px}
  @keyframes rmPop{from{transform:scale(.6);opacity:0}}
  .rm-title{position:absolute;left:10px;top:8px;background:rgba(255,250,240,.9);border-radius:10px;padding:3px 10px;font-weight:700;color:#6B4A35;font-size:14px}
  .rm-log{height:110px;overflow:auto;margin:8px 0;padding:6px 8px;background:#FFFBF4;border:1px solid var(--line,#E6D8C6);border-radius:10px;font-size:14px}
  .rm-log div{margin:2px 0}.rm-log .me{text-align:right}.rm-log .st{font-size:24px}
  .rm-ph{display:grid;grid-template-columns:repeat(auto-fill,minmax(118px,1fr));gap:5px}.rm-ph button{padding:6px 4px;font-size:13px}
  .rm-st{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px}.rm-st button{font-size:22px;padding:2px 8px;line-height:1.2}`;
  document.head.appendChild(css);

  const ov = document.createElement('div');
  ov.className = 'overlay'; ov.id = 'roomOv'; ov.hidden = true;
  ov.innerHTML = '<div class="card" id="roomCard"></div>';
  document.body.appendChild(ov);

  const on = () => !!(CLOUD.sb && !CLOUD.db);
  const nm = (t, d) => cleanName(t, d, 12);
  const rpc = async (fn, args) => { const { data, error } = await CLOUD.sb.rpc(fn, args); if (error) throw error; return data; };

  // my shop card: name, level, manager sprite, cats on duty (what friends see in my reception room)
  function look() {
    return { mgr: G.mgrName, sex: G.mgrSex === 'm' ? 'm' : 'f', spr: mgrSpr(), cats: onDuty().slice(0, 6).map(id => ({ id, nm: catNameOf(id) })) };
  }
  async function sync() {
    if (!on()) return;
    try { await ensurePlayer(); F.code = await rpc('catloft_me', { p_shop: G.shopName, p_lv: shopLv(), p_day: G.day, p_look: look() }) || F.code; } catch {}
  }
  async function load(quiet) {
    if (!on() || !CLOUD.uid || F.busy) return;
    F.busy = true;
    try {
      if (!F.code) await sync();
      const rows = await rpc('catloft_friend_list') || [];
      if (F.known && !quiet) news(rows);
      F.known = Object.fromEntries(rows.map(r => [r.code, r]));
      F.list = rows; F.err = false;
      const p = rows.find(r => r.coop === 'on'); F.partner = p ? nm(p.shop_name, '朋友的店') : '';
    } catch { F.err = true; }
    F.busy = false; F.at = Date.now();
    if (!$('phoneOv').hidden && phoneApp === 'friend') renderPhone();
  }
  // tell the player what changed since the last look, so a knock doesn't go unanswered
  function news(rows) {
    for (const r of rows) {
      const o = F.known[r.code] || {}, shop = `「${nm(r.shop_name, '朋友的店')}」`;
      if (r.rel === 'asks' && o.rel !== 'asks') toast(`👫 ${shop}想跟你當朋友，打開手機「好友」看看`);
      else if (r.rel === 'friend' && o.rel === 'sent') toast(`👫 ${shop}同意當你的朋友了！`);
      if (r.door_in === 'knock' && o.door_in !== 'knock') { toast(`🔔 ${shop}在敲你招待室的門，打開手機「好友」讓他進來`); sfx('door_bell'); }
      if (r.door_out === 'open' && o.door_out === 'knock') toast(`🚪 ${shop}讓你進去了！打開手機「好友」去招待室`);
      if (r.coop === 'asks' && o.coop !== 'asks') toast(`🤝 ${shop}想跟你合作`);
      if (r.coop === 'on' && o.coop !== 'on') toast(`🤝 跟${shop}開始合作了！兩家店的客人都會變多`);
      if (r.unread > (o.unread || 0) && !(F.room && F.room.code === r.code)) toast(`💬 ${shop}在招待室跟你說話`);
    }
  }
  setInterval(() => { if (started && on() && CLOUD.uid && document.visibilityState === 'visible') load(); }, 30000);

  const pending = () => (F.list || []).filter(r => r.rel === 'asks' || r.door_in === 'knock' || r.coop === 'asks' || r.unread > 0).length;
  function sub() { const n = pending(); return n ? `${n} 件事等你` : F.partner ? '合作中' : '加好友・招待室'; }

  function appHtml() {
    if (Date.now() - F.at > 15000) { F.at = Date.now(); (CLOUD.uid ? sync() : ensurePlayer().then(sync)).then(() => load(true)); }
    let h = `<div class="item"><div class="top"><span class="nm">我的好友碼</span><span class="fr-code">${F.code || '……'}</span></div>
      <div class="sub">把這 6 個字告訴朋友，朋友輸入後你按「同意」就是好朋友了。</div>
      <div class="fr-btns"><button id="frCopy">複製好友碼</button></div></div>
      <div class="item"><div class="top"><span class="nm">加好友</span></div>
      <div class="fr-btns" style="flex-wrap:nowrap"><input id="frIn" maxlength="6" placeholder="朋友的好友碼" autocomplete="off" style="flex:1;min-width:0;text-transform:uppercase;letter-spacing:2px"><button class="primary" id="frAdd"${F.adding ? ' disabled' : ''}>送出邀請</button></div></div>`;
    if (!F.list) return h + `<p class="muted">${F.err ? '連不上好友資料，等一下再試試' : '載入中…'}</p>`;
    const asks = F.list.filter(r => r.rel === 'asks'), sent = F.list.filter(r => r.rel === 'sent'), fr = F.list.filter(r => r.rel === 'friend');
    const card = r => `<div class="top"><span class="nm">${nm(r.shop_name, '朋友的店')}${r.unread ? `<span class="fr-dot">${r.unread}</span>` : ''}</span><small>Lv.${Number(r.lv) || 1}・第 ${Number(r.day) || 1} 天</small></div>`;
    if (asks.length) h += `<h4 style="margin:10px 0 4px">想跟你當朋友</h4>` + asks.map(r => `<div class="item">${card(r)}<div class="fr-btns"><button class="primary" data-fr="ok:${r.code}">同意</button><button data-fr="no:${r.code}">不要</button></div></div>`).join('');
    h += `<h4 style="margin:10px 0 4px">我的朋友（${fr.length}）</h4>`;
    if (!fr.length) h += `<p class="muted">還沒有朋友。跟同學交換好友碼吧！</p>`;
    h += fr.map(r => {
      const b = [];
      if (r.door_in === 'knock') b.push(`<button class="primary" data-fr="let:${r.code}">🔔 讓他進來</button><button data-fr="deny:${r.code}">下次吧</button>`);
      else if (r.door_in === 'open') b.push(`<button class="primary" data-fr="host:${r.code}">到招待室陪他</button>`);
      if (r.door_out === 'open') b.push(`<button class="primary" data-fr="go:${r.code}">🚪 進去他的招待室</button>`);
      else if (r.door_out === 'knock') b.push(`<button disabled>等他來開門…</button>`);
      else b.push(`<button data-fr="knock:${r.code}">敲門拜訪</button>`);
      if (r.coop === 'on') b.push(`<button data-fr="uncoop:${r.code}">結束合作</button>`);
      else if (r.coop === 'asks') b.push(`<button class="primary" data-fr="coop:${r.code}">🤝 答應合作</button>`);
      else if (r.coop === 'sent') b.push(`<button data-fr="uncoop:${r.code}">取消合作邀請</button>`);
      else b.push(`<button data-fr="coop:${r.code}">邀請合作</button>`);
      b.push(`<button data-fr="del:${r.code}">${F.sure === r.code ? '確定刪除？' : '刪除'}</button>`);
      const line = r.coop === 'on' ? '🤝 合作中：兩家店的客人都變多，營業額各算各的' : r.coop === 'sent' ? '已邀請合作，等他答應' : r.coop === 'asks' ? '他想跟你合作' : '';
      return `<div class="item"${r.coop === 'on' ? ' style="border-color:#D9A23A;background:#FFF6E0"' : ''}>${card(r)}${line ? `<div class="sub">${line}</div>` : ''}<div class="fr-btns">${b.join('')}</div></div>`;
    }).join('');
    if (sent.length) h += `<h4 style="margin:10px 0 4px">等對方同意</h4>` + sent.map(r => `<div class="item">${card(r)}<div class="fr-btns"><button data-fr="no:${r.code}">取消邀請</button></div></div>`).join('');
    h += `<p class="muted">去朋友的店要先敲門，朋友讓你進去才能到招待室聊天。一次只能跟一位朋友合作，合作要兩個人都答應。</p>`;
    return h;
  }

  async function act(kind, code) {
    const r = (F.list || []).find(x => x.code === code), shop = `「${nm(r && r.shop_name, '朋友的店')}」`;
    try {
      if (kind === 'ok') { await rpc('catloft_friend_add', { p_code: code }); toast(`跟${shop}變成朋友了！`); }
      else if (kind === 'no') await rpc('catloft_friend_remove', { p_code: code });
      else if (kind === 'del') { if (F.sure !== code) { F.sure = code; renderPhone(); return; } F.sure = ''; await rpc('catloft_friend_remove', { p_code: code }); toast(`已經把${shop}從好友刪掉了`); }
      else if (kind === 'knock') { const s = await rpc('catloft_knock', { p_code: code }); if (s === 'open') return openRoom(code, false); toast(`叩叩叩！等${shop}來開門`); }
      else if (kind === 'let') { await rpc('catloft_answer', { p_code: code, p_yes: true }); toast(`讓${shop}進來了，一起到招待室聊天吧`); await load(true); return openRoom(code, true); }
      else if (kind === 'deny') await rpc('catloft_answer', { p_code: code, p_yes: false });
      else if (kind === 'go') return openRoom(code, false);
      else if (kind === 'host') return openRoom(code, true);
      else if (kind === 'coop') { const other = F.list.find(x => x.coop === 'on' || x.coop === 'sent'); const s = await rpc('catloft_coop', { p_code: code });
        toast(s === 'on' ? `🤝 跟${shop}開始合作了！兩家店的客人都會變多` : `已經邀請${shop}合作，等他答應${other && other.code !== code ? '（之前的合作取消了）' : ''}`); }
      else if (kind === 'uncoop') { await rpc('catloft_coop', { p_code: null }); toast('合作結束了'); }
    } catch { toast('連不上好友資料，等一下再試試'); }
    await load(true);
  }
  async function add(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return toast('好友碼是 6 個字');
    F.adding = true; renderPhone();
    try {
      await ensurePlayer(); if (!F.code) await sync();
      const s = await rpc('catloft_friend_add', { p_code: code });
      toast({ self: '這是你自己的好友碼喔', none: '找不到這個好友碼，再檢查一下', full: '朋友太多了，先刪掉一些吧', sent: '邀請送出了！等對方按同意', friends: '你們變成朋友了！' }[s] || '送出了');
    } catch { toast('連不上好友資料，等一下再試試'); }
    F.adding = false; await load(true);
  }
  function bind(sc) {
    const q = s => sc.querySelector(s);
    q('#frCopy') && (q('#frCopy').onclick = () => { if (!F.code) return; navigator.clipboard?.writeText(F.code).then(() => toast('好友碼複製好了'), () => toast('好友碼：' + F.code)); });
    q('#frAdd') && (q('#frAdd').onclick = () => add(q('#frIn').value));
    q('#frIn') && (q('#frIn').onkeydown = e => { if (e.key === 'Enter') add(e.target.value); });
    sc.querySelectorAll('[data-fr]').forEach(b => b.onclick = () => { const [k, c] = b.dataset.fr.split(':'); sfx('ui_click'); b.disabled = true; act(k, c); });
  }

  // ---------- 招待室 ----------
  // host = whose shop we're in. Visiting: host is the friend, I'm the guest. Hosting: I'm the host.
  async function openRoom(code, hosting) {
    let card;
    try { card = (await rpc('catloft_card', { p_code: code }) || [])[0]; } catch {}
    if (!card) return toast('連不上好友資料，等一下再試試');
    await sync();
    const me = { shop_name: G.shopName, look: look() };
    closePhone(true); S.uiPause = true;
    F.room = { code, hosting, host: hosting ? me : card, guest: hosting ? card : me, log: [], last: '', timer: null };
    sfx('door_bell'); drawRoom(); readChat();
    F.room.timer = setInterval(readChat, 4000);
    ov.hidden = false;
  }
  function closeRoom() {
    if (!F.room) return;
    clearInterval(F.room.timer); F.room = null; ov.hidden = true; if (S) S.uiPause = false; load(true);
  }
  const say = m => m.kind === 1 ? STICKERS[m.n] || '' : PHRASES[m.n] || '';
  function who(look, x, cls, sayMsg) {
    const L = look || {}, spr = /^[a-z0-9]{1,8}$/.test(L.spr || '') ? L.spr : 'mgr';
    const bub = sayMsg ? `<span class="rm-say${sayMsg.kind === 1 ? ' big' : ''}">${say(sayMsg)}</span>` : '';
    return `<div class="rm-who ${cls}" style="left:${x}%">${bub}<img src="assets/${spr}_0.webp" alt="" onerror="this.src='assets/mgr_0.webp'"><span class="nm">${cleanName(L.mgr, '店長', 8)}</span></div>`;
  }
  function drawRoom() {
    const R = F.room; if (!R) return;
    const hostMine = R.hosting, lastOf = mine => [...R.log].reverse().find(m => m.mine === mine && Date.now() - new Date(m.at).getTime() < 15000);
    const hostSay = lastOf(hostMine), guestSay = lastOf(!hostMine);
    const cats = ((R.host.look || {}).cats || []).filter(c => CAT_DEFS[c.id]).slice(0, 6);
    const catX = [12, 24, 47, 78, 88, 66];
    let stage = `<div class="rm-stage"><span class="rm-title">${nm(R.host.shop_name, '朋友的店')}的招待室</span>`;
    stage += cats.map((c, i) => { const src = coatPic(CAT_DEFS[c.id]); return src ? `<div class="rm-who rm-cat" style="left:${catX[i]}%;bottom:${i % 2 ? 3 : 8}%"><img src="${src}" alt=""><span class="nm">${cleanName(c.nm, CAT_DEFS[c.id].name, 8)}</span></div>` : ''; }).join('');
    stage += who(R.host.look, 38, 'rm-mgr', hostSay) + who(R.guest.look, 58, 'rm-mgr', guestSay) + '</div>';
    const log = R.log.map(m => `<div class="${m.mine ? 'me' : ''}${m.kind === 1 ? ' st' : ''}">${m.mine ? '' : '<b>' + cleanName((m.mine === hostMine ? R.host : R.guest).look?.mgr, '朋友', 8) + '：</b>'}${say(m)}</div>`).join('') || '<div class="muted">還沒有人說話，打個招呼吧！</div>';
    $('roomCard').innerHTML = stage + `<div class="rm-log" id="rmLog">${log}</div>
      <div class="rm-ph">${PHRASES.map((p, i) => `<button data-say="0:${i}">${p}</button>`).join('')}</div>
      <div class="rm-st">${STICKERS.map((s, i) => `<button data-say="1:${i}">${s}</button>`).join('')}</div>
      <div class="row" style="margin:10px 0 0"><button class="primary" id="rmBye">${R.hosting ? '回店裡' : '回自己的店'}</button></div>`;
    const lg = $('rmLog'); lg.scrollTop = lg.scrollHeight;
    $('rmBye').onclick = closeRoom;
    $('roomCard').querySelectorAll('[data-say]').forEach(b => b.onclick = async () => {
      const [kind, n] = b.dataset.say.split(':').map(Number); sfx('ui_click');
      try {
        const ok = await rpc('catloft_say', { p_code: R.code, p_kind: kind, p_n: n });
        if (!ok) toast('門關起來了，或是說太快了，等一下再說');
      } catch { toast('連不上好友資料，等一下再試試'); }
      readChat();
    });
  }
  async function readChat() {
    const R = F.room; if (!R) return;
    try {
      const rows = await rpc('catloft_chat_read', { p_code: R.code }) || [];
      if (F.room !== R) return;
      const sig = rows.map(m => m.at).join();
      if (sig !== R.last || Date.now() - R.drawn > 5000) { R.last = sig; R.log = rows; R.drawn = Date.now(); drawRoom(); }
    } catch {}
  }

  window.FRIENDS = {
    get partner() { return F.partner; },
    boost: () => F.partner ? COOP_GUESTS : 1,
    sub, appHtml, bind, sync, load,
  };
})();
