// usage: (cd web && python3 -m http.server 8765) & node tools/quiz/og.js -> web/q/og/<type>.jpg (share previews for LINE / FB)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
(async () => {
  const out = path.join(__dirname, '..', '..', 'web', 'q', 'og'); fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch(), pg = await b.newPage();
  await pg.goto('http://localhost:8765/q/'); await pg.waitForFunction(() => window.CATQ);
  for (const id of await pg.evaluate(() => CATQ.TYPES.map(t => t.id))) {
    const data = await pg.evaluate(async id => (await CATQ.card(CATQ.typeOf(id), '')).toDataURL('image/jpeg', .82), id);
    fs.writeFileSync(path.join(out, id + '.jpg'), Buffer.from(data.split(',')[1], 'base64')); console.log(id);
  }
  await b.close();
})();
