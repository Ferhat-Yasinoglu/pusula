"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { RTL_LOCALES } from "@/i18n/config";
import { useDisplayBaseUrl } from "@/shared/hooks";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { INSTALL_COMMAND, type LandingStats } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { canAnimate, usePaused } from "../../runtime/heartbeat";
import { useDomLoop } from "../../runtime/useDomLoop";
import {
  Glyph,
  MagneticButton,
  Needle,
  Station,
  Terminal,
  WordReveal,
  type TerminalHandle,
  type TypeLineProps,
} from "../primitives";
import { numberFormat, watchView } from "../primitives/primitiveKit";
import DashboardMonitor from "./DashboardMonitor";
import { cleanId, useMediaMatch } from "./launchDom";
import {
  BEAD_MS,
  COOL_MS,
  COPIED_MS,
  FUSE_STRIDE,
  LINE_MS,
  SPARK_MS,
  SPIN_MS,
  beadOpacity,
  aimPoint,
  beadProgress,
  bearingBetween,
  buildFuse,
  clamp01,
  cpsFor,
  DEFAULT_AIM,
  dialTicks,
  fuseWaypoints,
  glintAt,
  legProgress,
  nodeThresholds,
  sparkIndex,
  spinOffset,
  type Fuse,
  type FuseLayout,
  type FuseLeg,
  type FusePoint,
} from "./launchModel";
import "./launch.css";

/**
 * Station NW, 315°: the dashboard monitor and the launch (spec §6.9). Two
 * H2s: "A dashboard, not a YAML file" (the station title) and "Up in three
 * steps" (rendered here, inside the station body).
 *
 * Part A, the monitor. The real dashboard screenshot sits in a thick bezel
 * under CSS perspective. It tilts from rotateX(14°) rotateY(−6°) to
 * rotateX(4°) as it crosses the viewport (traverse `--p`), powers on like a
 * CRT the first time it is seen (the screen layer opens from scaleY(.004)
 * with a fading bloom), then the self-test rows type in once the list itself
 * is in view: 300ms each beside the monitor, faster when stacked under it (all
 * four within ~600ms). Idle, a scan bar crosses the screen every 6s while the
 * monitor is near the middle of the viewport, and the three hotspots light in
 * sequence every 1.6s, each pulsing once and lighting its self-test row. (No
 * endless loop runs inside the tilted 3D frame: each one there kept the
 * compositor redrawing it every frame.) Hovering, focusing or
 * tapping a hotspot or a row holds the pair lit for 6s (and, on desktop,
 * opens that row's description).
 *
 * Part B, the launch. Three step tiles joined by a fuse (an SVG path built
 * from the measured layout: along the step nodes, then into the terminal on
 * desktop, or down the inline-start edge into the capsule on a phone). A
 * shimmer runs along it every 6s. "Copy and launch" copies `npx pusula`;
 * then an ember spark burns along the fuse in 1.2s (a lookup table of
 * arc-length points), ticking each step as it passes, the terminal prints
 * its lines 250ms apart, and the final compass spins once and locks back on
 * the "Open dashboard" button, which its needle always points at (an atan2
 * between the two rects, re-measured on resize and on view). Hovering Docs
 * swings the needle there.
 *
 * Every loop runs on the heartbeat's dom lane (`useDomLoop`), only while
 * needed; reduced motion and Pause show a flat monitor, every row, hotspot
 * and terminal line, and resolve the launch at once.
 */
export default function MonitorLaunch({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  // The station shows the real screenshot and the install flow; nothing here
  // reads the gateway figures.
  void stats;
  return (
    <Station id="launch" title={t("dashboardTitle")} lead={t("dashboardLead")} className="lx">
      <DashboardMonitor />
      <LaunchDeck />
    </Station>
  );
}

/* ------------------------------------------------------------------------ */
/* Part B: steps, fuse, ignition capsule, terminal, final compass            */
/* ------------------------------------------------------------------------ */

/** Where the fuse turns down into the terminal, from its inline-end edge. */
const DROP_INSET = 34;
const FUSE_RADIUS = 18;
/** Phone: the terminal's address lines drop their indent to fit the narrow card. */
const PHONE_QUERY = "(max-width: 639px)";
/** Trailing embers behind the launch spark, and how many LUT steps apart they ride. */
const TRAIL = 3;
const TRAIL_GAP = 3;
/** Trailing dots behind the idle bead, and their LUT spacing. */
const BEAD_TRAIL = 2;
const BEAD_GAP = 2;
/** "Copy blocked" stays on the launch button this long. */
const BLOCKED_MS = 3200;
/** Marker swapped for the base URL so it can be set in mono inside the sentence. */
const URL_MARK = "⁣URL⁣";
const TICKS = dialTicks();

type FuseGeom = {
  d: string;
  w: number;
  h: number;
  mode: FuseLayout["mode"];
  legs: FuseLeg[];
};

type BurnState = { t: number; ticked: number; landed: boolean };
type BeadState = { t: number; live: boolean; glint: Float32Array };
type CopyState = "idle" | "copied" | "blocked";

/**
 * One "label  url" terminal line: indent, label, padding, URL. `padTo` pads
 * the label to that many characters (mono locales); 0 leaves a plain gap
 * (RTL, where CSS gives the label its width).
 */
/**
 * One address line: indent, label (always token 2), padding, URL. On a phone
 * (`narrow`) the indent goes and the gap is one space, so the longest line
 * ("Dashboard http://localhost:20128/dashboard") fits a 375px card unscrolled.
 */
function termLine(
  id: string,
  label: string,
  url: string,
  padTo: number,
  caret: boolean,
  narrow = false
): TypeLineProps {
  const indent = narrow ? "" : "  ";
  const gap = " ".repeat(Math.max(0, padTo - label.length) + (narrow ? 1 : 2));
  const tokens = [{ t: indent }, { t: label }, { t: gap }, { t: url, c: "num" as const }];
  const text = `${indent}${label}${gap}${url}`;
  return { id, text, tokens, cps: cpsFor(text.length, LINE_MS), caret };
}

function isRtlLocale(locale: string): boolean {
  return (RTL_LOCALES as readonly string[]).includes(locale);
}

function legTransform(leg: FuseLeg, p: number): string {
  return `translate(${leg.x.toFixed(2)} ${leg.y.toFixed(2)}) rotate(${leg.angle}) scale(${p.toFixed(4)} 1)`;
}

function center(rect: DOMRect, box: DOMRect): FusePoint {
  return { x: rect.left + rect.width / 2 - box.left, y: rect.top + rect.height / 2 - box.top };
}

function LaunchDeck() {
  const t = useTranslations("landing");
  const blockedLabel = t("launchCopyBlocked");
  const locale = useLocale();
  const baseUrl = useDisplayBaseUrl();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;
  const uid = cleanId(useId());
  const rtl = isRtlLocale(locale);
  const fmt = numberFormat(locale);

  /* ---- fuse ------------------------------------------------------------ */
  const rigRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const stepRefs = useRef<(HTMLLIElement | null)[]>([]);
  const capsuleRef = useRef<HTMLDivElement>(null);
  const termWrapRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<TerminalHandle>(null);
  const sparkRef = useRef<SVGGElement>(null);
  const trailRefs = useRef<(SVGCircleElement | null)[]>([]);
  const burnRefs = useRef<(SVGRectElement | null)[]>([]);
  const fuseRef = useRef<{ fuse: Fuse; thresholds: number[] } | null>(null);
  const [geom, setGeom] = useState<FuseGeom | null>(null);

  const measureFuse = useCallback(() => {
    const rig = rigRef.current;
    if (!rig) return;
    const box = rig.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const nodes: FusePoint[] = [];
    for (const node of nodeRefs.current) {
      if (!node) return;
      nodes.push(center(node.getBoundingClientRect(), box));
    }
    if (nodes.length < 2) return;
    const start = nodes[0];
    const last = nodes[nodes.length - 1];
    const row = Math.abs(last.y - start.y) < 4;
    const reverse = last.x < start.x - 4;
    let layout: FuseLayout;
    if (row) {
      const term = termWrapRef.current?.getBoundingClientRect();
      if (!term) return;
      const dropX = reverse
        ? term.left - box.left + DROP_INSET
        : term.right - box.left - DROP_INSET;
      layout = { mode: "row", start, dropX, endY: term.top - box.top + 1 };
    } else {
      const capsule = capsuleRef.current?.getBoundingClientRect();
      if (!capsule) return;
      layout = { mode: "column", start, endY: capsule.top - box.top + 2 };
    }
    const fuse = buildFuse(fuseWaypoints(layout), FUSE_RADIUS);
    fuseRef.current = { fuse, thresholds: nodeThresholds(start, nodes, fuse) };
    setGeom({
      d: fuse.d,
      w: Math.round(box.width),
      h: Math.round(box.height),
      mode: layout.mode,
      legs: fuse.legs,
    });
  }, []);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig) return;
    measureFuse();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", measureFuse);
      return () => window.removeEventListener("resize", measureFuse);
    }
    const observer = new ResizeObserver(() => measureFuse());
    observer.observe(rig);
    if (capsuleRef.current) observer.observe(capsuleRef.current);
    if (termWrapRef.current) observer.observe(termWrapRef.current);
    return () => observer.disconnect();
  }, [measureFuse]);

  /* ---- final compass ---------------------------------------------------- */
  const finalRef = useRef<HTMLDivElement>(null);
  const compassRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLElement>(null);
  const docsRef = useRef<HTMLElement>(null);
  const initialAim: number = rtl ? DEFAULT_AIM.rtl : DEFAULT_AIM.ltr;
  const aimsRef = useRef({ cta: initialAim, docs: initialAim, onDocs: false });
  /** What the needle follows: the aim, plus the spin offset during a launch. */
  const angleRef = useRef(initialAim);
  const [aimDeg, setAimDeg] = useState(initialAim);
  const burningRef = useRef(false);

  const currentAim = useCallback(() => {
    const aims = aimsRef.current;
    return aims.onDocs ? aims.docs : aims.cta;
  }, []);

  const applyAim = useCallback(() => {
    const aim = currentAim();
    if (!burningRef.current) angleRef.current = aim;
    setAimDeg(Math.round(aim));
  }, [currentAim]);

  const measureAim = useCallback(() => {
    const compass = compassRef.current?.getBoundingClientRect();
    const cta = ctaRef.current?.getBoundingClientRect();
    if (!compass || !cta || compass.width === 0 || cta.width === 0) return;
    aimsRef.current.cta = bearingBetween(compass, aimPoint(compass, cta));
    const docs = docsRef.current?.getBoundingClientRect();
    if (docs && docs.width > 0) {
      aimsRef.current.docs = bearingBetween(compass, aimPoint(compass, docs));
    }
    applyAim();
  }, [applyAim]);

  useEffect(() => {
    const node = finalRef.current;
    if (!node) return;
    measureAim();
    const stopView = watchView(node, { onEnter: measureAim });
    const observer =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => measureAim()) : null;
    observer?.observe(node);
    window.addEventListener("resize", measureAim);
    return () => {
      stopView();
      observer?.disconnect();
      window.removeEventListener("resize", measureAim);
    };
  }, [measureAim]);

  const aimAtDocs = useCallback(
    (on: boolean) => {
      aimsRef.current.onDocs = on;
      applyAim();
    },
    [applyAim]
  );

  /* ---- launch ----------------------------------------------------------- */
  const [burning, setBurning] = useState(false);
  const burnRef = useRef<BurnState>({ t: 0, ticked: 0, landed: false });
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const copyTimer = useRef(0);
  const coolTimer = useRef(0);
  const cmdTextRef = useRef<HTMLSpanElement>(null);

  useEffect(
    () => () => {
      window.clearTimeout(copyTimer.current);
      window.clearTimeout(coolTimer.current);
    },
    []
  );

  const writeBurn = useCallback((p: number) => {
    const geo = fuseRef.current;
    if (!geo) return;
    const { fuse } = geo;
    fuse.legs.forEach((leg, i) => {
      burnRefs.current[i]?.setAttribute("transform", legTransform(leg, legProgress(leg, p)));
    });
    const index = sparkIndex(p, fuse.samples);
    const x = fuse.lut[index * FUSE_STRIDE];
    const y = fuse.lut[index * FUSE_STRIDE + 1];
    sparkRef.current?.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
    for (let k = 0; k < TRAIL; k++) {
      const back = Math.max(0, index - (k + 1) * TRAIL_GAP);
      const tx = fuse.lut[back * FUSE_STRIDE];
      const ty = fuse.lut[back * FUSE_STRIDE + 1];
      trailRefs.current[k]?.setAttribute(
        "transform",
        `translate(${tx.toFixed(2)} ${ty.toFixed(2)})`
      );
    }
  }, []);

  const tickSteps = useCallback((upTo: number) => {
    for (let i = 0; i < upTo; i++) stepRefs.current[i]?.setAttribute("data-ok", "");
  }, []);

  const scheduleCool = useCallback(() => {
    window.clearTimeout(coolTimer.current);
    coolTimer.current = window.setTimeout(() => {
      rigRef.current?.removeAttribute("data-burn");
    }, COOL_MS);
  }, []);

  /** Resolve a launch at once (reduced motion, Pause, or no fuse yet). */
  const landNow = useCallback(() => {
    burningRef.current = false;
    setBurning(false);
    writeBurn(1);
    tickSteps(stepRefs.current.length);
    rigRef.current?.setAttribute("data-burn", "done");
    termRef.current?.replay();
    angleRef.current = currentAim();
    scheduleCool();
  }, [writeBurn, tickSteps, currentAim, scheduleCool]);

  const startBurn = useCallback(() => {
    window.clearTimeout(coolTimer.current);
    for (const step of stepRefs.current) step?.removeAttribute("data-ok");
    if (!canAnimate() || !fuseRef.current) {
      landNow();
      return;
    }
    burnRef.current = { t: 0, ticked: 0, landed: false };
    burningRef.current = true;
    writeBurn(0);
    rigRef.current?.setAttribute("data-burn", "run");
    setBurning(true);
  }, [landNow, writeBurn]);

  const burnTick = useCallback(
    (dt: number) => {
      const burn = burnRef.current;
      burn.t += dt * 1000;
      const geo = fuseRef.current;
      const p = clamp01(burn.t / SPARK_MS);
      if (geo) {
        writeBurn(p);
        while (burn.ticked < geo.thresholds.length && p >= geo.thresholds[burn.ticked]) {
          stepRefs.current[burn.ticked]?.setAttribute("data-ok", "");
          burn.ticked++;
        }
      }
      if (!burn.landed && burn.t >= SPARK_MS) {
        burn.landed = true;
        tickSteps(stepRefs.current.length);
        rigRef.current?.setAttribute("data-burn", "done");
        termRef.current?.replay();
      }
      if (!burn.landed) return;
      const spun = burn.t - SPARK_MS;
      if (spun < SPIN_MS) {
        angleRef.current = currentAim() + spinOffset(spun);
        return;
      }
      angleRef.current = currentAim();
      burningRef.current = false;
      setBurning(false);
      scheduleCool();
    },
    [writeBurn, tickSteps, currentAim, scheduleCool]
  );

  useDomLoop("launch-burn", burnTick, { enabled: burning && motion });

  // Reduced motion or Pause in the middle of a launch: finish it now.
  useEffect(() => {
    if (!motion && burningRef.current) landNow();
  }, [motion, landNow]);

  /** Select the command in the capsule, so a blocked copy can be done by hand. */
  const selectCommand = useCallback(() => {
    const node = cmdTextRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    if (!node || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    selection.removeAllRanges();
    selection.addRange(range);
  }, []);

  const onLaunch = useCallback(() => {
    void copyToClipboard(INSTALL_COMMAND).then((ok) => {
      window.clearTimeout(copyTimer.current);
      if (!ok) {
        // Nothing was copied, so nothing launches: the command is selected
        // instead and the capsule shows the failure (ember, dashed).
        selectCommand();
        setCopyState("blocked");
        copyTimer.current = window.setTimeout(() => setCopyState("idle"), BLOCKED_MS);
        return;
      }
      setCopyState("copied");
      startBurn();
      copyTimer.current = window.setTimeout(() => setCopyState("idle"), COPIED_MS);
    });
  }, [startBurn, selectCommand]);

  /* ---- idle bead: a pilot spark runs the fuse every 6s ------------------- */
  const beadRef = useRef<HTMLSpanElement>(null);
  const beadDotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const glintRefs = useRef<(HTMLSpanElement | null)[]>([]);
  // The first run starts 1.4s after the rig comes into view.
  const beadState = useRef<BeadState>({
    t: BEAD_MS - 1400,
    live: false,
    glint: new Float32Array(3),
  });

  const hideBead = useCallback(() => {
    const bead = beadState.current;
    bead.live = false;
    if (beadRef.current) beadRef.current.style.opacity = "0";
    for (let i = 0; i < bead.glint.length; i++) {
      bead.glint[i] = 0;
      const glint = glintRefs.current[i];
      if (glint) glint.style.opacity = "0";
    }
  }, []);

  const beadTick = useCallback(
    (dt: number) => {
      const bead = beadState.current;
      bead.t = (bead.t + dt * 1000) % BEAD_MS;
      const geo = fuseRef.current;
      const p = geo ? beadProgress(bead.t) : -1;
      if (!geo || p < 0) {
        if (bead.live) hideBead();
        return;
      }
      bead.live = true;
      const { fuse, thresholds } = geo;
      const index = sparkIndex(p, fuse.samples);
      for (let k = 0; k <= BEAD_TRAIL; k++) {
        const at = Math.max(0, index - k * BEAD_GAP) * FUSE_STRIDE;
        const dot = beadDotRefs.current[k];
        if (dot) {
          dot.style.transform = `translate3d(${fuse.lut[at].toFixed(1)}px, ${fuse.lut[at + 1].toFixed(1)}px, 0)`;
        }
      }
      if (beadRef.current) beadRef.current.style.opacity = beadOpacity(p).toFixed(3);
      for (let i = 0; i < thresholds.length && i < bead.glint.length; i++) {
        const glow = glintAt(p, thresholds[i]);
        const prev = bead.glint[i];
        if (glow === prev || (glow > 0 && Math.abs(glow - prev) < 0.01)) continue;
        bead.glint[i] = glow;
        const glint = glintRefs.current[i];
        if (glint) glint.style.opacity = glow.toFixed(3);
      }
    },
    [hideBead]
  );

  const beadOn = motion && !burning && geom !== null;
  useDomLoop("launch-bead", beadTick, { target: rigRef, enabled: beadOn });

  useEffect(() => {
    if (!beadOn) hideBead();
  }, [beadOn, hideBead]);

  /* ---- content ---------------------------------------------------------- */
  const apiUrl = `${baseUrl}/v1`;
  const dashboardUrl = `${baseUrl}/dashboard`;

  const running = t("startRunning");
  const api = t("startApi");
  const dash = t("startDashboard");
  // Every line keeps its message in token 2, so CSS can set it apart: in an
  // RTL locale that token is an isolated right-to-left run in the sans face
  // (no bidi control characters end up in the copied text), and the labels
  // get a fixed width there so the URLs still line up.
  const labelWidth = Math.max(api.length, dash.length);
  const narrow = useMediaMatch(PHONE_QUERY);
  const termLines = useMemo<TypeLineProps[]>(
    () => [
      {
        id: "running",
        text: `● ${running}`,
        tokens: [{ t: "● ", c: "accent" }, { t: running }],
        cps: cpsFor(running.length + 2, LINE_MS),
      },
      termLine("api", api, apiUrl, rtl ? 0 : labelWidth, false, narrow),
      termLine("dashboard", dash, dashboardUrl, rtl ? 0 : labelWidth, true, narrow),
    ],
    [running, api, dash, labelWidth, rtl, apiUrl, dashboardUrl, narrow]
  );

  const step3 = t("startStep3Desc", { url: URL_MARK }).split(URL_MARK);
  const steps: { title: string; desc: ReactNode }[] = [
    { title: t("startStep1Title"), desc: t("startStep1Desc") },
    { title: t("startStep2Title"), desc: t("startStep2Desc") },
    {
      title: t("startStep3Title"),
      desc: (
        <>
          {step3[0]}
          <code className="lx-url" dir="ltr">
            {apiUrl}
          </code>
          {step3.slice(1).join("")}
        </>
      ),
    },
  ];

  const cmdId = `lx-${uid}-cmd`;
  const labels: { state: CopyState; text: string }[] = [
    { state: "idle", text: t("launchCopy") },
    { state: "copied", text: t("copied") },
    { state: "blocked", text: blockedLabel },
  ];
  const announce =
    copyState === "copied" ? t("copied") : copyState === "blocked" ? blockedLabel : "";

  return (
    <section id="start" className="station-inner lx-b" aria-labelledby="launch-start-title">
      <div className="lx-course" aria-hidden="true">
        <Glyph name="star4" size={16} />
        <span className="lx-course-line" />
      </div>
      <div className="lx-b-head">
        <WordReveal
          as="h2"
          id="launch-start-title"
          className="station-title serif-display"
          lines={[t("startTitle")]}
        />
        <p className="station-lead">{t("startLead")}</p>
      </div>

      <div ref={rigRef} className="lx-rig">
        {geom ? (
          <svg
            className="lx-fuse"
            data-mode={geom.mode}
            width={geom.w}
            height={geom.h}
            viewBox={`0 0 ${geom.w} ${geom.h}`}
            aria-hidden="true"
            focusable="false"
          >
            <defs>
              <radialGradient id={`${uid}-glow`}>
                <stop offset="0" stopColor="#fff1c9" stopOpacity="0.95" />
                <stop offset="0.25" stopColor="#ff7a45" stopOpacity="0.75" />
                <stop offset="1" stopColor="#ff7a45" stopOpacity="0" />
              </radialGradient>
              <clipPath id={`${uid}-burn`}>
                {geom.legs.map((leg, i) => (
                  <rect
                    key={i}
                    ref={(node) => {
                      burnRefs.current[i] = node;
                    }}
                    x="0"
                    y="-9"
                    width={(leg.length + 9).toFixed(2)}
                    height="18"
                    transform={legTransform(leg, 0)}
                  />
                ))}
              </clipPath>
            </defs>
            <path className="lx-fuse-bed" d={geom.d} />
            <path className="lx-fuse-cord" d={geom.d} />
            <path className="lx-fuse-burnt" d={geom.d} clipPath={`url(#${uid}-burn)`} />
            {Array.from({ length: TRAIL }, (_, k) => (
              <circle
                key={k}
                ref={(node) => {
                  trailRefs.current[k] = node;
                }}
                className="lx-spark-trail"
                r={(2.6 - k * 0.6).toFixed(1)}
                opacity={(0.85 - k * 0.24).toFixed(2)}
                transform="translate(-60 -60)"
              />
            ))}
            <g ref={sparkRef} className="lx-spark" transform="translate(-60 -60)">
              <circle r="15" fill={`url(#${uid}-glow)`} />
              <circle className="lx-spark-core" r="3.2" />
            </g>
          </svg>
        ) : null}
        {/* The idle bead: plain HTML dots moved with transforms, so its run composites. */}
        <span ref={beadRef} className="lx-bead" aria-hidden="true">
          {Array.from({ length: BEAD_TRAIL + 1 }, (_, k) => (
            <span
              key={k}
              ref={(node) => {
                beadDotRefs.current[k] = node;
              }}
              className="lx-bead-dot"
              data-k={k}
            />
          ))}
        </span>

        <ol className="lx-steps">
          {steps.map((step, i) => (
            <li
              key={i}
              ref={(node) => {
                stepRefs.current[i] = node;
              }}
              className="lx-step"
            >
              <span
                ref={(node) => {
                  nodeRefs.current[i] = node;
                }}
                className="lx-node"
                aria-hidden="true"
              >
                <span className="lx-node-num">{fmt.format(i + 1)}</span>
                <span className="lx-node-ok">
                  <Glyph name="check" size={16} tone="current" />
                </span>
                <span
                  ref={(node) => {
                    glintRefs.current[i] = node;
                  }}
                  className="lx-node-glint"
                />
              </span>
              <h3 className="lx-step-title">{step.title}</h3>
              <p className="lx-step-desc">{step.desc}</p>
            </li>
          ))}
        </ol>

        <div className="lx-ignite">
          <div className="lx-capsule-wrap">
            <div
              ref={capsuleRef}
              className="lx-capsule"
              data-fail={copyState === "blocked" ? "" : undefined}
            >
              <code id={cmdId} className="lx-cmd" dir="ltr">
                <span className="lx-cmd-prompt" aria-hidden="true">
                  $
                </span>
                <span ref={cmdTextRef} className="lx-cmd-text">
                  {INSTALL_COMMAND}
                </span>
                <span className="lx-cmd-caret" aria-hidden="true" />
              </code>
              <MagneticButton
                variant="gold"
                icon={copyState === "copied" ? "check" : copyState === "blocked" ? "close" : "bolt"}
                onClick={onLaunch}
                className="lx-launch-btn"
                aria-describedby={cmdId}
              >
                {/* Every label in one cell: the button keeps the widest one's width. */}
                <span className="lx-swap">
                  {labels.map((label) => (
                    <span
                      key={label.state}
                      data-on={copyState === label.state ? "" : undefined}
                      aria-hidden={copyState === label.state ? undefined : true}
                    >
                      {label.text}
                    </span>
                  ))}
                </span>
              </MagneticButton>
              <span className="sr-only" aria-live="polite">
                {announce}
              </span>
            </div>
          </div>
          <div ref={termWrapRef} className="lx-term-wrap" data-rtl={rtl ? "" : undefined}>
            <Terminal
              ref={termRef}
              className="lx-term"
              title={t("startTerminal")}
              lines={termLines}
            />
          </div>
        </div>
      </div>

      <div ref={finalRef} className="lx-final">
        <p className="lx-final-line serif-display">{t("finalLine")}</p>
        <div ref={compassRef} className="lx-compass" dir="ltr" aria-hidden="true">
          <svg className="lx-dial" viewBox="0 0 120 120" focusable="false">
            <circle className="lx-dial-face" cx="60" cy="60" r="58.5" />
            <circle className="lx-dial-ring" cx="60" cy="60" r="42" />
            <path className="lx-dial-minor" d={TICKS.minor} />
            <path className="lx-dial-major" d={TICKS.major} />
            <path className="lx-dial-north" d="M60 0.5L63.4 7.5H56.6Z" />
          </svg>
          <Needle size={88} angleRef={angleRef} bearing={aimDeg} className="lx-compass-needle" />
        </div>
        <div className="lx-final-ctas" data-dock-avoid="">
          <MagneticButton
            ref={ctaRef}
            variant="gold"
            size="lg"
            href="/dashboard"
            icon="arrow"
            className="lx-final-cta"
          >
            {t("navOpenDashboard")}
          </MagneticButton>
          <MagneticButton
            ref={docsRef}
            variant="ghost"
            size="lg"
            href="/docs"
            className="lx-final-docs"
            onMouseEnter={() => aimAtDocs(true)}
            onMouseLeave={() => aimAtDocs(false)}
            onFocus={() => aimAtDocs(true)}
            onBlur={() => aimAtDocs(false)}
          >
            {t("navDocs")}
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
