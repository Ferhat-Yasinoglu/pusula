/**
 * The keep-out zones `labelLayout` steers the hero's candidate labels around,
 * in dial coordinates: hard zones measured from the DOM on resize (the
 * headline's words, the copy rows, the HUD, the score caption) and soft ones
 * the overlay writes every frame for the cardinal letters.
 */
import { ZONE_STRIDE } from "./labelLayout";

/** Static keep-out zones (copy, HUD, caption) plus four soft ones for the cardinal letters. */
const MAX_STATIC_ZONES = 10;
export const MAX_ZONES = MAX_STATIC_ZONES + 4;

/** Writes zone `n` (x, y, w, h, soft flag) into the zone buffer. */
export function writeZone(
  zones: Float32Array,
  n: number,
  x: number,
  y: number,
  w: number,
  h: number,
  soft: boolean
): void {
  const o = n * ZONE_STRIDE;
  zones[o] = x;
  zones[o + 1] = y;
  zones[o + 2] = w;
  zones[o + 3] = h;
  zones[o + 4] = soft ? 1 : 0;
}

/**
 * Hard keep-out zones for the labels, in dial coordinates (read on resize
 * only): the headline's lines (their words, not the full block), the lead,
 * the CTA row, the HUD and the score caption; stacked layouts keep
 * everything below the headline's top.
 */
export function measureZones(
  dial: HTMLElement,
  copy: HTMLElement | null,
  hud: HTMLElement | null,
  note: HTMLElement | null,
  zones: Float32Array,
  countRef: { current: number }
): void {
  let n = 0;
  const push = (x: number, y: number, w: number, h: number) => {
    if (n >= MAX_STATIC_ZONES || !(w > 0) || !(h > 0)) return;
    writeZone(zones, n, x - dial.offsetLeft, y - dial.offsetTop, w, h, false);
    n++;
  };
  if (copy) {
    const title = copy.querySelector<HTMLElement>(".bridge-title");
    const stacked = window.innerWidth < 1024;
    if (title && stacked) {
      push(-1e4, copy.offsetTop + title.offsetTop - 6, 2e4, 1e5);
    } else if (title) {
      copy.querySelectorAll<HTMLElement>(".bridge-title .wr-line").forEach((line) => {
        let left = Infinity;
        let right = -Infinity;
        line.querySelectorAll<HTMLElement>(".wr-w").forEach((word) => {
          left = Math.min(left, word.offsetLeft);
          right = Math.max(right, word.offsetLeft + word.offsetWidth);
        });
        if (right > left) {
          // Lines and words are laid out against the copy block (their offset parent).
          push(
            copy.offsetLeft + left - 8,
            copy.offsetTop + line.offsetTop,
            right - left + 16,
            line.offsetHeight
          );
        }
      });
      for (const sel of [".bridge-version", ".bridge-line3", ".bridge-lead", ".bridge-cta"]) {
        const el = copy.querySelector<HTMLElement>(sel);
        if (el && el.offsetWidth > 0)
          push(
            copy.offsetLeft + el.offsetLeft,
            copy.offsetTop + el.offsetTop,
            el.offsetWidth,
            el.offsetHeight
          );
      }
    }
  }
  if (hud && hud.offsetWidth > 0) {
    push(hud.offsetLeft - 8, hud.offsetTop - 8, hud.offsetWidth + 16, hud.offsetHeight + 16);
  }
  if (note && note.offsetWidth > 0) {
    // Inside the dial already: its own offsets are dial coordinates.
    writeZone(
      zones,
      n,
      note.offsetLeft - 4,
      note.offsetTop - 4,
      note.offsetWidth + 8,
      note.offsetHeight + 8,
      false
    );
    n++;
  }
  countRef.current = n;
}
