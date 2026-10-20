# Auto-Combo: Let Pusula Pick the Best AI for You (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/AUTO-COMBO-GUIDE.md) · 🇩🇪 [de](../../../de/docs/getting-started/AUTO-COMBO-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/AUTO-COMBO-GUIDE.md)

---

> **Özet**: Modelinizi `auto` olarak ayarlayın; Pusula her istek için en iyi yapay zekâ sağlayıcısını otomatik olarak seçer. Yapılandırma gerekmez.

---

## Ne İşe Yarar?

Belirli bir yapay zekâ modeli (GPT-4o veya Claude gibi) seçmek yerine, Pusula'un her istek için **en iyi modeli otomatik olarak seçmesini** sağlayabilirsiniz. Şunları dikkate alır:

- **Sağlık** — Sağlayıcı şu anda çalışıyor mu?
- **Hız** — Ne kadar hızlı?
- **Maliyet** — Maliyeti ne kadar?
- **Kalite** — Bu görev türünde iyi mi?
- **Kapasite** — Kalan kotası var mı?

Pusula, bağlı tüm sağlayıcılarınızı puanlar ve en iyisini seçer. Seçilen sağlayıcı başarısız olursa otomatik olarak bir sonrakini dener.

---

## Hızlı Başlangıç

**Adım 1**: IDE veya CLI'nizde modelinizi `auto` olarak ayarlayın:

```
model: "auto"
```

**Adım 2**: Hepsi bu kadar! Geri kalanını Pusula halleder.

**Adım 3** (isteğe bağlı): Belirli görevler için bir varyant kullanın:

```
model: "auto/coding"    # Kod için en iyisi
model: "auto/fast"      # En hızlı yanıt
model: "auto/cheap"     # En ucuz seçenek
```

---

## Hangi "auto" Seçeneğini Kullanmalıyım?

| Şunu istiyorsanız...            | Bunu kullanın  | En uygun olduğu alanlar       | Nasıl çalışır                                 |
| ------------------------------- | -------------- | ----------------------------- | --------------------------------------------- |
| **Genel olarak en iyi**         | `auto`         | Genel sorular, sohbet         | Hız, maliyet ve kaliteyi dengeler             |
| **Kod için en iyi**             | `auto/coding`  | Kod yazma, hata ayıklama      | Kodlama görevlerinde iyi modelleri seçer      |
| **En hızlı yanıt**              | `auto/fast`    | Hızlı yanıtlar, düşük gecikme | Hıza her şeyden daha fazla öncelik verir      |
| **En ucuz seçenek**             | `auto/cheap`   | Tasarruf etme                 | En ucuz sağlayıcıyı seçer                     |
| **En akıllı model**             | `auto/smart`   | Karmaşık görevler             | Kaliteye öncelik verir + yeni modelleri dener |
| **En yüksek kullanılabilirlik** | `auto/offline` | Sağlayıcılar yoğun olduğunda  | En fazla kapasiteye sahip sağlayıcıları seçer |

### Örnekler

```bash
# Genel sohbet — dengeli
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello!"}]}'

# Kod üretimi — kalite öncelikli
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto/coding","messages":[{"role":"user","content":"Write a Python function"}]}'

# Hızlı yanıt — hız öncelikli
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto/fast","messages":[{"role":"user","content":"What is 2+2?"}]}'
```

---

## Nasıl Çalışır? (Basit Sürüm)

`model: "auto"` ile bir istek gönderdiğinizde Pusula:

1. **Bağlı tüm sağlayıcılarınıza bakar** — Eklediğiniz her sağlayıcıyı (OpenAI, Anthropic, Google vb.) değerlendirir
2. **Her birini puanlar** ve diğer etkenlerin yanı sıra şunları dikkate alır:
   - Çalışıyor mu? (sağlık)
   - Kapasitesi var mı? (kota)
   - Maliyeti ne kadar? (fiyat)
   - Ne kadar hızlı? (hız)
   - Bu görevde iyi mi? (kalite)
3. **En iyisini seçer** — En yüksek puanlı sağlayıcı isteğinizi alır
4. **Otomatik olarak kurtarır** — Başarısız olursa Pusula otomatik olarak bir sonrakini dener

### Puanlama Sistemi

Her sağlayıcı 0 ile 1 arasında bir puan alır. Puan ne kadar yüksekse uygunluk o kadar iyidir.

| Etken           | Ağırlık | Anlamı                                                  |
| --------------- | ------- | ------------------------------------------------------- |
| Sağlık          | 20%     | Sağlayıcı çalışıyor mu? (devre kesici durumu)           |
| Kota            | 15%     | Kalan kapasitesi var mı?                                |
| Maliyet         | 15%     | Ne kadar pahalı? (daha ucuz = daha yüksek puan)         |
| Hız             | 12%     | Ne kadar hızlı? (daha düşük gecikme = daha yüksek puan) |
| Göreve Uygunluk | 8%      | Bu görev türünde iyi mi?                                |
| Kararlılık      | 5%      | Tutarlı mı? (düşük hata oranı)                          |
| Katman          | 5%      | Hesap katmanı (Ultra > Pro > Free)                      |
| Diğer           | 20%     | Bağlam yakınlığı, bağlantı yoğunluğu vb.                |

### Varyantlar Puanlamayı Nasıl Değiştirir?

Her varyant farklı ağırlıklar kullanır:

| Varyant        | Öncelik Verdiği Unsur | Temel Ağırlıklar                |
| -------------- | --------------------- | ------------------------------- |
| `auto`         | Dengeli               | health=20%, quota=15%, cost=15% |
| `auto/coding`  | Kalite                | taskFit=37%, stability=15%      |
| `auto/fast`    | Hız                   | latency=32%, health=28%         |
| `auto/cheap`   | Maliyet               | cost=37%                        |
| `auto/smart`   | Kalite + Keşif        | taskFit=37%, exploration=10%    |
| `auto/offline` | Kapasite              | quota=37%, health=28%           |

---

## Hataları Nasıl Yönetir?

Pusula, **üç koruma katmanına** sahiptir:

### 1. Otomatik Yedek Sağlayıcıya Geçiş

En iyi sağlayıcı başarısız olursa Pusula otomatik olarak bir sonrakini dener. Herhangi bir şey yapmanız gerekmez.

### 2. Kendi Kendini İyileştirme

Bir sağlayıcı sürekli başarısız oluyorsa:

- **Puan < 0.2** → 5 dakika boyunca hariç tutulur
- **Devre kesici açık** → Otomatik olarak hariç tutulur
- **Sağlayıcıların %50'sinden fazlası devre dışı** → Olay modu (keşif yapılmaz)

### 3. Acil Durum Yedek Sağlayıcısı

Tüm sağlayıcılar başarısız olursa Pusula, son çare olarak istekleri kararlı ve ücretsiz sağlayıcılara (Kiro veya Qoder gibi) yönlendirir.

---

## Çoklu Hesap Desteği

Aynı sağlayıcı için birden fazla hesabınız varsa (ör. iki OpenAI anahtarı), Pusula her birini **ayrı bir aday** olarak değerlendirir. Bunun anlamı şudur:

- Hesap A'nın kotası kaldı → kullan
- Hesap B hız sınırına takıldı → atla
- Hesap C daha ucuz → tercih et

Her hesap; kendi durumu, kotası ve hızı temel alınarak bağımsız şekilde puanlanır.

---

## Bandit Keşfi

Pusula, daha iyi seçenekler keşfetmek için zaman zaman yeni sağlayıcıları **dener**:

- **Varsayılan**: İsteklerin %5'i rastgele sağlayıcılara gider
- **Auto/smart**: %10 keşif oranı
- Sağlayıcıların %50'sinden fazlası sağlıksız olduğunda **devre dışı bırakılır**

Bu, Pusula'un kullanım örüntüleriniz için hangi sağlayıcıların en iyi sonucu verdiğini öğrenmesine yardımcı olur.

---

## Sık Sorulan Sorular

### "Her zaman en pahalı modeli mi seçer?"

**Hayır.** Maliyet, varsayılan olarak puanın yalnızca %15'ini oluşturur. Ucuz, hızlı ve sağlıklı bir sağlayıcı pahalı bir sağlayıcıyı geride bırakabilir. Maliyete daha fazla öncelik vermek istiyorsanız `auto/cheap` kullanın.

### "Bir sağlayıcı devre dışı kalırsa ne olur?"

Pusula onu otomatik olarak atlar ve bir sonraki sağlayıcıyı dener. Bir sağlayıcı sürekli başarısız olursa geçici olarak (5-30 dakika) hariç tutulur. Herhangi bir şey yapmanız gerekmez.

### "Hangi sağlayıcının kullanıldığını görebilir miyim?"

Yanıt üstbilgilerini kontrol edin — Pusula, her yanıtta kullanılan sağlayıcıyı ve modeli belirtir.

### "Kullanımımdan öğrenir mi?"

Evet! Puanlama sistemi, zaman içinde daha iyi kararlar vermek için geçmiş verileri (gecikme, hata oranları ve başarı oranları) kullanır.

### "`auto` ile `auto/smart` arasındaki fark nedir?"

- `auto` — Dengeli, %5 keşif
- `auto/smart` — Önce kalite (`auto/coding` ile aynı ağırlıklar), %10 keşif

En iyi kaliteyi istediğinizde ve ara sıra keşif yapılmasını sorun etmediğinizde `auto/smart` kullanın.

### "Belirli bir sağlayıcının kullanılmasını zorunlu kılabilir miyim?"

Evet! `auto` yerine `priority` stratejisine sahip bir kombinasyon kullanın, ardından kombinasyonun **tam adını** `model` alanı olarak gönderin (ör. `model: "my-combo"` — `auto` değil). Ayrıntılar için [Teknik Referans](../routing/AUTO-COMBO.md) bölümüne bakın.

### "Bunun round-robin yönteminden farkı nedir?"

Round-robin, sağlayıcılar arasında sırayla geçiş yapar. Auto-combo ise **her sağlayıcıyı puanlar** ve en iyisini seçer. Daha akıllıdır — sağlık durumunu, hızı, maliyeti ve kaliteyi dikkate alır.

---

## Sırada Ne Var?

- **[Bir Sağlayıcı Bağlayın](./PROVIDERS-GUIDE.md)** — İlk yapay zekâ sağlayıcınızı ekleyin
- **[Ücretsiz Katmanlar Rehberi](./FREE-TIERS-GUIDE.md)** — Kredi kartı olmadan ücretsiz yapay zekâ erişimi elde edin
- **[Sorun Giderme](../guides/TROUBLESHOOTING.md)** — Yaygın sorunları çözün
- **[Teknik Referans](../routing/AUTO-COMBO.md)** — Puanlama algoritmasını ayrıntılı olarak inceleyin

---

## Daha Fazla Bilgi

Geliştiriciler ve katkıda bulunanlar için aşağıdakiler hakkında [Auto-Combo Teknik Referansı](../routing/AUTO-COMBO.md) belgesine bakın:

- 16 faktörlü puanlama algoritmasının tamamı
- Mod paketi ağırlık tabloları
- Uygulama dosyası yolları
- API uç noktaları
- Kendi kendini iyileştiren algoritmanın ayrıntıları
