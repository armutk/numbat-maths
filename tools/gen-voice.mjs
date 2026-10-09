#!/usr/bin/env node
// Generate Pip's offline voice clips with ElevenLabs, post-process with ffmpeg, write the manifest + report.
//
//   ELEVENLABS_API_KEY=... node tools/gen-voice.mjs            generate everything that is missing
//   node tools/gen-voice.mjs --dry                             list jobs + character count, no API calls
//   node tools/gen-voice.mjs --process-only                    skip the API, post-process raw files already in the work dir
//   node tools/gen-voice.mjs --raw-only                        call the API only (no ffmpeg), e.g. on a box without ffmpeg
//   node tools/gen-voice.mjs --only=n12,tap                    restrict the run to these keys (trial)
//   node tools/gen-voice.mjs --force=n7,tap                    regenerate these clip keys
//   node tools/gen-voice.mjs --manifest-only                   rebuild manifest + report from files already in assets/voice
//
// Env: ELEVENLABS_API_KEY (never printed), VOICE_WORK (raw mp3 dir), VOICE_OUT (default assets/voice).
// Node 20+, no dependencies. Needs ffmpeg + ffprobe unless --raw-only.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.env.VOICE_OUT || path.join(ROOT, 'assets/voice');
const WORK = process.env.VOICE_WORK || path.join(ROOT, 'tools/.voice-work');
const LINES = path.join(ROOT, 'tools/voice-lines.json');
const REPORT = path.join(ROOT, 'tools/voice-report.json');
const args = new Set(process.argv.slice(2).filter((a) => !a.includes('=')));
const kv = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes('=')).map((a) => a.replace(/^--/, '').split('=')));
const FORCE = new Set((kv.force || '').split(',').filter(Boolean));
const CONCURRENCY = 4;

const L = JSON.parse(fs.readFileSync(LINES, 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(WORK, { recursive: true });

/* ---------- job list ---------- */
const jobs = new Map(); // key -> { key, file, text }
const addJob = (key, text) => { if (!jobs.has(key)) jobs.set(key, { key, file: key + '.mp3', text }); };
L.numbers.forEach((t, i) => addJob('n' + i, t));
const nounFile = {}; // id -> { one, many }
for (const [id, [one, many]] of Object.entries(L.nouns)) {
  const o = `noun-${id}-one`;
  addJob(o, one);
  nounFile[id] = { one: o + '.mp3' };
  if (many) {
    if (many === one) nounFile[id].many = nounFile[id].one;
    else { addJob(`noun-${id}-many`, many); nounFile[id].many = `noun-${id}-many.mp3`; }
  }
}
for (const [key, text] of Object.entries(L.segments)) addJob(key, text);
const ONLY = new Set((kv.only || '').split(',').filter(Boolean));
const list = [...jobs.values()].filter((j) => !ONLY.size || ONLY.has(j.key));
const totalChars = list.reduce((a, j) => a + j.text.length, 0);

/* ---------- helpers ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(cmd, argv) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('error', reject);
    p.on('close', (code) => (code === 0 ? resolve({ out, err }) : reject(new Error(`${cmd} exit ${code}: ${err.slice(-400)}`))));
  });
}
const rawPath = (j) => path.join(WORK, j.file);
const outPath = (j) => path.join(OUT, j.file);

let langOk = true; // eleven_multilingual_v2 may reject language_code; fall back once
async function tts(text) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${L.voice.voice_id}?output_format=${L.voice.output_format}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    const body = { text, model_id: L.voice.model_id, voice_settings: L.voice.voice_settings };
    if (langOk && L.voice.language_code) body.language_code = L.voice.language_code;
    let res;
    try {
      res = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify(body) });
    } catch (e) { await sleep(1000 * 2 ** attempt); continue; }
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const msg = (await res.text()).slice(0, 300);
    if (res.status === 400 && langOk && /language/i.test(msg)) { langOk = false; console.log('note: model rejected language_code, continuing without it'); continue; }
    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after')) || 0;
      await sleep(Math.max(ra * 1000, 1000 * 2 ** attempt));
      continue;
    }
    throw new Error(`ElevenLabs ${res.status}: ${msg.replace(/xi-api-key\S*/gi, '')}`);
  }
  throw new Error('ElevenLabs: gave up after retries');
}

async function pool(items, n, fn) {
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const job = items[i++];
      await fn(job);
      done++;
      if (done % 25 === 0) console.log(`  ${done}/${items.length}`);
    }
  }));
}

/* ---------- ffmpeg post-processing ---------- */
const TRIM = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.06,areverse';
async function measure(file) {
  // loudnorm pass 1 (on the trimmed audio)
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', `${TRIM},loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  const m = err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1);
  try { return JSON.parse(m); } catch { return null; }
}
async function process1(j) {
  const src = rawPath(j), dst = outPath(j);
  const m = await measure(src);
  let loud;
  const ok = m && Number.isFinite(Number(m.input_i)) && Number(m.input_i) > -60;
  if (ok) {
    loud = `loudnorm=I=-18:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  } else {
    // very short clip: loudnorm cannot gate it. Fall back to a gain from the mean level (target about -21 dB mean).
    const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', `${TRIM},volumedetect`, '-f', 'null', '-']);
    const mean = Number((/mean_volume: (-?[\d.]+) dB/.exec(err) || [])[1]);
    loud = `volume=${Number.isFinite(mean) ? (-21 - mean).toFixed(2) : 0}dB`;
  }
  const tmp = dst + '.tmp.mp3';
  let trim = 0; // extra attenuation if the mp3 encode overshoots (peak must stay below -1 dBFS)
  for (let pass = 0; pass < 3; pass++) {
    const vol = trim ? `,volume=${trim.toFixed(2)}dB` : '';
    await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', src, '-af', `${TRIM},${loud},alimiter=limit=0.78:attack=2:release=30:level=disabled${vol},apad=whole_dur=0.27`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', tmp]);
    const { peak } = await probe(tmp);
    if (!(peak > -1.6)) break;
    trim -= peak + 2.2;
  }
  fs.renameSync(tmp, dst);
}
async function probe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file]);
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'volumedetect', '-f', 'null', '-']);
  const peak = Number((/max_volume: (-?[\d.]+) dB/.exec(err) || [])[1]);
  return { dur: Math.round(Number(out) * 1000) / 1000, peak };
}

/* ---------- main ---------- */
const prevReport = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : { clips: {} };
const report = { generated: new Date().toISOString(), voice: L.voice, clips: prevReport.clips || {} };

if (args.has('--dry')) {
  const missing = list.filter((j) => !fs.existsSync(rawPath(j)) && !fs.existsSync(outPath(j)));
  console.log(`clips: ${list.length}, characters in full set: ${totalChars}, still to generate: ${missing.length} clips / ${missing.reduce((a, j) => a + j.text.length, 0)} chars`);
  process.exit(0);
}

let charsSpent = 0, fetched = 0;
if (!args.has('--process-only') && !args.has('--manifest-only')) {
  const todo = list.filter((j) => FORCE.has(j.key) || (!fs.existsSync(rawPath(j)) && !(fs.existsSync(outPath(j)) && !FORCE.has(j.key))));
  console.log(`generating ${todo.length} of ${list.length} clips (${todo.reduce((a, j) => a + j.text.length, 0)} characters)`);
  await pool(todo, CONCURRENCY, async (j) => {
    const buf = await tts(j.text);
    fs.writeFileSync(rawPath(j), buf);
    charsSpent += j.text.length; fetched++;
    if (!args.has('--raw-only')) {
      try { await process1(j); } catch (e) { console.error('ffmpeg failed for', j.key, e.message); }
    }
  });
}

if (!args.has('--raw-only')) {
  const need = list.filter((j) => fs.existsSync(rawPath(j)) && (FORCE.has(j.key) || !fs.existsSync(outPath(j))));
  if (need.length) { console.log(`post-processing ${need.length} clips`); await pool(need, CONCURRENCY, process1); }
  // measure + report
  const toMeasure = list.filter((j) => fs.existsSync(outPath(j)) && (FORCE.has(j.key) || !report.clips[j.key] || report.clips[j.key].text !== j.text || args.has('--manifest-only') || need.includes(j)));
  await pool(toMeasure, CONCURRENCY, async (j) => {
    const { dur, peak } = await probe(outPath(j));
    report.clips[j.key] = { file: j.file, text: j.text, chars: j.text.length, dur, peak, ok: dur >= 0.25 && dur <= 8 && peak < -1 };
  });

  // manifest
  const clips = {};
  for (const j of list) if (report.clips[j.key]) clips[j.key] = { file: j.file, text: j.text, dur: report.clips[j.key].dur };
  const numbers = Object.fromEntries(L.numbers.map((_, i) => [String(i), `n${i}.mp3`]));
  const nouns = nounFile;
  const nounForms = Object.fromEntries(Object.entries(L.nouns).map(([id, [one, many]]) => [id, { one, ...(many ? { many } : {}) }]));
  const exact = {};
  const templates = [];
  for (const e of L.inventory) {
    // A fixed sentence is one whole clip. If it is built from several segments or has slots it must be a template
    // (give the entry a `pattern`), otherwise the exact map would play only its first segment (the old clipped-line bug).
    const multi = e.segments.length > 1 || e.segments.some((x) => x.startsWith('{') || x.startsWith('+'));
    if (e.kind === 'fixed' && !multi) exact[e.text] = e.segments[0];
    else if (e.kind === 'fixed' || e.kind === 'template') {
      if (e.kind === 'fixed' && !e.pattern) throw new Error(`fixed sentence "${e.text}" has several segments: add a "pattern" with slots`);
      templates.push({ pattern: e.pattern || e.text, segments: e.segments });
    }
  }
  const manifest = {
    version: 1, voice: L.voice.name, gaps_ms: L.gaps_ms,
    clips, numbers, nouns, nounForms, names: L.names, slots: L.slots, exact, templates, preload: L.preload,
  };
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  const files = fs.readdirSync(OUT).filter((f) => f.endsWith('.mp3'));
  const bytes = files.reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  report.summary = { clips: Object.keys(report.clips).length, files: files.length, bytes, chars: Object.values(report.clips).reduce((a, c) => a + c.chars, 0), bad: Object.entries(report.clips).filter(([, c]) => !c.ok).map(([k]) => k) };
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
  console.log(`manifest written: ${files.length} files, ${(bytes / 1024).toFixed(0)} KB, not-ok clips: ${report.summary.bad.length ? report.summary.bad.join(', ') : 'none'}`);
}
console.log(`characters sent to ElevenLabs this run: ${charsSpent} (${fetched} clips). Characters in the full clip set: ${totalChars}.`);
