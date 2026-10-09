// QA: audio unlock on first tap, SFX on pickup/drop/snap/correct/wrong, voice clip order for dynamic sentences, coverage of generated task sentences, speechSynthesis absent.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) || '--engine=chromium').split('=')[1];
const BASE = (process.env.BASE || 'https://armutk.github.io/numbat-maths/').replace(/\?.*$/, '') + '?dev';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const rec = (n, ok, i) => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} ${n} ${i ?? ''}`); };
const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch(ENGINE === 'chromium' ? { args: ['--autoplay-policy=document-user-activation-required'] } : {});
const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'], locale: 'en-AU', serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  window.__plays = []; window.__spy = { speak: 0 };
  const abUrl = new WeakMap(), bufUrl = new WeakMap();
  const ra = Response.prototype.arrayBuffer;
  Response.prototype.arrayBuffer = function () { const u = this.url; return ra.call(this).then((ab) => { abUrl.set(ab, u); return ab; }); };
  const AC = window.AudioContext || window.webkitAudioContext;
  const dd = AC.prototype.decodeAudioData;
  AC.prototype.decodeAudioData = function (ab, ok, bad) {
    const u = abUrl.get(ab);
    const wrap = (b) => { if (u) bufUrl.set(b, u); return b; };
    const p = dd.call(this, ab, ok ? (b) => ok(wrap(b)) : undefined, bad);
    return p && p.then ? p.then(wrap) : p;
  };
  const st = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (when) {
    const u = this.buffer && bufUrl.get(this.buffer);
    window.__plays.push({ f: u ? u.split('/assets/')[1] : '?', when: when ?? 0, now: this.context.currentTime, state: this.context.state, dur: this.buffer ? this.buffer.duration : 0, t: performance.now() });
    return st.apply(this, arguments);
  };
  if (window.speechSynthesis) { const sp = window.speechSynthesis.speak; window.speechSynthesis.speak = function () { window.__spy.speak++; return sp.apply(this, arguments); }; }
});
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); const misses = [];
page.on('console', (m) => { const t = m.text(); if (/voice:miss/.test(t)) misses.push(t); else if (m.type() === 'error' && !/Failed to load resource/.test(t)) errs.push(t); });
await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', created: Date.now(), sound: true } })));
await page.reload(); await page.waitForFunction(() => !!window.__numbat); await sleep(1500);
const ctxState = () => page.evaluate(async () => { const a = await import(new URL('./js/audio.js', document.baseURI).href); return { ctx: a.audioContext()?.state ?? 'none', unlocked: a.isUnlocked() }; });
const before = await ctxState();
const plays0 = await page.evaluate(() => window.__plays.length);
rec('before any tap: nothing has played, audio not unlocked', !before.unlocked && plays0 === 0, JSON.stringify(before) + ' plays=' + plays0);
// first tap anywhere (on the Talk-to-Pip hero would start a session; tap the empty backdrop instead)
await page.touchscreen.tap(20, 400);
await sleep(1800);
const after = await ctxState();
rec('first tap unlocks audio (ctx running)', after.unlocked && after.ctx === 'running', JSON.stringify(after));
// speechSynthesis never used
rec('speechSynthesis.speak never called', (await page.evaluate(() => window.__spy.speak)) === 0);

// SFX: drag in sharing.two with real-ish touch
await page.evaluate(() => window.__numbat.mountTask('sharing.two', 1)); await sleep(2800);
await page.evaluate(() => { window.__plays.length = 0; });
const f = { down: async (x, y) => { await page.evaluate(({ x, y }) => { window.__t = document.elementFromPoint(x, y)?.closest('.item'); window.__t?.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 })); }, { x, y }); }, move: async (x, y) => page.evaluate(({ x, y }) => window.__t?.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 1 })), { x, y }), up: async (x, y) => page.evaluate(({ x, y }) => window.__t?.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true, clientX: x, clientY: y, buttons: 0 })), { x, y }) };
const pts = () => page.evaluate(() => ({ items: [...document.querySelectorAll('.item[data-drag-state]')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }), plates: [...document.querySelectorAll('.plate')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }) }));
async function dragTo(a, b) { await f.down(a.x, a.y); for (let i = 1; i <= 8; i++) { await f.move(a.x + (b.x - a.x) * i / 8, a.y + (b.y - a.y) * i / 8); await sleep(16); } await f.up(b.x, b.y); await sleep(700); }
const names = () => page.evaluate(() => window.__plays.map((p) => p.f.replace(/^sfx\//, '')));
let P = await pts();
await dragTo(P.items[0], P.plates[0]);
let n = await names();
rec('drag to plate fires pickup + snap', n.includes('sfx/pickup.wav'.replace('sfx/', '')) || n.some((x) => /pickup/.test(x)), n.join(','));
rec('  ... and snap/drop on landing', n.some((x) => /snap|drop/.test(x)), n.join(','));
await page.evaluate(() => { window.__plays.length = 0; });
P = await pts();
await dragTo(P.items[0], { x: 40, y: 40 });   // drop in the wrong place (reject)
n = await names();
rec('drop on nothing fires reject', n.some((x) => /reject/.test(x)), n.join(','));
// button tap sound
await page.evaluate(() => { window.__plays.length = 0; });
const chk = await page.locator('.actions button').first().boundingBox();
await page.touchscreen.tap(chk.x + 5, chk.y + 5).catch(() => {});
// fill plates unevenly then press Check: wrong sound; then evenly: correct
P = await pts();
for (let i = 0; i < P.items.length; i++) { const q = await page.evaluate(() => { const it = document.querySelector('.tray .item'); if (!it) return null; const r = it.getBoundingClientRect(); const pl = document.querySelectorAll('.plate')[0].getBoundingClientRect(); return { a: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, b: { x: pl.left + pl.width / 2, y: pl.top + pl.height / 2 } }; }); if (!q) break; await dragTo(q.a, q.b); }
await page.evaluate(() => { window.__plays.length = 0; });
await page.locator('.actions button').first().evaluate((b) => b.click()); await sleep(1500);
n = await names();
rec('uneven Check fires wrong', n.some((x) => /wrong/.test(x)), n.join(','));
// move a few items so it is fair: take half from plate0 to plate1
await sleep(2500);
const itemsOn = await page.evaluate(() => [...document.querySelectorAll('.plate')].map((p) => p.querySelectorAll('.item').length));
console.log('plates', itemsOn);
for (let k = 0; k < Math.floor(itemsOn[0] / 2); k++) { const q = await page.evaluate(() => { const p0 = document.querySelectorAll('.plate')[0], p1 = document.querySelectorAll('.plate')[1]; const it = p0.querySelector('.item'); const r = it.getBoundingClientRect(), r1 = p1.getBoundingClientRect(); return { a: { x: r.left + r.width / 2, y: r.top + r.height / 2 }, b: { x: r1.left + r1.width / 2, y: r1.top + r1.height / 2 } }; }); await dragTo(q.a, q.b); }
await sleep(800);
await page.evaluate(() => { window.__plays.length = 0; });
await page.locator('.actions button').first().evaluate((b) => b.click()); await sleep(2500);
n = await names();
rec('fair Check fires correct/complete', n.some((x) => /correct|complete|celebrate/.test(x)), n.join(','));
// voice: offline clips in the right order for dynamic sentences
const man = await page.evaluate(async () => (await fetch(new URL('assets/voice/manifest.json', document.baseURI))).json());
const sentences = ["Put the socks in pairs. Each hoop needs 2 socks.",'Put the socks in pairs. Each hoop needs 2 socks.', 'Arisha has 7 cookies. How many are left over?', 'Share 12 strawberries between 3 friends.', "Great sharing, Arisha!", '14 plus 6 makes 20.', 'There are 35 stars. Count in fives.', 'Tap check.', 'Every friend has 4 grapes.'];
const plan = await page.evaluate(async (ss) => { const vo = await import(new URL('./js/voice.js', document.baseURI).href); return ss.map((s) => ({ s, r: vo.resolve(s, window.__man) })); }, sentences).catch(async () => { await page.evaluate((m) => { window.__man = m; }, man); return page.evaluate(async (ss) => { const vo = await import(new URL('./js/voice.js', document.baseURI).href); return ss.map((s) => ({ s, r: vo.resolve(s, window.__man) })); }, sentences); });
for (const { s, r } of plan) console.log('  plan:', JSON.stringify(s), r.ok ? 'OK' : 'MISSING ' + r.missing.join('|'), '->', r.items.map((i) => i.key).join(' '));
// actually play them and check order of scheduled starts equals plan order
for (const { s, r } of plan.filter((p) => p.r.ok && p.r.items.length > 1).slice(0, 4)) {
  await page.evaluate(() => { window.__plays.length = 0; });
  await page.evaluate(async (s) => { const vo = await import(new URL('./js/voice.js', document.baseURI).href); vo.say(s); }, s);
  await sleep(4500);
  const played = await page.evaluate(() => window.__plays.filter((p) => /^voice\//.test(p.f)).map((p) => ({ f: p.f, at: p.when })));
  const want = r.items.map((i) => 'voice/' + i.file);
  const orderOk = JSON.stringify(played.map((p) => p.f)) === JSON.stringify(want) && played.every((p, i) => i === 0 || p.at >= played[i - 1].at);
  rec(`voice order/timing: "${s}"`, orderOk, `${played.length}/${want.length} clips; ${played.map((p) => p.f.replace('voice/', '').replace('.mp3', '')).join(' ')}`);
}
// coverage of the app's generated sentences (silent lines = a voice gap)
const cov = await page.evaluate(async () => {
  const app = window.__numbat; const vo = await import(new URL('./js/voice.js', document.baseURI).href); vo.coverage('x');
  await new Promise((r) => setTimeout(r, 500));
  const miss = {}; let total = 0, bad = 0;
  for (const m of app.MODULES) for (const sk of m.skills) for (let lvl = 1; lvl <= (sk.maxLevel || 4); lvl++) for (let i = 0; i < 12; i++) {
    try { const t = m.makeTask(sk.id, lvl); const c = vo.coverage(t.say); total++; if (!c.ok) { bad++; (miss[`${sk.id}@${lvl}`] = miss[`${sk.id}@${lvl}`] || new Set()).add(t.say + ' => ' + c.missing.join('|')); } } catch (e) { }
  }
  return { total, bad, miss: Object.fromEntries(Object.entries(miss).map(([k, v]) => [k, [...v].slice(0, 3)])) };
});
rec(`task prompts fully covered by recorded voice (${cov.total - cov.bad}/${cov.total})`, cov.bad === 0, cov.bad ? JSON.stringify(cov.miss).slice(0, 700) : '');
rec('no page errors', errs.length === 0, errs.slice(0, 3).join('|'));
rec('speechSynthesis.speak still never called', (await page.evaluate(() => window.__spy.speak)) === 0);
console.log('voice:miss console lines seen:', misses.length, [...new Set(misses)].slice(0, 8).join(' || '));
await browser.close();
console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAIL');
