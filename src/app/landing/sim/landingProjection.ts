/**
 * The 3D projection shared by the hero's gyro-compass and the Afghanistan map.
 *
 * Pure maths, no React and no DOM, and allocation-free on the per-frame path:
 * a camera is built (or refreshed) once per frame with its sines and cosines
 * precomputed, and `project3` writes into a caller-owned typed array. Canvas
 * renderers keep one Float32Array pool per layer and never allocate inside the
 * draw loop.
 *
 * Two conventions, chosen by `up`:
 *
 * - `"z"` (ground, the default — the map): world x points east, y points
 *   south (down the screen), z points up out of the ground. At pitch 0 the
 *   camera looks straight down, so yaw 0 / pitch 0 reproduces `project()` from
 *   `landingGeometry.ts` exactly (pinned by `tests/unit/landing-projection.test.ts`).
 *   Yaw spins the ground about z; pitch tilts its northern edge away.
 * - `"y"` (globe — the gyro): world y points up the screen, z towards the
 *   viewer. Yaw spins the shell about y; pitch tips the north pole towards the
 *   viewer.
 *
 * In both, rotation order is yaw then pitch, depth is the distance behind the
 * screen plane (`-z` after rotation), and perspective is `s = F / (F + depth)`,
 * the same `F/(F − p.z)` the gyro spec states. `F = Infinity` gives an
 * orthographic view.
 */
import { arcControl, type Point } from "../landingGeometry";

export type Vec3 = Float64Array;

export function vec3(x = 0, y = 0, z = 0): Vec3 {
  const v = new Float64Array(3);
  v[0] = x;
  v[1] = y;
  v[2] = z;
  return v;
}

/** Rotate about x: y' = y·cos − z·sin, z' = y·sin + z·cos. `out` may be `v`. */
export function rotX(out: Vec3, v: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const x = v[0];
  const y = v[1];
  const z = v[2];
  out[0] = x;
  out[1] = y * c - z * s;
  out[2] = y * s + z * c;
  return out;
}

/** Rotate about y: x' = x·cos + z·sin, z' = −x·sin + z·cos. `out` may be `v`. */
export function rotY(out: Vec3, v: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const x = v[0];
  const y = v[1];
  const z = v[2];
  out[0] = x * c + z * s;
  out[1] = y;
  out[2] = -x * s + z * c;
  return out;
}

/** Rotate about z: x' = x·cos − y·sin, y' = x·sin + y·cos. `out` may be `v`. */
export function rotZ(out: Vec3, v: Vec3, rad: number): Vec3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  const x = v[0];
  const y = v[1];
  const z = v[2];
  out[0] = x * c - y * s;
  out[1] = x * s + y * c;
  out[2] = z;
  return out;
}

export type CameraUp = "z" | "y";

export type CameraInput = {
  /** Radians about the up axis. */
  yaw: number;
  /** Radians about the screen's x axis. */
  pitch: number;
  /** Perspective distance in world units; Infinity for orthographic. */
  F: number;
  /** Screen position of the world origin, in CSS or canvas pixels. */
  cx: number;
  cy: number;
  /** World units to pixels. */
  scale: number;
  up?: CameraUp;
};

export type Camera = {
  yaw: number;
  pitch: number;
  F: number;
  cx: number;
  cy: number;
  scale: number;
  up: CameraUp;
  sinYaw: number;
  cosYaw: number;
  sinPitch: number;
  cosPitch: number;
};

/** Build a camera; sines and cosines are computed here, once. */
export function makeCamera(input: CameraInput): Camera {
  return updateCamera(
    {
      yaw: 0,
      pitch: 0,
      F: Infinity,
      cx: 0,
      cy: 0,
      scale: 1,
      up: "z",
      sinYaw: 0,
      cosYaw: 1,
      sinPitch: 0,
      cosPitch: 1,
    },
    input
  );
}

/** Refresh an existing camera in place: the per-frame, allocation-free form of `makeCamera`. */
export function updateCamera(cam: Camera, input: CameraInput): Camera {
  cam.yaw = input.yaw;
  cam.pitch = input.pitch;
  cam.F = input.F;
  cam.cx = input.cx;
  cam.cy = input.cy;
  cam.scale = input.scale;
  cam.up = input.up ?? "z";
  cam.sinYaw = Math.sin(input.yaw);
  cam.cosYaw = Math.cos(input.yaw);
  cam.sinPitch = Math.sin(input.pitch);
  cam.cosPitch = Math.cos(input.pitch);
  return cam;
}

/** Floats `project3` writes per point: sx, sy, s, depth. */
export const PROJECTED_STRIDE = 4;

/**
 * Project one world point. Writes `sx, sy, s, depth` at `out[offset..offset+3]`
 * and returns `s`. Allocates nothing. `depth > 0` is behind the screen plane:
 * for the globe that is the back hemisphere.
 */
export function project3(
  cam: Camera,
  x: number,
  y: number,
  z: number,
  out: Float32Array,
  offset: number
): number {
  let x1: number;
  let y1: number;
  let z1: number;
  if (cam.up === "z") {
    // Yaw spins the ground about its own up axis.
    x1 = x * cam.cosYaw - y * cam.sinYaw;
    y1 = x * cam.sinYaw + y * cam.cosYaw;
    z1 = z;
  } else {
    // Yaw spins the globe about the screen's vertical.
    x1 = x * cam.cosYaw + z * cam.sinYaw;
    y1 = y;
    z1 = -x * cam.sinYaw + z * cam.cosYaw;
  }
  const y2 = y1 * cam.cosPitch - z1 * cam.sinPitch;
  const z2 = y1 * cam.sinPitch + z1 * cam.cosPitch;
  const depth = -z2;
  const s = cam.F === Infinity ? 1 : cam.F / (cam.F + depth);
  const k = s * cam.scale;
  out[offset] = cam.cx + x1 * k;
  // Ground y already grows down the screen; globe y grows up it.
  out[offset + 1] = cam.up === "z" ? cam.cy + y2 * k : cam.cy - y2 * k;
  out[offset + 2] = s;
  out[offset + 3] = depth;
  return s;
}

/**
 * `n` unit vectors spread evenly over a sphere (golden-angle spiral), as a
 * flat xyz Float32Array. Index 0 is nearest the north pole (+y).
 */
export function fibonacciSphere(n: number): Float32Array {
  const count = Math.max(0, Math.floor(n));
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const y = 1 - (2 * (i + 0.5)) / count;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = i * 2.399963;
    out[i * 3] = Math.cos(theta) * r;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = Math.sin(theta) * r;
  }
  return out;
}

/**
 * Project a ring of radius `R` into `out` as `segments + 1` points (closed: the
 * last repeats the first), `PROJECTED_STRIDE` floats each. The ring lies in the
 * camera's ground/equatorial plane (perpendicular to `up`), tipped about the
 * world x axis by `rotation` radians before the camera's yaw and pitch — 0 is
 * the horizon ring, π/2 a meridian, 23.4° the ecliptic. `(ox, oy, oz)` moves
 * the centre (map ripples around a city). Returns the number of floats written.
 */
export function ringPolyline(
  cam: Camera,
  R: number,
  rotation: number,
  segments: number,
  out: Float32Array,
  ox = 0,
  oy = 0,
  oz = 0
): number {
  const n = Math.max(3, Math.floor(segments));
  const needed = (n + 1) * PROJECTED_STRIDE;
  if (out.length < needed) throw new RangeError(`ringPolyline: need ${needed} floats`);
  const cr = Math.cos(rotation);
  const sr = Math.sin(rotation);
  for (let i = 0; i <= n; i++) {
    const a = ((i % n) / n) * Math.PI * 2;
    const u = Math.cos(a) * R;
    const v = Math.sin(a) * R;
    let x: number;
    let y: number;
    let z: number;
    if (cam.up === "z") {
      // Ground plane is xy; tip about x moves y into z.
      x = u;
      y = v * cr;
      z = v * sr;
    } else {
      // Equatorial plane is xz; tip about x moves z into y.
      x = u;
      y = -v * sr;
      z = v * cr;
    }
    project3(cam, x + ox, y + oy, z + oz, out, i * PROJECTED_STRIDE);
  }
  return needed;
}

/** A flight arc: the 2D bulged chord of `arcControl`, lifted into a parabola. */
export type Arc3 = {
  ax: number;
  ay: number;
  qx: number;
  qy: number;
  bx: number;
  by: number;
  /** Apex height (world z at t = .5). */
  apex: number;
  chord: number;
};

/**
 * Lift a 2D flight arc (`arcControl` + `quadraticPoint` in `landingGeometry.ts`)
 * into 3D: the ground track is the same quadratic, and z rises in a parabola
 * to `apexRatio × chord` at the midpoint. Built once per flight; sample it with
 * `arcPoint3` in the loop.
 */
export function liftArc(from: Point, to: Point, apexRatio: number, bulge = 0.28): Arc3 {
  const control = arcControl(from, to, bulge);
  const chord = Math.hypot(to.x - from.x, to.y - from.y);
  return {
    ax: from.x,
    ay: from.y,
    qx: control.x,
    qy: control.y,
    bx: to.x,
    by: to.y,
    apex: apexRatio * chord,
    chord,
  };
}

/** Write the arc's point at `t ∈ [0, 1]` into `out` (x, y, z). Allocates nothing. */
export function arcPoint3(arc: Arc3, t: number, out: Vec3): Vec3 {
  const u = 1 - t;
  out[0] = u * u * arc.ax + 2 * u * t * arc.qx + t * t * arc.bx;
  out[1] = u * u * arc.ay + 2 * u * t * arc.qy + t * t * arc.by;
  out[2] = 4 * arc.apex * t * u;
  return out;
}
