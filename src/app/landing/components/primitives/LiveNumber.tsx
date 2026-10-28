"use client";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Ref,
} from "react";
import { useLocale } from "next-intl";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import SplitFlap from "./SplitFlap";
import {
  ROLL_STRIP_CELLS,
  cx,
  localeDigits,
  numberFormat,
  rollPlan,
  watchView,
  whenIntroHandoff,
} from "./primitiveKit";
import "./primitives.css";

/**
 * A number that is always real text. The server renders the final value,
 * formatted by `Intl.NumberFormat` with the page's explicit locale (Persian
 * digits in fa), and that text is what assistive technology and copy-paste
 * see in every mode.
 *
 * - `roll`: on arrival (or when `value` changes) an `aria-hidden` overlay of
 *   locale digit strips slides into place by `translateY` (1400ms
 *   `--ease-out`, digits 60ms apart) while the real text underneath is
 *   transparent. The first roll starts every digit at 0 and turns it once.
 *   The overlay is built imperatively and removed when the last strip lands,
 *   so React renders the number exactly once.
 * - `tick`: simulation counters. `set(n)` rewrites the text directly, with
 *   no React render; the server renders `value` (pass 0 for sim counters).
 * - `flap`: delegates to `SplitFlap` with the formatted value.
 *
 * Reduced motion: the final text only. Pause lands a running roll at once.
 */

export type LiveNumberHandle = {
  /** Show `n` now (tick: direct text write; roll: rolls to it; flap: flips to it). */
  set(n: number): void;
};

export type LiveNumberProps = {
  value: number;
  mode: "roll" | "tick" | "flap";
  format?: Intl.NumberFormatOptions;
  /** When the first roll or flip plays (default "view"). Ignored by `tick`. */
  startOn?: "view" | "intro";
  /** Roll length in ms (default 1400); the intro's boot lines use 260. */
  duration?: number;
  /** ms between neighbouring roll strips (default 60). */
  stagger?: number;
  className?: string;
  ref?: Ref<LiveNumberHandle>;
};

/** Below the fold by this much, the overlay is prepared in its start position. */
const ARM_MARGIN = "0px 0px 40% 0px";

export default function LiveNumber({
  value,
  mode,
  format,
  startOn = "view",
  duration = 1400,
  stagger = 60,
  className,
  ref,
}: LiveNumberProps) {
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const formatter = useMemo(() => numberFormat(locale, format), [locale, format]);
  const text = useMemo(() => formatter.format(value), [formatter, value]);

  // `set()` in flap mode re-renders the flap with the new value, until the
  // `value` prop itself changes again.
  const [flapOverride, setFlapOverride] = useState<{ base: number; n: number } | null>(null);

  const rootRef = useRef<HTMLSpanElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLSpanElement | null>(null);
  /** The text currently shown (what the next roll starts from). */
  const shownRef = useRef(text);
  const startedRef = useRef(false);

  const endRoll = useCallback(() => {
    overlayRef.current?.remove();
    overlayRef.current = null;
    rootRef.current?.removeAttribute("data-rolling");
  }, []);

  /**
   * Build the strip overlay for a roll from `from` (null: from zeros) to `to`.
   * `armed` leaves it parked on the start digits; `release()` starts it.
   */
  const buildRoll = useCallback(
    (from: string | null, to: string, armed: boolean) => {
      endRoll();
      const root = rootRef.current;
      if (!root) return;
      const digits = localeDigits(locale);
      const plan = rollPlan(from, to, digits);
      const overlay = document.createElement("span");
      overlay.className = armed ? "ln-roll ln-armed" : "ln-roll";
      overlay.setAttribute("aria-hidden", "true");
      overlay.dir = "ltr";
      overlay.style.setProperty("--ln-dur", `${duration}ms`);
      overlay.style.setProperty("--ln-stagger", `${stagger}ms`);
      let column = 0;
      let lastStrip: HTMLElement | null = null;
      for (const cell of plan) {
        if (cell.kind === "char") {
          const ch = document.createElement("span");
          ch.className = "ln-ch";
          ch.textContent = cell.ch;
          overlay.appendChild(ch);
          continue;
        }
        const win = document.createElement("span");
        win.className = "ln-win";
        const strip = document.createElement("span");
        strip.className = "ln-strip";
        strip.style.setProperty("--ln-i", String(column));
        strip.style.setProperty("--ln-from", String(cell.from));
        strip.style.setProperty("--ln-to", String(cell.to));
        for (let k = 0; k < ROLL_STRIP_CELLS; k++) {
          const digit = document.createElement("span");
          digit.textContent = digits[k % 10];
          strip.appendChild(digit);
        }
        win.appendChild(strip);
        overlay.appendChild(win);
        lastStrip = strip;
        column += 1;
      }
      if (!lastStrip) return;
      const finalStrip = lastStrip;
      finalStrip.addEventListener("animationend", (event) => {
        if (event.target === finalStrip && overlayRef.current === overlay) endRoll();
      });
      overlayRef.current = overlay;
      root.appendChild(overlay);
      root.setAttribute("data-rolling", "");
    },
    [locale, duration, stagger, endRoll]
  );

  const release = useCallback(() => {
    overlayRef.current?.classList.remove("ln-armed");
  }, []);

  const rollTo = useCallback(
    (to: string, fromZero: boolean) => {
      const from = fromZero ? null : shownRef.current;
      shownRef.current = to;
      if (!canAnimate() || from === to) {
        endRoll();
        return;
      }
      buildRoll(from, to, false);
    },
    [buildRoll, endRoll]
  );

  useImperativeHandle(
    ref,
    () => ({
      set(n: number) {
        if (mode === "flap") {
          setFlapOverride({ base: value, n });
          return;
        }
        const next = formatter.format(n);
        if (mode === "roll") {
          if (textRef.current) textRef.current.textContent = next;
          rollTo(next, false);
          return;
        }
        shownRef.current = next;
        if (textRef.current && textRef.current.textContent !== next) {
          textRef.current.textContent = next;
        }
      },
    }),
    [mode, value, formatter, rollTo]
  );

  // The first roll: armed just below the fold, released once on screen.
  useEffect(() => {
    const node = rootRef.current;
    if (!node || mode !== "roll") return;
    const begin = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      if (!canAnimate()) return;
      if (overlayRef.current?.classList.contains("ln-armed")) release();
      else rollTo(shownRef.current, true);
    };
    if (startOn === "intro") return whenIntroHandoff(begin);
    return watchView(node, {
      nearMargin: ARM_MARGIN,
      onNear: () => {
        if (!startedRef.current && canAnimate()) buildRoll(null, shownRef.current, true);
      },
      onFar: () => {
        if (!startedRef.current) endRoll();
      },
      onEnter: begin,
    });
  }, [mode, startOn, buildRoll, release, rollTo, endRoll]);

  // A changed `value` rolls from what is shown now (roll) or simply shows (tick).
  // Before paint, so the new text React just rendered never flashes first.
  useLayoutEffect(() => {
    if (shownRef.current === text) return;
    if (mode === "roll" && startedRef.current) {
      rollTo(text, false);
      return;
    }
    shownRef.current = text;
    // Still parked below the fold: re-park on the new digits.
    if (mode === "roll" && overlayRef.current) buildRoll(null, text, true);
  }, [text, mode, rollTo, buildRoll]);

  useEffect(() => {
    if (reduced || paused) endRoll();
  }, [reduced, paused, endRoll]);

  useEffect(() => endRoll, [endRoll]);

  if (mode === "flap") {
    const flapText =
      flapOverride && flapOverride.base === value ? formatter.format(flapOverride.n) : text;
    return <SplitFlap value={flapText} startOn={startOn} className={cx("ln ln-flap", className)} />;
  }

  return (
    <span ref={rootRef} className={cx("ln", className)} data-mode={mode}>
      <span ref={textRef} className="ln-text">
        {text}
      </span>
    </span>
  );
}
