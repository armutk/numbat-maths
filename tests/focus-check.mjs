// Weekly school-focus persistence, expiry and quest weighting.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const BASE = process.argv[2] || 'http://127.0.0.1:8125/?dev';
const DAY = 86400000;
const NOW = 1800000000000;
const choices = [
  { id: 'place-value', label: 'Tens and ones', skillIds: ['numbers.build', 'numbers.read'] },
  { id: 'number-order', label: 'Number order', skillIds: ['numbers.find', 'numbers.beforeafter', 'numbers.order'] },
  { id: 'patterns', label: 'Patterns', skillIds: ['explore.patterns'] },
  { id: 'extra', label: 'Ignored fourth', skillIds: ['addsub.add'] },
];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false }, stars: 9, skills: { 'numbers.build': { level: 2, history: [1], streak: 1, total: 3, correct: 3, firstTry: 2, lastSeen: 1, due: 9999999999999, interval: 2 } } })));
await page.goto(BASE); await page.waitForFunction(() => window.__numbat);

const saved = await page.evaluate(({ choices, NOW, DAY }) => {
  const store = window.__numbat.store;
  const focus = store.setWeeklyFocus(choices, NOW);
  return { focus, beforeExpiry: store.getWeeklyFocus(NOW + 7 * DAY - 1), stars: store.getState().stars, total: store.skill('numbers.build').total };
}, { choices, NOW, DAY });
if (saved.focus.selections.length !== 3 || saved.focus.expiresAt !== NOW + 7 * DAY || !saved.beforeExpiry || saved.stars !== 9 || saved.total !== 3) throw new Error('focus persistence contract failed: ' + JSON.stringify(saved));
console.log('PASS focus saves max three choices for exactly seven rolling days');

const expired = await page.evaluate(({ NOW, DAY }) => ({ value: window.__numbat.store.getWeeklyFocus(NOW + 7 * DAY), raw: window.__numbat.store.getState().weeklyFocus }), { NOW, DAY });
if (expired.value !== null || expired.raw !== null) throw new Error('focus did not expire at boundary: ' + JSON.stringify(expired));
console.log('PASS focus expires at now >= expiresAt');

// Reapply two number topics. A chosen Numbers quest should favour them but retain revision.
const weighted = await page.evaluate(({ choices, NOW }) => {
  const app = window.__numbat, store = app.store;
  store.setWeeklyFocus(choices.slice(0, 2), NOW);
  const numbers = app.MODULES.find((m) => m.id === 'numbers');
  app.startQuest(numbers);
  const q = store.activeQuest();
  return q.plan.map((s) => s.skillId);
}, { choices, NOW });
const focusIds = new Set(['numbers.build', 'numbers.read', 'numbers.find', 'numbers.beforeafter', 'numbers.order']);
if (weighted.filter((id) => focusIds.has(id)).length < 4 || new Set(weighted).size < 3) throw new Error('chosen island was not focus-weighted with revision: ' + weighted.join(','));
console.log('PASS selected island favours focus while retaining revision');

// Updating focus never rewrites the already-saved quest.
const preserved = await page.evaluate(({ choices, NOW }) => {
  const store = window.__numbat.store; const before = JSON.stringify(store.activeQuest());
  store.setWeeklyFocus(choices.slice(2, 3), NOW + 1000);
  return before === JSON.stringify(store.activeQuest());
}, { choices, NOW });
if (!preserved) throw new Error('changing focus rewrote active quest');
console.log('PASS saved quest is unchanged by later parent focus');

// A child can deliberately choose another island; focus from Numbers does not hijack it.
const deliberate = await page.evaluate(({ choices, NOW }) => {
  const app = window.__numbat, store = app.store; store.clearActiveQuest(); store.setWeeklyFocus(choices.slice(0, 2), NOW);
  const groups = app.MODULES.find((m) => m.id === 'groups'); app.startQuest(groups);
  return store.activeQuest().plan.map((s) => s.moduleId);
}, { choices, NOW });
if (!deliberate.every((id) => id === 'groups')) throw new Error('focus hijacked deliberately chosen island: ' + deliberate.join(','));
console.log('PASS child can intentionally choose a different island');

const mixed = await page.evaluate(() => { const app = window.__numbat; app.store.clearActiveQuest(); app.startMixedAdventure(); return app.store.activeQuest().plan; });
if (!mixed.some((s) => focusIds.has(s.skillId)) || new Set(mixed.map((s) => s.moduleId)).size < 4) throw new Error('mixed quest lost focus or broad revision: ' + JSON.stringify(mixed));
console.log('PASS mixed practice includes focus and broad revision');

// Corrupt focus is dropped without damaging the rest of an older profile.
await page.evaluate(() => { const state = JSON.parse(localStorage.getItem('numbat-maths.v1')); state.weeklyFocus = { v: 1, selections: 'bad', setAt: -2, expiresAt: 'soon' }; localStorage.setItem('numbat-maths.v1', JSON.stringify(state)); });
await page.reload(); await page.waitForFunction(() => window.__numbat);
const repaired = await page.evaluate(() => ({ focus: window.__numbat.store.getWeeklyFocus(), stars: window.__numbat.store.getState().stars, total: window.__numbat.store.skill('numbers.build').total }));
if (repaired.focus !== null || repaired.stars !== 9 || repaired.total !== 3) throw new Error('corrupt focus recovery damaged profile: ' + JSON.stringify(repaired));
console.log('PASS corrupt focus is dropped without losing progress');
await browser.close();
