#!/usr/bin/env node
// Record WHOLE sentences (one mp3 each, natural prosody, no word stitching) with the same ElevenLabs voice as the word clips.
//
//   ELEVENLABS_API_KEY=... node tools/gen-sentences.mjs --list=tools/sentences.tasks.json --max-chars=300
//   node tools/gen-sentences.mjs --dry                 count characters, no API calls
//   --pick=short-stitched|all   which sentences to record first (default: stitched sentences, shortest first)
//   --max-chars=N               hard cap on characters sent in this run (the account has a monthly quota!)
//   --rebuild                   only rewrite manifest.sentences from files already in assets/voice/sent
//
// Output: assets/voice/sent/<sha1-10>.mp3 and manifest.sentences { sentenceKey: "sent/<hash>.mp3" } (see js/voice.js sentenceKey).
// Same settings as tools/gen-voice.mjs (voice_id, model, voice_settings from tools/voice-lines.json); each sentence is sent with the
// neighbouring sentence of its prompt as previous_text/next_text where known (tools/sentence-context.json) for natural prosody.
// ffmpeg: trim silence, loudnorm -18 LUFS, limiter, mono 44.1 kHz 64 kbps (same chain as gen-voice).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/voice/sent');
const MAN = path.join(ROOT, 'assets/voice/manifest.json');
const WORK = path.join(ROOT, 'tools/.voice-work/sent');
const argv = process.argv.slice(2);
const flag = (n) => argv.includes('--' + n);
const opt = (n, d) => (argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=') || d;
const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools/voice-lines.json'), 'utf8'));
const man = JSON.parse(fs.readFileSync(MAN, 'utf8'));
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(WORK, { recursive: true });
const skey = (s) => String(s).toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').replace(/\s+/g, ' ').trim();
const fileFor = (s) => 'sent/' + crypto.createHash('sha1').update(skey(s)).digest('hex').slice(0, 10) + '.mp3';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(cmd, a) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, a, { stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => (c === 0 ? res({ out, err }) : rej(new Error(`${cmd} exit ${c}: ${err.slice(-300)}`))));
  });
}
man.sentences = man.sentences || {};
if (flag('rebuild')) { /* nothing to read back: keys are not recoverable from hashes; manifest is the source of truth */ console.log('sentences in manifest:', Object.keys(man.sentences).length); process.exit(0); }

const all = JSON.parse(fs.readFileSync(path.resolve(ROOT, opt('list', 'tools/sentences.tasks.json')), 'utf8'));
let todo = all.filter((s) => !man.sentences[skey(s)] && !fs.existsSync(path.join(OUT, path.basename(fileFor(s)))));
// only sentences that are NOT already one clip (the fixed -p/-x lines are whole recordings already)
const exactKeys = new Set(Object.keys(man.exact || {}).map((t) => skey(t)));
todo = todo.filter((s) => !exactKeys.has(skey(s)));
todo.sort((a, b) => a.length - b.length);
const cap = Number(opt('max-chars', Infinity));
let budget = 0; const pick = [];
for (const s of todo) { if (budget + s.length > cap) continue; pick.push(s); budget += s.length; }
console.log(`sentences to record: ${pick.length} of ${todo.length} still missing (${budget} of ${todo.reduce((a, s) => a + s.length, 0)} characters)`);
if (flag('dry')) process.exit(0);

const key = process.env.ELEVENLABS_API_KEY; if (!key) throw new Error('ELEVENLABS_API_KEY not set');
const ctxFile = path.join(ROOT, 'tools/sentence-context.json');
const ctxMap = fs.existsSync(ctxFile) ? JSON.parse(fs.readFileSync(ctxFile, 'utf8')) : {};
async function tts(text) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${L.voice.voice_id}?output_format=${L.voice.output_format}`;
  const body = { text, model_id: L.voice.model_id, voice_settings: L.voice.voice_settings, language_code: L.voice.language_code };
  const c = ctxMap[text]; if (c) { if (c.previous) body.previous_text = c.previous; if (c.next) body.next_text = c.next; }
  for (let i = 0; i < 5; i++) {
    const r = await fetch(url, { method: 'POST', headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' }, body: JSON.stringify(body) }).catch(() => null);
    if (r && r.ok) return Buffer.from(await r.arrayBuffer());
    if (r && r.status === 400 && body.language_code) { delete body.language_code; continue; }
    if (r && r.status < 500 && r.status !== 429) throw new Error('ElevenLabs ' + r.status + ' ' + (await r.text()).slice(0, 200));
    await sleep(1000 * 2 ** i);
  }
  throw new Error('ElevenLabs: gave up');
}
const TRIM = 'silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.06,areverse,silenceremove=start_periods=1:start_duration=0:start_threshold=-45dB:start_silence=0.06,areverse';
async function process1(src, dst) {
  const { err } = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', src, '-af', `${TRIM},loudnorm=I=-18:TP=-1.5:LRA=11:print_format=json`, '-f', 'null', '-']);
  let m = null; try { m = JSON.parse(err.slice(err.lastIndexOf('{'), err.lastIndexOf('}') + 1)); } catch {}
  const loud = m && Number(m.input_i) > -60
    ? `loudnorm=I=-18:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`
    : 'volume=0dB';
  let trim = 0;
  for (let pass = 0; pass < 3; pass++) {
    const vol = trim ? `,volume=${trim.toFixed(2)}dB` : '';
    await run('ffmpeg', ['-hide_banner', '-nostats', '-y', '-i', src, '-af', `${TRIM},${loud},alimiter=limit=0.78:attack=2:release=30:level=disabled${vol},apad=whole_dur=0.27`, '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', dst + '.tmp.mp3']);
    const v = await run('ffmpeg', ['-hide_banner', '-nostats', '-i', dst + '.tmp.mp3', '-af', 'volumedetect', '-f', 'null', '-']);
    const peak = Number((/max_volume: (-?[\d.]+) dB/.exec(v.err) || [])[1]);
    if (!(peak > -1.6)) break; trim -= peak + 2.2;
  }
  fs.renameSync(dst + '.tmp.mp3', dst);
}
let spent = 0, done = 0, i = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (i < pick.length) {
    const s = pick[i++];
    const f = fileFor(s), raw = path.join(WORK, path.basename(f));
    const buf = await tts(s); spent += s.length; fs.writeFileSync(raw, buf);
    await process1(raw, path.join(ROOT, 'assets/voice', f));
    man.sentences[skey(s)] = f; done++;
  }
}));
fs.writeFileSync(MAN, JSON.stringify(man));
console.log(`recorded ${done} sentences; characters sent to ElevenLabs: ${spent}; sentences in manifest: ${Object.keys(man.sentences).length}`);
