"use client";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type RefObject,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import { RTL_LOCALES } from "@/i18n/config";
import {
  A2A_ENDPOINTS,
  A2A_METHODS,
  A2A_SKILLS,
  INSTALL_COMMAND,
  MCP_ENDPOINTS,
  MCP_TRANSPORTS,
  type LandingStats,
} from "../../landingTypes";
import { usePrefersReducedMotion } from "../../landingMotion";
import { usePaused } from "../../runtime/heartbeat";
import { useDomLoop } from "../../runtime/useDomLoop";
import {
  Glyph,
  LiveNumber,
  SimBadge,
  Terminal,
  WordReveal,
  type TypeLineProps,
  type TypeToken,
} from "../primitives";
import { hasFinePointer, numberFormat, watchView } from "../primitives/primitiveKit";
import { a2aExchange, laneEntryRows, ledForPacket, ledGrid, ledPhase, ledWave } from "./benchModel";

/**
 * Part B of the engine room (spec §6.8): the MCP and A2A array.
 *
 * One flow: three transport waveguides (stdio, SSE, Streamable HTTP, with
 * their real endpoints) carry comet packets in rotation into an engraved
 * plate of exactly `stats.mcpTools` lights. On arrival the guide's port
 * flashes, a trace runs into the matrix (along the entry row, then down the
 * column; on a phone down the bus, then along the row) and the light it
 * reaches glows and fades like phosphor over a few seconds, so a trail of
 * lit lights is always on the plate. Beside it, the A2A agent card turns
 * slowly and flips to a log of real exchanges (`message/send`,
 * `message/stream`, `tasks/get`); a skill chip sends that skill's exchange.
 *
 * DOM only, no canvas; the loop writes transforms and opacity only.
 * Positions of lit lights are not a map of the real tools (`mcpSimNote`).
 * Reduced motion: static lights, numbers as text, both card faces side by
 * side.
 */

const LANES = [
  { name: MCP_TRANSPORTS[0], endpoint: `${INSTALL_COMMAND} --mcp` },
  { name: MCP_TRANSPORTS[1], endpoint: `GET ${MCP_ENDPOINTS.sse}` },
  { name: MCP_TRANSPORTS[2], endpoint: `POST ${MCP_ENDPOINTS.stream}` },
] as const;

const SLOTS_PER_LANE = 2;
const PACKET_S = 1.35;
const PACKET_GAP_S = 0.36;
/** A packet's box: the comet's tail plus its head (`.engine-packet` width). */
const PACKET_W = 44;
/** The two legs of a trace, then its fade (seconds). */
const LEG1_S = 0.16;
const LEG2_S = 0.14;
const TRACE_FADE_S = 0.6;
/** A port's flash decays with this time constant (seconds). */
const PORT_TAU_S = 0.16;
const FLIP_EVERY_S = 8;
/** After a visitor flips the card or taps a skill, the idle flips wait this long. */
const HOLD_AFTER_INPUT_S = 12;
/** The card's idle turn: one full swing every 12 s; ±8° on a mouse, ±4° on touch. */
const SWAY_PERIOD_S = 12;
const SWAY_DEG_FINE = 8;
const SWAY_DEG_COARSE = 4;
const TAU = Math.PI * 2;
/** Below this width the array is the phone layout: the lanes feed a bus into the plate's top. */
const PHONE_MAX = 767;

/** The exchange on the card's back, and the one before it (kept above as history). */
type Exchange = { seq: number; skill: number; prev: number; prevSeq: number };

type PacketPool = {
  clock: number;
  nextAt: number;
  nextLane: number;
  seq: number;
  active: Uint8Array;
  t: Float32Array;
  shown: Float32Array;
  laneLen: Float32Array;
  /* traces, one per lane: age (-1 idle), target light, lit yet */
  trAge: Float32Array;
  trLed: Int16Array;
  trLit: Uint8Array;
  port: Float32Array;
  portShown: Float32Array;
  /* plate geometry, measured on resize (never in the loop) */
  pitch: number;
  edge: number;
  gridW: number;
  gridH: number;
  phone: boolean;
};

/** The packet pool, created on first use (in an effect or the loop, never in render). */
function ensurePool(ref: RefObject<PacketPool | null>): PacketPool {
  if (!ref.current) {
    const slots = LANES.length * SLOTS_PER_LANE;
    ref.current = {
      clock: 0,
      nextAt: 0.2,
      nextLane: 0,
      seq: 0,
      active: new Uint8Array(slots),
      t: new Float32Array(slots),
      shown: new Float32Array(slots).fill(-1),
      laneLen: new Float32Array(LANES.length),
      trAge: new Float32Array(LANES.length).fill(-1),
      trLed: new Int16Array(LANES.length),
      trLit: new Uint8Array(LANES.length),
      port: new Float32Array(LANES.length),
      portShown: new Float32Array(LANES.length),
      pitch: 26,
      edge: 21,
      gridW: 0,
      gridH: 0,
      phone: false,
    };
  }
  return ref.current;
}

/**
 * Draws one leg of a trace: a 2px bar from `from` to `to` along `axis` at
 * `fixed` on the other axis, grown to `p` (0..1). Coordinates are inline px
 * from the light grid's inline-start edge and block px from its top; the
 * bar's transform origin is its inline-start/top corner (CSS).
 */
function writeLeg(
  el: HTMLElement,
  axis: "h" | "v",
  fixed: number,
  from: number,
  to: number,
  p: number,
  alpha: number,
  span: number,
  sign: number
): void {
  const reach = from + (to - from) * p;
  const lo = Math.min(from, reach);
  const len = Math.abs(reach - from);
  const scale = span > 0 ? len / span : 0;
  if (axis === "h") {
    el.style.transform = `translate3d(${(sign * lo).toFixed(1)}px,${(fixed - 1).toFixed(1)}px,0) scaleX(${scale.toFixed(4)})`;
  } else {
    el.style.transform = `translate3d(${(sign * (fixed - 1)).toFixed(1)}px,${lo.toFixed(1)}px,0) scaleY(${scale.toFixed(4)})`;
  }
  el.style.opacity = alpha.toFixed(2);
}

function lineTokens(text: string, dir: "out" | "in", method?: string, skill?: string): TypeToken[] {
  if (dir === "in")
    return [
      { t: "← ", c: "num" },
      { t: text.slice(2), c: "str" },
    ];
  const tokens: TypeToken[] = [{ t: "→ ", c: "accent" }];
  if (method) tokens.push({ t: method, c: "kw" });
  if (skill) tokens.push({ t: " · skill: " }, { t: skill, c: "str" });
  return tokens;
}

export default function ProtocolArray({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const rtl = (RTL_LOCALES as readonly string[]).includes(locale);
  const fmt = useCallback((n: number) => numberFormat(locale).format(n), [locale]);
  const reduced = usePrefersReducedMotion();
  const paused = usePaused();

  const count = Math.max(0, stats.mcpTools);
  const { cols, rows } = ledGrid(count);
  const entryRows = useMemo(() => laneEntryRows(rows, LANES.length), [rows]);

  /* ---- refs ---- */
  const arrayRef = useRef<HTMLDivElement>(null);
  const plateRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const guideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const packetRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const portRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const legRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const ledsRef = useRef<HTMLElement[]>([]);
  const pinnedRef = useRef<boolean[]>([false, false, false]);
  const poolRef = useRef<PacketPool | null>(null);

  const [pinned, setPinned] = useState(-1);

  /* ---- measure the waveguides and the plate (resize only, never in the loop) ---- */
  useEffect(() => {
    const guides = guideRefs.current;
    const grid = gridRef.current;
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const p = ensurePool(poolRef);
      for (const entry of entries) {
        const index = guides.indexOf(entry.target as HTMLDivElement);
        if (index >= 0) p.laneLen[index] = Math.max(0, entry.contentRect.width - PACKET_W);
        if (entry.target === grid && grid) {
          p.gridW = entry.contentRect.width;
          p.gridH = entry.contentRect.height;
          const plate = plateRef.current;
          if (plate) {
            const style = getComputedStyle(plate);
            p.pitch = parseFloat(style.getPropertyValue("--pitch")) || 26;
            p.edge = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.borderTopWidth) || 0);
          }
          p.phone = window.matchMedia(`(max-width: ${PHONE_MAX}px)`).matches;
        }
      }
    });
    for (const guide of guides) if (guide) observer.observe(guide);
    if (grid) observer.observe(grid);
    return () => observer.disconnect();
  }, []);

  /* ---- the lights, collected once ---- */
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    ledsRef.current = Array.from(grid.querySelectorAll<HTMLElement>(".engine-led"));
  }, [count]);

  /* ---- power-on: a diagonal wave across the plate when it scrolls in; the sheen runs near view ---- */
  useEffect(() => {
    const plate = plateRef.current;
    if (!plate) return;
    if (reduced) {
      plate.removeAttribute("data-power");
      return;
    }
    if (plate.getBoundingClientRect().top > window.innerHeight) {
      plate.setAttribute("data-power", "armed");
    }
    return watchView(plate, {
      enterThreshold: 0.2,
      onNear: () => plate.setAttribute("data-run", ""),
      onFar: () => plate.removeAttribute("data-run"),
      onEnter: () => {
        if (plate.hasAttribute("data-power")) plate.setAttribute("data-power", "on");
      },
    });
  }, [reduced]);

  /* ---- packets ride the lanes in rotation; each arrival traces into the plate and lights one light ---- */
  const light = useCallback((index: number) => {
    const led = ledsRef.current[index];
    if (!led) return;
    led.setAttribute("data-hit", led.getAttribute("data-hit") === "a" ? "b" : "a");
  }, []);

  useDomLoop(
    "engine-mcp-packets",
    (dt) => {
      const p = ensurePool(poolRef);
      p.clock += dt;
      if (p.clock >= p.nextAt) {
        p.nextAt = p.clock + PACKET_GAP_S;
        for (let tries = 0; tries < LANES.length; tries++) {
          const lane = p.nextLane;
          p.nextLane = (lane + 1) % LANES.length;
          if (pinnedRef.current[lane]) continue;
          let launched = false;
          for (let j = 0; j < SLOTS_PER_LANE; j++) {
            const slot = lane * SLOTS_PER_LANE + j;
            if (p.active[slot]) continue;
            p.active[slot] = 1;
            p.t[slot] = 0;
            launched = true;
            break;
          }
          if (launched) break;
        }
      }
      const sign = rtl ? -1 : 1;

      /* packets */
      for (let slot = 0; slot < p.active.length; slot++) {
        const el = packetRefs.current[slot];
        if (!el) continue;
        const lane = Math.floor(slot / SLOTS_PER_LANE);
        if (!p.active[slot]) {
          if (p.shown[slot] !== -1) {
            p.shown[slot] = -1;
            el.style.opacity = "0";
          }
          continue;
        }
        if (!pinnedRef.current[lane]) p.t[slot] += dt / PACKET_S;
        const progress = p.t[slot];
        if (progress >= 1) {
          // Arrival: the port flashes and a trace starts towards this packet's light.
          p.active[slot] = 0;
          p.port[lane] = 1;
          p.trAge[lane] = 0;
          p.trLit[lane] = 0;
          p.trLed[lane] = ledForPacket(p.seq++, count);
          continue;
        }
        const x = Math.round(progress * p.laneLen[lane] * 2) / 2;
        if (x === p.shown[slot]) continue;
        p.shown[slot] = x;
        const fade = Math.min(1, progress * 8, (1 - progress) * 14);
        el.style.transform = `translate3d(${sign * x}px,0,0)`;
        el.style.opacity = fade.toFixed(2);
      }

      /* ports */
      const decay = Math.exp(-dt / PORT_TAU_S);
      for (let lane = 0; lane < LANES.length; lane++) {
        p.port[lane] *= decay;
        const level = p.port[lane] < 0.02 ? 0 : Math.round(p.port[lane] * 50) / 50;
        if (level === p.portShown[lane]) continue;
        p.portShown[lane] = level;
        const port = portRefs.current[lane];
        if (port) port.style.opacity = String(level);
      }

      /* traces: two legs into the matrix, then a fade; the light glows when the trace reaches it */
      const P = p.pitch;
      for (let lane = 0; lane < LANES.length; lane++) {
        const age = p.trAge[lane];
        if (age < 0) continue;
        const legH = legRefs.current[lane * 2];
        const legV = legRefs.current[lane * 2 + 1];
        const nextAge = age + dt;
        p.trAge[lane] = nextAge;
        const led = p.trLed[lane];
        if (!legH || !legV || led < 0) {
          p.trAge[lane] = -1;
          continue;
        }
        // (ledCell, inlined: no allocation in the loop)
        const row = Math.floor(led / cols);
        const col = led - row * cols;
        const cx = (col + 0.5) * P;
        const cy = (row + 0.5) * P;
        const p1 = Math.min(1, nextAge / LEG1_S);
        const p2 = Math.min(1, Math.max(0, (nextAge - LEG1_S) / LEG2_S));
        const reached = nextAge >= LEG1_S + LEG2_S;
        if (reached && !p.trLit[lane]) {
          p.trLit[lane] = 1;
          light(led);
        }
        const fade = reached ? Math.max(0, 1 - (nextAge - LEG1_S - LEG2_S) / TRACE_FADE_S) : 1;
        if (fade <= 0) {
          p.trAge[lane] = -1;
          legH.style.opacity = "0";
          legV.style.opacity = "0";
          continue;
        }
        if (p.phone) {
          // Down the bus at the last column, then along the light's row.
          const busX = (cols - 0.5) * P;
          writeLeg(legV, "v", busX, -p.edge, cy, p1, fade, p.gridH, sign);
          writeLeg(legH, "h", cy, busX, cx, p2, p2 > 0 ? fade : 0, p.gridW, sign);
        } else {
          // Along the lane's entry row from the plate's edge, then up or down the light's column.
          const ey = (entryRows[lane] + 0.5) * P;
          writeLeg(legH, "h", ey, -p.edge, cx, p1, fade, p.gridW, sign);
          writeLeg(legV, "v", cx, ey, cy, p2, p2 > 0 ? fade : 0, p.gridH, sign);
        }
      }
    },
    { target: arrayRef, enabled: !reduced }
  );

  const pinLane = (lane: number, on: boolean) => {
    pinnedRef.current[lane] = on;
    setPinned((current) => (on ? lane : current === lane ? -1 : current));
  };

  /* ---- the A2A card ---- */
  const cardRef = useRef<HTMLDivElement>(null);
  const swayRef = useRef<HTMLDivElement>(null);
  const returnRef = useRef<HTMLButtonElement>(null);
  const chipRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [exchange, setExchange] = useState<Exchange>({ seq: 0, skill: 4, prev: 3, prevSeq: -1 });
  const hoverRef = useRef(false);
  const focusRef = useRef(false);
  const autoRef = useRef({ t: 0, hold: 0 });
  const swayState = useRef({ phase: 0, amp: 0, shown: 0, max: SWAY_DEG_FINE });
  const flippedRef = useRef(flipped);
  const lastChipRef = useRef(0);
  const moveFocusRef = useRef(false);
  useEffect(() => {
    flippedRef.current = flipped;
  }, [flipped]);

  const backShown = flipped && !reduced;

  /** Flip the card; if focus is inside it, it follows to the face that is now shown. */
  const flipTo = useCallback((next: boolean) => {
    const card = cardRef.current;
    moveFocusRef.current = !!card && card.contains(document.activeElement);
    setFlipped(next);
  }, []);

  // The hidden face is `inert`, which drops focus: put it on the shown face instead.
  useLayoutEffect(() => {
    if (!moveFocusRef.current) return;
    moveFocusRef.current = false;
    const target = backShown
      ? returnRef.current
      : (chipRefs.current[lastChipRef.current] ?? chipRefs.current[0]);
    target?.focus({ preventScroll: true });
  }, [backShown]);

  const nextExchange = (skill?: number) =>
    setExchange((e) => ({
      seq: e.seq + 1,
      skill: skill ?? (e.skill + 1) % A2A_SKILLS.length,
      prev: e.skill,
      prevSeq: e.seq,
    }));

  useEffect(() => {
    swayState.current.max = hasFinePointer() ? SWAY_DEG_FINE : SWAY_DEG_COARSE;
  }, []);

  // Pause and reduced motion stop the loop: stand the card upright.
  useEffect(() => {
    if (!paused && !reduced) return;
    const sway = swayState.current;
    sway.amp = 0;
    sway.shown = 0;
    if (swayRef.current) swayRef.current.style.transform = "";
  }, [paused, reduced]);

  useDomLoop(
    "engine-a2a-card",
    (dt) => {
      // The slow turn: eases to upright while the card is flipped, hovered or focused,
      // so its text is never soft while someone reads or uses it.
      const sway = swayState.current;
      const still = hoverRef.current || focusRef.current || flippedRef.current;
      // Settles upright quickly; starts swinging again gently.
      sway.amp += ((still ? 0 : sway.max) - sway.amp) * Math.min(1, dt * (still ? 5 : 1.5));
      sway.phase = (sway.phase + dt) % SWAY_PERIOD_S;
      const angle =
        still && sway.amp < 0.03 ? 0 : sway.amp * Math.sin((sway.phase / SWAY_PERIOD_S) * TAU);
      const rounded = Math.round(angle * 100) / 100;
      if (rounded !== sway.shown && swayRef.current) {
        sway.shown = rounded;
        swayRef.current.style.transform = rounded === 0 ? "" : `rotateY(${rounded}deg)`;
      }

      // The idle flip, every 8 s, suspended while the card is hovered or holds focus.
      const auto = autoRef.current;
      if (auto.hold > 0) {
        auto.hold -= dt;
        return;
      }
      if (hoverRef.current || focusRef.current) return;
      auto.t += dt;
      if (auto.t < FLIP_EVERY_S) return;
      auto.t = 0;
      if (flippedRef.current) {
        flipTo(false);
      } else {
        nextExchange();
        flipTo(true);
      }
    },
    { target: cardRef, enabled: !reduced }
  );

  const holdAuto = () => {
    autoRef.current.hold = HOLD_AFTER_INPUT_S;
    autoRef.current.t = 0;
  };

  const sendSkill = (skill: number) => {
    holdAuto();
    lastChipRef.current = skill;
    nextExchange(skill);
    flipTo(true);
  };

  const onCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if (reduced) return;
    const target = event.target as Element;
    if (target.closest("button, a, .term-pre")) return;
    holdAuto();
    if (!flipped) nextExchange();
    flipTo(!flipped);
  };

  const onCardBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) focusRef.current = false;
  };

  const exchangeLines = useMemo<TypeLineProps[]>(() => {
    // The previous exchange stays above as history, dimmed: its request and how it ended.
    const before = a2aExchange(A2A_SKILLS[exchange.prev], Math.abs(exchange.prevSeq), A2A_METHODS);
    const ended = before.find((line) => line.text === "← completed") ?? before[before.length - 1];
    const history = [before[0], ended];
    const current = a2aExchange(A2A_SKILLS[exchange.skill], exchange.seq, A2A_METHODS);
    return [
      ...history.map((line, i) => ({
        id: `p${i}`,
        text: line.text,
        tokens: lineTokens(line.text, line.dir, line.method, line.skill),
        cps: 4000,
        className: "engine-log-old",
      })),
      ...current.map((line, i) => ({
        id: `a${i}`,
        text: line.text,
        tokens: lineTokens(line.text, line.dir, line.method, line.skill),
        caret: i === current.length - 1,
      })),
    ];
  }, [exchange]);

  const numerals = [
    { value: stats.mcpTools, label: t("protocolsMcpTools") },
    { value: stats.mcpScopes, label: t("protocolsMcpScopes") },
    { value: stats.mcpTransports, label: t("protocolsMcpTransports") },
  ];

  const laneVars = {
    "--entry0": entryRows[0],
    "--entry-step": entryRows.length > 1 ? entryRows[1] - entryRows[0] : 3,
  } as CSSProperties;

  return (
    <div className="engine-proto station-inner">
      <span className="engine-proto-rule" aria-hidden="true">
        <Glyph name="star4" size={16} />
      </span>
      <div ref={arrayRef} className="engine-array">
        <div className="engine-proto-head">
          <WordReveal
            as="h2"
            id="engine-protocols-title"
            className="station-title serif-display"
            lines={[t("protocolsTitle")]}
          />
          <p className="station-lead">{t("protocolsLead")}</p>
        </div>

        {/* ---- transport waveguides ---- */}
        <div className="engine-lanes" style={laneVars}>
          {LANES.map((lane, i) => (
            <div
              key={lane.name}
              className="engine-lane"
              data-pinned={pinned === i ? "" : undefined}
              onPointerEnter={() => pinLane(i, true)}
              onPointerLeave={() => pinLane(i, false)}
            >
              <p className="engine-lane-label">
                <span className="engine-lane-name" dir="ltr">
                  {lane.name}
                </span>
                <code className="engine-lane-end" dir="ltr">
                  {lane.endpoint}
                </code>
              </p>
              <div
                className="engine-guide"
                ref={(node) => {
                  guideRefs.current[i] = node;
                }}
                aria-hidden="true"
              >
                {Array.from({ length: SLOTS_PER_LANE }, (_, j) => (
                  <span
                    key={j}
                    className="engine-packet"
                    ref={(node) => {
                      packetRefs.current[i * SLOTS_PER_LANE + j] = node;
                    }}
                  />
                ))}
                <span
                  className="engine-port"
                  ref={(node) => {
                    portRefs.current[i] = node;
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ---- the plate: one light per MCP tool ---- */}
        <div
          ref={plateRef}
          className="engine-plate"
          style={{ "--cols": cols, "--rows": rows } as CSSProperties}
          aria-hidden="true"
        >
          <span className="engine-screw" />
          <span className="engine-screw" />
          <span className="engine-screw" />
          <span className="engine-screw" />
          <span className="engine-sheen" />
          <div ref={gridRef} className="engine-leds">
            {Array.from({ length: count }, (_, i) => (
              <span
                key={i}
                className="engine-led"
                style={{ "--w": ledWave(i, cols, rows), "--b": ledPhase(i) } as CSSProperties}
              >
                <i />
              </span>
            ))}
            {LANES.map((lane, i) => (
              <span key={lane.name} className="engine-traces">
                <span
                  className="engine-leg"
                  data-axis="h"
                  ref={(node) => {
                    legRefs.current[i * 2] = node;
                  }}
                />
                <span
                  className="engine-leg"
                  data-axis="v"
                  ref={(node) => {
                    legRefs.current[i * 2 + 1] = node;
                  }}
                />
              </span>
            ))}
          </div>
        </div>

        {/* ---- the real figures ---- */}
        <dl className="engine-nums">
          {numerals.map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>
                <LiveNumber value={item.value} mode="roll" className="engine-num" />
              </dd>
            </div>
          ))}
        </dl>

        <div className="engine-mcp">
          <h3 className="engine-h3">{t("protocolsMcpTitle")}</h3>
          <p className="engine-copy">
            {t("protocolsMcpDesc", {
              tools: fmt(stats.mcpTools),
              scopes: fmt(stats.mcpScopes),
              transports: fmt(stats.mcpTransports),
            })}
          </p>
          <SimBadge note={t("mcpSimNote")} />
        </div>

        {/* ---- the A2A agent card ---- */}
        <div
          ref={cardRef}
          className="engine-a2a"
          data-flipped={backShown ? "" : undefined}
          onPointerEnter={() => {
            hoverRef.current = true;
          }}
          onPointerLeave={() => {
            hoverRef.current = false;
          }}
          onFocus={() => {
            focusRef.current = true;
          }}
          onBlur={onCardBlur}
        >
          <div ref={swayRef} className="engine-a2a-sway">
            <div className="engine-a2a-flip" onClick={onCardClick}>
              <div className="engine-a2a-face engine-a2a-front" inert={backShown}>
                <h3 className="engine-h3 engine-a2a-title">
                  {t("protocolsA2aTitle")}
                  <span className="engine-a2a-sep" aria-hidden="true">
                    ·
                  </span>
                  <span className="engine-a2a-rpc" dir="ltr">
                    JSON-RPC 2.0
                  </span>
                </h3>
                <p className="engine-copy">{t("protocolsA2aDesc")}</p>
                <ul className="engine-skills">
                  {A2A_SKILLS.map((skill, i) => (
                    <li key={skill}>
                      <button
                        type="button"
                        className="engine-skill"
                        dir="ltr"
                        ref={(node) => {
                          chipRefs.current[i] = node;
                        }}
                        aria-pressed={backShown && exchange.skill === i}
                        onClick={() => sendSkill(i)}
                      >
                        {skill}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="engine-a2a-ends" dir="ltr">
                  <code>POST {A2A_ENDPOINTS.rpc}</code>
                  <code>{A2A_ENDPOINTS.card}</code>
                </p>
              </div>
              <div className="engine-a2a-face engine-a2a-back" inert={!backShown && !reduced}>
                <Terminal
                  className="engine-a2a-term"
                  title={`POST ${A2A_ENDPOINTS.rpc}`}
                  lines={exchangeLines}
                  restartKey={exchange.seq}
                  footer={
                    <div className="engine-a2a-foot">
                      <SimBadge />
                      {reduced ? null : (
                        <button
                          type="button"
                          ref={returnRef}
                          className="engine-a2a-return"
                          onClick={() => {
                            holdAuto();
                            flipTo(false);
                          }}
                        >
                          <Glyph
                            name="arrow"
                            size={16}
                            tone="current"
                            className="engine-back-glyph"
                          />
                          {t("protocolsA2aTitle")}
                        </button>
                      )}
                    </div>
                  }
                />
              </div>
            </div>
          </div>
        </div>

        <p className="engine-docs">
          <Link href="/docs" className="engine-docs-link">
            {t("protocolsDocsLink")}
            <Glyph name="arrow" size={16} tone="current" />
          </Link>
        </p>
      </div>
    </div>
  );
}
