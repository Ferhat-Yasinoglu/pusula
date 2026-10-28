/**
 * Topology and pure helpers of the network map (spec §6.3). No React, no DOM:
 * shared by the server poster, the client station and the lazily loaded
 * canvas renderer, and unit-tested (`tests/unit/landing-map.test.ts`).
 *
 * - Kabul is the Pusula hub.
 * - Six cities stand for the six sample candidates of the deck (the mapping is
 *   labelled on the map itself: "→ {catalogId}").
 * - Ghazni, Faizabad and four unlabelled border vertices are where simulated
 *   clients send their requests from.
 *
 * Nodes are numbered: the nine cities in `CITIES` order, then the four edge
 * vertices. Every flight runs on one of the precomputed hub arcs, either
 * inbound (client → Kabul) or outbound (Kabul → provider): the hub retries the
 * next target itself, there is never a relay through another city.
 */
import {
  CITIES,
  CITY_POINTS,
  MAP_HEIGHT,
  MAP_WIDTH,
  project,
  type CityId,
  type LabelSide,
  type Point,
} from "../../landingGeometry";
import { SAMPLE_CANDIDATES } from "../../landingTypes";
import { liftArc, type Arc3 } from "../../sim/landingProjection";
import type { BreakerState, CandidateId, ClientId, FailCode } from "../../sim/landingSim";

/* ------------------------------------------------------------------------ */
/* Cities, roles and nodes                                                  */
/* ------------------------------------------------------------------------ */

export const HUB_CITY: CityId = "kabul";
export const CITY_IDS: readonly CityId[] = CITIES.map((city) => city.id);
export const CITY_COUNT = CITY_IDS.length;
export const HUB_INDEX = CITY_IDS.indexOf(HUB_CITY);

/** Which city stands for which sample candidate. */
export const PROVIDER_CITY: Readonly<Record<CandidateId, CityId>> = {
  claude: "mazar",
  gpt: "herat",
  gemini: "kandahar",
  glm: "kunduz",
  cerebras: "jalalabad",
  ollama: "bamyan",
};

/** The deck's candidates in `SAMPLE_CANDIDATES` order (the order of `world.candidates`). */
export const MAP_CANDIDATES: readonly CandidateId[] = SAMPLE_CANDIDATES.map((c) => c.id);

/** The real catalog id each sample candidate is (`→ openai`, `→ ollama-local`, …). */
export const CATALOG_ID: Readonly<Record<CandidateId, string>> = Object.fromEntries(
  SAMPLE_CANDIDATES.map((c) => [c.id, c.catalogId])
) as Record<CandidateId, string>;

export const CANDIDATE_OF_CITY: Readonly<Partial<Record<CityId, CandidateId>>> = Object.fromEntries(
  (Object.entries(PROVIDER_CITY) as [CandidateId, CityId][]).map(([id, city]) => [city, id])
);

export const CLIENT_CITIES: readonly CityId[] = ["ghazni", "faizabad"];

export type CityRole = "hub" | "provider" | "client";

export function cityRole(id: CityId): CityRole {
  if (id === HUB_CITY) return "hub";
  return CANDIDATE_OF_CITY[id] ? "provider" : "client";
}

/** Four unlabelled border vertices (north, south-east, south, west) where edge clients enter. */
export const EDGE_VERTICES: readonly (readonly [number, number])[] = [
  [66.52, 37.36],
  [69.32, 31.9],
  [64.35, 29.56],
  [60.8, 34.4],
];

/** Every node's map point: the nine cities, then the four edge vertices. */
export const NODE_POINTS: readonly Point[] = [
  ...CITY_IDS.map((id) => CITY_POINTS[id]),
  ...EDGE_VERTICES.map(([lon, lat]) => project(lon, lat)),
];
export const NODE_COUNT = NODE_POINTS.length;

export function cityIndex(id: CityId): number {
  return CITY_IDS.indexOf(id);
}

/** The node a simulated client sends from. */
export function clientNode(from: ClientId): number {
  switch (from) {
    case "ghazni":
      return cityIndex("ghazni");
    case "faizabad":
      return cityIndex("faizabad");
    case "edge0":
      return CITY_COUNT;
    case "edge1":
      return CITY_COUNT + 1;
    case "edge2":
      return CITY_COUNT + 2;
    default:
      return CITY_COUNT + 3;
  }
}

/** The node (city index) a candidate is drawn at. */
export function providerNode(id: CandidateId): number {
  return cityIndex(PROVIDER_CITY[id]);
}

/** The candidate a node stands for, or null for the hub, clients and edges. */
export function candidateAtNode(node: number): CandidateId | null {
  const id = CITY_IDS[node];
  return id ? (CANDIDATE_OF_CITY[id] ?? null) : null;
}

/* ------------------------------------------------------------------------ */
/* Arcs and flight timing                                                   */
/* ------------------------------------------------------------------------ */

/** Apex height of a flight parabola, as a share of its chord (spec: .35). */
export const ARC_APEX = 0.35;
/** Sideways bow of the ground track (the reference image's thin curved arcs). */
export const ARC_BULGE = 0.22;

/** One lifted arc from Kabul to every other node; `null` at the hub itself. */
export const HUB_ARCS: readonly (Arc3 | null)[] = NODE_POINTS.map((point, node) =>
  node === HUB_INDEX ? null : liftArc(NODE_POINTS[HUB_INDEX], point, ARC_APEX, ARC_BULGE)
);

/** Spec: `700 + 1.4 · chord` ms. */
export function legDurationMs(chord: number): number {
  return 700 + 1.4 * chord;
}

/** How a leg is painted. */
export type LegTint = "client" | "provider" | "fallback";

/** One leg of a planned flight; `node` is the far end of its hub arc. */
export type LegPlan = {
  node: number;
  /** Travels towards Kabul (client → hub). */
  inbound: boolean;
  tint: LegTint;
  /** ms after the flight starts. */
  delayMs: number;
  durationMs: number;
  /** The failure this leg ends in (503 / 401 / 429), or 0 when it lands. */
  code: FailCode | 0;
  /** The leg that serves the request. */
  final: boolean;
};

export function emptyLeg(): LegPlan {
  return {
    node: 0,
    inbound: true,
    tint: "client",
    delayMs: 0,
    durationMs: 0,
    code: 0,
    final: false,
  };
}

/**
 * Plan a request's flight into `out` (pre-allocated legs, reused): the client
 * leg into Kabul, then one leg out to each target that failed (each ends in
 * its code), then the leg to the target that served it (`toNode`, or −1 when
 * nothing could). Every fallback leg departs from Kabul the moment the
 * previous target's failure lands: the hub retries the next target. Returns
 * the number of legs written (capped at `out.length`).
 */
export function planFlight(
  out: LegPlan[],
  fromNode: number,
  failedNodes: readonly number[],
  codes: readonly FailCode[],
  toNode: number
): number {
  let count = 0;
  let clock = 0;
  if (fromNode !== HUB_INDEX && count < out.length) {
    clock += writeLeg(out[count++], fromNode, true, "client", clock, 0, false);
  }
  for (let i = 0; i < failedNodes.length && count < out.length; i++) {
    const tint = i === 0 ? "provider" : "fallback";
    clock += writeLeg(out[count++], failedNodes[i], false, tint, clock, codes[i] ?? 503, false);
  }
  if (toNode >= 0 && count < out.length) {
    const tint = failedNodes.length > 0 ? "fallback" : "provider";
    clock += writeLeg(out[count++], toNode, false, tint, clock, 0, true);
  }
  return count;
}

/** Fill one leg in place; returns its duration. */
function writeLeg(
  leg: LegPlan,
  node: number,
  inbound: boolean,
  tint: LegTint,
  delayMs: number,
  code: FailCode | 0,
  final: boolean
): number {
  const arc = HUB_ARCS[node];
  leg.node = node;
  leg.inbound = inbound;
  leg.tint = tint;
  leg.delayMs = delayMs;
  leg.durationMs = legDurationMs(arc ? arc.chord : 0);
  leg.code = code;
  leg.final = final;
  return leg.durationMs;
}

/* ------------------------------------------------------------------------ */
/* Heat                                                                     */
/* ------------------------------------------------------------------------ */

export const HEAT_HALF_LIFE_S = 3;
export const HEAT_KICK = 0.35;
export const HEAT_CAP = 1.6;
/**
 * Smaller kicks for the hub and for departures: every request passes Kabul,
 * so a full kick would hold it at the cap and drown the providers' glow.
 */
export const HUB_HEAT_KICK = 0.03;
export const CLIENT_HEAT_KICK = 0.05;
/**
 * Heat spreads over the dots with σ = 4 · spacing (the spec's 6 · spacing lit
 * a 250-unit disc around every busy city, a blur rather than pillars).
 */
export const HEAT_SIGMA_SPACINGS = 4;
/** A dot whose heat exceeds this becomes a pillar of light once the map is tilted. */
export const PILLAR_THRESHOLD = 0.35;

export function decayHeat(heat: number, dtSeconds: number): number {
  if (!(dtSeconds > 0)) return heat;
  return heat * Math.pow(0.5, dtSeconds / HEAT_HALF_LIFE_S);
}

export function kickHeat(heat: number, amount = HEAT_KICK): number {
  return Math.min(HEAT_CAP, heat + amount);
}

/** Spec: pillar height `2 + 26 · min(h, 1)` map units. */
export function pillarHeight(heat: number): number {
  return 2 + 26 * Math.min(heat, 1);
}

/* ------------------------------------------------------------------------ */
/* Framing                                                                  */
/* ------------------------------------------------------------------------ */

/** "pin": the desktop sticky stage (≥1024). "flow": phone and tablet, not pinned. */
export type MapLayout = "pin" | "flow";

/** The map fills at most `w` of the stage width and `h` of its height, centred at (`x`, `y`). */
export type MapFit = {
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
};

/**
 * Every framing of the map. `map.css` mirrors these exact numbers for the
 * poster (`.netmap-fit`: `min(w·cqw, h·cqh · 825/643)` at `left: x; top: y`),
 * so canvas and poster coincide at pitch 0.
 *
 * Geography is never mirrored, and Afghanistan's open corners are its
 * north-west and south-east, so the desktop title always takes the top-left
 * and the legend the top-right. The flight board takes the bottom inline-end
 * corner (bottom-right in LTR, bottom-left in RTL, where the SimDock is not):
 * in RTL the map therefore leans further right, clear of both the title and
 * the board. A narrower desktop stage (1024–1279, "compact") frames it smaller.
 */
export const MAP_FITS = {
  flow: { w: 0.92, h: 0.86, x: 0.5, y: 0.56 },
  pin: { w: 0.78, h: 0.8, x: 0.58, y: 0.56 },
  pinRtl: { w: 0.78, h: 0.8, x: 0.61, y: 0.56 },
  compact: { w: 0.66, h: 0.8, x: 0.62, y: 0.56 },
  compactRtl: { w: 0.62, h: 0.8, x: 0.63, y: 0.56 },
} as const satisfies Record<string, MapFit>;
export type MapFitId = keyof typeof MAP_FITS;

/** Desktop stages narrower than this use the compact framing (`@container` in map.css). */
export const PIN_COMPACT_BELOW = 1280;

/** Which framing a stage of `width` uses. */
export function mapFitId(width: number, layout: MapLayout, rtl: boolean): MapFitId {
  if (layout === "flow") return "flow";
  if (width < PIN_COMPACT_BELOW) return rtl ? "compactRtl" : "compact";
  return rtl ? "pinRtl" : "pin";
}

export type MapFrame = { scale: number; cx: number; cy: number };

/** World units → CSS px for a stage of `width` × `height`; written into `out`. */
export function fitMap(
  width: number,
  height: number,
  layout: MapLayout,
  rtl = false,
  out: MapFrame = { scale: 1, cx: 0, cy: 0 }
): MapFrame {
  const fit: MapFit = MAP_FITS[mapFitId(width, layout, rtl)];
  const boxWidth = Math.min(fit.w * width, ((fit.h * height) / MAP_HEIGHT) * MAP_WIDTH);
  out.scale = Math.max(boxWidth, 1) / MAP_WIDTH;
  out.cx = width * fit.x;
  out.cy = height * fit.y;
  return out;
}

/**
 * How the frame moves once the map is tilted (`k` = tilt share, 0..1): a
 * tilted map is shallower, so the desktop stage drops it a little under its
 * rising arcs and grows it 6%; the phone grows it 14% (the tilt frees the
 * height the flat map needed) and lifts it towards the lead, where the
 * beacons rise. In stage fractions; written into `out`.
 */
export const TILT_FRAME: Readonly<Record<MapLayout, { dx: number; dy: number; grow: number }>> = {
  pin: { dx: 0, dy: 0.03, grow: 0.06 },
  flow: { dx: 0, dy: -0.02, grow: 0.14 },
};

export function tiltFrame(
  frame: MapFrame,
  width: number,
  height: number,
  layout: MapLayout,
  k: number,
  out: MapFrame
): MapFrame {
  const tilt = TILT_FRAME[layout];
  const share = clamp01(k);
  out.cx = frame.cx + width * tilt.dx * share;
  out.cy = frame.cy + height * tilt.dy * share;
  out.scale = frame.scale * (1 + tilt.grow * share);
  return out;
}

/** A node's top-down (pitch 0) screen position: the poster's geometry, for hit tests. */
export function flatNodePoint(node: number, frame: MapFrame): Point {
  const point = NODE_POINTS[node];
  return {
    x: frame.cx + (point.x - MAP_WIDTH / 2) * frame.scale,
    y: frame.cy + (point.y - MAP_HEIGHT / 2) * frame.scale,
  };
}

/** The six provider cities' node indices (`MAP_CANDIDATES` order): the only tap targets. */
export const PROVIDER_NODES: readonly number[] = MAP_CANDIDATES.map((id) => providerNode(id));
/** Every other city (the hub and the client cities): hover-only, for their card. */
export const PASSIVE_NODES: readonly number[] = CITY_IDS.map((_, i) => i).filter(
  (i) => !PROVIDER_NODES.includes(i)
);

/**
 * The node under (x, y): the nearest of `nodes` (indices into `screen`,
 * stride 4: sx, sy, …) within `radius` px, or −1.
 */
export function nearestNode(
  screen: ArrayLike<number>,
  nodes: readonly number[],
  x: number,
  y: number,
  radius: number
): number {
  let best = -1;
  let bestD2 = radius * radius;
  for (let k = 0; k < nodes.length; k++) {
    const i = nodes[k];
    const dx = screen[i * 4] - x;
    const dy = screen[i * 4 + 1] - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/** A provider city gets a full 48px target; the hub and the clients a 24px one, for hover only. */
export const PROVIDER_HIT_PX = 24;
export const PASSIVE_HIT_PX = 12;

/**
 * The city a pointer at (x, y) means: a provider within 24px wins (the hub,
 * 29px from Jalalabad on a phone, never steals its tap); otherwise, when
 * `passive`, the hub or a client within 12px (hover card only).
 */
export function cityAt(screen: ArrayLike<number>, x: number, y: number, passive: boolean): number {
  const provider = nearestNode(screen, PROVIDER_NODES, x, y, PROVIDER_HIT_PX);
  if (provider >= 0 || !passive) return provider;
  return nearestNode(screen, PASSIVE_NODES, x, y, PASSIVE_HIT_PX);
}

/* ------------------------------------------------------------------------ */
/* Camera                                                                   */
/* ------------------------------------------------------------------------ */

export const DEG = Math.PI / 180;

/** Desktop pin: tilt and turn over the first half of the track. */
export const PIN_PITCH_DEG = 52;
export const PIN_YAW_DEG = -10;
/** Phone: a time-based tilt on first sight. */
export const FLOW_PITCH_DEG = 46;
export const FLOW_YAW_DEG = -8;
export const FLOW_TILT_MS = 1600;
/** Pillars, the wall top and tilted shading start above this pitch. */
export const TILT_FEATURES_DEG = 12;
/** Pointer parallax, either way (desktop, fine pointer). */
export const PARALLAX_YAW_DEG = 5;
/** The idle breathing of the yaw, either way. */
export const BREATH_YAW_DEG = 3;
export const PERSPECTIVE_F = 1.6 * MAP_WIDTH;

export function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value > 1 ? 1 : value;
}

export function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function easeInOutCubic(value: number): number {
  const x = clamp01(value);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export type CameraTarget = { pitch: number; yaw: number };

/**
 * Desktop camera target (radians) for pin progress `p`: flat at 0 (the
 * reference image), fully tilted from .5 on. Written into `out`.
 */
export function pinCameraTarget(p: number, out: CameraTarget = { pitch: 0, yaw: 0 }): CameraTarget {
  const e = smoothstep(clamp01(p) / 0.5);
  out.pitch = PIN_PITCH_DEG * DEG * e;
  out.yaw = PIN_YAW_DEG * DEG * e;
  return out;
}

/** Phone pitch (radians) `elapsedMs` after the map first came into sight. */
export function flowPitch(elapsedMs: number): number {
  return FLOW_PITCH_DEG * DEG * easeInOutCubic(elapsedMs / FLOW_TILT_MS);
}

/* ------------------------------------------------------------------------ */
/* Labels                                                                   */
/* ------------------------------------------------------------------------ */

/**
 * Which side of its node each city label sits on. Desktop keeps the reference
 * layout (`City.label`); the phone map is 0.44× smaller, so the Kabul cluster
 * fans out around the hub instead.
 */
export const LABEL_SIDE: Readonly<Record<MapLayout, Readonly<Record<CityId, LabelSide>>>> = {
  pin: Object.fromEntries(CITIES.map((city) => [city.id, city.label])) as Record<CityId, LabelSide>,
  flow: {
    kabul: "n",
    herat: "s",
    kandahar: "e",
    mazar: "w",
    kunduz: "n",
    jalalabad: "e",
    bamyan: "w",
    ghazni: "s",
    faizabad: "e",
  },
};

/** Label opacity by depth: the far (northern) edge of a tilted map dims a little. */
export function labelOpacity(depth: number): number {
  return Math.max(0.7, Math.min(1, 1 - depth / 1200));
}

/* ------------------------------------------------------------------------ */
/* Breakers                                                                 */
/* ------------------------------------------------------------------------ */

const STATE_CODE: Readonly<Record<BreakerState, number>> = {
  closed: 0,
  degraded: 1,
  halfOpen: 2,
  open: 3,
};
const CODE_STATE: readonly BreakerState[] = ["closed", "degraded", "halfOpen", "open"];

/** Three bits per candidate (`MAP_CANDIDATES` order): upstream latch, then the breaker state. */
export function packCandidate(index: number, down: boolean, state: BreakerState): number {
  return ((down ? 4 : 0) | STATE_CODE[state]) << (index * 3);
}

export function unpackDown(packed: number, index: number): boolean {
  return ((packed >> (index * 3)) & 4) !== 0;
}

export function unpackState(packed: number, index: number): BreakerState {
  return CODE_STATE[(packed >> (index * 3)) & 3];
}

/** i18n key of a breaker state (`state*`). */
export const STATE_KEY: Readonly<
  Record<BreakerState, "stateClosed" | "stateDegraded" | "stateOpen" | "stateHalfOpen">
> = {
  closed: "stateClosed",
  degraded: "stateDegraded",
  open: "stateOpen",
  halfOpen: "stateHalfOpen",
};

/** The `X-Pusula-Fallback-Attempts` header without its prefix, as the flight board prints it. */
export function shortHeader(header: string): string {
  return header.replace(/^X-Pusula-/, "");
}

/* ------------------------------------------------------------------------ */
/* Flight board                                                             */
/* ------------------------------------------------------------------------ */

/**
 * How a flight-board line reads: "ok" (served first time), "fallback" (served
 * after the hub retried) or "dropped" (nothing could serve it: every target
 * failed, or none was admitted at all, e.g. the only local model's breaker is
 * open). A dropped line always says so; it never ends on a bare arrow.
 */
export type LogKind = "ok" | "fallback" | "dropped";

export function logKind(failedCount: number, served: boolean): LogKind {
  if (!served) return "dropped";
  return failedCount > 0 ? "fallback" : "ok";
}
