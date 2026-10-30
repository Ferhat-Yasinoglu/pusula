/**
 * The network map's palette (landing.css tokens) and stroke patterns, shared
 * by the canvas renderer (`mapRender.ts`) and its dot matrix (`mapDots.ts`).
 * Client-only, like both of them.
 */

export const GOLD = "#d4a840";
export const GOLD_HI = "#ffd36e";
export const GOLD_LO = "#8c6a1e";
export const PHOSPHOR = "#fff1c9";
export const EMBER = "#ff7a45";
export const VOID = "#040405";
/** Ember-gold, the tint of a fallback leg (between --ember and --gold-hi). */
export const EMBER_GOLD = "#ffa65a";
export const CODE_FONT = "600 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Five dot bands, dim gold to phosphor: [r, g, b, alpha]. */
const BAND_RGBA: readonly (readonly [number, number, number, number])[] = [
  [140, 106, 30, 0.62],
  [176, 136, 48, 0.78],
  [212, 168, 64, 0.9],
  [255, 211, 110, 0.96],
  [255, 241, 201, 1],
];
export const BANDS = BAND_RGBA.length;
export const BAND_FILL: readonly string[] = BAND_RGBA.map(
  ([r, g, b, a]) => `rgba(${r},${g},${b},${a})`
);
export const DASH_NONE: number[] = [];
export const DASH_HUB: number[] = [3, 4];
export const DASH_CUT: number[] = [5, 5];
/** The poster's spoke dash (`strokeDasharray="3 5"` in MapPoster). */
export const DASH_SPOKE: number[] = [3, 5];
