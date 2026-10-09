// Audio engine: one shared AudioContext, three buses, sample-based SFX (Kenney CC0, assets/sfx).
// Voice (Pip / pre-recorded clips) and SFX are separate buses; only SFX is ever ducked or muted.
let ctx = null;
let unlocked = false;
let sfxOn = true;
const waiters = [];
const bufs = {};
let loading = null;

export const buses = { master: null, voice: null, sfx: null };
const voiceSources = new Set();

function wire() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  buses.master = ctx.createGain(); buses.master.gain.value = 1.0;
  buses.voice = ctx.createGain(); buses.voice.gain.value = 1.0;
  buses.sfx = ctx.createGain(); buses.sfx.gain.value = 0.7;
  buses.voice.connect(buses.master); buses.sfx.connect(buses.master); buses.master.connect(ctx.destination);
  ctx.addEventListener?.('statechange', () => {
    if (ctx.state === 'running') flush();
    else if (unlocked && (ctx.state === 'suspended' || ctx.state === 'interrupted')) resume();
  });
  return true;
}

function flush() {
  if (!unlocked) { unlocked = true; }
  while (waiters.length) { try { waiters.shift()(); } catch {} }
}

function resume() {
  if (!ctx) return;
  try { const p = ctx.resume(); p && p.catch && p.catch(() => {}); } catch {}
}

export function unlockAudio() {
  try {
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch {}
    if (!wire()) return;
    // resume inside the gesture, then a silent 1-sample kick (iOS)
    if (ctx.state !== 'running') resume();
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
    unlocked = true;
    if (ctx.state === 'running') flush();
    else { const t = setInterval(() => { if (ctx.state === 'running') { clearInterval(t); flush(); } }, 50); setTimeout(() => clearInterval(t), 5000); }
  } catch {}
}

const wake = () => { if (unlocked && ctx && ctx.state !== 'running') resume(); };
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
  window.addEventListener('pageshow', wake);
  window.addEventListener('focus', wake);
}

export function audioContext() { return ctx; }
export function isUnlocked() { return unlocked && !!ctx && ctx.state === 'running'; }
export function onUnlock(fn) { if (isUnlocked()) { try { fn(); } catch {} } else waiters.push(fn); }
export function setSound(on) { sfxOn = !!on; }
export function soundOn() { return sfxOn; }

export function decode(arrayBuffer) {
  return new Promise((resolve, reject) => {
    if (!wire()) return reject(new Error('no WebAudio'));
    try {
      const p = ctx.decodeAudioData(arrayBuffer, resolve, reject); // Safari: callback form
      if (p && p.then) p.then(resolve, reject);
    } catch (e) { reject(e); }
  });
}

export function playBuffer(buf, { bus = 'sfx', gain = 1, when = 0, rate = 1 } = {}) {
  if (!ctx || !buf) return { source: null, stop() {} };
  try {
    const source = ctx.createBufferSource();
    source.buffer = buf; source.playbackRate.value = rate;
    let out = source;
    if (gain !== 1) { const g = ctx.createGain(); g.gain.value = gain; source.connect(g); out = g; }
    out.connect(buses[bus] || buses.sfx);
    const isVoice = bus === 'voice';
    if (isVoice) { voiceSources.add(source); source.onended = () => voiceSources.delete(source); }
    source.start(ctx.currentTime + Math.max(0, when));
    return { source, stop() { try { source.stop(); } catch {} voiceSources.delete(source); } };
  } catch { return { source: null, stop() {} }; }
}

export function stopAll() { for (const s of [...voiceSources]) { try { s.stop(); } catch {} } voiceSources.clear(); }

export function duck(on) {
  if (!ctx) return;
  const g = buses.sfx.gain, t = ctx.currentTime;
  try {
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(on ? 0.35 : 0.7, t + (on ? 0.06 : 0.25));
  } catch {}
}

export function preloadSfx() {
  if (loading) return loading;
  loading = (async () => {
    try {
      if (!wire()) return;
      const man = await (await fetch(new URL('../assets/sfx/manifest.json', import.meta.url))).json();
      await Promise.all(Object.entries(man).map(async ([name, v]) => {
        try {
          const file = typeof v === 'string' ? v : v.file;
          const ab = await (await fetch(new URL('../assets/sfx/' + file, import.meta.url))).arrayBuffer();
          bufs[name] = await decode(ab);
        } catch { /* leave missing; sfx stays silent */ }
      }));
    } catch {}
  })();
  return loading;
}

function play(name, opts) {
  if (!sfxOn || !ctx || !unlocked || !bufs[name]) return;
  playBuffer(bufs[name], opts);
}
const mk = (name, opts) => () => { try { play(name, opts); } catch {} };

export const sfx = {
  tap: mk('tap'), pickup: mk('pickup'), drag: mk('drag'), drop: mk('drop'), snap: mk('snap'), reject: mk('reject'),
  tick(i = 0) { try { play('tick', { rate: 2 ** ((Math.max(0, Math.floor(i)) % 8) / 12) }); } catch {} },
  correct: mk('correct'), wrong: mk('wrong'), hint: mk('hint'), complete: mk('complete'), sticker: mk('sticker'),
  celebrate: mk('celebrate'), whoosh: mk('whoosh'), pop: mk('pop'), ding: mk('ding'),
};
sfx.pick = sfx.pickup; sfx.success = sfx.complete; sfx.fanfare = sfx.celebrate;
