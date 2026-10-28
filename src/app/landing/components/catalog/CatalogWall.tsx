"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";

/** Station: the provider wall (spec §6.4). Stub until the section ships. */
export default function CatalogWall({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  void stats;
  return <Station id="catalog" title={t("catalogTitle", { count: stats.providers })} />;
}
