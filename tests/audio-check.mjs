// Headless audio check: node tests/audio-check.mjs  (serves the repo on :8124 itself)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require('/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = spawn('python3', ['-m', 'http.server', '8124', '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
await new Promise(r => setTimeout(r, 800));
let bad = 0;
try {
  for (const [name, type, opts] of [
    ['chromium', chromium, { viewport: { width: 820, height: 1180 }, hasTouch: true }],
    ['webkit-ipad', webkit, { ...devices['iPad Pro 11'] }],
  ]) {
    let b;
    try { b = await type.launch(name === 'chromium' ? { args: ['--autoplay-policy=document-user-activation-required'] } : {}); }
    catch (e) { console.log(name + ': SKIPPED, cannot launch: ' + String(e.message).split('\n').filter(l => /missing|install|lib/i.test(l)).slice(0, 3).join(' | ')); continue; }
    const ctx = await b.newContext(opts);
    const page = await ctx.newPage();
    page.on('pageerror', e => console.log(name, 'pageerror', e.message));
    await page.goto('http://127.0.0.1:8124/tests/audio-dev.html');
    const box = await page.locator('#go').boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForFunction(() => document.getElementById('log').textContent.startsWith('{'), null, { timeout: 15000 }).catch(() => {});
    const txt = await page.textContent('#log');
    console.log(name + ': ' + txt);
    try { const j = JSON.parse(txt); if (!j.unlocked || j.errors.length || Object.values(j.buffers || {}).some(v => typeof v !== 'number')) bad++; } catch { bad++; }
    await b.close();
  }
} finally { srv.kill(); }
process.exit(bad ? 1 : 0);
