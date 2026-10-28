"use client";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { CatalogEntry, CatalogKind, LandingStats } from "../landingTypes";
import SectionHeading from "./SectionHeading";

const KIND_ORDER: readonly CatalogKind[] = [
  "llm",
  "webSearch",
  "imageToText",
  "webFetch",
  "embedding",
  "video",
  "other",
];

const KIND_LABEL_KEY: Record<CatalogKind, string> = {
  llm: "catalogKindLlm",
  webSearch: "catalogKindSearch",
  imageToText: "catalogKindImageToText",
  webFetch: "catalogKindWebFetch",
  embedding: "catalogKindEmbedding",
  video: "catalogKindVideo",
  other: "catalogKindOther",
};

/** Chat providers shown before "Show all": enough to read as a wall, not a list. */
const COLLAPSED_CHAT_COUNT = 72;

function Name({ entry }: { entry: CatalogEntry }) {
  return (
    <li className="flex items-baseline gap-1.5 whitespace-nowrap text-sm leading-7 text-[var(--mist)]">
      {entry.free ? (
        <span
          className="inline-block size-1.5 shrink-0 rounded-full bg-[var(--gold-bright)]"
          aria-hidden="true"
        />
      ) : (
        <span className="inline-block size-1.5 shrink-0" aria-hidden="true" />
      )}
      <span>{entry.name}</span>
    </li>
  );
}

export default function Catalog({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing");
  const [expanded, setExpanded] = useState(false);

  const groups = useMemo(() => {
    const byKind = new Map<CatalogKind, CatalogEntry[]>();
    for (const entry of stats.catalog) {
      const list = byKind.get(entry.kind) ?? [];
      list.push(entry);
      byKind.set(entry.kind, list);
    }
    return KIND_ORDER.filter((kind) => byKind.has(kind)).map((kind) => ({
      kind,
      entries: byKind.get(kind) ?? [],
    }));
  }, [stats.catalog]);

  return (
    <section id="catalog" className="scroll-mt-20 px-4 py-20 sm:px-6 lg:py-28">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          title={t("catalogTitle", { count: stats.providers })}
          lead={t("catalogLead", {
            kinds: Object.values(stats.kindCounts).filter((n) => n > 0).length,
            free: stats.freeProviders,
            local: stats.localProviders,
          })}
          aside={
            <p className="flex items-center gap-2 text-xs text-[var(--mist)]">
              <span
                className="inline-block size-1.5 rounded-full bg-[var(--gold-bright)]"
                aria-hidden="true"
              />
              {t("catalogFreeMark")}
            </p>
          }
        />

        <div className="reveal space-y-10">
          {groups.map(({ kind, entries }) => {
            const collapsed = kind === "llm" && !expanded;
            const visible = collapsed ? entries.slice(0, COLLAPSED_CHAT_COUNT) : entries;
            const hidden = entries.length - visible.length;
            return (
              <div key={kind} className="grid gap-4 md:grid-cols-12">
                <h3 className="readout text-sm text-[var(--foam)] md:col-span-3 lg:col-span-2">
                  {t(KIND_LABEL_KEY[kind])}
                  <span className="ms-2 text-[var(--mist-dim)]">{entries.length}</span>
                </h3>
                <div className="md:col-span-9 lg:col-span-10">
                  <ul className="columns-2 gap-x-6 sm:columns-3 lg:columns-5">
                    {visible.map((entry) => (
                      <Name key={entry.id} entry={entry} />
                    ))}
                  </ul>
                  {kind === "llm" && entries.length > COLLAPSED_CHAT_COUNT && (
                    <button
                      type="button"
                      onClick={() => setExpanded((value) => !value)}
                      aria-expanded={expanded}
                      className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-[var(--rule)] px-3 text-sm text-[var(--foam)] transition-colors hover:border-[var(--gold)]"
                    >
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">
                        {expanded ? "unfold_less" : "unfold_more"}
                      </span>
                      {expanded ? t("catalogShowLess") : t("catalogShowAll", { count: hidden })}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
