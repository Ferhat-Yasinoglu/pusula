"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { copyToClipboard } from "@/shared/utils/clipboard";
import { useDisplayBaseUrl } from "@/shared/hooks";
import type { LandingStats } from "../landingTypes";
import SectionHeading from "./SectionHeading";

type Lang = "curl" | "javascript" | "python";

function snippet(lang: Lang, baseUrl: string): string {
  const url = `${baseUrl}/v1`;
  switch (lang) {
    case "curl":
      return [
        `curl ${url}/chat/completions \\`,
        `  -H "Authorization: Bearer $PUSULA_API_KEY" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -d '{"model":"auto","messages":[{"role":"user","content":"Hello"}]}'`,
      ].join("\n");
    case "javascript":
      return [
        `import OpenAI from "openai";`,
        ``,
        `const client = new OpenAI({`,
        `  baseURL: "${url}",`,
        `  apiKey: process.env.PUSULA_API_KEY,`,
        `});`,
        ``,
        `const reply = await client.chat.completions.create({`,
        `  model: "auto",`,
        `  messages: [{ role: "user", content: "Hello" }],`,
        `});`,
      ].join("\n");
    case "python":
      return [
        `from openai import OpenAI`,
        ``,
        `client = OpenAI(base_url="${url}", api_key=os.environ["PUSULA_API_KEY"])`,
        ``,
        `reply = client.chat.completions.create(`,
        `    model="auto",`,
        `    messages=[{"role": "user", "content": "Hello"}],`,
        `)`,
      ].join("\n");
  }
}

const LANGS: readonly { id: Lang; label: string }[] = [
  { id: "curl", label: "cURL" },
  { id: "javascript", label: "JavaScript" },
  { id: "python", label: "Python" },
];

export default function Tools({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const baseUrl = useDisplayBaseUrl();
  const [lang, setLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);

  const code = snippet(lang, baseUrl);
  const copy = async () => {
    await copyToClipboard(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section
      id="tools"
      className="scroll-mt-20 border-t border-[var(--rule-soft)] px-4 py-20 sm:px-6 lg:py-28"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          title={t("toolsTitle")}
          lead={t("toolsLead", { count: stats.cliTools.length })}
        />

        <div className="grid gap-12 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-5">
            <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label={t("toolsListAria")}>
              {stats.cliTools.map((tool) => (
                <li key={tool.id} className="text-sm leading-7 text-[var(--mist)]">
                  {tool.name}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-[var(--mist-dim)]">{t("toolsNote")}</p>
          </div>

          <div className="lg:col-span-7">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs text-[var(--mist-dim)]">{t("toolsBaseUrl")}</span>
              <code className="readout text-xs text-[var(--teal-bright)]" dir="ltr">
                {baseUrl}/v1
              </code>
            </div>
            <div className="overflow-hidden rounded-lg border border-[var(--rule)] bg-[var(--ink-deep)]">
              <div className="flex items-center justify-between border-b border-[var(--rule-soft)] px-2">
                <div role="tablist" aria-label={t("toolsSnippetAria")} className="flex">
                  {LANGS.map((entry) => {
                    const active = entry.id === lang;
                    return (
                      <button
                        key={entry.id}
                        role="tab"
                        type="button"
                        aria-selected={active}
                        onClick={() => setLang(entry.id)}
                        className={`relative px-3 py-2.5 text-xs font-medium transition-colors ${
                          active
                            ? "text-[var(--foam)] after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-[var(--teal-bright)]"
                            : "text-[var(--mist)] hover:text-[var(--foam)]"
                        }`}
                      >
                        {entry.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={copy}
                  className="readout flex h-8 items-center gap-1 rounded px-2 text-xs text-[var(--mist)] transition-colors hover:bg-[var(--chart)] hover:text-[var(--foam)]"
                  aria-live="polite"
                >
                  <span className="material-symbols-outlined text-[16px]" aria-hidden="true">
                    {copied ? "check" : "content_copy"}
                  </span>
                  {copied ? t("copied") : t("copy")}
                </button>
              </div>
              <pre
                role="tabpanel"
                className="readout overflow-x-auto p-4 text-[13px] leading-6 text-[var(--foam)]"
                dir="ltr"
              >
                <code>{code}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
