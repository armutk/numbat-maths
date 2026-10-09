// Camera mode: Arisha shows Pip real things. Frames go to the Hermes proxy (Gemini vision) and are never stored.
import { h } from './ui.js';
import { SETTINGS } from './profile-config.js';

let video = null, stream = null, canvas = null, wrap = null, timer = 0, lastSig = null, busy = false;
let onDescribe = () => {};

export function isOpen() { return !!stream; }
export function onAutoDescribe(fn) { onDescribe = fn; }

export async function open(container, { auto = true } = {}) {
  if (stream) return wrap;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('no_camera');
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
  video = h('video', { class: 'cam-video', playsinline: true, autoplay: true, muted: true });
  video.setAttribute('playsinline', ''); video.muted = true; video.srcObject = stream;
  const frame = h('div', { class: 'cam-frame' }, video, h('div', { class: 'cam-corner tl' }), h('div', { class: 'cam-corner tr' }), h('div', { class: 'cam-corner bl' }), h('div', { class: 'cam-corner br' }));
  const status = h('div', { class: 'cam-status' }, 'Hold your things up so Pip can see them');
  wrap = h('div', { class: 'cam' }, frame, status);
  wrap._status = status;
  container.append(wrap);
  try { await video.play(); } catch {}
  if (auto) startAuto();
  return wrap;
}

export function close() {
  stopAuto();
  try { stream?.getTracks().forEach((t) => t.stop()); } catch {}
  stream = null; video = null;
  wrap?.remove(); wrap = null; lastSig = null;
}

export function setStatus(text) { if (wrap?._status) wrap._status.textContent = text; }

/** JPEG snapshot (max 640 px wide) as base64 without the data: prefix. */
export function snapshot() {
  if (!video || video.readyState < 2) return null;
  canvas = canvas || document.createElement('canvas');
  const scale = Math.min(1, 640 / (video.videoWidth || 640));
  canvas.width = Math.round((video.videoWidth || 640) * scale); canvas.height = Math.round((video.videoHeight || 480) * scale);
  const g = canvas.getContext('2d');
  g.drawImage(video, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', 0.72);
  return url.slice(url.indexOf(',') + 1);
}

/** cheap change detector: 8x8 grey thumbnail signature */
function signature() {
  if (!video || video.readyState < 2) return null;
  const c = document.createElement('canvas'); c.width = 8; c.height = 8;
  const g = c.getContext('2d'); g.drawImage(video, 0, 0, 8, 8);
  const d = g.getImageData(0, 0, 8, 8).data; const out = [];
  for (let i = 0; i < d.length; i += 4) out.push((d[i] + d[i + 1] + d[i + 2]) / 3);
  return out;
}
const diff = (a, b) => { if (!a || !b) return 1; let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / (a.length * 255); };

/** Ask the proxy what is in front of the camera. */
export async function describe({ hint = '', child = '' } = {}) {
  const image = snapshot();
  if (!image) return { ok: false, error: 'no_frame' };
  busy = true; setStatus('Pip is looking...');
  try {
    const ctrl = new AbortController(); const to = setTimeout(() => ctrl.abort(), 22000);
    const res = await fetch(`${SETTINGS.proxyBase}/see`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, hint, child }), signal: ctrl.signal });
    clearTimeout(to);
    const j = await res.json();
    if (j.ok) setStatus(j.total ? `Pip sees ${j.total} thing${j.total === 1 ? '' : 's'}` : 'Pip can\'t see anything to count yet');
    else setStatus('Pip couldn\'t see that time. Try again.');
    return j;
  } catch (e) {
    setStatus('Pip couldn\'t see that time. Try again.');
    return { ok: false, error: 'vision_unavailable' };
  } finally { busy = false; }
}

function startAuto() {
  stopAuto();
  timer = setInterval(async () => {
    if (!stream || busy || document.hidden) return;
    const sig = signature();
    if (diff(sig, lastSig) < 0.06) return; // nothing changed
    lastSig = sig;
    const r = await describe();
    if (r.ok && r.total > 0) onDescribe(r);
  }, SETTINGS.cameraSnapshotSeconds * 1000);
}
function stopAuto() { clearInterval(timer); timer = 0; }
