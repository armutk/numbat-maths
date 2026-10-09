// Numbat Maths — app shell, quest runner and screens.
import { h, svg, wait, pick, shuffle, confetti, bounce, shake, toast, holdButton, flipMove, randInt, numberChoices } from './ui.js';
import { mascot, icons, backdrop, STICKERS, items, friend, moduleArt } from './art.js';
import { sfx, unlockAudio, setSound } from './audio.js';
import { say, replay, stop as stopSpeech, unlockSpeech, onSpeechState, setMuted } from './speech.js';
import { makeDraggable, makeDropTarget, clearPicked } from './drag.js';
import * as store from './store.js';
import { parentGate } from './parent.js';
import sharing from './modules/sharing.js';
import groups from './modules/groups.js';
import numbers from './modules/numbers.js';
import addsub from './modules/addsub.js';

export const MODULES = [sharing, groups, numbers, addsub];
const TASKS_PER_QUEST = 6;
const PRAISE = ['Yes!', 'Spot on!', 'You got it!', 'Beauty!', 'Nice one!', 'Too easy!', 'That\'s it!'];
const ENCOURAGE = ['Not quite. Have another go!', 'Nearly! Let\'s look again.', 'Hmm, let\'s try that again.', 'Good try. Let\'s check it together.'];

const app = document.getElementById('app');
let current = null;

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
  }
  stopSpeech();
  clearPicked();
  return el;
}

/* ---------- boot ---------- */
export function boot() {
  app.append(h('div', { class: 'backdrop', html: backdrop }));
  app.append(h('canvas', { id: 'fx' }));
  setMuted(false);
  setSound(store.getState().profile.sound !== false);
  if (!store.getName()) show(firstRun());
  else show(home());
}

/* ---------- first run ---------- */
function firstRun() {
  const input = h('input', { class: 'name-input', type: 'text', placeholder: 'Your name', autocomplete: 'off', autocapitalize: 'words', maxlength: '20', 'aria-label': 'Your first name' });
  const go = h('button', { class: 'btn btn-xl btn-green', disabled: true }, svg(icons.play), 'Let\'s go!');
  input.addEventListener('input', () => { go.disabled = !input.value.trim(); });
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && input.value.trim()) go.click(); });
  go.addEventListener('click', () => {
    unlockAudio(); unlockSpeech();
    store.setName(input.value);
    sfx.success();
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
  const done = store.dailyDone();
  const line = done
    ? `You've done your maths for today, ${name}! Play more if you like.`
    : st.quests === 0 ? `Pick an island to start, ${name}!` : pick([`Ready for some maths, ${name}?`, `Let's share some cookies, ${name}!`, `Which island today, ${name}?`]);

  const stars = h('div', { class: 'pill' }, svg(icons.star), String(st.stars));
  const book = h('button', { class: 'pill', onClick: () => { sfx.tap(); show(stickerBook()); } }, svg(icons.book), `${st.stickers.length} / ${STICKERS.length}`);
  const grown = holdButton(h('button', { class: 'btn btn-sm btn-ghost', 'aria-label': 'Grown-ups: hold to open' }, svg(icons.lock), 'Grown-ups'), () => parentGate({ show, home, say }), 1800);

  const islands = MODULES.map((m, i) => {
    const levels = m.skills.map((s) => store.skill(s.id).level);
    const avg = levels.reduce((a, b) => a + b, 0) / levels.length;
    const maxL = Math.max(...m.skills.map((s) => s.maxLevel || 4));
    const seen = m.skills.some((s) => store.skill(s.id).total > 0);
    const dots = h('span', { class: 'levels' }, ...Array.from({ length: maxL }, (_, k) => h('i', { class: k < Math.round(avg) && seen ? 'on' : '' })));
    const el = h('button', { class: `island ${m.id === 'sharing' ? 'is-hero' : ''}`, style: { '--island': `var(--${m.colour})`, '--island-deep': `var(--${m.colour}-deep)`, '--island-soft': `var(--${m.colour}-soft)` }, onClick: () => startQuest(m) },
      m.id === 'sharing' ? h('span', { class: 'tag' }, 'This week at school') : null,
      h('div', { class: 'island-art', html: m.art }),
      h('div', { class: 'island-body' }, h('h2', {}, m.title), h('div', { class: 'island-meta' }, h('span', {}, m.tagline), dots)),
    );
    el.style.animationDelay = `${i * 60}ms`;
    return el;
  });

  const s = h('div', { class: 'home' },
    h('div', { class: 'topbar' }, stars, book, h('div', { class: 'spacer' }), grown),
    h('div', { class: 'home-hero' },
      h('div', { html: mascot(done ? 'cheer' : 'happy', 'mascot is-idle') }),
      h('div', { class: 'speech-bubble' }, h('h1', {}, `G'day, ${name}!`), h('p', {}, line)),
    ),
    h('div', { class: 'world' }, ...islands),
  );
  setTimeout(() => say(line), 500);
  return s;
}

/* ---------- quest composition ---------- */
function buildQuest(mod) {
  // focus the weakest / lowest-level skills first, then cycle; sprinkle one due review skill
  // least-progressed skill first (level as a fraction of its max), weakest accuracy breaks ties
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

/* ---------- quest runner ---------- */
function startQuest(mod, forcedPlan) {
  unlockAudio(); unlockSpeech();
  sfx.whoosh();
  const plan = forcedPlan || buildQuest(mod);
  const result = { stars: 0, correct: 0, firstTry: 0, levelUps: [], tasks: plan.length, mod };
  let idx = 0;
  let timer = 0;

  const bubbleText = h('p', {}, '');
  const bubble = h('div', { class: 'speech-bubble' }, bubbleText);
  const mascotWrap = h('div', { html: mascot('happy', 'mascot-sm is-idle') });
  const speaker = h('button', { class: 'icon-btn', 'aria-label': 'Say it again', onClick: () => { sfx.tap(); replay(); } }, svg(icons.speaker));
  onSpeechState((on) => speaker.classList.toggle('is-talking', on));
  const progress = h('div', { class: 'progress' }, ...plan.map(() => h('i')));
  const stageInner = h('div', { class: 'stage-inner' });
  const stage = h('div', { class: 'stage' }, stageInner);
  const actions = h('div', { class: 'actions' });
  const homeBtn = h('button', { class: 'icon-btn', 'aria-label': 'Home', onClick: () => { clearInterval(timer); sfx.tap(); show(home()); } }, svg(icons.home));
  const screen = h('div', { class: 'quest' },
    h('div', { class: 'topbar' }, homeBtn, progress, speaker),
    h('div', { class: 'prompt' }, mascotWrap, bubble),
    stage, actions,
  );
  show(screen);
  timer = setInterval(() => { if (!document.hidden && current === screen) store.addSeconds(5); }, 5000);

  const setMood = (mood) => { mascotWrap.innerHTML = mascot(mood, 'mascot-sm is-idle'); };
  const setBubble = (text, kind) => {
    bubbleText.textContent = text;
    bubble.classList.remove('is-happy', 'is-hint');
    if (kind) bubble.classList.add(kind);
  };
  const speak = (text, kind) => { setBubble(text, kind); return say(text); };

  function runTask() {
    const step = plan[idx];
    progress.querySelectorAll('i').forEach((i, k) => { i.classList.toggle('done', k < idx); i.classList.toggle('cur', k === idx); });
    const level = store.skill(step.skill.id).level;
    let task;
    try { task = step.mod.makeTask(step.skill.id, level); } catch (e) { console.error(e); task = step.mod.makeTask(step.mod.skills[0].id, 1); }
    stageInner.innerHTML = ''; actions.innerHTML = '';
    stage.classList.remove('shake');
    setMood('happy');
    let wrongs = 0, locked = false, finished = false, cleanup = null;

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
        const b = h('button', { class: `btn ${cls}`, onClick: () => { if (!locked) { sfx.tap(); onClick(b); } } }, icon ? svg(icon) : null, label);
        actions.append(b);
        return b;
      },
      /** Intermediate check inside a multi-step task. Resolves after the feedback moment. */
      async step(ok, { say: text, hint } = {}) {
        if (ok) {
          sfx.correct(); setMood('cheer'); bounce(mascotWrap.firstElementChild);
          await speak(text || pick(PRAISE), 'is-happy');
          await wait(250);
          setMood('happy');
        } else {
          wrongs++; sfx.wrong(); shake(stage); setMood('kind');
          await speak(text || pick(ENCOURAGE), 'is-hint');
          await wait(200);
          const hintFn = hint || task.hint;
          if (hintFn) await hintFn.call(task, stageInner, api, wrongs);
        }
        return ok;
      },
      /** Final answer for the task. */
      async finish(ok, { say: text } = {}) {
        if (locked || finished) return;
        locked = true;
        if (ok) {
          finished = true;
          sfx.success(); setMood('cheer'); bounce(mascotWrap.firstElementChild);
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
          if (rec.levelUp) { sfx.sticker(); await speak(`Level up! ${step.skill.name} is getting easier for you.`, 'is-happy'); }
          next();
        } else {
          wrongs++; sfx.wrong(); shake(stage); setMood('kind');
          await speak(text || pick(ENCOURAGE), 'is-hint');
          await wait(150);
          if (wrongs >= 3 && task.reveal) {
            // show the answer kindly and move on
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
      /** Answer buttons. `answer` compares with ===. Calls finish() unless onCorrect is given. */
      ask({ options, answer, parent = stageInner, onCorrect, finalSay, text = (v) => String(v), sayOption = (v) => String(v), cls = '' }) {
        const group = h('div', { class: 'choices' });
        for (const v of options) {
          const b = h('button', { class: `choice ${cls}`, dataset: { value: String(v) } }, text(v));
          b.addEventListener('click', async () => {
            if (locked || b.classList.contains('is-wrong')) return;
            if (locked) return;
            locked = true; // one tap at a time while the option is read back
            sfx.tap();
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

    const intro = step.review ? `Quick look back. ${task.say}` : task.say;
    setTimeout(() => speak(intro), 350);
    try { cleanup = task.mount(stageInner, api) || null; } catch (e) { console.error('task mount failed', e); next(); }

    function next() {
      if (typeof cleanup === 'function') { try { cleanup(); } catch {} }
      idx++;
      if (idx >= plan.length) { clearInterval(timer); store.finishQuest(); show(summary(result)); }
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
if (new URLSearchParams(location.search).has('dev') || location.hostname === '127.0.0.1' || location.hostname === 'localhost') {
  window.__numbat = { MODULES, mountTask, store };
}

/* ---------- summary / done for today ---------- */
function summary(r) {
  const st = store.getState();
  const dayRec = store.day();
  const doneToday = store.dailyDone() && !dayRec.doneShown;
  let newSticker = null;
  if (doneToday || r.levelUps.length) {
    const locked = STICKERS.filter((s) => !st.stickers.includes(s.id));
    if (locked.length) { newSticker = locked[0]; store.earnSticker(newSticker.id); }
    if (doneToday) { dayRec.doneShown = true; store.save(); }
  }
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
      h('button', { class: 'btn btn-ghost', onClick: () => { sfx.tap(); show(home()); } }, svg(icons.home), 'Home'),
      doneToday ? null : h('button', { class: 'btn btn-green', onClick: () => startQuest(r.mod) }, svg(icons.play), 'Play again'),
    ),
  );
  const s = h('div', { class: 'summary' }, card);
  setTimeout(() => { sfx.fanfare(); confetti({ count: 60, spread: 1.4, y: innerHeight * 0.35 }); }, 300);
  setTimeout(() => { if (newSticker) sfx.sticker(); say(`${title} ${line}${newSticker ? ` You found a new sticker: a ${newSticker.name.toLowerCase()}!` : ''}`); }, 700);
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
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onClick: () => { sfx.tap(); show(home()); } }, svg(icons.back)),
      h('div', { class: 'pill' }, svg(icons.book), 'My stickers'),
      h('div', { class: 'spacer' }),
    ),
    grid,
  );
  const n = st.stickers.length;
  setTimeout(() => say(n ? `You have ${n} ${n === 1 ? 'sticker' : 'stickers'}. Finish your maths each day to find more.` : 'Finish your maths for the day to find your first sticker.'), 400);
  return s;
}
