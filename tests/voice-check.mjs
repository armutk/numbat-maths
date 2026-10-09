// Offline voice check (no browser):  node tests/voice-check.mjs [--samples]
//  1. every clip in assets/voice/manifest.json exists, decodes (ffprobe), lasts 0.25-8 s and peaks below -1 dBFS
//  2. a corpus of generated sentences (every template x3 random fills + every fixed line + real app strings)
//     is fully covered by js/voice.js `resolve` (the pure resolver the browser uses)
//  3. --samples: render 5 listening samples to ~/Downloads/numbat-voice-samples/ (composed with the same timing as the app)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, schedule, coverage, useManifest } from '../js/voice.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VOICE = path.join(ROOT, 'assets/voice');
const man = JSON.parse(fs.readFileSync(path.join(VOICE, 'manifest.json'), 'utf8'));
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/voice-lines.json'), 'utf8'));
useManifest(man);
let failures = 0;
const fail = (m) => { failures++; console.log('FAIL', m); };

/* ---------- 1. files ---------- */
const files = new Set();
Object.values(man.clips).forEach((c) => files.add(c.file));
Object.values(man.numbers).forEach((f) => files.add(f));
Object.values(man.nouns).forEach((n) => Object.values(n).forEach((f) => files.add(f)));
function probeOne(f) {
  return new Promise((res) => {
    const p = path.join(VOICE, f);
    if (!fs.existsSync(p)) return res({ f, err: 'missing file' });
    const a = spawn('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,channels,sample_rate', '-of', 'json', p]);
    let o = ''; a.stdout.on('data', (d) => (o += d));
    a.on('close', (code) => {
      if (code) return res({ f, err: 'ffprobe failed' });
      let j; try { j = JSON.parse(o); } catch { return res({ f, err: 'ffprobe json' }); }
      const dur = Number(j.format && j.format.duration);
      const b = spawn('ffmpeg', ['-hide_banner', '-nostats', '-i', p, '-af', 'volumedetect', '-f', 'null', '-']);
      let e = ''; b.stderr.on('data', (d) => (e += d));
      b.on('close', () => res({ f, dur, peak: Number((/max_volume: (-?[\d.]+) dB/.exec(e) || [])[1]), codec: j.streams && j.streams[0] && j.streams[0].codec_name }));
    });
  });
}
const list = [...files];
const results = [];
let idx = 0;
await Promise.all(Array.from({ length: 8 }, async () => { while (idx < list.length) results.push(await probeOne(list[idx++])); }));
let bytes = 0, minD = 99, maxD = 0, maxPeak = -99;
for (const r of results) {
  if (r.err) { fail(`${r.f}: ${r.err}`); continue; }
  bytes += fs.statSync(path.join(VOICE, r.f)).size;
  minD = Math.min(minD, r.dur); maxD = Math.max(maxD, r.dur); maxPeak = Math.max(maxPeak, r.peak);
  if (r.codec !== 'mp3') fail(`${r.f}: codec ${r.codec}`);
  if (!(r.dur >= 0.25 && r.dur <= 8)) fail(`${r.f}: duration ${r.dur}`);
  if (!(r.peak < -1)) fail(`${r.f}: peak ${r.peak} dBFS`);
}
console.log(`files: ${results.length} checked, ${(bytes / 1048576).toFixed(2)} MB, duration ${minD.toFixed(2)}-${maxD.toFixed(2)} s, loudest peak ${maxPeak} dBFS`);
if (bytes > 3 * 1048576) fail(`total size ${bytes} over 3 MB`);
// every key a template/exact/slot refers to must exist
for (const [t, k] of Object.entries(man.exact)) if (!man.clips[k]) fail(`exact "${t}" -> missing clip ${k}`);
for (const t of man.templates) for (const s of t.segments) { const m = /^\+?(\{[a-z0-9]+\})$/.exec(s); const k = s.replace(/^\+/, ''); if (!m && !man.clips[k]) fail(`template "${t.pattern}" -> missing clip ${k}`); }
for (const [slot, tbl] of Object.entries(man.slots)) for (const k of Object.values(tbl)) if (!man.clips[k] && !/^n\d+$/.test(k)) fail(`slot ${slot} -> missing clip ${k}`);

/* ---------- 2. coverage corpus ---------- */
let seed = 42;
const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const numWords = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const nounForms = Object.values(L.nouns).flatMap(([o, m]) => [o, m].filter(Boolean));
const fill = (pattern) => pattern.replace(/\{([a-z0-9]+)\}/g, (_, s) => {
  if ('nkabcde'.includes(s) && s.length === 1) return String(Math.floor(rnd() * 121));
  if (s === 'many' || s === 'many2') return pick(nounForms);
  if (s === 'one') return pick(Object.values(L.nouns).map(([o]) => o));
  if (s === 'name') return pick(['Arisha', 'Sam', 'Mia']);
  if (s === 'list') return Array.from({ length: 3 + Math.floor(rnd() * 5) }, () => 1 + Math.floor(rnd() * 120)).join(', ');
  if (s === 'tens') return pick(['ten', 'tens']);
  if (s === 'ones') return pick(['one', 'ones']);
  return pick(Object.keys(L.slots[s] || { x: 1 }));
});
const corpus = [];
for (const e of L.inventory) {
  if (e.kind === 'template') for (let i = 0; i < 3; i++) corpus.push(fill(e.text));
  else if (e.kind === 'fixed') corpus.push(e.text);
  else if (e.kind === 'number-only') for (let i = 0; i < 2; i++) corpus.push(String(Math.floor(rnd() * 121)));
}
// real strings as the app builds them (multi-sentence, mixed slots)
const real = [
  "G'day Arisha! I'm Pip. Let's do some maths together.",
  'Share 12 Tim Tams between 3 friends. Give each friend the same.',
  "Share 7 cookies between 2 friends. Give each friend the same. If any are left over, put them in Pip's bowl.",
  'Put all 9 strawberries into one basket.',
  'Quick look back. Share 20 apples between 5 friends. Give each friend the same.',
  "Hmm. This friend has 4 and this friend has 2. That's not the same. Move some so each friend has the same.",
  "Each friend has the same, but Pip's bowl should have 1. Pop the extra one in the bowl.",
  "Every friend has 3, and 1 left over for Pip. That's fair!",
  '12 cookies shared between 3 friends is 4 each. Great sharing!',
  '7 cookies shared between 2 friends is 3 each, with 1 left over. Great sharing!',
  "You've done your maths for today, Arisha! Play more if you like.",
  "Done for today! That's your maths done for today, Arisha. You earned 5 stars. You found a new sticker: a koala!",
  'Perfect! You earned 1 star. Every one first go! You found a new sticker: a echidna!',
  'Great work! You earned 3 stars. And you moved up a level!',
  'Level up! Sharing between 3, 4 or 5 is getting easier for you.',
  'You have 1 sticker. Finish your maths each day to find more.',
  'Here are 3 orange beads. Tap 4 empty spots to add 4 blue.',
  'There are 7 orange buttons and 5 blue buttons. How many buttons altogether?',
  'There are 12 fish. 5 swim away. Tap 5 fish to take them away.',
  '3 take away 1. How many fish are left?',
  '14 take away 5. Think: 5 and how many make 14?',
  '5 and 9 make 14, so 14 take away 5 is 9.',
  'The first frame is full. That is 10. Now count on 3.',
  '8 plus 5 is the same as 10 plus 3. How many altogether?',
  "That's 3 tens and 4 ones. That makes 34. We need 2 more tens.",
  "13 is 1 ten and 3 ones.",
  "That's 1 ten and no ones. That makes 10. We need 3 more ones.",
  '14, 41, 67, 105. Smallest to biggest!',
  '5, 10, 15, 20, 25, 30, 35. We count in 5s.',
  '3 groups of 2 is 6.',
  '4 tens and 7 ones is 47.',
  'Put the 12 lollies in bags of 4. How many bags do you fill?',
  '12 lollies in bags of 4 makes 3 bags.',
  '3 bags of 4, and 1 left over.',
  'What number is between 38 and 40?',
  '120', '17', 'ten', 'one',
  'Put 5 stars in each hand.',
  'Count the lollies in fives. Tap each hand.',
];
corpus.push(...real);
let covered = 0;
const misses = [];
for (const t of corpus) {
  const r = resolve(t, man);
  const c = coverage(t);
  if (r.ok && r.items.length && c.ok && r.items.every((it) => files.has(it.file))) covered++;
  else misses.push({ text: t, missing: r.missing });
}
for (const m of misses.slice(0, 25)) fail(`not covered: "${m.text}" missing ${JSON.stringify(m.missing)}`);
// negative control: unknown text must be reported, not silently ok
if (resolve('Quantum banana split galaxy.', man).ok) fail('negative control: unknown text reported as covered');
console.log(`coverage: ${covered}/${corpus.length} sample sentences fully covered (${L.inventory.filter((e) => e.kind === 'template').length} templates x3, ${L.inventory.filter((e) => e.kind === 'fixed').length} fixed lines, ${real.length} real app strings)`);

/* ---------- 3. samples ---------- */
function ff(argv) { const r = spawnSync('ffmpeg', ['-hide_banner', '-nostats', '-y', ...argv], { encoding: 'utf8' }); if (r.status) throw new Error(r.stderr.slice(-400)); }
function dur(f) { return Number(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f], { encoding: 'utf8' }).stdout); }
function compose(text, outFile) {
  const plan = resolve(text, man);
  if (!plan.ok) throw new Error('sample not covered: ' + text);
  const paths = plan.items.map((it) => path.join(VOICE, it.file));
  const d = paths.map(dur);
  const st = schedule(plan.items, (i) => d[i]);
  const inputs = paths.flatMap((p) => ['-i', p]);
  const parts = st.map((t, i) => `[${i}:a]adelay=${Math.round(t * 1000)}:all=1[a${i}]`);
  const mix = `${st.map((_, i) => `[a${i}]`).join('')}amix=inputs=${st.length}:normalize=0:duration=longest[o]`;
  ff([...inputs, '-filter_complex', `${parts.join(';')};${mix}`, '-map', '[o]', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '96k', outFile]);
  return { clips: st.length, seconds: Math.max(...st.map((t, i) => t + d[i])) };
}
if (process.argv.includes('--samples')) {
  const dir = path.join(os.homedir(), 'Downloads/numbat-voice-samples');
  fs.mkdirSync(dir, { recursive: true });
  const out = [];
  const one = (name, text) => { const f = path.join(dir, name); const r = compose(text, f); out.push(f); console.log(`sample ${name}: "${text}" -> ${r.clips} clips, ${r.seconds.toFixed(2)} s`); };
  one('1-greeting.mp3', "G'day Arisha! I'm Pip. Let's do some maths together.");
  one('2-share-12-tim-tams-between-3-friends.mp3', 'Share 12 Tim Tams between 3 friends. Give each friend the same.');
  one('3-praise-spot-on.mp3', 'Spot on!');
  one('4-encouragement.mp3', "Nearly! Let's look again.");
  one('5-number-120.mp3', '120');
}

console.log(failures ? `\nRESULT: ${failures} failure(s)` : '\nRESULT: all checks passed');
process.exit(failures ? 1 : 0);
