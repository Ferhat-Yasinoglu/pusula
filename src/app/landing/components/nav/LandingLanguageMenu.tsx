"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { LANGUAGES, RTL_LOCALES, type Locale } from "@/i18n/config";
import { persistLocale } from "@/shared/lib/persistLocale";
import Glyph from "../primitives/Glyph";
import { cx } from "../primitives/primitiveKit";
import "./nav.css";

/**
 * Language switch for the dark landing page. The dashboard's
 * `LanguageSelector` follows the app's (light) theme, so the public page has
 * its own: it writes the same locale cookie (`persistLocale`) and refreshes
 * the route, exactly as before; only the look changed.
 *
 * - `dropdown` (the bar): a globe pill showing the current code; the panel
 *   lists every language by its native name. Esc, an outside press or Tab
 *   away closes it; arrow keys, Home and End move between languages.
 * - `inline` (the phone menu): the four languages as a row of 44px buttons,
 *   no popover inside a scrolling dialog.
 */

export type LandingLanguageMenuProps = {
  variant?: "dropdown" | "inline";
  className?: string;
};

function directionOf(code: string): "rtl" | "ltr" {
  return (RTL_LOCALES as readonly string[]).includes(code) ? "rtl" : "ltr";
}

export default function LandingLanguageMenu({
  variant = "dropdown",
  className,
}: LandingLanguageMenuProps) {
  const t = useTranslations("landing");
  const locale = useLocale();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const panelId = useId();

  const current = LANGUAGES.find((entry) => entry.code === locale) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Focus the current language once the panel is in the DOM.
    listRef.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const select = (code: Locale) => {
    setOpen(false);
    if (code === locale) return;
    persistLocale(code);
    router.refresh();
  };

  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>("button"));
    const index = items.indexOf(document.activeElement as HTMLButtonElement);
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    if (next < 0) return;
    event.preventDefault();
    items[next]?.focus();
  };

  if (variant === "inline") {
    return (
      <div className={cx("lang-inline", className)} role="group" aria-label={t("languageMenu")}>
        {LANGUAGES.map((entry) => {
          const active = entry.code === locale;
          return (
            <button
              key={entry.code}
              type="button"
              className="lang-inline-opt"
              aria-pressed={active}
              lang={entry.code}
              dir={directionOf(entry.code)}
              onClick={() => select(entry.code)}
            >
              {entry.native}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={cx("lang", className)}
      onBlur={(event) => {
        if (open && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="lang-btn"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${t("languageMenu")}: ${current.native}`}
      >
        <Glyph name="globe" size={16} tone="current" />
        <span className="lang-code" dir="ltr">
          {current.label}
        </span>
      </button>
      {open ? (
        <div id={panelId} className="lang-panel nav-pop">
          <ul ref={listRef} aria-label={t("languageMenu")} onKeyDown={onListKeyDown}>
            {LANGUAGES.map((entry) => {
              const active = entry.code === locale;
              return (
                <li key={entry.code}>
                  <button
                    type="button"
                    className="lang-opt"
                    aria-current={active ? "true" : undefined}
                    onClick={() => select(entry.code)}
                  >
                    <span lang={entry.code} dir={directionOf(entry.code)}>
                      {entry.native}
                    </span>
                    <span className="lang-opt-code" dir="ltr">
                      {active ? <Glyph name="check" size={16} /> : entry.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
