"use client";
import { useTranslations } from "next-intl";
import { BREAKER_PROFILES } from "../landingTypes";
import SectionHeading from "./SectionHeading";

/**
 * Three nested scopes — model inside connection inside provider — drawn as
 * three rings, because that containment is the whole idea: a bad key cools
 * one connection, a rate-limited model locks one model, and only repeated
 * upstream failures open the provider breaker.
 */
export default function Resilience() {
  const t = useTranslations("landing");

  const layers = [
    { key: "provider", r: 124, label: t("resilienceProvider"), desc: t("resilienceProviderDesc") },
    {
      key: "connection",
      r: 84,
      label: t("resilienceConnection"),
      desc: t("resilienceConnectionDesc"),
    },
    { key: "model", r: 44, label: t("resilienceModel"), desc: t("resilienceModelDesc") },
  ];

  const profileLabel: Record<(typeof BREAKER_PROFILES)[number]["id"], string> = {
    oauth: t("resilienceProfileOauth"),
    apikey: t("resilienceProfileApiKey"),
    local: t("resilienceProfileLocal"),
  };

  return (
    <section
      id="resilience"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("resilienceTitle")} lead={t("resilienceLead")} />

        <div className="grid items-center gap-12 lg:grid-cols-12">
          <figure className="lg:col-span-5">
            <svg
              viewBox="0 0 280 280"
              className="mx-auto w-full max-w-[320px]"
              role="img"
              aria-label={t("resilienceDiagramAria")}
            >
              {layers.map((layer, i) => (
                <g key={layer.key}>
                  <circle
                    cx="140"
                    cy="140"
                    r={layer.r}
                    fill={
                      i === 2 ? "var(--chart-raised)" : i === 1 ? "var(--chart)" : "transparent"
                    }
                    stroke={i === 2 ? "var(--amber)" : "var(--teal-bright)"}
                    strokeOpacity={i === 2 ? 1 : 0.6 + i * 0.2}
                    strokeWidth={i === 2 ? 1.5 : 1}
                    strokeDasharray={i === 0 ? "3 5" : undefined}
                  />
                  <text
                    x="140"
                    y={140 - layer.r + (i === 2 ? layer.r : 16)}
                    textAnchor="middle"
                    dominantBaseline={i === 2 ? "central" : "auto"}
                    fill={i === 2 ? "var(--foam)" : "var(--mist)"}
                    fontSize="12"
                    fontFamily="var(--font-mono)"
                  >
                    {layer.label}
                  </text>
                </g>
              ))}
            </svg>
            <figcaption
              className="readout mt-2 text-center text-xs text-[var(--mist-dim)]"
              dir="ltr"
            >
              model ⊂ connection ⊂ provider
            </figcaption>
          </figure>

          <div className="lg:col-span-7">
            <dl className="divide-y divide-[var(--rule-soft)] border-y border-[var(--rule-soft)]">
              {[...layers].reverse().map((layer) => (
                <div key={layer.key} className="grid gap-2 py-5 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="text-base font-semibold text-[var(--foam)]">{layer.label}</dt>
                  <dd className="text-sm leading-6 text-[var(--mist)]">{layer.desc}</dd>
                </div>
              ))}
            </dl>

            <h3 className="mt-10 text-sm font-semibold text-[var(--foam)]">
              {t("resilienceDefaultsTitle")}
            </h3>
            <table className="mt-3 w-full text-sm">
              <thead>
                <tr className="text-start text-xs text-[var(--mist-dim)]">
                  <th scope="col" className="py-2 pe-4 text-start font-normal">
                    {t("resilienceColProfile")}
                  </th>
                  <th scope="col" className="py-2 pe-4 text-start font-normal">
                    {t("resilienceColOpens")}
                  </th>
                  <th scope="col" className="py-2 text-start font-normal">
                    {t("resilienceColProbe")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--rule-soft)] border-t border-[var(--rule-soft)]">
                {BREAKER_PROFILES.map((profile) => (
                  <tr key={profile.id}>
                    <td className="py-2.5 pe-4 text-[var(--foam)]">{profileLabel[profile.id]}</td>
                    <td className="readout py-2.5 pe-4 text-[var(--mist)]">
                      {t("resilienceOpensAfter", { count: profile.opensAfter })}
                    </td>
                    <td className="readout py-2.5 text-[var(--mist)]">
                      {t("resilienceProbeAfter", { seconds: profile.resetSeconds })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-[var(--mist-dim)]">{t("resilienceDefaultsNote")}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
