# Free Tiers Guide: Understand and Combine Free AI Access (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/FREE-TIERS-GUIDE.md) · 🇩🇪 [de](../../../de/docs/getting-started/FREE-TIERS-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/FREE-TIERS-GUIDE.md)

---

> **Kısaca**: Uygun sağlayıcı hesaplarınızı kendiniz getirin. Pusula, yapılandırdığınız bağlantıları birleştirir; ilan edilen toplam token bütçesini kendisi sağlamaz. Ücretsiz erişim; kayıt, API anahtarı, onay veya ödeme yöntemi gerektirebilir. Sağlayıcı limitleri, gizlilik politikaları ve kullanım koşulları geçerliliğini korur.

---

## Ücretsiz Katmanlar Nedir?

Birçok yapay zekâ sağlayıcısı bir tür **ücretsiz erişim** sunar. Sağlayıcıya bağlı olarak bu; kimlik doğrulama gerektirmeyen bir uç nokta, yenilenen kota, hız sınırlı ancak kullanım kotası olmayan erişim, kayıt bonusu, manuel onay veya geçici bir promosyon anlamına gelebilir. Bazı seçenekler hesap, API anahtarı, kredi kartı, KYC veya sağlayıcıya özel koşulların kabul edilmesini gerektirir.

Pusula, yapılandırılmış bağlantıları tek bir uç noktada **birleştirir**. Hesap gerektiren her sağlayıcıya yine ayrı ayrı kaydolmanız gerekir. Bu hesapları bağlayın ve uygun hedefler arasında yönlendirme yapmak için `model: "auto"` kullanın. Yeni bir kurulumda anahtarsız uygun bir hedef bulunmayabilir; yalnızca Pusula'u kurmak, başarılı bir sohbet yanıtını garanti etmez.

---

## Temsili Ücretsiz Erişim Sağlayıcıları

### Yinelenen, Anahtarsız veya Sınırsız Erişim

Bu sağlayıcılar, denetlenen katalogda yinelenen, anahtarsız veya sınırsız bir ücretsiz erişim yoluna sahiptir. “Sınırsız”, yayımlanmış bir token üst sınırı olmadığı anlamına gelir; hız, eşzamanlılık, hesap, bölge ve politika sınırları yine de geçerli olabilir:

| Sağlayıcı         | Modeller                                                                                             | Kota                                                                                                                                                                          | Nasıl Bağlanılır                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| **Kiro AI**       | Claude Sonnet 4.5, Haiku 4.5, DeepSeek V3.2 ve diğerleri                                             | Denetlenen katalog, aylık 25K tokenlık paylaşımlı bir havuz öngörüyor                                                                                                         | OAuth/hesap akışı; ToS katalogda `avoid` olarak işaretlenmiştir                                   |
| **Pollinations**  | Mevcut anahtarsız model kümesi; bazı eski modeller kullanımdan kaldırılmış veya anahtar gerektiriyor | Anahtarsız; yayımlanmış token üst sınırı yok                                                                                                                                  | Anahtarsız modeller için sağlayıcı kimlik bilgisi gerekmez                                        |
| **Logfare**       | kimi-k3, deepseek-v4-pro, glm-5.2, gpt-5.6-luna, minimax-m3 ve daha fazlası                          | Ücretsiz API anahtarı (hız sınırı ve kart gereksinimi yok); araştırma amacıyla **her istek kaydedilir** (logfare.ai/consent adresinden kapsam dışında kalmayı seçebilirsiniz) | logfare.ai/register adresinden anında anahtar; ToS/gizlilik: logfare.ai/tos ve logfare.ai/privacy |
| **Cloudflare AI** | Workers AI kataloğu                                                                                  | Denetlenen havuz, yayımlanmış kullanım birimlerine göre aylık ~30M token öngörüyor                                                                                            | Cloudflare hesabı ve API kimlik bilgileri                                                         |
| **Gemini**        | Gemini Flash ailesi                                                                                  | Projeye/modele göre değişken hız sınırları; öne çıkan bilgide sabit bir aylık token tahsisi yer almıyor                                                                       | Google AI Studio API anahtarı; projenin etkin sınırlarını kontrol edin                            |
| **Groq**          | Llama, GPT-OSS ve Qwen modelleri                                                                     | Denetlenen havuz aylık ~15M token öngörüyor                                                                                                                                   | Groq API anahtarı; hız sınırları geçerlidir                                                       |

### Kayıt Hibeleri ve Sağlayıcıya Özel Krediler

Bu sağlayıcılar, uygunluk kurallarına tabi olarak kayıt hibeleri veya promosyon kredileri sunar. 2026-10-08 tarihinde doğrulandığı üzere, [Cerebras fiyatlandırması](https://www.cerebras.ai/pricing), 30 gün sonra sona eren tek seferlik $5 kredi için bir ödeme yöntemi gerektirir; bu, yinelenen bir token kotası değildir. [Gemini hız sınırları](https://ai.google.dev/gemini-api/docs/rate-limits) projeye, modele ve katmana göre değiştiğinden, garantili aylık token hibesine dönüştürülmez.

| Sağlayıcı     | Ücretsiz Krediler                                                | Modeller                      | Nasıl Alınır                                                         |
| ------------- | ---------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| **Cerebras**  | Tek seferlik $5 promosyon kredisi; 30 gün sonra sona erer        | Mevcut çıkarım kataloğu       | Hesap ve geçerli ödeme yöntemi                                       |
| **DeepSeek**  | 5M ücretsiz token                                                | DeepSeek V4                   | platform.deepseek.com adresinden kaydolun                            |
| **LongCat**   | Tek seferlik 10M token hibesi                                    | LongCat 2.0                   | API anahtarı + KYC; hibe sonrasında kullandıkça öde                  |
| **Vertex AI** | Bütçe modelinde ~300M token olarak gösterilen $300 kayıt kredisi | Gemini ve iş ortağı modelleri | Google Cloud hesabı; faturalandırma ve uygunluk kuralları geçerlidir |

### Diğer Sınırlı Erişim Seçenekleri

Bu sağlayıcılar, belirli sınırlara sahip **ücretsiz katmanlar** sunar:

| Sağlayıcı                         | Ücretsiz Sınır                                                                                          | Modeller                             | En Uygun Kullanım |
| --------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ | ----------------- |
| **GitHub Models**                 | Denetlenen paylaşımlı havuz aylık ~18M token öngörüyor                                                  | Geniş kapsamlı model değerlendirmesi |
| **Hugging Face**                  | Küçük, yinelenen aylık havuz                                                                            | Deneyler ve model çeşitliliği        |
| **OpenRouter ücretsiz modelleri** | Paylaşımlı, istek sınırlı havuz; isteğe bağlı tek seferlik bakiye yüklemesi yinelenen tahsisatı artırır | Geniş kapsamlı yedek katalog         |
| **AI Horde**                      | Anahtarsız topluluk kapasitesi; kullanılabilirlik değişiklik gösterir                                   | Fırsata dayalı dağıtılmış çıkarım    |

---

## Ücretsiz Katmanlar Nasıl Birleştirilir?

Pusula'un sihri, **ücretsiz katmanları birleştirmesinde** yatar. Tek bir sağlayıcıya güvenmek yerine birden fazla ücretsiz sağlayıcı bağlarsınız ve Pusula'un her istek için en uygun olanı otomatik olarak seçmesini sağlarsınız.

### Örnek: Daha Geniş Ücretsiz Katman Kapsamı

Herhangi bir kotaya bağımlılığı azaltmak için birkaç sağlayıcı bağlayın:

1. **Gemini** — yenilenen API anahtarı kotası
2. **Groq** — yenilenen API anahtarı kotası
3. **Pollinations** — anahtarsız, hız sınırlamalı erişim
4. **LongCat** — tek seferlik kayıt hibesi (KYC gerektirir)

Ardından `model: "auto"` kullanın; Pusula şunları yapacaktır:

- Önce en yüksek sıradaki uygun bağlantıyı dener
- Bağlantının kotası tükenmişse veya sistem durumu denetimi başarısız olursa → yapılandırılmış bir sonraki sağlayıcıyı dener
- Anahtarsız sağlayıcı kullanılamıyorsa → kalan hedefleri denemeye devam eder
- Uygun hiçbir bağlantı başarılı olmazsa → hata döndürür; kayıt kredileri yalnızca geçerli ve kullanılabilir oldukları sürece kullanılabilir

**Sonuç**: otomatik yedek sağlayıcıya geçişle daha geniş ücretsiz katman kapsamı — sınırsız kapasite garantisi değildir.

---

## Ücretsiz Sağlayıcılara Nasıl Bağlanılır

### Adım 1: Panoyu Açın

Tarayıcınızda `http://localhost:20128` adresine gidin.

### Adım 2: Sağlayıcılar Bölümüne Gidin

Kenar çubuğunda **Sağlayıcılar**'a tıklayın.

### Adım 3: Sağlayıcı Ekle'ye Tıklayın

**+ Sağlayıcı Ekle** düğmesine tıklayın.

### Adım 4: Ücretsiz Bir Sağlayıcı Seçin

Kataloğa göz atın ve her sağlayıcının mevcut `hasFree`, kimlik doğrulama, kota, gizlilik ve kullanım koşulları meta verilerini inceleyin. Sağlayıcı kartı ve
[Ücretsiz Katmanlar Referansı](../reference/FREE_TIERS.md); yenilenen kullanım havuzlarını,
sınırsız/anahtarsız erişimi, kayıt kredilerini, kullanımdan kaldırılmış girdileri ve daha yüksek riskli kaynakları birbirinden ayırır.

### Adım 5: Bağlan'a Tıklayın

Bir `NOAUTH` sağlayıcısı için Pusula, yukarı akış hizmetine ait kimlik bilgilerini talep etmez. Bu, yukarı akış hizmetinin üçüncü taraf istemcileri kabul ettiğini veya kullanılabilir kapasiteye sahip olduğunu garanti etmez. OAuth ve API anahtarı kullanan sağlayıcılara, belgelerinde açıklanan hesap akışı üzerinden bağlanılmalıdır. Yönlendirici kimlik doğrulaması etkinleştirildiğinde istemciniz yine **Pano → Uç Noktalar** bölümünde gösterilen Pusula API anahtarını kullanır.

### Adım 6: Tekrarlayın

Koşulları ve gizlilik modeli kullanım senaryonuza uygun olan birkaç sağlayıcıya bağlanın.

---

## Kataloğu Doğru Okuma

- `NOAUTH`, Pusula'un sizden bir sağlayıcı kimlik bilgisi istemediği anlamına gelir; çalışma süresi, gizlilik veya sınırsız kapasite garantisi vermez.
- `hasFree`, keşif meta verisidir. Yinelenen bir kotayı, anahtarsız erişimi, kayıt kredisini, onay programını veya promosyonu temsil edebilir.
- `recurring-uncapped`, yayımlanmış bir token üst sınırının bulunmadığı anlamına gelir; hız ve eşzamanlılık sınırları yine de geçerlidir.
- `one-time-initial`, kayıt hibesi tükendikten sonra yinelenmez.
- `tos: avoid` olarak işaretlenen sağlayıcılar, varsayılan olarak otomatik yönlendirmeden hariç tutulur (`excludeTosAvoid`). Bir hesap bağlamak bu filtreyi atlamaz. Operatör tarafından yapılacak herhangi bir geçersiz kılma işlemi, sağlayıcı koşulları ve hesap riski incelendikten sonra gerçekleştirilmelidir.
- `discontinued` olarak işaretlenen girdiler tarihsel kanıt olarak kalır ve hâlihazırda ücretsizmiş gibi sunulmamalıdır.

---

## Pusula Ücretsiz Katmanları Nasıl Daha İyi Hâle Getirir?

### 1. Otomatik Geri Dönüş

Bir ücretsiz sağlayıcı meşgulse veya çalışmıyorsa Pusula otomatik olarak bir sonrakini dener. Herhangi bir işlem yapmanız gerekmez.

### 2. Akıllı Yönlendirme

Pusula, her istek için **en iyi ücretsiz sağlayıcıyı** şunlara göre seçer:

- Hız — Şu anda en hızlı sağlayıcı hangisi?
- Kalite — Bu görev için en iyi sağlayıcı hangisi?
- Kapasite — Hangi sağlayıcının kalan kotası var?

### 3. Token Tasarrufu

Pusula'un sıkıştırma işlem hattı, uygun istem ve araç çıktısı tokenlarının sayısını azaltabilir. Gerçek
tasarruf; içeriğe, seçilen motorlara, sağlayıcının hesaplama yöntemine ve aslına uygunluk
ayarlarına bağlıdır; sıkıştırma, her sağlayıcının kotasını sabit bir katsayıyla artırmaz.

### 4. Çoklu Hesap Desteği

Sağlayıcı koşulları birden fazla hesaba veya kimlik bilgisine izin veriyorsa Pusula her
bağlantıyı ayrı bir yönlendirme adayı olarak değerlendirebilir. Bir sağlayıcının kotasını veya
erişim politikasını aşmak amacıyla ek hesaplar oluşturmayın.

---

## Ücretsiz Katman Hesaplaması

Canlı, havuz bazında yinelenen kayıtları ayıklanmış katalog şu anda aşağıdaki değerleri bildiriyor:

| Metrik                         | Mevcut denetlenmiş değer | Açıklama                                                                         |
| ------------------------------ | -----------------------: | -------------------------------------------------------------------------------- |
| Yinelenen nicel kullanım hakkı |      **~1.62B token/ay** | Paylaşılan havuzlar bir kez sayılır; sınırsız sağlayıcılar toplama dahil edilmez |
| Kayıt hibeleriyle ilk ay       |         **~2.22B token** | Yinelenen toplam ile tek seferlik ve yinelenen kredilerin toplamı                |

Bunlar, birbirinden ayrı uygun hesaplar genelinde katalog çapında tahminlerdir; Pusula tarafından sağlanan bir kullanım hakkı veya yeni bir kurulum için öngörü değildir. Kullanılabilir kapasiteniz, bağladığınız sağlayıcılara ve bunların mevcut koşullarına bağlıdır. Değerler `open-sse/config/freeModelCatalog.ts` dosyasından hesaplanır; havuz bazında yinelenen kayıtların ayıklanması, Hizmet Şartları işaretleri, kullanımdan kaldırılan girdiler ve kayıt kredisi metodolojisi için
[Ücretsiz Katmanlar Referansı](../reference/FREE_TIERS.md) belgesine bakın.

---

## Sık Sorulan Sorular

### "Bu gerçekten ücretsiz mi?"

Katalog, sağlayıcıların yayımladığı koşulları ve proje araştırmalarını kaydeder ancak teklifler değişebilir.
Kullanmadan önce sağlayıcının güncel fiyatlandırmasını, kotasını, gizlilik politikasını ve uygunluk koşullarını doğrulayın.

### "Ücretsiz katman tükenir mi?"

Her sağlayıcı hız sınırı uygulayabilir, modelleri değiştirebilir, erişimi askıya alabilir veya çevrimdışı olabilir. Birden fazla
bağlantı, yedek seçenek kapsamını iyileştirir ancak kullanılabilir bir ücretsiz rota garanti etmez.

### "Ücretsiz sağlayıcıları üretimde kullanabilir miyim?"

Yalnızca sağlayıcının SLA'sı, veri işleme uygulamaları, sınırları ve koşulları üretim
gereksinimlerinizi karşılıyorsa. Kritik iş yükleri izlenen ve sözleşme açısından uygun bir yedek seçeneğe sahip olmalıdır.

### "Dezavantajı nedir?"

Ödünler arasında katı sınırlar, bekleme listeleri, KYC, kredi kartı doğrulaması, istemlerin eğitim için
kullanılması, daha zayıf gizlilik, SLA olmaması, model değişkenliği, coğrafi kısıtlamalar, ücretli kota aşımı veya
hesap politikası riski yer alabilir. Pusula kullanılabilir meta verileri gösterir; neyi etkinleştireceğinize siz karar verirsiniz.

### "Daha fazla ücretsiz kotayı nasıl edinebilirim?"

1. Daha fazla ücretsiz sağlayıcı bağlayın
2. Uygun sıkıştırma motorlarını etkinleştirin ve iş yükünüz için sağlanan tasarrufu ölçün
3. Ücretsiz/ucuz sağlayıcılara öncelik vermek için `auto/cheap` kullanın
4. Sağlayıcı koşullarını ihlal etmeden izin verilen ek sağlayıcılar veya kimlik bilgileri ekleyin

### "Ücretsiz sağlayıcıların kalitesi daha mı kötü?"

Her zaman değil. Bazı sağlayıcılar, ücretli rotalar üzerinden sunulanlarla aynı model ailelerine
erişim sağlar ancak sınırlar, gecikme, gizlilik, güvenilirlik ve model sürümleri farklılık gösterebilir. Kalite göstergesi olarak
Ücretsiz Sağlayıcı Sıralamaları sayfasını kullanın ve gerçekte sunulan modeli doğrulayın.

---

## Sırada Ne Var?

- **[Otomatik Kombinasyon Kılavuzu](./AUTO-COMBO-GUIDE.md)** — Pusula'un sizin için en iyi yapay zekâyı seçmesine izin verin
- **[Sağlayıcılar Kılavuzu](./PROVIDERS-GUIDE.md)** — Daha fazla sağlayıcı bağlayın
- **[Sorun Giderme](../guides/TROUBLESHOOTING.md)** — Yaygın sorunları düzeltin
- **[Ücretsiz Katmanlar Referansı](../reference/FREE_TIERS.md)** — Ücretsiz katmanların tam listesi
