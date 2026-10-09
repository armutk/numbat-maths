// QA: layout/overflow/Ask Pip overlap on iPad 10th gen + iPad Pro 11 (+ a short Safari-chrome variant), both orientations, every screen.
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, webkit, devices } = require(PW);
const ENGINE = (process.argv.find((a) => a.startsWith('--engine=')) || '--engine=chromium').split('=')[1];
const BASE = (process.env.BASE || 'https://armutk.github.io/numbat-maths/').replace(/\?.*$/, '') + '?dev';
const OUT = process.env.QA_OUT || '/tmp/claude-1000/qa/shots/'; fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = devices['iPad (gen 7)'];
const VPS = [
  ['ipad10-port', { width: 820, height: 1180 }], ['ipad10-land', { width: 1180, height: 820 }],
  ['ipadpro11-port', { width: 834, height: 1194 }], ['ipadpro11-land', { width: 1194, height: 834 }],
  ['ipad10-land-safari', { width: 1180, height: 700 }], ['ipad10-port-safari', { width: 820, height: 1060 }],
];
const SCREENS = [
  ['firstrun', null], ['home', 'home'],
  ['sharing.two', ['sharing.two', 1]], ['sharing.groups', ['sharing.groups', 3]], ['groups.pairs', ['groups.pairs', 1]], ['groups.pairs4', ['groups.pairs', 4]], ['groups.fives', ['groups.fives', 2]], ['numbers.build', ['numbers.build', 2]], ['numbers.order', ['numbers.order', 1]], ['addsub.maketen', ['addsub.maketen', 2]],
  ['stickers', 'stickers'], ['pip-fallback', 'pip-offline'],
];
const problems = [];
const browser = await (ENGINE === 'webkit' ? webkit : chromium).launch();
for (const [vpName, vp] of VPS) {
  const ctx = await browser.newContext({ ...base, viewport: vp, locale: 'en-AU', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errs.push(m.text()); });
  await page.goto(BASE);
  for (const [name, how] of SCREENS) {
    errs.length = 0;
    if (name === 'firstrun') { await page.evaluate(() => localStorage.clear()); await page.reload(); await sleep(900); }
    else if (name === 'home') { await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', created: Date.now(), sound: true } }))); await page.reload(); await page.waitForFunction(() => !!window.__numbat); await sleep(1200); }
    else if (Array.isArray(how)) { await page.evaluate(([s, l]) => window.__numbat.mountTask(s, l), how); await sleep(2600); }
    else if (how === 'stickers') { await page.evaluate(() => window.__numbat.home()); await sleep(600); await page.evaluate(() => document.querySelector('.pill:nth-child(2)')?.click()); await sleep(800); }
    else if (how === 'pip-offline') { await page.evaluate(() => window.__numbat.home()); await sleep(500); await ctx.setOffline(true); await page.evaluate(() => window.__numbat.startPip('lesson')); await sleep(1500); await ctx.setOffline(false); }
    const r = await page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const ask = document.querySelector('.ask-pip');
      const rect = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
      const vis = (e) => { const s = getComputedStyle(e); const r = e.getBoundingClientRect(); return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 2 && r.height > 2 && !e.closest('[hidden]') && !e.closest('.screen.is-leaving') && !e.closest('#drag-layer') && s.opacity !== '0'; };
      const out = { vw, vh, ask: null, overlaps: [], offscreen: [], hscroll: document.scrollingElement.scrollWidth > vw + 1 || document.scrollingElement.scrollHeight > vh + 1 };
      if (ask && vis(ask)) {
        const a = rect(ask); out.ask = { ...a, inView: a.l >= 0 && a.t >= 0 && a.r <= vw && a.b <= vh };
        const sel = '.item, [data-drop], button:not(.ask-pip), .choice, .btn, .icon-btn, .pill, .cellnum, input, .g-badge, .speech-bubble, .keypad button';
        for (const e of document.querySelectorAll(sel)) {
          if (e === ask || ask.contains(e) || !vis(e)) continue;
          const b = rect(e);
          const ix = Math.min(a.r, b.r) - Math.max(a.l, b.l), iy = Math.min(a.b, b.b) - Math.max(a.t, b.t);
          if (ix > 4 && iy > 4) out.overlaps.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')}"${(e.textContent || '').trim().slice(0, 14)}" ${Math.round(ix)}x${Math.round(iy)}`);
        }
      }
      for (const e of document.querySelectorAll('.screen:not(.is-leaving) .item, .screen:not(.is-leaving) button, .screen:not(.is-leaving) [data-drop], .screen:not(.is-leaving) h1, .screen:not(.is-leaving) .speech-bubble')) {
        if (!vis(e) || e.closest('[data-scroll]')) continue;
        const b = rect(e);
        if (b.l < -2 || b.t < -2 || b.r > vw + 2 || b.b > vh + 2) out.offscreen.push(`${e.tagName.toLowerCase()}.${String(e.className).split(' ').slice(0, 2).join('.')}"${(e.textContent || '').trim().slice(0, 12)}" [${Math.round(b.l)},${Math.round(b.t)},${Math.round(b.r)},${Math.round(b.b)}]`);
      }
      return out;
    });
    const tag = `${ENGINE}/${vpName}/${name}`;
    const issues = [];
    const askExpected = name !== 'firstrun';
    if (askExpected && !r.ask) issues.push('Ask Pip NOT visible');
    if (r.ask && !r.ask.inView) issues.push('Ask Pip partly off screen');
    if (r.overlaps.length) issues.push('Ask Pip overlaps: ' + r.overlaps.slice(0, 4).join('; '));
    if (r.offscreen.length) issues.push('off-screen: ' + r.offscreen.slice(0, 4).join('; '));
    if (r.hscroll) issues.push('page scrolls (overflow)');
    if (errs.length) issues.push('errors: ' + errs.slice(0, 2).join('|'));
    console.log(`${issues.length ? 'ISSUE' : 'ok   '} ${tag} ask=${r.ask ? `${Math.round(r.ask.l)},${Math.round(r.ask.t)} ${Math.round(r.ask.w)}x${Math.round(r.ask.h)}` : 'none'} ${issues.join(' || ')}`);
    if (issues.length) problems.push(tag);
    if (process.env.SHOTS_ALL || issues.length || /ipad10-(port|land)$/.test(vpName)) await page.screenshot({ path: `${OUT}layout-${ENGINE}-${vpName}-${name}.png` });
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? `ISSUES in ${problems.length} combos` : 'ALL CLEAN');
