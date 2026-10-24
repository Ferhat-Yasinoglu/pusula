"use client";
import "./landing.css";
import type { LandingStats } from "./landingTypes";
import ChartBackdrop from "./components/ChartBackdrop";
import Navigation from "./components/Navigation";
import Hero from "./components/Hero";
import StatsStrip from "./components/StatsStrip";
import Catalog from "./components/Catalog";
import Routing from "./components/Routing";
import Resilience from "./components/Resilience";
import Tools from "./components/Tools";
import DashboardPreview from "./components/DashboardPreview";
import Compression from "./components/Compression";
import Protocols from "./components/Protocols";
import GetStarted from "./components/GetStarted";
import Footer from "./components/Footer";

export default function LandingPage({ stats }: { stats: LandingStats }) {
  return (
    <div className="pusula-landing relative min-h-screen overflow-x-hidden">
      <ChartBackdrop />
      <div className="relative z-10">
        <Navigation />
        <main id="main-content">
          <Hero stats={stats} />
          <StatsStrip stats={stats} />
          <Catalog stats={stats} />
          <Routing stats={stats} />
          <Resilience />
          <Tools stats={stats} />
          <DashboardPreview />
          <Compression stats={stats} />
          <Protocols stats={stats} />
          <GetStarted />
        </main>
        <Footer stats={stats} />
      </div>
    </div>
  );
}
