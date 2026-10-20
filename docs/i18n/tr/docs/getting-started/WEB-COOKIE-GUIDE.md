# Web Cookie Providers (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/WEB-COOKIE-GUIDE.md) · 🇩🇪 [de](../../../de/docs/getting-started/WEB-COOKIE-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/WEB-COOKIE-GUIDE.md)

---

Web Cookie sağlayıcıları, Pusula'un bir API anahtarı yerine mevcut tarayıcı oturumunuz üzerinden bir yapay zekâ hizmetini kullanmasına olanak tanır. Bir hizmete web sitesi üzerinden zaten erişiminiz olduğunda ve Pusula'un aynı kimliği doğrulanmış oturumu kullanmasını istediğinizde kullanışlıdırlar.

API anahtarı sağlayıcılarından farklı olarak Web Cookie sağlayıcıları, tarayıcınızın web sitesine gönderdiği kimlik bilgilerini kullanarak kimlik doğrulaması yapar.

---

# Başlamadan Önce

> **Önemli:** Kimlik bilgilerini her zaman tarayıcınızın çerez depolama alanından **değil**, **canlı bir ağ isteğinden** kopyalayın.

Birçok kimlik doğrulama sorunu, çerezlerin yanlış yerden kopyalanmasından kaynaklanır.

## Çerez Depolama Alanından Kopyalamayın

Çoğu tarayıcı, depolanan çerezleri şu bölümde gösterir:

```
DevTools
→ Application (veya Storage)
→ Cookies
```

Bu çerezler doğru görünse de şunlardan biri söz konusu olabilir:

- güncelliğini yitirmiş olabilirler
- eksik olabilirler
- yalnızca kimliği doğrulanmış isteklerde gönderilen çerezleri içermeyebilirler

Bu değerlerin kullanılması, geçerli görünseler bile kimlik doğrulama hatalarına yol açabilir.

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

`Cookie` istek başlığı, tarayıcınızın başarıyla kullandığı kimlik doğrulama bilgilerinin tam hâlini içerir.

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

Gerekli kimlik bilgilerinin tam olarak hangileri olduğu sağlayıcıya bağlıdır.

---

# Sağlayıcı Kimlik Bilgisi Biçimleri

Farklı web siteleri kimlik doğrulama bilgilerini farklı şekillerde saklar. Bazıları yalnızca çerez gerektirirken diğerleri ek başlıklar veya belirteçler gerektirebilir.

| Sağlayıcı                       | Kimlik Bilgisi Biçimi         | Sağlayıcı Kılavuzu               |
| ------------------------------- | ----------------------------- | -------------------------------- |
| Claude Web                      | Tam Cookie istek başlığı      | `docs/providers/CLAUDE_WEB.md`   |
| ChatGPT Web (Codex)             | Tam Cookie başlığı            | `docs/providers/CHATGPT_WEB.md`  |
| Gemini Web                      | _(doğrulayın)_                |                                  |
| Copilot Web                     | _(doğrulayın)_                | `docs/providers/COPILOT-M365.md` |
| Microsoft 365 Copilot (BizChat) | WS access_token + chathubPath | `docs/providers/COPILOT-M365.md` |
| Grok Web                        | _(doğrulayın)_                |                                  |
| ...                             | ...                           | ...                              |

> Yeni Web Cookie sağlayıcıları eklendikçe veya mevcut sağlayıcıların kimlik doğrulama gereksinimleri değiştikçe bu tabloyu güncelleyin.

---

# Web Cookie Sağlayıcılarının Yapabildikleri ve Yapamadıkları

Web Cookie sağlayıcıları, bir web sitesinin sohbet arayüzünü yeniden kullanır. Resmî API'lerle aynı yetenekleri **sunmazlar**.

## Desteklenenler

- Mevcut tarayıcı oturumunuzu kullanarak kimlik doğrulama
- Hesabınız üzerinden kullanılabilen modellere erişim
- Sohbet yanıtlarını akış hâlinde alma
- API anahtarı gerektirmez

## Desteklenmeyenler

- Fonksiyon çağırma
- Araç çağırma
- Otomatik dosya düzenleme
- Otonom IDE iş akışları
- Yalnızca API üzerinden kullanılabilen özellikler

Bu, beklenen bir davranıştır ve **bir hata değildir**.

Araç yürütme, otomatik dosya düzenleme veya diğer aracı iş akışlarına ihtiyacınız varsa Web Cookie sağlayıcısı yerine bir **API anahtarı sağlayıcısı** kullanın.

---

# Doğrulamayla İlgili Uyarı

Başarılı bir **Test Connection** veya çerez doğrulaması, yalnızca sağlanan kimlik bilgilerinin beklenen biçimde göründüğünü doğrular.

Issue #7857 çözülene kadar başarılı bir doğrulama, sağlayıcının kimlik doğrulamasını başarıyla gerçekleştireceğini **garanti etmez**.

Kimlik doğrulama yine de başarısız olursa kimlik bilgilerini tarayıcı çerez depolama alanı yerine canlı bir ağ isteğinden kopyaladığınızı doğrulayın.

---

# Sorun Giderme

## Kimlik Doğrulama Başarısız Oluyor

Kimlik bilgilerinin şu bölümden kopyalandığını doğrulayın:

```
Network
→ Request Headers
→ Cookie
```

ve şu bölümden kopyalanmadığından emin olun:

```
Application
→ Cookies
```

---

## Çerez Tarayıcıda Çalışıyor ancak Pusula'ta Çalışmıyor

Bazı sağlayıcılar, yalnızca kimliği doğrulanmış istekler sırasında gönderilen çerezler içerir.

Bir konuşmayı başarıyla açtıktan sonra kimlik bilgilerini yeni bir ağ isteğinden tekrar kopyalayın.

---

## Oturumun Süresi Doldu

Web Cookie sağlayıcıları mevcut tarayıcı oturumunuzu kullanır.

Tarayıcı oturumunuzun süresi dolarsa veya oturumu kapatırsanız yeni bir kimlik bilgisi kümesi kopyalamanız gerekir.

---

## Test Connection Başarılı ancak İstekler Başarısız Oluyor

Issue #7857 çözülene kadar doğrulamanın başarılı olması, kimlik doğrulama isteğinin başarıyla sonuçlanacağını garanti etmez.

Sorunu daha ayrıntılı incelemeden önce kimlik bilgilerinizi yeni ve kimliği doğrulanmış bir istekten tekrar kopyalayın.

---

# Sağlayıcı Örneği

Sağlayıcıya özel eksiksiz bir açıklamalı kılavuz için şuna bakın:

- **Claude Web** — `docs/providers/CLAUDE_WEB.md`

Claude Web kılavuzu, bir Web Cookie sağlayıcısı için eksiksiz kurulum sürecini gösterir ve referans uygulama görevi görür.

---

# En İyi Uygulamalar

- Kimlik bilgilerini yeni ve kimliği doğrulanmış bir istekten kopyalayın.
- Eski çerezleri yeniden kullanmaktan kaçının.
- Web Cookie sağlayıcılarını kullanırken tarayıcı oturumunuzu etkin tutun.
- Kopyalanan çerezleri hassas kimlik bilgileri olarak değerlendirin.
- Fonksiyon çağırmaya veya aracı iş akışlarına ihtiyaç duyduğunuzda API anahtarı sağlayıcılarını kullanın.
