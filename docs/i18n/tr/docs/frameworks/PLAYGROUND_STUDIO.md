# Playground Studio (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/PLAYGROUND_STUDIO.md) · 🇩🇪 [de](../../../de/docs/frameworks/PLAYGROUND_STUDIO.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/PLAYGROUND_STUDIO.md)

---

> **Özellik:** Playground Studio — `/dashboard/playground` için birleşik yapay zekâ test çalışma alanı.
> **Planlar:** `17-playground-studio-redesign.plan.md` + `_orchestration/master-plan-group-C.md`
> **Durum:** v3.8.6 sürümünde yayımlandı

---

## Genel Bakış

Playground Studio, `/dashboard/playground` sayfasını basit bir Monaco tabanlı düzenleyiciden
tam özellikli bir test çalışma alanına dönüştürür. Eski `page.tsx` dosyasının yerini, dört sekme ve paylaşılan bir yapılandırma paneli oluşturan `PlaygroundStudio`
kabuğu alır.

```
┌ Playground ──────────────────────────────────────────────────────────┐
│ [💬 Sohbet] [⚖ Karşılaştır] [{} API] [🔧 Oluştur] 142↑ 38↓ · $0.002 </>│
├──────────────────────────────────────────┬───────────────────────────┤
│  {etkin sekme içeriği}                   │ ─ Yapılandırma            │
│                                          │ Uç Nokta  [chat ∨]        │
│                                          │ Model     [gpt-5.4 ∨]     │
│                                          │ Sistem    [metin alanı]   │
│                                          │ Sıcaklık  ▕▕▔▔ 0.7        │
│                                          │ Ön Ayarlar [▾ yükle][kaydet]│
│                                          │ [✨ İstemi iyileştir]      │
└──────────────────────────────────────────┴───────────────────────────┘
```

---

## Sekmeler

### Sohbet Sekmesi

`ChatPlayground.tsx` bileşenini çok turlu, akışlı bir çalışma ortamına dönüştürür:

- `MarkdownMessage.tsx` aracılığıyla eksiksiz markdown işleme (kod blokları, tablolar, listeler, bağlantılar).
- Paylaşılan Yapılandırma panelinden alınan sistem istemi.
- Mesaj başına token/maliyet (istem + tamamlama token'ları).
- Son yanıtı yeniden oluşturma.
- SSE akışıyla `POST /v1/chat/completions` adresine gönderim.

### Karşılaştırma Sekmesi

Bir proxy için temel farklılaştırıcı: 1 istemi en fazla **4 modelde paralel olarak** çalıştırın.

- Her biri `/v1/chat/completions` üzerinden bağımsız olarak akış sağlayan en fazla 4 sütun.
- Sütun eklemek için `+ Model ekle` düğmesi (Cmd+K kısayolu).
- `Tümünü çalıştır ▶`, `Promise.all` ve sütun başına `AbortController` kullanarak tüm akışları eş zamanlı olarak tetikler.
- Genel **Tümünü iptal et**, devam eden tüm akışları durdurur.
- Sütun başına `ProviderMetrics`, TTFT, TPS, token ve tahmini maliyeti gerçek zamanlı olarak gösterir.
- Metrikler **"istemci tarafı tahmini"** (D12) olarak etiketlenir — ilk SSE parçasından itibaren ölçülür.

### API Sekmesi

İleri düzey kullanıcılar için özgün Monaco düzenleyicisinin %100'ünü korur (D14):

- 10 uç nokta: sohbet tamamlamaları, tamamlamalar, gömmeler, görseller, ses, konuşma, transkripsiyonlar, moderasyonlar, yeniden sıralama, arama.
- Çok modlu dosya yükleme.
- Gerçek zamanlı çıktıyla SSE akışı.
- `ApiTab.tsx` olarak sarmalanmıştır (gecikmeli yüklenir, `ssr: false`).

### Oluşturma Sekmesi

Araçlar/fonksiyon çağırma ve yapılandırılmış çıktı kullanıcı arayüzü:

- `ToolsBuilder.tsx` — araç başına JSON şeması düzenleyicisiyle `tools[]` öğelerini ekleme/düzenleme/kaldırma.
  Parametreleri `ToolDefinitionSchema` (Zod) aracılığıyla doğrular.
- `StructuredOutputEditor.tsx` — JSON modu geçişi + JSON şeması düzenleyicisi.
  Yanıtı `StructuredOutputSchema` (Zod) aracılığıyla şemaya göre doğrular.
- İsteği `tools[]` ve/veya `response_format` ile `/v1/chat/completions` adresine gönderir.

---

## Yapılandırma Bölmesi (Paylaşılan)

`StudioConfigPane.tsx` — her zaman görünür, daraltılabilir.

| Alan             | Bileşen               | Notlar                                                                           |
| ---------------- | --------------------- | -------------------------------------------------------------------------------- |
| Uç Nokta         | `<select>`            | `PlaygroundEndpoint` ile eşleşen 10 seçenek                                      |
| Model            | `<input>`             | serbest metin, ör. `openai/gpt-4o`                                               |
| Sistem istemi    | `<textarea>`          | tüm sekmelere aktarılır                                                          |
| Parametreler     | `ParamSliders`        | temperature, max_tokens, top_p, presence/frequency penalty, seed, stop           |
| Ön Ayarlar       | `PresetPicker`        | adlandırılmış yapılandırma anlık görüntülerini yükler/kaydeder (DB'de kalıcıdır) |
| İstemi iyileştir | `ImprovePromptButton` | kota uyarısı modalını açar, `/api/playground/improve-prompt` çağrısını yapar     |

Durum `PlaygroundStudio.tsx` bileşenine yükseltilir ve tüm sekmelere aktarılır. Sekmeler arasında
geçiş yapıldığında yapılandırma durumu korunur.

---

## Üst Çubuk

`StudioTopBar.tsx`:

- Sekme değiştirici (role="tablist").
- `TokenCostCounter` — canlı token (↑/↓) ve tahmini maliyet göstergesi.
- Kodu dışa aktarma düğmesi (`</>`) — `ExportCodeModal` bileşenini açar.

---

## Kodu Dışa Aktarma Modalı

`ExportCodeModal.tsx`, mevcut `PlaygroundState` üzerinden curl / Python / TypeScript kod parçacıkları
oluşturmak için `codeExport.ts` kullanır. API anahtarı yer tutucusu her zaman `$PUSULA_API_KEY` değeridir (D11).

---

## İstem İyileştirici

`ImprovePromptButton.tsx` → `useImprovePrompt.ts` → `POST /api/playground/improve-prompt`:

1. Modal, "kota tüketeceği" konusunda uyarır.
2. Onaylandığında route'a `{ system, prompt, model, tone }` gönderir.
3. Route, dahili olarak `promptImprover.META_SYSTEM_PROMPT` ile `/v1/chat/completions` çağrısı yapar.
4. `{ improvedSystem?, improvedPrompt?, tokensIn, tokensOut }` döndürür.
5. Kullanıcı arayüzü, Yapılandırma bölmesindeki sistem istemini ve Sohbet sekmesindeki kullanıcı istemini günceller.

---

## Ön Ayarlar

`PresetPicker.tsx` → `usePresets.ts` → `/api/playground/presets/*`:

- `playground_presets` SQLite tablosunda saklanır (`084_playground_presets.sql` migrasyonu).
- Her ön ayar şunları saklar: `name`, `endpoint`, `model`, `system`, `params_json`, `created_at`.
- CRUD: listelemek için `GET`, oluşturmak için `POST`, `GET /:id`, `PUT /:id`, `DELETE /:id`.

---

## Akış Metrikleri

`useStreamMetrics.ts` + `streamMetrics.ts` (saf fonksiyon):

- `start()` — isteğin başlangıç zamanını kaydeder.
- `onFirstChunk()` — TTFT'yi kaydeder.
- `onChunk(n)` — tamamlama token sayısını biriktirir.
- `finish(usage?)` — nihai metrikleri hesaplar: `ttftMs`, `totalMs`, `tps`, `tokensIn`, `tokensOut`, `costUsd`.
- Fiyatlandırma, `src/lib/playground/types.ts` içindeki statik tablodan alınır ("tahmini" olarak etiketlenmiştir — D13).

---

## Backend Route'ları

| Yöntem   | Yol                              | İşleyici                                                                                                    |
| -------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `POST`   | `/api/playground/improve-prompt` | `ImprovePromptRequestSchema` ile Zod doğrulaması yapar; meta istemle `/v1/chat/completions` çağrısını yapar |
| `GET`    | `/api/playground/presets`        | `{ presets: PlaygroundPresetListItem[] }` döndürür                                                          |
| `POST`   | `/api/playground/presets`        | Ön ayar oluşturur; `PlaygroundPresetCreateSchema` doğrulaması yapar                                         |
| `GET`    | `/api/playground/presets/:id`    | Tek bir ön ayar veya 404 döndürür                                                                           |
| `PUT`    | `/api/playground/presets/:id`    | Kısmi güncelleme                                                                                            |
| `DELETE` | `/api/playground/presets/:id`    | 204                                                                                                         |

Kimlik doğrulama: isteğe bağlı (`REQUIRE_API_KEY`). Hatalar `buildErrorBody()` aracılığıyla döndürülür (Kesin Kural #12).

---

## Temel Dosyalar

| Yol                                                                        | Amaç                                               |
| -------------------------------------------------------------------------- | -------------------------------------------------- |
| `src/app/(dashboard)/dashboard/playground/PlaygroundStudio.tsx`            | Kabuk bileşeni, sekme düzenleyicisi                |
| `src/app/(dashboard)/dashboard/playground/components/StudioTopBar.tsx`     | Sekmeler + sayaç + dışa aktarma düğmesi            |
| `src/app/(dashboard)/dashboard/playground/components/StudioConfigPane.tsx` | Paylaşılan yapılandırma paneli                     |
| `src/app/(dashboard)/dashboard/playground/components/tabs/ChatTab.tsx`     | Sohbet çalışma alanı                               |
| `src/app/(dashboard)/dashboard/playground/components/tabs/CompareTab.tsx`  | Çoklu model karşılaştırması                        |
| `src/app/(dashboard)/dashboard/playground/components/tabs/ApiTab.tsx`      | Monaco düzenleyicisi (korundu)                     |
| `src/app/(dashboard)/dashboard/playground/components/tabs/BuildTab.tsx`    | Araçlar + yapılandırılmış çıktı                    |
| `src/app/(dashboard)/dashboard/playground/components/ExportCodeModal.tsx`  | Kod dışa aktarma penceresi                         |
| `src/app/(dashboard)/dashboard/playground/components/CompareColumn.tsx`    | Tekli karşılaştırma sütunu                         |
| `src/app/(dashboard)/dashboard/playground/components/ProviderMetrics.tsx`  | TTFT/TPS gösterimi                                 |
| `src/app/(dashboard)/dashboard/playground/hooks/useStreamMetrics.ts`       | İstemci tarafı metrik hook'u                       |
| `src/app/(dashboard)/dashboard/playground/hooks/usePresets.ts`             | Ön ayar CRUD hook'u                                |
| `src/app/(dashboard)/dashboard/playground/hooks/useImprovePrompt.ts`       | İstemi iyileştirme hook'u                          |
| `src/lib/playground/codeExport.ts`                                         | curl/Python/TS oluşturucu (Search Tools ile ortak) |
| `src/lib/playground/promptImprover.ts`                                     | Meta istem oluşturucu                              |
| `src/lib/playground/streamMetrics.ts`                                      | Saf metrik hesaplama                               |
| `src/lib/db/playgroundPresets.ts`                                          | DB modülü (CRUD)                                   |
| `src/app/api/playground/improve-prompt/route.ts`                           | İstemi iyileştirme REST rotası                     |
| `src/app/api/playground/presets/route.ts`                                  | Ön ayarları listeleme + oluşturma                  |
| `src/app/api/playground/presets/[id]/route.ts`                             | Ön ayarları alma/güncelleme/silme                  |
| `src/lib/db/migrations/084_playground_presets.sql`                         | DB geçişi                                          |

---

## Sorun Giderme

| Belirti                                             | Neden                               | Çözüm                                                                              |
| --------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| Monaco düzenleyicisi API sekmesinde görüntülenmiyor | SSR, Monaco'yu yükledi              | `ApiTab` öğesinin `dynamic(..., { ssr: false })` kullandığını doğrulayın           |
| Karşılaştırma akışları sırayla başlatılıyor         | Hatalı `Promise.all` kullanımı      | Tüm akış başlatmaları tek bir `Promise.all` çağrısında yürütülmelidir              |
| Metrikler `null` TTFT gösteriyor                    | İlk parça işleyicisi bağlanmamış    | SSE okuyucu döngüsünde `useStreamMetrics.onFirstChunk()` çağrıldığını kontrol edin |
| Ön ayar kalıcı olmuyor                              | DB migrasyonu çalıştırılmamış       | Sunucuyu yeniden başlatın: migrasyonlar başlangıçta otomatik olarak çalışır        |
| İstemi iyileştirme işlemi 502 döndürüyor            | Config bölümünde model ayarlanmamış | Kullanıcı, iyileştirme işleminden önce Config paneline bir model adı girmelidir    |
| Dışa aktarılan kod `MISSING_API_KEY` gösteriyor     | Yer tutucu eklenmemiş               | `codeExport.ts` her zaman `API_KEY_PLACEHOLDER = "$PUSULA_API_KEY"` kullanır       |

---

## Referanslar

- Ana plan: `_tasks/features-v3.8.6/refactorpages/_orchestration/master-plan-group-C.md`
- Özellik planı: `_tasks/features-v3.8.6/refactorpages/17-playground-studio-redesign.plan.md`
- Kod dışa aktarma: `src/lib/playground/codeExport.ts`
- İstem iyileştirici: `src/lib/playground/promptImprover.ts`
- Search Tools Studio: `docs/frameworks/SEARCH_TOOLS_STUDIO.md`
