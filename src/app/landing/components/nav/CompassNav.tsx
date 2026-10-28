"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type MutableRefObject,
} from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { usePaused } from "../../runtime/heartbeat";
import { TAPE, isSettled, springAt, stepSpring } from "../../runtime/springs";
import {
  HEADING_ANCHOR,
  STATIONS,
  getStation,
  useActiveStation,
  useHeading,
  useHeadingRef,
  type StationId,
} from "../../runtime/stations";
import { useDomLoop } from "../../runtime/useDomLoop";
import { gyroState } from "../hero/gyro";
import Glyph from "../primitives/Glyph";
import MagneticButton from "../primitives/MagneticButton";
import Needle from "../primitives/Needle";
import { cx, formatBearing, watchView } from "../primitives/primitiveKit";
import HeadingTape, { type HeadingTapeHandle } from "./HeadingTape";
import LandingLanguageMenu from "./LandingLanguageMenu";
import StationMenu from "./StationMenu";
import { homeHeading, navBearingText, progressShare, tapeHeading } from "./navModel";
import { landOnHash, setMenuOpen, travelTo } from "./navState";
import "./nav.css";

/**
 * The compass nav (spec §6.1): wayfinding that is itself a working compass.
 *
 * Desktop (≥1024): logo disk whose needle tracks the page heading (and, while
 * the bridge is in view, mirrors the hero's needle), the wordmark and the
 * version; the heading tape in the centre; Docs, GitHub, the language switch
 * and "Open dashboard" at the end. Transparent over the hero, glass once the
 * page has moved 40px.
 *
 * Phone: logo and wordmark, a chip naming the current station (crossfading as
 * it changes), the menu button, and a 2px gold line along the bottom edge that
 * grows with the voyage (heading / 360).
 *
 * One dom-lane loop springs the tape (`TAPE`) towards the heading and writes
 * the strip and the progress line, only while they change. Under reduced
 * motion or Pause there is no loop: both follow the heading directly. The
 * tape follows the stepped `tapeHeading` (it holds each station's bearing
 * while the station fills the middle of the viewport and turns across the
 * seams), so its lit waypoint names the station being read; the progress line
 * and the logo follow the continuous page heading.
 *
 * The root carries `.nav-bar` (the intro gate slides it in) and is never
 * transformed by this component; the station menu renders as a sibling.
 */

const REPO_URL = "https://github.com/Ferhat-Yasinoglu/pusula";
const SCROLLED_PX = 40;
const DESKTOP_QUERY = "(min-width: 1024px)";

/**
 * The page heading at which the footer's top crosses the middle of the
 * viewport: where the tape turns home to north. Measured from layout
 * (ResizeObserver on the body, window resize), never per scroll.
 */
function useHomeHeading(): MutableRefObject<number> {
  const ref = useRef(360);
  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const lastId = STATIONS[STATIONS.length - 1].id;
    const measure = () => {
      const station = document.getElementById(lastId);
      const footer = document.querySelector(".pusula-landing footer");
      if (!station || !footer) return;
      const y = window.scrollY;
      const viewport = window.innerHeight;
      const max = Math.max(0, document.documentElement.scrollHeight - viewport);
      ref.current = homeHeading(
        station.getBoundingClientRect().top + y,
        footer.getBoundingClientRect().top + y,
        viewport,
        max,
        HEADING_ANCHOR
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(document.body);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);
  return ref;
}

/** Follows the 10 Hz heading state; mounted only while the loop cannot run. */
function HeadingFollower({ onHeading }: { onHeading: (heading: number) => void }) {
  const heading = useHeading();
  useEffect(() => onHeading(heading), [heading, onHeading]);
  return null;
}

/** The logo: a bezel disk with eight wind ticks and a live needle. */
function LogoDisk({ angleRef, bearing }: { angleRef: MutableRefObject<number>; bearing?: number }) {
  return (
    <span className="nav-disk" aria-hidden="true">
      <svg className="nav-disk-ring" width="28" height="28" viewBox="0 0 28 28" focusable="false">
        <circle cx="14" cy="14" r="13.25" />
        <path d="M14 1.6V3.6M26.4 14H24.4M14 26.4V24.4M1.6 14H3.6" />
        <path
          className="nav-disk-fine"
          d="M22.77 5.23L21.72 6.28M22.77 22.77L21.72 21.72M5.23 22.77L6.28 21.72M5.23 5.23L6.28 6.28"
        />
      </svg>
      <Needle size={22} angleRef={angleRef} bearing={bearing} className="nav-disk-needle" />
    </span>
  );
}

/**
 * Without the loop (reduced motion, Pause) the needle does not run, but it
 * still re-settles whenever its `bearing` changes: feed it the 10 Hz heading
 * so the logo keeps pointing along the voyage.
 */
function StaticLogoDisk({ angleRef }: { angleRef: MutableRefObject<number> }) {
  const heading = useHeading();
  return <LogoDisk angleRef={angleRef} bearing={Math.round(heading)} />;
}

/**
 * Phone: the current station's bearing and label, crossfading on change. On
 * the bridge it rests out of sight: the wordmark beside it already names
 * "Pusula", and the chip arrives with the first station of the voyage.
 */
function StationChip({ onOpen }: { onOpen: () => void }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const active = useActiveStation();
  const [shown, setShown] = useState<StationId>(active);
  const [previous, setPrevious] = useState<StationId | null>(null);
  if (active !== shown) {
    setPrevious(shown);
    setShown(active);
  }
  const face = (id: StationId, state: "in" | "out" | "rest") => {
    const station = getStation(id);
    return (
      <span key={`${state}-${id}`} className="nav-chip-face" data-state={state}>
        <span className="nav-chip-deg" dir="ltr">
          {navBearingText(formatBearing(locale, station.bearing))}°
        </span>
        <span className="nav-chip-label">{t(station.navKey)}</span>
      </span>
    );
  };
  return (
    // A pointer shortcut to the menu (44px hit area); the menu button is the accessible control.
    <span
      className="nav-chip"
      aria-hidden="true"
      data-home={shown === "bridge" ? "on" : undefined}
      onClick={onOpen}
    >
      <span className="nav-chip-track">
        {previous ? face(previous, "out") : null}
        {face(shown, previous ? "in" : "rest")}
      </span>
    </span>
  );
}

export default function CompassNav({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;
  const motionRef = useRef(motion);
  const headingRef = useHeadingRef();
  const barRef = useRef<HTMLElement>(null);
  const tapeRef = useRef<HeadingTapeHandle>(null);
  const progressRef = useRef<HTMLSpanElement>(null);
  const previewRef = useRef<number | null>(null);
  const springRef = useRef(springAt(0));
  const progressWritten = useRef(0);
  const desktopRef = useRef(true);
  const bridgeInViewRef = useRef(true);
  const homeRef = useHomeHeading();
  const [menuOpen, setMenu] = useState(false);

  useEffect(() => {
    motionRef.current = motion;
  }, [motion]);

  /** Write the tape (desktop) or the progress line (phone) for `heading`. */
  const apply = useCallback((heading: number) => {
    if (desktopRef.current) {
      tapeRef.current?.apply(heading);
      return;
    }
    const share = progressShare(heading);
    if (Math.abs(share - progressWritten.current) < 0.0005) return;
    progressWritten.current = share;
    const line = progressRef.current;
    if (line) line.style.transform = `scaleX(${share.toFixed(4)})`;
  }, []);

  /** Where the bar points for a page heading: the stepped tape course, or the voyage share. */
  const course = useCallback(
    (heading: number) => (desktopRef.current ? tapeHeading(heading, homeRef.current) : heading),
    [homeRef]
  );

  /** Jump straight to `heading` (mount, layout switch, no-loop modes). */
  const snap = useCallback(
    (heading: number) => {
      const spring = springRef.current;
      spring.angle = heading;
      spring.velocity = 0;
      apply(heading);
    },
    [apply]
  );

  // Which half of the bar is showing; re-snap whenever the layout flips.
  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const sync = () => {
      desktopRef.current = query.matches;
      progressWritten.current = -1;
      snap(previewRef.current ?? course(headingRef.current));
      if (query.matches) setMenu(false);
    };
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, [snap, course, headingRef]);

  useDomLoop(
    "nav-tape",
    (dt) => {
      const target = previewRef.current ?? course(headingRef.current);
      const spring = springRef.current;
      if (isSettled(spring, target, 0.01)) {
        if (spring.angle !== target) snap(target);
        return;
      }
      stepSpring(spring, target, dt, TAPE);
      apply(spring.angle);
    },
    { enabled: motion }
  );

  const preview = useCallback(
    (bearing: number | null) => {
      previewRef.current = bearing;
      if (!motionRef.current) snap(bearing ?? course(headingRef.current));
    },
    [snap, course, headingRef]
  );

  const followStatic = useCallback(
    (heading: number) => {
      if (previewRef.current === null) snap(course(heading));
    },
    [snap, course]
  );

  // Glass once the page has moved; a scroll listener writes the attribute on change only.
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;
    let scrolled = false;
    const update = () => {
      const next = window.scrollY > SCROLLED_PX;
      if (next === scrolled) return;
      scrolled = next;
      bar.setAttribute("data-scrolled", next ? "on" : "off");
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  // While the bridge fills the top half of the viewport the logo mirrors the hero needle.
  useEffect(() => {
    const bridge = document.getElementById("bridge");
    if (!bridge) return;
    return watchView(bridge, {
      onEnter: () => {
        bridgeInViewRef.current = true;
      },
      onExit: () => {
        bridgeInViewRef.current = false;
      },
      enterMargin: "0px 0px -50% 0px",
    });
  }, []);

  const logoAngle = useMemo<MutableRefObject<number>>(
    () => ({
      get current() {
        return bridgeInViewRef.current ? gyroState.needle.angle : headingRef.current;
      },
      set current(value: number) {
        void value;
      },
    }),
    [headingRef]
  );

  useEffect(() => {
    setMenuOpen(menuOpen);
  }, [menuOpen]);
  useEffect(() => () => setMenuOpen(false), []);
  useEffect(() => landOnHash(), []);

  const openMenu = useCallback(() => setMenu(true), []);
  const closeMenu = useCallback(() => setMenu(false), []);

  const travel = useCallback((id: StationId, viaKeyboard: boolean) => {
    travelTo(id, viaKeyboard);
  }, []);

  const goHome = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.pathname !== window.location.pathname) return;
    event.preventDefault();
    travelTo("bridge", event.detail === 0);
  };

  return (
    <>
      <header ref={barRef} className="nav-bar" data-scrolled="off">
        <div className="nav-inner">
          <Link
            href="/landing"
            className="nav-brand"
            aria-label={t("navigateHome")}
            onClick={goHome}
          >
            {motion ? <LogoDisk angleRef={logoAngle} /> : <StaticLogoDisk angleRef={logoAngle} />}
            <span className="nav-word">{t("brandName")}</span>
            <span className="nav-version" dir="ltr">
              v{stats.version}
            </span>
          </Link>

          <div className="nav-centre">
            <HeadingTape ref={tapeRef} onTravel={travel} onPreview={preview} />
            <StationChip onOpen={openMenu} />
          </div>

          <div className="nav-end">
            <Link href="/docs" className="nav-link nav-docs" aria-label={t("navDocs")}>
              <Glyph name="docs" size={16} tone="current" className="nav-docs-mark" />
              <span className="nav-docs-text">{t("navDocs")}</span>
            </Link>
            <a
              href={REPO_URL}
              className="nav-link nav-gh"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t("navGithub")}
            >
              <Glyph name="github" size={16} tone="current" className="nav-gh-mark" />
              <span className="nav-gh-text">{t("navGithub")}</span>
              <Glyph name="external" size={16} className="nav-gh-ext" />
            </a>
            <LandingLanguageMenu className="nav-lang" />
            <MagneticButton variant="gold" size="md" href="/dashboard" className="nav-cta">
              {t("navOpenDashboard")}
            </MagneticButton>
            <button
              type="button"
              className={cx("nav-icon-btn", "nav-menu-btn")}
              onClick={openMenu}
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              aria-controls="nav-menu"
              aria-label={t("toggleMenu")}
            >
              <Glyph name="menu" size={24} tone="current" />
            </button>
          </div>
        </div>
        <span ref={progressRef} className="nav-progress" aria-hidden="true" />
      </header>
      {motion ? null : <HeadingFollower onHeading={followStatic} />}
      <StationMenu open={menuOpen} onClose={closeMenu} />
    </>
  );
}
