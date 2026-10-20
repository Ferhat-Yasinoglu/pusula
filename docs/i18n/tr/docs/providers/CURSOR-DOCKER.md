# Cursor Provider in Docker Environments (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CURSOR-DOCKER.md) · 🇩🇪 [de](../../../de/docs/providers/CURSOR-DOCKER.md) · 🇮🇷 [fa](../../../fa/docs/providers/CURSOR-DOCKER.md)

---

Pusula Docker içinde çalıştığında, container ana makinedeki Cursor
kurulumunu göremediği için eski **Cursor IDE'den İçe Aktar** /
`cursor-agent` akışları başarısız olur. Bunun yerine **Cursor ile Oturum Aç**
(deep-control PKCE) seçeneğini kullanın.

## IDE / CLI İçe Aktarma Docker'da Neden Başarısız Olur?

1. **Dosya sistemi yalıtımı** — Otomatik içe aktarma, container _içinde_
   `~/.config/Cursor/User/globalStorage/state.vscdb` gibi Linux yollarını arar.
   macOS için Docker Desktop'ta ana makinenin IDE veritabanı varsayılan olarak
   bağlanmaz ve ana makine Darwin olsa bile container işletim sistemi Linux'tur.
2. **`cursor-agent` ikili dosyası yok** — Resmî Pusula imajları
   `cursor-agent` içermez. Kullanılabilir Modeller daha önce
   `cursor-agent --list-models` komutunu çalıştırıyor ve başarısız olduğunda
   statik bir kataloğa geri dönüyordu.
3. **Yanlış ikili dosya** — macOS için bir `cursor-agent` ikili dosyasını Linux
   container'a bind-mount ile bağlamayın. Çalışmayacaktır.

## Önerilen: Cursor ile Oturum Açma

1. **Kontrol Paneli → Sağlayıcılar → Cursor** bölümünü açın.
2. **Cursor ile Oturum Aç** sekmesini seçin.
3. **Cursor ile Oturum Aç** düğmesine tıklayın — Pusula, **ana makine**
   tarayıcınızda `https://cursor.com/loginDeepControl?…` adresini açar.
4. Tarayıcıda oturum açmayı onaylayın, ardından kontrol paneline dönün. Pusula,
   token'lar gelene kadar `api2.cursor.sh/auth/poll` uç noktasını sorgular.
5. Pusula, **erişim + yenileme** token'larını saklar ve bunları
   `https://api2.cursor.sh/auth/exchange_user_api_key` üzerinden yeniler.

Bu yöntem, container içinde Cursor IDE veya `cursor-agent` bulunmasını gerektirmez.

## Model keşfi

Oturum açılmış bir bağlantı olduğunda **Kullanılabilir Modeller / Otomatik
Senkronizasyon**, bağlantının bearer token'ını kullanarak Cursor'ın HTTP
`AiService/AvailableModels` kataloğunu tercih eder. Bu başarısız olursa Pusula,
ana makinedeki `cursor-agent` aracını (mevcutsa), ardından statik kayıt defteri
başlangıç verilerini dener.

Pusula katalogda her zaman **`auto`** seçeneğini (görünen adı “Auto”) ve
OpenCodex tarzı yönlendirici modları olan **`auto-cost`**, **`auto-balance`** ve
**`auto-intelligence`** seçeneklerini sunar. İletim sırasında bunlar, Cursor'ın
`default` modeline eşlenir (üç varyant için bir `optimization` ModelParameter
ile). Premium modellerin kullanım hakkı tükendiğinde `cu/auto` seçeneğini tercih
edin — Auto için çoğu zaman hâlâ bütçe bulunur.

### Senkronize edildiğinde canlı katalog özeldir

Başarılı bir Cursor model senkronizasyonundan sonra (`cursor-agent --list-models`
→ kalıcı senkronize katalog veya yukarıdaki bearer kimlik doğrulamalı
`AvailableModels` isteği) **kontrol paneli**, **`/v1/models`** ve **Tümünü Test
Et** şunları listeler:

1. Canlı senkronizasyon tarafından döndürülen modeller
2. Eklenen otomatik yönlendirici kimlikleri: `auto`, `auto-cost`, `auto-balance`, `auto-intelligence`
3. Operatörün **özel** modelleri (İçe Aktarma / manuel) — senkronizasyon tarafından hiçbir zaman kaldırılmaz

`open-sse/config/providers/registry/cursor/` altındaki büyük statik kayıt defteri
**yalnızca çevrimdışı geri dönüş içindir**. Senkronize katalog boş olduğunda
(veya keşif başarısız olduğunda) listeleme bu kayıt defterine geri döner.

Efor sonekli kimlikler (örneğin `claude-4.6-sonnet-high`) çalışma zamanında yine
de **istenebilir**: `resolveRequestedModel`, soneki kaldırarak bir iletim
`ModelParameter` değerine dönüştürür. Özel listeleme, testlerin Cursor'ın gerçekten
kullanılabilir olarak döndürdüğü modellerle eşleşmesi için bu statik varyantları
Tümünü Test Et listesinden kasıtlı olarak gizler.

### Yardımcılar

- `providerUsesExclusiveSyncedListing("cursor"|"cu")` —
  `src/lib/providers/modelListingCapability.ts`
- `mergeProviderModelListing` — kontrol paneli birleştirmesi
- `ensureCursorAutoCatalogEntry` — keşif ve listeleme sırasında auto* ekleme
- `shouldSuppressStaticModelForExclusiveListing` — `/v1/models` statik döngüsü

## Sağlayıcı Sınırları (kota)

Cursor için **Kullanım → Sağlayıcı Sınırları**, PKCE veya token içe aktarma
işleminden sonra `api2.cursor.sh` üzerindeki Bearer API'lerini
(`GetCurrentPeriodUsage` → kullanım özeti → auth/usage) kullanır. Eski
cookie/`cursor.com` kontrol paneli yolu, eski IDE'den içe aktarılmış oturumlar
için son geri dönüş seçeneği olarak kalır.

Pencereler genellikle **Toplam**, **Auto + Composer** ve **API** bölümlerini
içerir. Sınırlar boş görünüyorsa **Cursor ile Oturum Aç** işlemini yeniden
gerçekleştirin veya token'ları yeniden içe aktarın (artık yalnızca IDE'den içe
aktarma gerekli değildir).

## Boş yanıtlar / kullanım hakkının tükenmesi

Cursor bir Run isteğini kabul edip hiçbir asistan metni döndürmediğinde (premium
kullanım hakkı tükendiğinde sık görülür), Pusula yalnızca “Sağlayıcı boş içerik
döndürdü” mesajı yerine, işlem yapılabilir bir **429** (kota ipuçlarıyla) veya
yönlendirme içeren bir **502** hatası gösterir. `not_found: AI Model Not Found`
(kullanım aralığı tükendi) gibi akış hataları **Cursor hız sınırı / kullanım
aşıldı** olarak sınıflandırılır ve bu mesaj SSE işlem hattı boyunca korunur
(paylaşılan boş akış koruması, daha önce yayımlanmış bir hatanın üzerine yazmaz).
Sağlayıcı Sınırları'nı kontrol edin, **`auto`** modelini deneyin veya Cursor plan
sınırlarını yükseltin.

## İstemci sürümü (başsız)

Yerel bir `cursor-agent` kurulumu olmadan Pusula, `x-cursor-client-version`
değerini önce `CURSOR_AGENT_CLI_VERSION` ortam değişkeninden, ardından Cursor
yükleyici betiğinin diskte önbelleğe alınmış taramasından ve son olarak sabitlenmiş
bir derleme kimliğinden çözümler. Gerektiğinde `CURSOR_AGENT_CLI_VERSION` ile
geçersiz kılın.

## Geri Dönüş: Manuel Token İçe Aktarma

Tarayıcı üzerinden oturum açmayı tamamlayamıyorsanız:

1. Ana makinede token'ları Cursor'ın `state.vscdb` dosyasından çıkarın:

   ```bash
   sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
     "SELECT key, value FROM ItemTable WHERE key IN ('cursorAuth/accessToken','cursorAuth/refreshToken','storage.serviceMachineId');"
   ```

2. Cursor kimlik doğrulama penceresinde **Token içe aktar** seçeneğini açın.
3. **Erişim Token'ı** ve mevcutsa **Yenileme Token'ı** değerlerini yapıştırın
   (otomatik yenileme için gereklidir). Makine kimliği isteğe bağlıdır.

Yalnızca erişim token'ı içeren aktarımlar çalışmaya devam eder ancak yenileme
token'ı olmadan süreleri dolar — sohbet kimlik doğrulama hataları döndürdüğünde
yeniden içe aktarın.

## İlgili

- Zed Docker rehberi: [`docs/providers/ZED-DOCKER.md`](./ZED-DOCKER.md)
- OpenCodex Cursor oturum açma referansı (harici):
  https://github.com/lidge-jun/opencodex/blob/main/src/oauth/cursor.ts
