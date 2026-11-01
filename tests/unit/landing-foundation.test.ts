/**
 * The landing foundation working together (spec §3): the sim, the runtime and
 * the primitives composed the way a section uses them, rendered on the server.
 *
 * Each module has its own suite; this one pins the seams between them, which
 * no single-module test sees:
 * - the deck's server snapshot (`primeDeck` → `useDeck`) is the same tick-0
 *   world a server poster builds with `createWorld` from the same stats, so
 *   the poster, the SSR markup and hydration agree on the first winner;
 * - every station renders its compass spine (`STATIONS` → `Station` →
 *   `Needle` + kicker) with real messages in every locale;
 * - a section that registers loops (`useDomLoop`, `useCanvasStage`,
 *   `useScrollProgress`, `useHeadingRef`) renders on the server without a
 *   browser, deterministically, and without claiming its canvas is live.
 */
import { register } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createElement, type ComponentType, type ReactElement, type ReactNode } from "react";

// Components import their stylesheet; stub `.css` before any component loads.
register(
  "data:text/javascript," +
    encodeURIComponent(
      `export async function load(url, context, next) {
        if (url.endsWith(".css")) return { format: "module", source: "export default {};", shortCircuit: true };
        return next(url, context);
      }`
    )
);

const { renderToString } = await import("react-dom/server");
const { NextIntlClientProvider } = await import("next-intl");
const { getLandingStats } = await import("../../src/app/landing/landingStats.ts");
const { createWorld, act } = await import("../../src/app/landing/sim/landingSim.ts");
const deck = await import("../../src/app/landing/runtime/deckStore.ts");
const { STATIONS } = await import("../../src/app/landing/runtime/stations.ts");
const heartbeat = await import("../../src/app/landing/runtime/heartbeat.ts");
const primitives = await import("../../src/app/landing/components/primitives/index.ts");
const { default: SampleSection } = await import("./fixtures/landingSampleSection.tsx");

const LOCALES = ["en", "tr", "de", "fa"] as const;
const stats = getLandingStats();

function messages(locale: string): Record<string, unknown> {
  return JSON.parse(
    readFileSync(join(process.cwd(), "src", "i18n", "messages", `${locale}.json`), "utf8")
  ) as Record<string, unknown>;
}

function landing(locale: string): Record<string, string> {
  return (messages(locale) as { landing: Record<string, string> }).landing;
}

/**
 * `createElement` with children in the third argument (lint: no `children`
 * prop) for components whose props type requires `children`.
 */
function withChildren<P extends { children?: ReactNode }>(
  type: ComponentType<P>,
  props: Omit<P, "children">,
  ...children: ReactNode[]
): ReactElement {
  return createElement(type as ComponentType<Omit<P, "children">>, props, ...children);
}

function render(locale: string, node: ReactNode): string {
  return renderToString(
    withChildren(
      NextIntlClientProvider,
      { locale, messages: messages(locale), timeZone: "UTC" },
      node
    )
  );
}

test("foundation: the deck's server snapshot is the tick-0 world a server poster builds", () => {
  deck.primeDeck(stats);
  const seed = deck.getSeedWorld();
  const poster = createWorld({
    factorIds: stats.scoringFactors.map((f) => f.id),
    defaults: stats.scoringFactors.map((f) => f.weight),
  });
  assert.equal(seed.tick, 0);
  assert.deepEqual(seed.featured, poster.featured);
  assert.deepEqual(seed.weights, poster.weights);
  assert.equal(seed.featured.winner, "claude", "agentic → claude with the shipped weights");
  // On the server the live world is the seed and nothing steps or mutates it.
  assert.equal(deck.getWorld(), seed);
  deck.dispatch(act.setUpstreamDown("claude", true), { user: true });
  assert.equal(seed.candidates[0].upstreamDown, false, "dispatch is client-only");
  assert.equal(seed.session.outagesCaused, 0);
  assert.equal(heartbeat.canAnimate(), false);
  const unregister = heartbeat.register({ id: "server", lane: "dom", tick: () => {} });
  unregister();
});

test("foundation: a section with loops, a canvas stage and deck readouts renders on the server", () => {
  deck.primeDeck(stats);
  for (const locale of LOCALES) {
    const first = render(locale, createElement(SampleSection));
    assert.equal(render(locale, createElement(SampleSection)), first, `${locale}: deterministic`);
    assert.match(first, /<section id="network" data-station="network" data-bearing="45"/);
    assert.match(first, /data-pin-min="1024"/);
    assert.match(first, /class="station-track" style="--pin-vh:160vh"/);
    assert.ok(!first.includes("station-cv"), "no content-visibility on a pinned station");
    assert.match(first, /<output data-winner="claude">claude<\/output>/);
    assert.match(first, /data-rate="0"/, "simulated counters render 0 on the server");
    assert.ok(first.includes(landing(locale).simBadge), `${locale}: SimBadge text`);
    assert.ok(!first.includes("data-live"), "a canvas is never live in server markup");
    assert.match(first, /<canvas aria-hidden="true">/);
  }
});

test("foundation: every station renders its compass spine with real messages", () => {
  for (const locale of LOCALES) {
    const t = landing(locale);
    const digits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 3, useGrouping: false });
    for (const station of STATIONS) {
      // React separates adjacent text nodes with `<!-- -->`; compare the text run without them.
      const html = render(
        locale,
        withChildren(
          primitives.Station,
          { id: station.id, title: `T-${station.id}` },
          createElement("p", null, "body")
        )
      ).replaceAll("<!-- -->", "");
      assert.ok(html.includes(`data-bearing="${station.bearing}"`), `${station.id} bearing`);
      assert.ok(html.includes(`aria-labelledby="${station.id}-title"`));
      assert.ok(
        html.includes(`id="${station.id}-title"`),
        `${station.id}: h2 carries the label id`
      );
      const kicker = `${digits.format(station.bearing)}°</span> · ${t[station.navKey]}`;
      assert.ok(html.includes(kicker), `${locale} ${station.id}: kicker "${kicker}"`);
      // No lazy placeholder: an estimated height put nav jumps and anchors off target.
      assert.ok(!html.includes("station-cv"), `${station.id}: no content-visibility`);
    }
  }
});

test("no loading boundary wraps /landing: the page is in the first flush, also without JavaScript", () => {
  // React streams a completed Suspense boundary larger than ~12.8 KB as its
  // fallback plus a hidden <div> that an inline script swaps in. A
  // `loading.tsx` at the app root or in the landing folder would wrap the
  // landing in one: a light spinner flash on every load, nothing at all
  // without JavaScript.
  for (const dir of [
    ["src", "app"],
    ["src", "app", "landing"],
  ]) {
    for (const ext of ["tsx", "ts", "jsx", "js"]) {
      const file = join(process.cwd(), ...dir, `loading.${ext}`);
      assert.equal(existsSync(file), false, `${dir.join("/")}/loading.${ext} must not exist`);
    }
  }
});

test("first paint: the page opens on the landing's black before any of its CSS loads", async () => {
  const { FIRST_PAINT_STYLE } = await import("../../src/app/landing/firstPaint.ts");
  const css = readFileSync(join(process.cwd(), "src", "app", "landing", "landing.css"), "utf8");
  const voidToken = /--void:\s*(#[0-9a-f]{6})/i.exec(css)?.[1];
  assert.ok(voidToken, "--void token not found in landing.css");
  assert.ok(
    FIRST_PAINT_STYLE.includes(`background:${voidToken}`),
    "first-paint colour drifted from --void"
  );
  assert.ok(
    FIRST_PAINT_STYLE.includes("body::before{content:none}"),
    "the app's grid must not paint first"
  );

  // page.tsx renders the style ahead of the page body. (A full server render
  // of the route needs the Next app router, so the order is pinned on the
  // source.)
  const page = readFileSync(join(process.cwd(), "src", "app", "landing", "page.tsx"), "utf8");
  const styleAt = page.indexOf("<style>{FIRST_PAINT_STYLE}</style>");
  const bodyAt = page.indexOf("<VisitorLanding");
  assert.ok(styleAt >= 0, "page.tsx must render <style>{FIRST_PAINT_STYLE}</style>");
  assert.ok(bodyAt >= 0, "page.tsx must render <VisitorLanding");
  assert.ok(styleAt < bodyAt, `order: style ${styleAt}, body ${bodyAt}`);
});
