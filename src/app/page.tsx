import { redirect } from "next/navigation";
import { isAuthRequired, isDashboardSessionAuthenticated } from "@/shared/utils/apiAuth";
import { resolveRootDestination } from "@/shared/utils/rootDestination";

export const dynamic = "force-dynamic";

/**
 * Root entry. In practice the authz pipeline (`src/proxy.ts` →
 * `runAuthzPipeline`) answers `/` before this page renders, with the same
 * `resolveRootDestination` decision; this page is the fallback for any
 * runtime where the proxy does not run. Three audiences arrive here:
 *
 * 1. Zed's native-app sign-in always redirects the browser to the loopback
 *    ROOT (`http://127.0.0.1:<dashboard-port>/?user_id=...&access_token=...`),
 *    ignoring any path — when the dashboard port is reused as native_app_port
 *    (see zed-hosted.ts), that redirect lands HERE. Forward the payload to the
 *    /callback relay (which postMessages it to the waiting OAuth modal).
 * 2. The operator (signed in, or running an instance that needs no login) goes
 *    straight to the dashboard.
 * 3. Anyone else — a visitor to a public instance — sees the landing page.
 */
export default async function InitPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) || {};
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      query.set(key, value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") query.append(key, item);
      }
    }
  }

  const hasZedCallback = Boolean(query.get("user_id") && query.get("access_token"));

  redirect(
    resolveRootDestination({
      hasZedCallback,
      query: query.toString(),
      requireLogin: await readRequireLogin(),
      authenticated: hasZedCallback ? false : await readSessionAuthenticated(),
    })
  );
}

async function readRequireLogin(): Promise<boolean> {
  try {
    return await isAuthRequired();
  } catch {
    // A settings read that fails must never open the dashboard by accident.
    return true;
  }
}

async function readSessionAuthenticated(): Promise<boolean> {
  try {
    return await isDashboardSessionAuthenticated();
  } catch {
    return false;
  }
}
