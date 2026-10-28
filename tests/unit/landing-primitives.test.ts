/**
 * The landing page's primitives (src/app/landing/components/primitives/):
 * the pure helpers they render with, and their server-rendered markup.
 *
 * The markup tests matter because every primitive promises that what the
 * server sends is final, real, readable text that the client hydrates without
 * a mismatch: numbers in the locale's digits, the whole typed line, the
 * heading split by words (never graphemes), no clock or randomness.
 */
import { register } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";
import assert from "node:assert/strict";
import {
  FLAP_MS,
  MAGNET_LABEL_MAX,
  MAGNET_MAX,
  ROLL_STRIP_CELLS,
  TREMOR_DEG,
  burstParticles,
  cx,
  digitValue,
  flapAngles,
  flapRng,
  flapSequence,
  formatBearing,
  isFlippable,
  localeDigits,
  magnetPull,
  rollPlan,
  splitWords,
  tremorAt,
  typeSlices,
  typedAt,
  type MagnetPull,
} from "../../src/app/landing/components/primitives/primitiveKit.ts";

// Components import their stylesheet; the test runner has no CSS loader, so
// stub `.css` modules before any component is imported (dynamically, below).
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function load(url, context, next) {
        if (url.endsWith(".css")) return { format: "module", source: "export default {};", shortCircuit: true };
        return next(url, context);
      }`
    )
);

const LOCALES = ["en", "tr", "de", "fa"] as const;

function landingMessages(locale: string): Record<string, string> {
  const file = join(process.cwd(), "src", "i18n", "messages", `${locale}.json`);
  const all = JSON.parse(readFileSync(file, "utf8")) as { landing: Record<string, unknown> };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(all.landing)) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* Pure helpers                                                             */
/* ------------------------------------------------------------------------ */

test("cx joins truthy class names only", () => {
  assert.equal(cx("a", false, null, undefined, "", "b"), "a b");
  assert.equal(cx(), "");
});

test("localeDigits comes from Intl: Latin for en, Persian for fa", () => {
  assert.deepEqual(localeDigits("en"), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.deepEqual(localeDigits("fa"), ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"]);
  assert.equal(digitValue(localeDigits("fa"), "۷"), 7);
  assert.equal(digitValue(localeDigits("fa"), "7"), -1);
});

test("formatBearing zero-pads, normalises and uses the locale's digits", () => {
  assert.equal(formatBearing("en", 0), "000");
  assert.equal(formatBearing("en", 45), "045");
  assert.equal(formatBearing("en", 315), "315");
  assert.equal(formatBearing("en", 405), "045");
  assert.equal(formatBearing("en", -45), "315");
  assert.equal(formatBearing("en", 359.6), "000");
  assert.equal(formatBearing("fa", 135), "۱۳۵");
  assert.equal(formatBearing("de", 1000), "280", "never a group separator");
});

test("splitWords keeps punctuation on its word and never breaks inside a no-break space", () => {
  const pieces = splitWords("One endpoint. 358 providers, X-Pusula-Provider", "en");
  assert.deepEqual(
    pieces.filter((p) => !p.space).map((p) => p.text),
    ["One", "endpoint.", "358 providers,", "X-Pusula-Provider"]
  );
  assert.equal(
    pieces.map((p) => p.text).join(""),
    "One endpoint. 358 providers, X-Pusula-Provider"
  );
});

test("splitWords keeps Persian words whole (ZWNJ inside, Arabic comma attached)", () => {
  const text = "پوسولا می‌گوید: سلام، دنیا!";
  const words = splitWords(text, "fa").filter((p) => !p.space);
  assert.deepEqual(
    words.map((p) => p.text),
    ["پوسولا", "می‌گوید:", "سلام،", "دنیا!"]
  );
});

test("splitWords: Intl.Segmenter and the fallback agree on every landing string", () => {
  const intl = Intl as unknown as { Segmenter?: unknown };
  const segmenter = intl.Segmenter;
  for (const locale of LOCALES) {
    const messages = landingMessages(locale);
    for (const [key, text] of Object.entries(messages)) {
      const withSegmenter = splitWords(text, locale);
      intl.Segmenter = undefined;
      try {
        const fallback = splitWords(text, locale);
        assert.deepEqual(withSegmenter, fallback, `${locale}.${key}`);
      } finally {
        intl.Segmenter = segmenter;
      }
      // Lossless, no empty pieces, words never contain breakable whitespace.
      assert.equal(withSegmenter.map((p) => p.text).join(""), text, `${locale}.${key}`);
      for (const piece of withSegmenter) {
        assert.ok(piece.text.length > 0);
        if (!piece.space) assert.doesNotMatch(piece.text, /[ \t\n]/, `${locale}.${key}`);
      }
    }
  }
});

test("rollPlan: the first roll turns every digit once from 0, separators stay put", () => {
  const plan = rollPlan(null, "1,234", localeDigits("en"));
  assert.deepEqual(plan, [
    { kind: "digit", from: 0, to: 11 },
    { kind: "char", ch: "," },
    { kind: "digit", from: 0, to: 12 },
    { kind: "digit", from: 0, to: 13 },
    { kind: "digit", from: 0, to: 14 },
  ]);
  for (const cell of plan) {
    if (cell.kind === "digit") assert.ok(cell.to < ROLL_STRIP_CELLS);
  }
});

test("rollPlan: later rolls align from the right and roll forwards", () => {
  const digits = localeDigits("en");
  assert.deepEqual(rollPlan("0.95", "1.02", digits), [
    { kind: "digit", from: 0, to: 1 },
    { kind: "char", ch: "." },
    { kind: "digit", from: 9, to: 10 },
    { kind: "digit", from: 5, to: 12 },
  ]);
  // A longer new value: the new leading digit rolls up from 0.
  assert.deepEqual(rollPlan("99", "100", digits), [
    { kind: "digit", from: 0, to: 1 },
    { kind: "digit", from: 9, to: 10 },
    { kind: "digit", from: 9, to: 10 },
  ]);
  // Unchanged digits do not move.
  assert.deepEqual(rollPlan("42", "42", digits), [
    { kind: "digit", from: 4, to: 4 },
    { kind: "digit", from: 2, to: 2 },
  ]);
  // Persian digits are digits too.
  const fa = localeDigits("fa");
  assert.deepEqual(rollPlan(null, "۱۰", fa), [
    { kind: "digit", from: 0, to: 11 },
    { kind: "digit", from: 0, to: 10 },
  ]);
});

test("typeSlices walks the token list and never splits a surrogate pair", () => {
  const tokens = ["curl ", "-X", " POST"];
  const out = new Int32Array(tokens.length);
  typeSlices(tokens, 0, out);
  assert.deepEqual([...out], [0, 0, 0]);
  typeSlices(tokens, 6, out);
  assert.deepEqual([...out], [5, 1, 0]);
  typeSlices(tokens, 12, out);
  assert.deepEqual([...out], [5, 2, 5]);
  typeSlices(tokens, 99, out);
  assert.deepEqual([...out], [5, 2, 5]);

  const emoji = ["a\u{1F9ED}b"]; // a, compass (2 units), b
  const one = new Int32Array(1);
  typeSlices(emoji, 2, one);
  assert.equal(one[0], 3, "the half-typed pair is completed");
});

test("typedAt follows cps and caps at the total", () => {
  assert.equal(typedAt(0, 90, 40), 0);
  assert.equal(typedAt(-5, 90, 40), 0);
  assert.equal(typedAt(100, 90, 40), 9);
  assert.equal(typedAt(1000, 90, 40), 40);
  assert.equal(typedAt(1000, 0, 40), 0);
});

test("flapSequence starts on the shown glyph, lands on the target and never repeats a glyph", () => {
  const digits = localeDigits("fa");
  const sequence = flapSequence(flapRng("۳۵۸", 1), "۳", "۸", digits, 8);
  assert.equal(sequence.length, 9);
  assert.equal(sequence[0], "۳");
  assert.equal(sequence[8], "۸");
  for (let i = 1; i < sequence.length - 1; i++) {
    assert.ok(digits.includes(sequence[i]), "in-between glyphs are locale digits");
    assert.notEqual(sequence[i], sequence[i - 1]);
  }
  // Seeded: the same run replays the same glyphs.
  assert.deepEqual(flapSequence(flapRng("۳۵۸", 1), "۳", "۸", digits, 8), sequence);
  assert.deepEqual(flapSequence(flapRng("x", 1), "a", "b", digits, 0), ["a", "b"]);
});

test("flapAngles: the upper flap falls, then the lower one lands", () => {
  assert.deepEqual(flapAngles(0), { upper: -0, lower: 90 });
  assert.deepEqual(flapAngles(0.25), { upper: -45, lower: 90 });
  assert.deepEqual(flapAngles(0.5), { upper: -90, lower: 90 });
  assert.deepEqual(flapAngles(0.75), { upper: -90, lower: 45 });
  assert.deepEqual(flapAngles(1), { upper: -90, lower: 0 });
  assert.equal(FLAP_MS, 90, "45ms per half");
});

test("isFlippable: letters and digits flip, punctuation and spaces do not", () => {
  assert.ok(isFlippable("7"));
  assert.ok(isFlippable("۷"));
  assert.ok(isFlippable("a"));
  assert.ok(!isFlippable(","));
  assert.ok(!isFlippable(" "));
  assert.ok(!isFlippable("%"));
});

test("tremorAt stays within ±0.7°", () => {
  let peak = 0;
  for (let t = 0; t < 30; t += 0.013) {
    peak = Math.max(peak, Math.abs(tremorAt(t, 1.234)));
  }
  assert.ok(peak <= TREMOR_DEG + 1e-9);
  assert.ok(peak > TREMOR_DEG * 0.6, "and actually moves");
});

test("magnetPull: inside the field it follows, clamped; outside it lets go", () => {
  const out: MagnetPull = { active: false, x: 0, y: 0, labelX: 0, labelY: 0 };
  // A 160×48 button; pointer 10px right of centre: inside the button.
  magnetPull(10, 0, 80, 24, 0.25, 80, out);
  assert.equal(out.active, true);
  assert.equal(out.x, 2.5);
  assert.equal(out.labelX, 1);
  // Far right but within the 80px field: clamped to ±8 and ±3.
  magnetPull(150, -40, 80, 24, 0.25, 80, out);
  assert.equal(out.active, true);
  assert.equal(out.x, MAGNET_MAX);
  assert.equal(out.y, -MAGNET_MAX);
  assert.equal(out.labelX, MAGNET_LABEL_MAX);
  assert.equal(out.labelY, -MAGNET_LABEL_MAX);
  // Exactly on the edge of the field still counts.
  magnetPull(160, 0, 80, 24, 0.25, 80, out);
  assert.equal(out.active, true);
  // Beyond it: released to rest.
  magnetPull(161, 0, 80, 24, 0.25, 80, out);
  assert.deepEqual(out, { active: false, x: 0, y: 0, labelX: 0, labelY: 0 });
});

test("burstParticles is deterministic and spread around the circle", () => {
  const sparks = burstParticles(12);
  assert.equal(sparks.length, 12);
  assert.deepEqual(burstParticles(12), sparks);
  sparks.forEach((spark, i) => {
    assert.ok(Math.abs(spark.angle - i * 30) <= 8);
    assert.ok(spark.distance >= 16 && spark.distance <= 26);
    assert.ok(spark.size >= 2 && spark.size <= 4);
  });
});

/* ------------------------------------------------------------------------ */
/* Server-rendered markup                                                   */
/* ------------------------------------------------------------------------ */

type ReactModule = typeof import("react");

/**
 * `createElement` with children in the third argument (lint: no `children`
 * prop) for components whose props type requires `children`.
 */
function withChildren<P extends { children?: ReactNode }>(
  type: ComponentType<P>,
  props: Omit<P, "children">,
  children: ReactNode
): ReactElement {
  return createElement(type as ComponentType<Omit<P, "children">>, props, children);
}

async function loadRenderer() {
  const React: ReactModule = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { NextIntlClientProvider } = await import("next-intl");
  const primitives = await import("../../src/app/landing/components/primitives/index.ts");
  const stationModule = await import("../../src/app/landing/components/primitives/Station.tsx");
  const render = (locale: string, node: import("react").ReactNode): string => {
    const messages = {
      // Keys added by the i18n ledger (§8.1) may land after the primitives.
      simBadge: "Simulation",
      navResilience: "Resilience",
      navUnderTheHood: "Compression and MCP",
      ...landingMessages(locale),
    };
    return renderToStaticMarkup(
      withChildren(
        NextIntlClientProvider,
        { locale, timeZone: "UTC", messages: { landing: messages } },
        node
      )
    );
  };
  return { React, h: React.createElement, render, primitives, stationModule };
}

const rendererPromise = loadRenderer();

test("Glyph: every name renders an aria-hidden 1.5px SVG; only arrow and chevron mirror", async () => {
  const { h, render, primitives } = await rendererPromise;
  const { Glyph, GLYPH_NAMES } = primitives;
  assert.equal(GLYPH_NAMES.length, 17);
  for (const name of GLYPH_NAMES) {
    const html = render("en", h(Glyph, { name, size: 16 }));
    assert.match(html, /^<svg /);
    assert.match(html, /aria-hidden="true"/);
    assert.match(html, /stroke-width="1.5"/);
    assert.match(html, /width="16" height="16"/);
    assert.equal(html.includes("glyph-dir"), name === "arrow" || name === "chevron", name);
    assert.doesNotMatch(html, /material-symbols/);
  }
});

test("Needle renders the final bearing with an explicit pivot", async () => {
  const { h, render, primitives } = await rendererPromise;
  const html = render("en", h(primitives.Needle, { size: 18, bearing: 45, swingOnView: true }));
  assert.match(html, /<g transform="rotate\(45 16 16\)">/);
  assert.match(html, /width="18" height="18"/);
  assert.match(html, /aria-hidden="true"/);
});

test("LiveNumber renders the final value as text, in the locale's digits", async () => {
  const { h, render, primitives } = await rendererPromise;
  const { LiveNumber } = primitives;
  const roll = render("fa", h(LiveNumber, { value: 1234, mode: "roll" }));
  assert.equal(roll, '<span class="ln" data-mode="roll"><span class="ln-text">۱٬۲۳۴</span></span>');
  const tick = render("en", h(LiveNumber, { value: 0, mode: "tick" }));
  assert.match(tick, /<span class="ln-text">0<\/span>/);
  const percent = render(
    "de",
    h(LiveNumber, { value: 0.45, mode: "roll", format: { style: "percent" } })
  );
  assert.match(percent, /45 %/);
  const flap = render("en", h(LiveNumber, { value: 358, mode: "flap" }));
  assert.match(flap, /<span class="sr-only">358<\/span>/);
  assert.match(flap, /class="sf ln ln-flap"/);
});

test("SplitFlap: tiles are aria-hidden and the value is read once as text", async () => {
  const { h, render, primitives } = await rendererPromise;
  const html = render("fa", h(primitives.SplitFlap, { value: "۳۵۸" }));
  assert.match(html, /<span class="sr-only">۳۵۸<\/span>/);
  assert.match(html, /class="sf-tiles" aria-hidden="true" dir="ltr"/);
  assert.equal(html.match(/class="sf-tile"/g)?.length, 3);
  // Four half-tiles per tile, all on the final glyph.
  assert.equal(html.match(/<span class="sf-glyph">۸<\/span>/g)?.length, 4);
  const spaced = render("en", h(primitives.SplitFlap, { value: "1 2,3" }));
  assert.equal(spaced.match(/class="sf-gap"/g)?.length, 1);
  assert.equal(spaced.match(/data-fixed=""/g)?.length, 1, "the comma is a fixed tile");
});

test("TypeLine renders the whole line, one span per token, never per character", async () => {
  const { h, render, primitives } = await rendererPromise;
  const tokens = [
    { t: "curl ", c: "kw" as const },
    { t: "http://localhost:20128/v1", c: "str" as const },
    { t: " -d model=" },
    { t: "auto", c: "accent" as const },
  ];
  const html = render(
    "en",
    h(primitives.TypeLine, { text: tokens.map((x) => x.t).join(""), tokens, caret: true })
  );
  assert.equal(html.replace(/<[^>]+>/g, ""), "curl http://localhost:20128/v1 -d model=auto");
  assert.equal(html.match(/class="tl-t/g)?.length, 4);
  assert.match(html, /class="tl-t tl-accent">auto</);
  assert.match(html, /class="tl-caret" aria-hidden="true"/);
  const plain = render("en", h(primitives.TypeLine, { text: "X-Pusula-Provider: openai" }));
  assert.match(plain, /<span class="tl-t">X-Pusula-Provider: openai<\/span>/);
});

test("Terminal: ltr panel, tabs pattern, lines joined by newlines, copy chip", async () => {
  const { h, render, primitives } = await rendererPromise;
  const html = render(
    "fa",
    h(primitives.Terminal, {
      title: "terminal",
      tabs: [
        { id: "curl", label: "cURL" },
        { id: "js", label: "JavaScript" },
      ],
      activeTab: "js",
      onTab: () => {},
      lines: [{ text: "line one" }, { text: "line two", id: "two" }],
      copyText: "line one\nline two",
    })
  );
  assert.match(html, /^<div class="term" dir="ltr" data-tabs="">/);
  assert.match(html, /role="tablist"/);
  assert.equal(html.match(/role="tab"/g)?.length, 2);
  assert.match(html, /aria-selected="false"[^>]*>cURL</);
  assert.match(html, /aria-selected="true"[^>]*>JavaScript</);
  assert.match(html, /role="tabpanel"/);
  assert.match(html, /tabindex="0"/);
  assert.match(html, /line one<\/span><\/span>\n<span class="tl"><span class="tl-t">line two/);
  assert.match(html, /class="cc"[^>]*data-size="sm"[^>]*aria-label="کپی: terminal"/);
});

test("WordReveal splits headings into words and keeps one accessible name", async () => {
  const { h, render, primitives } = await rendererPromise;
  const html = render(
    "en",
    h(primitives.WordReveal, {
      as: "h1",
      lines: ["One endpoint.", "358 providers."],
      trigger: "intro",
      id: "hero-title",
    })
  );
  assert.match(html, /^<h1 id="hero-title" class="wr"/);
  assert.match(html, /data-wr="armed"/);
  assert.match(html, /aria-label="One endpoint. 358 providers."/);
  assert.equal(html.match(/class="wr-line" aria-hidden="true"/g)?.length, 2);
  assert.equal(html.match(/class="wr-w"/g)?.length, 4);
  assert.match(html, /style="--i:3" data-wr-last="1">providers\.</);

  const fa = render("fa", h(primitives.WordReveal, { as: "h2", lines: ["یک نقطهٔ پایانی"] }));
  assert.match(fa, /<span class="wr-w" style="--i:2" data-wr-last="1">پایانی<\/span>/);

  const paragraph = render("en", h(primitives.WordReveal, { as: "p", lines: ["Plain text"] }));
  assert.doesNotMatch(paragraph, /aria-label|aria-hidden/);
});

test("Station renders the section shell and the compass kicker", async () => {
  const { h, render, primitives } = await rendererPromise;
  const { Station } = primitives;
  const html = render("en", h(Station, { id: "routing", title: "Routing", lead: "Lead." }, "x"));
  assert.match(
    html,
    /^<section id="routing" data-station="routing" data-bearing="135" data-align="start" aria-labelledby="routing-title" class="station station-cv">/
  );
  assert.match(html, /class="seam" data-bearing="135"/);
  assert.match(html, /<span dir="ltr">135°<\/span> · Routing<\/span>/);
  assert.match(html, /<g transform="rotate\(135 16 16\)">/);
  assert.match(html, /<h2 id="routing-title" class="wr station-title serif-display"/);
  assert.match(html, /<p class="station-lead">Lead\.<\/p>/);
  assert.match(html, /<div class="station-body">x<\/div>/);

  const fa = render("fa", h(Station, { id: "network", title: "t" }));
  assert.match(fa, /<span dir="ltr">۰۴۵°<\/span>/);

  const pinned = render(
    "en",
    h(Station, { id: "network", title: "Network", pin: { minWidth: 1024, vh: 160 } }, "stage")
  );
  assert.match(pinned, /data-pin-min="1024"/);
  assert.doesNotMatch(pinned, /station-cv/, "no content-visibility above a sticky stage");
  assert.match(
    pinned,
    /<div class="station-track" style="--pin-vh:160vh"><div class="station-stage">stage<\/div><\/div>/
  );
});

test("pinBreakpoint rounds up to a supported breakpoint", async () => {
  const { stationModule } = await rendererPromise;
  const { pinBreakpoint } = stationModule;
  assert.equal(pinBreakpoint(1024), 1024);
  assert.equal(pinBreakpoint(1000), 1024);
  assert.equal(pinBreakpoint(1280), 1280);
  assert.equal(pinBreakpoint(1281), 1440);
  assert.equal(pinBreakpoint(4000), 1440);
  assert.equal(pinBreakpoint(320), 768);
});

test("MagneticButton picks Link, external <a> or <button>", async () => {
  const { render, primitives } = await rendererPromise;
  const { MagneticButton } = primitives;
  const internal = render(
    "en",
    withChildren(
      MagneticButton,
      { href: "/dashboard", variant: "gold", size: "lg", icon: "arrow" },
      "Open"
    )
  );
  assert.match(internal, /^<a class="mb" data-variant="gold" data-size="lg" href="\/dashboard">/);
  assert.match(internal, /class="glyph glyph-dir"/, "the arrow mirrors in RTL");
  const external = render(
    "en",
    withChildren(MagneticButton, { href: "https://github.com/x/y", variant: "ghost" }, "GitHub")
  );
  assert.match(external, /target="_blank" rel="noopener noreferrer"/);
  const button = render(
    "en",
    withChildren(MagneticButton, { variant: "ghost", onClick: () => {} }, "Reset")
  );
  assert.match(button, /^<button class="mb" data-variant="ghost" data-size="md" type="button">/);
});

test("CopyChip shows the command and keeps its live region outside the button", async () => {
  const { h, render, primitives } = await rendererPromise;
  const html = render("en", h(primitives.CopyChip, { text: "npx pusula" }));
  assert.match(html, /aria-label="Copy: npx pusula"/);
  assert.match(html, /<span class="cc-prefix">\$ <\/span><span class="cc-cmd">npx pusula<\/span>/);
  assert.match(html, /<\/button><span class="sr-only" aria-live="polite"><\/span>$/);
  const compact = render("en", h(primitives.CopyChip, { text: "x", label: "Copy", size: "sm" }));
  assert.match(compact, /<span class="cc-label">Copy<\/span>/);
});

test("SimBadge, Toggle and Segmented markup", async () => {
  const { h, render, primitives } = await rendererPromise;
  const badge = render("en", h(primitives.SimBadge, { note: "Calls are simulated." }));
  assert.match(badge, /Simulation<\/span><span class="sim-note">Calls are simulated\.<\/span>/);

  const toggle = render(
    "en",
    h(primitives.Toggle, { pressed: true, onChange: () => {}, label: "503s", glyph: "bolt" })
  );
  assert.match(toggle, /^<button type="button" class="tg" aria-pressed="true">/);

  const segmented = render(
    "en",
    h(primitives.Segmented, {
      options: [
        { id: "oauth", label: "OAuth" },
        { id: "apikey", label: "API key" },
      ],
      value: "apikey",
      onChange: () => {},
      "aria-label": "Profile",
    })
  );
  assert.match(segmented, /role="radiogroup"[^>]*aria-label="Profile"/);
  assert.match(segmented, /aria-checked="false" tabindex="-1"/);
  assert.match(segmented, /aria-checked="true" tabindex="0"/);
});

test("server markup is deterministic (no clock, no randomness)", async () => {
  const { h, render, primitives } = await rendererPromise;
  const tree = () =>
    h(
      "div",
      null,
      h(primitives.Station, { id: "launch", title: "Launch" }),
      h(primitives.SplitFlap, { value: "110" }),
      h(primitives.CopyChip, { text: "npx pusula" }),
      h(primitives.LiveNumber, { value: 33, mode: "roll" })
    );
  for (const locale of LOCALES) assert.equal(render(locale, tree()), render(locale, tree()));
});
