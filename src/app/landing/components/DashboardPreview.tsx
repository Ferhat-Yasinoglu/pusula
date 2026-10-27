"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import SectionHeading from "./SectionHeading";

/**
 * The dashboard screenshot sits in a plain window frame; beside it, the four
 * facts a self-hoster asks first: where the data lives, how keys are stored,
 * whether an account is needed, which port to open.
 */
export default function DashboardPreview() {
  const t = useTranslations("landing");

  const facts = [
    { icon: "database", title: t("dashboardFactLocalTitle"), desc: t("dashboardFactLocalDesc") },
    {
      icon: "enhanced_encryption",
      title: t("dashboardFactEncryptedTitle"),
      desc: t("dashboardFactEncryptedDesc"),
    },
    {
      icon: "person_off",
      title: t("dashboardFactNoAccountTitle"),
      desc: t("dashboardFactNoAccountDesc"),
    },
    { icon: "lan", title: t("dashboardFactPortTitle"), desc: t("dashboardFactPortDesc") },
  ];

  return (
    <section
      id="dashboard"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          title={t("dashboardTitle")}
          lead={t("dashboardLead")}
          aside={
            <Link
              href="/dashboard"
              className="inline-flex h-10 items-center rounded-md border border-[var(--rule)] px-4 text-sm font-semibold text-[var(--foam)] transition-colors hover:border-[var(--gold)]"
            >
              {t("navOpenDashboard")}
            </Link>
          }
        />

        <div className="reveal grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="overflow-hidden rounded-xl border border-[var(--rule)] bg-[var(--chart)] shadow-[0_40px_90px_-40px_rgba(0,0,0,0.8)]">
              <div className="flex items-center gap-2 border-b border-[var(--rule-soft)] px-3 py-2">
                <span className="size-2.5 rounded-full bg-[var(--rule)]" aria-hidden="true" />
                <span className="size-2.5 rounded-full bg-[var(--rule)]" aria-hidden="true" />
                <span className="size-2.5 rounded-full bg-[var(--rule)]" aria-hidden="true" />
                <span className="readout ms-3 text-[11px] text-[var(--mist-dim)]" dir="ltr">
                  localhost:20128/dashboard
                </span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element -- static asset, no optimisation needed */}
              <img
                src="/screenshots/dashboard.png"
                width={1280}
                height={720}
                alt={t("dashboardScreenshotAlt")}
                loading="lazy"
                className="block w-full"
              />
            </div>
          </div>

          <dl className="grid gap-6 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
            {facts.map((fact) => (
              <div key={fact.icon} className="flex gap-3">
                <span
                  className="material-symbols-outlined mt-0.5 shrink-0 text-[20px] text-[var(--gold-bright)]"
                  aria-hidden="true"
                >
                  {fact.icon}
                </span>
                <div>
                  <dt className="text-sm font-semibold text-[var(--foam)]">{fact.title}</dt>
                  <dd className="mt-1 text-sm leading-6 text-[var(--mist)]">{fact.desc}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
