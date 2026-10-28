"use client";
import { useEffect, useRef, type ReactNode } from "react";
import "./landing.css";
import type { LandingStats } from "./landingTypes";
import { usePrefersReducedMotion, useScrollReveal } from "./landingMotion";
import { initDeck, primeDeck } from "./runtime/deckStore";
import IntroSequence from "./components/intro/IntroSequence";
import CompassNav from "./components/nav/CompassNav";
import SimDock from "./components/nav/SimDock";
import HeroBridge from "./components/hero/HeroBridge";
import NetworkMap from "./components/map/NetworkMap";
import CatalogWall from "./components/catalog/CatalogWall";
import RoutingStation from "./components/routing/RoutingStation";
import ResilienceStation from "./components/resilience/ResilienceStation";
import ToolsUplink from "./components/tools/ToolsUplink";
import EngineRoom from "./components/engine/EngineRoom";
import MonitorLaunch from "./components/launch/MonitorLaunch";
import Logbook from "./components/footer/Logbook";

/**
 * The landing page shell, "SEYİR": eight stations on the eight principal
 * winds, all driven by one seeded simulation of the gateway (the deck).
 * `primeDeck` runs in render so SSR and hydration read the same tick-0 world;
 * `initDeck` starts it stepping on the heartbeat once mounted.
 */
export default function LandingPage({
  stats,
  posters,
}: {
  stats: LandingStats;
  posters: { hero: ReactNode; map: ReactNode };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  primeDeck(stats);
  useEffect(() => initDeck(stats), [stats]);
  useScrollReveal(rootRef, !reduced);

  return (
    <div ref={rootRef} className="pusula-landing" data-motion={reduced ? "off" : "on"}>
      <IntroSequence stats={stats} />
      <CompassNav stats={stats} />
      <main id="main-content">
        <HeroBridge stats={stats} poster={posters.hero} />
        <NetworkMap poster={posters.map} />
        <CatalogWall stats={stats} />
        <RoutingStation stats={stats} />
        <ResilienceStation stats={stats} />
        <ToolsUplink stats={stats} />
        <EngineRoom stats={stats} />
        <MonitorLaunch stats={stats} />
      </main>
      <Logbook stats={stats} />
      <SimDock />
    </div>
  );
}
