"use client";
import Link from "next/link";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { round2 } from "../../landingGeometry";
import { prefersReducedMotion, usePrefersReducedMotion } from "../../landingMotion";
import type { LandingStats } from "../../landingTypes";
import { getWorld, shallowEqual, useDeck } from "../../runtime/deckStore";
import { canAnimate, setPaused, usePaused } from "../../runtime/heartbeat";
import { NEEDLE, isSettled, springAt, stepSpring, type SpringConfig } from "../../runtime/springs";
import { useHeadingRef } from "../../runtime/stations";
import { useDomLoop } from "../../runtime/useDomLoop";
import type { World } from "../../sim/landingSim";
import { Glyph, Needle, SimBadge, Toggle } from "../primitives";
import { cx, formatBearing, numberFormat, watchView } from "../primitives/primitiveKit";
import {
  LOG_SLOT_MARKS,
  SPIN,
  SWING_FROM_DEG,
  SWING_TO_DEG,
  bearingOf,
  countMayMove,
  countMotion,
  dialTicks,
  logLineRuns,
  wrapTurns,
  type LogSlot,
} from "./logbookModel";
import "./footer.css";

/**
 * Footer, the logbook (spec §6.10): the page's last leg, back to north.
 *
 * - A ruled log strip counts this visit in the simulation (requests routed,
 *   failures the visitor caused, reroutes) in ledger cells, beside the
 *   Simulation badge and a Pause switch (the dock steps aside here). With
 *   motion a dom loop writes them, only while the strip is near the viewport;
 *   under reduced motion or Pause the deck only moves when the visitor
 *   switches a fault, and React carries the totals.
 * - Brand, the three link columns (every href of the old footer kept).
 * - A giant outlined, dot-filled "PUSULA" a lighthouse beam sweeps across
 *   while the footer is on screen, and the back-to-north compass: its needle
 *   waits at south off screen, swings to north on the NEEDLE spring as it
 *   arrives, spins once on hover, and on click takes the visitor to the top
 *   (the nav's logo needle unwinds to north on the way) and focuses the h1.
 *
 * Server and hydration render the counters at 0 and the needle at north.
 * Reduced motion: no beam, no swing, the needle simply points north.
 */

const REPO_URL = "https://github.com/Ferhat-Yasinoglu/pusula";
const UPSTREAM_URL = "https://github.com/diegosouzapw/OmniRoute";
const NPM_URL = "https://www.npmjs.com/package/pusula";

type FooterLink = { label: string; href: string; external?: boolean };
type FooterColumn = { id: string; title: string; links: FooterLink[] };

/* ------------------------------------------------------------------------ */
/* The log strip                                                            */
/* ------------------------------------------------------------------------ */

type LogTotals = Record<LogSlot, number>;

/** Module level, so `useDeck` caches the selection; a fresh object compared shallowly. */
const selectLog = (w: World): LogTotals => ({
  routed: w.totals.routed,
  outages: w.session.outagesCaused,
  reroutes: w.totals.rerouted,
});

/** While the dom loop writes the counters, the strip selects nothing: no deck commit re-renders it. */
const selectNothing = (): null => null;

function logValue(w: World, slot: LogSlot): number {
  if (slot === "routed") return w.totals.routed;
  if (slot === "outages") return w.session.outagesCaused;
  return w.totals.rerouted;
}

/** One ledger cell of the strip, written directly (text, `data-hot`, motion). */
type CountCell = {
  slot: LogSlot;
  box: HTMLElement;
  face: HTMLElement;
  /** What the cell shows; NaN until the first write (which never animates). */
  value: number;
  /** When its last motion began (rAF ms). */
  movedAt: number;
};

/** `routed`: a 2px settle, no fade (it climbs several times a second). */
const SETTLE_FRAMES: Keyframe[] = [
  { transform: "translateY(-2px)" },
  { transform: "translateY(0)" },
];
const SETTLE_TIMING: KeyframeAnimationOptions = {
  duration: 320,
  easing: "cubic-bezier(.16,1,.3,1)",
};
/** Failures and reroutes, which the visitor causes: the entry drops into its cell. */
const DROP_FRAMES: Keyframe[] = [
  { transform: "translateY(-0.3em)", opacity: 0.3 },
  { transform: "translateY(0)", opacity: 1 },
];
const DROP_TIMING: KeyframeAnimationOptions = { duration: 360, easing: "cubic-bezier(.16,1,.3,1)" };

function isMoving(node: HTMLElement): boolean {
  return typeof node.getAnimations === "function" && node.getAnimations().length > 0;
}

/** Write one cell; it moves only when it rose and its last motion is ~1s old (`countMayMove`). */
function writeCount(
  cell: CountCell,
  value: number,
  format: Intl.NumberFormat,
  now: number,
  move: boolean
): void {
  const previous = cell.value;
  if (previous === value) return;
  cell.value = value;
  cell.face.textContent = format.format(value);
  if (cell.slot === "outages") {
    if (value > 0) cell.box.setAttribute("data-hot", "on");
    else cell.box.removeAttribute("data-hot");
  }
  if (!move || typeof cell.face.animate !== "function") return;
  if (!countMayMove(value > previous, now, cell.movedAt, isMoving(cell.face))) return;
  cell.movedAt = now;
  if (countMotion(cell.slot) === "settle") cell.face.animate(SETTLE_FRAMES, SETTLE_TIMING);
  else cell.face.animate(DROP_FRAMES, DROP_TIMING);
}

function LogStrip({ motion }: { motion: boolean }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const format = numberFormat(locale);
  const message = t("logbookLine", LOG_SLOT_MARKS);
  const runs = useMemo(() => logLineRuns(message), [message]);
  const zero = format.format(0);
  const pauseShown = paused || reduced;
  const stripRef = useRef<HTMLDivElement>(null);
  const cells = useRef<CountCell[]>([]);
  const held = useDeck(motion ? selectNothing : selectLog, shallowEqual);

  // Server and hydration render every cell at 0; from here on the cells are written directly.
  useLayoutEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    cells.current = Array.from(strip.querySelectorAll<HTMLElement>(".lb-n"), (box) => ({
      slot: box.dataset.slot as LogSlot,
      box,
      face: (box.firstElementChild as HTMLElement | null) ?? box,
      value: Number.NaN,
      movedAt: Number.NEGATIVE_INFINITY,
    }));
  }, [runs]);

  // Reduced motion and Pause: the heartbeat is still and the totals arrive through React.
  useEffect(() => {
    if (!held) return;
    for (const cell of cells.current) writeCount(cell, held[cell.slot], format, 0, false);
  }, [held, runs, format]);

  // With motion: read the live world each frame, but only while the strip is near the viewport.
  useDomLoop(
    "footer-log",
    (_dt, now) => {
      const world = getWorld();
      const list = cells.current;
      for (let i = 0; i < list.length; i++) {
        const cell = list[i];
        writeCount(cell, logValue(world, cell.slot), format, now, true);
      }
    },
    { enabled: motion, target: stripRef }
  );

  return (
    <div ref={stripRef} className="lb-strip">
      <SimBadge className="lb-badge" />
      {/* Before the line in the DOM so it can float beside it on a phone; CSS puts it last on wider screens. */}
      <Toggle
        className="lb-pause"
        pressed={pauseShown}
        disabled={reduced}
        onChange={(next) => setPaused(next)}
        label={t("simPause")}
        glyph={pauseShown ? "play" : "pause"}
        hideLabel
        title={t("simPause")}
      />
      <p className="lb-line">
        {runs.map((run, i) =>
          run.kind === "text" ? (
            <Fragment key={`t${i}`}>{run.text}</Fragment>
          ) : (
            <span key={`e${i}`} className="lb-entry">
              <span className="lb-n" data-slot={run.slot}>
                <span className="lb-n-v">{zero}</span>
              </span>
              {run.tail}
            </span>
          )
        )}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Brand and links                                                          */
/* ------------------------------------------------------------------------ */

const MARK_TICKS = dialTicks(16, 16, 15, 12.5, 13.6, 16, 4);

/** The brand's live mark: a bezel disk whose needle follows the page heading (north down here). */
function BrandMark({ motion }: { motion: boolean }) {
  const heading = useHeadingRef();
  return (
    <span className="lb-mark" aria-hidden="true">
      <svg className="lb-mark-ring" width="32" height="32" viewBox="0 0 32 32" focusable="false">
        <circle cx="16" cy="16" r="15.25" />
        <path className="lb-mark-major" d={MARK_TICKS.major} />
        <path className="lb-mark-minor" d={MARK_TICKS.minor} />
      </svg>
      <Needle
        size={24}
        bearing={0}
        angleRef={motion ? heading : undefined}
        className="lb-mark-needle"
      />
    </span>
  );
}

function FooterAnchor({ link, newTab }: { link: FooterLink; newTab: string | null }) {
  const body = (
    <>
      {/* The margin tick: an ember pencil mark against the chosen entry (hover, focus, press). */}
      <span className="lb-link-tick" aria-hidden="true" />
      <span className="lb-link-text">
        {link.label}
        <span className="lb-link-line" aria-hidden="true" />
      </span>
      {link.external && newTab ? <span className="sr-only"> {newTab}</span> : null}
      <span className={cx("lb-link-icon", link.external && "lb-link-icon-ext")} aria-hidden="true">
        <Glyph name={link.external ? "external" : "arrow"} size={16} tone="current" />
      </span>
    </>
  );
  if (link.external) {
    return (
      <a className="lb-link" href={link.href} target="_blank" rel="noopener noreferrer">
        {body}
      </a>
    );
  }
  if (link.href.startsWith("#")) {
    return (
      <a className="lb-link" href={link.href}>
        {body}
      </a>
    );
  }
  return (
    <Link className="lb-link" href={link.href}>
      {body}
    </Link>
  );
}

/* ------------------------------------------------------------------------ */
/* The wordmark                                                             */
/* ------------------------------------------------------------------------ */

/** Wordmark geometry in SVG user units; `textLength` pins its width whatever the system font. */
const WORD_W = 1000;
const WORD_H = 194;
const WORD_BASELINE = 186;
const WORD_SIZE = 252;
const WORD_INSET = 3;

function Wordmark({ text }: { text: string }) {
  const raw = useId();
  const uid = `lb${raw.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const textProps = {
    x: WORD_INSET,
    y: WORD_BASELINE,
    textLength: WORD_W - WORD_INSET * 2,
    lengthAdjust: "spacingAndGlyphs" as const,
    fontSize: WORD_SIZE,
    className: "lb-word-text",
  };
  return (
    <svg
      className="lb-word"
      viewBox={`0 0 ${WORD_W} ${WORD_H}`}
      preserveAspectRatio="xMinYMax meet"
      aria-hidden="true"
      focusable="false"
      direction="ltr"
    >
      <defs>
        {/* Two dot grids: a coarse one for wide screens, a finer-reading one for phones (CSS picks). */}
        <pattern id={`${uid}d`} width="9" height="9" patternUnits="userSpaceOnUse">
          <circle className="lb-word-dot" cx="4.5" cy="4.5" r="1.7" />
        </pattern>
        <pattern id={`${uid}s`} width="12" height="12" patternUnits="userSpaceOnUse">
          <circle className="lb-word-dot" cx="6" cy="6" r="2.6" />
        </pattern>
        <clipPath id={`${uid}c`}>
          <text {...textProps}>{text}</text>
        </clipPath>
        <linearGradient id={`${uid}b`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" className="lb-beam-stop-edge" />
          <stop offset="0.5" className="lb-beam-stop-core" />
          <stop offset="1" className="lb-beam-stop-edge" />
        </linearGradient>
      </defs>
      {/* The beam passes under the dots: light shows between them, the dots stay crisp on top. */}
      <g clipPath={`url(#${uid}c)`}>
        <g transform="skewX(-16)">
          <rect
            className="lb-beam"
            x="-320"
            y="-24"
            width="300"
            height={WORD_H + 48}
            fill={`url(#${uid}b)`}
          />
        </g>
      </g>
      <text
        {...textProps}
        style={
          {
            "--lb-dots": `url(#${uid}d)`,
            "--lb-dots-phone": `url(#${uid}s)`,
          } as CSSProperties
        }
      >
        {text}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* The back-to-north compass                                                */
/* ------------------------------------------------------------------------ */

const DIAL = 96;
const DIAL_C = DIAL / 2;
const DIAL_TICKS = dialTicks(DIAL_C, DIAL_C, 45, 38.5, 41.5, 32, 4);

/** Share of the compass that must be visible before the needle swings north. */
const SWING_VISIBLE_RATIO = 0.6;

function focusTitle(): void {
  const title =
    document.getElementById("bridge-title") ?? document.querySelector<HTMLElement>("main h1");
  if (!title) return;
  if (!title.hasAttribute("tabindex")) title.setAttribute("tabindex", "-1");
  title.focus({ preventScroll: true });
}

function NorthCompass({ motion }: { motion: boolean }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const rotorRef = useRef<HTMLSpanElement>(null);
  const readoutRef = useRef<HTMLSpanElement>(null);
  const spring = useRef(springAt(0));
  const target = useRef(0);
  const config = useRef<SpringConfig>(NEEDLE);
  const settled = useRef(true);
  const shownBearing = useRef(0);
  const [onScreen, setOnScreen] = useState(false);

  const write = useCallback(
    (angle: number) => {
      const rotor = rotorRef.current;
      if (rotor) rotor.style.transform = `rotate(${round2(angle)}deg)`;
      const bearing = bearingOf(angle);
      if (bearing === shownBearing.current) return;
      shownBearing.current = bearing;
      if (readoutRef.current) readoutRef.current.textContent = `${formatBearing(locale, bearing)}°`;
    },
    [locale]
  );

  /** Park the needle at south, out of view, ready to swing home when it arrives. */
  const arm = useCallback(() => {
    spring.current.angle = SWING_FROM_DEG;
    spring.current.velocity = 0;
    target.current = SWING_TO_DEG;
    config.current = NEEDLE;
    settled.current = false;
    write(SWING_FROM_DEG);
  }, [write]);

  /** Straight to north at rest (reduced motion, Pause). */
  const rest = useCallback(() => {
    spring.current.angle = 0;
    spring.current.velocity = 0;
    target.current = 0;
    settled.current = true;
    write(0);
  }, [write]);

  useEffect(() => {
    const node = buttonRef.current;
    if (!node) return;
    return watchView(node, {
      enterThreshold: SWING_VISIBLE_RATIO,
      onEnter: () => setOnScreen(true),
      onExit: () => {
        setOnScreen(false);
        if (canAnimate()) arm();
      },
    });
  }, [arm]);

  useEffect(() => {
    if (!motion) rest();
  }, [motion, rest]);

  useDomLoop(
    "footer-compass",
    (dt) => {
      if (settled.current) return;
      const state = spring.current;
      stepSpring(state, target.current, dt, config.current);
      if (isSettled(state, target.current)) {
        const home = wrapTurns(target.current);
        state.angle = home;
        state.velocity = 0;
        target.current = home;
        settled.current = true;
      }
      write(state.angle);
    },
    { enabled: motion && onScreen }
  );

  const spin = () => {
    if (!canAnimate()) return;
    target.current += 360;
    config.current = SPIN;
    settled.current = false;
  };

  const goNorth = () => {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    focusTitle();
  };

  return (
    <button
      ref={buttonRef}
      type="button"
      className="lb-north"
      onClick={goNorth}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") spin();
      }}
      onFocus={(event) => {
        // Keyboard arrivals only: a mouse press focuses too, after the hover already spun it.
        if (event.currentTarget.matches(":focus-visible")) spin();
      }}
    >
      <span className="lb-dial" aria-hidden="true">
        <svg className="lb-dial-card" viewBox={`0 0 ${DIAL} ${DIAL}`} focusable="false">
          <circle className="lb-dial-rim" cx={DIAL_C} cy={DIAL_C} r="46.5" />
          <circle className="lb-dial-inner" cx={DIAL_C} cy={DIAL_C} r="34" />
          <path className="lb-dial-minor" d={DIAL_TICKS.minor} />
          <path className="lb-dial-major" d={DIAL_TICKS.major} />
          {/* North index: the destination, in the decision colour. */}
          <path className="lb-dial-north" d={`M${DIAL_C} 1.5L${DIAL_C + 4} 8.5H${DIAL_C - 4}Z`} />
        </svg>
        <span ref={rotorRef} className="lb-rotor">
          <Needle size={56} bearing={0} />
        </span>
      </span>
      <span className="lb-north-text">
        <span className="lb-north-label">{t("backToNorth")}</span>
        <span ref={readoutRef} className="lb-north-readout" dir="ltr" aria-hidden="true">
          {`${formatBearing(locale, 0)}°`}
        </span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* The footer                                                               */
/* ------------------------------------------------------------------------ */

const subscribeNever = () => () => {};
const clientYear = () => new Date().getFullYear();
/** The server (and hydration) render no year at all, so no clock runs there; the client fills it in. */
const serverYear = (): number | null => null;

export default function Logbook({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;
  const footerRef = useRef<HTMLElement>(null);
  const [awake, setAwake] = useState(false);
  // The year as the old footer had it (the visitor's clock). Hydration uses the
  // server snapshot (no year: "© Pusula…"), then React re-renders with the
  // visitor's year, so a server/client year difference can never stick.
  const year = useSyncExternalStore(subscribeNever, clientYear, serverYear);
  const newTab = t.has("opensInNewTab") ? t("opensInNewTab") : null;

  useEffect(() => {
    const node = footerRef.current;
    if (!node) return;
    return watchView(node, {
      onEnter: () => setAwake(true),
      onExit: () => setAwake(false),
    });
  }, []);

  const format = numberFormat(locale);
  const ordinal = numberFormat(locale, { minimumIntegerDigits: 2 });
  const version = (
    <span className="lb-version" dir="ltr">
      v{stats.version}
    </span>
  );
  const columns: FooterColumn[] = [
    {
      id: "product",
      title: t("footerProduct"),
      links: [
        { label: t("navOpenDashboard"), href: "/dashboard" },
        { label: t("navCatalog"), href: "#catalog" },
        { label: t("navRouting"), href: "#routing" },
        { label: t("footerChangelog"), href: "/dashboard/changelog" },
      ],
    },
    {
      id: "resources",
      title: t("footerResources"),
      links: [
        { label: t("navDocs"), href: "/docs" },
        { label: t("navGithub"), href: REPO_URL, external: true },
        { label: t("footerNpm"), href: NPM_URL, external: true },
      ],
    },
    {
      id: "legal",
      title: t("footerLegal"),
      links: [
        { label: t("footerLicense"), href: `${REPO_URL}/blob/main/LICENSE`, external: true },
        { label: t("footerPrivacy"), href: "/privacy" },
        { label: t("footerTerms"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer ref={footerRef} className="logbook" data-awake={awake && motion ? "on" : undefined}>
      <div className="lb-inner">
        <LogStrip motion={motion} />

        <div className="lb-grid">
          <div className="lb-brand reveal">
            <p className="lb-id">
              <BrandMark motion={motion} />
              <span className="lb-name">{t("brandName")}</span>
              {version}
            </p>
            <p className="lb-tagline">
              {t("footerTagline", { providers: format.format(stats.providers) })}
            </p>
          </div>

          <div className="lb-navs">
            {columns.map((column, i) => (
              <nav
                key={column.id}
                className="lb-nav reveal"
                data-col={column.id}
                aria-label={column.title}
                style={{ "--reveal-delay": `${(i + 1) * 90}ms` } as CSSProperties}
              >
                <p className="lb-nav-title" aria-hidden="true">
                  <span className="lb-nav-no">{ordinal.format(i + 1)}</span>
                  <span>{column.title}</span>
                </p>
                <ul className="lb-links">
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <FooterAnchor link={link} newTab={newTab} />
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div className="lb-mark-row reveal">
          <Wordmark text={t("brandName").toLocaleUpperCase("en")} />
          <NorthCompass motion={motion} />
        </div>

        <div className="lb-base">
          <p>
            {t("copyright", {
              year: year === null ? "" : numberFormat(locale, { useGrouping: false }).format(year),
            })}
            {/* On a phone the brand row folds away and the version rides here. */}
            <span className="lb-base-version"> {version}</span>
          </p>
          <p>
            {t("footerUpstream")}{" "}
            <a
              className="lb-upstream"
              href={UPSTREAM_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              OmniRoute
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
