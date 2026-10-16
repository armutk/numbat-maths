import assert from 'node:assert/strict';

import { ADVENTURES, ADVENTURE_VOICE_LINES, buildAdventurePlan, getAdventure } from '../js/adventures.js';
import sharing from '../js/modules/sharing.js';
import groups from '../js/modules/groups.js';
import numbers from '../js/modules/numbers.js';
import addsub from '../js/modules/addsub.js';
import reasoning from '../js/modules/reasoning.js';
import explore from '../js/modules/explore.js';

const MODULES = [sharing, groups, numbers, addsub, reasoning, explore];
const byModule = new Map(MODULES.map((mod) => [mod.id, mod]));

const expectedRoutes = {
  'picnic-party': [
    ['groups', 'groups.howmany'],
    ['sharing', 'sharing.groups'],
    ['addsub', 'addsub.sub'],
  ],
  'lost-bilby': [
    ['explore', 'explore.shapes'],
    ['explore', 'explore.patterns'],
    ['numbers', 'numbers.beforeafter'],
    ['sharing', 'sharing.one'],
  ],
  'pips-bakery': [
    ['explore', 'explore.charts'],
    ['explore', 'explore.measure'],
    ['groups', 'groups.howmany'],
    ['sharing', 'sharing.groups'],
    ['addsub', 'addsub.sub'],
  ],
  'train-rescue': [
    ['numbers', 'numbers.order'],
    ['explore', 'explore.patterns'],
    ['numbers', 'numbers.beforeafter'],
    ['groups', 'groups.tens'],
  ],
};

assert.deepEqual(ADVENTURES.map((adventure) => adventure.id), Object.keys(expectedRoutes));
assert.equal(new Set(ADVENTURES.map((adventure) => adventure.id)).size, ADVENTURES.length);

const exactNarration = [];
const resumeIds = new Set();
for (const adventure of ADVENTURES) {
  const route = adventure.stages.map((stage) => [stage.moduleId, stage.skillId]);
  assert.deepEqual(route, expectedRoutes[adventure.id], `${adventure.id} route changed`);
  if (adventure.id !== 'picnic-party') assert.ok(adventure.stages.length >= 4 && adventure.stages.length <= 5);
  assert.ok(new Set(adventure.stages.map((stage) => stage.moduleId)).size >= 3, `${adventure.id} repeats too little of the curriculum`);
  assert.ok(adventure.buttonLabel && adventure.resumeLabel);
  exactNarration.push(adventure.title, adventure.intro, adventure.outro, adventure.buttonLabel, adventure.resumeLabel);

  const localStageIds = new Set();
  for (const stage of adventure.stages) {
    assert.ok(stage.id && stage.title && stage.intro && stage.outro);
    assert.ok(!localStageIds.has(stage.id), `${adventure.id} repeats stage id ${stage.id}`);
    localStageIds.add(stage.id);
    const mod = byModule.get(stage.moduleId);
    assert.ok(mod, `unknown module ${stage.moduleId}`);
    const skill = mod.skills.find((entry) => entry.id === stage.skillId);
    assert.ok(skill, `unknown skill ${stage.skillId}`);
    assert.ok(Number.isInteger(stage.level) && stage.level >= 1 && stage.level <= skill.maxLevel, `${stage.skillId} has unsafe level ${stage.level}`);
    assert.ok(!stage.params || (typeof stage.params === 'object' && !Array.isArray(stage.params)));
    exactNarration.push(stage.title, stage.intro, stage.outro);
  }

  const first = buildAdventurePlan({ adventureId: adventure.id, seed: 'same-run' });
  const replay = buildAdventurePlan({ adventureId: adventure.id, seed: 'same-run' });
  const next = buildAdventurePlan({ adventureId: adventure.id, seed: 'next-run' });
  assert.deepEqual(first, replay, `${adventure.id} is not deterministic`);
  assert.deepEqual(first.map((step) => step.id), next.map((step) => step.id), `${adventure.id} resume IDs depend on seed`);
  assert.notDeepEqual(first.map((step) => step.seed), next.map((step) => step.seed), `${adventure.id} task seeds do not vary`);
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.ok(first.every((step, index) => step.storyStage === index + 1));
  for (const step of first) {
    assert.ok(!resumeIds.has(step.id), `duplicate resume id ${step.id}`);
    resumeIds.add(step.id);
    assert.equal(typeof step.seed, 'number');
    assert.equal(JSON.stringify(step).includes('function'), false);
  }
}

assert.deepEqual(new Set(ADVENTURE_VOICE_LINES), new Set(exactNarration));
assert.equal(ADVENTURE_VOICE_LINES.length, new Set(exactNarration).size);
assert.ok(ADVENTURE_VOICE_LINES.every((line) => typeof line === 'string' && line.trim() === line && line.length > 0 && !/[{}]/.test(line)));

const chapterNarration = ADVENTURES.slice(1).flatMap((adventure) => [adventure.intro, adventure.outro, ...adventure.stages.flatMap((stage) => [stage.intro, stage.outro])]);
assert.ok(chapterNarration.every((line) => !/\d/.test(line)), 'story narration must not promise random task quantities');
assert.match(getAdventure('lost-bilby').intro, /lost|missing/i);
assert.match(getAdventure('lost-bilby').outro, /safe|found|home/i);
assert.match(getAdventure('pips-bakery').intro, /bakery/i);
assert.match(getAdventure('pips-bakery').outro, /bakery|baked|treat/i);
assert.match(getAdventure('train-rescue').intro, /train/i);
assert.match(getAdventure('train-rescue').outro, /moving|journey|station/i);

function withSeed(seed, run) {
  let state = Number(seed) >>> 0;
  const original = Math.random;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  try { return run(); } finally { Math.random = original; }
}

function taskFor(adventureId, stageId) {
  const step = buildAdventurePlan({ adventureId, seed: 'prompt-check' }).find((entry) => entry.id.endsWith(`:${stageId}`));
  const mod = byModule.get(step.moduleId);
  return withSeed(step.seed, () => mod.makeTask(step.skillId, step.level, { seed: step.seed, ...(step.params || {}) }));
}

assert.match(taskFor('lost-bilby', 'read-shape-clue').say, /shape/i);
assert.match(taskFor('lost-bilby', 'follow-track-pattern').say, /pattern/i);
assert.match(taskFor('lost-bilby', 'fill-bilby-basket').say, /all.+basket/i);
assert.match(taskFor('pips-bakery', 'check-ingredient-chart').say, /picture/i);
assert.match(taskFor('pips-bakery', 'measure-box-ribbons').say, /ribbon/i);
assert.match(taskFor('pips-bakery', 'count-cookie-leftovers').say, /cookie/i);
assert.match(taskFor('train-rescue', 'order-carriage-numbers').say, /numbers in order/i);
assert.match(taskFor('train-rescue', 'repair-signal-pattern').say, /pattern/i);
assert.match(taskFor('train-rescue', 'count-passengers').say, /tens/i);

console.log(`PASS ${ADVENTURES.length} adventures, ${resumeIds.size} stable stages, ${ADVENTURE_VOICE_LINES.length} exact narration lines`);
