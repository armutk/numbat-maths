// Pip, the live tutor: an ElevenLabs Conversational AI session wired to the whiteboard, the camera and memory.
// The agent speaks and listens; it acts on the screen through client tools; the app reports what Arisha does.
import { Conversation } from './vendor/elevenlabs-client.mjs';
import { SETTINGS } from './profile-config.js';
import * as mem from './memory.js';
import * as camera from './camera.js';
import { unlockAudio, duck, audioContext } from './audio.js';
import { todayKey } from './ui.js';

const DEV = new URLSearchParams(location.search).has('dev') || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
const log = (...a) => { if (DEV) console.info('[pip]', ...a); };

let conv = null;
let board = null;
let ui = {};                 // callbacks from the app: onStatus(status), onMode(mode: 'speaking'|'listening'), onTranscript({role,text}), onCamera(open), onEnd(reason), onError(e)
let session = null;          // { id, startedAt, mode, log:[], helpTaps, problems, seconds, textOnly }
let idleTimer = 0, tickTimer = 0;
let lastSpokeAt = 0, lastMoveAt = 0;
let moveBuffer = [], moveFlush = 0;
let wrongStreak = 0;
let micMode = 'mic';         // 'mic' | 'silent' (no permission: Pip talks, cannot hear)

export const state = () => ({ live: !!conv, session, micMode });
export function isLive() { return !!conv; }
export function attachBoard(b) {
  if (board) { board.off?.('move', onMove); board.off?.('answer', onAnswer); board.off?.('reject', onReject); }
  board = b;
  if (!board) return;
  board.on?.('move', onMove);
  board.on?.('answer', onAnswer);
  board.on?.('reject', onReject);
}
export function setUI(handlers) { ui = { ...ui, ...handlers }; }

/* ---------- group name <-> id mapping ---------- */
const norm = (s) => String(s || '').trim().toLowerCase().replace(/^group:/, '');
function groupId(nameOrId) {
  const st = board?.getState?.();
  const n = norm(nameOrId);
  if (!st) return nameOrId;
  if (n === 'bowl' || n === 'leftovers' || n === "pip's bowl") return 'leftovers';
  const g = st.groups.find((x) => norm(x.id) === n) || st.groups.find((x) => norm(x.name) === n) || st.groups.find((x) => norm(x.role) === n);
  return g ? g.id : nameOrId;
}
const slug = (s, i) => (norm(s).replace(/[^a-z0-9]+/g, '-') || `g${i}`);

/* ---------- client tools (what Pip can do on the screen) ---------- */
function toolResult(ok, extra = {}) { return JSON.stringify({ ok, ...extra }); }
const clientTools = {
  async set_scene({ item_kind, count, groups = [], leftovers, title }) {
    if (!board) return toolResult(false, { error: 'no board' });
    count = Math.max(1, Math.min(120, Number(count) || 6));
    const gs = (Array.isArray(groups) && groups.length ? groups : [{ name: mem.childName(), role: 'child' }, { name: 'Mum', role: 'mum' }]).slice(0, 6)
      .map((g, i) => ({ id: slug(g.name, i), name: String(g.name || `Friend ${i + 1}`).slice(0, 14), role: g.role || 'friend' }));
    const left = typeof leftovers === 'boolean' ? leftovers : (gs.length > 1 && count % gs.length !== 0);
    await board.setScene({ kind: 'share', items: { kind: String(item_kind || 'cookie').toLowerCase().replace(/\s+/g, ''), count }, groups: gs, leftovers: left, title });
    session && session.log.push({ t: Date.now(), type: 'scene', count, groups: gs.length, kind: item_kind });
    session && (session.problems += 1);
    wrongStreak = 0;
    armIdle();
    return toolResult(true, { state: board.describe() });
  },
  async spawn_items({ kind, count, to_group }) { await board?.spawnItems(String(kind || 'cookie').toLowerCase(), Math.max(1, Math.min(60, Number(count) || 1)), { toGroup: to_group ? groupId(to_group) : undefined }); return toolResult(true, { state: board?.describe() }); },
  async show_number_line({ from = 0, to = 20, mark }) { await board?.showNumberLine({ from: Number(from), to: Number(to), mark: mark == null ? undefined : Number(mark) }); return toolResult(true); },
  async show_chart_120({ highlight = [], hide_from }) { await board?.showChart120({ highlight: (highlight || []).map(Number), hideFrom: hide_from == null ? undefined : Number(hide_from) }); return toolResult(true); },
  async show_ten_frame({ filled = 0, second }) { await board?.showTenFrame({ filled: Number(filled), second: second == null ? undefined : Number(second) }); return toolResult(true); },
  async show_choices({ options = [], prompt }) { await board?.showChoices((options || []).map(Number).slice(0, 4), { prompt }); return toolResult(true); },
  async show_keypad({ max = 120 }) { await board?.showKeypad({ max: Number(max) || 120 }); return toolResult(true); },
  async highlight({ target }) {
    let t = String(target || '');
    if (/^group:/i.test(t)) t = `group:${groupId(t)}`;
    else if (/^(bowl|leftovers)$/i.test(t)) t = 'leftovers';
    await board?.highlight(t);
    return toolResult(true);
  },
  async demonstrate_move({ from = 'tray', to, count = 1 }) {
    const f = /^tray$/i.test(from) ? 'tray' : /^(bowl|leftovers)$/i.test(from) ? 'leftovers' : `group:${groupId(from)}`;
    const t = /^all-groups$/i.test(to) ? 'all-groups' : /^tray$/i.test(to) ? 'tray' : /^(bowl|leftovers)$/i.test(to) ? 'leftovers' : `group:${groupId(to)}`;
    await board?.demonstrateMove({ from: f, to: t, count: Math.max(1, Math.min(20, Number(count) || 1)) });
    session && session.log.push({ t: Date.now(), type: 'demo', from: f, to: t });
    return toolResult(true, { state: board?.describe() });
  },
  async show_counts({ on = true }) { await board?.showCounts(!!on); return toolResult(true); },
  async celebrate({ level = 'small' }) { await board?.celebrate(level === 'big' ? 'big' : 'small'); return toolResult(true); },
  async clear_board() { await board?.clear(); return toolResult(true); },
  async get_board_state() { return toolResult(true, { state: board?.describe?.() || 'empty board', detail: board?.getState?.() }); },
  async open_camera() { try { await ui.onCamera?.(true); return toolResult(true); } catch (e) { return toolResult(false, { error: String(e?.message || e) }); } },
  async close_camera() { await ui.onCamera?.(false); return toolResult(true); },
  async look_through_camera({ hint } = {}) {
    if (!camera.isOpen()) { try { await ui.onCamera?.(true); } catch (e) { return toolResult(false, { error: 'camera_unavailable' }); } }
    const r = await camera.describe({ hint, child: mem.childName() });
    session && session.log.push({ t: Date.now(), type: 'camera', total: r.total, ok: r.ok });
    if (!r.ok) return toolResult(false, { error: r.error || 'could_not_see', advice: 'Ask her to hold the things still and spread them out, then look again.' });
    return toolResult(true, { total: r.total, objects: r.objects, description: r.description });
  },
  async remember({ kind, text }) { const added = mem.remember(kind, text); return toolResult(true, { added }); },
  async save_session_summary(summary) {
    if (!session) return toolResult(false);
    session.summarySaved = true;
    await mem.saveSummary(session.id, { ...summary, misconceptions: summary.misconceptions || [] }, { seconds: elapsed(), helpTaps: session.helpTaps, mode: session.mode });
    return toolResult(true);
  },
  async end_session({ reason } = {}) { setTimeout(() => stop(reason || 'done'), 1200); return toolResult(true); },
};

/* ---------- board events -> agent ---------- */
function onMove(e) {
  lastMoveAt = Date.now();
  armIdle();
  conv?.sendUserActivity?.();
  moveBuffer.push(e);
  clearTimeout(moveFlush);
  moveFlush = setTimeout(flushMoves, 700);
}
function flushMoves() {
  if (!conv || !moveBuffer.length) return;
  const n = moveBuffer.length;
  const last = moveBuffer[moveBuffer.length - 1];
  moveBuffer = [];
  const desc = board?.describe?.() || '';
  const st = board?.getState?.();
  const text = `[APP] ${n === 1 ? `Moved one ${last.item?.kind || 'item'} from ${label(last.from)} to ${label(last.to)}.` : `Moved ${n} items; last one to ${label(last.to)}.`} Now: ${desc}`;
  session?.log.push({ t: Date.now(), type: 'move', n, to: last.to });
  if (st && st.tray === 0 && st.scene === 'share') {
    // tray empty: this is a natural checkpoint, Pip should respond
    if (st.equal) session?.log.push({ t: Date.now(), type: 'equal' });
    conv.sendUserMessage(`${text} The tray is empty. ${st.equal ? 'All plates have the same number.' : 'The plates are NOT equal yet.'} React to how she did it, and ask her how many each one has.`);
    if (!st.equal) wrongStreak += 1; else wrongStreak = 0;
    if (wrongStreak >= SETTINGS.stuckWrongTries) { session?.log.push({ t: Date.now(), type: 'stuck' }); }
  } else {
    conv.sendContextualUpdate(text);
  }
}
const label = (x) => { const k = String(x || '').replace(/^group:/, ''); if (k === 'tray') return 'the tray'; if (k === 'bowl' || k === 'leftovers') return "Pip's bowl"; const g = board?.getState?.()?.groups?.find((q) => q.id === k); return `${g ? g.name : k}'s plate`; };
function onAnswer(e) {
  armIdle();
  session?.log.push({ t: Date.now(), type: 'answer', value: e.value });
  conv?.sendUserMessage(`[APP] She tapped the number ${e.value}${e.prompt ? ` for "${e.prompt}"` : ''}. Board: ${board?.describe?.() || ''}`);
}
function onReject() { conv?.sendUserActivity?.(); }

/* ---------- idle / help ---------- */
function armIdle() {
  clearTimeout(idleTimer);
  if (!conv) return;
  idleTimer = setTimeout(() => {
    if (!conv || document.hidden) return;
    if (conv.isSpeaking?.()) { armIdle(); return; }
    if (Date.now() - lastSpokeAt < 8000) { armIdle(); return; }
    session?.log.push({ t: Date.now(), type: 'idle' });
    conv.sendUserMessage(`[APP] Nothing has happened for ${SETTINGS.idleNudgeSeconds} seconds. Board: ${board?.describe?.() || 'empty'}. Check in gently with one small question or offer to do one together.`);
  }, SETTINGS.idleNudgeSeconds * 1000);
}
/** The big Ask Pip button. */
export function askForHelp(context = '') {
  if (session) session.helpTaps += 1;
  session?.log.push({ t: Date.now(), type: 'help' });
  if (!conv) return false;
  const st = board?.getState?.();
  const recent = (st?.moves || []).slice(-5).map((m) => `${label(m.from)}→${label(m.to)}`).join(', ');
  conv.sendUserMessage(`[APP] She tapped the Ask Pip button: she is confused or stuck right now. ${context} Board: ${board?.describe?.() || 'empty'}. Her last moves: ${recent || 'none yet'}. Help taps this session: ${session?.helpTaps}. Respond first with ONE guiding question or ONE tiny demonstration from exactly where she is; do not give the answer.`);
  armIdle();
  return true;
}
/** Generic app event (screen change, check pressed in offline modules, camera seen, etc.) */
export function event(type, payload = {}) {
  if (!conv) return;
  switch (type) {
    case 'camera-seen':
      session?.log.push({ t: Date.now(), type: 'camera', total: payload.total, ok: true });
      conv.sendUserMessage(`[APP] Through the camera you can now see: ${payload.description} (${(payload.objects || []).map((o) => `${o.count} ${o.name}`).join(', ') || 'nothing countable'}). Count them with her, then make it a sharing problem with her family.`);
      break;
    case 'camera-opened': conv.sendContextualUpdate('[APP] Camera mode is open. She can hold real things up to the iPad.'); break;
    case 'camera-closed': conv.sendContextualUpdate('[APP] Camera mode closed; back to the whiteboard.'); break;
    case 'time-warning': conv.sendUserMessage('[APP] About two minutes left in this session. Finish this problem, then do your warm wrap-up, call save_session_summary and end_session.'); break;
    default: conv.sendContextualUpdate(`[APP] ${type}: ${JSON.stringify(payload)}`);
  }
}

/* ---------- session lifecycle ---------- */
function afterGreeting() {
  if (!session || session.greeted || !conv) return;
  session.greeted = true;
  if (session.mode === 'camera') return;
  setTimeout(() => { if (conv && session && session.problems === 0) conv.sendUserMessage('[APP] Now set up the first problem with set_scene (pick the step from her history), say it in one sentence, and ask her to have a go.'); }, 1200);
}

function elapsed() { return session ? Math.round((Date.now() - session.startedAt) / 1000) : 0; }

async function silentMicStream() {
  // No microphone permission: give the SDK a silent track so Pip can still talk from app events.
  const ctx = audioContext();
  if (!ctx) throw new Error('no audio context');
  const dest = ctx.createMediaStreamDestination();
  const osc = ctx.createOscillator(); const g = ctx.createGain(); g.gain.value = 0; osc.connect(g); g.connect(dest); osc.start();
  return dest.stream;
}

/**
 * start({ mode:'lesson'|'camera', textOnly:false }) -> resolves when connected.
 * Rejects with Error('cap') when the daily cap is used up, Error('offline') when there is no network, or the SDK error.
 */
export async function start({ mode = 'lesson', textOnly = false } = {}) {
  if (conv) return conv;
  if (!navigator.onLine) throw new Error('offline');
  const cap = mem.capState();
  if (cap.blocked) throw new Error('cap');
  unlockAudio();
  micMode = 'mic';
  if (!textOnly) {
    try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach((t) => t.stop()); }
    catch { micMode = 'silent'; }
  }
  if (micMode === 'silent' && navigator.mediaDevices) {
    const orig = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (c) => { if (c && c.audio && !c.video) { try { return await orig(c); } catch { return silentMicStream(); } } return orig(c); };
  }
  const entry = mem.addSession({ mode, startedAt: Date.now(), helpTaps: 0 });
  session = { id: entry.id, startedAt: Date.now(), mode, log: [], helpTaps: 0, problems: 0, textOnly };
  mem.addUsage(0, true);
  ui.onStatus?.('connecting');
  const dyn = { child_name: mem.childName(), learner_context: mem.learnerContext(), session_mode: mode, today: new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' }) };
  log('dynamic variables', dyn);
  const opts = {
    agentId: SETTINGS.agentId,
    connectionType: 'websocket',
    clientTools,
    dynamicVariables: dyn,
    overrides: textOnly ? { conversation: { textOnly: true } } : undefined,
    textOnly: textOnly || undefined,
    onConnect: () => { ui.onStatus?.('live'); log('connected', conv?.getId?.()); },
    onDisconnect: (d) => { log('disconnected', d); const reason = d?.reason || 'disconnected'; cleanup(reason); },
    onError: (e, ctx) => { log('error', e, ctx); ui.onError?.(e); },
    onModeChange: ({ mode: m }) => { if (m === 'speaking') { lastSpokeAt = Date.now(); duck(true); } else duck(false); ui.onMode?.(m); },
    onStatusChange: ({ status }) => { if (status === 'connected') ui.onStatus?.('live'); },
    onMessage: ({ message, source }) => { if (source === 'ai') { lastSpokeAt = Date.now(); afterGreeting(); } ui.onTranscript?.({ role: source === 'ai' ? 'pip' : 'child', text: message }); session?.log.push({ t: Date.now(), type: source === 'ai' ? 'pip' : 'child', text: String(message).slice(0, 200) }); },
    onUnhandledClientToolCall: (c) => log('unhandled tool', c),
    onDebug: (d) => { if (DEV && d?.type === 'client_tool_call') log('tool', d); },
  };
  try {
    conv = await Conversation.startSession(opts);
  } catch (e) {
    session = null; ui.onStatus?.('failed'); throw e;
  }
  window.__pipConv = DEV ? conv : undefined;
  // opening move: the app tells Pip where we are; she speaks first
  // Two-step opener: Pip greets first (speech only, no tools), then the app asks her to build the first problem.
  const opener = mode === 'camera'
    ? `[APP] Session started in CAMERA mode (she tapped "Show Pip something"). Greet her in one short sentence and ask her to hold her things up to the iPad so you can see them. Do not call any tools yet.`
    : `[APP] Session started (lesson mode). ${board?.getState?.()?.scene && board.getState().scene !== 'empty' ? `The board already shows: ${board.describe()}.` : 'The whiteboard is empty.'} Greet her warmly in one or two short sentences (use the callback from memory if there is one). Do not call any tools yet; the app will tell you when to set up the first problem.`;
  session.greeted = false;
  conv.sendUserMessage(opener);
  armIdle();
  tickTimer = setInterval(() => {
    if (!session) return;
    if (!document.hidden) { session.seconds = elapsed(); mem.addUsage(5); }
    const left = SETTINGS.sessionMinutes * 60 - elapsed();
    if (left <= 120 && !session.warned) { session.warned = true; event('time-warning'); }
    if (left <= 0) stop('time_up');
    if (mem.capState().minutesLeft < 0.1) stop('daily_cap');
  }, 5000);
  return conv;
}

async function cleanup(reason) {
  clearInterval(tickTimer); clearTimeout(idleTimer); clearTimeout(moveFlush);
  duck(false);
  const s = session; const c = conv;
  conv = null;
  if (s) {
    const seconds = elapsed();
    const meta = { seconds, helpTaps: s.helpTaps, mode: s.mode, endedAt: Date.now(), reason };
    if (!s.summarySaved && (seconds > 90 || s.problems > 0 || s.log.some((e) => e.type === 'camera'))) {
      mem.saveSummary(s.id, mem.summaryFromLog(s.log, { mode: s.mode }), meta).catch(() => {}); // never block the UI on the network
    } else mem.updateSession(s.id, meta);
  }
  session = null;
  ui.onStatus?.('off');
  ui.onEnd?.(reason);
  return c;
}

export async function stop(reason = 'stopped') {
  if (!conv) return;
  const c = conv;
  await cleanup(reason);
  try { await c.endSession(); } catch {}
}

export function setMicMuted(m) { try { conv?.setMicMuted?.(!!m); } catch {} }

// end the session cleanly if the page is closed/backgrounded for long
document.addEventListener('visibilitychange', () => {
  if (document.hidden && conv) { conv.sendContextualUpdate?.('[APP] The iPad screen was switched away.'); }
});
window.addEventListener('pagehide', () => { try { conv?.endSession(); } catch {} });
