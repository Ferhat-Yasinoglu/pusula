---
title: "Pusula Fly.io Dağıtım Kılavuzu"
version: 3.8.50
lastUpdated: 2026-08-23
---

# Pusula Fly.io Dağıtım Kılavuzu (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/FLY_IO_DEPLOYMENT_GUIDE.md) · 🇩🇪 [de](../../../de/docs/ops/FLY_IO_DEPLOYMENT_GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/ops/FLY_IO_DEPLOYMENT_GUIDE.md)

---

Bu belge, Pusula'un Fly.io platformunda dağıtım sürecini adım adım açıklar.

---

## 1. Dağıtım Hedefleri

- **Platform:** Fly.io
- **Dağıtım yöntemi:** Yerel `flyctl` ile doğrudan yayınlama
- **Çalışma Zamanı:** Depodaki mevcut `Dockerfile` ve `fly.toml`
- **Veri Kalıcılığı:** `/data` dizinine bağlanmış Fly Volume
- **Erişim Adresi:** `https://pusula.fly.dev/`

---

## 2. Ön Koşullar ve `flyctl` Kurulumu

```bash
# Fly CLI kurulumu (macOS / Linux):
curl -L https://fly.io/install.sh | sh

# Giriş yapma:
flyctl auth login
```

---

## 3. İlk Dağıtım Adımları

1. **Volume Oluşturma (Kalıcı Depolama):**

   ```bash
   flyctl volumes create data --size 3 --region sin
   ```

2. **Gizli Değişkenleri (Secrets) Ayarlama:**

   ```bash
   flyctl secrets set \
     JWT_SECRET="guclu-jwt-anahtariniz" \
     API_KEY_SECRET="guclu-aes-anahtariniz" \
     INITIAL_PASSWORD="yonetici-sifreniz" \
     DATA_DIR="/data"
   ```

3. **Uygulamayı Dağıtma:**
   ```bash
   flyctl deploy
   ```
