// Numbers to 120 — VC2M1N01 (recognise, represent, order numbers to 120) and VC2M1N02 (partition into tens and ones).
import { h, svg, flipMove, wait, randInt, pick, shuffle } from '../ui.js';
import { moduleArt } from '../art.js';
import { say as speak } from '../voice.js';

/* ---------- styles (self-contained; injected once) ---------- */
const CSS = `
.nb-chart { display: grid; grid-template-columns: repeat(10, var(--cell)); gap: var(--g, 5px); justify-content: center; align-content: center; margin: auto; flex: 0 0 auto; }
.nb-chart .nb-half { display: contents; }
.nb-chart.is-split { display: flex; gap: 26px; align-items: flex-start; }
.nb-chart.is-split .nb-half { display: grid; grid-template-columns: repeat(10, var(--cell)); gap: var(--g, 5px); }
.nb-chart .cellnum, .nb-track .cellnum { width: var(--cell); height: var(--cell); font-size: calc(var(--cell) * 0.4); border-radius: calc(var(--cell) * 0.22); }
.nb-chart .cellnum { box-shadow: 0 3px 0 var(--sand-deep), 0 4px 8px rgba(43, 39, 64, 0.06); }
.nb-track { margin: auto; flex: 0 0 auto; gap: 8px; }
.nb-chart .cellnum.is-tens, .nb-track .cellnum.is-tens { background: var(--blue-soft); box-shadow: 0 3px 0 var(--blue), 0 4px 8px rgba(77, 158, 235, 0.25); }
.nb-chart .cellnum.is-wrong, .nb-track .cellnum.is-wrong { background: var(--sand); color: var(--ink-faint); box-shadow: 0 2px 0 var(--sand-deep); pointer-events: none; }
.nb-chart .cellnum.is-right, .nb-track .cellnum.is-right { background: var(--green); color: #fff; box-shadow: 0 3px 0 var(--green-deep); }
.nb-chart .cellnum.is-hint, .nb-track .cellnum.is-hint { background: var(--yellow); color: var(--ink); box-shadow: 0 3px 0 var(--yellow-deep); }
.nb-seg { margin: 0 auto; flex: 0 0 auto; gap: 10px; flex-wrap: nowrap; }
.nb-seg .cellnum { width: var(--cell); height: var(--cell); font-size: calc(var(--cell) * 0.42); border-radius: 22px; cursor: default; }
.nb-seg .cellnum.is-blank { border: 4px dashed var(--yellow-deep); }
.nb-seg .cellnum.is-blank.is-right { border: 0; }
.nb-seg .cellnum.is-blank.is-hint { background: var(--yellow); }
.nb-seg .cellnum.is-lit { background: var(--blue-soft); box-shadow: 0 4px 0 var(--blue); transform: translateY(-6px); }

/* build */
.nb-build { --unit: 22px; flex: 1 1 auto; min-height: 0; display: flex; flex-direction: row; gap: 14px; align-items: stretch; }
.nb-build.is-big { --unit: 17px; }
.nb-build .nb-main { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 10px; justify-content: center; }
.nb-build .mat { flex: 0 0 auto; gap: 14px; }
.nb-build .mat-col { padding: 10px 12px; }
.nb-build .mat-col.tens { flex: 3 1 0; }
.nb-build.is-big .mat-col.tens { flex: 5 1 0; }
.nb-build .mat-col.ones { flex: 2 1 0; }
.nb-build .mat .mat-col .mat-zone { min-height: calc(var(--unit) * 10 + 18px + 24px); align-content: flex-end; align-items: flex-end; gap: 4px; }
.nb-build .mat-col.is-over .mat-zone { background: var(--blue-soft); }
.nb-build .mat-col.nb-glow { animation: nb-glow 1s ease-in-out infinite; }
@keyframes nb-glow { 0%, 100% { box-shadow: 0 6px 0 var(--sand-deep), 0 0 0 0 rgba(255, 210, 63, 0); } 50% { box-shadow: 0 6px 0 var(--sand-deep), 0 0 0 8px var(--yellow); } }
.nb-build .mat-col .big { font-size: 2.2rem; min-height: 1.1em; }
.nb-build .mat-col .nb-need { align-self: center; font-size: 1.05rem; font-weight: 700; background: var(--yellow-soft); color: var(--yellow-deep); border-radius: 999px; padding: 2px 14px; min-height: 1.5em; }
.nb-build .mat-col .nb-need:empty { visibility: hidden; }
.nb-build .equation { font-size: clamp(2rem, 5vmin, 3rem); }
.nb-build .equation .t { color: var(--blue-deep); }
.nb-build .equation .o { color: var(--orange-deep); }
.nb-build .equation .sum { color: var(--ink); }
.nb-build .tray { flex: 0 0 auto; flex-direction: column; justify-content: center; align-items: center; gap: 14px; padding: 12px; min-height: 0; width: 148px; }
.nb-hold { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: calc(var(--unit) + 24px); justify-content: flex-end; }
.nb-lbl { font-weight: 700; color: var(--ink-soft); font-size: 1.15rem; }
.nb-piece.item { width: auto; height: auto; padding: 6px 4px; display: flex; align-items: flex-end; justify-content: center; filter: none; }
.nb-piece::after { content: ""; position: absolute; inset: -6px -4px; }
.nb-piece.is-dragging, .nb-piece.is-picked { filter: drop-shadow(0 10px 8px rgba(43, 39, 64, 0.25)); }
.nb-piece.nb-src .block-ten { box-shadow: inset 0 0 0 2px var(--blue-deep), 5px 5px 0 -1px var(--blue-soft), 5px 5px 0 1px var(--blue); }
.nb-piece.nb-src .block-one { box-shadow: inset 0 0 0 2px var(--orange-deep), 4px 4px 0 -1px var(--orange-soft), 4px 4px 0 1px var(--orange); }
.nb-piece.nb-in { animation: popin 0.35s var(--ease-pop); }
.nb-piece.nb-out { transition: transform 0.18s, opacity 0.18s; transform: scale(0.2) !important; opacity: 0; }
@media (orientation: portrait) {
  /* block size follows the viewport height so rods, mat and tray always fit above the Ask Pip strip (short Safari-chrome portrait too) */
  .nb-build { --unit: clamp(14px, calc((100vh - 700px) / 20), 26px); flex-direction: column; }
  .nb-build.is-big { --unit: clamp(12px, calc((100vh - 700px) / 24), 22px); }
  .nb-build .tray { flex-direction: row; width: auto; align-items: flex-end; justify-content: space-around; gap: 40px; padding: 10px 30px; }
  .nb-build .mat-col .big { font-size: 2.6rem; }
}

/* read */
.nb-read { --unit: 24px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; flex: 1 1 auto; min-height: 0; }
.nb-read.is-big { --unit: 18px; }
.nb-show { position: relative; display: flex; align-items: flex-end; justify-content: center; gap: 40px; padding: 22px 36px 18px; background: var(--white); border-radius: 28px; box-shadow: 0 7px 0 var(--sand-deep), var(--shadow-card); min-width: min(88%, 520px); min-height: calc(var(--unit) * 10 + 18px + 40px); }
.nb-rods { display: flex; gap: calc(var(--unit) * 0.45); align-items: flex-end; }
.nb-cubes { display: grid; grid-template-columns: repeat(5, var(--unit)); gap: calc(var(--unit) * 0.3); align-content: end; }
.nb-show .block-ten, .nb-show .block-one { transition: filter 0.2s, transform 0.2s; }
.nb-show .is-lit { filter: brightness(1.25) saturate(1.2); transform: translateY(-6px); }
.nb-count { position: absolute; top: 10px; right: 14px; min-width: 76px; padding: 4px 16px; border-radius: 999px; background: var(--ink); color: #fff; font-size: 1.9rem; font-weight: 700; text-align: center; opacity: 0; transform: scale(0.7); transition: opacity 0.2s, transform 0.25s var(--ease-pop); }
.nb-count.on { opacity: 1; transform: scale(1); }
.nb-read .choices { flex: 0 0 auto; }
@media (orientation: portrait) {
  .nb-read { --unit: 30px; gap: 26px; }
  .nb-read.is-big { --unit: 24px; }
}

/* order */
.nb-order { --card: min(17vmin, 128px); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; flex: 1 1 auto; min-height: 0; }
.nb-slots { display: flex; gap: 14px; justify-content: center; }
.nb-slot.cellnum { width: var(--card); height: var(--card); border-radius: 26px; border: 4px dashed var(--yellow-deep); box-shadow: none; position: relative; flex: 0 0 auto; }
.nb-slot.cellnum.has-card { border-color: transparent; background: var(--sand); }
.nb-slot.cellnum.is-over { background: var(--blue-soft); border-color: var(--blue); transform: scale(1.05); }
.nb-slot.cellnum.nb-glow { animation: nb-slot-glow 1s ease-in-out infinite; }
.nb-slot.cellnum.is-right { background: var(--green-soft); border-color: transparent; color: inherit; box-shadow: none; }
@keyframes nb-slot-glow { 0%, 100% { box-shadow: 0 0 0 0 rgba(255, 210, 63, 0); } 50% { box-shadow: 0 0 0 9px var(--yellow); } }
.nb-axis { display: flex; align-items: center; gap: 12px; color: var(--ink-soft); font-weight: 700; font-size: 1.15rem; }
.nb-axis svg { flex: 1 1 auto; height: 26px; width: 100%; }
.nb-card.item { width: var(--card); height: var(--card); border-radius: 26px; background: var(--white); box-shadow: 0 7px 0 var(--sand-deep), var(--shadow-card); display: flex; align-items: center; justify-content: center; font-size: calc(var(--card) * 0.44); font-weight: 700; color: var(--ink); filter: none; }
.nb-card.item.is-dragging { box-shadow: 0 16px 0 var(--sand-deep), 0 20px 28px rgba(43, 39, 64, 0.25); }
.nb-card.item.nb-glow { animation: nudge 0.9s ease-in-out infinite; background: var(--yellow-soft); }
.nb-card.item.is-right { background: var(--green); color: #fff; box-shadow: 0 7px 0 var(--green-deep); }
.nb-slot .nb-card.item { box-shadow: 0 4px 0 var(--sand-deep), 0 6px 12px rgba(43, 39, 64, 0.1); }
.nb-order .tray { gap: 16px; padding: 14px 18px; min-height: calc(var(--card) + 28px); min-width: min(90%, 360px); }
`;
function injectCss() {
  if (document.getElementById('numbers-css')) return;
  const s = document.createElement('style');
  s.id = 'numbers-css';
  s.textContent = CSS;
  document.head.append(s);
}

/* ---------- helpers ---------- */
const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const w = (n) => (n >= 0 && n < WORDS.length ? WORDS[n] : String(n));
const tensWord = (n) => `${w(n)} ${n === 1 ? 'ten' : 'tens'}`;
const onesWord = (n) => `${w(n)} ${n === 1 ? 'one' : 'ones'}`;
const say1 = (text) => { try { speak(text, { interrupt: true }); } catch {} };
const setVar = (el, k, v) => el.style.setProperty(k, v);

function stageBox(api) {
  const s = api.stage.parentElement || api.stage;
  return { W: s.clientWidth || innerWidth - 40, H: s.clientHeight || innerHeight - 260 };
}

function onResize(fn) {
  addEventListener('resize', fn);
  return () => removeEventListener('resize', fn);
}

/* ---------- 1. Find the number ---------- */
let lastFind = 0;

function buildChart(api, { max, track, onTap }) {
  const cells = new Map();
  const mk = (n) => {
    const b = h('button', { class: 'cellnum', type: 'button', 'aria-label': String(n), dataset: { n: String(n) } }, String(n));
    b.addEventListener('click', () => onTap(n, b));
    cells.set(n, b);
    return b;
  };
  let root;
  if (track) {
    root = h('div', { class: 'track nb-track' });
    for (let n = 1; n <= max; n++) root.append(mk(n));
  } else {
    root = h('div', { class: 'chart120 nb-chart' });
    const rows = Math.ceil(max / 10), hr = Math.ceil(rows / 2);
    const halves = rows > 6 ? [h('div', { class: 'nb-half' }), h('div', { class: 'nb-half' })] : [h('div', { class: 'nb-half' })];
    for (let n = 1; n <= max; n++) halves[halves.length > 1 && n > hr * 10 ? 1 : 0].append(mk(n));
    root.append(...halves);
  }
  function fit() {
    const { W, H } = stageBox(api);
    if (track) {
      const gap = 8;
      const cell = Math.floor(Math.min(76, (W - 9 * gap) / 10, (H - gap) / 2));
      setVar(root, '--cell', `${cell}px`);
      root.style.width = `${10 * cell + 9 * gap}px`;
      return;
    }
    const rows = Math.ceil(max / 10), gap = 5;
    const single = Math.floor(Math.min(64, (H - (rows - 1) * gap) / rows, (W - 9 * gap) / 10));
    let cell = single, split = false;
    if (rows > 6) {
      const hr = Math.ceil(rows / 2);
      const sp = Math.floor(Math.min(64, (H - (hr - 1) * gap) / hr, (W - 26 - 18 * gap) / 20));
      if (sp > single) { cell = sp; split = true; }
    }
    root.classList.toggle('is-split', split);
    setVar(root, '--g', `${gap}px`);
    setVar(root, '--cell', `${cell}px`);
  }
  return { root, cells, fit };
}

function findTask(level) {
  const max = [0, 20, 50, 100, 120][level] || 20;
  let n;
  for (let i = 0; i < 20; i++) {
    n = level === 4 && Math.random() < 0.55 ? randInt(101, 120) : randInt(2, max);
    if (n !== lastFind) break;
  }
  lastFind = n;
  const target = n;
  let ctx = null;
  return {
    say: `Tap ${target}.`,
    mount(stage, api) {
      injectCss();
      let busy = false, done = false;
      const chart = buildChart(api, {
        max, track: level === 1,
        onTap(num, cell) {
          if (busy || done) return;
          say1(String(num));
          if (num === target) {
            done = true;
            cell.classList.add('is-right');
            api.finish(true, { say: `That's ${target}!` });
          } else {
            busy = true;
            cell.classList.add('is-wrong');
            api.finish(false);
          }
        },
      });
      stage.append(chart.root);
      chart.fit();
      const off = onResize(chart.fit);
      ctx = { chart, release: () => { busy = false; } };
      return off;
    },
    async hint(stage, api, wrongs) {
      const { chart, release } = ctx;
      const row = Math.floor((target - 1) / 10);
      chart.cells.forEach((el, num) => { if (Math.floor((num - 1) / 10) === row) el.classList.add('is-tens'); });
      if (wrongs === 1) api.say('It\'s in this row.', 'is-hint');
      else {
        chart.cells.get(target).classList.add('is-hint');
        api.say('Look for the wiggly one.', 'is-hint');
      }
      await api.wait(300);
      release();
    },
    async reveal(stage, api) {
      const { chart } = ctx;
      const row = Math.floor((target - 1) / 10);
      chart.cells.forEach((el, num) => { if (Math.floor((num - 1) / 10) === row) el.classList.add('is-tens'); });
      const el = chart.cells.get(target);
      el.classList.remove('is-wrong', 'is-hint');
      el.classList.add('is-right');
      await api.say(`Here's ${target}.`, 'is-happy');
    },
  };
}

/* ---------- 2. Tens and ones (build) ---------- */
function buildTask(N) {
  const T = Math.floor(N / 10), O = N % 10;
  const big = N >= 100;
  const tensMax = big ? 12 : 10, onesMax = 12;
  let ctx = null;
  return {
    say: `Make ${N}. Use the blocks!`,
    mount(stage, api) {
      injectCss();
      let busy = false, warned = false;
      const tensZone = h('div', { class: 'mat-zone' });
      const onesZone = h('div', { class: 'mat-zone' });
      const tensBig = h('div', { class: 'big' }, '0');
      const onesBig = h('div', { class: 'big' }, '0');
      const tensNeed = h('div', { class: 'nb-need' });
      const onesNeed = h('div', { class: 'nb-need' });
      const tensCol = h('div', { class: 'mat-col tens' }, h('h3', {}, 'Tens'), tensZone, tensBig, tensNeed);
      const onesCol = h('div', { class: 'mat-col ones' }, h('h3', {}, 'Ones'), onesZone, onesBig, onesNeed);
      api.dropTarget(tensCol, 'ten');
      api.dropTarget(onesCol, 'one');
      const eqT = h('span', { class: 't' }, '0');
      const eqO = h('span', { class: 'o' }, '0');
      const eqS = h('span', { class: 'sum' }, '0');
      const eq = h('div', { class: 'equation' }, eqT, h('span', { class: 'op' }, '+'), eqO, h('span', { class: 'op' }, '='), eqS);

      const holdT = h('div', { class: 'nb-hold' });
      const holdO = h('div', { class: 'nb-hold' });
      const tray = h('div', { class: 'tray drop' },
        h('div', { class: 'nb-hold-wrap', style: { display: 'contents' } }, holdT), holdO);
      holdT.append(h('span', { class: 'nb-lbl' }, '10'));
      holdO.append(h('span', { class: 'nb-lbl' }, '1'));
      api.dropTarget(tray, 'tray');

      const root = h('div', { class: `nb-build${big ? ' is-big' : ''}` },
        h('div', { class: 'nb-main' }, h('div', { class: 'mat' }, tensCol, onesCol), eq),
        tray);
      stage.append(root);

      const zoneOf = (kind) => (kind === 'ten' ? tensZone : onesZone);
      const count = (z) => z.querySelectorAll('.nb-piece').length;

      function update() {
        const t = count(tensZone), o = count(onesZone);
        tensBig.textContent = String(t * 10);
        onesBig.textContent = String(o);
        eqT.textContent = String(t * 10); eqO.textContent = String(o); eqS.textContent = String(t * 10 + o);
        tensCol.classList.remove('nb-glow'); onesCol.classList.remove('nb-glow');
      }

      function newPiece(kind) {
        const el = h('div', { class: `nb-piece nb-${kind}`, dataset: { kind } }, h('div', { class: kind === 'ten' ? 'block-ten' : 'block-one' }));
        api.draggable(el, { canDrag: () => !busy, onDrop, onPick: () => say1(kind === 'ten' ? 'ten' : 'one') });
        return el;
      }
      function addSource(kind) {
        const el = newPiece(kind);
        el.classList.add('nb-src');
        (kind === 'ten' ? holdT : holdO).prepend(el);
      }
      addSource('ten'); addSource('one');

      async function onDrop(el, target) {
        if (!target || busy) return;
        const id = target.dataset.drop, kind = el.dataset.kind;
        const isSrc = el.classList.contains('nb-src');
        if (id === 'tray') {
          if (isSrc) return;
          api.sfx.tap();
          el.classList.add('nb-out');
          await wait(190);
          el.remove();
          update();
          return;
        }
        if (id !== kind) {
          api.sfx.tap();
          if (!warned) { warned = true; api.say(kind === 'ten' ? 'The long rods go on the tens side.' : 'The little cubes go on the ones side.'); }
          return;
        }
        const zone = zoneOf(kind);
        if (el.parentElement === zone) return;
        if (count(zone) >= (kind === 'ten' ? tensMax : onesMax)) { api.sfx.tap(); api.say('That\'s plenty! Take some away if you like.'); return; }
        api.sfx.drop();
        el.classList.remove('nb-src');
        await flipMove(el, zone);
        if (isSrc) addSource(kind);
        update();
      }

      function dropIn(kind, i) {
        const el = newPiece(kind);
        el.classList.add('nb-in');
        zoneOf(kind).append(el);
        api.sfx.tick(i);
      }

      async function onCheck() {
        if (busy) return;
        const t = count(tensZone), o = count(onesZone), total = t * 10 + o;
        if (total === 0) { api.say('Drag some blocks onto the mat first.'); return; }
        if (t === T && o === O) {
          busy = true;
          api.finish(true, { say: `${N} is ${tensWord(T)} and ${onesWord(O)}.` });
          return;
        }
        busy = true;
        let need, col;
        if (t !== T) {
          const d = Math.abs(T - t);
          need = t < T ? `We need ${d === 1 ? 'one' : w(d)} more ${d === 1 ? 'ten' : 'tens'}.` : `That's too many tens. Take ${d === 1 ? 'one' : w(d)} away.`;
          col = tensCol;
        } else {
          const d = Math.abs(O - o);
          need = o < O ? `We need ${d === 1 ? 'one' : w(d)} more ${d === 1 ? 'one' : 'ones'}.` : `That's too many ones. Take ${d === 1 ? 'one' : w(d)} away.`;
          col = onesCol;
        }
        let msg = `That's ${tensWord(t)} and ${onesWord(o)}. That makes ${total}. ${need}`;
        if (total === N) { msg = `That makes ${N} too, but let's swap 10 ones for 1 ten.`; col = onesCol; }
        ctx.glow = col;
        api.finish(false, { say: msg });
      }
      api.button('Check', onCheck);

      ctx = {
        tensCol, onesCol, tensNeed, onesNeed,
        glow: tensCol,
        release: () => { busy = false; },
        async build() {
          busy = true;
          tensZone.querySelectorAll('.nb-piece').forEach((e) => e.remove());
          onesZone.querySelectorAll('.nb-piece').forEach((e) => e.remove());
          let i = 0;
          for (let k = 0; k < T; k++) { dropIn('ten', i++); update(); await wait(160); }
          for (let k = 0; k < O; k++) { dropIn('one', i++); update(); await wait(160); }
          update();
        },
      };
    },
    async hint(stage, api, wrongs) {
      ctx.glow.classList.add('nb-glow');
      if (wrongs >= 2) {
        ctx.tensNeed.textContent = `need ${T}`;
        ctx.onesNeed.textContent = `need ${O}`;
        api.say(`Try ${tensWord(T)} and ${onesWord(O)}.`, 'is-hint');
        await api.wait(300);
      }
      ctx.release();
    },
    async reveal(stage, api) {
      await ctx.build();
      ctx.tensNeed.textContent = ''; ctx.onesNeed.textContent = '';
      await api.say(`${N} is ${tensWord(T)} and ${onesWord(O)}.`, 'is-happy');
    },
  };
}

/* ---------- 3. Read the blocks ---------- */
function swapDigits(n) {
  if (n < 10 || n > 99) return null;
  const a = Math.floor(n / 10), b = n % 10;
  return a !== b && b > 0 ? b * 10 + a : null;
}

function readOptions(n, max, count) {
  const lo = 10;
  const ok = (v) => v >= lo && v <= max && v !== n;
  const out = [];
  const add = (v) => { if (v != null && ok(v) && !out.includes(v)) out.push(v); };
  const sw = swapDigits(n);
  add(sw);
  add(n >= 21 ? n - 10 : n + 10);
  if (Math.random() < 0.5) add(n + 10);
  add(Math.random() < 0.5 ? n + 1 : n - 1);
  add(n - 1); add(n + 1); add(n + 10); add(n - 10); add(n + 2);
  return shuffle([n, ...out.slice(0, count - 1)]);
}

let lastRead = 0;
function readTask(level) {
  const [lo, hi] = [null, [11, 20], [21, 50], [51, 99], [100, 120]][level];
  let n;
  for (let i = 0; i < 20; i++) {
    n = randInt(lo, hi);
    if (level === 3 && Math.random() < 0.25) n = randInt(5, 9) * 10;
    if (level === 4 && Math.random() < 0.2) n = pick([100, 110, 120]);
    if (n !== lastRead) break;
  }
  lastRead = n;
  const T = Math.floor(n / 10), O = n % 10;
  let ctx = null;
  return {
    say: 'What number is this?',
    mount(stage, api) {
      injectCss();
      const rods = [], cubes = [];
      const rodsEl = h('div', { class: 'nb-rods' });
      for (let i = 0; i < T; i++) { const r = h('div', { class: 'block-ten' }); rods.push(r); rodsEl.append(r); }
      const cubesEl = h('div', { class: 'nb-cubes' });
      for (let i = 0; i < O; i++) { const c = h('div', { class: 'block-one' }); cubes.push(c); cubesEl.append(c); }
      const counter = h('div', { class: 'nb-count' }, '0');
      const show = h('div', { class: 'nb-show' }, rodsEl, O ? cubesEl : null, counter);
      const root = h('div', { class: `nb-read${n >= 100 ? ' is-big' : ''}` }, show);
      stage.append(root);
      const opts = readOptions(n, level === 4 ? 130 : hi + 12, level >= 3 ? 4 : 3);
      const group = api.ask({ options: opts, answer: n, parent: root, finalSay: `${n} is ${tensWord(T)} and ${onesWord(O)}.` });
      ctx = {
        group, counter, rods, cubes,
        async count(tensOnly) {
          counter.classList.add('on');
          let i = 0;
          for (let k = 0; k < rods.length; k++) {
            rods[k].classList.add('is-lit'); counter.textContent = String((k + 1) * 10); api.sfx.tick(i++); await api.wait(330);
          }
          if (!tensOnly) {
            for (let k = 0; k < cubes.length; k++) {
              cubes[k].classList.add('is-lit'); counter.textContent = String(T * 10 + k + 1); api.sfx.tick(i++); await api.wait(300);
            }
          }
          await api.wait(250);
          [...rods, ...cubes].forEach((e) => e.classList.remove('is-lit'));
        },
      };
    },
    async hint(stage, api, wrongs) {
      if (wrongs === 1) {
        api.say('Each long rod is ten. Count in tens.', 'is-hint');
        await ctx.count(true);
      } else {
        api.say(`Count the tens, then the ones.`, 'is-hint');
        await ctx.count(false);
      }
    },
    async reveal(stage, api) {
      api.say(`Count with me.`, 'is-hint');
      await ctx.count(false);
      const b = ctx.group.querySelector(`[data-value="${n}"]`);
      if (b) { b.classList.remove('is-dim', 'is-wrong'); b.classList.add('is-right'); }
      await api.say(`It's ${n}. That's ${tensWord(T)} and ${onesWord(O)}.`, 'is-happy');
    },
  };
}

/* ---------- 4. Before and after ---------- */
const BA_MAX = [0, 20, 50, 100, 120];
let lastBA = 0;

function beforeAfterTask(level) {
  const max = BA_MAX[level];
  let kind = 'after';
  if (level === 2) kind = Math.random() < 0.5 ? 'after' : 'before';
  if (level === 3) kind = Math.random() < 0.5 ? 'after' : 'before';
  if (level === 4) kind = pick(['after', 'before', 'between', 'after', 'before']);
  const rnd = (a, b) => randInt(a, b);
  let ref, ans, start;
  const clampRange = (lo, hi) => rnd(Math.max(1, lo), Math.max(Math.max(1, lo), hi));
  for (let tries = 0; tries < 20; tries++) {
    if (kind === 'after') {
      const crossing = level >= 3 && Math.random() < 0.45;
      if (crossing) {
        const choices = []; for (let d = 10; d < max; d += 10) choices.push(d - 1);
        if (level === 4) choices.push(99, 109, 119);
        ref = pick(choices.filter((v) => v + 1 <= max));
      } else ref = rnd(level === 1 ? 2 : 3, max - 1);
      ans = ref + 1;
      start = clampRange(ref - 3, Math.min(ref, max - 4));
    } else if (kind === 'before') {
      const crossing = level >= 3 && Math.random() < 0.45;
      if (crossing) {
        const choices = []; for (let d = 10; d <= max; d += 10) choices.push(d);
        ref = pick(choices);
      } else ref = rnd(4, max);
      ans = ref - 1;
      start = clampRange(ref - 4, Math.min(ref - 1, max - 4));
    } else {
      ref = rnd(30, max - 3);
      ans = ref + 1;
      start = clampRange(ref - 2, Math.min(ref, max - 4));
    }
    if (ref !== lastBA) break;
  }
  lastBA = ref;
  start = Math.min(Math.max(1, start), max - 4);
  const nums = [0, 1, 2, 3, 4].map((i) => start + i);
  const blankIdx = nums.indexOf(ans);
  const say = kind === 'after' ? `What comes after ${ref}?` : kind === 'before' ? `What comes before ${ref}?` : `What number is between ${ref} and ${ref + 2}?`;
  const done = kind === 'after' ? `${ans} comes after ${ref}.` : kind === 'before' ? `${ans} comes before ${ref}.` : `${ans} is between ${ref} and ${ref + 2}.`;
  let ctx = null;

  function distractors() {
    const c = kind === 'after' ? [ref - 1, ans + 1, ref, ans + 10, ans - 10]
      : kind === 'before' ? [ref + 1, ans - 1, ref, ans - 10, ans + 10]
        : [ref - 1, ref + 3, ref, ans + 10, ans - 10];
    const ok = c.filter((v, i, a) => v >= 1 && v <= max && v !== ans && a.indexOf(v) === i);
    const near = ok.slice(0, 3), far = ok.slice(3);
    const pickN = level >= 3 && far.length && Math.random() < 0.6 ? [pick(near), pick(far)].filter((v, i, a) => a.indexOf(v) === i) : shuffle(near).slice(0, 2);
    while (pickN.length < 2) pickN.push(pick(ok.filter((v) => !pickN.includes(v))));
    return pickN.slice(0, 2);
  }

  return {
    say,
    mount(stage, api) {
      injectCss();
      const cells = nums.map((v, i) => h('div', { class: `cellnum${i === blankIdx ? ' is-blank' : ''}` }, i === blankIdx ? '?' : String(v)));
      const track = h('div', { class: 'track nb-seg' }, ...cells);
      const root = h('div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '28px', flex: '1 1 auto', minHeight: '0' } }, track);
      stage.append(root);
      const fit = () => {
        const { W } = stageBox(api);
        setVar(track, '--cell', `${Math.floor(Math.min(120, (W - 4 * 10 - 16) / 5))}px`);
      };
      fit();
      const off = onResize(fit);
      const group = api.ask({ options: shuffle([ans, ...distractors()]), answer: ans, parent: root, finalSay: done });
      group.addEventListener('click', (e) => {
        const b = e.target.closest('.choice');
        if (b && Number(b.dataset.value) === ans) {
          const bc = cells[blankIdx];
          bc.textContent = String(ans);
          bc.classList.remove('is-hint');
          bc.classList.add('is-right');
        }
      });
      ctx = { cells, group };
      return off;
    },
    async hint(stage, api, wrongs) {
      const { cells } = ctx;
      api.say(wrongs === 1 ? 'Let\'s count along.' : 'Count along with me.', 'is-hint');
      const last = Math.max(blankIdx, kind === 'before' ? blankIdx + 1 : blankIdx);
      for (let i = 0; i <= last; i++) {
        cells[i].classList.add('is-lit');
        api.sfx.tick(i);
        await api.wait(430);
        cells[i].classList.remove('is-lit');
      }
      if (wrongs >= 2) cells[blankIdx].classList.add('is-hint');
    },
    async reveal(stage, api) {
      const { cells, group } = ctx;
      const bc = cells[blankIdx];
      bc.textContent = String(ans);
      bc.classList.remove('is-hint');
      bc.classList.add('is-right');
      const b = group.querySelector(`[data-value="${ans}"]`);
      if (b) { b.classList.remove('is-dim', 'is-wrong'); b.classList.add('is-right'); }
      await api.say(done, 'is-happy');
    },
  };
}

/* ---------- 5. Order the numbers ---------- */
function pickOrderNumbers(level) {
  const k = level === 3 ? 4 : 3;
  const max = [0, 20, 50, 120][level];
  const minDiff = level === 1 ? 2 : level === 2 ? 3 : 2;
  for (let attempt = 0; attempt < 50; attempt++) {
    const arr = [];
    if (level === 3 && Math.random() < 0.4) {
      const a = randInt(1, 9); let b = randInt(1, 9);
      if (a === b) b = (a % 9) + 1;
      arr.push(a * 10 + b, b * 10 + a);
    }
    if (level === 3 && Math.random() < 0.55) arr.push(randInt(100, 120));
    let guard = 0;
    while (arr.length < k && guard++ < 100) {
      const v = randInt(1, max);
      if (arr.every((x) => Math.abs(x - v) >= minDiff) && !arr.includes(v)) arr.push(v);
    }
    if (arr.length === k && arr.every((x, i) => arr.every((y, j) => i === j || Math.abs(x - y) >= minDiff))) return shuffle(arr);
  }
  return level === 3 ? shuffle([14, 41, 67, 105]) : shuffle([3, 9, 15]);
}

function orderTask(level) {
  const nums = pickOrderNumbers(level);
  const sorted = nums.slice().sort((a, b) => a - b);
  const k = nums.length;
  const sentence = `${sorted.join(', ')}. Smallest to biggest!`;
  let ctx = null;
  return {
    say: 'Put the numbers in order. Smallest first!',
    mount(stage, api) {
      injectCss();
      let busy = false, firstWrong = 0, done = false;
      const slots = [], cards = [];
      const slotsEl = h('div', { class: 'nb-slots' });
      for (let i = 0; i < k; i++) {
        const s = h('div', { class: 'cellnum is-blank nb-slot drop' });
        api.dropTarget(s, `slot${i}`);
        slots.push(s); slotsEl.append(s);
      }
      const arrow = svg(`<svg viewBox="0 0 200 26" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 13 H184" stroke="#6d6886" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M170 3 L192 13 L170 23" stroke="#6d6886" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`);
      const axis = h('div', { class: 'nb-axis', style: { width: `calc(${k} * (var(--card) + 14px) - 14px)` } }, h('span', {}, 'smallest'), arrow, h('span', {}, 'biggest'));
      const tray = h('div', { class: 'tray drop' });
      api.dropTarget(tray, 'tray');
      const root = h('div', { class: 'nb-order' }, slotsEl, axis, tray);
      stage.append(root);

      const btn = api.button('Check', onCheck);
      btn.disabled = true;

      const valueIn = (s) => { const c = s.querySelector('.nb-card'); return c ? Number(c.dataset.v) : null; };
      function refresh() {
        slots.forEach((s) => { s.classList.toggle('has-card', !!s.querySelector('.nb-card')); s.classList.remove('nb-glow'); });
        cards.forEach((c) => c.classList.remove('nb-glow'));
        btn.disabled = !slots.every((s) => s.querySelector('.nb-card'));
        tray.classList.toggle('is-empty', !tray.querySelector('.nb-card'));
      }
      async function onDrop(el, target) {
        if (!target || busy || done) return;
        const id = target.dataset.drop;
        const from = el.parentElement;
        if (id === 'tray') {
          if (from === tray) return;
          api.sfx.drop();
          await flipMove(el, tray);
          refresh();
          return;
        }
        const slot = target;
        if (slot === from) return;
        const other = slot.querySelector('.nb-card');
        api.sfx.drop();
        if (other && other !== el) {
          flipMove(other, from);
        }
        await flipMove(el, slot);
        refresh();
      }
      for (const v of nums) {
        const c = h('div', { class: 'nb-card', dataset: { v: String(v) } }, String(v));
        api.draggable(c, { canDrag: () => !busy && !done, onDrop, onPick: () => say1(String(v)) });
        cards.push(c); tray.append(c);
      }
      setVar(root, '--n', String(k));

      async function onCheck() {
        if (busy || done) return;
        const vals = slots.map(valueIn);
        const bad = vals.findIndex((v, i) => v !== sorted[i]);
        if (bad === -1) {
          done = true;
          slots.forEach((s) => s.classList.add('is-right'));
          btn.remove();
          for (let i = 0; i < k; i++) { api.sfx.tick(i); await api.wait(120); }
          api.finish(true, { say: sentence });
          return;
        }
        busy = true;
        firstWrong = bad;
        ctx.firstWrong = bad;
        api.finish(false, { say: bad === 0 ? 'Hmm. Which number is the smallest? It goes first.' : 'Nearly! Look at the glowing spot. Which number comes next?' });
      }
      ctx = {
        firstWrong: 0, slots, cards, tray, release: () => { busy = false; },
        async solve() {
          busy = true;
          for (let i = 0; i < k; i++) {
            const c = cards.find((x) => Number(x.dataset.v) === sorted[i]);
            await flipMove(c, slots[i], { duration: 320 });
            api.sfx.tick(i);
            slots[i].classList.add('has-card');
          }
          slots.forEach((s) => s.classList.add('is-right'));
        },
      };
    },
    async hint(stage, api, wrongs) {
      const { slots, cards, firstWrong, release } = ctx;
      slots[firstWrong].classList.add('nb-glow');
      if (wrongs >= 2) {
        const c = cards.find((x) => Number(x.dataset.v) === sorted[firstWrong]);
        if (c) c.classList.add('nb-glow');
        api.say(`Put the glowing number in the glowing spot.`, 'is-hint');
      }
      await api.wait(300);
      release();
    },
    async reveal(stage, api) {
      ctx.slots.forEach((s) => s.classList.remove('nb-glow'));
      ctx.cards.forEach((c) => c.classList.remove('nb-glow'));
      await ctx.solve();
      await api.say(sentence, 'is-happy');
    },
  };
}

/* ---------- module ---------- */
function buildNumber(level) {
  if (level === 1) return randInt(11, 20);
  if (level === 2) return randInt(21, 50);
  if (level === 3) return Math.random() < 0.25 ? randInt(5, 9) * 10 : randInt(51, 99);
  return randInt(100, 120);
}

let lastBuild = 0;

export default {
  id: 'numbers',
  title: 'Numbers to 120',
  tagline: 'Find, build and order numbers',
  colour: 'blue',
  art: moduleArt.numbers,
  skills: [
    { id: 'numbers.find', name: 'Find the number', maxLevel: 4 },
    { id: 'numbers.build', name: 'Tens and ones', maxLevel: 4 },
    { id: 'numbers.read', name: 'Read the blocks', maxLevel: 4 },
    { id: 'numbers.beforeafter', name: 'Before and after', maxLevel: 4 },
    { id: 'numbers.order', name: 'Order the numbers', maxLevel: 3 },
  ],
  makeTask(skillId, level) {
    const L = Math.max(1, Math.min(4, Math.round(level) || 1));
    try {
      switch (skillId) {
        case 'numbers.find': return findTask(L);
        case 'numbers.build': {
          let n = buildNumber(L);
          if (n === lastBuild) n = buildNumber(L);
          lastBuild = n;
          return buildTask(n);
        }
        case 'numbers.read': return readTask(L);
        case 'numbers.beforeafter': return beforeAfterTask(L);
        case 'numbers.order': return orderTask(Math.min(L, 3));
        default: return findTask(1);
      }
    } catch (e) {
      console.error('numbers makeTask failed', e);
      return findTask(1);
    }
  },
};
