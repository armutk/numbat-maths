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
  log: [],      // last 200 attempts { t, skill, ok, firstTry }
});

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); return { ...blank(), ...s, profile: { ...blank().profile, ...s.profile } }; }
  } catch {}
  return blank();
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
export function recordAttempt(id, ok, firstTry, maxLevel = 4) {
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
  save();
  return { levelUp, levelDown, level: s.level };
}

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
