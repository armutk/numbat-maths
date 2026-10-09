// Pip's whiteboard: the manipulatives canvas a live AI tutor drives through tools.
// Default export createBoard(container, deps) -> board. See the API summary at the bottom of this header.
//
//   setScene / spawnItems / makeGroups / removeItems / showNumberLine / showChart120 / showTenFrame / showNumber
//   showChoices / showKeypad / hideInput / highlight / demonstrateMove / showCounts / celebrate / clear
//   getState / describe / on / off / setLocked / noun / destroy
//
// Location ids used in events and state: 'tray', a group id, and 'leftovers' (Pip's bowl).
import { h as H, svg as SVG, flipMove as FLIP, wait as WAIT, confetti } from './ui.js';
import { items as ITEMS, friend as FRIEND, mascot as MASCOT, avatarFor as AVATAR } from './art.js';

/* ---------- nouns (the tutor reads describe(), so plurals must be right) ---------- */
export const NOUNS = {
  cookie: ['cookie', 'cookies'], apple: ['apple', 'apples'], strawberry: ['strawberry', 'strawberries'],
  lolly: ['lolly', 'lollies'], muffin: ['muffin', 'muffins'], carrot: ['carrot', 'carrots'],
  timtam: ['Tim Tam', 'Tim Tams'], cracker: ['cracker', 'crackers'], grape: ['grape', 'grapes'],
  banana: ['banana', 'bananas'], block: ['block', 'blocks'], star: ['star', 'stars'], car: ['car', 'cars'],
  teddy: ['teddy', 'teddies'], dinosaur: ['dinosaur', 'dinosaurs'], flower: ['flower', 'flowers'],
  fish: ['fish', 'fish'], button: ['button', 'buttons'], coin: ['coin', 'coins'], egg: ['egg', 'eggs'],
  shell: ['shell', 'shells'], sock: ['sock', 'socks'], ball: ['ball', 'balls'], crayon: ['crayon', 'crayons'],
};
export function noun(kind, n = 2) {
  const t = NOUNS[kind] || [String(kind || 'thing'), String(kind || 'thing') + 's'];
  return n === 1 ? t[0] : t[1];
}

const GROUP_KINDS = ['plate', 'hoop', 'basket', 'bowl', 'box'];
const LEFTOVERS = 'leftovers';
const CELL_GAP = 6;

export default function createBoard(container, deps = {}) {
  const h = deps.h || H;
  const svgEl = deps.svg || SVG;
  const flip = deps.flipMove || FLIP;
  const wait = deps.wait || WAIT;
  const items = deps.items || ITEMS;
  const mascot = deps.mascot || MASCOT;
  const friend = deps.friend || FRIEND;
  const avatarFor = deps.avatarFor || AVATAR;
  const makeDrag = deps.draggable;
  const makeDrop = deps.dropTarget;
  const fx = (name, ...a) => { try { deps.sfx?.[name]?.(...a); } catch { /* sound must never break the board */ } };
  const warn = (...a) => console.warn('[board]', ...a);
  const reduceMotion = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

  /* ---------- events ---------- */
  const listeners = new Map();
  const on = (ev, fn) => { if (!listeners.has(ev)) listeners.set(ev, new Set()); listeners.get(ev).add(fn); return board; };
  const off = (ev, fn) => { listeners.get(ev)?.delete(fn); return board; };
  const emit = (ev, payload = {}) => {
    for (const fn of [...(listeners.get(ev) || [])]) { try { fn(payload); } catch (e) { warn('listener error', e); } }
  };

  /* ---------- DOM skeleton ---------- */
  const titleEl = h('div', { class: 'board-title', hidden: true });
  const stage = h('div', { class: 'board-stage' });
  const under = h('div', { class: 'board-under', hidden: true });
  const fxLayer = h('div', { class: 'board-fx', 'aria-hidden': 'true' });
  const main = h('div', { class: 'board-main' }, stage, under);
  const root = h('div', { class: 'board', dataset: { scene: 'empty' } }, titleEl, main, fxLayer);
  container.append(root);

  /* ---------- state ---------- */
  let S = freshState();
  let token = 0; // bumps on every scene change so in-flight animations can bail out
  let locked = false;
  let countsOn = false;
  let lastAnswer = null;
  let moves = [];
  let raf = 0;
  const timers = new Set();
  const later = (fn, ms) => { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; };

  function freshState() {
    return {
      scene: 'empty', itemKind: null, unit: 1, pieces: [], groups: [], nextIndex: 0, reserve: 0,
      tray: null, groupsWrap: null, relayout: null, nl: null, under: null, kp: null, choices: null, info: null,
      highlighted: null, hl: null, demo: false,
    };
  }

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => scheduleLayout()) : null;
  ro?.observe(stage);
  ro?.observe(root);
  function scheduleLayout() {
    if (raf) return;
    raf = requestAnimationFrame(() => { raf = 0; try { placeUnder(); S.relayout?.(); repositionHands(); } catch (e) { warn('layout', e); } });
  }
  const onWinResize = () => scheduleLayout();
  addEventListener('resize', onWinResize);

  /* ---------- helpers ---------- */
  const art = (kind) => {
    try { return items[kind] ? items[kind]() : items.generic(kind); } catch { return ''; }
  };
  const nounFor = (n) => noun(S.itemKind, n);
  const unitsIn = (loc) => S.pieces.reduce((a, p) => a + (p.loc === loc ? p.unit : 0), 0);
  const groupById = (id) => S.groups.find((g) => g.id === id) || null;
  const locOf = (s) => {
    if (s == null) return null;
    const t = String(s).replace(/^group:/, '');
    if (t === 'tray') return 'tray';
    if (t === LEFTOVERS || t === 'bowl') return LEFTOVERS;
    return t;
  };
  const dishOf = (loc) => (loc === 'tray' ? S.tray : groupById(loc)?.dish || null);
  const shareReady = () => S.scene === 'share' && S.tray;

  function boxOfTen(kind) {
    const dots = Array.from({ length: 10 }, (_, i) => `<g transform="translate(${6 + (i % 5) * 11} ${16 + Math.floor(i / 5) * 14}) scale(0.16)">${art(kind)}</g>`).join('');
    return `<svg viewBox="0 0 64 48" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="4" width="62" height="42" rx="8" fill="#F3D7B0" stroke="#D9B27F" stroke-width="2"/><rect x="1" y="4" width="62" height="10" rx="5" fill="#E6C291"/><text x="32" y="12.5" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="8" fill="#6B4B2E">10</text>${dots}</svg>`;
  }

  function resetScene(sceneName = 'empty') {
    token++;
    for (const t of timers) clearTimeout(t);
    timers.clear();
    clearHighlight();
    stage.replaceChildren();
    under.replaceChildren();
    under.hidden = true;
    root.classList.remove('is-side', 'has-under', 'is-locked', 'is-demo');
    fxLayer.replaceChildren();
    titleEl.hidden = true;
    titleEl.textContent = '';
    const keep = { pieces: [], };
    S = freshState();
    S.scene = sceneName;
    root.dataset.scene = sceneName;
    void keep;
    if (locked) root.classList.add('is-locked');
  }

  function setTitle(text) {
    if (!text) return;
    titleEl.textContent = text;
    titleEl.hidden = false;
  }

  /* =====================================================================
     SHARE SCENE (plates, hoops, baskets, bowls, boxes + a tray of items)
     ===================================================================== */
  function buildGroup(def, idx) {
    const kind = GROUP_KINDS.includes(def.kind) ? def.kind : 'plate';
    const leftover = def.id === LEFTOVERS;
    const role = def.role || (leftover ? 'pip' : 'friend');
    const name = def.name || (leftover ? "Pip's bowl" : `Friend ${idx + 1}`);
    const avatarSvg = (() => { try { return avatarFor(role, idx); } catch { return friend(idx); } })();
    const count = h('div', { class: 'count' + (countsOn ? ' on' : '') }, '0');
    const dish = h('div', { class: 'plate-dish' });
    const chip = h('div', { class: 'board-chip' },
      h('span', { class: `board-avatar is-${role}`, html: avatarSvg }),
      h('span', { class: 'board-name' }, name));
    const cls = ['plate', 'drop', 'board-group', `is-${kind}`];
    if (kind === 'basket') cls.push('basket');
    if (kind === 'hoop') cls.push('hoop');
    if (leftover) cls.push('is-leftover');
    const el = h('div', { class: cls.join(' '), dataset: { group: def.id } },
      h('div', { class: 'board-dishwrap' }, dish, count), chip);
    if (makeDrop) makeDrop(el, def.id);
    return { id: def.id, name, role, kind, leftover, el, dish, count };
  }

  function attachGroups(defs, { leftovers = false, animate = true } = {}) {
    S.groups = defs.map((d, i) => buildGroup({ ...d, id: String(d.id ?? `g${i}`) }, i));
    if (leftovers) S.groups.push(buildGroup({ id: LEFTOVERS, name: "Pip's bowl", role: 'pip', kind: 'bowl' }, 99));
    S.groupsWrap.replaceChildren(...S.groups.map((g) => g.el));
    if (animate) S.groups.forEach((g, i) => spawnAnim(g.el, i * 60));
  }

  function spawnAnim(el, delay = 0) {
    if (reduceMotion()) return;
    el.style.setProperty('--d', `${delay}ms`);
    el.classList.add('is-spawn');
    later(() => { el.classList.remove('is-spawn'); el.style.removeProperty('--d'); }, 700 + delay);
  }

  function makePiece(kind, loc, unit = S.unit) {
    const el = h('div', { class: 'board-item' + (unit > 1 ? ' is-box' : ''), html: unit > 1 ? boxOfTen(kind) : art(kind) });
    const piece = { el, kind, loc, unit, index: S.nextIndex++, moved: false, sx: 0, sy: 0 };
    el.dataset.index = String(piece.index);
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', noun(kind, 1));
    el.addEventListener('pointerdown', (e) => { piece.moved = false; piece.sx = e.clientX; piece.sy = e.clientY; });
    el.addEventListener('pointermove', (e) => { if (!piece.moved && Math.hypot(e.clientX - piece.sx, e.clientY - piece.sy) > 6) piece.moved = true; });
    if (makeDrag) {
      let lastPick = 0;
      const picked = () => { const now = Date.now(); if (now - lastPick < 150) return; lastPick = now; emit('pickup', { from: piece.loc }); };
      makeDrag(el, {
        canDrag: () => !locked && !S.demo,
        onDrop: (_el, target) => onDropPiece(piece, target),
        onPick: picked,
        onLift: picked,
      });
    }
    S.pieces.push(piece);
    return piece;
  }

  async function onDropPiece(piece, target) {
    const myToken = token;
    const viaTap = !piece.moved;
    if (!target) { emit('reject', { from: piece.loc }); return; }
    const to = target.dataset?.drop;
    const dish = dishOf(to);
    if (!dish || !S.pieces.includes(piece) || locked || S.demo) { emit('reject', { from: piece.loc }); return; }
    if (to === piece.loc) { piece.el.style.transform = ''; return; }
    const from = piece.loc;
    piece.loc = to;
    logMove(from, to);
    target.classList.add('did-receive');
    later(() => target.classList.remove('did-receive'), 600);
    fx('drop');
    refreshCounts([from, to]);
    layoutShare();
    try { await flip(piece.el, dish); } catch { dish.append(piece.el); }
    if (myToken !== token) return;
    emit('move', { item: { kind: piece.kind, index: piece.index }, from, to, counts: countsPayload(), viaTap });
  }

  function logMove(from, to) {
    moves.push({ t: Date.now(), from, to });
    if (moves.length > 20) moves = moves.slice(-20);
  }

  function countsPayload() {
    const groups = {};
    for (const g of S.groups) groups[g.id] = unitsIn(g.id);
    return { tray: unitsIn('tray'), groups };
  }

  function popCount(g) {
    const c = g.count;
    c.classList.remove('is-pop');
    void c.offsetWidth;
    c.classList.add('is-pop');
    later(() => c.classList.remove('is-pop'), 600);
  }

  function refreshCounts(popLocs = []) {
    if (!S.tray) return;
    for (const g of S.groups) {
      const n = unitsIn(g.id);
      const txt = String(n);
      const changed = g.count.textContent !== txt;
      g.count.textContent = txt;
      g.count.classList.toggle('on', countsOn);
      g.el.classList.toggle('has-items', n > 0);
      if (countsOn && (changed || popLocs.includes(g.id))) popCount(g);
    }
    S.tray.classList.toggle('is-empty', unitsIn('tray') === 0);
  }

  /** Fit tray items, plates and the items inside plates to the stage. Runs on resize and after every count change. */
  function layoutShare() {
    if (!shareReady()) return;
    const W = stage.clientWidth, Ht = stage.clientHeight;
    if (W < 60 || Ht < 60) return;
    const portrait = Ht > W;
    const gs = S.groups;
    const real = gs.filter((g) => !g.leftover);
    const slots = gs.length;
    const N = Math.max(S.reserve, S.pieces.length, 1);
    const box = S.unit > 1;
    const fab = parseInt(getComputedStyle(root).getPropertyValue('--fab-safe'), 10) || 112;
    const gap = 14, blockGap = 22, extra = 22, chipH = 46;
    const sMax = box ? (portrait ? 104 : 88) : N > 12 ? (portrait ? 72 : 60) : (portrait ? 100 : 76);
    const sMin = box ? 72 : 56;
    const cap = portrait ? 420 : 330;
    // column options for the groups grid: portrait prefers a 2 or 3 column grid, landscape one row
    let colOpts;
    if (slots <= 2) colOpts = [Math.max(1, slots)];
    else if (portrait) colOpts = [...new Set([slots <= 4 ? 2 : 3, 3, 4, slots])];
    else colOpts = [...new Set([slots, Math.ceil(slots / 2), Math.ceil(slots / 3)])];
    let pick = null;
    outer:
    for (let s = sMax; s >= sMin - 0.1; s -= 4) {
      const iw = s, ih = box ? s * 0.75 : s;
      const tcols = Math.max(1, Math.floor((W - 36 - fab + 8) / (iw + 8)));
      const trayH = Math.max(1, Math.ceil(N / tcols)) * (ih + 8) + 26;
      for (const ratio of [0.7, 0.62, 0.54, 0.46, 0.4]) {
        for (const cols of colOpts) {
          const rowsG = Math.ceil(Math.max(slots, 1) / cols);
          const plateW = Math.min(cap, (W - 6 - (cols - 1) * gap) / cols);
          if (plateW < 140 && cols !== colOpts[colOpts.length - 1]) continue;
          const dishH = plateW * ratio;
          const need = slots ? rowsG * (chipH + dishH + extra) + (rowsG - 1) * gap + blockGap + trayH : trayH;
          pick = { s, ih, trayH, plateW, dishH, rowsG, cols, tcols };
          if (need <= Ht) break outer;
        }
      }
    }
    if (!pick) return;
    S.tray.style.setProperty('--item', `${pick.s}px`);
    S.tray.style.minHeight = `${pick.trayH}px`;
    S.groupsWrap.style.maxWidth = `${Math.round(pick.cols * pick.plateW + (pick.cols - 1) * gap + 2)}px`;
    const expectMax = Math.max(1, ...real.map((g) => Math.ceil(unitsIn(g.id) / S.unit)), Math.ceil(N / Math.max(real.length, 1)));
    for (const g of gs) {
      const w = g.leftover && pick.rowsG === 1 ? Math.min(pick.plateW, Math.max(pick.plateW * 0.9, 190)) : pick.plateW;
      const dh = g.leftover ? pick.dishH * 0.72 : pick.dishH;
      g.el.style.setProperty('--plate-w', `${Math.round(w)}px`);
      g.dish.style.height = `${Math.round(dh)}px`;
      g.dish.style.minHeight = '0';
      const want = g.leftover ? Math.max(2, Math.ceil(unitsIn(g.id) / S.unit)) : Math.max(expectMax, Math.ceil(unitsIn(g.id) / S.unit));
      const innerW = w * 0.68, innerH = dh * 0.66;
      let ds = Math.min(pick.s, 84), over = 0;
      const floor = box ? 52 : 44;
      for (; ds >= floor; ds -= 2) {
        const dw = ds, dhh = box ? ds * 0.75 : ds;
        const c = Math.max(1, Math.floor((innerW + 10) / (dw + 10)));
        const r = Math.max(1, Math.floor((innerH + 10) / (dhh + 10)));
        if (c * r >= want) break;
      }
      if (ds < floor) { ds = floor; over = 1; }
      g.dish.style.setProperty('--item', `${ds}px`);
      g.dish.style.setProperty('--dish-m', over ? `${-Math.round(ds * 0.16)}px` : '0px');
    }
  }

  async function setScene(cfg = {}) {
    resetScene('share');
    countsOn = false;
    const it = cfg.items || {};
    const kind = it.kind || 'cookie';
    const unit = Math.max(1, Math.round(Number(it.unit) || 1));
    const total = Math.max(0, Math.round(Number(it.count) || 0));
    S.itemKind = kind;
    S.unit = unit;
    setTitle(cfg.title);
    S.groupsWrap = h('div', { class: 'board-groups' });
    S.tray = h('div', { class: 'tray drop board-tray' });
    if (makeDrop) makeDrop(S.tray, 'tray');
    stage.append(S.groupsWrap, S.tray);
    const defs = Array.isArray(cfg.groups) ? cfg.groups : [];
    attachGroups(defs, { leftovers: !!cfg.leftovers, animate: true });
    const pieces = Math.round(total / unit);
    S.reserve = pieces;
    for (let i = 0; i < pieces; i++) {
      const p = makePiece(kind, 'tray', unit);
      S.tray.append(p.el);
      spawnAnim(p.el, Math.min(i, 24) * 22);
    }
    S.relayout = layoutShare;
    moves = [];
    lastAnswer = null;
    refreshCounts();
    layoutShare();
    scheduleLayout();
    await wait(reduceMotion() ? 0 : Math.min(420 + pieces * 12, 800));
    return getState();
  }

  async function ensureShare(kind = 'cookie') {
    if (shareReady()) return;
    await setScene({ items: { kind, count: 0 }, groups: [] });
  }

  async function spawnItems(kind, n = 1, opts = {}) {
    await ensureShare(kind || 'cookie');
    if (!S.pieces.length) S.itemKind = kind || S.itemKind;
    const loc = locOf(opts.toGroup) || 'tray';
    const dish = dishOf(loc);
    if (!dish) { warn('spawnItems: no such group', opts.toGroup); return getState(); }
    const count = Math.max(0, Math.min(60, Math.round(Number(n) || 0)));
    for (let i = 0; i < count; i++) {
      const p = makePiece(kind || S.itemKind, loc);
      dish.append(p.el);
      spawnAnim(p.el, i * 40);
      fx('tick', i);
    }
    S.reserve = Math.max(S.reserve, unitsIn('tray') / S.unit);
    refreshCounts([loc]);
    layoutShare();
    await wait(reduceMotion() ? 0 : Math.min(300 + count * 40, 800));
    return getState();
  }

  async function makeGroups(list = [], opts = {}) {
    await ensureShare('cookie');
    const keepBowl = opts.leftovers != null ? !!opts.leftovers : S.groups.some((g) => g.leftover);
    const defs = (Array.isArray(list) ? list : []).filter((d) => d && d.id !== LEFTOVERS);
    const ids = new Set(defs.map((d, i) => String(d.id ?? `g${i}`)));
    if (keepBowl) ids.add(LEFTOVERS);
    for (const p of S.pieces) if (p.loc !== 'tray' && !ids.has(p.loc)) { p.loc = 'tray'; S.tray.append(p.el); }
    attachGroups(defs, { leftovers: keepBowl, animate: true });
    for (const p of S.pieces) { const d = dishOf(p.loc); if (d && p.el.parentElement !== d) d.append(p.el); }
    refreshCounts();
    layoutShare();
    await wait(reduceMotion() ? 0 : 300);
    return getState();
  }

  async function removeItems(n = 1, opts = {}) {
    if (!shareReady()) return getState();
    const loc = locOf(opts.fromGroup) || 'tray';
    if (!dishOf(loc)) { warn('removeItems: no such group', opts.fromGroup); return getState(); }
    const pool = S.pieces.filter((p) => p.loc === loc).slice(-Math.max(0, Math.round(Number(n) || 0)));
    for (const p of pool) p.el.classList.add('is-removing');
    S.pieces = S.pieces.filter((p) => !pool.includes(p));
    await wait(reduceMotion() ? 0 : 240);
    for (const p of pool) p.el.remove();
    refreshCounts([loc]);
    layoutShare();
    return getState();
  }

  /* ---------- demonstrateMove ---------- */
  async function demonstrateMove(opts = {}) {
    if (!shareReady()) { warn('demonstrateMove: no share scene'); return getState(); }
    const myToken = token;
    const src = locOf(opts.from || 'tray');
    if (!dishOf(src)) { warn('demonstrateMove: bad source', opts.from); return getState(); }
    const allGroups = opts.to === 'all-groups';
    const real = S.groups.filter((g) => !g.leftover);
    const bowl = S.groups.find((g) => g.leftover);
    const target = allGroups ? null : locOf(opts.to);
    if (!allGroups && !dishOf(target)) { warn('demonstrateMove: bad target', opts.to); return getState(); }
    if (allGroups && !real.length) { warn('demonstrateMove: no groups'); return getState(); }
    const pool = S.pieces.filter((p) => p.loc === src);
    let n = opts.count != null ? Math.round(Number(opts.count)) : allGroups ? pool.length : 1;
    n = Math.max(0, Math.min(n, pool.length));
    const plan = [];
    if (allGroups) {
      const full = bowl ? Math.floor(n / real.length) * real.length : n;
      for (let i = 0; i < n; i++) plan.push(i < full ? real[i % real.length].id : bowl.id);
    } else {
      for (let i = 0; i < n; i++) plan.push(target);
    }
    S.demo = true;
    root.classList.add('is-demo');
    clearHighlight();
    let done = 0;
    try {
      for (let i = 0; i < n; i++) {
        if (myToken !== token) return getState();
        const piece = pool[i];
        const dest = plan[i];
        if (piece.loc === dest) continue;
        const from = piece.loc;
        piece.loc = dest;
        logMove(from, dest);
        fx('tick', i);
        refreshCounts([from, dest]);
        layoutShare();
        const t0 = performance.now();
        try { await flip(piece.el, dishOf(dest), { duration: 280 }); } catch { dishOf(dest).append(piece.el); }
        done++;
        const rest = 300 - (performance.now() - t0);
        if (rest > 0 && !reduceMotion()) await wait(rest);
      }
    } finally {
      if (myToken === token) { S.demo = false; root.classList.remove('is-demo'); }
    }
    if (myToken === token) emit('demo', { from: src, to: opts.to, count: done, counts: countsPayload() });
    return getState();
  }

  /* =====================================================================
     OTHER STAGE SCENES
     ===================================================================== */
  const cardWrap = (cls, ...kids) => h('div', { class: `board-scene ${cls}` }, ...kids);

  /* ---- number line ---- */
  async function showNumberLine(opts = {}) {
    const from = Number.isFinite(+opts.from) ? +opts.from : 0;
    const to = Number.isFinite(+opts.to) && +opts.to > from ? +opts.to : from + 20;
    const step = Math.max(1, Math.round(+opts.step || 1));
    const mark = opts.mark == null ? null : Number(opts.mark);
    const hide = new Set((opts.hide || []).map(Number));
    // same line already showing: glide the marker instead of rebuilding
    if (S.scene === 'numberline' && S.nl && S.nl.from === from && S.nl.to === to && S.nl.step === step && !opts.title) {
      S.nl.mark = mark; S.nl.hide = hide;
      paintNumberLine();
      return getState();
    }
    resetScene('numberline');
    setTitle(opts.title);
    const vals = [];
    for (let v = from; v <= to; v += step) vals.push(v);
    if (vals[vals.length - 1] !== to && opts.snapEnd !== false) vals.push(to);
    const inner = h('div', { class: 'nl-inner' });
    const marker = h('div', { class: 'nl-marker' },
      h('div', { class: 'nl-pin' }, h('span', { class: 'nl-pin-dot' })),
      h('div', { class: 'nl-pin-tail' }));
    const line = h('div', { class: 'nl-line' });
    inner.append(line);
    const ticks = vals.map((v, i) => {
      const major = v % (step * 5) === 0 || i === 0 || i === vals.length - 1;
      const t = h('button', { class: 'nl-tick' + (major ? ' is-major' : ''), type: 'button', dataset: { n: String(v) },
        style: { left: `${(i / (vals.length - 1)) * 100}%` }, 'aria-label': String(v) },
      h('span', { class: 'nl-bar' }), h('span', { class: 'nl-num' }, String(v)));
      t.addEventListener('click', () => { fx('tap'); emit('tap', { target: `number:${v}` }); });
      inner.append(t);
      return t;
    });
    inner.append(marker);
    const card = cardWrap('nl', h('div', { class: 'nl-card' }, inner));
    stage.append(card);
    S.nl = { from, to, step, mark, hide, vals, ticks, marker, inner };
    S.info = { from, to };
    S.relayout = layoutNumberLine;
    layoutNumberLine();
    paintNumberLine(true);
    scheduleLayout();
    await wait(reduceMotion() ? 0 : 280);
    return getState();
  }

  function layoutNumberLine() {
    const nl = S.nl; if (!nl) return;
    const w = nl.inner.clientWidth || stage.clientWidth - 80;
    const per = w / Math.max(1, nl.vals.length - 1);
    const digits = String(Math.max(Math.abs(nl.to), Math.abs(nl.from))).length;
    const need = 14 + digits * 15;
    nl.every = Math.max(1, Math.ceil(need / per));
    nl.inner.style.setProperty('--tick-w', `${Math.max(34, Math.min(per, 90))}px`);
    nl.inner.style.setProperty('--nl-font', `${Math.max(15, Math.min(30, Math.round(per * 0.55 + 6)))}px`);
    nl.ticks.forEach((t, i) => {
      const v = nl.vals[i];
      const show = i % nl.every === 0 || i === nl.vals.length - 1 || v === nl.mark || nl.hide.has(v);
      t.classList.toggle('is-quiet', !show);
    });
  }

  function paintNumberLine() {
    const nl = S.nl; if (!nl) return;
    nl.ticks.forEach((t, i) => {
      const v = nl.vals[i];
      const hidden = nl.hide.has(v);
      t.querySelector('.nl-num').textContent = hidden ? '?' : String(v);
      t.classList.toggle('is-hidden', hidden);
      t.classList.toggle('is-marked', v === nl.mark);
    });
    layoutNumberLine();
    if (nl.mark == null) { nl.marker.classList.remove('is-on'); return; }
    const m = Math.max(nl.from, Math.min(nl.to, nl.mark));
    const frac = (m - nl.from) / (nl.to - nl.from);
    nl.marker.style.left = `${frac * 100}%`;
    nl.marker.classList.add('is-on');
  }

  /* ---- hundred chart ---- */
  async function showChart120(opts = {}) {
    resetScene('chart');
    setTitle(opts.title);
    const from = Number.isFinite(+opts.from) ? +opts.from : 1;
    const to = Number.isFinite(+opts.to) ? +opts.to : 120;
    const hl = new Set((opts.highlight || []).map(Number));
    const hideFrom = opts.hideFrom == null ? null : Number(opts.hideFrom);
    const hideSet = new Set((opts.hide || []).map(Number));
    const grid = h('div', { class: 'chart120 board-chart' });
    const cells = [];
    for (let n = from; n <= to; n++) {
      const hidden = (hideFrom != null && n >= hideFrom) || hideSet.has(n);
      const c = h('button', { class: 'cellnum' + (n % 10 === 0 ? ' is-tens' : '') + (hl.has(n) ? ' is-hl' : '') + (hidden ? ' is-blank is-unknown' : ''),
        type: 'button', dataset: { n: String(n), cell: String(n) } }, hidden ? '?' : String(n));
      c.addEventListener('click', () => {
        fx('tap');
        c.classList.remove('is-tapped'); void c.offsetWidth; c.classList.add('is-tapped');
        emit('tap', { target: `cell:${n}`, hidden });
      });
      grid.append(c);
      cells.push(c);
    }
    // line up the first row so 11..20 sits under 1..10 (numbers 1..10 start in column 1)
    if (from % 10 !== 1 && from > 0) grid.firstElementChild.style.gridColumnStart = String(((from - 1) % 10) + 1);
    stage.append(cardWrap('chart', grid));
    S.info = { from, to, highlight: [...hl], hideFrom, hide: [...hideSet] };
    S.relayout = () => {
      const W = stage.clientWidth, Ht = stage.clientHeight;
      if (W < 60 || Ht < 60) return;
      const rows = Math.ceil((to - from + 1 + ((from - 1) % 10 || 0)) / 10);
      const cell = Math.floor(Math.max(30, Math.min(72, (W - 24 - 9 * CELL_GAP) / 10, (Ht - 20 - (rows - 1) * CELL_GAP) / rows)));
      grid.style.setProperty('--cell', `${cell}px`);
    };
    S.relayout();
    scheduleLayout();
    await wait(reduceMotion() ? 0 : 200);
    return getState();
  }

  /* ---- ten frames ---- */
  async function showTenFrame(opts = {}) {
    resetScene('tenframe');
    setTitle(opts.title);
    let a = Math.max(0, Math.round(Number(opts.filled) || 0));
    let b = opts.second == null ? null : Math.max(0, Math.round(Number(opts.second) || 0));
    if (b == null && a > 10) { b = a - 10; a = 10; }
    const colour = ['orange', 'blue', 'green', 'purple', 'pink'].includes(opts.colour) ? opts.colour : 'orange';
    const colour2 = colour === 'blue' ? 'orange' : 'blue';
    const mk = (n, col, label) => {
      const cells = Array.from({ length: 10 }, (_, i) => {
        const cell = h('div', { class: 'cell', dataset: { cell: String(i + 1) } });
        if (i < Math.min(n, 10)) {
          const c = h('div', { class: `counter is-${col}`, style: { animationDelay: `${Math.min(i, 12) * 55}ms` } });
          cell.append(c);
        }
        cell.addEventListener('click', () => { fx('tap'); emit('tap', { target: `cell:${i + 1}` }); });
        return cell;
      });
      return h('div', { class: 'frame-wrap' }, h('div', { class: 'tenframe' }, ...cells), opts.labels ? h('div', { class: 'frame-label' }, label ?? String(n)) : null);
    };
    const frames = h('div', { class: 'board-frames' }, mk(a, colour), b != null ? mk(b, colour2) : null);
    stage.append(cardWrap('tenframe-scene', frames));
    S.info = { filled: a, second: b };
    S.relayout = () => {
      const W = stage.clientWidth, Ht = stage.clientHeight;
      if (W < 60 || Ht < 60) return;
      const count = b != null ? 2 : 1;
      const gap = 36;
      const byW = ((W - 24 - gap * (count - 1)) / count - 16 - 4 * CELL_GAP) / 5;
      const byH = ((Ht - 40 - (opts.labels ? 50 : 0)) - 16 - CELL_GAP) / 2;
      const cell = Math.floor(Math.max(36, Math.min(110, byW, byH)));
      frames.style.setProperty('--cell', `${cell}px`);
    };
    S.relayout();
    scheduleLayout();
    await wait(reduceMotion() ? 0 : 320);
    return getState();
  }

  /* ---- big number ---- */
  async function showNumber(n, opts = {}) {
    resetScene('number');
    setTitle(opts.title);
    const val = n == null ? '' : String(n);
    const card = h('button', { class: 'board-bignum', type: 'button', dataset: { n: val } },
      opts.label ? h('span', { class: 'bignum-label' }, opts.label) : null,
      h('span', { class: `bignum-digits d${Math.min(val.length, 4)}` }, val));
    card.addEventListener('click', () => { fx('tap'); emit('tap', { target: `number:${val}` }); });
    stage.append(cardWrap('number-scene', card));
    S.info = { value: n, label: opts.label || null };
    await wait(reduceMotion() ? 0 : 220);
    return getState();
  }

  /* =====================================================================
     INPUT UNDER THE STAGE: choices + keypad
     ===================================================================== */
  function openUnder(kind) {
    under.replaceChildren();
    under.hidden = false;
    under.dataset.kind = kind;
    root.classList.add('has-under');
    S.under = kind;
    if (S.scene === 'empty') { S.scene = kind; root.dataset.scene = kind; }
  }

  function answer(value, prompt) {
    lastAnswer = value;
    fx('tap');
    emit('answer', { value, prompt: prompt ?? null });
  }

  async function showChoices(list = [], opts = {}) {
    openUnder('choices');
    const arr = (Array.isArray(list) ? list : []).slice(0, 8);
    const prompt = opts.prompt ?? null;
    S.choices = { list: arr, prompt };
    const row = h('div', { class: 'choices board-choices' });
    for (const v of arr) {
      const isNum = typeof v === 'number' || (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)));
      const val = isNum ? Number(v) : v;
      const b = h('button', { class: 'choice' + (isNum ? '' : ' is-text'), type: 'button', dataset: { value: String(val), n: isNum ? String(val) : '' } }, String(v));
      b.addEventListener('click', () => {
        row.querySelectorAll('.choice').forEach((x) => x.classList.remove('is-selected'));
        b.classList.add('is-selected');
        answer(val, prompt);
      });
      row.append(b);
    }
    under.append(prompt ? h('div', { class: 'board-prompt' }, prompt) : null, row);
    under.querySelectorAll('.choice').forEach((b, i) => { b.style.animationDelay = `${i * 60}ms`; });
    placeUnder();
    scheduleLayout();
    await wait(reduceMotion() ? 0 : 200);
    return getState();
  }

  async function showKeypad(opts = {}) {
    openUnder('keypad');
    const max = Math.max(1, Math.round(Number(opts.max) || 120));
    const maxLen = String(max).length;
    const kp = { max, text: '', fresh: false };
    S.kp = kp;
    const display = h('div', { class: 'kp-display', 'aria-live': 'polite' }, h('span', { class: 'kp-text' }, ''));
    const paint = () => {
      display.firstChild.textContent = kp.text;
      display.classList.toggle('is-empty', kp.text === '');
    };
    const bad = () => { display.classList.remove('shake'); void display.offsetWidth; display.classList.add('shake'); later(() => display.classList.remove('shake'), 500); };
    const press = (k) => {
      fx('tap');
      if (k === 'back') { kp.text = kp.fresh ? '' : kp.text.slice(0, -1); kp.fresh = false; paint(); return; }
      if (k === 'ok') {
        if (kp.text === '') { bad(); return; }
        const v = Number(kp.text);
        kp.fresh = true;
        answer(v, 'keypad');
        return;
      }
      if (kp.fresh) { kp.text = ''; kp.fresh = false; }
      const next = (kp.text === '0' ? '' : kp.text) + k;
      if (next.length > maxLen || Number(next) > max) { bad(); return; }
      kp.text = next;
      paint();
    };
    const mkKey = (k, label, cls = '') => {
      const b = h('button', { class: `key ${cls}`, type: 'button', dataset: { key: k, n: /^\d$/.test(k) ? k : '' }, 'aria-label': k === 'back' ? 'delete' : k === 'ok' ? 'enter' : k }, label);
      b.addEventListener('click', () => press(k));
      return b;
    };
    const backIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 5H9l-6 7 6 7h12z"/><path d="M13 9.5l5 5M18 9.5l-5 5"/></svg>';
    const okIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
    const keys = [];
    for (const d of '123456789') keys.push(mkKey(d, d));
    keys.push(mkKey('back', h('span', { html: backIcon }), 'is-fn'), mkKey('0', '0'), mkKey('ok', h('span', { html: okIcon }), 'is-ok'));
    const pad = h('div', { class: 'kp-pad' }, ...keys);
    kp.pad = pad;
    under.append(h('div', { class: 'keypad' }, display, pad));
    paint();
    placeUnder();
    scheduleLayout();
    await wait(reduceMotion() ? 0 : 200);
    return getState();
  }

  async function hideInput() {
    under.replaceChildren();
    under.hidden = true;
    root.classList.remove('has-under', 'is-side');
    S.under = null; S.kp = null; S.choices = null;
    if (S.scene === 'choices' || S.scene === 'keypad') { S.scene = 'empty'; root.dataset.scene = 'empty'; }
    return getState();
  }

  function placeUnder() {
    if (under.hidden) { root.classList.remove('is-side'); return; }
    const W = root.clientWidth, Ht = root.clientHeight;
    const side = S.under === 'keypad' && W > 0 && W / Math.max(Ht, 1) > 1.25;
    root.classList.toggle('is-side', side);
    under.classList.toggle('kp-wide', S.under === 'keypad' && !side);
  }

  /* =====================================================================
     HIGHLIGHT + HAND
     ===================================================================== */
  const HAND = `<svg viewBox="0 0 48 60" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M17 30 V9 a7 7 0 0 1 14 0 V28 q9 -2 12 4 q3 8 0 14 q-3 9 -12 10 h-8 q-9 -1 -12 -10 l-3 -9 q-1 -5 4 -4z" fill="#E8793A" stroke="#2B2740" stroke-width="2.6" stroke-linejoin="round"/>
    <path d="M21 14 V12 a3 3 0 0 1 6 0 V16" stroke="#FFB07A" stroke-width="3" stroke-linecap="round" fill="none"/>
    <ellipse cx="24" cy="46" rx="7" ry="5" fill="#FFE6C7"/>
    <path d="M17 38 h3 M29 38 h4" stroke="#C9612B" stroke-width="2.2" stroke-linecap="round"/></svg>`;

  function clearHighlight() {
    if (S.hl) {
      clearTimeout(S.hl.timer);
      S.hl.els.forEach((e) => e.classList.remove('is-glow'));
      S.hl.hands.forEach((hd) => hd.remove());
      S.hl = null;
    }
    S.highlighted = null;
  }

  function resolveTargets(target) {
    const t = String(target);
    if (t === 'tray') return S.tray ? [S.tray] : [];
    if (t === 'all-groups') return S.groups.filter((g) => !g.leftover).map((g) => g.el);
    if (t.startsWith('group:')) { const g = groupById(locOf(t)); return g ? [g.el] : []; }
    if (t === LEFTOVERS) { const g = groupById(LEFTOVERS); return g ? [g.el] : []; }
    if (t.startsWith('item:')) { const p = S.pieces.find((q) => String(q.index) === t.slice(5)) || S.pieces[Number(t.slice(5))]; return p ? [p.el] : []; }
    if (t.startsWith('number:')) {
      const n = t.slice(7);
      const el = root.querySelector(`[data-n="${CSS.escape(n)}"]`) || root.querySelector(`.board-bignum`);
      return el ? [el] : [];
    }
    if (t.startsWith('cell:')) {
      const n = t.slice(5);
      const el = root.querySelector(`[data-cell="${CSS.escape(n)}"]`);
      return el ? [el] : [];
    }
    return [];
  }

  async function highlight(target, opts = {}) {
    const ms = Math.max(300, Number(opts.ms) || 2500);
    clearHighlight();
    if (target === 'check') { S.highlighted = 'check'; emit('tap-request', { target: 'check' }); later(() => { if (S.highlighted === 'check') S.highlighted = null; }, ms); return { ok: true }; }
    const els = resolveTargets(target);
    if (!els.length) { warn('highlight: nothing to highlight for', target); return { ok: false }; }
    const hands = [];
    els.slice(0, 6).forEach((el) => {
      el.classList.add('is-glow');
      const hand = h('div', { class: 'board-hand', html: HAND });
      fxLayer.append(hand);
      hands.push(hand);
    });
    const hl = { els, hands, target, timer: 0 };
    S.hl = hl;
    S.highlighted = String(target);
    repositionHands();
    const myTok = token;
    hl.timer = setTimeout(() => { if (token === myTok && S.hl === hl) clearHighlight(); }, ms);
    return { ok: true };
  }

  function repositionHands() {
    if (!S.hl) return;
    const rr = root.getBoundingClientRect();
    S.hl.els.slice(0, 6).forEach((el, i) => {
      const hand = S.hl.hands[i]; if (!hand) return;
      const anchor = el.classList.contains('board-group') ? (el.querySelector('.plate-dish') || el) : el;
      const r = anchor.getBoundingClientRect();
      const x = r.left - rr.left + r.width / 2;
      const y = r.top - rr.top + Math.min(r.height * 0.25, 16);
      hand.style.left = `${x}px`;
      hand.style.top = `${y}px`;
    });
  }

  /* =====================================================================
     COUNTS, CELEBRATE, LOCK, CLEAR
     ===================================================================== */
  async function showCounts(on = true) {
    countsOn = !!on;
    refreshCounts();
    if (countsOn) S.groups.forEach((g, i) => later(() => popCount(g), i * 60));
    return getState();
  }

  async function celebrate(level = 'small') {
    const r = stage.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    sparkle(level === 'big' ? 14 : 9, level === 'big' ? 150 : 100);
    if (level === 'big') {
      try { confetti({ x: cx, y: cy, count: 46 }); } catch { /* confetti canvas may be missing in the dev page */ }
      (deps.sfx?.celebrate ? fx('celebrate') : fx('fanfare'));
      try { document.querySelectorAll('.mascot, .mascot-sm').forEach((m) => { m.classList.remove('is-bounce'); void m.getBoundingClientRect(); m.classList.add('is-bounce'); later(() => m.classList.remove('is-bounce'), 700); }); } catch { /* optional */ }
    } else {
      fx('correct');
    }
    return { ok: true };
  }

  function sparkle(n, radius) {
    if (reduceMotion()) return;
    const rr = root.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const ring = h('div', { class: 'board-sparkle', style: { left: `${sr.left - rr.left + sr.width / 2}px`, top: `${sr.top - rr.top + sr.height / 2}px` } });
    const colours = ['#FFD23F', '#FF8C42', '#3FB984', '#4D9EEB', '#FF7EA8', '#9B7CF0'];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const s = h('span', { class: 'sp', style: { '--dx': `${Math.cos(a) * radius}px`, '--dy': `${Math.sin(a) * radius}px`, '--c': colours[i % colours.length], '--d': `${(i % 3) * 40}ms` },
        html: '<svg viewBox="0 0 24 24"><path d="M12 1.5l2.6 6.9 7.4.4-5.8 4.6 2 7.1L12 16.5 5.8 20.5l2-7.1L2 8.8l7.4-.4z" fill="currentColor"/></svg>' });
      ring.append(s);
    }
    fxLayer.append(ring);
    later(() => ring.remove(), 1300);
  }

  async function setLocked(v = true) {
    locked = !!v;
    root.classList.toggle('is-locked', locked);
    return locked;
  }

  async function clear() {
    resetScene('empty');
    hideInput();
    countsOn = false;
    moves = [];
    lastAnswer = null;
    return getState();
  }

  function destroy() {
    resetScene('empty');
    ro?.disconnect();
    removeEventListener('resize', onWinResize);
    if (raf) cancelAnimationFrame(raf);
    listeners.clear();
    root.remove();
  }

  /* =====================================================================
     STATE + DESCRIBE
     ===================================================================== */
  function equalNow() {
    if (S.scene !== 'share') return null;
    const real = S.groups.filter((g) => !g.leftover);
    if (!real.length || !S.pieces.length) return null;
    if (unitsIn('tray') > 0) return null;
    const c0 = unitsIn(real[0].id);
    return real.every((g) => unitsIn(g.id) === c0);
  }

  function getState() {
    const shared = S.scene === 'share';
    const bowl = S.groups.find((g) => g.leftover);
    return {
      scene: S.scene,
      itemKind: S.itemKind,
      total: shared ? S.pieces.reduce((a, p) => a + p.unit, 0) : 0,
      tray: shared ? unitsIn('tray') : 0,
      groups: S.groups.filter((g) => !g.leftover).map((g) => ({ id: g.id, name: g.name, role: g.role, kind: g.kind, count: unitsIn(g.id) })),
      leftovers: bowl ? { count: unitsIn(LEFTOVERS) } : null,
      equal: equalNow(),
      moves: moves.slice(-20),
      lastAnswer,
      highlighted: S.highlighted,
      under: S.under,
      countsShown: countsOn,
      locked,
      info: S.info,
    };
  }

  const list = (arr) => (arr.length <= 1 ? arr.join('') : `${arr.slice(0, -1).join(', ')} and ${arr[arr.length - 1]}`);

  function describe() {
    let s = '';
    const st = getState();
    switch (S.scene) {
      case 'share': {
        const total = st.total;
        if (!total && !S.groups.length) { s = 'Empty table: no items yet.'; break; }
        const parts = [`tray ${st.tray}`, ...st.groups.map((g) => `${g.name} ${g.count}`)];
        if (st.leftovers) parts.push(`Pip's bowl ${st.leftovers.count}`);
        s = `${total} ${nounFor(total)}: ${parts.join(', ')}.`;
        if (st.groups.length) {
          const real = st.groups.map((g) => g.count);
          const sameSoFar = real.every((c) => c === real[0]);
          if (st.tray > 0) s += sameSoFar && real[0] > 0 ? ` Equal so far, but ${st.tray} still in the tray.` : ' Not equal yet.';
          else if (st.equal) s += st.leftovers && st.leftovers.count ? ` All groups equal, ${st.leftovers.count} left over.` : ' All groups equal.';
          else s += ' Not equal yet.';
        }
        if (countsShown()) s += ' Counts are showing.';
        break;
      }
      case 'numberline': {
        const nl = S.nl;
        s = `Number line from ${nl.from} to ${nl.to}${nl.step !== 1 ? ` counting by ${nl.step}s` : ''}${nl.mark != null ? `, marker on ${nl.hide.has(nl.mark) ? 'a hidden number' : nl.mark}` : ', no marker'}.`;
        break;
      }
      case 'chart': {
        const i = S.info;
        s = `Hundred chart ${i.from} to ${i.to}`;
        if (i.highlight.length) s += `, highlighted ${list(i.highlight.map(String))}`;
        if (i.hideFrom != null) s += `, numbers from ${i.hideFrom} are hidden`;
        if (i.hide.length) s += `, hidden: ${list(i.hide.map(String))}`;
        s += '.';
        break;
      }
      case 'tenframe': {
        const i = S.info;
        s = i.second != null ? `Two ten frames: ${i.filled} filled in the first, ${i.second} filled in the second.` : `Ten frame with ${i.filled} filled and ${10 - i.filled} empty.`;
        break;
      }
      case 'number':
        s = `Big number card showing ${S.info.value}${S.info.label ? ` (${S.info.label})` : ''}.`;
        break;
      case 'choices':
      case 'keypad':
        s = 'Nothing on the stage.';
        break;
      default:
        s = 'The board is empty.';
    }
    if (S.under === 'choices' && S.choices) s += ` Choices shown: ${S.choices.list.join(', ')}${S.choices.prompt ? ` (${S.choices.prompt})` : ''}.`;
    if (S.under === 'keypad' && S.kp) s += ` Number pad is open${S.kp.text ? `, typed ${S.kp.text}` : ''}.`;
    if (lastAnswer != null) s += ` Last answer: ${lastAnswer}.`;
    if (locked) s += ' Dragging is locked.';
    return s;
  }
  const countsShown = () => countsOn;

  /* ---------- public object ---------- */
  const safe = (name, fn) => async (...a) => {
    try { return await fn(...a); } catch (e) { warn(`${name} failed`, e); return undefined; }
  };
  const board = {
    root,
    on, off,
    setScene: safe('setScene', setScene),
    spawnItems: safe('spawnItems', spawnItems),
    makeGroups: safe('makeGroups', makeGroups),
    removeItems: safe('removeItems', removeItems),
    showNumberLine: safe('showNumberLine', showNumberLine),
    showChart120: safe('showChart120', showChart120),
    showTenFrame: safe('showTenFrame', showTenFrame),
    showNumber: safe('showNumber', showNumber),
    showChoices: safe('showChoices', showChoices),
    showKeypad: safe('showKeypad', showKeypad),
    hideInput: safe('hideInput', hideInput),
    highlight: safe('highlight', highlight),
    demonstrateMove: safe('demonstrateMove', demonstrateMove),
    showCounts: safe('showCounts', showCounts),
    celebrate: safe('celebrate', celebrate),
    setLocked: safe('setLocked', setLocked),
    clear: safe('clear', clear),
    destroy,
    noun,
    getState() { try { return getState(); } catch (e) { warn('getState', e); return { scene: 'empty' }; } },
    describe() { try { return describe(); } catch (e) { warn('describe', e); return ''; } },
  };
  return board;
}
