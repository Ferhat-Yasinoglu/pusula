# Search Tools Studio (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/SEARCH_TOOLS_STUDIO.md) · 🇩🇪 [de](../../../de/docs/frameworks/SEARCH_TOOLS_STUDIO.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/SEARCH_TOOLS_STUDIO.md)

---

> **Özellik:** Search Tools Studio — `/dashboard/search-tools` için birleşik web araçları çalışma alanı.
> **Planlar:** `18-search-tools-studio-redesign.plan.md` + `_orchestration/master-plan-group-C.md`
> **Durum:** v3.8.6 sürümünde yayınlandı

---

## Genel Bakış

Search Tools Studio, `/dashboard/search-tools` sayfasını temel bir arama deneme alanından web araması, web içeriği çıkarma ve yan yana sağlayıcı karşılaştırmasını birleştiren üç sekmeli bir Studio'ya dönüştürür.

```
┌ Arama Araçları ────────────────────────────────────────────────────────┐
│ [🔍 Arama] [📄 İçerik Çıkar] [⚖ Karşılaştır]    142ms · $0.001  </>    │
│ ⓘ [Modalite rehberi]                                                    │
├──────────────────────────────────────────┬─────────────────────────────┤
│  {etkin sekme içeriği}                   │ ─ Yapılandırma              │
│                                          │ Sağlayıcı [otomatik ∨]      │
│                                          │   🟢 Serper  $0.001         │
│                                          │   🟢 Tavily  $0.008         │
│                                          │   🔥 Firecrawl (getirme)    │
│                                          │ Tür    [web | haberler]     │
│                                          │ Tam sayfa [ ] (çıkarma)     │
│                                          │ Biçim [md|metin|html]       │
│                                          │ Yeniden sıralama modeli [∨] │
└──────────────────────────────────────────┴─────────────────────────────┘
```

---

## Sekmeler

### Arama Sekmesi

Mevcut `SearchForm` + `ResultsPanel` + `RerankPanel` bileşenlerini bir sekmeye dönüştürür:

- Sorgu → sonuçlar (başlık, URL, metin parçacığı, alaka düzeyi puanı).
- Config bölmesinde sağlayıcı meta verileri (maliyet, kota, durum).
- Yeniden sıralama bölümü: bir yeniden sıralama modeli seçme, sonuçları yeniden sıralama, `positionDelta` değerini gösterme.
- Hiçbir arama sağlayıcısı yapılandırılmadığında CTA içeren boş durum.
- `SearchHistory.tsx` aracılığıyla arama geçmişi.
- `POST /v1/search` çağrısı yapar (mevcut uç nokta, değişiklik yok).

### İçerik Çıkarma Sekmesi

`POST /v1/web/fetch` (05 numaralı planda oluşturuldu) aracılığıyla bir URL'den içerik çıkarmak için yeni sekme:

- Girdi: URL + tam sayfa geçiş düğmesi + biçim seçici (markdown / metin / HTML).
- Gönder → getir → `ScrapeResult.tsx` bileşeninde görüntüle.
- `ScrapeResult`, markdown önizlemesi + ham veri geçiş düğmesini görüntüler.
- Sınır: Yanıt gövdesi **256 KB**'tan büyükse kullanıcı arayüzü `(kesildi, ham veriyi görüntüle)` ifadesini gösterir ve ham veriyi bir Monaco modalında açar (D21).
- Meta veri paneli: sağlayıcı (firecrawl/jina-reader/tavily-search/tinyfish/nimble-search/anysearch-search/parallel-search), gecikme, maliyet, yanıt boyutu, bağlantı sayısı.
- `useScrapeFetch.ts` hook'unu kullanır.

### Karşılaştırma Sekmesi

Aynı sorguyu/URL'yi en fazla **4 sağlayıcıda paralel olarak** çalıştırır (D22):

- Her sağlayıcı için yan yana sütunlar.
- Metrikler: gecikme, maliyet, sonuç sayısı, yanıt boyutu.
- Arama için URL örtüşmesi hesaplaması (ilk sonuca kıyasla ortak URL sayısı).
- Her sağlayıcı için `POST /v1/search` (arama) veya `POST /v1/web/fetch` (içerik çıkarma) çağrısı yapar.

---

## Yapılandırma Bölmesi (Paylaşılan)

`SearchToolsConfigPane.tsx` — her zaman görünür, daraltılabilir.

| Alan                    | Notlar                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| Sağlayıcı               | Durum rozetli açılır menü (yapılandırılmış / eksik / hız sınırına ulaşılmış)  |
| Tür                     | `web` veya `news` (yalnızca arama)                                            |
| Tam sayfa               | İçerik çıkarma anahtarı — ilk görünür içerik yerine sayfanın tamamını getirir |
| Biçim                   | `markdown`, `text` veya `html` (yalnızca içerik çıkarma)                      |
| Yeniden sıralama modeli | Arama sonrası yeniden sıralama için isteğe bağlı model                        |
| Geçmiş                  | Daraltılabilir arama geçmişi bölümü                                           |

---

## SearchConceptCard

`SearchConceptCard.tsx` — her zaman görünür, daraltılabilir akordeon. Şunları açıklar:

| Kavram                 | Kısa açıklama                                                                     |
| ---------------------- | --------------------------------------------------------------------------------- |
| **Arama**              | Web sonuçlarının bir listesini getirir (başlık, URL, özet, alaka düzeyi puanı)    |
| **İçerik çıkarma**     | Bir URL'nin tüm içeriğini çıkarır (markdown, metin veya HTML)                     |
| **Karşılaştırma**      | Aynı sorguyu N sağlayıcıda yan yana çalıştırır                                    |
| **Yeniden sıralama**   | Sorgu alaka düzeyini iyileştirmek için sonuçları LLM aracılığıyla yeniden sıralar |
| **Otomatik (en ucuz)** | Kullanılabilir en ucuz sağlayıcıyı otomatik olarak seçer                          |

---

## Sağlayıcı Kataloğu

`ProviderCatalog.tsx`, `GET /api/search/providers` uç noktasından tam sağlayıcı listesini sunar
(F4'te getirme sağlayıcılarını içerecek şekilde genişletilmiştir):

| `kind` | `"search"` (20 sağlayıcı) veya `"fetch"` (firecrawl, jina-reader, tavily-search, tinyfish, nimble-search, anysearch-search, parallel-search) |

Durum, kimlik bilgilerinin mevcut olup olmadığı ve tüm anahtarların o anda bekleme süresinde olup olmadığı kontrol edilerek **istek sırasında türetilir**.

---

## Kodu Dışa Aktarma

`ExportCodeModal` (Playground Studio'dan içe aktarılır) + `codeExport.ts`, hem `/v1/search`
hem de `/v1/web/fetch` çağrıları için curl / Python / TypeScript kod parçacıkları oluşturur.
API anahtarı yer tutucusu her zaman `$PUSULA_API_KEY` şeklindedir (D11, Playground Studio ile paylaşılır).

---

## Backend Değişiklikleri

Bu özellik için yalnızca bir backend değişikliği gerekti:

### Genişletilmiş `GET /api/search/providers`

`src/app/api/search/providers/route.ts` şu şekilde genişletildi:

- Her fetch sağlayıcısını (`firecrawl`, `jina-reader`, `tavily-search`, `tinyfish`, `nimble-search`, `anysearch-search`, `parallel-search`) diziye dahil etme.
- Her öğeye `kind: "search" | "fetch"` ekleme.
- Canlı kimlik bilgisi durumundan türetilen `status: "configured" | "missing" | "rate_limited"` alanını ekleme.
- Geriye dönük uyumluluğu koruma — mevcut alanlar (`id`, `name` vb.) değişmeden bırakıldı.

---

## Temel Dosyalar

| Yol                                                                               | Amaç                                                      |
| --------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/app/(dashboard)/dashboard/search-tools/SearchToolsClient.tsx`                | Studio kabuğu, sekme düzenleyicisi                        |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchToolsTopBar.tsx`     | Sekmeler + metrikler + dışa aktarma düğmesi               |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchToolsConfigPane.tsx` | Paylaşılan yapılandırma paneli                            |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchConceptCard.tsx`     | Açıklayıcı kartlar (her zaman görünür)                    |
| `src/app/(dashboard)/dashboard/search-tools/components/ProviderCatalog.tsx`       | Meta verilerle birlikte sağlayıcı listesi                 |
| `src/app/(dashboard)/dashboard/search-tools/components/ScrapeResult.tsx`          | Markdown önizlemesi + ham görünüm geçişi                  |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/SearchTab.tsx`        | Arama + yeniden sıralama sekmesi                          |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/ScrapeTab.tsx`        | İçerik çıkarma sekmesi                                    |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/CompareTab.tsx`       | Çoklu sağlayıcı karşılaştırma sekmesi                     |
| `src/app/(dashboard)/dashboard/search-tools/hooks/useScrapeFetch.ts`              | İçerik çıkarma getirme kancası                            |
| `src/app/api/search/providers/route.ts`                                           | `kind` + `status` + getirme sağlayıcılarıyla genişletildi |
| `open-sse/config/searchRegistry.ts`                                               | Arama sağlayıcısı meta verileri için doğruluk kaynağı     |

---

## Sorun Giderme

| Belirti                                                         | Neden                              | Çözüm                                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Scrape sekmesinde "uç nokta kullanılamıyor" mesajı gösteriliyor | `/v1/web/fetch` bağlanmamış        | Plan 05'in birleştirildiğini doğrulayın; `src/app/api/v1/web/fetch/route.ts` dosyasının mevcut olup olmadığını kontrol edin |
| Sağlayıcı kataloğunda tümü "eksik" olarak gösteriliyor          | Kimlik bilgileri yapılandırılmamış | `/dashboard/providers` sayfasına kimlik bilgilerini ekleyin                                                                 |
| Scrape içeriği kesiliyor                                        | Yanıt 256 KB sınırını aşıyor       | Beklenen davranış (D21). Tam içerik için "ham veriyi görüntüle" düğmesini kullanın                                          |
| Karşılaştır sekmesinde yalnızca 2 sağlayıcı gösteriliyor        | Hız sınırı etkin                   | İki veya daha fazla sağlayıcı bekleme süresinde olabilir — Yapılandırma bölmesinden sağlayıcı durumunu kontrol edin         |
| Tabloda "Boyut" ham anahtar olarak gösteriliyor                 | i18n anahtarı eksik                | Yerel ayar dosyasında `search.size` anahtarının bulunduğunu doğrulayın; i18n'i yeniden derleyin                             |

---

## Referanslar

- Ana plan: `_tasks/features-v3.8.6/refactorpages/_orchestration/master-plan-group-C.md`
- Özellik planı: `_tasks/features-v3.8.6/refactorpages/18-search-tools-studio-redesign.plan.md`
- Arama sağlayıcısı kayıt defteri: `open-sse/config/searchRegistry.ts`
- Playground Studio (paylaşılan `ExportCodeModal` + `codeExport.ts`): `docs/frameworks/PLAYGROUND_STUDIO.md`
- Web fetch arka ucu: `src/app/api/v1/web/fetch/route.ts`
