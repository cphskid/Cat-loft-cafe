// in-page autopilot for the cooking and change-counting mini-games, called every frame
exports.everyFrame = async (ev, frame) => ev(`(() => {
  const f = ${frame};
  if (S.cook && !S.cook.done && !S.cook.next) {
    const c = S.cook, st = c.steps[c.i], cx = COOK_BOX.x + COOK_BOX.w / 2, cy = COOK_BOX.y + 230;
    if (st.kind === 'tap' && f % 7 === 0) { cookPress(); PR.tapAt(cx, cy); }
    if (st.kind === 'hold') { if (!c.hold) { cookPress(); PR.tapAt(cx, cy); } else PR.tapT = .3; }
    if (st.kind === 'time' && c.mk > .7 && c.mk < .76 && (c.tt || 0) > 1.5) { cookPress(); PR.tapAt(cx, cy); }
  }
  if (S.reg && !S.reg.done && f % 9 === 0) {
    const r = S.reg; let need = r.given - r.total - r.tray.reduce((a, b) => a + b, 0);
    const i = MONEY.findIndex(m => m <= need);
    const b = need > 0 && i >= 0 ? regBtn(i) : REG_OK;
    const p = { x: b.x + b.w / 2, y: b.y + b.h / 2 }; regClick(p); PR.tapAt(p.x, p.y);
  }
})()`);
