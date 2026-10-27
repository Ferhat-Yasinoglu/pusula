/**
 * Pure geometry behind the landing page's two animated pieces — the astrolabe
 * in the hero and the route map. Kept free of React and of the DOM so the maths
 * can be unit-tested (`tests/unit/landing-geometry.test.ts`) and so every value
 * rendered on the server is byte-identical to the one the client hydrates.
 */

export type Point = { x: number; y: number };

/** Two decimals: identical strings on server and client, so hydration never disagrees. */
export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Bearing in compass degrees (0 = north, clockwise) to a point around a centre. */
export function polar(cx: number, cy: number, bearing: number, radius: number): Point {
  const rad = ((bearing - 90) * Math.PI) / 180;
  return { x: round2(cx + Math.cos(rad) * radius), y: round2(cy + Math.sin(rad) * radius) };
}

/* ------------------------------------------------------------------------ */
/* Astrolabe                                                                */
/* ------------------------------------------------------------------------ */

/** The dial's drawing box. The needle MUST pivot on (DIAL_CX, DIAL_CY). */
export const DIAL_WIDTH = 520;
export const DIAL_HEIGHT = 460;
export const DIAL_CX = DIAL_WIDTH / 2;
export const DIAL_CY = DIAL_HEIGHT / 2;

/**
 * SVG transform for the needle. The pivot is passed explicitly instead of
 * relying on CSS `transform-origin`: the previous instrument rotated around a
 * hard-coded origin that no longer matched the dial centre, so the needle
 * swung off-axis and pointed away from the provider it had chosen.
 */
export function needleTransform(angle: number): string {
  return `rotate(${round2(angle)} ${DIAL_CX} ${DIAL_CY})`;
}

/**
 * The bearing equivalent to `target` that is closest to `current`, so the
 * needle always takes the short way round (350° → 10° is +20°, not −340°).
 */
export function nearestEquivalentAngle(current: number, target: number): number {
  const delta = ((((target - current) % 360) + 540) % 360) - 180;
  return current + delta;
}

export type SpringState = { angle: number; velocity: number };

/**
 * One step of a slightly under-damped spring, which is how a real compass
 * card settles: a quick swing, a small overshoot, then rest. `dt` is in
 * seconds and clamped so a backgrounded tab cannot launch the needle.
 */
export function springStep(
  state: SpringState,
  target: number,
  dt: number,
  stiffness = 70,
  dampingRatio = 0.42
): SpringState {
  const step = Math.min(Math.max(dt, 0), 1 / 30);
  const damping = 2 * Math.sqrt(stiffness) * dampingRatio;
  const accel = -stiffness * (state.angle - target) - damping * state.velocity;
  const velocity = state.velocity + accel * step;
  return { angle: state.angle + velocity * step, velocity };
}

/* ------------------------------------------------------------------------ */
/* Route map                                                                */
/* ------------------------------------------------------------------------ */

/** Afghanistan's outline as [longitude, latitude] pairs (Natural Earth, 1:110m). */
export const AFGHANISTAN_BORDER: readonly (readonly [number, number])[] = [
  [61.21, 35.65],
  [62.23, 35.27],
  [62.98, 35.4],
  [63.19, 35.86],
  [63.98, 36.01],
  [64.55, 36.31],
  [64.75, 37.11],
  [65.59, 37.31],
  [65.75, 37.66],
  [66.22, 37.39],
  [66.52, 37.36],
  [67.08, 37.36],
  [67.83, 37.14],
  [68.14, 37.02],
  [68.86, 37.34],
  [69.2, 37.15],
  [69.52, 37.61],
  [70.12, 37.59],
  [70.27, 37.74],
  [70.38, 38.14],
  [70.81, 38.49],
  [71.35, 38.26],
  [71.24, 37.95],
  [71.54, 37.91],
  [71.45, 37.07],
  [71.84, 36.74],
  [72.19, 36.95],
  [72.64, 37.05],
  [73.26, 37.5],
  [73.95, 37.42],
  [74.98, 37.42],
  [75.16, 37.13],
  [74.58, 37.02],
  [74.07, 36.84],
  [72.92, 36.72],
  [71.85, 36.51],
  [71.26, 36.07],
  [71.5, 35.65],
  [71.61, 35.15],
  [71.12, 34.73],
  [71.16, 34.35],
  [70.88, 33.99],
  [69.93, 34.02],
  [70.32, 33.36],
  [69.69, 33.11],
  [69.26, 32.5],
  [69.32, 31.9],
  [68.93, 31.62],
  [68.56, 31.71],
  [67.79, 31.58],
  [67.68, 31.3],
  [66.94, 31.3],
  [66.38, 30.74],
  [66.35, 29.89],
  [65.05, 29.47],
  [64.35, 29.56],
  [64.15, 29.34],
  [63.55, 29.47],
  [62.55, 29.32],
  [60.87, 29.83],
  [61.78, 30.74],
  [61.7, 31.38],
  [60.94, 31.55],
  [60.86, 32.18],
  [60.54, 32.98],
  [60.96, 33.53],
  [60.53, 33.68],
  [60.8, 34.4],
];

export type CityId =
  | "kabul"
  | "herat"
  | "kandahar"
  | "mazar"
  | "kunduz"
  | "jalalabad"
  | "bamyan"
  | "ghazni"
  | "faizabad";

/** Where a city's label sits relative to its marker. */
export type LabelSide = "n" | "s" | "e" | "w";

export type City = {
  id: CityId;
  lon: number;
  lat: number;
  label: LabelSide;
  hub?: boolean;
};

export const CITIES: readonly City[] = [
  { id: "kabul", lon: 69.17, lat: 34.53, label: "s", hub: true },
  { id: "herat", lon: 62.2, lat: 34.35, label: "s" },
  { id: "kandahar", lon: 65.71, lat: 31.61, label: "e" },
  { id: "mazar", lon: 67.11, lat: 36.71, label: "w" },
  { id: "kunduz", lon: 68.86, lat: 36.73, label: "s" },
  { id: "jalalabad", lon: 70.45, lat: 34.43, label: "e" },
  { id: "bamyan", lon: 67.83, lat: 34.82, label: "w" },
  { id: "ghazni", lon: 68.42, lat: 33.55, label: "w" },
  { id: "faizabad", lon: 70.58, lat: 37.12, label: "e" },
];

const LON_MIN = 60.3;
const LON_MAX = 75.4;
const LAT_MIN = 29.1;
const LAT_MAX = 38.7;
/** Equirectangular projection, horizontally scaled by cos(mid-latitude). */
const LON_SCALE = Math.cos((((LAT_MIN + LAT_MAX) / 2) * Math.PI) / 180);
const MAP_SCALE = 62;
const MAP_PAD = 24;

export const MAP_WIDTH = Math.round((LON_MAX - LON_MIN) * LON_SCALE * MAP_SCALE + MAP_PAD * 2);
export const MAP_HEIGHT = Math.round((LAT_MAX - LAT_MIN) * MAP_SCALE + MAP_PAD * 2);

export function project(lon: number, lat: number): Point {
  return {
    x: round2(MAP_PAD + (lon - LON_MIN) * LON_SCALE * MAP_SCALE),
    y: round2(MAP_PAD + (LAT_MAX - lat) * MAP_SCALE),
  };
}

export const BORDER_POINTS: readonly Point[] = AFGHANISTAN_BORDER.map(([lon, lat]) =>
  project(lon, lat)
);

export const BORDER_PATH = `M ${BORDER_POINTS.map((p) => `${p.x} ${p.y}`).join(" L ")} Z`;

export const CITY_POINTS: Readonly<Record<CityId, Point>> = Object.fromEntries(
  CITIES.map((city) => [city.id, project(city.lon, city.lat)])
) as Record<CityId, Point>;

/** Even–odd ray cast. Points exactly on an edge may land either way. */
export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** Number of brightness bands the dot matrix is drawn in (one SVG path each). */
export const DOT_LEVELS = 5;

export type Dot = Point & { level: number };

/**
 * The dot-matrix fill: a regular grid clipped to the border, each dot assigned
 * a brightness band that rises near the cities so the map glows where the
 * traffic is.
 */
export function buildDotGrid(spacing: number): Dot[] {
  const dots: Dot[] = [];
  const cities = Object.values(CITY_POINTS);
  const sigma = spacing * 6;
  for (let y = spacing / 2; y < MAP_HEIGHT; y += spacing) {
    for (let x = spacing / 2; x < MAP_WIDTH; x += spacing) {
      const point = { x: round2(x), y: round2(y) };
      if (!pointInPolygon(point, BORDER_POINTS)) continue;
      let glow = 0;
      for (const city of cities) {
        const d2 = (city.x - point.x) ** 2 + (city.y - point.y) ** 2;
        glow = Math.max(glow, Math.exp(-d2 / (2 * sigma * sigma)));
      }
      dots.push({ ...point, level: Math.min(DOT_LEVELS - 1, Math.floor(glow * DOT_LEVELS)) });
    }
  }
  return dots;
}

/** All dots of one band as a single path of tiny circles — thousands of dots, five nodes. */
export function dotsPath(dots: readonly Dot[], radius: number): string {
  const r = round2(radius);
  const d = round2(radius * 2);
  return dots
    .map((dot) => `M${round2(dot.x - r)} ${dot.y}a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 ${-d} 0`)
    .join("");
}

/** Control point for a flight arc: the chord's midpoint pushed "up" by `bulge` × length. */
export function arcControl(from: Point, to: Point, bulge = 0.28): Point {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // Of the two normals, take the one that points up the screen.
  let nx = -dy / length;
  let ny = dx / length;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return { x: round2(mx + nx * length * bulge), y: round2(my + ny * length * bulge) };
}

export function quadraticPoint(from: Point, control: Point, to: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * from.x + 2 * u * t * control.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * control.y + t * t * to.y,
  };
}

export function arcPath(from: Point, to: Point, bulge?: number): string {
  const c = arcControl(from, to, bulge);
  return `M ${from.x} ${from.y} Q ${c.x} ${c.y} ${to.x} ${to.y}`;
}
