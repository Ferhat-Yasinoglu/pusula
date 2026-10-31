# Web Cookie Providers (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/WEB-COOKIE-GUIDE.md) · 🇩🇪 [de](../../../de/docs/getting-started/WEB-COOKIE-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/WEB-COOKIE-GUIDE.md)

---

Web Cookie sağlayıcıları, Pusula'un bir API anahtarı yerine mevcut tarayıcı oturumunuz üzerinden bir yapay zekâ hizmetini kullanmasına olanak tanır. Bir hizmete web sitesi üzerinden zaten erişiminiz varsa ve Pusula'un aynı kimliği doğrulanmış oturumu kullanmasını istiyorsanız kullanışlıdır.

API anahtarı sağlayıcılarının aksine Web Cookie sağlayıcıları, tarayıcınızın web sitesine gönderdiği kimlik bilgilerini kullanarak kimlik doğrulaması yapar.

---

# Başlamadan Önce

> **Önemli:** Kimlik bilgilerini her zaman tarayıcınızın çerez depolama alanından **değil**, **canlı bir ağ isteğinden** kopyalayın.

Birçok kimlik doğrulama sorunu, çerezlerin yanlış yerden kopyalanmasından kaynaklanır.

## Çerez Depolama Alanından Kopyalamayın

Çoğu tarayıcı, saklanan çerezleri şu bölümde gösterir:

```
DevTools
→ Application (veya Storage)
→ Cookies
```

Bu çerezler doğru görünse de şunlar söz konusu olabilir:

- güncelliğini yitirmiş olabilirler
- eksik olabilirler
- yalnızca kimliği doğrulanmış isteklerde gönderilen çerezleri içermeyebilirler

Bu değerlerin kullanılması, geçerli görünseler bile kimlik doğrulama hatalarına neden olabilir.

## Canlı Bir İstekten Kopyalayın

Bunun yerine, başarılı bir istekteki çerezleri kullanın:

```
DevTools
→ Network
→ Sayfayı yenileyin
→ Bir sohbet veya konuşma isteğini açın
→ Request Headers
→ Cookie
```

`Cookie` istek başlığı, tarayıcınızın başarıyla kullandığı kimlik doğrulama bilgilerini tam olarak içerir.

Çoğu Web Cookie sağlayıcısı için Pusula'a yapıştırılması gereken değer budur.

---

# Genel Kurulum

Kurulum süreci çoğu Web Cookie sağlayıcısı için aynıdır.

1. Sağlayıcının web sitesinde oturum açın.
2. Tarayıcının Geliştirici Araçları'nı açın.
3. **Network** sekmesini açın.
4. Sayfayı yenileyin.
5. Kimliği doğrulanmış bir sohbet veya konuşma isteğini açın.
6. Gerekli kimlik doğrulama bilgilerini kopyalayın.
7. Pusula'u açın.
8. **Providers → Add Provider** bölümüne gidin.
9. Web Cookie sağlayıcınızı seçin.
10. Kimlik bilgilerini yapıştırın.
11. **Test Connection** seçeneğine tıklayın.
12. Sağlayıcıyı kaydedin.

Gerekli kimlik bilgilerinin tam olarak neler olduğu sağlayıcıya bağlıdır.

---

# Sağlayıcı Kimlik Bilgisi Biçimleri

Farklı web siteleri kimlik doğrulama bilgilerini farklı şekillerde saklar. Bazıları yalnızca çerez gerektirirken, diğerleri ek başlıklar veya belirteçler gerektirebilir.

| Sağlayıcı                       | Kimlik Bilgisi Biçimi         | Sağlayıcı Kılavuzu               |
| ------------------------------- | ----------------------------- | -------------------------------- |
| Claude Web                      | Tam Cookie istek başlığı      | `docs/providers/CLAUDE_WEB.md`   |
| ChatGPT Web (Codex)             | Tam Cookie başlığı            | `docs/providers/CHATGPT_WEB.md`  |
| Gemini Web                      | _(doğrulanacak)_              |                                  |
| Copilot Web                     | _(doğrulanacak)_              | `docs/providers/COPILOT-M365.md` |
| Microsoft 365 Copilot (BizChat) | WS access_token + chathubPath | `docs/providers/COPILOT-M365.md` |
| Grok Web                        | _(doğrulanacak)_              |                                  |
| ...                             | ...                           | ...                              |

> Yeni Web Cookie sağlayıcıları eklendikçe veya mevcut sağlayıcıların kimlik doğrulama gereksinimleri değiştikçe bu tabloyu güncelleyin.

## NoTrack (notrack-web)

NoTrack ([notrack.ai](https://notrack.ai)), kayıt gerektirmeyen ücretsiz bir tüketici sohbet platformudur — oturum, ilk ziyarette anonim olarak oluşturulur ve üç çerez aracılığıyla kalıcı hâle gelir: `uid`, `si_usr_id` ve `si_ses_id`. Pusula, aynı `/api/dispatch` uç noktasını tek bir model kimliği (`notrack-c`, diğer adıyla `ntw`) üzerinden proxy'ler.

### Bağlanma adımları

1. Tarayıcınızda [notrack.ai](https://notrack.ai) adresini açın ve anonim oturum çerezinin ayarlanmasını bekleyin.
2. **Geliştirici Araçları → Ağ** bölümünü açın, sayfayı yenileyin ve herhangi bir `/api` isteğine tıklayın.
3. **İstek Üstbilgileri** bölümünde, `Cookie` üstbilgisinin tam değerini kopyalayın.
4. Pusula'ta **Sağlayıcılar → Sağlayıcı Ekle → NoTrack Web (Ücretsiz)** bölümüne gidin.
5. Çerez dizesini `apiKey` alanına yapıştırın ve **Kaydedin**.

Pusula, yapıştırılan dizeden `uid`, `si_usr_id` ve `si_ses_id` değerlerini çıkarır ve yalnızca bu çiftleri içeren temiz bir `Cookie` üstbilgisini yeniden oluşturur — mevcut olduğunda buna `nt_session` (oturum açmış hesaplar için ayarlanan `ntk_…` belirteci) da eklenir. Üç değerden herhangi biri eksikse operatörlerin alternatif biçimleri deneyebilmesi için yapıştırılan ham dize değiştirilmeden iletilir.

### Model kimlikleri

| Model kimliği | Görünen ad | Notlar                                                     |
| ------------- | ---------- | ---------------------------------------------------------- |
| `notrack-c`   | NoTrack C  | Varsayılan — yukarı akış gönderim modeli `C`.              |
| `C`           | NoTrack C  | `notrack-c` için diğer ad (ham yukarı akış gönderim kodu). |
| `notrack`     | NoTrack C  | `notrack-c` için diğer ad.                                 |
| `ntw`         | NoTrack C  | `notrack-c` için kısa diğer ad.                            |

Dört model kimliğinin tümü aynı yukarı akış gönderim modeline (`C`) eşlenir.

### İstek seçenekleri

Yürütücü, istek gövdesinde aşağıdaki isteğe bağlı alanları kabul eder:

| Gövde alanı           | Varsayılan | Amaç                                                                                  |
| --------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `notrack_mode`        | `usual`    | Gönderim modu (serbest biçimli dize; yukarı akış `usual`, … kabul eder)               |
| `notrack_max_turns`   | `6`        | Yukarı akışın yanıt vermeden önce gerçekleştirebileceği dahili tur sayısı.            |
| `notrack_chat_id`     | `null`     | Mevcut bir yukarı akış sohbetini sürdürür (yeni bir sohbet için atlayın).             |
| `notrack_attachments` | `[]`       | Yukarı akış ek tanımlayıcılarından oluşan doğrudan aktarılan dizi.                    |
| `notrack_regenerate`  | `false`    | Önceki tur için yeniden oluşturulmuş bir yanıt istemek üzere `true` olarak ayarlayın. |

### Yetenekler

- **Akışlı ve akışsız** sohbet tamamlamaları.
- **Araç çağırma** — istekte `tools: [...]` ayarlayın; yürütücü bunları bir araç çağrısı zarfı sözleşmesine dönüştürerek serileştirir ve modelin yanıtlarını yeniden OpenAI `tool_calls` biçiminde ayrıştırır.
- **`response_format`** — `json_object` ve `json_schema` desteklenir. Yürütücü, modelin yanıtından ilk JSON nesnesini çıkarır ve döndürmeden önce bunu dizeleştirir.
- **Akıl yürütme ipucu** — yukarı akış bir `thinking` olayı gönderdiğinde yürütücü bir `reasoning` deltası yayınlar.

### Sınırlamalar

- Yukarı akış, anonim kullanım kotaları uygular — kota aşıldığında yürütücü, kullanıcı dostu bir mesajla 429 hatası döndürür.
- Tüm model kimlikleri aynı yukarı akış gönderim modeline çözümlenir; model başına geçiş olanağı yoktur.
- Yürütücü, yukarı akışın `/api/chats` uç noktasını çağırmaz; bu nedenle sohbet geçmişi / oturumlar otomatik olarak yönetilmez. Mevcut bir yukarı akış sohbetini sürdürmek için `notrack_chat_id` kullanın.

---

# Web Çerezi Sağlayıcıları Neleri Yapabilir ve Neleri Yapamaz?

Web Çerezi sağlayıcıları, bir web sitesinin sohbet arayüzünü yeniden kullanır. Resmî API'lerle aynı yetenekleri **sunmazlar**.

## Desteklenenler

- Mevcut tarayıcı oturumunuzu kullanarak kimlik doğrulama
- Hesabınız üzerinden kullanılabilen modellere erişim
- Sohbet yanıtlarını akış hâlinde alma
- API anahtarı gerekmez

## Desteklenmeyenler

- Fonksiyon çağırma
- Araç çağırma
- Otomatik dosya düzenleme
- Otonom IDE iş akışları
- Yalnızca API üzerinden kullanılabilen özellikler

Bu, beklenen bir davranıştır ve **bir hata değildir**.

Araç çalıştırma, otomatik dosya düzenleme veya diğer otonom iş akışlarına ihtiyacınız varsa Web Cookie sağlayıcısı yerine bir **API anahtarı sağlayıcısı** kullanın.

---

# Doğrulamayla İlgili Uyarı

Başarılı bir **Bağlantıyı Test Etme** işlemi veya çerez doğrulaması, yalnızca sağlanan kimlik bilgilerinin beklenen biçimde göründüğünü doğrular.

#7857 numaralı sorun çözülene kadar başarılı bir doğrulama, sağlayıcının kimlik doğrulamasını başarıyla gerçekleştireceğini **garanti etmez**.

Kimlik doğrulama yine de başarısız olursa kimlik bilgilerini tarayıcı çerez depolamasından değil, etkin bir ağ isteğinden kopyaladığınızı doğrulayın.

---

# Sorun Giderme

## Kimlik Doğrulama Başarısız Oluyor

Kimlik bilgilerinin şu konumdan kopyalandığını doğrulayın:

```
Ağ
→ İstek Üstbilgileri
→ Çerez
```

ve şu konumdan kopyalanmadığından emin olun:

```
Uygulama
→ Çerezler
```

---

## Çerez Tarayıcıda Çalışıyor ancak Pusula'ta Çalışmıyor

Bazı sağlayıcılar, yalnızca kimliği doğrulanmış istekler sırasında gönderilen çerezler içerir.

Bir konuşmayı başarıyla açtıktan sonra kimlik bilgilerini yeni bir ağ isteğinden tekrar kopyalayın.

---

## Oturumun Süresi Doldu

Web Cookie sağlayıcıları mevcut tarayıcı oturumunuzu kullanır.

Tarayıcı oturumunuzun süresi dolarsa veya oturumu kapatırsanız yeni bir kimlik bilgisi kümesi kopyalamanız gerekir. Desteklenen web sağlayıcılarında çerez yenilemeyi otomatikleştirmek için yardımcı araç olan [Tarayıcı Oturumu Senkronizasyon Uzantısı](../guides/SESSION-SYNC-EXTENSION.md) bölümüne bakın.

---

## Bağlantı Testi Başarılı ancak İstekler Başarısız Oluyor

#7857 numaralı sorun çözülene kadar doğrulamadan geçmek, kimlik doğrulama isteğinin başarılı olacağını garanti etmez.

Daha fazla sorun giderme işlemi yapmadan önce kimlik bilgilerinizi yeni ve kimliği doğrulanmış bir istekten tekrar kopyalayın.

---

# Sağlayıcı Örneği

Sağlayıcıya özel eksiksiz bir açıklamalı kılavuz için şuraya bakın:

- **Claude Web** — `docs/providers/CLAUDE_WEB.md`

Claude Web kılavuzu, bir Web Cookie sağlayıcısının eksiksiz kurulum sürecini gösterir ve referans uygulama olarak kullanılır.

---

# En İyi Uygulamalar

- Kimlik bilgilerini yeni ve kimliği doğrulanmış bir istekten kopyalayın.
- Eski çerezleri yeniden kullanmaktan kaçının.
- Web Cookie sağlayıcılarını kullanırken tarayıcı oturumunuzu etkin tutun.
- Kopyalanan çerezleri hassas kimlik bilgileri olarak değerlendirin.
- Fonksiyon çağırma veya otonom iş akışlarına ihtiyaç duyduğunuzda API anahtarı sağlayıcılarını kullanın.
