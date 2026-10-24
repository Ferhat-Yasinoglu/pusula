"use client";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../landingTypes";
import SectionHeading from "./SectionHeading";

/**
 * Compression and semantic cache: the two things that stretch a free tier.
 * The savings range quoted here is the one measured in the project's own
 * compression benchmarks (`docs/compression/`); it is a range, not a promise.
 */
export default function Compression({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");

  // Header names come from `src/shared/constants/headers.ts`; values are the
  // shapes the handlers emit (`planResolution.ts`, `chatCore/semanticCache.ts`).
  const items = [
    {
      title: t("compressionEnginesTitle", { count: stats.compressionEngines }),
      desc: t("compressionEnginesDesc"),
      code: "X-Pusula-Compression: stacked; source=combo",
    },
    {
      title: t("compressionCacheTitle"),
      desc: t("compressionCacheDesc"),
      code: "X-Pusula-Cache: HIT",
    },
    {
      title: t("compressionSavingsTitle"),
      desc: t("compressionSavingsDesc"),
      code: "X-Pusula-Savings-Tokens: 1842",
    },
  ];

  return (
    <section
      id="compression"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("compressionTitle")} lead={t("compressionLead")} />
        <div className="grid gap-x-10 gap-y-10 md:grid-cols-3">
          {items.map((item) => (
            <div key={item.code} className="border-t border-[var(--rule)] pt-5">
              <h3 className="text-base font-semibold text-[var(--foam)]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--mist)]">{item.desc}</p>
              <code className="readout mt-4 block text-xs text-[var(--teal-bright)]" dir="ltr">
                {item.code}
              </code>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
