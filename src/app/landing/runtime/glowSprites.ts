/**
 * Pre-rendered glow sprites for the landing canvases.
 *
 * `shadowBlur` and `ctx.filter` re-run a blur on every draw call and are the
 * single most expensive thing a 2D canvas can do per frame, so they are banned
 * on this page. Instead each glow is a radial gradient rendered ONCE into a
 * small offscreen canvas and stamped with `drawImage` under additive
 * ("lighter") compositing, which also makes overlapping glows brighten like
 * real light instead of stacking grey halos.
 *
 * Client-only: sprites need `document`. Call these from `setup`/`draw`, never
 * during render.
 */

export type GlowColor = "gold" | "goldHi" | "phosphor" | "ember";
export type GlowSpriteSize = 16 | 32 | 64;

/** The page palette (`landing.css` tokens) as RGB, so canvases match the CSS exactly. */
export const GLOW_RGB: Readonly<Record<GlowColor, readonly [number, number, number]>> = {
  gold: [0xd4, 0xa8, 0x40], // --gold
  goldHi: [0xff, 0xd3, 0x6e], // --gold-hi
  phosphor: [0xff, 0xf1, 0xc9], // --phosphor
  ember: [0xff, 0x7a, 0x45], // --ember
};

export type GlowSprite = {
  readonly image: HTMLCanvasElement;
  readonly px: GlowSpriteSize;
  readonly color: GlowColor;
};

/** Gaussian sharpness: 4 gives a bright core with a long soft tail. */
const GLOW_FALLOFF = 4;

/**
 * Normalised glow falloff at radius `r` (0 = centre, 1 = sprite edge): a
 * Gaussian re-based so it reaches exactly 0 at the edge (no visible square
 * cut-off when sprites overlap) and exactly 1 at the centre.
 */
export function glowAlphaAt(r: number): number {
  if (r <= 0) return 1;
  if (r >= 1) return 0;
  const edge = Math.exp(-GLOW_FALLOFF);
  return (Math.exp(-GLOW_FALLOFF * r * r) - edge) / (1 - edge);
}

/** Gradient stops sampled from `glowAlphaAt`; 9 is visually indistinguishable from continuous. */
export const GLOW_STOPS: readonly number[] = [0, 0.08, 0.18, 0.3, 0.42, 0.56, 0.7, 0.85, 1];

const cache = new Map<string, GlowSprite>();

/**
 * The sprite for `color` at `px`×`px` backing pixels, rendered on first use
 * and cached for the life of the page. Pick the smallest `px` that still
 * looks smooth at the drawn size (a sprite may be drawn larger; glows are
 * soft, so upscaling is invisible up to about 4×).
 */
export function getSprite(color: GlowColor, px: GlowSpriteSize): GlowSprite {
  const key = `${color}:${px}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const image = document.createElement("canvas");
  image.width = px;
  image.height = px;
  const ctx = image.getContext("2d");
  if (ctx) {
    const [r, g, b] = GLOW_RGB[color];
    const half = px / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    for (const stop of GLOW_STOPS) {
      const alpha = Math.round(glowAlphaAt(stop) * 1000) / 1000;
      gradient.addColorStop(stop, `rgba(${r},${g},${b},${alpha})`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, px, px);
  }

  const sprite: GlowSprite = { image, px, color };
  cache.set(key, sprite);
  return sprite;
}

/**
 * Stamp one glow centred on (x, y), `size` CSS px across, with additive
 * blending. Restores the context's composite mode and alpha afterwards
 * without `save()/restore()` (which copies the whole state stack).
 */
export function drawGlow(
  ctx: CanvasRenderingContext2D,
  sprite: GlowSprite,
  x: number,
  y: number,
  size: number,
  alpha: number
): void {
  if (!(size > 0) || !(alpha > 0)) return;
  const previousOperation = ctx.globalCompositeOperation;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = alpha > 1 ? 1 : alpha;
  const half = size / 2;
  ctx.drawImage(sprite.image, x - half, y - half, size, size);
  ctx.globalAlpha = previousAlpha;
  ctx.globalCompositeOperation = previousOperation;
}

/**
 * Stamp many glows of one sprite in a single composite-mode switch: hundreds
 * of stars per frame without touching context state per star. `data` holds
 * `count` records of `stride` floats laid out as `x, y, size, alpha, …`
 * (extra fields after the first four are ignored), typically a pooled
 * `Float32Array` the renderer refills each frame.
 */
export function drawGlowBatch(
  ctx: CanvasRenderingContext2D,
  sprite: GlowSprite,
  data: ArrayLike<number>,
  count: number,
  stride = 4
): void {
  if (count <= 0) return;
  const previousOperation = ctx.globalCompositeOperation;
  const previousAlpha = ctx.globalAlpha;
  ctx.globalCompositeOperation = "lighter";
  const limit = Math.min(count, Math.floor(data.length / stride));
  for (let i = 0; i < limit; i++) {
    const o = i * stride;
    const size = data[o + 2];
    const alpha = data[o + 3];
    if (!(size > 0) || !(alpha > 0)) continue;
    ctx.globalAlpha = alpha > 1 ? 1 : alpha;
    const half = size / 2;
    ctx.drawImage(sprite.image, data[o] - half, data[o + 1] - half, size, size);
  }
  ctx.globalAlpha = previousAlpha;
  ctx.globalCompositeOperation = previousOperation;
}
