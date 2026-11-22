"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/** Card on the API key page that leads to the access requests and counts the pending ones. */
export default function AccessRequestsEntryLink() {
  const t = useTranslations("accessRequests");
  const [pending, setPending] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/access-requests")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body) setPending(Number(body.pendingCount) || 0);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="font-medium text-text-main">
          {t("entryTitle")}
          {pending !== null ? (
            <span
              className={
                pending > 0
                  ? "ms-2 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary"
                  : "ms-2 text-xs font-normal text-text-muted"
              }
            >
              {t("entryPending", { count: pending })}
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-sm text-text-muted">{t("entryHint")}</p>
      </div>
      <Link
        href="/dashboard/api-manager/access-requests"
        className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          how_to_reg
        </span>
        {t("review")}
      </Link>
    </div>
  );
}
