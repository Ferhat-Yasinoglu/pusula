# Chaos Mode (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CHAOS-MODE.md) · 🇩🇪 [de](../../../de/docs/guides/CHAOS-MODE.md) · 🇮🇷 [fa](../../../fa/docs/guides/CHAOS-MODE.md)

---

> **Kontrol Paneli:** **Kaos Modu** (kenar çubuğu) → `/dashboard/chaos`  
> **API:** `GET` / `PUT` `/api/chaos/config` · `POST /api/chaos/run` (kontrol paneli oturumu) · `POST /api/skills/collect/chaos` (API anahtarı)  
> **Kaynak:** `src/lib/chaos/chaosExecutor.ts`, `src/lib/chaos/chaosConfig.ts`

Kaos Modu, **tek bir görevi aynı anda birden fazla sağlayıcıya gönderir** — katılan her sağlayıcı
bir model örneğiyle katkıda bulunur ve tüm yanıtları yan yana (veya zincirlenmiş olarak) alırsınız.
Bu, bir yönlendirme stratejisi değil, çok modelli bir yürütme yüzeyidir: normal
`/v1/chat/completions` trafiğiniz bundan hiçbir zaman etkilenmez.

**Açıklama — adında "chaos" geçen üç farklı şey sunulur:**

| Şey                        | Nedir                                                                                                                                    | Belgelendiği yer                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **Kaos Modu**              | Burada açıklanan kontrol paneli sayfası + API: tek görevi birçok sağlayıcıya dağıtır (paralel veya iş birlikli).                         | Bu kılavuz                                   |
| `auto/chaos`               | Dayanıklılık testi için hata enjeksiyonu puanlama ağırlıklarına sahip bir Auto-Combo model kimliği. Yapılandırılacak bir şey yoktur.     | [AUTO-COMBO.md](../routing/AUTO-COMBO.md)    |
| Chaos combo yapılandırması | `config.chaos.enabled` ayarıyla, isteği isteğe bağlı bir değerlendirici model içeren bir panele dağıtan kalıcı bir combo (yalnızca API). | `open-sse/services/autoCombo/chaosEngine.ts` |

## Kurulum

1. **Kontrol Paneli → Kaos Modu** (`/dashboard/chaos`) sayfasını açın.
2. Özelliği **açın** — Kaos Modu varsayılan olarak **devre dışı** gelir (`enabled: false`,
   `src/lib/chaos/chaosConfig.ts` içinde). Devre dışıyken `POST /api/chaos/run`,
   `400 — "Chaos Mode is not enabled. Enable it in Dashboard → Chaos Mode."` yanıtını verir.
3. Katılımcıları ve varsayılanları seçin (ayar deposu aracılığıyla her örnek için kalıcı olarak saklanır):

   | Alan                | Anlamı                                                                     | Varsayılan / sınırlar                      |
   | ------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
   | `enabled`           | Ana anahtar                                                                | `false`                                    |
   | `defaultMode`       | `parallel` veya `collaborative` (aşağıya bakın)                            | `parallel`                                 |
   | `providerOverrides` | Sağlayıcı başına katılım (`providerId`, isteğe bağlı `modelId`, `enabled`) | boş = tüm etkin sağlayıcılar, en fazla 200 |
   | `systemPrompt`      | Yerleşik Chaos sistem istemini geçersiz kılar                              | isteğe bağlı, en fazla 10 000 karakter     |
   | `timeoutMs`         | Model çağrısı başına azami süre                                            | `120000` (5 000–600 000)                   |
   | `maxTokens`         | Model çağrısı başına `max_tokens`                                          | `4096` (256–128 000)                       |

4. **Doğrudan sayfadan bir test çalıştırın** — sonuçlar paneli her sağlayıcının yanıtını,
   durumunu ve süresini gösterir.

## Yürütme modları

- **`parallel`** — her model aynı görevi eş zamanlı olarak alır; tüm yanıtları birbirinden
  bağımsız şekilde alırsınız.
- **`collaborative`** — modeller **bir zincir hâlinde** çalışır: her biri önceki modelin çıktısını
  görür ve bunu iyileştirmesi, genişletmesi, eleştirmesi veya bir alternatif sunması istenir. Yanıtın
  `summary` alanı, başarılı çıktıları zincir sırasına göre birleştirir (paralel çalıştırmalarda
  `summary` bulunmaz).

## API

### `POST /api/chaos/run` — kontrol paneli oturumu

Çerezle kimlik doğrulaması yapılır (yönetim oturumu —
[MANAGEMENT-AUTH.md](MANAGEMENT-AUTH.md) dosyasına bakın); kontrol paneli sayfası tarafından kullanılır.

```jsonc
// gövde
{
  "task": "X'e yönelik yaklaşımları karşılaştır", // zorunlu
  "providers": ["glm", "kimi"], // isteğe bağlı filtre
  "mode": "parallel", // isteğe bağlı — defaultMode değerini geçersiz kılar
  "systemPrompt": "…", // isteğe bağlı geçersiz kılma
  "maxTokens": 4096, // isteğe bağlı geçersiz kılma
}
```

### `POST /api/skills/collect/chaos` — API anahtarı

Harici çağıranlar için Bearer belirteci çeşididir. Anahtarın **Kaos Modu iznine**
(`chaosModeEnabled`) sahip olması gerekir; bu izin **varsayılan olarak kapalıdır** — her anahtar için
**Kontrol Paneli → API Yöneticisi → anahtarı düzenle → izinler → Kaos Modu** bölümünden etkinleştirin.
Gövde yukarıdakiyle aynıdır.

```bash
curl -X POST http://localhost:20128/api/skills/collect/chaos \
  -H "Authorization: Bearer $PUSULA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task":"Compare approaches to X","mode":"parallel"}'
```

Her iki uç nokta da aynı yapıda yanıt döndürür:

```jsonc
{
  "task": "…",
  "mode": "parallel",
  "startedAt": "2026-09-01T00:00:00.000Z",
  "totalProviders": 3,
  "totalResults": 3,
  "models": [
    {
      "providerId": "glm",
      "providerName": "GLM",
      "modelId": "glm-4.7",
      "status": "success",
      "content": "…",
      "durationMs": 3210,
    },
  ],
  "summary": "…", // yalnızca collaborative modu
}
```

## Sorun giderme

- **`400 Chaos Mode is not enabled`** — yukarıdaki 2. adıma bakın: genel anahtar kapalıdır.
- **API anahtarı `/api/skills/collect/chaos` üzerinde reddediliyor** — anahtarda, anahtara özel
  `chaosModeEnabled` izni yoktur (varsayılan olarak kapalıdır; bu bir ayardır, hata değildir).
- **Beklediğiniz bir sağlayıcı sonuçlarda yok** — Kaos Modu sayfasındaki `providerOverrides`
  ayarını (devre dışı bırakılmış bir geçersiz kılma, sağlayıcıyı hariç tutar) ve sağlayıcı
  bağlantısının etkin olup olmadığını kontrol edin.
