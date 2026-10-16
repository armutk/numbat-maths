// Patterns, shapes, measurement and picture charts for Victorian Curriculum Level 1.
import { h, svg } from '../ui.js';
import { items } from '../art.js';

const TOKENS = [
  { id: 'red-circle', shape: 'circle', colour: '#f26b5b' },
  { id: 'blue-square', shape: 'square', colour: '#4d9eeb' },
  { id: 'yellow-triangle', shape: 'triangle', colour: '#f5bd32' },
  { id: 'green-diamond', shape: 'diamond', colour: '#3fb984' },
];

const SHAPES = [
  { id: 'circle', colour: '#f26b5b', prompt: 'Which shape has one curved edge and no corners?', criterion: { curvedEdges: 1, corners: 0 }, features: { straightSides: 0, curvedEdges: 1, corners: 0, equalSides: 0, longSides: 0 } },
  { id: 'triangle', colour: '#f5bd32', prompt: 'Which shape has 3 straight sides and 3 corners?', criterion: { straightSides: 3, corners: 3 }, features: { straightSides: 3, curvedEdges: 0, corners: 3, equalSides: 3, longSides: 0 } },
  { id: 'square', colour: '#4d9eeb', prompt: 'Which shape has 4 equal straight sides and 4 corners?', criterion: { straightSides: 4, equalSides: 4 }, features: { straightSides: 4, curvedEdges: 0, corners: 4, equalSides: 4, longSides: 0 } },
  { id: 'rectangle', colour: '#3fb984', prompt: 'Which shape has 2 long sides, 2 short sides and 4 corners?', criterion: { straightSides: 4, longSides: 2 }, features: { straightSides: 4, curvedEdges: 0, corners: 4, equalSides: 0, longSides: 2 } },
];

const RIBBONS = [
  { id: 'red-ribbon', label: 'red ribbon', colour: '#f26b5b' },
  { id: 'blue-ribbon', label: 'blue ribbon', colour: '#4d9eeb' },
  { id: 'green-ribbon', label: 'green ribbon', colour: '#3fb984' },
];

const CHART_CATEGORIES = [
  { id: 'apples', label: 'apples', icon: 'apple' },
  { id: 'carrots', label: 'carrots', icon: 'carrot' },
  { id: 'muffins', label: 'muffins', icon: 'muffin' },
];

const revealLine = (label) => `The answer is ${label}. Look at the model and try this idea again next time.`;

function buildSpokenLineInventory() {
  const lines = [
    'What comes next in this repeating pattern?',
    ...SHAPES.map((shape) => shape.prompt),
    ...['longest', 'shortest'].map((word) => `Each ribbon starts at the same line. Count the equal blocks. Which ribbon is ${word}?`),
    ...CHART_CATEGORIES.map((category) => `Each picture means one. How many ${category.label} are in the chart?`),
    'Each picture means one. Which row has the most?',
    ...CHART_CATEGORIES.flatMap((high) => CHART_CATEGORIES.filter((low) => low.id !== high.id).map((low) => `Each picture means one. How many more ${high.label} are there than ${low.label}?`)),
    ...new Set([...TOKENS.map((token) => token.shape), ...SHAPES.map((shape) => shape.id)].map((name) => `You chose the ${name}.`)),
    ...RIBBONS.map((ribbon) => `You chose the ${ribbon.label}.`),
    ...CHART_CATEGORIES.map((category) => `You chose ${category.label}.`),
    ...Array.from({ length: 8 }, (_, value) => `You chose ${value}.`),
    'Yes. That shape comes next because the pattern repeats.',
    ...SHAPES.map((shape) => `Yes. The ${shape.id} matches every clue.`),
    ...RIBBONS.flatMap((ribbon) => [5, 6, 7, 8].map((blocks) => `Yes. The ${ribbon.label} is longest. It measures ${blocks} equal blocks.`)),
    ...RIBBONS.flatMap((ribbon) => [3, 4, 5].map((blocks) => `Yes. The ${ribbon.label} is shortest. It measures ${blocks} equal blocks.`)),
    ...CHART_CATEGORIES.flatMap((category) => [2, 5].map((count) => `Yes. There are ${count} ${category.label}.`)),
    ...CHART_CATEGORIES.map((category) => `Yes. ${category.label} has the most pictures.`),
    ...CHART_CATEGORIES.flatMap((high) => CHART_CATEGORIES.filter((low) => low.id !== high.id).flatMap((low) => [2, 3, 4].map((difference) => `Yes. There are ${difference} more ${high.label} than ${low.label}.`))),
    'Look at the small part that repeats. Then start that part again.',
    'Say the pattern slowly from the beginning. What should follow the last shape?',
    'Count the straight sides and corners. Use every clue.',
    'Trace around each shape with your finger. Check the side lengths and corners.',
    'Start at the dark line and count the equal blocks in each row.',
    'Compare the block counts. The longest ribbon has the most blocks.',
    'Compare the block counts. The shortest ribbon has the fewest blocks.',
    'Point to each picture and count one at a time. Each picture means one.',
    'Count each row. The row with the biggest count has the most.',
    'Count both rows, then compare the two counts.',
    ...SHAPES.map((shape) => revealLine(`the ${shape.id}`)),
  ];
  return [...new Set(lines)];
}

export const EXPLORE_SPOKEN_LINES = Object.freeze(buildSpokenLineInventory());

function seeded(seed) {
  let state = (Number(seed) >>> 0) || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(values, random) {
  const out = values.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function patternData(level, random) {
  const size = level <= 1 ? 2 : level === 2 ? 3 : 4;
  const shown = level <= 1 ? 5 : level === 2 ? 7 : 9;
  const unit = shuffled(TOKENS, random).slice(0, size).map((token) => token.id);
  const sequence = Array.from({ length: shown }, (_, i) => unit[i % unit.length]);
  const answer = unit[sequence.length % unit.length];
  const distractors = shuffled(TOKENS.map((token) => token.id).filter((id) => id !== answer), random).slice(0, 2);
  return {
    kind: 'patterns',
    say: 'What comes next in this repeating pattern?',
    unit,
    sequence,
    answer,
    options: shuffled([answer, ...distractors], random),
    tokens: TOKENS,
  };
}

function shapeData(level, random) {
  const pool = level <= 1 ? SHAPES.slice(0, 3) : SHAPES;
  const answerShape = pool[Math.floor(random() * pool.length)];
  const optionCount = level <= 1 ? 3 : 4;
  const otherIds = shuffled(SHAPES.filter((shape) => shape.id !== answerShape.id).map((shape) => shape.id), random);
  return {
    kind: 'shapes',
    say: answerShape.prompt,
    answer: answerShape.id,
    options: shuffled([answerShape.id, ...otherIds.slice(0, optionCount - 1)], random),
    criterion: { ...answerShape.criterion },
    shapes: SHAPES.map(({ id, colour, features }) => ({ id, colour, features: { ...features } })),
  };
}

function measurementData(level, random) {
  const itemCount = level >= 3 ? 3 : 2;
  const askFor = level <= 1 ? 'longest' : random() < 0.5 ? 'longest' : 'shortest';
  const colours = shuffled(RIBBONS, random).slice(0, itemCount);
  const base = 3 + Math.floor(random() * 2);
  const lengths = level <= 1
    ? shuffled([base, base + 3], random)
    : level === 2
      ? shuffled([base + 1, base + 2], random)
      : shuffled([base, base + 2, base + 4], random);
  const items = colours.map((item, i) => ({ ...item, start: 0, blocks: lengths[i] }));
  const answerItem = items.reduce((best, item) => {
    if (askFor === 'longest') return item.blocks > best.blocks ? item : best;
    return item.blocks < best.blocks ? item : best;
  });
  return {
    kind: 'measure',
    say: `Each ribbon starts at the same line. Count the equal blocks. Which ribbon is ${askFor}?`,
    unit: 'equal blocks',
    askFor,
    items,
    options: shuffled(items.map((item) => item.id), random),
    answer: answerItem.id,
  };
}

function numberOptions(answer, random) {
  const values = [answer];
  for (const delta of shuffled([-2, -1, 1, 2], random)) {
    const value = answer + delta;
    if (value >= 0 && !values.includes(value)) values.push(value);
    if (values.length === 3) break;
  }
  return shuffled(values.map(String), random);
}

function chartData(level, random) {
  const rowCount = level <= 1 ? 2 : 3;
  const categories = shuffled(CHART_CATEGORIES, random).slice(0, rowCount);
  const start = 1 + Math.floor(random() * 2);
  const gapA = 1 + Math.floor(random() * 2);
  const gapB = 1 + Math.floor(random() * 2);
  const counts = shuffled(level <= 1 ? [2, 5] : [start, start + gapA, start + gapA + gapB], random);
  const rows = categories.map((category, i) => ({ ...category, count: counts[i] }));
  if (level <= 1) {
    const target = rows[Math.floor(random() * rows.length)];
    return {
      kind: 'charts', key: 1, question: 'howMany', target: target.id, rows,
      say: `Each picture means one. How many ${target.label} are in the chart?`,
      answer: String(target.count), options: numberOptions(target.count, random),
    };
  }
  if (level === 2) {
    const most = rows.reduce((best, row) => row.count > best.count ? row : best);
    return {
      kind: 'charts', key: 1, question: 'most', rows,
      say: 'Each picture means one. Which row has the most?',
      answer: most.id, options: shuffled(rows.map((row) => row.id), random),
    };
  }
  const ordered = rows.slice().sort((a, b) => b.count - a.count);
  const high = ordered[0];
  const low = ordered[ordered.length - 1];
  const answer = high.count - low.count;
  return {
    kind: 'charts', key: 1, question: 'difference', target: high.id, compare: low.id, rows,
    say: `Each picture means one. How many more ${high.label} are there than ${low.label}?`,
    answer: String(answer), options: numberOptions(answer, random),
  };
}

function ensureStyles() {
  if (document.getElementById('explore-module-styles')) return;
  const style = h('style', { id: 'explore-module-styles' });
  style.textContent = `
    .explore-stage .ex-task{width:min(900px,100%);margin:auto;display:flex;flex-direction:column;align-items:center;gap:clamp(14px,2.5vh,24px)}
    .explore-stage .ex-pattern{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:clamp(8px,1.5vw,16px);padding:18px;border-radius:24px;background:rgba(255,255,255,.72)}
    .explore-stage .ex-pattern-piece{width:clamp(52px,8vw,82px);height:clamp(52px,8vw,82px);display:grid;place-items:center}
    .explore-stage .ex-pattern-piece svg,.explore-stage .ex-choice-picture svg{width:100%;height:100%;display:block}
    .explore-stage .ex-next{font-size:clamp(38px,7vw,68px);font-weight:800;color:#5c5275;min-width:1.2em;text-align:center}
    .explore-stage .choices{display:flex;justify-content:center;flex-wrap:wrap;gap:14px}
    .explore-stage .choice{min-width:76px;min-height:64px;padding:10px;border-radius:18px}
    .explore-stage .ex-choice-picture{display:block;width:58px;height:58px;margin:auto}
    .explore-stage .ex-shape-options,.explore-stage .ex-measure-board,.explore-stage .ex-chart{width:min(760px,100%);display:grid;gap:12px}
    .explore-stage .ex-shape-card{display:block;width:76px;height:64px;margin:auto}
    .explore-stage .ex-shape-card svg{width:100%;height:100%;display:block}
    .explore-stage .ex-measure-board{padding:16px;border-radius:22px;background:rgba(255,255,255,.72)}
    .explore-stage .ex-measure-row{display:grid;grid-template-columns:minmax(105px,150px) 1fr;align-items:center;gap:12px;min-height:54px}
    .explore-stage .ex-measure-label,.explore-stage .ex-chart-label{font-weight:750;color:#4b4660;text-align:right}
    .explore-stage .ex-units{display:flex;align-items:center;border-left:4px solid #4b4660;padding-left:3px;min-width:0}
    .explore-stage .ex-unit{box-sizing:border-box;width:clamp(24px,5vw,38px);height:36px;border:2px solid rgba(75,70,96,.48);border-right:0}
    .explore-stage .ex-unit:last-child{border-right:2px solid rgba(75,70,96,.48);border-radius:0 8px 8px 0}
    .explore-stage .ex-chart{padding:16px;border-radius:22px;background:rgba(255,255,255,.72)}
    .explore-stage .ex-key{justify-self:center;font-weight:700;color:#5c5275;background:#fff7d6;border-radius:14px;padding:8px 14px}
    .explore-stage .ex-chart-row{display:grid;grid-template-columns:minmax(90px,130px) 1fr;align-items:center;gap:12px;min-height:54px}
    .explore-stage .ex-chart-pictures{display:flex;align-items:center;gap:5px;min-width:0}
    .explore-stage .ex-chart-icon{display:block;width:clamp(34px,5.5vw,50px);height:clamp(34px,5.5vw,50px)}
    .explore-stage .ex-chart-icon svg{width:100%;height:100%;display:block}
    @media(max-width:700px){.explore-stage .ex-pattern{gap:6px;padding:12px}.explore-stage .ex-pattern-piece{width:48px;height:48px}.explore-stage .choice{min-width:68px;min-height:58px}}
  `;
  document.head.append(style);
}

function tokenSvg(token) {
  const common = `fill="${token.colour}" stroke="#4b4660" stroke-width="4"`;
  if (token.shape === 'circle') return `<svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="28" ${common}/></svg>`;
  if (token.shape === 'triangle') return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M40 10L72 68H8Z" ${common} stroke-linejoin="round"/></svg>`;
  if (token.shape === 'diamond') return `<svg viewBox="0 0 80 80" aria-hidden="true"><path d="M40 7L73 40L40 73L7 40Z" ${common} stroke-linejoin="round"/></svg>`;
  return `<svg viewBox="0 0 80 80" aria-hidden="true"><rect x="11" y="11" width="58" height="58" rx="8" ${common}/></svg>`;
}

function tokenNode(data, id, className) {
  const token = data.tokens.find((item) => item.id === id);
  return h('span', { class: className, role: 'img', 'aria-label': token.id.replace('-', ' ') }, svg(tokenSvg(token)));
}

function shapeSvg(shape) {
  const common = `fill="${shape.colour}" stroke="#4b4660" stroke-width="4"`;
  if (shape.id === 'circle') return `<svg viewBox="0 0 100 80" aria-hidden="true"><circle cx="50" cy="40" r="29" ${common}/></svg>`;
  if (shape.id === 'triangle') return `<svg viewBox="0 0 100 80" aria-hidden="true"><path d="M50 7L87 71H13Z" ${common} stroke-linejoin="round"/></svg>`;
  if (shape.id === 'rectangle') return `<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="8" y="18" width="84" height="44" rx="5" ${common}/></svg>`;
  return `<svg viewBox="0 0 100 80" aria-hidden="true"><rect x="19" y="9" width="62" height="62" rx="5" ${common}/></svg>`;
}

function shapeNode(data, id) {
  const shape = data.shapes.find((item) => item.id === id);
  return h('span', { class: 'ex-shape-card', role: 'img', 'aria-label': id }, svg(shapeSvg(shape)));
}

function revealChoice(data, stage, api, label) {
  stage.querySelector(`.choice[data-value="${data.answer}"]`)?.classList.add('is-right');
  return api.say(revealLine(label), 'is-hint');
}

function patternTask(data) {
  return {
    data,
    say: data.say,
    mount(stage, api) {
      ensureStyles();
      stage.classList.add('explore-stage');
      const task = h('div', { class: 'ex-task ex-pattern-task' });
      const pattern = h('div', { class: 'ex-pattern', 'aria-label': 'repeating pattern' },
        data.sequence.map((id) => tokenNode(data, id, 'ex-pattern-piece')),
        h('span', { class: 'ex-next', 'aria-label': 'what comes next' }, '?'),
      );
      task.append(pattern);
      stage.append(task);
      api.ask({
        parent: task,
        options: data.options,
        answer: data.answer,
        text: (id) => tokenNode(data, id, 'ex-choice-picture'),
        sayOption: (id) => `You chose the ${data.tokens.find((token) => token.id === id).shape}.`,
        finalSay: 'Yes. That shape comes next because the pattern repeats.',
      });
      return () => stage.classList.remove('explore-stage');
    },
    hint(stage, api, wrongs) {
      const message = wrongs <= 1
        ? 'Look at the small part that repeats. Then start that part again.'
        : 'Say the pattern slowly from the beginning. What should follow the last shape?';
      return api.say(message, 'is-hint');
    },
  };
}

function shapeTask(data) {
  return {
    data,
    say: data.say,
    mount(stage, api) {
      ensureStyles();
      stage.classList.add('explore-stage');
      const task = h('div', { class: 'ex-task ex-shape-task' });
      stage.append(task);
      api.ask({
        parent: task,
        options: data.options,
        answer: data.answer,
        text: (id) => shapeNode(data, id),
        sayOption: (id) => `You chose the ${id}.`,
        finalSay: `Yes. The ${data.answer} matches every clue.`,
      });
      return () => stage.classList.remove('explore-stage');
    },
    hint(stage, api, wrongs) {
      const message = wrongs <= 1
        ? 'Count the straight sides and corners. Use every clue.'
        : 'Trace around each shape with your finger. Check the side lengths and corners.';
      return api.say(message, 'is-hint');
    },
    reveal(stage, api) { return revealChoice(data, stage, api, `the ${data.answer}`); },
  };
}

function measurementTask(data) {
  const answerItem = data.items.find((item) => item.id === data.answer);
  return {
    data,
    say: data.say,
    mount(stage, api) {
      ensureStyles();
      stage.classList.add('explore-stage');
      const board = h('div', { class: 'ex-measure-board', 'aria-label': 'ribbons measured with equal blocks' });
      for (const item of data.items) {
        const units = h('span', { class: 'ex-units', 'aria-label': `${item.blocks} equal blocks` });
        for (let i = 0; i < item.blocks; i++) units.append(h('i', { class: 'ex-unit', style: { backgroundColor: item.colour } }));
        board.append(h('div', { class: 'ex-measure-row' }, h('span', { class: 'ex-measure-label' }, item.label), units));
      }
      const task = h('div', { class: 'ex-task ex-measure-task' }, board);
      stage.append(task);
      api.ask({
        parent: task,
        options: data.options,
        answer: data.answer,
        text: (id) => data.items.find((item) => item.id === id).label,
        sayOption: (id) => `You chose the ${data.items.find((item) => item.id === id).label}.`,
        finalSay: `Yes. The ${answerItem.label} is ${data.askFor}. It measures ${answerItem.blocks} equal blocks.`,
      });
      return () => stage.classList.remove('explore-stage');
    },
    hint(stage, api, wrongs) {
      const message = wrongs <= 1
        ? 'Start at the dark line and count the equal blocks in each row.'
        : `Compare the block counts. The ${data.askFor} ribbon has the ${data.askFor === 'longest' ? 'most' : 'fewest'} blocks.`;
      return api.say(message, 'is-hint');
    },
  };
}

function chartTask(data) {
  const rowById = (id) => data.rows.find((row) => row.id === id);
  const answerLabel = data.question === 'most' ? rowById(data.answer).label : data.answer;
  const finalSay = data.question === 'howMany'
    ? `Yes. There are ${data.answer} ${rowById(data.target).label}.`
    : data.question === 'most'
      ? `Yes. ${answerLabel} has the most pictures.`
      : `Yes. There are ${data.answer} more ${rowById(data.target).label} than ${rowById(data.compare).label}.`;
  return {
    data,
    say: data.say,
    mount(stage, api) {
      ensureStyles();
      stage.classList.add('explore-stage');
      const chart = h('div', { class: 'ex-chart', 'aria-label': 'picture chart' }, h('div', { class: 'ex-key' }, 'Key: 1 picture = 1'));
      for (const row of data.rows) {
        const pictures = h('span', { class: 'ex-chart-pictures', 'aria-label': `${row.count} ${row.label}` });
        for (let i = 0; i < row.count; i++) pictures.append(h('span', { class: 'ex-chart-icon', html: items[row.icon]() }));
        chart.append(h('div', { class: 'ex-chart-row' }, h('span', { class: 'ex-chart-label' }, row.label), pictures));
      }
      const task = h('div', { class: 'ex-task ex-chart-task' }, chart);
      stage.append(task);
      api.ask({
        parent: task,
        options: data.options,
        answer: data.answer,
        text: (value) => data.question === 'most' ? rowById(value).label : value,
        sayOption: (value) => data.question === 'most' ? `You chose ${rowById(value).label}.` : `You chose ${value}.`,
        finalSay,
      });
      return () => stage.classList.remove('explore-stage');
    },
    hint(stage, api, wrongs) {
      const message = wrongs <= 1
        ? 'Point to each picture and count one at a time. Each picture means one.'
        : data.question === 'most'
          ? 'Count each row. The row with the biggest count has the most.'
          : data.question === 'difference'
            ? 'Count both rows, then compare the two counts.'
            : 'Point to each picture and count one at a time. Each picture means one.';
      return api.say(message, 'is-hint');
    },
  };
}

export function makeExploreTaskData(skillId, level = 1, seed = 1) {
  const random = seeded(seed);
  const safeLevel = Math.max(1, Math.min(3, Number(level) || 1));
  if (skillId === 'explore.patterns') return patternData(safeLevel, random);
  if (skillId === 'explore.shapes') return shapeData(safeLevel, random);
  if (skillId === 'explore.measure') return measurementData(safeLevel, random);
  if (skillId === 'explore.charts') return chartData(safeLevel, random);
  throw new Error(`Unknown explore skill: ${skillId}`);
}

export default {
  id: 'explore',
  title: 'Maths Explorer',
  tagline: 'Patterns, shapes, measures and charts',
  colour: 'blue',
  art: '<svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><circle cx="52" cy="68" r="24" fill="#f26b5b"/><rect x="83" y="44" width="48" height="48" rx="8" fill="#4d9eeb"/><path d="M160 42l28 50h-56z" fill="#f5bd32"/></svg>',
  skills: [
    { id: 'explore.patterns', name: 'Repeating patterns', maxLevel: 3 },
    { id: 'explore.shapes', name: 'Shape clues', maxLevel: 3 },
    { id: 'explore.measure', name: 'Compare lengths', maxLevel: 3 },
    { id: 'explore.charts', name: 'Picture charts', maxLevel: 3 },
  ],
  makeTask(skillId, level, options = {}) {
    const supplied = typeof options === 'number' ? options : options.seed;
    const seed = Number.isFinite(supplied) ? supplied : Math.floor(Math.random() * 0xffffffff);
    const data = makeExploreTaskData(skillId, level, seed);
    if (data.kind === 'patterns') return patternTask(data);
    if (data.kind === 'shapes') return shapeTask(data);
    if (data.kind === 'measure') return measurementTask(data);
    return chartTask(data);
  },
};
