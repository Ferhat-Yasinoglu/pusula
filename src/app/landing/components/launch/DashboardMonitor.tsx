"use client";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslations } from "next-intl";
import { DEFAULT_PORT } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { useScrollProgress } from "../../runtime/scrollProgress";
import { useDomLoop } from "../../runtime/useDomLoop";
import { Glyph, MagneticButton, TypeLine, type TypeLineHandle } from "../primitives";
import { watchView } from "../primitives/primitiveKit";
import { cleanId, useMediaMatch } from "./launchDom";
import {
  FACTS,
  HOLD_MS,
  HOTSPOTS,
  LIT_MS,
  NUMERALS,
  PACE_COMPACT,
  PACE_WIDE,
  PANEL_VIEW_MARGIN,
  cpsFor,
  hotspotOf,
  inScanBand,
  nextLit,
  rowDoneMs,
  rowStartMs,
  scanClock,
  stepScan,
  tiltMoving,
  type BootPace,
  type ScanClock,
} from "./launchModel";

/*
 * Part A of the launch station (`MonitorLaunch`, spec §6.9): the monitor and
 * its self-test. The dashboard screenshot in its tilting bezel, the CRT
 * power-on, the self-test rows typed in once the list is in view, the idle
 * scan bar, and the hotspots lit in turn with their rows (or held lit by the
 * visitor). The station's doc comment in `MonitorLaunch.tsx` walks through the
 * whole choreography.
 */

type BootPhase = "rest" | "armed" | "power" | "idle";

type BootState = {
  phase: BootPhase;
  /** ms since power-on. */
  t: number;
  /** Whether the self-test list is in view now (its top above 85% of the viewport). */
  panelIn: boolean;
  /** ms since the rows were released (power-on lead over, list in view); -1: not yet. */
  rowsT: number;
  /** Whether this boot blanked the rows (false when the list was already on screen). */
  rowsArmed: boolean;
  /** Rows that started typing / that show their tick. */
  started: number;
  done: number;
  /** ms towards the next idle step, and the hotspot lit now (-1: none). */
  cycle: number;
  lit: number;
  /** The idle scan sweep, and what the figure's `data-scan` / `data-tilting` show. */
  scan: ScanClock;
  scanShown: boolean;
  tilting: boolean;
};

/** Stacked layouts (the list under the monitor) boot the rows faster. */
const COMPACT_QUERY = "(max-width: 1023px)";

/** The fact row paired with a hotspot. */
function factOfHotspot(hotspot: number): number {
  const id = HOTSPOTS[hotspot]?.fact;
  return FACTS.findIndex((fact) => fact.id === id);
}

export default function DashboardMonitor() {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;
  const uid = cleanId(useId());

  const rootRef = useRef<HTMLDivElement>(null);
  const figRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDListElement>(null);
  const hotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const typeRefs = useRef<(TypeLineHandle | null)[]>([]);
  const bootRef = useRef<BootState>({
    phase: "rest",
    t: 0,
    panelIn: false,
    rowsT: -1,
    rowsArmed: false,
    started: 0,
    done: 0,
    cycle: 0,
    lit: -1,
    scan: scanClock(),
    scanShown: false,
    tilting: false,
  });
  /** Row pace for this layout; the TypeLine speed follows it. */
  const pace = useMediaMatch(COMPACT_QUERY) ? PACE_COMPACT : PACE_WIDE;
  const paceRef = useRef<BootPace>(pace);
  useEffect(() => {
    paceRef.current = pace;
  }, [pace]);
  /** The fact row the visitor is holding lit (hover, focus or tap), or null. */
  const [hold, setHold] = useState<number | null>(null);
  const holdRef = useRef<number | null>(null);
  const holdTimer = useRef(0);

  const progressRef = useScrollProgress(figRef, { mode: "traverse" });

  const titles = FACTS.map((fact) => t(fact.title));
  const descId = (i: number) => `lx-${uid}-d${i}`;

  /**
   * Power state on the monitor and, unless `panel` is false, on the self-test
   * panel (its brackets close in with it).
   */
  const setPower = useCallback((state: "off" | "on" | null, panel = true) => {
    for (const node of panel ? [figRef.current, panelRef.current] : [figRef.current]) {
      if (!node) continue;
      if (state) node.setAttribute("data-power", state);
      else node.removeAttribute("data-power");
    }
  }, []);

  const setRow = useCallback((index: number, state: "off" | "type" | "on" | null) => {
    const row = rowRefs.current[index];
    if (!row) return;
    if (state) row.setAttribute("data-boot", state);
    else row.removeAttribute("data-boot");
  }, []);

  /** Light one hotspot and its row (the idle sequence); -1 clears. */
  const writeLit = useCallback((lit: number) => {
    for (let h = 0; h < HOTSPOTS.length; h++) {
      hotRefs.current[h]?.toggleAttribute("data-lit", h === lit);
    }
    for (let f = 0; f < FACTS.length; f++) {
      rowRefs.current[f]?.toggleAttribute("data-lit", lit >= 0 && hotspotOf(f) === lit);
    }
  }, []);

  /** Everything at rest and readable, now (reduced motion, Pause, left before power-on). */
  const settle = useCallback(
    (phase: BootPhase) => {
      const boot = bootRef.current;
      boot.phase = phase;
      setPower(null);
      for (let i = 0; i < FACTS.length; i++) {
        setRow(i, null);
        typeRefs.current[i]?.complete();
      }
    },
    [setPower, setRow]
  );

  /**
   * Near the viewport: screen off, ready to boot. The rows blank too, unless
   * the list is already on screen (coming back up from below, or a load that
   * lands here): what the reader can see never disappears under them.
   */
  const arm = useCallback(() => {
    const boot = bootRef.current;
    if (boot.phase !== "rest" || !canAnimate()) return;
    const panel = panelRef.current?.getBoundingClientRect();
    boot.rowsArmed = !panel || panel.top >= window.innerHeight || panel.bottom <= 0;
    boot.phase = "armed";
    setPower("off", boot.rowsArmed);
    if (!boot.rowsArmed) return;
    for (let i = 0; i < FACTS.length; i++) {
      setRow(i, "off");
      typeRefs.current[i]?.reset();
    }
  }, [setPower, setRow]);

  const disarm = useCallback(() => {
    if (bootRef.current.phase === "armed") settle("rest");
  }, [settle]);

  /** On screen: power on (the loop then types the rows in). */
  const powerOn = useCallback(() => {
    const boot = bootRef.current;
    if (boot.phase === "armed" && canAnimate()) {
      boot.phase = "power";
      boot.t = 0;
      boot.rowsT = -1;
      // Rows left on screen at rest have nothing to type.
      boot.started = boot.done = boot.rowsArmed ? 0 : FACTS.length;
      setPower("on", boot.rowsArmed);
      return;
    }
    if (boot.phase === "rest" || boot.phase === "armed") {
      settle("idle");
      boot.cycle = LIT_MS - 300;
    }
  }, [setPower, settle]);

  useEffect(() => {
    const node = figRef.current;
    if (!node) return;
    return watchView(node, {
      onNear: arm,
      onFar: disarm,
      onEnter: powerOn,
      enterThreshold: 0.3,
    });
  }, [arm, disarm, powerOn]);

  // The rows type when the list itself is in view. A fling that lands on the
  // list with the monitor barely showing powers the monitor on there and then.
  useEffect(() => {
    const node = panelRef.current;
    if (!node) return;
    return watchView(node, {
      onEnter: () => {
        bootRef.current.panelIn = true;
        if (bootRef.current.phase === "armed") powerOn();
      },
      onExit: () => {
        bootRef.current.panelIn = false;
      },
      enterMargin: PANEL_VIEW_MARGIN,
    });
  }, [powerOn]);

  // Reduced motion or Pause: no boot left half-done, no idle light, no scan
  // or layer hint left on.
  useEffect(() => {
    if (motion) return;
    const boot = bootRef.current;
    if (boot.phase === "armed" || boot.phase === "power") settle("idle");
    const fig = figRef.current;
    fig?.removeAttribute("data-scan");
    fig?.removeAttribute("data-tilting");
    boot.scan = scanClock();
    boot.scanShown = false;
    boot.tilting = false;
    if (reduced) {
      boot.lit = -1;
      writeLit(-1);
    }
  }, [motion, reduced, settle, writeLit]);

  const tick = useCallback(
    (dt: number) => {
      const boot = bootRef.current;
      const ms = dt * 1000;
      const fig = figRef.current;
      const p = progressRef.current;

      // The layer hint only while the tilt still moves; the scan only near the middle.
      const tilting = tiltMoving(p);
      if (tilting !== boot.tilting) {
        boot.tilting = tilting;
        fig?.toggleAttribute("data-tilting", tilting);
      }
      const scanning = boot.phase !== "armed" && stepScan(boot.scan, ms, inScanBand(p));
      if (scanning !== boot.scanShown) {
        boot.scanShown = scanning;
        fig?.toggleAttribute("data-scan", scanning);
      }

      if (boot.phase === "power") {
        const rowPace = paceRef.current;
        boot.t += ms;
        if (boot.rowsT >= 0) boot.rowsT += ms;
        else if (boot.done < FACTS.length && boot.panelIn && boot.t >= rowPace.lead) {
          boot.rowsT = 0;
        }
        if (boot.rowsT >= 0) {
          // The rows' clock on the power-on timeline, as if the list had been in view all along.
          const at = rowPace.lead + boot.rowsT;
          while (boot.started < FACTS.length && at >= rowStartMs(boot.started, rowPace)) {
            setRow(boot.started, "type");
            typeRefs.current[boot.started]?.play();
            boot.started++;
          }
          while (boot.done < boot.started && at >= rowDoneMs(boot.done, rowPace)) {
            typeRefs.current[boot.done]?.complete();
            setRow(boot.done, "on");
            boot.done++;
          }
        }
        if (boot.done >= FACTS.length) {
          boot.phase = "idle";
          boot.cycle = LIT_MS - 240;
        }
        return;
      }
      if (boot.phase !== "idle" || holdRef.current !== null) return;
      boot.cycle += ms;
      if (boot.cycle < LIT_MS) return;
      boot.cycle = 0;
      boot.lit = nextLit(boot.lit, HOTSPOTS.length);
      writeLit(boot.lit);
    },
    [progressRef, setRow, writeLit]
  );

  // Gated on the whole block: on a phone the list is often on screen without the monitor.
  useDomLoop("launch-monitor", tick, { target: rootRef, enabled: motion });

  /** Hold a fact row (and its hotspot) lit for 6s. */
  const light = useCallback(
    (fact: number) => {
      holdRef.current = fact;
      setHold(fact);
      writeLit(-1);
      window.clearTimeout(holdTimer.current);
      holdTimer.current = window.setTimeout(() => {
        holdRef.current = null;
        setHold(null);
        const boot = bootRef.current;
        const hotspot = hotspotOf(fact);
        if (hotspot >= 0) boot.lit = hotspot;
        boot.cycle = LIT_MS - 500;
      }, HOLD_MS);
    },
    [writeLit]
  );

  useEffect(() => () => window.clearTimeout(holdTimer.current), []);

  const onHover = (fact: number) => (event: ReactPointerEvent) => {
    if (event.pointerType !== "touch") light(fact);
  };

  return (
    <div ref={rootRef} className="station-inner lx-a">
      <figure ref={figRef} className="lx-mon" dir="ltr">
        <div className="lx-mon-tilt">
          <div className="lx-mon-frame">
            <div className="lx-mon-bar">
              <span className="lx-mon-dot blink" aria-hidden="true" />
              <span className="lx-mon-url">localhost:{DEFAULT_PORT}/dashboard</span>
              <span className="lx-mon-sep" aria-hidden="true">
                ·
              </span>
              <span className="lx-mon-tag" dir="auto">
                {t("screenshotTag")}
              </span>
            </div>
            <div className="lx-mon-screen">
              <div className="lx-mon-layer">
                {/* eslint-disable-next-line @next/next/no-img-element -- static screenshot, fixed size, no optimisation needed */}
                <img
                  className="lx-mon-img"
                  src="/screenshots/dashboard.png"
                  width={1280}
                  height={720}
                  loading="lazy"
                  decoding="async"
                  alt={t("dashboardScreenshotAlt")}
                />
                <span className="lx-mon-scan" aria-hidden="true" />
                {HOTSPOTS.map((hotspot, h) => {
                  const fact = factOfHotspot(h);
                  return (
                    <button
                      key={hotspot.fact}
                      ref={(node) => {
                        hotRefs.current[h] = node;
                      }}
                      type="button"
                      className="lx-hot"
                      data-side={hotspot.side}
                      data-shape={hotspot.w > 0 ? "pill" : "ring"}
                      data-hold={hold === fact ? "" : undefined}
                      style={
                        {
                          left: `${hotspot.x}%`,
                          top: `${hotspot.y}%`,
                          "--hot-w": `${hotspot.w}%`,
                        } as CSSProperties
                      }
                      aria-label={`${NUMERALS[h]} · ${titles[fact]}`}
                      aria-describedby={descId(fact)}
                      onPointerEnter={onHover(fact)}
                      onFocus={() => light(fact)}
                      onClick={() => light(fact)}
                    >
                      <span className="lx-hot-pulse" aria-hidden="true" />
                      <span className="lx-hot-ring" aria-hidden="true">
                        <span className="lx-hot-core" />
                      </span>
                      <span className="lx-hot-num" aria-hidden="true">
                        {NUMERALS[h]}
                      </span>
                      <span className="lx-hot-chip" aria-hidden="true" dir="auto">
                        <b dir="ltr">{NUMERALS[h]}</b>
                        {titles[fact]}
                      </span>
                    </button>
                  );
                })}
              </div>
              <span className="lx-mon-beam" aria-hidden="true" />
              <span className="lx-mon-bloom" aria-hidden="true" />
              <span className="lx-mon-glass" aria-hidden="true" />
            </div>
            <div className="lx-mon-chin" aria-hidden="true">
              <span className="lx-mon-led" />
            </div>
          </div>
        </div>
        <span className="lx-mon-floor" aria-hidden="true" />
      </figure>

      <div className="lx-test">
        <dl ref={panelRef} className="lx-dl bracketed">
          {FACTS.map((fact, i) => {
            const hotspot = hotspotOf(i);
            const title = titles[i];
            return (
              <div
                key={fact.id}
                ref={(node) => {
                  rowRefs.current[i] = node;
                }}
                className="lx-row"
                data-hold={hold === i ? "" : undefined}
              >
                <dt className="lx-row-dt">
                  <button
                    type="button"
                    className="lx-row-btn"
                    aria-describedby={descId(i)}
                    onPointerEnter={onHover(i)}
                    onFocus={() => light(i)}
                    onClick={() => light(i)}
                  >
                    <span className="lx-row-num" aria-hidden="true" dir="ltr">
                      {hotspot >= 0 ? NUMERALS[hotspot] : "–"}
                    </span>
                    <span className="lx-row-title">
                      <span className="sr-only">{title}</span>
                      <span aria-hidden="true">
                        <TypeLine
                          ref={(handle) => {
                            typeRefs.current[i] = handle;
                          }}
                          text={title}
                          startOn="manual"
                          cps={cpsFor(title.length, pace.type)}
                        />
                      </span>
                    </span>
                    <span className="lx-row-leader" aria-hidden="true" />
                    {fact.id === "port" ? (
                      <span className="lx-row-val" dir="ltr">
                        {DEFAULT_PORT}
                      </span>
                    ) : null}
                    <span className="lx-row-ok" aria-hidden="true">
                      <Glyph name="check" size={16} tone="current" />
                    </span>
                  </button>
                </dt>
                <dd id={descId(i)} className="lx-row-desc">
                  {t(fact.desc)}
                </dd>
              </div>
            );
          })}
        </dl>
        {/* Desktop only: beside the screenshot it closes the column. On a phone or tablet the
            finale's button is enough (and the nav carries one too). */}
        <MagneticButton variant="gold" href="/dashboard" icon="arrow" className="lx-a-cta">
          {t("navOpenDashboard")}
        </MagneticButton>
      </div>
    </div>
  );
}
