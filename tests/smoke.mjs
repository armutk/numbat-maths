// Mounts every skill at every level in both orientations (via a dev hook), checks for page errors, screenshots each.
// Run: node tests/smoke.mjs [baseUrl]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8124/';
const OUT = new URL('../screens/smoke/', import.meta.url).pathname;
import { mkdirSync } from 'node:fs';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const problems = [];
let count = 0;
for (const [dev, tag] of [['iPad Pro 11 landscape', 'land'], ['iPad Pro 11', 'port']]) {
  const context = await browser.newContext({ ...devices[dev], locale: 'en-AU' });
  const page = await context.newPage();
  let current = '';
  page.on('pageerror', (e) => problems.push(`${tag} ${current}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${tag} ${current}: ${m.text()}`); });
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Mia' } })));
  await page.reload();
  await page.waitForTimeout(600);
  const plan = await page.evaluate(() => window.__numbat.MODULES.map((m) => ({ id: m.id, skills: m.skills.map((s) => ({ id: s.id, max: s.maxLevel || 4 })) })));
  for (const m of plan) {
    for (const s of m.skills) {
      for (let lvl = 1; lvl <= s.max; lvl++) {
        current = `${s.id} L${lvl}`;
        await page.evaluate(({ id, lvl }) => window.__numbat.mountTask(id, lvl), { id: s.id, lvl });
        await page.waitForTimeout(500);
        // check nothing overflows the viewport
        const overflow = await page.evaluate(() => {
          const vw = innerWidth, vh = innerHeight; const bad = [];
          document.querySelectorAll('.stage *, .actions *').forEach((el) => { const r = el.getBoundingClientRect(); if (r.width && r.height && (r.right > vw + 2 || r.bottom > vh + 2 || r.left < -2 || r.top < -2)) bad.push(el.className || el.tagName); });
          return bad.slice(0, 3);
        });
        if (overflow.length) problems.push(`${tag} ${current}: overflow ${overflow.join(',')}`);
        await page.screenshot({ path: `${OUT}${s.id}-L${lvl}-${tag}.png` });
        count++;
      }
    }
  }
  await context.close();
}
await browser.close();
console.log(`mounted ${count} tasks`);
if (problems.length) { console.log('PROBLEMS:\n' + problems.join('\n')); process.exit(1); }
console.log('SMOKE OK');
