// Deterministic, progress-neutral worked examples for every shipped practice skill.
import { h, svg } from './ui.js';
import { items } from './art.js';

export const DEMONSTRATION_COVERAGE = Object.freeze({
  'sharing.two': { family: 'fair-deal', model: 'deal objects between two plates', maxLevel: 4 },
  'sharing.groups': { family: 'fair-deal', model: 'deal objects around several plates', maxLevel: 4 },
  'sharing.one': { family: 'fair-deal', model: 'collect every object into one group', maxLevel: 2 },
  'groups.pairs': { family: 'equal-groups', model: 'make and count groups of two', maxLevel: 4 },
  'groups.fives': { family: 'equal-groups', model: 'make and skip-count groups of five', maxLevel: 4 },
  'groups.tens': { family: 'equal-groups', model: 'make and skip-count groups of ten', maxLevel: 4 },
  'groups.howmany': { family: 'equal-groups', model: 'partition a total and count the groups', maxLevel: 4 },
  'numbers.find': { family: 'locate-number', model: 'locate a numeral on a bounded track', maxLevel: 4 },
  'numbers.build': { family: 'place-value', model: 'build a number with tens and ones', maxLevel: 4 },
  'numbers.read': { family: 'place-value', model: 'read tens and ones as a number', maxLevel: 4 },
  'numbers.beforeafter': { family: 'number-sequence', model: 'step one place before and after', maxLevel: 4 },
  'numbers.order': { family: 'number-order', model: 'compare and order number cards', maxLevel: 3 },
  'addsub.add': { family: 'addition', model: 'count on or bridge through ten', maxLevel: 4 },
  'addsub.ppw': { family: 'part-part-whole', model: 'split a whole into two known parts', maxLevel: 4 },
  'addsub.maketen': { family: 'make-ten', model: 'split an addend to complete ten', maxLevel: 4 },
  'addsub.sub': { family: 'subtraction', model: 'remove counters and count what remains', maxLevel: 4 },
  'reasoning.mistake': { family: 'correct-error', model: 'model an equation and correct Pip', maxLevel: 4 },
  'reasoning.missing': { family: 'missing-part', model: 'use part-whole structure to find a gap', maxLevel: 4 },
  'reasoning.match': { family: 'equivalent-models', model: 'connect an object model to an equation', maxLevel: 4 },
  'explore.patterns': { family: 'repeating-pattern', model: 'mark the repeat unit and continue it', maxLevel: 3 },
  'explore.shapes': { family: 'shape-properties', model: 'trace sides and corners', maxLevel: 3 },
  'explore.measure': { family: 'equal-unit-measure', model: 'align starts and count equal units', maxLevel: 3 },
  'explore.charts': { family: 'picture-chart', model: 'use a one-picture-one-object key', maxLevel: 3 },
});

const at = (rows, level, variant) => rows[Math.max(0, Math.min(rows.length - 1, level - 1))][variant];
const variantOf = (seed) => Math.abs(Math.trunc(Number(seed) || 0)) % 2;
const groupsOf = (count, size) => Array.from({ length: count }, () => size);
const view = (type, data = {}) => ({ type, ...data });
const step = (say, model) => ({ say, view: model });

function shareDemo(skillId, level, variant) {
  let groupCount, groupSize, leftover = 0, unit = 1;
  if (skillId === 'sharing.two') {
    groupCount = 2;
    if (level === 3) {
      const cfg = variant === 0 ? { size: 4, leftover: 1 } : { size: 6, leftover: 0 };
      groupSize = cfg.size; leftover = cfg.leftover;
    } else {
      groupSize = at([[[3, 4]], [[4, 6]], [[4, 6]], [[20, 40]]].map(([pair]) => pair.map((each) => ({ each }))), level, variant).each;
      if (level === 4) unit = 10;
    }
  } else if (skillId === 'sharing.one') {
    groupCount = 1;
    groupSize = at([[[5, 7]], [[12, 18]]].map(([pair]) => pair.map((each) => ({ each }))), level, variant).each;
  } else {
    const cfg = at([
      [{ count: 3, size: 2, leftover: 0 }, { count: 3, size: 3, leftover: 0 }],
      [{ count: 3, size: 4, leftover: 0 }, { count: 4, size: 3, leftover: 0 }],
      [{ count: 3, size: 3, leftover: 1 }, { count: 4, size: 3, leftover: 2 }],
      [{ count: 3, size: 20 }, { count: 4, size: 20 }],
    ], level, variant);
    groupCount = cfg.count; groupSize = cfg.size; leftover = cfg.leftover || 0;
    if (level === 4) unit = 10;
  }
  const total = groupCount * groupSize + leftover;
  const groups = groupsOf(groupCount, groupSize);
  const objectName = unit === 10 ? 'counters in boxes of ten' : 'counters';
  return {
    facts: { kind: 'share', total, groupCount, groupSize, groups, leftover, unit },
    steps: [
      step(`Start with ${total} ${objectName}.`, view('loose-counters', { total, unit })),
      step(groupCount === 1 ? 'Move every counter into the one group.' : `Deal one ${unit === 10 ? 'box' : 'counter'} to each group, then go around again until no full round is possible.`, view('deal', { total, groupCount, groups, leftover, unit, roundRobin: true })),
      step(groupCount === 1 ? `All ${total} counters are together in one group.` : leftover ? `Each group has ${groupSize}, with ${leftover} left over. Every group has the same, so the share is fair.` : `Each group has ${groupSize}. Every group has the same, so the share is fair.`, view('groups', { groups, leftover, unit })),
    ],
  };
}

function equalGroupsDemo(skillId, level, variant) {
  if (skillId === 'groups.tens' && level === 4) {
    const tens = variant === 0 ? 2 : 4;
    const ones = variant === 0 ? 1 : 9;
    const number = tens * 10 + ones;
    return {
      facts: { kind: 'place', number, tens, ones },
      steps: [
        step(`Start with ${tens} ${tens === 1 ? 'ten' : 'tens'}. That is ${tens * 10}.`, view('place-value', { tens, ones: 0, focus: 'tens' })),
        step(`Now count on the ${ones} ${ones === 1 ? 'one' : 'ones'}.`, view('place-value', { tens, ones, focus: 'ones' })),
        step(`${tens} ${tens === 1 ? 'ten' : 'tens'} and ${ones} ${ones === 1 ? 'one' : 'ones'} make ${number}.`, view('place-value', { tens, ones })),
      ],
    };
  }
  let groupSize, groupCount;
  if (skillId === 'groups.pairs') { groupSize = 2; groupCount = level + 2 + variant; }
  else if (skillId === 'groups.fives') { groupSize = 5; groupCount = level + 1 + variant; }
  else if (skillId === 'groups.tens') { groupSize = 10; groupCount = [2, 3, 4, 6][level - 1] + variant; }
  else {
    groupSize = at([[2, 2], [2, 3], [3, 4], [4, 5]], level, variant);
    groupCount = level === 4 ? (variant === 0 ? 3 : 2) : 3 + variant;
  }
  const leftover = skillId === 'groups.howmany' && level === 4 ? (variant === 0 ? 1 : 2) : 0;
  const total = groupSize * groupCount + leftover;
  const groups = groupsOf(groupCount, groupSize);
  const sequence = groups.map((_, index) => (index + 1) * groupSize);
  const noun = groupSize === 2 ? 'pair' : 'group';
  return {
    facts: { kind: 'groups', total, groupCount, groupSize, groups, leftover },
    steps: [
      step(`There are ${total} counters. We will put ${groupSize} in every ${noun}.`, view('loose-counters', { total })),
      step(`Make one ${noun} at a time. Stop each time the ${noun} has ${groupSize}.`, view('groups', { groups, leftover })),
      step(skillId === 'groups.howmany' ? leftover ? `Count the finished groups. There are ${groupCount} groups, with ${leftover} left over.` : `Count the finished groups. There are ${groupCount} groups.` : `Skip-count the equal groups: ${sequence.join(', ')}. The total is ${total}.`, view('skip-count', { groups, sequence, leftover })),
    ],
  };
}

const NUMBER_EXAMPLES = {
  'numbers.find': [[[13, 17]], [[34, 48]], [[67, 83]], [[106, 118]]],
  'numbers.build': [[[16, 18]], [[32, 47]], [[64, 91]], [[104, 117]]],
  'numbers.read': [[[15, 19]], [[37, 42]], [[76, 93]], [[108, 116]]],
  'numbers.beforeafter': [[[8, 14]], [[29, 41]], [[68, 93]], [[108, 117]]],
};

function numberDemo(skillId, level, variant) {
  const number = NUMBER_EXAMPLES[skillId][level - 1][0][variant];
  if (skillId === 'numbers.find') {
    const start = Math.floor(number / 10) * 10;
    const end = start + 10;
    return {
      facts: { kind: 'locate', target: number, start, end },
      steps: [
        step(`Start at the nearest ten below ${number}. That is ${start}.`, view('number-line', { start, end, highlight: start })),
        step(`Start at ${start} and count on to ${number}.`, view('number-line', { start, end, highlight: number })),
        step(`This is ${number}. Its place on the track matches its number name.`, view('number-line', { start, end, highlight: number, answer: true })),
      ],
    };
  }
  if (skillId === 'numbers.beforeafter') {
    const before = number - 1, after = number + 1;
    return {
      facts: { kind: 'neighbours', before, number, after },
      steps: [
        step(`Put ${number} in the middle.`, view('number-line', { start: before, end: after, highlight: number })),
        step(`One step back is ${before}. That number comes before ${number}.`, view('number-line', { start: before, end: after, highlight: before })),
        step(`One step forward is ${after}. That number comes after ${number}.`, view('number-line', { start: before, end: after, highlight: after })),
      ],
    };
  }
  const tens = Math.floor(number / 10), ones = number % 10;
  const read = skillId === 'numbers.read';
  return {
    facts: { kind: 'place', number, tens, ones },
    steps: [
      step(read ? 'Look at the long tens rods first.' : `We will build ${number} with tens and ones.`, view('place-value', { tens: read ? tens : 0, ones: 0 })),
      step(`${tens} ${tens === 1 ? 'ten makes' : 'tens make'} ${tens * 10}.`, view('place-value', { tens, ones: 0, focus: 'tens' })),
      step(`${ones} ${ones === 1 ? 'one joins' : 'ones join'} the tens. ${tens * 10} and ${ones} make ${number}.`, view('place-value', { tens, ones, focus: 'ones' })),
    ],
  };
}

function orderDemo(level, variant) {
  const values = at([
    [[4, 11, 7], [3, 9, 6]],
    [[18, 35, 24], [22, 49, 31]],
    [[72, 105, 89, 116], [61, 118, 94, 47]],
  ], level, variant);
  const sorted = values.slice().sort((a, b) => a - b);
  return {
    facts: { kind: 'order', values, sorted },
    steps: [
      step(`Compare these numbers: ${values.join(', ')}.`, view('number-cards', { values })),
      step(`The smallest number is ${sorted[0]}. Put it first.`, view('number-cards', { values: [sorted[0]], waiting: values.filter((n) => n !== sorted[0]) })),
      step(`Now compare what is left. Smallest to biggest is ${sorted.join(', ')}.`, view('number-cards', { values: sorted, answer: true })),
    ],
  };
}

const ADD_EXAMPLES = [
  [[4, 3], [5, 2]],
  [[7, 5], [8, 4]],
  [[8, 7], [6, 8]],
  [[9, 8], [7, 9]],
];
const MAKE_TEN_EXAMPLES = [
  [[8, 4], [9, 3]],
  [[7, 6], [8, 5]],
  [[9, 7], [6, 8]],
  [[8, 9], [7, 9]],
];

function additionDemo(skillId, level, variant) {
  if (skillId === 'addsub.maketen' && level === 4) {
    const [a, b] = variant === 0 ? [8, 8] : [7, 8];
    const total = a + b;
    const strategy = a === b ? 'double' : 'double-plus-one';
    const steps = a === b ? [
      step(`Start with two equal groups of ${a}.`, view('counter-row', { first: a, second: b })),
      step(`Double ${a} means ${a} and ${a} more.`, view('counter-row', { first: a, second: a })),
      step(`Double ${a} is ${total}.`, view('equation', { text: `${a} + ${b} = ${total}` })),
    ] : [
      step(`Start with ${a} plus ${b}. The numbers are one apart.`, view('counter-row', { first: a, second: b })),
      step(`Double ${a} first. ${a} plus ${a} is ${a + a}.`, view('counter-row', { first: a, second: a })),
      step(`Now add the one more. ${a + a} and one more make ${total}.`, view('equation', { text: `${a} + ${b} = ${total}` })),
    ];
    return { facts: { kind: 'add', a, b, total, strategy, toTen: 0, remaining: b }, steps };
  }
  const [a, b] = (skillId === 'addsub.maketen' ? MAKE_TEN_EXAMPLES : ADD_EXAMPLES)[level - 1][variant];
  const total = a + b;
  const strategy = total > 10 ? 'make-ten' : 'count-on';
  const toTen = strategy === 'make-ten' ? 10 - a : 0;
  const remaining = strategy === 'make-ten' ? b - toTen : b;
  const steps = strategy === 'make-ten' ? [
    step(`Start with ${a}, then add ${b}.`, view('ten-frame', { first: a, second: 0, spare: b, total: a })),
    step(`Split ${b} into ${toTen} and ${remaining}. Move ${toTen} to fill ten.`, view('ten-frame', { first: a, second: toTen, spare: remaining, total: 10 })),
    step(`Ten is full. Add the ${remaining} left over. Ten and ${remaining} make ${total}.`, view('ten-frame', { first: 10, second: remaining, total })),
  ] : [
    step(`Start with ${a}. Keep that number in your head.`, view('counter-row', { first: a, second: 0 })),
    step(`Add ${b} more counters and count on from ${a}.`, view('counter-row', { first: a, second: b })),
    step(`${a} plus ${b} is ${total}.`, view('equation', { text: `${a} + ${b} = ${total}` })),
  ];
  return { facts: { kind: 'add', a, b, total, strategy, toTen, remaining }, steps };
}

function partWholeDemo(level, variant) {
  const [whole, partA] = at([
    [[5, 2], [7, 4]],
    [[8, 5], [10, 4]],
    [[9, 5], [10, 6]],
    [[17, 9], [20, 12]],
  ], level, variant);
  const partB = whole - partA;
  return {
    facts: { kind: 'partwhole', whole, partA, partB },
    steps: [
      step(`The whole is ${whole}.`, view('part-whole', { whole, partA: null, partB: null })),
      step(`One part is ${partA}. Move those counters into the first part.`, view('part-whole', { whole, partA, partB: null })),
      step(`${partB} counters are left for the other part. ${partA} and ${partB} make ${whole}.`, view('part-whole', { whole, partA, partB })),
    ],
  };
}

function subtractionDemo(level, variant) {
  const [start, take] = at([
    [[8, 3], [9, 4]],
    [[12, 5], [10, 4]],
    [[16, 7], [17, 8]],
    [[18, 12], [17, 9]],
  ], level, variant);
  const left = start - take;
  return {
    facts: { kind: 'subtract', start, take, left },
    steps: [
      step(`Start with ${start} counters.`, view('remove-counters', { start, take: 0, left: start })),
      step(`Take away ${take}. Move those counters out of the group.`, view('remove-counters', { start, take, left })),
      step(`Count what remains. ${start} take away ${take} is ${left}.`, view('equation', { text: `${start} − ${take} = ${left}` })),
    ],
  };
}

function reasoningDemo(skillId, level, variant) {
  if (skillId === 'reasoning.mistake') {
    const data = at([
      [{ a: 3, b: 2, operation: 'add', shown: 6 }, { a: 4, b: 3, operation: 'add', shown: 8 }],
      [{ a: 7, b: 4, operation: 'add', shown: 12 }, { a: 8, b: 5, operation: 'add', shown: 14 }],
      [{ a: 7, b: 6, operation: 'add', shown: 12 }, { a: 9, b: 5, operation: 'add', shown: 15 }],
      [{ a: 13, b: 6, operation: 'add', shown: 18 }, { a: 11, b: 9, operation: 'add', shown: 19 }],
    ], level, variant);
    const correct = data.operation === 'add' ? data.a + data.b : data.a - data.b;
    const symbol = data.operation === 'add' ? '+' : '−';
    const spokenOperator = data.operation === 'add' ? 'plus' : 'take away';
    return {
      facts: { kind: 'mistake', ...data, correct },
      steps: [
        step(`Pip wrote ${data.a} ${spokenOperator} ${data.b} equals ${data.shown}. Let us check the model.`, view('equation', { text: `${data.a} ${symbol} ${data.b} = ${data.shown}`, wrong: true })),
        step(data.operation === 'add' ? `Join ${data.a} counters and ${data.b} counters, then count them all.` : `Show ${data.a} counters, remove ${data.b}, then count what remains.`, view(data.operation === 'add' ? 'counter-row' : 'remove-counters', data.operation === 'add' ? { first: data.a, second: data.b } : { start: data.a, take: data.b, left: correct })),
        step(`The model shows ${correct}, not ${data.shown}. The correct equation is ${data.a} ${spokenOperator} ${data.b} equals ${correct}.`, view('equation', { text: `${data.a} ${symbol} ${data.b} = ${correct}`, answer: true })),
      ],
    };
  }
  if (skillId === 'reasoning.missing') {
    const [whole, partA] = at([
      [[7, 3], [8, 5]], [[10, 6], [12, 7]], [[15, 8], [16, 9]], [[20, 13], [18, 11]],
    ], level, variant);
    const partB = whole - partA;
    return {
      facts: { kind: 'partwhole', whole, partA, partB },
      steps: [
        step(`${partA} plus a missing part makes ${whole}.`, view('part-whole', { whole, partA, partB: null })),
        step(`Build the whole ${whole}, then cover the known part ${partA}.`, view('part-whole', { whole, partA, partB: null, focus: 'gap' })),
        step(`${partB} counters are not covered, so the missing part is ${partB}.`, view('part-whole', { whole, partA, partB })),
      ],
    };
  }
  const right = at([[5, 7], [8, 10], [12, 14], [16, 18]], level, variant);
  const leftA = Math.max(2, Math.floor(right / 2));
  const leftB = right - leftA;
  return {
    facts: { kind: 'match', left: leftA + leftB, right },
    steps: [
      step(`The object model has ${right} counters.`, view('loose-counters', { total: right })),
      step(`Split the same amount into ${leftA} and ${leftB}.`, view('counter-row', { first: leftA, second: leftB })),
      step(`${leftA} plus ${leftB} equals ${right}, so the equation matches the objects.`, view('equation', { text: `${leftA} + ${leftB} = ${right}` })),
    ],
  };
}

function explorerDemo(skillId, level, variant) {
  if (skillId === 'explore.patterns') {
    const units = [
      [['circle', 'square'], ['triangle', 'circle']],
      [['circle', 'square', 'triangle'], ['square', 'diamond', 'circle']],
      [['circle', 'square', 'triangle', 'diamond'], ['diamond', 'circle', 'square', 'triangle']],
    ];
    const unit = units[level - 1][variant];
    const sequence = Array.from({ length: unit.length * 2 + 1 }, (_, index) => unit[index % unit.length]);
    const answer = unit[sequence.length % unit.length];
    return {
      facts: { kind: 'pattern', unit, sequence, answer },
      steps: [
        step(`Look for the smallest part that repeats: ${unit.join(', ')}.`, view('pattern', { unit, sequence: unit })),
        step(`The same unit appears again in the same order.`, view('pattern', { unit, sequence: unit.concat(unit), marked: true })),
        step(`After ${sequence.at(-1)} the unit starts again, so ${answer} comes next.`, view('pattern', { unit, sequence: sequence.concat(answer), answer })),
      ],
    };
  }
  if (skillId === 'explore.shapes') {
    const names = level === 1 ? ['triangle', 'circle'] : level === 2 ? ['square', 'rectangle'] : ['rectangle', 'triangle'];
    const name = names[variant];
    const props = {
      circle: { sides: 0, corners: 0, sideNames: [], cornerNames: [] },
      triangle: { sides: 3, corners: 3, sideNames: ['bottom', 'left', 'right'], cornerNames: ['top', 'left', 'right'] },
      square: { sides: 4, corners: 4, sideNames: ['top', 'right', 'bottom', 'left'], cornerNames: ['top left', 'top right', 'bottom right', 'bottom left'] },
      rectangle: { sides: 4, corners: 4, sideNames: ['top', 'right', 'bottom', 'left'], cornerNames: ['top left', 'top right', 'bottom right', 'bottom left'] },
    }[name];
    return {
      facts: { kind: 'shape', name, ...props },
      steps: [
        step(`Trace around the ${name}.`, view('shape', { name, trace: 0 })),
        step(name === 'circle' ? 'The edge curves all the way around. There are no straight sides.' : `Count the straight sides: ${props.sides}.`, view('shape', { name, trace: 'sides' })),
        step(name === 'circle' ? 'A circle has no corners.' : `Count the corners: ${props.corners}. These properties tell us it is a ${name}.`, view('shape', { name, trace: 'corners' })),
      ],
    };
  }
  if (skillId === 'explore.measure') {
    const configs = [
      [{ lengths: [3, 6], askFor: 'longest' }, { lengths: [4, 7], askFor: 'longest' }],
      [{ lengths: [5, 6], askFor: 'shortest' }, { lengths: [4, 6], askFor: 'shortest' }],
      [{ lengths: [4, 7, 6], askFor: 'longest' }, { lengths: [5, 3, 6], askFor: 'shortest' }],
    ];
    const cfg = configs[level - 1][variant];
    const answer = cfg.askFor === 'longest' ? Math.max(...cfg.lengths) : Math.min(...cfg.lengths);
    return {
      facts: { kind: 'measure', ...cfg, answer, sameUnit: true },
      steps: [
        step('Line up every ribbon at the same starting line.', view('measure', { lengths: cfg.lengths, aligned: true, units: false })),
        step('Use equal blocks with no gaps or overlaps, then count each row.', view('measure', { lengths: cfg.lengths, aligned: true, units: true })),
        step(`Compare the counts. The ${cfg.askFor} ribbon measures ${answer} equal blocks.`, view('measure', { lengths: cfg.lengths, aligned: true, units: true, answer })),
      ],
    };
  }
  const rows = level === 1
    ? (variant ? [{ id: 'carrots', count: 5 }, { id: 'apples', count: 2 }] : [{ id: 'apples', count: 2 }, { id: 'carrots', count: 5 }])
    : (variant ? [{ id: 'apples', count: 3 }, { id: 'carrots', count: 6 }, { id: 'muffins', count: 4 }] : [{ id: 'apples', count: 5 }, { id: 'carrots', count: 2 }, { id: 'muffins', count: 3 }]);
  const question = level === 1 ? 'howMany' : level === 2 ? 'most' : 'difference';
  const sorted = rows.slice().sort((a, b) => b.count - a.count);
  const target = level === 1 ? rows[0].id : sorted[0].id;
  const answer = question === 'howMany' ? rows[0].count : question === 'most' ? sorted[0].id : sorted[0].count - sorted.at(-1).count;
  return {
    facts: { kind: 'chart', key: 1, rows, question, target, answer },
    steps: [
      step('Read the key first. One picture means one object.', view('chart', { rows, key: 1, counted: [] })),
      step('Point to each picture and count one at a time in every row.', view('chart', { rows, key: 1, counted: rows.map((row) => row.id) })),
      step(question === 'howMany' ? `The ${target} row has ${answer} pictures, so it shows ${answer} ${target}.` : question === 'most' ? `The ${answer} row has the biggest count, so that row has the most.` : `The biggest count is ${sorted[0].count} and the smallest is ${sorted.at(-1).count}. The difference is ${answer}.`, view('chart', { rows, key: 1, answer })),
    ],
  };
}

export function makeDemonstration(skillId, level = 1, { seed = 0 } = {}) {
  const coverage = DEMONSTRATION_COVERAGE[skillId];
  if (!coverage) throw new Error(`No demonstration for skill: ${skillId}`);
  const safeLevel = Math.max(1, Math.min(coverage.maxLevel, Math.round(Number(level) || 1)));
  const variant = variantOf(seed);
  let built;
  if (skillId.startsWith('sharing.')) built = shareDemo(skillId, safeLevel, variant);
  else if (skillId.startsWith('groups.')) built = equalGroupsDemo(skillId, safeLevel, variant);
  else if (skillId === 'numbers.order') built = orderDemo(safeLevel, variant);
  else if (skillId.startsWith('numbers.')) built = numberDemo(skillId, safeLevel, variant);
  else if (skillId === 'addsub.add' || skillId === 'addsub.maketen') built = additionDemo(skillId, safeLevel, variant);
  else if (skillId === 'addsub.ppw') built = partWholeDemo(safeLevel, variant);
  else if (skillId === 'addsub.sub') built = subtractionDemo(safeLevel, variant);
  else if (skillId.startsWith('reasoning.')) built = reasoningDemo(skillId, safeLevel, variant);
  else built = explorerDemo(skillId, safeLevel, variant);
  return {
    skillId,
    level: safeLevel,
    seed: Number(seed) || 0,
    family: coverage.family,
    model: coverage.model,
    title: `Show me: ${coverage.model}`,
    facts: built.facts,
    steps: built.steps,
  };
}

export const buildDemonstration = makeDemonstration;

export function validateDemonstration(demo) {
  const errors = [];
  if (!demo || !DEMONSTRATION_COVERAGE[demo.skillId]) errors.push('unknown skill');
  if (!Number.isInteger(demo?.level) || demo.level < 1) errors.push('invalid level');
  if (!Array.isArray(demo?.steps) || demo.steps.length < 3 || demo.steps.length > 5) errors.push('invalid steps');
  for (const [index, item] of (demo?.steps || []).entries()) {
    if (!item?.say || typeof item.say !== 'string') errors.push(`step ${index} has no narration`);
    if (!item?.view?.type) errors.push(`step ${index} has no visual model`);
  }
  if (!demo?.facts?.kind) errors.push('missing facts');
  return errors;
}

function exhaustiveVoiceLines() {
  const lines = [];
  for (const [skillId, coverage] of Object.entries(DEMONSTRATION_COVERAGE)) {
    for (let level = 1; level <= coverage.maxLevel; level++) {
      for (const seed of [0, 1]) lines.push(...makeDemonstration(skillId, level, { seed }).steps.map((item) => item.say));
    }
  }
  return [...new Set(lines)];
}

export const DEMONSTRATION_VOICE_LINES = Object.freeze(exhaustiveVoiceLines());

function ensureDemoStyles() {
  if (document.getElementById('demonstration-styles')) return;
  const style = h('style', { id: 'demonstration-styles' });
  style.textContent = `
    .demo-worked{box-sizing:border-box;width:min(940px,100%);max-height:100%;margin:auto;padding:clamp(12px,2vw,22px);display:grid;grid-template-rows:auto auto minmax(190px,1fr) auto;gap:12px;border:3px solid #d8cff3;border-radius:26px;background:#fffdf8;color:#39334d;overflow:auto}
    .demo-worked *{box-sizing:border-box}.demo-worked h2{margin:0;font:800 clamp(22px,3vw,32px)/1.15 Fredoka,sans-serif;text-align:center}.demo-narration{min-height:2.8em;margin:0;padding:9px 14px;border-radius:16px;background:#f3efff;font:700 clamp(17px,2.3vw,22px)/1.3 Nunito,sans-serif;text-align:center}
    .demo-model{min-height:190px;display:grid;place-items:center;padding:10px;border-radius:20px;background:#fff8e7;overflow:auto}.demo-model-inner{width:100%;display:grid;place-items:center;gap:12px;opacity:.15;transform:translateY(8px);transition:opacity .3s ease,transform .3s ease}.demo-model-inner.is-shown,.demo-worked[data-reduced-motion="true"] .demo-model-inner{opacity:1;transform:none;transition:none}
    .demo-controls{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:9px}.demo-controls button{min-width:52px;min-height:48px;padding:10px 15px;border:2px solid #7365a8;border-radius:15px;background:white;color:#39334d;font:800 16px/1 Nunito,sans-serif;touch-action:manipulation}.demo-controls button.demo-primary{background:#4d9eeb;border-color:#2f78bb;color:white}.demo-controls button:disabled{opacity:.4}.demo-progress{font-weight:800;color:#7365a8}
    .demo-counter-set,.demo-counter-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:7px;max-width:650px}.demo-dot{width:28px;height:28px;border:3px solid #a94e35;border-radius:50%;background:#ff8c65}.demo-dot.demo-second{border-color:#276fa9;background:#67b8ee}.demo-dot.is-removed{opacity:.28;text-decoration:line-through;transform:scale(.8)}
    .demo-rods{display:flex;flex-wrap:wrap;justify-content:center;gap:8px}.demo-rod{width:28px;height:104px;border:3px solid #2b78b6;border-radius:8px;background:repeating-linear-gradient(to bottom,#66b9f1 0 8px,#2b78b6 8px 10px);display:grid;place-items:center;font-weight:900;color:#173f61}.demo-one{width:28px;height:28px;border:3px solid #3a9169;border-radius:6px;background:#75d5a4}.demo-ten-box{min-width:48px;height:48px;border:3px solid #a66b28;border-radius:10px;background:#f1c27d;display:grid;place-items:center;font-weight:900;color:#664017}
    .demo-groups{width:100%;display:flex;justify-content:center;align-items:stretch;flex-wrap:wrap;gap:10px}.demo-group{min-width:95px;max-width:190px;flex:1 1 120px;padding:10px;border:3px solid #e1b965;border-radius:20px;background:white;display:grid;align-content:center;gap:7px}.demo-group b{text-align:center}.demo-deal .demo-dot,.demo-deal .demo-ten-box{animation:demoDeal .48s both;animation-delay:var(--delay)}.demo-leftover{padding:9px 13px;border:3px dashed #ff8c42;border-radius:15px;background:#fff4dc;display:grid;gap:5px;place-items:center}@keyframes demoDeal{from{opacity:0;transform:translateY(-35px) scale(.6)}to{opacity:1;transform:none}}
    .demo-number-line{width:min(720px,100%);display:flex;justify-content:center;align-items:flex-end;gap:0}.demo-mark{min-width:42px;padding:24px 5px 5px;border-bottom:5px solid #6f6590;text-align:center;font-weight:800;position:relative}.demo-mark:after{content:"";position:absolute;bottom:-9px;left:50%;width:4px;height:13px;background:#6f6590}.demo-mark.is-focus{color:#bd4b35;background:#ffe3bb;border-radius:12px 12px 0 0;font-size:1.25em}
    .demo-place{display:flex;align-items:flex-end;justify-content:center;gap:24px}.demo-place-section{padding:12px;border:3px solid #d9d1ec;border-radius:18px;background:white}.demo-place-section h3{margin:0 0 8px;text-align:center}.demo-place-section.is-focus{border-color:#ff8c42;box-shadow:0 0 0 4px #ffe0c4}
    .demo-cards{display:flex;justify-content:center;flex-wrap:wrap;gap:12px}.demo-card{min-width:72px;padding:18px;border:3px solid #7b6db1;border-radius:16px;background:white;text-align:center;font:900 28px Fredoka,sans-serif}.demo-card.is-waiting{opacity:.45}
    .demo-tenframes{display:flex;justify-content:center;flex-wrap:wrap;gap:14px}.demo-tenframe{display:grid;grid-template-columns:repeat(5,34px);grid-template-rows:repeat(2,34px);gap:4px;padding:7px;border:3px solid #6f6590;border-radius:12px;background:white}.demo-cell{border:2px solid #d4cee5;border-radius:50%}.demo-cell.first{background:#ff8c65;border-color:#a94e35}.demo-cell.second{background:#67b8ee;border-color:#276fa9}.demo-spare{padding:8px 13px;border-radius:13px;background:#e8f4fd;font-weight:800;display:grid;gap:6px;place-items:center}
    .demo-equation{padding:18px 24px;border:3px solid #7b6db1;border-radius:18px;background:white;font:900 clamp(30px,6vw,52px) Fredoka,sans-serif}.demo-equation.is-wrong{border-color:#d75f55;text-decoration:line-through}.demo-equation.is-answer{border-color:#3fa879}
    .demo-part-whole{display:grid;grid-template-columns:repeat(2,minmax(100px,180px));grid-template-areas:"whole whole" "a b";gap:18px}.demo-part{min-height:92px;padding:12px;border:3px solid #7b6db1;border-radius:50%;background:white;display:grid;place-items:center;text-align:center;font:800 20px Nunito,sans-serif}.demo-part.whole{grid-area:whole}.demo-part.a{grid-area:a}.demo-part.b{grid-area:b}.demo-part.is-gap{border-style:dashed;background:#fff3c9}
    .demo-pattern{display:flex;justify-content:center;align-items:center;flex-wrap:wrap;gap:9px}.demo-pattern-shape,.demo-big-shape{display:block;width:62px;height:62px}.demo-big-shape{width:180px;height:140px}.demo-pattern-shape svg,.demo-big-shape svg{width:100%;height:100%}.demo-pattern-unit{padding:8px;border:3px dashed #ff8c42;border-radius:16px}
    .demo-measure{width:min(720px,100%);display:grid;gap:10px}.demo-measure-row{display:flex;align-items:center;border-left:5px solid #4b4660;padding-left:4px}.demo-ribbon{height:38px;border:2px solid #357cae;border-radius:0 9px 9px 0;background:#67b8ee}.demo-unit{width:clamp(28px,5vw,42px);height:38px;border:2px solid #4b4660;border-right:0;background:#67b8ee}.demo-unit:last-child{border-right:2px solid #4b4660}.demo-measure-row.is-answer{outline:4px solid #ff8c42;border-radius:6px}
    .demo-chart{width:min(720px,100%);display:grid;gap:9px}.demo-chart-key{justify-self:center;padding:7px 12px;border-radius:12px;background:white;font-weight:800}.demo-chart-row{display:grid;grid-template-columns:100px 1fr;gap:8px;align-items:center}.demo-chart-row b{text-align:right}.demo-chart-icons{display:flex;gap:4px}.demo-chart-icon{width:42px;height:42px}.demo-chart-icon svg{width:100%;height:100%}
    .demo-worked[data-reduced-motion="true"] .demo-deal .demo-dot,.demo-worked[data-reduced-motion="true"] .demo-deal .demo-ten-box{animation:none}.demo-label{font-weight:850;text-align:center}.demo-focus-note{padding:6px 10px;border-radius:10px;background:#fff0b8;font-weight:800;text-align:center}
    @media(max-width:800px){.demo-worked{border-radius:18px;padding:10px;gap:9px}.demo-model{min-height:170px;padding:7px}.demo-dot{width:24px;height:24px}.demo-group{min-width:82px;padding:7px}.demo-controls{gap:6px}.demo-controls button{padding:9px 11px}.demo-mark{min-width:34px}.demo-place{gap:10px}.demo-rod{height:82px}.demo-chart-row{grid-template-columns:82px 1fr}.demo-chart-icon{width:34px;height:34px}}
  `;
  document.head.append(style);
}

function counterSet(count, { secondFrom = Infinity, removedFrom = Infinity } = {}) {
  const wrap = h('div', { class: count > 30 ? 'demo-rods' : 'demo-counter-set', dataset: { total: String(count) }, 'aria-label': `${count} counters` });
  if (count > 30) {
    const tens = Math.floor(count / 10), ones = count % 10;
    for (let i = 0; i < tens; i++) wrap.append(h('span', { class: 'demo-rod', 'aria-label': 'ten' }, '10'));
    for (let i = 0; i < ones; i++) wrap.append(h('span', { class: 'demo-one', 'aria-label': 'one' }));
    return wrap;
  }
  for (let i = 0; i < count; i++) wrap.append(h('span', { class: `demo-dot${i >= secondFrom ? ' demo-second' : ''}${i >= removedFrom ? ' is-removed' : ''}`, 'aria-hidden': 'true' }));
  return wrap;
}

function shapeMarkup(name) {
  const common = 'fill="#67b8ee" stroke="#3f5275" stroke-width="5"';
  if (name === 'circle') return `<svg viewBox="0 0 180 140" aria-label="circle"><circle cx="90" cy="70" r="52" ${common}/></svg>`;
  if (name === 'triangle') return `<svg viewBox="0 0 180 140" aria-label="triangle"><path d="M90 12L163 125H17Z" ${common} stroke-linejoin="round"/></svg>`;
  if (name === 'rectangle') return `<svg viewBox="0 0 180 140" aria-label="rectangle"><rect x="15" y="36" width="150" height="72" rx="5" ${common}/></svg>`;
  if (name === 'diamond') return `<svg viewBox="0 0 180 140" aria-label="diamond"><path d="M90 10L166 70L90 130L14 70Z" ${common}/></svg>`;
  return `<svg viewBox="0 0 180 140" aria-label="square"><rect x="32" y="12" width="116" height="116" rx="5" ${common}/></svg>`;
}

function smallShape(name) {
  return h('span', { class: 'demo-pattern-shape', role: 'img', 'aria-label': name }, svg(shapeMarkup(name)));
}

function tenBoxes(count) {
  const wrap = h('div', { class: 'demo-counter-set', dataset: { total: String(count * 10) }, 'aria-label': `${count} boxes of ten` });
  for (let i = 0; i < count; i++) wrap.append(h('span', { class: 'demo-ten-box', 'aria-label': 'box of ten' }, '10'));
  return wrap;
}

function groupCards(groups, dealt = false, unit = 1, leftover = 0) {
  const wrap = h('div', { class: `demo-groups${dealt ? ' demo-deal' : ''}` });
  groups.forEach((size, groupIndex) => {
    const card = h('div', { class: 'demo-group', dataset: { count: String(size) } }, h('b', {}, `Group ${groupIndex + 1}`));
    const set = unit === 10 ? tenBoxes(size / 10) : counterSet(size);
    if (dealt) [...set.children].forEach((dot, itemIndex) => dot.style.setProperty('--delay', `${(itemIndex * groups.length + groupIndex) * 55}ms`));
    card.append(set);
    wrap.append(card);
  });
  if (leftover) wrap.append(h('div', { class: 'demo-leftover', dataset: { leftover: String(leftover) } }, h('b', {}, 'Left over'), counterSet(leftover)));
  return wrap;
}

function renderModel(model) {
  const root = h('div', { class: 'demo-model-inner', dataset: { model: model.type } });
  if (model.type === 'loose-counters') root.append(model.unit === 10 ? tenBoxes(model.total / 10) : counterSet(model.total));
  else if (model.type === 'deal') root.append(groupCards(model.groups, true, model.unit || 1, model.leftover || 0));
  else if (model.type === 'groups') root.append(groupCards(model.groups, false, model.unit || 1, model.leftover || 0));
  else if (model.type === 'skip-count') {
    root.append(groupCards(model.groups, false, model.unit || 1, model.leftover || 0), h('div', { class: 'demo-focus-note' }, model.sequence.join(' → ')));
  } else if (model.type === 'number-line') {
    const line = h('div', { class: 'demo-number-line' });
    for (let n = model.start; n <= model.end; n++) line.append(h('span', { class: `demo-mark${n === model.highlight ? ' is-focus' : ''}` }, String(n)));
    root.append(line);
  } else if (model.type === 'place-value') {
    const tensSet = h('div', { class: 'demo-rods', dataset: { total: String(model.tens * 10) }, 'aria-label': `${model.tens} ${model.tens === 1 ? 'ten' : 'tens'}` });
    for (let i = 0; i < model.tens; i++) tensSet.append(h('span', { class: 'demo-rod', 'aria-label': 'ten' }, '10'));
    const onesSet = h('div', { class: 'demo-counter-set', dataset: { total: String(model.ones) }, 'aria-label': `${model.ones} ${model.ones === 1 ? 'one' : 'ones'}` });
    for (let i = 0; i < model.ones; i++) onesSet.append(h('span', { class: 'demo-one', 'aria-label': 'one' }));
    const tens = h('div', { class: `demo-place-section${model.focus === 'tens' ? ' is-focus' : ''}` }, h('h3', {}, 'Tens'), tensSet);
    const ones = h('div', { class: `demo-place-section${model.focus === 'ones' ? ' is-focus' : ''}` }, h('h3', {}, 'Ones'), onesSet);
    root.append(h('div', { class: 'demo-place' }, tens, ones));
  } else if (model.type === 'number-cards') {
    const cards = h('div', { class: 'demo-cards' });
    for (const n of model.values || []) cards.append(h('span', { class: 'demo-card' }, String(n)));
    for (const n of model.waiting || []) cards.append(h('span', { class: 'demo-card is-waiting' }, String(n)));
    root.append(cards);
  } else if (model.type === 'ten-frame') {
    const frames = h('div', { class: 'demo-tenframes', dataset: { total: String(model.total) } });
    const filled = Math.min(20, model.total || 0);
    for (let frame = 0; frame < Math.max(1, Math.ceil(filled / 10)); frame++) {
      const box = h('div', { class: 'demo-tenframe' });
      for (let i = 0; i < 10; i++) {
        const index = frame * 10 + i;
        const cls = index < Math.min(model.first, filled) ? ' first' : index < filled ? ' second' : '';
        box.append(h('span', { class: `demo-cell${cls}` }));
      }
      frames.append(box);
    }
    root.append(frames);
    if (model.spare) root.append(h('div', { class: 'demo-spare' }, h('span', {}, 'Waiting'), counterSet(model.spare, { secondFrom: 0 })));
  } else if (model.type === 'counter-row') {
    root.append(counterSet(model.first + model.second, { secondFrom: model.first }));
  } else if (model.type === 'equation') {
    root.append(h('div', { class: `demo-equation${model.wrong ? ' is-wrong' : ''}${model.answer ? ' is-answer' : ''}` }, model.text));
  } else if (model.type === 'part-whole') {
    const part = (cls, label, value, gap = false) => h('div', { class: `demo-part ${cls}${gap ? ' is-gap' : ''}` }, h('b', {}, label), h('span', {}, value == null ? '?' : String(value)));
    root.append(h('div', { class: 'demo-part-whole' }, part('whole', 'Whole', model.whole), part('a', 'Part', model.partA, model.partA == null), part('b', 'Part', model.partB, model.partB == null)));
  } else if (model.type === 'remove-counters') {
    root.append(counterSet(model.start, { removedFrom: model.left }), h('div', { class: 'demo-focus-note' }, `${model.take} moved away · ${model.left} left`));
  } else if (model.type === 'pattern') {
    const row = h('div', { class: 'demo-pattern' });
    (model.sequence || []).forEach((name, index) => {
      const piece = smallShape(name);
      if (model.marked && index < model.unit.length) piece.classList.add('demo-pattern-unit');
      row.append(piece);
    });
    root.append(row);
  } else if (model.type === 'shape') {
    root.append(h('span', { class: 'demo-big-shape', html: shapeMarkup(model.name) }), h('div', { class: 'demo-label' }, model.trace === 'sides' ? 'Trace each straight side' : model.trace === 'corners' ? 'Touch each corner' : model.name));
  } else if (model.type === 'measure') {
    const board = h('div', { class: 'demo-measure' });
    model.lengths.forEach((length) => {
      const row = h('div', { class: `demo-measure-row${length === model.answer ? ' is-answer' : ''}`, dataset: { length: String(length) } });
      if (model.units) for (let i = 0; i < length; i++) row.append(h('span', { class: 'demo-unit' }));
      else row.append(h('span', { class: 'demo-ribbon', style: { width: `min(${length * 54}px, 90%)` }, 'aria-label': 'ribbon ready to measure' }));
      board.append(row);
    });
    root.append(board);
  } else if (model.type === 'chart') {
    const chart = h('div', { class: 'demo-chart' }, h('div', { class: 'demo-chart-key' }, 'Key: 1 picture = 1 object'));
    model.rows.forEach((row) => {
      const icons = h('span', { class: 'demo-chart-icons' });
      const draw = items[row.id === 'apples' ? 'apple' : row.id === 'carrots' ? 'carrot' : 'muffin'];
      for (let i = 0; i < row.count; i++) icons.append(h('span', { class: 'demo-chart-icon', html: draw() }));
      chart.append(h('div', { class: 'demo-chart-row', dataset: { count: String(row.count) } }, h('b', {}, row.id), icons));
    });
    root.append(chart);
  }
  return root;
}

export function mountDemonstration(host, demo, api = {}, options = {}) {
  const validation = validateDemonstration(demo);
  if (validation.length) throw new Error(`Invalid demonstration: ${validation.join(', ')}`);
  if (!host || typeof host.replaceChildren !== 'function') throw new Error('A demonstration host element is required');
  ensureDemoStyles();
  const reducedMotion = options.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let index = 0;
  let destroyed = false;
  let generation = 0;
  let speechController = null;
  const timers = new Set();
  const stillHere = () => !destroyed && (typeof api.stillHere !== 'function' || api.stillHere());

  const title = h('h2', {}, demo.title);
  const narration = h('p', { class: 'demo-narration', role: 'status', 'aria-live': 'polite' });
  const modelHost = h('div', { class: 'demo-model' });
  const progress = h('span', { class: 'demo-progress' });
  const back = h('button', { type: 'button', 'aria-label': 'Back' }, 'Back');
  const replay = h('button', { type: 'button', 'aria-label': 'Replay' }, 'Replay');
  const next = h('button', { type: 'button', class: 'demo-primary', 'aria-label': 'Next step' }, 'Next');
  const tryIt = h('button', { type: 'button', class: 'demo-primary', 'aria-label': 'Try it' }, 'Try it');
  const skip = h('button', { type: 'button', 'aria-label': 'Skip demonstration' }, 'Skip');
  const controls = h('div', { class: 'demo-controls' }, back, replay, progress, next, tryIt, skip);
  const root = h('section', { class: 'demo-worked demo-step', dataset: { reducedMotion: String(!!reducedMotion) }, 'aria-label': `Worked example for ${demo.skillId}` }, title, narration, modelHost, controls);
  host.replaceChildren(root);

  const clearTimers = () => {
    for (const timer of timers) clearTimeout(timer);
    timers.clear();
  };
  const stopSpeech = () => {
    speechController?.abort();
    speechController = null;
    try { api.stopSay?.(); } catch {}
  };
  const updateControls = () => {
    back.disabled = index === 0;
    next.hidden = index >= demo.steps.length - 1;
    tryIt.hidden = index < demo.steps.length - 1;
    progress.textContent = `${index + 1} of ${demo.steps.length}`;
  };
  const playStep = async (wanted = index) => {
    if (!stillHere()) return false;
    generation++;
    const mine = generation;
    clearTimers();
    stopSpeech();
    index = Math.max(0, Math.min(demo.steps.length - 1, wanted));
    const current = demo.steps[index];
    root.classList.remove('demo-is-narrated');
    root.dataset.step = String(index);
    narration.textContent = current.say;
    const model = renderModel(current.view);
    modelHost.replaceChildren(model);
    updateControls();
    const show = () => { if (mine === generation && stillHere()) model.classList.add('is-shown'); };
    if (reducedMotion) show();
    else {
      const timer = setTimeout(() => { timers.delete(timer); show(); }, 45);
      timers.add(timer);
    }
    if (typeof api.say !== 'function') return true;
    speechController = new AbortController();
    const signal = speechController.signal;
    try { await api.say(current.say, { signal }); } catch (error) { if (error?.name !== 'AbortError' && stillHere()) console.error(error); }
    if (mine !== generation || signal.aborted || !stillHere()) return false;
    root.classList.add('demo-is-narrated');
    return true;
  };

  const onBack = () => { if (index > 0) void playStep(index - 1); };
  const onReplay = () => { void playStep(0); };
  const onNext = () => { if (index < demo.steps.length - 1) void playStep(index + 1); };
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    generation++;
    clearTimers();
    stopSpeech();
    back.removeEventListener('click', onBack);
    replay.removeEventListener('click', onReplay);
    next.removeEventListener('click', onNext);
    tryIt.removeEventListener('click', onTryIt);
    skip.removeEventListener('click', onSkip);
    root.remove();
    host.classList.remove('has-demonstration');
  };
  const onTryIt = () => {
    if (index !== demo.steps.length - 1 || destroyed) return;
    destroy();
    api.onDone?.();
  };
  const onSkip = () => {
    if (destroyed) return;
    destroy();
    api.onSkip?.();
  };

  back.addEventListener('click', onBack);
  replay.addEventListener('click', onReplay);
  next.addEventListener('click', onNext);
  tryIt.addEventListener('click', onTryIt);
  skip.addEventListener('click', onSkip);
  host.classList.add('has-demonstration');
  void playStep(0);

  return {
    play: playStep,
    next: () => playStep(index + 1),
    previous: () => playStep(index - 1),
    replay: () => playStep(0),
    destroy,
    getState: () => ({ index, stepCount: demo.steps.length, destroyed, reducedMotion }),
  };
}

export function createDemonstration(options, api) {
  const demo = makeDemonstration(options.skillId, options.level, { seed: options.seed });
  return mountDemonstration(api.host, demo, api, options);
}
