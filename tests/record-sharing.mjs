// Record a Sharing Equally round (offline practice, recorded voice) with real touch drags, in webkit or chromium.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require(process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright');
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) || '--engine=webkit').split('=')[1];
const BASE = process.env.BASE || 'http://127.0.0.1:8125/?dev';
const b = await pw[ENGINE].launch();
const ctx = await b.newContext({ ...pw.devices['iPad Pro 11 landscape'], locale: 'en-AU', recordVideo: { dir: 'screens/video-tmp', size: { width: 1194, height: 834 } } });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 150)); });
await p.goto(BASE); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', created: Date.now(), sound: true } })); });
await p.reload(); await p.waitForTimeout(900);
await p.touchscreen.tap(600, 400); // unlock audio
await p.evaluate(() => window.__numbat.mountTask('sharing.two', 2)); await p.waitForTimeout(1500);
const center = async (l) => { const bb = await l.boundingBox(); return { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }; };
async function touchDrag(from, to, steps = 14) {
  await p.evaluate(async ({ from, to, steps }) => {
    const el = document.elementFromPoint(from.x, from.y).closest('.item');
    const fire = (type, x, y, target) => (target || document.elementFromPoint(x, y) || document.body).dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, button: type === 'pointermove' ? -1 : 0, buttons: type === 'pointerup' ? 0 : 1 }));
    fire('pointerdown', from.x, from.y, el);
    for (let i = 1; i <= steps; i++) { const t = i / steps, e = 1 - Math.pow(1 - t, 2); fire('pointermove', from.x + (to.x - from.x) * e, from.y + (to.y - from.y) * e, el); await new Promise((r) => setTimeout(r, 28)); }
    fire('pointerup', to.x, to.y, el);
  }, { from, to, steps });
  await p.waitForTimeout(520);
}
const plates = p.locator('.plate.drop:not(:has(.label))');
const n = await p.locator('.tray .item').count(); const g = await plates.count(); const each = Math.floor(n / g);
let shots = 0;
for (let i = 0; i < n; i++) {
  const item = p.locator('.tray .item').first();
  const target = i < each * g ? plates.nth(i % g) : p.locator('.plate.drop:has(.label)');
  const a = await center(item), c = await center(target);
  if (i === 1) { // mid-drag screenshot
    const mid = p.evaluate(async ({ a, c }) => { const el = document.elementFromPoint(a.x, a.y).closest('.item'); const fire = (type, x, y) => el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 8, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, buttons: type === 'pointerup' ? 0 : 1 })); fire('pointerdown', a.x, a.y); for (let k = 1; k <= 8; k++) { fire('pointermove', a.x + (c.x - a.x) * k / 16, a.y + (c.y - a.y) * k / 16); await new Promise((r) => setTimeout(r, 30)); } await new Promise((r) => setTimeout(r, 400)); fire('pointermove', c.x, c.y); await new Promise((r) => setTimeout(r, 120)); fire('pointerup', c.x, c.y); }, { a, c });
    await p.waitForTimeout(420); await p.screenshot({ path: `screens/drag-mid-${ENGINE}.png` }); shots++;
    await mid; await p.waitForTimeout(500);
  } else await touchDrag(a, c);
}
await p.screenshot({ path: `screens/drag-done-${ENGINE}.png` });
await p.getByRole('button', { name: 'Check' }).tap({ force: true }); await p.waitForTimeout(2800);
const q = await p.locator('.prompt .speech-bubble p').innerText();
const choices = p.locator('.choices .choice');
const answer = each;
await choices.filter({ hasText: new RegExp(`^${answer}$`) }).first().tap({ force: true }); await p.waitForTimeout(3500);
await p.screenshot({ path: `screens/drag-correct-${ENGINE}.png` });
const stuck = await p.evaluate(() => [...document.querySelectorAll('.item')].filter((e) => (e.dataset.dragState && e.dataset.dragState !== 'idle') || e.classList.contains('is-lifted') || e.classList.contains('is-dragging')).length);
console.log(JSON.stringify({ engine: ENGINE, items: n, plates: g, afterCheck: q, stuck, errors: errs }));
await ctx.close(); const path = await p.video().path(); await b.close();
const fs = await import('node:fs'); fs.renameSync(path, `screens/sharing-round-${ENGINE}.webm`); fs.rmSync('screens/video-tmp', { recursive: true, force: true });
console.log('video: screens/sharing-round-' + ENGINE + '.webm');
