const { chromium } = require('./common');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.goto('http://localhost:8765/about/');
  await p.setContent(`<html><head><base href="http://localhost:8765/about/"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=LXGW+WenKai+TC:wght@400;700&family=Noto+Sans+TC:wght@500&display=swap"></head>
  <body style="margin:0;width:1200px;height:630px;display:flex;align-items:center;gap:44px;padding:0 56px;box-sizing:border-box;background:radial-gradient(ellipse at 20% 10%,#FFF9EF,#F3E4CE 75%);font-family:'LXGW WenKai TC';color:#4A3426">
  <img src="../assets/title.webp" style="width:600px;border-radius:20px;border:7px solid #fff;box-shadow:0 14px 34px rgba(60,40,30,.25);transform:rotate(-1.5deg)">
  <div><div style="letter-spacing:.3em;color:#9B7B62;font-size:20px">CAT LOFT CAFE</div>
  <div style="font-size:84px;font-weight:700;color:#5D4037;line-height:1.1;margin:6px 0 14px">暖陽貓閣</div>
  <div style="font-size:28px;line-height:1.5;margin-bottom:22px">今天開始，<br>你是貓咪咖啡廳的店長</div>
  <span style="background:#D9773E;color:#fff;border-radius:999px;padding:8px 24px;font-size:26px;font-weight:700">免費線上試玩</span>
  <img src="../assets/cat_orange_1.webp" style="height:90px;vertical-align:bottom;margin-left:14px"></div></body></html>`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: 'og.png' });
  await b.close();
})();
