#!/usr/bin/env node
// Re-render Pip's ENTIRE offline voice set in one consistent voice (kokoro-af_heart, local):
// every word/phrase/number/noun clip AND every whole sentence from tools/inventory.json
// (pure counting-list lines excluded — they play via number clips by design).
//
//   node tools/gen-voice2.mjs --tasks      build tools/.voice-work/v2/tasks.json from inventory + voice-lines
//   node tools/gen-voice2.mjs --tts        render raw WAVs with kokoro (python venv, multiprocess)
//   node tools/gen-voice2.mjs --post       ffmpeg chain (identical to gen-sentences.mjs) -> assets/voice
//   node tools/gen-voice2.mjs --manifest   rewrite assets/voice/manifest.json
//   node tools/gen-voice2.mjs --audit      per-file verify + internal-silence sample (200 random)
//   node tools/gen-voice2.mjs --all        tasks -> tts -> post -> manifest -> audit (for a background run)
//   --retry=N                              re-render files that failed audit, up to N rounds (default 3)
//
// Sentence key/file naming is EXACTLY js/voice.js sentenceKey + tools/gen-sentences.mjs fileFor:
// sent/<sha1-10 of sentenceKey>.mp3 (sentenceKey keeps punctuation, folds quotes/ellipsis/whitespace).
// Clip keys and filenames are unchanged from the ElevenLabs set (manifest.clips keys identical).
// Kokoro: voice=af_heart, speed=1.0 (default), lang=en-us. Winner decision: see
// tools/voice-judge/WINNER.md addendum. ffmpeg chain mirrors tools/gen-sentences.mjs:
// edge trim (-45dB, keep 0.06s), loudnorm I=-18 TP=-1.5 (2-pass linear), alimiter 0.78,
// apad 0.27s, mono 44.1kHz mp3. Bitrate 64k unless total would exceed ~90MB, then 48k
// (computed from rendered raw durations; recorded in the manifest report).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/voice');
const WORK = path.join(ROOT, 'tools/.voice-work/v2');
const RAW = path.join(WORK, 'raw');
const TASKS = path.join(WORK, 'tasks.json');
const MAN = path.join(OUT, 'manifest.json');
const LINES = path.join(ROOT, 'tools/voice-lines.json');
const INVENTORY = path.join(ROOT, 'tools/inventory.json');
const KOKORO = '/home/impmaster/Work/voice-bakeoff/models/kokoro-v1.0.onnx';
const VOICES = '/home/impmaster/Work/voice-bakeoff/models/voices-v1.0.bin';
const PY = '/home/impmaster/Work/voice-bakeoff/.venv/bin/python3';
const TTS_WORKERS = 8;
const POST_WORKERS = 3;
const RETRIES = Number((process.argv.find((a) => a.startsWith('--retry=')) || '').split('=')[1]) || 3;
const BITRATE_MAX_BYTES = 90 * 1024 * 1024;

const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n) || argv.includes('--all');
const opt = (n, d = '') => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
const LIST = opt('list');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- key/file naming (mirror js/voice.js + gen-sentences.mjs) ---------- */
const skey = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();
const fileFor = (s) => 'sent/' + crypto.createHash('sha1').update(skey(s)).digest('hex').slice(0, 10) + '.mp3';
const isCountingList = (s) => /^[\d,\s]+$/.test(s.replace(/[.!?]+$/, ''));

/* ---------- task list ---------- */
function buildTasks() {
  const L = JSON.parse(fs.readFileSync(LINES, 'utf8'));
  const inv = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'));
  const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  const tasks = [];
  if (LIST) {
    const source = JSON.parse(fs.readFileSync(path.resolve(ROOT, LIST), 'utf8'));
    const unique = [...new Set(source.map((s) => String(s).replace(/\s+/g, ' ').trim()).filter(Boolean))];
    for (const s of unique) {
      if (isCountingList(s)) continue;
      const f = fileFor(s);
      tasks.push({ key: 'sent:' + f.slice(5, 15), text: s, kind: 'sentence', file: f });
    }
    fs.mkdirSync(WORK, { recursive: true });
    fs.writeFileSync(TASKS, JSON.stringify({ excludedCountingLists: unique.length - tasks.length, tasks }));
    console.log(`tasks: ${tasks.length} release sentences from ${LIST}`);
    return;
  }
  // word/phrase/number/noun clips — same derivation as tools/gen-voice.mjs, keys unchanged
  L.numbers.forEach((t, i) => tasks.push({ key: 'n' + i, text: t, kind: 'clip', file: 'n' + i + '.mp3' }));
  for (const [id, [one, many]] of Object.entries(L.nouns)) {
    tasks.push({ key: `noun-${id}-one`, text: one, kind: 'clip', file: `noun-${id}-one.mp3` });
    if (many && many !== one) tasks.push({ key: `noun-${id}-many`, text: many, kind: 'clip', file: `noun-${id}-many.mp3` });
  }
  for (const [key, text] of Object.entries(L.segments)) tasks.push({ key, text, kind: 'clip', file: key + '.mp3' });
  // whole sentences (counting-list lines keep playing via number clips)
  const clipTexts = new Set(tasks.map((t) => t.text));
  let excluded = 0;
  for (const s of inv.sentences) {
    if (isCountingList(s)) { excluded++; continue; }
    const f = fileFor(s);
    tasks.push({ key: 'sent:' + f.slice(5, 15), text: s, kind: 'sentence', file: f });
    clipTexts.add(s);
  }
  // safety: the 44 previously recorded sentences must all be covered
  for (const k of Object.keys(man.sentences || {})) {
    if (!tasks.some((t) => t.kind === 'sentence' && skey(t.text) === k))
      throw new Error(`previous sentence not in task set: ${k}`);
  }
  fs.writeFileSync(TASKS, JSON.stringify({ excludedCountingLists: excluded, tasks }));
  const clips = tasks.filter((t) => t.kind === 'clip').length;
  const sents = tasks.length - clips;
  console.log(`tasks: ${tasks.length} (${clips} clips, ${sents} sentences); counting-list lines excluded: ${excluded}`);
}

const loadTasks = () => JSON.parse(fs.readFileSync(TASKS, 'utf8'));
const rawPath = (t) => path.join(RAW, t.file.replace(/\//g, '__') + '.wav');
const outPath = (t) => path.join(OUT, t.file);

/* ---------- kokoro TTS (python helper, multiprocess) ---------- */
const PYSCRIPT = `
import json, os, sys, wave, time
from multiprocessing import Pool
from kokoro_onnx import Kokoro
KOKORO = "${KOKORO}"; VOICES = "${VOICES}"; RAW = "${RAW}"
kokoro = None
def init():
    global kokoro
    kokoro = Kokoro(KOKORO, VOICES)
def render(t):
    out = os.path.join(RAW, t["file"].replace("/", "__") + ".wav")
    if os.path.exists(out) and os.path.getsize(out) > 1000:
        return None
    for attempt in range(3):
        try:
            samples, sr = kokoro.create(t["text"], voice="af_heart", speed=1.0, lang="en-us")
            if len(samples) < sr * 0.1 or not (samples.max() > 1e-4):
                raise RuntimeError("empty/flat audio")
            w = wave.open(out + ".tmp", "wb"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
            w.writeframes((samples * 32767).astype("int16").tobytes()); w.close()
            os.replace(out + ".tmp", out)
            return None
        except Exception as e:
            if attempt == 2: return {"key": t["key"], "err": str(e)[:200]}
            time.sleep(0.5)
if __name__ == "__main__":
    tasks = [t for t in json.load(open(sys.argv[1]))["tasks"]
             if not os.path.exists(os.path.join(RAW, t["file"].replace("/", "__") + ".wav"))
             or os.path.getsize(os.path.join(RAW, t["file"].replace("/", "__") + ".wav")) < 1000]
    print(f"kokoro: {len(tasks)} to render", flush=True)
    fails = []
    with Pool(${TTS_WORKERS}, initializer=init) as p:
        for i, r in enumerate(p.imap_unordered(render, tasks, chunksize=8)):
            if r: fails.append(r); print("FAIL", r["key"], r["err"], flush=True)
            if (i + 1) % 200 == 0: print(f"  {i + 1}/{len(tasks)}", flush=True)
    json.dump(fails, open(os.path.join(RAW, "failed.json"), "w"))
    print(f"kokoro done, failures: {len(fails)}", flush=True)
`;
async function run(cmd, a, cwd) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'], cwd });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res({ out, err }) : rej(new Error(`${cmd} exit ${c}: ${err.slice(-300)}`))));
  });
}
async function doTts() {
  fs.mkdirSync(RAW, { recursive: true });
  fs.writeFileSync(path.join(WORK, 'kokoro-batch.py'), PYSCRIPT);
  for (let round = 1; round <= RETRIES + 1; round++) {
    const { out } = await run(PY, [path.join(WORK, 'kokoro-batch.py'), TASKS]);
    console.log(out.trim().split('\n').slice(-2).join('\n'));
    const fails = JSON.parse(fs.readFileSync(path.join(RAW, 'failed.json'), 'utf8'));
    if (!fails.length) { console.log('tts: all raw files rendered'); return; }
    console.log(`tts round ${round}: ${fails.length} failures, retrying (max ${RETRIES} rounds)`);
  }
  throw new Error('tts: failures remain after retries (see raw/failed.json)');
}

/* ---------- ffmpeg post (identical chain to gen-sentences.mjs) ---------- */
const TRIM = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.06,areverse';
const ffprobe1 = (f) => run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', f]);
const volume1 = (f) => run('ffmpeg', ['-hide_banner', '-nostats', '-i', f, '-af', 'volumedetect', '-f', 'null', '-']);
async function probe(f) {
  const { out } = await ffprobe1(f);
  const { err } = await volume1(f);
  const peak = Number((/max_volume: (-?[\d.]+) dB/.exec(err) || [])[1]);
  return { dur: Math.round(Number(out) * 1000) / 1000, peak: Number.isFinite(peak) ? peak : -99 };
}
async function process1(t, bitrate) {
  const src = rawPath(t), dst = outPath(t);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', `${TRIM},loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  let m = null; try { m = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)); } catch {}
  const loud = m && Number(m.input_i) > -60
    ? `loudnorm=I=-18:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : 'volume=0dB';
  let trim = 0;
  for (let pass = 0; pass < 3; pass++) {
    const vol = trim ? `,volume=${trim.toFixed(2)}dB` : '';
    await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', src, '-af', `${TRIM},${loud},alimiter=limit=0.78:attack=2:release=30:level=disabled${vol},apad=whole_dur=0.27`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', bitrate, '-map_metadata', '-1', dst + '.tmp.mp3']);
    const v = await volume1(dst + '.tmp.mp3');
    const peak = Number((/max_volume: (-?[\d.]+) dB/.exec(v.err) || [])[1]);
    if (!(peak > -1.6)) break; trim -= peak + 2.2;
  }
  fs.renameSync(dst + '.tmp.mp3', dst);
}
async function pool(items, n, fn) {
  let i = 0, done = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      await fn(items[i++]);
      if (++done % 500 === 0) console.log(`  ${done}/${items.length}`);
    }
  }));
}
async function doPost() {
  const { tasks } = loadTasks();
  const missing = tasks.filter((t) => !fs.existsSync(outPath(t)) || fs.statSync(outPath(t)).size < 500);
  if (!missing.length) { console.log('post: nothing to do'); return; }
  // bitrate: total raw duration -> 64k unless it would exceed the size cap
  let totalDur = 0;
  await pool(tasks, 16, async (t) => {
    if (!fs.existsSync(rawPath(t))) return;
    const { out } = await ffprobe1(rawPath(t));
    totalDur += Number(out) || 0;
  });
  const est64 = totalDur * 64000 / 8;
  const bitrate = est64 > BITRATE_MAX_BYTES ? '48k' : '64k';
  const estMb = (totalDur * Number(bitrate.slice(0, -1)) * 1000 / 8 / 1048576).toFixed(1);
  fs.writeFileSync(path.join(WORK, 'bitrate.txt'), bitrate);
  console.log(`post: ${missing.length} files; raw total ${totalDur.toFixed(0)}s; ${bitrate} -> est ${estMb} MB`);
  for (let round = 1; round <= RETRIES + 1; round++) {
    const fail = [];
    await pool(missing, POST_WORKERS, async (t) => {
      try { await process1(t, bitrate); } catch (e) { fail.push({ key: t.key, err: String(e.message).slice(0, 200) }); }
    });
    if (!fail.length) { console.log('post: all encoded'); return; }
    console.log(`post round ${round}: ${fail.length} failures` + (round <= RETRIES ? ', retrying' : ''));
    missing.length = 0; missing.push(...fail.map((f) => tasks.find((t) => t.key === f.key)));
    if (round > RETRIES) { fs.writeFileSync(path.join(WORK, 'post-failed.json'), JSON.stringify(fail)); throw new Error('post: failures remain'); }
  }
}

/* ---------- manifest ---------- */
async function doManifest() {
  const { tasks, excludedCountingLists } = loadTasks();
  const prev = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  const man = {
    version: 2,
    voice: { name: 'Kokoro af_heart', engine: 'kokoro-onnx v1.0 (local)', model: 'kokoro-v1.0', settings: { voice: 'af_heart', speed: 1.0, lang: 'en-us' } },
    gaps_ms: prev.gaps_ms,
    clips: {}, numbers: prev.numbers, nouns: prev.nouns, nounForms: prev.nounForms,
    names: prev.names, slots: prev.slots, exact: prev.exact, templates: prev.templates, preload: prev.preload,
    sentences: {},
  };
  await pool(tasks, 16, async (t) => {
    const { dur } = await probe(outPath(t));
    if (t.kind === 'clip') man.clips[t.key] = { file: t.file, text: t.text, dur };
    else man.sentences[skey(t.text)] = t.file;
  });
  fs.writeFileSync(MAN, JSON.stringify(man));
  const files = fs.readdirSync(OUT, { recursive: true }).filter((f) => f.endsWith('.mp3'));
  const bytes = files.reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0);
  console.log(`manifest: version 2, clips ${Object.keys(man.clips).length}, numbers ${Object.keys(man.numbers).length}, sentences ${Object.keys(man.sentences).length}; files ${files.length}, ${(bytes / 1048576).toFixed(1)} MB; counting lists excluded ${excludedCountingLists}`);
}

async function mergeManifest() {
  const { tasks } = loadTasks();
  const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
  man.sentences = man.sentences || {};
  for (const task of tasks) {
    if (!fs.existsSync(outPath(task))) throw new Error(`missing encoded voice file: ${task.file}`);
    man.sentences[skey(task.text)] = task.file;
  }
  fs.writeFileSync(MAN, JSON.stringify(man));
  console.log(`manifest: merged ${tasks.length} release sentences; total ${Object.keys(man.sentences).length}`);
}

/* ---------- audit ---------- */
async function audit() {
  const { tasks } = loadTasks();
  const bad = [];
  await pool(tasks, 16, async (t) => {
    try {
      const { dur, peak } = await probe(outPath(t));
      if (!(dur > 0.05)) bad.push({ key: t.key, why: `duration ${dur}` });
      if (!(peak <= -0.5)) bad.push({ key: t.key, why: `peak ${peak} dBFS` });
    } catch (e) { bad.push({ key: t.key, why: String(e.message).slice(0, 120) }); }
  });
  // internal-silence sample: 200 random files, any silent stretch >600ms that is not at an edge
  const rnd = (n) => Math.floor(Math.random() * n);
  const sample = Array.from({ length: 200 }, () => tasks[rnd(tasks.length)]);
  let silBad = 0;
  await pool(sample, 12, async (t) => {
    const { out } = await ffprobe1(outPath(t));
    const dur = Number(out);
    const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', outPath(t), '-af', 'silencedetect=noise=-35dB:d=0.6', '-f', 'null', '-']);
    const starts = [...err.matchAll(/silence_start: ([\d.]+)/g)].map((m) => Number(m[1]));
    const ends = [...err.matchAll(/silence_end: ([\d.]+)/g)].map((m) => Number(m[1]));
    for (let i = 0; i < starts.length; i++) {
      const e = ends[i] ?? dur;
      const internal = starts[i] > 0.15 && e < dur - 0.15; // edges hold only the 0.06s trim pad
      if (internal) { silBad++; bad.push({ key: t.key, why: `internal silence ${starts[i]}-${e}` }); }
    }
  });
  fs.writeFileSync(path.join(WORK, 'audit.json'), JSON.stringify(bad, null, 1));
  console.log(`audit: ${tasks.length} files, ${bad.length - silBad} duration/peak failures, ${silBad} internal-silence failures (sample ${sample.length})`);
  return bad;
}

/* ---------- retry loop over audit failures ---------- */
async function retryBad() {
  const { tasks } = loadTasks();
  for (let round = 1; round <= RETRIES; round++) {
    const bad = JSON.parse(fs.readFileSync(path.join(WORK, 'audit.json'), 'utf8'));
    if (!bad.length) return;
    const keys = new Set(bad.map((b) => b.key));
    const redo = tasks.filter((t) => keys.has(t.key));
    console.log(`retry round ${round}: re-rendering ${redo.length} files`);
    const bitrate = fs.existsSync(path.join(WORK, 'bitrate.txt')) ? fs.readFileSync(path.join(WORK, 'bitrate.txt'), 'utf8').trim() : '64k';
    const still = [];
    for (const t of redo) {
      try { fs.rmSync(rawPath(t), { force: true }); } catch {}
    }
    fs.writeFileSync(path.join(RAW, 'retry-keys.json'), JSON.stringify(redo.map((t) => t.key)));
    // single-process kokoro render for the retries (small batch)
    await run(PY, ['-c', `
import json, os, sys
sys.path.insert(0, ${JSON.stringify(WORK)})
import importlib.util
spec = importlib.util.spec_from_file_location("kb", ${JSON.stringify(path.join(WORK, 'kokoro-batch.py'))})
kb = importlib.util.module_from_spec(spec); spec.loader.exec_module(kb)
from multiprocessing import Pool
tasks = {t["key"]: t for t in json.load(open(${JSON.stringify(TASKS)}))["tasks"]}
todo = [tasks[k] for k in json.load(open(os.path.join(kb.RAW, "retry-keys.json")))]
with Pool(${TTS_WORKERS}, initializer=kb.init) as p:
    for r in p.imap_unordered(kb.render, todo):
        if r: print("FAIL", r["key"], r["err"], flush=True)
print("retry tts done", flush=True)`]);
    for (const t of redo) {
      try { await process1(t, bitrate); } catch (e) { still.push({ key: t.key, why: String(e.message).slice(0, 120) }); }
    }
    // re-audit the redone set
    for (const t of redo) {
      try {
        const { dur, peak } = await probe(outPath(t));
        if (!(dur > 0.05) || !(peak <= -0.5)) still.push({ key: t.key, why: `still bad dur=${dur} peak=${peak}` });
      } catch (e) { still.push({ key: t.key, why: String(e.message).slice(0, 120) }); }
    }
    fs.writeFileSync(path.join(WORK, 'audit.json'), JSON.stringify(still, null, 1));
    if (!still.length) { console.log(`retry round ${round}: all clean`); return; }
    console.log(`retry round ${round}: ${still.length} still failing`);
  }
  console.log('WARNING: some files never passed audit (see audit.json)');
}

/* ---------- main ---------- */
if (flag('tasks')) buildTasks();
if (flag('tts')) await doTts();
if (flag('post')) await doPost();
if (flag('manifest')) await doManifest();
if (flag('merge-manifest')) await mergeManifest();
if (argv.includes('--audit')) await audit();
if (argv.includes('--retry')) await retryBad();
