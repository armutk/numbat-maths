// Add and Take Away — ten frames and number friends (VC2M1N04, VC2M1N05).
import { h, wait, randInt, pick, shuffle, numberChoices } from '../ui.js';
import { items, moduleArt } from '../art.js';

/* ---------- styles (self-contained, injected once) ---------- */
const CSS = `
.as-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(10px,2vmin,22px);flex:1 1 auto;min-height:0;width:100%}
.as-wrap .equation{font-size:clamp(2rem,5.2vmin,3.2rem);flex-wrap:wrap;gap:clamp(8px,1.6vmin,14px)}
.as-wrap .equation .num{min-width:.7em;text-align:center}
.as-wrap .choices{gap:clamp(10px,2vmin,16px)}
.as-wrap .choice{min-height:clamp(72px,10vmin,92px)}
.as-pop{animation:popin .45s var(--ease-pop)}
.as-frames{--cell:min(10.5vmin,86px);display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:clamp(12px,2.4vmin,24px)}
.as-frames .tenframe .cell{cursor:pointer}
.as-frames .cell .counter{width:78%;height:78%}
.as-frames .cell .counter.item{width:78%;height:78%}
.as-frames .cell.as-want{animation:aswant 1.5s ease-in-out infinite}
@keyframes aswant{0%,100%{border-color:var(--sand-deep);background:var(--sand)}50%{border-color:var(--blue);background:var(--blue-soft)}}
.as-frames .cell.as-glow{border-color:var(--yellow-deep);background:var(--yellow-soft);animation:asnudge 1s ease-in-out infinite}
@keyframes asnudge{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}
.tenframe.as-full{box-shadow:0 6px 0 var(--green-deep),0 0 0 5px var(--green-soft),var(--shadow-card)}
.counter.as-lit{box-shadow:0 0 0 5px var(--yellow),inset -4px -6px 0 rgba(0,0,0,.12),0 3px 4px rgba(43,39,64,.2)}
.counter.as-hop,.as-item.as-hop{animation:ashop .55s var(--ease-pop)}
@keyframes ashop{0%{transform:scale(1)}40%{transform:scale(1.28)}100%{transform:scale(1)}}
.counter.is-pink.item{--counter:var(--pink)}
.as-item{width:84%;height:84%;transition:opacity .25s,transform .25s,filter .25s;pointer-events:none}
.as-item svg{width:100%;height:100%;display:block}
.as-item.as-gone{opacity:.3;transform:scale(.82);filter:grayscale(.6)}
.as-item.as-lit{filter:drop-shadow(0 0 7px var(--yellow-deep)) drop-shadow(0 0 3px var(--yellow))}
.as-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:clamp(14px,3vmin,32px)}
.as-dots{--dot:min(6.2vmin,48px);display:flex;flex-wrap:wrap;justify-content:center;align-content:center;gap:8px;max-width:calc(10 * (var(--dot) + 8px) + 22px);padding:10px;background:var(--white);border-radius:20px;box-shadow:0 6px 0 var(--sand-deep),var(--shadow-card)}
.as-dots .counter{width:var(--dot);height:var(--dot)}
.as-ppw{--b:clamp(92px,13vmin,128px);width:calc(var(--b) * 2 + 12px);margin:0}
.as-ppw .bubble{width:var(--b);height:var(--b);font-size:clamp(2rem,5vmin,2.8rem)}
.as-ppw .bubble small{font-size:.8rem;line-height:1}
`;
let styled = false;
function injectStyle() {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.id = 'addsub-style';
  s.textContent = CSS;
  document.head.append(s);
}

/* ---------- small builders ---------- */
const NOUNS = [
  { one: 'bead', many: 'beads' }, { one: 'button', many: 'buttons' }, { one: 'marble', many: 'marbles' },
  { one: 'sticker', many: 'stickers' }, { one: 'shell', many: 'shells' }, { one: 'coin', many: 'coins' },
];
const ctr = (cls = '') => h('div', { class: `counter ${cls}`.trim() });
const plural = (n, k) => `${n} ${n === 1 ? k.one : k.many}`;

/** Equation row. Use '?' for the unknown box. */
function eq(parts) {
  const el = h('div', { class: 'equation' });
  let box = null;
  for (const p of parts) {
    if (p === '?') { box = h('span', { class: 'box' }, '?'); el.append(box); }
    else if (typeof p === 'number') el.append(h('span', { class: 'num' }, p));
    else el.append(h('span', { class: 'op' }, p));
  }
  return {
    el, box,
    fill(v) { if (box) { box.textContent = String(v); box.classList.add('is-filled'); } },
    /** insert tokens (animated) before the unknown box */
    insert(tokens) {
      for (const t of tokens) {
        const s = h('span', { class: `${typeof t === 'number' ? 'num' : 'op'} as-pop` }, t);
        el.insertBefore(s, box);
      }
    },
  };
}

/** n ten frames; returns { wrap, frames:[{el,cells}], all:[cells...] } */
function frames(n) {
  const wrap = h('div', { class: 'as-frames' });
  const list = [];
  for (let i = 0; i < n; i++) {
    const cells = Array.from({ length: 10 }, () => h('div', { class: 'cell' }));
    const el = h('div', { class: 'tenframe' }, ...cells);
    wrap.append(el);
    list.push({ el, cells });
  }
  return { wrap, list, all: list.flatMap((f) => f.cells) };
}

/** answer buttons that also fill the equation box / bubble when the right one is tapped */
function askNumber(api, parent, { answer, lo, hi, fill, finalSay }) {
  const group = api.ask({ options: numberChoices(answer, 3, lo, hi), answer, parent, finalSay });
  group.addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (b && Number(b.dataset.value) === answer && b.classList.contains('is-right')) fill();
  });
  return group;
}

async function revealAnswer(stage, api, answer, fill, text) {
  const b = stage.querySelector(`.choice[data-value="${answer}"]`);
  if (b) { b.classList.remove('is-wrong', 'is-dim'); b.classList.add('is-right'); }
  fill();
  await api.say(text, 'is-happy');
}

const clearLit = (root) => root.querySelectorAll('.as-lit').forEach((e) => e.classList.remove('as-lit'));
async function hop(api, el, i, num, gap = 650) {
  el.classList.remove('as-hop'); void el.offsetWidth;
  el.classList.add('as-hop', 'as-lit');
  api.sfx.tick(i);
  if (num != null) api.say(String(num));
  await api.wait(gap);
}

/* ================= 1. Adding ================= */
function addTask(level) {
  let a, b, mode = 'tap';
  if (level === 1) { a = randInt(2, 6); b = randInt(1, Math.min(5, 10 - a)); }
  else if (level === 2) {
    if (Math.random() < 0.4) a = b = pick([3, 4, 5, 6]);
    else do { a = randInt(1, 6); b = randInt(1, 6); } while (a + b < 6);
  } else if (level === 3) { mode = 'show'; do { a = randInt(2, 10); b = randInt(2, 10); } while (a + b < 11); }
  else { mode = 'missing'; a = randInt(5, 9); b = randInt(2, 9); }
  const total = a + b;
  const noun = pick(NOUNS);
  let say;
  if (mode === 'tap') say = `Here are ${plural(a, { one: 'orange ' + noun.one, many: 'orange ' + noun.many })}. Tap ${b} empty ${b === 1 ? 'spot' : 'spots'} to add ${b} blue.`;
  else if (mode === 'show') say = `There are ${a} orange ${noun.many} and ${b} blue ${noun.many}. How many ${noun.many} altogether?`;
  else say = `There are ${a} orange ${noun.many}. Add blue ones to make ${total}. How many blue ${noun.many} do you add?`;

  let all = [];
  let ex = null;
  let phase = 'tap';
  const blues = () => all.map((c) => c.querySelector('.counter.is-blue')).filter(Boolean);

  async function placeBlues(n, withHint) {
    blues().forEach((c) => c.remove());
    const empties = all.filter((c) => !c.firstElementChild);
    for (let i = 0; i < n; i++) {
      const c = ctr('is-blue as-lit');
      empties[i].append(c);
      api_.sfx.tick(i); api_.say(String(a + i + 1));
      if (withHint) await wait(650);
    }
  }
  let api_ = null;

  return {
    say,
    mount(stage, api) {
      injectStyle(); api_ = api;
      const fr = frames(total > 10 ? 2 : 1);
      all = fr.all;
      ex = eq(mode === 'missing' ? [a, '+', '?', '=', total] : [a, '+', b, '=', '?']);
      const area = h('div', { class: 'as-wrap' }, ex.el, fr.wrap);
      stage.append(area);
      for (let i = 0; i < a; i++) all[i].append(ctr());
      if (mode === 'show') for (let i = 0; i < b; i++) all[a + i].append(ctr('is-blue'));
      phase = mode === 'show' ? 'ask' : 'tap';
      const want = () => all.forEach((c) => c.classList.toggle('as-want', phase === 'tap' && !c.firstElementChild));
      const toAsk = () => askNumber(api, area, { answer: total, lo: 1, hi: 20, fill: () => ex.fill(total), finalSay: `${a} plus ${b} is ${total}. Well done!` });

      if (mode === 'show') { toAsk(); return; }

      let chk = null;
      if (mode === 'missing') {
        chk = api.button('Check', async () => {
          if (phase !== 'tap') return;
          if (blues().length === b) { phase = 'done'; want(); clearLit(area); ex.fill(b); api.finish(true, { say: `${a} plus ${b} is ${total}. You counted on!` }); }
          else api.finish(false);
        });
        chk.disabled = true;
      }
      want();
      all.forEach((cell) => cell.addEventListener('click', async () => {
        if (phase !== 'tap') return;
        const c = cell.firstElementChild;
        if (c) {
          if (c.classList.contains('is-blue')) { c.remove(); api.sfx.tap(); api.say(String(a + blues().length)); want(); if (chk) chk.disabled = blues().length === 0; }
          return;
        }
        clearLit(area);
        cell.append(ctr('is-blue'));
        const n = blues().length;
        api.sfx.tick(n - 1);
        api.say(String(a + n));
        want();
        if (chk) chk.disabled = false;
        if (mode === 'tap' && n === b) {
          phase = 'ask'; want();
          await api.wait(700);
          api.say(`${a} and ${b} more. How many ${noun.many} altogether?`);
          toAsk();
        }
      }));
    },
    async hint(stage, api) {
      clearLit(stage);
      if (mode === 'missing') {
        await api.say(`We have ${a}, we need ${total}. Count on.`, 'is-hint');
        all.slice(0, a).forEach((c) => c.firstElementChild && c.firstElementChild.classList.add('as-lit'));
        await api.wait(600);
        clearLit(stage);
        await placeBlues(b, true);
        await api.wait(300);
        clearLit(stage);
        return;
      }
      await api.say(`Count on from ${a}.`, 'is-hint');
      all.slice(0, a).forEach((c) => c.firstElementChild && c.firstElementChild.classList.add('as-lit'));
      await api.wait(900);
      clearLit(stage);
      const bs = blues();
      for (let i = 0; i < bs.length; i++) await hop(api, bs[i], i, a + i + 1);
      await api.wait(200);
    },
    async reveal(stage, api) {
      clearLit(stage);
      if (mode === 'missing') {
        phase = 'done';
        await placeBlues(b, false);
        ex.fill(b);
        await api.say(`${a} and ${b} makes ${total}.`, 'is-happy');
        return;
      }
      await revealAnswer(stage, api, total, () => ex.fill(total), `${a} plus ${b} is ${total}.`);
    },
  };
}

/* ================= 2. Number friends (part-part-whole) ================= */
function bubble(cls, val, label) {
  return h('div', { class: `bubble ${cls}`.trim() }, val == null ? '?' : String(val), h('small', {}, label));
}

/** whole on top, two parts below, plus a row of dots. blank: 'p1' | 'p2' | 'whole'. */
function ppwScene({ whole, p1, p2, blank }) {
  const bw = bubble(blank === 'whole' ? 'whole is-blank' : 'whole', blank === 'whole' ? null : whole, 'whole');
  const b1 = bubble(blank === 'p1' ? 'is-blank' : '', blank === 'p1' ? null : p1, 'part');
  const b2 = bubble(blank === 'p2' ? 'is-blank' : '', blank === 'p2' ? null : p2, 'part');
  const ppw = h('div', { class: 'ppw as-ppw' }, bw, b1, b2);
  const target = blank === 'whole' ? bw : blank === 'p1' ? b1 : b2;
  const dots = h('div', { class: 'as-dots' });
  const known = blank === 'p1' ? p2 : p1;
  for (let i = 0; i < whole; i++) {
    let cls;
    if (blank === 'whole') cls = i < p1 ? '' : 'is-blue';
    else cls = i < known ? '' : 'is-ghost';
    dots.append(ctr(cls));
  }
  const value = blank === 'whole' ? whole : blank === 'p1' ? p1 : p2;
  return {
    el: h('div', { class: 'as-row' }, ppw, dots), ppw, dots, value, blank,
    fill() { target.classList.remove('is-blank'); target.classList.add('is-filled'); target.firstChild.nodeValue = String(value); },
    async hint(api) {
      clearLit(dots);
      if (blank === 'whole') {
        await api.say('Count them all.', 'is-hint');
        const all = [...dots.children];
        for (let i = 0; i < all.length; i++) await hop(api, all[i], i, i + 1, 520);
      } else {
        await api.say('Count the empty ones.', 'is-hint');
        const ghosts = [...dots.querySelectorAll('.is-ghost')];
        for (let i = 0; i < ghosts.length; i++) {
          ghosts[i].classList.remove('is-ghost'); ghosts[i].classList.add('is-blue');
          await hop(api, ghosts[i], i, i + 1, 600);
        }
      }
      await api.wait(200);
    },
  };
}

function ppwTask(level) {
  let whole, wholeBlank = false;
  if (level === 1) whole = randInt(5, 7);
  else if (level === 2) whole = pick([6, 7, 8, 9, 10, 10, 10]);
  else if (level === 3) { whole = randInt(6, 10); wholeBlank = Math.random() < 0.3; }
  else { whole = randInt(11, 20); wholeBlank = Math.random() < 0.25; }
  const p1 = randInt(1, whole - 1), p2 = whole - p1;
  const blank = wholeBlank ? 'whole' : pick(['p1', 'p2']);
  const known = blank === 'p1' ? p2 : p1;
  const say = wholeBlank
    ? `One part is ${p1}. The other part is ${p2}. What is the whole?`
    : `The whole is ${whole}. One part is ${known}. What is the other part?`;
  const answer = wholeBlank ? whole : (blank === 'p1' ? p1 : p2);
  let sc = null;
  const finalSay = wholeBlank ? `${p1} and ${p2} make ${whole}. That's the whole!` : `${known} and ${answer} make ${whole}. Number friends!`;
  return {
    say,
    mount(stage, api) {
      injectStyle();
      sc = ppwScene({ whole, p1, p2, blank });
      const area = h('div', { class: 'as-wrap' }, sc.el);
      stage.append(area);
      askNumber(api, area, { answer, lo: wholeBlank ? 2 : 1, hi: wholeBlank ? whole + 3 : whole - 1, fill: () => sc.fill(), finalSay });
    },
    hint(stage, api) { return sc.hint(api); },
    reveal(stage, api) { return revealAnswer(stage, api, answer, () => sc.fill(), finalSay); },
  };
}

/* ================= 3. Make ten ================= */
function makeTenTask(level) {
  let a, b, big, small, mode = 'drag';
  if (level === 1) { a = pick([8, 9]); b = randInt(11 - a, 13 - a); }
  else if (level === 2) { a = randInt(6, 9); b = randInt(11 - a, Math.min(9, 15 - a)); }
  else if (level === 3) {
    big = randInt(5, 9); small = randInt(Math.max(2, 11 - big), Math.min(big, 18 - big, 9));
    if (Math.random() < 0.5) { a = small; b = big; } else { a = big; b = small; }
  } else {
    mode = 'double';
    const base = pick([6, 7, 8, 9]);
    if (Math.random() < 0.4) { a = base; b = base; } else { const s = pick([6, 7, 8]); a = s; b = s + 1; }
  }
  const total = a + b;
  if (mode === 'drag') { big = Math.max(a, b); small = Math.min(a, b); if (level < 3) { big = a; small = b; } }
  const need = mode === 'drag' ? 10 - big : 0;
  const rest = mode === 'drag' ? small - need : 0;
  const swapped = mode === 'drag' && a < b;
  let say;
  if (mode === 'double') say = a === b ? `Double ${a}. ${a} plus ${a}. How many altogether?` : `${a} plus ${b}. That's a double and one more. How many altogether?`;
  else if (swapped) say = `${a} plus ${b}. Start with the bigger number, ${big}. Drag counters to fill the ten frame.`;
  else say = `${a} plus ${b}. Drag the blue counters to fill up the ten frame first.`;

  let ex = null, fa = null, fb = null, phase = 'fill', idle = 0, area = null;
  return {
    say,
    mount(stage, api) {
      injectStyle();
      const fr = frames(2);
      fa = fr.list[0]; fb = fr.list[1];
      const parts = mode === 'double'
        ? (a === b ? [a, '+', b, '=', '?'] : [a, '+', b, '=', a, '+', a, '+', 1, '=', '?'])
        : [a, '+', b, '=', '?'];
      ex = eq(parts);
      area = h('div', { class: 'as-wrap' }, ex.el, fr.wrap);
      stage.append(area);
      const answerAsk = () => askNumber(api, area, { answer: total, lo: 4, hi: 20, fill: () => ex.fill(total), finalSay: `${a} plus ${b} is ${total}. Great thinking!` });

      if (mode === 'double') {
        const nA = a, nB = b;
        for (let i = 0; i < nA; i++) fa.cells[i].append(ctr());
        for (let i = 0; i < nB; i++) fb.cells[i].append(ctr(i < a ? 'is-blue' : 'is-pink'));
        phase = 'ask';
        answerAsk();
        return () => {};
      }

      for (let i = 0; i < big; i++) fa.cells[i].append(ctr());
      for (let i = 0; i < small; i++) {
        const c = ctr('is-blue');
        fb.cells[i].append(c);
        api.draggable(c, { canDrag: () => phase === 'fill' && fb.cells.includes(c.parentElement), onDrop });
      }
      fa.cells.forEach((cell, i) => api.dropTarget(cell, `a${i}`));

      const glowEmpty = () => {
        const em = fa.cells.filter((c) => !c.firstElementChild);
        em.forEach((c) => c.classList.add('as-glow'));
        setTimeout(() => em.forEach((c) => c.classList.remove('as-glow')), 2600);
      };
      const arm = () => {
        clearTimeout(idle);
        idle = setTimeout(() => {
          if (phase !== 'fill') return;
          glowEmpty();
          const left = fa.cells.filter((c) => !c.firstElementChild).length;
          api.say(`Fill the ten frame first. ${big} needs ${left} more to make 10.`, 'is-hint');
          arm();
        }, 14000);
      };
      arm();

      async function onDrop(el, target) {
        if (phase !== 'fill' || !target) return;
        arm();
        if (!fa.cells.includes(target) || target.firstElementChild) {
          if (target.firstElementChild !== el) { glowEmpty(); api.say('Pop it in an empty spot in the first frame.', 'is-hint'); }
          return;
        }
        api.sfx.drop();
        await api.flipMove(el, target);
        el.style.pointerEvents = '';
        if (fa.cells.every((c) => c.firstElementChild)) {
          phase = 'ask';
          clearTimeout(idle);
          fa.el.classList.add('as-full');
          fa.cells.forEach((c) => c.classList.remove('as-glow'));
          await api.say('The first frame is full. That makes 10!', 'is-happy');
          ex.insert([10, '+', rest, '=']);
          await api.wait(300);
          api.say(`${a} plus ${b} is the same as 10 plus ${rest}. How many altogether?`);
          answerAsk();
        }
      }
      return () => clearTimeout(idle);
    },
    async hint(stage, api) {
      clearLit(stage);
      if (mode === 'double') {
        if (a === b) {
          await api.say(`Double ${a}. ${a} and ${a} more.`, 'is-hint');
          const all = [...fa.cells, ...fb.cells].map((c) => c.firstElementChild).filter(Boolean);
          for (let i = 0; i < all.length; i++) await hop(api, all[i], i, i + 1, 450);
        } else {
          await api.say(`Double ${a} first. ${a} and ${a} is ${a + a}.`, 'is-hint');
          const base = [...fa.cells.slice(0, a), ...fb.cells.slice(0, a)].map((c) => c.firstElementChild);
          base.forEach((c) => c.classList.add('as-lit'));
          await api.wait(1000);
          clearLit(stage);
          const extra = fb.cells[a].firstElementChild;
          await api.say(`Now one more makes ${a + a + 1}.`, 'is-hint');
          await hop(api, extra, 0, a + a + 1, 700);
        }
        return;
      }
      // full frame: say it, then count on from ten over the leftovers
      fa.el.classList.add('as-full');
      fa.cells.forEach((c) => c.firstElementChild && c.firstElementChild.classList.add('as-lit'));
      await api.say(`The first frame is full. That is 10. Now count on ${rest}.`, 'is-hint');
      await api.wait(500);
      clearLit(stage);
      const left = fb.cells.map((c) => c.firstElementChild).filter(Boolean);
      for (let i = 0; i < left.length; i++) await hop(api, left[i], i, 10 + i + 1);
      await api.wait(200);
    },
    async reveal(stage, api) {
      clearLit(stage);
      await revealAnswer(stage, api, total, () => ex.fill(total), `${a} plus ${b} is ${total}.`);
    },
  };
}

/* ================= 4. Taking away ================= */
const SUBKINDS = [
  { one: 'apple', many: 'apples', draw: items.apple, verb: 'are eaten', verb1: 'is eaten' },
  { one: 'cookie', many: 'cookies', draw: items.cookie, verb: 'are eaten', verb1: 'is eaten' },
  { one: 'strawberry', many: 'strawberries', draw: items.strawberry, verb: 'are eaten', verb1: 'is eaten' },
  { one: 'muffin', many: 'muffins', draw: items.muffin, verb: 'are eaten', verb1: 'is eaten' },
  { one: 'carrot', many: 'carrots', draw: items.carrot, verb: 'are eaten', verb1: 'is eaten' },
  { one: 'fish', many: 'fish', draw: () => items.fish(), verb: 'swim away', verb1: 'swims away' },
  { one: 'ball', many: 'balls', draw: () => items.ball(), verb: 'roll away', verb1: 'rolls away' },
  { one: 'flower', many: 'flowers', draw: () => items.flower(), verb: 'are picked', verb1: 'is picked' },
  { one: 'star', many: 'stars', draw: items.star, verb: 'fall down', verb1: 'falls down' },
];

function subTask(level) {
  let n, s, mode = 'tap';
  if (level === 1) { n = randInt(4, 10); s = randInt(1, Math.min(n - 1, 6)); }
  else if (level === 2) { n = Math.random() < 0.5 ? randInt(11, 12) : randInt(8, 10); s = randInt(2, Math.min(n - 2, 9)); }
  else if (level === 3) { mode = 'pre'; n = randInt(11, 20); s = randInt(2, 9); }
  else { mode = 'think'; n = randInt(11, 20); s = n - randInt(2, 8); }
  const left = n - s;
  const kind = pick(SUBKINDS);
  const noun = (k) => (k === 1 ? kind.one : kind.many);
  const verb = s === 1 ? kind.verb1 : kind.verb;
  let say;
  if (mode === 'tap') say = `There are ${n} ${noun(n)}. ${s} ${verb}. Tap ${s} ${noun(s)} to take ${s === 1 ? 'it' : 'them'} away.`;
  else if (mode === 'pre') say = `There are ${n} ${noun(n)}. ${s} ${verb}. How many are left?`;
  else say = `${n} take away ${s}. Think: ${s} and how many make ${n}?`;

  let ex = null, cells = [], sc = null, phase = 'tap';
  const gone = () => cells.filter((c) => c.firstElementChild && c.firstElementChild.classList.contains('as-gone'));
  const finalSay = mode === 'think' ? `${s} and ${left} make ${n}, so ${n} take away ${s} is ${left}.` : `${n} take away ${s} is ${left}. Well done!`;

  return {
    say,
    mount(stage, api) {
      injectStyle();
      ex = eq([n, '−', s, '=', '?']);
      const area = h('div', { class: 'as-wrap' });
      if (mode === 'think') {
        sc = ppwScene({ whole: n, p1: s, p2: left, blank: 'p2' });
        area.append(ex.el, sc.el);
        stage.append(area);
        const origFill = sc.fill;
        sc.fill = () => { origFill(); ex.fill(left); };
        askNumber(api, area, { answer: left, lo: 1, hi: n, fill: () => sc.fill(), finalSay });
        return;
      }
      const fr = frames(n > 10 ? 2 : 1);
      cells = fr.all;
      area.append(ex.el, fr.wrap);
      stage.append(area);
      for (let i = 0; i < n; i++) cells[i].append(h('div', { class: 'as-item', html: kind.draw() }));
      const want = () => cells.forEach((c, i) => c.classList.toggle('as-want', phase === 'tap' && i < n && !c.firstElementChild.classList.contains('as-gone')));
      const fillBox = () => ex.fill(left);
      const toAsk = () => askNumber(api, area, { answer: left, lo: 0, hi: Math.max(n, 5), fill: fillBox, finalSay });

      if (mode === 'pre') {
        for (let i = n - s; i < n; i++) cells[i].firstElementChild.classList.add('as-gone');
        phase = 'ask';
        toAsk();
        return;
      }
      want();
      cells.forEach((cell, i) => cell.addEventListener('click', async () => {
        if (phase !== 'tap' || i >= n) return;
        const it = cell.firstElementChild;
        if (it.classList.contains('as-gone')) { it.classList.remove('as-gone'); api.sfx.tap(); api.say(String(gone().length) || ''); want(); return; }
        it.classList.add('as-gone');
        api.sfx.tap();
        const k = gone().length;
        api.say(String(k));
        want();
        if (k === s) {
          phase = 'ask'; want();
          await api.wait(700);
          api.say(`${n} take away ${s}. How many ${noun(left)} are left?`);
          toAsk();
        }
      }));
    },
    async hint(stage, api) {
      clearLit(stage);
      if (mode === 'think') return sc.hint(api);
      await api.say("Let's count what is left.", 'is-hint');
      const rem = cells.slice(0, n).map((c) => c.firstElementChild).filter((e) => !e.classList.contains('as-gone'));
      for (let i = 0; i < rem.length; i++) await hop(api, rem[i], i, i + 1, 550);
      await api.wait(200);
    },
    async reveal(stage, api) {
      clearLit(stage);
      await revealAnswer(stage, api, left, () => (sc ? sc.fill() : ex.fill(left)), finalSay);
    },
  };
}

/* ================= module ================= */
export default {
  id: 'addsub',
  title: 'Add and Take Away',
  tagline: 'Ten frames and number friends',
  colour: 'purple',
  art: moduleArt.addsub,
  skills: [
    { id: 'addsub.add', name: 'Adding', maxLevel: 4 },
    { id: 'addsub.ppw', name: 'Number friends', maxLevel: 4 },
    { id: 'addsub.maketen', name: 'Make ten', maxLevel: 4 },
    { id: 'addsub.sub', name: 'Taking away', maxLevel: 4 },
  ],
  makeTask(skillId, level) {
    const lv = Math.max(1, Math.min(4, Number(level) || 1));
    try {
      if (skillId === 'addsub.ppw') return ppwTask(lv);
      if (skillId === 'addsub.maketen') return makeTenTask(lv);
      if (skillId === 'addsub.sub') return subTask(lv);
      return addTask(lv);
    } catch (e) {
      console.error('addsub makeTask failed', e);
      return addTask(1);
    }
  },
};
