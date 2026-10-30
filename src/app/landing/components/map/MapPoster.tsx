import { useTranslations } from "next-intl";
import {
  BORDER_PATH,
  CITIES,
  MAP_HEIGHT,
  MAP_WIDTH,
  round2,
  type CityId,
} from "../../landingGeometry";
import {
  PROJECTED_STRIDE,
  arcPoint3,
  makeCamera,
  project3,
  vec3,
} from "../../sim/landingProjection";
import {
  CATALOG_ID,
  CANDIDATE_OF_CITY,
  CITY_COUNT,
  HUB_ARCS,
  HUB_INDEX,
  LABEL_SIDE,
  NODE_COUNT,
  NODE_POINTS,
  PERSPECTIVE_F,
  cityRole,
} from "./mapRoles";

/**
 * The network map's still frame (spec §6.3), rendered on the server: the
 * reference look the client sent (a gold dot-matrix Afghanistan on near-black,
 * glowing city nodes, thin gold arcs out of Kabul), top-down, with city names
 * and no counters (simulated numbers never come from the server).
 *
 * It sits in the canvas stage's `.stage-poster` and fades once the canvas has
 * drawn; under reduced motion it is the map. Its box (`.netmap-fit`) is framed
 * by `map.css` with exactly the canvas camera's fit (`fitMap` in mapRoles.ts),
 * so the hand-off does not move a dot.
 *
 * The dot matrix is a pattern masked by the border, lit by one radial glow per
 * city, so the poster costs a few hundred bytes instead of a path per dot. Two
 * grids match the canvas: 12-unit spacing from 640px up, 14 below.
 */

/** The canvas camera at pitch 0, in map units: arcs here match the canvas frame exactly. */
const FLAT = makeCamera({
  yaw: 0,
  pitch: 0,
  F: PERSPECTIVE_F,
  cx: MAP_WIDTH / 2,
  cy: MAP_HEIGHT / 2,
  scale: 1,
});

function spokePath(node: number): string {
  const arc = HUB_ARCS[node];
  if (!arc) return "";
  const v = vec3();
  const out = new Float32Array(PROJECTED_STRIDE);
  const parts: string[] = [];
  for (let i = 0; i <= 20; i++) {
    arcPoint3(arc, i / 20, v);
    project3(FLAT, v[0] - MAP_WIDTH / 2, v[1] - MAP_HEIGHT / 2, v[2], out, 0);
    parts.push(`${i === 0 ? "M" : "L"}${round2(out[0])} ${round2(out[1])}`);
  }
  return parts.join("");
}

const SPOKES = Array.from({ length: CITY_COUNT }, (_, node) =>
  node === HUB_INDEX ? null : { node, d: spokePath(node) }
).filter((spoke): spoke is { node: number; d: string } => spoke !== null);

const HUB_POINT = NODE_POINTS[HUB_INDEX];

function pct(value: number, total: number): string {
  return `${round2((value / total) * 100)}%`;
}

function DotGrid({ spacing, radius }: { spacing: number; radius: number }) {
  const id = `netmap-dots-${spacing}`;
  return (
    <>
      <defs>
        <pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse">
          <circle cx={spacing / 2} cy={spacing / 2} r={radius} fill="#fff" />
        </pattern>
        <mask
          id={`${id}-mask`}
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width={MAP_WIDTH}
          height={MAP_HEIGHT}
        >
          <path d={BORDER_PATH} fill={`url(#${id})`} />
        </mask>
      </defs>
      <g className={`netmap-pdots netmap-pdots-${spacing}`} mask={`url(#${id}-mask)`}>
        <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="rgb(176,136,48)" fillOpacity="0.78" />
        {CITIES.map((city) => {
          const p = NODE_POINTS[CITIES.indexOf(city)];
          return <circle key={city.id} cx={p.x} cy={p.y} r="90" fill="url(#netmap-heat)" />;
        })}
      </g>
    </>
  );
}

export default function MapPoster() {
  const t = useTranslations("landing");
  return (
    <div className="netmap-fit netmap-poster">
      <svg
        className="netmap-poster-svg"
        viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Warmth around a city stays gold (the canvas's bands 1–2 at rest): no cream. */}
          <radialGradient id="netmap-heat">
            <stop offset="0" stopColor="#ffd36e" stopOpacity="0.9" />
            <stop offset="0.35" stopColor="#d4a840" stopOpacity="0.9" />
            <stop offset="1" stopColor="#d4a840" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="netmap-glow">
            <stop offset="0" stopColor="#ffd36e" stopOpacity="0.55" />
            <stop offset="0.35" stopColor="#d4a840" stopOpacity="0.22" />
            <stop offset="1" stopColor="#d4a840" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="netmap-wash" cx="55%" cy="45%" r="62%">
            <stop offset="0" stopColor="#d4a840" stopOpacity="0.12" />
            <stop offset="1" stopColor="#d4a840" stopOpacity="0.02" />
          </radialGradient>
        </defs>
        <path d={BORDER_PATH} fill="url(#netmap-wash)" />
        <DotGrid spacing={12} radius={1.7} />
        <DotGrid spacing={14} radius={2.2} />

        <path
          d={BORDER_PATH}
          fill="none"
          stroke="#d4a840"
          strokeOpacity="0.14"
          strokeWidth="6"
          strokeLinejoin="round"
        />
        <path
          d={BORDER_PATH}
          fill="none"
          stroke="#ffd36e"
          strokeOpacity="0.85"
          strokeWidth="1.4"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {SPOKES.map((spoke) => (
          <path
            key={spoke.node}
            d={spoke.d}
            fill="none"
            stroke="#d4a840"
            strokeOpacity="0.5"
            strokeWidth="1"
            strokeDasharray="3 5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {NODE_POINTS.slice(CITY_COUNT, NODE_COUNT).map((p, i) => (
          <circle key={`edge-${i}`} cx={p.x} cy={p.y} r="2" fill="#8c6a1e" />
        ))}

        {CITIES.map((city, node) => {
          const p = NODE_POINTS[node];
          return (
            <circle
              key={`glow-${city.id}`}
              cx={p.x}
              cy={p.y}
              r={node === HUB_INDEX ? 46 : 30}
              fill="url(#netmap-glow)"
            />
          );
        })}
        <circle
          cx={HUB_POINT.x}
          cy={HUB_POINT.y}
          r="15"
          fill="none"
          stroke="#ffd36e"
          strokeOpacity="0.9"
          strokeDasharray="3 4"
        />
        {CITIES.map((city, node) => {
          const p = NODE_POINTS[node];
          const role = cityRole(city.id);
          if (role === "hub") {
            return (
              <g key={city.id}>
                <circle cx={p.x} cy={p.y} r="6" fill="#040405" stroke="#ffd36e" strokeWidth="1.6" />
                <circle cx={p.x} cy={p.y} r="2.8" fill="#fff1c9" />
              </g>
            );
          }
          if (role === "provider") {
            return (
              <g key={city.id}>
                <circle cx={p.x} cy={p.y} r="16" fill="#d4a840" fillOpacity="0.1" />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="14"
                  fill="none"
                  stroke="#8c6a1e"
                  strokeOpacity="0.7"
                  strokeWidth="1.3"
                />
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4.6"
                  fill="#040405"
                  stroke="#ffd36e"
                  strokeWidth="1.5"
                />
                <circle cx={p.x} cy={p.y} r="2" fill="#ffd36e" />
              </g>
            );
          }
          return (
            <path
              key={city.id}
              d={`M${p.x} ${round2(p.y - 4.4)}L${round2(p.x + 4.4)} ${p.y}L${p.x} ${round2(p.y + 4.4)}L${round2(p.x - 4.4)} ${p.y}Z`}
              fill="#040405"
              stroke="#d4a840"
              strokeWidth="1.4"
            />
          );
        })}
      </svg>

      {CITIES.map((city, node) => {
        const p = NODE_POINTS[node];
        const role = cityRole(city.id);
        const candidate = CANDIDATE_OF_CITY[city.id as CityId];
        return (
          <span
            key={city.id}
            className="netmap-pname"
            data-role={role}
            data-city={candidate ? node : undefined}
            data-pin={LABEL_SIDE.pin[city.id]}
            data-flow={LABEL_SIDE.flow[city.id]}
            style={{ left: pct(p.x, MAP_WIDTH), top: pct(p.y, MAP_HEIGHT) }}
          >
            <span className="netmap-lbody">
              <span className="netmap-lname">{t(`mapCity_${city.id}`)}</span>
              {candidate ? (
                <span className="netmap-lrole" dir="ltr">
                  → {CATALOG_ID[candidate]}
                </span>
              ) : role === "hub" ? (
                <span className="netmap-lrole">{t("mapHub")}</span>
              ) : null}
            </span>
          </span>
        );
      })}
    </div>
  );
}
