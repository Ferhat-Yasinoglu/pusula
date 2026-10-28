/**
 * Pure helpers behind the footer logbook (spec §6.10): no React, no DOM, no
 * clock. They run during render, so the server and the client must get the
 * same answers; `tests/unit/landing-footer.test.ts` pins them.
 */
import { round2 } from "../../landingGeometry";
import type { SpringConfig } from "../../runtime/springs";

/* ------------------------------------------------------------------------ */
/* The logbook line                                                         */
/* ------------------------------------------------------------------------ */

/** The three counters `logbookLine` interpolates, in no particular order. */
export const LOG_SLOTS = ["routed", "outages", "reroutes"] as const;
export type LogSlot = (typeof LOG_SLOTS)[number];

/**
 * Private-use characters handed to `t("logbookLine", …)` in place of the
 * numbers. They never occur in a translation, so the formatted sentence can
 * be cut at them and the live counters spliced back in, in whatever order the
 * locale puts them.
 */
export const LOG_SLOT_MARKS: Readonly<Record<LogSlot, string>> = {
  routed: "\uE000",
  outages: "\uE001",
  reroutes: "\uE002",
};

const SLOT_BY_MARK = new Map<string, LogSlot>(
  LOG_SLOTS.map((slot) => [LOG_SLOT_MARKS[slot], slot] as const)
);

export type LogPiece = { kind: "text"; text: string } | { kind: "slot"; slot: LogSlot };

/**
 * Cut a sentence formatted with `LOG_SLOT_MARKS` into text runs and counter
 * slots. Adjacent text is merged; a slot the translation does not use simply
 * does not appear; a mark that occurs twice yields two slots.
 */
export function splitLogLine(message: string): LogPiece[] {
  const pieces: LogPiece[] = [];
  let text = "";
  for (const ch of message) {
    const slot = SLOT_BY_MARK.get(ch);
    if (!slot) {
      text += ch;
      continue;
    }
    if (text) pieces.push({ kind: "text", text });
    text = "";
    pieces.push({ kind: "slot", slot });
  }
  if (text) pieces.push({ kind: "text", text });
  return pieces;
}

const NBSP = "\u00A0";
/** Spaces in front of the line's "·" separators. */
const BEFORE_SEPARATOR = / +·/g;

/**
 * Keep the line's entries whole when it wraps: the space after a counter is
 * made non-breaking ("23 requests" never splits), and so is the space before
 * each "·" separator ("routed ·"), so a line may end on a separator but never
 * starts with one. Lines then break only after a "·" or inside a phrase.
 */
export function tieLogLine(pieces: readonly LogPiece[]): LogPiece[] {
  return pieces.map((piece, i) => {
    if (piece.kind !== "text") return piece;
    let text = piece.text.replace(BEFORE_SEPARATOR, `${NBSP}·`);
    if (pieces[i - 1]?.kind === "slot") text = text.replace(/^ +/, NBSP);
    return text === piece.text ? piece : { kind: "text", text };
  });
}

/** A run of the rendered line: plain text, or a counter glued to what it counts. */
export type LogRun =
  { kind: "text"; text: string } | { kind: "entry"; slot: LogSlot; tail: string };

/**
 * The longest noun phrase (in characters, up to the next "·") that stays
 * glued to its counter whole; a longer one keeps only its first word.
 */
export const TIE_PHRASE_MAX = 20;

/** How much of the text after a counter belongs to it (see `groupLogLine`). */
function counterTail(text: string): number {
  const separator = text.indexOf(`${NBSP}·`);
  const phraseEnd = separator === -1 ? text.length : separator + 2;
  if ([...text.slice(0, phraseEnd)].length <= TIE_PHRASE_MAX + 2) return phraseEnd;
  const firstSpace = text.indexOf(" ");
  return firstSpace === -1 ? text.length : firstSpace;
}

/**
 * Browsers may wrap beside an inline-block (the counter's ledger cell) even
 * next to a no-break space, so each counter is grouped with what it counts
 * into one run the page renders unbreakable: its whole noun phrase up to the
 * next "·" when that is short ("23 requests routed ·", "0 yeniden
 * yönlendirme"), else its first word ("0 Ausfälle"). The rest of the text
 * keeps its own break opportunities.
 */
export function groupLogLine(pieces: readonly LogPiece[]): LogRun[] {
  const runs: LogRun[] = [];
  for (let i = 0; i < pieces.length; i++) {
    const piece = pieces[i];
    if (piece.kind === "text") {
      runs.push(piece);
      continue;
    }
    const next = pieces[i + 1];
    if (next?.kind !== "text" || !next.text.startsWith(NBSP)) {
      runs.push({ kind: "entry", slot: piece.slot, tail: "" });
      continue;
    }
    const cut = counterTail(next.text);
    runs.push({ kind: "entry", slot: piece.slot, tail: next.text.slice(0, cut) });
    if (cut < next.text.length) runs.push({ kind: "text", text: next.text.slice(cut) });
    i += 1;
  }
  return runs;
}

/** The whole pipeline: a sentence formatted with `LOG_SLOT_MARKS` to the runs the strip renders. */
export function logLineRuns(message: string): LogRun[] {
  return groupLogLine(tieLogLine(splitLogLine(message)));
}

/**
 * How a counter acknowledges a new value. `routed` climbs several times a
 * second, so it only settles by a pixel or two; failures and reroutes change
 * rarely and because of the visitor, so they drop in.
 */
export function countMotion(slot: LogSlot): "settle" | "drop" {
  return slot === "routed" ? "settle" : "drop";
}

/**
 * The quietest a counter may move: a new animation starts only after this
 * long since the last one began (and never over one still running), so even a
 * counter climbing every frame moves about once a second, not five times.
 */
export const COUNT_MOTION_GAP_MS = 900;

/** Whether a counter that just changed may play its motion now. */
export function countMayMove(
  rose: boolean,
  now: number,
  lastAt: number,
  running: boolean
): boolean {
  return rose && !running && now - lastAt >= COUNT_MOTION_GAP_MS;
}

/* ------------------------------------------------------------------------ */
/* The back-to-north compass                                                */
/* ------------------------------------------------------------------------ */

/** Where the needle waits, out of view, before the footer arrives: due south. */
export const SWING_FROM_DEG = 180;
/** Where it swings to: north, reached clockwise (the voyage's last leg, 180° → 360°). */
export const SWING_TO_DEG = 360;

/**
 * The "spin once" on hover: one full turn, quicker and better damped than the
 * swing so it reads as a deliberate flourish rather than a wobble (≈2.6% overshoot).
 */
export const SPIN: SpringConfig = { stiffness: 48, damping: 0.72 };

/** A whole-degree compass bearing, 0..359, for the readout under the label. */
export function bearingOf(angle: number): number {
  return ((Math.round(angle) % 360) + 360) % 360;
}

/**
 * Bring a settled angle back into 0..359 without moving the needle: full
 * turns pile up after a spin or two, and the next swing measures from here.
 */
export function wrapTurns(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/**
 * The tick marks of the compass card as two SVG path strings: `major` every
 * 45° (the eight winds), `minor` between them. `count` ticks are evenly spaced
 * from north, clockwise; every `majorEvery`-th one is major. Coordinates are
 * rounded to two decimals, so the markup is identical on server and client.
 */
export function dialTicks(
  cx: number,
  cy: number,
  rOuter: number,
  rMajor: number,
  rMinor: number,
  count = 32,
  majorEvery = 4
): { major: string; minor: string } {
  let major = "";
  let minor = "";
  for (let i = 0; i < count; i++) {
    const rad = (i / count) * Math.PI * 2;
    const sin = Math.sin(rad);
    const cos = Math.cos(rad);
    const isMajor = i % majorEvery === 0;
    const rInner = isMajor ? rMajor : rMinor;
    const segment =
      `M${round2(cx + sin * rOuter)} ${round2(cy - cos * rOuter)}` +
      `L${round2(cx + sin * rInner)} ${round2(cy - cos * rInner)}`;
    if (isMajor) major += segment;
    else minor += segment;
  }
  return { major, minor };
}
