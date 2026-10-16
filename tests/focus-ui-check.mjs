// Parent weekly-focus controls: visible status, max-three guard and clear.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);
await page.evaluate(async () => {
  const { parentView } = await import('./js/parent.js');
  const view = await parentView({ show: window.__numbat.show, home: () => document.createElement('div') });
  window.__numbat.show(view);
});
await page.getByText('School focus for the next 7 days', { exact: true }).waitFor();
for (const name of ['Fair sharing', 'Tens and ones', 'Add and subtract']) await page.getByRole('button', { name }).click();
const status = await page.locator('.focus-status').innerText();
if (!/Current focus: Fair sharing, Tens and ones, Add and subtract · until /.test(status)) throw new Error('current focus/expiry missing: ' + status);
await page.getByRole('button', { name: 'Patterns and shapes' }).click();
const selected = await page.locator('.focus-choice[aria-pressed="true"]').count();
if (selected !== 3) throw new Error(`max-three guard failed: ${selected}`);
await page.getByRole('button', { name: 'Clear focus' }).click();
if (!/No school focus chosen/.test(await page.locator('.focus-status').innerText())) throw new Error('clear focus status failed');
if (await page.evaluate(() => window.__numbat.store.getWeeklyFocus())) throw new Error('clear focus did not persist');
await browser.close();
console.log('PASS parent focus controls, expiry display, max-three guard and clear');
