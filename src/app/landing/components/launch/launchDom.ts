"use client";
/**
 * DOM helpers shared by the launch station's two parts (`DashboardMonitor` and
 * the launch deck in `MonitorLaunch`): a media-query hook and the `useId()`
 * cleaner both use for their element ids.
 */
import { useEffect, useState } from "react";

/** Whether `query` matches (false on the server and on the first client render). */
export function useMediaMatch(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener("change", sync);
    return () => list.removeEventListener("change", sync);
  }, [query]);
  return matches;
}

/** `useId()` output reduced to characters safe in an element id and a `url(#…)` reference. */
export function cleanId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, "");
}
