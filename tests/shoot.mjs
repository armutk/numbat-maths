// Quick visual harness: screenshots key screens on iPad emulation. Run: node tests/shoot.mjs [baseUrl]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8124/';
const OUT = new URL('../screens/', import.meta.url).pathname;

const browser = await chromium.launch();
const errors = [];
async function ctx(dev) {
  const c = await browser.newContext({ ...devices[dev], locale: 'en-AU' });
  c.on('page', (p) => { p.on('pageerror', (e) => errors.push(`${dev}: ${e.message}`)); p.on('console', (m) => { if (m.type() === 'error') errors.push(`${dev}: ${m.text()}`); }); });
  return c;
}
async function seed(page, name = 'Mia') {
  await page.goto(BASE);
  await page.evaluate((n) => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: n, created: Date.now(), sound: true } })), name);
  await page.reload();
  await page.waitForTimeout(700);
}

for (const [dev, tag] of [['iPad Pro 11 landscape', 'land'], ['iPad Pro 11', 'port']]) {
  const c = await ctx(dev);
  const page = await c.newPage();
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}00-firstrun-${tag}.png` });
  await seed(page);
  await page.screenshot({ path: `${OUT}01-home-${tag}.png` });
  await page.getByRole('button', { name: /Sharing Equally/ }).tap();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OUT}02-sharing-start-${tag}.png` });
  await c.close();
}
await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('ok');
