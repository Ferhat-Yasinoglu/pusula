# Pusula Tiers — User Guide (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/TIERS.md) · 🇩🇪 [de](../../../de/docs/guides/TIERS.md) · 🇮🇷 [fa](../../../fa/docs/guides/TIERS.md)

---

Pusula, desteklenen 352 sağlayıcıyı 3 ekonomik kademede düzenler. Her
istek, biri başarıyla yanıt verene kadar sırayla bu kademelerden geçer — hiçbir
geri dönüş kodu yazmadan kullanılabilir en ucuz yanıtı alırsınız.

## Kademe 1 — Abonelik

**Ücretini zaten ödediğiniz sağlayıcılar.** Pusula, süresi dolmadan önce
kotanın tamamını kullanır.

| Sağlayıcı                        | Neden Kademe 1                                      |
| -------------------------------- | --------------------------------------------------- |
| Claude Code OAuth                | Anthropic Pro/Team — sabit ücretli, genellikle atıl |
| OpenAI Codex (ChatGPT aboneliği) | Plus/Team, Codex kotası içerir                      |
| GitHub Copilot                   | Kullanıcı başına — kota aylık olarak sıfırlanır     |
| Cursor IDE                       | Pro planı kotası                                    |
| Antigravity / Devin Desktop      | Yerleşik kotalar                                    |

**Strateji**: modelin güçlü yönlerine uyan her isteği önce buraya yönlendirin.
Kota izleyici, yaklaşan sıfırlamaları takip eder ve `reset-aware`
birleşik stratejisi buna göre öncelik verir. Önce Kademe 1'e yönlendirmek ve
yalnızca kota tükendikçe ücretli kademelere geçmek için `auto/thrifty` kimliğini
kullanın; bunun yerine yalnızca plana dahil kapasitede kalmak ve kapasite yoksa
başarısız olmak için `auto/subscription` kullanın. Bkz.
[Önce abonelik yönlendirmesi](../routing/SUBSCRIPTION_LADDER.md).

## Kademe 2 — Ucuz

**1 milyon token başına $1'ın altındaki, token başına ücretlendirilen sağlayıcılar.**
Yüksek hacimli işler için veya Kademe 1 kotaları sınıra ulaştıktan sonra kullanılır.

| Sağlayıcı                 | Fiyat (girdi/çıktı)     | Güçlü yönleri       |
| ------------------------- | ----------------------- | ------------------- |
| DeepSeek V4 Pro           | 1M başına $0.27 / $1.10 | Kod, akıl yürütme   |
| GLM-4.5                   | 1M başına $0.60 / $2.20 | Uzun bağlam         |
| MiniMax M1                | 1M başına $0.20 / $1.10 | Hız                 |
| Qwen Coder                | 1M başına $0.30 / $1.20 | Kod                 |
| OpenRouter (fiyat odaklı) | değişken                | 100+ model, dinamik |

**Strateji**: `cost-optimized` birleşimi, görevin yetenek filtresini (görüntü,
JSON modu, araçlar, maksimum bağlam) karşılayan en düşük $/token maliyetli modeli seçer.

## Kademe 3 — Ücretsiz

**Sıfır maliyetli sağlayıcılar** — ücretsiz kademeler, kredi programları,
OAuth günlük kotaları.

| Sağlayıcı        | Ücretsiz kota / krediler                        |
| ---------------- | ----------------------------------------------- |
| Kiro AI          | Ücretsiz Claude kademesi (cömert adil kullanım) |
| Qoder            | Ücretsiz OAuth                                  |
| Google Vertex AI | Yeni hesaplar için $300 kredi                   |
| Amazon Q         | AWS kullanıcıları için ücretsiz kademe          |
| Pollinations     | Açık genel API                                  |
| Cloudflare AI    | Workers AI ücretsiz kademesi                    |

**Strateji**: bütçe sınırına sahip `auto` birleşimi, Kademe 1+2 başarısız olduğunda
veya `useFreeOnly=true` ayarlandığında istekleri buraya yönlendirir. Ücretsiz
sağlayıcıların hız sınırları genellikle daha düşüktür — devre kesici, geri
çekilme süresinden sonra bunları yeniden kullanılabilir hâle getirir.

## Kademeleri yapılandırma

Kontrol Paneli → **Kademeler** → sağlayıcılarınızı atayın. Varsayılanlar
(`tierDefaults.json` dosyasından) makuldür; öncelik vermek istediğiniz belirli
abonelikler veya hariç tutmak istediğiniz sağlayıcılar olduğunda bunları düzenleyin.

Auto-Combo'nun 16 faktörlü puanlaması kademeyi de dikkate alır. Bkz.
[`docs/routing/AUTO-COMBO.md`](../routing/AUTO-COMBO.md).

## Telemetri

Kontrol Paneli → **Kullanım**, kademe başına günlük harcanan token miktarını gösterir.
Bunu şu amaçlarla kullanın:

- Kademe 1'in tam olarak kullanıldığını doğrulamak (aksi hâlde abonelik değerini boşa harcıyorsunuz)
- En çok hangi Kademe 2 modellerinin seçildiğini belirlemek (1-2 modelde birleştirin)
- Kademe 3'ün test/keşif iş yüklerinde tasarruf sağladığını doğrulamak

## Yaygın kalıplar

### Tamamen ücretsiz iş yükü

```json
{
  "strategy": "auto",
  "config": { "auto": { "weights": { "costInv": 0.5, "tierPriority": 0.3 } } }
}
```

Güçlü biçimde Kademe 3'e yönlendirir; Kademe 2'yi yalnızca Kademe 3 kullanılamıyorsa kullanır.

### Ucuz geri dönüş seçeneğiyle önce abonelik

```json
{
  "strategy": "priority",
  "targets": [
    { "provider": "claude-code-oauth", "weight": 1 },
    { "provider": "deepseek", "weight": 1 },
    { "provider": "kiro", "weight": 1 }
  ]
}
```

Kademe 1 → Kademe 2 → Kademe 3 sırasıyla eşleşen açıkça tanımlanmış liste.
