// 暖陽貓閣「遊玩統計」：每天玩了多久、時間花在哪裡，給管理者頁面看回流和功能熱度。
// index.html 在「真的在玩」的每一格畫面呼叫 STATS.tick(秒)（畫面在前面、兩分鐘內有操作，跟 G.play 同一個條件）。
// 累積起來每分鐘送一次到 Supabase（catloft_log_play，supabase/catloft_stats.sql），切走分頁時也送。
// 用到 index.html 的全域：G、S、CLOUD、phoneApp、$。
(function () {
  const on = () => !!(CLOUD.sb && !CLOUD.db && CLOUD.uid && !CLOUD.conflict);
  const twDate = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
  let bucket = { d: twDate(), secs: 0, gday: 0, act: {} }, busy = false;

  // what the player is doing right now, as a short key (the admin page turns it into words)
  function what() {
    if (S.cook) return 'cook';
    if (S.mini) return 'dessert';
    if (S.reg) return 'reg';
    if (!$('phoneOv').hidden) return 'app_' + String(phoneApp || 'home').replace(/[^a-z0-9]/g, '').slice(0, 16);
    if (S.out) return 'out';
    if (S.phase === 'closing' || S.phase === 'settle') return 'close';
    if (S.phase === 'prep') return 'prep';
    return 's' + G.at + 'f' + S.view;
  }

  function tick(dt) {
    const d = twDate();
    if (d !== bucket.d) { flush(); bucket = { d, secs: 0, gday: 0, act: {} }; }
    bucket.secs += dt; bucket.gday = Math.max(bucket.gday, G.day || 1);
    const k = what(); bucket.act[k] = (bucket.act[k] || 0) + dt;
  }

  // send what has piled up; on failure it is put back and goes with the next send
  async function flush() {
    if (busy || !on() || bucket.secs < 1) return;
    const b = bucket; bucket = { d: b.d, secs: 0, gday: b.gday, act: {} };
    const act = Object.fromEntries(Object.entries(b.act).map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0));
    busy = true;
    try {
      const { error } = await CLOUD.sb.rpc('catloft_log_play', { p_d: b.d, p_secs: Math.round(b.secs), p_gday: b.gday, p_act: act });
      if (error) throw error;
    } catch {
      if (bucket.d === b.d) { bucket.secs += b.secs; for (const [k, v] of Object.entries(b.act)) bucket.act[k] = (bucket.act[k] || 0) + v; }
    }
    busy = false;
  }

  setInterval(flush, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
  window.STATS = { tick, flush };
})();
