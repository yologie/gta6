// Solmar City — seeded RNG (mulberry32). Every gameplay decision draws from the
// world's rng; the live game seeds it once, the screenshot scenes seed it fixed,
// so the same seed plus the same inputs always replays the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Live-game seed: real entropy when available. This is the ONLY place entropy
// enters; once the world exists, everything it does uses its own rng.
export function liveRng() {
  let seed = (Math.random() * 0xffffffff) >>> 0;
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    seed = buf[0];
  } catch { /* crypto unavailable; the Math.random seed stands */ }
  return mulberry32(seed);
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

// Shortest signed turn from angle a toward angle b, in (-PI, PI].
export function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}
