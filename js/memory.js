// Pip's memory of the learner: profile (seed + learned facts), session history, usage caps.
// Everything lives in localStorage on the device. Summaries are also POSTed to the Hermes proxy for the parent loop.
import { PROFILE_SEED, SETTINGS } from './profile-config.js';
import { todayKey } from './ui.js';

const K_PROFILE = 'pip.profile.v1';
const K_HISTORY = 'pip.history.v1';
const K_USAGE = 'pip.usage.v1';

const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ---------- profile ---------- */
export function getProfile() {
  const learned = read(K_PROFILE, { facts: [] });
  return { ...PROFILE_SEED, learned: learned.facts || [] };
}
export function setChildName(name) {
  // the app's own first-run name wins over the seed
  const p = read(K_PROFILE, { facts: [] }); p.name = name; write(K_PROFILE, p);
}
export function childName() { return read(K_PROFILE, {}).name || PROFILE_SEED.child.name; }
/** Pip learned something: kind ∈ family|pet|favourite|interest|tricky|easy|note */
export function remember(kind, text) {
  const p = read(K_PROFILE, { facts: [] });
  p.facts = p.facts || [];
  const clean = String(text || '').trim().slice(0, 140);
  if (!clean) return false;
  if (p.facts.some((f) => f.kind === kind && f.text.toLowerCase() === clean.toLowerCase())) return false;
  p.facts.push({ kind, text: clean, t: Date.now() });
  if (p.facts.length > 60) p.facts = p.facts.slice(-60);
  write(K_PROFILE, p);
  return true;
}

/* ---------- history ---------- */
export function getHistory() { return read(K_HISTORY, []); }
export function addSession(entry) {
  const h = getHistory();
  h.push({ id: `${Date.now().toString(36)}`, date: todayKey(), ...entry });
  if (h.length > 40) h.shift();
  write(K_HISTORY, h);
  return h[h.length - 1];
}
export function updateSession(id, patch) {
  const h = getHistory();
  const i = h.findIndex((s) => s.id === id);
  if (i >= 0) { h[i] = { ...h[i], ...patch }; write(K_HISTORY, h); return h[i]; }
  return null;
}

/* ---------- usage caps ---------- */
export function usageToday() {
  const u = read(K_USAGE, {});
  const d = u[todayKey()] || { seconds: 0, sessions: 0 };
  return d;
}
export function addUsage(seconds, sessionStarted = false) {
  const u = read(K_USAGE, {});
  const k = todayKey();
  u[k] = u[k] || { seconds: 0, sessions: 0 };
  u[k].seconds += seconds;
  if (sessionStarted) u[k].sessions += 1;
  for (const key of Object.keys(u)) if (key < k && Object.keys(u).length > 14) delete u[key];
  write(K_USAGE, u);
}
export function capState() {
  const d = usageToday();
  const minutesLeft = Math.max(0, SETTINGS.dailyMinutes - d.seconds / 60);
  const sessionsLeft = Math.max(0, SETTINGS.dailySessions - d.sessions);
  return { minutesLeft, sessionsLeft, blocked: minutesLeft < 1 || sessionsLeft <= 0 };
}

/* ---------- learner context for the agent ---------- */
const niceDate = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }); };
const daysAgo = (k) => Math.round((Date.now() - new Date(k).getTime()) / 86400000);

export function learnerContext() {
  const p = getProfile();
  const name = childName();
  const lines = [];
  lines.push(`Child: ${name}, ${p.child.age}, ${p.child.year}, ${p.child.city}.`);
  if (p.family.length) lines.push(`Family: ${p.family.map((f) => `${f.name} (${f.role})`).join(', ')}.`);
  if (p.pets.length) lines.push(`Pets: ${p.pets.map((x) => `${x.name} the ${x.kind}`).join(', ')}.`);
  if (p.favourites.length) lines.push(`Favourite things to share: ${p.favourites.join(', ')}.`);
  if (p.interests.length) lines.push(`Interests: ${p.interests.join(', ')}.`);
  if (p.notes) lines.push(`From her parents: ${p.notes}`);
  const byKind = {};
  for (const f of p.learned) (byKind[f.kind] = byKind[f.kind] || []).push(f.text);
  for (const [k, arr] of Object.entries(byKind)) lines.push(`You learned (${k}): ${arr.slice(-6).join('; ')}.`);
  const hist = getHistory().filter((s) => s.summary).slice(-3);
  if (!hist.length) lines.push('This is your first session together: spend the first minute getting to know her (one question at a time: who is in her family, a pet, a favourite snack or toy), then start sharing with those things.');
  else {
    lines.push('Recent sessions, newest last:');
    for (const s of hist) {
      const ago = daysAgo(s.date);
      lines.push(`- ${ago === 0 ? 'Earlier today' : ago === 1 ? 'Yesterday' : niceDate(s.date)}: ${s.summary.what_she_did} Clicked: ${s.summary.what_clicked} Tricky: ${s.summary.what_was_tricky}${s.summary.misconceptions?.length ? ` Tags: ${s.summary.misconceptions.join(', ')}.` : ''}${s.helpTaps ? ` Asked for help ${s.helpTaps} times.` : ''}`);
    }
    const last = hist[hist.length - 1];
    lines.push(`Open with a one-line callback to last time (e.g. "${last.summary.what_was_tricky ? 'Last time leftovers were tricky, let\'s try again' : 'You were a sharing champion last time'}"), then start one step easier than where she struggled.`);
  }
  const sessionsToday = usageToday().sessions;
  if (sessionsToday > 0) lines.push(`She has already had ${sessionsToday} session${sessionsToday > 1 ? 's' : ''} today; keep this one short and light.`);
  return lines.join('\n');
}

/* ---------- parent summary ---------- */
export async function saveSummary(sessionId, summary, meta = {}) {
  const entry = updateSession(sessionId, { summary, ...meta, savedAt: Date.now() });
  try {
    const body = {
      child: childName(), date: todayKey(), minutes: Math.round((meta.seconds || 0) / 60), mode: meta.mode || 'lesson',
      what_she_did: summary.what_she_did, what_clicked: summary.what_clicked, what_was_tricky: summary.what_was_tricky,
      home_activity: summary.home_activity, misconceptions: summary.misconceptions || [], help_taps: meta.helpTaps || 0, confidence: summary.confidence,
    };
    // Dev/test builds never notify a real phone: the proxy logs dry runs instead of sending.
    const dry = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) || new URLSearchParams(location.search).has('dev');
    const res = await fetch(`${SETTINGS.proxyBase}/summary`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(dry ? { 'X-Pip-Dry-Run': '1' } : {}) }, body: JSON.stringify({ ...body, dry_run: dry }) });
    const j = await res.json().catch(() => ({}));
    updateSession(sessionId, { sent: j.ok ? (j.telegram || 'sent') : 'failed' });
  } catch { updateSession(sessionId, { sent: 'offline' }); }
  return entry;
}

/** Fallback summary built from the event log when the agent did not get to save one. */
export function summaryFromLog(log, { mode = 'lesson' } = {}) {
  const problems = log.filter((e) => e.type === 'scene').length;
  const solved = log.filter((e) => e.type === 'equal').length;
  const helps = log.filter((e) => e.type === 'help').length;
  const looks = log.filter((e) => e.type === 'camera').length;
  const what = mode === 'camera'
    ? `Showed Pip real things through the camera ${looks} time${looks === 1 ? '' : 's'} and talked about sharing them.`
    : `Worked on ${problems || 'a few'} sharing problem${problems === 1 ? '' : 's'} with Pip and got ${solved} shared out evenly.`;
  return {
    what_she_did: what,
    what_clicked: solved ? 'Dealing items out one at a time until the plates matched.' : 'Getting started and talking through the problem.',
    what_was_tricky: helps >= 2 ? 'She asked Pip for help a few times, mostly when plates did not match.' : 'Nothing stood out; the session ended early.',
    home_activity: 'At a snack, share a small pile (6 to 10 pieces) between two or three people and ask "Is that fair? How many each?"',
    misconceptions: [],
    auto: true,
  };
}
