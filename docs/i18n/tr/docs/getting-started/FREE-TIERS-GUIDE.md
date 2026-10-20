# Free Tiers Guide: Understand and Combine Free AI Access (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/FREE-TIERS-GUIDE.md) · 🇩🇪 [de](../../../de/docs/getting-started/FREE-TIERS-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/FREE-TIERS-GUIDE.md)

---

> **Kısaca**: Pusula, **`hasFree` olarak işaretlenmiş 152 sağlayıcı kataloğu girdisiyle** 357 sağlayıcı kimliği kaydeder. Daha sıkı şekilde denetlenmiş ücretsiz model kataloğu, **35 yinelenen havuz anahtarını / 482 girdiyi** (475 etkin + 7 kullanımdan kaldırılmış) kapsar. Daha geniş yedek kapasitesi için uygun birkaç sağlayıcıyı bağlayın; tüm kota, onay kuralı, gizlilik politikası ve ücretli kota aşımı koşulları geçerliliğini korur.

---

## Ücretsiz Katmanlar Nedir?

Birçok yapay zekâ sağlayıcısı bir tür **ücretsiz erişim** sunar. Sağlayıcıya bağlı olarak bu;
kimlik doğrulaması gerektirmeyen bir uç nokta, yinelenen kota, hız sınırlamalı ancak üst sınırı olmayan erişim, kayıt hibesi,
manuel onay veya geçici bir promosyon anlamına gelebilir. Bazı seçenekler hesap, API anahtarı,
kredi kartı, KYC veya sağlayıcıya özgü koşulların kabulünü gerektirir.

Pusula, bu ücretsiz katmanları tek bir uç noktada **bir araya getirir**. 10 farklı hizmete ayrı ayrı kaydolmak yerine hepsini Pusula'a bağlayabilir ve her istek için en iyi ücretsiz seçeneğin otomatik olarak belirlenmesi amacıyla `model: "auto"` kullanabilirsiniz.

---

## Ücretsiz Erişim Sunan Temsilî Sağlayıcılar

### Yinelenen, Anahtarsız veya Üst Sınırsız Erişim

Bu sağlayıcılar, denetlenmiş katalogda yinelenen, anahtarsız veya üst sınırsız bir ücretsiz erişim yoluna sahiptir. “Üst sınırsız”, yayımlanmış bir token üst sınırı olmadığı anlamına gelir; hız, eşzamanlılık, hesap, bölge ve politika sınırları yine de geçerli olabilir:

| Sağlayıcı         | Modeller                                                                                              | Kota                                                                                                                                                                           | Nasıl Bağlanılır                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| **Kiro AI**       | Claude Sonnet 4.5, Haiku 4.5, DeepSeek V3.2 ve diğerleri                                              | Denetlenmiş katalog, aylık 25K tokenlık ortak bir havuz öngörür                                                                                                                | OAuth/hesap akışı; ToS katalogda `avoid` olarak işaretlenmiştir                                       |
| **OpenCode Free** | Sağlayıcı kayıt defterindeki mevcut `*-free` model kümesi                                             | Anahtarsız; yayımlanmış bir token üst sınırı yoktur                                                                                                                            | Sağlayıcı kimlik bilgisi gerekmez; ToS `avoid` olarak işaretlenmiştir                                 |
| **Pollinations**  | Mevcut anahtarsız model kümesi; bazı eski modeller kullanımdan kaldırılmıştır veya anahtar gerektirir | Anahtarsız; yayımlanmış bir token üst sınırı yoktur                                                                                                                            | Anahtarsız modeller için sağlayıcı kimlik bilgisi gerekmez                                            |
| **Logfare**       | kimi-k3, deepseek-v4-pro, glm-5.2, gpt-5.6-luna, minimax-m3 ve diğerleri                              | Ücretsiz API anahtarı (hız sınırı ve kart gerekmez); araştırma amacıyla **her istek günlüğe kaydedilir** (logfare.ai/consent adresinden kapsam dışında kalmayı seçebilirsiniz) | logfare.ai/register adresinden anında anahtar; ToS/gizlilik için logfare.ai/tos ve logfare.ai/privacy |
| **Cloudflare AI** | Workers AI kataloğu                                                                                   | Denetlenmiş havuz, yayımlanmış kullanım birimlerine göre ayda ~30M token öngörür                                                                                               | Cloudflare hesabı ve API kimlik bilgileri                                                             |
| **Gemini**        | Gemini Flash ailesi                                                                                   | Denetlenmiş havuz ayda ~60M token öngörür                                                                                                                                      | Google AI Studio API anahtarı; hız sınırları geçerlidir                                               |
| **Groq**          | Llama, GPT-OSS ve Qwen modelleri                                                                      | Denetlenmiş havuz ayda ~15M token öngörür                                                                                                                                      | Groq API anahtarı; hız sınırları geçerlidir                                                           |
| **Cerebras**      | GLM 4.7 ve GPT-OSS 120B                                                                               | Denetlenmiş havuz ayda ~30M token öngörür                                                                                                                                      | Cerebras API anahtarı; hız sınırları geçerlidir                                                       |

### Kayıt Hibeleri ve Sağlayıcıya Özgü Krediler

Bu sağlayıcılar kaydolduğunuzda size **ücretsiz kredi** verir:

| Sağlayıcı     | Ücretsiz Krediler                                                   | Modeller                      | Nasıl Alınır                                                         |
| ------------- | ------------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| **DeepSeek**  | 5M ücretsiz token                                                   | DeepSeek V4                   | platform.deepseek.com adresinden kaydolun                            |
| **LongCat**   | Tek seferlik 10M token hibesi                                       | LongCat 2.0                   | API anahtarı + KYC; hibe sonrasında kullandıkça ödeme                |
| **Vertex AI** | Bütçe modelinde ~300M token olarak temsil edilen $300 kayıt kredisi | Gemini ve iş ortağı modelleri | Google Cloud hesabı; faturalandırma ve uygunluk kuralları geçerlidir |

### Diğer Sınırlı Erişim Seçenekleri

Bu sağlayıcılar, belirli sınırlara sahip **ücretsiz katmanlar** sunar:

| Sağlayıcı                  | Ücretsiz Limit                                                                                                    | Modeller                             | En Uygun Olduğu Alan |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------- |
| **GitHub Models**          | Denetlenen ortak havuz tahmini: ayda ~18 milyon token                                                             | Geniş kapsamlı model değerlendirmesi |
| **Hugging Face**           | Aylık olarak yenilenen küçük havuz                                                                                | Deneyler ve model çeşitliliği        |
| **OpenRouter free models** | İstek sayısıyla sınırlı ortak havuz; isteğe bağlı tek seferlik bakiye yükleme, yinelenen kullanım hakkını artırır | Geniş kapsamlı yedek model kataloğu  |
| **AI Horde**               | Anahtarsız topluluk kapasitesi; kullanılabilirlik değişiklik gösterir                                             | Fırsata dayalı dağıtık çıkarım       |

---

## Ücretsiz Katmanlar Nasıl Birleştirilir?

Pusula'un sihri, **ücretsiz katmanları birleştirmesinde** yatar. Tek bir sağlayıcıya bağlı kalmak yerine birden fazla ücretsiz sağlayıcı bağlar ve Pusula'un her istek için en uygun olanı otomatik olarak seçmesini sağlarsınız.

### Örnek: Daha Geniş Ücretsiz Katman Kapsamı

Tek bir kotaya bağımlılığı azaltmak için birkaç sağlayıcı bağlayın:

1. **Gemini** — yinelenen API anahtarı kotası
2. **Groq** — yinelenen API anahtarı kotası
3. **Pollinations** — anahtarsız, hız sınırlamalı erişim
4. **LongCat** — tek seferlik kayıt hibesi (KYC gerektirir)

Ardından `model: "auto"` kullanın; Pusula şunları yapar:

- Önce en yüksek sıralamaya sahip uygun bağlantıyı dener
- Bağlantının kotası tükenmişse veya durum denetimi başarısız olursa → yapılandırılmış bir sonraki sağlayıcıyı dener
- Anahtarsız sağlayıcı kullanılamıyorsa → kalan hedefleri denemeye devam eder
- Tümü başarısız olursa → LongCat'i yedek olarak kullanır

**Sonuç**: otomatik geri dönüş mekanizmasıyla daha geniş ücretsiz katman kapsamı — sınırsız kapasite garantisi değildir.

---

## Ücretsiz Sağlayıcılar Nasıl Bağlanır?

### Adım 1: Kontrol Panelini Açın

Tarayıcınızda `http://localhost:20128` adresine gidin.

### Adım 2: Sağlayıcılara Gidin

Kenar çubuğunda **Sağlayıcılar** seçeneğine tıklayın.

### Adım 3: Sağlayıcı Ekle'ye Tıklayın

**+ Sağlayıcı Ekle** düğmesine tıklayın.

### Adım 4: Ücretsiz Bir Sağlayıcı Seçin

Kataloğa göz atın ve her sağlayıcının güncel `hasFree`, kimlik doğrulama, kota, gizlilik
ve Hizmet Şartları meta verilerini inceleyin. Sağlayıcı kartı ve
[Ücretsiz Katmanlar Referansı](../reference/FREE_TIERS.md); yinelenen havuzlar,
sınırsız/anahtarsız erişim, kayıt kredileri, kullanımdan kaldırılmış girdiler ve daha yüksek riskli kaynaklar arasındaki farkları gösterir.

### Adım 5: Bağlan'a Tıklayın

Bir `NOAUTH` sağlayıcısı için kimlik bilgisi gerekmez. OAuth ve API anahtarı kullanan sağlayıcılar,
belgelerinde açıklanan hesap akışı aracılığıyla bağlanmalıdır.

### Adım 6: Tekrarlayın

Koşulları ve gizlilik modeli kullanım senaryonuza uygun olan birkaç sağlayıcıyı bağlayın.

---

## Katalog Nasıl Doğru Okunur?

- `NOAUTH`, Pusula'un sizden sağlayıcı kimlik bilgisi istemediği anlamına gelir; çalışma süresini,
  gizliliği veya sınırsız kapasiteyi garanti etmez.
- `hasFree`, keşif meta verisidir. Yinelenen bir kotayı, anahtarsız erişimi,
  kayıt kredisini, onay programını veya promosyonu temsil edebilir.
- `recurring-uncapped`, yayımlanmış bir token üst sınırının bulunmadığı anlamına gelir; hız ve
  eşzamanlılık sınırları yine de geçerlidir.
- `one-time-initial`, kayıt hibesi tüketildikten sonra yinelenmez.
- `tos: avoid`, kullanımdan önce sağlayıcı koşullarını ve hesap riskini incelemeniz gerektiğine dair bir uyarıdır.
- `discontinued` olarak işaretlenen girdiler geçmişe dönük kanıt olarak kalır ve
  hâlen ücretsizmiş gibi sunulmamalıdır.

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

Canlı, havuz bazında yinelenen kayıtları kaldırılmış katalog şu anda şunları bildiriyor:

| Metrik                                                            |                              Güncel denetlenmiş değer | Yorum                                                                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------------------: | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Yinelenen nicelendirilmiş tahsisat                                |                                   **~1.62B token/ay** | Paylaşılan havuzlar bir kez sayılır; sınırsız sağlayıcılar toplama dahil edilmez                                                             |
| Kayıt tahsisatlarıyla ilk ay                                      |                                      **~2.22B token** | Yinelenen toplam ile tek seferlik ve yinelenen kredilerin toplamı                                                                            |
| Denetlenmiş ücretsiz model envanteri                              | **35 yinelenen havuz anahtarı / 482 katalog girdisi** | 475 etkin + 7 kullanımdan kaldırılmış; 357 sağlayıcılı katalogdan farklıdır                                                                  |
| Temsil edilen yinelenen/anahtarsız, süresiz ücretsiz sağlayıcılar |                                                **53** | Yinelenen günlük/aylık/kredi/sınırsız ve anahtarsız katalog türlerindeki benzersiz sağlayıcılar; uygunluk koşullu satırlar hariç tutulmuştur |
| `hasFree` olarak işaretlenen sağlayıcı katalog girdileri          |                                         **152 / 357** | Daha geniş sağlayıcı meta verileri; tümünün nicelendirilebilir yinelenen kotası yoktur                                                       |

Bu değerler `open-sse/config/freeModelCatalog.ts` dosyasından hesaplanır; havuz bazında yinelenen kayıtların kaldırılması, ToS işaretleri,
kullanımdan kaldırılmış girdiler ve kayıt kredisi metodolojisi için
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
