// Short reasoning challenges from finite banks, so every spoken line can be recorded ahead of time.
import { moduleArt } from '../art.js';

export const REASONING_QUESTION_BANKS = {
  mistake: [
    [
      { a: 2, b: 3, shown: 5 },
      { a: 3, b: 2, shown: 6 },
      { a: 4, b: 3, shown: 7 },
      { a: 5, b: 2, shown: 8 },
    ],
    [
      { a: 2, b: 6, shown: 8 },
      { a: 4, b: 5, shown: 8 },
      { a: 7, b: 3, shown: 10 },
      { a: 6, b: 2, shown: 9 },
    ],
    [
      { a: 6, b: 5, shown: 11 },
      { a: 7, b: 6, shown: 12 },
      { a: 8, b: 4, shown: 12 },
      { a: 9, b: 5, shown: 15 },
    ],
    [
      { a: 12, b: 7, shown: 19 },
      { a: 13, b: 6, shown: 18 },
      { a: 9, b: 8, shown: 17 },
      { a: 11, b: 9, shown: 19 },
    ],
  ],
  missing: [
    [
      { a: 2, total: 5, options: [2, 3, 4] },
      { a: 4, total: 7, options: [3, 2, 4] },
      { a: 3, total: 8, options: [4, 6, 5] },
      { a: 5, total: 8, options: [2, 3, 4] },
    ],
    [
      { a: 3, total: 9, options: [5, 7, 6] },
      { a: 6, total: 10, options: [4, 3, 5] },
      { a: 2, total: 8, options: [7, 6, 5] },
      { a: 5, total: 9, options: [3, 5, 4] },
    ],
    [
      { a: 6, total: 13, options: [6, 7, 8] },
      { a: 8, total: 15, options: [7, 6, 8] },
      { a: 5, total: 12, options: [6, 8, 7] },
      { a: 9, total: 14, options: [4, 5, 6] },
    ],
    [
      { a: 11, total: 18, options: [8, 6, 7] },
      { a: 13, total: 20, options: [7, 8, 6] },
      { a: 9, total: 17, options: [7, 9, 8] },
      { a: 12, total: 19, options: [6, 7, 8] },
    ],
  ],
  match: [
    [
      { total: 3, a: 1, b: 2, options: ['1 + 1', '1 + 2', '2 + 2'] },
      { total: 4, a: 2, b: 2, options: ['2 + 2', '1 + 2', '3 + 2'] },
      { total: 5, a: 2, b: 3, options: ['2 + 2', '3 + 3', '2 + 3'] },
      { total: 6, a: 4, b: 2, options: ['3 + 2', '4 + 2', '4 + 3'] },
    ],
    [
      { total: 7, a: 3, b: 4, options: ['3 + 3', '3 + 4', '4 + 4'] },
      { total: 8, a: 5, b: 3, options: ['5 + 3', '4 + 3', '5 + 4'] },
      { total: 9, a: 4, b: 5, options: ['4 + 4', '5 + 5', '4 + 5'] },
      { total: 10, a: 6, b: 4, options: ['5 + 4', '6 + 4', '6 + 5'] },
    ],
    [
      { total: 11, a: 6, b: 5, options: ['6 + 4', '6 + 5', '6 + 6'] },
      { total: 12, a: 7, b: 5, options: ['7 + 5', '6 + 5', '7 + 6'] },
      { total: 13, a: 8, b: 5, options: ['8 + 4', '8 + 6', '8 + 5'] },
      { total: 15, a: 9, b: 6, options: ['8 + 6', '9 + 6', '9 + 7'] },
    ],
    [
      { total: 16, a: 9, b: 7, options: ['9 + 6', '9 + 7', '9 + 8'] },
      { total: 17, a: 10, b: 7, options: ['10 + 7', '9 + 7', '10 + 8'] },
      { total: 18, a: 11, b: 7, options: ['11 + 6', '11 + 8', '11 + 7'] },
      { total: 20, a: 12, b: 8, options: ['11 + 8', '12 + 8', '12 + 9'] },
    ],
  ],
};

function seedNumber(value) {
  const text = String(value ?? 1);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const levelOf = (level) => Math.max(1, Math.min(4, Math.round(Number(level)) || 1));

function choose(kind, level, seed) {
  const bank = REASONING_QUESTION_BANKS[kind][level - 1];
  const index = seed === undefined
    ? Math.floor(Math.random() * bank.length)
    : seedNumber(`${kind}:${level}:${seed}`) % bank.length;
  return bank[index];
}

function card(api, eyebrow, equation) {
  const eq = api.h('div', { class: 'challenge-equation' }, equation);
  const root = api.h('div', { class: 'challenge-card' },
    api.h('p', { class: 'challenge-label' }, eyebrow),
    eq,
  );
  return { root, eq };
}

function mistakeTask(question) {
  const { a, b, shown } = question;
  const answer = a + b;
  const correct = shown === answer ? 'Right' : 'Mistake';
  const say = `Pip says ${a} plus ${b} is ${shown}. Is Pip right?`;
  const success = correct === 'Right'
    ? `That's right. ${a} plus ${b} is ${answer}.`
    : `You found Pip's mistake! ${a} plus ${b} is ${answer}.`;
  const hint = `Count on from ${a}.`;
  const data = { kind: 'mistake', a, b, answer, shown, correct, options: ['Right', 'Mistake'] };
  let equation = null;
  return {
    data,
    say,
    success,
    voiceLines: [say, success, hint, 'Right.', 'Mistake.'],
    mount(stage, api) {
      const view = card(api, 'Pip says:', `${a} + ${b} = ${shown}`);
      equation = view.eq;
      stage.append(view.root);
      api.ask({
        options: data.options,
        answer: data.correct,
        parent: view.root,
        text: (value) => value,
        sayOption: (value) => `${value}.`,
        finalSay: success,
      });
    },
    async hint(stage, api) {
      equation?.classList.add('challenge-hint');
      await api.say(hint, 'is-hint');
    },
    async reveal(stage, api) {
      if (equation) {
        equation.textContent = `${a} + ${b} = ${answer}`;
        equation.classList.add('challenge-answer');
      }
      await api.say(success, 'is-happy');
    },
  };
}

function missingTask(question) {
  const { a, total } = question;
  const answer = total - a;
  const options = [...question.options];
  const say = `What number is missing? ${a} plus what makes ${total}?`;
  const success = `${a} plus ${answer} is ${total}.`;
  const hint = `Count on from ${a} to ${total}.`;
  const data = { kind: 'missing', a, total, answer, options };
  let equation = null;
  return {
    data,
    say,
    success,
    voiceLines: [say, success, hint, ...options.map(String)],
    mount(stage, api) {
      const view = card(api, 'Find the missing number:', `${a} + ? = ${total}`);
      equation = view.eq;
      stage.append(view.root);
      api.ask({ options, answer, parent: view.root, finalSay: success });
    },
    async hint(stage, api) {
      equation?.classList.add('challenge-hint');
      await api.say(hint, 'is-hint');
    },
    async reveal(stage, api) {
      if (equation) {
        equation.textContent = `${a} + ${answer} = ${total}`;
        equation.classList.add('challenge-answer');
      }
      await api.say(success, 'is-happy');
    },
  };
}

function expression(a, b) {
  return `${a} + ${b}`;
}

function spokenExpression(value) {
  return `${value.replace(' + ', ' plus ')}.`;
}

function matchTask(question) {
  const { total, a, b } = question;
  const correct = expression(a, b);
  const options = [...question.options];
  const say = 'Which number sentence matches these apples?';
  const success = `There are ${total} apples. ${a} plus ${b} is ${total}.`;
  const hint = 'Count the apples, then find that total.';
  const data = { kind: 'match', total, a, b, correct, options };
  let objects = null;
  return {
    data,
    say,
    success,
    voiceLines: [say, success, hint, ...options.map(spokenExpression)],
    mount(stage, api) {
      objects = api.h('div', { class: 'challenge-objects', 'aria-label': `${total} apples` },
        ...Array.from({ length: total }, () => api.h('span', { class: 'challenge-object', html: api.items.apple() })),
      );
      const root = api.h('div', { class: 'challenge-card' },
        api.h('p', { class: 'challenge-label' }, 'Show the same amount:'),
        objects,
      );
      stage.append(root);
      api.ask({
        options,
        answer: correct,
        parent: root,
        text: (value) => value,
        sayOption: spokenExpression,
        finalSay: success,
      });
    },
    async hint(stage, api) {
      objects?.classList.add('challenge-hint');
      await api.say(hint, 'is-hint');
    },
    async reveal(stage, api) {
      stage.append(api.h('p', { class: 'challenge-answer' }, `${correct} = ${total}`));
      await api.say(success, 'is-happy');
    },
  };
}

const reasoning = {
  id: 'reasoning',
  title: "Pip's Brain Teasers",
  tagline: 'Spot, solve and show your thinking',
  colour: 'blue',
  art: moduleArt.numbers,
  skills: [
    { id: 'reasoning.mistake', name: "Spot Pip's mistake", maxLevel: 4 },
    { id: 'reasoning.missing', name: 'Find the missing number', maxLevel: 4 },
    { id: 'reasoning.match', name: 'Show the same amount', maxLevel: 4 },
  ],
  makeTask(skillId, level, { seed } = {}) {
    const safeLevel = levelOf(level);
    if (skillId === 'reasoning.missing') return missingTask(choose('missing', safeLevel, seed));
    if (skillId === 'reasoning.match') return matchTask(choose('match', safeLevel, seed));
    return mistakeTask(choose('mistake', safeLevel, seed));
  },
};

function exhaustiveVoiceLines() {
  const tasks = [];
  for (const level of [1, 2, 3, 4]) {
    tasks.push(...REASONING_QUESTION_BANKS.mistake[level - 1].map(mistakeTask));
    tasks.push(...REASONING_QUESTION_BANKS.missing[level - 1].map(missingTask));
    tasks.push(...REASONING_QUESTION_BANKS.match[level - 1].map(matchTask));
  }
  return [...new Set(tasks.flatMap((task) => task.voiceLines))];
}

export const REASONING_VOICE_LINES = exhaustiveVoiceLines();

export function getReasoningVoiceLines() {
  return [...REASONING_VOICE_LINES];
}

export default reasoning;
