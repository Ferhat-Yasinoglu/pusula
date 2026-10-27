"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import type { LandingStats } from "../landingTypes";
import Astrolabe from "./Astrolabe";

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
    <section className="relative flex min-h-[100svh] items-center px-4 pb-16 pt-28 sm:px-6 sm:pt-32 lg:pb-20">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-14 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-6">
          <p
            className="rise readout mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--rule)] bg-[rgba(212,168,64,0.06)] px-3 py-1 text-xs text-[var(--mist)]"
            style={{ animationDelay: "100ms" }}
          >
            <span className="live-dot" aria-hidden="true" />
            {t("heroVersion", { version: stats.version })}
          </p>
          <h1 className="rise display gilded" style={{ animationDelay: "220ms" }}>
            {t("heroTitle")}
          </h1>
          <p className="rise lead mt-7" style={{ animationDelay: "380ms" }}>
            {t("heroLead", { providers: stats.providers, free: stats.freeProviders })}
          </p>

          <div
            className="rise mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animationDelay: "520ms" }}
          >
            <Link
              href="/dashboard"
              className="btn-gold inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-base font-bold"
            >
              {t("heroCtaDashboard")}
              <span
                className="material-symbols-outlined text-[20px] rtl:-scale-x-100"
                aria-hidden="true"
              >
                arrow_forward
              </span>
            </Link>
          </div>

          <div className="rise mt-9 max-w-md" style={{ animationDelay: "660ms" }}>
            <p className="mb-2 text-xs text-[var(--mist-dim)]">{t("heroInstallHint")}</p>
            <div className="glass flex items-center justify-between gap-3 rounded-xl ps-4 pe-2 py-2">
              <code className="readout caret text-sm text-[var(--gold-bright)]" dir="ltr">
                <span className="text-[var(--mist-dim)]">$ </span>
                {INSTALL_COMMAND}
              </code>
              <button
                type="button"
                onClick={copyInstall}
                className="readout flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs text-[var(--mist)] transition-colors hover:bg-[var(--chart-raised)] hover:text-[var(--foam)]"
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
          <Astrolabe factorCount={stats.scoringFactors.length} />
        </div>
      </div>
    </section>
  );
}
