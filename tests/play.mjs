// Scripted play-through on iPad emulation: drag-and-drop, wrong answers, hints, explain step, summary, parent view, offline reload.
// Run: node tests/play.mjs [baseUrl] [device]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8124/';
const DEV = process.argv[3] || 'iPad Pro 11 landscape';
const TAG = (process.argv[4] || (DEV.includes('landscape') ? 'land' : 'port'));
const OUT = new URL('../screens/', import.meta.url).pathname;
const errors = [];

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices[DEV], locale: 'en-AU', serviceWorkers: 'allow' });
const page = await context.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const center = async (loc) => { const b = await loc.boundingBox(); if (!b) throw new Error('no box'); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function drag(from, to) {
  const a = await center(from), b = await center(to);
  await page.mouse.move(a.x, a.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(420);
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
  await page.waitForTimeout(2600);
  const q = await bubble();
  console.log('  after check:', q);
  const choices = page.locator('.choices .choice');
  if (!(await choices.count())) { errors.push(`no choices after check in task ${t + 1}: ${q}`); break; }
  if (t === 0) await shot(`13-sharing-explain`);
  const answer = g === 1 ? n : each * unit;
  // task 2: tap a wrong option first to exercise the hint path
  if (t === 1) {
    const wrong = choices.filter({ hasNotText: new RegExp(`^${answer}$`) }).first();
    await wrong.tap(); await page.waitForTimeout(1600); await shot(`14-explain-wrong`);
  }
  await choices.filter({ hasText: new RegExp(`^${answer}$`) }).first().tap();
  await page.waitForTimeout(600);
  if (t === 0) await shot(`15-sharing-correct`);
  await page.waitForTimeout(2600);
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
const c = await center(hold); await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.waitForTimeout(2100); await page.mouse.up();
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
await context.setOffline(true);
await page.reload(); await page.waitForTimeout(900);
const offlineOk = await page.locator('.home, .first-run').count();
console.log('offline reload rendered:', offlineOk > 0);
await shot('26-offline-reload');
await context.setOffline(false);

await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('PLAY OK');
