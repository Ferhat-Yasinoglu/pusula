# Model Exposure Allow/Deny List (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../routing/MODEL_EXPOSURE_LIST.md) · 🇩🇪 [de](../../../de/docs/routing/MODEL_EXPOSURE_LIST.md) · 🇮🇷 [fa](../../../fa/docs/routing/MODEL_EXPOSURE_LIST.md)

---

> Etkinleştirme isteğe bağlıdır ve varsayılan olarak kapalıdır (`modelVisibilityAllowlist`/`modelVisibilityDenylist` değerlerinin
> ikisinin de boş olması, `/v1/models` kataloğunu VE her `auto/*` aday havuzunu bayt düzeyinde aynı bırakır).
> Maliyetle ilgisi olmayan nedenlerle düzenlenmiş bir model listesi isteyen operatörler için
> `hidePaidModels`/`hideAutoCombos` ayarlarının (`src/lib/db/settings.ts`) eşleniğidir.

## Bunun var olma nedeni

`hidePaidModels`, "bu model ücretsiz mi?" sorusunu; `hideAutoCombos` ise "`auto/*`
sanal kimlikleri hiç duyurulmalı mı?" sorusunu yanıtlar — bunların hiçbiri, bir operatörün
rastgele bir model alt kümesi oluşturmasına olanak tanımaz (ör. fiyatlandırmadan bağımsız olarak
belirli bir Claude Code / OpenCode istemcisinin görmesi gereken modelleri tam olarak sunmak).
#11481 bunu, birbirinden bağımsız ve isteğe bağlı iki dize dizisi ayarı olarak ekler.

## Ayarlar

| Anahtar                    | Tür        | Varsayılan | Anlamı                                                                |
| -------------------------- | ---------- | ---------- | --------------------------------------------------------------------- |
| `modelVisibilityDenylist`  | `string[]` | `[]`       | Bir adayla eşleşen girdiler, adayı katalogdan/aday havuzundan gizler. |
| `modelVisibilityAllowlist` | `string[]` | `[]`       | Boş olmadığında, YALNIZCA bir adayla eşleşen girdiler görünür kalır.  |

Her ikisi de en fazla 200 karakterden oluşan en fazla 500 girdi kabul eder
(`src/shared/validation/settingsSchemas.ts` içinde Zod ile doğrulanır). Bir girdi şunlardan biridir:

- tam bir katalog kimliği — `"gpt-4o"` (yalın model kimliği) veya `"openai/gpt-4o"` (sağlayıcı önekli), ya da
- `*`/`?` kullanan bir glob kalıbı — ör. `"openai/gpt-4*"` veya `"anthropic/*"` — `ModelRoutingSection`
  bileşeninin model başına kombinasyon eşlemeleri ve `freeModels.ts::matchesOnlyPaidModels` tarafından
  zaten kullanılan aynı ortak `globToRegex()` eşleştiricisi (`src/shared/utils/globPattern.ts`) aracılığıyla çözümlenir.

Öncelik: Önce engelleme listesi kontrol edilir (engellenen bir girdi, izin verme listesiyle de
eşleşse bile her zaman gizlenir); izin verme listesi boş olmadığında yalnızca onunla eşleşen
girdiler görünür kalır.

## Bir değil, iki darboğaz noktası

#6512'den çıkarılan ders (yalnızca `hidePaidModels` kullanan bir katalog filtresi, kombinasyon
aday havuzu bağımsız olarak oluşturulduğundan `auto/*` yönlendirmesinin ücretli bir modele
gitmesine yine de izin veriyordu) burada da aynen geçerlidir. Eşleştirme koşulu
`isModelExposureAllowed()` (`src/shared/utils/modelExposureList.ts`) ŞU İKİ yerde çağrılır:

- `src/app/api/v1/models/catalog.ts` — `/v1/models` listesinin kendisinde, `shouldHidePaid()`
  tarafından hâlihazırda denetlenen kaynak başına aynı 5 darboğaz noktasında (statik `PROVIDER_MODELS`,
  eşitlenmiş sağlayıcı satırları, özel satırlar, takma ad destekli satırlar, yönetilen geri dönüş satırları).
- `open-sse/services/autoCombo/modelExposureFilter.ts::filterModelExposureCandidates()` —
  `virtualFactory.ts::buildPreparedPool` içinden, eşdeğer `filterPaidOnlyCandidates()`
  çağrısından hemen sonra çağrılır; böylece engellenen bir model, bir `auto/*` aday havuzuna da
  hiçbir zaman seçilemez.

## Filtrelenmeyenler

`hideAutoCombos` ayarının mevcut davranışını yansıtır: **açıkça** gönderilen bir model kimliği
(`auto/*` üzerinden gönderilmeyen ve katalog listesi aracılığıyla keşfedilmeyen), yönlendirme
sırasında hiçbir zaman engellenmez — yalnızca duyuru/aday havuzu üyeliği filtrelenir. Bu,
`hidePaidModels` ayarından bağımsızdır; bir operatör maliyetle ilgisi olmayan nedenlerle
düzenlenmiş bir küme isteyebilir. Bu nedenle her iki ayar da `catalog.ts` içindeki mevcut çoklu
bayrak bileşiminde olduğu gibi bağımsız VE'lenen filtreler olarak birleşir.

Ayarların dışa aktarımı (`GET /api/settings/export-json`), diğer tüm ayar alanlarında olduğu gibi
her iki diziyi de olduğu gibi içerir — `hidePaidModels` ayarının kombinasyon adımı dışa aktarma
filtresinden farklı olarak burada yeniden yükleme riski yoktur: dışa aktarılan bir kombinasyon
adımına gömülü engellenmiş bir kimlik, operatörün kendi açık yönlendirme tercihidir; dışa aktarma
sınırının kaldırması gereken bir şey değildir.
