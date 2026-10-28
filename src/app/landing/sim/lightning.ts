/**
 * Lightning bolts for the resilience rail's provider failures (a 503 striking
 * the provider band). Classic midpoint displacement: the segment is halved
 * `depth` times and every new midpoint is pushed sideways by a seeded amount
 * that halves with each level, so the bolt is jagged at every scale but never
 * wanders far from its chord.
 *
 * Pure and seeded (the caller passes the rng), so a bolt is reproducible and
 * nothing here touches `Math.random`. A bolt is built once per strike — not per
 * frame — and drawn from its flat Float32Arrays (x0, y0, x1, y1, …).
 */
import type { Rng } from "./prng";

export type Bolt = { main: Float32Array; branches: Float32Array[] };

/** Sideways displacement of the first midpoint, as a fraction of the chord. */
const ROUGHNESS = 0.22;
/** Each level keeps this share of the previous level's displacement. */
const DECAY = 0.5;
const MAX_DEPTH = 10;

/**
 * Midpoint displacement between two points into a fresh `2^depth + 1`-point
 * polyline.
 */
function displace(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  rng: Rng,
  depth: number,
  roughness: number
): Float32Array {
  const levels = Math.max(0, Math.min(MAX_DEPTH, Math.floor(depth)));
  const count = (1 << levels) + 1;
  const pts = new Float32Array(count * 2);
  const last = count - 1;
  pts[0] = ax;
  pts[1] = ay;
  pts[last * 2] = bx;
  pts[last * 2 + 1] = by;
  const length = Math.hypot(bx - ax, by - ay);
  let amplitude = length * roughness;
  for (let span = last; span > 1; span >>= 1) {
    const half = span >> 1;
    for (let i = 0; i < last; i += span) {
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[(i + span) * 2];
      const y1 = pts[(i + span) * 2 + 1];
      const dx = x1 - x0;
      const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1;
      // Unit normal of this sub-segment.
      const nx = -dy / len;
      const ny = dx / len;
      const offset = (rng() * 2 - 1) * amplitude;
      const m = (i + half) * 2;
      pts[m] = (x0 + x1) / 2 + nx * offset;
      pts[m + 1] = (y0 + y1) / 2 + ny * offset;
    }
    amplitude *= DECAY;
  }
  return pts;
}

/**
 * A seeded lightning bolt from (ax, ay) to (bx, by): a main channel of
 * `2^depth + 1` points and 1–3 shorter forks that leave the channel at random
 * points, angled up to ±35° off its direction and reaching 20–45% of the
 * remaining distance.
 */
export function bolt(ax: number, ay: number, bx: number, by: number, rng: Rng, depth = 6): Bolt {
  const main = displace(ax, ay, bx, by, rng, depth, ROUGHNESS);
  const branches: Float32Array[] = [];
  const points = main.length / 2;
  if (points < 5) return { main, branches };

  const forks = 1 + Math.floor(rng() * 3);
  const dirX = bx - ax;
  const dirY = by - ay;
  const total = Math.hypot(dirX, dirY) || 1;
  for (let f = 0; f < forks; f++) {
    // Leave from the middle stretch of the channel, never its ends.
    const at = Math.floor((0.2 + rng() * 0.5) * (points - 1));
    const sx = main[at * 2];
    const sy = main[at * 2 + 1];
    const remaining = total * (1 - at / (points - 1));
    const reach = remaining * (0.2 + rng() * 0.25);
    const angle = Math.atan2(dirY, dirX) + (rng() * 2 - 1) * ((35 * Math.PI) / 180);
    const ex = sx + Math.cos(angle) * reach;
    const ey = sy + Math.sin(angle) * reach;
    branches.push(displace(sx, sy, ex, ey, rng, Math.max(1, depth - 2), ROUGHNESS * 1.3));
  }
  return { main, branches };
}
