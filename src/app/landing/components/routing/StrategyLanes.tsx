"use client";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePrefersReducedMotion } from "../../landingMotion";
import { getWorld, useDeck } from "../../runtime/deckStore";
import { usePaused } from "../../runtime/heartbeat";
import { useDomLoop } from "../../runtime/useDomLoop";
import type { World } from "../../sim/landingSim";
import { hash32, mulberry32, type Rng } from "../../sim/prng";
import {
  autoScore,
  createLanes,
  createStratState,
  pick,
  pickTargets,
  type Lane,
  type StratPick,
  type StratState,
} from "../../sim/landingStrategies";
import { Glyph, SimBadge } from "../primitives";
import {
  HOP_POINTS,
  cardDoor,
  clamp01,
  hopArc,
  laneHitSpan,
  laneLayout,
  polylineAt,
  polylineLength,
} from "./routingKit";

/**
 * The strategy band's lanes figure (spec §6.5, part B): a source, a hub and
 * four lanes A–D with mini gauges (quota bar, load dots, cost $–$$$, context
 * window, health LED). Requests leave the source at 3 per second and go where
 * the selected strategy sends them (`sim/landingStrategies.ts`, a small
 * picture of `applyStrategyOrdering`):
 *
 * - fusion fans out to three lanes; the replies converge on the judge (⚖) at
 *   the hub, and one merged gold packet returns;
 * - pipeline hops one packet A → B → C along visible hand-off arcs, lighting
 *   each stage in turn;
 * - context-relay fills a session gauge on one lane, then hands a summary to
 *   the next along an arc;
 * - cache-optimized keeps a prefix tab on the lane that cached it;
 * - auto ranks the lanes with the deck's live (visitor-tunable) weights.
 *
 * Tap a lane to fail it (ember, dashed, ✕): packets already on their way
 * bounce back to the hub, which retries the strategy's next target.
 *
 * A process flow, so it mirrors in RTL (source at the inline start). Motion is
 * one dom-lane loop, only while the figure is on screen; per frame it writes
 * only packet transforms and changed gauges. Reduced motion and Pause: a
 * static first pick (its routes lit), every tap still instant.
 */

const LANE_IDS = ["A", "B", "C", "D"] as const;
const POOL = 28;
const MAX_PTS = 12;
const RATE_S = 1 / 3;
const DRAIN = 0.02;
const REGEN_PER_S = 0.007;
const HOT_MS = 520;
/** Hand-off arcs drawn at once (pipeline stages, relay summaries). */
const HOP_POOL = 3;
const HOP_LINGER_MS = 240;

const KIND_REQ = 0;
const KIND_REPLY = 1;
const KIND_MERGED = 2;
const KIND_SUMMARY = 3;
const KIND_BOUNCE = 4;
const KIND_NAMES = ["req", "reply", "merged", "summary", "bounce"] as const;
/** A bounce that does not retry (every lane was down). */
const NO_RETRY = -2;

const selectWeights = (w: World) => w.weights;
const selectFactorIds = (w: World) => w.factorIds;

function ctxLabel(k: number): string {
  return k >= 1000 ? `${Math.round(k / 100) / 10}M` : `${k}k`;
}

/** Lane polylines (source → hub → curve → track → card door) and visible paths. */
function buildGeometry(compact: boolean, rtl: boolean) {
  const L = laneLayout(compact, rtl);
  const door = cardDoor(L);
  const dir = rtl ? -1 : 1;
  const polys: Float32Array[] = [];
  const paths: string[] = [];
  const r = (v: number) => Math.round(v * 100) / 100;
  for (let i = 0; i < 4; i++) {
    const ly = L.laneY[i];
    const hx = L.judge.x;
    const hy = L.judge.y;
    const tx = L.trackStart;
    const mx = hx + (tx - hx) * 0.55;
    const pts = new Float32Array(9 * 2);
    pts[0] = L.source.x;
    pts[1] = L.source.y;
    pts[2] = hx;
    pts[3] = hy;
    // Cubic hub → track start, sampled.
    for (let k = 1; k <= 4; k++) {
      const t = k / 5;
      const u = 1 - t;
      const x = u * u * u * hx + 3 * u * u * t * mx + 3 * u * t * t * mx + t * t * t * tx;
      const y = u * u * u * hy + 3 * u * u * t * hy + 3 * u * t * t * ly + t * t * t * ly;
      pts[2 + k * 2] = x;
      pts[3 + k * 2] = y;
    }
    pts[12] = tx;
    pts[13] = ly;
    pts[14] = door - dir * 2;
    pts[15] = ly;
    pts[16] = door;
    pts[17] = ly;
    polys.push(pts);
    paths.push(
      `M${r(hx)} ${r(hy)}C${r(mx)} ${r(hy)} ${r(mx)} ${r(ly)} ${r(tx)} ${r(ly)}L${r(door - dir * 2)} ${r(ly)}`
    );
  }
  // Hand-off arcs between every ordered pair of cards (pair `from * 4 + to`).
  const hops = new Float32Array(16 * HOP_POINTS * 2);
  const hopPaths: string[] = new Array<string>(16).fill("");
  for (let from = 0; from < 4; from++) {
    for (let to = 0; to < 4; to++) {
      if (from === to) continue;
      const pair = from * 4 + to;
      hopPaths[pair] = hopArc(L, from, to, hops, pair * HOP_POINTS * 2);
    }
  }
  const span = laneHitSpan(L);
  return { L, door, dir, polys, paths, hops, hopPaths, span };
}

export type StrategyLanesProps = {
  strategy: string;
  compact: boolean;
  rtl: boolean;
  onInteract: () => void;
};

export default function StrategyLanes({ strategy, compact, rtl, onInteract }: StrategyLanesProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();
  const motion = !reduced && !paused;
  const weights = useDeck(selectWeights);
  const factorIds = useDeck(selectFactorIds);
  const [failed, setFailed] = useState<readonly boolean[]>([false, false, false, false]);
  const hintId = useId();

  const geo = useMemo(() => buildGeometry(compact, rtl), [compact, rtl]);
  const { L, door, dir } = geo;
  const plain = useMemo(() => new Intl.NumberFormat(locale), [locale]);

  /* ---- the static first pick (server, reduced motion, Pause; also the first lit routes) ---- */
  const staticView = useMemo(() => {
    const lanes = createLanes().map((lane, i) => ({ ...lane, healthy: !failed[i] }));
    const st = createStratState();
    st.autoWeights = { factorIds, weights };
    const autoRanks = rankLanes(lanes, st);
    const first = pick(strategy, lanes, st, mulberry32(hash32("lanes", strategy)));
    return { lanes, st, first, targets: pickTargets(first), autoRanks };
  }, [strategy, failed, factorIds, weights]);

  /* ---- live simulation state (client only, owned by the loop) ---- */
  const figRef = useRef<HTMLDivElement>(null);
  const el = useRef({
    track: [] as (SVGPathElement | null)[],
    card: [] as (SVGGElement | null)[],
    hop: [] as (SVGPathElement | null)[],
    flash: [] as (SVGRectElement | null)[],
    quota: [] as (SVGRectElement | null)[],
    dots: [] as (SVGCircleElement | null)[],
    badge: [] as (SVGTextElement | null)[],
    session: [] as (SVGRectElement | null)[],
    packets: [] as (SVGGElement | null)[],
  });
  const sim = useRef<{
    lanes: Lane[];
    st: StratState;
    rng: Rng;
    acc: number;
    active: Uint8Array;
    kind: Uint8Array;
    lane: Int8Array;
    slot: Int8Array;
    chain: Int8Array;
    chainAt: Uint8Array;
    start: Float64Array;
    dur: Float32Array;
    pts: Float32Array;
    npts: Uint8Array;
    fusionLeft: Int8Array;
    fusionNext: number;
    flash: Float32Array;
    hotUntil: Float64Array;
    cardUntil: Float64Array;
    hopUntil: Float64Array;
    hopNext: number;
    shownQuota: Float32Array;
    shownLoad: Int8Array;
    shownSession: Float32Array;
    shownBadge: string[];
    pos: Float32Array;
    ranks: number[];
  } | null>(null);
  const live = useRef({ strategy, geo, failed });
  useEffect(() => {
    live.current = { strategy, geo, failed };
  });

  const resetSim = useCallback((name: string) => {
    const down = live.current.failed;
    const lanes = createLanes().map((lane, i) => ({ ...lane, load: 0, healthy: !down[i] }));
    const prev = sim.current;
    const st = createStratState();
    const world = getWorld();
    st.autoWeights = { factorIds: world.factorIds, weights: world.weights };
    const s = {
      lanes,
      st,
      rng: mulberry32(hash32("lanes-live", name)),
      acc: RATE_S * 0.6,
      active: new Uint8Array(POOL),
      kind: new Uint8Array(POOL),
      lane: new Int8Array(POOL),
      slot: new Int8Array(POOL).fill(-1),
      chain: new Int8Array(POOL * 3).fill(-1),
      chainAt: new Uint8Array(POOL),
      start: new Float64Array(POOL),
      dur: new Float32Array(POOL),
      pts: new Float32Array(POOL * MAX_PTS * 2),
      npts: new Uint8Array(POOL),
      fusionLeft: new Int8Array(8),
      fusionNext: 0,
      flash: new Float32Array(4),
      hotUntil: new Float64Array(4),
      cardUntil: new Float64Array(4),
      hopUntil: new Float64Array(HOP_POOL),
      hopNext: 0,
      shownQuota: prev?.shownQuota ?? new Float32Array(4).fill(-1),
      shownLoad: prev?.shownLoad ?? new Int8Array(4).fill(-1),
      shownSession: prev?.shownSession ?? new Float32Array(4).fill(-1),
      shownBadge: prev?.shownBadge ?? ["", "", "", ""],
      pos: new Float32Array(2),
      ranks: rankLanes(lanes, st),
    };
    sim.current = s;
    // Track highlights stay as rendered (the static first pick); the loop takes them over.
    for (const node of el.current.packets) node?.setAttribute("opacity", "0");
  }, []);

  // A new strategy or a new geometry starts the demo afresh.
  useEffect(() => {
    resetSim(strategy);
  }, [strategy, geo, resetSim]);

  /* ---- packets ---- */
  const spawn = useCallback(
    (
      kind: number,
      lane: number,
      src: ArrayLike<number>,
      from: number,
      count: number,
      now: number
    ) => {
      const s = sim.current;
      if (!s) return -1;
      let p = -1;
      for (let i = 0; i < POOL; i++) {
        if (!s.active[i]) {
          p = i;
          break;
        }
      }
      if (p < 0) return -1;
      const n = Math.min(count, MAX_PTS);
      const base = p * MAX_PTS * 2;
      for (let k = 0; k < n * 2; k++) s.pts[base + k] = src[from * 2 + k];
      s.npts[p] = n;
      s.active[p] = 1;
      s.kind[p] = kind;
      s.lane[p] = lane;
      s.slot[p] = -1;
      s.chainAt[p] = 0;
      s.chain[p * 3] = -1;
      s.start[p] = now;
      const speed = compactSpeed(live.current.geo.L.w);
      s.dur[p] = Math.max(240, (polylineLength(s.pts, base, n) / speed) * 1000);
      const node = el.current.packets[p];
      if (node) {
        node.setAttribute("data-kind", KIND_NAMES[kind] ?? "req");
        node.setAttribute("opacity", "0");
      }
      if (kind === KIND_REQ && lane >= 0) s.lanes[lane].load += 1;
      return p;
    },
    []
  );

  /**
   * A packet handed from one card to another along the pair's arc: the arc
   * lights for the trip, then the receiving card (its track carries nothing,
   * so it stays dark: a chain reads as one lit lane and a cascade of arcs).
   */
  const handOff = useCallback(
    (kind: number, from: number, to: number, now: number) => {
      const s = sim.current;
      if (!s) return -1;
      const g = live.current.geo;
      const pair = from * 4 + to;
      const q = spawn(kind, to, g.hops, pair * HOP_POINTS, HOP_POINTS, now);
      if (q < 0) return q;
      const until = now + s.dur[q];
      s.cardUntil[to] = Math.max(s.cardUntil[to], until + HOT_MS);
      const k = s.hopNext;
      s.hopNext = (s.hopNext + 1) % HOP_POOL;
      s.hopUntil[k] = until + HOP_LINGER_MS;
      const node = el.current.hop[k];
      if (node) {
        node.setAttribute("d", g.hopPaths[pair]);
        node.setAttribute("data-hot", "");
      }
      return q;
    },
    [spawn]
  );

  const request = useCallback(
    (now: number, fromHub: boolean) => {
      const s = sim.current;
      if (!s) return;
      const { strategy: name, geo: g } = live.current;
      const world = getWorld();
      s.st.autoWeights = { factorIds: world.factorIds, weights: world.weights };
      // Auto's ranking as the pick sees it, so the lit lane is always its #1.
      if (name === "auto") s.ranks = rankLanes(s.lanes, s.st);
      const result: StratPick = pick(name, s.lanes, s.st, s.rng);
      if (result.kind === "chain") {
        // A pipeline lights its stages one after another, as the packet reaches them.
        const first = LANE_INDEX[result.to[0]];
        s.hotUntil[first] = now + HOT_MS;
        s.cardUntil[first] = now + HOT_MS;
      } else {
        for (const id of pickTargets(result)) {
          s.hotUntil[LANE_INDEX[id]] = now + HOT_MS;
          s.cardUntil[LANE_INDEX[id]] = now + HOT_MS;
        }
      }
      // Badges change only with a pick (counts, auto's ranking).
      for (let i = 0; i < 4; i++) {
        const badge = badgeText(name, s.lanes[i], i, s.st, name === "auto" ? s.ranks : null, plain);
        if (badge !== s.shownBadge[i]) {
          s.shownBadge[i] = badge;
          const node = el.current.badge[i];
          if (node) node.textContent = badge;
        }
      }
      const start = fromHub ? 1 : 0;
      const len = 9 - start;
      if (result.kind === "single") {
        const i = LANE_INDEX[result.to];
        spawn(KIND_REQ, i, g.polys[i], start, len, now);
      } else if (result.kind === "fanout") {
        const slot = s.fusionNext;
        s.fusionNext = (s.fusionNext + 1) % s.fusionLeft.length;
        s.fusionLeft[slot] = 0;
        for (const id of result.to) {
          const i = LANE_INDEX[id];
          const p = spawn(KIND_REQ, i, g.polys[i], start, len, now);
          if (p >= 0) {
            s.slot[p] = slot;
            s.fusionLeft[slot] += 1;
          }
        }
      } else if (result.kind === "chain") {
        const first = LANE_INDEX[result.to[0]];
        const p = spawn(KIND_REQ, first, g.polys[first], start, len, now);
        if (p >= 0) {
          for (let k = 0; k < 3; k++) {
            s.chain[p * 3 + k] = k < result.to.length ? LANE_INDEX[result.to[k]] : -1;
          }
          s.chainAt[p] = 0;
        }
      } else {
        const from = LANE_INDEX[result.from];
        const to = LANE_INDEX[result.to];
        handOff(KIND_SUMMARY, from, to, now);
        spawn(KIND_REQ, to, g.polys[to], start, len, now);
      }
    },
    [spawn, handOff, plain]
  );

  const arrive = useCallback(
    (p: number, now: number) => {
      const s = sim.current;
      if (!s) return;
      const g = live.current.geo;
      const kind = s.kind[p];
      const lane = s.lane[p];
      s.active[p] = 0;
      el.current.packets[p]?.setAttribute("opacity", "0");
      if (kind === KIND_REQ && lane >= 0 && !s.lanes[lane].healthy) {
        // Every lane is down (the strategy fell back to the first): it fails there and drops.
        s.lanes[lane].load = Math.max(0, s.lanes[lane].load - 1);
        const door = live.current.geo.polys[lane];
        BOUNCE[0] = door[16];
        BOUNCE[1] = door[17];
        BOUNCE[2] = g.L.judge.x;
        BOUNCE[3] = g.L.judge.y;
        const q = spawn(KIND_BOUNCE, lane, BOUNCE, 0, 2, now);
        if (q >= 0) s.slot[q] = NO_RETRY;
      } else if (kind === KIND_REQ && lane >= 0) {
        const target = s.lanes[lane];
        target.load = Math.max(0, target.load - 1);
        target.quota = Math.max(0, target.quota - DRAIN);
        s.flash[lane] = 1;
        const slot = s.slot[p];
        if (slot >= 0) {
          // Fusion: the reply runs back up the lane to the judge.
          const poly = g.polys[lane];
          REPLY.fill(0);
          for (let k = 0; k < 8; k++) {
            const src = 8 - k;
            REPLY[k * 2] = poly[src * 2];
            REPLY[k * 2 + 1] = poly[src * 2 + 1];
          }
          const q = spawn(KIND_REPLY, lane, REPLY, 0, 8, now);
          if (q >= 0) s.slot[q] = slot;
          else s.fusionLeft[slot] -= 1;
        }
        const at = s.chainAt[p];
        const next = at < 2 ? s.chain[p * 3 + at + 1] : -1;
        if (next >= 0 && s.lanes[next].healthy) {
          const q = handOff(KIND_REQ, lane, next, now);
          if (q >= 0) {
            for (let k = 0; k < 3; k++) s.chain[q * 3 + k] = s.chain[p * 3 + k];
            s.chainAt[q] = at + 1;
          }
        }
      } else if (kind === KIND_REPLY) {
        const slot = s.slot[p];
        if (slot >= 0) {
          s.fusionLeft[slot] -= 1;
          if (s.fusionLeft[slot] <= 0) {
            MERGED[0] = g.L.judge.x;
            MERGED[1] = g.L.judge.y;
            MERGED[2] = g.L.source.x;
            MERGED[3] = g.L.source.y;
            spawn(KIND_MERGED, -1, MERGED, 0, 2, now);
          }
        }
      } else if (kind === KIND_SUMMARY && lane >= 0) {
        s.flash[lane] = Math.max(s.flash[lane], 0.7);
      } else if (kind === KIND_BOUNCE && s.slot[p] !== NO_RETRY) {
        // Back at the hub: retry the strategy's next target.
        request(now, true);
      }
    },
    [spawn, handOff, request]
  );

  // A lane failing: packets on their way to it bounce back to the hub.
  const failedKey = failed.join();
  useEffect(() => {
    const s = sim.current;
    if (!s) return;
    const g = live.current.geo;
    const now = performance.now();
    for (let i = 0; i < 4; i++) s.lanes[i].healthy = !failed[i];
    for (let p = 0; p < POOL; p++) {
      if (!s.active[p] || s.kind[p] !== KIND_REQ) continue;
      const lane = s.lane[p];
      if (lane < 0 || !failed[lane]) continue;
      const u = clamp01((now - s.start[p]) / s.dur[p]);
      polylineAt(s.pts, p * MAX_PTS * 2, s.npts[p], u, s.pos);
      BOUNCE[0] = s.pos[0];
      BOUNCE[1] = s.pos[1];
      BOUNCE[2] = g.L.judge.x;
      BOUNCE[3] = g.L.judge.y;
      const slot = s.slot[p];
      s.lanes[lane].load = Math.max(0, s.lanes[lane].load - 1);
      s.active[p] = 0;
      const q = spawn(KIND_BOUNCE, lane, BOUNCE, 0, 2, now);
      if (slot >= 0) s.fusionLeft[slot] -= 1;
      if (q < 0) request(now, true);
    }
  }, [failedKey, failed, spawn, request]);

  useDomLoop(
    "routing-lanes",
    (dt, now) => {
      const s = sim.current;
      if (!s) return;
      const { strategy: name } = live.current;

      s.acc += dt;
      if (s.acc >= RATE_S) {
        s.acc -= RATE_S;
        if (s.acc > RATE_S) s.acc = 0;
        request(now, false);
      }

      // Packets.
      for (let p = 0; p < POOL; p++) {
        if (!s.active[p]) continue;
        const u = (now - s.start[p]) / s.dur[p];
        if (u >= 1) {
          arrive(p, now);
          continue;
        }
        polylineAt(s.pts, p * MAX_PTS * 2, s.npts[p], u, s.pos);
        const node = el.current.packets[p];
        if (node) {
          node.setAttribute(
            "transform",
            `translate(${Math.round(s.pos[0] * 10) / 10} ${Math.round(s.pos[1] * 10) / 10})`
          );
          node.setAttribute("opacity", u < 0.06 ? String(Math.round((u / 0.06) * 100) / 100) : "1");
        }
      }

      // Gauges.
      for (let i = 0; i < 4; i++) {
        const lane = s.lanes[i];
        if (lane.healthy) lane.quota = Math.min(1, lane.quota + REGEN_PER_S * dt);
        if (Math.abs(lane.quota - s.shownQuota[i]) > 0.004) {
          s.shownQuota[i] = lane.quota;
          el.current.quota[i]?.setAttribute(
            "transform",
            `scale(${Math.round(lane.quota * 1000) / 1000} 1)`
          );
        }
        const load = Math.min(3, lane.load);
        if (load !== s.shownLoad[i]) {
          s.shownLoad[i] = load;
          for (let k = 0; k < 3; k++) {
            el.current.dots[i * 3 + k]?.setAttribute("data-on", k < load ? "1" : "0");
          }
        }
        const session =
          name === "context-relay" && s.st.sessionLane === LANE_IDS[i] ? s.st.session : 0;
        if (Math.abs(session - s.shownSession[i]) > 0.001) {
          s.shownSession[i] = session;
          el.current.session[i]?.setAttribute("transform", `scale(${session} 1)`);
        }
        if (s.flash[i] > 0) {
          s.flash[i] = Math.max(0, s.flash[i] - dt * 2.6);
          el.current.flash[i]?.setAttribute("opacity", String(Math.round(s.flash[i] * 70) / 100));
        }
        // The lane taking traffic right now: its track and its card's outline.
        toggleAttr(el.current.track[i], "data-hot", now < s.hotUntil[i]);
        toggleAttr(el.current.card[i], "data-target", now < s.cardUntil[i]);
      }

      // Hand-off arcs fade once their packet has arrived.
      for (let k = 0; k < HOP_POOL; k++) {
        if (s.hopUntil[k] > 0 && now >= s.hopUntil[k]) {
          s.hopUntil[k] = 0;
          el.current.hop[k]?.removeAttribute("data-hot");
        }
      }
    },
    { target: figRef, enabled: motion }
  );

  const toggleLane = (i: number) => {
    onInteract();
    setFailed((prev) => prev.map((v, k) => (k === i ? !v : v)));
  };

  /* ---- render ---- */
  const staticTargets = new Set(staticView.targets);
  // A chain's packet travels only its first lane's track; the other stages are reached by arcs.
  const staticTracks =
    staticView.first.kind === "chain" ? new Set(staticView.first.to.slice(0, 1)) : staticTargets;
  const staticSessionLane = strategy === "context-relay" ? staticView.st.sessionLane : null;
  const cacheLane = staticView.lanes.findIndex((lane) => lane.cached);
  const pad = compact ? 8 : 10;
  const barW = compact ? 46 : 84;
  // The static pick's hand-offs (a pipeline's chain), drawn lit without a loop.
  const staticHops: number[] = [];
  if (staticView.first.kind === "chain") {
    const chain = staticView.first.to;
    for (let k = 0; k + 1 < chain.length && staticHops.length < HOP_POOL; k++) {
      staticHops.push(LANE_INDEX[chain[k]] * 4 + LANE_INDEX[chain[k + 1]]);
    }
  }
  return (
    <div className="rt-lanes" data-strategy={strategy} data-compact={compact ? "" : undefined}>
      <div ref={figRef} className="rt-lanes-figure">
        <svg
          className="rt-lanes-svg"
          viewBox={`0 0 ${L.w} ${L.h}`}
          width={L.w}
          height={L.h}
          aria-hidden="true"
          focusable="false"
        >
          {/* trunk: source → hub */}
          <line
            className="rt-trunk"
            x1={L.source.x}
            y1={L.source.y}
            x2={L.judge.x}
            y2={L.judge.y}
          />
          {LANE_IDS.map((id, i) => (
            <path
              key={id}
              ref={(node) => {
                el.current.track[i] = node;
              }}
              className="rt-track-path"
              d={geo.paths[i]}
              data-failed={failed[i] ? "" : undefined}
              data-hot={staticTracks.has(id) ? "" : undefined}
            />
          ))}
          {/* hand-off arcs: pipeline stages and relay summaries (the loop sets their paths) */}
          {Array.from({ length: HOP_POOL }, (_, k) => (
            <path
              key={k}
              ref={(node) => {
                el.current.hop[k] = node;
              }}
              className="rt-hop"
              d={staticHops[k] !== undefined ? geo.hopPaths[staticHops[k]] : undefined}
              data-hot={staticHops[k] !== undefined ? "" : undefined}
            />
          ))}

          {/* source and hub / judge */}
          <g className="rt-source" transform={`translate(${L.source.x} ${L.source.y})`}>
            <circle r={compact ? 12 : 14} className="rt-source-ring" />
            <circle r={compact ? 4 : 5} className="rt-source-core" />
          </g>
          <g className="rt-hub" transform={`translate(${L.judge.x} ${L.judge.y})`}>
            <circle r="3.5" className="rt-hub-dot" />
            <g className="rt-judge">
              <circle r={compact ? 13 : 15} className="rt-judge-ring" />
              <g transform="translate(-8 -8)">
                <Glyph name="scales" size={16} tone="current" className="rt-judge-glyph" />
              </g>
            </g>
          </g>

          {/* lane cards */}
          {staticView.lanes.map((lane, i) => {
            const y = L.laneY[i] - L.cardH / 2;
            const x = L.cardX;
            // Row 1: id, health LED, cost, context window. Row 2: quota bar, load dots, badge.
            const top = y + (compact ? 16 : 18);
            const bottom = y + L.cardH - (compact ? 11 : 13);
            const id = LANE_IDS[i];
            const isFailed = failed[i];
            const qx = x + pad;
            const costX = x + pad + (compact ? 26 : 30);
            const ctxX = x + L.cardW - pad;
            const dotsX = qx + barW + (compact ? 10 : 14);
            return (
              <g
                key={id}
                ref={(node) => {
                  el.current.card[i] = node;
                }}
                className="rt-card"
                data-failed={isFailed ? "" : undefined}
                data-target={staticTargets.has(id) ? "" : undefined}
              >
                <rect className="rt-card-box" x={x} y={y} width={L.cardW} height={L.cardH} rx="7" />
                <rect
                  ref={(node) => {
                    el.current.flash[i] = node;
                  }}
                  className="rt-card-flash"
                  x={x}
                  y={y}
                  width={L.cardW}
                  height={L.cardH}
                  rx="7"
                  opacity="0"
                />
                <text className="rt-card-id" x={x + pad} y={top}>
                  {id}
                </text>
                <circle
                  className="rt-led"
                  cx={x + pad + (compact ? 16 : 18)}
                  cy={top - 4.5}
                  r="3.5"
                />
                {/* cost */}
                <text className="rt-cost" x={costX} y={top}>
                  {[1, 2, 3].map((k) => (
                    <tspan key={k} data-on={k <= lane.cost ? "1" : "0"}>
                      $
                    </tspan>
                  ))}
                </text>
                {/* context window */}
                <text className="rt-ctx" x={ctxX} y={top} textAnchor="end">
                  {ctxLabel(lane.ctx)}
                </text>
                {/* quota bar */}
                <rect
                  className="rt-quota-track"
                  x={qx}
                  y={bottom - 2.5}
                  width={barW}
                  height="5"
                  rx="2.5"
                />
                <g transform={`translate(${qx} ${bottom - 2.5})`}>
                  <rect
                    ref={(node) => {
                      el.current.quota[i] = node;
                    }}
                    className="rt-quota-fill"
                    width={barW}
                    height="5"
                    rx="2.5"
                    transform={`scale(${lane.quota} 1)`}
                  />
                </g>
                {/* load dots */}
                {[0, 1, 2].map((k) => (
                  <circle
                    key={k}
                    ref={(node) => {
                      el.current.dots[i * 3 + k] = node;
                    }}
                    className="rt-load-dot"
                    cx={dotsX + k * 9}
                    cy={bottom}
                    r="2.6"
                    data-on={k < Math.min(3, lane.load) ? "1" : "0"}
                  />
                ))}
                {/* strategy badge: auto rank, weight, request count */}
                <text
                  ref={(node) => {
                    el.current.badge[i] = node;
                  }}
                  className="rt-badge-text"
                  x={ctxX}
                  y={bottom + 4.5}
                  textAnchor="end"
                >
                  {badgeText(strategy, lane, i, staticView.st, staticView.autoRanks, plain)}
                </text>
                {/* context-relay session gauge */}
                <g transform={`translate(${x + 3} ${y + L.cardH - 4})`}>
                  <rect
                    ref={(node) => {
                      el.current.session[i] = node;
                    }}
                    className="rt-session"
                    width={L.cardW - 6}
                    height="2.5"
                    rx="1.25"
                    transform={`scale(${staticSessionLane === id ? staticView.st.session : 0} 1)`}
                  />
                </g>
                {/* cache-optimized prefix tab */}
                {i === cacheLane ? (
                  <g
                    className="rt-prefix"
                    transform={`translate(${door - dir * (compact ? 13 : 15)} ${L.laneY[i] - 9})`}
                  >
                    <rect x="-5" y="0" width="10" height="18" rx="2" />
                    <path d="M-2.5 5H2.5M-2.5 9H2.5M-2.5 13H1" />
                  </g>
                ) : null}
                {/* failure: ✕ over the card */}
                {isFailed ? (
                  <path
                    className="rt-card-x"
                    d={`M${x + L.cardW / 2 - 7} ${L.laneY[i] - 7}l14 14m0 -14l-14 14`}
                  />
                ) : null}
              </g>
            );
          })}

          {/* packet pool */}
          {Array.from({ length: POOL }, (_, p) => (
            <g
              key={p}
              ref={(node) => {
                el.current.packets[p] = node;
              }}
              className="rt-pk"
              opacity="0"
            >
              <circle className="rt-pk-dot" r="3.6" />
              <rect className="rt-pk-doc" x="-4" y="-4" width="8" height="8" rx="1.5" />
            </g>
          ))}
        </svg>

        {/* lane switches over each track and card: tap to fail, tap again to restore */}
        <div className="rt-lane-buttons">
          {LANE_IDS.map((id, i) => {
            const lane = staticView.lanes[i];
            const gap = L.laneY[1] - L.laneY[0];
            return (
              <button
                key={id}
                type="button"
                className="rt-lane-btn"
                aria-pressed={failed[i]}
                aria-label={t("heroToggleAria", {
                  down: String(failed[i]),
                  provider: `${id} (${"$".repeat(lane.cost)}, ${ctxLabel(lane.ctx)})`,
                })}
                aria-describedby={hintId}
                style={
                  {
                    "--left": `${pct(geo.span.x, L.w)}%`,
                    "--width": `${pct(geo.span.w, L.w)}%`,
                    "--top": `${pct(L.laneY[i] - gap / 2, L.h)}%`,
                    "--h": `${pct(gap, L.h)}%`,
                  } as CSSProperties
                }
                onClick={() => toggleLane(i)}
              />
            );
          })}
        </div>
      </div>
      <p className="rt-lanes-hint" id={hintId}>
        <SimBadge note={t("routingLaneFailHint")} />
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

const LANE_INDEX: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };
const REPLY = new Float32Array(16);
const MERGED = new Float32Array(4);
const BOUNCE = new Float32Array(4);

function compactSpeed(width: number): number {
  return width < 400 ? 250 : 340;
}

function pct(v: number, of: number): number {
  return Math.round((v / of) * 100000) / 1000;
}

/** Sets or clears a boolean attribute, touching the DOM only on change. */
function toggleAttr(node: Element | null | undefined, name: string, on: boolean): void {
  if (!node || node.hasAttribute(name) === on) return;
  if (on) node.setAttribute(name, "");
  else node.removeAttribute(name);
}

/** Auto's lane order (1 = first) under the deck's live weights. */
function rankLanes(lanes: readonly Lane[], st: StratState): number[] {
  const scored = lanes.map((lane, i) => ({
    i,
    s: lane.healthy ? autoScore(lane, lanes, st) : -1,
  }));
  scored.sort((a, b) => b.s - a.s || a.i - b.i);
  const out = [0, 0, 0, 0];
  scored.forEach((entry, r) => {
    out[entry.i] = r + 1;
  });
  return out;
}

function badgeText(
  strategy: string,
  lane: Lane,
  index: number,
  st: StratState,
  ranks: readonly number[] | null,
  format: Intl.NumberFormat
): string {
  switch (strategy) {
    case "auto":
      return ranks && lane.healthy ? `#${format.format(ranks[index])}` : "";
    case "weighted":
      return `×${format.format(lane.weight)}`;
    case "least-used":
    case "round-robin":
      return format.format(st.counts[LANE_IDS[index]] ?? 0);
    default:
      return "";
  }
}
