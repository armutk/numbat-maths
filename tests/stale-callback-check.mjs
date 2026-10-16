// Leaving during final-answer feedback must not let the old quest eject a newly started quest.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);
const answer = await page.evaluate(async () => {
  (await import('./js/voice.js')).setMuted(true);
  window.__numbat.mountTask('reasoning.missing', 1);
  const q = window.__numbat.store.activeQuest();
  const mod = window.__numbat.MODULES.find((item) => item.id === 'reasoning');
  return mod.makeTask(q.plan[0].skillId, q.plan[0].level, { seed: q.plan[0].seed }).data.answer;
});
await page.locator(`.choice[data-value="${answer}"]`).click();
await page.waitForFunction(() => window.__numbat.store.activeQuest()?.idx === 1);
const newId = await page.evaluate(() => {
  window.__numbat.home();
  window.__numbat.store.clearActiveQuest();
  window.__numbat.mountTask('explore.patterns', 1);
  return window.__numbat.store.activeQuest().id;
});
await page.waitForTimeout(1200);
const after = await page.evaluate((id) => ({ same: window.__numbat.store.activeQuest()?.id === id, visible: !!document.querySelector('#app > .screen:last-child.quest') }), newId);
await browser.close();
if (!after.same || !after.visible || errors.length) throw new Error(`stale quest callback changed the new quest: ${JSON.stringify({ after, errors })}`);
console.log('PASS stale completion callback cannot eject a newly started quest');
