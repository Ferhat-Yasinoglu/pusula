// @vitest-environment jsdom
/**
 * ProviderPageHeader — discreet "Referral link" disclosure on the top-of-page
 * website link when a Radar default referral (D28) replaced the catalog
 * `website`. Presentation only — the decision itself lives in
 * `resolveProviderHeaderLink` (tests/unit/provider-header-referral-link.test.ts).
 * No provider id earns the note on its own: a plain catalog website never
 * renders it, whatever the provider.
 */
import React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import ProviderPageHeader from "@/app/(dashboard)/dashboard/providers/[id]/components/ProviderPageHeader";

// No `.has` method — providerText() falls back to the hardcoded English default.
const t = (key: string) => key;
const REFERRAL_NOTE = "Referral link — supports Pusula at no extra cost to you";

describe("ProviderPageHeader — referral-link note", () => {
  let container: HTMLDivElement | null = null;
  const mounted: { root: Root; container: HTMLDivElement }[] = [];

  afterEach(async () => {
    for (const instance of mounted.splice(0)) {
      await act(async () => instance.root.unmount());
      instance.container.remove();
    }
    if (container) {
      container = null;
    }
  });

  function renderHeader(id: string, name: string, website: string, isReferralLink?: boolean) {
    container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    mounted.push({ root, container });
    act(() => {
      root.render(
        <ProviderPageHeader
          providerId={id}
          providerInfo={{ id, name, website, color: "#1783FF" }}
          connectionsCount={0}
          isOpenAICompatible={false}
          isAnthropicProtocolCompatible={false}
          onOpenTutorial={() => {}}
          t={t}
          isReferralLink={isReferralLink}
        />
      );
    });
    return container;
  }

  it("flags the header link as a referral link when isReferralLink is set", () => {
    const website = "https://groq.com/?ref=pusula";
    const el = renderHeader("groq", "Groq", website, true);
    // The component also renders a "Back to Providers" <Link> above the
    // website title link — target the website anchor specifically.
    const link = el.querySelector(`a[href="${website}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute("title")).toBe(REFERRAL_NOTE);
    expect(link?.getAttribute("aria-label")).toBe(`Groq — ${REFERRAL_NOTE}`);
    expect(el.textContent).toContain(REFERRAL_NOTE);
  });

  it.each([
    ["moonshot", "Kimi", "https://platform.kimi.ai"],
    ["kimi-coding", "Kimi Code CLI", "https://www.kimi.ai/code"],
    ["kimi-web", "Kimi Web", "https://www.kimi.ai"],
    ["cheaperinference", "Cheaper Inference", "https://cheaperinference.com"],
    ["openai", "OpenAI", "https://openai.com"],
  ])("does NOT flag %s's plain catalog website link (no per-provider partner note)", (id, name, website) => {
    const el = renderHeader(id, name, website);
    const link = el.querySelector(`a[href="${website}"]`);
    expect(link).not.toBeNull();
    expect(link?.getAttribute("title")).toBeNull();
    expect(link?.getAttribute("aria-label")).toBeNull();
    expect(el.textContent).not.toContain("Referral link");
    expect(el.textContent).not.toContain("Partner link");
  });
});
