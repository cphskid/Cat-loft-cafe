// 暖陽貓閣：遊戲裡的「喵型測驗」app、本命貓、邀請好友（暖陽好友套裝）。
//   測驗題目、喵型、圖卡在 quiz.js（/q/ 測驗頁也用同一份）。
//   本命貓：測完（在 /q/ 或手機 app）就能領一隻，兩種個性、親密度長得快；一個存檔只能領一次（G.hm）。
//     /q/ 頁面的「進遊戲領本命貓」帶著 ?quiz=<喵型>&r=<好友碼> 進來，這裡收進 localStorage 再從網址拿掉。
//   邀請好友：分享出去的連結帶著自己的好友碼（= 邀請碼）。新玩家從連結開店就記成被邀請（supabase/catloft_invites.sql），
//     兩人自動變好友、新玩家先拿到太陽貓掌髮夾；新玩家玩完第一天才算成功。
//     邀請人依成功人數拿套裝：第 1 位 髮夾、第 2 位 貓項圈、第 3 位 整套衣服，之後每位 ¥3,000（G.inv = 已經發到第幾位）。
// 用到 index.html 的全域：G、S、CLOUD、started、CATQ、CAT_DEFS、CHARMS、OUTFITS、HONMEI、welcomeCat、showPopup、closeChoose、
// openPhone、renderPhone、phoneApp、toast、sfx、saveProgress、ensurePlayer、yen、$，以及 friends.js 的 FRIENDS。
(function () {
  const SET = [{ kind: 'charm', id: 'sunclip' }, { kind: 'charm', id: 'suncat' }, { kind: 'outfit', id: 'mo11' }];
  const AFTER_SET = 3000; // each friend after the third
  const I = { done: null, waiting: 0, busy: false, stating: false, asked: false };
  const ls = { get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } }, set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} } };
  const on = () => !!(CLOUD.sb && !CLOUD.db);
  const rpc = async (fn, args) => { const { data, error } = await CLOUD.sb.rpc(fn, args); if (error) throw error; return data; };
  const code = () => (window.FRIENDS && FRIENDS.code) || '';

  // ?quiz=lazy&r=K7M2QX from the quiz page
  (function takeUrl() {
    const qs = new URLSearchParams(location.search), t = qs.get('quiz'), r = (qs.get('r') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!t && !r) return;
    if (CATQ.typeOf(t)) ls.set('catloft-quiz', t);
    if (r.length === 6) ls.set('catloft-ref', r);
    qs.delete('quiz'); qs.delete('r');
    history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash);
  })();

  const pendingType = () => CATQ.typeOf(ls.get('catloft-quiz'));
  const busyUi = () => !$('chooseOv').hidden || !$('phoneOv').hidden || !S || S.phase === 'settle' || S.cook || S.reg || S.mini || S.out;

  // ---------- 本命貓 ----------
  function honmeiHtml(t) {
    const P = CATQ.PERS;
    return `<h2>🎉 你的本命貓來了！</h2><p class="muted" style="margin:0 0 6px">喵型測驗結果：${t.name}</p>
      <div style="text-align:center"><img src="assets/cat_${t.base}_1.webp" alt="" style="height:120px"><div style="font:700 22px var(--display);color:var(--wood-d)">${t.cat}</div>
      <span style="display:inline-block;background:#F5C16C;color:#5D4037;font-weight:700;font-size:13px;padding:2px 10px;border-radius:10px;margin:4px 0 8px">⭐ 本命貓・${P[t.p]} ＋ ${P[t.q]}</span></div>
      <div class="item" style="text-align:left;line-height:1.8">牠同時有「${P[t.p]}」和「${P[t.q]}」兩種個性（一般的貓只有一種）。<br>親密度長得比別的貓快一點，每個存檔只能領一隻喔。</div>`;
  }
  function offerHonmei(t) {
    if (G.hm || G.cats.some(c => c.id === HONMEI(t.id))) return false;
    const card = $('chooseCard');
    card.innerHTML = honmeiHtml(t) + '<div class="row"><button id="hmLater">之後再領</button><button class="primary" id="hmTake">收下牠</button></div>';
    $('chooseOv').hidden = false; S.uiPause = true; sfx('adopt');
    $('hmLater').onclick = () => { closeChoose(); toast('隨時可以打開手機「喵型測驗」領本命貓'); };
    $('hmTake').onclick = () => { closeChoose(); takeHonmei(t); };
    return true;
  }
  function takeHonmei(t) {
    if (G.hm || G.cats.some(c => c.id === HONMEI(t.id))) return;
    G.hm = t.id; G.mtype = t.id; ls.set('catloft-quiz', '');
    welcomeCat(HONMEI(t.id), `${t.cat}是你的本命貓！`);
    if (!$('phoneOv').hidden && phoneApp === 'quiz') renderPhone();
  }

  // ---------- invites: the new player's side ----------
  async function joinRef() {
    if (!G.ref || G.ref.s !== 0 || !on() || I.busy) return;
    I.busy = true;
    try {
      await ensurePlayer(); if (window.FRIENDS) await FRIENDS.sync();
      const r = await rpc('catloft_invite_join', { p_code: G.ref.c });
      G.ref.s = r === 'ok' ? 1 : 3;
      if (r === 'ok') { toast('👫 你跟邀請你的朋友變成好友了！打開手機「好友」看看'); if (window.FRIENDS) FRIENDS.load(true); }
      saveProgress();
    } catch {}
    I.busy = false;
  }
  async function doneRef() {
    if (!G.ref || G.ref.s !== 1 || G.day < 2 || !on() || !CLOUD.uid) return;
    try { if (await rpc('catloft_invite_done')) { G.ref.s = 2; saveProgress(); } } catch {}
  }
  function takeRef() {
    const r = ls.get('catloft-ref'); if (!r) return;
    ls.set('catloft-ref', '');
    if (G.ref || G.day > 2 || r === code()) return; // only a brand-new shop counts as invited
    G.ref = { c: r, s: 0 };
    if (!G.acc.own.includes('sunclip')) { G.acc.own.push('sunclip'); if (!G.acc.mgr.hair) G.acc.mgr.hair = 'sunclip'; }
    toast('🌞 朋友邀請你來的！送你限定的「太陽貓掌髮夾」，已經戴上了');
    saveProgress(); joinRef();
  }

  // ---------- invites: the inviter's side ----------
  function give(n) {
    const it = SET[n - 1];
    if (it && it.kind === 'charm' && !G.acc.own.includes(it.id)) { G.acc.own.push(it.id); return `「${CHARMS[it.id].name}」`; }
    if (it && it.kind === 'outfit' && !G.wardrobe.includes(it.id)) { G.wardrobe.push(it.id); return `「${OUTFITS.find(o => o.id === it.id).name}」`; }
    G.cash += AFTER_SET; return yen(AFTER_SET);
  }
  async function stats() {
    if (!on() || !CLOUD.uid || !started || I.stating) return;
    I.stating = true;
    try {
      if (!code() && window.FRIENDS) await FRIENDS.sync(); // the friend code is the invite code in shared links
      const row = (await rpc('catloft_invite_stats') || [])[0] || {};
      I.done = Number(row.done) || 0; I.waiting = Number(row.waiting) || 0;
      const got = [];
      while (G.inv < I.done) got.push(give(++G.inv));
      if (got.length) {
        sfx('levelup'); saveProgress();
        const msg = `🎁 有 ${got.length} 位朋友從你的連結來玩、完成第一天了！拿到 ${got.join('、')}`;
        if (busyUi()) toast(msg); else showPopup(`<h2>🌞 邀請成功！</h2><p>${msg.slice(3)}</p><p class="muted">到手機「衣櫃」就能換上。暖陽好友套裝一共 3 件，只有邀請朋友才拿得到。</p>`);
      }
      if (!$('phoneOv').hidden && (phoneApp === 'quiz' || phoneApp === 'friend')) renderPhone();
    } catch {}
    I.stating = false;
  }

  // ---------- phone app 「喵型測驗」 ----------
  let view = 'home', want = 'start'; // view: home | quiz; want: start the quiz or show my card
  function setRow(n, label, have) {
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-top:1px dashed var(--line)">
      <span style="flex:none;width:26px;height:26px;border-radius:13px;background:${have ? '#F5C16C' : '#EADFCF'};text-align:center;line-height:26px;font-weight:700;color:#5D4037">${n}</span>
      <span style="flex:1">${label}</span><b style="color:${have ? 'var(--good)' : 'var(--muted)'}">${have ? '✓ 已拿到' : `邀請 ${n} 位`}</b></div>`;
  }
  function appHtml() {
    if (view === 'quiz') return '<div id="cqBox"></div>';
    const t = CATQ.typeOf(G.mtype), hmT = CATQ.typeOf(G.hm), pend = !G.hm && (pendingType() || t);
    let h = `<div class="item"><div class="top"><span class="nm">我的喵型</span><b>${t ? t.name : '還沒測'}</b></div>
      <div class="sub">${t ? `「${t.say}」${CATQ.persName(t)}` : '8 題、1 分鐘，測測你是哪一種喵。測完可以領一隻跟你同個性的本命貓。'}</div>
      <div class="row" style="margin:6px 0 0"><button class="primary" data-mq="start">${t ? '再測一次' : '開始測驗'}</button>${t ? '<button data-mq="card">看我的圖卡・分享</button>' : ''}</div></div>`;
    const hc = hmT && G.cats.find(c => c.id === HONMEI(hmT.id));
    if (hmT) h += `<div class="item"><div class="top"><span class="nm">⭐ 本命貓</span><b>${hc ? hc.nm || hmT.cat : '已經送養'}</b></div><div class="sub">${hmT.name}的本命貓，${CATQ.persName(hmT)}。</div></div>`;
    else if (pend) h += `<div class="item" style="border-color:#F5C16C;background:#FFF8E6"><div class="top"><span class="nm">⭐ 本命貓等你領</span><b>${pend.cat}</b></div><div class="sub">${pend.name}的本命貓，${CATQ.persName(pend)}。</div><div class="row" style="margin:6px 0 0"><button class="primary" data-mq="take">收下牠</button></div></div>`;
    if (on()) {
      h += `<p class="kh">🌞 邀請朋友・暖陽好友套裝</p><div class="item"><div class="sub" style="margin-bottom:4px">分享你的喵型圖卡，連結裡帶著你的好友碼${code() ? `（${code()}）` : ''}。朋友從你的連結開新店、玩完第一天，就算邀請成功。套裝只有邀請朋友才拿得到！</div>
        ${setRow(1, '太陽貓掌髮夾（店長）', G.acc.own.includes('sunclip'))}${setRow(2, '太陽鈴鐺項圈（貓咪）', G.acc.own.includes('suncat'))}${setRow(3, '暖陽好友咖啡師套裝（店長）', G.wardrobe.includes('mo11'))}
        <div class="sub" style="margin-top:6px">${I.done == null ? '讀取中…' : `已經邀請成功 ${I.done} 位${I.waiting ? `，還有 ${I.waiting} 位玩到第一天就算數` : ''}。`}之後每多邀請 1 位送 ${yen(AFTER_SET)}。</div>
        <div class="row" style="margin:6px 0 0"><button class="primary" data-mq="${t ? 'card' : 'start'}">${t ? '分享我的圖卡' : '先測喵型再分享'}</button></div></div>`;
      if (G.ref && G.ref.s < 3) h += `<p class="muted">你是朋友邀請來的，${G.ref.s >= 2 ? '已經幫朋友完成邀請了，謝謝你！' : '玩完第一天，邀請你的朋友就能拿到獎勵。'}</p>`;
    }
    return h;
  }
  function bind(sc) {
    if (view === 'quiz') {
      const t = CATQ.typeOf(G.mtype);
      const ui = CATQ.mount(sc.querySelector('#cqBox'), {
        toast, code,
        onDone: t => { G.mtype = t.id; saveProgress(); },
        extra: t => G.hm ? [{ label: '回喵型測驗', onClick: () => { view = 'home'; renderPhone(); } }]
          : [{ label: `收下本命貓「${t.cat}」🐾`, cls: 'go', onClick: () => { view = 'home'; closePhone(true); takeHonmei(t); } }],
      });
      if (want === 'card' && t) ui.result(t); else ui.ask();
      return;
    }
    sc.querySelectorAll('[data-mq]').forEach(b => b.onclick = () => {
      const k = b.dataset.mq;
      if (k === 'take') { const t = pendingType() || CATQ.typeOf(G.mtype); if (t) { closePhone(true); takeHonmei(t); } return; }
      view = 'quiz'; want = k; renderPhone();
    });
  }

  // after a shop opens: hand over a waiting 本命貓, note who invited us, and on a brand-new game offer the quiz
  function onOpen() {
    view = 'home';
    takeRef();
    setTimeout(() => {
      if (!started || busyUi()) return;
      const t = pendingType();
      if (t && !G.hm) { if (!G.mtype) G.mtype = t.id; offerHonmei(t); return; }
      if (G.day === 1 && !G.mtype && !G.hm && !I.asked) {
        I.asked = true;
        const card = $('chooseCard');
        card.innerHTML = `<h2>🐾 要不要先測你的喵型？</h2><p>8 題、1 分鐘。測完會送你一隻跟你同個性的「本命貓」，還有一張可以分享給朋友的圖卡。</p>
          <div class="row"><button id="mqLater">之後再說</button><button class="primary" id="mqGo">來測測看</button></div>`;
        $('chooseOv').hidden = false; S.uiPause = true;
        $('mqLater').onclick = () => { closeChoose(); toast('隨時可以打開手機的「喵型測驗」'); };
        $('mqGo').onclick = () => { closeChoose(); view = 'quiz'; want = 'start'; openPhone('quiz'); };
      }
    }, 1200);
    setTimeout(stats, 3000);
  }
  setInterval(() => { if (!started || document.visibilityState !== 'visible') return; joinRef(); doneRef(); stats(); }, 60000);

  window.MEOW = {
    sub: () => !G.hm && (pendingType() || CATQ.typeOf(G.mtype)) ? '本命貓等你領' : CATQ.typeOf(G.mtype) ? CATQ.typeOf(G.mtype).name : '測測你是哪種喵',
    appHtml, bind, onOpen, reset: () => { view = 'home'; },
    tick: () => Promise.all([joinRef(), doneRef(), stats()]),
  };
})();
