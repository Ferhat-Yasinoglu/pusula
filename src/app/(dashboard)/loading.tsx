"use client";

import { PageLoading } from "@/shared/components/Loading";

/**
 * The app's loading screen, scoped to the dashboard group.
 *
 * It used to live at `src/app/loading.tsx`, where its Suspense boundary
 * wrapped every route, the public landing page included. React's streaming
 * renderer outlines any completed boundary larger than ~12.8 KB: it sends this
 * fallback first and the real page in a hidden `<div>` that an inline script
 * swaps in. So `/landing` (and `/login`, `/docs`, …) flashed this light
 * spinner on every load and showed nothing else with JavaScript disabled.
 * Routes outside this group now render inline in the first flush.
 */
export default function AppLoading() {
  return <PageLoading message="Loading Pusula..." />;
}
