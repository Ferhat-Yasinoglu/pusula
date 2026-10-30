/**
 * The landing page's named springs. Every spring-driven value on the page — the
 * compass needles, the heading tape, the rose's weight recall, the map camera,
 * small UI swings — uses one of these presets, so the same kind of motion
 * always settles the same way.
 *
 * All of them integrate with `springStep` from `landingGeometry.ts` (the
 * under-damped spring the old astrolabe needle used). `stepSpring` sub-steps a
 * long frame so a stiff spring stays stable at the heartbeat's 1/20 s clamp,
 * where a single `springStep` would only integrate its own 1/30 s cap.
 */
import { springStep, type SpringState } from "../landingGeometry";

export type { SpringState } from "../landingGeometry";

export type SpringConfig = {
  /** k: how hard the spring pulls towards its target. */
  readonly stiffness: number;
  /** ζ: 1 is critically damped (no overshoot); below 1 swings past and settles. */
  readonly damping: number;
};

/** Section needles and the hero compass: a quick swing, a small overshoot, rest. */
export const NEEDLE: SpringConfig = { stiffness: 70, damping: 0.42 };
/** The intro's needle locking north: softer, with about two visible overshoots. */
export const INTRO_NEEDLE: SpringConfig = { stiffness: 55, damping: 0.32 };
/** The nav's heading tape: firm and nearly critically damped, never wobbles. */
export const TAPE: SpringConfig = { stiffness: 120, damping: 0.9 };
/** The routing rose's motorised recall to the shipped weights. */
export const RECALL: SpringConfig = { stiffness: 180, damping: 0.8 };
/** The map camera's pitch and yaw: slow and critically damped. */
export const CAMERA: SpringConfig = { stiffness: 40, damping: 1 };
/** Small interface swings (menu needle, toggles). */
export const UI: SpringConfig = { stiffness: 180, damping: 0.7 };

export const SPRINGS = { NEEDLE, INTRO_NEEDLE, TAPE, RECALL, CAMERA, UI } as const;

/** Longest single integration step; `springStep` itself caps at 1/30 s. */
const MAX_SUBSTEP = 1 / 60;
/** Never integrate more than this per call: a resumed tab must not launch a needle. */
const MAX_DT = 1 / 20;

/**
 * Advance a spring by `dt` seconds towards `target`, in place. `dt` is clamped
 * to [0, 1/20] (the heartbeat's own clamp) and integrated in ≤ 1/60 s sub-steps.
 */
export function stepSpring(
  state: SpringState,
  target: number,
  dt: number,
  config: SpringConfig = NEEDLE
): SpringState {
  const total = Math.min(Math.max(dt, 0), MAX_DT);
  if (total === 0) return state;
  const steps = Math.ceil(total / MAX_SUBSTEP);
  const h = total / steps;
  let angle = state.angle;
  let velocity = state.velocity;
  for (let i = 0; i < steps; i++) {
    const next = springStep({ angle, velocity }, target, h, config.stiffness, config.damping);
    angle = next.angle;
    velocity = next.velocity;
  }
  state.angle = angle;
  state.velocity = velocity;
  return state;
}

/** At rest: within `epsilon` of the target and barely moving. */
export function isSettled(state: SpringState, target: number, epsilon = 0.05): boolean {
  return Math.abs(state.angle - target) < epsilon && Math.abs(state.velocity) < epsilon;
}

/** A spring at rest on `value`. */
export function springAt(value: number): SpringState {
  return { angle: value, velocity: 0 };
}
