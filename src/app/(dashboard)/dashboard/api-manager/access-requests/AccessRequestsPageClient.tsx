"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Button, Card } from "@/shared/components";
import { useCopyToClipboard } from "@/shared/hooks/useCopyToClipboard";

interface AccessRequest {
  id: string;
  name: string;
  email: string;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt: string | null;
}

interface IssuedKey {
  name: string;
  email: string;
  key: string;
}

type Limits = { daily: string; weekly: string };

const DEFAULT_LIMITS: Limits = { daily: "1", weekly: "5" };

async function fetchRequests(): Promise<AccessRequest[]> {
  const res = await fetch("/api/access-requests");
  if (!res.ok) throw new Error(String(res.status));
  const body = await res.json();
  return body.requests;
}

function positiveOrUndefined(value: string): number | undefined {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/**
 * Requests sent from the landing page's "Ask for access" form. Approving one issues an API key
 * with the daily and weekly limits typed next to it; the key is shown once, here, for the
 * operator to send on. Decided requests stay listed below for the record.
 */
export default function AccessRequestsPageClient() {
  const t = useTranslations("accessRequests");
  const locale = useLocale();
  const { copied, copy } = useCopyToClipboard();
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [limits, setLimits] = useState<Record<string, Limits>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);

  const load = useCallback(async () => {
    try {
      setRequests(await fetchRequests());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchRequests()
      .then((list) => {
        if (!cancelled) setRequests(list);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function decide(request: AccessRequest, action: "approve" | "reject") {
    const own = limits[request.id] ?? DEFAULT_LIMITS;
    setBusyId(request.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/access-requests/${encodeURIComponent(request.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          action === "approve"
            ? {
                action,
                dailyUsageLimitUsd: positiveOrUndefined(own.daily),
                weeklyUsageLimitUsd: positiveOrUndefined(own.weekly),
              }
            : { action }
        ),
      });
      if (res.status === 409) {
        setActionError(t("alreadyDecided"));
      } else if (!res.ok) {
        setActionError(t("actionError"));
      } else if (action === "approve") {
        const body = await res.json();
        setIssued({ name: request.name, email: request.email, key: body.key });
      }
    } catch {
      setActionError(t("actionError"));
    } finally {
      setBusyId(null);
      await load();
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const baseUrl = typeof window === "undefined" ? "/v1" : `${window.location.origin}/v1`;
  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const decided = requests?.filter((r) => r.status !== "pending") ?? [];

  return (
    <div className="min-w-0 w-full space-y-6 pb-10">
      <header className="space-y-3">
        <Link href="/dashboard/api-manager" className="text-sm text-primary hover:underline">
          ← {t("backToKeys")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-text-main">{t("pageTitle")}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-text-muted">{t("pageDescription")}</p>
      </header>

      {issued ? (
        <Card title={t("keyIssuedTitle", { name: issued.name })}>
          <p className="text-sm text-text-muted">{t("keyIssuedHint", { email: issued.email })}</p>
          <dl className="mt-4 grid gap-3 text-sm">
            {[
              { id: "url", label: t("baseUrl"), value: baseUrl },
              { id: "key", label: t("apiKey"), value: issued.key },
            ].map((row) => (
              <div key={row.id} className="flex flex-wrap items-center gap-2">
                <dt className="w-28 shrink-0 text-text-muted">{row.label}</dt>
                <dd className="min-w-0 flex-1 break-all rounded-control border border-border bg-surface px-3 py-1.5 font-mono">
                  {row.value}
                </dd>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={copied === row.id ? "check" : "content_copy"}
                  onClick={() => void copy(row.value, row.id)}
                >
                  {copied === row.id ? t("copied") : t("copy")}
                </Button>
              </div>
            ))}
          </dl>
          <div className="mt-4">
            <Button onClick={() => setIssued(null)}>{t("done")}</Button>
          </div>
        </Card>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-sm text-red-500">
          {actionError}
        </p>
      ) : null}
      {loadFailed ? (
        <p role="alert" className="text-sm text-red-500">
          {t("loadError")}
        </p>
      ) : null}

      <Card title={t("pending")}>
        {requests && pending.length === 0 ? (
          <p className="text-sm text-text-muted">
            {requests.length === 0 ? t("empty") : t("emptyPending")}
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {pending.map((request) => {
            const own = limits[request.id] ?? DEFAULT_LIMITS;
            const setOwn = (patch: Partial<Limits>) =>
              setLimits((all) => ({ ...all, [request.id]: { ...own, ...patch } }));
            const busy = busyId === request.id;
            return (
              <li key={request.id} className="flex flex-col gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium text-text-main">
                    {request.name} <span className="text-text-muted">&lt;{request.email}&gt;</span>
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text-secondary">
                    {request.reason || t("noReason")}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {t("received")}: {formatDate(request.createdAt)}
                  </p>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-text-muted">
                    {t("dailyLimit")}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={own.daily}
                      onChange={(e) => setOwn({ daily: e.target.value })}
                      className="h-9 w-28 rounded-control border border-border bg-surface px-2 text-sm text-text-main"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-text-muted">
                    {t("weeklyLimit")}
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={own.weekly}
                      onChange={(e) => setOwn({ weekly: e.target.value })}
                      className="h-9 w-28 rounded-control border border-border bg-surface px-2 text-sm text-text-main"
                    />
                  </label>
                  <Button
                    icon="check"
                    loading={busy}
                    disabled={busy}
                    onClick={() => void decide(request, "approve")}
                  >
                    {busy ? t("working") : t("approve")}
                  </Button>
                  <Button
                    variant="outline"
                    icon="close"
                    disabled={busy}
                    onClick={() => void decide(request, "reject")}
                  >
                    {t("reject")}
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {decided.length > 0 ? (
        <Card title={t("decided")}>
          <ul className="divide-y divide-border">
            {decided.map((request) => (
              <li key={request.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <span className="font-medium text-text-main">{request.name}</span>
                <span className="text-sm text-text-muted">{request.email}</span>
                <span
                  className={
                    request.status === "approved"
                      ? "text-sm font-medium text-green-600 dark:text-green-400"
                      : "text-sm font-medium text-text-muted"
                  }
                >
                  {request.status === "approved" ? t("statusApproved") : t("statusRejected")}
                </span>
                {request.decidedAt ? (
                  <span className="text-xs text-text-muted">{formatDate(request.decidedAt)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
