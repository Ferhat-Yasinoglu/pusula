"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { nearestEquivalentAngle, round2, type SpringState } from "../../landingGeometry";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { NEEDLE, stepSpring } from "../../runtime/springs";
import { useDomLoop } from "../../runtime/useDomLoop";
import { cx, phaseOf, tremorAt } from "./primitiveKit";
import "./primitives.css";

/**
 * A compass needle: ember north half, gold tail, gold pivot. Every section
 * kicker carries one at its station's bearing; the nav logo and the footer
 * compass follow an external angle through `angleRef`.
 *
 * Motion runs on the heartbeat's `dom` lane (`useDomLoop`) and only while the
 * needle is on screen: the `NEEDLE` spring (k 70, ζ .42) towards the target
 * plus a ±0.7° tremor. Each frame writes `transform="rotate(a cx cy)"` with
 * an explicit pivot, exactly like `needleTransform` in `landingGeometry.ts`,
 * so the needle can never swing off its axis.
 *
 * The needle always takes the short way round (350° → 10° is +20°), which
 * also keeps continuous inputs (a 0..360 heading, an atan2 angle) from
 * jumping at the wrap. A full spin is made by feeding `angleRef` a steadily
 * increasing angle.
 *
 * The server renders the final bearing. Under reduced motion or Pause the
 * needle is static and settled on its target.
 */

export type NeedleProps = {
  /** Target bearing in compass degrees (0 = north, clockwise). Ignored when `angleRef` is given. */
  bearing?: number;
  /** Rendered size in px (the needle is square). */
  size: number;
  /** Ease to the target on the NEEDLE spring (default) or follow it exactly. */
  spring?: boolean;
  /** ±0.7° shiver while on screen (default true). */
  tremor?: boolean;
  /** Start 90° short of the bearing and swing in each time the needle scrolls into view. */
  swingOnView?: boolean;
  /** Follow an external angle (degrees) that changes outside React. */
  angleRef?: MutableRefObject<number>;
  className?: string;
};

/** Drawing box; the needle pivots on its centre. */
const VIEW = 32;
const C = VIEW / 2;

function needleTransformAt(angle: number): string {
  return `rotate(${round2(angle)} ${C} ${C})`;
}

const HAS_INTERSECTION_OBSERVER = typeof IntersectionObserver !== "undefined";
/** Share of the needle that must be visible before it swings in. */
const SWING_VISIBLE_RATIO = 0.6;

export default function Needle({
  bearing = 0,
  size,
  spring = true,
  tremor = true,
  swingOnView = false,
  angleRef,
  className,
}: NeedleProps) {
  const id = useId();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;

  // The attribute React renders is frozen at the first bearing; from then on
  // only the loop (or `settle`) writes it, so a new bearing springs instead of
  // jumping.
  const [initialBearing] = useState(bearing);
  const svgRef = useRef<SVGSVGElement>(null);
  const cardRef = useRef<SVGGElement>(null);
  const stateRef = useRef<SpringState>({ angle: bearing, velocity: 0 });
  const writtenRef = useRef(round2(bearing));
  const bearingRef = useRef(bearing);
  /** Has the needle been armed at least once (swingOnView)? */
  const armedOnceRef = useRef(false);
  const [onScreen, setOnScreen] = useState(false);
  const phase = useMemo(() => phaseOf(id), [id]);

  useEffect(() => {
    bearingRef.current = bearing;
  }, [bearing]);

  const write = useCallback((angle: number) => {
    const rounded = round2(angle);
    if (rounded === writtenRef.current) return;
    writtenRef.current = rounded;
    cardRef.current?.setAttribute("transform", needleTransformAt(rounded));
  }, []);

  const target = useCallback(() => (angleRef ? angleRef.current : bearingRef.current), [angleRef]);

  /** Park the needle 90° short of its bearing, ready to swing in (only while hidden). */
  const arm = useCallback(() => {
    const state = stateRef.current;
    state.angle = bearingRef.current - 90;
    state.velocity = 0;
    write(state.angle);
  }, [write]);

  /** Put the needle on its target at once (reduced motion, Pause). */
  const settle = useCallback(() => {
    const state = stateRef.current;
    state.angle = nearestEquivalentAngle(state.angle, target());
    state.velocity = 0;
    write(state.angle);
  }, [target, write]);

  // Visibility: one observer drives both the loop gate and the swing-in.
  useEffect(() => {
    const node = svgRef.current;
    if (!node || !HAS_INTERSECTION_OBSERVER) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[entries.length - 1];
        if (!entry) return;
        if (!entry.isIntersecting) {
          setOnScreen(false);
          // Off screen again: re-arm so the next arrival swings in too.
          if (swingOnView && canAnimate()) arm();
          return;
        }
        if (!swingOnView || entry.intersectionRatio >= SWING_VISIBLE_RATIO) setOnScreen(true);
      },
      { threshold: swingOnView ? [0, SWING_VISIBLE_RATIO] : 0 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [swingOnView, arm]);

  // First arming happens once, on mount, while motion is allowed.
  useEffect(() => {
    if (!swingOnView || !motion || armedOnceRef.current) return;
    armedOnceRef.current = true;
    arm();
  }, [swingOnView, motion, arm]);

  // Reduced motion or Pause: no loop, the needle simply points at its target.
  useEffect(() => {
    if (!motion) settle();
  }, [motion, bearing, settle]);

  const tick = useCallback(
    (dt: number, now: number) => {
      const state = stateRef.current;
      const aim = nearestEquivalentAngle(state.angle, target());
      if (spring) {
        stepSpring(state, aim, dt, NEEDLE);
      } else {
        state.angle = aim;
        state.velocity = 0;
      }
      write(tremor ? state.angle + tremorAt(now / 1000, phase) : state.angle);
    },
    [spring, tremor, phase, target, write]
  );

  useDomLoop(`needle${id}`, tick, {
    enabled: motion && (HAS_INTERSECTION_OBSERVER ? onScreen : true),
  });

  return (
    <svg
      ref={svgRef}
      className={cx("needle", className)}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      aria-hidden="true"
      focusable="false"
    >
      <g ref={cardRef} transform={needleTransformAt(initialBearing)}>
        {/* North half, split into a lit and a shaded facet. */}
        <path className="needle-n" d="M16 2.5L16 16L13.6 16Z" />
        <path className="needle-n-shade" d="M16 2.5L18.4 16L16 16Z" />
        {/* Tail. */}
        <path className="needle-s" d="M13.6 16L16 16L16 29.5Z" />
        <path className="needle-s-shade" d="M16 16L18.4 16L16 29.5Z" />
      </g>
      <circle className="needle-pivot" cx={C} cy={C} r="2.6" />
      <circle className="needle-pin" cx={C} cy={C} r="0.95" />
    </svg>
  );
}
