import LandingPage from "./LandingPage";
import { getLandingStats } from "./landingStats";

/**
 * Public landing page. A server component so every figure on the page is read
 * from the gateway's own constants at request time (see `landingStats.ts`);
 * the client shell below only renders.
 */
export default function LandingRoute() {
  return <LandingPage stats={getLandingStats()} />;
}
