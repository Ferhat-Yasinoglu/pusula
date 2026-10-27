"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../landingTypes";
import { useInView, usePrefersReducedMotion } from "../landingMotion";

const COUNT_MS = 1600;

/**
 * Counts up to `value` the first time it scrolls into view. The server and
 * the first client render show the real figure, so the number is correct
 * without JavaScript and for reduced-motion visitors.
 */
function CountUp({ value, active }: { value: number; active: boolean }) {
  const [shown, setShown] = useState(value);
  const played = useRef(false);

  useEffect(() => {
    if (!active || played.current) return;
    played.current = true;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      const eased = 1 - (1 - progress) ** 4;
      setShown(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, value]);

  return <>{shown}</>;
}

/**
 * Four figures read from the codebase, set as a single ruled line rather than
 * four cards: the numbers are the point, the chrome around them is not.
 */
export default function StatsStrip({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const reduced = usePrefersReducedMotion();
  const [ref, inView] = useInView<HTMLElement>();
  const items = [
    { value: stats.providers, label: t("statProviders") },
    { value: stats.freeProviders, label: t("statFree") },
    { value: stats.strategies.length, label: t("statStrategies") },
    { value: stats.cliTools.length, label: t("statTools") },
  ];

  return (
    <section ref={ref} className="px-4 sm:px-6" aria-label={t("statsAria")}>
      <dl className="reveal mx-auto grid max-w-7xl grid-cols-2 border-y border-[var(--rule)] md:grid-cols-4">
        {items.map((item, i) => (
          <div
            key={item.label}
            className={`py-7 pe-4 ${i % 2 === 1 ? "ps-6 md:ps-8" : "ps-0"} ${
              i > 1 ? "border-t border-[var(--rule)] md:border-t-0" : ""
            } ${i % 2 === 1 ? "border-s border-[var(--rule)]" : ""} ${
              i === 2 ? "md:border-s md:ps-8" : ""
            }`}
          >
            <dd className="readout text-4xl font-semibold text-[var(--gold-bright)] [text-shadow:0_0_24px_rgba(255,211,110,0.35)] sm:text-5xl">
              <CountUp value={item.value} active={inView && !reduced} />
            </dd>
            <dt className="mt-2 text-sm text-[var(--mist)]">{item.label}</dt>
          </div>
        ))}
      </dl>
    </section>
  );
}
