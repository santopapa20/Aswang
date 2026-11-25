/**
 * All sound, made in the browser with the Web Audio API: there are no sound files. Every noise is built
 * from tones and filtered hiss, and the score is played live from the same parts, so it can follow the night.
 *
 * The mix (audio-design): everything plays into one of three buses under the master, each with its own
 * slider: effects (what the rules of the night are told by), ambience (wind, crickets, birds, the fire) and
 * music. Music goes through a duck gain of its own, so dipping it under talk never moves the player's
 * slider. A shared reverb (a generated room tail) gives the score and the worst noises space. A limiter
 * on the master is the safety net against summed sounds clipping, not the mixer.
 *
 * The score is in layers that rise and fall with how near the danger is (`danger`, 0 to 1, from the
 * director in Cast.tsx), with a quick attack and a slow release so it does not flap:
 *   - by day and on the title, a few slow plucks of a bamboo-and-gong sound in a minor pentatonic;
 *   - at night, a low drone that never quite settles, and a faint glassy beating high above it;
 *   - as danger comes, a detuned low cluster that opens up, and a pulse like a heart that quickens;
 * and stingers for the moments that should land: night falling, being seen, a breach, a face coming off,
 * first light.
 *
 * The one rule that matters most is still the tiktik: the aswang's clicking is LOUD when she is far and
 * FAINT when she is near.
 */
type Ambience = {
  dark: number; tiktik: number | null; scratch: boolean; fear: number; smoke: boolean; muted: boolean; sfx: number; ambience: number;
  stage: "title" | "day" | "night" | "other"; danger: number; night: number; talking: boolean; music: number;
};
export type Sting = "night" | "seen" | "breach" | "reveal" | "dawn";

let ctx: AudioContext | null = null;
let master: GainNode, limiter: DynamicsCompressorNode, sfx: GainNode, amb: GainNode, mus: GainNode, duck: GainNode, verb: GainNode, hiss: AudioBuffer;
let crickets: GainNode, wind: GainNode, fire: GainNode;
const layer = {} as Record<"drone" | "glass" | "cluster", GainNode>;
let clusterFilter: BiquadFilterNode, droneFilter: BiquadFilterNode;
const timers = { tik: 0.8, burst: 0, scratch: 0, pulse: 0, bird: 3, pluck: 2, whisper: 30, howl: 45, gust: 12, stingGap: 0 };
const music = { danger: 0, stage: "other" as Ambience["stage"], beat: 0 };
let meterOn = false, analyser: AnalyserNode | null = null, pre: AnalyserNode | null = null;
const meter = { peak: 0, prePeak: 0, sum: 0, n: 0 };

function noise(seconds: number) {
  const b = ctx!.createBuffer(1, Math.floor(ctx!.sampleRate * seconds), ctx!.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
/** A room tail: noise in two channels, dying away over `seconds`, for the convolver. */
function tail(seconds: number) {
  const rate = ctx!.sampleRate, n = Math.floor(rate * seconds);
  const b = ctx!.createBuffer(2, n, rate);
  for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  return b;
}
/** Where a sound goes: a bus, how far left or right (-1..1), and how much of it goes to the reverb. */
type Out = { bus?: GainNode; pan?: number; wet?: number };
function route(node: AudioNode, o: Out = {}) {
  let end: AudioNode = node;
  if (o.pan) { const p = ctx!.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, o.pan)); node.connect(p); end = p; }
  end.connect(o.bus ?? sfx);
  if (o.wet) { const w = ctx!.createGain(); w.gain.value = o.wet; end.connect(w).connect(verb); }
}
/** A short burst of filtered hiss: the building block for clicks, steps, scratches, breath and whispers. */
function burst(freq: number, q: number, volume: number, seconds: number, type: BiquadFilterType = "bandpass", when = 0, bus?: GainNode, o: Out = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource(); src.buffer = hiss; src.loop = true;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, volume), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  src.connect(f).connect(g); route(g, { ...o, bus: bus ?? o.bus });
  src.start(t, Math.random() * 1.5); src.stop(t + seconds + 0.05);
}
/** A tone that slides from one pitch to another. */
function tone(type: OscillatorType, from: number, to: number, volume: number, seconds: number, when = 0, filter = 0, bus?: GainNode, o: Out = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const osc = ctx.createOscillator(); osc.type = type;
  osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + seconds);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(volume, t + Math.min(0.05, seconds * 0.3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
  if (filter) { const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = filter; f.Q.value = 2.5; osc.connect(f).connect(g); } else osc.connect(g);
  route(g, { ...o, bus: bus ?? o.bus });
  osc.start(t); osc.stop(t + seconds + 0.05);
}
/** A struck note that rings and dies: a sine with a little of an out-of-tune partial, like bamboo or a small gong. */
function pluck(freq: number, volume: number, seconds: number, when = 0, o: Out = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  for (const [mult, share] of [[1, 1], [2.76, 0.18], [5.4, 0.06]]) {
    const osc = ctx.createOscillator(); osc.type = "sine"; osc.frequency.value = freq * mult;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(volume * share, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds / mult ** 0.5);
    osc.connect(g); route(g, o);
    osc.start(t); osc.stop(t + seconds + 0.05);
  }
}
function loopHiss(freq: number, type: BiquadFilterType, q: number, bus: GainNode) {
  const src = ctx!.createBufferSource(); src.buffer = hiss; src.loop = true;
  const f = ctx!.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx!.createGain(); g.gain.value = 0;
  src.connect(f).connect(g).connect(bus); src.start();
  return g;
}
/** A held note made of a few detuned oscillators, always running; its layer's gain decides if it is heard. */
function held(freqs: number[], type: OscillatorType, into: AudioNode, detune = 6) {
  for (const f of freqs) for (const d of [-detune, detune]) {
    const osc = ctx!.createOscillator(); osc.type = type; osc.frequency.value = f; osc.detune.value = d;
    osc.connect(into); osc.start();
  }
}
const SCALE = [146.8, 174.6, 196, 220, 261.6, 293.7, 349.2, 392];   // D minor pentatonic from D3, with a flat sixth for unease

export const sound = {
  /** Browsers only allow sound after a key or a click, so this is called on the first one. */
  wake() {
    if (ctx) { if (ctx.state === "suspended") void ctx.resume(); return; }
    try { ctx = new AudioContext(); } catch { return; }
    // master -> limiter -> speakers; the buses under the master
    limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4; limiter.knee.value = 2; limiter.ratio.value = 16; limiter.attack.value = 0.003; limiter.release.value = 0.25;
    master = ctx.createGain(); master.gain.value = 1;
    master.connect(limiter).connect(ctx.destination);
    sfx = ctx.createGain(); sfx.connect(master);
    amb = ctx.createGain(); amb.connect(master);
    duck = ctx.createGain(); duck.connect(master);
    mus = ctx.createGain(); mus.connect(duck);
    // the shared reverb: a send bus into a convolver with a long, dark tail
    const conv = ctx.createConvolver(); conv.buffer = tail(3.2);
    const dark = ctx.createBiquadFilter(); dark.type = "lowpass"; dark.frequency.value = 2600;
    verb = ctx.createGain(); verb.gain.value = 0.9;
    verb.connect(conv).connect(dark).connect(master);
    hiss = noise(2);
    wind = loopHiss(320, "lowpass", 0.6, amb);
    fire = loopHiss(900, "bandpass", 0.8, amb);
    // crickets: a high tone chopped fast, breathing slowly
    crickets = ctx.createGain(); crickets.gain.value = 0; crickets.connect(amb);
    for (const [f, rate] of [[4300, 23], [5100, 31]]) {
      const o = ctx.createOscillator(); o.frequency.value = f;
      const chop = ctx.createGain(); chop.gain.value = 0.5;
      const lfo = ctx.createOscillator(); lfo.type = "square"; lfo.frequency.value = rate;
      const depth = ctx.createGain(); depth.gain.value = 0.5;
      lfo.connect(depth).connect(chop.gain);
      o.connect(chop).connect(crickets); o.start(); lfo.start();
    }
    // ---- the score's held layers (each runs all the time at 0 until it is wanted)
    // the drone: D1 and A1, detuned against each other so they beat, through a lowpass that breathes
    layer.drone = ctx.createGain(); layer.drone.gain.value = 0;
    droneFilter = ctx.createBiquadFilter(); droneFilter.type = "lowpass"; droneFilter.frequency.value = 160; droneFilter.Q.value = 3;
    droneFilter.connect(layer.drone); layer.drone.connect(mus);
    held([36.7, 55], "sawtooth", droneFilter, 9);
    // the glass: a minor second high up, very faint, beating slowly against itself
    layer.glass = ctx.createGain(); layer.glass.gain.value = 0;
    const glassSend = ctx.createGain(); glassSend.gain.value = 0.6;
    layer.glass.connect(mus); layer.glass.connect(glassSend).connect(verb);
    held([1174.7, 1244.5], "sine", layer.glass, 4);
    // the cluster: D2, E-flat 2 and A2, sawtooth, through a lowpass that opens as danger comes
    layer.cluster = ctx.createGain(); layer.cluster.gain.value = 0;
    clusterFilter = ctx.createBiquadFilter(); clusterFilter.type = "lowpass"; clusterFilter.frequency.value = 200; clusterFilter.Q.value = 4;
    clusterFilter.connect(layer.cluster); layer.cluster.connect(mus);
    const clusterSend = ctx.createGain(); clusterSend.gain.value = 0.35; layer.cluster.connect(clusterSend).connect(verb);
    held([73.4, 77.8, 110], "sawtooth", clusterFilter, 12);
  },

  /** Called every frame with what the night is doing. */
  update(dt: number, a: Ambience) {
    if (!ctx) return;
    const now = ctx.currentTime;
    master.gain.setTargetAtTime(a.muted ? 0 : 1, now, 0.1);
    // a slider's 0..1 squared, so the change is spread over its whole travel (audio-design)
    sfx.gain.setTargetAtTime(a.stage === "title" ? 0 : a.sfx * a.sfx, now, 0.05);
    amb.gain.setTargetAtTime(a.ambience * a.ambience, now, 0.05);
    mus.gain.setTargetAtTime(a.music * a.music, now, 0.05);
    duck.gain.setTargetAtTime(a.talking ? 0.45 : 1, now, a.talking ? 0.12 : 0.6);       // under talk, and back slowly
    crickets.gain.setTargetAtTime(0.012 * a.dark * (a.tiktik !== null && a.tiktik < 9 ? 0.15 : 1) * (1 - a.danger * 0.8), now, 0.6);   // they go quiet when she is close
    wind.gain.setTargetAtTime(0.05 + 0.04 * Math.sin(now * 0.23), now, 0.5);
    fire.gain.setTargetAtTime(a.smoke ? 0.03 : 0, now, 0.4);

    // ---- the score
    // danger rises fast and falls slow (hysteresis), so the music does not flap as she comes and goes
    const want = Math.max(0, Math.min(1, a.danger));
    music.danger += (want - music.danger) * Math.min(1, dt * (want > music.danger ? 3 : 0.25));
    const d = music.danger, night = a.stage === "night";
    const calm = a.stage === "title" || a.stage === "day" ? 1 : 0;
    // stingers on the moments that should land
    timers.stingGap = Math.max(0, timers.stingGap - dt);
    if (a.stage !== music.stage) {
      if (a.stage === "night" && music.stage === "day") sound.sting("night");
      if (a.stage === "other" && music.stage === "night") sound.sting("dawn");
      music.stage = a.stage;
    }
    if (night && want > 0.75 && d < 0.5 && timers.stingGap <= 0) sound.sting("seen");
    const deepen = Math.min(1, 0.6 + a.night * 0.08);                  // later nights sit lower and louder
    layer.drone.gain.setTargetAtTime(night ? 0.05 * deepen + 0.03 * d : a.stage === "title" ? 0.025 : 0, now, 1.5);
    droneFilter.frequency.setTargetAtTime(130 + 70 * Math.sin(now * 0.11) + 260 * d, now, 0.8);
    layer.glass.gain.setTargetAtTime(night ? 0.0035 * (1 - d * 0.5) * (0.6 + 0.4 * Math.sin(now * 0.07)) : 0, now, 2);
    layer.cluster.gain.setTargetAtTime(night ? 0.07 * d * d : 0, now, 0.4);
    clusterFilter.frequency.setTargetAtTime(200 + 2200 * d * d, now, 0.3);
    // the pulse: two low beats like a heart, quicker as danger grows (it replaces the old heartbeat)
    const beating = night && (d > 0.15 || a.fear > 0.05);
    if (beating) {
      timers.pulse -= dt;
      const strength = Math.max(d, a.fear);
      if (timers.pulse <= 0) {
        timers.pulse = 60 / (58 + 62 * strength);
        tone("sine", 72, 38, 0.55 * strength, 0.2, 0, 0, mus); tone("sine", 64, 34, 0.38 * strength, 0.2, 0.19, 0, mus);
      }
    }
    // by day and on the title: a slow pluck now and then, sometimes two, never a tune you could hum
    if (calm) {
      timers.pluck -= dt;
      if (timers.pluck <= 0) {
        timers.pluck = 2.6 + Math.random() * 4.5;
        const n = SCALE[Math.floor(Math.random() * SCALE.length)];
        pluck(n, 0.09, 3.4, 0, { bus: mus, pan: Math.random() * 1.2 - 0.6, wet: 0.5 });
        if (Math.random() < 0.35) pluck(SCALE[Math.floor(Math.random() * SCALE.length)] / 2, 0.065, 4, 0.5 + Math.random() * 0.6, { bus: mus, pan: Math.random() * 1.2 - 0.6, wet: 0.5 });
      }
    }

    // ---- the night's own noises
    if (a.tiktik !== null) {
      // loud when far, faint when near
      const volume = Math.max(0.012, Math.min(0.5, (a.tiktik - 2.5) / 34 * 0.5));
      timers.tik -= dt;
      if (timers.tik <= 0) {
        if (timers.burst <= 0) { timers.burst = 3 + Math.floor(Math.random() * 3); timers.tik = 1.1 + Math.random() * 1.6; }
        else { timers.burst -= 1; timers.tik = 0.13 + Math.random() * 0.05; burst(2600 + Math.random() * 500, 9, volume, 0.035, "bandpass", 0, sfx, { wet: 0.25 }); }
      }
    }
    if (a.scratch) {
      timers.scratch -= dt;
      if (timers.scratch <= 0) { timers.scratch = 0.12 + Math.random() * 0.35; burst(1400 + Math.random() * 1600, 1.2, 0.16, 0.14 + Math.random() * 0.12); }
    }
    if (night && a.dark > 0.7) {
      // a whisper somewhere off to one side: more often as the danger grows
      timers.whisper -= dt * (1 + 2 * d);
      if (timers.whisper <= 0) { timers.whisper = 26 + Math.random() * 40; sound.whisper(); }
      // a dog howling far off, on the nights the dead dogs run
      if (a.night >= 2) {
        timers.howl -= dt;
        if (timers.howl <= 0) { timers.howl = 45 + Math.random() * 60; sound.howl(Math.random() * 1.6 - 0.8, 0.5); }
      }
      // the wind gusts through the trees
      timers.gust -= dt;
      if (timers.gust <= 0) { timers.gust = 9 + Math.random() * 16; burst(500 + Math.random() * 400, 0.5, 0.05, 2.6, "bandpass", 0, amb, { pan: Math.random() * 1.6 - 0.8 }); }
    }
    if (a.dark < 0.4) {
      timers.bird -= dt;
      if (timers.bird <= 0) { timers.bird = 2 + Math.random() * 6; const f = 2400 + Math.random() * 1600; tone("sine", f, f * 1.25, 0.03, 0.09, 0, 0, amb); tone("sine", f * 1.2, f * 0.95, 0.03, 0.11, 0.14, 0, amb); }
    }

    // ---- levels, for scripts/levels.mjs (only while asked for)
    if (meterOn && analyser && pre) {
      const buf = new Float32Array(analyser.fftSize), raw = new Float32Array(pre.fftSize);
      analyser.getFloatTimeDomainData(buf); pre.getFloatTimeDomainData(raw);
      for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > meter.peak) meter.peak = v; meter.sum += buf[i] * buf[i]; }
      meter.n += buf.length;
      for (let i = 0; i < raw.length; i++) { const v = Math.abs(raw[i]); if (v > meter.prePeak) meter.prePeak = v; }
    }
  },

  /** A short piece of score for a moment that should land. */
  sting(kind: Sting) {
    if (!ctx) return;
    timers.stingGap = 14;
    const m = { bus: mus, wet: 0.7 };
    if (kind === "night") {
      // a low gong, and a swell of air rising into it
      burst(900, 0.7, 0.05, 2.2, "bandpass", 0, mus, { wet: 0.8 });
      for (const [mult, v] of [[1, 0.5], [2.4, 0.2], [3.9, 0.12], [5.4, 0.06]]) tone("sine", 49 * mult, 47 * mult, v * 0.45, 7, 1.6, 0, mus, m);
    } else if (kind === "seen" || kind === "reveal") {
      // a stab: a dissonant cluster hit hard, with a scrape above it
      const base = kind === "seen" ? 98 : 116.5;
      for (const r of [1, 1.06, 1.5, 2.12]) tone("sawtooth", base * r, base * r * 0.97, 0.07, 1.6, 0, 0, mus, m);
      burst(3200, 6, 0.07, 1.1, "bandpass", 0.02, mus, { wet: 0.6 });
      tone("sine", 60, 30, 0.5, 0.9, 0, 0, mus);
    } else if (kind === "breach") {
      tone("sine", 44, 26, 0.6, 2.2, 0, 0, mus, m);
      for (const r of [1, 1.06, 1.41]) tone("sawtooth", 61.7 * r, 58 * r, 0.06, 2.6, 0.05, 0, mus, m);
    } else if (kind === "dawn") {
      // first light: an open chord, swelling and gone, and the drone let go
      for (const [f, at] of [[146.8, 0], [220, 0.25], [293.7, 0.5], [370, 0.8]] as const) pluck(f, 0.07, 5, at, { bus: mus, wet: 0.6 });
    }
  },

  /** Someone whispering, off to one side: breathy syllables with no words in them. */
  whisper(pan = Math.random() * 1.8 - 0.9) {
    const n = 4 + Math.floor(Math.random() * 5);
    let at = 0;
    for (let i = 0; i < n; i++) {
      const len = 0.08 + Math.random() * 0.16;
      burst(1100 + Math.random() * 1600, 3 + Math.random() * 4, 0.035 + Math.random() * 0.02, len, "bandpass", at, sfx, { pan, wet: 0.5 });
      at += len + 0.03 + Math.random() * 0.12;
    }
  },
  /** A dog howling, near (pan, volume) or far. */
  howl(pan = 0, far = 1) {
    if (!ctx) return;
    const v = 0.09 * far;
    tone("sawtooth", 380, 610, v, 0.9, 0, 900, amb, { pan, wet: 0.8 });
    tone("sawtooth", 610, 520, v, 1.6, 0.85, 900, amb, { pan, wet: 0.8 });
    tone("sawtooth", 520, 300, v * 0.8, 1.3, 2.4, 800, amb, { pan, wet: 0.8 });
  },

  step(v: number) { burst(170 + Math.random() * 90, 0.7, 0.1 * v * (0.85 + Math.random() * 0.3), 0.07, "lowpass"); },
  blip() { tone("sine", 660, 880, 0.05, 0.08); },
  whip() { burst(3200, 0.8, 0.5, 0.09, "highpass"); tone("sawtooth", 900, 140, 0.18, 0.1); },
  knock() { for (let i = 0; i < 3; i++) { tone("triangle", 190, 120, 0.5, 0.09, i * 0.16, 0, sfx, { wet: 0.3 }); burst(700, 1, 0.2, 0.05, "bandpass", i * 0.16); } },
  slash() { burst(2400, 1.2, 0.35, 0.12, "bandpass"); tone("sawtooth", 600, 220, 0.08, 0.14); },
  hurt() { burst(320, 0.8, 0.55, 0.22, "lowpass"); tone("sawtooth", 220, 120, 0.22, 0.32, 0.02, 700); },
  strike() { tone("triangle", 240, 110, 0.6, 0.14); burst(900, 1, 0.3, 0.07); },
  held() { burst(900, 3, 0.4, 0.3); tone("sawtooth", 700, 180, 0.22, 0.45, 0, 900); },
  breach() { tone("sawtooth", 180, 60, 0.5, 1.2, 0, 400); burst(500, 0.6, 0.5, 0.9, "lowpass"); tone("sawtooth", 1300, 500, 0.25, 0.9, 0.1, 1500); sound.sting("breach"); },
  shriek() { const o = { wet: 0.6 }; tone("sawtooth", 900, 2300, 0.3, 0.5, 0, 2200, sfx, o); tone("sawtooth", 2300, 1100, 0.3, 0.9, 0.45, 2400, sfx, o); tone("square", 1700, 2100, 0.08, 1.2, 0.05, 3000, sfx, o); },
  roar() { tone("sawtooth", 150, 55, 0.6, 1.6, 0, 300, sfx, { wet: 0.4 }); tone("sawtooth", 97, 48, 0.4, 1.8, 0.05, 240); burst(260, 0.5, 0.4, 1.4, "lowpass"); },
  growl() { tone("sawtooth", 118, 72, 0.3, 0.9, 0, 260); tone("sawtooth", 83, 60, 0.2, 1.0, 0.05, 200); burst(210, 0.5, 0.22, 0.8, "lowpass"); },
  yelp() { tone("sawtooth", 620, 1250, 0.28, 0.12, 0, 1800); tone("sawtooth", 1250, 420, 0.25, 0.3, 0.1, 1600); },
  wings() { for (let i = 0; i < 3; i++) burst(380, 0.7, 0.3, 0.22, "lowpass", i * 0.3, sfx, { wet: 0.3 }); },
  /** A face coming off: a wet crack, and the stab. */
  unmask() { for (let i = 0; i < 4; i++) burst(1800 + Math.random() * 1500, 2, 0.25, 0.05, "bandpass", i * 0.04); burst(300, 1, 0.3, 0.3, "lowpass", 0.05); sound.sting("reveal"); },
  /** Little bells on a fence, shaken: a few bright struck notes, a little out of time. */
  bells() { for (let i = 0; i < 6; i++) tone("triangle", 2100 + (i % 3) * 330, 2000 + (i % 3) * 330, 0.12, 0.5, i * 0.11 + Math.random() * 0.04, 2400, sfx, { wet: 0.4 }); },
  whoosh() { burst(700, 0.6, 0.6, 0.7, "lowpass"); tone("sine", 320, 70, 0.3, 0.6); },
  rooster() {
    const notes: [number, number, number, number][] = [[520, 640, 0.16, 0], [640, 690, 0.12, 0.2], [690, 900, 0.34, 0.36], [900, 560, 0.5, 0.72]];
    for (const [a, b, len, at] of notes) { tone("sawtooth", a, b, 0.25, len, at, 1500, sfx, { wet: 0.4 }); tone("square", a * 2, b * 2, 0.05, len, at, 2600); }
  },

  /** For scripts/levels.mjs: start measuring the output, or read and reset what was measured (dBFS). */
  meter(start: boolean) {
    if (!ctx) return null;
    if (!analyser) {
      analyser = ctx.createAnalyser(); analyser.fftSize = 2048; limiter.connect(analyser);
      pre = ctx.createAnalyser(); pre.fftSize = 2048; master.connect(pre);
    }
    const db = (v: number) => (v > 0 ? +(20 * Math.log10(v)).toFixed(1) : -120);
    const out = { peakDb: db(meter.peak), rmsDb: db(Math.sqrt(meter.sum / Math.max(1, meter.n))), prePeakDb: db(meter.prePeak), state: ctx.state };
    meterOn = start; meter.peak = 0; meter.prePeak = 0; meter.sum = 0; meter.n = 0;
    return out;
  },
};
