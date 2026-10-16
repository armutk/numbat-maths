// Local progress store with mastery levels + spaced review. All reads/writes wrapped in try/catch.
import { todayKey } from './ui.js';

const KEY = 'numbat-maths.v1';
const DAY = 86400000;

const blank = () => ({
  profile: { name: '', created: Date.now(), sound: true },
  skills: {},   // id -> { level, history:[], streak, total, correct, firstTry, lastSeen, due, interval }
  days: {},     // 'YYYY-MM-DD' -> { seconds, tasks, correct, quests, doneShown }
  stickers: [], // sticker ids earned
  stars: 0,
  quests: 0,
  activeQuest: null,
  completedQuestIds: [],
  log: [],      // last 200 attempts { t, skill, ok, firstTry }
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      const next = { ...blank(), ...s, profile: { ...blank().profile, ...s.profile } };
      next.activeQuest = normaliseQuest(next.activeQuest);
      next.completedQuestIds = Array.isArray(next.completedQuestIds) ? next.completedQuestIds.filter((id) => typeof id === 'string').slice(-20) : [];
      return next;
    }
  } catch {}
  return blank();
}

function normaliseQuest(q) {
  if (!q || q.v !== 1 || typeof q.id !== 'string' || !q.id || !Array.isArray(q.plan) || !q.plan.length) return null;
  if (!Number.isInteger(q.idx) || q.idx < 0 || q.idx > q.plan.length) return null;
  if (!q.plan.every((p) => p && typeof p.moduleId === 'string' && typeof p.skillId === 'string' && Number.isFinite(p.seed))) return null;
  const result = q.result && typeof q.result === 'object' ? q.result : {};
  return {
    ...q,
    mode: ['standard', 'adventure', 'story'].includes(q.mode) ? q.mode : 'standard',
    wrongs: Math.max(0, Number(q.wrongs) || 0),
    helpUsed: Math.max(0, Number(q.helpUsed) || 0),
    helpTaps: Math.max(0, Number(q.helpTaps) || 0),
    result: {
      stars: Math.max(0, Number(result.stars) || 0),
      correct: Math.max(0, Number(result.correct) || 0),
      firstTry: Math.max(0, Number(result.firstTry) || 0),
      levelUps: Array.isArray(result.levelUps) ? result.levelUps.filter((x) => x && typeof x.skillId === 'string') : [],
    },
  };
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}

export function getState() { return state; }
export function reset() { state = blank(); save(); }

export function setName(name) { state.profile.name = name.trim().slice(0, 24); save(); }
export function getName() { return state.profile.name; }

export function skill(id) {
  if (!state.skills[id]) state.skills[id] = { level: 1, history: [], streak: 0, total: 0, correct: 0, firstTry: 0, lastSeen: 0, due: 0, interval: 1 };
  return state.skills[id];
}

/** Record an attempt. `ok` = eventually right, `firstTry` = right without a wrong step. Returns {levelUp, levelDown}. */
function applyAttempt(id, ok, firstTry, maxLevel = 4) {
  const s = skill(id);
  const now = Date.now();
  s.total++;
  if (ok) s.correct++;
  if (firstTry) s.firstTry++;
  s.history.push(firstTry ? 1 : 0);
  if (s.history.length > 10) s.history.shift();
  s.streak = firstTry ? s.streak + 1 : 0;
  s.lastSeen = now;
  // spaced review: grow the interval on first-try success, shrink on struggle
  if (firstTry) s.interval = Math.min(14, Math.round(s.interval * 2));
  else s.interval = 1;
  s.due = now + s.interval * DAY;

  let levelUp = false, levelDown = false;
  const last5 = s.history.slice(-5);
  if (s.level < maxLevel && last5.length >= 5 && last5.reduce((a, b) => a + b, 0) >= 4 && s.streak >= 2) {
    s.level++; s.history = []; s.streak = 0; levelUp = true;
  } else if (s.level > 1 && s.history.length >= 4 && s.history.slice(-4).every((v) => v === 0)) {
    s.level--; s.history = []; levelDown = true;
  }
  state.log.push({ t: now, skill: id, ok, firstTry });
  if (state.log.length > 300) state.log.shift();
  const d = day();
  d.tasks++; if (firstTry) d.correct++;
  return { levelUp, levelDown, level: s.level };
}

export function recordAttempt(id, ok, firstTry, maxLevel = 4) {
  const result = applyAttempt(id, ok, firstTry, maxLevel);
  save();
  return result;
}

/** Persist one active quest. Plans contain IDs/seeds only, never DOM or task functions. */
export function beginQuest(quest) {
  const q = normaliseQuest({ ...quest, createdAt: quest.createdAt || Date.now(), updatedAt: Date.now() });
  if (!q) throw new Error('invalid quest');
  state.activeQuest = q;
  save();
  return q;
}

export function activeQuest() { return state.activeQuest; }

export function updateActiveQuest(patch = {}) {
  const q = state.activeQuest;
  if (!q || (patch.questId && patch.questId !== q.id)) return null;
  for (const k of ['wrongs', 'helpUsed', 'helpTaps']) if (patch[k] != null) q[k] = Math.max(0, Number(patch[k]) || 0);
  q.updatedAt = Date.now();
  save();
  return q;
}

/** Apply rewards, attempt counters and the next-task position in one synchronous save. */
export function completeQuestStep({ questId, index, skillId, maxLevel = 4, ok, firstTry, stars = 0 }) {
  const q = state.activeQuest;
  if (!q || q.id !== questId || index < q.idx) return { duplicate: true };
  if (index !== q.idx || index >= q.plan.length) return { duplicate: false, invalid: true };
  const rec = applyAttempt(skillId, !!ok, !!firstTry, maxLevel);
  const earned = ok ? Math.max(0, Number(stars) || 0) : 0;
  state.stars += earned;
  q.result.stars += earned;
  if (ok) q.result.correct++;
  if (firstTry) q.result.firstTry++;
  if (rec.levelUp) q.result.levelUps.push({ skillId, level: rec.level });
  q.idx++;
  q.wrongs = 0;
  q.helpUsed = 0;
  q.updatedAt = Date.now();
  save();
  return { duplicate: false, ...rec, quest: q };
}

export function finishActiveQuest() {
  const q = state.activeQuest;
  if (!q || q.idx < q.plan.length) return null;
  if (!state.completedQuestIds.includes(q.id)) {
    state.quests++;
    day().quests++;
    state.completedQuestIds.push(q.id);
    if (state.completedQuestIds.length > 20) state.completedQuestIds.shift();
  }
  state.activeQuest = null;
  save();
  return q;
}

export function clearActiveQuest() { state.activeQuest = null; save(); }

export function day(key = todayKey()) {
  if (!state.days[key]) state.days[key] = { seconds: 0, tasks: 0, correct: 0, quests: 0, doneShown: false };
  return state.days[key];
}

export function addSeconds(sec) { day().seconds += sec; if (Math.random() < 0.2) save(); }
export function addStars(n) { state.stars += n; save(); }
export function finishQuest() { state.quests++; day().quests++; save(); }

/** Weak skills: low recent accuracy with enough data. */
export function weakSkills(threshold = 0.6) {
  return Object.entries(state.skills)
    .filter(([, s]) => s.total >= 3 && s.firstTry / s.total < threshold)
    .map(([id]) => id);
}

/** Skills that are due for review (and have been seen before). Weakest-first. */
export function dueSkills() {
  const now = Date.now();
  return Object.entries(state.skills)
    .filter(([, s]) => s.total > 0 && s.due <= now)
    .sort((a, b) => a[1].firstTry / a[1].total - b[1].firstTry / b[1].total)
    .map(([id]) => id);
}

export function accuracy(id) { const s = state.skills[id]; return s && s.total ? s.firstTry / s.total : null; }

export function earnSticker(id) {
  if (state.stickers.includes(id)) return false;
  state.stickers.push(id); save(); return true;
}

export function timeTotals() {
  const now = new Date();
  const week = [];
  for (let i = 0; i < 7; i++) { const d = new Date(now); d.setDate(now.getDate() - i); week.push(todayKey(d)); }
  let today = 0, thisWeek = 0, all = 0, tasksWeek = 0, correctWeek = 0;
  for (const [k, d] of Object.entries(state.days)) {
    all += d.seconds;
    if (week.includes(k)) { thisWeek += d.seconds; tasksWeek += d.tasks; correctWeek += d.correct; }
    if (k === todayKey()) today = d.seconds;
  }
  return { today, thisWeek, all, tasksWeek, correctWeek };
}

/** Daily goal: 2 quests. */
export const DAILY_QUESTS = 2;
export function dailyDone() { return day().quests >= DAILY_QUESTS; }
