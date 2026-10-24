"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../landingTypes";
import SectionHeading from "./SectionHeading";

/**
 * Strategy ids and scoring-factor ids are code identifiers; the page shows
 * them verbatim (monospace) next to a translated one-line description. Keys
 * are looked up with a fallback so a newly added strategy never breaks the
 * page — it simply appears without a description until translated.
 */
function describe(t: ReturnType<typeof useTranslations>, prefix: string, id: string): string {
  const key = `${prefix}_${id.replace(/-/g, "_")}`;
  return t.has(key) ? t(key) : "";
}

export default function Routing({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const maxWeight = Math.max(...stats.scoringFactors.map((factor) => factor.weight), 0.0001);

  return (
    <section
      id="routing"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("routingTitle")} lead={t("routingLead")} />

        <div className="grid gap-14 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <h3 className="text-lg font-semibold text-[var(--foam)]">
              {t("routingStrategiesTitle", { count: stats.strategies.length })}
            </h3>
            <p className="mt-2 text-sm text-[var(--mist)]">{t("routingStrategiesLead")}</p>
            <ul className="mt-6 divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
              {stats.strategies.map((id) => {
                const description = describe(t, "strategy", id);
                const isAuto = id === "auto";
                return (
                  <li key={id} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2.5">
                    <code
                      className={`readout text-sm ${
                        isAuto ? "text-[var(--amber)]" : "text-[var(--teal-bright)]"
                      }`}
                      dir="ltr"
                    >
                      {id}
                    </code>
                    <span className="text-sm text-[var(--mist)]">{description}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-7">
            <h3 className="text-lg font-semibold text-[var(--foam)]">
              {t("routingAutoTitle", { count: stats.scoringFactors.length })}
            </h3>
            <p className="mt-2 text-sm text-[var(--mist)]">{t("routingAutoLead")}</p>
            <figure className="mt-6">
              <ol className="space-y-2">
                {stats.scoringFactors.map((factor) => {
                  const silent = factor.weight === 0;
                  const label = describe(t, "factor", factor.id) || factor.id;
                  return (
                    <li
                      key={factor.id}
                      className="grid grid-cols-[minmax(0,13.5rem)_1fr_4.25rem] items-center gap-3"
                    >
                      <span className="truncate text-sm text-[var(--foam)]" title={factor.id}>
                        {label}
                      </span>
                      <span className="h-2 overflow-hidden rounded-full bg-[var(--rule-soft)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max((factor.weight / maxWeight) * 100, silent ? 0 : 2)}%`,
                            background: silent ? "transparent" : "var(--teal)",
                          }}
                        />
                      </span>
                      <span
                        className={`readout text-end text-xs ${
                          silent ? "text-[var(--mist-dim)]" : "text-[var(--mist)]"
                        }`}
                      >
                        {silent ? t("routingFactorSilent") : factor.weight.toFixed(3)}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <figcaption className="mt-4 text-xs text-[var(--mist-dim)]">
                {t("routingAutoCaption")}
              </figcaption>
            </figure>
          </div>
        </div>
      </div>
    </section>
  );
}
