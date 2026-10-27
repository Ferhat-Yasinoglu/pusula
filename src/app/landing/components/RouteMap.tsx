"use client";
import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  BORDER_PATH,
  CITIES,
  CITY_POINTS,
  DOT_LEVELS,
  MAP_HEIGHT,
  MAP_WIDTH,
  arcControl,
  arcPath,
  buildDotGrid,
  dotsPath,
  quadraticPoint,
  round2,
  type CityId,
  type LabelSide,
  type Point,
} from "../landingGeometry";
import { useAnimationFrame, useInView, usePrefersReducedMotion } from "../landingMotion";
import SectionHeading from "./SectionHeading";

/**
 * The route map: Afghanistan drawn as a field of gold dots, with requests
 * flying between its cities and Kabul as the hub. It is a picture of what the
 * gateway does — pick a route, send the request, count the arrival — and is
 * labelled as a simulation; no real traffic is shown.
 */

const DOT_SPACING = 8;
const DOTS = buildDotGrid(DOT_SPACING);
/** One path per brightness band: ~1,700 dots rendered as five SVG nodes. */
const DOT_BANDS = Array.from({ length: DOT_LEVELS }, (_, level) => ({
  level,
  d: dotsPath(
    DOTS.filter((dot) => dot.level === level),
    1.05 + level * 0.16
  ),
}));

const HUB: CityId = "kabul";
const SPOKES = CITIES.filter((city) => city.id !== HUB).map((city) => ({
  id: city.id,
  d: arcPath(CITY_POINTS[HUB], CITY_POINTS[city.id], 0.18),
}));

const SLOTS = 10;
const SPAWN_EVERY_MS = 520;
const TRAIL = 0.22;
const LOG_LENGTH = 5;

type Flight = {
  active: boolean;
  from: Point;
  to: Point;
  control: Point;
  dest: CityId;
  start: number;
  duration: number;
};

type LogEntry = { id: number; from: CityId; to: CityId };

const LABEL_OFFSET: Record<
  LabelSide,
  { dx: number; dy: number; anchor: "start" | "middle" | "end" }
> = {
  n: { dx: 0, dy: -16, anchor: "middle" },
  s: { dx: 0, dy: 28, anchor: "middle" },
  e: { dx: 13, dy: 4, anchor: "start" },
  w: { dx: -13, dy: 4, anchor: "end" },
};

function emptyCounts(): Record<CityId, number> {
  return Object.fromEntries(CITIES.map((city) => [city.id, 0])) as Record<CityId, number>;
}

function pickRoute(): [CityId, CityId] {
  const ids = CITIES.map((city) => city.id);
  const other = () => ids[1 + Math.floor(Math.random() * (ids.length - 1))];
  const roll = Math.random();
  // Most traffic goes through the hub, as most requests go through one gateway.
  if (roll < 0.42) return [other(), HUB];
  if (roll < 0.78) return [HUB, other()];
  const a = other();
  let b = other();
  while (b === a) b = other();
  return [a, b];
}

export default function RouteMap() {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const [sectionRef, inView] = useInView<HTMLElement>("80px");
  const [counts, setCounts] = useState<Record<CityId, number>>(emptyCounts);
  const [log, setLog] = useState<LogEntry[]>([]);

  const flights = useRef<Flight[]>(
    Array.from({ length: SLOTS }, () => ({
      active: false,
      from: { x: 0, y: 0 },
      to: { x: 0, y: 0 },
      control: { x: 0, y: 0 },
      dest: HUB,
      start: 0,
      duration: 1,
    }))
  );
  const trailRefs = useRef<(SVGPathElement | null)[]>([]);
  const headRefs = useRef<(SVGCircleElement | null)[]>([]);
  const pulseRefs = useRef<Partial<Record<CityId, SVGCircleElement | null>>>({});
  const lastSpawn = useRef(0);
  const logId = useRef(0);

  const total = useMemo(() => Object.values(counts).reduce((sum, n) => sum + n, 0), [counts]);
  const cityName = (id: CityId) => t(`mapCity_${id}`);

  const arrive = (dest: CityId) => {
    setCounts((previous) => ({ ...previous, [dest]: previous[dest] + 1 }));
    const pulse = pulseRefs.current[dest];
    if (pulse) {
      pulse.classList.remove("city-pulse");
      // Force a reflow so the animation restarts on every arrival.
      void pulse.getBoundingClientRect();
      pulse.classList.add("city-pulse");
    }
  };

  useAnimationFrame((_dt, now) => {
    if (now - lastSpawn.current > SPAWN_EVERY_MS) {
      const slot = flights.current.findIndex((flight) => !flight.active);
      if (slot >= 0) {
        lastSpawn.current = now;
        const [from, to] = pickRoute();
        const a = CITY_POINTS[from];
        const b = CITY_POINTS[to];
        const flight = flights.current[slot];
        flight.active = true;
        flight.from = a;
        flight.to = b;
        flight.control = arcControl(a, b, 0.3);
        flight.dest = to;
        flight.start = now;
        flight.duration = 1300 + Math.hypot(b.x - a.x, b.y - a.y) * 2.4;
        trailRefs.current[slot]?.setAttribute("d", arcPath(a, b, 0.3));
        const id = (logId.current += 1);
        setLog((previous) => [{ id, from, to }, ...previous].slice(0, LOG_LENGTH));
      }
    }

    flights.current.forEach((flight, i) => {
      const trail = trailRefs.current[i];
      const head = headRefs.current[i];
      if (!trail || !head) return;
      if (!flight.active) {
        trail.setAttribute("opacity", "0");
        head.setAttribute("opacity", "0");
        return;
      }
      const progress = (now - flight.start) / flight.duration;
      if (progress >= 1) {
        flight.active = false;
        trail.setAttribute("opacity", "0");
        head.setAttribute("opacity", "0");
        arrive(flight.dest);
        return;
      }
      // Ease in-out so a request leaves gently and lands softly.
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - (-2 * progress + 2) ** 2 / 2;
      const tail = Math.max(0, eased - TRAIL);
      trail.setAttribute("stroke-dasharray", `${round2(eased - tail)} 2`);
      trail.setAttribute("stroke-dashoffset", String(round2(-tail)));
      trail.setAttribute("opacity", "1");
      const point = quadraticPoint(flight.from, flight.control, flight.to, eased);
      head.setAttribute("cx", String(round2(point.x)));
      head.setAttribute("cy", String(round2(point.y)));
      head.setAttribute("opacity", "1");
    });
  }, !reduced && inView);

  return (
    <section
      id="network"
      ref={sectionRef}
      className="relative scroll-mt-20 overflow-hidden border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("mapTitle")} lead={t("mapLead")} />

        <div className="grid items-center gap-10 lg:grid-cols-12">
          <figure className="reveal relative lg:col-span-8">
            <svg
              viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
              style={{ direction: "ltr" }}
              className="block w-full"
              role="img"
              aria-label={t("mapAria")}
            >
              <defs>
                <clipPath id="map-clip">
                  <path d={BORDER_PATH} />
                </clipPath>
                <radialGradient id="map-wash" cx="58%" cy="44%" r="60%">
                  <stop offset="0%" stopColor="#d4a840" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#d4a840" stopOpacity="0.02" />
                </radialGradient>
                <linearGradient id="map-scan" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#ffd36e" stopOpacity="0" />
                  <stop offset="50%" stopColor="#ffd36e" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#ffd36e" stopOpacity="0" />
                </linearGradient>
                <filter id="map-bloom" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              <path d={BORDER_PATH} fill="url(#map-wash)" />
              <g clipPath="url(#map-clip)">
                {DOT_BANDS.map((band) => (
                  <path
                    key={band.level}
                    d={band.d}
                    fill="var(--gold)"
                    fillOpacity={round2(0.16 + band.level * 0.17)}
                  />
                ))}
                {!reduced && (
                  <rect
                    className="map-scan"
                    x={-220}
                    y={0}
                    width={220}
                    height={MAP_HEIGHT}
                    fill="url(#map-scan)"
                  />
                )}
              </g>
              <path
                d={BORDER_PATH}
                fill="none"
                stroke="var(--gold-bright)"
                strokeOpacity="0.85"
                strokeWidth="1.6"
                strokeLinejoin="round"
                filter="url(#map-bloom)"
                className="map-border"
              />

              {SPOKES.map((spoke) => (
                <path
                  key={spoke.id}
                  d={spoke.d}
                  fill="none"
                  stroke="var(--gold)"
                  strokeOpacity="0.28"
                  strokeWidth="1"
                  strokeDasharray="2 6"
                />
              ))}

              {Array.from({ length: SLOTS }, (_, i) => (
                <g key={i}>
                  <path
                    ref={(node) => {
                      trailRefs.current[i] = node;
                    }}
                    d="M 0 0"
                    pathLength={1}
                    fill="none"
                    stroke="var(--gold-bright)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    opacity="0"
                    filter="url(#map-bloom)"
                  />
                  <circle
                    ref={(node) => {
                      headRefs.current[i] = node;
                    }}
                    r="3.2"
                    cx="0"
                    cy="0"
                    fill="#fff4d6"
                    opacity="0"
                    filter="url(#map-bloom)"
                  />
                </g>
              ))}

              {CITIES.map((city) => {
                const point = CITY_POINTS[city.id];
                const offset = LABEL_OFFSET[city.label];
                return (
                  <g key={city.id}>
                    <circle
                      ref={(node) => {
                        pulseRefs.current[city.id] = node;
                      }}
                      cx={point.x}
                      cy={point.y}
                      r="6"
                      fill="none"
                      stroke="var(--gold-bright)"
                      strokeWidth="1.5"
                      opacity="0"
                    />
                    {city.hub && (
                      <circle
                        className={reduced ? undefined : "spin-hub"}
                        cx={point.x}
                        cy={point.y}
                        r="13"
                        fill="none"
                        stroke="var(--gold-bright)"
                        strokeOpacity="0.8"
                        strokeDasharray="3 4"
                      />
                    )}
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={city.hub ? 6 : 4.5}
                      fill="var(--ink)"
                      stroke="var(--gold-bright)"
                      strokeWidth="1.6"
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={city.hub ? 2.8 : 2}
                      fill="var(--gold-bright)"
                    />
                    <text
                      x={round2(point.x + offset.dx)}
                      y={round2(point.y + offset.dy)}
                      textAnchor={offset.anchor}
                      fill="var(--foam)"
                      className={city.hub ? "map-label map-label-hub" : "map-label"}
                      fontSize={city.hub ? 15 : 13}
                      fontWeight={city.hub ? 700 : 600}
                      paintOrder="stroke"
                      stroke="var(--ink)"
                      strokeWidth="3"
                      strokeLinejoin="round"
                    >
                      {cityName(city.id)}{" "}
                      <tspan fill="var(--gold-bright)" fontFamily="var(--font-mono)">
                        {counts[city.id]}
                      </tspan>
                    </text>
                  </g>
                );
              })}
            </svg>
          </figure>

          <aside className="glass reveal rounded-2xl p-6 lg:col-span-4" aria-live="off">
            <div className="flex items-center gap-2 text-xs text-[var(--mist)]">
              <span className="live-dot" aria-hidden="true" />
              {t("mapLiveTitle")}
            </div>
            <div className="readout mt-4 text-5xl font-semibold text-[var(--gold-bright)]">
              {total}
            </div>
            <div className="mt-1 text-sm text-[var(--mist)]">{t("mapTotal")}</div>

            <ul className="mt-6 space-y-2 border-t border-[var(--rule-soft)] pt-4">
              {log.length === 0 ? (
                <li className="readout text-xs text-[var(--mist-dim)]">
                  {cityName(HUB)} · {t("mapHub")}
                </li>
              ) : (
                log.map((entry) => (
                  <li
                    key={entry.id}
                    className="swap-in flex items-center gap-2 text-sm text-[var(--foam)]"
                  >
                    <span className="truncate">{cityName(entry.from)}</span>
                    <span
                      className="inline-block text-[var(--gold)] rtl:-scale-x-100"
                      aria-hidden="true"
                    >
                      →
                    </span>
                    <span className="truncate">{cityName(entry.to)}</span>
                    {(entry.to === HUB || entry.from === HUB) && (
                      <span className="readout ms-auto text-[10px] text-[var(--mist-dim)]">
                        {t("mapHub")}
                      </span>
                    )}
                  </li>
                ))
              )}
            </ul>
            <p className="mt-6 text-xs text-[var(--mist-dim)]">{t("mapSimNote")}</p>
          </aside>
        </div>
      </div>
    </section>
  );
}
