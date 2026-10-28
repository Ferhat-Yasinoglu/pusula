"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { NEEDLE, TAPE, springAt, stepSpring } from "../../runtime/springs";
import { useDomLoop } from "../../runtime/useDomLoop";
import { Glyph } from "../primitives";
import StrategyLanes from "./StrategyLanes";
import { clampTo, isShortHop, nearestIndex, strategyKey, tunerCell, wrapIndex } from "./routingKit";

/**
 * Part B of the routing station: the strategy tuner (spec §6.5).
 *
 * One listbox of every id in `stats.strategies`, styled two ways:
 * - ≥1280px, a 72px tuner band: the ids in two interleaved rows laid out by
 *   their real widths (CSS grid, inset from the rims), and an ember needle
 *   that springs to the selected one. Neighbouring hops use the lively NEEDLE
 *   spring, long jumps a damped one, and the drawn position never leaves the
 *   first…last id, so the needle cannot fly off the instrument;
 * - below 1280px, a horizontal scroll-snap picker: the id centred under the
 *   fixed ember pointers is the selection.
 *
 * Below it the selected id with its description (`strategy_*` via `t.has`),
 * `StrategyLanes` demonstrating it on four lanes, and the full `<dl>` of ids
 * (collapsed behind a disclosure on phone).
 *
 * Alive: an auto-tour advances every 4.5 s while the band is on screen and
 * idle, holding 12 s after any interaction. Reduced motion and Pause: no tour,
 * the needle is placed on the selection at once, the lanes show a static pick.
 */

const TOUR_MS = 4500;
const HOLD_MS = 12000;
const PICKER_SETTLE_MS = 110;
const PROGRAMMATIC_SCROLL_MS = 800;

export type StrategyBandProps = {
  strategies: readonly string[];
  locale: string;
  /** ≥1024px: the lanes figure at 560×240. */
  wide: boolean;
  /** ≥1280px: the tuner band (otherwise the scroll-snap picker). */
  tuner: boolean;
  rtl: boolean;
};

export default function StrategyBand({ strategies, locale, wide, tuner, rtl }: StrategyBandProps) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;
  const count = strategies.length;
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const needleRef = useRef<HTMLSpanElement>(null);
  const optionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const selectedRef = useRef(selected);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  /** ms since the tour last advanced; set negative to hold it after an interaction. */
  const tourMs = useRef(0);

  const describe = useCallback(
    (id: string) => {
      const key = strategyKey(id);
      return t.has(key) ? t(key) : "";
    },
    [t]
  );
  const plain = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const optionId = (i: number) => `rt-strategy-${strategies[i] ?? i}`;

  /*
   * Geometry, measured only in effects and observers (never in the loop):
   * the centre of every option along the list, and the list's width.
   */
  const geo = useRef({ centers: new Float32Array(0), listW: 0, lo: 0, hi: 0, ready: false });
  const programmaticUntil = useRef(0);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const measure = useCallback(() => {
    const list = listRef.current;
    if (!list) return;
    const out = new Float32Array(optionRefs.current.length);
    let lo = Infinity;
    let hi = -Infinity;
    optionRefs.current.forEach((node, i) => {
      const c = node ? node.offsetLeft + node.offsetWidth / 2 : 0;
      out[i] = c;
      if (node) {
        lo = Math.min(lo, c);
        hi = Math.max(hi, c);
      }
    });
    const g = geo.current;
    g.centers = out;
    g.listW = list.clientWidth;
    g.lo = Number.isFinite(lo) ? lo : 0;
    g.hi = Number.isFinite(hi) ? hi : 0;
    g.ready = out.length > 0 && g.listW > 0;
    if (g.ready) bandRef.current?.setAttribute("data-measured", "");
  }, []);

  /** Phone picker: scroll so `index` sits under the pointers (cached geometry only). */
  const centerPicker = useCallback(
    (index: number, smooth: boolean) => {
      const list = listRef.current;
      const g = geo.current;
      if (!list || tuner || !g.ready) return;
      const left = (g.centers[index] ?? 0) - g.listW / 2;
      programmaticUntil.current = performance.now() + PROGRAMMATIC_SCROLL_MS;
      list.scrollTo({ left, behavior: smooth && canAnimate() ? "smooth" : "auto" });
    },
    [tuner]
  );

  /** Tuner needle without a running loop: placed on the selection at once. */
  const placeNeedle = useCallback((index: number) => {
    const g = geo.current;
    const node = needleRef.current;
    if (!node || !g.ready) return;
    node.style.transform = `translateX(${Math.round((g.centers[index] ?? 0) * 10) / 10}px)`;
  }, []);

  const needle = useRef(springAt(0));
  const needleShown = useRef(Number.NaN);
  const hop = useRef({ from: 0, to: 0 });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    measure();
    if (tuner) {
      const g = geo.current;
      needle.current = springAt(g.centers[selectedRef.current] ?? 0);
      needleShown.current = Number.NaN;
      hop.current = { from: selectedRef.current, to: selectedRef.current };
      placeNeedle(selectedRef.current);
    } else {
      centerPicker(selectedRef.current, false);
    }
    const onResize = () => {
      measure();
      if (tuner) {
        const g = geo.current;
        const s = needle.current;
        s.angle = g.centers[selectedRef.current] ?? 0;
        s.velocity = 0;
        needleShown.current = Number.NaN;
        placeNeedle(selectedRef.current);
      } else {
        centerPicker(selectedRef.current, false);
      }
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(onResize) : null;
    observer?.observe(list);
    // Web fonts change the ids' widths (and so the tuner's columns).
    for (const node of optionRefs.current) if (node) observer?.observe(node);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) onResize();
    });

    const onScroll = () => {
      if (tuner) return;
      if (settleTimer.current) clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        if (performance.now() < programmaticUntil.current) return;
        const g = geo.current;
        const index = nearestIndex(g.centers, list.scrollLeft + g.listW / 2);
        if (index !== selectedRef.current) {
          setSelected(index);
          tourMs.current = TOUR_MS - HOLD_MS;
        }
      }, PICKER_SETTLE_MS);
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      alive = false;
      observer?.disconnect();
      list.removeEventListener("scroll", onScroll);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    };
  }, [tuner, count, measure, centerPicker, placeNeedle]);

  /* ---- selection ---- */
  const choose = useCallback(
    (index: number, source: "user" | "tour") => {
      const next = wrapIndex(index, 0, count);
      if (source === "user") tourMs.current = TOUR_MS - HOLD_MS;
      hop.current = { from: selectedRef.current, to: next };
      selectedRef.current = next;
      setSelected(next);
      centerPicker(next, true);
    },
    [count, centerPicker]
  );

  // Reduced motion / Pause: the needle lands on the selection at once.
  useEffect(() => {
    if (motion || !tuner) return;
    const g = geo.current;
    needle.current = springAt(g.centers[selected] ?? 0);
    needleShown.current = Number.NaN;
    placeNeedle(selected);
  }, [motion, tuner, selected, placeNeedle]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        next = wrapIndex(selected, 1, count);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        next = wrapIndex(selected, -1, count);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = count - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    choose(next, "user");
  };

  /* ---- the tuner needle (≥1280) and the auto-tour ---- */
  useDomLoop(
    "routing-band",
    (dt) => {
      tourMs.current += dt * 1000;
      if (tourMs.current >= TOUR_MS) {
        tourMs.current = 0;
        choose(selectedRef.current + 1, "tour");
      }
      if (!tuner) return;
      const g = geo.current;
      const node = needleRef.current;
      if (!g.ready || !node) return;
      const target = g.centers[selectedRef.current] ?? 0;
      const s = needle.current;
      const { from, to } = hop.current;
      stepSpring(s, target, dt, isShortHop(from, to) ? NEEDLE : TAPE);
      // Never drawn past the first or last id: the needle stays on the instrument.
      const x = Math.round(clampTo(s.angle, g.lo, g.hi) * 10) / 10;
      if (x !== needleShown.current) {
        needleShown.current = x;
        node.style.transform = `translateX(${x}px)`;
      }
    },
    { target: rootRef, enabled: motion }
  );

  const selectedId = strategies[selected] ?? "";
  const selectedText = describe(selectedId);
  const title = t("routingStrategiesTitle", { count: plain.format(count) });

  return (
    <div ref={rootRef} className="station-inner rt-strat">
      <header className="rt-strat-head">
        <h3 className="rt-h3">{title}</h3>
        <p className="rt-lead">{t("routingStrategiesLead")}</p>
      </header>

      <div
        ref={bandRef}
        className="rt-band reveal"
        dir="ltr"
        data-mode={tuner ? "tuner" : "picker"}
      >
        <div
          ref={listRef}
          className="rt-band-list"
          role="listbox"
          tabIndex={0}
          aria-label={title}
          aria-activedescendant={optionId(selected)}
          aria-orientation="horizontal"
          style={{ "--rt-cols": count + 1 } as CSSProperties}
          onKeyDown={onKeyDown}
        >
          {strategies.map((id, i) => {
            const cell = tunerCell(i);
            return (
              <div
                key={id}
                ref={(node) => {
                  optionRefs.current[i] = node;
                }}
                id={optionId(i)}
                role="option"
                aria-selected={i === selected}
                className="rt-opt readout"
                data-row={cell.row}
                style={{ "--row": cell.row, "--col": cell.col } as CSSProperties}
                onClick={() => choose(i, "user")}
              >
                <span className="rt-opt-text">{id}</span>
              </div>
            );
          })}
        </div>
        <span className="rt-band-scale" aria-hidden="true" />
        <span className="rt-band-needle-track" aria-hidden="true">
          <span ref={needleRef} className="rt-band-needle-pos">
            <span className="rt-band-needle" />
          </span>
        </span>
        <span className="rt-picker-needle" aria-hidden="true" />
      </div>

      <div className="rt-strat-detail">
        <div className="rt-strat-desc" key={selectedId}>
          <code className="rt-strat-id readout" dir="ltr">
            {selectedId}
          </code>
          {selectedText ? (
            <p className="rt-strat-text" dir={rtl ? "rtl" : "ltr"}>
              {selectedText}
            </p>
          ) : null}
        </div>
        <StrategyLanes
          strategy={selectedId}
          compact={!wide}
          rtl={rtl}
          onInteract={() => {
            tourMs.current = TOUR_MS - HOLD_MS;
          }}
        />
      </div>

      <dl className="rt-strat-dl" data-open={open ? "" : undefined} id="rt-strat-dl">
        {strategies.map((id, i) => (
          <div key={id} className="rt-dl-item" data-selected={i === selected ? "" : undefined}>
            <dt>
              <button
                type="button"
                className="rt-dl-id readout"
                dir="ltr"
                aria-pressed={i === selected}
                onClick={() => choose(i, "user")}
              >
                {id}
              </button>
            </dt>
            <dd className="rt-dl-text">{describe(id)}</dd>
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="rt-more"
        aria-expanded={open}
        aria-controls="rt-strat-dl"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? t("catalogShowLess") : title}</span>
        <Glyph name="chevron" size={16} tone="current" className="rt-more-glyph" />
      </button>
    </div>
  );
}
