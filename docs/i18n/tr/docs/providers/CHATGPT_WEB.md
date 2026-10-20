# Providers — ChatGPT Web (Codex) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CHATGPT_WEB.md) · 🇩🇪 [de](../../../de/docs/providers/CHATGPT_WEB.md) · 🇮🇷 [fa](../../../fa/docs/providers/CHATGPT_WEB.md)

---

`chatgpt-web-codex` (`cgpt-codex` diğer adıyla), kimliği doğrulanmış bir ChatGPT tarayıcı oturumu üzerinden Codex Responses turlarına köprü oluşturur. Kullanımdan kaldırılan ortak `chatgpt-web` sağlayıcısından bağımsızdır ve `open-sse/vendor/codex-chatgpt-web/` altındaki MIT bildirimi içeren uygulamayı kullanır; bu uygulama, upstream v4.0.7 commit'i `b59d7dc51b84fb1f465ff1d00f5207f3b2b4a494` üzerinden güncellenmiştir.

## Ortak sağlayıcının kullanımdan kaldırılması

Önceki ortak sağlayıcı kimlikleri `chatgpt-web` ve `cgpt-web`, pre-key/proof-of-work uygulamalarının kaynağı doğrulanamadığı için artık dağıtılmamaktadır. Eğik çizgi önekli model kimlikleri ve kalıcı diğer adlar dahil olmak üzere her iki kimliğe yönelik açık istekler, herhangi bir upstream isteğinden önce HTTP `410` ve **PROVIDER_RETIRED** koduyla kapalı biçimde başarısız olur.

`168_retire_chatgpt_web.sql` geçişi, eşleşen sağlayıcı bağlantılarını tombstone olarak işaretler ve etkin oturum kiralarını geçersiz kılar. Bağlantı geçmişini ve API anahtarı izin listelerini korur; izin listesine bunların yerine geçecek bir erişim eklemez. Codex sağlayıcısı ve bağlantıları bu kullanımdan kaldırma işlemiyle eşleştirilmez.

## Ön koşullar

- oturum açılmış bir ChatGPT oturumundan alınan tam Cookie üstbilgisi;
- npm, systemd ve PM2 kurulumları için Chrome veya Chromium ile grafiksel bir oturum ya da Xvfb ekranı;
- Docker `web` profiliyle birlikte `docker-compose.yml` dosyasındaki dahili Chromium hizmeti;
- yerel Codex araçları için OpenAI `tunnel-client` v0.0.13 ve bir ChatGPT özel bağlayıcısı.

Tünel yalnızca araç turları için gereklidir. `pro` dahil olmak üzere listelenen her rota, tünel ve bağlayıcı yapılandırıldığında aynı tura bağlı yerel araç yeteneğini kullanabilir.

## Pano kurulumu

1. **ChatGPT Web (Codex)** sağlayıcısını açın ve bir bağlantı ekleyin.
2. Tam ChatGPT Cookie üstbilgisini, tünel kimliğini, çalışma zamanı anahtarını ve özel bağlayıcı adını yapıştırın. Araç kullanabilen yeni kurulumlar, tam olarak `Pusula Codex v2` olarak adlandırılan yeni oluşturulmuş bir bağlayıcı kullanmalı; Authentication değeri None, Permissions değeri ise Allow all actions olarak ayarlanmalıdır.
3. Bağlantı kontrolünü çalıştırın. Pusula, tarayıcı destekli bir Temporary Chat açar ve hesap için Sol ile Pro'nun kullanılabilir olup olmadığını algılar.
4. Bağlantıyı kaydedin. Pusula, yapıştırılan cookie'yi doğrulanmış Playwright depolama durumuyla değiştirir ve şifrelenmiş kimlik bilgisi soyutlaması aracılığıyla çalışma zamanı anahtarıyla birlikte saklar.

Başarılı bir kaydetme işleminden sonra ham cookie tutulmaz. Oturumun süresi dolduğunda bağlantıyı açın, yeni bir tam Cookie üstbilgisi yapıştırın ve kontrolü yeniden çalıştırın. Düzenleme iletişim kutusundaki doctor durumu; tarayıcı, depolama durumu, oturum açma, Temporary Chat, tünel, bağlayıcı ve araç gidiş-dönüş durumlarını ayrı ayrı bildirir.

> Gerçek bir cookie'yi, çalışma zamanı anahtarını, depolama durumunu veya yetenek belirtecini asla commit etmeyin. Test ve
> dokümantasyon değerleri her zaman yer tutucu olmalıdır.

## Modeller ve kombinasyonlar

Sabit model rotaları şunlardır:

- `chatgpt-web-codex/luna` — GPT-5.6 Luna, düşük efor
- `chatgpt-web-codex/think` — GPT-5.6 Luna, orta düzey efor
- `chatgpt-web-codex/instant`
- `chatgpt-web-codex/medium`
- `chatgpt-web-codex/high`
- `chatgpt-web-codex/extra-high`
- `chatgpt-web-codex/pro`

Bunlardan birini diğer modeller gibi bir kombinasyona ekleyin. Codex uygulaması, kombinasyon adını normal Responses uç noktası olan `/v1/responses` adresine `model` olarak gönderir; ayrı bir Codex uç noktası veya mod anahtarı yoktur.

Free/Go hesapları Luna rotalarını sunar. Sol özelliğine sahip hesaplar Instant'tan High'a kadar olan rotaları, Pro özelliğine sahip hesaplar ise bunlara ek olarak Extra High ve Pro rotalarını sunar. Her rotanın sabit bir backend modeli ve akıl yürütme eforu vardır; çakışan açık bir Responses eforu, seçili tarayıcı modunu sessizce değiştirmek yerine kapalı biçimde başarısız olur.

Eski bir `Codex Native` veya `Pusula Codex` bağlayıcısını yeniden adlandırmayın ya da tekrar kullanmayın. ChatGPT, herkese açık MCP sözleşmesini bağlayıcı kimliğine göre önbelleğe alırken yenilenmiş köprü yeni bir doğrudan tur belirteci sözleşmesi kullanır. Çalışma zamanı bu eski kimlikleri reddeder ve yeni bir `Pusula Codex v2` bağlayıcısı gerektirir.

## Güvenlik modeli

- Yerel yol; bir Responses isteği, tanınan bir Codex istemcisi ve eşleşen iş parçacığı ile tur kimlikleri gerektirir.
- Çalışma alanı, sandbox, onay politikası ve araç kataloğu yerel Codex kabuğundan gelir; serbest biçimli istem metni bunlar üzerinde yetkili değildir.
- ChatGPT, tur başına yalnızca kısa ömürlü bir yetenek alır. MCP aracısı yalnızca Codex'in tam olarak o turda sunduğu araçları kabul eder.
- **Bir kez izin ver** seçeneğinin otomatik olarak onaylanması, araç isteğini yalnızca Codex'e geri gönderir. Onay ve yürütmeye yalnızca Codex karar verir.
- İlk çıktıdan önce bir kombinasyon, başka bir uyumlu hedefe geri dönebilir. Çıktı başladıktan sonra sağlayıcı, model, bağlantı ve tarayıcı turu, tur tamamlanana kadar sabit kalır.
- Çerezler, çalışma zamanı anahtarları, depolama durumu ve yetenek belirteçleri sağlayıcı yanıtlarında veya istek günlüklerinde görünmez.

## Ekransız VPS ve Docker

Pusula; npm, systemd ve PM2 kurulumlarında yaygın Chrome ve Chromium yollarını algılar.
Alternatif olarak `CHATGPT_WEB_CODEX_CHROME_PATH` değişkenini ayarlayın. Çalışma zamanı turları, ChatGPT gerçek başsız tarayıcı yapısını reddettiği için Chrome'u kasıtlı olarak arayüzlü modda kullanır. Bu nedenle ekransız bir ana makine, Pusula'u özel bir Xvfb ekranıyla çalıştırmalıdır; yalnızca Chrome yolunu ayarlamak ekran sağlamaz.

Docker `web` profili, dahili Compose ağında `chatgpt-web-codex-browser` bileşenini başlatır. Yardımcı konteyner, Chrome'u Xvfb içinde arayüzlü modda çalıştırdığından fiziksel bir ekran gerekmez. CDP portu ana makinede yayımlanmaz. Korumalı tarayıcı profili birimi, Pusula veri biriminden ayrıdır ve tarayıcıya yeterli paylaşımlı bellek sağlanır. Dahili CDP proxy'si yalnızca Compose ağı içindeki `9223` portunu dinler; Chrome, yardımcı konteynerde geri döngü arayüzüne bağlı kalır.

`DATA_DIR` altındaki bir gözetmen kiralaması, birden fazla Pusula işleminin aynı tünel ve aracı durumuna sahip olmasını önler. Bir çakışma, doctor tarafından bildirilir.

## Etkileşimli kurtarma

Otomatik Docker yolunda ana makinede görünür bir pencere yoktur, ancak Chrome özel Xvfb ekranı içinde arayüzlü modda çalışır. ChatGPT etkileşimli oturum açma veya doğrulama gerektirdiğinde, mevcut VNC tarayıcı altyapısı kurtarma için kullanılabilir. Tarayıcı kullanıcı arayüzü ve CDP yalnızca geri döngü, kimliği doğrulanmış bir yönetim bağlantısı veya SSH tüneli üzerinden erişilebilir durumda kalmalıdır; noVNC normal çalışma sırasında devre dışı kalır.

## WebSocket geri dönüşü

Bir kombinasyon ChatGPT Web (Codex) içerdiğinde, Responses WebSocket köprüsü üst akışa bağlanmadan önce HTTP/SSE geri dönüşünü talep eder. Aktarım daha sonra `/v1/responses` üzerinden gerçekleşir.

## Doğrulama

Kullanımdan kaldırılan sağlayıcıyı çağırmadan sağlayıcı denetimlerini çalıştırın:

```bash
node --import tsx/esm --test \\
  tests/unit/chatgpt-web-codex.test.ts \\
  tests/unit/chatgpt-web-codex-turn-pin.test.ts \\
  tests/unit/chatgpt-web-environment-double-unescape.test.ts
```

Kullanımdan kaldırma regresyon korumaları şuralarda bulunur:

- `tests/unit/chatgpt-web-retirement.test.ts`
- `tests/unit/chatgpt-web-runtime-block.test.ts`
- `tests/unit/chatgpt-web-image-handler-retirement.test.ts`
- `tests/unit/chatgpt-web-source-retirement.test.ts`
- `tests/unit/migration-168-retire-chatgpt-web.test.ts`
