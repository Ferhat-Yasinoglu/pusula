/**
 * links.ts — pure config for the two OPTIONAL Radar "get a supporter key"
 * outbound links (F4/T7): the contributor-claim flow and the supporter-plans
 * page. Both live on the operator's own self-hosted Radar feed server.
 *
 * Radar is self-hosted only, so NEITHER link has a default: when the operator
 * leaves `RADAR_CONTRIBUTOR_CLAIM_URL` / `RADAR_SUPPORTER_PLANS_URL` unset the
 * accessors return `null`, `GET /api/radar/settings` relays `null`, and the
 * dashboard hides the corresponding button. Same env-only shape as the
 * `RADAR_FEED_URL` setting used by `./sync.ts` (see docs/frameworks/RADAR.md).
 *
 * DELIBERATELY DB-FREE and side-effect-free. These functions are read
 * server-side only (inside a route handler) and the resolved URLs are relayed
 * to the client via GET /api/radar/settings — the dashboard page never reads
 * `process.env` itself, matching the pattern the D28 referral links use.
 *
 * No price or monetary value is ever resolved, stored, or exposed here — the
 * URLs point at pages the operator controls; this repo never states pricing
 * (spec D14).
 */

import { parseRadarAdminUrl } from "@/shared/validation/radarAdminUrl";

/**
 * Accept only an absolute `http(s)` URL; anything else (unset, blank,
 * relative, `javascript:` …) resolves to `null` so it is never rendered as an
 * `href`.
 */
function optionalHttpUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  } catch {
    return null;
  }
  return trimmed;
}

/**
 * URL of the "I'm a contributor" claim flow on the operator's feed server,
 * from `RADAR_CONTRIBUTOR_CLAIM_URL`. `null` (button hidden) when unset.
 */
export function getContributorClaimUrl(): string | null {
  return optionalHttpUrl(process.env.RADAR_CONTRIBUTOR_CLAIM_URL);
}

/**
 * URL of the "Support the project" plans page on the operator's feed server,
 * from `RADAR_SUPPORTER_PLANS_URL`. `null` (button hidden) when unset.
 */
export function getSupporterPlansUrl(): string | null {
  return optionalHttpUrl(process.env.RADAR_SUPPORTER_PLANS_URL);
}

/**
 * Private operations-panel URL configured by the instance owner.
 * Like the two links above, this deliberately has no default.
 */
export function getRadarAdminUrl(): string | null {
  return parseRadarAdminUrl(process.env.RADAR_ADMIN_URL);
}
