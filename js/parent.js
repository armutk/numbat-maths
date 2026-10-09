// Grown-ups view: gate, per-skill accuracy, time, what to practise at home.
import { h, svg, randInt, shuffle, toast } from './ui.js';
import { icons } from './art.js';
import { sfx, setSound } from './audio.js';
import { voiceInfo } from './voice.js';
import * as store from './store.js';
import * as mem from './memory.js';

let MODULES = null;
async function modules() {
  if (!MODULES) MODULES = (await import('./app.js')).MODULES;
  return MODULES;
}

const fmtMin = (sec) => sec < 60 ? `${Math.round(sec)} s` : `${Math.round(sec / 60)} min`;

export function parentGate({ show, home, say }) {
  sfx.tap();
  const a = randInt(6, 9), b = randInt(6, 9);
  const answer = a * b;
  const opts = shuffle([answer, answer + randInt(1, 6), answer - randInt(1, 6)]);
  const s = h('div', { class: 'parent' },
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onClick: () => show(home()) }, svg(icons.back)),
      h('div', { class: 'pill' }, svg(icons.lock), 'Grown-ups only'),
    ),
    h('div', { class: 'center-card' },
      h('h1', {}, `What is ${a} × ${b}?`),
      h('p', {}, 'A quick check that a grown-up is here.'),
      h('div', { class: 'choices' }, ...opts.map((v) => h('button', { class: 'choice', onClick: async () => { if (v === answer) show(await parentView({ show, home })); else { toast('Not quite'); show(home()); } } }, String(v)))),
    ),
  );
  show(s);
}

async function parentView({ show, home }) {
  const mods = await modules();
  const st = store.getState();
  const t = store.timeTotals();
  const acc = t.tasksWeek ? Math.round((t.correctWeek / t.tasksWeek) * 100) : null;

  const rows = [];
  const weak = [];
  for (const m of mods) {
    for (const sk of m.skills) {
      const s = st.skills[sk.id];
      if (!s || !s.total) continue;
      const pct = Math.round((s.firstTry / s.total) * 100);
      const cls = pct >= 75 ? '' : pct >= 50 ? 'mid' : 'low';
      if (s.total >= 3 && pct < 60) weak.push({ m, sk, pct });
      rows.push(h('div', { class: 'skillrow' },
        h('div', {}, h('div', { class: 'name' }, `${sk.name}`), h('div', { class: 'sub' }, `${m.title} · level ${s.level} of ${sk.maxLevel || 4} · ${s.total} ${s.total === 1 ? 'try' : 'tries'}`)),
        h('div', { class: 'bar' }, h('i', { class: cls, style: { width: `${pct}%` } })),
        h('div', { class: 'pct' }, `${pct}%`),
      ));
    }
  }

  const sharingSkills = mods[0].skills.map((sk) => st.skills[sk.id]).filter(Boolean);
  const sharingLevel = sharingSkills.length ? Math.round(sharingSkills.reduce((a, s) => a + s.level, 0) / sharingSkills.length) : 0;
  const sharingAcc = sharingSkills.reduce((a, s) => a + s.total, 0) ? Math.round((sharingSkills.reduce((a, s) => a + s.firstTry, 0) / sharingSkills.reduce((a, s) => a + s.total, 0)) * 100) : null;

  const homeTips = [];
  homeTips.push('At the table, ask her to share a pile of crackers, grapes or blocks equally between everyone. Then ask: "How many does each person get? Is it fair? How do you know?"');
  if (sharingAcc !== null && sharingAcc < 60) homeTips.push('She is still finding equal sharing tricky. Deal items out one at a time together, saying "one for you, one for me" out loud, then count each pile and compare.');
  if (sharingLevel >= 3) homeTips.push('She is ready for leftovers: share 7 biscuits between 2 people and talk about the one left over, then try 10 between 4.');
  if (sharingLevel >= 4) homeTips.push('Extension the teacher mentioned: share bigger numbers using groups of ten, such as 40 pegs between 4 people (a bag of 10 each).');
  for (const w of weak) {
    if (w.m.id === 'groups') homeTips.push(`Equal groups (${w.sk.name.toLowerCase()}): put socks in pairs or pegs in fives and count by 2s or 5s out loud together.`);
    if (w.m.id === 'numbers') homeTips.push(`Numbers to 120 (${w.sk.name.toLowerCase()}): count stairs, or point to house numbers and ask what comes before and after.`);
    if (w.m.id === 'addsub') homeTips.push(`Adding and taking away (${w.sk.name.toLowerCase()}): use fingers or a ten-frame egg carton; practise "make ten" (8 and 2, 7 and 3) and doubles (4 and 4).`);
  }

  const soundToggle = h('button', { class: 'btn btn-sm btn-ghost', onClick: (e) => { const p = store.getState().profile; p.sound = !p.sound; store.save(); setSound(p.sound); e.currentTarget.textContent = p.sound ? 'Sounds: on' : 'Sounds: off'; } }, st.profile.sound === false ? 'Sounds: off' : 'Sounds: on');
  const nameBtn = h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { const n = prompt('Child\'s first name', store.getName()); if (n && n.trim()) { store.setName(n); toast('Name updated'); } } }, 'Change name');
  const resetBtn = h('button', { class: 'btn btn-sm btn-ghost', onClick: () => { if (confirm('Erase all progress on this iPad? This cannot be undone.')) { store.reset(); show(home()); location.reload(); } } }, 'Erase progress');

  const s = h('div', { class: 'parent' },
    h('div', { class: 'topbar' },
      h('button', { class: 'icon-btn', 'aria-label': 'Back', onClick: () => show(home()) }, svg(icons.back)),
      h('div', { class: 'pill' }, svg(icons.lock), `Grown-ups · ${store.getName()}`),
      h('div', { class: 'spacer' }),
    ),
    h('div', { class: 'panel', dataset: { scroll: '1' } },
      h('div', { class: 'card' },
        h('h2', {}, 'This week'),
        h('div', { class: 'stat-row' },
          h('div', { class: 'stat' }, h('b', {}, fmtMin(t.today)), h('span', {}, 'Today')),
          h('div', { class: 'stat' }, h('b', {}, fmtMin(t.thisWeek)), h('span', {}, 'This week')),
          h('div', { class: 'stat' }, h('b', {}, acc === null ? '–' : `${acc}%`), h('span', {}, 'First-go accuracy')),
        ),
        h('p', { class: 'muted', style: { marginTop: '12px' } }, `${st.quests} quests finished all up · ${st.stars} stars · ${st.stickers.length} stickers. Daily goal is ${store.DAILY_QUESTS} short quests (about 5–10 minutes).`),
      ),
      pipNotesCard(),
      h('div', { class: 'card' },
        h('h2', {}, 'What to practise at home'),
        h('p', {}, h('b', {}, 'School topic this fortnight: sharing equally.'), ' The class is sharing collections (like 10 cookies) equally into 2, 5 or 1 group with counters and everyday objects, and explaining how they shared. Confident students extend to bigger numbers, up to 120.'),
        h('ul', {}, ...homeTips.map((tip) => h('li', {}, tip))),
        h('p', { class: 'muted' }, 'Tip: ask her to explain her thinking ("How did you share them?") more than you ask for the answer. That is the part the teacher is listening for.'),
      ),
      h('div', { class: 'card' },
        h('h2', {}, 'Where she is finding it tricky'),
        weak.length
          ? h('ul', {}, ...weak.map((w) => h('li', {}, h('span', { class: 'danger' }, `${w.sk.name}`), ` (${w.m.title}) — ${w.pct}% right first go. The app is giving her easier versions and extra practice of this one.`)))
          : h('p', { class: 'muted' }, rows.length ? 'Nothing flagged yet. Skills under 60% first-go accuracy (after at least 3 tries) show up here.' : 'No practice recorded yet. Play a quest first.'),
      ),
      h('div', { class: 'card' },
        h('h2', {}, 'Skill by skill'),
        rows.length ? h('div', {}, ...rows) : h('p', { class: 'muted' }, 'No data yet.'),
        h('p', { class: 'muted', style: { marginTop: '10px' } }, 'Accuracy = answered right on the first go. Levels move up after a run of first-go answers and down gently after repeated misses. Skills she wobbles on come back for a quick review a day or so later.'),
      ),
      h('div', { class: 'card' },
        h('h2', {}, 'Curriculum'),
        h('p', {}, 'Victorian Curriculum 2.0 Mathematics, Level 1: VC2M1N06 (equal sharing and grouping), VC2M1N03 (equal groups and skip counting), VC2M1N01 and VC2M1N02 (numbers to 120, tens and ones), VC2M1N04 (add and subtract within 20), VC2M1A01 (skip-counting patterns).'),
      ),
      h('div', { class: 'card' },
        h('h2', {}, 'Settings'),
        h('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } }, soundToggle, nameBtn, resetBtn),
        h('p', { class: 'muted', style: { marginTop: '10px' } }, `Voice: ${voiceInfo()}. Everything is stored only on this iPad. No accounts, no tracking, no internet needed after the first visit.`),
      ),
    ),
  );
  return s;
}

/* ---------- Pip's notes: one short summary per live session ---------- */
function pipNotesCard() {
  const hist = mem.getHistory().filter((s) => s.summary && s.mode !== 'practice').slice(-6).reverse();
  const fmtWhen = (s) => { const d = new Date(s.endedAt || s.startedAt || Date.now()); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' }); };
  const notes = hist.map((s) => h('div', { class: 'note' },
    h('div', { class: 'when' }, `${fmtWhen(s)} · ${Math.max(1, Math.round((s.seconds || 0) / 60))} min · ${s.mode === 'camera' ? 'camera' : 'whiteboard'}${s.helpTaps ? ` · asked Pip for help ${s.helpTaps} time${s.helpTaps === 1 ? '' : 's'}` : ''}${s.summary.auto ? ' · auto note' : ''}`),
    h('p', {}, h('b', {}, 'Did: '), s.summary.what_she_did),
    s.summary.what_clicked ? h('p', {}, h('b', {}, 'Clicked: '), s.summary.what_clicked) : null,
    s.summary.what_was_tricky ? h('p', {}, h('b', {}, 'Tricky: '), s.summary.what_was_tricky) : null,
    s.summary.home_activity ? h('p', {}, h('b', {}, 'Try at home (2 min): '), s.summary.home_activity) : null,
    s.summary.misconceptions?.length ? h('div', {}, ...s.summary.misconceptions.map((t) => h('span', { class: 'tag' }, t))) : null,
    h('p', { class: 'muted' }, s.sent === 'sent' ? 'Sent to your phone.' : s.sent === 'skipped' ? 'Saved (phone notifications not set up).' : s.sent ? 'Saved on this iPad only (could not send).' : ''),
  ));
  const profile = mem.getProfile();
  const learned = profile.learned.slice(-8).map((f) => `${f.kind}: ${f.text}`).join(' · ');
  return h('div', { class: 'card' },
    h('h2', {}, 'Pip\'s notes'),
    notes.length ? h('div', {}, ...notes) : h('p', { class: 'muted' }, 'After each chat with Pip a short note appears here: what she did, what clicked, what was tricky, and a two-minute thing to try at home.'),
    h('p', { class: 'muted', style: { marginTop: '10px' } }, learned ? `What Pip remembers about her: ${learned}` : 'Pip remembers her favourite things and family names as she learns them. A parent can also pre-fill js/profile-config.js.'),
    h('p', { class: 'muted' }, `Pip today: ${Math.round(mem.usageToday().seconds / 60)} min of ${mem.capState().minutesLeft + Math.round(mem.usageToday().seconds / 60) | 0} allowed, ${mem.usageToday().sessions} session${mem.usageToday().sessions === 1 ? '' : 's'}.`),
  );
}
