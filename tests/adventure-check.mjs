// Connected story integration and explicit saved-quest choices.
import { createRequire } from 'node:module';
import { buildAdventurePlan } from '../js/adventures.js';
import addsub from '../js/modules/addsub.js';
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

const picnicPlan = buildAdventurePlan({ seed: 2 });
if (picnicPlan[2].params?.storyKind !== 'snacks') throw new Error('leftovers stage has no snack constraint');
const leftovers = addsub.makeTask(picnicPlan[2].skillId, picnicPlan[2].level, picnicPlan[2].params);
if (!/cookies?/.test(leftovers.say)) throw new Error('leftovers stage generated a non-food story: ' + leftovers.say);

await page.goto(BASE);
await page.evaluate(() => localStorage.setItem('numbat-maths.v1', JSON.stringify({ profile: { name: 'Arisha', sound: false } })));
await page.reload(); await page.waitForFunction(() => !!window.__numbat);
if (!(await page.getByRole('button', { name: /Story adventures/ }).count())) throw new Error('home has no story picker');
await page.getByRole('button', { name: /Story adventures/ }).click();
await page.getByRole('button', { name: 'Start the picnic' }).click();
await page.getByText('Pack the Picnic Bags', { exact: true }).waitFor();
await page.getByText('Share the Snacks', { exact: true }).waitFor();
await page.getByText('Count the Leftovers', { exact: true }).waitFor();
await page.getByRole('button', { name: 'Start adventure' }).click();
await page.locator('.mission-strip').waitFor();
const q = await page.evaluate(() => window.__numbat.store.activeQuest());
if (q.mode !== 'adventure' || q.plan.length !== 3) throw new Error('adventure was not persisted: ' + JSON.stringify(q));
const route = q.plan.map((s) => `${s.moduleId}/${s.skillId}`).join(',');
if (route !== 'groups/groups.howmany,sharing/sharing.groups,addsub/addsub.sub') throw new Error('story route changed: ' + route);
if (!/Stage 1 of 3/.test(await page.locator('.mission-strip').innerText())) throw new Error('story progress is not visible');

await page.getByRole('button', { name: 'Home' }).last().click();
await page.getByRole('button', { name: 'Start something new' }).click();
if (await page.evaluate(() => window.__numbat.store.activeQuest())) throw new Error('Start something new did not abandon saved quest');
if (await page.getByRole('button', { name: /Sharing Equally/ }).last().isDisabled()) throw new Error('islands stayed disabled after explicit abandon');

await page.evaluate(() => window.__numbat.startMixedAdventure());
const mixed = await page.evaluate(() => window.__numbat.store.activeQuest());
if (mixed.title !== "Pip's Maths Adventure" || new Set(mixed.plan.map((s) => s.moduleId)).size < 5) throw new Error('mixed continuation is not balanced: ' + JSON.stringify(mixed));

if (errors.length) throw new Error('page errors: ' + errors.join(' | '));
await browser.close();
console.log('PASS connected story route, visible stage progress, and explicit abandon choice');
