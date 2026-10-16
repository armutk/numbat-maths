import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import reasoning, { REASONING_QUESTION_BANKS, REASONING_VOICE_LINES, getReasoningVoiceLines } from '../js/modules/reasoning.js';
import { ADVENTURES, ADVENTURE_VOICE_LINES, buildAdventurePlan, getAdventure } from '../js/adventures.js';

const require = createRequire(import.meta.url);
const PW = process.env.PW_PATH || '/home/impmaster/.local/share/mise/installs/npm-playwright/1.63.0/node_modules/playwright';
const { chromium } = require(PW);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

const picnic = getAdventure('picnic-party');
assert.equal(ADVENTURES.length, 1);
assert.equal(picnic.stages.length, 3);
assert.deepEqual(picnic.stages.map((s) => [s.moduleId, s.skillId]), [
  ['groups', 'groups.howmany'],
  ['sharing', 'sharing.groups'],
  ['addsub', 'addsub.sub'],
]);
assert.ok(picnic.stages.every((s) => s.title && s.intro && s.outro));
for (const line of [picnic.title, picnic.intro, picnic.outro, ...picnic.stages.flatMap((s) => [s.title, s.intro, s.outro])]) {
  assert.ok(ADVENTURE_VOICE_LINES.includes(line), `voice inventory missing: ${line}`);
}

const planA = buildAdventurePlan({ seed: 'arisha-friday' });
const planB = buildAdventurePlan({ seed: 'arisha-friday' });
assert.deepEqual(planA, planB);
assert.equal(planA.length, 3);
assert.equal(new Set(planA.map((s) => s.seed)).size, 3);
assert.doesNotThrow(() => JSON.stringify(planA));
assert.ok(planA.every((s, i) => s.storyStage === i + 1 && s.id && s.title && s.intro && s.outro));
assert.equal(buildAdventurePlan({ adventureId: 'missing' }), null);
assert.match(picnic.outro, /picnic/i);
assert.doesNotMatch(picnic.outro, /ready/i, 'adventure outro cannot say the picnic is ready after it is over');

assert.deepEqual(reasoning.skills.map((s) => s.id), ['reasoning.mistake', 'reasoning.missing', 'reasoning.match']);
assert.deepEqual(Object.keys(REASONING_QUESTION_BANKS), ['mistake', 'missing', 'match']);
assert.ok(REASONING_QUESTION_BANKS.mistake.flat().some((q) => q.shown === q.a + q.b));
assert.ok(REASONING_QUESTION_BANKS.mistake.flat().some((q) => q.shown !== q.a + q.b));
assert.deepEqual(getReasoningVoiceLines(), REASONING_VOICE_LINES);
assert.ok(REASONING_VOICE_LINES.length > 100, 'exact voice inventory is unexpectedly small');
assert.ok(REASONING_VOICE_LINES.every((line) => typeof line === 'string' && line.length > 0 && !/[{}]/.test(line)), 'voice inventory contains placeholders');

const reached = new Set();
const judgments = new Set();
for (const skill of reasoning.skills) {
  for (let level = 1; level <= skill.maxLevel; level++) {
    for (let seed = 1; seed <= 400; seed++) {
      const a = reasoning.makeTask(skill.id, level, { seed });
      const b = reasoning.makeTask(skill.id, level, { seed });
      assert.deepEqual(plain(a.data), plain(b.data), `${skill.id} level ${level} seed ${seed} is not deterministic`);
      assert.equal(a.say, b.say);
      assert.equal(typeof a.mount, 'function');
      assert.equal(typeof a.hint, 'function');
      assert.equal(typeof a.reveal, 'function');
      assert.ok(a.voiceLines.includes(a.say));
      assert.ok(a.voiceLines.every((line) => typeof line === 'string' && line.length > 0));
      for (const line of a.voiceLines) {
        reached.add(line);
        assert.ok(REASONING_VOICE_LINES.includes(line), `reachable line missing from exact inventory: ${line}`);
      }
      if (skill.id === 'reasoning.mistake') {
        assert.equal(a.data.answer, a.data.a + a.data.b);
        assert.equal(a.data.correct, a.data.shown === a.data.answer ? 'Right' : 'Mistake');
        judgments.add(a.data.correct);
        if (a.data.correct === 'Right') assert.match(a.success, /^That's right\./);
        else assert.match(a.success, /^You found Pip's mistake!/);
      } else if (skill.id === 'reasoning.missing') {
        assert.equal(a.data.a + a.data.answer, a.data.total);
        assert.ok(a.data.options.includes(a.data.answer));
        assert.equal(new Set(a.data.options).size, a.data.options.length);
      } else {
        assert.equal(a.say, 'Which number sentence matches these apples?');
        assert.doesNotMatch(a.say, /\d/, 'same-quantity prompt leaks the object count');
        assert.equal(a.data.a + a.data.b, a.data.total);
        assert.equal(a.data.correct, `${a.data.a} + ${a.data.b}`);
        assert.ok(a.data.options.includes(a.data.correct));
        assert.equal(new Set(a.data.options).size, a.data.options.length);
        for (const option of a.data.options.filter((x) => x !== a.data.correct)) {
          const [x, y] = option.split(' + ').map(Number);
          assert.notEqual(x + y, a.data.total, `distractor ${option} also equals ${a.data.total}`);
        }
      }
    }
  }
}
assert.deepEqual([...judgments].sort(), ['Mistake', 'Right']);
assert.ok(reached.size > 100, 'broad seeds did not exercise a useful exact voice set');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, rel.endsWith('/') ? `${rel}index.html` : rel);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('missing'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((resolve, reject) => server.listen(8136, '127.0.0.1', (e) => e ? reject(e) : resolve()));

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(m.text()); });
await page.goto('http://127.0.0.1:8136/');

const mistakeSeeds = {};
for (let seed = 1; !mistakeSeeds.Right || !mistakeSeeds.Mistake; seed++) {
  const task = reasoning.makeTask('reasoning.mistake', 2, { seed });
  mistakeSeeds[task.data.correct] ||= seed;
}
const browserCases = [
  ['reasoning.mistake', mistakeSeeds.Right],
  ['reasoning.mistake', mistakeSeeds.Mistake],
  ['reasoning.missing', 11],
  ['reasoning.match', 19],
];
for (const [skillId, seed] of browserCases) {
  const result = await page.evaluate(async ({ skillId, seed }) => {
    const [{ default: mod }, art] = await Promise.all([import('./js/modules/reasoning.js'), import('./js/art.js')]);
    const h = (tag, attrs = {}, ...kids) => {
      const el = document.createElement(tag);
      for (const [key, value] of Object.entries(attrs || {})) {
        if (key === 'class') el.className = value;
        else if (key === 'html') el.innerHTML = value;
        else if (key === 'dataset') Object.assign(el.dataset, value);
        else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
        else el.setAttribute(key, value);
      }
      for (const kid of kids.flat()) if (kid != null) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
      return el;
    };
    document.body.innerHTML = '<main id="stage"></main>';
    const stage = document.getElementById('stage');
    let finished = null;
    const events = [];
    let task = null;
    const api = {
      h, items: art.items, wait: async () => {}, say: async (line, kind) => { events.push(`say:${kind || 'plain'}:${line}`); }, sfx: { tap() {} },
      ask({ options, answer, parent = stage, text = String, finalSay }) {
        const group = h('div', { class: 'choices' });
        for (const value of options) {
          const button = h('button', { class: 'choice', dataset: { value: String(value) } }, text(value));
          button.addEventListener('click', async () => {
            if (value === answer) { events.push('correct'); finished = true; }
            else { events.push('wrong'); finished = false; await task.hint(stage, api, 1); }
          });
          group.append(button);
        }
        parent.append(group);
        return group;
      },
      finish(ok) { finished = ok; },
    };
    task = mod.makeTask(skillId, 2, { seed });
    task.mount(stage, api);
    const answer = String(task.data.correct ?? task.data.answer);
    const wrong = [...stage.querySelectorAll('button')].find((button) => button.dataset.value !== answer);
    wrong?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    const hinted = events.includes('wrong') && events.some((event) => event.startsWith('say:is-hint:'));
    const target = stage.querySelector(`button[data-value="${CSS.escape(answer)}"]`);
    target?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    return {
      finished,
      hinted,
      judgment: task.data.correct || null,
      events,
      buttons: stage.querySelectorAll('button').length,
      objects: stage.querySelectorAll('.challenge-object').length,
      text: stage.textContent,
    };
  }, { skillId, seed });
  assert.equal(result.finished, true, `${skillId} correct control did not finish`);
  assert.equal(result.hinted, true, `${skillId} wrong control did not run its hint before correction`);
  assert.ok(result.buttons >= 2, `${skillId} did not render choices`);
  assert.ok(result.text.length > 5, `${skillId} rendered no readable question`);
  if (skillId === 'reasoning.match') assert.ok(result.objects >= 3, 'same-quantity task did not render objects');
}

assert.deepEqual(errors, []);
await browser.close();
await new Promise((resolve) => server.close(resolve));
console.log('PASS adventure descriptors, deterministic reasoning generation, and browser controls');
