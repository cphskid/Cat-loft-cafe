// 暖陽貓閣的「💬 問題回報」，照時光冒險樂園 js/feedback.js 的做法改的。
//
// 回報寫進樂園共用的 feedback 表（supabase/catloft_feedback.sql），context.game = 'catloft'，
// 所以和樂園、守護異世界、島嶼開拓者的回報都在樂園老師後台 teacher.html#feedback 同一個收件匣。
// 送出用 catloft_submit_feedback（貓閣玩家不是樂園的學生或老師），讀回覆用樂園的 my_feedback / seen_my_feedback。
//
// 小朋友描述 bug 通常只會寫「壞掉了」，所以真正有用的是自動附上的東西：
// 第幾天、在哪一層、開著哪個視窗、網址、裝置、螢幕大小、最近按過的按鈕、最近跳出的錯誤。
//
// 用法：
//   CatFeedback.mount({
//     client: () => supabaseClient,        // 遊戲自己的 supabase client
//     ensureUser: async () => {},          // 還沒有玩家身分時先建一個（匿名登入）
//     context: () => ({ screen: '1F' }),   // 送出當下要附上的東西，screen 會另外存一欄
//     onDot: (n) => {},                    // 「我的回報」有幾則新回覆，給自己的按鈕亮紅點
//   })
//   CatFeedback.open()
(function () {
  if (window.CatFeedback) return;

  let opts = {};
  let mine = null;

  // ---------- 自動附上的東西 ----------
  const taps = [];
  const errors = [];
  const hhmmss = () => new Date().toTimeString().slice(0, 8);
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest && e.target.closest('button, a, [role=button]');
    if (!el || el.closest('.cfb')) return;
    const label = (el.textContent || el.getAttribute('aria-label') || el.className || '?').trim().replace(/\s+/g, ' ');
    taps.push(`${hhmmss()} ${String(label).slice(0, 30)}${el.disabled ? '（停用中）' : ''}`);
    if (taps.length > 5) taps.shift();
  }, true);
  const keep = (m) => { errors.push(`${hhmmss()} ${m}`.slice(0, 200)); if (errors.length > 5) errors.shift(); };
  window.addEventListener('error', (e) => keep(e.message || String(e.error)));
  window.addEventListener('unhandledrejection', (e) => keep(e.reason instanceof Error ? e.reason.message : String(e.reason)));

  // ---------- 資料庫 ----------
  async function rpc(name, body, make) {
    const sb = opts.client && opts.client();
    if (!sb) throw new Error('連不上回報系統，重新整理網頁再試一次');
    let { data: { session } } = await sb.auth.getSession();
    if (!session && make && opts.ensureUser) {
      try { await opts.ensureUser(); } catch { /* 下面會說連不上 */ }
      ({ data: { session } } = await sb.auth.getSession());
    }
    if (!session) {
      if (!make) return [];
      throw new Error('連不上網路，檢查一下網路再試一次');
    }
    let res;
    try { res = await sb.rpc(name, body || {}); } catch { throw new Error('連不上網路，檢查一下網路再試一次'); }
    if (res.error) {
      const m = res.error.message || '';
      if (/jwt/i.test(m)) throw new Error('登入過期了，重新整理網頁再試一次');
      if (/fetch|network/i.test(m)) throw new Error('連不上網路，檢查一下網路再試一次');
      throw new Error(m || '送不出去，等一下再試');
    }
    return res.data;
  }

  // ---------- 狀態說法（跟樂園一樣） ----------
  const KINDS = [
    { id: 'bug', label: '🐞 壞掉了', hint: '例如：按了沒反應、畫面卡住、東西不見了' },
    { id: 'confusing', label: '❓ 看不懂', hint: '例如：不知道下一步要做什麼' },
    { id: 'idea', label: '💡 我有想法', hint: '例如：希望多一隻貓、多一道甜點' },
  ];
  const MY_STATUS = {
    new: ['已收到', 'wait', '我們收到了，會盡快來看。'],
    bug: ['處理中', 'work', '我們確認這是問題，正在修。'],
    unclear: ['處理中', 'work', '我們正在討論要怎麼處理。'],
    request: ['好點子', 'work', '謝謝你的想法！已經放進想做的清單。'],
    fixed: ['修好了', 'done', '修好了！重新整理網頁就會是新版。謝謝你幫忙！'],
    dup: ['已處理', 'close', '已經有人回報過一樣的問題，我們會一起處理。'],
    wontfix: ['看過了', 'close', '我們看過了，這次先不改，謝謝你告訴我們。'],
  };
  const isUnread = (r) => !!r.updated_at && (!r.seen_at || Date.parse(r.updated_at) > Date.parse(r.seen_at));
  const unread = () => (mine || []).filter(isUnread).length;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  function paintDot() {
    if (opts.onDot) try { opts.onDot(unread()); } catch { /* 紅點壞了不影響回報 */ }
  }
  async function loadMine() {
    try { mine = await rpc('my_feedback'); } catch { mine = mine || null; }
    paintDot();
  }

  // ---------- 畫面（用遊戲的紙、木頭顏色） ----------
  const CSS = `
.cfb{font-family:var(--body,"Noto Sans TC",system-ui,sans-serif);color:var(--ink,#4A3428);-webkit-text-size-adjust:100%}
.cfb-veil{position:fixed;inset:0;z-index:30;display:flex;align-items:center;justify-content:center;padding:12px;background:rgba(74,52,40,.45);touch-action:manipulation}
.cfb-box{position:relative;width:min(440px,100%);max-height:calc(100dvh - 24px);overflow:auto;padding:18px 18px 16px;border-radius:18px;background:var(--paper,#FDFBF7);box-shadow:0 20px 50px rgba(0,0,0,.25)}
.cfb h2{margin:0 0 10px;font:700 21px/1.2 var(--display,serif);color:var(--wood-d,#5D4037)}
.cfb p{margin:8px 0;font-size:14px;line-height:1.6}
.cfb-x{position:absolute;right:10px;top:10px;width:34px;height:34px;padding:0!important;border-radius:50%!important;font-size:16px!important}
.cfb-tabs,.cfb-kinds,.cfb-btns{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 10px}
.cfb-btns{justify-content:flex-end;margin:12px 0 0}
.cfb button.b.on{background:var(--sun,#F6E7C8);border-color:var(--wood,#8D6E63);font-weight:700}
.cfb button.b.go{background:var(--wood,#8D6E63);border-color:var(--wood,#8D6E63);color:#fff;font-weight:700}
.cfb textarea{box-sizing:border-box;width:100%;min-height:96px;padding:10px 12px;border-radius:12px;border:1px solid var(--wood-l,#C9A27E);background:#fff;font:16px/1.5 var(--body,sans-serif);color:inherit;resize:vertical}
.cfb textarea:focus{outline:2px solid var(--accent,#D9773E)}
.cfb .note{font-size:12px;color:var(--muted,#8B776B)}
.cfb .err{color:var(--bad,#C65445);font-weight:700}
.cfb-tabs i{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--accent,#D9773E);margin-left:4px;vertical-align:top}
.cfb-tabs i[hidden]{display:none}
.cfb-list{display:flex;flex-direction:column;gap:8px}
.cfb-item{padding:10px 12px;border-radius:12px;background:#fff;border:1px solid var(--line,#E6DACB)}
.cfb-item.fresh{border-color:var(--accent,#D9773E);box-shadow:0 0 0 3px rgba(217,119,62,.15)}
.cfb-row{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--muted,#8B776B)}
.cfb-badge{padding:3px 8px;border-radius:99px;color:#fff;background:#9a8a7a;font-weight:700}
.cfb-badge.wait{background:#7A8DA6}.cfb-badge.work{background:var(--warn,#D9A23A)}.cfb-badge.done{background:var(--good,#6E9B4E)}
.cfb-msg{margin:6px 0 4px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}
.cfb-reply{font-size:13px;line-height:1.5;color:var(--wood-d,#5D4037);background:var(--sun,#F6E7C8);border-radius:10px;padding:6px 10px}`;

  function injectCss() {
    if (document.getElementById('cfb-css')) return;
    const st = document.createElement('style');
    st.id = 'cfb-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  let veil = null;
  function close() {
    if (!veil) return;
    veil.remove(); veil = null;
    if (opts.onClose) try { opts.onClose(); } catch { /* 遊戲自己的事 */ }
  }

  function open(tab) {
    injectCss();
    if (veil) { veil.remove(); veil = null; }
    const fresh = new Set((mine || []).filter(isUnread).map((r) => r.id));
    let cur = tab || (fresh.size ? 'mine' : 'write');
    let kind = 'bug';
    let text = '';
    let state = 'edit';
    let error = '';

    veil = document.createElement('div');
    veil.className = 'cfb cfb-veil';
    veil.setAttribute('role', 'dialog');
    veil.setAttribute('aria-modal', 'true');
    veil.addEventListener('click', (e) => { if (e.target === veil) close(); });
    document.body.appendChild(veil);

    function paint() {
      if (!veil) return;
      if (state === 'done') {
        veil.innerHTML = `<div class="cfb-box"><h2>收到了，謝謝你！</h2>
          <p>我們看過之後會處理。處理的進度和回覆，之後在店長手機的「問題回報」→「我的回報」就看得到。</p>
          <div class="cfb-btns"><button class="b go" data-close>好</button></div></div>`;
      } else {
        const n = unread();
        const body = cur === 'mine'
          ? (mine === null ? `<p class="note">讀取中…</p>`
            : mine.length === 0 ? `<p class="note">你還沒有回報過。遇到問題或有想法，隨時告訴我們！</p>`
            : `<div class="cfb-list">${mine.map((r) => {
                const [label, tone, say] = MY_STATUS[r.status] || MY_STATUS.new;
                return `<div class="cfb-item${fresh.has(r.id) ? ' fresh' : ''}">
                  <div class="cfb-row"><span class="cfb-badge ${tone}">${label}</span><span>${new Date(r.created_at).toLocaleDateString('zh-TW')}</span>${fresh.has(r.id) ? '<span style="color:#D9773E">新消息</span>' : ''}</div>
                  <div class="cfb-msg">${esc(r.message)}</div>
                  <div class="cfb-reply">${r.reply ? '💌 ' + esc(r.reply) : say}</div></div>`;
              }).join('')}</div>`)
            + (error ? `<p class="err">${esc(error)}</p>` : '')
            + `<div class="cfb-btns"><button class="b" data-close>關閉</button></div>`
          : `<div class="cfb-kinds">${KINDS.map((k) => `<button class="b${k.id === kind ? ' on' : ''}" data-kind="${k.id}">${k.label}</button>`).join('')}</div>
            <textarea maxlength="500" rows="4" placeholder="${esc(KINDS.find((k) => k.id === kind).hint)}">${esc(text)}</textarea>
            <p class="note">會自動附上第幾天、在哪一層和用什麼裝置，不用另外寫。</p>
            ${error ? `<p class="err">${esc(error)}</p>` : ''}
            <div class="cfb-btns"><button class="b" data-close>取消</button>
              <button class="b go" data-send ${!text.trim() || state === 'sending' ? 'disabled' : ''}>${state === 'sending' ? '送出中…' : '送出'}</button></div>`;
        veil.innerHTML = `<div class="cfb-box"><button class="cfb-x" data-close aria-label="關閉">✕</button><h2>💬 問題回報</h2>
          <div class="cfb-tabs"><button class="b${cur === 'write' ? ' on' : ''}" data-tab="write">✏️ 寫新的</button>
          <button class="b${cur === 'mine' ? ' on' : ''}" data-tab="mine">📬 我的回報<i ${n || fresh.size ? '' : 'hidden'}></i></button></div>${body}</div>`;
      }
      veil.querySelectorAll('[data-close]').forEach((b) => { b.onclick = close; });
      veil.querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => { cur = b.dataset.tab; error = ''; showTab(); }; });
      veil.querySelectorAll('[data-kind]').forEach((b) => { b.onclick = () => { kind = b.dataset.kind; paint(); focusText(); }; });
      const ta = veil.querySelector('textarea');
      if (ta) ta.oninput = () => {
        text = ta.value;
        const send = veil.querySelector('[data-send]');
        if (send) send.disabled = !text.trim() || state === 'sending';
      };
      const send = veil.querySelector('[data-send]');
      if (send) send.onclick = submit;
    }
    function focusText() {
      const ta = veil && veil.querySelector('textarea');
      if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
    }
    async function showTab() {
      paint();
      if (cur !== 'mine') return;
      try {
        mine = await rpc('my_feedback');
        if (mine.some(isUnread)) {
          await rpc('seen_my_feedback');
          const now = new Date().toISOString();
          mine = mine.map((r) => ({ ...r, seen_at: now }));
        }
      } catch (e) { error = e.message; if (mine === null) mine = []; }
      paintDot();
      paint();
    }
    async function submit() {
      state = 'sending'; error = ''; paint();
      let extra = {};
      try { extra = (opts.context && opts.context()) || {}; } catch { /* 遊戲給的資料壞了照樣送 */ }
      const { screen, ...rest } = extra;
      try {
        await rpc('catloft_submit_feedback', {
          p_kind: kind,
          p_message: text,
          p_screen: String(screen || location.pathname).slice(0, 40),
          p_context: {
            game: 'catloft',
            ...rest,
            url: (location.pathname + location.search + location.hash).slice(0, 200),
            taps: [...taps],
            errors: [...errors],
            ua: navigator.userAgent.slice(0, 200),
            view: `${innerWidth}x${innerHeight}`,
          },
        }, true);
        state = 'done';
        text = '';
        loadMine();
      } catch (e) {
        state = 'edit'; error = e.message;
      }
      paint();
    }
    showTab();
    if (cur === 'write') setTimeout(focusText, 50);
  }

  function mount(o) {
    opts = { ...opts, ...(o || {}) };
    injectCss();
    loadMine();
  }

  window.CatFeedback = { mount, open, refresh: loadMine, close, isOpen: () => !!veil };
})();
