// Hardened pointer-events drag and drop engine shared by every module and the board.
//
// Feel: critically damped spring follow (rAF), lift (scale 1.15 + shadow), tilt from horizontal
// velocity (+-6 deg), wobble after 600 ms holding still, `.is-over` on the zone under the finger,
// squash-and-stretch landing (ui.js flipMove), spring-back on a rejected drop.
//
// Reliability design (all items are plain DOM nodes owned by the modules):
// - While dragging, a GHOST clone is moved inside a fixed #drag-layer at document level. The real
//   element stays in place (opacity 0), so no ancestor overflow/transform/z-index can trap the visual,
//   the layout never reflows, and owners' bookkeeping (children counts, parentElement) is untouched.
// - On release the ghost is removed and the real element takes over its exact on-screen position as an
//   inline transform. Owners' `onDrop(el, target|null, point)` re-parent with flipMove (as before) and we
//   clear the transform once it resolves; if the item was not re-parented it springs back to its origin.
// - We never animate `transform` of a draggable through CSS (the picked look is a halo + an inner bob).
// - State machine in `el.dataset.dragState`: idle -> lifted (finger down) -> dragging -> dropping -> idle.
// - Everything that can strand a drag (pointercancel, lostpointercapture, touchcancel, blur, hidden,
//   pagehide, resize/orientation, detached element, second finger) ends or resets it. A 500 ms watchdog
//   force-resets anything stuck. Per-element listeners live behind an AbortController.
import { sfx } from './audio.js';
import { prefersReducedMotion } from './ui.js';

const play = (name, ...a) => { try { sfx?.[name]?.(...a); } catch {} };

let hooks = { onLift: null, onDrop: null, onReject: null };
let picked = null, pickTimer = 0, pickedAt = 0;

const registry = new Set();   // elements made draggable (pruned when detached)
const active = new Set();     // elements whose dragState !== 'idle'
const stats = { resets: 0 };

const OMEGA = 55;             // spring stiffness: ~18 ms time constant
const LIFT_SCALE = 1.15;
const MAX_TILT = 6;
const WOBBLE_AFTER = 600;
const TAP_MS = 350, TAP_PX = 8;
const PICK_EXPIRE = 4000;
const WATCHDOG_MS = 500, STALE_MS = 1500, DROP_STUCK_MS = 4000;
const CSS_VARS = ['--item', '--card', '--unit', '--cell', '--counter', '--dot', '--plate-w', '--plate-h'];

/** Global observers (the whiteboard uses these to report moves to the tutor). */
export function setDragHooks({ onLift, onDrop, onReject } = {}) {
  hooks = { onLift: onLift || null, onDrop: onDrop || null, onReject: onReject || null };
}
const callHook = (name, ...a) => { try { hooks[name]?.(...a); } catch (err) { console.warn('drag hook', name, err); } };

export function dragStats() { return { active: active.size, resets: stats.resets }; }

function dragLayer() {
  let l = document.getElementById('drag-layer');
  if (!l) { l = document.createElement('div'); l.id = 'drag-layer'; document.body.append(l); }
  return l;
}

/**
 * makeDraggable(el, { canDrag(el) -> bool, onDrop(el, target|null, point) -> Promise|void, onPick(el), onLift(el) })
 */
export function makeDraggable(el, { canDrag = () => true, onDrop, onPick, onLift } = {}) {
  if (el._dragAbort) destroyDraggable(el);
  const life = new AbortController();
  el._dragAbort = life;
  registry.add(el);
  el.classList.add('item');
  el.style.touchAction = 'none';
  el.style.webkitUserSelect = 'none'; el.style.userSelect = 'none';
  el.style.webkitTouchCallout = 'none'; el.style.webkitUserDrag = 'none';
  el.setAttribute('draggable', 'false');
  el.dataset.dragState = 'idle';

  const info = el._dg = { lastEv: 0, pid: null, dropAt: 0 };
  let state = 'idle';
  const setState = (s) => {
    state = s; el.dataset.dragState = s;
    if (s === 'idle') active.delete(el); else active.add(el);
  };

  let pressAC = null, holdTimer = 0, raf = 0, ghost = null;
  let startX = 0, startY = 0, startT = 0, lastX = 0, lastY = 0, lastMoveAt = 0, lastFx = 0, lastFy = 0;
  let dx = 0, dy = 0, px = 0, py = 0, vx = 0, vy = 0, sc = 1, tilt = 0, lastT = 0;
  let baseL = 0, baseT = 0, boxW = 0, boxH = 0;
  let over = null, lastDragSfx = 0;

  const clampDx = (v) => Math.max(-baseL, Math.min(innerWidth - baseL - boxW, v));
  const clampDy = (v) => Math.max(-baseT, Math.min(innerHeight - baseT - boxH, v));
  const tStr = (x, y, rot, s) => `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${s.toFixed(4)})`;

  const stepAxis = (x, v, target, t) => {
    const d = x - target, b = v + OMEGA * d, e = Math.exp(-OMEGA * t);
    return [target + (d + b * t) * e, (v - OMEGA * b * t) * e];
  };

  const setOver = (zone) => {
    if (zone === over) return;
    if (over) over.classList.remove('is-over');
    if (zone) {
      zone.classList.add('is-over');
      const now = performance.now();
      if (now - lastDragSfx > 250) { lastDragSfx = now; play('drag'); }
    }
    over = zone;
  };

  /** Return every trace of a drag to rest. `hard` = forced (counted in stats.resets). */
  function reset(hard) {
    clearTimeout(holdTimer); holdTimer = 0;
    cancelAnimationFrame(raf); raf = 0;
    pressAC?.abort(); pressAC = null;
    try { if (info.pid != null && el.hasPointerCapture?.(info.pid)) el.releasePointerCapture(info.pid); } catch {}
    ghost?.remove(); ghost = null;
    setOver(null);
    el.classList.remove('is-dragging', 'is-lifted');
    for (const p of ['transform', 'zIndex', 'pointerEvents', 'willChange', 'animation', 'opacity', 'transition']) el.style[p] = '';
    try { el.getAnimations?.().forEach((a) => a.cancel()); } catch {}
    el._flip = null; el._springing = null; el._landedByDrag = false;
    const wasActive = state !== 'idle';
    setState('idle');
    if (hard && wasActive) stats.resets++;
  }
  el._dragReset = reset;

  const tick = (now) => {
    if (state !== 'dragging') { raf = 0; return; }
    if (!el.isConnected) { reset(true); return; }
    const dt = Math.min(0.05, Math.max(0.001, (now - lastT) / 1000));
    lastT = now;
    [px, vx] = stepAxis(px, vx, clampDx(dx), dt);
    [py, vy] = stepAxis(py, vy, clampDy(dy), dt);
    sc += (LIFT_SCALE - sc) * Math.min(1, dt * 16);
    tilt += (Math.max(-MAX_TILT, Math.min(MAX_TILT, vx * 0.006)) - tilt) * Math.min(1, dt * 12);
    const still = now - lastMoveAt;
    let wob = 0;
    if (still > WOBBLE_AFTER) wob = Math.sin((still - WOBBLE_AFTER) / 1000 * Math.PI * 2 * 1.7) * 2.6 * Math.min(1, (still - WOBBLE_AFTER) / 400);
    if (ghost) ghost.style.transform = tStr(px, py, tilt + wob, sc);
    raf = requestAnimationFrame(tick);
  };

  function startDrag() {
    if (state !== 'lifted') return;
    clearTimeout(holdTimer); holdTimer = 0;
    if (!el.isConnected) { reset(true); return; }
    clearPicked();
    // a grab during a landing / spring-back animation: stop it, grab from the rest position
    el._flip?.cancel(); el._springing?.cancel();
    try { el.getAnimations?.().forEach((a) => a.cancel()); } catch {}
    el.style.transition = 'none'; el.style.animation = 'none'; el.style.transform = '';
    const r = el.getBoundingClientRect();
    baseL = r.left; baseT = r.top; boxW = r.width; boxH = r.height;
    const cs = getComputedStyle(el);
    ghost = el.cloneNode(true);
    ghost.removeAttribute('id');
    ghost.classList.remove('is-picked', 'nb-glow', 'is-glow', 'as-hop', 'nb-in', 'is-bounce');
    ghost.classList.add('drag-ghost', 'is-dragging', 'is-lifted');
    delete ghost.dataset.dragState;
    Object.assign(ghost.style, {
      position: 'fixed', left: `${baseL}px`, top: `${baseT}px`, width: `${boxW}px`, height: `${boxH}px`, margin: '0',
      transition: 'none', animation: 'none', pointerEvents: 'none', opacity: '1',
    });
    for (const v of CSS_VARS) { const val = cs.getPropertyValue(v); if (val) ghost.style.setProperty(v, val); }
    px = dx; py = dy; vx = vy = 0; tilt = 0; sc = prefersReducedMotion() ? LIFT_SCALE : 1;
    ghost.style.transform = tStr(clampDx(px), clampDy(py), 0, sc);
    dragLayer().append(ghost);
    el.style.opacity = '0';
    el.classList.add('is-dragging', 'is-lifted');
    lastT = performance.now(); lastMoveAt = lastT; lastFx = lastX; lastFy = lastY;
    setState('dragging');
    play('pickup');
    try { onLift?.(el); } catch {}
    callHook('onLift', el);
    if (prefersReducedMotion()) ghost.style.transform = tStr(clampDx(dx), clampDy(dy), 0, LIFT_SCALE);
    else { ghost.style.willChange = 'transform'; raf = requestAnimationFrame(tick); }
    setOver(targetAt(lastX, lastY, el));
  }

  function onMove(e) {
    if (e.pointerId !== info.pid || (state !== 'lifted' && state !== 'dragging')) return;
    info.lastEv = performance.now();
    if (Number.isFinite(e.clientX)) { lastX = e.clientX; lastY = e.clientY; }
    dx = lastX - startX; dy = lastY - startY;
    if (state === 'lifted' && Math.hypot(dx, dy) > TAP_PX) startDrag();
    if (state === 'dragging') {
      if (Math.hypot(lastX - lastFx, lastY - lastFy) > 2) { lastMoveAt = performance.now(); lastFx = lastX; lastFy = lastY; }
      if (prefersReducedMotion() && ghost) ghost.style.transform = tStr(clampDx(dx), clampDy(dy), 0, LIFT_SCALE);
      setOver(targetAt(lastX, lastY, el));
    }
    e.preventDefault();
  }

  async function end(e, cancel) {
    if (state !== 'lifted' && state !== 'dragging') return;
    const wasDrag = state === 'dragging';
    clearTimeout(holdTimer); holdTimer = 0;
    pressAC?.abort(); pressAC = null;
    try { if (el.hasPointerCapture?.(info.pid)) el.releasePointerCapture(info.pid); } catch {}
    cancelAnimationFrame(raf); raf = 0;
    info.lastEv = performance.now();
    if (!wasDrag) {
      // a tap (short press, < 8 px): toggle the pick state
      setState('idle');
      if (cancel) return;
      if (info.wasPicked) clearPicked();
      else { setPicked(el); play('pickup'); try { onPick?.(el); } catch {} }
      return;
    }
    const x = e && Number.isFinite(e.clientX) ? e.clientX : lastX;
    const y = e && Number.isFinite(e.clientY) ? e.clientY : lastY;
    const target = cancel || !el.isConnected ? null : targetAt(x, y, el);
    setOver(null);
    setState('dropping'); info.dropAt = performance.now();
    // hand the exact on-screen position from the ghost to the real element
    el.style.transform = 'none';
    const rr = el.getBoundingClientRect();
    const adjX = baseL - rr.left, adjY = baseT - rr.top;
    const shown = tStr(clampDx(px) + adjX, clampDy(py) + adjY, 0, prefersReducedMotion() ? LIFT_SCALE : sc);
    el.style.transform = prefersReducedMotion() ? 'none' : shown;
    el.style.opacity = '';
    ghost?.remove(); ghost = null;
    el.style.willChange = '';
    el.classList.remove('is-dragging', 'is-lifted');
    const point = { x, y };
    const fromParent = el.parentElement;
    el._landed = false; el._landedByDrag = true;
    try {
      if (target && onDrop) await onDrop(el, target, point);
      else if (onDrop) onDrop(el, null, point);
    } catch (err) { console.warn('onDrop failed', err); }
    el._landedByDrag = false;
    if (state !== 'dropping') return; // reset() ran meanwhile (question changed etc.)
    if (!el.isConnected) { reset(false); return; }
    const reparented = el.parentElement !== fromParent;
    if (reparented) {
      if (!el._landed) landFallback(el);
      el.style.transform = ''; el.style.transition = ''; el.style.animation = '';
      callHook('onDrop', el, target, { ...point, from: fromParent, to: el.parentElement });
    } else {
      const droppedBack = !!(target && target.contains(el));
      el.style.animation = '';
      springBack(el, shown);
      if (!droppedBack) { play('reject'); callHook('onReject', el, target, point); }
    }
    setState('idle');
  }

  el.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;                 // second finger / palm: ignore
    if (state === 'dropping') return;         // landing in progress
    if (state !== 'idle') reset(true);        // a stale gesture (its pointer was lost): start clean
    if (!canDrag(el)) return;
    e.preventDefault();
    info.wasPicked = picked === el;
    clearPicked();
    pressAC?.abort();
    pressAC = new AbortController();
    const sig = { signal: pressAC.signal };
    info.pid = e.pointerId; info.lastEv = performance.now();
    startX = lastX = e.clientX; startY = lastY = e.clientY; dx = dy = 0; startT = performance.now();
    setState('lifted');
    try { el.setPointerCapture(e.pointerId); } catch {}
    el.addEventListener('pointermove', onMove, sig);
    el.addEventListener('pointerup', (ev) => { if (ev.pointerId === info.pid) end(ev, false); }, sig);
    el.addEventListener('pointercancel', (ev) => { if (ev.pointerId === info.pid) end(ev, true); }, sig);
    el.addEventListener('lostpointercapture', (ev) => { if (ev.pointerId === info.pid && (state === 'lifted' || state === 'dragging')) end(ev, true); }, sig);
    holdTimer = setTimeout(() => { if (state === 'lifted') startDrag(); }, TAP_MS);
  }, { signal: life.signal });

  el._dragOnDrop = onDrop;
  return el;
}

/** Remove a draggable's listeners and any drag state. */
export function destroyDraggable(el) {
  if (!el) return;
  try { el._dragReset?.(false); } catch {}
  el._dragAbort?.abort();
  el._dragAbort = null; el._dragReset = null; el._dragOnDrop = null;
  registry.delete(el); active.delete(el);
  delete el.dataset.dragState;
}

/** Reset every drag in flight (call on question change). Also prunes detached draggables. */
export function resetAllDrags() {
  for (const el of [...active]) { try { el._dragReset?.(true); } catch {} }
  for (const el of [...registry]) if (!el.isConnected) destroyDraggable(el);
  clearPicked();
  document.querySelectorAll('.drag-ghost').forEach((g) => g.remove());
  document.querySelectorAll('.is-over').forEach((z) => z.classList.remove('is-over'));
}

/* ---------- tap-to-pick ---------- */

function setPicked(el) {
  clearPicked();
  picked = el; pickedAt = performance.now();
  el.classList.add('is-picked');
  pickTimer = setTimeout(clearPicked, PICK_EXPIRE);
}
export function clearPicked() {
  clearTimeout(pickTimer); pickTimer = 0;
  if (picked) { picked.classList.remove('is-picked'); picked = null; }
}
// any press on any item ends a pending pick
document.addEventListener('pointerdown', (e) => { const it = e.target instanceof Element ? e.target.closest('.item') : null; if (picked && it && it !== picked) clearPicked(); }, true);

/** Make a drop target that also accepts a tapped (picked) item. */
export function makeDropTarget(el, id) {
  el.dataset.drop = id ?? el.dataset.drop ?? '';
  el.addEventListener('pointerup', async (e) => {
    if (!picked || !picked.isConnected) return;
    if (performance.now() - pickedAt < 40 || (e.target instanceof Element && e.target.closest('.item') === picked)) return;
    const item = picked;
    clearPicked();
    if (item._dragOnDrop) {
      const fromParent = item.parentElement;
      const pt = { x: e.clientX, y: e.clientY };
      item._landed = false; item._landedByDrag = true;
      try { await item._dragOnDrop(item, el, pt); } catch (err) { console.warn('onDrop failed', err); }
      item._landedByDrag = false;
      if (item.parentElement !== fromParent) {
        if (!item._landed) landFallback(item);
        callHook('onDrop', item, el, { ...pt, from: fromParent, to: item.parentElement, viaTap: true });
      } else { play('reject'); callHook('onReject', item, el, { ...pt, viaTap: true }); }
    }
    item.style.transform = '';
  });
  return el;
}

/* ---------- landing + spring-back ---------- */

function pulse(zone) {
  if (!zone) return;
  zone.classList.remove('did-receive');
  void zone.offsetWidth;
  zone.classList.add('did-receive');
  clearTimeout(zone._pulseT);
  zone._pulseT = setTimeout(() => zone.classList.remove('did-receive'), 400);
}

// flipMove (ui.js) fires 'flip:land' at the squash moment: thump + pulse the zone.
document.addEventListener('flip:land', (e) => {
  const el = e.target;
  if (!(el instanceof Element)) return;
  el._landed = true;
  pulse(el.parentElement?.closest('[data-drop]'));
  if (el._landedByDrag) play('snap');
});

function landFallback(el) {
  el._landed = true;
  pulse(el.parentElement?.closest('[data-drop]'));
  play('snap');
  if (prefersReducedMotion() || !el.animate) return;
  el.animate([
    { transform: 'scale(1.15)' }, { transform: 'scale(1.08, 0.92)', offset: 0.4 },
    { transform: 'scale(0.97, 1.03)', offset: 0.7 }, { transform: 'none' },
  ], { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
}

function springBack(el, from) {
  el.style.transform = '';
  if (prefersReducedMotion() || !el.animate || !from) { el.style.transition = ''; return; }
  el.style.transition = 'none';
  el._springing?.cancel();
  const a = el.animate([{ transform: from }, { transform: 'none' }], { duration: 380, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' });
  el._springing = a;
  const done = () => { if (el._springing === a) { el._springing = null; el.style.transition = ''; } };
  a.addEventListener('finish', done); a.addEventListener('cancel', done);
}

/* ---------- hit-testing (skips the dragged element and the drag layer) ---------- */

function targetAt(x, y, skip) {
  const list = document.elementsFromPoint ? document.elementsFromPoint(x, y) : [document.elementFromPoint(x, y)];
  for (const n of list) {
    if (!n || (skip && skip.contains(n)) || n.closest?.('#drag-layer')) continue;
    return n.closest('[data-drop]');
  }
  return null;
}

/* ---------- watchdog + global safety nets ---------- */

setInterval(() => {
  const now = performance.now();
  for (const el of [...active]) {
    const g = el._dg;
    if (!g) { el._dragReset?.(true); continue; }
    const dropping = el.dataset.dragState === 'dropping';
    let held = false;
    try { held = g.pid != null && !!el.hasPointerCapture?.(g.pid); } catch {}
    if (!el.isConnected) el._dragReset?.(true);
    else if (dropping && now - g.dropAt > DROP_STUCK_MS) el._dragReset?.(true);
    else if (!dropping && !held && now - g.lastEv > STALE_MS) el._dragReset?.(true);
  }
  for (const el of [...registry]) if (!el.isConnected && !active.has(el)) destroyDraggable(el);
}, WATCHDOG_MS);

const hardCancel = () => { for (const el of [...active]) { try { el._dragReset?.(true); } catch {} } };
window.addEventListener('blur', hardCancel);
window.addEventListener('pagehide', hardCancel);
window.addEventListener('resize', hardCancel);
window.addEventListener('orientationchange', hardCancel);
document.addEventListener('visibilitychange', () => { if (document.hidden) hardCancel(); });
document.addEventListener('touchcancel', hardCancel, { passive: true });

/* ---------- press feedback (delegated, installed once) ---------- */

const PRESS_SEL = 'button, .choice, .cellnum, .island, .pill, .icon-btn, .ask-pip, [data-press]';
let pressInstalled = null;

export function installPressFeedback(root = document) {
  if (pressInstalled === root) return;
  pressInstalled = root;
  const held = new Map(); // pointerId -> element
  const isDisabled = (el) => el.matches(':disabled, .is-disabled, .is-dim, [aria-disabled="true"]');
  root.addEventListener('pointerdown', (e) => {
    const t = e.target instanceof Element ? e.target : null;
    const el = t?.closest(PRESS_SEL);
    if (!el || el.closest('.item') || isDisabled(el)) return;
    held.set(e.pointerId, el);
    el.classList.remove('is-released');
    el.classList.add('is-pressed');
    play('tap');
  }, { passive: true });
  const release = (e) => {
    const el = held.get(e.pointerId);
    if (!el) return;
    held.delete(e.pointerId);
    el.classList.remove('is-pressed');
    if (prefersReducedMotion()) return;
    el.classList.remove('is-released');
    void el.offsetWidth;
    el.classList.add('is-released');
    clearTimeout(el._relT);
    el._relT = setTimeout(() => el.classList.remove('is-released'), 300);
  };
  const target = root === document ? window : root;
  ['pointerup', 'pointercancel'].forEach((t) => target.addEventListener(t, release, { passive: true, capture: true }));
  window.addEventListener('blur', () => { for (const el of held.values()) el.classList.remove('is-pressed'); held.clear(); });
}

// Block the browser's own gestures while the app is open (touchmove is always prevented outside [data-scroll],
// which also covers rubber-banding and pinch during a drag).
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (!e.target.closest('[data-scroll]')) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
