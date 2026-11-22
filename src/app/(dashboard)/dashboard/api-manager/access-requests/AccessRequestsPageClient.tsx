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
type Decision = "approve" | "reject";

const DEFAULT_LIMITS: Limits = { daily: "1", weekly: "5" };
const LIMIT_INPUT_CLASS =
  "h-9 w-28 rounded-control border border-border bg-surface px-2 text-sm text-text-main";

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

function decisionBody(action: Decision, limits: Limits) {
  if (action === "reject") return { action };
  return {
    action,
    dailyUsageLimitUsd: positiveOrUndefined(limits.daily),
    weeklyUsageLimitUsd: positiveOrUndefined(limits.weekly),
  };
}

function useFormatDate() {
  const locale = useLocale();
  return (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
}

/** The request list, loaded once on mount and again on `reload()`. */
function useAccessRequests() {
  const [requests, setRequests] = useState<AccessRequest[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const reload = useCallback(async () => {
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

  return { requests, loadFailed, reload };
}

/** The key just issued, with the base URL, shown once with copy buttons. */
function IssuedKeyCard({ issued, onDone }: { issued: IssuedKey; onDone: () => void }) {
  const t = useTranslations("accessRequests");
  const { copied, copy } = useCopyToClipboard();
  const baseUrl = typeof window === "undefined" ? "/v1" : `${window.location.origin}/v1`;
  const rows = [
    { id: "url", label: t("baseUrl"), value: baseUrl },
    { id: "key", label: t("apiKey"), value: issued.key },
  ];

  return (
    <Card title={t("keyIssuedTitle", { name: issued.name })}>
      <p className="text-sm text-text-muted">{t("keyIssuedHint", { email: issued.email })}</p>
      <dl className="mt-4 grid gap-3 text-sm">
        {rows.map((row) => (
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
        <Button onClick={onDone}>{t("done")}</Button>
      </div>
    </Card>
  );
}

/** One pending request: who asked and why, the limits for its key, Approve and Reject. */
function PendingRequestItem({
  request,
  busy,
  onDecide,
}: {
  request: AccessRequest;
  busy: boolean;
  onDecide: (request: AccessRequest, action: Decision, limits: Limits) => void;
}) {
  const t = useTranslations("accessRequests");
  const formatDate = useFormatDate();
  const [limits, setLimits] = useState<Limits>(DEFAULT_LIMITS);

  return (
    <li className="flex flex-col gap-3 py-4">
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
        {(["daily", "weekly"] as const).map((field) => (
          <label key={field} className="flex flex-col gap-1 text-xs text-text-muted">
            {field === "daily" ? t("dailyLimit") : t("weeklyLimit")}
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={limits[field]}
              onChange={(e) => setLimits((all) => ({ ...all, [field]: e.target.value }))}
              className={LIMIT_INPUT_CLASS}
            />
          </label>
        ))}
        <Button
          icon="check"
          loading={busy}
          disabled={busy}
          onClick={() => onDecide(request, "approve", limits)}
        >
          {busy ? t("working") : t("approve")}
        </Button>
        <Button
          variant="outline"
          icon="close"
          disabled={busy}
          onClick={() => onDecide(request, "reject", limits)}
        >
          {t("reject")}
        </Button>
      </div>
    </li>
  );
}

/** Approved and rejected requests, kept for the record. */
function DecidedList({ requests }: { requests: AccessRequest[] }) {
  const t = useTranslations("accessRequests");
  const formatDate = useFormatDate();

  return (
    <Card title={t("decided")}>
      <ul className="divide-y divide-border">
        {requests.map((request) => (
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
  );
}

/**
 * Requests sent from the landing page's "Ask for access" form. Approving one issues an API key
 * with the daily and weekly limits typed next to it; the key is shown once, here, for the
 * operator to send on. Decided requests stay listed below for the record.
 */
export default function AccessRequestsPageClient() {
  const t = useTranslations("accessRequests");
  const { requests, loadFailed, reload } = useAccessRequests();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [issued, setIssued] = useState<IssuedKey | null>(null);

  async function decide(request: AccessRequest, action: Decision, limits: Limits) {
    setBusyId(request.id);
    setActionError(null);
    try {
      const res = await fetch(`/api/access-requests/${encodeURIComponent(request.id)}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(decisionBody(action, limits)),
      });
      if (res.status === 409) setActionError(t("alreadyDecided"));
      else if (!res.ok) setActionError(t("actionError"));
      else if (action === "approve") {
        const body = await res.json();
        setIssued({ name: request.name, email: request.email, key: body.key });
      }
    } catch {
      setActionError(t("actionError"));
    } finally {
      setBusyId(null);
      await reload();
    }
  }

  const pending = requests?.filter((r) => r.status === "pending") ?? [];
  const decided = requests?.filter((r) => r.status !== "pending") ?? [];
  const errors = [actionError, loadFailed ? t("loadError") : null].filter(Boolean);

  return (
    <div className="min-w-0 w-full space-y-6 pb-10">
      <header className="space-y-3">
        <Link href="/dashboard/api-manager" className="text-sm text-primary hover:underline">
          ← {t("backToKeys")}
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-text-main">{t("pageTitle")}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-text-muted">{t("pageDescription")}</p>
      </header>

      {issued ? <IssuedKeyCard issued={issued} onDone={() => setIssued(null)} /> : null}
      {errors.map((message) => (
        <p key={message} role="alert" className="text-sm text-red-500">
          {message}
        </p>
      ))}

      <Card title={t("pending")}>
        {requests && pending.length === 0 ? (
          <p className="text-sm text-text-muted">
            {requests.length === 0 ? t("empty") : t("emptyPending")}
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {pending.map((request) => (
            <PendingRequestItem
              key={request.id}
              request={request}
              busy={busyId === request.id}
              onDecide={(r, action, limits) => void decide(r, action, limits)}
            />
          ))}
        </ul>
      </Card>

      {decided.length > 0 ? <DecidedList requests={decided} /> : null}
    </div>
  );
}
