/**
 * Where a request to `/` goes. Kept free of Next.js imports so the decision is
 * unit-testable without mocking `cookies()` or the settings store.
 *
 * - A Zed native-app sign-in lands on the root with `user_id` + `access_token`
 *   and must be forwarded to the `/callback` relay with its query intact.
 * - An instance that does not require login is a personal/local gateway: its
 *   owner opens the dashboard directly, the public page would only be in the way.
 * - A signed-in operator goes straight to the dashboard.
 * - Everyone else sees the public landing page.
 */
export type RootDestinationInput = {
  /** `user_id` and `access_token` both present on the root URL. */
  hasZedCallback: boolean;
  /** The `auth_token` cookie verified as a dashboard session. */
  authenticated: boolean;
  /** `settings.requireLogin !== false` (defaults to true). */
  requireLogin: boolean;
  /** Query string (without `?`) to carry to the callback relay. */
  query?: string;
};

export const LANDING_PATH = "/landing";
export const DASHBOARD_PATH = "/dashboard";
export const CALLBACK_PATH = "/callback";

export function resolveRootDestination(input: RootDestinationInput): string {
  if (input.hasZedCallback) {
    return input.query ? `${CALLBACK_PATH}?${input.query}` : CALLBACK_PATH;
  }
  if (!input.requireLogin) return DASHBOARD_PATH;
  if (input.authenticated) return DASHBOARD_PATH;
  return LANDING_PATH;
}
