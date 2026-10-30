/**
 * The maths and the small browser helpers behind the landing page's
 * primitives (`Needle`, `LiveNumber`, `SplitFlap`, `TypeLine`, `WordReveal`,
 * `MagneticButton`, `CopyChip`, …).
 *
 * Everything above the "Browser helpers" divider is pure: no React, no DOM, no
 * clock, no `Math.random`. Those functions run during render, so the server
 * and the client must get byte-identical answers from them, and
 * `tests/unit/landing-primitives.test.ts` pins them. The browser helpers below
 * touch `window`/`document` only when called (never at import), so this module
 * is safe to load on the server and in the test runner.
 */
import { hash32, mulberry32, type Rng } from "../../sim/prng";

/** Window event `IntroSequence` dispatches when the hero takes over from the intro (§5.1). */
export const INTRO_HANDOFF_EVENT = "pusula:intro-handoff";

/** Join class names, skipping falsy entries. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  let out = "";
  for (const part of parts) {
    if (!part) continue;
    out = out ? `${out} ${part}` : part;
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Locale-aware numbers                                                     */
/* ------------------------------------------------------------------------ */

const formatterCache = new Map<string, Intl.NumberFormat>();

/**
 * A cached `Intl.NumberFormat`. The locale is always explicit (never the
 * runtime default), so a Persian page prints Persian digits on the server and
 * on the client alike.
 */
export function numberFormat(
  locale: string,
  options?: Intl.NumberFormatOptions
): Intl.NumberFormat {
  const key = options ? `${locale}|${JSON.stringify(options)}` : locale;
  let format = formatterCache.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, format);
  }
  return format;
}

const digitCache = new Map<string, readonly string[]>();

/** The locale's ten digit glyphs, 0 to 9, straight from `Intl` (fa → ۰…۹). */
export function localeDigits(locale: string): readonly string[] {
  let digits = digitCache.get(locale);
  if (!digits) {
    const format = numberFormat(locale, { useGrouping: false });
    digits = Array.from({ length: 10 }, (_, d) => format.format(d));
    digitCache.set(locale, digits);
  }
  return digits;
}

/** The value (0..9) of `ch` in `digits`, or -1 when it is not one of them. */
export function digitValue(digits: readonly string[], ch: string): number {
  for (let d = 0; d < digits.length; d++) if (digits[d] === ch) return d;
  return -1;
}

/**
 * A compass bearing as the station kickers print it: a whole number of
 * degrees, normalised to 0..359 and zero-padded to three digits in the
 * locale's own digits ("045", "۰۴۵"). The degree sign is added by the caller.
 */
export function formatBearing(locale: string, degrees: number): string {
  const whole = ((Math.round(degrees) % 360) + 360) % 360;
  return numberFormat(locale, { minimumIntegerDigits: 3, useGrouping: false }).format(whole);
}

/* ------------------------------------------------------------------------ */
/* Word splitting (WordReveal)                                              */
/* ------------------------------------------------------------------------ */

export type WordPiece = { text: string; space: boolean };

/**
 * Whitespace a line may break at. No-break spaces (U+00A0, U+2007, U+202F) are
 * deliberately missing: words joined by them must stay one unbreakable piece.
 * U+200C (ZWNJ, inside Persian words) is not whitespace at all.
 */
const BREAKING_SPACE = /[\t\n\f\r   -  -  　]/;
/** Scripts written without spaces: their words are split by the segmenter alone. */
const SPACELESS =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Lao}\p{Script=Khmer}\p{Script=Myanmar}]/u;

/**
 * Split a line into words and the whitespace between them, for a word-by-word
 * reveal. Words come from `Intl.Segmenter(locale, { granularity: "word" })`
 * and are never cut into graphemes, so Arabic-script joining stays intact.
 * Punctuation stays glued to its word ("endpoint." is one piece), and a piece
 * only ends at breakable whitespace, so the reveal never introduces a line
 * break the plain text would not have.
 *
 * Without `Intl.Segmenter` the same whitespace rule is applied directly; for
 * every script that separates words with spaces the two paths produce the
 * same pieces, so server and client markup agree either way.
 */
export function splitWords(text: string, locale: string): WordPiece[] {
  const pieces: WordPiece[] = [];
  let word = "";
  const flushWord = () => {
    if (!word) return;
    pieces.push({ text: word, space: false });
    word = "";
  };
  const addSpace = (ch: string) => {
    flushWord();
    const last = pieces[pieces.length - 1];
    if (last && last.space) last.text += ch;
    else pieces.push({ text: ch, space: true });
  };
  const addLoose = (segment: string) => {
    for (const ch of segment) {
      if (BREAKING_SPACE.test(ch)) addSpace(ch);
      else word += ch;
    }
  };

  const Segmenter = typeof Intl === "object" ? Intl.Segmenter : undefined;
  if (typeof Segmenter === "function") {
    for (const { segment, isWordLike } of new Segmenter(locale, { granularity: "word" }).segment(
      text
    )) {
      if (!isWordLike) {
        addLoose(segment);
      } else if (word && SPACELESS.test(segment[0]) && SPACELESS.test(word[word.length - 1])) {
        // Two words of a spaceless script touch: the segmenter's boundary is the only one there is.
        flushWord();
        word = segment;
      } else {
        word += segment;
      }
    }
  } else {
    addLoose(text);
  }
  flushWord();
  return pieces;
}

/* ------------------------------------------------------------------------ */
/* Rolling digits (LiveNumber "roll")                                       */
/* ------------------------------------------------------------------------ */

/** Cells in one digit strip: 0..9 twice, so a digit can always roll forwards. */
export const ROLL_STRIP_CELLS = 20;

export type RollCell = { kind: "digit"; from: number; to: number } | { kind: "char"; ch: string };

/**
 * The columns of a rolling number. Every digit of `to` becomes a strip that
 * slides from cell `from` to cell `to` (indices into the doubled 0..9 strip);
 * any other character (group separator, sign, percent) stays still.
 *
 * - First roll (`from === null`): each digit starts at 0 and makes one full
 *   turn before landing, like an odometer waking up.
 * - Later rolls: digits are aligned from the right with the previous value
 *   and roll forwards to the new digit; unchanged digits do not move.
 */
export function rollPlan(from: string | null, to: string, digits: readonly string[]): RollCell[] {
  const toChars = Array.from(to);
  const previous: number[] = [];
  if (from !== null) {
    for (const ch of from) {
      const d = digitValue(digits, ch);
      if (d >= 0) previous.push(d);
    }
  }
  let digitCount = 0;
  for (const ch of toChars) if (digitValue(digits, ch) >= 0) digitCount += 1;

  const cells: RollCell[] = [];
  let seen = 0;
  for (const ch of toChars) {
    const d = digitValue(digits, ch);
    if (d < 0) {
      cells.push({ kind: "char", ch });
      continue;
    }
    if (from === null) {
      cells.push({ kind: "digit", from: 0, to: 10 + d });
    } else {
      const aligned = previous.length - digitCount + seen;
      const start = aligned >= 0 ? previous[aligned] : 0;
      cells.push({ kind: "digit", from: start, to: start + ((d - start + 10) % 10) });
    }
    seen += 1;
  }
  return cells;
}

/* ------------------------------------------------------------------------ */
/* Typing (TypeLine)                                                        */
/* ------------------------------------------------------------------------ */

/**
 * How many UTF-16 units of each token are visible once `typed` units of the
 * whole line have been typed. Writes into `out` (allocation-free; the typing
 * loop calls this every frame) and never ends a slice between the two halves
 * of a surrogate pair.
 */
export function typeSlices(tokens: readonly string[], typed: number, out: Int32Array): void {
  let offset = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    let visible = typed - offset;
    if (visible <= 0) visible = 0;
    else if (visible >= token.length) visible = token.length;
    else {
      const unit = token.charCodeAt(visible - 1);
      if (unit >= 0xd800 && unit <= 0xdbff) visible += 1;
    }
    out[i] = visible;
    offset += token.length;
  }
}

/** Units typed after `elapsedMs` at `cps` characters per second, capped at `total`. */
export function typedAt(elapsedMs: number, cps: number, total: number): number {
  if (!(elapsedMs > 0) || !(cps > 0)) return 0;
  const typed = Math.floor((elapsedMs * cps) / 1000);
  return typed >= total ? total : typed;
}

/* ------------------------------------------------------------------------ */
/* Split-flap (SplitFlap)                                                   */
/* ------------------------------------------------------------------------ */

/** One flap: the upper half falls (first 45 ms), then the lower half lands (next 45 ms). */
export const FLAP_MS = 90;

/** Letters and numbers flip; spaces and punctuation are fixed tiles. */
export function isFlippable(ch: string): boolean {
  return /[\p{L}\p{N}]/u.test(ch);
}

/**
 * The glyphs one tile shows during a flip: it starts on `from`, passes
 * `flips − 1` seeded glyphs from the locale's digit set (never the same glyph
 * twice in a row) and lands on `to`. Length is `flips + 1`.
 */
export function flapSequence(
  rng: Rng,
  from: string,
  to: string,
  digits: readonly string[],
  flips: number
): string[] {
  const steps = Math.max(1, Math.floor(flips));
  const sequence = [from];
  let previous = from;
  for (let k = 1; k < steps; k++) {
    let glyph = digits[Math.floor(rng() * digits.length)];
    if (glyph === previous) glyph = digits[(digitValue(digits, glyph) + 1) % digits.length];
    sequence.push(glyph);
    previous = glyph;
  }
  sequence.push(to);
  return sequence;
}

/** A seeded generator for one flip run of one value. */
export function flapRng(value: string, run: number): Rng {
  return mulberry32(hash32("flap", value, run));
}

/** Flap angles at phase `u` (0..1) of one flip: the upper flap falls, then the lower one lands. */
export function flapAngles(u: number): { upper: number; lower: number } {
  if (u < 0.5) return { upper: -180 * u, lower: 90 };
  return { upper: -90, lower: 180 * (1 - u) };
}

/* ------------------------------------------------------------------------ */
/* Needle tremor                                                            */
/* ------------------------------------------------------------------------ */

/** Peak tremor of every live needle, in degrees. */
export const TREMOR_DEG = 0.7;

/**
 * A compass card never sits perfectly still. Two incommensurate sines keep the
 * shiver from looking periodic; `phase` (from the needle's id) keeps two
 * needles on screen from shivering in step. Bounded by ±TREMOR_DEG.
 */
export function tremorAt(seconds: number, phase: number): number {
  const slow = Math.sin(2 * Math.PI * 0.83 * seconds + phase);
  const fast = Math.sin(2 * Math.PI * 2.17 * seconds + 1.7 * phase);
  return TREMOR_DEG * (0.62 * slow + 0.38 * fast);
}

/** A stable phase in [0, 2π) for a string id. */
export function phaseOf(id: string): number {
  return (hash32("needle", id) / 4294967296) * 2 * Math.PI;
}

/* ------------------------------------------------------------------------ */
/* Magnet (MagneticButton)                                                  */
/* ------------------------------------------------------------------------ */

export type MagnetPull = { active: boolean; x: number; y: number; labelX: number; labelY: number };

/** The button moves at most this far (px). */
export const MAGNET_MAX = 8;
/** Its label moves at most this far on top (px). */
export const MAGNET_LABEL_MAX = 3;

function clampAbs(value: number, limit: number): number {
  return value > limit ? limit : value < -limit ? -limit : value;
}

/**
 * The pull on a magnetic button for a pointer at offset (dx, dy) from its
 * centre. The field reaches `radius` px beyond the button's edges (half-size
 * hw × hh). Inside it the button follows the pointer by `strength`, clamped to
 * ±8 px, and its label by ±3 px. Writes into `out`.
 */
export function magnetPull(
  dx: number,
  dy: number,
  hw: number,
  hh: number,
  strength: number,
  radius: number,
  out: MagnetPull
): MagnetPull {
  const outsideX = Math.max(Math.abs(dx) - hw, 0);
  const outsideY = Math.max(Math.abs(dy) - hh, 0);
  if (Math.hypot(outsideX, outsideY) > radius) {
    out.active = false;
    out.x = out.y = out.labelX = out.labelY = 0;
    return out;
  }
  out.active = true;
  out.x = clampAbs(dx * strength, MAGNET_MAX);
  out.y = clampAbs(dy * strength, MAGNET_MAX);
  out.labelX = clampAbs(dx * strength * 0.4, MAGNET_LABEL_MAX);
  out.labelY = clampAbs(dy * strength * 0.4, MAGNET_LABEL_MAX);
  return out;
}

/* ------------------------------------------------------------------------ */
/* Copy burst (CopyChip)                                                    */
/* ------------------------------------------------------------------------ */

export type BurstParticle = { angle: number; distance: number; size: number };

/**
 * The particles of the copy burst: evenly spread with a seeded jitter, so the
 * burst looks hand-thrown but renders identically everywhere.
 */
export function burstParticles(count: number): BurstParticle[] {
  const particles: BurstParticle[] = [];
  for (let i = 0; i < count; i++) {
    const h = hash32("burst", i);
    particles.push({
      angle: Math.round((i * 360) / count + ((h % 17) - 8)),
      distance: 16 + ((h >>> 8) % 11),
      size: 2 + ((h >>> 16) % 3),
    });
  }
  return particles;
}

/* ------------------------------------------------------------------------ */
/* Browser helpers (call only from effects and event handlers)              */
/* ------------------------------------------------------------------------ */

/** True while the first-visit intro is playing (`IntroSequence` will fire the hand-off). */
export function introIsPlaying(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-intro") === "play";
}

/** The intro forces its end by 4 s after mount; give up waiting a little later. */
const INTRO_WAIT_LIMIT_MS = 6000;

/**
 * Run `callback` once the intro hands over to the page, or right away when no
 * intro is playing. A timeout guards against an intro that never mounted.
 * Returns a cleanup that cancels the wait.
 */
export function whenIntroHandoff(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  if (!introIsPlaying()) {
    callback();
    return () => {};
  }
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.removeEventListener(INTRO_HANDOFF_EVENT, finish);
    window.clearTimeout(timer);
    callback();
  };
  window.addEventListener(INTRO_HANDOFF_EVENT, finish);
  const timer = window.setTimeout(finish, INTRO_WAIT_LIMIT_MS);
  return () => {
    done = true;
    window.removeEventListener(INTRO_HANDOFF_EVENT, finish);
    window.clearTimeout(timer);
  };
}

export type ViewWatch = {
  /** Fired when the element comes within `nearMargin` of the viewport (before it is visible). */
  onNear?: () => void;
  /** Fired when it leaves that wider zone again. */
  onFar?: () => void;
  /** Fired when it is actually on screen (see `enterMargin` / `enterThreshold`). */
  onEnter?: () => void;
  /** Fired when it leaves the screen. */
  onExit?: () => void;
  /** Default "0px 0px 35% 0px": the zone just below the fold. */
  nearMargin?: string;
  /** Default "0px". */
  enterMargin?: string;
  /** Default 0 (any pixel). */
  enterThreshold?: number;
};

/**
 * Two IntersectionObservers on one element: a wide one that lets a primitive
 * prepare its hidden start state before it scrolls into view, and a tight one
 * that starts the motion once it is on screen. Without IntersectionObserver
 * the element counts as on screen at once. Returns the cleanup.
 */
export function watchView(node: Element, watch: ViewWatch): () => void {
  if (typeof IntersectionObserver === "undefined") {
    watch.onNear?.();
    watch.onEnter?.();
    return () => {};
  }
  const observers: IntersectionObserver[] = [];
  if (watch.onNear || watch.onFar) {
    const near = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting) watch.onNear?.();
        else watch.onFar?.();
      },
      { rootMargin: watch.nearMargin ?? "0px 0px 35% 0px" }
    );
    near.observe(node);
    observers.push(near);
  }
  if (watch.onEnter || watch.onExit) {
    const threshold = watch.enterThreshold ?? 0;
    const enter = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (entry.isIntersecting && entry.intersectionRatio >= threshold) watch.onEnter?.();
        else if (!entry.isIntersecting) watch.onExit?.();
      },
      { rootMargin: watch.enterMargin ?? "0px", threshold: threshold > 0 ? [0, threshold] : 0 }
    );
    enter.observe(node);
    observers.push(enter);
  }
  return () => {
    for (const observer of observers) observer.disconnect();
  };
}

/** True when the primary pointer can hover precisely (the magnet is pointless on touch). */
export function hasFinePointer(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(pointer: fine)").matches
    : false;
}
