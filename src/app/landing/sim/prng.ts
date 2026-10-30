/**
 * Seeded randomness for the landing page's simulation and decorations.
 *
 * Nothing on the landing page may call `Math.random` during render: the server
 * and the client must produce byte-identical markup, and the simulated deck
 * must replay identically from its seed (two worlds with the same seed and the
 * same actions produce the same event log). These helpers are called only
 * inside effects, animation loops and the simulation step — never in render.
 *
 * mulberry32 is split into a state step and a state-to-value mix so the deck
 * can keep its generator as a plain number inside the world (cloneable, no
 * closure) while decorations use the ordinary closure form.
 */

export type Rng = () => number;

/** The additive constant of mulberry32: the generator's whole state transition. */
const MULBERRY_STEP = 0x6d2b79f5;

/** Advance a mulberry32 state by one draw. */
export function mulberry32Next(state: number): number {
  return (state + MULBERRY_STEP) | 0;
}

/** The uniform [0, 1) value a mulberry32 state maps to (after `mulberry32Next`). */
export function mulberry32Value(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A seeded uniform generator over [0, 1). Same seed, same sequence, everywhere. */
export function mulberry32(seed: number): Rng {
  let state = seed | 0;
  return () => {
    state = mulberry32Next(state);
    return mulberry32Value(state);
  };
}

/**
 * A stable 32-bit hash of any mix of strings and numbers (FNV-1a over the
 * parts, then a murmur3 finaliser so nearby inputs land far apart). Used to
 * derive per-item phases — a star's twinkle, a cell's flip offset — without
 * keeping a generator around.
 */
export function hash32(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (let p = 0; p < parts.length; p++) {
    const text = typeof parts[p] === "number" ? String(parts[p]) : (parts[p] as string);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Separator, so ("ab", "c") and ("a", "bc") hash differently.
    h ^= 0xff;
    h = Math.imul(h, 0x01000193);
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** A uniform integer in [min, max] (both inclusive). */
export function int(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** In-place Fisher–Yates shuffle; returns the same array. */
export function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
  return items;
}

/**
 * Index drawn with probability proportional to `weights[i]` (non-finite and
 * negative weights count as 0). Returns -1 when every weight is 0.
 */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  let total = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (Number.isFinite(w) && w > 0) total += w;
  }
  if (total <= 0) return -1;
  let r = rng() * total;
  let last = -1;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (!(Number.isFinite(w) && w > 0)) continue;
    last = i;
    r -= w;
    if (r < 0) return i;
  }
  // Float residue: the draw landed on the closing edge.
  return last;
}
