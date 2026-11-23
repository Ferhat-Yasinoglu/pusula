# Changelog (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../CHANGELOG.md) · 🇩🇪 [de](../de/CHANGELOG.md) · 🇮🇷 [fa](../fa/CHANGELOG.md)

---

# Değişiklik Günlüğü

Pusula'daki tüm önemli değişiklikler bu dosyada tutulur. Biçim
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) standardını, sürümler
[Anlamsal Sürümleme](https://semver.org/lang/tr/) kurallarını izler.

## [Unreleased]

### ✨ Yeni Özellikler

- **feat(access):** ziyaretçiler tanıtım sayfasındaki yeni "Erişim iste" formuyla (ad, e-posta, isteğe bağlı açıklama) erişim isteyebilir. Operatör talepleri API Yöneticisi → Erişim talepleri altında inceler; bir talebi onaylamak günlük ve haftalık USD limitli (varsayılan $1 / $5) bir API anahtarı oluşturur ve iletilmek üzere bir kez gösterir. Herkese açık adres her adres için hız sınırlıdır, robot tuzağına düşen gönderimleri yok sayar ve 200 bekleyen talepten sonra yeni talep almaz.

### 🔧 CI / Derleme

- **ci(fly):** `Deploy to Fly.io` iş akışı kaldırıldı. `FLY_API_TOKEN` olmadan hiç dağıtım yapmıyordu ve herkese açık örnek kendi sunucumuzda çalışıyor; yani `main`'e yapılan her gönderimde boşuna çalışıyordu.

## [1.0.0] - 2026-10-20

### ✨ Yeni Özellikler

- **feat(core):** Pusula'nın ilk genel sürümü: yüzlerce yapay zekâ sağlayıcısının önünde tek bir OpenAI uyumlu uç nokta; otomatik yedek geçiş, kota bilinçli yönlendirme stratejileri ve kombolar.
- **feat(compression):** Uyarlanabilir bağlam bütçesi kadranıyla RTK + Caveman katmanlı istem sıkıştırması.
- **feat(apps):** Pano, CLI, MCP/A2A sunucuları, masaüstü uygulaması (Electron) ve PWA.
- **feat(i18n):** İngilizce, Türkçe, Almanca ve Farsça arayüz ve belgeler.
