import type { Viewport } from "next";
import { getLandingStats } from "./landingStats";
import { FIRST_PAINT_STYLE } from "./firstPaint";
import VisitorLanding from "./visitor/VisitorLanding";

/**
 * The landing is always dark: the browser chrome (Safari's toolbar tint,
 * Android's status bar) matches the page, not the app's navy.
 */
export const viewport: Viewport = {
  themeColor: "#0b0907",
  colorScheme: "dark",
};

/**
 * Public visitor page ("Pusula ziyaretçi sayfası"). A server component, so
 * every figure on it is read from the gateway's own constants at request time
 * (see `landingStats.ts`) and the whole page is in the first response, also
 * without JavaScript. The first-paint style ahead of it keeps the first frame
 * dark before any CSS loads (`firstPaint.ts`).
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
      <VisitorLanding providers={stats.providers} />
    </>
  );
}
