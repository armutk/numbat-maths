// Review screenshots for the sustained-practice release. Output stays outside the repository.
import fs from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const OUT = process.env.QA_OUT || '/tmp/numbat-release-evidence';
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block' });
const page = await ctx.newPage();
await page.goto(BASE);
await page.evaluate(async () => {
  localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } }));
  (await import('./js/voice.js')).setMuted(true);
});
await page.reload(); await page.waitForFunction(() => window.__numbat);
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/01-home-portrait.png`, fullPage: true });

await page.getByRole('button', { name: /Numbers to 120/ }).click();
await page.waitForFunction(() => /\d/.test(document.querySelector('#app > .screen:last-child .speech-bubble p')?.textContent || ''));
await page.getByRole('button', { name: 'Home' }).last().click();
await page.getByRole('button', { name: /Resume quest/ }).waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/02-resume-choice.png`, fullPage: true });

await page.getByRole('button', { name: 'Start something new' }).click();
await page.evaluate(() => window.__numbat.startAdventure('picnic-party'));
await page.locator('.mission-strip').waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/03-story-stage.png`, fullPage: true });

await page.evaluate(() => { window.__numbat.store.clearActiveQuest(); window.__numbat.mountTask('explore.patterns', 2); });
await page.locator('.ex-pattern').waitFor();
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-new-pattern-activity.png`, fullPage: true });

const answer = await page.evaluate(() => {
  window.__numbat.store.clearActiveQuest();
  const day = window.__numbat.store.day(); day.quests = 1; day.doneShown = false; window.__numbat.store.save();
  window.__numbat.mountTask('reasoning.missing', 1);
  const q = window.__numbat.store.activeQuest();
  const mod = window.__numbat.MODULES.find((item) => item.id === 'reasoning');
  return mod.makeTask(q.plan[0].skillId, q.plan[0].level, { seed: q.plan[0].seed }).data.answer;
});
await page.locator(`.choice[data-value="${answer}"]`).click();
await page.getByRole('button', { name: 'Continue adventure' }).waitFor({ timeout: 10000 });
await page.waitForTimeout(1800);
await page.screenshot({ path: `${OUT}/05-post-goal-continue.png`, fullPage: true });

await browser.close();
console.log(`PASS release screenshots written to ${OUT}`);
