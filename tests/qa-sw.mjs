// QA: service worker v4 served, fresh install, upgrade from an older real build, offline reload.
import { createRequire } from 'node:module';
import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) || '--engine=chromium').split('=')[1];
const LIVE = 'https://armutk.github.io/numbat-maths/';
const OLD = process.env.OLD_DIR; // extracted old build
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.webmanifest': 'application/manifest+json' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = [];
const rec = (name, ok, info) => { res.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name} ${info ?? ''}`); };
const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
const swInfo = (page) => page.evaluate(async () => { const r = await navigator.serviceWorker.getRegistration(); const keys = await caches.keys(); const counts = {}; for (const k of keys) counts[k] = (await (await caches.open(k)).keys()).length; return { active: r?.active?.scriptURL, state: r?.active?.state, waiting: !!r?.waiting, installing: !!r?.installing, controlled: !!navigator.serviceWorker.controller, counts }; });
async function waitFull(page, min = 560, ms = 60000) { const t = Date.now(); while (Date.now() - t < ms) { const i = await swInfo(page); if (i.counts['numbat-maths-v4'] >= min && i.controlled) return i; await sleep(500); } return swInfo(page); }

// 0. served file
const sw = await (await fetch(LIVE + 'sw.js', { cache: 'no-store' })).text();
rec('live sw.js has VERSION numbat-maths-v4', /VERSION = 'numbat-maths-v4'/.test(sw));
const nShell = (sw.match(/'\.\/[^']+'/g) || []).length;

// 1. fresh install (iPad context)
{
  const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'], locale: 'en-AU' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(LIVE + '?dev');
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 120000 });
  await page.reload();
  const i = await waitFull(page);
  console.log('fresh', JSON.stringify(i));
  rec('fresh install: v4 active, controlling, only v4 cache', /sw\.js/.test(i.active || '') && i.controlled && Object.keys(i.counts).join() === 'numbat-maths-v4', JSON.stringify(i.counts));
  rec(`fresh install: cache holds shell+sfx+voice (>= ${nShell - 5} entries of ${nShell} listed)`, i.counts['numbat-maths-v4'] >= nShell - 5, `${i.counts['numbat-maths-v4']}/${nShell}`);
  // offline reload
  await ctx.setOffline(true);
  await page.reload({ waitUntil: 'load' }).catch((e) => console.log('offline reload err', e.message));
  await page.waitForTimeout(1500);
  const txt = await page.evaluate(() => ({ title: document.title, text: document.body.innerText.slice(0, 120), screens: document.querySelectorAll('.screen').length }));
  rec('offline reload renders app (fresh install)', txt.screens > 0 && /Pip|name|Practise/i.test(txt.text), JSON.stringify(txt));
  // offline: mount a task, check voice clips fetch from cache and play
  await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', created: Date.now(), sound: true } })));
  await page.reload(); await page.waitForTimeout(1200);
  const off = await page.evaluate(async () => {
    const u = (p) => new URL(p, document.baseURI).href;
    const r = await Promise.all(['assets/voice/n7.mp3', 'assets/sfx/pickup.wav', 'js/board.js', 'css/pip.css', 'assets/voice/manifest.json'].map(async (p) => { try { const x = await fetch(u(p)); return p + ':' + x.status; } catch (e) { return p + ':ERR'; } }));
    return r;
  });
  rec('offline: assets served from cache', off.every((x) => /:200$/.test(x)), off.join(' '));
  rec('fresh install: no console/page errors', errs.filter((e) => !/Failed to load resource|ERR_INTERNET|net::/.test(e)).length === 0, errs.slice(0, 3).join(' | '));
  await ctx.close();
}

// 2. upgrade from an older real build (served by routing the live origin to the old checkout)
for (const [label, dir] of [['d5e3179 (previous deploy)', process.env.OLD_DIR_A], ['f06d23b (first deploy)', process.env.OLD_DIR_B]].filter((x) => x[1])) {
  const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'], locale: 'en-AU' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  let serveOld = true;
  await ctx.route(LIVE + '**', async (route) => {
    if (!serveOld) return route.continue();
    const u = new URL(route.request().url()); let rel = decodeURIComponent(u.pathname.replace(/^\/numbat-maths\//, '')); if (!rel || rel.endsWith('/')) rel += 'index.html';
    const f = path.join(dir, rel);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({ status: 404, body: 'nf' });
    return route.fulfill({ status: 200, contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(LIVE);
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 120000 });
  await page.reload(); await page.waitForTimeout(2000);
  const before = await swInfo(page);
  console.log(label, 'old state', JSON.stringify(before.counts));
  await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', created: Date.now(), sound: true } })));
  // now the iPad "goes online to the new build": stop serving old
  serveOld = false;
  await page.reload(); await page.waitForTimeout(500);
  // first open after deploy may still show the old shell (stale-while-revalidate); give the new SW time to install
  let after;
  const t0 = Date.now();
  while (Date.now() - t0 < 90000) { after = await swInfo(page).catch(() => null); if (after && Object.keys(after.counts).join() === 'numbat-maths-v4' && after.counts['numbat-maths-v4'] >= nShell - 5) break; await sleep(800); }
  console.log(label, 'after', JSON.stringify(after));
  rec(`upgrade from ${label}: v4 takes over, old caches removed`, !!after && Object.keys(after.counts).join() === 'numbat-maths-v4', JSON.stringify(after?.counts));
  await page.reload(); await page.waitForTimeout(2500);
  const ver = await page.evaluate(() => ({ pipcss: [...document.styleSheets].some((s) => /pip\.css/.test(s.href || '')), ask: !!document.querySelector('.ask-pip'), screens: document.querySelectorAll('.screen').length }));
  rec(`upgrade from ${label}: next open runs the new app (pip.css + Ask Pip present)`, ver.pipcss && ver.ask, JSON.stringify(ver));
  await ctx.setOffline(true);
  await page.reload().catch(() => {}); await page.waitForTimeout(1500);
  const o = await page.evaluate(() => ({ ask: !!document.querySelector('.ask-pip'), screens: document.querySelectorAll('.screen').length }));
  rec(`upgrade from ${label}: offline reload works after upgrade`, o.ask && o.screens > 0, JSON.stringify(o));
  rec(`upgrade from ${label}: no page errors`, errs.length === 0, errs.slice(0, 2).join('|'));
  await ctx.close();
}
await browser.close();
const bad = res.filter((r) => !r.ok).length;
console.log(bad ? `FAILED ${bad}` : 'ALL PASS');
process.exit(bad ? 1 : 0);
