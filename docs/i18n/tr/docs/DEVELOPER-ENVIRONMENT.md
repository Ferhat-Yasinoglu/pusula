# Developer environment notes (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../DEVELOPER-ENVIRONMENT.md) · 🇩🇪 [de](../../de/docs/DEVELOPER-ENVIRONMENT.md) · 🇮🇷 [fa](../../fa/docs/DEVELOPER-ENVIRONMENT.md)

---

Bu sayfa, projenin yerel `.env` davranışını ve Pusula geliştirilirken ortam dosyaları ile gizli bilgilerin nasıl yönetileceğini açıklar.

## .env postinstall davranışı

Proje, geliştiricilere kolaylık sağlamak amacıyla `npm install` / `postinstall` sırasında yerel bir `.env` dosyası oluşturabilir. Bu dosya yalnızca yerel geliştirme ve test amaçlıdır ve hiçbir zaman sürüm kontrolüne kaydedilmemelidir.

Önemli noktalar:

- Deponun `.gitignore` dosyası `.env*` dosyalarını zaten yok sayar (`.gitignore` girdisine bakın). Belirli bir örnek dosyayı bilinçli olarak kaydetmeyi amaçlamadığınız ve bunun için belgelenmiş bir süreciniz olmadığı sürece bu kuralı kaldırmayın veya değiştirmeyin.
- Gerçek bir gizli bilgi yanlışlıkla depoya kaydedilirse kimlik bilgisini hemen yenileyin/iptal edin ve depo geçmişinden kaldırın (örneğin, `git filter-repo` veya eşdeğer bir düzeltme iş akışı kullanarak). Yardıma ihtiyacınız varsa güvenlik sorumlusu/iletişim yetkilisiyle irtibata geçin.
- CI ve üretim ortamlarında gizli bilgileri dosyalara kaydetmek yerine CI gizli bilgilerini veya bir gizli bilgi yöneticisini (GitHub Actions Secrets, Azure Key Vault, HashiCorp Vault vb.) kullanın.

## Önerilen yerel iş akışı

- `.env` dosyasını yalnızca yerel çalışma alanınızda tutun. Gerekli değişkenleri ve kabul edilebilir örnek değerleri belgelemek için `.env.example` dosyasını (zaten izlenmektedir) kullanın.
- Yerel olarak gizli bilgi benzeri değerler gerektiren testleri çalıştırırken gerçek kimlik bilgileri yerine sentetik yer tutucuları veya çalışma zamanında oluşturulan geçici anahtarları tercih edin.
- Yer tutucu kullanan testlere kısa bir yorum ekleyerek inceleyenlerin test verisinin sentetik olduğunu anlamasını sağlayın.

## Tarayıcı notları

- Bazı derlenmiş veya ikili varlıklar (ör. gömülü base64 WASM blobları), kimlik bilgilerine benzeyen ASCII alt dizeleri içerebilir ve metin tabanlı gizli bilgi tarayıcılarını tetikleyebilir. Bu varlıklar meşruysa bunları tarayıcının izin verilenler listesine ekleyin veya ilgili dizinleri tarayıcı yapılandırmasında hariç tutun.

## Bir sızıntı bulursanız

1. Anahtarı hemen yenileyin/iptal edin.
2. Gizli bilgiyi geçmişten kaldırın ve gerekirse temizlenmiş dalı zorla gönderin.
3. Bakım sorumlularını bilgilendirin ve kuruluşunuzun olay müdahale kontrol listesini izleyin.
