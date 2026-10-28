"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";

/** Station: the patch bay (spec §6.7). Stub until the section ships. */
export default function ToolsUplink({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  void stats;
  return <Station id="tools" title={t("toolsTitle")} />;
}
