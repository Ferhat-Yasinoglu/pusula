"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { nearestEquivalentAngle } from "../../landingGeometry";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, setPaused, usePaused } from "../../runtime/heartbeat";
import {
  STATIONS,
  useActiveStation,
  useHeadingRef,
  type Station,
  type StationId,
} from "../../runtime/stations";
import Glyph from "../primitives/Glyph";
import MagneticButton from "../primitives/MagneticButton";
import Toggle from "../primitives/Toggle";
import { formatBearing } from "../primitives/primitiveKit";
import LandingLanguageMenu from "./LandingLanguageMenu";
import { navBearingText } from "./navModel";
import { focusStation, primeTravel, travelTo } from "./navState";
import "./nav.css";

/**
 * The phone menu (spec §6.1): a full-screen modal dialog. The native
 * `<dialog>` opened with `showModal()` gives the modal contract for free:
 * focus is trapped, everything behind it (main, footer, the bar) is inert,
 * and Esc closes it (intercepted so it closes with the same animation).
 *
 * At the top, a 300px compass rose whose eight points are the stations,
 * each a link named "{station}, {bearing}°". The rose is one tab stop (a
 * roving tabindex): arrow keys walk the points around the dial, swinging the
 * needle and naming the station in the caption; Enter or Space travels. Under
 * it the same eight stations as 56px rows, then Docs, GitHub, the languages,
 * the Pause control and a sticky "Open dashboard".
 *
 * Choosing a station swings the rose's needle to its bearing (300ms), then the
 * menu fades out while the page travels there. A rose point holds a moment
 * longer with the destination named in the caption (on touch there is no
 * hover to preview it).
 */

export const MENU_SWING_MS = 300;
/** A rose point holds this long, so the caption naming the destination can be read. */
const ROSE_HOLD_MS = 640;
const CLOSE_FALLBACK_MS = 360;
const REPO_URL = "https://github.com/Ferhat-Yasinoglu/pusula";

const ROSE = 300;
const C = ROSE / 2;
const DEG = Math.PI / 180;

function polar(radius: number, bearing: number): [number, number] {
  return [C + radius * Math.sin(bearing * DEG), C - radius * Math.cos(bearing * DEG)];
}

function fmt(v: number): string {
  return String(Math.round(v * 100) / 100);
}

/** One kite of the rose: tip at `tip`, waist at `waist` on either side. */
function kite(bearing: number, tip: number, waist: number): { lit: string; shade: string } {
  const [tx, ty] = polar(tip, bearing);
  const [lx, ly] = polar(waist, bearing - 45);
  const [rx, ry] = polar(waist, bearing + 45);
  return {
    lit: `M${fmt(C)} ${fmt(C)}L${fmt(lx)} ${fmt(ly)}L${fmt(tx)} ${fmt(ty)}Z`,
    shade: `M${fmt(C)} ${fmt(C)}L${fmt(tx)} ${fmt(ty)}L${fmt(rx)} ${fmt(ry)}Z`,
  };
}

/** The 45° pie slice around a bearing: the point's hit area. */
function wedge(bearing: number, radius: number): string {
  const [ax, ay] = polar(radius, bearing - 22.5);
  const [bx, by] = polar(radius, bearing + 22.5);
  return `M${C} ${C}L${fmt(ax)} ${fmt(ay)}A${radius} ${radius} 0 0 1 ${fmt(bx)} ${fmt(by)}Z`;
}

const KITES = STATIONS.map((station) =>
  kite(station.bearing, station.index % 2 === 0 ? 112 : 78, station.index % 2 === 0 ? 20 : 15)
);
const WEDGES = STATIONS.map((station) => wedge(station.bearing, 146));
const TICKS = (() => {
  let minor = "";
  let major = "";
  for (let deg = 0; deg < 360; deg += 5) {
    const longTick = deg % 45 === 0;
    const [ax, ay] = polar(longTick ? 116 : 120, deg);
    const [bx, by] = polar(124, deg);
    const seg = `M${fmt(ax)} ${fmt(ay)}L${fmt(bx)} ${fmt(by)}`;
    if (longTick) major += seg;
    else minor += seg;
  }
  return { minor, major };
})();
const LETTERS = STATIONS.map((station) => {
  const [x, y] = polar(138, station.bearing);
  return { x: fmt(x), y: fmt(y), point: station.point };
});

export type StationMenuProps = {
  open: boolean;
  onClose: () => void;
};

export default function StationMenu({ open, onClose }: StationMenuProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const active = useActiveStation();
  const headingRef = useHeadingRef();
  const dialogRef = useRef<HTMLDialogElement>(null);
  /** Cumulative needle angle (deg), so every swing takes the short way round. */
  const [needle, setNeedle] = useState(0);
  const [preview, setPreview] = useState<Station | null>(null);
  const [closing, setClosing] = useState(false);
  const pendingRef = useRef<{ id: StationId; viaKeyboard: boolean } | null>(null);
  /** A station was chosen: hover and focus no longer steer the needle. */
  const pickingRef = useRef(false);
  const swingTimer = useRef<number | undefined>(undefined);
  /** The rose point that takes the rose's single tab stop. */
  const [rove, setRove] = useState(0);
  const pointRefs = useRef<(HTMLOrSVGElement | null)[]>([]);
  /** The current station, read when the menu opens (not a reason to re-run the open effect). */
  const activeRef = useRef(active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const aim = useCallback((bearing: number) => {
    setNeedle((angle) => nearestEquivalentAngle(angle, bearing));
  }, []);

  const finishClose = useCallback(() => {
    const dialog = dialogRef.current;
    setClosing(false);
    if (dialog?.open) dialog.close();
    document.documentElement.style.removeProperty("overflow");
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending?.viaKeyboard) focusStation(pending.id);
  }, []);

  // Open and close the native dialog from the `open` prop.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (dialog.open) return;
      pickingRef.current = false;
      setPreview(null);
      setRove(
        Math.max(
          0,
          STATIONS.findIndex((station) => station.id === activeRef.current)
        )
      );
      setNeedle((angle) => nearestEquivalentAngle(angle, headingRef.current % 360));
      dialog.showModal();
      document.documentElement.style.overflow = "hidden";
      return;
    }
    if (!dialog.open) return;
    if (!canAnimate()) {
      finishClose();
      return;
    }
    setClosing(true);
    const timer = window.setTimeout(finishClose, CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [open, finishClose, headingRef]);

  // Unmount safety: never leave the page locked.
  useEffect(
    () => () => {
      window.clearTimeout(swingTimer.current);
      document.documentElement.style.removeProperty("overflow");
    },
    []
  );

  const choose = (station: Station, viaKeyboard: boolean, holdMs: number) => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPreview(station);
    aim(station.bearing);
    // Lay the stations out now, while the needle swings, so the travel aims true.
    primeTravel();
    window.clearTimeout(swingTimer.current);
    const go = () => {
      pendingRef.current = { id: station.id, viaKeyboard };
      // Unlock first: the page travels while the menu fades out.
      document.documentElement.style.removeProperty("overflow");
      onClose();
      travelTo(station.id);
    };
    if (canAnimate()) swingTimer.current = window.setTimeout(go, holdMs);
    else go();
  };

  const pick =
    (station: Station, holdMs = MENU_SWING_MS) =>
    (event: MouseEvent<Element>) => {
      event.preventDefault();
      choose(station, event.detail === 0, holdMs);
    };

  /** Arrow keys walk the rose clockwise / anticlockwise; Space travels like Enter. */
  const roseKey = (index: number) => (event: KeyboardEvent<Element>) => {
    const count = STATIONS.length;
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % count;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      next = (index + count - 1) % count;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = count - 1;
    else if (event.key === " ") {
      event.preventDefault();
      choose(STATIONS[index], true, ROSE_HOLD_MS);
      return;
    }
    if (next < 0) return;
    event.preventDefault();
    setRove(next);
    pointRefs.current[next]?.focus();
  };

  const shown = preview ?? STATIONS.find((station) => station.id === active) ?? STATIONS[0];

  const hover = (station: Station | null) => () => {
    if (pickingRef.current) return;
    setPreview(station);
    aim(station ? station.bearing : headingRef.current % 360);
  };

  return (
    <dialog
      ref={dialogRef}
      id="nav-menu"
      className="nav-menu"
      aria-label={t("navSections")}
      data-closing={closing ? "on" : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        // The browser may close it natively (a repeated Esc): keep state in step.
        document.documentElement.style.removeProperty("overflow");
        if (open) onClose();
      }}
      onAnimationEnd={(event) => {
        if (closing && event.target === event.currentTarget) finishClose();
      }}
    >
      <div className="nav-menu-sheet">
        <div className="nav-menu-head">
          <span className="nav-menu-title" aria-hidden="true">
            <Glyph name="compass" size={20} />
            <span>{t("brandName")}</span>
          </span>
          <button
            type="button"
            className="nav-icon-btn nav-menu-close"
            onClick={onClose}
            aria-label={t("toggleMenu")}
            aria-expanded="true"
            aria-controls="nav-menu"
          >
            <Glyph name="close" size={24} tone="current" />
          </button>
        </div>

        <nav aria-label={t("navSections")}>
          <div className="nav-rose-wrap" dir="ltr">
            <svg
              className="nav-rose"
              viewBox={`0 0 ${ROSE} ${ROSE}`}
              width={ROSE}
              height={ROSE}
              role="group"
              focusable="false"
            >
              <g aria-hidden="true">
                <defs>
                  <radialGradient id="nav-rose-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0" stopColor="#d4a840" stopOpacity="0.16" />
                    <stop offset="0.7" stopColor="#d4a840" stopOpacity="0.04" />
                    <stop offset="1" stopColor="#d4a840" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <circle cx={C} cy={C} r={128} fill="url(#nav-rose-glow)" />
                <circle className="nav-rose-ring" cx={C} cy={C} r={124} />
                <circle className="nav-rose-ring nav-rose-ring-inner" cx={C} cy={C} r={100} />
                <path className="nav-rose-tick" d={TICKS.minor} />
                <path className="nav-rose-tick nav-rose-tick-major" d={TICKS.major} />
                {STATIONS.map((station, i) => (
                  <g
                    key={station.id}
                    className="nav-rose-point"
                    data-wind={station.index % 2 === 0 ? "cardinal" : "inter"}
                    data-on={station.id === shown.id ? "" : undefined}
                  >
                    <path className="nav-rose-lit" d={KITES[i].lit} />
                    <path className="nav-rose-shade" d={KITES[i].shade} />
                  </g>
                ))}
                {LETTERS.map((letter, i) => (
                  <text
                    key={letter.point}
                    className="nav-rose-letter"
                    data-on={STATIONS[i].id === shown.id ? "" : undefined}
                    x={letter.x}
                    y={letter.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {letter.point}
                  </text>
                ))}
                <g className="nav-rose-needle" style={{ transform: `rotate(${needle}deg)` }}>
                  <path className="nav-rose-needle-n" d={`M${C} 54L${C - 5} ${C}L${C + 5} ${C}Z`} />
                  <path
                    className="nav-rose-needle-s"
                    d={`M${C} 246L${C - 5} ${C}L${C + 5} ${C}Z`}
                  />
                </g>
                <circle className="nav-rose-pivot" cx={C} cy={C} r={6} />
                <circle className="nav-rose-pin" cx={C} cy={C} r={2} />
              </g>
              {STATIONS.map((station, i) => (
                <a
                  key={station.id}
                  ref={(node) => {
                    pointRefs.current[i] = node;
                  }}
                  href={`#${station.id}`}
                  tabIndex={i === rove ? 0 : -1}
                  className="nav-rose-hit"
                  aria-label={`${t(station.navKey)}, ${navBearingText(
                    formatBearing(locale, station.bearing)
                  )}°`}
                  aria-current={station.id === active ? "location" : undefined}
                  onClick={pick(station, ROSE_HOLD_MS)}
                  onKeyDown={roseKey(i)}
                  onPointerEnter={hover(station)}
                  onPointerLeave={hover(null)}
                  onFocus={() => {
                    setRove(i);
                    hover(station)();
                  }}
                  onBlur={hover(null)}
                >
                  <path d={WEDGES[i]} />
                </a>
              ))}
            </svg>
          </div>
          <p className="nav-rose-caption" aria-hidden="true">
            <span className="nav-rose-caption-deg" dir="ltr">
              {navBearingText(formatBearing(locale, shown.bearing))}°
            </span>
            <span>{t(shown.navKey)}</span>
          </p>

          <ol className="nav-menu-list">
            {STATIONS.map((station) => {
              const current = station.id === active;
              return (
                <li key={station.id}>
                  <a
                    href={`#${station.id}`}
                    className="nav-menu-row"
                    style={{ "--i": station.index } as CSSProperties}
                    aria-current={current ? "location" : undefined}
                    onClick={pick(station)}
                    onPointerEnter={hover(station)}
                    onPointerLeave={hover(null)}
                    onFocus={hover(station)}
                    onBlur={hover(null)}
                  >
                    <span className="nav-menu-deg" dir="ltr">
                      {navBearingText(formatBearing(locale, station.bearing))}°
                    </span>
                    <span className="nav-menu-label">{t(station.navKey)}</span>
                    <Glyph name="chevron" size={20} className="nav-menu-chev" />
                  </a>
                </li>
              );
            })}
          </ol>
        </nav>

        <div className="nav-menu-tools">
          <div className="nav-menu-links">
            <Link href="/docs" className="nav-menu-link">
              {t("navDocs")}
            </Link>
            <a href={REPO_URL} className="nav-menu-link" target="_blank" rel="noopener noreferrer">
              <Glyph name="github" size={16} tone="current" />
              {t("navGithub")}
              <Glyph name="external" size={16} />
            </a>
          </div>
          <LandingLanguageMenu variant="inline" />
          <Toggle
            className="nav-menu-pause"
            pressed={paused || reduced}
            disabled={reduced}
            onChange={(next) => setPaused(next)}
            label={t("simPause")}
            glyph={paused || reduced ? "play" : "pause"}
          />
        </div>

        <div className="nav-menu-cta">
          <MagneticButton variant="gold" size="lg" href="/dashboard" icon="arrow">
            {t("navOpenDashboard")}
          </MagneticButton>
        </div>
      </div>
    </dialog>
  );
}
