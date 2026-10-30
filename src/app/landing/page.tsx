import type { Viewport } from "next";
import LandingPage from "./LandingPage";
import { getLandingStats } from "./landingStats";
import { INTRO_GATE } from "./components/intro/introGate";
import { FIRST_PAINT_STYLE } from "./firstPaint";
import HeroPoster from "./components/hero/HeroPoster";
import MapPoster from "./components/map/MapPoster";

/**
 * The landing is always black: the browser chrome (Safari's toolbar tint,
 * Android's status bar) matches the page's `--void`, not the app's navy.
 */
export const viewport: Viewport = {
  themeColor: "#040405",
  colorScheme: "dark",
};

/**
 * Without JavaScript: the SimDock's Pause and Time-lapse controls do nothing
 * and it cannot step aside for the content it covers, so it is not shown;
 * headings skip WordReveal's hold (its failsafe would keep them hidden for
 * the first 5s); the hero's provider names show where the server drew them.
 */
const NO_SCRIPT_STYLE =
  "<style>" +
  ".pusula-landing .sim-dock{display:none!important}" +
  ".pusula-landing .wr .wr-w{animation:none!important}" +
  ".pusula-landing .bridge-dial:not([data-placed]) .bridge-cand{opacity:1;visibility:visible}" +
  ".pusula-landing .bridge-dial:not([data-placed]) .bridge-cand[data-front='0']{opacity:.35}" +
  "</style>";

/**
 * Public landing page. A server component so every figure on the page is read
 * from the gateway's own constants at request time (see `landingStats.ts`).
 * The posters are server components too: the still frames of the two canvases
 * are rendered once here and never re-run on the client. The intro gate runs
 * before first paint to decide whether the first-visit intro plays; the
 * first-paint style ahead of it keeps that first frame black (`firstPaint.ts`).
 *
 * No `loading.tsx` may wrap this route (none in this folder or above it): React
 * streams a large page behind a Suspense boundary as a hidden `<div>` that an
 * inline script swaps in, so the first paint would be the fallback and a
 * visitor without JavaScript would never see the page.
 */
export default function LandingRoute() {
  const stats = getLandingStats();
  return (
    <>
      <style>{FIRST_PAINT_STYLE}</style>
      <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
      <noscript dangerouslySetInnerHTML={{ __html: NO_SCRIPT_STYLE }} />
      <LandingPage
        stats={stats}
        posters={{ hero: <HeroPoster stats={stats} />, map: <MapPoster /> }}
      />
    </>
  );
}
