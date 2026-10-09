// Headless check of the live tutor wiring (text-only session, fake board): handshake, first response latency,
// client tool calls arriving and changing the (fake) board, move reporting, Ask Pip, session end.
// Run: node tests/tutor-check.mjs [--engine=chromium|webkit] [--base=http://127.0.0.1:8125/]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const pw = require(PW);
const arg = (k, d) => (process.argv.find((a) => a.startsWith(`--${k}=`)) || '').split('=')[1] || d;
const ENGINE = arg('engine', 'chromium');
const BASE = process.env.BASE || arg('base', 'http://127.0.0.1:8125/');
const browser = await pw[ENGINE].launch();
const context = await browser.newContext({ ...pw.devices['iPad Pro 11 landscape'], locale: 'en-AU' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(`${BASE}tests/tutor-dev.html?dev`);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('pip.history.v1', JSON.stringify([{ id: 'x1', date: new Date(Date.now() - 86400000).toISOString().slice(0, 10), mode: 'lesson', helpTaps: 3, summary: { what_she_did: 'Shared 8 strawberries between Mum and Dad.', what_clicked: 'Dealing one each.', what_was_tricky: 'Leftovers: she put the extra one on Mum\'s plate.', home_activity: 'Share grapes at dinner.', misconceptions: ['leftover-on-plate'] } }])); });
await page.reload();
const ev = () => page.evaluate(() => window.__events);
const until = async (pred, ms, what, from = 0) => { const t = Date.now(); while (Date.now() - t < ms) { const e = await ev(); const hit = e.slice(from).find(pred); if (hit) return hit; await page.waitForTimeout(150); } throw new Error(`timeout waiting for ${what}`); };
const count = async () => (await ev()).length;
const results = {};
const tStart = Date.now();
await page.click('#start');
const live = await until((e) => e.type === 'status' && e.data === 'live', 20000, 'connection');
results.connect_ms = live.t;
const firstPip = await until((e) => e.type === 'pip', 25000, 'first Pip line');
results.first_response_ms_after_start = firstPip.t - live.t;
results.first_line = firstPip.data;
const scene = await until((e) => e.type === 'tool:set_scene', 30000, 'set_scene tool call');
results.set_scene = scene.data;
results.set_scene_ms_after_start = scene.t - live.t;
// move items one at a time; Pip should mostly stay quiet until the tray is empty
for (let i = 0; i < 3; i++) { await page.click('#move'); await page.waitForTimeout(400); }
await page.waitForTimeout(2500);
const pipLinesMid = (await ev()).filter((e) => e.type === 'pip').length;
const t1 = await count();
await page.click('#finish');
const reaction = await until((e) => e.type === 'pip', 20000, 'Pip reaction after tray empty', t1);
results.reaction_after_empty_tray = reaction.data;
results.pip_lines_during_dragging = pipLinesMid - 1;
// Ask Pip
const t2 = await count();
const tHelp = Date.now();
await page.click('#help');
const help = await until((e) => e.type === 'pip', 20000, 'help response', t2);
results.help_response = help.data;
results.help_latency_ms = Date.now() - tHelp;
// child answers by voice (text)
const t3 = await count();
await page.click('#say');
const ans = await until((e) => e.type === 'pip', 20000, 'answer response', t3);
results.after_child_says_four = ans.data;
await page.click('#stop');
await until((e) => e.type === 'end', 10000, 'end');
const all = await ev();
results.tool_calls = all.filter((e) => e.type.startsWith('tool:')).map((e) => e.type.slice(5));
results.transcript = all.filter((e) => e.type === 'pip' || e.type === 'child').map((e) => `${e.type}: ${e.data}`);
results.history = await page.evaluate(() => JSON.parse(localStorage.getItem('pip.history.v1')));
results.errors = errors;
console.log(JSON.stringify(results, null, 1));
await browser.close();
const ok = results.connect_ms < 15000 && results.set_scene && results.help_response && errors.filter((e) => !/favicon|ERR_INTERNET/.test(e)).length === 0;
process.exit(ok ? 0 : 1);
