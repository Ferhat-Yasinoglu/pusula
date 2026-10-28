"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";

/** Station: compression bench and MCP/A2A array (spec §6.8). Stub until the section ships. */
export default function EngineRoom({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  void stats;
  return <Station id="engine" title={t("compressionTitle")} />;
}
