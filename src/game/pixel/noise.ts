/** Integer lattice hash → [0, 1). Stable across platforms (used for seamless world textures). */
export function hash2(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Smooth value noise in [0, 1). */
export function vnoise(x: number, y: number, seed = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = smooth(x - x0);
  const fy = smooth(y - y0);
  const a = hash2(x0, y0, seed);
  const b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed);
  const d = hash2(x0 + 1, y0 + 1, seed);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/** Fractal value noise (3 octaves) in [0, 1). */
export function fbm(x: number, y: number, seed = 0, octaves = 3): number {
  let v = 0;
  let amp = 0.5;
  let tot = 0;
  for (let o = 0; o < octaves; o++) {
    v += vnoise(x, y, seed + o * 31) * amp;
    tot += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return v / tot;
}
