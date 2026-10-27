"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { useDisplayBaseUrl } from "@/shared/hooks";
import SectionHeading from "./SectionHeading";

const INSTALL_COMMAND = "npx pusula";

/**
 * The one numbered sequence on the page: three steps that are really
 * sequential. The terminal on the right shows what the first step prints.
 */
export default function GetStarted() {
  const t = useTranslations("landing");
  const baseUrl = useDisplayBaseUrl();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await copyToClipboard(INSTALL_COMMAND);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const steps = [
    { title: t("startStep1Title"), desc: t("startStep1Desc") },
    { title: t("startStep2Title"), desc: t("startStep2Desc") },
    { title: t("startStep3Title"), desc: t("startStep3Desc", { url: `${baseUrl}/v1` }) },
  ];

  return (
    <section
      id="start"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("startTitle")} lead={t("startLead")} />

        <div className="reveal grid gap-12 lg:grid-cols-12 lg:gap-10">
          <ol className="space-y-8 lg:col-span-5">
            {steps.map((step, i) => (
              <li key={step.title} className="grid grid-cols-[2.5rem_1fr] gap-4">
                <span className="readout flex size-9 items-center justify-center rounded-full border border-[var(--rule)] text-sm text-[var(--gold-bright)]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-[var(--foam)]">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-[var(--mist)]">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="lg:col-span-7">
            <div className="overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--ink-deep)]">
              <div className="flex items-center justify-between border-b border-[var(--rule-soft)] px-3 py-2">
                <span className="readout text-[11px] text-[var(--mist-dim)]">
                  {t("startTerminal")}
                </span>
                <button
                  type="button"
                  onClick={copy}
                  className="readout flex h-8 items-center gap-1 rounded px-2 text-xs text-[var(--mist)] transition-colors hover:bg-[var(--chart)] hover:text-[var(--foam)]"
                  aria-live="polite"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {copied ? "check" : "content_copy"}
                  </span>
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
              <pre className="readout overflow-x-auto p-4 text-[13px] leading-6" dir="ltr">
                <code>
                  <span className="text-[var(--mist-dim)]">$ </span>
                  <span className="text-[var(--gold-bright)]">{INSTALL_COMMAND}</span>
                  {"\n"}
                  <span className="text-[var(--mist)]">{t("startRunning")}</span>
                  {"\n"}
                  <span className="text-[var(--mist)]">{t("startApi")}</span>{" "}
                  <span className="text-[var(--foam)]">{baseUrl}/v1</span>
                  {"\n"}
                  <span className="text-[var(--mist)]">{t("startDashboard")}</span>{" "}
                  <span className="text-[var(--foam)]">{baseUrl}/dashboard</span>
                </code>
              </pre>
            </div>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center justify-center btn-gold rounded-full px-6 text-sm font-bold"
              >
                {t("navOpenDashboard")}
              </Link>
              <Link
                href="/docs"
                className="inline-flex h-11 items-center justify-center rounded-md border border-[var(--rule)] px-6 text-sm font-semibold text-[var(--foam)] transition-colors hover:border-[var(--gold)]"
              >
                {t("navDocs")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
