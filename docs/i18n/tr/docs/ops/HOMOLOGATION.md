# Homologation Suite (`npm run homolog`) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/HOMOLOGATION.md) · 🇩🇪 [de](../../../de/docs/ops/HOMOLOGATION.md) · 🇮🇷 [fa](../../../fa/docs/ops/HOMOLOGATION.md)

---

Homologasyon VPS'sinde çalışan Pusula dağıtımının gerçek ortam E2E doğrulaması
(`HOMOLOG_BASE_URL`, ör. `http://127.0.0.1:20128`). Tek bir komut, manuel
sürüm STOP #2 kontrol listesinin yerini otomatik ve kanıt üreten bir çalıştırmayla alır.

## Kapsamı

| Katman                    | Kontrol ettikleri                                                                                                                                                                                                                             | Uygulama                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| L0 — sağlık/parite        | `/api/monitoring/health`, `status: "healthy"` ve beklenen sürümle birlikte `200` yanıtı verir                                                                                                                                                 | `scripts/homolog/lib/parity.mjs`                                              |
| L1a — geçici anahtar      | Yönetici girişi → `POST /api/keys`, çalıştırma için kapsamı belirlenmiş bir API anahtarı oluşturur; sonuç ne olursa olsun bir `finally` bloğunda iptal edilir (`DELETE /api/keys/:id`)                                                        | `scripts/homolog/lib/adminClient.mjs`                                         |
| L1b — API yüzeyi          | `/v1/models` kataloğu, gerçek bir akışsız sohbet tamamlama isteği (katman açısından kritik model, `max_tokens: 5`), geçersiz anahtar için `401` ve herkese açık `/api/monitoring/health`                                                      | `tests/homolog/api/core.http` (httpYac)                                       |
| L1c — SSE akışı           | Gerçek akışlı sohbet tamamlama; `text/event-stream`, en az bir içerik deltası ve bir `[DONE]` sonlandırıcısı bulunduğunu doğrular                                                                                                             | `scripts/homolog/lib/sseCheck.mjs`                                            |
| L2 — gerçek sağlayıcılar  | Canlı `/v1/models` kataloğunda bulunan her kritik sağlayıcı için promptfoo aracılığıyla anında oluşturulan, minimum maliyetli bir sohbet isteği                                                                                               | `scripts/homolog/gen-promptfoo.mjs` + `scripts/homolog/lib/providerTiers.mjs` |
| L4a — UI kimlik doğrulama | Gerçek giriş formu üzerinden bir kez giriş yapar ve oturumu (`storageState`) UI katmanı genelinde yeniden kullanır                                                                                                                            | `tests/homolog/ui/auth.setup.ts`                                              |
| L4b — UI rotaları         | `src/app/(dashboard)/dashboard` altındaki her statik `page.tsx` dosyası (dosya sisteminden keşfedilir, dinamik `[param]` rotaları atlanır) HTTP hatası, sayfa hatası veya Next.js hata sınırı olmadan yüklenir                                | `tests/homolog/ui/routes.spec.ts`                                             |
| L4c — kritik UI akışı     | Kontrol paneli UI'ı üzerinden bir API anahtarı oluşturur ve ardından iptal eder (VPS üzerinde kalıntı bırakmaz)                                                                                                                               | `tests/homolog/ui/api-key-flow.spec.ts`                                       |
| L5 — birleşik rapor       | httpYac'i (`junit-to-ctrf` aracılığıyla), promptfoo→CTRF bağdaştırıcısını ve Playwright CTRF raporlayıcısını tek bir `homolog-ctrf.json` dosyasında birleştirir; ayrıca insan tarafından okunabilir bir `homolog-report/summary.md` oluşturur | `scripts/homolog/run.mjs`                                                     |

Yeniden oynatımın kendisinde sıfır LLM katılımı vardır — bu bir değerlendirme değil,
deterministik bir regresyon test paketidir. Yapay zekâ yalnızca gelecekteki bakım
çalışmalarında devreye girer (aşağıdaki Yol Haritası'na bakın).

## Ön koşullar

1. `.env.homolog.example` dosyasını `.env.homolog` olarak kopyalayın (git tarafından yok sayılır — asla commit etmeyin) ve şunları doldurun:
   - `HOMOLOG_BASE_URL` — hedef dağıtım, ör. `http://127.0.0.1:20128`.
   - `HOMOLOG_ADMIN_PASSWORD` — söz konusu dağıtımın pano yönetim parolası.
   - `HOMOLOG_CRITICAL_PROVIDERS` — gerçek bir duman testi sohbet isteği alacak, virgülle ayrılmış sağlayıcı ön ekleri (ör. `openai,anthropic,gemini,codex,grok,glm,deepseek,openrouter`).
   - `HOMOLOG_API_KEY` — normal çalıştırmalarda boş bırakın; test paketi kendi geçici anahtarını oluşturur ve iptal eder. Bunu yalnızca tek bir katmanda yalıtılmış olarak hata ayıklamak için ayarlayın.
2. Depoda `npm install` komutunu çalıştırın (test paketinin bağımlılıkları — `httpyac`, `promptfoo`, `playwright-ctrf-json-reporter`, `junit-to-ctrf`, `ctrf` — normal devDependencies öğeleridir).
3. Tarayıcı ikili dosyaları henüz mevcut değilse `npx playwright install` komutunu çalıştırın.

## Nasıl çalıştırılır

```bash
npm run homolog
```

Sürümü yerel `package.json` ile eşleşmeyen bir dağıtımı doğrulamak için (ör. hâlâ önceki bir yama sürümünde olan bir homologasyon sunucusu), beklenen sürümü açıkça geçersiz kılın:

```bash
HOMOLOG_EXPECT_VERSION=3.8.47 npm run homolog
```

Herhangi bir katman başarısız olursa çalıştırma sıfırdan farklı bir kodla sonlanır ve hata durumunda bile oluşturduğu geçici API anahtarını her zaman iptal etmeye çalışır (`scripts/homolog/run.mjs` içindeki `finally` bloğu).

## Raporu okuma

Tüm çıktılar `homolog-report/` dizinine yazılır (git tarafından yok sayılır):

- `summary.md` — stdout'a yazdırılan tablonun aynısı; her katman için bir satır (✅/❌ + ayrıntı).
- `homolog-ctrf.json` — birleştirilmiş CTRF raporu (API/SSE, sağlayıcı duman testi ve UI sonuçlarının birleşimi) — bir sürümün STOP #2 kontrol listesine eklenmesi gereken yapıt budur.
- `httpyac-junit.xml`, `api-ctrf.json`, `providers-ctrf.json`, `ui-ctrf.json` — katman başına ham/ara raporlar.
- `promptfooconfig.yaml`, `provider-misses.json` — mevcut çalıştırma için oluşturulan promptfoo yapılandırması ve canlı katalogda bulunmayan kritik sağlayıcılar.

Başarısız bir L0 işlemi hemen durdurur (geçici anahtar oluşturulmaz), çünkü bir sürüm/sağlık uyuşmazlığı, sonraki her katmanın yanlış dağıtımı doğrulayacağı anlamına gelir.

## UI meşru biçimde değiştiğinde temel değerleri yeniden belirleme

L4b (rota duman testi) ve L4c (API anahtarı UI akışı), anlık görüntüler yerine gerçek DOM konumlandırıcılarıyla çalışır; bu nedenle çoğu meşru UI değişikliği test paketinde güncelleme gerektirmez. Bir değişiklik konumlandırıcıyı bozduğunda (ör. yeniden adlandırılmış bir düğme etiketi veya taşınmış bir ayarlar sayfası):

1. Konumlandırıcıyı mevcut kaynakla yeniden doğrulayın (spesifikasyonlar, her konumlandırıcının hangi dosya/satıra göre doğrulandığını zaten belgeler — aynı örüntüyü izleyin, tahminde bulunmayın).
2. `tests/homolog/ui/` içindeki spesifikasyonu güncelleyin.
3. Düzeltmeyi doğrulamak için VPS'e karşı `npm run homolog` komutunu (veya yalnızca etkilenen Playwright spesifikasyonunu) yeniden çalıştırın, ardından commit edin.

Bu test paketinde görsel/piksel temel değeri yoktur (F1) — bunun için Yol Haritası'na bakın.

## Yol Haritası (F2 / F3)

Tasarım ve aşamalı kullanıma sunma planı, dahili planlama spesifikasyonu olan
`_tasks/superpowers/specs/2026-07-13-homolog-e2e-suite-design.md` içinde yer alır (bağlantı verilmemiştir — dahili bir `_tasks/` yapıtıdır ve bu deponun izlenen belgelerinin parçası değildir). Özet:

- **F2** — tam adım adım kullanım kaydı → Playwright Test Agents (`planner`/`generator`) bunu akış spesifikasyonlarına dönüştürür (combo oluşturma, sağlayıcıyı test etme, ayarları düzenleme, MCP araçları) + dinamik verilerin (metrikler, zaman damgaları, günlükler) üzerini maskeleyen görsel regresyon temel değeri (Lost Pixel) + her sürüm için bir `healer` bakım rutini.
- **F3** — dayanıklılık/sözleşme/entegrasyon kapsamı: devbox üzerinde toxiproxy + OpenAI uyumlu sahte bir sağlayıcı, VPS üzerinde buna yönlendirilmiş bir `homolog-resilience` combo (enjekte edilen zaman aşımı → geri dönüşü + devre kesicinin `/api/monitoring/health` üzerinden açılıp kapanmasını doğrulama); `docs/openapi.yaml` dosyasına karşı kapılı Schemathesis sözleşme testi (düşük `--max-examples`, sabit seed değerleri, yalnızca LLM dışı uç noktalar); ayrıca `npm run homolog` + onun `summary.md` dosyasının `/generate-release` STOP #2 aşamasına bağlanması.
