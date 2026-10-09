// Drag-engine fuzz suite: real touch against every draggable module, both engines, both orientations.
//   node tests/drag-fuzz.mjs --engine=chromium|webkit [--random=200] [--modules=a,b] [--orient=land|port] [--seed=1]
// Base URL: env BASE (default http://127.0.0.1:8124/). Playwright path: env PW_PATH (as tests/play.mjs).
// Chromium uses CDP Input.dispatchTouchEvent (real touch). WebKit dispatches PointerEvents (touch, isPrimary)
// plus Touch events via page.evaluate. WebKit cannot launch on this host: use tests/run-webkit.sh (docker).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] ?? d;
const ENGINE = arg('engine', 'chromium');
const RANDOM = Number(arg('random', 200));
const SEED = Number(arg('seed', 1));
const ONLY = arg('modules', '') ? arg('modules', '').split(',') : null;
const ORIENTS = arg('orient', '') ? [arg('orient', '')] : ['land', 'port'];
const BASE = (process.env.BASE || 'http://127.0.0.1:8124/').replace(/\/?(\?.*)?$/, '/') + '?dev';
const OUT = process.env.QA_OUT || '/tmp/claude-1000/qa/shots/';
mkdirSync(OUT, { recursive: true });
const MODE = ENGINE === 'webkit' ? 'synthetic' : 'cdp';

// module id -> { skill, level, conserve: item count must stay constant }
const MODULES = [
  { name: 'sharing.two', skill: 'sharing.two', level: 1, conserve: true },
  { name: 'sharing.groups', skill: 'sharing.groups', level: 2, conserve: true },
  { name: 'groups.pairs', skill: 'groups.pairs', level: 1, conserve: true },
  { name: 'groups.fives', skill: 'groups.fives', level: 2, conserve: true },
  { name: 'numbers.build', skill: 'numbers.build', level: 1, conserve: false },
  { name: 'numbers.order', skill: 'numbers.order', level: 1, conserve: true },
  { name: 'addsub.maketen', skill: 'addsub.maketen', level: 1, conserve: true, strictZones: false },
].filter((m) => !ONLY || ONLY.includes(m.name));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/* ---------- finger ---------- */
async function makeFingerOld(context, page) {
  if (MODE === 'cdp') {
    const cdp = await context.newCDPSession(page);
    const pts = new Map();
    const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...pts.entries()].map(([id, p]) => ({ x: p.x, y: p.y, id })) });
    return {
      down: async (x, y, id = 1) => { pts.set(id, { x, y }); await send('touchStart'); },
      move: async (x, y, id = 1) => { pts.set(id, { x, y }); await send('touchMove'); },
      up: async (id = 1) => { if (!pts.has(id)) return; const p = pts.get(id); pts.delete(id); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [...pts.entries()].map(([i, q]) => ({ x: q.x, y: q.y, id: i })) }); void p; },
      cancel: async () => { pts.clear(); await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] }); },
    };
  }
  const fire = (type, x, y, id, primary, grab) => page.evaluate(({ type, x, y, id, primary, grab }) => {
    if (grab && primary) window.__fingerEl = document.elementFromPoint(x, y)?.closest?.('.item') || document.elementFromPoint(x, y);
    const el = primary ? (window.__fingerEl || document.body) : document.body;
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: primary, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 }));
    // matching Touch event where the engine supports the constructors
    try {
      const tt = { touchstart: type === 'pointerdown', touchmove: type === 'pointermove', touchend: type === 'pointerup' }, name = Object.keys(tt).find((k) => tt[k]);
      if (name && primary) {
        const t = new Touch({ identifier: id, target: el, clientX: x, clientY: y });
        const ev = new TouchEvent(name, { touches: name === 'touchend' ? [] : [t], targetTouches: name === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true });
        el.dispatchEvent(ev);
        if (name === 'touchmove' && ev.defaultPrevented) window.__tmPrevented = (window.__tmPrevented || 0) + 1;
      }
    } catch {}
  }, { type, x, y, id, primary, grab });
  const last = new Map();
  return {
    down: async (x, y, id = 1) => { last.set(id, { x, y }); await fire('pointerdown', x, y, id, id === 1, true); },
    move: async (x, y, id = 1) => { last.set(id, { x, y }); await fire('pointermove', x, y, id, id === 1, false); },
    up: async (id = 1) => { const p = last.get(id) || { x: 0, y: 0 }; last.delete(id); await fire('pointerup', p.x, p.y, id, id === 1, false); },
    cancel: async () => { const p = last.get(1) || { x: 0, y: 0 }; last.clear(); await fire('pointercancel', p.x, p.y, 1, true, false); },
  };
}

async function glide(f, from, to, steps, dt) {
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    await f.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
    if (dt) await sleep(dt);
  }
}

/* ---------- page helpers ---------- */
const ITEMS = '.item[data-drag-state]';
async function boot(page) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      await page.goto(BASE);
      await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Mia', created: Date.now(), sound: true } })));
      await page.reload();
      await page.waitForFunction(() => !!window.__numbat, null, { timeout: 5000 });
      await page.evaluate(async () => { window.__drag = await import(new URL('./js/drag.js', document.baseURI).href); });
      if (await page.evaluate(() => !!window.__drag)) return;
    } catch (e) { console.log(`boot attempt ${attempt} failed: ${String(e.message).split('\n')[0]}`); }
    await sleep(1500);
  }
  throw new Error('page did not boot (is the server up and the app loading?)');
}
async function mount(page, m) {
  await page.evaluate(([id, l]) => window.__numbat.mountTask(id, l), [m.skill, m.level]);
  await page.waitForFunction((s) => document.querySelectorAll(s).length > 0, ITEMS, { timeout: 6000 });
  await page.waitForFunction(() => document.querySelector('.screen:last-child')?.classList.contains('is-active'), null, { timeout: 15000 });
  await page.waitForTimeout(550);
  await snapshot(page);
}
const snapshot = (page) => page.evaluate((s) => { window.__orig = [...document.querySelectorAll(s)]; return window.__orig.length; }, ITEMS);

const itemPoints = (page, onlyIdle = true) => page.evaluate(({ s, onlyIdle }) => [...document.querySelectorAll(s)].filter((e) => (!onlyIdle || e.dataset.dragState === 'idle')).map((e) => { const r = e.getBoundingClientRect(); const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; const top = document.elementFromPoint(c.x, c.y); return { ...c, ok: r.width > 4 && r.height > 4 && c.x > 4 && c.y > 4 && c.x < innerWidth - 4 && c.y < innerHeight - 4 && !!top && (e === top || e.contains(top)) }; }).filter((p) => p.ok), { s: ITEMS, onlyIdle });
const zonePoints = (page) => page.evaluate(() => [...document.querySelectorAll('[data-drop]')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, ok: r.width > 8 && r.height > 8 && r.left < innerWidth && r.top < innerHeight && r.right > 0 && r.bottom > 0 }; }).filter((z) => z.ok));
const emptyPoint = (page, rand) => page.evaluate((seed) => {
  let a = seed; const r = () => { a = (a * 16807) % 2147483647; return a / 2147483647; };
  for (let i = 0; i < 80; i++) {
    const x = 6 + r() * (innerWidth - 12), y = 6 + r() * (innerHeight - 12);
    const els = document.elementsFromPoint(x, y);
    if (!els.some((e) => e.closest('[data-drop]') || e.closest('button') || e.closest('.item'))) return { x, y };
  }
  return { x: 6, y: innerHeight - 6 };
}, Math.floor(rand() * 2147483646) + 1);
const state = (page) => page.evaluate(() => ({ stats: window.__drag.dragStats(), ghosts: document.querySelectorAll('.drag-ghost').length, lifted: document.querySelectorAll('.is-lifted,.is-dragging').length, picked: document.querySelectorAll('.is-picked').length, nonIdle: [...document.querySelectorAll('[data-drag-state]')].filter((e) => e.dataset.dragState !== 'idle').length, over: document.querySelectorAll('.is-over').length }));
const dirty = (s) => s.nonIdle || s.lifted || s.ghosts || s.picked || s.stats.active;

async function settle(page, ms = 3500) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const busy = await page.evaluate((s) => {
      const items = [...document.querySelectorAll('.item')];
      return items.some((e) => e.dataset.dragState && e.dataset.dragState !== 'idle') || items.some((e) => e.getAnimations().length || (e.style.transform && e.style.transform !== 'none')) || document.querySelectorAll('.drag-ghost').length > 0;
    }, ITEMS);
    if (!busy) return true;
    await sleep(80);
  }
  return false;
}

// Full invariant check. Returns a list of problems (empty = clean).
async function verify(page, m, rand, { skipPick = false } = {}) {
  const problems = [];
  const settled = await settle(page);
  const s = await state(page);
  if (!settled) problems.push('did not settle');
  if (s.nonIdle) problems.push(`${s.nonIdle} item(s) not idle`);
  if (s.lifted) problems.push(`${s.lifted} lifted/dragging class left`);
  if (s.ghosts) problems.push(`${s.ghosts} ghost left in drag layer`);
  if (s.picked && !skipPick) problems.push(`${s.picked} picked left`);
  if (s.stats.active) problems.push(`stats.active=${s.stats.active}`);
  if (s.over) problems.push(`${s.over} .is-over left`);
  const bad = await page.evaluate(() => {
    const out = [];
    for (const e of document.querySelectorAll('.item')) {
      const inl = e.style.transform;
      const cs = getComputedStyle(e).transform;
      const identity = cs === 'none' || /^matrix\(1, 0, 0, 1, (-?0(\.\d+)?|-?\d(\.\d+)?e-\d+), (-?0(\.\d+)?|-?\d(\.\d+)?e-\d+)\)$/.test(cs);
      if ((inl && inl !== 'none') || !identity) out.push(`${e.className.slice(0, 30)} inline="${inl}" computed=${cs}`);
      if (e.style.opacity === '0') out.push('opacity:0 left on item');
      if (e.style.pointerEvents === 'none' && e.dataset.dragState) out.push('pointer-events:none left on item');
    }
    return out.slice(0, 3);
  });
  problems.push(...bad);
  // conservation
  const cons = await page.evaluate(({ s, conserve, strict }) => {
    const orig = window.__orig || [];
    const live = orig.filter((e) => e.isConnected);
    if (live.length === 0) { window.__orig = [...document.querySelectorAll(s)]; return { rebased: true }; }
    const all = [...document.querySelectorAll(s)];
    const missing = orig.length - live.length;
    const outside = conserve && strict ? all.filter((e) => !e.closest('[data-drop]') || e.closest('#drag-layer')).length : 0;
    return { missing: conserve ? missing : 0, outside, total: all.length, orig: orig.length };
  }, { s: ITEMS, conserve: m.conserve, strict: m.strictZones !== false });
  if (cons.missing) problems.push(`item count changed: ${cons.orig} -> ${cons.total}`);
  if (cons.outside) problems.push(`${cons.outside} item(s) outside tray/targets`);
  return problems;
}

const phaseMovedOn = (page) => page.evaluate(() => !!document.querySelector('.as-full, .sentence b, .choices .choice, .tray.is-empty:not(.drop)'));
// Still draggable: some item can be moved into some zone (counts per zone change). Tries several pairs.
async function draggableCheck(page, f, rand) {
  const snap = () => page.evaluate(() => [...document.querySelectorAll('.item[data-drag-state]')].map((e) => { let i = 0, p = e.parentElement; const z = e.closest('[data-drop]'); return (z?.dataset.drop || '?') + ':' + (e.parentElement === z ? 'direct' : 'nested') + ':' + (e.parentElement?.className || '').slice(0, 12); }).sort().join('|'));
  if (await phaseMovedOn(page)) return true; // phase moved on (dragging is legitimately over)
  const before = await snap();
  for (let round = 0; round < 2; round++) {            // round 2: a module may be busy speaking feedback, so wait and retry
    if (round) await sleep(4000);
    const items = await itemPoints(page);
    const zones = await page.evaluate(() => [...document.querySelectorAll('[data-drop]')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, empty: !e.querySelector('.item'), ok: r.width > 8 && r.height > 8 && r.left < innerWidth && r.top < innerHeight && r.right > 0 && r.bottom > 0 }; }).filter((z) => z.ok));
    if (!items.length || !zones.length) return false;
    zones.sort((a, b) => (b.empty - a.empty) || (rand() - 0.5));   // empty zones first
    const tries = [];
    for (const it of items.slice().sort(() => rand() - 0.5).slice(0, 3)) for (const z of zones.slice(0, 12)) if (Math.hypot(z.x - it.x, z.y - it.y) > 70) tries.push([it, z]);
    for (const [it, z] of tries.slice(0, 24)) {
      await f.down(it.x, it.y); await sleep(20);
      await glide(f, it, z, 10, 10);
      await f.up();
      await settle(page, 2500);
      if ((await snap()) !== before) return true;
      if (!(await page.evaluate((s) => document.querySelectorAll(s).length, ITEMS))) return true; // module advanced to the next question
    }
    if (await phaseMovedOn(page)) return true;
  }
  return false;
}


const randOf = (rand, arr) => arr[Math.floor(rand() * arr.length)];
// a zone whose centre is at least 70 px from the item, so the gesture is a real drag and not an accidental tap
const farZone = (rand, zones, it) => { const far = zones.filter((z) => Math.hypot(z.x - it.x, z.y - it.y) > 70); return randOf(rand, far.length ? far : zones); };

async function dragOne(page, f, rand, { steps = 12, dt = 12, to = 'zone' } = {}) {
  const items = await itemPoints(page);
  if (!items.length) return false;
  const it = randOf(rand, items);
  let dest;
  if (to === 'zone') { const z = await zonePoints(page); const zz = farZone(rand, z, it); dest = { x: zz.x + (rand() - 0.5) * zz.w * 0.3, y: zz.y + (rand() - 0.5) * zz.h * 0.3 }; }
  else if (to === 'off') dest = randOf(rand, [{ x: -60, y: -60 }, { x: 99999 > 0 ? 3000 : 0, y: 400 }, { x: 400, y: 3000 }]);
  else dest = await emptyPoint(page, rand);
  await f.down(it.x, it.y);
  await sleep(15);
  await glide(f, it, dest, steps, dt);
  await f.up();
  return true;
}


/* ---------- multi-touch aware finger (QA) ---------- */
async function makeFinger2(context, page) {
  if (MODE === 'cdp') return makeFingerOld(context, page);
  // synthetic: each pointer id is bound to the element under it at pointerdown (pointer-capture semantics)
  const last = new Map();
  const fire = (type, x, y, id, grab) => page.evaluate(({ type, x, y, id, grab }) => {
    window.__tgt = window.__tgt || {};
    if (grab) { const u = document.elementFromPoint(x, y); window.__tgt[id] = u?.closest?.('.item') || u || document.body; }
    const el = window.__tgt[id] || document.body;
    const primary = id === 1;
    el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: primary, bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 }));
    if (type === 'pointerup' || type === 'pointercancel') delete window.__tgt[id];
  }, { type, x, y, id, grab });
  return {
    down: async (x, y, id = 1) => { last.set(id, { x, y }); await fire('pointerdown', x, y, id, true); },
    move: async (x, y, id = 1) => { last.set(id, { x, y }); await fire('pointermove', x, y, id, false); },
    up: async (id = 1) => { const p = last.get(id) || { x: 0, y: 0 }; last.delete(id); await fire('pointerup', p.x, p.y, id, false); },
    cancel: async () => { const p = last.get(1) || { x: 0, y: 0 }; last.clear(); await fire('pointercancel', p.x, p.y, 1, false); },
  };
}

const SC = {
  // 40 very fast taps on the same item, then a drag
  async rapidTaps(page, f, m, rand) {
    const items = await itemPoints(page); const it = randOf(rand, items);
    for (let i = 0; i < 40; i++) { await f.down(it.x, it.y); await sleep(i % 3 ? 5 : 0); await f.up(); }
    for (let i = 0; i < 10; i++) { await f.down(it.x, it.y); await f.up(); await f.down(it.x + 2, it.y + 1); await f.up(); }
    const z = farZone(rand, await zonePoints(page), it);
    await f.down(it.x, it.y); await glide(f, it, z, 8, 12);
    const ghost = await page.evaluate(() => document.querySelectorAll('.drag-ghost').length);
    if (ghost !== 1) throw new Error(`after rapid taps, drag produced ${ghost} ghosts (expected 1)`);
    await f.up(); await sleep(400);
  },
  // two fingers on two different items at once, release in both orders
  async twoFingers(page, f, m, rand) {
    for (const order of [[1, 2], [2, 1]]) {
      const items = await itemPoints(page); if (items.length < 2) return;
      const a = items[0], b = items[items.length - 1];
      const zs = await zonePoints(page); const za = farZone(rand, zs, a), zb = farZone(rand, zs, b);
      await f.down(a.x, a.y, 1); await f.down(b.x, b.y, 2);
      for (let i = 1; i <= 10; i++) { await f.move(a.x + (za.x - a.x) * i / 10, a.y + (za.y - a.y) * i / 10, 1); await f.move(b.x + (zb.x - b.x) * i / 10, b.y + (zb.y - b.y) * i / 10, 2); await sleep(10); }
      await f.up(order[0]); await sleep(30); await f.up(order[1]); await sleep(700);
    }
    // and a pinch-ish: both fingers on the SAME item
    const items = await itemPoints(page); if (items.length) { const a = items[0]; await f.down(a.x, a.y, 1); await f.down(a.x + 10, a.y + 6, 2); await sleep(40); await f.move(a.x + 40, a.y + 40, 1); await f.up(2); await sleep(30); await f.up(1); await sleep(600); }
  },
  // drag while recorded voice / SFX are playing and Pip ducking toggles
  async dragWhileAudio(page, f, m, rand) {
    await page.evaluate(async () => {
      const au = await import(new URL('./js/audio.js', document.baseURI).href);
      const vo = await import(new URL('./js/voice.js', document.baseURI).href);
      au.unlockAudio(); await au.preloadSfx();
      window.__vo = vo; window.__au = au;
      vo.say('Put the socks in pairs. Each hoop needs 2 socks. How many socks altogether?', { interrupt: true });
      window.__spk = setInterval(() => { vo.say('Every hoop has 2. Lovely pairs!', { interrupt: false }); au.duck(true); setTimeout(() => au.duck(false), 300); au.sfx.pop(); }, 250);
    });
    for (let i = 0; i < 6; i++) { await dragOne(page, f, rand, { steps: 8, dt: 15 }); await sleep(200); }
    await page.evaluate(() => { clearInterval(window.__spk); window.__vo.stop(); });
  },
  // after Check (right or wrong), grab things immediately during the feedback/celebration
  async dragDuringCheck(page, f, m, rand) {
    const clickCheck = () => page.evaluate(() => { const b = document.querySelector('.actions button:not([disabled])'); if (b) { b.click(); return true; } return false; });
    for (const delay of [0, 60, 250, 700, 1500]) {
      // fill (roughly even, alternate zones) then Check, then drag at `delay`
      const items = await itemPoints(page); if (!items.length) break;
      const zs = (await page.evaluate(() => [...document.querySelectorAll('[data-drop]:not(.tray)')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; })));
      for (let i = 0; i < items.length; i++) {
        const cur = await itemPoints(page); const it = cur.find((p) => true); if (!it) break;
        const z = zs[i % zs.length]; await f.down(it.x, it.y); await glide(f, it, z, 5, 6); await f.up(); await sleep(120);
      }
      await settle(page, 2500);
      const clicked = await clickCheck();
      await sleep(delay);
      for (let k = 0; k < 3; k++) { await dragOne(page, f, rand, { steps: 6, dt: 8 }).catch(() => {}); await sleep(30); }
      await sleep(1200);
      const s = await state(page);
      if (s.nonIdle || s.lifted || s.ghosts) throw new Error(`delay ${delay} (check ${clicked}): stuck state ${JSON.stringify(s)}`);
      if (!(await page.evaluate((sel) => document.querySelectorAll(sel).length, ITEMS))) break; // advanced
    }
  },
  // a flurry of random gestures including cancel mid-flight, over many iterations at once with two fingers
  async chaos(page, f, m, rand) {
    for (let i = 0; i < 120; i++) {
      const items = await itemPoints(page); if (!items.length) break;
      const a = randOf(rand, items), b = randOf(rand, items);
      const zs = await zonePoints(page); const za = randOf(rand, zs), zb = randOf(rand, zs);
      const two = rand() < 0.4;
      await f.down(a.x, a.y, 1); if (two) await f.down(b.x, b.y, 2);
      const n = 2 + Math.floor(rand() * 6);
      for (let s = 1; s <= n; s++) { await f.move(a.x + (za.x - a.x) * s / n, a.y + (za.y - a.y) * s / n, 1); if (two) await f.move(b.x + (zb.x - b.x) * s / n, b.y + (zb.y - b.y) * s / n, 2); }
      const r = rand();
      if (r < 0.15) await f.cancel(); else if (two && r < 0.5) { await f.up(2); await f.up(1); } else { await f.up(1); if (two) await f.up(2); }
      await sleep(Math.floor(rand() * 60));
    }
  },
};

const table2 = []; let fails = 0;
const MODS2 = [{ name: 'sharing.two', skill: 'sharing.two', level: 1, conserve: true }, { name: 'groups.pairs', skill: 'groups.pairs', level: 1, conserve: true }, { name: 'sharing.groups', skill: 'sharing.groups', level: 2, conserve: true }, { name: 'groups.pairs.L4', skill: 'groups.pairs', level: 4, conserve: true }];
async function runCombo2(browser, orient) {
  const devName = orient === 'land' ? 'iPad (gen 7) landscape' : 'iPad (gen 7)';
  const context = await browser.newContext({ ...devices[devName], locale: 'en-AU', serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await boot(page);
  const f = await makeFinger2(context, page);
  for (const m of MODS2.filter((x) => !ONLY || ONLY.includes(x.name))) {
    const rand = rng(SEED * 31 + m.name.length + (orient === 'land' ? 1 : 2));
    for (const [name, fn] of Object.entries(SC)) {
      let problems = [];
      errors.length = 0;
      try {
        await mount(page, m);
        await page.evaluate(() => { window.__drag.resetAllDrags(); });
        await fn(page, f, m, rand);
        problems = await verify(page, m, rand, { skipPick: true });
        if (!problems.length && !(await draggableCheck(page, f, rand))) problems.push('items no longer draggable into any target');
        if (!problems.length) problems.push(...(await verify(page, m, rand, { skipPick: true })));
        if (errors.length) problems.push(`page error: ${errors[0]}`);
      } catch (e) { problems.push(`exception: ${String(e.message).split('\n')[0]}`); }
      const ok = !problems.length;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${ENGINE}/${orient}/${m.name}/${name}${ok ? '' : ': ' + problems.join('; ')}`);
      if (!ok) { fails++; mkdirSync(OUT, { recursive: true }); await page.screenshot({ path: `${OUT}extra-fail-${ENGINE}-${orient}-${m.name}-${name}.png` }).catch(() => {}); await page.evaluate(() => window.__drag.resetAllDrags()).catch(() => {}); await f.cancel().catch(() => {}); }
    }
  }
  await context.close();
}
const browser2 = await (ENGINE === 'webkit' ? webkit : chromium).launch();
await Promise.all(ORIENTS.map((o) => runCombo2(browser2, o)));
await browser2.close();
console.log(fails ? `FAILED ${fails}` : 'ALL PASS');
process.exit(fails ? 1 : 0);
