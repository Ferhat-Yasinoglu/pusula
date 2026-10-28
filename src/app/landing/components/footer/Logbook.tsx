"use client";
import type { LandingStats } from "../../landingTypes";

/** Footer: the logbook (spec §6.10). Stub until the footer ships. */
export default function Logbook({ stats }: { stats: LandingStats }) {
  return (
    <footer className="station-inner" style={{ padding: "64px 0" }}>
      Pusula v{stats.version}
    </footer>
  );
}
