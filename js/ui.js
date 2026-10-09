// Small DOM + animation helpers. No framework.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') { for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; } }
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function svg(markup, cls) {
  const wrap = document.createElement('div');
  wrap.innerHTML = markup.trim();
  const el = wrap.firstElementChild;
  if (cls) el.classList.add(...cls.split(' '));
  return el;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));
export const rand = (n) => Math.floor(Math.random() * n);
export const randInt = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[rand(arr.length)];
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Build a set of distinct answer choices around the correct value. */
export function numberChoices(correct, count = 3, lo = 0, hi = 120) {
  const set = new Set([correct]);
  const spread = Math.max(2, Math.round(Math.abs(correct) * 0.3) + 1);
  let guard = 0;
  while (set.size < count && guard++ < 200) {
    const v = correct + randInt(-spread, spread);
    if (v >= lo && v <= hi) set.add(v);
  }
  while (set.size < count) set.add(randInt(lo, hi));
  return shuffle([...set]);
}

export function shake(el) {
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 500);
}

export function bounce(el) {
  if (!el) return;
  el.classList.remove('is-bounce');
  void el.offsetWidth;
  el.classList.add('is-bounce');
  setTimeout(() => el.classList.remove('is-bounce'), 700);
}

export const prefersReducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Set a counter badge's text and re-trigger its pop (.is-pop) only when the text really changed. */
export function popCount(el, text) {
  if (!el) return;
  const t = String(text);
  if (el.textContent === t) return;
  el.textContent = t;
  if (prefersReducedMotion()) return;
  el.classList.remove('is-pop');
  void el.offsetWidth;
  el.classList.add('is-pop');
  clearTimeout(el._popT);
  el._popT = setTimeout(() => el.classList.remove('is-pop'), 460);
}

/**
 * Move `el` into `newParent` with a FLIP animation (Web Animations API) that glides from where it is
 * on screen, then squashes and stretches as it lands. Fires a bubbling 'flip:land' event on `el` at the
 * moment of landing (drag.js uses it for the thump + zone pulse).
 */
export function flipMove(el, newParent, { duration = 420, before } = {}) {
  const first = el.getBoundingClientRect();
  if (before) before();
  el._flip?.cancel();
  newParent.append(el);
  el.style.transition = 'none';
  el.style.transform = 'none';
  const last = el.getBoundingClientRect();
  const dx = first.left - last.left;
  const dy = first.top - last.top;
  const sx = first.width / (last.width || 1);
  const land = () => el.dispatchEvent(new CustomEvent('flip:land', { bubbles: true }));
  if (prefersReducedMotion() || !el.animate || (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(sx - 1) < 0.02)) {
    el.style.transition = '';
    land();
    return Promise.resolve();
  }
  const anim = el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${sx})`, easing: 'cubic-bezier(0.25, 0.8, 0.35, 1)' },
    { transform: 'translate(0, 0) scale(1.08, 0.92)', offset: 0.52, easing: 'ease-out' },
    { transform: 'scale(0.97, 1.03)', offset: 0.78, easing: 'ease-in-out' },
    { transform: 'none' },
  ], { duration });
  el._flip = anim;
  const landT = setTimeout(land, duration * 0.52);
  return new Promise((res) => {
    const end = () => { clearTimeout(landT); if (el._flip === anim) { el._flip = null; el.style.transition = ''; } res(); };
    anim.addEventListener('finish', end);
    anim.addEventListener('cancel', () => { clearTimeout(landT); res(); });
  });
}

/* ---------- Confetti (restrained: ~40 pieces, 1.2s) ---------- */
let fxCanvas, fxCtx, fxPieces = [], fxRaf = 0;
const FX_COLOURS = ['#ff8c42', '#3fb984', '#4d9eeb', '#ffd23f', '#ff7ea8', '#9b7cf0'];

function fxEnsure() {
  if (fxCanvas) return;
  fxCanvas = document.getElementById('fx');
  fxCtx = fxCanvas.getContext('2d');
  const fit = () => { fxCanvas.width = innerWidth * devicePixelRatio; fxCanvas.height = innerHeight * devicePixelRatio; fxCtx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); };
  fit();
  addEventListener('resize', fit);
}

export function confetti({ x = innerWidth / 2, y = innerHeight / 2, count = 40, spread = 1 } = {}) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  fxEnsure();
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9 * spread;
    const sp = 7 + Math.random() * 9;
    fxPieces.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: 0.35, r: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: pick(FX_COLOURS), life: 1, shape: Math.random() < 0.3 ? 'c' : 'r' });
  }
  if (!fxRaf) fxRaf = requestAnimationFrame(fxTick);
}

function fxTick() {
  fxCtx.clearRect(0, 0, innerWidth, innerHeight);
  fxPieces = fxPieces.filter((p) => p.life > 0);
  for (const p of fxPieces) {
    p.vy += p.g; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.rot += p.vr; p.life -= 0.014;
    fxCtx.save();
    fxCtx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.6));
    fxCtx.translate(p.x, p.y); fxCtx.rotate(p.rot); fxCtx.fillStyle = p.c;
    if (p.shape === 'c') { fxCtx.beginPath(); fxCtx.arc(0, 0, p.r * 0.7, 0, Math.PI * 2); fxCtx.fill(); }
    else fxCtx.fillRect(-p.r, -p.r * 0.6, p.r * 2, p.r * 1.2);
    fxCtx.restore();
  }
  fxRaf = fxPieces.length ? requestAnimationFrame(fxTick) : 0;
  if (!fxRaf) fxCtx.clearRect(0, 0, innerWidth, innerHeight);
}

/* ---------- Toast ---------- */
let toastEl, toastTimer;
export function toast(msg, ms = 1800) {
  if (!toastEl) { toastEl = h('div', { class: 'toast' }); document.getElementById('app').append(toastEl); }
  toastEl.textContent = msg;
  toastEl.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('on'), ms);
}

/** Hold-to-activate button: fires `onHold` after `ms` of continuous press. */
export function holdButton(el, onHold, ms = 1800) {
  const fill = h('div', { class: 'fill' });
  el.classList.add('gate-hold');
  el.append(fill);
  let timer = 0, start = 0, raf = 0;
  const tick = () => { fill.style.width = `${Math.min(100, ((performance.now() - start) / ms) * 100)}%`; raf = requestAnimationFrame(tick); };
  const cancel = () => { clearTimeout(timer); cancelAnimationFrame(raf); fill.style.width = '0'; timer = 0; };
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch {}
    start = performance.now(); tick();
    timer = setTimeout(() => { cancel(); onHold(); }, ms);
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => el.addEventListener(t, cancel));
  return el;
}

export function pluralise(n, one, many = one + 's') { return n === 1 ? one : many; }

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
