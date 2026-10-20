# Thinking Budget (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/THINKING_BUDGET.md) · 🇩🇪 [de](../../../de/docs/guides/THINKING_BUDGET.md) · 🇮🇷 [fa](../../../fa/docs/guides/THINKING_BUDGET.md)

---

> **Dashboard:** Ayarlar → **AI** → Düşünme Bütçesi  
> **API:** `GET` / `PUT` `/api/settings/thinking-budget`  
> **Kaynak:** `open-sse/services/thinkingBudget.ts`

Düşünme Bütçesi, Pusula'un sağlayıcılara giden istemci düşünme/akıl yürütme parametrelerini **yeniden yazıp yazmayacağını** kontrol eder. Sıkıştırmayı, yönlendirmeyi veya istem önbelleğini açıp kapatmaz.

## Modlar

| Mod                            | Pusula'un yaptığı                                                                                                       | Ne zaman kullanılmalı                                                                                                                                                                                  |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **`passthrough`** (varsayılan) | İstemci alanlarını olduğu gibi bırakır (`reasoning`, `reasoning_effort`, Claude `thinking`, Gemini `thinking_config` vb.). | **Codex / Desktop / çaba düzeyini ve akıl yürütme özetlerini kontrol etmesi gereken herhangi bir istemci.** İstemci `reasoning.summary` istediğinde görünür düşünme panelleri için gereklidir.         |
| **`auto`**                     | Yukarı akışa göndermeden önce istek gövdesindeki tüm düşünme/akıl yürütme alanlarını **kaldırır**.                         | Yalnızca varsayılanları **sağlayıcının** belirlemesini özellikle istediğiniz ve istemci kontrollü düşünmeye ihtiyaç duymadığınız durumlarda kullanın. “Düşünmeyi otomatik göster” anlamına **gelmez**. |
| **`custom`**                   | Her isteğin üzerine sabit bir düşünme token bütçesi yazar.                                                                 | Tüm trafik için düşünme tokenlarına katı bir üst sınır koymak amacıyla.                                                                                                                                |
| **`adaptive`**                 | Mesaj sayısı, araçlar ve istem uzunluğunu kullanarak bütçeyi temel bir çaba düzeyinden ölçeklendirir.                      | İstemci niyetini tamamen kaldırmadan esnek token kontrolü sağlamak amacıyla.                                                                                                                           |

### `auto` neleri kaldırır?

Mod `auto` olduğunda, `stripThinkingConfig()` diğerlerinin yanı sıra şunları siler:

- OpenAI / Responses: `reasoning`, `reasoning_effort`
- Claude: `thinking` ve mevcut olduğunda `output_config.effort`
- Gemini: `generationConfig.thinking_config` / `thinkingConfig`

Bir istemci (ör. Codex Desktop) `reasoning: { effort: "ultra", summary: "detailed" }` gönderdiyse **auto bu nesneyi kaldırır**. Yukarı akış yine de bazı akıl yürütme tokenlarını ücretlendirebilir ancak çoğunlukla **boş veya yalnızca şifrelenmiş** akıl yürütme öğeleri döndürür; dolayısıyla kullanıcı arayüzü yararlı bir düşünme akışı göstermez.

## Bu ne **değildir**

| Özellik                                              | İlişki                                                                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sıkıştırma** (Caveman, RTK, stacked, …)            | Ayrı bir işlem hattıdır. Her düşünme bütçesi modunda çalışır.                                                                                                 |
| **İstem / semantik önbellek**                        | Ayrıdır. Düşünme bütçesi modundan etkilenmez.                                                                                                                 |
| **Birleşik yönlendirme / geri dönüşler**             | Ayrıdır. Etkilenmez.                                                                                                                                          |
| **API anahtarı token sınırları / maliyet bütçeleri** | Ayrıdır. Etkilenmez.                                                                                                                                          |
| **Akıl yürütme yeniden oynatma önbelleği**           | Katı sağlayıcılar (DeepSeek, Kimi, Qwen-thinking, …) için çok turlu yeniden ekleme mekanizmasıdır. Desktop'taki “düşünmeyi göster” özelliğiyle aynı değildir. |
| **`encrypted_content` şifresini çözme**              | **İmkânsızdır.** OpenAI/Codex özel akıl yürütme blob'ları opaktır. Pusula bunların şifresini asla çözmez (#7095 / #7176 / #7304).                          |

## Görünür düşünme (Codex / Responses istemcileri)

Bir istemcinin düşünme metnini göstermesi için aşağıdakilerin **tümünün** sağlanması gerekir:

1. Thinking Budget modu = **`passthrough`** (veya kullandığınız yol için özet isteklerini yeterince değiştirmeden bırakan custom/adaptive).
2. İstemci bir özet ister; ör. Codex `model_reasoning_summary = "detailed"` / `auto` (`none` değil).
3. Üst sağlayıcı gerçekten `response.reasoning_summary_text.*` akışı gönderir (veya öğede boş olmayan bir `reasoning.summary` bulunur).

Yalnızca “şifrelenmiş özel akıl yürütme” alıyorsanız:

- mod **`auto`** idi (istemci isteği kaldırıldı) veya
- üst sağlayıcı özet metni olmadan `encrypted_content` döndürdü (sağlayıcı kısıtlaması; Pusula yalnızca bir yer tutucu gösterebilir, düz metni gösteremez).

## API örnekleri

```bash
# Oku
curl -sS https://localhost:20128/api/settings/thinking-budget \
  -H "Authorization: Bearer $PUSULA_TOKEN"

# Codex / Desktop düşünme görünürlüğü için önerilen
curl -sS -X PUT https://localhost:20128/api/settings/thinking-budget \
  -H "Authorization: Bearer $PUSULA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"passthrough","customBudget":10240,"effortLevel":"medium"}'
```

Şema (`updateThinkingBudgetSchema`): `mode` ∈ `passthrough|auto|custom|adaptive`; isteğe bağlı `customBudget`, `effortLevel`, `baseBudget`, `complexityMultiplier`.

### Kalıcılık / yeniden başlatma

Değer, `thinkingBudget` ayarlar anahtarı altında saklanır ve işlem başlangıcında yüklenir (`hydrateThinkingBudgetConfig`). DB veya API dışındaki bazı yollar üzerinden değişiklik yaptıktan sonra, bellekteki singleton'ın diskle eşleşmesi için **Pusula işlemini yeniden başlatın**.

## Operatör kontrol listesi

- [ ] Codex / Desktop kullanıcıları: mod = **passthrough**
- [ ] Düşünmeyi kaldırarak değil, **mesajlarda** token tasarrufu sağlamak istiyorsanız sıkıştırmayı etkin tutun
- [ ] `auto` modunun “daha fazla düşünme göstermesini” beklemeyin
- [ ] Yalnızca şifrelenmiş özetler bir **sağlayıcı** davranışıdır; passthrough bunların şifresini çözemez

## İlgili belgeler

- [REASONING_REPLAY.md](../routing/REASONING_REPLAY.md) — çok turlu `reasoning_content` önbelleği
- [USER_GUIDE.md](./USER_GUIDE.md) — Ayarlar panosu sekmeleri
- [API_REFERENCE.md](../reference/API_REFERENCE.md) — ayarlar uç noktaları
