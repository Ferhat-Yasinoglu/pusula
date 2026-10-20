# Cursor API provider and the Cursor CLI passthrough (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CURSOR-API-KEY-AND-CLI.md) · 🇩🇪 [de](../../../de/docs/providers/CURSOR-API-KEY-AND-CLI.md) · 🇮🇷 [fa](../../../fa/docs/providers/CURSOR-API-KEY-AND-CLI.md)

---

IDE oturumu olmadan Cursor'ı Pusula arkasına yerleştirmenin iki yolu:

1. **`cursor-api` sağlayıcısı** ("Cursor API" kartı, `cua` diğer adı): Cursor kullanıcı API anahtarını (`crsr_…`, `https://cursor.com/dashboard/api` adresinde oluşturulur) saklayan bir API anahtarı sağlayıcısıdır. Böylece herhangi bir Pusula istemcisi, standart kota, yedek sağlayıcı ve günlükleme katmanlarıyla Cursor modellerine `/v1/chat/completions` üzerinden `cursor-api/<model>` veya `cua/<model>` olarak erişebilir. IDE sağlayıcısı (`cursor`, OAuth/IDE oturumu) değişmemiştir.
2. **Cursor CLI doğrudan geçişi**: Cursor CLI'ı (`agent`) Pusula'a yönlendirin; böylece CLI'ın yaptığı her RPC çağrısı bir Pusula API anahtarıyla doğrulanır, bir `cursor-api` bağlantısının kimlik bilgileriyle Cursor'a iletilir ve Günlükler sayfasına kaydedilir.

## Anahtar neden takas edilir?

`api2.cursor.sh`, ham bir `crsr_…` anahtarını Bearer belirteci olarak reddeder (401). Cursor CLI, anahtarı önce `/auth/exchange_user_api_key` uç noktasına POST eder ve bir saat sonra süresi dolan bir oturum JWT'si alır; döndürülen `refreshToken` aynı `exp` değerini taşıdığından yenileme işlemi, anahtarın yeniden takas edilmesi anlamına gelir.
`open-sse/services/cursorApiKeyAuth.ts` bu takası gerçekleştirir, anahtar başına bir oturum belirtecini önbelleğe alır, sona erme süresinden beş dakika önce yeniden takas eder ve Cursor 401 yanıtı verdiğinde önbelleğe alınmış belirteci siler. `CursorExecutor`, `cursor-api` bağlantıları için üst akış akışını açmadan hemen önce bunu çağırır.

## `cursor-api` sağlayıcısı

Kayıt defteri: `open-sse/config/providers/registry/cursor/index.ts`
(`cursor_apiProvider`, `authType: "apikey"`, `cursor` ile aynı `format`, `baseUrl` ve
`models`). Katalog kartı:
`src/shared/constants/providers/apikey/specialty-media.ts`. Yürütücü eşlemesi:
`open-sse/executors/index.ts` (`"cursor-api"` / `cua` →
`new CursorExecutor("cursor-api")`).

Kontrol paneli: Sağlayıcılar → Cursor API → API anahtarı ekle.

REST:

```bash
curl -sS -X POST http://localhost:20128/api/providers \
  -H "Content-Type: application/json" \
  -d '{"provider":"cursor-api","name":"cursor-api-key","apiKey":"crsr_…","priority":1}'
```

Ardından:

```bash
curl -sS http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer <pusula-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor-api/auto","messages":[{"role":"user","content":"say PONG"}]}'
```

Notlar:

- `cursor-api` için model listesi, statik Cursor kayıt defterinden gelir (IDE sağlayıcısının yedek olarak kullandığı listeyle aynıdır); Pusula ana makinesine `cursor-agent` kurulması gerekmez.
- `POST /api/providers/{id}/refresh-cursor` yalnızca `cursor` IDE sağlayıcısı içindir; `cursor-api` bağlantılarının yenilenecek bir IDE oturumu yoktur.

## Yerel model kimlikleri ve efor

`cursor` / `cu` ve `cursor-api` / `cua` için paylaşılan Claude efor normalleştiricisi, istenen model kimliğini olduğu gibi bırakır. Cursor, `-low` gibi bir son eki Pusula efor diğer adı olarak değil, gerçek bir model kimliğinin parçası olarak yayımlayabilir.
Cursor yürütücüsü, canlı katalogdaki tam eşleşmeyi korur; eşleşme olmadığında, mevcut model çözümleyicisi son ekten parametreye geri dönüş işlemini yönetir.

Bu, doğrudan Claude, Claude uyumlu veya Vertex rotaları için efor normalleştirmesini değiştirmez. Kullanılabilirlik yine de seçilen Cursor hesabının kataloğuna ve yetkilerine bağlıdır.

## Cursor CLI doğrudan geçişi

Rota: `src/app/api/cursor-cli/[...path]/route.ts` →
`open-sse/handlers/cursorCliProxy.ts`. `/api/cursor-cli/` öneki,
işleyici kendi kimlik doğrulamasını uyguladığı için
`src/shared/constants/publicApiRoutes.ts` içinde kayıtlıdır:

| Yol                                                                                                                          | CLI'dan beklenen kimlik doğrulaması | Pusula'un yaptığı                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /auth/exchange_user_api_key`                                                                                           | `Bearer <Pusula API key>`        | Anahtarı doğrular, 1 saatlik bir HS256 JWT (`JWT_SECRET` ile imzalanmış) oluşturur ve döndürür                                                                                               |
| diğer tüm yollar (`/aiserver.v1.*`, `/agent.v1.AgentService/RunSSE`, `/aiserver.v1.BidiService/BidiAppend`, `/v1/traces`, …) | `Bearer <that JWT>`                 | Veren/hedef kitle/süre sonu bilgilerini doğrular, etkin bir `cursor-api` bağlantısı seçer, Authorization başlığını takas edilmiş Cursor belirteciyle değiştirir ve yanıtı akışla geri iletir |

CLI, aldığı herhangi bir belirteçten `exp` değerini çözümler; bu nedenle ona opak
bir belirteç vermek, neredeyse her istekten önce yeniden takas yapmasına neden
olur. Oluşturulan JWT bunu önler. Pusula'tan gelen bir 401 yanıtı, CLI'ın
yeniden takas yapmasını sağlar.

### Kurulum

1. Bir Pusula API anahtarı (Dashboard → API keys) ve bir `cursor-api`
   bağlantısı oluşturun.
2. CLI'a agent akışı için HTTP/1.1 kullanmasını söyleyin.
   `~/.cursor/cli-config.json` içinde:

   ```json
   { "network": { "useHttp1ForAgent": true } }
   ```

   Bu ayar olmadan CLI, agent etkileşimini ayrı olarak yapılandırılmış bir agent
   sunucusuna HTTP/2 üzerinden açar ve yalnızca kontrol düzlemi RPC'leri uç nokta
   üzerinden geçer.

3. CLI'ı Pusula'a karşı çalıştırın:

   ```bash
   export CURSOR_API_ENDPOINT=http://localhost:20128/api/cursor-cli
   export CURSOR_API_KEY=<pusula-api-key>
   agent -p --trust "Reply with exactly OK"
   ```

Her geçiş Logs bölümünde sağlayıcı `cursor-api`, istek türü `cursor-cli`,
yol `/api/cursor-cli/<rpc>` olarak görünür ve ilgili Pusula API anahtarı ile
isteği sunan bağlantıya atfedilir.

### Hata durumları

| Durum                                                   | CLI'a verilen yanıt                                     |
| ------------------------------------------------------- | ------------------------------------------------------- |
| Bilinmeyen Pusula anahtarı ve `REQUIRE_API_KEY=true` | Takas sırasında 401 `unauthenticated`                   |
| `REQUIRE_API_KEY=false`                                 | anonim oturum (`/v1/*` davranışını yansıtır)            |
| Süresi dolmuş / yabancı / değiştirilmiş oturum JWT'si   | 401, CLI yeniden takas yapar                            |
| Pusula API anahtarının takastan sonra iptal edilmesi | Sonraki RPC'de 401                                      |
| Etkin `cursor-api` bağlantısının olmaması               | 503 `unavailable`                                       |
| Cursor'ın bağlantının anahtarını reddetmesi             | 401 `unauthenticated`, önbelleğe alınmış oturum silinir |
| Yukarı akışa erişilememesi                              | 502 `unavailable` (arındırılmış ileti)                  |
| `JWT_SECRET` ayarlanmamış                               | Takas sırasında 503                                     |
