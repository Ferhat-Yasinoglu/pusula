# Cost & Spend Tracking (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/COST_TRACKING.md) · 🇩🇪 [de](../../../de/docs/guides/COST_TRACKING.md) · 🇮🇷 [fa](../../../fa/docs/guides/COST_TRACKING.md)

---

Pusula'un her isteğin maliyetini nasıl tahmin ettiği, kaydettiği ve raporladığı — ve
gösterge panelindeki sayının neden bir fatura değil, **tasarruf takipçisi** olduğu.

Ayrıca bkz.: [Kullanıcı Kılavuzu](./USER_GUIDE.md) · [Özellikler Galerisi](./FEATURES.md)

---

## Nedir (ve ne değildir)

Pusula, token sayılarını modelin fiyatlandırma oranlarıyla çarparak her tamamlama
isteğine USD cinsinden bir maliyet atar. Bu sayılar **Maliyetler** gösterge panelinde,
`pusula cost` / `pusula usage` CLI komutlarında, CSV/JSON dışa aktarımlarında ve
API anahtarı başına bütçelerde kullanılır.

> **Gösterge panelindeki "maliyet" bir fatura değil, tasarruf takipçisidir.** Pusula
> sizden hiçbir zaman ücret almaz — isteklerinizi daha önce bağladığınız sağlayıcılara
> (kendi aboneliklerinize, ücretsiz katmanlarınıza ve API anahtarlarınıza) yönlendirir.
> Tamamı ücretsiz modellerde birikmiş "$290 toplam maliyet", ücretli bir API'ye yaklaşık
> olarak **$290 ödemediğiniz** anlamına gelir. Bu değer, aynı trafiğin standart liste
> fiyatlarıyla ne kadara mal olacağının bir _tahminidir_; böylece kullanımınızın nerede
> yoğunlaştığını ve daha ucuz/ücretsiz sağlayıcılara yönlendirmenin size ne kadar tasarruf
> sağladığını görebilirsiniz.

Bu çerçeve, projenin [README](../../README.md) dosyasında doğrudan belirtilmiştir
("gösterge panelindeki 'maliyet' bir fatura değil, tasarruf takipçisidir").

Bu sayı bir tahmin olduğundan:

- Pusula'un her model için sahip olduğu fiyatlandırma tablosuna bağlıdır.
  Fiyatlandırma girdisi olmayan bir model `0` maliyet oluşturur (gezginde
  "Eski / Ücretsiz" satırı olarak görünür).
- Ücretsiz katman ve abonelik trafiği de _tahmini_ maliyet oluşturur — bu, borçlu
  olduğunuz tutar değil, tasarruf ettiğiniz tutardır.

---

## Maliyetler nasıl tahmin edilir

### Fiyatlandırma kaynağı

Maliyetler, aşağıdaki öncelik sırasına göre çözümlenen bir fiyatlandırma tablosundan gelir
([`src/lib/pricingSync.ts`](../../src/lib/pricingSync.ts)):

1. **Kullanıcı geçersiz kılmaları** — gösterge panelinde / `PATCH /api/pricing`
   aracılığıyla belirlediğiniz fiyatlar.
2. **Senkronize edilmiş harici fiyatlandırma** — senkronizasyon etkinleştirildiğinde
   LiteLLM'in herkese açık `model_prices_and_context_window.json` dosyasından alınır
   (geçersiz kılmalarınızın üzerine hiçbir zaman yazmaması için ayrı bir
   `pricing_synced` ad alanında saklanır).
3. **Sabit kodlanmış varsayılanlar** — Pusula ile birlikte sunulur.

Harici fiyatlandırma senkronizasyonu **isteğe bağlıdır** ve varsayılan olarak devre
dışıdır. İlgili ortam değişkenleri
([`.env.example`](../../.env.example) dosyasına bakın):

| Ortam değişkeni         | Varsayılan | Amaç                                                                         |
| ----------------------- | ---------- | ---------------------------------------------------------------------------- |
| `PRICING_SYNC_ENABLED`  | `false`    | Başlangıçta arka plan LiteLLM fiyatlandırma senkronizasyonunu etkinleştirir. |
| `PRICING_SYNC_INTERVAL` | `86400`    | **Saniye** cinsinden senkronizasyon aralığı (varsayılan olarak günlük).      |
| `PRICING_SYNC_SOURCES`  | `litellm`  | Virgülle ayrılmış kaynak listesi (şu anda yalnızca `litellm` desteklenir).   |

### Maliyet formülü

Maliyet, her istek için token sayılarından ve milyon token başına oranlardan
[`src/lib/usage/costCalculator.ts`](../../src/lib/usage/costCalculator.ts)
içindeki (`computeCostFromPricing` / `calculateCost`) hesaplanır:

- **Girdi token'ları** (önbellek okumaları ve önbellek oluşturma token'ları çıkarıldıktan sonra) × `input` oranı.
- **Önbellek okuma token'ları** × `cached` oranı (yoksa girdi oranı kullanılır).
- **Önbellek oluşturma token'ları** × `cache_creation` oranı (yoksa girdi oranı kullanılır).
- **Çıktı token'ları** × `output` oranı.
- **Akıl yürütme token'ları** × `reasoning` oranı (yoksa çıktı oranı kullanılır).

Tüm oranlar, 1.000.000 token başına USD olarak yorumlanır. Codex "fast"/"priority" veya
"flex" hizmet katmanı bir maliyet çarpanı (`getCodexFastCostMultiplier`) uygular — örneğin
flex, token maliyetinde %50 indirimle ücretlendirilir ve bu, gösterge panelinde
**flex tasarrufu** olarak gösterilir.

Model adları önce normalleştirilir (`openai/` veya `accounts/fireworks/models/` gibi
sağlayıcı yolu önekleri kaldırılır); böylece geçmiş satırlar da bir fiyatla eşleşmeye
devam eder.

### Harcamalar nasıl kaydedilir

- İstek başına maliyet, yanıttan sonra hesaplanır ve istemciye hiçbir zaman gecikme
  eklememesi için sonucu beklenmeden kaydedilir. Paylaşılan kota tüketimi, bir sonraki
  olay döngüsü adımında [`src/lib/quota/spendRecorder.ts`](../../src/lib/quota/spendRecorder.ts)
  aracılığıyla zamanlanır.
- API anahtarı harcamaları arabelleğe alınır ve
  [`SpendBatchWriter`](../../src/lib/spend/batchWriter.ts) tarafından toplu olarak
  yazılır (varsayılan 60 saniyelik yazma aralığı, 1.000 girdilik arabellek).
  Şunlarla ayarlanabilir:

  | Ortam değişkeni                     | Varsayılan | Amaç                                             |
  | ----------------------------------- | ---------- | ------------------------------------------------ |
  | `PUSULA_SPEND_FLUSH_INTERVAL_MS` | `60000`    | Milisaniye cinsinden arabelleği yazma aralığı.   |
  | `PUSULA_SPEND_MAX_BUFFER_SIZE`   | `1000`     | Yazmadan önce arabellekte tutulacak azami girdi. |

Gösterge panelindeki maliyet değerleri, satır başına saklanan bir dolar tutarından
**okunmaz** — analiz uç noktası her çalıştığında token sayılarından ve geçerli
fiyatlandırma tablosundan anlık olarak yeniden hesaplanır. Bu, hatalı bir fiyatı
düzeltmenin (ve yeniden senkronize etmenin) geçmiş maliyet tahminlerini geriye dönük
olarak güncelleyeceği anlamına gelir.

---

## Dashboard: Maliyetler sayfası

**Maliyetler** sayfası `/dashboard/costs`
(`src/app/(dashboard)/dashboard/costs/`) konumundadır.
Ana görünümü, tüm verileri `GET /api/usage/analytics` üzerinden yükleyen **Maliyet Genel Bakışı** sekmesidir
(`src/app/(dashboard)/dashboard/costs/CostOverviewTab.tsx`).

Gösterilenler:

- **Harcama kutucukları** — _Bugün (1d)_, _7d_, _30d_ ve seçilen zaman aralığı için tahmini harcama. Aralık seçici: `7d`, `30d`, `90d`, `all`.
- **Öne çıkan metrikler** — zaman aralığındaki istekler, etkin sağlayıcılar, etkin modeller ve istek başına ortalama maliyet.
- **Maliyet Gezgini** — **sağlayıcı**, **model**, **API anahtarı**, **hesap** veya **hizmet katmanına** göre gruplandırılmış; maliyet, istekler, token'lar, ortalama istek maliyeti ve toplam içindeki yüzde payını gösteren sıralanabilir/filtrelenebilir bir tablo.
- **Token kullanımı** — toplam / girdi / çıktı token'ları ve girdi:çıktı oranı.
- **Yönlendirme verimliliği** — geri dönüş sayısı, geri dönüş oranı ve istenen modelin kapsama oranı.
- **Aylık tahmin** — son günlük ortalamaya göre ay sonu harcamasını tahmin eder.
- **Dönem karşılaştırması** — zaman aralığının ilk ve ikinci yarısı arasındaki yüzde değişim.
- **Grafikler** — günlük maliyet eğilimi, sağlayıcı payı (pasta), en çok kullanılan sağlayıcılar, en çok kullanılan modeller, API anahtarına göre maliyet, hesaba göre maliyet, haftalık kullanım düzeni ve etkinlik ısı haritası.
- **Dışa aktarma** — geçerli zaman aralığını **CSV** veya **JSON** olarak indirin (düğmeler, sıfırdan büyük maliyet verisi olduğunda görünür).

Ücretlendirilmiş trafik olmadığında satırlar `$0` yerine "Eski / Ücretsiz" etiketiyle görüntülenir; bu, tasarruf izleyici modelini yansıtır.

### İlgili Maliyetler alt sayfaları

Maliyetler alanı ayrıca aşağıdakileri de barındırır (tümü `/dashboard/costs/` altında):

- **Fiyatlandırma** (`/dashboard/costs/pricing`) — model başına fiyatları görüntüleyin ve geçersiz kılın (paylaşılan Fiyatlandırma sekmesini oluşturur).
- **Bütçe** (`/dashboard/costs/budget`) — kapsam başına harcama limitleri belirleyin (paylaşılan Bütçe sekmesini oluşturur).
- **Kota Paylaşımı** (`/dashboard/costs/quota-share`) — paylaşılan kota havuzları ve tüketim oranı görünümleri.

---

## API uç noktaları

Aksi belirtilmedikçe bunların tümü yönetim kimlik doğrulaması gerektirir (loopback/JWT, `requireManagementAuth` aracılığıyla).

### Kullanım ve maliyet analitiği

| Yöntem | Uç nokta                 | Amaç                                                                                                                                                                    |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/api/usage/analytics`   | Tam maliyet/kullanım analitiği: özet, günlük eğilim, sağlayıcı/model/API anahtarı/hesap/katman bazında. Sorgu: `range`, `startDate`, `endDate`, `apiKeyIds`, `presets`. |
| `GET`  | `/api/usage/utilization` | Zaman içinde sağlayıcı başına kota kullanımı. Sorgu: `range` (`1h`/`24h`/`7d`/`30d`), `provider`.                                                                       |
| `GET`  | `/api/usage/history`     | Ham kullanım geçmişi satırları.                                                                                                                                         |
| `GET`  | `/api/usage/call-logs`   | İstek başına çağrı günlükleri (model, token'lar, maliyet, gecikme, durum).                                                                                              |
| `GET`  | `/api/usage/quota`       | Sağlayıcı kota durumu.                                                                                                                                                  |
| `GET`  | `/api/usage/proxy-logs`  | Proxy istek günlükleri.                                                                                                                                                 |

### Bütçeler

| Yöntem | Uç nokta                 | Amaç                                                                                            |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------- |
| `GET`  | `/api/usage/budget`      | Bir API anahtarı için maliyet özeti + bütçe kontrolü (`apiKeyId` sorgu parametresi gereklidir). |
| `POST` | `/api/usage/budget`      | Bir API anahtarı için günlük/haftalık/aylık USD limitlerini ve uyarı eşiğini ayarlayın.         |
| `GET`  | `/api/usage/budget/bulk` | API anahtarları genelinde toplu bütçe özetleri.                                                 |

> Bütçe API'si her **API anahtarı** (`apiKeyId`) için ayrı kapsamlandırılır.
> `GET /api/usage/budget` tarafından döndürülen limitler `dailyLimitUsd`, `weeklyLimitUsd`, `monthlyLimitUsd`,
> bir `warningThreshold` ve güncel toplamları (`totalCostToday`, `totalCostMonth`, …) içerir.

### Fiyatlandırma

| Yöntem   | Uç nokta                | Amaç                                                                                                                                           |
| -------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`    | `/api/pricing`          | Geçerli birleştirilmiş fiyatlandırma (kullanıcı + senkronize edilmiş + varsayılanlar). Her girdinin kaynağını görmek için `?includeSources=1`. |
| `PATCH`  | `/api/pricing`          | `{ provider: { model: { input, output, cached, … } } }` için fiyatlandırmayı geçersiz kılın.                                                   |
| `DELETE` | `/api/pricing`          | Fiyatlandırmayı varsayılanlara sıfırlayın (isteğe bağlı olarak `?provider=&model=` ile kapsamlandırılır).                                      |
| `GET`    | `/api/pricing/defaults` | 1 milyon başına varsayılan geri dönüş oranlarını gösterin.                                                                                     |
| `GET`    | `/api/pricing/models`   | Modele göre anahtarlanmış fiyatlandırma.                                                                                                       |
| `POST`   | `/api/pricing/sync`     | Harici kaynaklardan (LiteLLM) manuel senkronizasyon başlatın.                                                                                  |
| `GET`    | `/api/pricing/sync`     | Geçerli senkronizasyon durumu.                                                                                                                 |
| `DELETE` | `/api/pricing/sync`     | Senkronize edilmiş tüm fiyatlandırma verilerini temizleyin.                                                                                    |

### Maliyetle ilgili diğer uç noktalar

| Yöntem | Uç Nokta                      | Amaç                                                                             |
| ------ | ----------------------------- | -------------------------------------------------------------------------------- |
| `GET`  | `/api/free-tier/summary`      | Ücretsiz model token toplamları, bu ay kullanılan miktar ve kalan ücretsiz kota. |
| `GET`  | `/api/quota/pools/[id]/usage` | Paylaşılan kota havuzunun kullanımı.                                             |

---

## CLI

Pusula CLI'ı, maliyet, kullanım ve fiyatlandırma komutlarını sunar ([`bin/cli/commands/registry.mjs`](../../bin/cli/commands/registry.mjs) dosyasında kaydedilmiştir).

### `pusula cost`

`/api/usage/analytics` üzerinden toplanan bir maliyet raporu.

```bash
pusula cost                          # son 30 gün, sağlayıcıya göre gruplandırılmış
pusula cost --period 7d              # son 7 gün
pusula cost --group-by model         # provider | model | combo | api-key | day değerine göre gruplandır
pusula cost --since 2026-06-01 --until 2026-06-13
pusula cost --api-key <key> --limit 50
```

Sütunlar: grup, istekler, giriş/çıkış token'ları, maliyet (USD) ve toplamın yüzdesi. En sonda genel toplam satırı yazdırılır (`--quiet` veya `--output json` ile gizlenir).

### `pusula usage`

```bash
pusula usage analytics --period 30d [--provider <id>]   # sağlayıcı başına maliyet özeti
pusula usage logs [--limit 100] [--follow] [--api-key <k>] [--search <q>]
pusula usage quota [--provider <id>] [--check]
pusula usage utilization [--api-key <k>]
pusula usage history [--limit 100]
pusula usage proxy-logs [--limit 100]

# Bütçeler
pusula usage budget list
pusula usage budget get [scope]
pusula usage budget set <amount> [--scope global] [--period monthly]
pusula usage budget reset [scope]
```

### `pusula pricing`

```bash
pusula pricing list [--provider <p>] [--model <m>] [--limit 200]
pusula pricing get <model>
pusula pricing sync [--provider <p>] [--force]   # POST /api/pricing/sync
pusula pricing diff [--model <m>]
pusula pricing defaults show
pusula pricing defaults set [--input <p>] [--output <p>] [--cache-read <p>] [--cache-write <p>]
```

> `pricing defaults show`, `GET /api/pricing/defaults` üzerinden okur. Bunun yerine ayrı ayrı model
> fiyatlarını düzenlemek için **Fiyatlandırma** pano sayfasını veya `PATCH /api/pricing` uç noktasını kullanın.

---

## Sorun giderme

- **Tüm maliyetler $0 / "Legacy / Free" olarak görünüyor.** Kullanılan modeller için fiyatlandırma kaydı yoktur.
  Harici eşitlemeyi etkinleştirin (`PRICING_SYNC_ENABLED=true`) ve `pusula pricing sync` komutunu çalıştırın veya
  Fiyatlandırma sayfası / `PATCH /api/pricing` üzerinden fiyatları elle ayarlayın.
- **Geçmişte kullanılan bir model yanlış fiyatlandırılmış.** Fiyatı düzeltin (geçersiz kılın veya yeniden eşitleyin) — maliyet,
  her analiz okumasında token sayılarından yeniden hesaplandığından tahminler geriye dönük olarak güncellenir.
- **Harcama gerçek zamanın gerisinde kalıyor.** Anahtar başına harcama toplu olarak işlenir; daha güncel rakamlara ihtiyacınız varsa
  `PUSULA_SPEND_FLUSH_INTERVAL_MS` değerini düşürün.

---

Bunun genel pano içindeki yerini görmek için [Kullanıcı Kılavuzu](./USER_GUIDE.md) ve
[Özellikler Galerisi](./FEATURES.md) belgelerine bakın.
