// Every new release line resolves to a whole-sentence Kokoro recording; pure counting lists may stitch number clips.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const root = new URL('../', import.meta.url).pathname;
const lines = JSON.parse(fs.readFileSync(new URL('../tools/voice-release-v6.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(new URL('../assets/voice/manifest.json', import.meta.url), 'utf8'));
if (!lines.includes('Daily goal reached!')) throw new Error('release voice inventory missing daily-goal celebration');
const skey = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();
const counting = (s) => /^[\d,\s]+$/.test(s.replace(/[.!?]+$/, ''));
for (const line of lines) {
  if (counting(line)) continue;
  const file = manifest.sentences[skey(line)];
  if (!file) throw new Error(`manifest missing whole sentence: ${line}`);
  const full = path.join(root, 'assets/voice', file);
  if (!fs.existsSync(full) || fs.statSync(full).size < 500) throw new Error(`voice file missing/short: ${file}`);
}
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(BASE);
const resolved = await page.evaluate(async (lines) => {
  const voice = await import('./js/voice.js');
  const man = await (await fetch('./assets/voice/manifest.json')).json();
  return lines.map((line) => { const r = voice.resolve(line, man); return { line, ok: r.ok, whole: r.items.length > 0 && r.items.every((i) => i.key === 'sentence'), counting: voice.isCountingList(line) }; });
}, lines);
await browser.close();
const bad = resolved.filter((r) => !r.ok || (!r.counting && !r.whole));
if (bad.length) throw new Error(`release voice resolution failures: ${JSON.stringify(bad.slice(0, 5))}`);
console.log(`PASS ${lines.length} release lines; ${lines.filter(counting).length} intentional counting lists; all others whole-sentence`);
