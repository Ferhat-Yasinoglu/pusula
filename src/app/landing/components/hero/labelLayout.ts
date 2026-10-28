/**
 * Placement of the gyro's candidate labels, once per frame and allocation
 * free.
 *
 * Each label wants to sit beside its star. It tries four places in turn: its
 * preferred side, the other side, above the star and below it. A place is
 * rejected when it leaves the stage or covers a hard keep-out zone (the
 * headline's lines, the lead, the CTA row, the HUD). Soft zones (the
 * cardinal letters) are avoided when another place is clear. Labels never
 * overlap: a lower-priority label steps aside vertically from the ones
 * already placed.
 *
 * A label with no clear place is hidden, except a `LABEL_KEEP` one (the
 * provider the needle points at, a focused label): it is never hidden. With
 * every place blocked it is pushed just outside the zone it hits, so the
 * needle never points at an unnamed star.
 *
 * Priority: kept labels, then front-hemisphere labels, then slot order. The
 * order is stable, so labels only move when their stars do.
 *
 * Pure: unit-tested in `tests/unit/landing-intro.test.ts`.
 */

/** Floats per label in the box buffer. */
export const LABEL_STRIDE = 8;
/** Box fields: x, y, w, h (top-left, px; x and y are outputs), priority, flags, star x, star y. */
export const L_X = 0;
export const L_Y = 1;
export const L_W = 2;
export const L_H = 3;
export const L_PRIO = 4;
export const L_FLAGS = 5;
export const L_AX = 6;
export const L_AY = 7;

/** Flag bits. HIDDEN, ABOVE and BELOW are outputs; FLIP is an input (preferred side) and an output. */
export const LABEL_HIDDEN = 1;
/** The star is on the front hemisphere (informational; the caller styles it). */
export const LABEL_FRONT = 2;
/** The label sits on the star's left (its right edge towards the star). */
export const LABEL_FLIP = 4;
/** Never hidden. */
export const LABEL_KEEP = 8;
/** Placed above / below the star, centred on it. */
export const LABEL_ABOVE = 16;
export const LABEL_BELOW = 32;

/** Floats per keep-out rect: x, y, w, h, soft (1) or hard (0). */
export const ZONE_STRIDE = 5;
export const Z_SOFT = 4;

/** Floats in the bounds buffer: min x, min y, max x, max y (the stage, in the same space). */
export const BOUNDS_SIZE = 4;

/** Horizontal gap between a star and a label beside it; vertical gap above or below it. */
export const SIDE_GAP = 14;
export const STACK_GAP = 10;

function overlaps(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
  pad: number
): boolean {
  return ax < bx + bw + pad && bx < ax + aw + pad && ay < by + bh + pad && by < ay + ah + pad;
}

/** 0 clear, 1 soft zones only, 2 a hard zone. */
function zoneHit(
  x: number,
  y: number,
  w: number,
  h: number,
  zones: Float32Array,
  zoneCount: number
): number {
  let hit = 0;
  for (let z = 0; z < zoneCount; z++) {
    const zo = z * ZONE_STRIDE;
    if (!overlaps(x, y, w, h, zones[zo], zones[zo + 1], zones[zo + 2], zones[zo + 3], 0)) continue;
    if (zones[zo + Z_SOFT] > 0) hit = 1;
    else return 2;
  }
  return hit;
}

/** The first hard zone the box overlaps, or -1. */
function firstHardZone(
  x: number,
  y: number,
  w: number,
  h: number,
  zones: Float32Array,
  zoneCount: number
): number {
  for (let z = 0; z < zoneCount; z++) {
    const zo = z * ZONE_STRIDE;
    if (zones[zo + Z_SOFT] > 0) continue;
    if (overlaps(x, y, w, h, zones[zo], zones[zo + 1], zones[zo + 2], zones[zo + 3], 0)) return z;
  }
  return -1;
}

/** Step `y` aside from every visible label already placed (two passes settle chains). */
function stepAside(
  boxes: Float32Array,
  order: Int8Array,
  placed: number,
  x: number,
  y: number,
  w: number,
  h: number,
  gap: number
): number {
  for (let pass = 0; pass < 2; pass++) {
    for (let m = 0; m < placed; m++) {
      const q = order[m] * LABEL_STRIDE;
      if (boxes[q + L_FLAGS] & LABEL_HIDDEN) continue;
      const qy = boxes[q + L_Y];
      const qh = boxes[q + L_H];
      if (!overlaps(x, y, w, h, boxes[q + L_X], qy, boxes[q + L_W], qh, gap - 1)) continue;
      y = y + h / 2 < qy + qh / 2 ? qy - h - gap : qy + qh + gap;
    }
  }
  return y;
}

/**
 * Resolve `count` labels in place. `order` is scratch space (≥ count).
 * `bounds` (min x, min y, max x, max y) is the stage in the boxes' space.
 */
export function resolveLabels(
  boxes: Float32Array,
  count: number,
  zones: Float32Array,
  zoneCount: number,
  order: Int8Array,
  bounds: Float32Array,
  gap = 4
): void {
  // Priority order, highest first (insertion sort; ties keep slot order).
  for (let i = 0; i < count; i++) {
    let j = i;
    const p = boxes[i * LABEL_STRIDE + L_PRIO];
    while (j > 0 && boxes[order[j - 1] * LABEL_STRIDE + L_PRIO] < p) {
      order[j] = order[j - 1];
      j--;
    }
    order[j] = i;
  }
  const minX = bounds[0];
  const minY = bounds[1];
  const maxX = bounds[2];
  const maxY = bounds[3];

  for (let k = 0; k < count; k++) {
    const o = order[k] * LABEL_STRIDE;
    const w = boxes[o + L_W];
    const h = boxes[o + L_H];
    const ax = boxes[o + L_AX];
    const ay = boxes[o + L_AY];
    const inFlags = boxes[o + L_FLAGS];
    const keep = (inFlags & LABEL_KEEP) !== 0;
    const prefFlip = (inFlags & LABEL_FLIP) !== 0;
    const base = inFlags & ~(LABEL_HIDDEN | LABEL_FLIP | LABEL_ABOVE | LABEL_BELOW);

    let bestX = Number.NaN;
    let bestY = 0;
    let bestFlags = 0;
    let softX = Number.NaN;
    let softY = 0;
    let softFlags = 0;
    // The preferred place, for a hidden or forced label.
    let prefX = 0;
    let prefY = 0;
    let prefFlags = 0;

    for (let c = 0; c < 4; c++) {
      let x: number;
      let y: number;
      let flags: number;
      if (c < 2) {
        const left = c === 0 ? prefFlip : !prefFlip;
        x = left ? ax - SIDE_GAP - w : ax + SIDE_GAP;
        y = ay - h / 2;
        flags = left ? LABEL_FLIP : 0;
        if (x < minX || x + w > maxX) {
          if (c === 0) {
            // Off the stage on its preferred side: the other side is the preference.
            prefX = left ? ax + SIDE_GAP : ax - SIDE_GAP - w;
            prefY = y;
            prefFlags = left ? 0 : LABEL_FLIP;
          }
          continue;
        }
      } else {
        x = Math.min(Math.max(ax - w / 2, minX), maxX - w);
        y = c === 2 ? ay - STACK_GAP - h : ay + STACK_GAP;
        flags = c === 2 ? LABEL_ABOVE : LABEL_BELOW;
      }
      y = stepAside(boxes, order, k, x, y, w, h, gap);
      if (c === 0) {
        prefX = x;
        prefY = y;
        prefFlags = flags;
      }
      if (y < minY || y + h > maxY) continue;
      const hit = zoneHit(x, y, w, h, zones, zoneCount);
      if (hit === 0) {
        bestX = x;
        bestY = y;
        bestFlags = flags;
        break;
      }
      if (hit === 1 && Number.isNaN(softX)) {
        softX = x;
        softY = y;
        softFlags = flags;
      }
    }

    if (Number.isNaN(bestX) && !Number.isNaN(softX)) {
      bestX = softX;
      bestY = softY;
      bestFlags = softFlags;
    }
    if (Number.isNaN(bestX)) {
      bestX = prefX;
      bestY = prefY;
      bestFlags = prefFlags;
      if (keep) {
        // Push it just outside the zone it covers: above it, else below it.
        const z = firstHardZone(bestX, bestY, w, h, zones, zoneCount);
        if (z >= 0) {
          const zo = z * ZONE_STRIDE;
          const above = zones[zo + 1] - h - gap;
          const below = zones[zo + 1] + zones[zo + 3] + gap;
          if (above >= minY) bestY = above;
          else if (below + h <= maxY) bestY = below;
        }
      } else {
        bestFlags |= LABEL_HIDDEN;
      }
    }
    boxes[o + L_X] = bestX;
    boxes[o + L_Y] = bestY;
    boxes[o + L_FLAGS] = base | bestFlags;
  }
}
