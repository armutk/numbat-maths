import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

import sharing from '../js/modules/sharing.js';
import groups from '../js/modules/groups.js';
import numbers from '../js/modules/numbers.js';
import addsub from '../js/modules/addsub.js';
import reasoning from '../js/modules/reasoning.js';
import explore from '../js/modules/explore.js';
import {
  DEMONSTRATION_COVERAGE,
  DEMONSTRATION_VOICE_LINES,
  buildDemonstration,
  mountDemonstration,
  validateDemonstration,
} from '../js/demonstrations.js';

const modules = [sharing, groups, numbers, addsub, reasoning, explore];
const shippedSkills = modules.flatMap((module) => module.skills.map((skill) => ({ ...skill, moduleId: module.id })));
assert.equal(shippedSkills.length, 23, 'release should expose 23 skills');
assert.deepEqual(Object.keys(DEMONSTRATION_COVERAGE).sort(), shippedSkills.map((skill) => skill.id).sort(), 'coverage map should exactly match shipped skills');

function checkFacts(demo) {
  const f = demo.facts;
  if (f.kind === 'share' || f.kind === 'groups') {
    assert.equal(f.total, f.groupCount * f.groupSize + (f.leftover || 0));
    assert.equal(f.groups.length, f.groupCount);
    assert.ok(f.groups.every((group) => group === f.groupSize));
    assert.ok((f.leftover || 0) >= 0 && (f.leftover || 0) < f.groupSize);
  } else if (f.kind === 'place') {
    assert.equal(f.number, f.tens * 10 + f.ones);
  } else if (f.kind === 'locate') {
    assert.ok(f.target >= f.start && f.target <= f.end);
  } else if (f.kind === 'neighbours') {
    assert.equal(f.before + 1, f.number);
    assert.equal(f.number + 1, f.after);
  } else if (f.kind === 'order') {
    assert.deepEqual(f.sorted, f.values.slice().sort((a, b) => a - b));
  } else if (f.kind === 'add') {
    assert.equal(f.total, f.a + f.b);
    assert.equal(f.toTen, f.strategy === 'make-ten' ? 10 - f.a : 0);
    assert.equal(f.remaining, f.strategy === 'make-ten' ? f.b - f.toTen : f.b);
    assert.ok(f.toTen >= 0 && f.remaining >= 0);
  } else if (f.kind === 'partwhole') {
    assert.equal(f.partA + f.partB, f.whole);
  } else if (f.kind === 'subtract') {
    assert.equal(f.start - f.take, f.left);
  } else if (f.kind === 'mistake') {
    assert.equal(f.correct, f.operation === 'add' ? f.a + f.b : f.a - f.b);
    assert.notEqual(f.shown, f.correct);
  } else if (f.kind === 'match') {
    assert.equal(f.left, f.right);
  } else if (f.kind === 'pattern') {
    assert.equal(f.answer, f.unit[f.sequence.length % f.unit.length]);
  } else if (f.kind === 'shape') {
    assert.equal(f.sides, f.sideNames.length);
    assert.equal(f.corners, f.cornerNames.length);
  } else if (f.kind === 'measure') {
    assert.equal(f.sameUnit, true);
    assert.equal(new Set(f.lengths).size, f.lengths.length);
    assert.equal(f.answer, f.askFor === 'longest' ? Math.max(...f.lengths) : Math.min(...f.lengths));
  } else if (f.kind === 'chart') {
    assert.equal(f.key, 1);
    assert.equal(new Set(f.rows.map((row) => row.count)).size, f.rows.length);
    const sorted = f.rows.slice().sort((a, b) => b.count - a.count);
    const expected = f.question === 'howMany' ? f.rows.find((row) => row.id === f.target).count
      : f.question === 'most' ? sorted[0].id : sorted[0].count - sorted.at(-1).count;
    assert.equal(f.answer, expected);
  } else {
    assert.fail(`unknown fact kind ${f.kind}`);
  }
}

const reachableLines = new Set();
for (const skill of shippedSkills) {
  const coverage = DEMONSTRATION_COVERAGE[skill.id];
  assert.equal(coverage.maxLevel, skill.maxLevel, `${skill.id} max level should match`);
  assert.ok(coverage.family && coverage.model, `${skill.id} should name a relevant family and model`);
  for (let level = 1; level <= skill.maxLevel; level++) {
    for (const seed of [0, 1]) {
      const demo = buildDemonstration(skill.id, level, { seed });
      assert.deepEqual(demo, buildDemonstration(skill.id, level, { seed }), 'same seed should reproduce the demonstration');
      assert.equal(demo.skillId, skill.id);
      assert.equal(demo.level, level);
      assert.equal(demo.family, coverage.family);
      assert.ok(demo.steps.length >= 3 && demo.steps.length <= 5, `${skill.id} should have a short finite demonstration`);
      assert.deepEqual(validateDemonstration(demo), [], `${skill.id} L${level} should validate`);
      assert.doesNotThrow(() => JSON.stringify(demo));
      checkFacts(demo);
      for (const step of demo.steps) {
        assert.ok(step.say && !/[{}]|\$\{/.test(step.say), 'narration should be exact and placeholder-free');
        reachableLines.add(step.say);
      }
    }
  }
}

assert.deepEqual([...DEMONSTRATION_VOICE_LINES].sort(), [...reachableLines].sort(), 'voice inventory should exactly cover every reachable narration line');
assert.equal(new Set(DEMONSTRATION_VOICE_LINES).size, DEMONSTRATION_VOICE_LINES.length, 'voice inventory should be deduplicated');
assert.equal(DEMONSTRATION_VOICE_LINES.some((line) => /[+−=]/.test(line)), false, 'spoken narration should use operator words; symbols belong only in visual equations');
assert.equal(DEMONSTRATION_VOICE_LINES.some((line) => /\b1 (tens|ones)\b/.test(line)), false, 'spoken narration should use singular ten and one');
assert.equal(DEMONSTRATION_VOICE_LINES.some((line) => /\b(apples|carrots|muffins) has the biggest count/.test(line)), false, 'chart narration should use grammatical row language');
for (let level = 1; level <= 4; level++) for (const seed of [0, 1]) {
  assert.equal(buildDemonstration('reasoning.mistake', level, { seed }).facts.operation, 'add', 'Spot Pip\'s mistake should stay aligned with its addition-only task bank');
  assert.equal(buildDemonstration('numbers.find', level, { seed }).steps.some((item) => /decade/i.test(item.say)), false, 'Find-number narration should use child-friendly starting-number language');
}
assert.equal(buildDemonstration('addsub.maketen', 4, { seed: 0 }).facts.strategy, 'double');
assert.equal(buildDemonstration('addsub.maketen', 4, { seed: 1 }).facts.strategy, 'double-plus-one');
assert.match(buildDemonstration('addsub.maketen', 4, { seed: 1 }).steps[1].say, /Double 7 first/);
for (const seed of [0, 1]) {
  const tensL4 = buildDemonstration('groups.tens', 4, { seed }).facts;
  assert.equal(tensL4.kind, 'place');
  assert.ok(tensL4.tens >= 2 && tensL4.tens <= 4 && tensL4.ones >= 1 && tensL4.ones <= 9);
  const bagsL4 = buildDemonstration('groups.howmany', 4, { seed }).facts;
  assert.ok(bagsL4.leftover >= 1 && bagsL4.leftover < bagsL4.groupSize, 'How many groups L4 should demonstrate leftovers');
  assert.equal(buildDemonstration('numbers.order', 3, { seed }).facts.values.length, 4, 'Order L3 should use four cards');
  assert.equal(new Set(buildDemonstration('explore.patterns', 2, { seed }).facts.unit).size, 3, 'Pattern L2 repeat unit should contain three distinct tokens');
  assert.equal(new Set(buildDemonstration('explore.patterns', 3, { seed }).facts.unit).size, 4, 'Pattern L3 repeat unit should contain four distinct tokens');
  assert.deepEqual(buildDemonstration('explore.charts', 1, { seed }).facts.rows.map((row) => row.count).sort((a, b) => a - b), [2, 5]);
  assert.ok([8, 9].includes(buildDemonstration('addsub.maketen', 1, { seed }).facts.a), 'Make Ten L1 should start at 8 or 9');
  assert.ok(buildDemonstration('addsub.sub', 2, { seed }).facts.start <= 12, 'Subtraction L2 should start at no more than 12');
  assert.ok(buildDemonstration('addsub.sub', 4, { seed }).facts.left >= 2 && buildDemonstration('addsub.sub', 4, { seed }).facts.left <= 8, 'Subtraction L4 should use missing parts from 2 to 8');
  assert.equal(buildDemonstration('sharing.two', 4, { seed }).facts.unit, 10, 'Large sharing should use boxes of ten');
  assert.equal(buildDemonstration('sharing.groups', 4, { seed }).facts.unit, 10, 'Large group sharing should use boxes of ten');
}
assert.ok(buildDemonstration('sharing.two', 3, { seed: 0 }).facts.leftover > 0, 'Sharing L3 should model a leftover case');
assert.ok(buildDemonstration('sharing.groups', 3, { seed: 0 }).facts.leftover > 0, 'Multi-group sharing L3 should model a leftover case');
for (const [level, lo, hi] of [[1, 5, 7], [2, 6, 10], [3, 6, 10], [4, 11, 20]]) for (const seed of [0, 1]) {
  const whole = buildDemonstration('addsub.ppw', level, { seed }).facts.whole;
  assert.ok(whole >= lo && whole <= hi, `Number friends L${level} whole should match its task range`);
}

const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const root = fileURLToPath(new URL('../', import.meta.url));
const harness = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>html,body{margin:0;height:100%;overflow:hidden}#host{height:100%;padding:8px;box-sizing:border-box}</style></head><body><main id="host"></main><script type="module">
  const mod = await import('/js/demonstrations.js');
  const host = document.querySelector('#host');
  window.events = { said: [], done: 0, skipped: 0, stopped: 0, aborted: 0 };
  window.mountDemo = (skillId, level, options = {}) => {
    window.controller?.destroy();
    const demo = mod.makeDemonstration(skillId, level, { seed: options.seed || 0 });
    const api = {
      say(text, { signal } = {}) {
        window.events.said.push(text);
        if (!options.pending) return Promise.resolve();
        return new Promise((resolve) => {
          window.resolveSay = resolve;
          signal?.addEventListener('abort', () => { window.events.aborted++; resolve(); }, { once: true });
        });
      },
      stopSay() { window.events.stopped++; },
      stillHere: () => true,
      onDone() { window.events.done++; },
      onSkip() { window.events.skipped++; },
    };
    window.controller = mod.mountDemonstration(host, demo, api, { reducedMotion: !!options.reducedMotion });
    return demo;
  };
  window.inspectFinal = async (skillId, level, seed = 0) => {
    const demo = window.mountDemo(skillId, level, { seed, reducedMotion: true });
    await window.controller.play(demo.steps.length - 1);
    const root = document.querySelector('.demo-worked');
    const result = { kind: demo.facts.kind };
    result.groupCounts = [...root.querySelectorAll('.demo-group')].map((node) => Number(node.dataset.count));
    result.counterTotals = [...root.querySelectorAll('[data-total]')].map((node) => Number(node.dataset.total));
    result.focusNumber = Number(root.querySelector('.demo-mark.is-focus')?.textContent);
    result.cards = [...root.querySelectorAll('.demo-card:not(.is-waiting)')].map((node) => Number(node.textContent));
    result.equation = root.querySelector('.demo-equation')?.textContent || '';
    result.parts = [...root.querySelectorAll('.demo-part > span')].map((node) => Number(node.textContent));
    result.patternCount = root.querySelectorAll('.demo-pattern-shape').length;
    result.lastPatternShape = root.querySelector('.demo-pattern-shape:last-child')?.getAttribute('aria-label') || '';
    result.bigShape = root.querySelector('.demo-big-shape svg')?.getAttribute('aria-label') || '';
    result.measureLengths = [...root.querySelectorAll('.demo-measure-row')].map((node) => Number(node.dataset.length));
    result.measureAnswer = Number(root.querySelector('.demo-measure-row.is-answer')?.dataset.length);
    result.chartCounts = [...root.querySelectorAll('.demo-chart-row')].map((node) => Number(node.dataset.count));
    result.rodCount = root.querySelectorAll('.demo-rod').length;
    result.oneCount = root.querySelectorAll('.demo-one').length;
    result.tenBoxCount = root.querySelectorAll('.demo-ten-box').length;
    result.leftover = Number(root.querySelector('.demo-leftover')?.dataset.leftover || 0);
    return { demo, result };
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
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const address = server.address();
  await page.goto(`http://127.0.0.1:${address.port}/harness.html`);
  await page.waitForFunction(() => typeof window.mountDemo === 'function');

  const demo = await page.evaluate(() => window.mountDemo('addsub.add', 2));
  assert.equal(demo.facts.a, 7);
  assert.equal(demo.facts.b, 5);
  assert.equal(demo.facts.toTen, 3);
  assert.equal(demo.facts.remaining, 2);
  assert.equal(await page.locator('.demo-step').getAttribute('data-step'), '0');
  assert.match(await page.locator('.demo-narration').innerText(), /Start with 7/);
  assert.equal(await page.locator('.demo-tenframe .demo-cell.first').count(), 7, '7 should be visible in the first frame');
  assert.equal(await page.locator('.demo-spare .demo-dot').count(), 5, 'the complete second addend should be visible before moving counters');
  const targetSizes = await page.locator('.demo-controls button').evaluateAll((buttons) => buttons.filter((button) => !button.hidden).map((button) => { const r = button.getBoundingClientRect(); return [r.width, r.height]; }));
  assert.ok(targetSizes.every(([width, height]) => width >= 44 && height >= 44), 'all demonstration controls should be at least 44px');

  await page.getByRole('button', { name: 'Next step' }).click();
  assert.equal(await page.locator('.demo-step').getAttribute('data-step'), '1');
  assert.match(await page.locator('.demo-narration').innerText(), /Split 5 into 3 and 2/);
  assert.equal(await page.locator('.demo-tenframe .demo-cell.second').count(), 3, 'three counters should visibly move to complete ten');
  assert.equal(await page.locator('.demo-spare .demo-dot').count(), 2, 'two counters should remain visibly outside the ten-frame');
  await page.getByRole('button', { name: 'Back' }).click();
  assert.equal(await page.locator('.demo-step').getAttribute('data-step'), '0');
  await page.getByRole('button', { name: 'Replay' }).click();
  assert.equal(await page.locator('.demo-step').getAttribute('data-step'), '0');
  await page.getByRole('button', { name: 'Next step' }).click();
  await page.getByRole('button', { name: 'Next step' }).click();
  assert.equal(await page.getByRole('button', { name: 'Try it' }).isVisible(), true);
  await page.getByRole('button', { name: 'Try it' }).click();
  assert.deepEqual(await page.evaluate(() => ({ done: events.done, skipped: events.skipped, children: document.querySelector('#host').childElementCount })), { done: 1, skipped: 0, children: 0 });

  await page.evaluate(() => window.mountDemo('sharing.groups', 2, { pending: true }));
  await page.waitForFunction(() => typeof window.resolveSay === 'function');
  await page.evaluate(() => window.controller.destroy());
  await page.evaluate(() => window.resolveSay());
  await page.waitForTimeout(100);
  const destroyed = await page.evaluate(() => ({ aborted: events.aborted, stopped: events.stopped, done: events.done, children: document.querySelector('#host').childElementCount }));
  assert.ok(destroyed.aborted >= 1, 'destroy should abort pending narration');
  assert.ok(destroyed.stopped >= 1, 'destroy should stop scoped audio');
  assert.equal(destroyed.done, 1, 'destroy should not report learner completion');
  assert.equal(destroyed.children, 0, 'destroy should clear its host without stale updates');

  await page.evaluate(() => window.mountDemo('explore.measure', 3, { reducedMotion: true }));
  assert.equal(await page.locator('.demo-worked').getAttribute('data-reduced-motion'), 'true');
  assert.ok(await page.locator('.demo-model').count(), 'reduced-motion view should keep the essential model visible');
  assert.equal(await page.locator('.demo-measure-row').evaluateAll((rows) => rows.some((row) => /\d/.test(row.textContent))), false, 'aligned ribbons should not print their lengths before the equal-unit counting step');
  await page.getByRole('button', { name: 'Skip demonstration' }).click();
  assert.equal(await page.evaluate(() => events.skipped), 1);

  for (const viewport of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }]) {
    await page.setViewportSize(viewport);
    for (const skill of shippedSkills) {
      await page.evaluate(([id, level]) => window.mountDemo(id, level, { seed: 1, reducedMotion: true }), [skill.id, skill.maxLevel]);
      const layout = await page.locator('.demo-worked').evaluate((root) => {
        const rect = root.getBoundingClientRect();
        const buttons = [...root.querySelectorAll('button:not([hidden])')].map((button) => button.getBoundingClientRect());
        return {
          inView: rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1,
          controlsLarge: buttons.every((rect) => rect.width >= 44 && rect.height >= 44),
          hasModel: !!root.querySelector('.demo-model-inner')?.children.length,
        };
      });
      assert.deepEqual(layout, { inView: true, controlsLarge: true, hasModel: true }, `${skill.id} should render accessibly at ${viewport.width}x${viewport.height}`);
    }
  }

  for (const skill of shippedSkills) {
    const { demo: renderedDemo, result } = await page.evaluate(([id, level]) => window.inspectFinal(id, level, 1), [skill.id, skill.maxLevel]);
    const f = renderedDemo.facts;
    if (f.kind === 'share' || f.kind === 'groups') assert.deepEqual(result.groupCounts, f.groups, `${skill.id} should render every group count`);
    else if (f.kind === 'place') {
      assert.deepEqual(result.counterTotals.slice(-2), [f.tens * 10, f.ones], `${skill.id} should render its tens and ones`);
      assert.equal(result.rodCount, f.tens, `${skill.id} should render one rod per ten`);
      assert.equal(result.oneCount, f.ones, `${skill.id} should render one cube per one`);
    }
    else if (f.kind === 'locate') assert.equal(result.focusNumber, f.target, `${skill.id} should highlight its target`);
    else if (f.kind === 'neighbours') assert.equal(result.focusNumber, f.after, `${skill.id} should finish one step after`);
    else if (f.kind === 'order') assert.deepEqual(result.cards, f.sorted, `${skill.id} should render sorted cards`);
    else if (f.kind === 'add') {
      if (f.strategy === 'make-ten') assert.ok(result.counterTotals.includes(f.total), `${skill.id} should render its final total`);
      else assert.match(result.equation, new RegExp(`= ${f.total}$`));
    } else if (f.kind === 'partwhole') assert.deepEqual(result.parts, [f.whole, f.partA, f.partB], `${skill.id} should render whole and both parts`);
    else if (f.kind === 'subtract') assert.match(result.equation, new RegExp(`= ${f.left}$`));
    else if (f.kind === 'mistake') assert.match(result.equation, new RegExp(`= ${f.correct}$`));
    else if (f.kind === 'match') assert.match(result.equation, new RegExp(`= ${f.right}$`));
    else if (f.kind === 'pattern') {
      assert.equal(result.patternCount, f.sequence.length + 1);
      assert.equal(result.lastPatternShape, f.answer);
    } else if (f.kind === 'shape') assert.equal(result.bigShape, f.name);
    else if (f.kind === 'measure') {
      assert.deepEqual(result.measureLengths, f.lengths);
      assert.equal(result.measureAnswer, f.answer);
    } else if (f.kind === 'chart') assert.deepEqual(result.chartCounts, f.rows.map((row) => row.count));
    if ((f.kind === 'share' || f.kind === 'groups') && f.leftover) assert.equal(result.leftover, f.leftover, `${skill.id} should visibly keep leftovers outside full groups`);
    if (f.kind === 'share' && f.unit === 10) assert.equal(result.tenBoxCount, f.total / 10, `${skill.id} should render boxes of ten instead of loose counters`);
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}

console.log(`demonstration checks passed: ${shippedSkills.length} skills, ${reachableLines.size} exact voice lines, controls and cancellation`);
