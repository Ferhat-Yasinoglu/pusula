"use client";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import type { Locale } from "@/i18n/config";
import { persistLocale } from "@/shared/lib/persistLocale";
import { VISITOR_LOCALES } from "./visitorModel";

/**
 * The visitor page's TR / EN / DE / FA buttons. Like the rest of the app it
 * writes the locale cookie (`persistLocale`) and refreshes the route, so the
 * server renders the new language with the right `<html lang>` and `dir`.
 */
export default function VisitorLanguageSwitch({ label }: { label: string }) {
  const locale = useLocale();
  const router = useRouter();

  const select = (code: Locale) => {
    if (code === locale) return;
    persistLocale(code);
    router.refresh();
  };

  return (
    <div className="vz-langs" role="group" aria-label={label}>
      {VISITOR_LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          lang={code}
          className="vz-lang"
          aria-pressed={code === locale}
          onClick={() => select(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
