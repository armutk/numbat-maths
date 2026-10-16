// Task timers/prompts must never interrupt demonstration narration.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);
await page.evaluate(async () => {
  (await import('./js/voice.js')).setMuted(true);
  window.__numbat.mountTask('addsub.maketen', 1);
  document.querySelector('#app>.screen:last-child .demo-help-button').click();
});
await page.locator('.demo-overlay').waitFor();
await page.waitForTimeout(800); // crosses the task's delayed initial prompt
let text = await page.locator('#app>.screen:last-child .speech-bubble p').innerText();
let narration = await page.locator('.demo-narration').innerText();
if (text !== narration) throw new Error(`task initial prompt interrupted demo: ${JSON.stringify({ text, narration })}`);
await page.waitForTimeout(14000); // crosses make-ten's task-owned idle hint
text = await page.locator('#app>.screen:last-child .speech-bubble p').innerText();
narration = await page.locator('.demo-narration').innerText();
if (text !== narration || /Fill the ten frame first/.test(text)) throw new Error(`task idle hint interrupted demo: ${JSON.stringify({ text, narration })}`);
await browser.close();
console.log('PASS task initial/idle speech cannot interrupt demonstration');
