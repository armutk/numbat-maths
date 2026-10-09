// Numbat Maths — app shell. Pip the numbat is Arisha's live tutor; the screen is her whiteboard.
// Screens: first run, home, Pip (lesson or camera), practise-on-my-own quests (offline fallback), summary, stickers, grown-ups.
import { h, svg, wait, pick, shuffle, confetti, bounce, shake, toast, holdButton, flipMove, randInt, numberChoices, popCount } from './ui.js';
import { mascot, icons, backdrop, STICKERS, items, friend, moduleArt } from './art.js';
import { sfx, unlockAudio, setSound, preloadSfx } from './audio.js';
import { say, replay, stop as stopSpeech, unlockSpeech, onSpeechState, setMuted, preload as preloadVoice } from './voice.js';
import { makeDraggable, makeDropTarget, clearPicked, installPressFeedback, resetAllDrags } from './drag.js';
import * as store from './store.js';
import * as mem from './memory.js';
import { SETTINGS } from './profile-config.js';
import { parentGate } from './parent.js';
import createBoard from './board.js';
import * as tutor from './tutor.js';
import * as camera from './camera.js';
import sharing from './modules/sharing.js';
import groups from './modules/groups.js';
import numbers from './modules/numbers.js';
import addsub from './modules/addsub.js';

export const MODULES = [sharing, groups, numbers, addsub];
const TASKS_PER_QUEST = 6;
const PRAISE = ['Yes!', 'Spot on!', 'You got it!', 'Beauty!', 'Nice one!', 'Too easy!', 'That\'s it!'];
const ENCOURAGE = ['Not quite. Have another go!', 'Nearly! Let\'s look again.', 'Hmm, let\'s try that again.', 'Good try. Let\'s check it together.'];
const DEV = new URLSearchParams(location.search).has('dev') || /^(127\.0\.0\.1|localhost)$/.test(location.hostname);

const ICON_MIC = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M9 21h6"/></svg>';
const ICON_CAM = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/></svg>';
const ICON_CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5h16v11H9l-5 4z"/></svg>';
const ICON_STOP = '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="3"/></svg>';

const app = document.getElementById('app');
let current = null;
let askPipBtn = null;
let online = navigator.onLine;

/* ---------- screen management ---------- */
function show(el) {
  const prev = current;
  current = el;
  el.classList.add('screen');
  app.append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-active')));
  if (prev) {
    prev.classList.remove('is-active'); prev.classList.add('is-leaving');
    setTimeout(() => prev.remove(), 360);
    if (typeof prev._leave === 'function') { try { prev._leave(); } catch {} }
  }
  stopSpeech();
  clearPicked();
  resetAllDrags?.();
  updateAskPip();
  return el;
}

/* ---------- boot ---------- */
export function boot() {
  app.append(h('div', { class: 'backdrop', html: backdrop }));
  app.append(h('canvas', { id: 'fx' }));
  installPressFeedback?.(document);
  setMuted(false);
  setSound(store.getState().profile.sound !== false);
  // first touch anywhere unlocks audio on iOS and warms the sounds
  const warm = () => { unlockAudio(); unlockSpeech(); preloadSfx?.(); preloadVoice?.(); };
  document.addEventListener('pointerdown', warm, { once: true, capture: true });
  document.addEventListener('touchend', warm, { once: true, capture: true });
  addEventListener('online', () => { online = true; document.body.classList.remove('is-offline'); });
  addEventListener('offline', () => { online = false; document.body.classList.add('is-offline'); });
  if (!online) document.body.classList.add('is-offline');
  askPipBtn = makeAskPip();
  app.append(askPipBtn);
  if (store.getName()) mem.setChildName(store.getName());
  if (!store.getName()) show(firstRun());
  else show(home());
}

/* ---------- Ask Pip (always visible) ---------- */
function makeAskPip() {
  const b = h('button', { class: 'ask-pip', 'aria-label': 'Ask Pip for help' },
    h('span', { class: 'face', html: mascot('happy', 'ask-pip-face') }),
    h('span', { class: 'hand', html: icons.hand }),
    h('span', { class: 'label' }, 'Ask Pip'),
  );
  b.addEventListener('click', () => {
    unlockAudio();
    sfx.hint?.();
    b.classList.add('is-waving'); setTimeout(() => b.classList.remove('is-waving'), 900);
    if (current && typeof current._askPip === 'function') current._askPip();
    else startPip('lesson');
  });
  return b;
}
function updateAskPip() {
  if (!askPipBtn) return;
  askPipBtn.classList.toggle('is-live', tutor.isLive());
  askPipBtn.hidden = !!(current && current.classList.contains('first-run'));
}

/* ---------- first run ---------- */
function firstRun() {
  const input = h('input', { class: 'name-input', type: 'text', placeholder: 'Your name', autocomplete: 'off', autocapitalize: 'words', maxlength: '20', 'aria-label': 'Your first name', value: mem.childName() || '' });
  const go = h('button', { class: 'btn btn-xl btn-green', disabled: !input.value.trim() }, svg(icons.play), 'Let\'s go!');
  input.addEventListener('input', () => { go.disabled = !input.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) go.click(); });
  go.addEventListener('click', () => {
    unlockAudio(); unlockSpeech();
    store.setName(input.value); mem.setChildName(store.getName());
    sfx.complete?.();
    say(`G'day ${store.getName()}! I'm Pip. Let's do some maths together.`);
    show(home());
  });
  const card = h('div', { class: 'center-card' },
    h('div', { class: 'mascot-wrap', html: mascot('happy', 'mascot is-idle') }),
    h('h1', {}, 'G\'day! I\'m Pip the numbat.'),
    h('p', {}, 'What\'s your name?'),
    input, go,
  );
  const s = h('div', { class: 'first-run' }, card);
  setTimeout(() => { try { input.focus(); } catch {} }, 450);
  return s;
}

/* ---------- home ---------- */
function home() {
  const name = store.getName();
  const st = store.getState();
  const cap = mem.capState();
  const hist = mem.getHistory().filter((s) => s.summary);
  const last = hist[hist.length - 1];
  const line = cap.blocked ? `Pip's having a rest now. You can still practise on your own, ${name}.`
    : !online ? `No internet right now, so Pip can't chat. Practise on your own, ${name}!`
    : last ? `Ready for more sharing, ${name}?` : `Tap me and let's do some maths together, ${name}!`;

  const stars = h('div', { class: 'pill' }, svg(icons.star), String(st.stars));
  const book = h('button', { class: 'pill', onClick: () => { sfx.tap?.(); show(stickerBook()); } }, svg(icons.book), `${st.stickers.length} / ${STICKERS.length}`);
  const grown = holdButton(h('button', { class: 'btn btn-sm btn-ghost', 'aria-label': 'Grown-ups: hold to open' }, svg(icons.lock), 'Grown-ups'), () => parentGate({ show, home, say }), 1800);

  const talk = h('button', { class: 'pip-cta pip-cta-talk', disabled: cap.blocked || !online, onClick: () => startPip('lesson') },
    h('span', { class: 'pip-cta-icon', html: ICON_CHAT }), h('span', { class: 'pip-cta-text' }, h('b', {}, 'Talk to Pip'), h('small', {}, cap.blocked ? 'Pip is resting' : 'Share things out together')));
  const cam = h('button', { class: 'pip-cta pip-cta-cam', disabled: cap.blocked || !online, onClick: () => startPip('camera') },
    h('span', { class: 'pip-cta-icon', html: ICON_CAM }), h('span', { class: 'pip-cta-text' }, h('b', {}, 'Show Pip something'), h('small', {}, 'Crackers, toys, anything!')));

  const islands = MODULES.map((m, i) => {
    const levels = m.skills.map((s) => store.skill(s.id).level);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const maxL = Math.max(...m.skills.map((s) => s.maxLevel || 4));
    const seen = m.skills.some((s) => store.skill(s.id).total > 0);
    const dots = h('span', { class: 'levels' }, ...Array.from({ length: maxL }, (_, k) => h('i', { class: k < Math.round(avg) && seen ? 'on' : '' })));
    const el = h('button', { class: `island ${m.id === 'sharing' ? 'is-hero' : ''}`, style: { '--island': `var(--${m.colour})`, '--island-deep': `var(--${m.colour}-deep)`, '--island-soft': `var(--${m.colour}-soft)` }, onClick: () => startQuest(m) },
      h('div', { class: 'island-art', html: m.art }),
      h('div', { class: 'island-body' }, h('h2', {}, m.title), h('div', { class: 'island-meta' }, h('span', {}, m.tagline), dots)),
    );
    el.style.animationDelay = `${i * 60}ms`;
    return el;
  });

  const s = h('div', { class: 'home pip-home' },
    h('div', { class: 'topbar' }, stars, book, h('div', { class: 'spacer' }), grown),
    h('div', { class: 'home-hero' },
      h('button', { class: 'pip-hero-btn', 'aria-label': 'Talk to Pip', html: mascot(cap.blocked ? 'think' : 'happy', 'mascot is-idle'), onClick: () => (cap.blocked || !online ? null : startPip('lesson')) }),
      h('div', { class: 'speech-bubble' }, h('h1', {}, `G'day, ${name}!`), h('p', {}, line)),
    ),
    h('div', { class: 'pip-ctas' }, talk, cam),
    h('div', { class: 'practise-label' }, 'Practise on my own'),
    h('div', { class: 'world' }, ...islands),
  );
  s._askPip = () => { if (!cap.blocked && online) startPip('lesson'); else { say(line); } };
  setTimeout(() => say(line), 500);
  return s;
}

/* ---------- Pip: live tutor screen (lesson or camera) ---------- */
async function startPip(mode = 'lesson') {
  unlockAudio(); unlockSpeech();
  sfx.whoosh?.();
  const cap = mem.capState();
  if (cap.blocked) { show(restScreen()); return; }
  const screen = pipScreen(mode);
  show(screen);
  await screen._start();
}

function pipScreen(mode) {
  let currentMode = mode;
  const bubbleText = h('p', {}, 'Waking Pip up...');
  const bubble = h('div', { class: 'speech-bubble' }, bubbleText);
  const mascotWrap = h('div', { class: 'pip-mascot', html: mascot('happy', 'mascot-sm is-idle') });
  const status = h('div', { class: 'pip-status' }, h('i', { class: 'dot' }), h('span', {}, 'Connecting'));
  const micBtn = h('button', { class: 'icon-btn pip-mic', 'aria-label': 'Microphone', html: ICON_MIC });
  const camBtn = h('button', { class: `icon-btn ${mode === 'camera' ? 'is-on' : ''}`, 'aria-label': 'Camera', html: ICON_CAM });
  const endBtn = h('button', { class: 'icon-btn pip-end', 'aria-label': 'Finish', html: ICON_STOP });
  const homeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Home', onClick: async () => { sfx.tap?.(); await endSession('child_asked'); } }, svg(icons.home));
  const boardHost = h('div', { class: 'board-host' });
  const camHost = h('div', { class: 'cam-host', hidden: true });
  const lookBtn = h('button', { class: 'btn btn-xl btn-blue cam-look', onClick: () => lookNow() }, h('span', { html: ICON_CAM, class: 'btn-ico' }), 'Show Pip');
  const camBack = h('button', { class: 'btn btn-ghost', onClick: () => setMode('lesson') }, 'Back to the whiteboard');
  camHost.append(h('div', { class: 'cam-actions' }, lookBtn, camBack));
  const stage = h('div', { class: 'stage pip-stage' }, boardHost, camHost);
  const overlay = h('div', { class: 'pip-overlay' }, h('div', { class: 'pip-overlay-card' }, h('div', { html: mascot('think', 'mascot') }), h('h2', {}, 'Waking Pip up...'), h('p', {}, 'Say hello when she does!')));
  const screen = h('div', { class: 'quest pip-screen', dataset: { mode } },
    h('div', { class: 'topbar' }, homeBtn, status, h('div', { class: 'spacer' }), micBtn, camBtn, endBtn),
    h('div', { class: 'prompt' }, mascotWrap, bubble),
    stage, overlay,
  );

  const board = createBoard(boardHost, { sfx, draggable: makeDraggable, dropTarget: makeDropTarget, flipMove, h, svg, items, friend, mascot, wait });
  tutor.attachBoard(board);
  let muted = false, ended = false, timer = 0;

  const setMood = (m) => { mascotWrap.innerHTML = mascot(m, 'mascot-sm is-idle'); };
  const setStatus = (text, cls) => { status.lastElementChild.textContent = text; status.className = `pip-status ${cls || ''}`; };

  function setMode(m) {
    if (m === currentMode) return;
    currentMode = m;
    screen.dataset.mode = m;
    camBtn.classList.toggle('is-on', m === 'camera');
    if (m === 'camera') openCamera().catch(() => {}); else closeCamera();
  }
  async function openCamera() {
    camHost.hidden = false; boardHost.hidden = true;
    try {
      await camera.open(camHost, { auto: true });
      const view = camHost.querySelector('.cam'); if (view) camHost.prepend(view); // keep actions under the view
      camera.onAutoDescribe((r) => tutor.event('camera-seen', r));
      tutor.event('camera-opened');
      bubbleText.textContent = 'Hold your things up so Pip can see them.';
    } catch (e) {
      camHost.hidden = true; boardHost.hidden = false;
      toast('Pip can\'t use the camera on this iPad right now');
      currentMode = 'lesson'; screen.dataset.mode = 'lesson'; camBtn.classList.remove('is-on');
      throw e;
    }
  }
  function closeCamera() {
    camera.close();
    camHost.hidden = true; boardHost.hidden = false;
    tutor.event('camera-closed');
  }
  async function lookNow() {
    sfx.tap?.();
    lookBtn.disabled = true;
    const r = await camera.describe({ child: store.getName() });
    lookBtn.disabled = false;
    if (r.ok) tutor.event('camera-seen', r); else toast('Pip couldn\'t see that time. Try again.');
  }
  camBtn.addEventListener('click', () => { sfx.tap?.(); setMode(currentMode === 'camera' ? 'lesson' : 'camera'); });
  micBtn.addEventListener('click', () => { sfx.tap?.(); muted = !muted; tutor.setMicMuted(muted); micBtn.classList.toggle('is-muted', muted); micBtn.setAttribute('aria-label', muted ? 'Microphone off' : 'Microphone'); });
  endBtn.addEventListener('click', () => { sfx.tap?.(); endSession('child_asked'); });

  async function endSession(reason) {
    if (ended) return; ended = true;
    clearInterval(timer);
    camera.close();
    await tutor.stop(reason);
    board.destroy?.();
    tutor.attachBoard(null);
    const hist = mem.getHistory();
    const lastS = hist[hist.length - 1];
    if (lastS && lastS.summary && (lastS.seconds || 0) > 60) show(pipSummary(lastS)); else show(home());
  }

  tutor.setUI({
    onStatus: (s) => {
      if (s === 'live') { overlay.classList.add('is-gone'); setStatus(tutor.state().micMode === 'silent' ? 'Pip can talk, but can\'t hear you' : 'Pip is listening', 'is-live'); updateAskPip(); }
      else if (s === 'connecting') setStatus('Connecting', '');
      else if (s === 'off') { setStatus('Finished', ''); updateAskPip(); }
      else if (s === 'failed') setStatus('Could not connect', 'is-bad');
    },
    onMode: (m) => {
      const speaking = m === 'speaking';
      screen.classList.toggle('is-pip-talking', speaking);
      askPipBtn?.classList.toggle('is-talking', speaking);
      setStatus(speaking ? 'Pip is talking' : (tutor.state().micMode === 'silent' ? 'Pip can\'t hear you' : 'Your turn'), speaking ? 'is-talking' : 'is-live');
      setMood(speaking ? 'happy' : 'think');
    },
    onTranscript: ({ role, text }) => { const clean = String(text || '').replace(/\[[a-z][a-z ,'-]{1,24}\]/gi, '').replace(/\s{2,}/g, ' ').trim(); if (role === 'pip' && clean && clean !== 'Hmm...') { bubbleText.textContent = clean; bubble.classList.remove('is-hint', 'is-happy'); } },
    onCamera: async (open) => { if (open) { if (currentMode !== 'camera') { currentMode = 'camera'; screen.dataset.mode = 'camera'; camBtn.classList.add('is-on'); await openCamera(); } } else setMode('lesson'); },
    onEnd: (reason) => { if (!ended) { if (reason === 'daily_cap' || reason === 'time_up') { ended = true; camera.close(); board.destroy?.(); tutor.attachBoard(null); show(restScreen(reason)); } else if (reason === 'error' || reason === 'disconnected') { showFallback('Pip lost the connection.'); } } },
    onError: (e) => { if (DEV) console.warn('tutor error', e); },
  });

  function showFallback(why) {
    overlay.classList.remove('is-gone');
    overlay.innerHTML = '';
    overlay.append(h('div', { class: 'pip-overlay-card' },
      h('div', { html: mascot('kind', 'mascot') }),
      h('h2', {}, 'Pip can\'t chat right now'),
      h('p', {}, `${why} You can practise on your own and Pip will talk with her recorded voice.`),
      h('div', { class: 'actions' },
        h('button', { class: 'btn btn-green', onClick: () => { ended = true; camera.close(); tutor.attachBoard(null); startQuest(sharing); } }, svg(icons.play), 'Practise on my own'),
        h('button', { class: 'btn btn-ghost', onClick: () => { ended = false; overlay.innerHTML = ''; overlay.append(h('div', { class: 'pip-overlay-card' }, h('div', { html: mascot('think', 'mascot') }), h('h2', {}, 'Waking Pip up...'))); screen._start(); } }, 'Try again'),
        h('button', { class: 'btn btn-ghost', onClick: () => { ended = true; show(home()); } }, svg(icons.home), 'Home'),
      ),
    ));
    say('Pip can\'t chat right now. Let\'s practise on our own.');
  }

  screen._start = async () => {
    try {
      if (mode === 'camera' && currentMode === 'camera') { camHost.hidden = false; boardHost.hidden = true; try { await openCamera(); } catch {} }
      await tutor.start({ mode: currentMode });
      timer = setInterval(() => { if (!document.hidden && current === screen) store.addSeconds(5); }, 5000);
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg === 'cap') { ended = true; show(restScreen('daily_cap')); return; }
      showFallback(msg === 'offline' ? 'There is no internet right now.' : 'The connection did not work.');
    }
  };
  screen._askPip = () => {
    if (tutor.isLive()) { tutor.askForHelp(); setMood('think'); }
    else say('Pip is just waking up. One moment.');
  };
  screen._leave = () => { clearInterval(timer); camera.close(); if (!ended) { ended = true; tutor.stop('left_screen'); tutor.attachBoard(null); } };
  return screen;
}

/* ---------- after a Pip session ---------- */
function pipSummary(s) {
  const sum = s.summary;
  const mins = Math.max(1, Math.round((s.seconds || 0) / 60));
  const card = h('div', { class: 'center-card' },
    h('div', { class: 'reward-row' }, h('div', { html: mascot('cheer', 'mascot') })),
    h('h1', {}, 'See you next time!'),
    h('p', {}, `${mins} minute${mins === 1 ? '' : 's'} with Pip. ${sum.what_clicked || ''}`),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-ghost', onClick: () => { sfx.tap?.(); show(home()); } }, svg(icons.home), 'Home'),
      h('button', { class: 'btn btn-green', onClick: () => startPip('lesson') }, svg(icons.play), 'Talk to Pip again'),
    ),
  );
  setTimeout(() => { sfx.celebrate?.(); confetti({ count: 40, spread: 1.2, y: innerHeight * 0.35 }); }, 300);
  const scr = h('div', { class: 'summary' }, card);
  scr._askPip = () => startPip('lesson');
  return scr;
}

function restScreen(reason = 'daily_cap') {
  const cap = mem.capState();
  const line = reason === 'time_up' ? 'That was a big session! Pip is having a little rest now.' : 'Pip has done lots of maths today and is having a rest.';
  const card = h('div', { class: 'center-card' },
    h('div', { html: mascot('think', 'mascot') }),
    h('h1', {}, 'Pip needs a rest'),
    h('p', {}, `${line} ${cap.blocked ? 'She\'ll be back tomorrow.' : 'You can talk to her again in a bit.'} You can still practise on your own.`),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-ghost', onClick: () => { sfx.tap?.(); show(home()); } }, svg(icons.home), 'Home'),
      h('button', { class: 'btn btn-green', onClick: () => startQuest(sharing) }, svg(icons.play), 'Practise on my own'),
    ),
  );
  const scr = h('div', { class: 'summary pip-rest' }, card);
  scr._askPip = () => say(line);
  setTimeout(() => say('Pip needs a rest. You can still practise on your own.'), 400);
  return scr;
}

/* ---------- quest composition (practise on my own) ---------- */
function buildQuest(mod) {
  const prog = (sk) => { const s = store.skill(sk.id); const max = sk.maxLevel || 4; return max > 1 ? (s.level - 1) / (max - 1) : 1; };
  const mine = mod.skills.slice().sort((a, b) => {
    const pa = prog(a), pb = prog(b);
    if (pa !== pb) return pa - pb;
    return (store.accuracy(a.id) ?? 1) - (store.accuracy(b.id) ?? 1);
  });
  const plan = [];
  for (let i = 0; i < TASKS_PER_QUEST; i++) plan.push({ mod, skill: mine[i % mine.length] });
  const due = store.dueSkills().filter((id) => !mine.slice(0, 2).some((s) => s.id === id));
  if (due.length) {
    const id = due[0];
    const owner = MODULES.find((m) => m.skills.some((s) => s.id === id));
    if (owner) plan.splice(3, 1, { mod: owner, skill: owner.skills.find((s) => s.id === id), review: true });
  }
  return plan;
}

/* ---------- quest runner (offline fallback; recorded voice) ---------- */
function startQuest(mod, forcedPlan) {
  unlockAudio(); unlockSpeech();
  sfx.whoosh?.();
  const plan = forcedPlan || buildQuest(mod);
  const result = { stars: 0, correct: 0, firstTry: 0, levelUps: [], tasks: plan.length, mod };
  let idx = 0;
  let timer = 0;
  let helpTaps = 0;

  const bubbleText = h('p', {}, '');
  const bubble = h('div', { class: 'speech-bubble' }, bubbleText);
  const mascotWrap = h('div', { html: mascot('happy', 'mascot-sm is-idle') });
  const speaker = h('button', { class: 'icon-btn', 'aria-label': 'Say it again', onClick: () => { sfx.tap?.(); replay(); } }, svg(icons.speaker));
  onSpeechState((on) => speaker.classList.toggle('is-talking', on));
  const progress = h('div', { class: 'progress' }, ...plan.map(() => h('i')));
  const stageInner = h('div', { class: 'stage-inner' });
  const stage = h('div', { class: 'stage' }, stageInner);
  const actions = h('div', { class: 'actions' });
  const homeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Home', onClick: () => { clearInterval(timer); sfx.tap?.(); show(home()); } }, svg(icons.home));
  const screen = h('div', { class: 'quest' },
    h('div', { class: 'topbar' }, homeBtn, progress, speaker),
    h('div', { class: 'prompt' }, mascotWrap, bubble),
    stage, actions,
  );
  show(screen);
  timer = setInterval(() => { if (!document.hidden && current === screen) store.addSeconds(5); }, 5000);
  screen._leave = () => clearInterval(timer);

  const setMood = (mood) => { mascotWrap.innerHTML = mascot(mood, 'mascot-sm is-idle'); };
  const setBubble = (text, kind) => {
    bubbleText.textContent = text;
    bubble.classList.remove('is-happy', 'is-hint');
    if (kind) bubble.classList.add(kind);
  };
  const speak = (text, kind) => { setBubble(text, kind); return say(text); };
  let currentHelp = null; // scripted help for the Ask Pip button while offline

  screen._askPip = async () => {
    helpTaps++;
    if (currentHelp) await currentHelp();
  };

  function runTask() {
    const step = plan[idx];
    progress.querySelectorAll('i').forEach((i, k) => { i.classList.toggle('done', k < idx); i.classList.toggle('cur', k === idx); });
    const level = store.skill(step.skill.id).level;
    let task;
    try { task = step.mod.makeTask(step.skill.id, level); } catch (e) { console.error(e); task = step.mod.makeTask(step.mod.skills[0].id, 1); }
    resetAllDrags?.();
    stageInner.innerHTML = ''; actions.innerHTML = '';
    stage.classList.remove('shake');
    setMood('happy');
    let wrongs = 0, locked = false, finished = false, cleanup = null, helpUsed = 0;

    const api = {
      name: store.getName(),
      level,
      stage: stageInner,
      actions,
      sfx, items, friend, svg, h, wait, pick, shuffle, randInt, numberChoices, flipMove,
      draggable: makeDraggable,
      dropTarget: makeDropTarget,
      say: (t, kind) => speak(t, kind),
      mood: setMood,
      button(label, onClick, cls = 'btn-green', icon = icons.check) {
        const b = h('button', { class: `btn ${cls}`, onClick: () => { if (!locked) { sfx.tap?.(); onClick(b); } } }, icon ? svg(icon) : null, label);
        actions.append(b);
        return b;
      },
      async step(ok, { say: text, hint } = {}) {
        if (ok) {
          sfx.correct?.(); setMood('cheer'); bounce(mascotWrap.firstElementChild);
          await speak(text || pick(PRAISE), 'is-happy');
          await wait(250);
          setMood('happy');
        } else {
          wrongs++; sfx.wrong?.(); shake(stage); setMood('kind');
          await speak(text || pick(ENCOURAGE), 'is-hint');
          await wait(200);
          const hintFn = hint || task.hint;
          if (hintFn) await hintFn.call(task, stageInner, api, wrongs);
        }
        return ok;
      },
      async finish(ok, { say: text } = {}) {
        if (locked || finished) return;
        locked = true;
        if (ok) {
          finished = true;
          sfx.complete?.(); setMood('cheer'); bounce(mascotWrap.firstElementChild);
          stage.classList.add('is-win'); setTimeout(() => stage.classList.remove('is-win'), 1200);
          const r = stage.getBoundingClientRect();
          confetti({ x: r.left + r.width / 2, y: r.top + r.height * 0.4, count: wrongs ? 18 : 36 });
          const first = wrongs === 0;
          const earned = first ? 2 : 1;
          result.stars += earned; result.correct++; if (first) result.firstTry++;
          store.addStars(earned);
          const rec = store.recordAttempt(step.skill.id, true, first, step.skill.maxLevel || 4);
          if (rec.levelUp) result.levelUps.push({ skill: step.skill, level: rec.level });
          await speak(text || pick(PRAISE), 'is-happy');
          await wait(rec.levelUp ? 300 : 500);
          if (rec.levelUp) { sfx.sticker?.(); await speak(`Level up! ${step.skill.name} is getting easier for you.`, 'is-happy'); }
          next();
        } else {
          wrongs++; sfx.wrong?.(); shake(stage); setMood('kind');
          await speak(text || pick(ENCOURAGE), 'is-hint');
          await wait(150);
          if (wrongs >= 3 && task.reveal) {
            await task.reveal(stageInner, api);
            store.recordAttempt(step.skill.id, false, false, step.skill.maxLevel || 4);
            await wait(900);
            finished = true;
            next();
            return;
          }
          if (task.hint) await task.hint(stageInner, api, wrongs);
          locked = false;
          setMood('happy');
        }
      },
      ask({ options, answer, parent = stageInner, onCorrect, finalSay, text = (v) => String(v), sayOption = (v) => String(v), cls = '' }) {
        const group = h('div', { class: 'choices' });
        for (const v of options) {
          const b = h('button', { class: `choice ${cls}`, dataset: { value: String(v) } }, text(v));
          b.addEventListener('click', async () => {
            if (locked || b.classList.contains('is-wrong')) return;
            locked = true;
            sfx.tap?.();
            say(sayOption(v), { interrupt: true });
            if (v === answer) {
              b.classList.add('is-right');
              group.querySelectorAll('.choice').forEach((o) => { if (o !== b) o.classList.add('is-dim'); });
              await wait(550);
              locked = false;
              if (onCorrect) { await api.step(true, { say: onCorrect.say }); onCorrect.then && onCorrect.then(); }
              else api.finish(true, { say: finalSay });
            } else {
              b.classList.add('is-wrong');
              await wait(650);
              locked = false;
              api.finish(false);
            }
          });
          group.append(b);
        }
        parent.append(group);
        return group;
      },
    };

    // Offline Ask Pip: first tap repeats the question with a kind nudge, later taps run the task's own hint ladder.
    currentHelp = async () => {
      if (locked) return;
      helpUsed++;
      setMood('kind');
      if (helpUsed === 1 || !task.hint) { await speak(task.say, 'is-hint'); }
      else { locked = true; try { await task.hint.call(task, stageInner, api, Math.min(helpUsed, 3)); } catch {} locked = false; }
      setMood('happy');
    };

    const intro = step.review ? `Quick look back. ${task.say}` : task.say;
    setTimeout(() => speak(intro), 350);
    try { cleanup = task.mount(stageInner, api) || null; } catch (e) { console.error('task mount failed', e); next(); }

    function next() {
      if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
      currentHelp = null;
      idx++;
      if (idx >= plan.length) { clearInterval(timer); store.finishQuest(); show(summary(result, helpTaps)); }
      else setTimeout(runTask, 200);
    }
  }
  runTask();
}

/* dev hook for tests: mount one task of a skill at a level inside a quest screen */
function mountTask(skillId, level) {
  const mod = MODULES.find((m) => m.skills.some((s) => s.id === skillId));
  const sk = mod.skills.find((s) => s.id === skillId);
  store.skill(skillId).level = level;
  startQuest(mod, [{ mod, skill: sk }]);
}
if (DEV) {
  window.__numbat = { MODULES, mountTask, store, startPip, startQuest, mem, tutor, show, home: () => show(home()) };
}

/* ---------- summary / done for today ---------- */
function summary(r, helpTaps = 0) {
  const st = store.getState();
  const dayRec = store.day();
  const doneToday = store.dailyDone() && !dayRec.doneShown;
  let newSticker = null;
  if (doneToday || r.levelUps.length) {
    const locked = STICKERS.filter((s) => !st.stickers.includes(s.id));
    if (locked.length) { newSticker = locked[0]; store.earnSticker(newSticker.id); }
    if (doneToday) { dayRec.doneShown = true; store.save(); }
  }
  if (r.tasks) mem.addSession({ mode: 'practice', seconds: 0, helpTaps, summary: { what_she_did: `Practised ${r.mod.title} on her own: ${r.correct} of ${r.tasks} right, ${r.firstTry} first go.`, what_clicked: r.firstTry === r.tasks ? 'Every one first go.' : '', what_was_tricky: r.firstTry < r.tasks / 2 ? `${r.mod.title} needed a few goes.` : '', home_activity: '', misconceptions: [], auto: true }, endedAt: Date.now() });
  const starsRow = h('div', { class: 'stars-row' }, ...Array.from({ length: Math.min(12, r.stars) }, (_, i) => { const s = svg(icons.star); s.style.animationDelay = `${i * 90}ms`; return s; }));
  const title = doneToday ? 'Done for today!' : r.firstTry === r.tasks ? 'Perfect!' : 'Great work!';
  const line = doneToday
    ? `That's your maths done for today, ${store.getName()}. You earned ${r.stars} stars.`
    : `You earned ${r.stars} ${r.stars === 1 ? 'star' : 'stars'}. ${r.firstTry === r.tasks ? 'Every one first go!' : r.levelUps.length ? 'And you moved up a level!' : 'Keep it up!'}`;

  const card = h('div', { class: 'center-card' },
    h('div', { class: 'reward-row' },
      h('div', { html: mascot('cheer', 'mascot') }),
      newSticker ? h('div', {}, h('div', { class: 'sticker-reveal', html: newSticker.svg }), h('p', {}, `New sticker: ${newSticker.name}!`)) : null,
    ),
    h('h1', {}, title),
    starsRow,
    h('p', {}, line),
    h('div', { class: 'actions' },
      h('button', { class: 'btn btn-ghost', onClick: () => { sfx.tap?.(); show(home()); } }, svg(icons.home), 'Home'),
      doneToday ? null : h('button', { class: 'btn btn-green', onClick: () => startQuest(r.mod) }, svg(icons.play), 'Play again'),
    ),
  );
  const s = h('div', { class: 'summary' }, card);
  s._askPip = () => say(line);
  setTimeout(() => { sfx.celebrate?.(); confetti({ count: 60, spread: 1.4, y: innerHeight * 0.35 }); }, 300);
  setTimeout(() => { if (newSticker) sfx.sticker?.(); say(`${title} ${line}${newSticker ? ` You found a new sticker: a ${newSticker.name.toLowerCase()}!` : ''}`); }, 700);
  return s;
}

/* ---------- sticker book ---------- */
function stickerBook() {
  const st = store.getState();
  const grid = h('div', { class: 'sticker-grid', dataset: { scroll: '1' } }, ...STICKERS.map((s) => {
    const got = st.stickers.includes(s.id);
    return h('div', { class: `sticker ${got ? '' : 'is-locked'}`, html: s.svg + `<span>${got ? s.name : '?'}</span>` });
  }));
  const s = h('div', { class: 'stickers' },
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onClick: () => { sfx.tap?.(); show(home()); } }, svg(icons.back)),
      h('div', { class: 'pill' }, svg(icons.book), 'My stickers'),
      h('div', { class: 'spacer' }),
    ),
    grid,
  );
  const n = st.stickers.length;
  const line = n ? `You have ${n} ${n === 1 ? 'sticker' : 'stickers'}. Finish your maths each day to find more.` : 'Finish your maths for the day to find your first sticker.';
  s._askPip = () => say(line);
  setTimeout(() => say(line), 400);
  return s;
}
