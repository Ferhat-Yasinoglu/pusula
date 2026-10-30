"use client";
import { useImperativeHandle, useRef, type MouseEvent, type Ref } from "react";
import { useLocale, useTranslations } from "next-intl";
import { STATIONS, type StationId } from "../../runtime/stations";
import { formatBearing } from "../primitives/primitiveKit";
import {
  navBearingText,
  TAPE_HEIGHT,
  TAPE_STRIP_WIDTH,
  buildTapeTicks,
  nearestWaypoint,
  tapeOffsetPx,
  tapeX,
  waypointCopies,
} from "./navModel";
import "./nav.css";

/**
 * The heading tape (spec §6.1): a horizontal degree scale that slides under a
 * fixed ember caret as the page turns from north (the bridge) through the
 * eight winds and back to north at the footer.
 *
 * One strip spans −180°..540°: an SVG ruler (ticks every 5°, taller every
 * 15°) plus one waypoint per station at its bearing, labelled with the
 * station's nav label over its bearing numeral. The ±360° repeats keep the
 * tape continuous at both ends; only the canonical copy of each waypoint is a
 * focusable link, the repeats are pointer-only twins.
 *
 * The tape never runs a loop of its own: the nav's single dom-lane loop
 * springs the heading and calls `apply(heading)`, which writes the strip's
 * `transform` and lights the waypoint under the caret (opacity crossfade).
 * The strip is always `direction: ltr`: degrees increase to the right in
 * every locale. Each label is its own bidi paragraph (`dir="auto"`), so a
 * mixed-script label ("فشرده‌سازی و MCP") keeps its word order.
 *
 * `CompassNav` feeds the stepped tape heading (`tapeHeading`), so the
 * waypoint nearest the caret is the station under the middle of the viewport.
 */

export type HeadingTapeHandle = {
  /** Put `heading` (degrees) under the caret and light the nearest waypoint. */
  apply(heading: number): void;
};

export type HeadingTapeProps = {
  /** A waypoint was activated (click, Enter). */
  onTravel: (id: StationId, viaKeyboard: boolean) => void;
  /** Keyboard focus on a waypoint previews its bearing; null when focus leaves. */
  onPreview: (bearing: number | null) => void;
  ref?: Ref<HeadingTapeHandle>;
};

const TICKS = buildTapeTicks();
const BEARINGS = STATIONS.map((station) => station.bearing);
const MINOR_PATH = TICKS.filter((tick) => tick.kind === "minor")
  .map((tick) => `M${tick.x} ${TAPE_HEIGHT - 5}V${TAPE_HEIGHT}`)
  .join("");
const MAJOR_PATH = TICKS.filter((tick) => tick.kind === "major")
  .map((tick) => `M${tick.x} ${TAPE_HEIGHT - 9}V${TAPE_HEIGHT}`)
  .join("");
const INITIAL_TRANSFORM = `translate3d(${tapeOffsetPx(0)}px,0,0)`;
/** Writes below this (px) are not worth a style change. */
const WRITE_EPSILON_PX = 0.05;

export default function HeadingTape({ onTravel, onPreview, ref }: HeadingTapeProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const stripRef = useRef<HTMLDivElement>(null);
  /** Every copy of every waypoint, grouped by station index. */
  const copiesRef = useRef<HTMLAnchorElement[][]>(STATIONS.map(() => []));
  const writtenRef = useRef({ x: tapeOffsetPx(0), on: 0 });

  useImperativeHandle(
    ref,
    () => ({
      apply(heading: number) {
        const written = writtenRef.current;
        const x = tapeOffsetPx(heading);
        if (Math.abs(x - written.x) >= WRITE_EPSILON_PX) {
          written.x = x;
          const strip = stripRef.current;
          if (strip) strip.style.transform = `translate3d(${x.toFixed(2)}px,0,0)`;
        }
        const on = nearestWaypoint(heading, BEARINGS);
        if (on !== written.on) {
          for (const node of copiesRef.current[written.on] ?? []) {
            node.removeAttribute("data-on");
            node.removeAttribute("aria-current");
          }
          for (const node of copiesRef.current[on] ?? []) {
            node.setAttribute("data-on", "");
            if (!node.hasAttribute("tabindex")) node.setAttribute("aria-current", "location");
          }
          written.on = on;
        }
      },
    }),
    []
  );

  const register = (index: number, copy: number) => (node: HTMLAnchorElement | null) => {
    const group = copiesRef.current[index];
    if (node) group[copy] = node;
  };

  const activate = (id: StationId) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onTravel(id, event.detail === 0);
  };

  return (
    <nav className="tape" aria-label={t("navSections")}>
      <div className="tape-window" dir="ltr">
        <div ref={stripRef} className="tape-strip" style={{ transform: INITIAL_TRANSFORM }}>
          <svg
            className="tape-scale"
            width={TAPE_STRIP_WIDTH}
            height={TAPE_HEIGHT}
            viewBox={`0 0 ${TAPE_STRIP_WIDTH} ${TAPE_HEIGHT}`}
            aria-hidden="true"
            focusable="false"
          >
            <path className="tape-rule" d={`M0 ${TAPE_HEIGHT - 0.5}H${TAPE_STRIP_WIDTH}`} />
            <path className="tape-tick" d={MINOR_PATH} />
            <path className="tape-tick tape-tick-major" d={MAJOR_PATH} />
          </svg>
          {STATIONS.map((station) => {
            const label = t(station.navKey);
            const numeral = navBearingText(formatBearing(locale, station.bearing));
            const name = `${label}, ${numeral}°`;
            return waypointCopies(station.bearing).map((deg, copy) => {
              const canonical = copy === 0;
              const lit = station.index === 0 && deg === 0;
              return (
                <a
                  key={`${station.id}${deg}`}
                  ref={register(station.index, copy)}
                  href={`#${station.id}`}
                  className="tape-wp"
                  style={{ left: tapeX(deg) }}
                  data-on={station.index === 0 ? "" : undefined}
                  aria-current={canonical && lit ? "location" : undefined}
                  tabIndex={canonical ? undefined : -1}
                  aria-hidden={canonical ? undefined : true}
                  aria-label={canonical ? name : undefined}
                  onClick={activate(station.id)}
                  onFocus={canonical ? () => onPreview(station.bearing) : undefined}
                  onBlur={canonical ? () => onPreview(null) : undefined}
                >
                  <span className="tape-face">
                    <span className="tape-label" dir="auto">
                      {label}
                    </span>
                    <span className="tape-num">{numeral}</span>
                  </span>
                  <span className="tape-face tape-face-hi" aria-hidden="true">
                    <span className="tape-label" dir="auto">
                      {label}
                    </span>
                    <span className="tape-num">{numeral}</span>
                  </span>
                </a>
              );
            });
          })}
        </div>
      </div>
      <span className="tape-lens" aria-hidden="true" />
      <svg className="tape-caret" width="12" height="7" viewBox="0 0 12 7" aria-hidden="true">
        <path d="M0 0H12L6 7Z" />
      </svg>
    </nav>
  );
}
