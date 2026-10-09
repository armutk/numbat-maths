// Equal Groups — count in 2s, 5s and 10s (VC2M1N03, VC2M1A01) and grouping vs sharing (VC2M1N06).
import { h, flipMove, wait, randInt, pick, shuffle } from '../ui.js';
import { items, moduleArt } from '../art.js';

/* ---------------------------------------------------------------- styles (self-contained) */
const HAND_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 150'><g fill='#ffd9b8' stroke='#e5ad82' stroke-width='3' stroke-linejoin='round'><rect x='4' y='56' width='22' height='56' rx='11' transform='rotate(-32 15 84)'/><rect x='32' y='10' width='20' height='80' rx='10'/><rect x='55' y='3' width='20' height='86' rx='10'/><rect x='78' y='8' width='20' height='82' rx='10'/><rect x='101' y='24' width='19' height='68' rx='9.5'/><rect x='22' y='50' width='98' height='94' rx='32'/></g><rect x='30' y='56' width='82' height='80' rx='26' fill='#ffd9b8'/></svg>`;

const CSS = `
.g-wrap{position:relative;display:flex;flex-direction:column;align-items:center}
.g-badge{position:absolute;right:-6px;top:-12px;min-width:38px;height:38px;padding:0 10px;border-radius:999px;background:var(--ink);color:#fff;font-weight:700;font-size:1.25rem;display:flex;align-items:center;justify-content:center;opacity:0;transform:scale(.6);transition:opacity .25s,transform .25s var(--ease-pop);z-index:4;pointer-events:none}
.g-badge.on{opacity:1;transform:scale(1)}
.g-badge.is-blank{background:var(--yellow-soft);color:var(--yellow-deep);box-shadow:inset 0 0 0 3px var(--yellow-deep)}
.g-glow{animation:nudge 1.1s ease-in-out infinite}
.g-glow .plate-dish,.g-glow.tenframe,.g-glow.g-t5{box-shadow:0 0 0 6px var(--yellow-soft),0 10px 20px rgba(255,210,63,.5)!important}
.g-pulse{animation:nudge .6s ease-in-out}
.g-tappable{cursor:pointer;touch-action:manipulation}
.plate.g-hand .plate-dish{background:url("data:image/svg+xml,${encodeURIComponent(HAND_SVG)}") center/contain no-repeat;border-radius:0;box-shadow:none;width:150px;min-height:150px;padding:60px 26px 12px;gap:2px;align-content:center}
.plate.g-hand.is-over .plate-dish,.plate.g-hand.g-glow .plate-dish{box-shadow:none!important;filter:drop-shadow(0 0 8px var(--blue))}
.plate.g-hand.g-glow .plate-dish{filter:drop-shadow(0 0 9px var(--yellow-deep))}
.plate.g-hand.is-full .plate-dish{filter:drop-shadow(0 0 5px var(--green))}
.plate.g-bag .plate-dish{border-radius:10px 10px 22px 22px;background:#f0cf94;box-shadow:inset 0 0 0 4px #d9a85f,0 6px 0 #c08f45;padding:12px 8px 8px;gap:3px}
.plate.g-bag .plate-dish::before{content:'';position:absolute;top:-9px;left:14%;right:14%;height:14px;background:#e3b872;border-radius:8px 8px 0 0;box-shadow:inset 0 0 0 3px #d9a85f}
.plate.g-bag.is-full .plate-dish{box-shadow:inset 0 0 0 4px var(--green),0 6px 0 #c08f45}
.plate.g-bag.g-unused{opacity:.35}
.plate.hoop .plate-dish{padding:8px;gap:3px}
.tenframe.is-full{box-shadow:0 6px 0 var(--green-deep),var(--shadow-card)}
.g-t5{display:flex;gap:3px;padding:12px 12px 10px;border-radius:16px;background:#fff;box-shadow:inset 0 0 0 4px var(--blue-soft),0 6px 0 var(--sand-deep)}
.g-track{padding-top:34px;gap:16px;align-items:flex-end}
.g-tcell{position:relative}
.g-jump{position:absolute;left:-26px;top:-28px;width:36px;text-align:center;font-weight:700;font-size:.95rem;color:var(--green-deep);background:var(--green-soft);border-radius:999px;padding:1px 0}
.g-center{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;flex:1 1 auto;min-height:0}
.g-row{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:clamp(16px,3vmin,30px);padding-top:14px}
.g-left{margin-top:4px;font-weight:600;color:var(--ink-soft)}
`;
function injectStyle() {
  if (document.getElementById('groups-css')) return;
  const s = document.createElement('style');
  s.id = 'groups-css';
  s.textContent = CSS;
  document.head.append(s);
}

/* ---------------------------------------------------------------- shared bits */
const SOCKS = ['#4d9eeb', '#ff7ea8', '#ffd23f', '#3fb984', '#9b7cf0', '#ff8c42'];
const COUNTERS = ['is-blue', 'is-green', 'is-purple', 'is-pink', ''];
const THINGS = [
  { one: 'lolly', many: 'lollies', draw: (c) => items.lolly(c) },
  { one: 'cookie', many: 'cookies', draw: () => items.cookie() },
  { one: 'apple', many: 'apples', draw: () => items.apple() },
  { one: 'strawberry', many: 'strawberries', draw: () => items.strawberry() },
  { one: 'muffin', many: 'muffins', draw: () => items.muffin() },
  { one: 'carrot', many: 'carrots', draw: () => items.carrot() },
];
const noun = (t, n) => (n === 1 ? t.one : t.many);

/** Three answer buttons that are different kinds of "close": +/- one group, +/- 1. */
function totalOptions(total, per) {
  const cands = shuffle([total + per, total - per, total + 1, total - 1, total + 2 * per].filter((v) => v > 0 && v !== total));
  return shuffle([total, ...cands.slice(0, 2)]);
}

/** Light the badges one at a time with a tick and a spoken count. */
async function pulse(api, targets, labelFn, ms = 600) {
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    const l = labelFn(i);
    t.wrap.classList.add('g-pulse');
    api.sfx.tick(i);
    if (l != null) {
      t.badge.textContent = String(l);
      t.badge.classList.add('on');
      t.badge.classList.toggle('is-blank', l === '?');
      if (l !== '?') api.say(String(l));
    }
    await wait(ms);
    t.wrap.classList.remove('g-pulse');
  }
}

/** Ask for a number. Wires S.answer and S.onRight so hint/reveal can work. */
function askNum(api, S, parent, { answer, options, finalSay, onCorrect }) {
  S.answer = answer;
  const grp = api.ask({ options, answer, parent, finalSay, onCorrect });
  grp.addEventListener('click', (e) => {
    const b = e.target.closest('.choice');
    if (b && Number(b.dataset.value) === answer && S.onRight) S.onRight();
  });
  S.group = grp;
  return grp;
}

function sentenceEl(text) {
  const b = h('b', {}, '?');
  return { el: h('div', { class: 'sentence' }, text, b), b };
}

/** Standard hint/reveal for tasks whose last step is a number question. */
function wireHelp(task, S) {
  task.hint = (stage, api, wrongs) => (S.replay ? S.replay(api, wrongs) : undefined);
  task.reveal = async (stage, api) => {
    const b = [...stage.querySelectorAll('.choice')].find((c) => c.dataset.value === String(S.answer));
    if (b) { b.classList.remove('is-dim'); b.classList.add('is-right'); }
    if (S.onRight) S.onRight();
    await api.say(S.revealSay || `It is ${S.answer}.`, 'is-happy');
  };
  return task;
}

/* ---------------------------------------------------------------- containers */
function plateWidth(slots) { return slots <= 4 ? 150 : slots <= 6 ? 130 : slots <= 8 ? 120 : 108; }

/**
 * Build one container. kind: hoop | hand | bag | frame.
 * Returns { wrap (laid out), el (drop target / glow target), badge, count(), place(item), cap }
 */
function buildZone(api, kind, { i, itemPx, plateW, droppable = true, cell = 40 }) {
  const badge = h('div', { class: 'g-badge' });
  if (kind === 'frame') {
    const cells = Array.from({ length: 10 }, () => h('div', { class: 'cell' }));
    const el = h('div', { class: `tenframe g-frame ${droppable ? 'drop' : ''}`, style: { '--cell': `${cell}px`, '--item': `${Math.round(cell * 0.82)}px` } }, ...cells);
    if (droppable) api.dropTarget(el, `z${i}`);
    const wrap = h('div', { class: 'g-wrap' }, el, badge);
    return {
      wrap, el, badge, cells, cap: 10,
      count: () => el.querySelectorAll('.item').length,
      place: (it) => flipMove(it, cells.find((c) => !c.querySelector('.item')) || cells[9]),
    };
  }
  const dish = h('div', { class: 'plate-dish', style: { '--item': `${itemPx}px` } });
  const cls = { hoop: 'hoop g-hoop', hand: 'g-hand', bag: 'basket g-bag' }[kind];
  const el = h('div', { class: `plate ${droppable ? 'drop' : ''} ${cls}`, style: { '--plate-w': `${plateW}px`, '--plate-h': kind === 'hand' ? '150px' : kind === 'bag' ? '96px' : '84px' } },
    h('div', { style: { position: 'relative', width: '100%' } }, dish, badge));
  if (droppable) api.dropTarget(el, `z${i}`);
  return {
    wrap: el, el, badge, dish, cap: null,
    count: () => dish.children.length,
    place: (it) => flipMove(it, dish),
  };
}

const fillItem = (el, d) => { if (typeof d === 'string') el.innerHTML = d; else el.append(d); return el; };

/* ---------------------------------------------------------------- drag-into-groups engine */
/**
 * cfg: say, kind, per, total, slots, leftover, itemPx, trayPx, drawItem(i), okSay, word, onSolved(ctx), cell
 */
function placeTask(cfg) {
  const { say, kind, per, total, slots, leftover = 0, itemPx, trayPx, drawItem, okSay, word, onSolved, cell } = cfg;
  const S = {};
  const used = Math.floor(total / per);
  const task = {
    say,
    mount(stage, api) {
      injectStyle();
      let phase = 'place', busy = false, saidCheck = false;
      const row = h('div', { class: 'plates' });
      const plateW = plateWidth(slots);
      const zones = Array.from({ length: slots }, (_, i) => {
        const z = buildZone(api, kind, { i, itemPx, plateW, cell });
        row.append(z.wrap);
        return z;
      });
      const tray = h('div', { class: 'tray drop', style: { '--item': `${trayPx}px` } });
      api.dropTarget(tray, 'tray');
      const pieces = [];
      for (let i = 0; i < total; i++) {
        const el = fillItem(h('div', { class: 'item' }), drawItem(i));
        api.draggable(el, { canDrag: () => phase === 'place', onDrop: drop });
        tray.append(el);
        pieces.push(el);
      }
      stage.append(row, tray);

      const checkBtn = api.button('Check', onCheck);
      checkBtn.disabled = true;

      function clearGlow() { zones.forEach((z) => z.el.classList.remove('g-glow')); }
      function refresh() {
        clearGlow();
        zones.forEach((z) => z.el.classList.toggle('is-full', z.count() === per));
        tray.classList.toggle('is-empty', tray.children.length === 0);
        const ready = tray.children.length <= leftover;
        checkBtn.disabled = !ready;
        if (ready && !saidCheck) { saidCheck = true; checkBtn.classList.add('is-glow'); api.say('All done? Tap Check.'); }
        if (!ready) { saidCheck = false; checkBtn.classList.remove('is-glow'); }
      }
      async function drop(el, target) {
        if (!target || phase !== 'place') return;
        if (target === tray) {
          if (el.parentElement === tray) { el.style.transform = ''; return; }
          api.sfx.drop();
          await flipMove(el, tray);
        } else {
          const z = zones.find((q) => q.el === target);
          if (!z || z.el.contains(el)) { el.style.transform = ''; return; }
          if (z.cap && z.count() >= z.cap) { el.style.transform = ''; api.say(`That ${word} is full. It holds ${z.cap}.`, 'is-hint'); return; }
          api.sfx.drop();
          await z.place(el);
        }
        refresh();
      }

      async function solved(auto) {
        phase = 'done';
        checkBtn.remove();
        zones.forEach((z) => { z.el.classList.remove('g-glow'); z.el.classList.toggle('is-full', z.count() === per); if (kind === 'bag' && z.count() === 0) z.el.classList.add('g-unused'); });
        if (!tray.children.length) tray.remove(); else { tray.classList.remove('drop'); tray.classList.add('is-empty'); }
        if (auto) await api.say(okSay, 'is-happy'); else await api.step(true, { say: okSay });
        const usedZones = zones.filter((z) => z.count() > 0);
        await onSolved({ api, stage, S, zones: usedZones, row, per, total, tray });
      }

      async function onCheck() {
        if (phase !== 'place' || busy) return;
        busy = true;
        checkBtn.classList.remove('is-glow');
        const counts = zones.map((z) => z.count());
        const bad = counts.findIndex((c) => c !== 0 && c !== per);
        const ok = bad < 0 && tray.children.length === leftover;
        if (ok) { await solved(false); busy = false; return; }
        let msg = 'Have another look. Every group needs the same.';
        if (bad >= 0) {
          zones[bad].el.classList.add('g-glow');
          msg = `This ${word} has ${counts[bad]}. Every ${word} needs ${per}.`;
        }
        await api.step(false, { say: msg, hint: (st, a, wrongs) => hint(wrongs) });
        busy = false;
      }

      async function hint(wrongs) {
        if (wrongs < 2 || phase !== 'place') return;
        phase = 'auto';
        clearGlow();
        checkBtn.remove();
        await api.say(`Let's make ${per === 2 ? 'pairs' : `groups of ${per}`} together.`);
        // everything back to the tray first so no group is ever over capacity
        await Promise.all(pieces.filter((p) => p.parentElement !== tray).map((p) => flipMove(p, tray, { duration: 250 })));
        for (let idx = 0; idx < used * per; idx++) {
          const zi = Math.floor(idx / per);
          api.sfx.tick(zi);
          await zones[zi].place(pieces[idx]);
          await wait(110);
        }
        refresh();
        await wait(250);
        await solved(true);
      }

      return () => {};
    },
  };
  return wireHelp(task, S);
}

/* ---------------------------------------------------------------- tap-to-count engine */
/**
 * cfg: say, makeGroups(api) -> [{ wrap, badge, labels:[..], subs?:[el] }], total, per, okSay, sentence, finalSay, gap
 */
function tapTask(cfg) {
  const S = {};
  const task = {
    say: cfg.say,
    mount(stage, api) {
      injectStyle();
      const groups = cfg.makeGroups(api);
      const row = h('div', { class: 'g-row' }, ...groups.map((g) => g.wrap));
      const center = h('div', { class: 'g-center' }, row);
      stage.append(center);
      let next = 0, busy = false;
      S.replay = async (a) => {
        await pulse(a, groups, (i) => groups[i].labels[groups[i].labels.length - 1], 650);
      };
      const arm = () => groups[next] && groups[next].wrap.classList.add('g-glow');
      async function play(g, gi) {
        for (let j = 0; j < g.labels.length; j++) {
          g.badge.textContent = String(g.labels[j]);
          g.badge.classList.add('on');
          api.sfx.tick(gi + j);
          if (g.subs && g.subs[j]) g.subs[j].classList.add('g-pulse');
          api.say(String(g.labels[j]));
          await wait(g.labels.length > 1 ? 520 : 650);
        }
      }
      async function allCounted() {
        const s = sentenceEl(cfg.sentence);
        S.onRight = () => { s.b.textContent = String(cfg.total); };
        center.append(s.el);
        await api.step(true, { say: cfg.okSay });
        api.say('So how many altogether?');
        askNum(api, S, stage, { answer: cfg.total, options: totalOptions(cfg.total, cfg.per), finalSay: cfg.finalSay });
      }
      groups.forEach((g, gi) => {
        g.wrap.classList.add('g-tappable');
        g.wrap.addEventListener('click', async () => {
          if (busy || gi < next) return;
          if (gi !== next) { groups[next].wrap.classList.add('g-pulse'); const w = groups[next].wrap; setTimeout(() => w.classList.remove('g-pulse'), 600); api.say('Start here.'); return; }
          busy = true;
          g.wrap.classList.remove('g-glow');
          await play(g, gi);
          next++;
          if (next < groups.length) { arm(); busy = false; } else { await allCounted(); }
        });
      });
      arm();
      api.say(cfg.tapSay || 'Tap each group to count.');
      return () => {};
    },
  };
  S.revealSay = '';
  return wireHelp(task, S);
}

/* ---------------------------------------------------------------- missing-number track */
function trackTask({ say, step, start, n, blankIdx, tail }) {
  const S = {};
  const values = Array.from({ length: n }, (_, i) => start + i * step);
  const answer = values[blankIdx];
  const task = {
    say,
    mount(stage, api) {
      injectStyle();
      const cells = values.map((v, i) => h('div', { class: `cellnum ${i === blankIdx ? 'is-blank' : ''}` }, i === blankIdx ? '?' : String(v)));
      const track = h('div', { class: 'track g-track', style: { '--cell': 'min(10vmin, 74px)' } },
        ...cells.map((c, i) => h('div', { class: 'g-tcell' }, i > 0 ? h('div', { class: 'g-jump' }, `+${step}`) : null, c)));
      stage.append(h('div', { class: 'g-center' }, track));
      const fill = () => { const c = cells[blankIdx]; c.textContent = String(answer); c.classList.remove('is-blank'); c.classList.add('is-right'); };
      S.onRight = fill;
      S.revealSay = `It is ${answer}. We count in ${step}s.`;
      S.replay = async (a) => {
        for (let i = 0; i < cells.length; i++) {
          cells[i].classList.add('is-hint');
          a.sfx.tick(i);
          if (i !== blankIdx) a.say(String(values[i])); else a.say('What comes here?');
          await wait(i === blankIdx ? 800 : 600);
          cells[i].classList.remove('is-hint');
        }
      };
      const opts = shuffle([answer, answer + step, answer - step > 0 ? answer - step : answer + 2 * step]);
      const finalSay = `${values.join(', ')}. ${tail}`;
      api.say(say);
      askNum(api, S, stage, { answer, options: opts, finalSay });
      return () => {};
    },
  };
  return wireHelp(task, S);
}

/* ---------------------------------------------------------------- 1. groups of 2 */
function pairsTask(level) {
  const range = { 1: [4, 8], 2: [8, 12], 3: [12, 16], 4: [16, 20] }[level];
  const total = 2 * randInt(range[0] / 2, range[1] / 2);
  const g = total / 2;
  const cols = shuffle(SOCKS).slice(0, 2);
  const gapIdx = level === 3 ? randInt(1, g - 2) : -1;
  return placeTask({
    say: 'Put the socks in pairs. Each hoop needs 2 socks.',
    kind: 'hoop', per: 2, total, slots: g, word: 'hoop',
    itemPx: g > 8 ? 34 : 38, trayPx: total > 14 ? 40 : 46,
    drawItem: (i) => items.sock(cols[i % 2]),
    okSay: 'Every hoop has 2. Lovely pairs!',
    async onSolved({ api, stage, S, zones, row, tray }) {
      const label = (i) => (i === gapIdx ? '?' : 2 * (i + 1));
      S.replay = (a) => pulse(a, zones, label);
      await pulse(api, zones, label, 520);
      await wait(250);
      const total2 = 2 * g;
      if (level === 3) {
        S.onRight = () => { const z = zones[gapIdx]; z.badge.textContent = String(2 * (gapIdx + 1)); z.badge.classList.remove('is-blank'); };
        api.say('One number is hiding. Which one is missing?');
        const ans = 2 * (gapIdx + 1);
        askNum(api, S, stage, { answer: ans, options: shuffle([ans, ans + 2, ans - 2]), finalSay: `${g} groups of 2 is ${total2}.` });
        S.revealSay = `It is ${ans}. We count 2, 4, 6.`;
        return;
      }
      const s = sentenceEl(`${g} groups of 2 is `);
      stage.append(s.el);
      if (level === 4) {
        api.say('How many pairs?');
        S.answer = g;
        S.onRight = null;
        S.revealSay = `${g} pairs.`;
        askNum(api, S, stage, {
          answer: g, options: shuffle([g, g + 1, g - 1].filter((v) => v > 0)),
          onCorrect: {
            say: `${g} pairs!`,
            then: () => {
              S.group.remove();
              S.onRight = () => { s.b.textContent = String(total2); };
              S.revealSay = '';
              api.say('How many socks?');
              askNum(api, S, stage, { answer: total2, options: totalOptions(total2, 2), finalSay: `${g} groups of 2 is ${total2}.` });
            },
          },
        });
        return;
      }
      S.onRight = () => { s.b.textContent = String(total2); };
      api.say('How many socks altogether?');
      askNum(api, S, stage, { answer: total2, options: totalOptions(total2, 2), finalSay: `${g} groups of 2 is ${total2}.` });
    },
  });
}

/* ---------------------------------------------------------------- 2. groups of 5 */
function fivesDraw() {
  const useStar = Math.random() < 0.5;
  const col = pick(['#ff7ea8', '#4d9eeb', '#ff8c42', '#9b7cf0']);
  return { thing: useStar ? 'stars' : 'lollies', draw: useStar ? () => items.star() : () => items.lolly(col) };
}

function fivesTask(level) {
  const f = fivesDraw();
  if (level === 1 || level === 4) {
    const g = level === 1 ? randInt(2, 3) : randInt(5, 8);
    const total = g * 5;
    return tapTask({
      per: 5, total,
      say: level === 1 ? 'Count the stars in fives. Tap each hand.' : `Count in fives. Tap each tray.`,
      tapSay: 'Tap to count in fives.',
      okSay: `${g} groups of 5.`,
      sentence: `${g} groups of 5 is `,
      finalSay: `${g} groups of 5 is ${total}.`,
      makeGroups(api) {
        return Array.from({ length: g }, (_, i) => {
          let badge = h('div', { class: 'g-badge' });
          let wrap;
          if (level === 1) {
            const z = buildZone(api, 'hand', { i, itemPx: 30, plateW: 150, droppable: false });
            for (let k = 0; k < 5; k++) z.dish.append(h('div', { class: 'item', html: f.draw() }));
            wrap = z.wrap;
            badge = z.badge;
          } else {
            const t = h('div', { class: 'g-t5', style: { '--item': '30px' } }, ...Array.from({ length: 5 }, () => h('div', { class: 'item', html: f.draw() })));
            wrap = h('div', { class: 'g-wrap' }, t, badge);
          }
          return { wrap, badge, labels: [5 * (i + 1)] };
        });
      },
    });
  }
  if (level === 2) {
    const g = randInt(2, 4);
    const total = g * 5;
    return placeTask({
      say: `Put 5 ${f.thing} in each hand.`,
      kind: 'hand', per: 5, total, slots: g, word: 'hand',
      itemPx: 30, trayPx: total > 12 ? 42 : 48,
      drawItem: () => f.draw(),
      okSay: 'Every hand has 5. Well done!',
      async onSolved({ api, stage, S, zones }) {
        S.replay = (a) => pulse(a, zones, (i) => 5 * (i + 1));
        await pulse(api, zones, (i) => 5 * (i + 1), 560);
        await wait(250);
        const s = sentenceEl(`${g} groups of 5 is `);
        stage.append(s.el);
        S.onRight = () => { s.b.textContent = String(total); };
        api.say('How many altogether?');
        askNum(api, S, stage, { answer: total, options: totalOptions(total, 5), finalSay: `${g} groups of 5 is ${total}.` });
      },
    });
  }
  // level 3: missing number in a 5s track
  const start = pick([5, 5, 10, 15, 20]);
  const n = 7;
  return trackTask({
    say: 'Count in fives. Which number is missing?',
    step: 5, start, n, blankIdx: randInt(2, n - 2), tail: 'We count in 5s.',
  });
}

/* ---------------------------------------------------------------- 3. groups of 10 */
function frameEl(api, { filled, cell, col, i }) {
  const z = buildZone(api, 'frame', { i, cell, droppable: false });
  z.cells.slice(0, filled).forEach((c) => c.append(h('div', { class: `counter ${col}` })));
  return z;
}

function tensTask(level) {
  const col = pick(COUNTERS);
  if (level === 1) {
    const g = randInt(2, 3);
    const total = g * 10;
    return tapTask({
      per: 10, total,
      say: 'Count in tens. Tap each ten frame.',
      tapSay: 'Tap to count in tens.',
      okSay: `${g} groups of 10.`,
      sentence: `${g} groups of 10 is `,
      finalSay: `${g} groups of 10 is ${total}.`,
      makeGroups(api) {
        return Array.from({ length: g }, (_, i) => {
          const z = frameEl(api, { filled: 10, cell: 40, col, i });
          return { wrap: z.wrap, badge: z.badge, labels: [10 * (i + 1)] };
        });
      },
    });
  }
  if (level === 2) {
    const total = pick([10, 20, 20]);
    const g = total / 10;
    return placeTask({
      say: 'Fill each ten frame with 10 counters.',
      kind: 'frame', per: 10, total, slots: g, word: 'frame', cell: 40,
      itemPx: 32, trayPx: 38,
      drawItem: () => h('div', { class: `counter ${col}`, style: { width: '100%', height: '100%' } }),
      okSay: 'Every frame is full. That is 10!',
      async onSolved({ api, stage, S, zones }) {
        S.replay = (a) => pulse(a, zones, (i) => 10 * (i + 1));
        await pulse(api, zones, (i) => 10 * (i + 1), 650);
        await wait(250);
        const s = sentenceEl(`${g} ${g === 1 ? 'group' : 'groups'} of 10 is `);
        stage.append(s.el);
        S.onRight = () => { s.b.textContent = String(total); };
        api.say('How many altogether?');
        askNum(api, S, stage, { answer: total, options: totalOptions(total, 10), finalSay: `${g} ${g === 1 ? 'group' : 'groups'} of 10 is ${total}.` });
      },
    });
  }
  if (level === 3) {
    const start = pick([10, 10, 20, 30, 40, 50, 60]);
    const n = 7;
    return trackTask({
      say: 'Count in tens. Which number is missing?',
      step: 10, start, n, blankIdx: randInt(2, n - 2), tail: 'We count in 10s.',
    });
  }
  // level 4: tens and ones
  const tens = randInt(2, 4);
  const ones = randInt(1, 9);
  const total = tens * 10 + ones;
  return tapTask({
    per: 10, total,
    say: 'Count the tens, then count on the ones.',
    tapSay: 'Tap each ten, then the ones.',
    okSay: `${tens} tens and ${ones} ${ones === 1 ? 'one' : 'ones'}.`,
    sentence: `${tens} tens and ${ones} ${ones === 1 ? 'one' : 'ones'} is `,
    finalSay: `${tens} tens and ${ones} ${ones === 1 ? 'one' : 'ones'} is ${total}.`,
    makeGroups(api) {
      const cell = 34;
      const gs = Array.from({ length: tens }, (_, i) => {
        const z = frameEl(api, { filled: 10, cell, col: 'is-blue', i });
        return { wrap: z.wrap, badge: z.badge, labels: [10 * (i + 1)] };
      });
      const z = frameEl(api, { filled: ones, cell, col: '', i: tens });
      z.cells.slice(0, ones).forEach((c) => { c.firstElementChild.style.background = 'var(--orange)'; });
      gs.push({
        wrap: z.wrap, badge: z.badge,
        labels: Array.from({ length: ones }, (_, k) => tens * 10 + k + 1),
        subs: z.cells.slice(0, ones).map((c) => c.firstElementChild),
      });
      return gs;
    },
  });
}

/* ---------------------------------------------------------------- 4. how many groups? */
function howManyTask(level) {
  const t = pick(THINGS);
  const col = pick(['#ff7ea8', '#4d9eeb', '#ffd23f', '#9b7cf0']);
  let per, total, leftover = 0;
  if (level === 1) { per = 2; total = pick([4, 6, 8]); }
  else if (level === 2) { per = pick([2, 5]); total = per === 2 ? pick([6, 8, 10, 12, 14]) : pick([10, 15]); }
  else if (level === 3) { per = pick([3, 4]); total = per === 3 ? pick([6, 9, 12, 15]) : pick([8, 12, 16]); }
  else {
    per = randInt(2, 5);
    const b = randInt(2, Math.min(6, Math.floor(18 / per)));
    leftover = randInt(1, per - 1);
    total = per * b + leftover;
  }
  const bags = Math.floor(total / per);
  const slots = Math.min(bags + 2, 10);
  const word = noun(t, total);
  return placeTask({
    say: `Put the ${total} ${word} in bags of ${per}. How many bags do you fill?`,
    kind: 'bag', per, total, slots, leftover, word: 'bag',
    itemPx: 34, trayPx: total > 14 ? 42 : 46,
    drawItem: () => t.draw(col),
    okSay: `Every bag has ${per}.`,
    async onSolved({ api, stage, S, zones, tray }) {
      S.replay = (a) => pulse(a, zones, (i) => i + 1);
      await pulse(api, zones, (i) => i + 1, 560);
      await wait(250);
      const s = sentenceEl(`${total} ${word} in bags of ${per} makes `);
      stage.append(s.el);
      S.onRight = () => { s.b.textContent = `${bags} ${bags === 1 ? 'bag' : 'bags'}`; };
      S.revealSay = `It is ${bags}.`;
      api.say('How many bags did you use?');
      const bagOpts = shuffle([bags, bags + 1, bags > 1 ? bags - 1 : bags + 2]);
      if (!leftover) {
        askNum(api, S, stage, { answer: bags, options: bagOpts, finalSay: `${total} ${word} in bags of ${per} makes ${bags} bags.` });
        return;
      }
      askNum(api, S, stage, {
        answer: bags, options: bagOpts,
        onCorrect: {
          say: `${bags} bags.`,
          then: () => {
            S.group.remove();
            tray.classList.add('g-glow');
            tray.style.boxShadow = '0 0 0 6px var(--yellow-soft)';
            S.onRight = () => { s.b.textContent = `${bags} bags, ${leftover} left`; };
            S.revealSay = `${leftover} left over.`;
            api.say(`How many ${word} are left over?`);
            askNum(api, S, stage, {
              answer: leftover, options: shuffle([leftover, ...[leftover + 1, leftover - 1, leftover + 2].filter((v) => v >= 0).slice(0, 2)]),
              finalSay: `${bags} bags of ${per}, and ${leftover} left over.`,
            });
          },
        },
      });
    },
  });
}

/* ---------------------------------------------------------------- module */
export default {
  id: 'groups',
  title: 'Equal Groups',
  tagline: 'Count in 2s, 5s and 10s',
  colour: 'green',
  art: moduleArt.groups,
  skills: [
    { id: 'groups.pairs', name: 'Groups of 2', maxLevel: 4 },
    { id: 'groups.fives', name: 'Groups of 5', maxLevel: 4 },
    { id: 'groups.tens', name: 'Groups of 10', maxLevel: 4 },
    { id: 'groups.howmany', name: 'How many groups?', maxLevel: 4 },
  ],
  makeTask(skillId, level) {
    const lv = Math.max(1, Math.min(4, Number(level) || 1));
    try {
      if (skillId === 'groups.fives') return fivesTask(lv);
      if (skillId === 'groups.tens') return tensTask(lv);
      if (skillId === 'groups.howmany') return howManyTask(lv);
      return pairsTask(lv);
    } catch (e) {
      console.error(e);
      return pairsTask(1);
    }
  },
};
