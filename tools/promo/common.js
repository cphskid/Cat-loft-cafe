// Shared setup for the promo recordings: a day-12 shop with all staff, 7 cats and most furniture.
// Playwright: the global install in the Claude cloud container, or a local `npm i playwright`.
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;
exports.chromium = chromium;
// recordings never touch the real cloud save or feedback inbox
exports.setup = async (page) => {
  await page.route(/supabase\.co|feedback/, r => r.abort());
};
exports.G_SETUP = `(() => {
  const ng = freshG();
  Object.assign(ng, { day: 12, cash: 3280, fans: 64, exp: 520, earned: 18400, tables: 6, expand: 2,
    staff: ['cook','server','cashier','feeder','sitter'], furn: ['plant','lamp','record','cushion','cattree','chalk','bed','deodor','warmer'],
    music: 'jazz', bowl: 6 });
  ng.stock = { flour: 40, food: 30, catfood: 20, litter: 10, beans: 20, treat: 20 };
  for (const id of ['calico','gray','tabby','milk']) { ng.cats.push({ id, since: 4, pets: 0 }); ng.seen.push(id); ng.duty.push(id); }
  ng.bond = { orange: 120, tux: 60, fluffy: 80, calico: 30 };
  return ng;
})()`;
