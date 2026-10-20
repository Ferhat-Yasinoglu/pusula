# Provider Plugin Manifest (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/PROVIDER_PLUGIN_MANIFEST.md) · 🇩🇪 [de](../../../de/docs/reference/PROVIDER_PLUGIN_MANIFEST.md) · 🇮🇷 [fa](../../../fa/docs/reference/PROVIDER_PLUGIN_MANIFEST.md)

---

`open-sse/config/providerPluginManifest.ts`, JSON açısından güvenli sağlayıcı
eklenti sözleşmesini tanımlar. `open-sse/config/providerPluginManifestRegistry.ts`, bu
sözleşmeyi Bifrost, CLIProxyAPI veya gelecekteki bir Go/Rust yönlendiricisi gibi yan süreçler
için mevcut sağlayıcı kayıt defterine bağlar. TypeScript kayıt defteri doğruluk kaynağı
olmaya devam eder, ancak yan süreçler yürütücü kodunu, OAuth varsayılanlarını, başlıkları
veya süreç ortamı durumunu içe aktarmadan manifesti kullanabilir.

Aynı manifest, süreç dışında çalışan yan süreçler için HTTP üzerinden
`GET /api/v1/provider-plugin-manifest` adresinde de kullanılabilir.

Pusula, bu URL'yi Bifrost ve CLIProxyAPI'ye
`X-Pusula-Provider-Manifest-Url` istek başlığı aracılığıyla bildirir. Yan süreç,
yerel istek kaynağı yerine genel veya konteyner ağına ait bir URL'ye ihtiyaç duyduğunda
`PUSULA_PROVIDER_MANIFEST_URL` değerini ayarlayın.

## Manifesti Yenileme

HTTP uç noktası `Cache-Control: public, max-age=60` ve güçlü bir
`ETag` döndürür. Bir yan süreç, doğrulanmış son manifesti saklamalı ve yenileme
sırasında onun ETag değerini `If-None-Match` içinde göndermelidir. `304 Not Modified`
yanıtının gövdesi yoktur; yan süreç önbelleğe alınmış manifestini kullanmaya devam eder.
Doğrulanmış, önbelleğe alınmış bir manifest yoksa yan süreç, bir `304` yanıtını kabul
etmek yerine koşulsuz bir istek göndermelidir.

## Hedef

Sağlayıcı meta verilerini bir eklenti sözleşmesine doğru taşıyarak yoğun istek yolunun
ileride daha düşük gecikmeli bir yan süreç tarafından yönetilebilmesini sağlarken,
Pusula'un TypeScript rotasını ilke kapısı ve geri dönüş mekanizması olarak
korumasını sağlamak. Manifest eklemelidir: istek yönlendirmesini kendi başına
değiştirmez.

## Sözleşme

Manifest şunları içerir:

- sağlayıcı kimliği ve takma adı
- yukarı akış biçimi ve yürütücü adı
- kimlik doğrulama türü, kimlik doğrulama başlığı ve isteğe bağlı kimlik doğrulama ön eki
- statik uç nokta meta verileri
- yan süreç uygunluğu ve bir sağlayıcının TS üzerinde kalması gerektiği durumlarda açık nedenler
- bağlam uzunluğu, görüntü/akıl yürütme bayrakları ve desteklenmeyen parametreler gibi
  JSON açısından güvenli model meta verileri
- `apikey`, `oauth`, `custom-executor`,
  `passthrough-models`, `responses`, `sidecar-candidate`, `usage-fetch` ve `usage-supported` dahil olmak üzere yetenek etiketleri

Manifest kasıtlı olarak şunları hariç tutar:

- OAuth istemci gizli anahtarları ve varsayılan gizli değerler
- çalışma zamanı ortam çözümlemesi
- istek başlıkları ve genel kimlik bilgisi yardımcıları
- dinamik URL oluşturucuları
- yürütücü işlevleri
- oturum havuzu iç bileşenleri

## Yetenek Etiketleri

`capabilities`, kayıt defteri girdisinden türetilen, sıralanmış bir etiket dizisidir. Entegrasyon
geliştiricileri, TypeScript kaynaklarını yeniden okumak yerine bunu "bu sağlayıcı ne yapabilir"
sorusunun makine tarafından okunabilir yanıtı olarak ele almalıdır.

| Etiket               | Anlamı                                                                                |
| -------------------- | ------------------------------------------------------------------------------------- |
| `apikey`             | Bir API anahtarını kabul eder (`authType`, `apikey` veya `optional` değerindedir).    |
| `oauth`              | Bir OAuth veya oturum akışı kullanır.                                                 |
| `responses`          | Bir OpenAI Responses-API temel URL'si sunar.                                          |
| `passthrough-models` | Modelleri statik bir katalog yerine doğrudan yukarı akıştan sunar.                    |
| `custom-executor`    | Varsayılan olmayan bir yürütücü çalıştırır, bu nedenle TypeScript yolunda kalır.      |
| `sidecar-candidate`  | `sidecar.eligible` değerini yansıtır — yan sürece aktarma için değerlendirilebilir.   |
| `usage-fetch`        | Yapılandırılmış bir kullanım veya kota getiricisine (`getUsageForProvider`) sahiptir. |
| `usage-supported`    | Kullanım API'si bu sağlayıcıyı kabul eder (`isSupportedUsageConnection`).             |

`usage-fetch` yalnızca keşif amaçlıdır. Pusula'un sağlayıcı için kullanımı nasıl okuyacağını
bildiğini belirtir; getirmeyi etkinleştirmez, kota anlamlarını değiştirmez veya
sağlayıcı için Dashboard kota bileşeninin etkin olduğunu ima etmez — bu bileşen ayrıca
`USAGE_SUPPORTED_PROVIDERS` tarafından denetlenir. Doğruluk kaynağı,
`open-sse/services/usage/fetcherProviders.ts` içindeki `USAGE_FETCHER_PROVIDERS` değeridir.

Bu liste, kullanım dağıtıcısının kabul ettiği dizgelerle anahtarlanır; dolayısıyla kanonik kimlikleri
takma adlarla birlikte içerir ve etiketlenmiş sağlayıcıların sayısından biraz daha uzundur: manifest
kayıt defterinde sohbet sağlayıcısı olmayan girdiler (örneğin `firecrawl` arama sağlayıcısı
ve `amazon-q` ACP sağlayıcısı), etiketlenecek bir manifest girdisine sahip değildir.

`usage-supported`, sunucu ve Dashboard kullanım rotalarının sağlayıcıya ait bir bağlantıyı
kabul edip etmediğini belirtir. Her ikisi de
`USAGE_SUPPORTED_PROVIDERS` (`open-sse/services/usage/supportedProviders.ts`) tarafından
denetlenen `isSupportedUsageConnection()` (`src/lib/usage/providerLimits.ts`)
ve `supportsProviderQuota()` (`src/shared/utils/providerQuotaVisibility.ts`) işlevlerini
yansıtır. `usage-fetch` etiketinden farklı olarak yalnızca sağlayıcı kimliği üzerinde oluşturulur
— çalışma zamanı koruması, takma ad çözümlemesi olmadan
`USAGE_SUPPORTED_PROVIDERS.includes(providerId)` işlemini gerçekleştirir; dolayısıyla manifest
aynı kuralı korur. İki etiketin kapsamları farklıdır: 3 sağlayıcı yalnızca
`usage-fetch` (`opencode`, `opencode-zen`, `xai`) etiketini, 1 sağlayıcı ise yalnızca
`usage-supported` (`xiaomi-mimo-token-plan`) etiketini taşır; bu nedenle biri diğerini
ima etmez.

## Sidecar Kullanımı

Sidecar'lar `sidecar.eligible` değerini koşulsuz bir yönlendirme kararı olarak değil, ihtiyatlı bir aday sinyali olarak değerlendirmelidir. İlk içe aktarma hedefi, varsayılan yürütücüyü kullanan API anahtarı/statik uç nokta sağlayıcıları olmalıdır. Özel web yürütücülerine, OAuth/oturum akışlarına, dinamik URL oluşturucularına veya havuz yapılandırmasına sahip sağlayıcılar; bir sidecar eşdeğer davranışı uygulayana ve telemetri eşdeğerliği kanıtlayana kadar TypeScript geri dönüş yolunda kalmalıdır.

Önerilen geçiş aşamaları:

1. Sağlayıcı eklenti manifestini TS kayıt defterinden oluşturun ve doğrulayın.
2. Bifrost veya CLIProxyAPI'ye API anahtarı/statik sağlayıcılar için manifesti içe aktarmayı öğretin.
3. TS geri dönüşünü etkin tutarken uygun sağlayıcıları `PUSULA_RELAY_BACKEND` arkasındaki sidecar üzerinden yönlendirin.
4. Sağlayıcıları yalnızca başarı oranı, p99 gecikmesi, akış davranışı ve desteklenmeyen parametrelerin işlenmesi TS yoluyla eşleştiğinde yükseltin.
5. Özel yürütücüler için her seferinde bir sağlayıcı ailesi olacak şekilde sidecar'a özgü eklentiler ekleyin.

## Sağlayıcılar Neden Doğrudan Next'e Gömülmemeli?

Next ön ucu, sağlayıcı yürütmesinin sahibi olmamalıdır. API sınırını çağırmalıdır. Ardından arka uç; TypeScript yürütücüsünü, Bifrost'u, CLIProxyAPI'yi veya gelecekteki yerel bir sidecar'ı kullanıp kullanmayacağına karar verebilir. Bu yaklaşım, herhangi bir sidecar devrinden önce istek imzalama, izin listesi kontrolleri, DB politikası ve geri dönüş davranışını merkezî hâlde tutar.
