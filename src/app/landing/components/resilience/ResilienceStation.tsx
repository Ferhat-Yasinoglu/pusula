"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";

/** Station: the storm rail (spec §6.6). Stub until the section ships. */
export default function ResilienceStation({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  void stats;
  return <Station id="resilience" title={t("resilienceTitle")} />;
}
