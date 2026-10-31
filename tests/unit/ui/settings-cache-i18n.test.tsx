import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CacheSettingsTab from "@/app/(dashboard)/dashboard/settings/components/CacheSettingsTab";
import { IntlMessageFormat } from "intl-messageformat";
import tr from "@/i18n/messages/tr.json";

// Expected strings come from the same Turkish catalog the component renders, formatted
// the way next-intl formats them (ICU messages, tr number grouping).
const fmt = (message: string, values: Record<string, unknown>) =>
  String(new IntlMessageFormat(message, "tr").format(values as Record<string, string | number>));

const model = {
  id: "openai/text-embedding-3-small",
  rawId: "text-embedding-3-small",
  name: "text-embedding-3-small",
  dimensions: 1536,
  maxTokens: 8191,
  supportedInputTypes: ["text", "image"],
};
const config = {
  modelCatalogCacheTtlMs: 1500,
  semanticCacheEnabled: true,
  semanticCacheVectorEnabled: false,
  semanticCacheEmbeddingProvider: "openai",
  semanticCacheEmbeddingModel: model.rawId,
  semanticCacheEmbeddingDimension: 1536,
  embeddingOptions: [{ id: "openai", name: "OpenAI", hasConnection: true, models: [model] }],
};
// Exercise the real catalog and formatter, not the global key-only test mock.
vi.unmock("next-intl");

const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const fetchMock = vi.fn<typeof fetch>();

function mount() {
  return render(
    <NextIntlClientProvider
      locale="tr"
      timeZone="UTC"
      messages={{ settings: tr.settings, common: tr.common }}
      onError={(error) => {
        throw error;
      }}
    >
      <CacheSettingsTab />
    </NextIntlClientProvider>
  );
}

async function loaded() {
  const view = mount();
  await waitFor(() => expect(screen.getAllByRole("combobox")[0]).toHaveProperty("disabled", false));
  return view;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => reply(config));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("cache settings with real Turkish catalogs", () => {
  it("localizes headings, metadata, accessible controls, Redis and advanced overrides", async () => {
    await loaded();
    expect(screen.getByText(tr.settings.semanticCacheTitle)).toBeTruthy();
    expect(
      screen.getByRole("switch", { name: tr.settings.semanticCacheVectorEnable })
    ).toHaveProperty("ariaChecked", "false");
    expect(
      screen.getByRole("option", {
        name: fmt(tr.settings.semanticCacheConfiguredProvider, { name: "OpenAI" }),
      })
    ).toHaveProperty("value", "openai");
    expect(
      screen.getByRole("option", {
        name: fmt(tr.settings.semanticCacheModelDimensions, {
          name: "text-embedding-3-small",
          count: 1536,
        }),
      })
    ).toHaveProperty("value", model.rawId);
    expect(
      screen.getByText(
        fmt(tr.settings.semanticCacheConfiguredConnection, {
          url: tr.settings.semanticCacheDefaultUrl,
        })
      )
    ).toBeTruthy();
    expect(
      screen.getByText(fmt(tr.settings.semanticCacheDimensions, { count: 1536 }))
    ).toBeTruthy();
    expect(screen.getByText(fmt(tr.settings.semanticCacheMaxTokens, { count: 8191 }))).toBeTruthy();
    expect(
      screen.getByText(
        fmt(tr.settings.semanticCacheInputTypes, {
          types: new Intl.ListFormat("tr").format([
            tr.settings.semanticCacheInputText,
            tr.settings.semanticCacheInputImage,
          ]),
        })
      )
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: tr.settings.semanticCacheRedis }));
    expect(screen.getByLabelText(tr.settings.semanticCacheRedisPrefix)).toHaveProperty(
      "value",
      "pusula:semcache:"
    );
    expect(screen.getByLabelText("Redis URL")).toHaveProperty(
      "placeholder",
      "redis://127.0.0.1:6379"
    );
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheShowAdvanced }));
    expect(screen.getByLabelText(tr.settings.semanticCacheApiKey)).toHaveProperty(
      "placeholder",
      tr.settings.semanticCacheApiKeyPlaceholder
    );
    expect(
      screen
        .getByRole("button", { name: tr.settings.semanticCacheHideAdvanced })
        .getAttribute("aria-expanded")
    ).toBe("true");
    fireEvent.click(screen.getByRole("switch", { name: tr.settings.semanticCacheEnable }));
    expect(screen.getByText(tr.settings.semanticCacheDisabled)).toBeTruthy();
  });

  it("renders translated TTL validation and saves the unchanged numeric API payload", async () => {
    await loaded();
    const ttl = screen.getByLabelText(tr.settings.modelCatalogCacheTtlLabel);
    fireEvent.change(ttl, { target: { value: "" } });
    expect(screen.getByText(tr.settings.modelCatalogTtlRequired)).toBeTruthy();
    const save = screen.getByRole("button", { name: tr.settings.modelCatalogCacheTtlSave });
    expect(save).toHaveProperty("disabled", true);
    fireEvent.change(ttl, { target: { value: "50" } });
    expect(save).toHaveProperty("disabled", true);
    fireEvent.change(ttl, { target: { value: "5000" } });
    fetchMock.mockResolvedValueOnce(reply({ modelCatalogCacheTtlMs: 5000 }));
    fireEvent.click(save);
    await screen.findByText(tr.settings.cacheConfigSaveSuccess);
    const call = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT");
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ modelCatalogCacheTtlMs: 5000 });
  });

  it("localizes saving feedback without translating provider/model/backend wire values", async () => {
    await loaded();
    fireEvent.click(screen.getByRole("tab", { name: tr.settings.semanticCacheRedis }));
    let resolve!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        })
    );
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheSave }));
    expect(screen.getByRole("button", { name: tr.settings.semanticCacheSaving })).toHaveProperty(
      "disabled",
      true
    );
    resolve(reply({ ok: true }));
    await screen.findByText(tr.settings.semanticCacheSaveSuccess);
    const body = JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body));
    expect(body).toMatchObject({
      semanticCacheBackend: "redis",
      semanticCacheEmbeddingProvider: "openai",
      semanticCacheEmbeddingModel: model.rawId,
      semanticCacheEmbeddingDimension: 1536,
      semanticCacheVectorEnabled: false,
      semanticCacheRedisPrefix: "pusula:semcache:",
      semanticCacheTTL: 1800000,
    });
    fetchMock.mockResolvedValueOnce(reply({}, 500));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheSave }));
    await screen.findByText(tr.settings.semanticCacheSaveFailed);
  });

  it.each([undefined, "https://example.com/v1"])(
    "formats complete embedding success messages (endpoint %s)",
    async (url) => {
      await loaded();
      fetchMock.mockResolvedValueOnce(
        reply({ ok: true, dimensions: 1536, latencyMs: 25, resolvedBaseUrl: url })
      );
      fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheTest }));
      await screen.findByText(tr.settings.semanticCacheConnectionVerified);
      expect(
        screen.getByText(
          url
            ? fmt(tr.settings.semanticCacheTestSuccessVia, {
                url: "https://example.com/v1",
                latency: 25,
                dimensions: 1536,
              })
            : fmt(tr.settings.semanticCacheTestSuccess, { latency: 25, dimensions: 1536 })
        )
      ).toBeTruthy();
      expect(JSON.parse(String(fetchMock.mock.calls.at(-1)?.[1]?.body))).toMatchObject({
        provider: "openai",
        model: model.rawId,
        dimensions: 1536,
      });
    }
  );

  it("localizes connection errors and missing diagnostics", async () => {
    await loaded();
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheTest }));
    await screen.findByText(tr.settings.semanticCacheConnectionError);
    expect(screen.queryByText("Failed to fetch")).toBeNull();
    fetchMock.mockResolvedValueOnce(reply({ ok: false }, 400));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheTest }));
    await screen.findByText(tr.settings.semanticCacheUnknownError);
    fetchMock.mockResolvedValueOnce(reply({ ok: false, error: "upstream-diagnostic-code" }));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheTest }));
    await screen.findByText("upstream-diagnostic-code");
  });

  it("localizes purge success and failure while retaining DELETE semantics", async () => {
    await loaded();
    fetchMock.mockResolvedValueOnce(reply({ ok: true }));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheClear }));
    await screen.findByText(tr.settings.semanticCacheClearSuccess);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/cache", { method: "DELETE" });
    fetchMock.mockResolvedValueOnce(reply({}, 500));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheClear }));
    await screen.findByText(`${tr.settings.semanticCacheClearFailed} HTTP 500`);
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fireEvent.click(screen.getByRole("button", { name: tr.settings.semanticCacheClear }));
    await screen.findByText(tr.settings.semanticCacheClearFailed);
  });

  it("localizes initial load failure", async () => {
    fetchMock.mockResolvedValueOnce(reply({}, 503));
    mount();
    await screen.findByText(tr.settings.cacheConfigLoadFailed);
  });
});
