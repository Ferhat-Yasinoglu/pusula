"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { Station } from "../primitives";
import CompressionBench from "./CompressionBench";
import ProtocolArray from "./ProtocolArray";
import "./engine.css";

/**
 * Station W, 270°: under the hood (spec §6.8). Two plain `<h2>`s in one
 * station: the compression bench (`compressionTitle`, the station's own
 * title) and, below it, the MCP and A2A array (`protocolsTitle`).
 */
export default function EngineRoom({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  return (
    <Station
      id="engine"
      title={t("compressionTitle")}
      lead={t("compressionLead")}
      className="engine-station"
    >
      <CompressionBench stats={stats} />
      <ProtocolArray stats={stats} />
    </Station>
  );
}
