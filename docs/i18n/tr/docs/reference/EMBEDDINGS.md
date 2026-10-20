# Embeddings client runbook (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/EMBEDDINGS.md) · 🇩🇪 [de](../../../de/docs/reference/EMBEDDINGS.md) · 🇮🇷 [fa](../../../fa/docs/reference/EMBEDDINGS.md)

---

Pusula, Hindsight 0.9.1 (yalnızca metin destekleyen `encode(list[str])`) ve Memorix 1.6.0'ın (Jina medya geçidi) önünde yer aldığında `POST /v1/embeddings` için operatör notları. 2026-08-17 tarihinde Pusula 3.8.49 ve `https://pusula.jaguar-fish.ts.net/v1` üzerinde canlı olarak doğrulanmıştır. Aşağıda hiçbir gizli bilgi yoktur.

## Çalışan model kimlikleri

| İstemci kimliği                                | HTTP | Vektörler            | Boyut   | Notlar                                          |
| ---------------------------------------------- | ---- | -------------------- | ------- | ----------------------------------------------- |
| `openrouter/google/gemini-embedding-2`         | 200  | 2'li toplu işlem → 2 | 3072    | Yerel Gemini anahtarı olmadan çalışır           |
| `openrouter/google/gemini-embedding-2-preview` | 200  | 2'li toplu işlem → 2 | 3072    | Önizleme olmayan kimlikle aynı vektör uzayı     |
| `openrouter/google/gemini-embedding-001`       | 200  | 2'li toplu işlem → 2 | 3072    | `GET /v1/embeddings` içinde listelenir          |
| `jina-ai/jina-embeddings-v5-omni-small`        | 200  | 2'li toplu işlem → 2 | 1024    | Standart Jina omni kimliği                      |
| `jina/jina-embeddings-v5-omni-small`           | 200  | 2'li toplu işlem → 2 | 1024    | Takma ad; yanıttaki `model`, `jina-ai/...` olur |
| `jina-embeddings-v5-omni-small`                | 200  | 2'li toplu işlem → 2 | 1024    | Öneksiz kimlik de çözümlenir                    |
| `jina-ai/jina-embeddings-v5-omni-nano`         | 200  | 1 → 1                | **768** | Small'dan farklı bir vektör uzayı               |

`GET /v1/models` ve `GET /v1/embeddings`,
`jina-ai/jina-embeddings-v5-omni-small` (1024),
`jina-ai/jina-embeddings-v5-omni-nano` (768) ve
`openrouter/google/gemini-embedding-001` kimliklerini listeledi. Ancak bu kimlik
hâlihazırda hizmet veriyor olmasına rağmen
`openrouter/google/gemini-embedding-2` kimliğini listelemediler.

Nano (768 boyutlu) ve small (1024 boyutlu) modellerini aynı indekste
karıştırmayın. Birbirleriyle karşılaştırılabilir değillerdir.

## Bozuk / yanıltıcı kimlikler

### Yerel Gemini Embedding 2

İstek:

```json
{ "model": "gemini-embedding-2", "input": ["alpha", "beta"] }
```

Gerçek sonuç (2026-08-17): HTTP **400**

```json
{
  "error": {
    "message": "No credentials for embedding provider: gemini",
    "type": "invalid_request_error",
    "code": "bad_request"
  }
}
```

`gemini/gemini-embedding-2` aynı 400 yanıtını döndürür. Özel bir sağlayıcı
düğümü `google` önekini kullanmadığı sürece `google/gemini-embedding-2`,
HTTP **400** `Unknown embedding provider: google` yanıtını döndürür.

Beklenen: `gemini` sağlayıcısında bir Google AI Studio anahtarıyla yerel
Gemini gömme işlemi veya çalışan OpenRouter kimliğini belirten bir 400 yanıtı.

Yeniden oluşturma (bearer değerini gizleyin):

```bash
curl -sS -D- https://pusula.example/v1/embeddings \
  -H "Authorization: Bearer $PUSULA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-embedding-2","input":["alpha","beta"]}'
```

Çalışan alternatif:

```bash
curl -sS https://pusula.example/v1/embeddings \
  -H "Authorization: Bearer $PUSULA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openrouter/google/gemini-embedding-2","input":["alpha","beta"]}'
```

Yerel `gemini-embedding-2`, yalnızca GitOps aracılığıyla çalıştırılamaz. Bir
Google AI Studio anahtarı, `gemini` sağlayıcı bağlantısı olarak eklenmelidir
(pano veya Pusula'a içe aktarılan `GEMINI_API_KEY`). Bu gizli bilgi bu
depoda bulunmamaktadır.

### Jina çok modlu yolu

`POST /v1/multimodal-embeddings` → HTTP **404**

```json
{
  "error": {
    "message": "Unknown API route: /v1/multimodal-embeddings",
    "type": "not_found",
    "code": "unknown_route",
    "path": "/v1/multimodal-embeddings"
  }
}
```

Bir takma ad kullanıma sunulana kadar `POST /v1/embeddings` kullanın.

### Jina / Memorix görüntü nesnesi

Pusula standart görüntü öğesi (28×28 PNG, 784 piksel — Jina 1×1'i reddeder):

```json
{
  "model": "jina-ai/jina-embeddings-v5-omni-small",
  "input": [
    {
      "type": "image",
      "source": {
        "type": "base64",
        "data": "<base64-png>",
        "media_type": "image/png"
      }
    }
  ]
}
```

Gerçek sonuç: HTTP **200**, 1 vektör, 1024 boyutlu.

Memorix 1.6.0 / Jina yerel biçimi:

```json
{
  "model": "jina-ai/jina-embeddings-v5-omni-small",
  "input": [{ "image": "data:image/png;base64,<base64-png>" }]
}
```

Gerçek sonuç: HTTP **400**

```json
{
  "error": {
    "message": "Invalid request",
    "type": "invalid_request_error",
    "code": "bad_request"
  }
}
```

`{ "text": "..." }` ile `{ "image": "data:..." }` öğelerinin birlikte
kullanılması da aynı 400 yanıtını verir.

## İstemci notları

### Hindsight 0.9.1

Hindsight gömme işlemleri yalnızca metin destekler (`encode(list[str])`).
Görüntü nesneleri göndermez. Hindsight'ın OpenAI uyumlu gömme temel URL'sini
Pusula `/v1` olarak ayarlayın ve yukarıdaki tablodan çalışan bir kimlik
kullanın (`jina-ai/jina-embeddings-v5-omni-small` veya
`openrouter/google/gemini-embedding-2`). Ağ geçidinde bir `gemini` API
anahtarı bulunmadığı sürece modeli öneksiz `gemini-embedding-2` olarak
ayarlamayın.

### Memorix 1.6.0

Memorix yalnızca `/jina\.ai/i` ile eşleşen `baseUrl` değerlerini yerel medya
olarak işler. Model Jina omni olsa bile bir Pusula URL'si yalnızca metin
yolunda kalır. Bu geçit, Memorix istemcisiyle ilgili bir sorundur. Bundan
bağımsız olarak Pusula, geçit açılsaydı Memorix'in göndereceği Jina
`{image: "data:..."}` gövdesini yine reddeder; dolayısıyla Jina uyumlu
istemciler, standart `{type,source}` şeması olmadan Pusula üzerinden
görüntü gömme işlemi yapamaz.

Metin için `jina-ai/jina-embeddings-v5-omni-small` kullanın. Memorix
`base_url` değerini `https://api.jina.ai` olarak ayarlamayın — tek geçiş
noktası olarak Pusula'u kullanmaya devam edin.
