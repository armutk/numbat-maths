// Review screenshots for weekly focus, chapter picker and worked demonstrations.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const OUT = process.env.QA_OUT || '/tmp/numbat-next-release-evidence';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);
await page.evaluate(async () => {
  (await import('./js/voice.js')).setMuted(true);
  const { parentView } = await import('./js/parent.js');
  window.__numbat.show(await parentView({ show: window.__numbat.show, home: () => document.createElement('div') }));
});
await page.getByRole('button', { name: 'Fair sharing' }).click();
await page.getByRole('button', { name: 'Tens and ones' }).click();
await page.locator('.focus-card').scrollIntoViewIfNeeded(); await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/01-parent-weekly-focus.png`, fullPage: true });

await page.evaluate(() => window.__numbat.showAdventurePicker());
await page.getByText('Choose a story adventure', { exact: true }).waitFor(); await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-chapter-picker.png`, fullPage: true });

await page.evaluate(() => window.__numbat.mountTask('addsub.maketen', 2));
await page.getByRole('button', { name: 'Show me how' }).click();
await page.locator('.demo-overlay').waitFor(); await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-demo-step.png`, fullPage: true });
while (await page.getByRole('button', { name: 'Next step' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Next step' }).click();
await page.getByRole('button', { name: 'Try it' }).waitFor(); await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/04-demo-try-it.png`, fullPage: true });

await browser.close();
console.log(`PASS next-release screenshots written to ${OUT}`);
