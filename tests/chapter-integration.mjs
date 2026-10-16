// Chapter picker, deterministic start, resume labels and weekly-focus isolation.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium, devices } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices['iPad Pro 11'], serviceWorkers: 'block' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);
await page.getByRole('button', { name: /Story adventures/ }).click();
for (const title of ["Pip's Picnic Adventure", 'Lost Bilby', "Pip's Bakery", 'Train Rescue']) await page.getByText(title, { exact: true }).waitFor();
console.log('PASS picker shows all four chapters');

await page.getByRole('button', { name: 'Find Bilby' }).click();
await page.getByRole('button', { name: 'Start adventure' }).click();
await page.locator('.mission-strip').waitFor();
let quest = await page.evaluate(() => window.__numbat.store.activeQuest());
if (quest.adventureId !== 'lost-bilby' || quest.plan.length !== 4 || !quest.plan.every((s) => s.adventureId === 'lost-bilby')) throw new Error('Lost Bilby plan not saved intact: ' + JSON.stringify(quest));
await page.getByRole('button', { name: 'Home' }).last().click();
await page.getByRole('button', { name: 'Keep looking' }).waitFor();
console.log('PASS chapter-specific resume label and saved stage progress');

// Focus must not alter a fixed story route.
await page.getByRole('button', { name: 'Start something new' }).click();
await page.evaluate(() => {
  window.__numbat.store.setWeeklyFocus([{ id: 'add', label: 'Add and subtract', skillIds: ['addsub.add', 'addsub.sub'] }]);
  window.__numbat.startAdventure('train-rescue');
});
quest = await page.evaluate(() => window.__numbat.store.activeQuest());
const route = quest.plan.map((s) => s.skillId).join(',');
if (route !== 'numbers.order,explore.patterns,numbers.beforeafter,groups.tens') throw new Error('weekly focus changed fixed story route: ' + route);
console.log('PASS fixed story curriculum ignores weekly focus');

// Every chapter can enter its first stage without page errors.
for (const id of ['picnic-party', 'lost-bilby', 'pips-bakery', 'train-rescue']) {
  await page.evaluate((id) => { window.__numbat.store.clearActiveQuest(); window.__numbat.startAdventure(id); }, id);
  await page.locator('#app>.screen:last-child .mission-strip').waitFor();
  const state = await page.evaluate(() => ({ q: window.__numbat.store.activeQuest(), strip: document.querySelector('#app>.screen:last-child .mission-strip')?.textContent }));
  if (state.q.adventureId !== id || !/Stage 1 of/.test(state.strip)) throw new Error(`chapter ${id} did not enter stage 1`);
}
if (errors.length) throw new Error('chapter browser errors: ' + errors.join(' | '));
await browser.close();
console.log('PASS all chapters enter visible Stage 1 without errors');
