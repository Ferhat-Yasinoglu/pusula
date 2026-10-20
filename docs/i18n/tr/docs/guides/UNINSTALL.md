# Pusula — Uninstall Guide (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/UNINSTALL.md) · 🇩🇪 [de](../../../de/docs/guides/UNINSTALL.md) · 🇮🇷 [fa](../../../fa/docs/guides/UNINSTALL.md)

---

🌐 **Languages:** 🇺🇸 [English](../../../../guides/UNINSTALL.md) · 🇩🇪 [de](../../../de/docs/guides/UNINSTALL.md) · 🇮🇷 [fa](../../../fa/docs/guides/UNINSTALL.md)

Bu kılavuz, Pusula'u sisteminizden temiz bir şekilde nasıl kaldıracağınızı açıklar.

---

## Hızlı Kaldırma (v3.6.2+)

Pusula, temiz kaldırma işlemi için iki yerleşik komut dosyası sunar:

### Verilerinizi Koruyun

```bash
npm run uninstall
```

Bu komut Pusula uygulamasını kaldırır ancak `~/.pusula/` içindeki veritabanınızı, yapılandırmalarınızı, API anahtarlarınızı ve sağlayıcı ayarlarınızı **korur**. Uygulamayı daha sonra yeniden yüklemeyi planlıyorsanız ve mevcut kurulumunuzu korumak istiyorsanız bunu kullanın.

### Tamamen Kaldırma

```bash
npm run uninstall:full
```

Bu komut uygulamayı kaldırır **ve tüm verileri kalıcı olarak siler**:

- Veritabanı (`storage.sqlite`)
- Sağlayıcı yapılandırmaları ve API anahtarları
- Yedekleme dosyaları
- Günlük dosyaları
- `~/.pusula/` dizinindeki tüm dosyalar

> ⚠️ **Uyarı:** `npm run uninstall:full` işlemi geri alınamaz. Tüm sağlayıcı bağlantılarınız, kombinasyonlarınız, API anahtarlarınız ve kullanım geçmişiniz kalıcı olarak silinir.

---

## Manuel Kaldırma

### NPM Genel Kurulumu

```bash
# Genel paketi kaldırın
npm uninstall -g pusula

# (İsteğe bağlı) Veri dizinini kaldırın
rm -rf ~/.pusula
```

### pnpm Genel Kurulumu

```bash
pnpm uninstall -g pusula
rm -rf ~/.pusula
```

### Docker

```bash
# Konteyneri durdurun ve kaldırın
docker stop pusula
docker rm pusula

# Birimi kaldırın (tüm verileri siler)
docker volume rm pusula-data

# (İsteğe bağlı) İmajı kaldırın
docker rmi ferhat-yasinoglu/pusula:latest
```

### Docker Compose

```bash
# Konteynerleri durdurun ve kaldırın
docker compose down

# Birimleri de kaldırın (tüm verileri siler)
docker compose down -v
```

### Electron Masaüstü Uygulaması

**Windows:**

- `Ayarlar → Uygulamalar → Pusula → Kaldır` yolunu açın
- Veya kurulum dizinindeki NSIS kaldırma programını çalıştırın

**macOS:**

- `Pusula.app` dosyasını `/Applications` klasöründen Çöp Sepeti'ne sürükleyin
- Verileri kaldırın: `rm -rf ~/Library/Application Support/pusula`

**Linux:**

- AppImage dosyasını kaldırın
- Verileri kaldırın: `rm -rf ~/.pusula`

### Kaynaktan Kurulum (git clone)

```bash
# Klonlanan dizini kaldırın
rm -rf /path/to/pusula

# (İsteğe bağlı) Veri dizinini kaldırın
rm -rf ~/.pusula
```

---

## Veri Dizinleri

Pusula, verileri varsayılan olarak aşağıdaki konumlarda depolar:

| Platform   | Varsayılan Yol                | Geçersiz Kılma                    |
| ---------- | ----------------------------- | --------------------------------- |
| Linux      | `~/.pusula/`               | `DATA_DIR` ortam değişkeni        |
| macOS      | `~/.pusula/`               | `DATA_DIR` ortam değişkeni        |
| Windows    | `%APPDATA%/pusula/`        | `DATA_DIR` ortam değişkeni        |
| Docker     | `/app/data/` (bağlı birim)    | `DATA_DIR` ortam değişkeni        |
| XDG uyumlu | `$XDG_CONFIG_HOME/pusula/` | `XDG_CONFIG_HOME` ortam değişkeni |

### Veri dizinindeki dosyalar

| Dosya/Dizin          | Açıklama                                                           |
| -------------------- | ------------------------------------------------------------------ |
| `storage.sqlite`     | Ana veritabanı (sağlayıcılar, kombinasyonlar, ayarlar, anahtarlar) |
| `storage.sqlite-wal` | SQLite önceden yazma günlüğü (geçici)                              |
| `storage.sqlite-shm` | SQLite paylaşımlı belleği (geçici)                                 |
| `call_logs/`         | İstek yükü arşivleri                                               |
| `backups/`           | Otomatik veritabanı yedekleri                                      |
| `log.txt`            | Eski istek günlüğü (isteğe bağlı)                                  |

---

## Tamamen Kaldırıldığını Doğrulama

Kaldırma işleminden sonra geride hiçbir dosya kalmadığını doğrulayın:

```bash
# Global npm paketini kontrol edin
npm list -g pusula 2>/dev/null

# Veri dizinini kontrol edin
ls -la ~/.pusula/ 2>/dev/null

# Çalışan işlemleri kontrol edin
pgrep -f pusula
```

Herhangi bir işlem hâlâ çalışıyorsa durdurun:

```bash
pkill -f pusula
```
