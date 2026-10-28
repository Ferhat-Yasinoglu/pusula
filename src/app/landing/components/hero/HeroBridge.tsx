"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";

/** The bridge: hero gyro-compass and almanac board (spec §6.2). Stub until the hero ships. */
export default function HeroBridge({ stats, poster }: { stats: LandingStats; poster: ReactNode }) {
  const t = useTranslations("landing");
  return (
    <section
      id="bridge"
      data-station="bridge"
      className="station-inner"
      style={{ minHeight: "100svh", paddingTop: 96 }}
    >
      <h1 className="serif-display">
        {t("heroCardLine1")} {t("heroCardLine2", { providers: stats.providers })}
      </h1>
      {poster}
    </section>
  );
}
