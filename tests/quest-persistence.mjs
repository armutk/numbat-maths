// Quest persistence contract: exact task resume, corrupt-save recovery, and idempotent rewards.
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
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const pass = (s) => console.log('PASS', s);

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.reload(); await page.waitForFunction(() => !!window.__numbat);

// Store transaction is idempotent: a reload/replayed callback cannot award twice.
const txn = await page.evaluate(() => {
  const s = window.__numbat.store;
  s.beginQuest({ v: 1, id: 'txn-1', mode: 'standard', moduleId: 'numbers', title: 'Numbers to 120', plan: [{ moduleId: 'numbers', skillId: 'numbers.find', level: 1, seed: 123 }], idx: 0, wrongs: 0, helpUsed: 0, helpTaps: 0, result: { stars: 0, correct: 0, firstTry: 0, levelUps: [] } });
  const a = s.completeQuestStep({ questId: 'txn-1', index: 0, skillId: 'numbers.find', maxLevel: 4, ok: true, firstTry: true, stars: 2 });
  const b = s.completeQuestStep({ questId: 'txn-1', index: 0, skillId: 'numbers.find', maxLevel: 4, ok: true, firstTry: true, stars: 2 });
  return { a, b, stars: s.getState().stars, total: s.skill('numbers.find').total, idx: s.activeQuest().idx };
});
if (txn.a.duplicate || !txn.b.duplicate || txn.stars !== 2 || txn.total !== 1 || txn.idx !== 1) throw new Error('quest completion was not idempotent: ' + JSON.stringify(txn));
pass('quest step rewards and attempt counters are idempotent');

// A standard quest stores a deterministic current question and offers a resume/start choice.
await page.evaluate(() => { window.__numbat.store.clearActiveQuest(); window.__numbat.home(); });
await page.getByRole('button', { name: /Numbers to 120/ }).last().click();
await page.waitForFunction(() => /\d/.test(document.querySelector('#app > .screen:last-child .speech-bubble p')?.textContent || ''));
const prompt = await page.locator('#app > .screen:last-child .speech-bubble p').innerText();
const saved = await page.evaluate(() => window.__numbat.store.activeQuest());
if (!saved || saved.idx !== 0 || !saved.plan[0]?.seed) throw new Error('quest was not saved on start');
await page.getByRole('button', { name: 'Home' }).click();
await page.getByRole('button', { name: /Resume/ }).waitFor();
await page.getByRole('button', { name: /Resume/ }).click();
await page.waitForFunction(() => /\d/.test(document.querySelector('#app > .screen:last-child .speech-bubble p')?.textContent || ''));
const sameSession = await page.locator('#app > .screen:last-child .speech-bubble p').innerText();
if (sameSession !== prompt) throw new Error(`question changed on same-session resume: ${JSON.stringify(prompt)} -> ${JSON.stringify(sameSession)}`);
await page.getByRole('button', { name: 'Home' }).last().click();
await page.getByRole('button', { name: /Resume/ }).waitFor();
await page.reload(); await page.waitForFunction(() => !!window.__numbat);
await page.getByRole('button', { name: /Resume/ }).click();
await page.waitForFunction(() => /\d/.test(document.querySelector('#app > .screen:last-child .speech-bubble p')?.textContent || ''));
const resumed = await page.locator('#app > .screen:last-child .speech-bubble p').innerText();
if (resumed !== prompt) throw new Error(`question changed on resume: ${JSON.stringify(prompt)} -> ${JSON.stringify(resumed)}`);
pass('Home/reload resumes the same current question');

// Wrong/help state survives, even though the current board restarts clearly.
const wrongTarget = Number(resumed.match(/\d+/)[0]);
await page.locator('.cellnum').filter({ hasNotText: new RegExp(`^${wrongTarget}$`) }).first().click();
await page.waitForFunction(() => window.__numbat.store.activeQuest()?.wrongs === 1);
await page.waitForTimeout(5500);
await page.getByRole('button', { name: 'Ask Pip for help' }).evaluate((button) => button.click());
await page.waitForFunction(() => window.__numbat.store.activeQuest()?.helpUsed === 1);
await page.getByRole('button', { name: 'Home' }).last().click();
await page.reload(); await page.waitForFunction(() => !!window.__numbat);
const kept = await page.evaluate(() => window.__numbat.store.activeQuest());
if (kept.wrongs !== 1 || kept.helpUsed !== 1 || kept.helpTaps !== 1) throw new Error('wrong/help state was lost: ' + JSON.stringify(kept));
await page.getByRole('button', { name: /Resume/ }).click();
await page.waitForFunction(() => /\d/.test(document.querySelector('#app > .screen:last-child .speech-bubble p')?.textContent || ''));
if ((await page.locator('#app > .screen:last-child .speech-bubble p').innerText()) !== prompt) throw new Error('wrong-answer resume changed question');
pass('wrong count and help state survive Home/reload');

// Reload during post-answer celebration resumes at the next task without duplicate credit.
await page.locator('.cellnum').filter({ hasText: new RegExp(`^${wrongTarget}$`) }).click();
await page.waitForFunction(() => window.__numbat.store.activeQuest()?.idx === 1);
const committed = await page.evaluate(() => ({ stars: window.__numbat.store.getState().stars, total: window.__numbat.store.skill('numbers.find').total, idx: window.__numbat.store.activeQuest().idx }));
await page.reload(); await page.waitForFunction(() => !!window.__numbat);
const afterCelebrationReload = await page.evaluate(() => ({ stars: window.__numbat.store.getState().stars, total: window.__numbat.store.skill('numbers.find').total, idx: window.__numbat.store.activeQuest().idx }));
if (JSON.stringify(afterCelebrationReload) !== JSON.stringify(committed)) throw new Error('celebration reload duplicated outcome: ' + JSON.stringify({ committed, afterCelebrationReload }));
pass('reload during celebration keeps committed next position without duplicate rewards');

// Corrupt active quest is ignored without damaging the older profile.
await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('numbat-maths.v1'));
  s.activeQuest = { v: 1, id: 'broken', plan: 'nope', idx: -8 };
  localStorage.setItem('numbat-maths.v1', JSON.stringify(s));
});
await page.reload(); await page.waitForFunction(() => !!window.__numbat);
const corrupt = await page.evaluate(() => ({ name: window.__numbat.store.getName(), q: window.__numbat.store.activeQuest() }));
if (corrupt.name !== 'Arisha' || corrupt.q !== null) throw new Error('corrupt quest recovery failed: ' + JSON.stringify(corrupt));
pass('corrupt quest is dropped while profile survives');

if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
await browser.close();
console.log('ALL PASS');
