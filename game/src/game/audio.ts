/**
 * All sound, made in the browser with the Web Audio API. There are no sound files yet: every noise
 * here is built from tones and filtered hiss. They are stand-ins, good enough to make the rules of
 * the night audible, and each can be swapped for a recording later without touching the game.
 *
 * The one that matters most is the tiktik: the aswang's clicking is LOUD when she is far and FAINT
 * when she is near.
 */
type Ambience = { dark: number; tiktik: number | null; scratch: boolean; fear: number; smoke: boolean; muted: boolean };

let ctx: AudioContext | null = null;
let master: GainNode, hiss: AudioBuffer;
let crickets: GainNode, wind: GainNode, fire: GainNode;
const timers = { tik: 0.8, burst: 0, scratch: 0, heart: 0, bird: 3 };

function noise(seconds: number) {
  const b = ctx!.createBuffer(1, Math.floor(ctx!.sampleRate * seconds), ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
/** A short burst of filtered hiss: the building block for clicks, steps, scratches and breath. */
function burst(freq: number, q: number, volume: number, seconds: number, type: BiquadFilterType = "bandpass", when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource(); src.buffer = hiss; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(f).connect(g).connect(master);
  src.start(t, Math.random() * 1.5); src.stop(t + seconds + 0.05);
}
/** A tone that slides from one pitch to another. */
function tone(type: OscillatorType, from: number, to: number, volume: number, seconds: number, when = 0, filter = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + Math.min(0.05, seconds * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  if (filter) { const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filter; f.Q.value = 2.5; o.connect(f).connect(g); } else o.connect(g);
  g.connect(master);
  o.start(t); o.stop(t + seconds + 0.05);
}
function loopHiss(freq: number, type: BiquadFilterType, q: number) {
  const src = ctx!.createBufferSource(); src.buffer = hiss; src.loop = true;
  const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx!.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(master); src.start();
  return g;
}

export const sound = {
  /** Browsers only allow sound after a key or a click, so this is called on the first one. */
  wake() {
    if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return; }
    try { ctx = new AudioContext(); } catch { return; }
    master = ctx.createGain(); master.gain.value = 0.7; master.connect(ctx.destination);
    hiss = noise(2);
    wind = loopHiss(320, "lowpass", 0.6);
    fire = loopHiss(900, "bandpass", 0.8);
    // crickets: a high tone chopped fast, breathing slowly
    crickets = ctx.createGain(); crickets.gain.value = 0; crickets.connect(master);
    for (const [f, rate] of [[4300, 23], [5100, 31]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const chop = ctx.createGain(); chop.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = rate;
      const depth = ctx.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth).connect(chop.gain);
      o.connect(chop).connect(crickets); o.start(); lfo.start();
    }
  },

  /** Called every frame with what the night is doing. */
  update(dt: number, a: Ambience) {
    if (!ctx) return;
    master.gain.setTargetAtTime(a.muted ? 0 : 0.7, ctx.currentTime, 0.1);
    crickets.gain.setTargetAtTime(0.012 * a.dark * (a.tiktik !== null && a.tiktik < 9 ? 0.15 : 1), ctx.currentTime, 0.6);   // they go quiet when she is close
    wind.gain.setTargetAtTime(0.05 + 0.04 * Math.sin(ctx.currentTime * 0.23), ctx.currentTime, 0.5);
    fire.gain.setTargetAtTime(a.smoke ? 0.03 : 0, ctx.currentTime, 0.4);

    if (a.tiktik !== null) {
      // loud when far, faint when near
      const volume = Math.max(0.012, Math.min(0.5, (a.tiktik - 2.5) / 34 * 0.5));
      timers.tik -= dt;
      if (timers.tik <= 0) {
        if (timers.burst <= 0) { timers.burst = 3 + Math.floor(Math.random() * 3); timers.tik = 1.1 + Math.random() * 1.6; }
        else { timers.burst -= 1; timers.tik = 0.13 + Math.random() * 0.05; burst(2600 + Math.random() * 500, 9, volume, 0.035); }
      }
    }
    if (a.scratch) {
      timers.scratch -= dt;
      if (timers.scratch <= 0) { timers.scratch = 0.12 + Math.random() * 0.35; burst(1400 + Math.random() * 1600, 1.2, 0.16, 0.14 + Math.random() * 0.12); }
    }
    if (a.fear > 0.05) {
      timers.heart -= dt;
      if (timers.heart <= 0) { timers.heart = 1.05 - 0.55 * a.fear; tone("sine", 62, 38, 0.5 * a.fear, 0.16); tone("sine", 56, 34, 0.35 * a.fear, 0.16, 0.2); }
    }
    if (a.dark < 0.4) {
      timers.bird -= dt;
      if (timers.bird <= 0) { timers.bird = 2 + Math.random() * 6; const f = 2400 + Math.random() * 1600; tone("sine", f, f * 1.25, 0.03, 0.09); tone("sine", f * 1.2, f * 0.95, 0.03, 0.11, 0.14); }
    }
  },

  step(v: number) { burst(170 + Math.random() * 90, 0.7, 0.1 * v, 0.07, "lowpass"); },
  blip() { tone("sine", 660, 880, 0.05, 0.08); },
  whip() { burst(3200, 0.8, 0.5, 0.09, "highpass"); tone("sawtooth", 900, 140, 0.18, 0.1); },
  knock() { for (let i = 0; i < 3; i++) { tone("triangle", 190, 120, 0.5, 0.09, i * 0.16); burst(700, 1, 0.2, 0.05, "bandpass", i * 0.16); } },
  slash() { burst(2400, 1.2, 0.35, 0.12, "bandpass"); tone("sawtooth", 600, 220, 0.08, 0.14); },
  hurt() { burst(320, 0.8, 0.55, 0.22, "lowpass"); tone("sawtooth", 220, 120, 0.22, 0.32, 0.02, 700); },
  strike() { tone("triangle", 240, 110, 0.6, 0.14); burst(900, 1, 0.3, 0.07); },
  held() { burst(900, 3, 0.4, 0.3); tone("sawtooth", 700, 180, 0.22, 0.45, 0, 900); },
  breach() { tone("sawtooth", 180, 60, 0.5, 1.2, 0, 400); burst(500, 0.6, 0.5, 0.9, "lowpass"); tone("sawtooth", 1300, 500, 0.25, 0.9, 0.1, 1500); },
  shriek() { tone("sawtooth", 900, 2300, 0.3, 0.5, 0, 2200); tone("sawtooth", 2300, 1100, 0.3, 0.9, 0.45, 2400); tone("square", 1700, 2100, 0.08, 1.2, 0.05, 3000); },
  roar() { tone("sawtooth", 150, 55, 0.6, 1.6, 0, 300); tone("sawtooth", 97, 48, 0.4, 1.8, 0.05, 240); burst(260, 0.5, 0.4, 1.4, "lowpass"); },
  growl() { tone("sawtooth", 118, 72, 0.3, 0.9, 0, 260); tone("sawtooth", 83, 60, 0.2, 1.0, 0.05, 200); burst(210, 0.5, 0.22, 0.8, "lowpass"); },
  yelp() { tone("sawtooth", 620, 1250, 0.28, 0.12, 0, 1800); tone("sawtooth", 1250, 420, 0.25, 0.3, 0.1, 1600); },
  wings() { for (let i = 0; i < 3; i++) burst(380, 0.7, 0.3, 0.22, "lowpass", i * 0.3); },
  whoosh() { burst(700, 0.6, 0.6, 0.7, "lowpass"); tone("sine", 320, 70, 0.3, 0.6); },
  rooster() {
    const notes: [number, number, number, number][] = [[520, 640, 0.16, 0], [640, 690, 0.12, 0.2], [690, 900, 0.34, 0.36], [900, 560, 0.5, 0.72]];
    for (const [a, b, len, at] of notes) { tone("sawtooth", a, b, 0.25, len, at, 1500); tone("square", a * 2, b * 2, 0.05, len, at, 2600); }
  },
};
