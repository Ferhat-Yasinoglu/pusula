"use client";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Station } from "../primitives";

/** Network: the Afghanistan map (spec §6.3). Stub until the map ships. */
export default function NetworkMap({ poster }: { poster: ReactNode }) {
  const t = useTranslations("landing");
  return (
    <Station id="network" title={t("mapTitle")} lead={t("mapLead")}>
      {poster}
    </Station>
  );
}
