// Offline voice: pre-recorded ElevenLabs clips (assets/voice) played through the Web Audio engine.
// Replaces the old Web Speech module. Never touches speechSynthesis.
//
// say(text) resolves the text to a clip sequence:
//   exact sentence clip -> bare number -> template (slots for numbers / nouns / names ...) -> sentence split.
// Sentences that cannot be resolved stay silent (the caller shows the text); in dev they log `voice:miss`.
import { decode, playBuffer, duck, stopAll, audioContext, isUnlocked, unlockAudio, onUnlock } from './audio.js';

const EDGE = 0.06;             // seconds of silence kept at each end of every clip (see tools/gen-voice.mjs)
const NUM_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const NUM_SLOTS = new Set(['n', 'k', 'a', 'b', 'c', 'd', 'e']);
const NOUN_SLOTS = new Set(['many', 'many2', 'one']);
const ENUM_SLOTS = new Set(['tens', 'ones', 'verb', 'sticker', 'skill']);

/* ===================================================================== resolver (pure, DOM-free) */

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Lower-case, straight quotes, single spaces, no trailing sentence punctuation. */
export function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
    .replace(/…/g, '...').replace(/\s+/g, ' ').trim().replace(/[.!?]+$/g, '').trim();
}

export function splitSentences(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

function numKey(tok) {
  if (tok === 'no') return 'no';
  if (/^\d+$/.test(tok)) { const v = Number(tok); return v >= 0 && v <= 120 ? 'n' + v : null; }
  const i = NUM_WORDS.indexOf(tok);
  return i >= 0 ? 'n' + i : null;
}

const compiled = new WeakMap();
function compile(man) {
  if (compiled.has(man)) return compiled.get(man);
  const exact = new Map();
  for (const [text, key] of Object.entries(man.exact || {})) exact.set(norm(text), key);

  // nouns: normalised surface form -> file
  const nounFormMap = new Map();     // 'cookies' -> file
  const oneFormMap = new Map();
  for (const [id, forms] of Object.entries(man.nounForms || {})) {
    const files = (man.nouns || {})[id] || {};
    if (forms.one && files.one) { nounFormMap.set(norm(forms.one), files.one); oneFormMap.set(norm(forms.one), files.one); }
    if (forms.many && files.many) nounFormMap.set(norm(forms.many), files.many);
  }
  const alt = (map) => [...map.keys()].sort((x, y) => y.length - x.length).map(esc).join('|') || '(?!)';
  const enumMaps = {};
  for (const [slot, table] of Object.entries(man.slots || {})) {
    enumMaps[slot] = new Map(Object.entries(table).map(([t, key]) => [norm(t), key]));
  }
  const slotRe = {
    num: `(\\d{1,3}|no|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)`,
    many: `(${alt(nounFormMap)})`,
    one: `(${alt(oneFormMap)})`,
    name: `([^.!?]+?)`,
    list: `(\\d{1,3}(?:, \\d{1,3})+)`,
  };
  for (const slot of ENUM_SLOTS) slotRe[slot] = `(${alt(enumMaps[slot] || new Map())})`;

  const templates = [];
  for (const t of man.templates || []) {
    const parts = norm(t.pattern).split(/(\{[a-z0-9]+\})/);
    const slots = [];
    let src = '', lit = 0;
    for (const p of parts) {
      const m = /^\{([a-z0-9]+)\}$/.exec(p);
      if (!m) { src += esc(p); lit += p.length; continue; }
      const name = m[1];
      slots.push(name);
      src += NUM_SLOTS.has(name) ? slotRe.num : name === 'many2' ? slotRe.many : slotRe[name];
    }
    templates.push({ re: new RegExp('^' + src + '$'), slots, segments: t.segments, lit });
  }
  templates.sort((x, y) => y.lit - x.lit);
  const c = { exact, templates, nounFormMap, oneFormMap, enumMaps };
  compiled.set(man, c);
  return c;
}

function clipFile(man, key) {
  const nm = /^n(\d+)$/.exec(key);
  if (nm) return (man.numbers || {})[nm[1]] || null;
  const c = (man.clips || {})[key];
  return c ? c.file : null;
}

/** Expand one matched template into items [{ file, key, gap }] (gap in ms of audible silence before the item). */
function expand(man, c, tpl, caps, out, missing, gaps) {
  const val = {};
  tpl.slots.forEach((s, i) => { val[s] = caps[i + 1]; });
  let prevKind = null;
  let first = out.length === 0;
  const push = (file, key, gap, kind) => {
    if (!file) { missing.push(key); return; }
    out.push({ file, key, gap: first ? 0 : gap });
    first = false; prevKind = kind;
  };
  for (let seg of tpl.segments) {
    let attach = false;
    if (seg.startsWith('+')) { attach = true; seg = seg.slice(1); }
    const sm = /^\{([a-z0-9]+)\}$/.exec(seg);
    if (!sm) { push(clipFile(man, seg), seg, attach ? 0 : gaps.between_segments, 'lit'); continue; }
    const slot = sm[1], v = val[slot];
    if (NUM_SLOTS.has(slot)) {
      const k = numKey(v);
      push(k ? clipFile(man, k) : null, `${slot}=${v}`, attach ? 0 : gaps.between_segments, 'num');
    } else if (slot === 'many' || slot === 'many2' || slot === 'one') {
      const f = c.nounFormMap.get(v);
      push(f, `noun:${v}`, attach || prevKind === 'num' ? 0 : gaps.between_segments, 'noun');
    } else if (ENUM_SLOTS.has(slot)) {
      const key = (c.enumMaps[slot] || new Map()).get(v);
      push(key ? clipFile(man, key) : null, `${slot}:${v}`, attach || (prevKind === 'num' && (slot === 'tens' || slot === 'ones' || slot === 'verb')) ? 0 : gaps.between_segments, 'enum');
    } else if (slot === 'name') {
      const key = (man.names || {})[norm(v)];
      if (key) push(clipFile(man, key), key, gaps.between_segments, 'name');
    } else if (slot === 'list') {
      v.split(', ').forEach((t, i) => push(clipFile(man, numKey(t)), `n${t}`, i === 0 ? gaps.between_segments : gaps.list, 'num'));
    }
  }
}

/** Key of a whole-sentence recording: lower-case, straight quotes, single spaces, punctuation kept (so "." and "!" differ). */
export function sentenceKey(s) {
  return String(s ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();
}

function resolveSentence(man, c, sentence, gaps) {
  const n = norm(sentence);
  if (!n) return { items: [], missing: [] };
  // 1. a recording of this exact sentence: one file, no stitching (natural prosody)
  const whole = (man.sentences || {})[sentenceKey(sentence)];
  if (whole) return { items: [{ file: whole, key: 'sentence', gap: 0 }], missing: [], whole: true };
  const ex = c.exact.get(n);
  if (ex) { const f = clipFile(man, ex); return f ? { items: [{ file: f, key: ex, gap: 0 }], missing: [] } : { items: [], missing: [ex] }; }
  if (/^(\d{1,3}|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|no)$/.test(n)) {
    const k = numKey(n);
    const f = k && clipFile(man, k);
    return f ? { items: [{ file: f, key: k, gap: 0 }], missing: [] } : { items: [], missing: [n] };
  }
  for (const tpl of c.templates) {
    const m = tpl.re.exec(n);
    if (!m) continue;
    const items = [], missing = [];
    expand(man, c, tpl, m, items, missing, gaps);
    if (!missing.length) return { items, missing };
    // matched shape but a clip is missing: report it (do not fall through to a worse match)
    return { items: [], missing };
  }
  return { items: [], missing: [sentence.trim()] };
}

/**
 * Resolve text to a playable plan. Pure: needs only the manifest object.
 * Returns { ok, missing:[...], items:[{file,key,gap}] }  (gap = ms of audible silence before the item).
 */
export function resolve(text, manifest) {
  const gaps = Object.assign({ between_segments: 60, between_sentences: 220, list: 140 }, manifest.gaps_ms || {});
  const c = compile(manifest);
  const items = [], missing = [], stitched = [];
  const whole = resolveSentence(manifest, c, String(text ?? ''), gaps);
  if (whole.items.length) return { ok: true, missing: [], stitched: whole.whole ? [] : [String(text).trim()], items: whole.items };
  for (const s of splitSentences(text)) {
    const r = resolveSentence(manifest, c, s, gaps);
    if (r.items.length && !r.whole) stitched.push(s);
    if (r.items.length) {
      const [head, ...rest] = r.items;
      items.push({ ...head, gap: items.length ? gaps.between_sentences : 0 }, ...rest);
    }
    missing.push(...r.missing);
  }
  return { ok: missing.length === 0, missing, stitched, items };
}


/**
 * Start time (seconds from the first clip's start) for every plan item. Pure, shared with the tests.
 * Each clip carries EDGE seconds of silence at both ends, so an audible gap of g ms needs the next clip to start
 * at prevEnd + g - 2*EDGE (gap 0 therefore overlaps the two silent edges and the words run together).
 */
export function schedule(items, durOf) {
  const out = [];
  let prevStart = 0, prevEnd = 0, started = false;
  for (let i = 0; i < items.length; i++) {
    const d = durOf(i);
    if (!d) { out.push(prevEnd); continue; }
    const t = started ? Math.max(prevStart + d * 0.3, prevEnd + items[i].gap / 1000 - 2 * EDGE) : 0;
    out.push(t);
    prevStart = t; prevEnd = t + d; started = true;
  }
  return out;
}

/* ===================================================================== playback (browser) */

let manifest = null;
let manifestP = null;
const bufs = new Map();      // file -> AudioBuffer
const inflight = new Map();  // file -> Promise<AudioBuffer|null>
const listeners = new Set();
let muted = false;
let lastText = '';
let token = 0;               // bumps on every say/stop so stale utterances never play
let active = null;           // { handles, timer, finish }
let chain = Promise.resolve();

const dev = () => { try { return typeof location !== 'undefined' && /[?&]dev\b/.test(location.search); } catch { return false; } };
const emit = (on) => { for (const fn of [...listeners]) { try { fn(on); } catch {} } };
const base = () => new URL('../assets/voice/', import.meta.url);

function loadManifest() {
  if (manifest) return Promise.resolve(manifest);
  if (!manifestP) {
    manifestP = fetch(new URL('manifest.json', base())).then((r) => r.json()).then((m) => { manifest = m; return m; })
      .catch((e) => { manifestP = null; if (dev()) console.info('voice:manifest-failed', e && e.message); return null; });
  }
  return manifestP;
}

/** Test hook: supply a manifest without fetching (also used by Node checks). */
export function useManifest(m) { manifest = m; return m; }

function loadBuf(file) {
  if (bufs.has(file)) return Promise.resolve(bufs.get(file));
  if (inflight.has(file)) return inflight.get(file);
  const p = (async () => {
    try {
      const ab = await (await fetch(new URL(file, base()))).arrayBuffer();
      const b = await decode(ab);
      bufs.set(file, b);
      return b;
    } catch (e) { if (dev()) console.info('voice:load-failed', file); return null; }
    finally { inflight.delete(file); }
  })();
  inflight.set(file, p);
  return p;
}

export function voiceInfo() { return 'Pip, recorded voice'; }
export function onSpeechState(fn) { if (typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); }
export function isMuted() { return muted; }
export function setMuted(m) { muted = !!m; if (muted) stop(); }

/** Call inside a user gesture (kept for the old module's name). Unlocks audio and warms the common clips. */
export function unlockSpeech() {
  try { unlockAudio(); } catch {}
  onUnlock(() => { preload(); });
}

export function stop() {
  token++;
  const a = active;
  active = null;
  if (a) {
    clearTimeout(a.timer);
    for (const h of a.handles) { try { h.stop(); } catch {} }
    try { stopAll(); } catch {}
    try { duck(false); } catch {}
    emit(false);
    a.finish();
  }
}

export function replay() { return lastText ? say(lastText) : Promise.resolve(); }

export function say(text, { interrupt = true } = {}) {
  lastText = String(text ?? '');
  if (muted || !lastText.trim()) return Promise.resolve();
  if (interrupt) { stop(); return speak(lastText); }
  const p = chain.then(() => speak(lastText));
  chain = p.catch(() => {});
  return p;
}

async function speak(text) {
  const my = ++token;
  if (!isUnlocked()) return;                       // not unlocked yet: the caller already shows the text
  const man = await loadManifest();
  if (!man || my !== token) return;
  const plan = resolve(text, man);
  if (dev() && plan.missing.length) for (const m of plan.missing) console.info('voice:miss', m);
  if (plan.stitched && plan.stitched.length) {           // last-resort word stitching: log it so the sentence can be recorded
    try { (window.__voiceStitched = window.__voiceStitched || new Set()).add(plan.stitched.join(' | ')); } catch {}
    if (dev()) for (const m of plan.stitched) console.info('voice:stitched', m);
  }
  if (!plan.items.length) return;
  const loaded = await Promise.all(plan.items.map((it) => loadBuf(it.file)));
  if (my !== token || !isUnlocked()) return;
  const ctx = audioContext();
  if (!ctx) return;

  // schedule everything on the audio clock, gap-free
  const handles = [];
  const starts = schedule(plan.items, (i) => (loaded[i] ? loaded[i].duration : 0));
  let prevEnd = 0;
  for (let i = 0; i < plan.items.length; i++) {
    const buf = loaded[i];
    if (!buf) continue;
    const t = 0.04 + starts[i];
    handles.push(playBuffer(buf, { bus: 'voice', when: t }));
    prevEnd = Math.max(prevEnd, t + buf.duration);
  }
  if (!handles.length) return;

  return new Promise((resolveDone) => {
    const rec = { handles, timer: 0, finish: () => resolveDone() };
    active = rec;
    emit(true);
    try { duck(true); } catch {}
    rec.timer = setTimeout(() => {
      if (active !== rec) return;
      active = null;
      try { duck(false); } catch {}
      emit(false);
      resolveDone();
    }, Math.ceil((prevEnd + 0.12) * 1000));
  });
}

/** Decode the most common clips ahead of time. keys: clip keys, 'n12' number keys, or omitted for manifest.preload. */
export async function preload(keys) {
  const man = await loadManifest();
  if (!man) return;
  const list = keys && keys.length ? keys : man.preload || [];
  const files = [...new Set(list.map((k) => clipFile(man, k)).filter(Boolean))];
  let i = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < files.length) await loadBuf(files[i++]); }));
}

/** Can this text be fully spoken from the recorded clips? (needs the manifest loaded or supplied via useManifest) */
export function coverage(text) {
  if (!manifest) { loadManifest(); return { ok: false, missing: ['manifest-not-loaded'] }; }
  const r = resolve(text, manifest);
  return { ok: r.ok, missing: r.missing };
}
