/**
 * Pure helpers for the visitor page, kept out of the components so they can be
 * unit-tested without a Next/next-intl render.
 */

/** Locales the visitor page ships copy for (mirrors `config/i18n.json`). */
export const VISITOR_LOCALES = ["en", "tr", "de", "fa"] as const;

/** The three setup steps, in order; each maps to `stepNTitle` / `stepNDesc`. */
export const VISITOR_STEPS = [1, 2, 3] as const;

/**
 * A number in the visitor's own digits: `Intl.NumberFormat` writes Persian
 * digits for `fa` (358 → ۳۵۸) and Latin digits for the other locales.
 */
export function formatCount(value: number, locale: string): string {
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

/** A step's two-digit marker in the visitor's digits: 1 → "01" (fa: "۰۱"). */
export function stepLabel(step: number, locale: string): string {
  return formatCount(step, locale).padStart(2, formatCount(0, locale));
}

export type VisitorStat = { value: string; labelKey: string };

/**
 * The four figures under the hero. The provider count comes from the gateway's
 * own catalog (`getLandingStats`), never a hard-coded number.
 */
export function visitorStats(providers: number, locale: string): VisitorStat[] {
  return [
    { value: formatCount(providers, locale), labelKey: "statProviders" },
    { value: formatCount(1, locale), labelKey: "statEndpoint" },
    { value: "MIT", labelKey: "statLicense" },
    { value: formatCount(VISITOR_STEPS.length, locale), labelKey: "statSteps" },
  ];
}
