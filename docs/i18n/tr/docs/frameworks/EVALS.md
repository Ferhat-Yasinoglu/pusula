# Evaluations (Evals) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/EVALS.md) · 🇩🇪 [de](../../../de/docs/frameworks/EVALS.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/EVALS.md)

---

> **Temel referans:** `src/lib/evals/`, `src/lib/db/evals.ts`, `src/app/api/evals/`
> **Son güncelleme:** 2026-06-28 — v3.8.40

Pusula; yönlendirme yapılandırmalarını, tekil sağlayıcıları/modelleri veya paketle birlikte sunulan "golden set" paketlerini karşılaştırmalı olarak değerlendirmenizi sağlayan genel amaçlı bir değerlendirme çatısıyla birlikte gelir. Bu çatıyı; yönlendirme değişikliklerini doğrulamak, yeni sağlayıcıları geçerli kılmak ve sürümleri üretim trafiğine almadan önce denetlemek için kullanın.

Çerçeve şu şekilde uygulanmıştır:

- Bellek içi yerleşik paketleri kaydeden, çıktıları beklenen ölçütlere göre değerlendiren ve puan kartlarını birleştiren saf bir çalıştırıcı (`src/lib/evals/evalRunner.ts`).
- Özel (kullanıcı tanımlı) paketler ve geçmiş çalıştırmalar için SQLite üzerinde bir kalıcılık katmanı (`src/lib/db/evals.ts`).
- Her vakayı `POST /v1/chat/completions` adresine gerçek çağrılar göndererek yürüten, gecikme sürelerini ve çıktıları yakalayan ve çalıştırmayı kalıcı olarak saklayan bir orkestrasyon katmanı (`src/lib/evals/runtime.ts`).
- `/api/evals/*` altında REST uç noktaları (yalnızca yönetim kimlik doğrulamasıyla erişilebilir).
- `Dashboard → Usage → Evals` konumunda bir pano arayüzü (`EvalsTab.tsx`).

## Kavramlar

### Paket

Paket, bir `description` ve bir ya da daha fazla vakadan oluşan, adlandırılmış bir test vakaları koleksiyonudur. Paketler iki kaynaktan gelir:

| Kaynak     | Tanımlandığı yer                                    | Çalışma zamanında değiştirilebilir mi? |
| ---------- | --------------------------------------------------- | -------------------------------------- |
| `built-in` | Başlatma sırasında `registerSuite()` ile kaydedilir | Hayır (kodda tanımlanır)               |
| `custom`   | SQLite `eval_suites` + `eval_cases` içinde saklanır | Evet (API/UI üzerinden)                |

Mevcut yerleşik paketler (bkz. `src/lib/evals/evalRunner.ts`):

- `golden-set` — selamlama/matematik/çeviri/güvenlik alanlarında 10 temel vaka
- `coding-proficiency` — Python/JS/SQL/TS/hata tespiti
- `reasoning-logic` — kıyaslar, sözel problemler, örüntü tanıma
- `multilingual` — çeviri ve dil algılama
- `safety-guardrails` — PII, jailbreak, reddetme, önyargı farkındalığı
- `instruction-following` — yalnızca JSON, numaralı listeler, dil kısıtlamaları
- `codex-comparison` — karşılaştırma modu için tasarlanmış bire bir kodlama görevleri

### Vaka

Her vaka şu alanları içerir:

| Alan       | Açıklama                                                                   |
| ---------- | -------------------------------------------------------------------------- |
| `id`       | Kararlı tanımlayıcı (çıktıları ve metrikleri anahtarlamak için kullanılır) |
| `name`     | İnsan tarafından okunabilir etiket                                         |
| `model`    | Çalıştırma `suite-default` hedeflemesini kullandığında varsayılan model    |
| `input`    | `{ messages, max_tokens? }` — `/v1/chat/completions` adresine gönderilir   |
| `expected` | `{ strategy, value }` — puanlama ölçütü (aşağıya bakın)                    |
| `tags`     | İsteğe bağlı etiketler (ör. `safety`, `pii`, `jailbreak`)                  |

### Hedef

Aynı paket farklı hedeflere karşı çalıştırılabilir. Hedef şeması, `src/shared/validation/schemas.ts` içindeki `evalTargetSchema` öğesidir:

| Hedef türü      | `id`      | Davranış                                                                    |
| --------------- | --------- | --------------------------------------------------------------------------- |
| `suite-default` | `null`    | Her vaka kendi yerleşik `model` alanını kullanır                            |
| `model`         | model adı | Her vakayı tek bir doğrudan model üzerinden çalışmaya zorlar (ör. `gpt-4o`) |
| `combo`         | combo adı | Her vakayı tek bir combo üzerinden çalıştırır (yönlendirme motorunu sınar)  |

`model` ve `combo` için `id` alanı zorunludur (Zod `superRefine` tarafından zorunlu kılınır). `compareTarget` sağlandığında iki hedef birbirinden farklı olmalıdır — çalıştırıcı, A/B karşılaştırması için her iki çalıştırmayı da aynı `runGroupId` altında kalıcı olarak saklar.

## Puanlama Ölçütleri

`evaluateCase()` (evalRunner.ts) içinde uygulanır:

| Strateji   | Geçme koşulu…                                                                    |
| ---------- | -------------------------------------------------------------------------------- |
| `exact`    | `actualOutput === expected.value`                                                |
| `contains` | `actualOutput.toLowerCase().includes(expected.value.toLowerCase())`              |
| `regex`    | `new RegExp(expected.value).test(actualOutput)` doğru sonuç verirse              |
| `custom`   | `expected.fn(actualOutput, evalCase)` doğru sonuç döndürürse (yalnızca yerleşik) |

**Not:** İşlevler API üzerinden serileştirilemediği için özel işlevle puanlama,
kodla tanımlanmış (yerleşik) paketlere ayrılmıştır. `evalCaseBuilderSchema`,
kullanıcı tarafından oluşturulan paketler için yalnızca
`contains | exact | regex` değerlerini kabul eder.

Şu anda LLM tabanlı hakem veya embedding tabanlı benzerlik puanlayıcısı yoktur;
bu, `evaluateCase()` içinde kolayca genişletilebilecek bir noktadır.

## Veritabanı Şeması

Üç tablo (`030_create_eval_runs.sql` ve `031_create_eval_suites.sql`
migrasyonları):

| Tablo         | Amaç                                                                                                                              |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `eval_suites` | Özel paket meta verileri (`id`, `name`, `description`)                                                                            |
| `eval_cases`  | Paket başına vakalar — `input_json`, `expected_*`, `tags_json`                                                                    |
| `eval_runs`   | Geçmiş çalıştırmalar — `pass_rate`, `total`, `passed`, `failed`, `avg_latency_ms`, `summary_json`, `results_json`, `outputs_json` |

Yerleşik paketler veritabanında **saklanmaz**. Bellekte bulunurlar ve
`evalRunner.ts` her içe aktarıldığında yeniden kaydedilirler.

## REST API

Tüm uç noktalar yönetim kimlik doğrulaması (`requireManagementAuth`) gerektirir;
genel proxy yüzeyinin bir parçası değildirler.

| Uç nokta                      | Yöntem   | Açıklama                                                                        |
| ----------------------------- | -------- | ------------------------------------------------------------------------------- |
| `/api/evals`                  | `GET`    | Paketleri + son çalıştırmaları + puan kartını + hedefleri + anahtarları listele |
| `/api/evals`                  | `POST`   | Bir paketi çalıştır (tekli veya karşılaştırmalı) — şema `evalRunSuiteSchema`    |
| `/api/evals/{suiteId}`        | `GET`    | Bir paketi getir (yerleşik veya özel)                                           |
| `/api/evals/suites`           | `POST`   | Özel bir paket oluştur — şema `evalSuiteSaveSchema`                             |
| `/api/evals/suites/{suiteId}` | `GET`    | Özel bir paketi getir                                                           |
| `/api/evals/suites/{suiteId}` | `PUT`    | Özel bir paketi değiştir (vakalar yeniden eklenir)                              |
| `/api/evals/suites/{suiteId}` | `DELETE` | Özel bir paketi ve vakalarını sil                                               |

### Bir paketi çalıştırma

```bash
curl -X POST http://localhost:20128/api/evals \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "suiteId": "golden-set",
    "target": { "type": "combo", "id": "my-combo" },
    "apiKeyId": "optional-api-key-uuid"
  }'
```

İsteğe bağlı alanlar:

- `outputs` — önceden hesaplanmış çıktıların `Record<caseId, string>` biçimindeki
  kaydıdır. Sağlandığında çalıştırıcı **istek göndermeyi atlar** ve yalnızca
  önbelleğe alınmış çıktıları puanlar (çevrimdışı değerlendirme için kullanışlıdır).
- `compareTarget` — paralel olarak çalıştırılacak ikinci hedeftir; iki çalıştırma
  da doğrudan karşılaştırmalı görünüm için oluşturulan aynı `runGroupId`
  değerini paylaşır.
- `apiKeyId` — gönderilen `/v1/chat/completions` çağrılarının kimliğini
  doğrulamak için kullanılan dahili API anahtarıdır. `REQUIRE_API_KEY`
  etkinleştirildiğinde gereklidir.

### Özel bir paket oluşturma

```bash
curl -X POST http://localhost:20128/api/evals/suites \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production smoke",
    "description": "Quick sanity check before deploy",
    "cases": [
      {
        "name": "JSON shape",
        "model": "gpt-4o",
        "input": { "messages": [{ "role": "user", "content": "Reply with {\"ok\": true}" }] },
        "expected": { "strategy": "regex", "value": "\"ok\"\\s*:\\s*true" }
      }
    ]
  }'
```

## Gönderim İşlem Hattı

`runEvalSuiteAgainstTarget()` (`src/lib/evals/runtime.ts`):

1. Paketi çözümler (yerleşik veya özel).
2. Her bir vaka için, vakanın `messages` değerini, çözümlenen `model` değerini, `stream: false` ve `max_tokens: 512` değerlerini (veya vakaya özel geçersiz kılmayı) içeren, `/v1/chat/completions` adresine yönelik bir `Request` oluşturur.
3. Sohbet işleyicisini doğrudan çağırır (işlem içinde — ek HTTP geçişi olmadan).
4. Gecikmeyi kaydeder ve metni ya `choices[0].message.content` alanından ya da Responses-API `output[]` yükünden çıkarır.
5. Tüm çıktıları `runSuite()` aracılığıyla puanlar, ardından `saveEvalRun()` aracılığıyla kalıcı hâle getirir.

Vakalar **sıralı olarak** çalıştırılır. Şu anda eşzamanlılık bayrağı yoktur.

## Kontrol Paneli

Kullanıcı arayüzü `Dashboard → Usage → Evals`
(`src/app/(dashboard)/dashboard/usage/components/EvalsTab.tsx`) konumundadır. Buradan şunları yapabilirsiniz:

- Yerleşik ve özel paketleri vaka bazında önizlemeyle inceleyebilirsiniz.
- Vaka oluşturucuyla özel paketler oluşturabilir, düzenleyebilir ve silebilirsiniz.
- Bir hedef (paket varsayılanları / model / combo), isteğe bağlı olarak ikinci bir `compareTarget` ve isteğe bağlı olarak bir API anahtarı seçip çalıştırmayı talep üzerine başlatabilirsiniz.
- Çalıştırma geçmişini, vaka başına başarılı/başarısız durumunu, gecikmeyi ve yakalanan çıktıları inceleyebilirsiniz.
- Her `(suite, target)` kapsamı için en son çalıştırma üzerinden toplanan hareketli puan kartını görebilirsiniz.

## Otomatik Değerlendirme RFC'siyle İlişkisi

Ayrı ve daha dar kapsamlı bir değerlendirme alt sistemi `src/domain/assessment/` konumundadır
(canlı puanlama motoru için ayrıca [AUTO-COMBO.md](../routing/AUTO-COMBO.md) belgesine bakın).
Bu alt sistem, Auto Combo motorunu hedefler — üst sağlayıcılar başarısız olduğunda combo'ların kendilerini otomatik olarak iyileştirebilmesi için sağlayıcıları ve modelleri otomatik olarak puanlar. Kendi çalıştırıcısını, kendi kategorilere ayırma mekanizmasını ve kendi puanlama mantığını kullanır.

Burada belgelenen Evals çerçevesi, **daha geniş ve genel amaçlı bir test yüzeyidir**. Rastgele regresyon paketleri, A/B karşılaştırmaları ve sürüm başına duman testleri için bunu tercih edin. Yönlendirme kararlarını etkilemek üzere gerçek zamanlı sağlayıcı durumu gerektiğinde Otomatik Değerlendirme alt sistemini kullanın.

## CI Entegrasyonu

Şu anda özel bir `eval:ci` npm betiği yoktur. Sürümleri değerlendirme sonuçlarına göre geçit denetimine tabi tutmak istiyorsanız iki yol vardır:

- **HTTP yolu**: Sunucuyu ayağa kaldırın, bilinen bir `suiteId` + `target` ile `POST /api/evals` isteği gönderin ve yanıtta `runs[].summary.passRate >= N` koşulunun sağlandığını doğrulayın.
- **İşlem içi yol**: Bir betikten `@/lib/evals/runtime` içindeki `runEvalSuiteAgainstTarget()` fonksiyonunu içe aktarın, bir test veritabanına karşı çalıştırın ve döndürülen `PersistedEvalRun.summary` değerini kontrol edin.

Yolu ve geçmişi kapsayan testler
`tests/unit/evals-route.test.ts` ve `tests/unit/evals-history.test.ts` konumlarındadır.

## Genişletme Noktaları

Yaygın değişiklikler ve bunların yapılacağı yerler:

- **Yeni puanlama stratejisi** — `evaluateCase()` (`evalRunner.ts`) içindeki `switch (evalCase.expected.strategy)` bloğunu genişletin ve `src/lib/db/evals.ts` içindeki `EvalCaseStrategy` ile `schemas.ts` içindeki `evalCaseBuilderSchema` kapsamlarını genişletin.
- **Yeni yerleşik paket** — bir paket nesnesi tanımlayın ve `evalRunner.ts` dosyasının en altında `registerSuite()` çağrısı yapın. Paket, `listSuites()` tarafından otomatik olarak keşfedilir.
- **Eşzamanlı çalıştırma** — `runEvalSuiteAgainstTarget()` içindeki sıralı `for` döngüsünü sınırlı bir `Promise.all` ile değiştirin (şu anda eşzamanlılık denetimi yoktur).
- **Akış/araç çağrısı vakaları** — çalıştırıcı şu anda `stream: false` değerini zorunlu kılar. Akış veya araç farkındalıklı değerlendirme, `runtime.ts` içinde değişiklik yapılmasını gerektirir (puanlamadan önce SSE parçalarını yakalayıp birleştirin).

## Ayrıca Bakınız

- [USER_GUIDE.md](../guides/USER_GUIDE.md) — genel ürün tanıtımı
- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — istek işlem hattı referansı
- [AUTO-COMBO.md](../routing/AUTO-COMBO.md) — Auto Combo puanlama motoru (canlı çalışma zamanı)
- Kaynak: `src/lib/evals/`, `src/lib/db/evals.ts`, `src/app/api/evals/`
- Kullanıcı arayüzü: `src/app/(dashboard)/dashboard/usage/components/EvalsTab.tsx`
