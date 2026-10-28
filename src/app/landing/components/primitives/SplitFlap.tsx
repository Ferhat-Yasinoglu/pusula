"use client";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  type Ref,
} from "react";
import { useLocale } from "next-intl";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, register, usePaused } from "../../runtime/heartbeat";
import { int } from "../../sim/prng";
import {
  FLAP_MS,
  cx,
  flapAngles,
  flapRng,
  flapSequence,
  isFlippable,
  localeDigits,
  watchView,
  whenIntroHandoff,
} from "./primitiveKit";
import "./primitives.css";

/**
 * A split-flap readout, one tile per character, like a station departure
 * board. Each tile is two half-tiles (`--bezel` with a centre hairline); a
 * change flips the upper flap down (`rotateX` 0 → −90°) and then the lower
 * flap into place (90° → 0), 45ms each, with `backface-visibility: hidden`.
 *
 * - The server renders the value on the tiles and once more as visually
 *   hidden text; the tiles are `aria-hidden`, so a screen reader hears the
 *   value once and never the flip.
 * - The in-between glyphs come from a seeded generator in effects, drawn from
 *   the locale's own digit set (Persian digits in fa). Every run lands on the
 *   value it was given.
 * - Flipping runs on the heartbeat's `dom` lane: per tile a closed-form
 *   timeline (start = delay + order × stagger) sets the flap angles and swaps
 *   the four half-tile glyphs through `textContent`. No React render per flip.
 * - `startOn`: "view" (default) flips once when the readout is half on
 *   screen, "intro" when the intro hands over, "manual" only on `reflip()`.
 *   A changed `value` always flips from the old glyphs to the new ones.
 * - Reduced motion: no flips, ever. Pause lands a running flip at once.
 */

export type SplitFlapHandle = {
  /** Replay a flip cycle that lands on the same value. */
  reflip(): void;
};

export type SplitFlapProps = {
  value: string;
  /** Flips per tile, inclusive range (default [6, 10]). */
  cycles?: readonly [number, number];
  /** ms between neighbouring tiles starting (default 70). */
  stagger?: number;
  /** ms before the first tile starts (default 0); lets a board stagger its cells. */
  delay?: number;
  startOn?: "view" | "intro" | "manual";
  className?: string;
  ref?: Ref<SplitFlapHandle>;
};

const DEFAULT_CYCLES: readonly [number, number] = [6, 10];

/** The four glyph layers of one tile, back to front. */
type TileLayers = {
  upperBack: HTMLElement;
  lowerBack: HTMLElement;
  upperFlap: HTMLElement;
  lowerFlap: HTMLElement;
  upperFlapGlyph: HTMLElement;
  lowerFlapGlyph: HTMLElement;
};

type TileRun = TileLayers & {
  sequence: string[];
  start: number;
  /** Transition currently shown (-1 before the first). */
  step: number;
  done: boolean;
};

type Run = { elapsed: number; tiles: TileRun[]; unregister: () => void };

function layersOf(tile: HTMLElement): TileLayers | null {
  const [upper, lower, upperFlap, lowerFlap] = Array.from(tile.children) as HTMLElement[];
  const upperBack = upper?.firstElementChild as HTMLElement | null;
  const lowerBack = lower?.firstElementChild as HTMLElement | null;
  const upperFlapGlyph = upperFlap?.firstElementChild as HTMLElement | null;
  const lowerFlapGlyph = lowerFlap?.firstElementChild as HTMLElement | null;
  if (!upperBack || !lowerBack || !upperFlapGlyph || !lowerFlapGlyph) return null;
  return { upperBack, lowerBack, upperFlap, lowerFlap, upperFlapGlyph, lowerFlapGlyph };
}

/** Rest state: every layer on `glyph`, flaps back in their resting angles. */
function restTile(tile: TileLayers, glyph: string): void {
  tile.upperBack.textContent = glyph;
  tile.lowerBack.textContent = glyph;
  tile.upperFlapGlyph.textContent = glyph;
  tile.lowerFlapGlyph.textContent = glyph;
  tile.upperFlap.style.transform = "";
  tile.lowerFlap.style.transform = "";
}

/** The flippable tiles of a readout, keyed by character index. */
function tilesOf(root: HTMLElement): Map<number, TileLayers> {
  const tiles = new Map<number, TileLayers>();
  root.querySelectorAll<HTMLElement>(".sf-tile[data-i]").forEach((node) => {
    const layers = layersOf(node);
    if (layers) tiles.set(Number(node.dataset.i), layers);
  });
  return tiles;
}

export default function SplitFlap({
  value,
  cycles = DEFAULT_CYCLES,
  stagger = 70,
  delay = 0,
  startOn = "view",
  className,
  ref,
}: SplitFlapProps) {
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const chars = useMemo(() => Array.from(value), [value]);
  const [minFlips, maxFlips] = cycles;

  const rootRef = useRef<HTMLSpanElement>(null);
  const runRef = useRef<Run | null>(null);
  const runCountRef = useRef(0);
  /** What every tile shows at rest (the value the last run landed on). */
  const shownRef = useRef<readonly string[]>(chars);

  /** Stop a run and leave every tile resting on its final glyph. */
  const finish = useCallback(() => {
    const run = runRef.current;
    if (!run) return;
    runRef.current = null;
    run.unregister();
    for (const tile of run.tiles) restTile(tile, tile.sequence[tile.sequence.length - 1]);
  }, []);

  /** Flip every flippable tile from what it shows now to `target`. */
  const flipTo = useCallback(
    (target: readonly string[]) => {
      finish();
      const root = rootRef.current;
      const from = shownRef.current;
      shownRef.current = target;
      if (!root || !canAnimate()) return;

      const digits = localeDigits(locale);
      runCountRef.current += 1;
      const rng = flapRng(target.join(""), runCountRef.current);
      const tiles: TileRun[] = [];
      for (const [i, layers] of tilesOf(root)) {
        const to = target[i];
        if (to === undefined) continue;
        const flips = int(rng, minFlips, Math.max(minFlips, maxFlips));
        tiles.push({
          ...layers,
          sequence: flapSequence(rng, from[i] ?? to, to, digits, flips),
          start: delay + tiles.length * stagger,
          step: -1,
          done: false,
        });
      }
      if (tiles.length === 0) return;

      const run: Run = { elapsed: 0, tiles, unregister: () => {} };
      const tick = (dt: number) => {
        run.elapsed += dt * 1000;
        let pending = 0;
        for (const tile of run.tiles) {
          if (tile.done) continue;
          const local = run.elapsed - tile.start;
          if (local < 0) {
            pending += 1;
            continue;
          }
          const transitions = tile.sequence.length - 1;
          const step = Math.floor(local / FLAP_MS);
          if (step >= transitions) {
            restTile(tile, tile.sequence[transitions]);
            tile.done = true;
            continue;
          }
          pending += 1;
          if (step !== tile.step) {
            tile.step = step;
            const current = tile.sequence[step];
            const next = tile.sequence[step + 1];
            // Behind: the next glyph's top, the current glyph's bottom.
            tile.upperBack.textContent = next;
            tile.lowerBack.textContent = current;
            // In front: the current top falls away, the next bottom lands.
            tile.upperFlapGlyph.textContent = current;
            tile.lowerFlapGlyph.textContent = next;
          }
          const angles = flapAngles((local - step * FLAP_MS) / FLAP_MS);
          tile.upperFlap.style.transform = `rotateX(${angles.upper.toFixed(1)}deg)`;
          tile.lowerFlap.style.transform = `rotateX(${angles.lower.toFixed(1)}deg)`;
        }
        if (pending === 0 && runRef.current === run) {
          runRef.current = null;
          run.unregister();
        }
      };
      runRef.current = run;
      run.unregister = register({ id: "split-flap", lane: "dom", tick });
    },
    [finish, locale, minFlips, maxFlips, delay, stagger]
  );

  useImperativeHandle(ref, () => ({ reflip: () => flipTo(shownRef.current) }), [flipTo]);

  // The first flip.
  const startedRef = useRef(false);
  useEffect(() => {
    const node = rootRef.current;
    if (!node || startOn === "manual") return;
    const start = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      flipTo(shownRef.current);
    };
    if (startOn === "intro") return whenIntroHandoff(start);
    return watchView(node, { enterThreshold: 0.5, onEnter: start });
  }, [startOn, flipTo]);

  // A new value flips from the old glyphs. This runs before paint, so the new
  // value React just wrote into the tiles is never seen before the flip.
  const previousValueRef = useRef(value);
  useLayoutEffect(() => {
    if (previousValueRef.current === value) return;
    previousValueRef.current = value;
    finish();
    const root = rootRef.current;
    if (!root || !canAnimate()) {
      shownRef.current = chars;
      return;
    }
    const old = shownRef.current;
    for (const [i, layers] of tilesOf(root)) {
      if (old[i] !== undefined) restTile(layers, old[i]);
    }
    flipTo(chars);
  }, [value, chars, flipTo, finish]);

  // Reduced motion or Pause: land at once.
  useEffect(() => {
    if (reduced || paused) finish();
  }, [reduced, paused, finish]);

  useEffect(() => finish, [finish]);

  return (
    <span ref={rootRef} className={cx("sf", className)}>
      <span className="sr-only">{value}</span>
      <span className="sf-tiles" aria-hidden="true" dir="ltr">
        {chars.map((ch, i) => {
          if (ch.trim() === "") return <span key={i} className="sf-gap" />;
          const flippable = isFlippable(ch);
          return (
            <span
              key={i}
              className="sf-tile"
              data-i={flippable ? i : undefined}
              data-fixed={flippable ? undefined : ""}
            >
              <span className="sf-half sf-upper">
                <span className="sf-glyph">{ch}</span>
              </span>
              <span className="sf-half sf-lower">
                <span className="sf-glyph">{ch}</span>
              </span>
              <span className="sf-half sf-upper sf-flap">
                <span className="sf-glyph">{ch}</span>
              </span>
              <span className="sf-half sf-lower sf-flap">
                <span className="sf-glyph">{ch}</span>
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
