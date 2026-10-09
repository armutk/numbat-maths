// Board harness check. Run: node tests/board-check.mjs
// Starts a tiny node static server on :8124 for the repo (or reuses one already there), opens tests/board-dev.html on iPad emulation in chromium + webkit,
// portrait + landscape, clicks every toolbar button, drags with touch-type PointerEvents, asserts, screenshots, kills the server.
import { createRequire } from 'node:module';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'screens');
const PORT = 8124;
const BASE = `http://127.0.0.1:${PORT}/tests/board-dev.html`;
fs.mkdirSync(OUT, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, rel.endsWith('/') ? rel + 'index.html' : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('nope'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
server.on('error', () => { /* port already served by another static server: use it */ });
server.listen(PORT, '127.0.0.1');
const stopServer = () => { try { server.close(); } catch {} };
for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE); if (r.ok) break; } catch {} await new Promise((r) => setTimeout(r, 150)); }

const failures = [];
const skipped = [];
const results = [];
const check = (cond, msg, ctx) => { if (!cond) { failures.push(`[${ctx}] ${msg}`); console.log(`  FAIL ${msg}`); } else console.log(`  ok   ${msg}`); };

/** Dispatch touch-type pointer events: down on `el`, moves, up at (x, y). */
async function touchDrag(page, itemSel, toPoint, { steps = 8, holdMs = 0 } = {}) {
  return page.evaluate(async ({ itemSel, toPoint, steps, holdMs }) => {
    const el = document.querySelector(itemSel);
    if (!el) return { ok: false, why: 'no item' };
    const r = el.getBoundingClientRect();
    const sx = r.left + r.width / 2, sy = r.top + r.height / 2;
    const mk = (type, x, y) => new PointerEvent(type, { pointerId: 7, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' ? 0 : 1 });
    const fire = (type, x, y) => el.dispatchEvent(mk(type, x, y));
    const tick = () => new Promise((res) => requestAnimationFrame(() => res()));
    fire('pointerdown', sx, sy);
    if (holdMs) await new Promise((res) => setTimeout(res, holdMs));
    for (let i = 1; i <= steps; i++) {
      fire('pointermove', sx + ((toPoint.x - sx) * i) / steps, sy + ((toPoint.y - sy) * i) / steps);
      await tick();
    }
    fire('pointerup', toPoint.x, toPoint.y);
    return { ok: true };
  }, { itemSel, toPoint, steps, holdMs });
}
const centerOf = (page, sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel);
const waitEvent = (page, name, since, ms = 3000) => page.waitForFunction(({ name, since }) => window.__events.slice(since).some((e) => e.ev === name), { name, since }, { timeout: ms }).then(() => true, () => false);
const evCount = (page) => page.evaluate(() => window.__events.length);
const lastEvent = (page, name) => page.evaluate((n) => [...window.__events].reverse().find((e) => e.ev === n)?.p, name);

async function runOne(engineName, browser, orient) {
  const ctxName = `${engineName}-${orient}`;
  console.log(`\n== ${ctxName} ==`);
  const dev = orient === 'port' ? devices['iPad (gen 7)'] : devices['iPad (gen 7) landscape'];
  const context = await browser.newContext({ ...dev, locale: 'en-AU' });
  const errors = [];
  context.on('page', (p) => {
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console.error: ${m.text()}`); });
  });
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 8000 });
  await page.waitForTimeout(300);

  // 1. click every toolbar button, wait for its report line
  const labels = await page.evaluate(() => window.__actions);
  for (let i = 0; i < labels.length; i++) {
    const before = await page.evaluate((l) => document.getElementById('log').textContent.split(`> ${l}\n`).length - 1, labels[i]);
    await page.locator(`button[data-act="${i}"]`).evaluate((b) => b.click());
    try {
      await page.waitForFunction(({ l, before }) => document.getElementById('log').textContent.split(`> ${l}\n`).length - 1 > before, { l: labels[i], before }, { timeout: 12000 });
    } catch { failures.push(`[${ctxName}] toolbar "${labels[i]}" never reported`); console.log(`  FAIL toolbar "${labels[i]}" never reported`); }
    await page.waitForTimeout(120);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1);
  check(!overflow, 'no horizontal overflow after the toolbar tour', ctxName);

  // 2. drag: fresh share scene (button 0), drag one Tim Tam into Arisha's plate
  await page.locator('button[data-act="0"]').evaluate((b) => b.click());
  await page.waitForFunction(() => window.board.getState().scene === 'share' && document.querySelectorAll('.board-tray .board-item').length === 12);
  await page.waitForTimeout(1100);
  let since = await evCount(page);
  const target = await centerOf(page, '.board-group[data-group="g0"] .plate-dish');
  await touchDrag(page, '.board-tray .board-item', target);
  const gotMove = await waitEvent(page, 'move', since);
  check(gotMove, "'move' fired after touch drag into Arisha's plate", ctxName);
  const mv = await lastEvent(page, 'move');
  check(mv && mv.to === 'g0' && mv.from === 'tray' && mv.counts.groups.g0 === 1 && mv.counts.tray === 11 && mv.viaTap === false, `move payload ${JSON.stringify(mv)}`, ctxName);
  await page.waitForTimeout(600);
  const desc = await page.evaluate(() => window.board.describe());
  check(/tray 11/.test(desc) && /Arisha 1/.test(desc), `describe() mentions new counts: "${desc}"`, ctxName);
  const st = await page.evaluate(() => window.board.getState());
  check(st.tray === 11 && st.groups.find((g) => g.id === 'g0').count === 1 && st.equal === null, 'getState counts and equal=null while tray not empty', ctxName);

  // 3. reject: drop on nothing
  since = await evCount(page);
  const nowhere = await page.evaluate(() => { const r = document.querySelector('.board').getBoundingClientRect(); return { x: r.left + 4, y: r.top + 4 }; });
  await touchDrag(page, '.board-tray .board-item', nowhere);
  check(await waitEvent(page, 'reject', since), "'reject' fired when dropped on nothing", ctxName);
  await page.waitForTimeout(500);

  // 4. tap-to-place: tap an item, tap Mum's plate
  since = await evCount(page);
  const itemCentre = await centerOf(page, '.board-tray .board-item');
  await page.evaluate(({ x, y }) => {
    const el = document.querySelector('.board-tray .board-item');
    const mk = (t, cx, cy) => new PointerEvent(t, { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: cx, clientY: cy });
    el.dispatchEvent(mk('pointerdown', x, y)); el.dispatchEvent(mk('pointerup', x, y));
  }, itemCentre);
  await page.waitForTimeout(150);
  const mumPt = await centerOf(page, '.board-group[data-group="g1"] .plate-dish');
  await page.evaluate(({ x, y }) => {
    const el = document.querySelector('.board-group[data-group="g1"]');
    el.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  }, mumPt);
  const tapMove = await waitEvent(page, 'move', since);
  check(tapMove, "tap-to-place produced a 'move'", ctxName);
  if (tapMove) { const m2 = await lastEvent(page, 'move'); check(m2.to === 'g1' && m2.viaTap === true, `tap move payload ${JSON.stringify(m2)}`, ctxName); }

  // 5. demonstrate + counts + equal
  await page.evaluate(() => window.board.showCounts(true));
  await page.evaluate(() => window.board.demonstrateMove({ from: 'tray', to: 'all-groups' }));
  await page.waitForTimeout(300);
  const eq = await page.evaluate(() => window.board.getState());
  check(eq.tray === 0 && eq.equal === false || eq.equal === true, `after dealing: tray ${eq.tray}, equal=${eq.equal}`, ctxName);
  const locked = await page.evaluate(async () => { await window.board.setLocked(true); const s = window.board.getState().locked; await window.board.setLocked(false); return s; });
  check(locked === true, 'setLocked toggles state', ctxName);

  // 6. choices + keypad answer events
  since = await evCount(page);
  await page.evaluate(() => window.board.showChoices([3, 4, 5], { prompt: 'How many each?' }));
  await page.locator('.board-choices .choice', { hasText: '4' }).first().click();
  check(await waitEvent(page, 'answer', since), "'answer' event from a choice tap", ctxName);
  check((await lastEvent(page, 'answer')).value === 4, 'choice answer value is the number 4', ctxName);
  since = await evCount(page);
  await page.evaluate(() => window.board.showKeypad({ max: 120 }));
  await page.locator('.key[data-key="1"]').click(); await page.locator('.key[data-key="2"]').click(); await page.locator('.key[data-key="ok"]').click();
  check(await waitEvent(page, 'answer', since), "'answer' event from keypad", ctxName);
  check((await lastEvent(page, 'answer')).value === 12, 'keypad typed 12', ctxName);
  const keyBox = await page.locator('.key[data-key="5"]').boundingBox();
  check(keyBox && keyBox.width >= 71.5 && keyBox.height >= 71.5, `keypad keys are 72px (${keyBox?.width}x${keyBox?.height})`, ctxName);
  await page.evaluate(() => window.board.hideInput());

  // 7. setScene twice cleans up; clear() empties
  await page.evaluate(async () => { await window.board.setScene({ items: { kind: 'cookie', count: 4 }, groups: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }); await window.board.setScene({ items: { kind: 'apple', count: 6 }, groups: [{ id: 'x', name: 'X' }, { id: 'y', name: 'Y' }] }); });
  const counts2 = await page.evaluate(() => ({ boards: document.querySelectorAll('.board').length, items: document.querySelectorAll('.board-item').length, groups: document.querySelectorAll('.board-group').length }));
  check(counts2.boards === 1 && counts2.items === 6 && counts2.groups === 2, `setScene twice leaves one clean scene ${JSON.stringify(counts2)}`, ctxName);
  const dsc = await page.evaluate(() => window.board.describe());
  check(/6 apples/.test(dsc), `plural noun in describe: "${dsc}"`, ctxName);
  await page.evaluate(() => window.board.clear());
  const empty = await page.evaluate(() => ({ items: document.querySelectorAll('.board-item').length, scene: window.board.getState().scene }));
  check(empty.items === 0 && empty.scene === 'empty', 'clear() empties the board', ctxName);

  // 8. screenshots (clean page per scene)
  const shots = [['share', 'share'], ['dealt', 'share'], ['numberline', 'numberline'], ['chart', 'chart'], ['tenframe', 'tenframe'], ['keypad', 'share'], ['choices', 'numberline']];
  for (const [name, scene] of shots) {
    const p = await context.newPage();
    p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    await p.goto(`${BASE}?clean=1&scene=${scene}`);
    await p.waitForFunction(() => window.__ready === true);
    await p.waitForTimeout(1300);
    if (name === 'dealt') { await p.evaluate(() => window.board.demonstrateMove({ from: 'tray', to: 'all-groups' })); await p.evaluate(() => window.board.showCounts(true)); await p.waitForTimeout(700); }
    if (name === 'keypad') { await p.evaluate(async () => { await window.board.demonstrateMove({ from: 'tray', to: 'all-groups' }); await window.board.showKeypad({ max: 120 }); }); await p.waitForTimeout(700); }
    if (name === 'choices') { await p.evaluate(() => window.board.showChoices([11, 12, 13], { prompt: 'Which number is the marker on?' })); await p.waitForTimeout(700); }
    const ov = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(!ov, `no horizontal overflow in ${name}`, ctxName);
    await p.screenshot({ path: path.join(OUT, `board-${name}-${engineName}-${orient}.png`) });
    await p.close();
  }

  check(errors.length === 0, `no page errors${errors.length ? ': ' + errors.join(' | ') : ''}`, ctxName);
  await context.close();
}

try {
  const only = (process.argv.find((a) => a.startsWith('--engine=')) || '').slice(9);
  for (const [name, type] of [['chromium', chromium], ['webkit', webkit]].filter(([n]) => !only || n === only)) {
    let browser;
    try { browser = await type.launch(); } catch (e) {
      const msg = String(e.message || e).split('\n').find((l) => l.trim()) || 'launch failed';
      console.log(`\n== ${name}: CANNOT LAUNCH on this host (${msg.trim()}) ==`);
      if (process.env.REQUIRE_ALL) failures.push(`${name} could not launch`); else skipped.push(name);
      continue;
    }
    for (const orient of ['port', 'land']) await runOne(name, browser, orient);
    await browser.close();
  }
} catch (e) {
  failures.push(`crash: ${e.stack || e}`);
  console.log(e);
} finally {
  stopServer();
}
if (skipped.length) console.log(`\nSKIPPED engines (browser would not launch here): ${skipped.join(', ')}. Set REQUIRE_ALL=1 to make that a failure.`);
console.log(failures.length ? `\nFAILED (${failures.length}):\n${failures.join('\n')}` : '\nALL OK');
process.exit(failures.length ? 1 : 0);
