// Pointer-events drag and drop that feels native on iPad.
// - touch-action:none on draggables, pointer capture, transform-based movement
// - drop targets are elements with [data-drop]; nearest target under the pointer wins
// - tap-to-pick / tap-to-place fallback for kids who prefer tapping
import { sfx } from './audio.js';

let picked = null; // element picked by tap (not drag)

/**
 * makeDraggable(el, { canDrag(el) -> bool, onDrop(el, target|null, point) -> Promise|void })
 * `onDrop` is responsible for re-parenting (use flipMove) or leaving the element where it was.
 */
export function makeDraggable(el, { canDrag = () => true, onDrop, onPick } = {}) {
  el.classList.add('item');
  el.style.touchAction = 'none';
  let active = false, moved = false, startX = 0, startY = 0, dx = 0, dy = 0, pid = null;

  const move = (e) => {
    if (!active || e.pointerId !== pid) return;
    dx = e.clientX - startX; dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 6) {
      moved = true;
      el.classList.add('is-dragging');
      el.style.pointerEvents = 'none';
      sfx.pick();
      if (picked && picked !== el) { picked.classList.remove('is-picked'); picked = null; }
    }
    if (moved) {
      el.style.transform = `translate3d(${dx}px, ${dy}px, 0) scale(1.15)`;
      highlight(targetAt(e.clientX, e.clientY));
    }
    e.preventDefault();
  };

  const finish = async (e) => {
    if (!active || e.pointerId !== pid) return;
    active = false;
    try { el.releasePointerCapture(pid); } catch {}
    el.removeEventListener('pointermove', move);
    el.removeEventListener('pointerup', finish);
    el.removeEventListener('pointercancel', finish);
    highlight(null);
    if (moved) {
      // hit-test while the dragged element still ignores pointer events, so it can't shadow the target
      const target = e.type === 'pointercancel' ? null : targetAt(e.clientX, e.clientY);
      el.style.pointerEvents = '';
      el.classList.remove('is-dragging');
      if (target && onDrop) {
        // keep the visual position until onDrop re-parents (flipMove reads the rect)
        await onDrop(el, target, { x: e.clientX, y: e.clientY });
        el.style.transform = '';
      } else {
        el.classList.add('is-settling');
        el.style.transform = '';
        setTimeout(() => el.classList.remove('is-settling'), 380);
        if (onDrop) onDrop(el, null, { x: e.clientX, y: e.clientY });
      }
    } else {
      el.style.pointerEvents = '';
      // tap: toggle pick state
      if (picked === el) { picked.classList.remove('is-picked'); picked = null; }
      else {
        if (picked) picked.classList.remove('is-picked');
        picked = el; el.classList.add('is-picked'); sfx.pick();
        if (onPick) onPick(el);
      }
    }
  };

  el.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || !canDrag(el)) return;
    e.preventDefault();
    active = true; moved = false; pid = e.pointerId;
    startX = e.clientX; startY = e.clientY;
    try { el.setPointerCapture(pid); } catch {}
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', finish);
    el.addEventListener('pointercancel', finish);
  });
  el._dragOnDrop = onDrop;
  return el;
}

/** Make a drop target that also accepts a tapped (picked) item. */
export function makeDropTarget(el, id) {
  el.dataset.drop = id ?? el.dataset.drop ?? '';
  el.addEventListener('pointerup', async (e) => {
    if (!picked) return;
    const item = picked;
    picked.classList.remove('is-picked'); picked = null;
    if (item._dragOnDrop) await item._dragOnDrop(item, el, { x: e.clientX, y: e.clientY });
    item.style.transform = '';
  });
  return el;
}

export function clearPicked() { if (picked) { picked.classList.remove('is-picked'); picked = null; } }

let lastHi = null;
function highlight(t) {
  if (lastHi && lastHi !== t) lastHi.classList.remove('is-over');
  if (t) t.classList.add('is-over');
  lastHi = t;
}

function targetAt(x, y) {
  const el = document.elementFromPoint(x, y);
  return el ? el.closest('[data-drop]') : null;
}

// Block the browser's own gestures while the app is open.
['gesturestart', 'gesturechange', 'gestureend'].forEach((t) => document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
document.addEventListener('touchmove', (e) => { if (!e.target.closest('[data-scroll]')) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
document.addEventListener('contextmenu', (e) => { if (!e.target.closest('input')) e.preventDefault(); });
