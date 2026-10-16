#!/usr/bin/env node
// Deterministic, complete inventory of every sentence the app can pass to say().
// No browser, no sampling, no TTS: every template/call site is expanded over the exact
// value ranges read from the generators (js/modules/*.js, js/app.js, tools/voice-lines.json).
//
//   node tools/build-inventory.mjs
//
// Writes tools/inventory.json:
//   { fixed:[...], sentences:[...], byPattern:{pattern:[...]}, numbers:[...], stats:{...} }
// Re-runnable with identical output: everything is sorted.
//
// Conventions:
//  - sentences are whole sentences, digits as written, exactly the way the app passes them to say()
//    (English number words kept where the app writes them, e.g. "45 is 4 tens and 5 ones."
//    is built by numbers.js as "45 is four tens and five ones." — words <= 12 are words).
//  - bare numbers (badge counts, tapped answers, sayOption) are NOT sentences: they resolve to
//    number clips. They are listed under `numbers`.
//  - {list} sentences (number sequences) are stitched from number clips by design. The counting
//    tracks are enumerated exactly; "Order the numbers" level 3 is combinatorial (any 4 numbers
//    1..120 pairwise >= 2 apart, ~millions) and is NOT enumerated here - see the report note.
import fs from 'node:fs';
import { ADVENTURE_VOICE_LINES } from '../js/adventures.js';
import { REASONING_VOICE_LINES } from '../js/modules/reasoning.js';
import { EXPLORE_SPOKEN_LINES } from '../js/modules/explore.js';
import { DEMONSTRATION_VOICE_LINES } from '../js/demonstrations.js';

const ROOT = new URL('..', import.meta.url).pathname;
const man = JSON.parse(fs.readFileSync(ROOT + 'assets/voice/manifest.json', 'utf8'));
const lines = JSON.parse(fs.readFileSync(ROOT + 'tools/voice-lines.json', 'utf8'));

/* ---------------------------------------------------------------- voice.js helpers (same semantics) */
const norm = (s) => String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
  .replace(/…/g, '...').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/g, '').trim();
const splitSentences = (t) => String(t ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/* ---------------------------------------------------------------- collectors */
const fixed = new Set();               // whole fixed sentences (no variables)
const sents = new Set();               // every whole sentence
const byPattern = new Map();           // manifest pattern -> Set<sentence>
const touchedPatterns = new Set();

// addSentence(T('pattern', ...vals), sentenceText): T() substitutes the slots and remembers the
// pattern + slot values. `sentenceText` is the exact text the app passes to say() (which may contain
// neighbouring sentences and may write slot values differently, e.g. English number words for
// {a}+{tens}). A split sentence is filed under byPattern[pattern] when it contains every slot value.
let lastPattern = null, lastVals = [];
// literal fragments of the pattern (everything between the {slots}) that must appear in the sentence
const literalsOf = (pattern) => norm(pattern).split(/\{[a-z0-9]+\}/).map((s) => s.trim()).filter((s) => /[a-z]/.test(s));
function addSentence(_templateText, sentence) {
  const pattern = lastPattern, vals = lastVals.map((v) => norm(String(v))).filter(Boolean);
  const lits = pattern ? literalsOf(pattern) : [];
  lastPattern = null; lastVals = [];
  if (pattern) touchedPatterns.add(pattern);
  for (const p of splitSentences(sentence)) {
    sents.add(p);
    if (pattern) {
      const n = norm(p);
      if (vals.every((v) => n.includes(v)) && lits.every((l) => n.includes(l))) {
        if (!byPattern.has(pattern)) byPattern.set(pattern, new Set());
        byPattern.get(pattern).add(p);
      }
    }
  }
}
function addFixed(s) { for (const p of splitSentences(s)) { fixed.add(p); sents.add(p); } }

/* word forms exactly as the generators write them */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const w = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const tensWord = (n) => `${w(n)} ${n === 1 ? 'ten' : 'tens'}`;
const onesWord = (n) => `${w(n)} ${n === 1 ? 'one' : 'ones'}`;

const NAME = 'Arisha';                       // manifest.names: only "arisha" has a recording
const SKILLS = Object.keys(lines.slots.skill);
const STICKERS = ['a koala', 'a kookaburra', 'a wombat', 'a platypus', 'a echidna', 'a cockatoo',
  'a bilby', 'a kangaroo', 'a tree frog', 'a quokka', 'a emu', 'a sea turtle'];  // art.js names lower-cased

const SHARE_KINDS = [['cookie', 'cookies'], ['apple', 'apples'], ['strawberry', 'strawberries'],
  ['lolly', 'lollies'], ['muffin', 'muffins'], ['carrot', 'carrots']];
const GROUP_THINGS = [['lolly', 'lollies'], ['cookie', 'cookies'], ['apple', 'apples'],
  ['strawberry', 'strawberries'], ['muffin', 'muffins'], ['carrot', 'carrots']];    // groups.js THINGS
const FIVE_THINGS = ['stars', 'lollies'];                                           // fivesDraw()
const ADD_NOUNS = [['bead', 'beads'], ['button', 'buttons'], ['marble', 'marbles'],
  ['sticker', 'stickers'], ['shell', 'shells'], ['coin', 'coins']];                 // addsub.js NOUNS
const SUB_KINDS = [['apple', 'apples', 'are eaten', 'is eaten'], ['cookie', 'cookies', 'are eaten', 'is eaten'],
  ['strawberry', 'strawberries', 'are eaten', 'is eaten'], ['muffin', 'muffins', 'are eaten', 'is eaten'],
  ['carrot', 'carrots', 'are eaten', 'is eaten'], ['fish', 'fish', 'swim away', 'swims away'],
  ['ball', 'balls', 'roll away', 'rolls away'], ['flower', 'flowers', 'are picked', 'is picked'],
  ['star', 'stars', 'fall down', 'falls down']];                                    // addsub.js SUBKINDS
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const nounOf = (n, one, many) => (n === 1 ? one : many);

/* ---------------------------------------------------------------- 1. fixed lines (voice-lines.json + app.js) */
for (const e of lines.inventory) if (e.kind === 'fixed') addFixed(e.text);
// exact one-clip lines from the manifest too (PRAISE / ENCOURAGE wording)
for (const t of Object.keys(man.exact || {})) addFixed(t);
// app.js lines not in the inventory file (Pip status / rest / home lines)
addFixed(`G'day ${NAME}! I'm Pip. Let's do some maths together.`);
addFixed(`Pip's having a rest now. You can still practise on your own, ${NAME}.`);
addFixed(`No internet right now, so Pip can't chat. Practise on your own, ${NAME}!`);
addFixed(`Ready for more sharing, ${NAME}?`);
addFixed(`Tap me and let's do some maths together, ${NAME}!`);
addFixed(`Pip can't chat right now. Let's practise on our own.`);
addFixed(`Pip is just waking up. One moment.`);
addFixed(`Pip needs a rest. You can still practise on your own.`);
addFixed(`That was a big session! Pip is having a little rest now.`);
addFixed(`Pip has done lots of maths today and is having a rest.`);
addFixed('Daily goal reached!');
for (const line of [...ADVENTURE_VOICE_LINES, ...REASONING_VOICE_LINES, ...EXPLORE_SPOKEN_LINES, ...DEMONSTRATION_VOICE_LINES]) addFixed(line);
addFixed('Choose a story adventure.');
for (const title of ['Sharing Equally', 'Equal Groups', 'Numbers to 120', 'Add and Take Away', "Pip's Brain Teasers", 'Maths Explorer']) {
  addFixed(`Let's explore ${title} first.`);
  addFixed(`Next stop: ${title}.`);
}

/* ---------------------------------------------------------------- 2. name / skill / sticker templates */
const T = (pattern, ...vals) => {                       // substitute {slot} tokens in a manifest pattern
  let i = 0;
  lastPattern = pattern; lastVals = vals;
  return pattern.replace(/\{[a-z0-9]+\}/g, () => String(vals[i++]));
};
addSentence(T("G'day {name}", NAME), `G'day ${NAME}! I'm Pip. Let's do some maths together.`);
addSentence(T("You've done your maths for today, {name}", NAME), `You've done your maths for today, ${NAME}`);
addSentence(T('Pick an island to start, {name}', NAME), `Pick an island to start, ${NAME}`);
addSentence(T('Ready for some maths, {name}', NAME), `Ready for some maths, ${NAME}`);
addSentence(T("Let's share some cookies, {name}", NAME), `Let's share some cookies, ${NAME}`);
addSentence(T('Which island today, {name}', NAME), `Which island today, ${NAME}`);
// app.js says: `Level up! ${skill.name} is getting easier for you.` (skill names can contain '?'/'.' which split)
for (const sk of SKILLS) addSentence(T('{skill} is getting easier for you.', sk), `Level up! ${sk} is getting easier for you.`);
addSentence(T("That's your maths done for today, {name}.", NAME), `That's your maths done for today, ${NAME}.`);
for (let stars = 0; stars <= 12; stars++) for (const [one, many] of [['star', 'stars']]) { // star nounForms
  addSentence(T('You earned {n} {many}.', stars, nounOf(stars, one, many)), `You earned ${stars} ${nounOf(stars, one, many)}.`);
}
for (const st of STICKERS) addSentence(T('You found a new sticker: {sticker}!', st), `You found a new sticker: ${st}!`);
for (let n = 0; n <= 12; n++) addSentence(T('You have {n} {many}.', n, nounOf(n, 'sticker', 'stickers')), `You have ${n} ${nounOf(n, 'sticker', 'stickers')}.`);

/* ---------------------------------------------------------------- 3. sharing.js */
// exact (n, g, tens) parameter sets from levelParams()
const sharingParams = [];
for (const n of [4, 6, 8, 10]) sharingParams.push({ n, g: 2 });
for (const n of [6, 8, 10, 12, 14]) sharingParams.push({ n, g: 2 });
for (const n of [5, 7, 8, 9, 10, 11, 12]) sharingParams.push({ n, g: 2 });
for (const n of [20, 40, 60, 80, 100, 120]) sharingParams.push({ n, g: 2, tens: true });
for (const n of [6, 9, 12]) sharingParams.push({ n, g: 3 });
for (const g of [3, 4]) for (const m of range(2, 4)) sharingParams.push({ n: g * m, g });
for (const g of [3, 4, 5]) for (const m of range(2, 4)) for (const r of range(0, g - 1)) sharingParams.push({ n: Math.min(g * m + r, 20), g });
for (const g of [3, 4, 5, 6]) for (const m of range(1, Math.floor(12 / g))) sharingParams.push({ n: g * 10 * m, g, tens: true });
for (const n of range(5, 10)) sharingParams.push({ n, g: 1 });
for (const n of range(8, 20)) sharingParams.push({ n, g: 1 });

for (const kind of SHARE_KINDS) for (const { n, g, tens } of sharingParams) {
  const unit = tens ? 10 : 1;
  const count = n / unit, each = Math.floor(count / g), left = count - each * g;
  const eachItems = each * unit, leftItems = left * unit;
  const many = nounOf(n, kind[0], kind[1]);
  if (g === 1) {
    addSentence(T('Put all {n} {many} into one basket.', n, many), `Put all ${n} ${many} into one basket.`);
    addSentence(T('All {n} in one basket.', n), `All ${n} in one basket.`);
    addSentence(T('{n} {many} in 1 group is {k}.', n, many, n), `${n} ${many} in 1 group is ${n}. Great counting!`);
    addSentence(T('How many {many} are in the basket?', many), `How many ${many} are in the basket?`);
  } else {
    const tail = left ? " If any are left over, put them in Pip's bowl." : '';
    addSentence(T('Share {n} {many} between {k} friends.', n, many, g), `Share ${n} ${many} between ${g} friends. Give each friend the same.${tail}`);
    addSentence(left
      ? T('Every friend has {n}, and {k} left over for Pip.', eachItems, leftItems)
      : T('Every friend has {n}.', eachItems),
    left ? `Every friend has ${eachItems}, and ${leftItems} left over for Pip. That's fair!` : `Every friend has ${eachItems}. That's fair!`);
    addSentence(T('Now every friend has {n}.', eachItems), `Now every friend has ${eachItems}. That's the same for everyone.`);
    if (left) addSentence(T('Now every friend has {n}, and {k} left over.', eachItems, leftItems), `Now every friend has ${eachItems}, and ${leftItems} left over. That's the same for everyone.`);
    addSentence(T('How many {many} did each friend get?', many), `How many ${many} did each friend get?`);
    const full = `${n} ${many} shared between ${g} friends is ${eachItems} each${left ? `, with ${leftItems} left over` : ''}. Great sharing!`;
    addSentence(left
      ? T('{n} {many} shared between {k} friends is {a} each, with {b} left over.', n, many, g, eachItems, leftItems)
      : T('{n} {many} shared between {k} friends is {a} each.', n, many, g, eachItems), full);
  }
}
// "Pip's bowl should have {n}": leftovers are only ever 1 piece (odd n, g=2, unit tasks)
addSentence(T("Each friend has the same, but Pip's bowl should have {n}.", 1), "Each friend has the same, but Pip's bowl should have 1. Pop the extra one in the bowl.");
// "This friend has {a} and this friend has {b}": child-state plate counts, unit tasks 0..20,
// tens tasks multiples of 10 to 120. Union of both value sets, both slots.
const plateVals = [...range(0, 20), ...range(3, 12).map((d) => d * 10)];
for (const a of plateVals) for (const b of plateVals) {
  addSentence(T('This friend has {n} and this friend has {k}.', a, b), `Hmm. This friend has ${a} and this friend has ${b}. That's not the same. Move some so each friend has the same.`);
}
addFixed("Pip's bowl has too many. Share some more out to the friends.");

/* ---------------------------------------------------------------- 4. groups.js */
/* pairs (Groups of 2): total = 2*randInt(lo/2, hi/2) per level */
for (const [lo, hi] of [[4, 8], [8, 12], [12, 16], [16, 20]]) {
  for (const half of range(lo / 2, hi / 2)) {
    const total = 2 * half, g = half;
    addSentence(T('Each {many} needs {n} {many2}.', 'hoop', 2, 'socks'), 'Put the socks in pairs. Each hoop needs 2 socks.');
    addFixed('Every hoop has 2. Lovely pairs!');
    for (const gi of range(1, Math.max(1, g - 2))) {           // level-3 missing number (blank mid-track)
      const ans = 2 * (gi + 1);
      addSentence(T('It is {n}.', ans), `It is ${ans}. We count 2, 4, 6.`);
    }
    addSentence(T('{n} {many} of {k} is {a}.', g, 'groups', 2, total), `${g} groups of 2 is ${total}.`);
    addSentence(T('{n} {many}.', g, 'pairs'), `${g} pairs!`);
    addSentence(T('How many {many}?', 'pairs'), 'How many pairs?');
    addSentence(T('How many {many} altogether?', 'socks'), 'How many socks altogether?');
  }
}
/* "That {many} is full." / "It holds {n}.": only ten frames have a cap (10) */
addSentence(T('That {many} is full.', 'frame'), 'That frame is full. It holds 10.');
addSentence(T('It holds {n}.', 10), 'That frame is full. It holds 10.');
addFixed('All done? Tap Check.');
addFixed('Have another look. Every group needs the same.');
addFixed('Start here.');
addFixed('Tap each group to count.');
addFixed('So how many altogether?');
addFixed('One number is hiding. Which one is missing?');
addFixed("We count 2, 4, 6.");
addFixed('How many socks?');
/* "This {many} has {n}." (child state 1..20) and "Every {many} needs {n}." (per-group size) */
for (const many of ['hoop', 'hand', 'bag', 'frame']) {
  for (const c of range(1, 20)) addSentence(T('This {many} has {n}.', many, c), `This ${many} has ${c}. Every ${many} needs 2.`);
}
for (const per of [2, 3, 4, 5]) {
  addSentence(T("Let's make groups of {n} together.", per), `Let's make groups of ${per} together.`);
  addSentence(T('Every {many} needs {n}.', 'bag', per), `Every bag needs ${per}.`);
}
addSentence(T("Let's make pairs together."), "Let's make pairs together.");
addSentence(T('Every {many} has {n}.', 'bag', 2), 'Every bag has 2.');
for (const per of range(2, 5)) addSentence(T('Every {many} has {n}.', 'bag', per), `Every bag has ${per}.`);

/* fives: tap levels 1 and 4, place level 2, track level 3 */
const fivesTrackStarts = [5, 10, 15, 20];
for (const g of range(2, 3)) { const total = g * 5;
  for (const thing of FIVE_THINGS) addSentence(T('Count the {many} in fives.', thing), `Count the ${thing} in fives. Tap each hand.`);
  addSentence(T('{n} {many}.', g, 'groups'), `${g} groups of 5.`);
  addSentence(T('{n} {many} of {k} is {a}.', g, 'groups', 5, total), `${g} groups of 5 is ${total}.`);
  addSentence(T('It is {n}.', total), `It is ${total}.`);
}
for (const g of range(5, 8)) { const total = g * 5;
  for (const thing of FIVE_THINGS) addSentence(T('Count the {many} in fives.', thing), `Count the ${thing} in fives. Tap each tray.`);
  addSentence(T('{n} {many}.', g, 'groups'), `${g} groups of 5.`);
  addSentence(T('{n} {many} of {k} is {a}.', g, 'groups', 5, total), `${g} groups of 5 is ${total}.`);
  addSentence(T('It is {n}.', total), `It is ${total}.`);
}
for (const g of range(2, 4)) { const total = g * 5;
  for (const thing of FIVE_THINGS) addSentence(T('Put {n} {many} in each hand.', 5, thing), `Put 5 ${thing} in each hand.`);
  addFixed('Every hand has 5. Well done!');
  addSentence(T('How many {many} altogether?', 'socks'), 'How many socks altogether?');
  addSentence(T('{n} {many} of {k} is {a}.', g, 'groups', 5, total), `${g} groups of 5 is ${total}.`);
  addSentence(T('It is {n}.', total), `It is ${total}.`);
}
/* tens: tap level 1, place level 2, track level 3, tens-and-ones level 4 */
for (const g of range(2, 3)) { const total = g * 10;
  addFixed('Count in tens. Tap each ten frame.');
  addSentence(T('{n} {many}.', g, 'groups'), `${g} groups of 10.`);
  addSentence(T('{n} {many} of {k} is {a}.', g, 'groups', 10, total), `${g} groups of 10 is ${total}.`);
  addSentence(T('It is {n}.', total), `It is ${total}.`);
}
for (const total of [10, 20]) { const g = total / 10;
  addFixed('Fill each ten frame with 10 counters.');
  addSentence(T('That is {n}!', 10), 'Every frame is full. That is 10!');
  addSentence(T('How many {many} altogether?', 'socks'), 'How many socks altogether?');
  addSentence(T('{n} {many} of {k} is {a}.', g, nounOf(g, 'group', 'groups'), 10, total), `${g} ${nounOf(g, 'group', 'groups')} of 10 is ${total}.`);
  addSentence(T('It is {n}.', total), `It is ${total}.`);
}
for (const tens of range(2, 4)) for (const ones of range(1, 9)) { const total = tens * 10 + ones;
  addFixed('Count the tens, then count on the ones.');
  addSentence(T('Tap each ten, then the ones.'), 'Tap each ten, then the ones.');
  addSentence(T('{n} {tens} and {k} {ones}.', tens, 'tens', ones, nounOf(ones, 'one', 'ones')), `${tens} tens and ${ones} ${nounOf(ones, 'one', 'ones')}.`);
  addSentence(T('{n} {tens} and {k} {ones} is {a}.', tens, 'tens', ones, nounOf(ones, 'one', 'ones'), total), `${tens} tens and ${ones} ${nounOf(ones, 'one', 'ones')} is ${total}.`);
  addSentence(T('It is {n}.', total), `It is ${total}.`);
}
/* how many groups? — exact (per, total[, leftover]) sets */
const howManySets = [];
for (const total of [4, 6, 8]) howManySets.push({ per: 2, total });
for (const total of [6, 8, 10, 12, 14]) howManySets.push({ per: 2, total });
for (const total of [10, 15]) howManySets.push({ per: 5, total });
for (const total of [6, 9, 12, 15]) howManySets.push({ per: 3, total });
for (const total of [8, 12, 16]) howManySets.push({ per: 4, total });
for (const per of range(2, 5)) for (const b of range(2, Math.min(6, Math.floor(18 / per)))) for (const lo of range(1, per - 1)) howManySets.push({ per, total: per * b + lo, leftover: lo });
for (const { per, total, leftover } of howManySets) {
  const bags = Math.floor(total / per);
  for (const [, many] of GROUP_THINGS) {
    addSentence(T('Put the {n} {many} in bags of {k}.', total, many, per), `Put the ${total} ${many} in bags of ${per}. How many bags do you fill?`);
    if (leftover) addSentence(T('How many {many} are left over?', many), `How many ${many} are left over?`);
  }
  addSentence(T('Every {many} has {n}.', 'bag', per), `Every bag has ${per}.`);
  addSentence(T('It is {n}.', bags), `It is ${bags}.`);
  addSentence(T('{n} {many}.', bags, 'bags'), `${bags} bags.`);
  addSentence(T('{n} {many} in bags of {k} makes {a} {many2}.', total, 'bags', per, bags, 'bags'), `${total} bags in bags of ${per} makes ${bags} bags.`);
  if (leftover) {
    addSentence(T('{n} left over.', leftover), `${leftover} left over.`);
    addSentence(T('{n} {many} of {k}, and {a} left over.', bags, 'bags', per, leftover), `${bags} bags of ${per}, and ${leftover} left over.`);
  }
}
/* counting tracks: exact sequences ({list}) */
addFixed('Count in fives. Which number is missing?');
addFixed('We count in 5s.');
addFixed('Count in tens. Which number is missing?');
addFixed('We count in 10s.');
for (const start of fivesTrackStarts) {
  const vals = range(start, start + 30).filter((v) => (v - start) % 5 === 0);
  addSentence(T('{list}', vals.join(', ')), `${vals.join(', ')}. We count in 5s.`);
  for (const blank of range(2, 5)) addSentence(T('It is {n}.', vals[blank]), `It is ${vals[blank]}. We count in 5s.`);
}
for (const start of range(10, 60).filter((v) => v % 10 === 0)) {
  const vals = range(start, start + 60).filter((v) => (v - start) % 10 === 0);
  addSentence(T('{list}', vals.join(', ')), `${vals.join(', ')}. We count in 10s.`);
  for (const blank of range(2, 5)) addSentence(T('It is {n}.', vals[blank]), `It is ${vals[blank]}. We count in 10s.`);
}

/* ---------------------------------------------------------------- 5. numbers.js */
/* find the number: target 2..120 */
for (const n of range(2, 120)) {
  addSentence(T('Tap {n}.', n), `Tap ${n}.`);
  addSentence(T("That's {n}!", n), `That's ${n}!`);
  addSentence(T("Here's {n}.", n), `Here's ${n}.`);
}
/* tens and ones (build) + read the blocks: N 11..120, words <= 12 written as words */
for (const N of [...range(11, 50), ...range(51, 99), 50, 60, 70, 80, 90, ...range(100, 120)]) {
  const t = Math.floor(N / 10), o = N % 10;
  addSentence(T('Make {n}.', N), `Make ${N}. Use the blocks!`);
  addSentence(T('{n} is {a} {tens} and {b} {ones}.', N, tensWord(t), onesWord(o)), `${N} is ${tensWord(t)} and ${onesWord(o)}.`);
  addSentence(T("It's {n}.", N), `It's ${N}. That's ${tensWord(t)} and ${onesWord(o)}.`);
  addSentence(T("That makes {n} too, but let's swap 10 ones for 1 ten.", N), `That makes ${N} too, but let's swap 10 ones for 1 ten.`);
  addSentence(T('Try {a} {tens} and {b} {ones}.', tensWord(t), onesWord(o)), `Try ${tensWord(t)} and ${onesWord(o)}.`);
}
/* build-check wrong state: t,o in 0..12 (child state), need lines per mismatching column */
for (let t = 0; t <= 12; t++) for (let o = 0; o <= 12; o++) {
  const total = t * 10 + o;
  const head = `That's ${tensWord(t)} and ${onesWord(o)}. That makes ${total}. `;
  addSentence(T("That's {a} {tens} and {b} {ones}.", tensWord(t), onesWord(o)), head + `We need one more ten.`);
  addSentence(T('That makes {n}.', total), `That makes ${total}.`);
  for (const d of range(2, 12)) {
    addSentence(T('We need {a} more {tens}.', w(d), 'tens'), head + `We need ${w(d)} more tens.`);
    addSentence(T('Take {a} away.', w(d)), head + `That's too many tens. Take ${w(d)} away.`);
  }
  addSentence(T("That's {a} {tens} and {b} {ones}.", tensWord(t), onesWord(o)), head + `We need one more one.`);
  for (const d of range(2, 12)) {
    addSentence(T('We need {a} more {ones}.', w(d), 'ones'), head + `We need ${w(d)} more ones.`);
    addSentence(T('Take {a} away.', w(d)), head + `That's too many ones. Take ${w(d)} away.`);
  }
}
/* before and after — exact ref sets per level/kind */
const baRefs = [];
for (const r of range(2, 19)) baRefs.push({ kind: 'after', ref: r });                       // L1 max 20
for (const r of range(3, 49)) baRefs.push({ kind: 'after', ref: r });                       // L2 max 50
for (const r of range(4, 50)) baRefs.push({ kind: 'before', ref: r });
for (const r of [9, 19, 29, 39, 49, 59, 69, 79, 89]) baRefs.push({ kind: 'after', ref: r }); // L3 crossings
for (const r of range(3, 99)) baRefs.push({ kind: 'after', ref: r });
for (const r of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) baRefs.push({ kind: 'before', ref: r });
for (const r of range(4, 100)) baRefs.push({ kind: 'before', ref: r });
for (const r of [9, 19, 29, 39, 49, 59, 69, 79, 89, 99, 109, 119]) baRefs.push({ kind: 'after', ref: r }); // L4 max 120
for (const r of range(3, 119)) baRefs.push({ kind: 'after', ref: r });
for (const r of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]) baRefs.push({ kind: 'before', ref: r });
for (const r of range(4, 120)) baRefs.push({ kind: 'before', ref: r });
for (const r of range(30, 117)) baRefs.push({ kind: 'between', ref: r });
for (const { kind, ref } of baRefs) {
  if (kind === 'after') {
    addSentence(T('What comes after {n}?', ref), `What comes after ${ref}?`);
    addSentence(T('{n} comes after {k}.', ref + 1, ref), `${ref + 1} comes after ${ref}.`);
  } else if (kind === 'before') {
    addSentence(T('What comes before {n}?', ref), `What comes before ${ref}?`);
    addSentence(T('{n} comes before {k}.', ref - 1, ref), `${ref - 1} comes before ${ref}.`);
  } else {
    addSentence(T('What number is between {n} and {k}?', ref, ref + 2), `What number is between ${ref} and ${ref + 2}?`);
    addSentence(T('{n} is between {k} and {a}.', ref + 1, ref, ref + 2), `${ref + 1} is between ${ref} and ${ref + 2}.`);
  }
}
/* order the numbers: level 1 (3 of 1..20, dist>=2) and level 2 (3 of 1..50, dist>=3) exactly;
   level 3 is combinatorial (see header note) — only its fixed fallback is listed */
addFixed('Put the numbers in order. Smallest first!');
addFixed('Smallest to biggest!');
addFixed('Hmm. Which number is the smallest? It goes first.');
addFixed('Nearly! Look at the glowing spot. Which number comes next?');
addFixed('Put the glowing number in the glowing spot.');
const orderSets = [];
for (let a = 1; a <= 20; a++) for (let b = a + 2; b <= 20; b++) for (let c = b + 2; c <= 20; c++) orderSets.push([a, b, c]);
for (let a = 1; a <= 50; a++) for (let b = a + 3; b <= 50; b++) for (let c = b + 3; c <= 50; c++) orderSets.push([a, b, c]);
orderSets.push([14, 41, 67, 105]);      // deterministic fallback of level 3
orderSets.push([3, 9, 15]);             // deterministic fallback of levels 1/2
for (const set of orderSets) addSentence(T('{list}', set.join(', ')), `${set.join(', ')}. Smallest to biggest!`);

/* ---------------------------------------------------------------- 6. addsub.js */
/* Adding — exact (a, b) sets per level/mode */
const addSets = { tap: [], show: [], missing: [] };
for (let a = 2; a <= 6; a++) for (let b = 1; b <= Math.min(5, 10 - a); b++) addSets.tap.push([a, b]);
for (const v of [3, 4, 5, 6]) addSets.tap.push([v, v]);
for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) if (a + b >= 6) addSets.tap.push([a, b]);
for (let a = 2; a <= 10; a++) for (let b = 2; b <= 10; b++) if (a + b >= 11) addSets.show.push([a, b]);
for (let a = 5; a <= 9; a++) for (let b = 2; b <= 9; b++) addSets.missing.push([a, b]);
for (const [a, b] of addSets.tap) {
  const total = a + b;
  for (const [one, many] of ADD_NOUNS) {
    addSentence(T('Here are {n} orange {many}.', a, `orange ${nounOf(a, one, many)}`), `Here are ${a} orange ${nounOf(a, one, many)}. Tap ${b} empty ${nounOf(b, 'spot', 'spots')} to add ${b} blue.`);
    addSentence(T('Tap {n} empty {many} to add {k} blue.', b, nounOf(b, 'spot', 'spots'), b), `Here are ${a} orange ${nounOf(a, one, many)}. Tap ${b} empty ${nounOf(b, 'spot', 'spots')} to add ${b} blue.`);
    addSentence(T('{n} and {k} more.', a, b), `${a} and ${b} more. How many ${many} altogether?`);
    addSentence(T('How many {many} altogether?', many), `${a} and ${b} more. How many ${many} altogether?`);
    addSentence(T('Count on from {n}.', a), `Count on from ${a}.`);
    addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}. Well done!`);
    addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}. You counted on!`);
    addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}.`);
  }
}
for (const [a, b] of addSets.show) {
  const total = a + b;
  for (const [, many] of ADD_NOUNS) {
    addSentence(T('There are {n} orange {many} and {k} blue {many2}.', a, `orange ${many}`, b, `blue ${many}`), `There are ${a} orange ${many} and ${b} blue ${many}. How many ${many} altogether?`);
    addSentence(T('How many {many} altogether?', many), `There are ${a} orange ${many} and ${b} blue ${many}. How many ${many} altogether?`);
    addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}. Well done!`);
    addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}.`);
  }
}
for (const [a, b] of addSets.missing) {
  const total = a + b;
  for (const [, many] of ADD_NOUNS) {
    addSentence(T('There are {n} orange {many}.', a, `orange ${many}`), `There are ${a} orange ${many}. Add blue ones to make ${total}. How many blue ${many} do you add?`);
    addSentence(T('Add blue ones to make {n}.', total), `There are ${a} orange ${many}. Add blue ones to make ${total}. How many blue ${many} do you add?`);
    addSentence(T('How many blue {many} do you add?', many), `There are ${a} orange ${many}. Add blue ones to make ${total}. How many blue ${many} do you add?`);
    addSentence(T('We have {n}, we need {k}.', a, total), `We have ${a}, we need ${total}. Count on.`);
    addSentence(T('{n} and {k} makes {a}.', a, b, total), `${a} and ${b} makes ${total}.`);
    addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}. You counted on!`);
  }
}
/* Number friends (part-part-whole) */
for (const whole of [...range(5, 7), ...[6, 7, 8, 9, 10], ...range(6, 10), ...range(11, 20)]) {
  for (let p1 = 1; p1 < whole; p1++) {
    const p2 = whole - p1;
    addSentence(T('One part is {n}.', p1), `One part is ${p1}. The other part is ${p2}. What is the whole?`);
    addSentence(T('The other part is {n}.', p2), `One part is ${p1}. The other part is ${p2}. What is the whole?`);
    addSentence(T('{n} and {k} make {a}.', p1, p2, whole), `${p1} and ${p2} make ${whole}. That's the whole!`);
    addSentence(T('The whole is {n}.', whole), `The whole is ${whole}. One part is ${p2}. What is the other part?`);
    addSentence(T('One part is {n}.', p2), `The whole is ${whole}. One part is ${p2}. What is the other part?`);
    addSentence(T('{n} and {k} make {a}.', p2, p1, whole), `${p2} and ${p1} make ${whole}. Number friends!`);
  }
}
/* Make ten — exact (a, b) sets per level */
const tenSets = [];
for (const a of [8, 9]) for (let b = 11 - a; b <= 13 - a; b++) tenSets.push([a, b]);
for (let a = 6; a <= 9; a++) for (let b = 11 - a; b <= Math.min(9, 15 - a); b++) tenSets.push([a, b]);
for (let big = 5; big <= 9; big++) {
  const lo = Math.max(2, 11 - big), hi = Math.min(big, 18 - big, 9);
  for (let s = lo; s <= hi; s++) { tenSets.push([big, s]); tenSets.push([s, big]); }
}
for (const v of [6, 7, 8, 9]) tenSets.push([v, v]);
for (const s of [6, 7, 8]) tenSets.push([s, s + 1]);
for (const [a, b] of tenSets) {
  const total = a + b, big = Math.max(a, b);
  const restV = Math.min(a, b) - (10 - Math.max(a, b));
  addSentence(T('{n} plus {k}.', a, b), `${a} plus ${b}. Drag the blue counters to fill up the ten frame first.`);
  addSentence(T('{n} plus {k}.', a, b), `${a} plus ${b}. Start with the bigger number, ${big}. Drag counters to fill the ten frame.`);
  addSentence(T('Start with the bigger number, {n}.', big), `${a} plus ${b}. Start with the bigger number, ${big}. Drag counters to fill the ten frame.`);
  addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}. Great thinking!`);
  addSentence(T('{n} plus {k} is {a}.', a, b, total), `${a} plus ${b} is ${total}.`);
  addSentence(T('{n} needs {k} more to make 10.', big, restV), `Fill the ten frame first. ${big} needs ${restV} more to make 10.`);
  if (restV >= 1) addSentence(T('{n} plus {k} is the same as 10 plus {a}.', a, b, restV), `${a} plus ${b} is the same as 10 plus ${restV}. How many altogether?`);
  addSentence(T('Now count on {n}.', restV), `The first frame is full. That is 10. Now count on ${restV}.`);
}
for (const v of [6, 7, 8, 9]) {
  addSentence(T('Double {n}.', v), `Double ${v}. ${v} plus ${v}. How many altogether?`);
  addSentence(T('{n} plus {k}.', v, v), `Double ${v}. ${v} plus ${v}. How many altogether?`);
  addSentence(T('{n} and {k} more.', v, v), `Double ${v}. ${v} and ${v} more.`);
}
for (const s of [6, 7, 8]) {
  addSentence(T('{n} plus {k}.', s, s + 1), `${s} plus ${s + 1}. That's a double and one more. How many altogether?`);
  addSentence(T('Double {n} first.', s), `Double ${s} first. ${s} and ${s} is ${s + s}.`);
  addSentence(T('{n} and {k} is {a}.', s, s, s + s), `Double ${s} first. ${s} and ${s} is ${s + s}.`);
  addSentence(T('Now one more makes {n}.', s + s + 1), `Now one more makes ${s + s + 1}.`);
}
/* Taking away — exact (n, s) sets per level/mode */
const subSets = { tap: [], pre: [], think: [] };
for (let n = 4; n <= 10; n++) for (let s = 1; s <= Math.min(n - 1, 6); s++) subSets.tap.push([n, s]);
for (const n of [8, 9, 10, 11, 12]) for (let s = 2; s <= Math.min(n - 2, 9); s++) subSets.tap.push([n, s]);
for (let n = 11; n <= 20; n++) for (let s = 2; s <= 9; s++) subSets.pre.push([n, s]);
for (let n = 11; n <= 20; n++) for (let d = 2; d <= 8; d++) subSets.think.push([n, n - d]);
for (const [n, s] of subSets.tap) {
  const left = n - s;
  for (const [one, many, verb, verb1] of SUB_KINDS) {
    const verbV = s === 1 ? verb1 : verb;
    addSentence(T('There are {n} {many}.', n, nounOf(n, one, many)), `There are ${n} ${nounOf(n, one, many)}. ${s} ${verbV}. Tap ${s} ${nounOf(s, one, many)} to take ${s === 1 ? 'it' : 'them'} away.`);
    addSentence(T('{n} {verb}.', s, verbV), `There are ${n} ${nounOf(n, one, many)}. ${s} ${verbV}. Tap ${s} ${nounOf(s, one, many)} to take ${s === 1 ? 'it' : 'them'} away.`);
    addSentence(s === 1 ? T('Tap {n} {many} to take it away.', s, nounOf(s, one, many)) : T('Tap {n} {many} to take them away.', s, nounOf(s, one, many)),
      `There are ${n} ${nounOf(n, one, many)}. ${s} ${verbV}. Tap ${s} ${nounOf(s, one, many)} to take ${s === 1 ? 'it' : 'them'} away.`);
    addSentence(T('{n} take away {k}.', n, s), `${n} take away ${s}. How many ${nounOf(left, one, many)} are left?`);
    addSentence(T('How many {many} are left?', nounOf(left, one, many)), `${n} take away ${s}. How many ${nounOf(left, one, many)} are left?`);
    addSentence(T('{n} take away {k} is {a}.', n, s, left), `${n} take away ${s} is ${left}. Well done!`);
  }
}
for (const [n, s] of subSets.pre) {
  for (const [one, many, verb, verb1] of SUB_KINDS) {
    const verbV = s === 1 ? verb1 : verb;
    addSentence(T('There are {n} {many}.', n, nounOf(n, one, many)), `There are ${n} ${nounOf(n, one, many)}. ${s} ${verbV}. How many are left?`);
    addSentence(T('{n} {verb}.', s, verbV), `There are ${n} ${nounOf(n, one, many)}. ${s} ${verbV}. How many are left?`);
    addSentence(T('{n} take away {k} is {a}.', n, s, n - s), `${n} take away ${s} is ${n - s}. Well done!`);
  }
}
for (const [n, s] of subSets.think) {
  const left = n - s;
  addSentence(T('{n} take away {k}.', n, s), `${n} take away ${s}. Think: ${s} and how many make ${n}?`);
  addSentence(T('Think: {n} and how many make {k}?', s, n), `${n} take away ${s}. Think: ${s} and how many make ${n}?`);
  addSentence(T('{n} and {k} make {a}, so {b} take away {c} is {d}.', s, left, n, n, s, left), `${s} and ${left} make ${n}, so ${n} take away ${s} is ${left}.`);
}
addFixed("Let's count what is left.");

/* ---------------------------------------------------------------- 7. bare-number utterances (number clips, not sentences) */
const numbers = range(0, 120).map(String);

/* ---------------------------------------------------------------- 8. assemble + verify superset */
const fixedOut = [...fixed].sort();
const sentencesOut = [...sents].sort();
const byPatternOut = {};
for (const [p, set] of [...byPattern].sort((a, b) => a[0].localeCompare(b[0]))) byPatternOut[p] = [...set].sort();

const tasks = JSON.parse(fs.readFileSync(ROOT + 'tools/sentences.tasks.json', 'utf8'));
const invSet = new Set(sentencesOut.map(norm));
const missing = tasks.filter((s) => !invSet.has(norm(s)));

const stats = {
  fixed: fixedOut.length,
  sentences: sentencesOut.length,
  chars: sentencesOut.reduce((a, s) => a + s.length, 0),
  numbers: numbers.length,
  patterns: Object.keys(byPatternOut).length,
  manifestTemplates: man.templates.length,
  manifestTemplatesNotTouched: man.templates.map((t) => t.pattern).filter((p) => !touchedPatterns.has(p)),
  supersetCheck: { compared: tasks.length, missing: missing.length, missingSample: missing.slice(0, 20) },
  generatedAt: 'deterministic (no timestamps)',
};

fs.writeFileSync(ROOT + 'tools/inventory.json', JSON.stringify({ fixed: fixedOut, sentences: sentencesOut, byPattern: byPatternOut, numbers, stats }, null, 0) + '\n');
console.log('fixed:', stats.fixed, '| sentences:', stats.sentences, '| chars:', stats.chars, '| patterns:', stats.patterns);
console.log('numbers (bare utterances):', stats.numbers);
console.log('superset check vs tools/sentences.tasks.json:', stats.supersetCheck.missing, 'missing of', stats.supersetCheck.compared);
if (stats.supersetCheck.missing) console.log('missing sample:', JSON.stringify(stats.supersetCheck.missingSample, null, 1));
if (stats.manifestTemplatesNotTouched.length) console.log('manifest patterns never expanded:', stats.manifestTemplatesNotTouched);
