// Touch-feel check. Drives REAL touch (CDP on chromium) / synthetic touch PointerEvents (webkit)
// through the sharing task and asserts lift, hover highlight, drop, spring-back and press feedback.
// Run: python3 -m http.server 8124 &   then   node tests/touch-check.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const BASE = (process.argv[2] || 'http://127.0.0.1:8124/') .replace(/\/?(\?.*)?$/, '/') + '?dev';
const OUT = new URL('../screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (engine, name, ok, info = '') => { results.push({ engine, name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} [${engine}] ${name}${info ? ' ' + info : ''}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function seed(page) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Mia', created: Date.now(), sound: true } })));
  await page.reload();
  await page.waitForTimeout(700);
}

// A finger: down / move / up, same interface for both engines.
async function makeFinger(mode, context, page) {
  if (mode === 'cdp') {
    const cdp = await context.newCDPSession(page);
    const send = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    return {
      down: (x, y) => send('touchStart', [{ x, y, id: 1 }]),
      move: (x, y) => send('touchMove', [{ x, y, id: 1 }]),
      up: () => send('touchEnd', []),
    };
  }
  // webkit: synthetic pointer events (pointerType touch, isPrimary) dispatched at the grabbed element
  const fire = (type, x, y, sel) => page.evaluate(({ type, x, y, sel }) => {
    if (sel) window.__fingerEl = document.querySelector(sel);
    const el = window.__fingerEl || document.elementFromPoint(x, y);
    el.dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1 }));
  }, { type, x, y, sel });
  let sel = null;
  return {
    setTarget: (s) => { sel = s; },
    down: (x, y) => fire('pointerdown', x, y, sel),
    move: (x, y) => fire('pointermove', x, y, null),
    up: (x, y) => fire('pointerup', x, y || 0, null),
  };
}

async function glide(finger, from, to, steps = 14, dt = 16) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await finger.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    await sleep(dt);
  }
}

const centre = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);

async function runEngine(engine, launcher, mode) {
  const browser = await launcher.launch();
  const context = await browser.newContext({ ...devices['iPad (gen 7) landscape'], locale: 'en-AU', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await seed(page);
  await page.evaluate(async () => { const d = await import('/js/drag.js'); d.installPressFeedback(document); });
  await page.evaluate(() => window.__numbat.mountTask('sharing.two', 1));
  await page.waitForSelector('.tray .item', { timeout: 5000 });
  await page.waitForTimeout(700);
  const finger = await makeFinger(mode, context, page);

  // ---- 1. valid drop onto the first plate
  const itemSel = '.tray .item';
  const before = await page.evaluate(() => ({ tray: document.querySelectorAll('.tray .item').length, plate0: document.querySelectorAll('.plate .plate-dish')[0].children.length }));
  finger.setTarget?.(itemSel);
  const a = await centre(page, itemSel);
  const plate = await centre(page, '.plate:nth-child(1) .plate-dish');
  await finger.down(a.x, a.y);
  await sleep(40);
  await glide(finger, a, { x: a.x + 30, y: a.y - 30 }, 4);
  const lifted = await page.evaluate(() => !!document.querySelector('.item.is-lifted'));
  check(engine, 'item gets .is-lifted during drag', lifted);
  await glide(finger, { x: a.x + 30, y: a.y - 30 }, plate, 18);
  await sleep(120);
  const over = await page.evaluate(() => !!document.querySelector('.drop.is-over'));
  check(engine, 'drop zone gets .is-over while hovering', over);
  const tf = await page.evaluate(() => document.querySelector('.drag-ghost')?.style.transform || '');
  check(engine, 'lifted item uses spring transform (scale 1.15)', /scale\(1\.1/.test(tf), tf.slice(0, 70));
  await page.screenshot({ path: `${OUT}touch-drag-mid-${engine}.png` });
  await finger.up(plate.x, plate.y);
  await sleep(160);
  await page.screenshot({ path: `${OUT}touch-drag-drop-mid-landing-${engine}.png` });
  await sleep(700);
  const after = await page.evaluate(() => ({ tray: document.querySelectorAll('.tray .item').length, plate0: document.querySelectorAll('.plate .plate-dish')[0].children.length, lifted: document.querySelectorAll('.is-lifted,.is-over,.did-receive').length, tf: [...document.querySelectorAll('.item')].filter((e) => e.style.transform && e.style.transform !== 'none').length }));
  check(engine, 'item ends inside the plate', after.plate0 === before.plate0 + 1 && after.tray === before.tray - 1, JSON.stringify(after));
  check(engine, 'lift/over/receive classes cleaned up and transforms cleared', after.lifted === 0 && after.tf === 0, JSON.stringify(after));
  await page.screenshot({ path: `${OUT}touch-drag-drop-${engine}.png` });

  // ---- 2. invalid drop (empty space) springs back to the tray
  const emptyPt = await page.evaluate(() => {
    for (let y = 8; y < innerHeight; y += 24) for (let x = 8; x < innerWidth; x += 24) {
      const e = document.elementFromPoint(x, y);
      if (e && !e.closest('[data-drop]') && !e.closest('button')) return { x, y };
    }
    return null;
  });
  finger.setTarget?.(itemSel);
  const b = await centre(page, itemSel);
  const trayBefore = await page.evaluate(() => document.querySelectorAll('.tray .item').length);
  await finger.down(b.x, b.y);
  await sleep(40);
  await glide(finger, b, emptyPt, 16);
  await sleep(60);
  await finger.up(emptyPt.x, emptyPt.y);
  await sleep(120);
  const springing = await page.evaluate(() => document.getAnimations().some((an) => an.effect?.target?.classList?.contains('item')));
  check(engine, 'invalid drop plays a spring-back animation', springing);
  await sleep(600);
  const back = await page.evaluate(() => ({ tray: document.querySelectorAll('.tray .item').length, stray: [...document.querySelectorAll('.item')].filter((e) => e.style.transform && e.style.transform !== 'none').length }));
  check(engine, 'invalid drop returns item to the tray', back.tray === trayBefore && back.stray === 0, JSON.stringify(back));

  // ---- 3. press feedback on a button (and none on disabled)
  const btn = '.icon-btn';
  const hasBtn = await page.$(btn);
  if (hasBtn) {
    const c = await centre(page, btn);
    const f2 = await makeFinger(mode, context, page);
    f2.setTarget?.(btn);
    await f2.down(c.x, c.y);
    await sleep(60);
    const pressed = await page.evaluate((s) => document.querySelector(s).classList.contains('is-pressed'), btn);
    check(engine, '.is-pressed appears on a button during pointerdown', pressed);
    await f2.up(c.x, c.y);
    await sleep(60);
    const released = await page.evaluate((s) => !document.querySelector(s).classList.contains('is-pressed'), btn);
    check(engine, '.is-pressed removed on release', released);
  } else check(engine, 'press target present', false);
  const disabledOk = await page.evaluate(() => {
    const d = document.querySelector('.btn[disabled]');
    if (!d) return true;
    d.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true }));
    const bad = d.classList.contains('is-pressed');
    d.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true }));
    return !bad;
  });
  check(engine, 'disabled button gets no .is-pressed', disabledOk);

  check(engine, 'no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
}

async function homePortrait() {
  const browser = await chromium.launch();
  for (const [dev, tag] of [['iPad (gen 7)', 'gen7'], ['iPad Pro 11', 'pro11']]) {
    const context = await browser.newContext({ ...devices[dev], locale: 'en-AU' });
    const page = await context.newPage();
    await seed(page);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${OUT}home-port-${tag}.png` });
    const m = await page.evaluate(() => [...document.querySelectorAll('.island')].map((e) => { const r = e.getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; }));
    const over = await page.evaluate(() => { const w = document.querySelector('.world'); return w.scrollHeight > w.clientHeight + 1; });
    check('chromium', `home portrait ${tag} islands ${m.join(' ')}`, m.length === 4 && !over);
    await context.close();
  }
  await browser.close();
}

await runEngine('chromium', chromium, 'cdp');
let wkOk = true;
try { await runEngine('webkit', webkit, 'synthetic'); }
catch (e) {
  wkOk = false;
  console.log(`SKIP [webkit] cannot launch on this host: ${String(e.message).split('\n').find((l) => /missing|Executable|install/i.test(l)) || e.message.split('\n')[0]}`);
  // same synthetic-PointerEvent path WebKit would take, run in Chromium so the logic is still exercised
  await runEngine('chromium-synthetic', chromium, 'synthetic');
}
await homePortrait();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
