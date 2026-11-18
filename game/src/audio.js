// Solmar City — WebAudio synth only. No audio files, no network: every sound is
// an oscillator or filtered noise built at runtime. Audio is a side effect only —
// it never feeds the simulation, so muting or a missing AudioContext cannot change
// a single game outcome.
let ctx = null;
let master = null;
let muted = false;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

export function ensureAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    // Engine hum: a low sawtooth whose pitch follows the player's speed.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Police siren: a sine that wails between two tones while wanted.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 720;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  } catch { ctx = null; }
}

// Called every rendered frame with live state; purely cosmetic.
export function updateEngine(speed, wanted, dt) {
  if (!ctx || !engineOsc) return;
  const target = speed > 5 ? 0.05 + Math.min(0.16, speed / 520 * 0.16) : 0;
  engineGain.gain.value += (target - engineGain.gain.value) * 0.2;
  engineOsc.frequency.value = 55 + speed * 0.22;
  if (wanted > 0) {
    sirenTimer += dt;
    sirenOsc.frequency.value = sirenTimer % 0.9 < 0.45 ? 720 : 960;
    sirenGain.gain.value = 0.045;
  } else {
    sirenGain.gain.value = 0;
  }
}

function tone(freq, dur, type, vol, slideTo) {
  if (!ctx || !master) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(master);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio is cosmetic */ }
}

// Deterministic noise source for the burst filter: a tiny LCG, so even the
// sound effects never touch Math.random.
let noiseSeed = 123456789;
function noiseRand() {
  noiseSeed = (Math.imul(noiseSeed, 1664525) + 1013904223) >>> 0;
  return noiseSeed / 4294967296;
}

function noiseBurst(dur, vol, filterFreq) {
  if (!ctx || !master) return;
  try {
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (noiseRand() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1200;
    const g = ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start();
  } catch { /* audio is cosmetic */ }
}

export function sfxPunch() { noiseBurst(0.12, 0.35, 500); tone(90, 0.1, 'sine', 0.3, 50); }
export function sfxGunshot() { noiseBurst(0.16, 0.5, 2600); tone(220, 0.08, 'square', 0.18, 60); }
export function sfxPickup() { tone(880, 0.09, 'sine', 0.22); setTimeout(() => tone(1320, 0.12, 'sine', 0.22), 80); }
export function sfxCrash() { noiseBurst(0.25, 0.45, 800); tone(70, 0.2, 'sine', 0.3, 40); }
export function sfxMission() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.25), i * 110)); }
export function sfxBusted() { [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sawtooth', 0.2), i * 160)); }
export function sfxClick() { tone(660, 0.06, 'sine', 0.18); }
export function sfxDenied() { tone(160, 0.15, 'square', 0.18, 110); }
