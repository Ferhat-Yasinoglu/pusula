/**
 * feedUrl.ts — resolves the operator-configured Radar feed base URL.
 *
 * Radar is SELF-HOSTED ONLY: this project ships no feed service and bakes in
 * no default upstream host. The feature only becomes network-active once the
 * operator runs their own feed server and points `RADAR_FEED_URL` at it.
 *
 * Every Radar sync entry point (catalog, referrals, offers, Intel) calls
 * `getRadarFeedBaseUrl()` AFTER its flag/opt-in gates and, when the URL is not
 * configured, returns `{ status: "not_configured" }` via
 * `radarFeedNotConfigured()` — one operator-facing log line, no throw, and
 * never a `fetch()` against an empty or relative URL.
 *
 * Pure and side-effect-free apart from that single `console.warn`.
 */

/** Env var that points the client at the operator's self-hosted feed server. */
export const RADAR_FEED_URL_ENV = "RADAR_FEED_URL";

/** Operator-facing reason relayed inside the `not_configured` sync status. */
export const RADAR_FEED_URL_NOT_CONFIGURED_REASON =
  "Radar feed URL not configured; set RADAR_FEED_URL to the absolute http(s) URL of your self-hosted feed server";

/** Sync status shared by all four feed syncs when `RADAR_FEED_URL` is unset. */
export interface RadarFeedNotConfiguredStatus {
  status: "not_configured";
  reason: string;
}

/**
 * The feed base URL with trailing slashes stripped, or `null` when
 * `RADAR_FEED_URL` is unset, empty, whitespace-only, relative, or not an
 * absolute `http(s)` URL. Deliberately has NO default — an unusable value is
 * treated exactly like an unset one so callers never hand `fetch()` a
 * relative or garbage URL.
 */
export function getRadarFeedBaseUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const raw = env[RADAR_FEED_URL_ENV]?.trim() ?? "";
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;

  const stripped = raw.replace(/\/+$/, "");
  return stripped || null;
}

/**
 * Emit the single, clear log line for a skipped sync and build the matching
 * status object. `feedName` names the entry point (`catalog`, `referrals`,
 * `offers`, `intel`) so the line stays unambiguous when several feeds skip
 * within one scheduler tick.
 */
export function radarFeedNotConfigured(feedName: string): RadarFeedNotConfiguredStatus {
  console.warn(`[RADAR_SYNC] Radar feed URL not configured; skipping ${feedName} sync`);
  return { status: "not_configured", reason: RADAR_FEED_URL_NOT_CONFIGURED_REASON };
}
