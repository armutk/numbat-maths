import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import explore, { EXPLORE_SPOKEN_LINES, makeExploreTaskData } from '../js/modules/explore.js';

const sameA = makeExploreTaskData('explore.patterns', 1, 12345);
const sameB = makeExploreTaskData('explore.patterns', 1, 12345);
assert.deepEqual(sameA, sameB, 'same skill, level and seed should reproduce the task');
assert.equal(sameA.kind, 'patterns');
assert.ok(sameA.sequence.length >= 5, 'pattern should show enough repeats to see its unit');
assert.ok(sameA.options.includes(sameA.answer), 'pattern answer should be among the choices');
assert.equal(new Set(sameA.options).size, sameA.options.length, 'pattern choices should be distinct');
assert.equal(sameA.answer, sameA.unit[sameA.sequence.length % sameA.unit.length], 'pattern answer should continue the repeating unit');
assert.equal(new Set(sameA.unit.map((id) => sameA.tokens.find((token) => token.id === id).shape)).size, sameA.unit.length, 'pattern parts should differ by shape as well as colour');
assert.equal(explore.id, 'explore');
assert.ok(explore.skills.some((skill) => skill.id === 'explore.patterns'));

for (let level = 1; level <= 3; level++) {
  for (let seed = 1; seed <= 30; seed++) {
    const task = makeExploreTaskData('explore.shapes', level, seed);
    assert.equal(task.kind, 'shapes');
    assert.ok(task.options.includes(task.answer), 'shape answer should be among the choices');
    assert.equal(new Set(task.options).size, task.options.length, 'shape choices should be distinct');
    assert.ok(task.shapes.find((shape) => shape.id === task.answer), 'shape answer should describe a visible shape');
    assert.ok(!task.say.toLowerCase().includes(task.answer), 'shape question should describe properties without naming the answer');
    const matches = task.options.filter((id) => {
      const features = task.shapes.find((shape) => shape.id === id).features;
      return Object.entries(task.criterion).every(([name, value]) => features[name] === value);
    });
    assert.deepEqual(matches, [task.answer], 'shape property clue should have exactly one matching choice');
  }
}
assert.ok(explore.skills.some((skill) => skill.id === 'explore.shapes'));

for (let level = 1; level <= 3; level++) {
  for (let seed = 1; seed <= 30; seed++) {
    const task = makeExploreTaskData('explore.measure', level, seed);
    assert.equal(task.kind, 'measure');
    assert.equal(task.unit, 'equal blocks', 'all lengths should use the same stated unit');
    assert.equal(new Set(task.items.map((item) => item.start)).size, 1, 'all compared lengths should have aligned starts');
    assert.ok(task.options.includes(task.answer), 'measurement answer should be among the choices');
    assert.equal(new Set(task.items.map((item) => item.blocks)).size, task.items.length, 'compared lengths should differ');
    const expected = task.askFor === 'longest'
      ? task.items.reduce((best, item) => item.blocks > best.blocks ? item : best).id
      : task.items.reduce((best, item) => item.blocks < best.blocks ? item : best).id;
    assert.equal(task.answer, expected, 'measurement answer should match the requested comparison');
  }
}
assert.ok(explore.skills.some((skill) => skill.id === 'explore.measure'));

for (let level = 1; level <= 3; level++) {
  for (let seed = 1; seed <= 30; seed++) {
    const task = makeExploreTaskData('explore.charts', level, seed);
    assert.equal(task.kind, 'charts');
    assert.equal(task.key, 1, 'each picture should represent exactly one object');
    assert.ok(task.options.includes(task.answer), 'chart answer should be among the choices');
    assert.equal(new Set(task.options).size, task.options.length, 'chart choices should be distinct');
    assert.ok(task.rows.every((row) => Number.isInteger(row.count) && row.count > 0), 'chart rows should use countable whole pictures');
    assert.equal(new Set(task.rows.map((row) => row.count)).size, task.rows.length, 'chart comparison rows should have unique counts');
    if (task.question === 'howMany') {
      assert.equal(Number(task.answer), task.rows.find((row) => row.id === task.target).count);
    } else if (task.question === 'most') {
      assert.equal(task.answer, task.rows.reduce((best, row) => row.count > best.count ? row : best).id);
    } else {
      const high = task.rows.find((row) => row.id === task.target);
      const low = task.rows.find((row) => row.id === task.compare);
      assert.equal(Number(task.answer), high.count - low.count);
      assert.ok(high.count > low.count, 'more-than chart question should have a positive difference');
    }
  }
}
const advancedChartAnswers = new Set(Array.from({ length: 40 }, (_, seed) => makeExploreTaskData('explore.charts', 3, seed + 1).answer));
assert.ok(advancedChartAnswers.size >= 3, 'advanced picture-chart differences should vary across seeds');
assert.ok(explore.skills.some((skill) => skill.id === 'explore.charts'));
for (const skill of explore.skills) {
  for (let level = 1; level <= skill.maxLevel; level++) {
    const first = makeExploreTaskData(skill.id, level, 2026);
    const second = makeExploreTaskData(skill.id, level, 2026);
    assert.equal(JSON.stringify(first), JSON.stringify(second), `${skill.id} L${level} should be deterministic and JSON-serializable`);
    assert.deepEqual(explore.makeTask(skill.id, level, 2026).data, explore.makeTask(skill.id, level, { seed: 2026 }).data, 'numeric and object seed contracts should agree');
  }
}
assert.equal(new Set(EXPLORE_SPOKEN_LINES).size, EXPLORE_SPOKEN_LINES.length, 'spoken-line inventory should not contain duplicates');
assert.equal(EXPLORE_SPOKEN_LINES.length, 103, 'spoken-line inventory should exactly enumerate reachable lines');
for (const line of [
  'What comes next in this repeating pattern?',
  'Which shape has 2 long sides, 2 short sides and 4 corners?',
  'Each ribbon starts at the same line. Count the equal blocks. Which ribbon is shortest?',
  'Each picture means one. How many more apples are there than carrots?',
  'You chose 0.',
  'Yes. The green ribbon is longest. It measures 8 equal blocks.',
  'The answer is the rectangle. Look at the model and try this idea again next time.',
]) assert.ok(EXPLORE_SPOKEN_LINES.includes(line), `spoken-line inventory should include: ${line}`);

const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const root = fileURLToPath(new URL('../', import.meta.url));
const harness = `<!doctype html><html><body><p id="bubble"></p><main id="stage"></main><aside id="actions"></aside><script type="module">
  const mod = await import('/js/modules/explore.js');
  const stage = document.querySelector('#stage');
  const bubble = document.querySelector('#bubble');
  window.results = [];
  window.mountExplore = (skill, level, seed) => {
    stage.innerHTML = '';
    const task = mod.default.makeTask(skill, level, { seed });
    let wrongs = 0;
    const api = {
      say(text) { bubble.textContent = text; return Promise.resolve(); },
      finish(ok, detail = {}) {
        window.results.push(ok);
        if (detail.say) bubble.textContent = detail.say;
        if (!ok) { wrongs++; return task.hint?.(stage, api, wrongs); }
      },
      ask({ options, answer, parent = stage, text = String, sayOption = String, finalSay }) {
        const group = document.createElement('div'); group.className = 'choices';
        for (const value of options) {
          const button = document.createElement('button'); button.className = 'choice'; button.dataset.value = String(value);
          button.append(text(value));
          button.addEventListener('click', async () => {
            bubble.textContent = sayOption(value);
            if (value === answer) api.finish(true, { say: finalSay });
            else { button.classList.add('is-wrong'); await api.finish(false); }
          });
          group.append(button);
        }
        parent.append(group);
      },
    };
    task.mount(stage, api);
    return { answer: task.data.answer, say: task.say };
  };
</script></body></html>`;
const server = createServer(async (request, response) => {
  try {
    if (request.url === '/harness.html') { response.setHeader('content-type', 'text/html'); response.end(harness); return; }
    const path = fileURLToPath(new URL(`..${request.url}`, import.meta.url));
    if (!path.startsWith(root)) throw new Error('outside root');
    response.setHeader('content-type', path.endsWith('.js') ? 'text/javascript' : 'text/plain');
    response.end(await readFile(path));
  } catch { response.statusCode = 404; response.end('missing'); }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const address = server.address();
  await page.goto(`http://127.0.0.1:${address.port}/harness.html`);
  await page.waitForFunction(() => typeof window.mountExplore === 'function');
  const mounted = await page.evaluate(() => window.mountExplore('explore.patterns', 2, 77));
  assert.ok(mounted.say.includes('pattern'));
  assert.ok(await page.locator('.ex-pattern-piece').count() >= 5, 'pattern pieces should be visible');
  const patternLabels = await page.locator('.ex-pattern-piece').evaluateAll((pieces) => pieces.map((piece) => piece.getAttribute('aria-label')));
  assert.ok(patternLabels.every((label) => /^(red|blue|yellow|green) (circle|square|triangle|diamond)$/.test(label)), 'pattern pictures should have human-readable labels');
  const sizes = await page.locator('.choice').evaluateAll((buttons) => buttons.map((button) => button.getBoundingClientRect().height));
  assert.ok(sizes.every((height) => height >= 44), 'choice targets should be at least 44px high');
  await page.locator(`.choice:not([data-value="${mounted.answer}"])`).first().click();
  assert.equal(await page.evaluate(() => window.results.at(-1)), false, 'wrong pattern choice should be rejected');
  assert.match(await page.locator('#bubble').innerText(), /look|repeat|again/i, 'wrong pattern choice should give a useful hint');
  await page.locator(`.choice[data-value="${mounted.answer}"]`).click();
  assert.equal(await page.evaluate(() => window.results.at(-1)), true, 'right pattern choice should finish successfully');

  const activities = [
    ['explore.shapes', 3, 91, '.ex-shape-card', /side|corner|clue/i],
    ['explore.measure', 3, 92, '.ex-measure-row', /block|start|count/i],
    ['explore.charts', 3, 93, '.ex-chart-row', /picture|row|count/i],
  ];
  for (const [skill, level, seed, visible, hint] of activities) {
    const item = await page.evaluate(([id, lv, sd]) => window.mountExplore(id, lv, sd), [skill, level, seed]);
    assert.ok(await page.locator(visible).count() >= 2, `${skill} should show its visual model`);
    const wrong = page.locator(`.choice:not([data-value="${item.answer}"])`).first();
    await wrong.click();
    assert.equal(await page.evaluate(() => window.results.at(-1)), false, `${skill} wrong choice should be rejected`);
    assert.match(await page.locator('#bubble').innerText(), hint, `${skill} wrong choice should give a useful hint`);
    await page.locator(`.choice[data-value="${item.answer}"]`).click();
    assert.equal(await page.evaluate(() => window.results.at(-1)), true, `${skill} right choice should finish successfully`);
  }

  await page.setViewportSize({ width: 768, height: 1024 });
  for (const [skill, level] of [['explore.patterns', 3], ['explore.shapes', 3], ['explore.measure', 3], ['explore.charts', 3]]) {
    await page.evaluate(([id, lv]) => window.mountExplore(id, lv, 101), [skill, level]);
    const overflow = await page.locator('.ex-task').evaluate((task) => {
      const rect = task.getBoundingClientRect();
      return rect.left < -1 || rect.right > innerWidth + 1 || rect.bottom > innerHeight + 1;
    });
    assert.equal(overflow, false, `${skill} should fit a narrow iPad viewport`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log('explore generation and interaction checks passed');
