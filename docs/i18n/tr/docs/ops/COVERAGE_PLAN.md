# Test Coverage Plan (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/COVERAGE_PLAN.md) · 🇩🇪 [de](../../../de/docs/ops/COVERAGE_PLAN.md) · 🇮🇷 [fa](../../../fa/docs/ops/COVERAGE_PLAN.md)

---

Son güncelleme: 2026-06-28

> 2026-05-13 tarihinde ölçülen durum: satırlar %82.58, ifadeler %82.58, fonksiyonlar %84.23, dallar %75.22. Aşama 1-5 tamamlandı. Mevcut odak Aşama 6 (>=%85) ve Aşama 7 (>=%90).

## Başlangıç Değerleri

Raporun nasıl hesaplandığına bağlı olarak birden fazla kapsam değeri vardır. Planlama açısından bunlardan yalnızca biri kullanışlıdır.

| Metrik                    | Kapsam                                             | İfadeler / Satırlar | Dallar | Fonksiyonlar | Notlar                                                          |
| ------------------------- | -------------------------------------------------- | ------------------: | -----: | -----------: | --------------------------------------------------------------- |
| Eski                      | Eski `npm run test:coverage`                       |              %79.42 | %75.15 |       %67.94 | Şişirilmiş: test dosyalarını sayar ve `open-sse` kapsam dışıdır |
| Tanılama                  | Yalnızca kaynak, testler ve `open-sse` hariç       |              %68.16 | %63.55 |       %64.06 | Yalnızca `src/**` kapsamını yalıtmak için kullanışlıdır         |
| Önerilen başlangıç değeri | Yalnızca kaynak, testler hariç ve `open-sse` dahil |              %82.58 | %75.22 |       %84.23 | İyileştirilecek proje genelindeki başlangıç değeri budur        |

Önerilen başlangıç değeri, optimizasyon için esas alınacak değerdir.

## Kurallar

- Kapsam hedefleri `tests/**` için değil, kaynak dosyalar için geçerlidir.
- `open-sse/**` ürünün bir parçasıdır ve kapsamda kalmalıdır.
- Yeni kod, dokunulan alanlardaki kapsamı azaltmamalıdır.
- Uygulama ayrıntıları yerine davranışların ve dal sonuçlarının test edilmesini tercih edin.
- `src/lib/db/**` için kapsamlı mock'lar yerine geçici SQLite veritabanlarını ve küçük fixture'ları tercih edin.

## Mevcut komut kümesi

- `npm run test:coverage`
  - Birim test paketi için ana kaynak kapsamı kalite kapısı
  - `text-summary`, `html`, `json-summary` ve `lcov` oluşturur
- `npm run coverage:report`
  - En son çalıştırmadan elde edilen ayrıntılı, dosya bazında rapor
- `npm run test:coverage:legacy`
  - Yalnızca geçmiş karşılaştırması için

## Aşamalar

| Aşama   |                   Hedef | Odak                                                   | Durum         |
| ------- | ----------------------: | ------------------------------------------------------ | ------------- |
| Aşama 1 | %60 ifadeler / satırlar | Hızlı kazanımlar ve düşük riskli yardımcı araç kapsamı | ✅ Tamamlandı |
| Aşama 2 | %65 ifadeler / satırlar | DB ve rota temelleri                                   | ✅ Tamamlandı |
| Aşama 3 | %70 ifadeler / satırlar | Sağlayıcı doğrulaması ve kullanım analitiği            | ✅ Tamamlandı |
| Aşama 4 | %75 ifadeler / satırlar | `open-sse` dönüştürücüleri ve yardımcıları             | ✅ Tamamlandı |
| Aşama 5 | %80 ifadeler / satırlar | `open-sse` işleyicileri ve yürütücü dalları            | ✅ Tamamlandı |
| Aşama 6 | %85 ifadeler / satırlar | Daha zor uç durumlar, dal borcu, regresyon paketleri   | Devam ediyor  |
| Aşama 7 | %90 ifadeler / satırlar | Son tarama, boşlukların kapatılması, katı eşik artışı  | Bekliyor      |

Dallar ve fonksiyonlar her aşamada kademeli olarak yükselmelidir; ancak birincil kesin hedef ifadeler / satırlardır.

## Öncelikli sıcak noktalar

Bu dosyalar bugün en düşük satır kapsamına (< %60) sahip ve 6-7. Aşamalar için en yüksek getiriyi sunuyor. 2026-05-13 tarihinde `coverage/coverage-summary.json` dosyasından oluşturulmuştur:

| #   | Dosya                                                        | Satırlar % |
| --- | ------------------------------------------------------------ | ---------: |
| 1   | `open-sse/services/compression/validation.ts`                |      %7.87 |
| 2   | `src/app/api/v1/batches/route.ts`                            |      %9.67 |
| 3   | `src/app/docs/components/FeedbackWidget.tsx`                 |      %9.80 |
| 4   | `open-sse/services/compression/toolResultCompressor.ts`      |     %10.00 |
| 5   | `src/app/docs/components/DocCodeBlocks.tsx`                  |     %10.63 |
| 6   | `open-sse/services/compression/engines/rtk/lineFilter.ts`    |     %10.96 |
| 7   | `open-sse/services/specificityRules.ts`                      |     %11.28 |
| 8   | `src/mitm/systemCommands.ts`                                 |     %12.19 |
| 9   | `open-sse/services/compression/aggressive.ts`                |     %12.77 |
| 10  | `src/app/api/v1/batches/[id]/cancel/route.ts`                |     %12.98 |
| 11  | `open-sse/services/compression/progressiveAging.ts`          |     %13.26 |
| 12  | `open-sse/services/compression/engines/rtk/smartTruncate.ts` |     %13.43 |
| 13  | `open-sse/services/compression/engines/rtk/deduplicator.ts`  |     %13.51 |
| 14  | `src/lib/cloudAgent/agents/jules.ts`                         |     %13.52 |
| 15  | `open-sse/services/compression/lite.ts`                      |     %14.46 |
| 16  | `src/app/api/v1/rerank/route.ts`                             |     %14.94 |
| 17  | `open-sse/services/compression/preservation.ts`              |     %15.07 |
| 18  | `src/lib/cloudAgent/agents/codex.ts`                         |     %15.54 |
| 19  | `open-sse/services/tierResolver.ts`                          |     %16.66 |
| 20  | `src/app/docs/components/DocsLazyWrapper.tsx`                |     %16.66 |

6-7. Aşamaların temaları:

- `open-sse/services/compression/**`, düşük kapsamın en yoğun olduğu kümedir ve kalan açığın büyük bölümünü oluşturur.
- Toplu işlem ve yeniden sıralama API rotaları (`src/app/api/v1/batches/**`, `src/app/api/v1/rerank/route.ts`) işleyici düzeyinde testlere ihtiyaç duyuyor.
- Bulut ajanı adaptörleri (`src/lib/cloudAgent/agents/jules.ts`, `codex.ts`) ve `tierResolver.ts` senaryo testlerine ihtiyaç duyuyor.
- Dokümantasyon kullanıcı arayüzü bileşenleri ve `src/mitm/systemCommands.ts` daha düşük önceliklidir, ancak kolay dal kapsamı kazanımları sağlar.

## Yürütme kontrol listesi

### Aşama 1: %56.95 -> %60

- [x] Kaynak dosyaları yerine kaynak kodunu yansıtacak şekilde kapsam metriğini düzelt
- [x] Karşılaştırma için eski kapsam betiğini koru
- [x] Başlangıç değerini ve sıcak noktaları depo içinde kaydet
- [ ] Düşük riskli yardımcı araçlar için odaklı testler ekle:
  - `src/shared/utils/upstreamError.ts`
  - `src/shared/utils/fetchTimeout.ts`
  - `src/lib/api/errorResponse.ts`
  - `src/shared/utils/apiAuth.ts`
  - `src/lib/display/names.ts`
- [ ] Şunlar için rota testleri ekle:
  - `src/app/api/settings/require-login/route.ts`
  - `src/app/api/providers/[id]/models/route.ts`

### Aşama 2: %60 -> %65

- [ ] Şunlar için veritabanı destekli testler ekle:
  - `src/lib/db/modelComboMappings.ts`
  - `src/lib/db/settings.ts`
  - `src/lib/db/registeredKeys.ts`
- [ ] Şunlardaki dal davranışını kapsa:
  - `src/lib/providers/validation.ts`
  - `src/app/api/v1/embeddings/route.ts`
  - `src/app/api/v1/moderations/route.ts`

### Aşama 3: %65 -> %70

- [ ] Şunlar için kullanım analitiği testleri ekle:
  - `src/lib/usage/usageHistory.ts`
  - `src/lib/usage/usageStats.ts`
  - `src/lib/usage/costCalculator.ts`
- [ ] Proxy yönetimi ve ayar dalları için rota kapsamını genişlet

### Aşama 4: %70 -> %75

- [ ] Çevirici yardımcılarını ve merkezi çeviri yollarını kapsa:
  - `open-sse/translator/index.ts`
  - `open-sse/translator/helpers/*`
  - `open-sse/translator/request/*`
  - `open-sse/translator/response/*`

### Aşama 5: %75 -> %80

- [ ] Şunlar için işleyici düzeyinde testler ekle:
  - `open-sse/handlers/chatCore.ts`
  - `open-sse/handlers/responsesHandler.js`
  - `open-sse/handlers/imageGeneration.js`
  - `open-sse/handlers/embeddings.js`
- [ ] Sağlayıcıya özgü kimlik doğrulama, yeniden denemeler ve uç nokta geçersiz kılmaları için yürütücü dal kapsamı ekle

### Aşama 6: %80 -> %85

- [ ] Daha fazla uç durum test paketini ana kapsam yoluna birleştir
- [ ] Zayıf kurucu/yardımcı kapsamına sahip veritabanı modüllerinin fonksiyon kapsamını artır
- [ ] `settings.ts`, `registeredKeys.ts`, `validation.ts` ve çevirici yardımcılarındaki dal kapsamı açıklarını kapat

### Aşama 7: %85 -> %90

- [ ] Kalan düşük kapsamlı dosyaları engelleyici olarak ele al
- [ ] %90'a ulaşma sürecinde düzeltilen her kapsanmamış üretim hatası için regresyon testleri ekle
- [ ] CI kapsam eşiğini yalnızca yerel başlangıç değeri art arda en az iki çalıştırmada kararlı kaldıktan sonra yükselt

## Ratchet politikası

`npm run test:coverage` eşiklerini yalnızca proje bir sonraki kilometre taşını rahat bir marjla gerçekten aştıktan sonra güncelleyin.

**Mevcut eşik:** `npm run test:coverage`, **60 ifade / 60 satır / 60 fonksiyon / 60 dal** değerlerini zorunlu kılar (metrik, Quality-Gates Aşama 6A.1'de yeniden temel alındı — önceki %82,58'lik temel değer, test dosyalarını saydığı ve `open-sse` paketini hariç tuttuğu için şişirilmişti). `test:coverage:legacy` komutu, geçmişe dönük karşılaştırma için eski 50/50/50 metriğini korur.

En son rapora göre anlık eşik kontrolleri yapmak için şunu kullanın:

```bash
node scripts/check/test-report-summary.mjs --threshold 75
```

Önerilen ratchet sıralaması (sıra `ifadeler-satırlar / dallar / fonksiyonlar` şeklindedir):

1. 55/60/55
2. 60/62/58
3. 65/64/62
4. 70/66/66
5. 75/70/72 <-- mevcut eşik (75/70/75)
6. 80/75/78
7. 85/80/84
8. 90/85/88

Dal kapsamı art arda iki çalıştırmada %78'in üzerinde kaldığında bir sonraki ratchet hedefi `80/75/78` olacaktır.

## Bilinen eksiklik

Mevcut kapsam komutu, ana Node birim testi paketini ölçer ve `open-sse` dahil olmak üzere bu testler tarafından erişilen kaynak kodunu kapsar. Henüz Vitest kapsamını tek bir birleşik raporda birleştirmez. Bu birleştirmeyi daha sonra yapmak faydalı olacaktır ancak %60'tan %80'e yükselişi başlatmak için engel değildir.
