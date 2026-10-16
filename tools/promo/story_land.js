const d = require('./drivers');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = {
  length: 62,
  everyFrame: d.everyFrame,
  stills: [{ t: 2, name: 'title' }, { t: 14, name: '1f' }, { t: 19.5, name: 'cook' }, { t: 28, name: 'reg' }, { t: 40, name: '2f' }, { t: 45.5, name: 'room' }, { t: 49.5, name: 'phone' }, { t: 56.5, name: '1f-late' }],
  acts: [
    { t: 0,    run: ev => ev(`PR.cap('巷子裡，一間小小的雙層貓咪咖啡廳')`) },
    { t: 3.6,  run: ev => ev(`PR.cap('')`) },
    { t: 4,    run: ev => ev(`openShop(__G0); S.lvShown = 99; S.speed = 1; PR.cap('今天開始，你是這間店的店長')`) },
    { t: 5.6,  run: ev => ev(`PR.tapDom('#openBtn'); document.getElementById('openBtn').click()`) },
    { t: 7.5,  run: ev => ev(`S.speed = 2`) },
    { t: 9,    run: ev => ev(`PR.cap('招呼客人、點餐、送餐，店員也會一起幫忙')`) },
    { t: 15.5, run: ev => ev(`PR.cap('')`) },
    { t: 16,   run: async (ev, page) => { await page.clock.runFor(30000); await ev(`S.speed = 1; PR.tele(1, OVEN_SPOT.x, OVEN_SPOT.y); PR.cap('親手做甜點：倒麵粉、攪拌、壓貓掌、看火候')`); } },
    { t: 18,   run: ev => ev(`PR.cap(''); startCook('cookie')`) },
    { t: 27,   run: ev => ev(`(() => { const c = S.queue[0] || S.customers.find(c => c.state === 'queue'); if (c) { c.path = []; } PR.tele(1, MGR_COUNTER.x, MGR_COUNTER.y); PR.cap('收銀台算找錢，找對了客人開心'); })()`) },
    { t: 28.6, run: ev => ev(`(() => { PR.cap(''); if (!takeOrder(true, S.mgr)) { const cc = S.customers[0]; openReg(cc, { dish: 'pudding' }, 85); } })()`) },
    { t: 33,   run: async (ev, page) => { await ev('S.reg = null; S.speed = 2'); await page.clock.runFor(30000); await ev(`(() => { const k = S.cats.find(k => k.id === 'orange'); k.floor = 2; k.x = 520; k.y = 566; k.path = []; k.state = 'idle'; PR.tele(2, 470, 566); queueTask(petTask(k, null, 'five')); PR.cap('上 2F 吸貓，跟每隻貓培養感情'); })()`); } },
    { t: 37.5, run: ev => ev(`(() => { const k = S.cats.find(k => k.id === 'orange'); k.hold = false; k.anim = null; queueTask(petTask(k, null, 'hug')); })()`) },
    { t: 43.5, run: ev => ev(`PR.cap('')`) },
    { t: 44,   run: ev => ev(`(() => { const k = S.cats.find(k => k.anim && k.anim.kind === 'hug'); if (k) putDown(k); PR.tele(3, ROOM_IN.x + 140, ROOM_IN.y); PR.cap('累了就到員工休息室喝杯咖啡'); })()`) },
    { t: 47.5, run: ev => ev(`PR.cap('')`) },
    { t: 48,   run: ev => ev(`PR.tele(1, 500, 540); openPhone('cats'); PR.cap('領養新貓咪，收集 300 多種貓')`) },
    { t: 51,   run: ev => ev(`phoneApp = 'guests'; renderPhone(); PR.cap('還有稀有顧客圖鑑等你收集')`) },
    { t: 54,   run: ev => ev(`$('phoneOv').hidden = true; S.uiPause = false; S.speed = 2; PR.cap('升級店鋪、擴建二樓，解鎖新菜單')`) },
    { t: 57.5, run: ev => ev(`PR.cap(''); PR.endOn = true`) },
  ],
};
