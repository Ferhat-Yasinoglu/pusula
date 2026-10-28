import LandingPage from "./LandingPage";
import { getLandingStats } from "./landingStats";
import { INTRO_GATE } from "./components/intro/introGate";
import HeroPoster from "./components/hero/HeroPoster";
import MapPoster from "./components/map/MapPoster";

/**
 * Public landing page. A server component so every figure on the page is read
 * from the gateway's own constants at request time (see `landingStats.ts`).
 * The posters are server components too: the still frames of the two canvases
 * are rendered once here and never re-run on the client. The intro gate runs
 * before first paint to decide whether the first-visit intro plays.
 */
export default function LandingRoute() {
  const stats = getLandingStats();
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: INTRO_GATE }} />
      <LandingPage
        stats={stats}
        posters={{ hero: <HeroPoster stats={stats} />, map: <MapPoster /> }}
      />
    </>
  );
}
