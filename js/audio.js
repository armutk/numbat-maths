// Gentle synthesised sounds via Web Audio. No audio assets.
let ctx = null;
let master = null;
let enabled = true;

export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    // iOS needs a silent buffer kick inside the gesture
    const b = ctx.createBuffer(1, 1, 22050);
    const s = ctx.createBufferSource(); s.buffer = b; s.connect(ctx.destination); s.start(0);
  } catch {}
}

export function setSound(on) { enabled = on; }
export function soundOn() { return enabled; }

document.addEventListener('visibilitychange', () => { if (ctx && !document.hidden && ctx.state === 'suspended') ctx.resume().catch(() => {}); });

function tone({ f = 440, f2, type = 'sine', dur = 0.15, vol = 0.6, at = 0, attack = 0.005, release }) {
  if (!ctx || !enabled) return;
  const t0 = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (release || dur));
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + (release || dur) + 0.05);
}

const NOTE = { C4: 261.63, D4: 293.66, E4: 329.63, G4: 392.0, A4: 440.0, C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99, A5: 880.0, C6: 1046.5, E6: 1318.5 };

export const sfx = {
  /** soft pop when an item is picked up */
  pick() { tone({ f: 520, f2: 760, type: 'sine', dur: 0.08, vol: 0.35 }); },
  /** satisfying plop when an item lands */
  drop() { tone({ f: 420, f2: 230, type: 'triangle', dur: 0.12, vol: 0.5 }); tone({ f: 1200, f2: 600, type: 'sine', dur: 0.05, vol: 0.12 }); },
  /** counting blip, pitched by index */
  tick(i = 0) { tone({ f: NOTE.C5 * Math.pow(2, (i % 8) / 12), type: 'triangle', dur: 0.12, vol: 0.4 }); },
  tap() { tone({ f: 700, f2: 900, type: 'sine', dur: 0.05, vol: 0.2 }); },
  /** correct answer: two-note ding */
  correct() { tone({ f: NOTE.E5, type: 'triangle', dur: 0.16, vol: 0.5 }); tone({ f: NOTE.G5, type: 'triangle', dur: 0.26, vol: 0.5, at: 0.11 }); },
  /** wrong: a soft, low, kind "hmm" — never a buzzer */
  wrong() { tone({ f: 300, f2: 240, type: 'sine', dur: 0.22, vol: 0.35 }); },
  /** task complete chime */
  success() { [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.35, vol: 0.45, at: i * 0.09 })); },
  /** quest done fanfare (still gentle) */
  fanfare() { [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.C6, NOTE.E6, NOTE.C6].forEach((f, i) => tone({ f, type: 'triangle', dur: 0.4, vol: 0.4, at: i * 0.11 })); tone({ f: NOTE.C4, type: 'sine', dur: 0.9, vol: 0.25, at: 0.5 }); },
  sticker() { [NOTE.G4, NOTE.C5, NOTE.E5, NOTE.G5].forEach((f, i) => tone({ f, type: 'sine', dur: 0.5, vol: 0.4, at: i * 0.07 })); },
  whoosh() { tone({ f: 200, f2: 900, type: 'sine', dur: 0.18, vol: 0.12 }); },
};
