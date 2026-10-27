"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import PusulaLogo from "@/shared/components/PusulaLogo";
import type { LandingStats } from "../landingTypes";

const REPO_URL = "https://github.com/Ferhat-Yasinoglu/pusula";
const UPSTREAM_URL = "https://github.com/diegosouzapw/OmniRoute";

export default function Footer({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const year = new Date().getFullYear();

  const columns = [
    {
      title: t("footerProduct"),
      links: [
        { label: t("navOpenDashboard"), href: "/dashboard" },
        { label: t("navCatalog"), href: "#catalog" },
        { label: t("navRouting"), href: "#routing" },
        { label: t("footerChangelog"), href: "/dashboard/changelog" },
      ],
    },
    {
      title: t("footerResources"),
      links: [
        { label: t("navDocs"), href: "/docs" },
        { label: t("navGithub"), href: REPO_URL, external: true },
        { label: t("footerNpm"), href: "https://www.npmjs.com/package/pusula", external: true },
      ],
    },
    {
      title: t("footerLegal"),
      links: [
        { label: t("footerLicense"), href: `${REPO_URL}/blob/main/LICENSE`, external: true },
        { label: t("footerPrivacy"), href: "/privacy" },
        { label: t("footerTerms"), href: "/terms" },
      ],
    },
  ];

  return (
    <footer className="border-t border-[var(--rule-soft)] bg-[var(--ink-deep)] px-4 pb-10 pt-16 sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2.5">
              <span className="flex size-7 items-center justify-center rounded-lg btn-gold">
                <PusulaLogo size={18} />
              </span>
              <span className="text-lg font-bold">{t("brandName")}</span>
              <span className="readout ms-1 text-xs text-[var(--mist-dim)]">v{stats.version}</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-6 text-[var(--mist)]">
              {t("footerTagline", { providers: stats.providers })}
            </p>
          </div>

          {columns.map((column) => (
            <nav key={column.title} className="md:col-span-2" aria-label={column.title}>
              <h3 className="text-sm font-semibold text-[var(--foam)]">{column.title}</h3>
              <ul className="mt-3 space-y-2">
                {column.links.map((link) =>
                  link.external ? (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[var(--mist)] transition-colors hover:text-[var(--foam)]"
                      >
                        {link.label}
                      </a>
                    </li>
                  ) : (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-sm text-[var(--mist)] transition-colors hover:text-[var(--foam)]"
                      >
                        {link.label}
                      </Link>
                    </li>
                  )
                )}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--rule-soft)] pt-6 text-xs text-[var(--mist-dim)] sm:flex-row sm:items-center sm:justify-between">
          <p>{t("copyright", { year })}</p>
          <p>
            {t("footerUpstream")}{" "}
            <a
              href={UPSTREAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--mist)] underline-offset-4 hover:underline"
            >
              OmniRoute
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
