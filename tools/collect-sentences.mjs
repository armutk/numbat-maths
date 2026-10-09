// Collect every sentence the app can say from the live task generators + the fixed/template inventory (tools/voice-lines.json).
// Writes tools/sentences.json: sorted array of whole sentences (digits as written, the way the app passes them to say()).
//   node tools/collect-sentences.mjs  (needs a static server on 127.0.0.1:8124 and Playwright)
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const BASE = (process.env.BASE || 'http://127.0.0.1:8124/').replace(/\?.*$/, '') + '?dev';
const SAMPLES = Number(process.env.SAMPLES || 600);
const lines = JSON.parse(fs.readFileSync(new URL('./voice-lines.json', import.meta.url), 'utf8'));
const browser = await chromium.launch();
const page = await (await browser.newContext({ serviceWorkers: 'block' })).newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__numbat, null, { timeout: 15000 });
const tasks = await page.evaluate(async (SAMPLES) => {
  const vo = await import(new URL('./js/voice.js', document.baseURI).href);
  const app = window.__numbat; const set = new Set();
  for (const m of app.MODULES) for (const sk of m.skills) for (let lvl = 1; lvl <= (sk.maxLevel || 4); lvl++) for (let i = 0; i < SAMPLES; i++) {
    try { const t = m.makeTask(sk.id, lvl); for (const k of ['say', 'hint', 'okSay']) if (typeof t[k] === 'string') for (const s of vo.splitSentences(t[k])) set.add(s); } catch {}
  }
  return [...set];
}, SAMPLES);
await browser.close();
const out = new Set(tasks);
const split = (t) => t.replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).filter(Boolean);
for (const e of lines.inventory) if (e.kind === 'fixed') split(e.text).forEach((s) => out.add(s));
fs.writeFileSync(new URL('./sentences.tasks.json', import.meta.url), JSON.stringify([...out].sort(), null, 0));
console.log('task+fixed sentences:', out.size, 'chars:', [...out].reduce((a, s) => a + s.length, 0));
