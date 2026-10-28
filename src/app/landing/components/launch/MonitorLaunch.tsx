"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";

/** Station: dashboard monitor and launch (spec §6.9). Stub until the section ships. */
export default function MonitorLaunch({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  void stats;
  return <Station id="launch" title={t("dashboardTitle")} />;
}
