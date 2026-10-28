import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COUNT_MOTION_GAP_MS,
  LOG_SLOTS,
  LOG_SLOT_MARKS,
  SPIN,
  SWING_FROM_DEG,
  SWING_TO_DEG,
  TIE_PHRASE_MAX,
  bearingOf,
  countMayMove,
  countMotion,
  dialTicks,
  groupLogLine,
  logLineRuns,
  splitLogLine,
  tieLogLine,
  wrapTurns,
  type LogRun,
} from "../../src/app/landing/components/footer/logbookModel.ts";
import { NEEDLE, isSettled, springAt, stepSpring } from "../../src/app/landing/runtime/springs.ts";

const LOCALES = ["en", "tr", "de", "fa"] as const;

function landingMessages(locale: string): Record<string, string> {
  const file = join(process.cwd(), "src", "i18n", "messages", `${locale}.json`);
  return JSON.parse(readFileSync(file, "utf8")).landing;
}

/** What `t("logbookLine", LOG_SLOT_MARKS)` produces: simple ICU arguments replaced verbatim. */
function formatWithMarks(message: string): string {
  return message.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in LOG_SLOT_MARKS ? LOG_SLOT_MARKS[name as keyof typeof LOG_SLOT_MARKS] : whole
  );
}

test("splitLogLine cuts a sentence at the slot marks, in the locale's order", () => {
  const { routed, outages, reroutes } = LOG_SLOT_MARKS;
  const pieces = splitLogLine(`a ${reroutes} b ${routed}${outages} c`);
  assert.deepEqual(pieces, [
    { kind: "text", text: "a " },
    { kind: "slot", slot: "reroutes" },
    { kind: "text", text: " b " },
    { kind: "slot", slot: "routed" },
    { kind: "slot", slot: "outages" },
    { kind: "text", text: " c" },
  ]);
});

test("splitLogLine keeps plain text whole and never emits empty runs", () => {
  assert.deepEqual(splitLogLine("landing.logbookLine"), [
    { kind: "text", text: "landing.logbookLine" },
  ]);
  assert.deepEqual(splitLogLine(""), []);
  assert.deepEqual(splitLogLine(LOG_SLOT_MARKS.routed), [{ kind: "slot", slot: "routed" }]);
});

test("the slot marks are private-use characters no translation contains", () => {
  const marks = Object.values(LOG_SLOT_MARKS);
  assert.equal(new Set(marks).size, LOG_SLOTS.length);
  for (const mark of marks) {
    const code = mark.codePointAt(0) ?? 0;
    assert.ok(
      code >= 0xe000 && code <= 0xf8ff,
      `U+${code.toString(16)} is in the private-use area`
    );
  }
  for (const locale of LOCALES) {
    const all = JSON.stringify(landingMessages(locale));
    for (const mark of marks) assert.ok(!all.includes(mark), `${locale} contains a slot mark`);
  }
});

test("the model source spells the slot marks as escapes, never as invisible literals", () => {
  const source = readFileSync(
    join(process.cwd(), "src", "app", "landing", "components", "footer", "logbookModel.ts"),
    "utf8"
  );
  assert.ok(!/[\uE000-\uF8FF]/u.test(source), "a raw private-use character is in the source");
  assert.ok(source.includes('"\\uE000"'), "the routed mark is written as an escape");
});

test("every locale's logbookLine yields each counter exactly once", () => {
  for (const locale of LOCALES) {
    const line = landingMessages(locale).logbookLine;
    assert.equal(typeof line, "string", `${locale}.landing.logbookLine exists`);
    const slots = splitLogLine(formatWithMarks(line))
      .filter((piece) => piece.kind === "slot")
      .map((piece) => (piece.kind === "slot" ? piece.slot : ""));
    assert.deepEqual([...slots].sort(), [...LOG_SLOTS].sort(), `${locale}: ${slots.join(",")}`);
  }
});

const NBSP = "\u00A0";

test("tieLogLine binds a counter to the next word and a separator to the word before it", () => {
  const { routed, outages } = LOG_SLOT_MARKS;
  const tied = tieLogLine(splitLogLine(`seen: ${routed} requests routed · ${outages} failures`));
  assert.deepEqual(tied, [
    { kind: "text", text: "seen: " },
    { kind: "slot", slot: "routed" },
    { kind: "text", text: `${NBSP}requests routed${NBSP}· ` },
    { kind: "slot", slot: "outages" },
    { kind: "text", text: `${NBSP}failures` },
  ]);
  // The break opportunity before a counter (after "·" or a colon) is kept.
  assert.ok(tied[0].kind === "text" && tied[0].text.endsWith(" "));
});

function render(runs: LogRun[]): string[] {
  return runs.map((run) => (run.kind === "text" ? run.text : `[${run.slot}]${run.tail}`));
}

test("groupLogLine glues a counter to its short noun phrase, or to its first word when long", () => {
  const { routed, outages, reroutes } = LOG_SLOT_MARKS;
  const long = "x".repeat(TIE_PHRASE_MAX) + " y";
  const runs = groupLogLine(
    tieLogLine(
      splitLogLine(`a: ${routed} requests routed · ${outages} ${long} · ${reroutes} reroutes`)
    )
  );
  assert.deepEqual(render(runs), [
    "a: ",
    `[routed]${NBSP}requests routed${NBSP}·`,
    " ",
    `[outages]${NBSP}${"x".repeat(TIE_PHRASE_MAX)}`,
    ` y${NBSP}· `,
    `[reroutes]${NBSP}reroutes`,
  ]);
  // A counter with nothing tied after it stands alone.
  assert.deepEqual(render(groupLogLine(splitLogLine(`${routed}, more`))), ["[routed]", ", more"]);
});

test("in every locale no rendered line can start with a separator or strand a counter", () => {
  for (const locale of LOCALES) {
    const runs = logLineRuns(formatWithMarks(landingMessages(locale).logbookLine));
    const entries = runs.filter((run) => run.kind === "entry");
    assert.equal(entries.length, LOG_SLOTS.length, locale);
    for (const entry of entries) {
      assert.ok(entry.kind === "entry" && entry.tail.startsWith(NBSP), `${locale}: ${entry.tail}`);
    }
    for (const run of runs) {
      if (run.kind !== "text") continue;
      // Breakable spaces only ever follow a separator or precede a counter's phrase.
      assert.ok(!/ ·/.test(run.text), `${locale}: a breakable space before "·" in "${run.text}"`);
    }
    // Glued back together, the runs are the tied sentence: nothing lost or reordered.
    const joined = runs
      .map((run) => (run.kind === "text" ? run.text : LOG_SLOT_MARKS[run.slot] + run.tail))
      .join("");
    assert.equal(
      joined.replaceAll(NBSP, " "),
      formatWithMarks(landingMessages(locale).logbookLine)
    );
  }
});

test("routed only settles, visitor-caused counters drop in, and neither moves more than about once a second", () => {
  assert.equal(countMotion("routed"), "settle");
  assert.equal(countMotion("outages"), "drop");
  assert.equal(countMotion("reroutes"), "drop");
  assert.ok(COUNT_MOTION_GAP_MS >= 900);
  assert.equal(countMayMove(true, 10_000, Number.NEGATIVE_INFINITY, false), true);
  assert.equal(countMayMove(false, 10_000, 0, false), false, "a fall never moves");
  assert.equal(countMayMove(true, 10_000, 9_500, false), false, "too soon after the last");
  assert.equal(countMayMove(true, 10_000, 9_000, true), false, "never over a running motion");
  assert.equal(countMayMove(true, 10_000, 10_000 - COUNT_MOTION_GAP_MS, false), true);
  // A counter climbing every 100ms (10 Hz) for 5s moves at most 6 times: ≤ ~1.2/s.
  let lastAt = Number.NEGATIVE_INFINITY;
  let moves = 0;
  for (let now = 0; now <= 5_000; now += 100) {
    if (countMayMove(true, now, lastAt, now - lastAt < 360)) {
      lastAt = now;
      moves += 1;
    }
  }
  assert.ok(moves <= 6, `${moves} moves in 5s`);
});

test("bearingOf and wrapTurns normalise to whole compass degrees", () => {
  assert.equal(bearingOf(0), 0);
  assert.equal(bearingOf(359.6), 0);
  assert.equal(bearingOf(360), 0);
  assert.equal(bearingOf(721.2), 1);
  assert.equal(bearingOf(-1), 359);
  assert.equal(bearingOf(183.4), 183);
  assert.equal(wrapTurns(720), 0);
  assert.equal(wrapTurns(1080 + 45), 45);
  assert.equal(wrapTurns(-90), 270);
});

test("dialTicks draws `count` ticks from north, every majorEvery-th one major", () => {
  const { major, minor } = dialTicks(48, 48, 45, 38.5, 41.5, 32, 4);
  assert.equal(major.split("M").length - 1, 8);
  assert.equal(minor.split("M").length - 1, 24);
  // The first major tick is due north: straight up from the centre.
  assert.ok(major.startsWith("M48 3L48 9.5"), major.slice(0, 20));
  // Deterministic, two-decimal coordinates (identical on server and client).
  assert.equal(dialTicks(48, 48, 45, 38.5, 41.5, 32, 4).minor, minor);
  assert.ok(!/\d\.\d{3}/.test(major + minor));
});

function runSpring(from: number, to: number, config = NEEDLE, seconds = 4) {
  const state = springAt(from);
  let peak = from;
  let settledAt: number | null = null;
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    stepSpring(state, to, dt, config);
    peak = Math.max(peak, state.angle);
    if (settledAt === null && isSettled(state, to)) settledAt = t;
  }
  return { state, peak, settledAt };
}

test("the arrival swing runs clockwise from south to north and comes to rest", () => {
  assert.equal(SWING_FROM_DEG, 180);
  assert.equal(SWING_TO_DEG, 360);
  const { peak, settledAt } = runSpring(SWING_FROM_DEG, SWING_TO_DEG, NEEDLE);
  // A compass swing: it overshoots north visibly, then settles within a few seconds.
  assert.ok(peak > SWING_TO_DEG + 10, `overshoot ${peak - SWING_TO_DEG}`);
  assert.ok(settledAt !== null && settledAt < 3.5, `settled at ${settledAt}`);
  assert.equal(bearingOf(SWING_TO_DEG), 0);
});

test("the hover spin is one full turn with only a small overshoot", () => {
  const { peak, settledAt } = runSpring(0, 360, SPIN);
  assert.ok(peak - 360 < 15, `overshoot ${peak - 360}`);
  assert.ok(settledAt !== null && settledAt < 2.5, `settled at ${settledAt}`);
});
