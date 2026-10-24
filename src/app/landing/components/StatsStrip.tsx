"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../landingTypes";

/**
 * Four figures read from the codebase, set as a single ruled line rather than
 * four cards: the numbers are the point, the chrome around them is not.
 */
export default function StatsStrip({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const items = [
    { value: stats.providers, label: t("statProviders") },
    { value: stats.freeProviders, label: t("statFree") },
    { value: stats.strategies.length, label: t("statStrategies") },
    { value: stats.cliTools.length, label: t("statTools") },
  ];

  return (
    <section className="px-4 sm:px-6" aria-label={t("statsAria")}>
      <dl className="mx-auto grid max-w-7xl grid-cols-2 border-y border-[var(--rule-soft)] md:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`py-6 pe-4 ${i % 2 === 1 ? "ps-6 md:ps-8" : "ps-0"} ${
              i > 1 ? "border-t border-[var(--rule-soft)] md:border-t-0" : ""
            } ${i % 2 === 1 ? "border-s border-[var(--rule-soft)]" : ""} ${
              i === 2 ? "md:border-s" : ""
            }`}
          >
            <dd className="readout text-3xl font-semibold text-[var(--foam)] sm:text-4xl">
              {item.value}
            </dd>
            <dt className="mt-1 text-sm text-[var(--mist)]">{item.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
