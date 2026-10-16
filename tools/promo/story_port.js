const d = require('./drivers');
module.exports = {
  length: 31,
  everyFrame: d.everyFrame,
  acts: [
    { t: 0,    run: ev => ev(`PR.cap('巷子裡的雙層貓咪咖啡廳')`) },
    { t: 2.6,  run: ev => ev(`PR.cap('')`) },
    { t: 3,    run: ev => ev(`openShop(__G0); S.lvShown = 99; S.speed = 1; PR.cap('今天開始，你是店長')`) },
    { t: 4.3,  run: ev => ev(`PR.tapDom('#openBtn'); document.getElementById('openBtn').click()`) },
    { t: 5.5,  run: ev => ev(`S.speed = 2; PR.cap('招呼客人、點餐、送餐')`) },
    { t: 9.6,  run: ev => ev(`PR.cap('')`) },
    { t: 10,   run: async (ev, page) => { await page.clock.runFor(30000); await ev(`S.speed = 1; PR.tele(1, OVEN_SPOT.x, OVEN_SPOT.y); PR.cap('親手做甜點')`); } },
    { t: 11.4, run: ev => ev(`PR.cap(''); startCook('cookie')`) },
    { t: 19.8, run: async (ev, page) => { await ev('S.speed = 2'); await page.clock.runFor(40000); await ev(`(() => { const k = S.cats.find(k => k.id === 'orange'); k.floor = 2; k.x = 520; k.y = 566; k.path = []; k.state = 'idle'; PR.tele(2, 470, 566); queueTask(petTask(k, null, 'five')); PR.cap('上 2F 吸貓、培養感情'); })()`); } },
    { t: 23.2, run: ev => ev(`(() => { const k = S.cats.find(k => k.id === 'orange'); k.hold = false; k.anim = null; queueTask(petTask(k, null, 'hug')); })()`) },
    { t: 26.2, run: ev => ev(`PR.cap('')`) },
    { t: 26.5, run: ev => ev(`openPhone('cats'); PR.cap('領養新貓咪，收集 300 多種貓')`) },
    { t: 28.8, run: ev => ev(`PR.cap(''); PR.endOn = true`) },
  ],
};
