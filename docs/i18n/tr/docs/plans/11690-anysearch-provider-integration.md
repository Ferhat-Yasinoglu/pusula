# AnySearch provider integration (PR #11690) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../plans/11690-anysearch-provider-integration.md) · 🇩🇪 [de](../../../de/docs/plans/11690-anysearch-provider-integration.md) · 🇮🇷 [fa](../../../fa/docs/plans/11690-anysearch-provider-integration.md)

---

Şablon: xquik #11370 (release/v3.8.51 sürümüne birleştirildi). Duruş: `fallbackOnly`.
Upstream önerisi: issue Ferhat-Yasinoglu/pusula#11637.

## 1. Servis temel gerçekleri (resmî belgeler, çapraz kontrol edildi)

- Temel URL: `https://api.anysearch.com` (REST) + `POST /mcp` (MCP, JSON-RPC 2.0).
- `POST /v1/search` - parametreler: `query` (zorunlu), `max_results` (1-10, varsayılan 10), `tag` (`{domain}.{sub_domain}` dikey yönlendirmesi), `zone` (cn/intl), `language`, `params` (yapılandırılmış dikey alanlar), `format` (json/markdown).
- `GET /v1/sub-domains?domain=...` - yetenek kataloğu, kotadan DÜŞMEZ.
- `POST /v1/extract` - `{url, title, content}` verilerini getirir/ayıklayır; katı JSON gövdesi, 16 KiB sınırı.
- `POST /v1/auth/email/register` - tek çağrılı kayıt, tek kullanımlık düz metin anahtarı `as_sk_...` döndürür.
- Kimlik doğrulama: isteğe bağlı `Authorization: Bearer <as_sk_...>`; anonim kullanım, günlük ücretsiz kotayı tüketen IP başına sınırlara indirgenir; geçersiz anahtar, sessiz anonim geri dönüş OLMADAN 401/403 döndürür.
- Ücretsiz katman: günde 1000 istek, anahtar başına 20 QPS. Ücretli katman: fiyatlandırılmamış (Yakında).
- Yanıt zarfı: başarı `{code: 0, message: "success", request_id, data}`; başarısızlık `{code: -1, message}`. Kimlik doğrulama/kota hataları yapılandırılmış `error_code` içermez (sinyal, ileti metnidir); ayıklamaya özgü hatalar ise `error_code` içerir (`invalid_extract_url`, `extract_failed`). 429 yanıtlarında `Retry-After` başlığı yoktur.

## 2. Değişiklik kapsamı (~10 katman, xquik kapsamını yansıtır)

| Katman                     | Dosya                                                                                                                                                                                                                                                                       | Değişiklik                                                                                                     |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Kayıt girdisi              | `open-sse/config/searchRegistry.ts`                                                                                                                                                                                                                                         | `anysearch-search` girdisi + `anysearch`, `anysearch_search` takma adları                                      |
| Yürütücü                   | `open-sse/handlers/search/anysearchSearch.ts`                                                                                                                                                                                                                               | `buildAnysearchSearchRequest`, `normalizeAnysearchSearchResponse`, `AnysearchSearchEnvelopeError`              |
| Yönlendirme eşlemeleri     | `open-sse/handlers/search.ts` + `searchProxy.ts`                                                                                                                                                                                                                            | istek oluşturucu eşlemesi + yanıt normalleştirici eşlemesi; zarf hatası -> 402 (kota) / 502 (diğer)            |
| Fetch yürütücüsü           | `open-sse/executors/anysearch-fetch.ts` + `open-sse/handlers/webFetch.ts`                                                                                                                                                                                                   | `POST /v1/extract`; birleşim + `WEB_FETCH_PROVIDERS` + yönlendirme durumu; kota zarfı -> 402                   |
| Kullanıcı arayüzü kataloğu | `src/shared/constants/providers/search.ts`                                                                                                                                                                                                                                  | meta veri girdisi (`serviceKinds: ["webSearch", "webFetch"]`); authHint, günlük 1000 ücretsiz katmanı belgeler |
| Kimlik bilgisi doğrulaması | `src/lib/providers/validation/searchProviders.ts`                                                                                                                                                                                                                           | `SEARCH_VALIDATOR_CONFIGS["anysearch-search"]` (Bearer yoklaması)                                              |
| MCP                        | `open-sse/mcp-server/schemas/tools.ts`                                                                                                                                                                                                                                      | fetch enum'u + web_search açıklaması                                                                           |
| API şeması                 | `src/shared/validation/schemas/apiV1.ts`, `docs/openapi.yaml`                                                                                                                                                                                                               | takma adların standartlaştırılması + sağlayıcı enum'u                                                          |
| Belgeler                   | `docs/reference/PROVIDER_REFERENCE.md`, `docs/frameworks/SEARCH_TOOLS_STUDIO.md`, `changelog.d/features/anysearch-search-provider.md`                                                                                                                                       | tutarlılık kopyaları                                                                                           |
| Testler                    | `tests/unit/anysearch-search-provider.test.ts` (8 durum), `tests/unit/executor-anysearch-fetch.test.ts` (2 durum), `search-registry.test.ts`, `search-route.test.ts`, `tests/integration/search-providers-catalog.test.ts`, `tests/snapshots/executors/dispatch-rules.json` | xquik paketini yansıtır; katalog sayıları 20 arama / 6 fetch (nimble-search ile birlikte mevcut)               |

## 3. Kararlar (tümü 2026-08-26 tarihinde alındı)

1. **Yönlendirme yaklaşımı: `fallbackOnly`.** Gerekçe: maliyeti 0 olan ücretsiz bir sağlayıcı, otomatik maliyet yönlendirmesinde hiçbir zaman baskın olmamalıdır; açık seçim ve yük devretmeden dönüş bundan etkilenmez. Emsal: birleştirilmiş xquik girdisi.
2. **Kapsam: v1'de `POST /v1/extract` üzerinden webSearch + webFetch.** tavily/exa çift yetenekli zihinsel modeliyle uyumludur. Dikey yüzeyler (`tag`, `sub-domains`, `batch_search`) kapsam dışında kalır — bugün dikey parametreler için bir IR bulunmamaktadır.
3. **Kota gösterimi: `freeMonthlyQuota: 0`** (xquik tarzı ihtiyatlı gösterim). Gerçek hak (günde 1000 istek, günlük sıfırlama) bunun yerine UI kataloğundaki `authHint` metninde belirtilir. Gerekçe: kota gösterimi sıfırlama semantiğiyle eşleşmelidir; günlük bir sınırı aylık eşdeğere (30000) dönüştürmek, UI'ın yerine getiremeyeceği yanlış bir vaattir.
4. **searchTypes: yalnızca `["web"]`.** AnySearch API'sinde haber/görsel dikeyine ilişkin herkese açık bir kanıt bulunmamaktadır; belgelenmiş bir dikeyi olmayan API'leri entegre eden ağ geçitleri (ör. Google Custom Search), haberları sessizce web'e eşlemek yerine yalnızca web'i sunar.
5. **Anahtar yaklaşımı:** anahtarsız kullanım çalışır; geçersiz bir anahtar 401/403 döndürür ve hiçbir zaman sessizce anonim kullanıma düşürülmez (üst sağlayıcının sözleşmesini yansıtır).
6. **Bilinçli hariç tutmalar:** `FETCH_BACKEND_TO_PROVIDER` / `FetchInterceptionBackend` (sohbet müdahalesi firecrawl/jina/tavily ile sınırlı kalır); `ANONYMOUS_CAPABLE_WEB_FETCH_PROVIDERS` (anonim uzak uç noktalar, çıkış IP'si başına IP ile sınırlandırılmış tek bir havuzu paylaşır; bu nedenle anahtarsız extract isteğe bağlıdır, otomatik yönlendirme adayı değildir); `QUOTA_STATUS_PROVIDERS` (AnySearch kotayı 402/403 durum koduyla değil, 429/zarf üzerinden bildirir).

## 4. Referanslar

- xquik şablonu: commit a0ceccc, PR #11370 (release/v3.8.51 içinde).
- AnySearch resmi belgeleri: https://anysearch.com/docs, https://anysearch.com/pricing; MCP kataloğu mcpservers.org/servers/anysearch-ai/anysearch-mcp-server; beceri deposu github.com/anysearch-ai/anysearch-skill.
- Sektörel zihinsel model: LiteLLM arama belgeleri (kayıt defteri + birleşik search() + Perplexity özellikli IR), open-webui web araması (yerleşik sağlayıcılar, search_web/fetch_url çift araçları), Dify araç eklentisi deseni; maliyet yük devretme basamakları: kendi sunucunda barındırılan -> ücretsiz kota -> ücretli.
