# Cursor Image Generation (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CURSOR_IMAGE.md) · 🇩🇪 [de](../../../de/docs/providers/CURSOR_IMAGE.md) · 🇮🇷 [fa](../../../fa/docs/providers/CURSOR_IMAGE.md)

---

Pusula, sohbetle aynı sağlayıcı kimliği üzerinden `POST /v1/images/generations` uç noktasında Cursor planı **görsel oluşturma** özelliğini sunar: `cursor` (`cu` diğer adıyla).

| Alan                      | Değer                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `IMAGE_PROVIDERS` kimliği | `cursor`                                                                                   |
| Biçim                     | `cursor-agent-image`                                                                       |
| Kimlik doğrulama          | Sohbetle aynı OAuth / API anahtarı bağlantısı (`provider_connections.provider = "cursor"`) |
| Modeller                  | `cursor/auto`, `cursor/composer-2`, `cursor/composer-2.5`                                  |

## Neden Agent CLI

Pusula'taki Cursor sohbeti `agent.v1.AgentService/Run` (protobuf) kullanır. Bu yol, yerleşik istemci araçlarını (shell, write, …) **reddeder**. Görsel oluşturma, lisans üzerinden **`agent` CLI** tarafından yürütülen Cursor'a özgü bir araçtır. Bu nedenle görsel işleyicisi, kilitlenmiş bir istem ve istek başına geçici bir çalışma alanıyla `agent` sürecini başlatır (topluluk lisans köprüleriyle aynı yapıda) ve ardından OpenAI uyumlu `b64_json` döndürür.

## Erişim kısıtlaması (Katı Kurallar #15 + #17)

Bu, bir alt süreç (`agent` ikili dosyası) başlatan tek `IMAGE_PROVIDERS`
biçimidir. `POST /v1/images/generations`, uzak çağrı yapanların meşru biçimde
kullandığı, süreç başlatmayan yaklaşık 40 başka görsel sağlayıcısı tarafından paylaşıldığından
tüm rota `LOCAL_ONLY` olarak sınıflandırılmaz. Bunun yerine
`handleCursorAgentImageGeneration`, yetkilendirme işlem hattının her isteğe eklediği
güvenilir `AUTHZ_HEADER_PEER_LOCALITY` kararını kullanarak kendi erişim denetimini uygular
(sahtecilik yapılabilen `Host` başlığından değil, gerçek TCP eşinden): yalnızca
`loopback` ve `lan` çağrıları süreç başlatma aşamasına ulaşabilir; diğer tüm çağrılar
(herkese açık bir tünel üzerinden yeniden kullanılan sızdırılmış bir API anahtarı dâhil),
herhangi bir kimlik bilgisi araması veya süreç başlatma gerçekleşmeden önce `403` alır.
`LOCAL_ONLY` katmanının geri kalanına uygulanan aynı politika için
`src/server/authz/policies/management.ts` dosyasına bakın.

## Eşzamanlılık denetimi modül düzeyindedir (tek örnek sınırlaması)

`CURSOR_IMG_MAX_CONCURRENT`, Node modülü örneği kapsamında tutulan bellek içi bir
sayaç/kuyruk tarafından uygulanır (`open-sse/handlers/imageGeneration/providers/cursorAgentImage.ts`).
Tek bir Pusula süreci içindeki eşzamanlı `agent` süreç başlatmalarını doğru biçimde
sınırlar ancak aynı Cursor lisansını paylaşan birden fazla süreç/örnek arasında
(ör. çok replikalı bir dağıtımda) koordinasyon **sağlamaz** — her örnek kendi bağımsız
sınırını uygular. Tek örnekli bir dağıtımda (varsayılan) bu sınır kesindir; yatay olarak
ölçeklendirilmiş dağıtımlar, örnek başına `CURSOR_IMG_MAX_CONCURRENT` değerini ihtiyatlı
tutmalı veya Cursor görsel trafiğini tek bir örneğe yönlendirmelidir.

## Gereksinimler

1. Kontrol panelinde bağlı bir Cursor hesabı (OAuth veya `crsr_…` API anahtarı).
2. Cursor Agent ikili dosyasının Pusula süreci tarafından kullanılabilir olması:
   - env `CURSOR_AGENT_BIN=/path/to/agent`, veya
   - `~/.local/bin/agent`, veya
   - Cursor bağlantısında `providerSpecificData.agentBin`.

İsteğe bağlı ayarlar:

| Env                         | Varsayılan              | Anlamı                                       |
| --------------------------- | ----------------------- | -------------------------------------------- |
| `CURSOR_IMG_TIMEOUT_MS`     | `210000`                | Görsel başına geçen gerçek süre              |
| `CURSOR_IMG_MAX_CONCURRENT` | `2`                     | Paylaşılan lisans için eşzamanlılık denetimi |
| `CURSOR_IMG_MODEL`          | (istek modeli / `auto`) | CLI `--model` değerini geçersiz kıl          |

## Örnek

```bash
curl -sS https://<host>/v1/images/generations \
  -H "Authorization: Bearer <pusula-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","prompt":"a lantern in fog","size":"1024x1024"}'
```

Oluşturma işlemi genellikle 1–2 dakika sürer. Dahili bir ağ yolunu tercih edin; yaklaşık 100 saniyelik zaman aşımına sahip uç proxy'ler başarısız olur.

## LiteLLM

`mode: image_generation`, `api_base: http://pusula:20128/v1` ve `model: openai/cursor/auto` (veya LiteLLM sürümünüze bağlı olarak yalın `cursor/auto`) ile bir görsel modeli kaydedin.
