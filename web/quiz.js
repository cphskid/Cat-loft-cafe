// 暖陽貓閣「喵型測驗」：8 題情境題 → 12 種喵型之一（遊戲裡 8 種貓咪個性取兩種：主個性 + 副個性）。
// 同一份檔案給兩個地方用：
//   /q/ 測驗頁（不用登入，q/index.html、q/<喵型>/index.html）
//   遊戲手機裡的「喵型測驗」app（index.html 的 renderPhone）
// 結果圖卡在瀏覽器裡用 canvas 畫：插畫 q/art/<喵型>.webp 鋪滿整張，上下淡出的地方放字。
// 分享連結 = https://catloftcafe.ciyulab.com/q/<喵型>/?r=好友碼（好友碼就是邀請碼，見 invite.js）。
(function () {
  const ROOT = new URL('./', document.currentScript.src).href; // the web/ folder, wherever this page sits
  const SITE = 'https://catloftcafe.ciyulab.com/';
  // same order as PERSONAS in index.html
  const PERS = ['黏人', '貪吃', '愛睡', '活潑', '害羞', '好奇', '優雅', '調皮'];
  // p = main personality (the 本命貓's own), q = second one; base = which painted cat it is; cat = the 本命貓's name
  const TYPES = [
    { id: 'lazy',      name: '好吃懶做喵', p: 1, q: 2, base: 'orange', cat: '地瓜', say: '吃飽睡、睡飽吃，人生就是要舒服', kw: ['貪吃', '慵懶', '知足'], desc: '你知道怎麼讓自己開心。吃一口好吃的蛋糕，再找個暖暖的位置睡午覺，就是最棒的一天。', pal: 'party' },
    { id: 'gourmet',   name: '美食評論喵', p: 1, q: 6, base: 'orange', cat: '布丁', say: '這塊蛋糕，我給四顆半星', kw: ['挑嘴', '有品味', '懂享受'], desc: '你對好吃的東西很有研究，也很樂意跟大家分享哪裡最好吃。', pal: 'dreamy' },
    { id: 'clingy',    name: '撒嬌黏黏喵', p: 0, q: 1, base: 'milk', cat: '奶糖', say: '摸摸我，順便給我零食', kw: ['撒嬌', '溫暖', '坦率'], desc: '你喜歡和重要的人待在一起，也很會表達自己的心情。', pal: 'noble' },
    { id: 'guardian',  name: '暖心守護喵', p: 0, q: 6, base: 'milk', cat: '暖暖', say: '有我在，別怕', kw: ['體貼', '可靠', '溫柔'], desc: '你很會照顧別人，是朋友心中最可靠的避風港。', pal: 'prankster' },
    { id: 'party',     name: '派對社交喵', p: 3, q: 0, base: 'calico', cat: '彩彩', say: '哪裡熱鬧哪裡就有我', kw: ['開朗', '熱情', '朋友多'], desc: '你是大家的開心果，有你在的地方總是充滿笑聲。', pal: 'watcher' },
    { id: 'watcher',   name: '默默觀察喵', p: 4, q: 5, base: 'gray', cat: '灰灰', say: '我都看在眼裡喔', kw: ['安靜', '細心', '觀察力強'], desc: '你不太愛出風頭，卻總是第一個發現別人需要幫忙。', pal: 'lazy' },
    { id: 'homebody',  name: '社恐宅宅喵', p: 4, q: 2, base: 'gray', cat: '被被', say: '今天也不想出門', kw: ['內向', '自在', '享受獨處'], desc: '一個人的時間對你來說很珍貴，你在自己的小天地裡最快樂。', pal: 'explorer' },
    { id: 'explorer',  name: '好奇探險喵', p: 5, q: 3, base: 'tabby', cat: '小探', say: '那邊是什麼？我去看看！', kw: ['好奇', '勇敢', '行動派'], desc: '世界對你來說就是一個大遊樂場，每天都有新發現。', pal: 'homebody' },
    { id: 'noble',     name: '優雅貴族喵', p: 6, q: 4, base: 'tux', cat: '伯爵', say: '請保持距離，謝謝', kw: ['優雅', '講究', '有品味'], desc: '你有自己的步調和堅持，喜歡美好又精緻的東西。', pal: 'clingy' },
    { id: 'prankster', name: '調皮搗蛋喵', p: 7, q: 3, base: 'tabby', cat: '皮皮', say: '不是我弄的（尾巴在搖）', kw: ['調皮', '幽默', '點子多'], desc: '你總有用不完的鬼點子，生活在你身邊從不無聊。', pal: 'guardian' },
    { id: 'quirky',    name: '古靈精怪喵', p: 7, q: 5, base: 'calico', cat: '咕嚕', say: '猜不到我下一步吧', kw: ['機靈', '創意', '不按牌理'], desc: '你的想法總是跟別人不一樣，常常帶來意想不到的驚喜。', pal: 'party' },
    { id: 'dreamy',    name: '夢遊雲朵喵', p: 2, q: 0, base: 'fluffy', cat: '雲朵', say: '抱著我，我就睡著了', kw: ['溫柔', '放鬆', '好相處'], desc: '你總是慢慢來，待在你身邊會讓人覺得很安心。', pal: 'gourmet' },
  ];
  // every personality is behind exactly 4 of the 32 answers
  const QS = [
    { q: '放假第一天早上，你會？', img: 'orange_2', a: [['睡到自然醒', 2], ['先吃一頓豐盛的早午餐', 1], ['約朋友出門玩', 3], ['去沒去過的地方逛逛', 5]] },
    { q: '走進一間新開的咖啡廳，你會先？', img: 'milk_1', a: [['看看菜單有什麼好吃的', 1], ['找個角落安靜坐下', 4], ['跟店員打招呼、聊兩句', 0], ['欣賞裝潢和擺設', 6]] },
    { q: '朋友偷偷整了你一下，你的反應是？', img: 'tabby_3', a: [['笑最大聲，然後計畫反擊', 7], ['跟著一起鬧，越玩越開心', 3], ['有點不好意思，臉紅紅', 4], ['淡定地喝一口茶', 6]] },
    { q: '心情不好的時候，你會？', img: 'gray_2', a: [['吃一個甜點', 1], ['先睡一覺再說', 2], ['找人抱抱、說說話', 0], ['出去走一走', 5]] },
    { q: '你最喜歡待在哪裡？', img: 'fluffy_2', a: [['窗邊曬太陽', 2], ['大家的中間', 0], ['高高的地方，可以看到全部', 6], ['小角落或箱子裡', 4]] },
    { q: '看到一隻貓在搖尾巴，你會？', img: 'calico_1', a: [['拿逗貓棒衝過去', 7], ['蹲下來等牠自己靠過來', 0], ['先觀察牠想做什麼', 5], ['找零食給牠', 1]] },
    { q: '收到一個沒寫名字的神秘包裹，你會？', img: 'tux_1', a: [['馬上拆開來看', 5], ['搖一搖，假裝是怪東西嚇朋友', 7], ['先放著，睡個午覺再說', 2], ['拿去跟大家一起拆', 3]] },
    { q: '朋友辦了一場派對，你通常是？', img: 'calico_3', a: [['帶動氣氛的那個人', 3], ['偷偷在蛋糕上插奇怪的蠟燭', 7], ['穿得最好看的那個人', 6], ['在角落跟熟的朋友聊天', 4]] },
  ];
  const typeOf = id => TYPES.find(t => t.id === id) || null;
  const persName = t => `${PERS[t.p]}＋${PERS[t.q]}`;
  // answers = the chosen personality index per question; ties go to the personality picked first
  function score(answers) {
    const s = PERS.map(() => 0), first = PERS.map(() => 99);
    answers.forEach((p, i) => { s[p]++; if (first[p] === 99) first[p] = i; });
    let best = TYPES[0], bv = -1;
    for (const t of TYPES) { const v = s[t.p] * 2 + s[t.q] - (first[t.p] + first[t.q]) * .001; if (v > bv) { bv = v; best = t; } }
    return best;
  }
  const link = (t, code) => `${SITE}q/${t.id}/${code ? '?r=' + encodeURIComponent(code) : ''}`;
  const art = t => `${ROOT}q/art/${t.id}.webp`;

  // ---- the share card (1080 x 1350) ----
  const FONT_D = '"LXGW WenKai TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",serif';
  const FONT_B = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
  const loadImg = src => new Promise((ok, no) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => ok(im); im.onerror = no; im.src = src; });
  // web fonts arrive in unicode-range slices, so ask for the exact characters the card uses
  async function fontsReady(text) {
    try { await Promise.all([`400 32px ${FONT_D}`, `700 100px ${FONT_D}`, `400 29px ${FONT_B}`, `700 30px ${FONT_B}`].map(f => document.fonts.load(f, text))); } catch {}
  }
  // wrap Chinese text by character, latin words kept together
  function wrap(x, text, maxW) {
    const out = []; let line = '';
    for (const tok of text.match(/[A-Za-z0-9.:/?=_-]+|./g) || []) { if (x.measureText(line + tok).width > maxW && line) { out.push(line); line = tok.trimStart(); } else line += tok; }
    if (line) out.push(line); return out;
  }
  function pill(x, text, cx, cy, bg, fg, size) {
    x.font = `700 ${size}px ${FONT_B}`; const w = x.measureText(text).width + size * 1.3, h = size * 1.75;
    x.fillStyle = bg; x.beginPath(); x.roundRect(cx - w / 2, cy - h / 2, w, h, h / 2); x.fill();
    x.fillStyle = fg; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, cx, cy + 1); return w;
  }
  function pills(x, list, cy) {
    const gap = 14; x.font = `700 28px ${FONT_B}`;
    const ws = list.map(([t, , , sz]) => { x.font = `700 ${sz}px ${FONT_B}`; return x.measureText(t).width + sz * 1.3; });
    let cx = 540 - (ws.reduce((a, b) => a + b, 0) + gap * (ws.length - 1)) / 2;
    list.forEach(([t, bg, fg, sz], i) => { pill(x, t, cx + ws[i] / 2, cy, bg, fg, sz); cx += ws[i] + gap; });
  }
  // inviter = the sharing shop's name (only shown on someone else's link)
  async function card(t, code, inviter) {
    const pal = typeOf(t.pal);
    await fontsReady([t.name, t.say, t.desc, t.kw.join(''), PERS.join(''), inviter || '', pal ? pal.name : '', '暖陽貓閣・喵型測驗　我的喵型是「」的最合拍用這個連結來玩，我們一起拿限定服裝測測你是哪一種#'].join(''));
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const x = c.getContext('2d');
    x.fillStyle = '#FBF4E8'; x.fillRect(0, 0, 1080, 1350);
    try { x.drawImage(await loadImg(art(t)), 0, 0, 1080, 1350); } catch {}
    // keep the top and bottom readable over the painting
    let gr = x.createLinearGradient(0, 0, 0, 360); gr.addColorStop(0, 'rgba(251,244,232,.9)'); gr.addColorStop(1, 'rgba(251,244,232,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 1080, 360);
    gr = x.createLinearGradient(0, 960, 0, 1350); gr.addColorStop(0, 'rgba(251,244,232,0)'); gr.addColorStop(.3, 'rgba(251,244,232,.93)'); gr.addColorStop(1, '#FBF4E8');
    x.fillStyle = gr; x.fillRect(0, 960, 1080, 390);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#8B776B'; x.font = `400 32px ${FONT_D}`;
    x.fillText(inviter ? `「${inviter.slice(0, 10)}」的喵型是` : '暖陽貓閣・喵型測驗　我的喵型是', 540, 92);
    x.font = `700 112px ${FONT_D}`; x.lineJoin = 'round'; x.strokeStyle = 'rgba(251,244,232,.95)'; x.lineWidth = 16; x.strokeText(t.name, 540, 222);
    x.fillStyle = '#5D4037'; x.fillText(t.name, 540, 222);
    pills(x, [[PERS[t.p], '#F1D9BD', '#5D4037', 28], [PERS[t.q], '#F1D9BD', '#5D4037', 28], ...t.kw.map(k => ['#' + k, 'rgba(255,255,255,.85)', '#5D4037', 24])], 284);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#5D4037'; x.font = `700 44px ${FONT_D}`; x.fillText(`「${t.say}」`, 540, 1104);
    x.fillStyle = '#4A3428'; x.font = `400 29px ${FONT_B}`;
    wrap(x, t.desc, 900).slice(0, 2).forEach((l, i) => x.fillText(l, 540, 1156 + i * 44));
    x.textAlign = 'left'; x.fillStyle = '#8B776B'; x.font = `400 24px ${FONT_B}`; x.fillText('最合拍的喵型', 90, 1262);
    x.fillStyle = '#5D4037'; x.font = `700 30px ${FONT_B}`; x.fillText(pal ? pal.name : '', 90, 1302);
    x.textAlign = 'right'; x.fillStyle = '#8B776B'; x.font = `400 24px ${FONT_B}`; x.fillText(code ? '用這個連結來玩，我們一起拿限定服裝' : '來測測你是哪一種喵', 990, 1262);
    x.fillStyle = '#D9773E'; x.font = `700 30px ${FONT_B}`; x.fillText(link(t, code).replace('https://', ''), 990, 1302);
    return c;
  }

  // ---- quiz UI, mounted into any element ----
  const css = document.createElement('style');
  css.textContent = `
  .cq{font-family:${FONT_B};color:#4A3428}
  .cq-top{display:flex;justify-content:space-between;align-items:center;font-size:13px;color:#8B776B}
  .cq-prog{height:8px;border-radius:4px;background:#EADFCF;overflow:hidden;margin:6px 0 4px}.cq-prog i{display:block;height:100%;background:linear-gradient(90deg,#E9A46A,#D9773E);transition:width .3s}
  .cq-img{height:130px;display:flex;justify-content:center;align-items:flex-end;margin:8px 0}.cq-img img{max-height:124px;max-width:70%}
  .cq-q{font-family:${FONT_D};font-size:22px;color:#5D4037;text-align:center;margin:4px 0 14px;line-height:1.4}
  .cq-opt{display:flex;align-items:center;width:100%;text-align:left;font:500 15px ${FONT_B};color:#4A3428;background:#fff;border:1.5px solid #C9A27E;border-radius:14px;padding:11px 14px;margin:0 0 9px;box-sizing:border-box;cursor:pointer}
  .cq-opt b{flex:none;width:26px;height:26px;border-radius:13px;background:#F6E7C8;color:#5D4037;text-align:center;line-height:26px;margin-right:10px;font-size:13px}
  .cq-opt:hover,.cq-opt:focus-visible{background:#FFF1E2;border-color:#D9773E}
  .cq-hint{text-align:center;font-size:12px;color:#8B776B;margin-top:8px}
  .cq-card{width:100%;border-radius:14px;box-shadow:0 6px 18px rgba(93,64,55,.2);display:block;aspect-ratio:4/5;background:#FBF4E8}
  .cq-link{margin:12px 0 8px;background:#fff;border:1.5px solid #C9A27E;border-radius:12px;display:flex;align-items:center;overflow:hidden}
  .cq-link span{flex:1;min-width:0;padding:10px 12px;font-size:13px;color:#5D4037;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;user-select:all}
  .cq-link button{flex:none;border:0;border-radius:0;background:#D9773E;color:#fff;padding:10px 14px;font:700 14px ${FONT_B};cursor:pointer}
  .cq-btns{display:flex;flex-wrap:wrap;gap:8px}.cq-btns>*{flex:1 1 30%;text-align:center;padding:10px 6px;border-radius:12px;font:700 14px ${FONT_B};border:1.5px solid #C9A27E;background:#fff;color:#5D4037;cursor:pointer;text-decoration:none;box-sizing:border-box}
  .cq-btns .line{background:#06C755;border-color:#06C755;color:#fff}.cq-btns .go{background:#D9773E;border-color:#D9773E;color:#fff}
  .cq-note{font-size:13px;color:#8B776B;margin:10px 0 0;line-height:1.5}`;
  document.head.appendChild(css);

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
  async function copy(text) { try { await navigator.clipboard.writeText(text); return true; } catch { return false; } }
  const cardFile = async (canvas, t) => { const blob = await new Promise(ok => canvas.toBlob(ok, 'image/jpeg', .9)); return blob && new File([blob], `喵型_${t.name}.jpg`, { type: 'image/jpeg' }); };
  function download(file) { const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); }
  async function saveImage(canvas, t) { const f = await cardFile(canvas, t); if (f) download(f); }
  // the phone's own share sheet (LINE, IG, Messenger…) with the card picture and the link together.
  // file = the card made ahead of time: iOS only allows share() straight from a tap, so nothing may be awaited before it.
  async function share(file, t, url, say) {
    const text = `我是「${t.name}」！你是哪一種喵？來測測看 👉 ${url}`, title = '暖陽貓閣・喵型測驗';
    const tryShare = async data => { try { await navigator.share(data); return 'ok'; } catch (e) { return e.name === 'AbortError' ? 'ok' : 'no'; } };
    if (file && navigator.canShare && navigator.canShare({ files: [file] }) && await tryShare({ files: [file], text, title }) === 'ok') return;
    if (navigator.share && await tryShare({ text, url, title }) === 'ok') return;
    // no share sheet (a computer): save the picture and copy the text, ready to paste into LINE
    if (file) download(file);
    say(await copy(text) ? '圖卡存好了，連結也複製好了，到 LINE 貼上就可以' : '圖卡存好了，再按「複製連結」貼到 LINE');
  }
  // opts: { onDone(type), code: () => invite code or '', extra: (type) => [{label, cls, href | onClick}], note: (type) => html, toast(msg), inviter }
  function mount(el, opts = {}) {
    const ans = [];
    const say = m => (opts.toast || (m => alert(m)))(m);
    function ask() {
      const i = ans.length, Q = QS[i];
      el.innerHTML = `<div class="cq"><div class="cq-top"><span>喵型測驗</span><span>${i + 1} / ${QS.length}</span></div>
        <div class="cq-prog"><i style="width:${i / QS.length * 100}%"></i></div>
        <div class="cq-img"><img src="${ROOT}assets/cat_${Q.img}.webp" alt=""></div>
        <div class="cq-q">${esc(Q.q)}</div>
        ${Q.a.map((a, k) => `<button class="cq-opt" data-k="${k}"><b>${'ABCD'[k]}</b>${esc(a[0])}</button>`).join('')}
        <div class="cq-hint">沒有標準答案，選最像你的就好 🐾</div></div>`;
      el.querySelectorAll('.cq-opt').forEach(b => b.onclick = () => { ans.push(Q.a[+b.dataset.k][1]); ans.length < QS.length ? ask() : done(score(ans)); });
    }
    function done(t) {
      try { localStorage.setItem('catloft-quiz', t.id); } catch {}
      if (opts.onDone) opts.onDone(t);
      result(t);
    }
    async function result(t) {
      el.innerHTML = '<div class="cq"><div class="cq-note">圖卡準備中……</div></div>';
      // the game may still be fetching the player's friend code; links must carry it
      const code = (opts.code && await opts.code()) || '', url = link(t, code);
      el.innerHTML = `<div class="cq"><canvas class="cq-card" id="cqCard" width="1080" height="1350"></canvas>
        <div class="cq-note">把這個連結傳給朋友，他點開就會看到你的圖卡，也能馬上自己測${code ? '。朋友從你的連結來玩，你們都能拿到限定的暖陽好友套裝' : ''}：</div>
        <div class="cq-link"><span>${esc(url.replace('https://', ''))}</span><button data-cq="copy">複製連結</button></div>
        <div class="cq-btns"><button class="line" data-cq="share">分享圖卡</button><button data-cq="save">存成圖片</button><button data-cq="again">再測一次</button></div>
        <div class="cq-btns" style="margin-top:8px" id="cqExtra"></div>${opts.note ? `<div class="cq-note">${opts.note(t)}</div>` : ''}</div>`;
      const extra = el.querySelector('#cqExtra'), list = opts.extra ? opts.extra(t) : [];
      if (!list.length) extra.remove();
      list.forEach(b => { const n = document.createElement(b.href ? 'a' : 'button'); n.textContent = b.label; if (b.cls) n.className = b.cls; if (b.href) n.href = b.href; else n.onclick = () => b.onClick(n); extra.appendChild(n); });
      let file = null;
      el.querySelector('[data-cq="copy"]').onclick = async () => say(await copy(url) ? '連結複製好了，貼給朋友吧！' : '請長按連結自己複製');
      el.querySelector('[data-cq="share"]').onclick = () => share(file, t, url, say);
      el.querySelector('[data-cq="save"]').onclick = () => { if (file) download(file); };
      el.querySelector('[data-cq="again"]').onclick = () => { ans.length = 0; ask(); };
      const cv = await card(t, code);
      const slot = el.querySelector('#cqCard'); if (slot) slot.getContext('2d').drawImage(cv, 0, 0);
      file = await cardFile(cv, t);
    }
    return { ask, result };
  }
  window.CATQ = { PERS, TYPES, QS, typeOf, persName, score, link, art, card, mount, saveImage, share, copy, SITE };
})();
