"use client";
import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import PusulaLogo from "@/shared/components/PusulaLogo";
import LandingLanguageMenu from "./LandingLanguageMenu";

const REPO_URL = "https://github.com/Ferhat-Yasinoglu/pusula";

const SECTION_LINKS = [
  { key: "navMap", href: "#network" },
  { key: "navCatalog", href: "#catalog" },
  { key: "navRouting", href: "#routing" },
  { key: "navTools", href: "#tools" },
  { key: "navDashboard", href: "#dashboard" },
] as const;

export default function Navigation() {
  const t = useTranslations("landing");
  const [open, setOpen] = useState(false);

  const linkClass =
    "text-sm text-[var(--mist)] transition-colors hover:text-[var(--foam)] whitespace-nowrap";

  return (
    <header className="fixed top-0 z-50 w-full border-b border-[var(--rule-soft)] bg-[rgba(7,8,10,0.62)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/landing" className="flex items-center gap-2.5" aria-label={t("navigateHome")}>
          <span className="flex size-8 items-center justify-center rounded-lg btn-gold">
            <PusulaLogo size={20} />
          </span>
          <span className="text-lg font-bold tracking-tight">{t("brandName")}</span>
        </Link>

        <nav className="hidden items-center gap-7 md:flex" aria-label={t("navSections")}>
          {SECTION_LINKS.map((link) => (
            <a key={link.key} href={link.href} className={linkClass}>
              {t(link.key)}
            </a>
          ))}
          <Link href="/docs" className={linkClass}>
            {t("navDocs")}
          </Link>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {t("navGithub")}
          </a>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <LandingLanguageMenu />
          <Link
            href="/dashboard"
            className="hidden h-9 items-center btn-gold rounded-full px-4 text-sm font-bold sm:inline-flex"
          >
            {t("navOpenDashboard")}
          </Link>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-md border border-[var(--rule)] text-[var(--foam)] md:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            aria-label={t("toggleMenu")}
          >
            <span className="material-symbols-outlined" aria-hidden="true">
              {open ? "close" : "menu"}
            </span>
          </button>
        </div>
      </div>

      {open && (
        <div
          id="landing-mobile-menu"
          className="border-t border-[var(--rule-soft)] bg-[var(--ink)] md:hidden"
        >
          <nav className="flex flex-col gap-1 p-4" aria-label={t("navSections")}>
            {SECTION_LINKS.map((link) => (
              <a
                key={link.key}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-base text-[var(--foam)] hover:bg-[var(--chart)]"
              >
                {t(link.key)}
              </a>
            ))}
            <Link
              href="/docs"
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-2.5 text-base text-[var(--foam)] hover:bg-[var(--chart)]"
            >
              {t("navDocs")}
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md px-2 py-2.5 text-base text-[var(--foam)] hover:bg-[var(--chart)]"
            >
              {t("navGithub")}
            </a>
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex h-11 items-center justify-center btn-gold rounded-full text-base font-bold"
            >
              {t("navOpenDashboard")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
