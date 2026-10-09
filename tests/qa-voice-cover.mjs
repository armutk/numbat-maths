// QA: every sentence the app can speak must resolve to a clip sequence whose text equals the sentence text.
// Collects (a) every fixed/template sentence in tools/voice-lines.json and (b) many generated task prompts from the live modules,
// resolves each with js/voice.js and compares the spoken words (clip texts) with the sentence words (digits read as words).
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const BASE = (process.env.BASE || 'http://127.0.0.1:8124/').replace(/\?.*$/, '') + '?dev';
const SAMPLES = Number(process.env.SAMPLES || 40);
const browser = await chromium.launch();
const ctx = await browser.newContext({ serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.goto(BASE, { waitUntil: 'load' });
await page.waitForFunction(() => window.__numbat, null, { timeout: 15000 });
const lines = JSON.parse(fs.readFileSync(new URL('../tools/voice-lines.json', import.meta.url), 'utf8'));
const inv = lines.inventory.filter((e) => e.kind === 'fixed').map((e) => e.text);
// name templates: speak them with the learner's name
for (const e of lines.inventory) if (e.kind === 'template' && /^[^{]*\{name\}[^{]*$/.test(e.text)) inv.push(e.text.replace('{name}', 'Arisha'));
const out = await page.evaluate(async ({ inv, SAMPLES }) => {
  const vo = await import(new URL('./js/voice.js', document.baseURI).href);
  const man = await (await fetch(new URL('assets/voice/manifest.json', document.baseURI))).json();
  const app = window.__numbat;
  const sents = new Set(inv);
  for (const m of app.MODULES) for (const sk of m.skills) for (let lvl = 1; lvl <= (sk.maxLevel || 4); lvl++) for (let i = 0; i < SAMPLES; i++) {
    try { const t = m.makeTask(sk.id, lvl); for (const k of ['say', 'hint', 'okSay']) if (t[k] && typeof t[k] === 'string') sents.add(t[k]); } catch {}
  }
  const fileText = {};
  for (const c of Object.values(man.clips)) fileText[c.file] = c.text;
  for (const [id, f] of Object.entries(man.nouns)) { const nf = man.nounForms[id]; if (f.one) fileText[f.one] = nf.one; if (f.many) fileText[f.many] = nf.many; }
  const res = [...sents].map((s) => { const r = vo.resolve(s, man); return { s, ok: r.ok, missing: r.missing, whole: r.items.length > 0 && r.items.every((i) => i.key === 'sentence'), spoken: r.items.map((i) => fileText[i.file] ?? '?').join(' ') }; });
  return res;
}, { inv, SAMPLES });
await browser.close();
const W = 'zero one two three four five six seven eight nine ten eleven twelve'.split(' ');
const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const TEENS = 'ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen'.split(' ');
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const num = (n) => n < 10 ? W[n] : n < 20 ? TEENS[n - 10] : n < 100 ? TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '') : n === 100 ? 'one hundred' : n < 120 ? 'one hundred and ' + num(n - 100) : 'one hundred and twenty';
const words = (s) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/(\d+)s\b/g, (_, d) => num(+d).replace(/y$/, 'ie') + 's').replace(/\d+/g, (d) => num(+d)).replace(/[^a-z' ]+/g, ' ').replace(/'/g, '').split(/\s+/).filter(Boolean);
const same = (a, b) => { const x = words(a), y = words(b); return x.length === y.length && x.every((w, i) => w === y[i]); };
const truncated = [], unresolved = []; let wholeN = 0;
for (const r of out) {
  if (!r.ok) { unresolved.push(r); continue; }
  if (r.whole) { wholeN++; continue; }   // one recording of the whole sentence: nothing to stitch
  if (!same(r.s, r.spoken)) truncated.push(r);
}
console.log(`whole-sentence recordings used: ${wholeN}; stitched (fallback): ${out.length - wholeN - unresolved.length}`);
console.log(`sentences checked: ${out.length}; unresolved: ${unresolved.length}; spoken text != sentence: ${truncated.length}`);
for (const r of unresolved.slice(0, 40)) console.log('  UNRESOLVED', JSON.stringify(r.s), '=>', r.missing.join('|'));
for (const r of truncated.slice(0, 60)) console.log('  MISMATCH', JSON.stringify(r.s), '=> plays', JSON.stringify(r.spoken));
const bad = unresolved.length + truncated.length;
console.log(bad ? 'FAIL voice coverage' : 'ALL PASS voice coverage');
process.exit(bad ? 1 : 0);
