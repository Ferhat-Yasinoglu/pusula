"use client";
import { useEffect, useMemo, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { LandingStats } from "../../landingTypes";
import { canAnimate } from "../../runtime/heartbeat";
import { hash32, int, mulberry32 } from "../../sim/prng";
import SplitFlap, { type SplitFlapHandle } from "../primitives/SplitFlap";
import { numberFormat } from "../primitives/primitiveKit";

/**
 * The almanac board: the gateway's real figures on split-flap tiles along the
 * hero's bottom edge (spec §6.2). Real figures only, never a simulated cell.
 *
 * Alive: the cells flip in at the intro hand-off (70ms apart), then every
 * 5–8s one seeded cell re-flips and lands on the same value, only while the
 * page may animate.
 */

type Cell = { value: number; label: string };

const REFLIP_MIN_MS = 5000;
const REFLIP_MAX_MS = 8000;

export default function AlmanacBoard({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const format = useMemo(() => numberFormat(locale), [locale]);
  const cells: Cell[] = [
    { value: stats.providers, label: t("statProviders") },
    { value: stats.freeProviders, label: t("statFree") },
    { value: stats.strategies.length, label: t("statStrategies") },
    { value: stats.scoringFactors.length, label: t("boardFactors") },
    { value: stats.cliTools.length, label: t("statTools") },
    { value: stats.mcpTools, label: t("boardMcpTools") },
  ];
  const flaps = useRef<(SplitFlapHandle | null)[]>([]);
  const boardRef = useRef<HTMLDivElement>(null);
  const count = cells.length;

  useEffect(() => {
    const node = boardRef.current;
    if (!node) return;
    const rng = mulberry32(hash32("almanac", count));
    let timer = 0;
    let visible = false;
    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(tick, int(rng, REFLIP_MIN_MS, REFLIP_MAX_MS));
    };
    const tick = () => {
      if (visible && canAnimate()) flaps.current[int(rng, 0, count - 1)]?.reflip();
      schedule();
    };
    const observer =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            const entry = entries[entries.length - 1];
            if (entry) visible = entry.isIntersecting;
          })
        : null;
    if (observer) observer.observe(node);
    else visible = true;
    schedule();
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, [count]);

  return (
    <div
      ref={boardRef}
      className="almanac"
      role="group"
      aria-label={t("statsAria")}
      data-dock-clear=""
    >
      <ul className="almanac-row">
        {cells.map((cell, i) => (
          <li key={i} className="almanac-cell">
            <SplitFlap
              ref={(handle) => {
                flaps.current[i] = handle;
              }}
              className="almanac-value"
              value={format.format(cell.value)}
              startOn="intro"
              delay={i * 70}
            />
            <span className="almanac-label">{cell.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
