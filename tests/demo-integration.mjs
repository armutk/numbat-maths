// Worked demonstrations preserve learner state, award nothing and cancel cleanly.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11 landscape'], serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);

const answer = await page.evaluate(() => {
  window.__numbat.mountTask('reasoning.missing', 1);
  const q = window.__numbat.store.activeQuest(); const mod = window.__numbat.MODULES.find((m) => m.id === 'reasoning');
  return mod.makeTask(q.plan[0].skillId, q.plan[0].level, { seed: q.plan[0].seed }).data.answer;
});
await page.waitForFunction(() => (document.querySelector('#app>.screen:last-child .speech-bubble p')?.textContent || '').length > 8);
const prompt = await page.locator('#app>.screen:last-child .speech-bubble p').innerText();
await page.getByRole('button', { name: 'Show me how' }).evaluate((button) => button.click());
await page.locator('.demo-overlay').waitFor();
await page.getByText('Pip shows you how', { exact: true }).waitFor();
let state = await page.evaluate(() => ({ q: window.__numbat.store.activeQuest(), stars: window.__numbat.store.getState().stars, total: window.__numbat.store.skill('reasoning.missing').total }));
if (state.q.helpUsed !== 1 || state.q.helpTaps !== 1 || state.q.idx !== 0 || state.stars !== 0 || state.total !== 0) throw new Error('opening demo changed learner progress incorrectly: ' + JSON.stringify(state));
while (await page.getByRole('button', { name: 'Next step' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Next step' }).click();
await page.getByRole('button', { name: 'Try it' }).click();
await page.locator('.demo-overlay').waitFor({ state: 'detached' });
if ((await page.locator('#app>.screen:last-child .speech-bubble p').innerText()) !== prompt) throw new Error('demo did not return to same learner question');
state = await page.evaluate(() => ({ q: window.__numbat.store.activeQuest(), stars: window.__numbat.store.getState().stars, total: window.__numbat.store.skill('reasoning.missing').total }));
if (state.q.idx !== 0 || state.stars !== 0 || state.total !== 0) throw new Error('demo awarded progress: ' + JSON.stringify(state));
console.log('PASS demo returns to same task without rewards or completion');

await page.locator(`.choice[data-value="${answer}"]`).click();
await page.locator('.summary').waitFor({ timeout: 10000 });
state = await page.evaluate(() => ({ skill: window.__numbat.store.skill('reasoning.missing'), stars: window.__numbat.store.getState().stars }));
if (state.skill.total !== 1 || state.skill.firstTry !== 0 || state.stars !== 1) throw new Error('demo-assisted answer counted as first try: ' + JSON.stringify(state));
console.log('PASS demonstration help prevents first-try mastery credit');

// After two misses the explicit control is offered, never forced.
await page.evaluate(() => window.__numbat.mountTask('reasoning.missing', 1));
const data = await page.evaluate(() => { const q = window.__numbat.store.activeQuest(); const mod = window.__numbat.MODULES.find((m) => m.id === 'reasoning'); return mod.makeTask(q.plan[0].skillId, q.plan[0].level, { seed: q.plan[0].seed }).data; });
for (const wrong of data.options.filter((v) => v !== data.answer).slice(0, 2)) {
  await page.locator(`#app>.screen:last-child .choice[data-value="${wrong}"]`).click();
  await page.waitForFunction(() => !![...document.querySelectorAll('#app>.screen:last-child .choice')].find((b) => !b.disabled));
}
if (!(await page.getByRole('button', { name: 'Show me how' }).evaluate((b) => b.classList.contains('is-offered')))) throw new Error('demo was not offered after repeated misses');
if (await page.locator('.demo-overlay').count()) throw new Error('demo interrupted learner without explicit choice');
console.log('PASS repeated misses offer rather than force demonstration');

// Leaving destroys timers/audio callbacks; an old demo cannot eject or alter a new quest.
await page.getByRole('button', { name: 'Show me how' }).evaluate((button) => button.click());
await page.locator('.demo-overlay').waitFor();
await page.getByRole('button', { name: 'Home' }).last().click();
const newId = await page.evaluate(() => { window.__numbat.store.clearActiveQuest(); window.__numbat.mountTask('explore.patterns', 1); return window.__numbat.store.activeQuest().id; });
await page.waitForTimeout(1200);
const after = await page.evaluate((id) => ({ id: window.__numbat.store.activeQuest()?.id, quest: !!document.querySelector('#app>.screen:last-child.quest'), demo: !!document.querySelector('.demo-overlay') }), newId);
if (after.id !== newId || !after.quest || after.demo) throw new Error('stale demo callback affected new quest: ' + JSON.stringify(after));
if (errors.length) throw new Error('demo integration page errors: ' + errors.join(' | '));
await browser.close();
console.log('PASS demo lifecycle cancels on Home/new quest');
