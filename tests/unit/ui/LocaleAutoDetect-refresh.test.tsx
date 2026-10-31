// @vitest-environment jsdom
import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression guard (release v3.8.44 e2e finding): LocaleAutoDetect called
// router.refresh() on EVERY first visit — even when the detected browser
// locale was exactly the one the server had just rendered — re-navigating the
// page mid-interaction (Playwright: "Execution context was destroyed") and
// flashing for every new visitor. It must refresh ONLY when the detected
// locale differs from <html lang>.

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

// config/i18n.json declares no `aliases` today, so the real LOCALE_ALIASES is empty and
// could not tell a wired alias map from a forgotten one. Inject one synthetic alias on a
// real locale (Dari `prs` → Persian `fa`): no configured locale code starts with `prs`,
// so it resolves ONLY through the alias map the component must hand to detectBrowserLocale.
vi.mock("@/i18n/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/i18n/config")>();
  return { ...actual, LOCALE_ALIASES: Object.freeze({ fa: Object.freeze(["prs"]) }) };
});

describe("LocaleAutoDetect refresh gating", () => {
  const cleanups: Array<() => void> = [];

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    refresh.mockReset();
    // Fresh visit: no locale cookie.
    document.cookie = "NEXT_LOCALE=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    localStorage.removeItem("NEXT_LOCALE");
    document.documentElement.dir = "ltr";
    Object.defineProperty(navigator, "languages", { value: ["en-US"], configurable: true });
  });

  afterEach(() => {
    while (cleanups.length) cleanups.pop()?.();
  });

  async function mount() {
    const { LocaleAutoDetect } = await import("@/shared/components/LocaleAutoDetect");
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(React.createElement(LocaleAutoDetect));
    });
    cleanups.push(() => {
      act(() => root.unmount());
      container.remove();
    });
  }

  it("does NOT refresh when the detected locale equals the server-rendered <html lang>", async () => {
    document.documentElement.lang = "en";
    await mount();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes when the detected locale differs from the server-rendered <html lang>", async () => {
    document.documentElement.lang = "de";
    await mount();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("persists the detected locale before refreshing server content on a first visit", async () => {
    document.documentElement.lang = "en";
    // Persian is Pusula's right-to-left locale (the four configured locales are en/tr/de/fa).
    Object.defineProperty(navigator, "languages", { value: ["fa"], configurable: true });
    refresh.mockImplementation(() => {
      expect(document.cookie).toContain("NEXT_LOCALE=fa");
      expect(localStorage.getItem("NEXT_LOCALE")).toBe("fa");
      expect(document.documentElement.lang).toBe("fa");
      expect(document.documentElement.dir).toBe("rtl");
    });

    await mount();

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // Alias wiring guard: the component must hand `LOCALE_ALIASES` to
  // `detectBrowserLocale`. `prs` (Dari) is the discriminating input — no locale code
  // starts with `prs`, so it resolves to `fa` ONLY through the (injected) alias; a
  // forgotten third argument yields null and no cookie is written.
  it("persists the aliased locale for a Dari browser (prs → fa)", async () => {
    document.documentElement.lang = "en";
    Object.defineProperty(navigator, "languages", { value: ["prs"], configurable: true });
    await mount();
    expect(document.cookie).toContain("NEXT_LOCALE=fa");
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // A region-tagged browser language must reach its base-language catalog through RFC 4647
  // truncation (`tr-TR` → `tr`), not fall through to null.
  it("persists tr for a tr-TR browser through base-language truncation", async () => {
    document.documentElement.lang = "en";
    Object.defineProperty(navigator, "languages", { value: ["tr-TR"], configurable: true });
    await mount();
    expect(document.cookie).toContain("NEXT_LOCALE=tr");
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
