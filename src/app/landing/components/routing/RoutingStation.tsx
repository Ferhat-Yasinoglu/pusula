"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";

/** Station: the rose of sixteen and the strategy band (spec §6.5). Stub until the section ships. */
export default function RoutingStation({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  void stats;
  return <Station id="routing" title={t("routingTitle")} />;
}
