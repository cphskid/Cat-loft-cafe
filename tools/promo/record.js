// Drives the real game with a fake clock and screenshots every frame.
// node record.js land|port [preview]
const fs = require('fs');
const { chromium, setup, G_SETUP } = require('./common');
const MODE = process.argv[2] || 'land', PREVIEW = process.argv[3] === 'preview', STILLS = process.argv[3] === 'stills';
const FPS = 30, OUT = `${__dirname}/${STILLS ? 'stills' : 'frames'}_${MODE}`;
const VP = MODE === 'land' ? { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 }
                           : { viewport: { width: 405, height: 720 }, deviceScaleFactor: 8 / 3, isMobile: true, hasTouch: true };

const OVERLAY_CSS = `
#promoCap{position:fixed;left:50%;top:${MODE === 'land' ? '11%' : '15%'};transform:translateX(-50%);z-index:99;pointer-events:none;
  font-family:"LXGW WenKai TC",serif;font-weight:700;font-size:${MODE === 'land' ? 34 : 22}px;color:#4A3426;white-space:nowrap;
  background:rgba(253,248,238,.93);border:2px solid #D9773E;border-radius:999px;padding:.35em 1.1em;box-shadow:0 6px 20px rgba(60,40,30,.25);
  opacity:0;transition:none}
#promoTap{position:fixed;z-index:98;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;border:4px solid rgba(255,255,255,.95);
  background:rgba(217,119,62,.35);box-shadow:0 0 0 3px rgba(217,119,62,.6);pointer-events:none;opacity:0}
#promoEnd{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:${MODE === 'land' ? 14 : 12}px;
  background:radial-gradient(ellipse at center,#FFF9EF 0%,#F6E9D6 70%,#EAD6BC 100%);font-family:"LXGW WenKai TC",serif;color:#4A3426;opacity:0;text-align:center}
#promoEnd img{width:${MODE === 'land' ? '46%' : '86%'};border-radius:18px;box-shadow:0 10px 30px rgba(60,40,30,.25)}
#promoEnd .en{letter-spacing:.3em;font-size:${MODE === 'land' ? 20 : 14}px;color:#9B7B62}
#promoEnd .big{font-size:${MODE === 'land' ? 72 : 52}px;font-weight:700;line-height:1}
#promoEnd .cta{font-size:${MODE === 'land' ? 30 : 22}px;background:#D9773E;color:#fff;border-radius:999px;padding:.3em 1.2em;font-weight:700}
#promoEnd .url{font-family:"Noto Sans TC",sans-serif;font-size:${MODE === 'land' ? 26 : 17}px;color:#6B4E3A}
#titleOv .card > p.muted, #titleOv textarea, #titleOv .row:last-of-type, #toasts .toast:empty{display:none!important}
.coach{display:none!important}${STILLS ? '#promoCap,#promoTap{display:none!important}' : ''}`;

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT);
  const b = await chromium.launch();
  const ctx = await b.newContext(VP);
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('ERR', e.message));
  await setup(page);
  await page.clock.install({ time: new Date('2026-10-16T09:00:00') });
  await page.goto('http://localhost:8765/');
  await page.clock.runFor(500);
  await page.waitForTimeout(3000); // real time for fonts + art to download
  await page.clock.pauseAt(await page.evaluate('Date.now() + 200')); // freeze game time; only runFor moves it
  await page.addStyleTag({ content: OVERLAY_CSS });
  await page.evaluate(`(() => {
    window.__sfx = []; window.__f = 0;
    sfx = (name, f) => { __sfx.push({ name, t: __f, quiet: !!(f && S && f !== S.view) }); };
    const cap = document.createElement('div'); cap.id = 'promoCap'; document.body.appendChild(cap);
    const tap = document.createElement('div'); tap.id = 'promoTap'; document.body.appendChild(tap);
    const end = document.createElement('div'); end.id = 'promoEnd';
    end.innerHTML = '<img src="assets/title.webp"><div class="en">CAT LOFT CAFE</div><div class="big">暖陽貓閣</div><div class="cta">免費試玩・手機電腦都能玩</div><div class="url">catloftcafe.ciyulab.com</div>';
    document.body.appendChild(end);
    window.PR = {
      capT: 0, tapT: 0, endA: 0, endOn: false,
      cap(t) { cap.textContent = t; this.capT = 0; this.capOn = !!t; },
      tapAt(wx, wy) { tap.style.left = (wx * V.s + V.tx) + 'px'; tap.style.top = (wy * V.s + V.ty) + 'px'; this.tapT = .35; },
      tapDom(sel) { const r = document.querySelector(sel).getBoundingClientRect(); tap.style.left = (r.left + r.width / 2) + 'px'; tap.style.top = (r.top + r.height / 2) + 'px'; this.tapT = .35; },
      tick(dt) {
        this.capT += dt; cap.style.opacity = this.capOn ? Math.min(1, this.capT * 4) : Math.max(0, +cap.style.opacity - dt * 4);
        cap.style.transform = 'translateX(-50%) translateY(' + (this.capOn ? Math.max(0, 12 - this.capT * 60) : 0) + 'px)';
        this.tapT = Math.max(0, this.tapT - dt); tap.style.opacity = this.tapT ? this.tapT / .35 : 0; tap.style.transform = 'scale(' + (1.3 - this.tapT) + ')';
        this.endA = this.endOn ? Math.min(1, this.endA + dt * 2) : 0; end.style.opacity = this.endA;
      },
    };
    window.PR.tele = (f, x, y) => { const m = S.mgr; m.floor = f; m.x = x; m.y = y; m.path = []; m.task = null; m.mode = 'idle'; m.lastFloor = f; S.tasks = []; S.view = f; CAM.snap = true; updateButtons(); };
  })()`);
  const G0 = await page.evaluate(`window.__G0 = ${G_SETUP}; 1`);

  // ---------- the storyboard ----------
  const T = MODE === 'land' ? require('./story_land') : require('./story_port');
  const ev = s => page.evaluate(s);
  let frame = 0;
  const total = Math.round(T.length * FPS);
  const step = PREVIEW ? FPS : 1;
  const acts = T.acts.map(a => ({ ...a, f: Math.round(a.t * FPS) })).sort((a, b) => a.f - b.f);
  let ai = 0;
  while (frame < total) {
    for (let k = 0; k < step; k++) {
      while (ai < acts.length && acts[ai].f <= frame) { await acts[ai].run(ev, page); ai++; }
      await ev(`__f = ${frame}; PR.tick(${1 / FPS})`);
      if (T.everyFrame) await T.everyFrame(ev, frame);
      await page.clock.runFor(1000 / FPS);
      frame++;
    }
    if (STILLS) { const hit = T.stills.find(s => Math.round(s.t * FPS) === frame); if (hit) await page.screenshot({ path: `${OUT}/${hit.name}.png` }); }
    else await page.screenshot({ path: `${OUT}/${String(PREVIEW ? frame / FPS : frame).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 92 });
    if (frame % (FPS * 5) === 0) console.log('t', frame / FPS);
  }
  fs.writeFileSync(`${OUT}/sfx.json`, JSON.stringify(await ev('__sfx')));
  await b.close();
})();
