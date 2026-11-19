/** Tiny synthesized sound effects (Web Audio, no files). */
let ctx: AudioContext | null = null;
function audio() {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Rising power-up hum lasting `seconds`. */
export function playCharge(seconds = 3) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const gain = a.createGain();
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.18, t + seconds * 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.1);
  const filter = a.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(300, t);
  filter.frequency.exponentialRampToValueAtTime(5000, t + seconds);
  filter.connect(gain).connect(a.destination);
  for (const detune of [0, 7, -12]) {
    const o = a.createOscillator();
    o.type = "sawtooth";
    o.detune.value = detune * 100;
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(900, t + seconds);
    o.connect(filter);
    o.start(t);
    o.stop(t + seconds + 0.15);
  }
}

/** Energy explosion: noise burst + sub boom. */
export function playExplosion() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const len = a.sampleRate * 1.6;
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  const noise = a.createBufferSource();
  noise.buffer = buf;
  const ng = a.createGain();
  ng.gain.value = 0.35;
  noise.connect(ng).connect(a.destination);
  noise.start(t);
  const boom = a.createOscillator();
  boom.type = "sine";
  boom.frequency.setValueAtTime(120, t);
  boom.frequency.exponentialRampToValueAtTime(30, t + 1.2);
  const bg = a.createGain();
  bg.gain.setValueAtTime(0.5, t);
  bg.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
  boom.connect(bg).connect(a.destination);
  boom.start(t);
  boom.stop(t + 1.5);
}

/** Sad descending fizzle for a failed awakening. */
export function playFizzle() {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const o = a.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(320, t);
  o.frequency.exponentialRampToValueAtTime(60, t + 1.2);
  const g = a.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + 1.4);
}
