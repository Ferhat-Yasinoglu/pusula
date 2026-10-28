import { round2 } from "../../landingGeometry";
import { SAMPLE_CANDIDATES, type LandingStats } from "../../landingTypes";
import { createWorld } from "../../sim/landingSim";
import { PROJECTED_STRIDE } from "../../sim/landingProjection";
import {
  BEZEL_RATIO,
  BEZEL_TICKS,
  GYRO_TILT_DEG,
  NEEDLE_TAIL,
  NEEDLE_TIP,
  POSTER_BOX,
  POSTER_GEOMETRY,
  RING_TILTS,
  bearingTo,
  createGyroScene,
  posterFactorArcs,
  posterRingPath,
  posterStars,
} from "./gyro";

/**
 * Server-rendered still of the gyro-compass at yaw 0 (spec §6.2): the stars,
 * rings, factor ring and bezel, and the needle on the tick-0 featured winner.
 * It sits in the dial square under the hero canvas, which fades it out after
 * its first frame (`.stage[data-live="on"]`); under reduced motion it is what
 * a visitor sees until the canvas draws its still frame.
 *
 * Drawn in the 1000-unit dial box from the same geometry as the canvas
 * (`gyro.ts`). Strokes and star dots use `vector-effect: non-scaling-stroke`
 * so they keep their pixel size at any dial size. Never re-executed on the
 * client, so the trigonometry carries no hydration risk.
 */
export default function HeroPoster({ stats }: { stats: LandingStats }) {
  const scene = createGyroScene(
    stats.catalog,
    SAMPLE_CANDIDATES.map((c) => c.catalogId)
  );
  const stars = posterStars(scene);
  const { cx, cy, R } = POSTER_GEOMETRY;

  let back = "";
  let frontGold = "";
  let frontHi = "";
  for (let i = 0; i < scene.n; i++) {
    const o = i * PROJECTED_STRIDE;
    const dot = `M${Math.round(stars[o] * 10) / 10} ${Math.round(stars[o + 1] * 10) / 10}h.01`;
    if (stars[o + 3] > 0) back += dot;
    else if (scene.free[i]) frontHi += dot;
    else frontGold += dot;
  }

  // The tick-0 winner, computed exactly as the deck's server snapshot does.
  const world = createWorld({
    factorIds: stats.scoringFactors.map((f) => f.id),
    defaults: stats.scoringFactors.map((f) => f.weight),
  });
  const winnerSlot = SAMPLE_CANDIDATES.findIndex((c) => c.id === world.featured.winner);
  const winnerStar = winnerSlot >= 0 ? scene.candStar[winnerSlot] : -1;
  const wx = winnerStar >= 0 ? stars[winnerStar * PROJECTED_STRIDE] : cx;
  const wy = winnerStar >= 0 ? stars[winnerStar * PROJECTED_STRIDE + 1] : cy - R;
  const bearing = round2(bearingTo(POSTER_GEOMETRY, wx, wy));

  const arcs = posterFactorArcs(stats.scoringFactors.map((f) => f.weight));

  let ticks = "";
  const r0 = R * BEZEL_RATIO;
  for (let k = 0; k < BEZEL_TICKS; k++) {
    const a = (k / BEZEL_TICKS) * Math.PI * 2;
    const len = R * (k % 10 === 0 ? 0.05 : 0.025);
    const c = Math.cos(a);
    const s = Math.sin(a);
    ticks += `M${Math.round(cx + c * r0)} ${Math.round(cy + s * r0)}L${Math.round(cx + c * (r0 + len))} ${Math.round(cy + s * (r0 + len))}`;
  }

  const half = R * 0.032;
  const tip = R * NEEDLE_TIP;
  const tail = R * NEEDLE_TAIL;
  const candidates = SAMPLE_CANDIDATES.map((c, slot) => {
    const i = scene.candStar[slot];
    if (i < 0) return null;
    const o = i * PROJECTED_STRIDE;
    return {
      id: c.id,
      x: round2(stars[o]),
      y: round2(stars[o + 1]),
      front: stars[o + 3] < 0,
      winner: slot === winnerSlot,
    };
  });

  return (
    <svg
      className="bridge-poster-svg"
      viewBox={`0 0 ${POSTER_BOX} ${POSTER_BOX}`}
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
      data-tilt={GYRO_TILT_DEG}
    >
      <defs>
        <radialGradient id="bridge-poster-haze" cx="50%" cy="46%" r="50%">
          <stop offset="0" stopColor="#d4a840" stopOpacity="0.09" />
          <stop offset="1" stopColor="#d4a840" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bridge-poster-glow">
          <stop offset="0" stopColor="#ffd36e" stopOpacity="0.85" />
          <stop offset="1" stopColor="#ffd36e" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="bridge-poster-ember">
          <stop offset="0" stopColor="#ff7a45" stopOpacity="0.9" />
          <stop offset="1" stopColor="#ff7a45" stopOpacity="0" />
        </radialGradient>
      </defs>
      <g fill="none" vectorEffect="non-scaling-stroke">
        <circle cx={cx} cy={cy - R * 0.08} r={R * 1.25} fill="url(#bridge-poster-haze)" />
        <circle cx={cx} cy={cy} r={R * 1.02} stroke="rgba(212,168,64,0.22)" />
        <circle
          cx={cx}
          cy={cy}
          r={round2(R * (BEZEL_RATIO + 0.035))}
          stroke="#1a1712"
          strokeWidth={round2(R * 0.07)}
        />
        <circle cx={cx} cy={cy} r={round2(r0)} stroke="rgba(212,168,64,0.4)" />
        <circle
          cx={cx}
          cy={cy}
          r={round2(R * (BEZEL_RATIO + 0.07))}
          stroke="rgba(212,168,64,0.18)"
        />
        <path d={ticks} stroke="#d4a840" strokeOpacity="0.55" vectorEffect="non-scaling-stroke" />
        <path
          d={back}
          stroke="#8c6a1e"
          strokeOpacity="0.42"
          strokeWidth="1.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {RING_TILTS.map((tilt, r) => (
          <path
            key={`b${r}`}
            d={posterRingPath(tilt, false)}
            stroke="#d4a840"
            strokeOpacity={r === 0 ? 0.35 : 0.2}
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {arcs.map((d, k) =>
          d ? (
            <path
              key={`f${k}`}
              d={d}
              stroke="#d4a840"
              strokeOpacity="0.45"
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ) : null
        )}
        <g transform={`rotate(${bearing} ${cx} ${cy})`}>
          <path d={`M${cx} ${cy - tip}L${cx - half} ${cy}L${cx} ${cy}Z`} fill="#ff7a45" />
          <path d={`M${cx} ${cy - tip}L${cx + half} ${cy}L${cx} ${cy}Z`} fill="#c4552b" />
          <path d={`M${cx} ${cy + tail}L${cx - half} ${cy}L${cx} ${cy}Z`} fill="#d4a840" />
          <path d={`M${cx} ${cy + tail}L${cx + half} ${cy}L${cx} ${cy}Z`} fill="#8c6a1e" />
        </g>
        <circle
          cx={cx}
          cy={cy}
          r={round2(half * 1.5)}
          fill="#1a1712"
          stroke="#d4a840"
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={cx} cy={cy} r={round2(half * 0.45)} fill="#fff1c9" />
        {RING_TILTS.slice(1).map((tilt, r) => (
          <path
            key={`fr${r}`}
            d={posterRingPath(tilt, true)}
            stroke="#d4a840"
            strokeOpacity="0.6"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <path
          d={frontGold}
          stroke="#d4a840"
          strokeOpacity="0.85"
          strokeWidth="2.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={frontHi}
          stroke="#ffd36e"
          strokeWidth="2.6"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {candidates.map((c) =>
          c ? (
            <circle
              key={c.id}
              cx={c.x}
              cy={c.y}
              r={c.winner ? 26 : 14}
              fill={c.winner ? "url(#bridge-poster-ember)" : "url(#bridge-poster-glow)"}
              opacity={c.front ? 0.8 : 0.3}
            />
          ) : null
        )}
      </g>
    </svg>
  );
}
