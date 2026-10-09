// Spoken instructions via Web Speech API. Prefers an Australian English voice.
const synth = window.speechSynthesis;
let voice = null;
let voicesReady = false;
let lastText = '';
let onStateChange = () => {};
let muted = false;

function chooseVoice() {
  if (!synth) return;
  const voices = synth.getVoices();
  if (!voices.length) return;
  voicesReady = true;
  const au = voices.filter((v) => /en[-_]AU/i.test(v.lang));
  const byName = (list, re) => list.find((v) => re.test(v.name));
  voice =
    byName(au, /karen/i) ||           // iOS / macOS Australian voice
    byName(au, /catherine|lee|matilda|olivia/i) ||
    au.find((v) => v.localService) || au[0] ||
    byName(voices, /english.*australia|australia/i) ||
    voices.find((v) => /en[-_]GB/i.test(v.lang) && v.localService) ||
    voices.find((v) => /en[-_]GB/i.test(v.lang)) ||
    voices.find((v) => /^en/i.test(v.lang) && v.localService) ||
    voices.find((v) => /^en/i.test(v.lang)) || null;
}

if (synth) {
  chooseVoice();
  synth.addEventListener?.('voiceschanged', chooseVoice);
  if (typeof synth.onvoiceschanged !== 'undefined') synth.onvoiceschanged = chooseVoice;
}

export function voiceInfo() { return voice ? `${voice.name} (${voice.lang})` : (synth ? 'default voice' : 'no speech'); }
export function setMuted(m) { muted = m; if (m) stop(); }
export function isMuted() { return muted; }
export function onSpeechState(fn) { onStateChange = fn; }

/** Warm up inside a user gesture (iOS requires it). */
export function unlockSpeech() {
  if (!synth) return;
  try {
    chooseVoice();
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0; u.rate = 1;
    synth.speak(u);
  } catch {}
}

export function stop() { try { synth && synth.cancel(); } catch {} onStateChange(false); }

/**
 * Speak text. Returns a promise that resolves when done (or immediately when speech is unavailable).
 * Numbers are spoken naturally; keep sentences short.
 */
export function say(text, { rate = 0.92, pitch = 1.08, interrupt = true } = {}) {
  lastText = text;
  if (!synth || muted) return Promise.resolve();
  return new Promise((resolve) => {
    try {
      if (interrupt) synth.cancel();
      if (!voicesReady) chooseVoice();
      const u = new SpeechSynthesisUtterance(text);
      if (voice) u.voice = voice;
      u.lang = voice?.lang || 'en-AU';
      u.rate = rate; u.pitch = pitch; u.volume = 1;
      let done = false;
      const finish = () => { if (done) return; done = true; onStateChange(false); resolve(); };
      u.onend = finish; u.onerror = finish;
      onStateChange(true);
      synth.speak(u);
      // Safety: iOS occasionally drops onend
      setTimeout(finish, 1200 + text.length * 90);
    } catch { resolve(); }
  });
}

export function replay() { if (lastText) return say(lastText); return Promise.resolve(); }

// iOS pauses speech when the page is hidden; resume on return.
document.addEventListener('visibilitychange', () => { if (!document.hidden && synth?.paused) { try { synth.resume(); } catch {} } });
