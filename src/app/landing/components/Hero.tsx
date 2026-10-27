"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import type { LandingStats } from "../landingTypes";
import RoutingInstrument from "./RoutingInstrument";

const INSTALL_COMMAND = "npx pusula";

export default function Hero({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const [copied, setCopied] = useState(false);

  const copyInstall = async () => {
    await copyToClipboard(INSTALL_COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="relative px-4 pb-16 pt-28 sm:px-6 sm:pt-36 lg:pb-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p className="readout mb-6 inline-flex items-center gap-2 rounded-full border border-[var(--rule)] px-3 py-1 text-xs text-[var(--mist)]">
            <span className="size-1.5 rounded-full bg-[var(--teal-bright)]" aria-hidden="true" />
            {t("heroVersion", { version: stats.version })}
          </p>
          <h1 className="display text-[var(--foam)]">{t("heroTitle")}</h1>
          <p className="lead mt-6">
            {t("heroLead", { providers: stats.providers, free: stats.freeProviders })}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/dashboard"
              className="inline-flex h-12 items-center justify-center rounded-md bg-[var(--teal)] px-6 text-base font-semibold text-[var(--foam)] transition-colors hover:bg-[var(--teal-ink)]"
            >
              {t("heroCtaDashboard")}
            </Link>
          </div>

          <div className="mt-8 max-w-md">
            <p className="mb-2 text-xs text-[var(--mist-dim)]">{t("heroInstallHint")}</p>
            <div className="flex items-center justify-between gap-3 rounded-md border border-[var(--rule)] bg-[var(--ink-deep)] ps-4 pe-2 py-2">
              <code className="readout caret text-sm text-[var(--teal-bright)]" dir="ltr">
                <span className="text-[var(--mist-dim)]">$ </span>
                {INSTALL_COMMAND}
              </code>
              <button
                type="button"
                onClick={copyInstall}
                className="readout flex h-8 shrink-0 items-center gap-1 rounded px-2 text-xs text-[var(--mist)] transition-colors hover:bg-[var(--chart)] hover:text-[var(--foam)]"
                aria-live="polite"
              >
                <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                  {copied ? "check" : "content_copy"}
                </span>
                {copied ? t("copied") : t("copy")}
              </button>
            </div>
          </div>
        </div>

        <div className="flex justify-center lg:col-span-6 lg:justify-end">
          <RoutingInstrument factorCount={stats.scoringFactors.length} />
        </div>
      </div>
    </section>
  );
}
