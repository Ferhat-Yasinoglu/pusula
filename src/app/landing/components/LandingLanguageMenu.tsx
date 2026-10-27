"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LANGUAGES } from "@/i18n/config";
import type { Locale } from "@/i18n/config";
import { persistLocale } from "@/shared/lib/persistLocale";

/**
 * Language menu for the dark landing page. The dashboard's `LanguageSelector`
 * follows the app theme tokens (light by default), so the public page gets a
 * small dark variant that writes the same cookie and refreshes the route.
 */
export default function LandingLanguageMenu() {
  const t = useTranslations("landing");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((entry) => entry.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (code: Locale) => {
    setOpen(false);
    if (code === locale) return;
    persistLocale(code);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={t("languageMenu")}
        className="flex h-9 items-center gap-1.5 rounded-md border border-[var(--rule)] px-2.5 text-xs font-semibold tracking-wide text-[var(--mist)] transition-colors hover:border-[var(--gold)] hover:text-[var(--foam)]"
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
          language
        </span>
        {current.label}
      </button>
      {open && (
        <ul
          role="listbox"
          aria-label={t("languageMenu")}
          className="absolute end-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--chart)] py-1 shadow-2xl"
        >
          {LANGUAGES.map((entry) => {
            const active = entry.code === locale;
            return (
              <li key={entry.code} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => select(entry.code)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-sm transition-colors ${
                    active
                      ? "text-[var(--gold-bright)]"
                      : "text-[var(--foam)] hover:bg-[var(--chart-raised)]"
                  }`}
                >
                  <span>{entry.native}</span>
                  <span className="readout text-xs text-[var(--mist-dim)]">{entry.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
