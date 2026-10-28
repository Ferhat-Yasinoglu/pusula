"use client";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type SyntheticEvent,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDisplayBaseUrl } from "@/shared/hooks";
import { HEADER, type LandingStats } from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { dispatch, getSeedWorld, getWorld } from "../../runtime/deckStore";
import { canAnimate, getQualityTier, usePaused } from "../../runtime/heartbeat";
import { useDomLoop } from "../../runtime/useDomLoop";
import { CANDIDATE_IDS, nextTake } from "../../sim/landingSim";
import { hash32, mulberry32, type Rng } from "../../sim/prng";
import { nearestEquivalentAngle } from "../../landingGeometry";
import {
  MagneticButton,
  Needle,
  SimBadge,
  Station,
  Terminal,
  type TerminalTab,
  type TypeLineProps,
} from "../primitives";
import { numberFormat, typeSlices, watchView } from "../primitives/primitiveKit";
import {
  FUNNEL_LINES,
  LUT_STRIDE,
  PHONE_VISIBLE_TOOLS,
  RUN_SAMPLE,
  SKIP_REASON,
  bayColumns,
  buildRun,
  candidateBearing,
  catalogIdOf,
  createRunFrame,
  dropCable,
  easeInOutCubic,
  fillPathLut,
  lutAt,
  nearestLine,
  pathData,
  rovingTarget,
  runFrameAt,
  runHeaders,
  runPlan,
  skippedOpen,
  spanCable,
  spreadAnchors,
  trayCables,
  wordEnds,
  type CablePath,
  type Cubic,
  type RunPlan,
  type RunResult,
  type TrayJack,
} from "./toolsRig";
import {
  SNIPPET_LANGS,
  commentLine,
  isSnippetLang,
  snippet,
  snippetLines,
  type SnippetLang,
} from "./toolsSnippets";
import "./tools.css";

/**
 * Station SW, 225°: the patch bay (spec §6.7). "Keep the tools you have."
 *
 * Every supported tool (`stats.cliTools`) is a jack in a square bay; one patch
 * cable per jack runs to a single Pusula hub socket (`{baseUrl}/v1`), and a
 * trunk runs on to a terminal with the real snippet (cURL, JavaScript,
 * Python, with `useDisplayBaseUrl`).
 *
 * - Beside the hub (≥1024px) the cables are dressed through the bay's
 *   gutters: up out of each plug, along the tray above its row as one strand
 *   of a ribbon, then down a lane beside the bay into the hub, drawn over the
 *   plates so every pulse and every lit cable is seen end to end. With the
 *   hub under the bay (768–1023) they hang straight down behind the plates;
 *   on a phone a seven-line funnel runs from the chip cloud into the hub.
 * - Geometry is recomputed only when a ResizeObserver sees the rig change;
 *   pulses ride 32-point arc-length lookup tables built at the same time
 *   (SVG transform writes through reused `SVGTransform`s: no allocation).
 * - Hover, focus or tap a jack: its cable lights, the rest dim, and the
 *   snippet's comment line names the tool.
 * - "Run it" routes one agentic request through the page's deck
 *   (`nextTake`), so it honours outages and weights set anywhere on the page:
 *   lines light in order, a packet runs to the hub, the needle spins, stops
 *   on any skipped or failed target (the hub retrying the next one) and
 *   settles on the winner; the reply streams and the X-Pusula headers type.
 * - Reduced motion or Pause: no pulses, and a run prints at once.
 */

type WireMode = "tray" | "drop" | "funnel";

type Wires = {
  w: number;
  h: number;
  mode: WireMode;
  /** Path data per cable: one per tool (tray and drop) or per funnel line. */
  cables: readonly string[];
  trunk: string;
  /** Per tool: the cable that carries its pulses and highlight (−1 when hidden). */
  lineOf: readonly number[];
};

const POOL = 6;
/** Sparks per pooled pulse: the head, then two trailing embers. */
const SPARKS = 3;
const SPAWN_MS = 300;
const LED_MS = 170;
const HUB_LED_MS = 140;
/** Pulse speed, px per ms (each pulse picks one in this range). */
const PULSE_SPEED: readonly [number, number] = [0.42, 0.6];
const PULSE_MS: readonly [number, number] = [650, 2400];
/** Trailing sparks sit this far behind the head along the cable, in px. */
const TRAIL_PX: readonly [number, number] = [11, 22];
const TRAIL_ALPHA: readonly [number, number] = [0.55, 0.28];
/** The dial's rim radius as a share of the hub box (viewBox 120, rim r 58). */
const RIM = 58 / 120;
const RTL_LOCALES = new Set(["fa", "ar", "he", "ur"]);

/** Opacity steps as ready-made attribute strings, so the frame loop never formats numbers. */
const OPACITY_STEPS = 20;
const OPACITY = Array.from({ length: OPACITY_STEPS + 1 }, (_, i) => String(i / OPACITY_STEPS));

const HEADER_NAMES = {
  provider: HEADER.provider,
  fallbackAttempts: HEADER.fallbackAttempts,
  latencyMs: HEADER.latencyMs,
  requestId: HEADER.requestId,
};

const TABS: readonly TerminalTab[] = SNIPPET_LANGS.map((lang) => ({
  id: lang.id,
  label: lang.label,
}));

/** The tick-0 answer: what SSR, no-JS and reduced motion show before any run. */
function seedRun(): RunResult {
  return buildRun(getSeedWorld().featured, []);
}

/** Keyboard focus (where `:focus-visible` is unknown, any focus counts). */
function isKeyboardFocus(el: Element): boolean {
  try {
    return el.matches(":focus-visible");
  } catch {
    return true;
  }
}

/** Empty every element's text (spans the run is about to type into). */
function clearTexts(nodes: readonly (Element | null)[]): void {
  for (const node of nodes) if (node) node.textContent = "";
}

/**
 * The element's own translate, created once and then moved with
 * `setTranslate` every frame (no strings, no allocation).
 */
function translateOf(node: SVGGraphicsElement): SVGTransform | null {
  const svg = node.ownerSVGElement;
  if (!svg) return null;
  const list = node.transform.baseVal;
  return list.numberOfItems > 0 ? list.getItem(0) : list.appendItem(svg.createSVGTransform());
}

/** Write a quantized opacity into `nodes[k]`, only when its step changes. */
function writeAlpha(
  level: Int8Array,
  nodes: readonly (SVGGraphicsElement | null)[],
  k: number,
  alpha: number
): void {
  const step = alpha <= 0 ? 0 : alpha >= 1 ? OPACITY_STEPS : Math.round(alpha * OPACITY_STEPS);
  if (level[k] === step) return;
  level[k] = step;
  nodes[k]?.setAttribute("opacity", OPACITY[step]);
}

/**
 * A one-listener signal: a stable `fire` a TypeLine can hold as `onDone`
 * without the render touching any ref; the listener is attached in an effect.
 */
function createSignal() {
  let listener: (() => void) | null = null;
  return {
    fire: () => listener?.(),
    listen: (fn: () => void) => {
      listener = fn;
      return () => {
        if (listener === fn) listener = null;
      };
    },
  };
}

/** Shortest signed turn from `from` to `to`, in degrees (−180, 180]. */
function turn(from: number, to: number): number {
  const d = (((to - from) % 360) + 540) % 360;
  return d - 180;
}

type RunAnim = {
  active: boolean;
  user: boolean;
  t: number;
  plan: RunPlan | null;
  frame: ReturnType<typeof createRunFrame>;
  lines: Element[];
  hl: number;
  startAngle: number;
  angles: Float64Array;
  reached: number;
  reply: string;
  ends: number[];
  words: number;
  strings: string[];
  slices: Int32Array;
  shown: Int32Array;
  packetOn: boolean;
  statusShown: boolean;
};

export default function ToolsUplink({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const rtl = RTL_LOCALES.has(locale.split("-")[0]);
  const baseUrl = useDisplayBaseUrl();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const tools = stats.cliTools;
  const n = tools.length;
  const fmt = numberFormat(locale);
  const listId = useId();

  /* ---------------------------------------------------------------------- */
  /* State                                                                  */
  /* ---------------------------------------------------------------------- */

  const [lang, setLang] = useState<SnippetLang>("curl");
  const [hover, setHover] = useState<number | null>(null);
  const [focus, setFocus] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [rove, setRove] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [wires, setWires] = useState<Wires | null>(null);
  const [run, setRun] = useState<RunResult>(seedRun);
  const [runSeq, setRunSeq] = useState(0);
  const [announce, setAnnounce] = useState("");
  const active = hover ?? focus ?? pinned;

  const rigRef = useRef<HTMLDivElement>(null);
  const bayRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const jackRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hubRef = useRef<HTMLDivElement>(null);
  const hubColRef = useRef<HTMLDivElement>(null);
  const hubTextRef = useRef<HTMLDivElement>(null);
  const hubLedRef = useRef<SVGCircleElement>(null);
  const termWrapRef = useRef<HTMLDivElement>(null);
  const runRowRef = useRef<HTMLDivElement>(null);
  const runBtnRef = useRef<HTMLElement>(null);
  const sparkRefs = useRef<(SVGGraphicsElement | null)[]>([]);
  const sparkTf = useRef<(SVGTransform | null)[]>([]);
  const packetRef = useRef<SVGGElement>(null);
  const packetTf = useRef<SVGTransform | null>(null);
  const tickRefs = useRef<(SVGGElement | null)[]>([]);
  const stopRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const replyRef = useRef<HTMLSpanElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const headerRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ledsRef = useRef<HTMLElement[]>([]);
  const lutRef = useRef<Float32Array>(new Float32Array(0));
  const lenRef = useRef<Float32Array>(new Float32Array(0));
  const lineOfRef = useRef<readonly number[]>([]);
  const cableCountRef = useRef(0);
  const needleAngle = useRef(candidateBearing(run.winner ?? "claude"));

  /* ---------------------------------------------------------------------- */
  /* Cables: measured on resize only                                        */
  /* ---------------------------------------------------------------------- */

  const measure = useCallback(() => {
    const rig = rigRef.current;
    const hub = hubRef.current;
    const hubCol = hubColRef.current;
    const term = termWrapRef.current;
    const list = listRef.current;
    const bay = bayRef.current;
    if (!rig || !hub || !hubCol || !term || !list || !bay) return;
    const rr = rig.getBoundingClientRect();
    if (rr.width === 0 || rr.height === 0) return;
    const ox = rr.left;
    const oy = rr.top;
    const funnel = getComputedStyle(rig).getPropertyValue("--tools-wire").trim() === "funnel";
    const hb = hub.getBoundingClientRect();
    const hx = hb.left + hb.width / 2 - ox;
    const hy = hb.top + hb.height / 2 - oy;
    const hr = hb.width * RIM;
    const br = bay.getBoundingClientRect();

    const jacks = Array.from(list.querySelectorAll<HTMLElement>("[data-jack]"));
    const leds: HTMLElement[] = [];
    const paths: CablePath[] = [];
    const lineOf: number[] = [];
    for (const jack of jacks) {
      const led = jack.querySelector<HTMLElement>("[data-led]");
      if (led) leds.push(led);
    }

    let mode: WireMode;
    if (funnel) {
      mode = "funnel";
      const top = br.bottom - oy;
      const anchors = spreadAnchors(br.left - ox, br.right - ox, FUNNEL_LINES, 28);
      for (const ax of anchors) paths.push([dropCable(ax, top, hx, hb.top - oy + 14)]);
      for (const jack of jacks) {
        const r = jack.getBoundingClientRect();
        lineOf.push(r.width === 0 ? -1 : nearestLine(anchors, r.left + r.width / 2 - ox));
      }
    } else if (hb.top >= br.bottom - 1) {
      // The hub under the bay: cables hang straight down behind the plates
      // and drop into the dial's top, fanned a little along its rim.
      mode = "drop";
      const midX = br.left + br.width / 2 - ox;
      const fan = hb.height * 0.22;
      jacks.forEach((jack, i) => {
        const r = jack.querySelector<HTMLElement>("[data-socket]")?.getBoundingClientRect();
        if (!r || r.width === 0) {
          lineOf.push(-1);
          paths.push([]);
          return;
        }
        const sx = r.left + r.width / 2 - ox;
        const sy = r.top + r.height / 2 - oy;
        const inX = hx + Math.max(-fan, Math.min(fan, (sx - midX) * 0.12));
        lineOf.push(i);
        paths.push([dropCable(sx, sy, inX, hb.top - oy + 14)]);
      });
    } else {
      // The hub beside the bay: cables dressed through the gutters (see trayCables).
      mode = "tray";
      const side: 1 | -1 = hx > br.left + br.width / 2 - ox ? 1 : -1;
      const cols = bayColumns(jacks.length);
      const rows = Math.ceil(jacks.length / cols);
      const rowTop = new Array<number>(rows).fill(Infinity);
      const rowBottom = new Array<number>(rows).fill(-Infinity);
      const trayJacks: TrayJack[] = [];
      let gridEdge = side === 1 ? -Infinity : Infinity;
      jacks.forEach((jack, i) => {
        const plate = jack.getBoundingClientRect();
        const socket = jack.querySelector<HTMLElement>("[data-socket]")?.getBoundingClientRect();
        if (plate.width === 0 || !socket || socket.width === 0) {
          trayJacks.push({ x: 0, y: 0, row: -1 });
          return;
        }
        const row = Math.floor(i / cols);
        rowTop[row] = Math.min(rowTop[row], plate.top - oy);
        rowBottom[row] = Math.max(rowBottom[row], plate.bottom - oy);
        gridEdge =
          side === 1 ? Math.max(gridEdge, plate.right - ox) : Math.min(gridEdge, plate.left - ox);
        // The cable leaves from the top of the plug seated in the socket.
        const plug = socket.height * 0.18;
        trayJacks.push({
          x: socket.left + socket.width / 2 - ox,
          y: socket.top + socket.height / 2 - plug - oy,
          row,
        });
      });
      const gap = rows > 1 ? rowTop[1] - rowBottom[0] : 12;
      const trayY = rowTop.map((top, r) =>
        r === 0 ? top - gap / 2 : (rowBottom[r - 1] + top) / 2
      );
      const routed = trayCables({
        side,
        jacks: trayJacks,
        trayY,
        gridEdge,
        bayEdge: side === 1 ? br.right - ox : br.left - ox,
        hub: { x: hx, y: hy, r: hr },
      });
      routed.forEach((path, i) => {
        paths.push(path);
        lineOf.push(path.length > 0 ? i : -1);
      });
    }

    // The trunk: hub → terminal, beside it (either side: RTL mirrors) or below it.
    const tb = term.getBoundingClientRect();
    const tl = tb.left - ox;
    const tr = tb.right - ox;
    const tt = tb.top - oy;
    const ty = Math.min(Math.max(hy, tt + 64), tb.bottom - oy - 64);
    let trunk: Cubic;
    if (tl >= hb.right - ox - 1) trunk = spanCable(hb.right - ox - 10, hy, tl + 1, ty);
    else if (tr <= hb.left - ox + 1) trunk = spanCable(hb.left - ox + 10, hy, tr - 1, ty);
    else {
      // Straight down: from the dial when its caption sits beside it, else from under the caption.
      const text = hubTextRef.current?.getBoundingClientRect();
      const besideDial = !!text && text.top < hb.bottom - 2;
      const from = besideDial ? hb.bottom - oy - 6 : hubCol.getBoundingClientRect().bottom - oy + 2;
      trunk = dropCable(hx, from, hx, tt + 1);
    }

    const lut = new Float32Array((paths.length + 1) * LUT_STRIDE);
    const lens = new Float32Array(paths.length + 1);
    paths.forEach((path, i) => {
      lens[i] = fillPathLut(path, lut, i * LUT_STRIDE);
    });
    lens[paths.length] = fillPathLut([trunk], lut, paths.length * LUT_STRIDE);
    lutRef.current = lut;
    lenRef.current = lens;
    lineOfRef.current = lineOf;
    ledsRef.current = leds;
    cableCountRef.current = paths.length;

    setWires({
      w: Math.round(rr.width),
      h: Math.round(rr.height),
      mode,
      cables: paths.map((path) => pathData(path)),
      trunk: pathData([trunk]),
      lineOf,
    });
  }, []);

  useEffect(() => {
    const rig = rigRef.current;
    if (!rig || typeof ResizeObserver === "undefined") return;
    // Runs after layout, once per batch of size changes: reading rects here is cheap.
    const observer = new ResizeObserver(() => measure());
    observer.observe(rig);
    if (listRef.current) observer.observe(listRef.current);
    if (termWrapRef.current) observer.observe(termWrapRef.current);
    if (hubColRef.current) observer.observe(hubColRef.current);
    // Web fonts change the jack labels' metrics without resizing the rig.
    let live = true;
    void document.fonts?.ready.then(() => {
      if (live) measure();
    });
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [measure]);

  /* ---------------------------------------------------------------------- */
  /* The run                                                                */
  /* ---------------------------------------------------------------------- */

  const headers = useMemo(() => runHeaders(run, HEADER_NAMES), [run]);
  const reply = t("toolsReply");
  const anim = useRef<RunAnim>({
    active: false,
    user: false,
    t: 0,
    plan: null,
    frame: createRunFrame(),
    lines: [],
    hl: -1,
    startAngle: 0,
    angles: new Float64Array(0),
    reached: -1,
    reply: "",
    ends: [],
    words: -1,
    strings: [],
    slices: new Int32Array(0),
    shown: new Int32Array(0),
    packetOn: false,
    statusShown: true,
  });
  const userRanRef = useRef(false);
  /** A run is on its way: Run waits for it instead of restarting it. */
  const busyRef = useRef(false);
  /** The terminal's line texts (blank lines are not lit during a run). */
  const lineTextsRef = useRef<readonly string[]>([]);

  const setBusy = useCallback((busy: boolean) => {
    busyRef.current = busy;
    const button = runBtnRef.current;
    if (busy) {
      runRowRef.current?.setAttribute("data-busy", "");
      button?.setAttribute("aria-disabled", "true");
    } else {
      runRowRef.current?.removeAttribute("data-busy");
      button?.removeAttribute("aria-disabled");
    }
  }, []);

  const runRequest = useCallback(
    (user: boolean) => {
      if (busyRef.current) return;
      setBusy(true);
      const world = getWorld();
      const skipped = skippedOpen(world, RUN_SAMPLE);
      dispatch((w) => nextTake(w, RUN_SAMPLE));
      if (user) userRanRef.current = true;
      anim.current.user = user;
      setRun(buildRun(getWorld().featured, skipped));
      setRunSeq((seq) => seq + 1);
    },
    [setBusy]
  );

  /** Final state of every run element (React rendered it; our writes may have hidden it). */
  const settleRun = useCallback(
    (result: RunResult, replyText: string) => {
      const a = anim.current;
      const text = result.served ? replyText : "";
      a.active = false;
      setBusy(false);
      for (const line of a.lines) line.removeAttribute("data-hl");
      a.hl = -1;
      packetRef.current?.setAttribute("opacity", "0");
      a.packetOn = false;
      statusRef.current?.removeAttribute("data-wait");
      if (replyRef.current) replyRef.current.textContent = text;
      const rows = runHeaders(result, HEADER_NAMES);
      rows.forEach((row, i) => {
        const key = headerRefs.current[i * 2];
        const value = headerRefs.current[i * 2 + 1];
        if (key) key.textContent = `${row.name}: `;
        if (value) value.textContent = row.value;
      });
      for (const stop of stopRefs.current) stop?.setAttribute("data-on", "");
      const states = new Map(result.stops.map((s) => [s.id, s.kind]));
      CANDIDATE_IDS.forEach((id, i) => {
        tickRefs.current[i]?.setAttribute("data-state", states.get(id) ?? "idle");
      });
      const last = result.stops[result.stops.length - 1];
      if (last) {
        const bearing = candidateBearing(last.id);
        needleAngle.current = nearestEquivalentAngle(needleAngle.current, bearing);
      }
      if (a.user) {
        a.user = false;
        // The same lines the response shows (a zero fallback count is not one of them).
        const parts = result.provider ? [`${HEADER.provider}: ${result.provider}`] : ["503"];
        if (result.fallbackAttempts > 0) {
          parts.push(`${HEADER.fallbackAttempts}: ${result.fallbackAttempts}`);
        }
        if (text) parts.push(text);
        setAnnounce(parts.join(" · "));
      }
    },
    [setBusy]
  );

  // Each new run: clear what will be revealed, then let the loop play it.
  const handledSeq = useRef(0);
  useLayoutEffect(() => {
    if (runSeq === 0 || handledSeq.current === runSeq) return;
    handledSeq.current = runSeq;
    const a = anim.current;
    // The response shows from the first run on (it was folded while the snippet typed).
    termWrapRef.current?.removeAttribute("data-armed");
    if (!canAnimate()) {
      settleRun(run, reply);
      return;
    }
    const pre = termWrapRef.current?.querySelector(".term-pre");
    const texts = lineTextsRef.current;
    // The request's own lines light in turn (not the comment on top, not blank lines).
    a.lines = pre
      ? Array.from(pre.querySelectorAll(".tl")).filter(
          (_, i) => i > 0 && (texts[i] ?? "").trim() !== ""
        )
      : [];
    for (const line of a.lines) line.removeAttribute("data-hl");
    a.hl = -1;
    a.reply = run.served ? reply : "";
    a.ends = wordEnds(a.reply);
    a.words = -1;
    a.strings = [];
    for (const row of runHeaders(run, HEADER_NAMES)) a.strings.push(`${row.name}: `, row.value);
    a.slices = new Int32Array(a.strings.length);
    a.shown = new Int32Array(a.strings.length).fill(-1);
    const chars = a.strings.reduce((sum, s) => sum + s.length, 0);
    a.plan = runPlan(a.lines.length, run.stops.length, a.ends.length, chars);
    // Unwrapped needle angles: two full turns into the first stop, then the short way round.
    a.startAngle = needleAngle.current;
    a.angles = new Float64Array(run.stops.length);
    let angle = a.startAngle;
    run.stops.forEach((stop, k) => {
      const bearing = candidateBearing(stop.id);
      angle = k === 0 ? angle + 720 + ((((bearing - angle) % 360) + 360) % 360) : angle;
      if (k > 0) angle += turn(angle, bearing);
      a.angles[k] = angle;
    });
    a.reached = -1;
    for (const stop of stopRefs.current) stop?.removeAttribute("data-on");
    tickRefs.current.forEach((tick) => tick?.setAttribute("data-state", "idle"));
    a.statusShown = false;
    statusRef.current?.setAttribute("data-wait", "");
    if (replyRef.current) replyRef.current.textContent = "";
    clearTexts(headerRefs.current);
    a.t = 0;
    a.active = true;
  }, [runSeq, run, reply, settleRun]);

  // Reduced motion or Pause: a run mid-way shows its answer at once, and a
  // response folded for the typing comes back.
  useEffect(() => {
    if (!reduced && !paused) return;
    termWrapRef.current?.removeAttribute("data-armed");
    if (anim.current.active) settleRun(run, reply);
  }, [reduced, paused, run, reply, settleRun]);

  /* ---------------------------------------------------------------------- */
  /* The loop: idle pulses and the run timeline                             */
  /* ---------------------------------------------------------------------- */

  const loop = useRef({
    clock: 0,
    nextSpawn: 500,
    rng: null as Rng | null,
    cable: new Int16Array(POOL).fill(-1),
    start: new Float64Array(POOL),
    dur: new Float64Array(POOL),
    level: new Int8Array(POOL * SPARKS).fill(-1),
    ledOff: new Float64Array(0),
    hubOff: 0,
    hubReady: 0,
    pos: new Float32Array(2),
  });

  const tick = useCallback(
    (dt: number) => {
      const L = loop.current;
      L.clock += dt * 1000;
      const now = L.clock;
      const lut = lutRef.current;
      const lens = lenRef.current;
      const cables = cableCountRef.current;
      const leds = ledsRef.current;
      const sparks = sparkRefs.current;
      if (!L.rng) L.rng = mulberry32(hash32("tools-pulses", n));
      if (L.ledOff.length !== leds.length) L.ledOff = new Float64Array(leds.length);

      // Spawn: one pulse every 300 ms (600 ms on a struggling device), from a random jack.
      if (cables > 0 && now >= L.nextSpawn) {
        L.nextSpawn = now + (getQualityTier() >= 2 ? SPAWN_MS * 2 : SPAWN_MS);
        let slot = -1;
        for (let i = 0; i < POOL; i++) {
          if (L.cable[i] < 0) {
            slot = i;
            break;
          }
        }
        const lineOf = lineOfRef.current;
        if (slot >= 0 && lineOf.length > 0) {
          for (let tries = 0; tries < 4; tries++) {
            const tool = Math.floor(L.rng() * lineOf.length);
            const cable = lineOf[tool];
            if (cable < 0 || cable >= cables) continue;
            const speed = PULSE_SPEED[0] + L.rng() * (PULSE_SPEED[1] - PULSE_SPEED[0]);
            const dur = (lens[cable] ?? 0) / speed;
            L.cable[slot] = cable;
            L.start[slot] = now;
            L.dur[slot] = dur < PULSE_MS[0] ? PULSE_MS[0] : dur > PULSE_MS[1] ? PULSE_MS[1] : dur;
            const led = leds[tool];
            if (led) {
              led.setAttribute("data-tx", "");
              L.ledOff[tool] = now + LED_MS;
            }
            break;
          }
        }
      }

      // Move the pooled pulses: a head and two trailing sparks each.
      for (let i = 0; i < POOL; i++) {
        const cable = L.cable[i];
        if (cable < 0) continue;
        const u = (now - L.start[i]) / L.dur[i];
        const base = i * SPARKS;
        if (u >= 1 || cable >= cables) {
          L.cable[i] = -1;
          for (let k = 0; k < SPARKS; k++) writeAlpha(L.level, sparks, base + k, 0);
          // The hub rim flashes on arrival, at most ~2.5 times a second.
          if (u >= 1 && now >= L.hubReady) {
            hubLedRef.current?.setAttribute("data-rx", "");
            L.hubOff = now + HUB_LED_MS;
            L.hubReady = now + 400;
          }
          continue;
        }
        const len = lens[cable] > 1 ? lens[cable] : 1;
        const fade = u < 0.08 ? u / 0.08 : u > 0.92 ? (1 - u) / 0.08 : 1;
        for (let k = 0; k < SPARKS; k++) {
          const uk = k === 0 ? u : u - TRAIL_PX[k - 1] / len;
          const tf = sparkTf.current[base + k];
          if (uk <= 0 || !tf) {
            writeAlpha(L.level, sparks, base + k, 0);
            continue;
          }
          lutAt(lut, cable * LUT_STRIDE, uk, L.pos);
          tf.setTranslate(L.pos[0], L.pos[1]);
          writeAlpha(L.level, sparks, base + k, k === 0 ? fade : fade * TRAIL_ALPHA[k - 1]);
        }
      }

      // LEDs off.
      for (let i = 0; i < L.ledOff.length; i++) {
        if (L.ledOff[i] > 0 && now >= L.ledOff[i]) {
          L.ledOff[i] = 0;
          leds[i]?.removeAttribute("data-tx");
        }
      }
      if (L.hubOff > 0 && now >= L.hubOff) {
        L.hubOff = 0;
        hubLedRef.current?.removeAttribute("data-rx");
      }

      // The run.
      const a = anim.current;
      if (!a.active || !a.plan) return;
      a.t += dt * 1000;
      const f = runFrameAt(a.plan, a.t, a.frame);
      if (f.hl !== a.hl) {
        if (a.hl >= 0) a.lines[a.hl]?.removeAttribute("data-hl");
        if (f.hl >= 0) a.lines[f.hl]?.setAttribute("data-hl", "");
        a.hl = f.hl;
      }
      const packet = packetRef.current;
      const packetTfm = packetTf.current;
      if (packet && packetTfm) {
        if (f.packet >= 0 && lut.length >= (cables + 1) * LUT_STRIDE) {
          lutAt(lut, cables * LUT_STRIDE, 1 - f.packet, L.pos);
          packetTfm.setTranslate(L.pos[0], L.pos[1]);
          if (!a.packetOn) {
            packet.setAttribute("opacity", "1");
            a.packetOn = true;
          }
        } else if (a.packetOn) {
          packet.setAttribute("opacity", "0");
          a.packetOn = false;
          hubLedRef.current?.setAttribute("data-rx", "");
          L.hubOff = now + HUB_LED_MS * 2;
        }
      }
      if (f.spin >= 0 && a.angles.length > 0) {
        needleAngle.current = a.startAngle + easeInOutCubic(f.spin) * (a.angles[0] - a.startAngle);
      } else if (f.reached > 0) {
        needleAngle.current = a.angles[f.reached - 1];
      }
      if (f.reached !== a.reached) {
        for (let k = Math.max(0, a.reached); k < f.reached; k++) {
          stopRefs.current[k]?.setAttribute("data-on", "");
          const stop = run.stops[k];
          if (stop) {
            tickRefs.current[CANDIDATE_IDS.indexOf(stop.id)]?.setAttribute("data-state", stop.kind);
          }
        }
        a.reached = f.reached;
      }
      if (!a.statusShown && a.t >= a.plan.replyStart) {
        a.statusShown = true;
        statusRef.current?.removeAttribute("data-wait");
      }
      if (f.words !== a.words) {
        a.words = f.words;
        const end = f.words > 0 ? a.ends[f.words - 1] : 0;
        if (replyRef.current) replyRef.current.textContent = a.reply.slice(0, end);
      }
      typeSlices(a.strings, f.chars, a.slices);
      for (let i = 0; i < a.strings.length; i++) {
        if (a.slices[i] === a.shown[i]) continue;
        a.shown[i] = a.slices[i];
        const span = headerRefs.current[i];
        if (span) span.textContent = a.strings[i].slice(0, a.slices[i]);
      }
      if (f.done) settleRun(run, reply);
    },
    [n, run, reply, settleRun]
  );

  useDomLoop("tools-patch-bay", tick, { target: rigRef });

  /* ---------------------------------------------------------------------- */
  /* The terminal: typing, the folded response, the one automatic run       */
  /* ---------------------------------------------------------------------- */

  const autoFlip = useRef(false);
  const auto = useRef({ done: false, pending: false, timer: 0, inView: false, seen: false });
  const runRef = useRef(runRequest);
  useEffect(() => {
    runRef.current = runRequest;
  });

  /** Run once by itself, but only while the terminal is on screen (else when it returns). */
  const scheduleAuto = useCallback((delay: number) => {
    const s = auto.current;
    window.clearTimeout(s.timer);
    s.timer = window.setTimeout(() => {
      if (s.done || userRanRef.current) return;
      if (!s.inView || !canAnimate()) {
        s.pending = true;
        return;
      }
      s.done = true;
      s.pending = false;
      runRef.current(false);
    }, delay);
  }, []);

  useEffect(() => {
    const s = auto.current;
    return () => window.clearTimeout(s.timer);
  }, []);

  // Mirrors the Terminal's first-view typing: while its lines are cleared to
  // type, the response folds away too (the answer must not come before the
  // question); SSR, no-JS and reduced motion keep showing it.
  useEffect(() => {
    const node = termWrapRef.current;
    if (!node) return;
    const s = auto.current;
    return watchView(node, {
      onNear: () => {
        if (!s.seen && canAnimate()) node.setAttribute("data-armed", "");
      },
      onFar: () => {
        if (!s.seen) node.removeAttribute("data-armed");
      },
      onEnter: () => {
        s.seen = true;
        s.inView = true;
        if (s.pending && !s.done) scheduleAuto(700);
      },
      onExit: () => {
        s.inView = false;
      },
    });
  }, [scheduleAuto]);

  // Back from Pause with the automatic run still owed.
  useEffect(() => {
    const s = auto.current;
    if (!reduced && !paused && s.pending && s.inView && !s.done) scheduleAuto(700);
  }, [reduced, paused, scheduleAuto]);

  // Once the snippet has typed: "auto" pulses ember twice; the first time, the
  // request then runs by itself so the whole story plays once without a click.
  const onSnippetTyped = useCallback(() => {
    const wrap = termWrapRef.current;
    if (!wrap || !canAnimate()) return;
    autoFlip.current = !autoFlip.current;
    wrap.setAttribute("data-auto", autoFlip.current ? "a" : "b");
    const s = auto.current;
    if (s.done || userRanRef.current) return;
    scheduleAuto(1500);
  }, [scheduleAuto]);

  const [typedSignal] = useState(createSignal);
  useEffect(() => typedSignal.listen(onSnippetTyped), [typedSignal, onSnippetTyped]);

  // Clicking or copying the code completes the typing at once: count that as typed.
  const onTermComplete = useCallback(
    (event: SyntheticEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest?.(".term-pre, .cc")) return;
      if (!auto.current.done && !userRanRef.current) onSnippetTyped();
    },
    [onSnippetTyped]
  );

  const code = snippet(lang, baseUrl);
  const codeLines = useMemo(() => snippetLines(lang, baseUrl), [lang, baseUrl]);
  const activeTool = active !== null ? tools[active] : undefined;
  const activeToolId = activeTool?.id;
  // The comment on top: the base-URL caption, or the hovered tool's sentence.
  const caption = activeTool ? t("toolsComment", { tool: activeTool.name }) : t("toolsBaseUrl");
  const lines = useMemo<TypeLineProps[]>(() => {
    const cmt = commentLine(lang, caption, rtl);
    const out: TypeLineProps[] = [
      {
        id: `cmt-${activeToolId ?? "base"}`,
        text: cmt.text,
        tokens: cmt.tokens,
        className: activeToolId ? "tools-cmt tools-cmt-tool" : "tools-cmt",
      },
    ];
    codeLines.forEach((line, i) => {
      out.push({
        id: `l${i}`,
        text: line.text,
        tokens: line.tokens,
        onDone: i === codeLines.length - 1 ? typedSignal.fire : undefined,
      });
    });
    return out;
  }, [codeLines, caption, lang, rtl, activeToolId, typedSignal]);
  useEffect(() => {
    lineTextsRef.current = lines.map((line) => line.text);
  }, [lines]);

  /* ---------------------------------------------------------------------- */
  /* The jacks: roving focus, show more / fewer                             */
  /* ---------------------------------------------------------------------- */

  const cols = bayColumns(n);
  const cloud = wires?.mode === "funnel";
  const visibleCount = cloud && !expanded ? Math.min(n, PHONE_VISIBLE_TOOLS) : n;
  const tabStop = rove < visibleCount ? rove : 0;
  const hidden = Math.max(0, n - PHONE_VISIBLE_TOOLS);
  const revealRef = useRef(false);

  // "Show more": focus moves to the first chip it revealed.
  useEffect(() => {
    if (!expanded || !revealRef.current) return;
    revealRef.current = false;
    jackRefs.current[PHONE_VISIBLE_TOOLS]?.focus();
  }, [expanded]);

  const onJackKey = (event: ReactKeyboardEvent<HTMLButtonElement>, i: number) => {
    const next = rovingTarget(event.key, i, visibleCount, cloud ? 1 : cols, rtl);
    if (next === null) return;
    event.preventDefault();
    if (next !== i) jackRefs.current[next]?.focus();
  };

  const pointerHover = (i: number | null) => (event: ReactPointerEvent) => {
    if (event.pointerType === "mouse") setHover(i);
  };

  /* ---------------------------------------------------------------------- */
  /* Render                                                                 */
  /* ---------------------------------------------------------------------- */

  const activeLine = active !== null && wires ? (wires.lineOf[active] ?? -1) : -1;
  const lit = activeLine >= 0 && wires ? (wires.cables[activeLine] ?? "") : "";
  const stopKinds = new Map(run.stops.map((s) => [s.id, s.kind]));

  return (
    <Station id="tools" title={t("toolsTitle")} lead={t("toolsLead", { count: fmt.format(n) })}>
      <div className="station-inner tools-inner">
        <div
          ref={rigRef}
          className="tools-rig"
          data-wire={wires?.mode}
          data-focus={active !== null ? "" : undefined}
          data-expanded={expanded ? "" : undefined}
          style={{ "--tools-cols": cols } as CSSProperties}
        >
          <svg
            className="tools-wires"
            aria-hidden="true"
            focusable="false"
            width={wires?.w ?? 0}
            height={wires?.h ?? 0}
            viewBox={`0 0 ${wires?.w ?? 1} ${wires?.h ?? 1}`}
          >
            <defs>
              <radialGradient id="tools-halo-gold">
                <stop offset="0" stopColor="#ffd36e" stopOpacity="0.75" />
                <stop offset="0.35" stopColor="#ffd36e" stopOpacity="0.3" />
                <stop offset="1" stopColor="#ffd36e" stopOpacity="0" />
              </radialGradient>
              <radialGradient id="tools-halo-ember">
                <stop offset="0" stopColor="#ff7a45" stopOpacity="0.7" />
                <stop offset="1" stopColor="#ff7a45" stopOpacity="0" />
              </radialGradient>
            </defs>
            {wires ? (
              <>
                <g className="tools-loom">
                  {wires.cables.map((d, i) =>
                    d ? <path key={i} d={d} className="tools-cable" /> : null
                  )}
                </g>
                <path d={wires.trunk} className="tools-trunk" />
                {lit ? (
                  <g key={activeLine} className="tools-lit">
                    <path d={lit} className="tools-lit-glow" />
                    <path d={lit} className="tools-lit-core" />
                  </g>
                ) : null}
              </>
            ) : null}
            {Array.from({ length: POOL }, (_, i) => (
              <g key={i} className="tools-pulse">
                {[2, 1].map((k) => (
                  <circle
                    key={k}
                    ref={(node) => {
                      sparkRefs.current[i * SPARKS + k] = node;
                      sparkTf.current[i * SPARKS + k] = node ? translateOf(node) : null;
                    }}
                    r={k === 1 ? 2.3 : 1.7}
                    className="tools-trail"
                    opacity="0"
                  />
                ))}
                <g
                  ref={(node) => {
                    sparkRefs.current[i * SPARKS] = node;
                    sparkTf.current[i * SPARKS] = node ? translateOf(node) : null;
                  }}
                  opacity="0"
                >
                  <circle r="13" fill="url(#tools-halo-gold)" />
                  <circle r="3" className="tools-pulse-core" />
                </g>
              </g>
            ))}
            <g
              ref={(node) => {
                packetRef.current = node;
                packetTf.current = node ? translateOf(node) : null;
              }}
              className="tools-packet"
              opacity="0"
            >
              <circle r="14" fill="url(#tools-halo-ember)" />
              <circle r="3.4" className="tools-packet-core" />
            </g>
          </svg>

          <div ref={bayRef} className="tools-bay">
            <p className="tools-bay-head kicker">
              <span>{t("toolsListAria")}</span>
              <span className="tools-bay-count">{fmt.format(n)}</span>
            </p>
            <ul id={listId} ref={listRef} className="tools-jacks" aria-label={t("toolsListAria")}>
              {tools.map((tool, i) => (
                <li
                  key={tool.id}
                  className="tools-jack-li"
                  data-extra={i >= PHONE_VISIBLE_TOOLS ? "" : undefined}
                >
                  <button
                    ref={(node) => {
                      jackRefs.current[i] = node;
                    }}
                    type="button"
                    className="tools-jack"
                    data-jack=""
                    data-active={active === i ? "" : undefined}
                    aria-pressed={pinned === i}
                    tabIndex={i === tabStop ? 0 : -1}
                    onClick={() => {
                      const pin = pinned !== i;
                      setPinned(pin ? i : null);
                      if (pin) setAnnounce(t("toolsComment", { tool: tool.name }));
                    }}
                    onKeyDown={(event) => onJackKey(event, i)}
                    onPointerEnter={pointerHover(i)}
                    onPointerLeave={pointerHover(null)}
                    onFocus={(event) => {
                      setRove(i);
                      // Keyboard focus previews like a hover; a tap's focus must not
                      // keep a jack lit after it is tapped off again.
                      if (isKeyboardFocus(event.currentTarget)) setFocus(i);
                    }}
                    onBlur={() => setFocus((f) => (f === i ? null : f))}
                  >
                    <span className="tools-socket" data-socket="" aria-hidden="true">
                      <span className="tools-plug" />
                    </span>
                    <span className="tools-led" data-led="" aria-hidden="true" />
                    <span className="tools-name">{tool.name}</span>
                  </button>
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <button
                type="button"
                className="tools-more"
                aria-expanded={expanded}
                aria-controls={listId}
                onClick={() => {
                  if (!expanded) revealRef.current = true;
                  setExpanded((e) => !e);
                }}
              >
                {expanded
                  ? t("catalogShowLess")
                  : t("catalogShowAll", { count: fmt.format(hidden) })}
              </button>
            ) : null}
          </div>

          <div className="tools-side">
            <div ref={hubColRef} className="tools-hub-col">
              <div ref={hubRef} className="tools-hub" dir="ltr">
                <svg
                  className="tools-dial"
                  viewBox="0 0 120 120"
                  aria-hidden="true"
                  focusable="false"
                >
                  <defs>
                    <radialGradient id="tools-dial-face" cx="50%" cy="40%" r="62%">
                      <stop offset="0" stopColor="#221d15" />
                      <stop offset="0.7" stopColor="#0d0b08" />
                      <stop offset="1" stopColor="#060505" />
                    </radialGradient>
                  </defs>
                  <circle className="tools-dial-rim" cx="60" cy="60" r="58" />
                  <circle ref={hubLedRef} className="tools-dial-rx" cx="60" cy="60" r="58" />
                  <circle
                    className="tools-dial-face"
                    cx="60"
                    cy="60"
                    r="50"
                    fill="url(#tools-dial-face)"
                  />
                  {Array.from({ length: 36 }, (_, i) =>
                    i % 6 === 0 ? null : (
                      <line
                        key={i}
                        className="tools-dial-minor"
                        x1="60"
                        y1="6"
                        x2="60"
                        y2="9.5"
                        transform={`rotate(${i * 10} 60 60)`}
                      />
                    )
                  )}
                  {CANDIDATE_IDS.map((id, i) => (
                    <g
                      key={id}
                      ref={(node) => {
                        tickRefs.current[i] = node;
                      }}
                      className="tools-dial-tick"
                      data-state={stopKinds.get(id) ?? "idle"}
                      transform={`rotate(${candidateBearing(id)} 60 60)`}
                    >
                      <line x1="60" y1="4.5" x2="60" y2="13" />
                      <circle cx="60" cy="18" r="1.6" />
                    </g>
                  ))}
                </svg>
                <span className="tools-hub-needle">
                  <Needle
                    size={64}
                    angleRef={needleAngle}
                    bearing={candidateBearing(run.stops[run.stops.length - 1]?.id ?? "claude")}
                  />
                </span>
              </div>
              <div ref={hubTextRef} className="tools-hub-text">
                <p className="tools-hub-label">{t("toolsBaseUrl")}</p>
                <code className="tools-hub-url" dir="ltr">
                  {baseUrl}
                  <wbr />
                  /v1
                </code>
                <p className="tools-route" dir="ltr">
                  <span className="tools-route-auto">auto</span>
                  {run.stops.map((stop, k) => (
                    <span
                      key={`${run.take}-${k}`}
                      ref={(node) => {
                        stopRefs.current[k] = node;
                      }}
                      className="tools-stop"
                      data-kind={stop.kind}
                      data-on=""
                    >
                      <span className="tools-stop-arrow" aria-hidden="true">
                        →
                      </span>
                      <span className="tools-stop-id">{catalogIdOf(stop.id)}</span>
                      {stop.kind !== "win" ? (
                        <span className="tools-stop-code">
                          <span aria-hidden="true">✕ </span>
                          {stop.kind === "skip" ? SKIP_REASON : stop.code}
                        </span>
                      ) : null}
                    </span>
                  ))}
                </p>
                <SimBadge className="tools-hub-sim" />
              </div>
            </div>

            <div
              ref={termWrapRef}
              className="tools-term"
              onClick={onTermComplete}
              onCopy={onTermComplete}
            >
              <Terminal
                title="pusula /v1"
                tabs={TABS}
                activeTab={lang}
                onTab={(id) => {
                  if (isSnippetLang(id)) setLang(id);
                }}
                lines={lines}
                copyText={code}
                ariaLabel={t("toolsSnippetAria")}
                footer={
                  <div className="tools-foot">
                    <div ref={runRowRef} className="tools-run-row">
                      <MagneticButton
                        ref={runBtnRef}
                        variant="ghost"
                        icon="play"
                        onClick={() => runRequest(true)}
                      >
                        {t("toolsRun")}
                      </MagneticButton>
                      <SimBadge />
                    </div>
                    <div className="tools-resp" dir="ltr">
                      <p className="tools-resp-line tools-resp-reply">
                        <span
                          ref={statusRef}
                          className="tools-status"
                          data-ok={run.served ? "" : undefined}
                        >
                          {run.served ? "200" : "503"}
                        </span>
                        <bdi className="tools-reply">
                          <span ref={replyRef}>{run.served ? reply : ""}</span>
                        </bdi>
                      </p>
                      {headers.map((row, i) => (
                        <p key={row.name} className="tools-resp-line tools-resp-h">
                          <span
                            ref={(node) => {
                              headerRefs.current[i * 2] = node;
                            }}
                            className="tools-h-k"
                          >{`${row.name}: `}</span>
                          <span
                            ref={(node) => {
                              headerRefs.current[i * 2 + 1] = node;
                            }}
                            className="tools-h-v"
                          >
                            {row.value}
                          </span>
                        </p>
                      ))}
                    </div>
                    <p className="sr-only" aria-live="polite">
                      {announce}
                    </p>
                  </div>
                }
              />
            </div>
          </div>

          <p className="tools-note">{t("toolsNote")}</p>
        </div>
      </div>
    </Station>
  );
}
