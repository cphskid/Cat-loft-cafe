// 暖陽貓閣「📢 公告」：管理者在 admin/「📢 公告」分頁打字發布，玩家這裡讀（supabase/catloft_news.sql）。
// Chuck 2026-10-31「管理者那邊有一個新增公告可以直接自己打字新增上去，新增完畢之後玩家就看得到了」；
// 女兒的企劃：「公告會有即將來到的活動和新消息，過了 7 天就會消失」（下架時間由管理者選，預設 7 天）。
// 手機「公告」App 列出還在的公告；沒看過的新公告在開店後、或遊戲開著時一分鐘內跳一張卡片。
// 看過哪些記在這台裝置的 localStorage（只是「新」的小紅點，換裝置頂多再看一次）。
// 用到 index.html 的全域：CLOUD、S、started、closeChoose、renderPhone、phoneApp、sfx、$。
(function () {
  const KEY = 'catloft-news-seen';
  let list = [], seen = 0, busy = false, loaded = false;
  try { seen = +localStorage.getItem(KEY) || 0; } catch {}
  const on = () => !!(CLOUD.sb && !CLOUD.db);
  const unread = () => list.filter(n => n.id > seen);
  const markSeen = () => { const top = Math.max(seen, ...list.map(n => n.id)); if (top > seen) { seen = top; try { localStorage.setItem(KEY, String(seen)); } catch {} } };
  const esc = (t, n) => String(t ?? '').slice(0, n).replace(/[&<>"'`]/g, c => `&#${c.charCodeAt(0)};`);
  const md = t => { const d = new Date(t); return `${d.getMonth() + 1}/${d.getDate()}`; };
  const left = t => { const d = Math.ceil((new Date(t) - Date.now()) / 864e5); return d <= 1 ? '今天最後一天' : `還有 ${d} 天`; };
  const item = n => `<div class="item"><div class="top"><span class="nm">${n.id > seen ? '<span class="badge sm" style="position:static;display:inline-block;margin-right:4px">新</span>' : ''}${esc(n.title, 30)}</span><span class="sub">${md(n.created_at)}</span></div>
    ${n.body ? `<div style="white-space:pre-wrap;margin:4px 0">${esc(n.body, 300)}</div>` : ''}<div class="sub">${left(n.expires_at)}後消失</div></div>`;

  async function load() {
    if (!on()) return;
    try { const { data, error } = await CLOUD.sb.rpc('catloft_news'); if (!error && Array.isArray(data)) { list = data; loaded = true; } } catch {}
  }

  // ---------- phone app ----------
  function page() {
    if (!loaded && on()) load().then(() => { if (loaded && phoneApp === 'news' && !$('phoneOv').hidden) renderPhone(); });
    const h = list.length ? list.map(item).join('') : `<p class="muted">${on() ? '現在沒有公告。有新活動或新消息的時候會出現在這裡。' : '連不上網路，看不到公告。'}</p>`;
    // opening the app counts as reading them; the 新 tags stay until the app is closed
    setTimeout(markSeen, 0);
    return `<p class="muted" style="margin:0 0 6px">管理者發的最新消息和即將到來的活動，時間到會自動消失。</p>` + h;
  }
  const sub = () => unread().length ? `${unread().length} 則新公告` : list.length ? `${list.length} 則公告` : '最新消息';

  // ---------- the card for new ones ----------
  const free = () => started && S && S.phase !== 'settle' && !S.cook && !S.reg && !S.mini && !S.uiPause && !S.out && $('phoneOv').hidden && $('chooseOv').hidden;
  async function check() {
    if (busy || !on() || document.visibilityState !== 'visible') return;
    busy = true;
    try {
      await load();
      const fresh = unread();
      if (!fresh.length || !free()) return;
      const c = $('chooseCard');
      c.innerHTML = `<h2>📢 公告</h2>${fresh.slice(0, 3).map(item).join('')}${fresh.length > 3 ? `<p class="muted">還有 ${fresh.length - 3} 則，打開手機「公告」看全部。</p>` : ''}<div class="row"><button class="primary" id="newsOk">知道了</button></div>`;
      $('chooseOv').hidden = false; S.uiPause = true; sfx('delivery');
      markSeen();
      $('newsOk').onclick = closeChoose;
    } catch {} finally { busy = false; }
  }
  setInterval(check, 60000);
  // after the gift (3 s) and check-in (6 s) cards have had their turn
  const wait = setInterval(() => { if (started) { clearInterval(wait); setTimeout(check, 9000); } }, 2000);
  window.NEWS = { page, sub, unread: () => unread().length };
})();
