# CORS Configuration & Security (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../security/CORS.md) · 🇩🇪 [de](../../../de/docs/security/CORS.md) · 🇮🇷 [fa](../../../fa/docs/security/CORS.md)

---

Pusula, hangi **tarayıcı origin'lerinin** origin'ler arası yanıtları okuyabileceğini tek ve merkezi bir izin listesi üzerinden denetler. Model, **varsayılan olarak erişimi reddeder**: siz açıkça izin verene kadar hiçbir origin'e izin verilmez. Bu sayfa; izin listesinin nasıl çözümlendiğini, `CORS_ALLOW_ALL=true` ayarının gerçekte neleri erişime açtığını (ve daha da önemlisi neleri **açmadığını**), geliştirme ve üretim ortamlarının güvenli biçimde nasıl yapılandırılacağını ve wildcard etkin olduğunda dashboard'da gösterilen çalışma zamanı uyarısını açıklar.

**Doğruluğun kaynağı:** `src/server/cors/origins.ts` (`resolveAllowedOrigin`, `applyCorsHeaders`, `getCorsStatus`). İzin listesi middleware'de (`src/server/authz/pipeline.ts`) yalnızca bir kez uygulanır — her route'a özgü handler'lar `Access-Control-Allow-Origin` değerini kendileri ayarlamaz.

## Bir origin nasıl çözümlenir?

Middleware, her istek için `Access-Control-Allow-Origin` değerini şu sırayla hesaplar:

1. **`CORS_ALLOW_ALL=true`** (veya eski `CORS_ORIGIN=*`) → çağrıyı yapanın `Origin` değerini geri yansıtır (`Origin` header'ı yoksa `*`) ve cache'lerin doğru kalması için `Vary: Origin` ekler. Aynı `applyCorsHeaders()` kontrol noktası ayrıca token ile kimliği doğrulanan `/v1*`/`/v1beta*` yüzeyindeki gövdeli tüm 2xx yanıtlara `Vary: Accept-Encoding` ekler (`relaxForTokenAuth`, RFC 9110 §12.5.5, issue #6737); böylece sonraki katmandaki/paylaşılan cache'ler sıkıştırılmış ve sıkıştırılmamış varyantları doğru şekilde ayırt edebilir.
2. Aksi takdirde isteğin `Origin` değeri normalize edilir (küçük harfe dönüştürülür, sondaki eğik çizgi kaldırılır) ve **birleştirilmiş izin listesiyle** eşleştirilir:
   - env **`CORS_ALLOWED_ORIGINS`** — virgülle ayrılmış liste ve
   - `src/lib/config/runtimeSettings.ts` içindeki `setRuntimeAllowedOrigins()` aracılığıyla enjekte edilen çalışma zamanı **`corsOrigins`** ayarı (Dashboard → Security → _CORS Allowed Origins_).
3. Eşleşme yoksa → **`Access-Control-Allow-Origin` header'ı gönderilmez**. Tarayıcı, origin'ler arası okumayı engeller. Bu, erişimi varsayılan olarak reddeden, amaçlanan davranıştır.

| Env değişkeni          | Anlamı                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `CORS_ALLOWED_ORIGINS` | İzin verilecek tam origin'lerin CSV listesi (önerilir).                              |
| `CORS_ALLOW_ALL`       | `true`/`1` → herhangi bir origin'i geri yansıt (wildcard). Yalnızca geliştirme için. |
| `CORS_ORIGIN`          | Eski. `*`, `CORS_ALLOW_ALL` gibi davranır; tek bir değer izin listesine eklenir.     |

## Tehdit modeli — `CORS_ALLOW_ALL=true` gerçekte neleri erişime açar?

Genel OWASP uyarısını ("wildcard CORS = herhangi bir site API'nizi çağırabilir") ciddiye almak gerekir; ancak somut bir uygulama ayrıntısı nedeniyle Pusula'un maruz kaldığı risk **genel duruma göre daha sınırlıdır**:

> **Merkezi `applyCorsHeaders()` hiçbir zaman
> `Access-Control-Allow-Credentials` göndermez.** Sunucu
> `Access-Control-Allow-Credentials: true` göndermediği sürece tarayıcı, _kimlik
> bilgileri içeren_ (cookie taşıyan) origin'ler arası bir yanıtı erişime açmaz.
> Pusula'un paylaşılan CORS yolu bunu hiçbir zaman yapmaz.

`CORS_ALLOW_ALL=true` kullanıldığında bile bunun her yüzey için anlamı şöyledir:

| Yüzey                                       | Kimlik doğrulama mekanizması | Wildcard CORS'un etkisi                                                                                                                                                                                                                                        |
| ------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard / MANAGEMENT `/api/*`             | Cookie session               | Origin geri yansıtılır; ancak **`Allow-Credentials` olmadan** tarayıcı, kimlik bilgileri içeren okumayı **engeller**. Kötü amaçlı, origin'ler arası bir site kimliği doğrulanmış dashboard yanıtlarınızı **okuyamaz** ve session cookie'si açığa çıkmaz.       |
| Client API `/v1/*`, `/v1beta/*`             | Bearer / `x-api-key` header  | Zaten **tasarım gereği** izin vericidir (`relaxForTokenAuth`): tarayıcılar `Authorization`/`x-api-key` değerini hiçbir zaman otomatik olarak eklemez, dolayısıyla saldırganın sayfası anahtarınızı sağlayamaz. `CORS_ALLOW_ALL` bunu daha geniş hâle getirmez. |
| Herkese açık salt okunur (`/api/health`, …) | Yok                          | Hassas değildir; wildcard zararsızdır.                                                                                                                                                                                                                         |

Dolayısıyla `CORS_ALLOW_ALL=true` ayarından kaynaklanan **artık** risk şunlarla sınırlıdır: (a) zaten kimlik doğrulaması gerektirmeyen verilerin, kimlik bilgileri içermeyen origin'ler arası **okumaları** ve (b) yönetim route'larında CORS **preflight isteğinin geçmesine** izin verilmesi — bu route'lar yine de origin'ler arası bir sayfanın sağlayamayacağı kimlik doğrulamasını gerektirir. Paylaşılan CORS yolunda bu, bir session ele geçirme veya kimlik bilgisi çalma vektörü **değildir**.

### Gerçek bir istisna — `/api/v1/agents/`

Cloud-Agent route'ları (`/api/v1/agents/{health,credentials,tasks,tasks/[id]}`) **kendi** CORS header'larını ayarlar (`src/lib/cloudAgent/api.ts`, `getCloudAgentCorsHeaders`) ve `Access-Control-Allow-Origin: <origin>|*` ile birlikte `Access-Control-Allow-Credentials: true` değerini **gönderir**. Bu, origin yansıtma ile kimlik bilgilerinin bir arada bulunduğu tek yüzeydir ve **`CORS_ALLOW_ALL` ayarından bağımsızdır**. Bu route'larda yönetim kimlik doğrulaması kullanılır (`requireManagementAuth`); dashboard'u host dışından erişime açan operatörler, yanıt header'larının origin'ler arası ve kimlik bilgileri içeren bir okumaya izin verdiği tek yerin burası olduğunu bilmelidir. Bunun açık bir izin listesiyle sınırlandırılması, bu CORS kılavuzundan ayrı olarak takip edilmektedir.

## Üretim kontrol listesi

- **Üretimde asla `CORS_ALLOW_ALL=true` ayarlamayın.** Ayarlanmamış olarak bırakın.
- **Açık** bir origin listesi ayarlayın — ortam değişkenini veya Güvenlik sekmesindeki alanı kullanın:

  ```bash
  CORS_ALLOWED_ORIGINS="https://app.example.com, https://admin.example.com"
  ```

- Pusula bir ters proxy / tünel (nginx, Caddy, Cloudflare
  Tunnel, Tailscale) arkasında çalışıyorsa CORS **tek** denetiminiz değildir —
  loopback rota koruması, işlem başlatabilen rotaları korumaya devam eder (bkz.
  [ROUTE_GUARD_TIERS](./ROUTE_GUARD_TIERS.md)). Bir 403 hatasını "düzeltmek" için
  `X-Forwarded-For: 127.0.0.1` sahteciliği yapmayın; bu, rota korumasının kapattığı
  RCE sınıfını yeniden açar.
- Çalışma zamanı durumunu doğrulayın: `CORS_ALLOW_ALL=true` etkin olduğunda,
  kontrol panelinde Kontrol Paneli → Güvenlik → Yetkilendirme Envanteri altında
  **kalıcı sarı bir banner** gösterilir ve `/api/settings/authz-inventory`,
  izleme araçlarının sorgulayabileceği bir `cors: { allowAll, allowedOrigins }`
  zarfı döndürür.

## Geliştirme kolaylığı — belirli yerel origin'lere izin verme

Geliştirme ortamında bile joker karaktere nadiren ihtiyaç duyarsınız. Yalnızca
kullandığınız geliştirme sunucularına izin verin:

```bash
# Yerel bir Pusula'u çağıran Vite (5173) + Next.js (3000) geliştirme sunucuları
CORS_ALLOWED_ORIGINS="http://localhost:5173, http://localhost:3000"
```

Origin'ler, sondaki eğik çizgi yok sayılarak büyük/küçük harfe duyarsız biçimde
eşleştirilir; dolayısıyla `http://localhost:3000` ile
`http://localhost:3000/` eşdeğerdir. Aynı CSV, yeniden başlatma gerekmeden çalışma
zamanında **Kontrol Paneli → Güvenlik → İzin Verilen CORS Origin'leri** bölümünden
ayarlanabilir.

## API anahtarları ile çerez oturumlarının karşılaştırması

- **Bearer / `x-api-key` (`/v1/*` çıkarım yüzeyi):** tarayıcılar bunları hiçbir
  zaman otomatik olarak eklemez. CORS burada anlamlı bir engel değildir — engel
  API anahtarıdır — bu nedenle söz konusu yüzey, tarayıcı ve Electron
  istemcilerinin zaten erişim hakkına sahip oldukları yanıtları okuyabilmesi için
  bilinçli olarak izin verici tutulur.
- **Çerez oturumu (kontrol paneli):** güvenli biçimde kapalı varsayılan ayar
  **ve** paylaşılan yolda `Access-Control-Allow-Credentials` bulunmamasıyla
  korunur. Yönetim/kontrol paneli origin'lerini izin verici yapılandırmalardan
  uzak tutun; bunlar kesinlikle güvenli biçimde kapalı kalmalıdır.

## Örnek: Pusula'un önündeki ters proxy

CORS, Pusula'un kendisi tarafından uygulanır; bu nedenle proxy genel olarak
`Access-Control-*` üst bilgileri eklememeli veya yeniden yazmamalıdır (çift üst
bilgiler tarayıcılarda sorunlara yol açar). TLS'yi sonlandırıp iletin —
ön kontrol isteğini Pusula'un yanıtlamasına izin verin:

```nginx
# nginx — Pusula'a ilet; buraya Access-Control-* ekleme
location / {
    proxy_pass http://127.0.0.1:20128;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    # X-Forwarded-For değerini 127.0.0.1 olarak ayarlama — bu, loopback rota korumasını etkisiz hâle getirir.
}
```

İzin verilen tarayıcı origin'lerini proxy'de değil, Pusula'ta
(`CORS_ALLOWED_ORIGINS` veya Güvenlik sekmesi) ayarlayın.

## Kaynak dosyalar

| Konu                                                        | Dosya                                                                |
| ----------------------------------------------------------- | -------------------------------------------------------------------- |
| İzin verilenler listesinin çözümlenmesi + `getCorsStatus()` | `src/server/cors/origins.ts`                                         |
| Ara yazılım uygulaması (tek doğruluk kaynağı)               | `src/server/authz/pipeline.ts`                                       |
| Ayarlar → çalışma zamanı origin ekleme                      | `src/lib/config/runtimeSettings.ts`                                  |
| Kontrol paneli için çalışma zamanı durumu                   | `src/app/api/settings/authz-inventory/route.ts`                      |
| Kontrol paneli uyarı banner'ı                               | `src/app/(dashboard)/dashboard/settings/components/AuthzSection.tsx` |
| İzin Verilen CORS Origin'leri alanı                         | `src/app/(dashboard)/dashboard/settings/components/SecurityTab.tsx`  |
| Cloud-Agent rota başına CORS (istisna)                      | `src/lib/cloudAgent/api.ts`                                          |

## Ayrıca bakınız

- [Rota Koruması Katmanları](./ROUTE_GUARD_TIERS.md) — süreç başlatabilen rotalar için
  loopback zorlaması (ayrı, tamamlayıcı bir denetim).
- [Yetkilendirme Kılavuzu](../architecture/AUTHZ_GUIDE.md) — tam kimlik doğrulama hattı.
