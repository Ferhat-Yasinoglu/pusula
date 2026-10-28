"use client";
import type { CSSProperties, ReactNode, Ref } from "react";
import { useLocale, useTranslations } from "next-intl";
import { getStation, type StationId } from "../../runtime/stations";
import CourseSeam from "./CourseSeam";
import Needle from "./Needle";
import WordReveal from "./WordReveal";
import { cx, formatBearing } from "./primitiveKit";
import "./primitives.css";

/**
 * The shell of every station (section) below the bridge: the compass spine of
 * the page.
 *
 * Renders `<section id data-station data-bearing aria-labelledby>` and, in
 * order: a `CourseSeam` in the top padding; a kicker row with a live
 * `Needle` that swings to the station's bearing each time it scrolls in, and
 * the mono kicker "{bearing}° · {nav label}" (bearing via `Intl`, zero-padded,
 * locale digits); the plain `<h2>` through `WordReveal`; the lead (`--fs-lead`,
 * mist, at most 56ch); then the children.
 *
 * Children are full width (canvases may bleed); wrap constrained content in
 * `.station-inner` (max `--content`, side gutters) yourself.
 *
 * Pinned stations (`pin`) put the children in a `{vh}vh` track with a sticky
 * `100svh` stage, from `minWidth` up (supported breakpoints: 768, 1024, 1280,
 * 1440; other values round up to the next). Below it the track is ordinary
 * flow. Nothing above the stage gets `transform`, `filter`, `contain`,
 * `overflow` or `content-visibility`, which would break `position: sticky`.
 * Pass the same `minWidth` to `useScrollProgress(trackRef, { mode: "pin" })`.
 *
 * Non-pinned stations skip rendering while far off screen
 * (`content-visibility: auto; contain-intrinsic-size: auto 900px`).
 */

export type StationProps = {
  id: StationId;
  title: ReactNode;
  lead?: ReactNode;
  align?: "start" | "center";
  pin?: { minWidth: number; vh: number };
  tone?: "plain" | "graticule";
  /** The pinned track (for `useScrollProgress` in "pin" mode). */
  trackRef?: Ref<HTMLDivElement>;
  className?: string;
  children?: ReactNode;
};

/** Breakpoints with a pin rule in primitives.css. */
export const PIN_BREAKPOINTS = [768, 1024, 1280, 1440] as const;

/** The supported pin breakpoint a `minWidth` maps to (rounding up, capped at the largest). */
export function pinBreakpoint(minWidth: number): (typeof PIN_BREAKPOINTS)[number] {
  for (const breakpoint of PIN_BREAKPOINTS) if (minWidth <= breakpoint) return breakpoint;
  return PIN_BREAKPOINTS[PIN_BREAKPOINTS.length - 1];
}

export default function Station({
  id,
  title,
  lead,
  align = "start",
  pin,
  tone = "plain",
  trackRef,
  className,
  children,
}: StationProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const station = getStation(id);
  const titleId = `${id}-title`;
  const pinned = pin !== undefined;

  return (
    <section
      id={id}
      data-station={id}
      data-bearing={station.bearing}
      data-align={align}
      data-pin-min={pinned ? pinBreakpoint(pin.minWidth) : undefined}
      aria-labelledby={titleId}
      className={cx(
        "station",
        tone === "graticule" && "graticule",
        // content-visibility contains its subtree: never on a pinned station.
        !pinned && id !== "bridge" && "station-cv",
        className
      )}
    >
      <CourseSeam bearing={station.bearing} />
      <header className="station-inner station-head">
        <p className="station-kicker">
          <span className="station-dial">
            <Needle size={18} bearing={station.bearing} swingOnView />
          </span>
          <span className="kicker">
            <span dir="ltr">{formatBearing(locale, station.bearing)}°</span>
            {" · "}
            {t(station.navKey)}
          </span>
        </p>
        <WordReveal as="h2" id={titleId} className="station-title serif-display" lines={[title]} />
        {lead ? <p className="station-lead">{lead}</p> : null}
      </header>
      {pinned ? (
        <div
          ref={trackRef}
          className="station-track"
          style={{ "--pin-vh": `${pin.vh}vh` } as CSSProperties}
        >
          <div className="station-stage">{children}</div>
        </div>
      ) : (
        <div className="station-body">{children}</div>
      )}
    </section>
  );
}
