"use client";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import MagneticButton from "../primitives/MagneticButton";
import "./access.css";

type FormState = "idle" | "sending" | "sent" | "invalid" | "rate" | "closed" | "error";

const ERROR_KEY: Partial<Record<FormState, string>> = {
  invalid: "accessErrorInvalid",
  rate: "accessErrorRate",
  closed: "accessErrorClosed",
  error: "accessErrorGeneric",
};

function stateForStatus(status: number): FormState {
  if (status === 400) return "invalid";
  if (status === 429) return "rate";
  if (status === 503) return "closed";
  return "error";
}

/**
 * "Ask for access": a visitor leaves a name, an email and an optional reason, which lands in
 * the operator's dashboard (POST /api/access-request). The `website` field is a honeypot,
 * kept off-screen and out of the tab order; people never fill it, so the server drops any
 * request that carries it.
 */
export default function AccessRequest() {
  const t = useTranslations("landing");
  const [state, setState] = useState<FormState>("idle");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => String(data.get(name) ?? "").trim();
    setState("sending");
    try {
      const res = await fetch("/api/access-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: field("name"),
          email: field("email"),
          reason: field("reason") || undefined,
          website: field("website") || undefined,
        }),
      });
      setState(res.ok ? "sent" : stateForStatus(res.status));
    } catch {
      setState("error");
    }
  }

  const errorKey = ERROR_KEY[state];

  return (
    <section id="access" className="ar-section" aria-labelledby="access-title">
      <div className="ar-inner">
        <div className="ar-head">
          <h2 id="access-title" className="station-title serif-display">
            {t("accessTitle")}
          </h2>
          <p className="station-lead">{t("accessLead")}</p>
        </div>

        {state === "sent" ? (
          <p className="ar-sent" role="status">
            {t("accessSent")}
          </p>
        ) : (
          <form className="ar-form" onSubmit={onSubmit}>
            <label className="ar-field">
              <span>{t("accessName")}</span>
              <input name="name" type="text" required maxLength={80} autoComplete="name" />
            </label>
            <label className="ar-field">
              <span>{t("accessEmail")}</span>
              <input name="email" type="email" required maxLength={254} autoComplete="email" />
            </label>
            <label className="ar-field ar-field-wide">
              <span>{t("accessReason")}</span>
              <textarea name="reason" rows={3} maxLength={500} />
            </label>
            <label className="ar-trap" aria-hidden="true">
              <span>{t("accessHoneypot")}</span>
              <input name="website" type="text" tabIndex={-1} autoComplete="off" />
            </label>

            <div className="ar-actions">
              <MagneticButton variant="gold" type="submit" disabled={state === "sending"}>
                {state === "sending" ? t("accessSending") : t("accessSubmit")}
              </MagneticButton>
              <p className="ar-privacy">{t("accessPrivacy")}</p>
            </div>
            {errorKey ? (
              <p className="ar-error" role="alert">
                {t(errorKey)}
              </p>
            ) : null}
          </form>
        )}
      </div>
    </section>
  );
}
