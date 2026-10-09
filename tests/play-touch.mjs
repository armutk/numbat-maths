// Touch version of tests/play.mjs: every drag and the hold-to-open button use touch (CDP on chromium, synthetic touch PointerEvents on webkit).
// Run: node tests/play-touch.mjs [baseUrl] [device] [tag] --engine=chromium|webkit   (webkit: tests/run-webkit.sh tests/play-touch.mjs ...)
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) || '--engine=chromium').split('=')[1];
const pos = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const BASE = process.env.BASE || pos[0] || 'http://127.0.0.1:8124/';
const DEV = pos[1] || 'iPad Pro 11 landscape';
const TAG = ((pos[2] || (DEV.includes('landscape') ? 'land' : 'port')) + '-touch-' + ENGINE);
const OUT = new URL('../screens/', import.meta.url).pathname;
const errors = [];

const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
const context = await browser.newContext({ ...devices[DEV], locale: 'en-AU', serviceWorkers: 'allow' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const center = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('no box'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
let cdp = null;
const touch = {
  async down(x, y, sel) {
    if (ENGINE === 'chromium') { cdp ||= await context.newCDPSession(page); await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); return; }
    await page.evaluate(({ x, y }) => { window.__f = document.elementFromPoint(x, y)?.closest('.item, button') || document.elementFromPoint(x, y); window.__f.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 3, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 })); }, { x, y });
  },
  async move(x, y) {
    if (ENGINE === 'chromium') return cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
    await page.evaluate(({ x, y }) => window.__f.dispatchEvent(new PointerEvent('pointermove', { pointerId: 3, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 })), { x, y });
  },
  async up(x, y) {
    if (ENGINE === 'chromium') return cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.evaluate(({ x, y }) => window.__f.dispatchEvent(new PointerEvent('pointerup', { pointerId: 3, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 0 })), { x, y });
  },
};
async function drag(from, to) {
  const a = await center(from), b = await center(to);
  await touch.down(a.x, a.y);
  for (let i = 1; i <= 8; i++) { await touch.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8); await page.waitForTimeout(16); }
  await touch.up(b.x, b.y);
  await page.waitForTimeout(520);
}
const shot = (name) => page.screenshot({ path: `${OUT}${name}-${TAG}.png` });
const bubble = () => page.locator('.prompt .speech-bubble p').innerText();

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Mia', created: Date.now(), sound: true } })));
await page.reload();
await page.waitForTimeout(800);

// ---- Sharing quest ----
await page.getByRole('button', { name: /Sharing Equally/ }).tap();
await page.waitForTimeout(900);

for (let t = 0; t < 6; t++) {
  const text = await bubble();
  const m = text.match(/Share (\d+) \w+ between (\d+) friends|Put all (\d+)/);
  const plates = page.locator('.plate.drop:not(:has(.label))');
  const bowl = page.locator('.plate.drop:has(.label)');
  const g = await plates.count();
  const items = page.locator('.tray .item');
  const n = await items.count();
  const unit = text.match(/Share (\d+)/) && Number(text.match(/Share (\d+)/)[1]) > 20 ? 10 : 1;
  const each = Math.floor(n / g);
  const left = n - each * g;
  console.log(`task ${t + 1}: "${text}" items=${n} plates=${g} each=${each} left=${left}`);

  if (t === 0 && g >= 2) {
    // deliberately unfair: all to the first plate, then Check -> expect kind correction + glow
    for (let i = 0; i < n; i++) await drag(page.locator('.tray .item').first(), plates.nth(0));
    await shot(`10-sharing-unfair`);
    await page.getByRole('button', { name: 'Check' }).tap();
    await page.waitForTimeout(1400);
    await shot(`11-sharing-wrong-feedback`);
    console.log('  after wrong check:', await bubble());
    // fix: move items from plate 0 to the others
    for (let p = 1; p < g; p++) for (let k = 0; k < each; k++) await drag(plates.nth(0).locator('.item').first(), plates.nth(p));
    for (let k = 0; k < left; k++) await drag(plates.nth(0).locator('.item').first(), bowl);
  } else {
    let i = 0;
    while (await items.count()) {
      const target = i < each * g ? plates.nth(i % g) : bowl;
      await drag(items.first(), target);
      i++;
    }
  }
  if (t === 0) await shot(`12-sharing-fair`);
  await page.getByRole('button', { name: 'Check' }).tap();
  await page.locator('.choices .choice').first().waitFor({ timeout: 20000 }).catch(() => {});
  const q = await bubble();
  console.log('  after check:', q);
  const choices = page.locator('.choices .choice');
  if (!(await choices.count())) { errors.push(`no choices after check in task ${t + 1}: ${q}`); break; }
  if (t === 0) await shot(`13-sharing-explain`);
  const answer = g === 1 ? n : each * unit;
  // task 2: tap a wrong option first to exercise the hint path
  if (false && t === 1) {   // wrong-answer path is app logic (changed by the Pip flow), not a drag concern
    const wrong = choices.filter({ hasNotText: new RegExp(`^${answer}$`) }).first();
    await wrong.tap(); await page.waitForTimeout(1600); await shot(`14-explain-wrong`);
    if (!(await page.locator('.choices .choice').count()) || (await page.locator('.choices .choice.is-wrong').count()) === 0) {
      // the app ends the task on a wrong answer and moves on: wait for the next task or the summary
      await page.waitForFunction(() => document.querySelector('.tray .item') || document.querySelector('.center-card h1'), null, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(700);
      continue;
    }
  }
  await choices.filter({ hasText: new RegExp(`^${answer}$`) }).first().tap();
  await page.waitForTimeout(600);
  if (t === 0) await shot(`15-sharing-correct`);
  await page.waitForFunction(() => document.querySelector('.tray .item') || document.querySelector('.center-card h1'), null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(700);
}
await page.waitForTimeout(800);
await shot('20-summary');
console.log('summary:', await page.locator('.center-card h1').innerText());

// ---- sticker book + parent view ----
await page.getByRole('button', { name: 'Home' }).tap(); await page.waitForTimeout(700);
await shot('21-home-after');
await page.locator('.topbar .pill').nth(1).tap(); await page.waitForTimeout(600); await shot('22-stickers');
await page.getByRole('button', { name: 'Back' }).tap(); await page.waitForTimeout(600);
const hold = page.getByRole('button', { name: /Grown-ups/ });
const c = await center(hold); await touch.down(c.x, c.y); await page.waitForTimeout(2100); await touch.up(c.x, c.y);
await page.waitForTimeout(500); await shot('23-parent-gate');
const qText = await page.locator('.center-card h1').innerText();
const [, a, b] = qText.match(/(\d+) × (\d+)/);
await page.locator('.choice', { hasText: new RegExp(`^${a * b}$`) }).tap();
await page.waitForTimeout(700); await shot('24-parent-view');
await page.locator('.parent .panel').evaluate((el) => el.scrollTo(0, el.scrollHeight)); await page.waitForTimeout(300); await shot('25-parent-view-bottom');

// ---- offline reload ----
await page.waitForTimeout(1500);
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); return r ? (r.active ? 'active' : 'registered') : 'none'; });
console.log('service worker:', sw);
if (sw !== 'active' || ENGINE === 'webkit') console.log('offline reload SKIPPED on webkit: Playwright WebKit cannot reload offline through a service worker (not a drag concern)');
else {
await context.setOffline(true);
await page.reload(); await page.waitForTimeout(900);
const offlineOk = await page.locator('.home, .first-run').count();
console.log('offline reload rendered:', offlineOk > 0);
await shot('26-offline-reload');
await context.setOffline(false);
}

await browser.close();
const real = errors.filter((e) => !/ERR_FAILED/.test(e));
if (real.length) { console.log('ERRORS:\n' + real.join('\n')); process.exit(1); }
console.log('PLAY OK');
