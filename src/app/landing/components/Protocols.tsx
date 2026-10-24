"use client";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { LandingStats } from "../landingTypes";
import SectionHeading from "./SectionHeading";

/**
 * Agent protocols: the gateway is also a tool server (MCP) and an agent on
 * the network (A2A). Two columns, each with the one figure that matters and
 * the endpoint a reader would type.
 */
export default function Protocols({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");

  return (
    <section
      id="protocols"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading title={t("protocolsTitle")} lead={t("protocolsLead")} />

        <div className="grid gap-10 md:grid-cols-2 md:gap-14">
          <div className="border-t border-[var(--rule)] pt-6">
            <h3 className="text-xl font-semibold text-[var(--foam)]">{t("protocolsMcpTitle")}</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--mist)]">
              {t("protocolsMcpDesc", {
                tools: stats.mcpTools,
                scopes: stats.mcpScopes,
                transports: stats.mcpTransports,
              })}
            </p>
            <dl className="readout mt-5 grid grid-cols-3 gap-4 text-sm">
              <div>
                <dd className="text-2xl text-[var(--foam)]">{stats.mcpTools}</dd>
                <dt className="font-sans text-xs text-[var(--mist-dim)]">
                  {t("protocolsMcpTools")}
                </dt>
              </div>
              <div>
                <dd className="text-2xl text-[var(--foam)]">{stats.mcpScopes}</dd>
                <dt className="font-sans text-xs text-[var(--mist-dim)]">
                  {t("protocolsMcpScopes")}
                </dt>
              </div>
              <div>
                <dd className="text-2xl text-[var(--foam)]">{stats.mcpTransports}</dd>
                <dt className="font-sans text-xs text-[var(--mist-dim)]">
                  {t("protocolsMcpTransports")}
                </dt>
              </div>
            </dl>
            <code className="readout mt-5 block text-xs text-[var(--teal-bright)]" dir="ltr">
              POST /api/mcp/stream
            </code>
          </div>

          <div className="border-t border-[var(--rule)] pt-6">
            <h3 className="text-xl font-semibold text-[var(--foam)]">{t("protocolsA2aTitle")}</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--mist)]">{t("protocolsA2aDesc")}</p>
            <ul className="mt-5 space-y-1.5 text-sm text-[var(--mist)]">
              {[
                "smart-routing",
                "quota-management",
                "provider-discovery",
                "cost-analysis",
                "health-report",
              ].map((skill) => (
                <li key={skill} className="flex items-center gap-2">
                  <span
                    className="size-1 rounded-full bg-[var(--teal-bright)]"
                    aria-hidden="true"
                  />
                  <code className="readout text-xs" dir="ltr">
                    {skill}
                  </code>
                </li>
              ))}
            </ul>
            <code className="readout mt-5 block text-xs text-[var(--teal-bright)]" dir="ltr">
              POST /a2a
            </code>
          </div>
        </div>

        <p className="mt-10 text-sm text-[var(--mist)]">
          <Link
            href="/docs"
            className="text-[var(--teal-bright)] underline-offset-4 hover:underline"
          >
            {t("protocolsDocsLink")}
          </Link>
        </p>
      </div>
    </section>
  );
}
