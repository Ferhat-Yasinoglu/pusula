# Embeddings client runbook (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/EMBEDDINGS.md) · 🇮🇷 [fa](../../../fa/docs/reference/EMBEDDINGS.md) · 🇹🇷 [tr](../../../tr/docs/reference/EMBEDDINGS.md)

---

Hinweise für Betreiber zu `POST /v1/embeddings`, wenn Pusula vor
Hindsight 0.9.1 (nur Text, `encode(list[str])`) und Memorix 1.6.0 (Jina-Medien-
Gate) geschaltet ist. Live verifiziert am 2026-08-17 mit Pusula 3.8.49 unter
`https://pusula.jaguar-fish.ts.net/v1`. Nachfolgend keine Geheimnisse.

## Funktionierende Modell-IDs

| Client-ID                                      | HTTP | Vektoren    | Dimension | Hinweise                                         |
| ---------------------------------------------- | ---- | ----------- | --------- | ------------------------------------------------ |
| `openrouter/google/gemini-embedding-2`         | 200  | Batch 2 → 2 | 3072      | Funktioniert ohne nativen Gemini-Schlüssel       |
| `openrouter/google/gemini-embedding-2-preview` | 200  | Batch 2 → 2 | 3072      | Derselbe Vektorraum wie bei der Nicht-Preview-ID |
| `openrouter/google/gemini-embedding-001`       | 200  | Batch 2 → 2 | 3072      | In `GET /v1/embeddings` aufgeführt               |
| `jina-ai/jina-embeddings-v5-omni-small`        | 200  | Batch 2 → 2 | 1024      | Kanonische Jina-Omni-ID                          |
| `jina/jina-embeddings-v5-omni-small`           | 200  | Batch 2 → 2 | 1024      | Alias; `model` in der Antwort ist `jina-ai/...`  |
| `jina-embeddings-v5-omni-small`                | 200  | Batch 2 → 2 | 1024      | Auch die bloße ID wird aufgelöst                 |
| `jina-ai/jina-embeddings-v5-omni-nano`         | 200  | 1 → 1       | **768**   | Anderer Vektorraum als bei small                 |

`GET /v1/models` und `GET /v1/embeddings` führten
`jina-ai/jina-embeddings-v5-omni-small` (1024),
`jina-ai/jina-embeddings-v5-omni-nano` (768) und
`openrouter/google/gemini-embedding-001` auf. Sie führten
`openrouter/google/gemini-embedding-2` **nicht** auf, obwohl diese ID bereits Anfragen verarbeitet.

Nano (768-dimensional) und small (1024-dimensional) dürfen nicht in einem Index
gemischt werden. Sie sind nicht vergleichbar.

## Defekte / irreführende IDs

### Natives Gemini Embedding 2

Anfrage:

```json
{ "model": "gemini-embedding-2", "input": ["alpha", "beta"] }
```

Tatsächliches Ergebnis (2026-08-17): HTTP **400**

```json
{
  "error": {
    "message": "No credentials for embedding provider: gemini",
    "type": "invalid_request_error",
    "code": "bad_request"
  }
}
```

`gemini/gemini-embedding-2` gibt denselben 400-Fehler zurück. `google/gemini-embedding-2`
gibt HTTP **400** mit `Unknown embedding provider: google` zurück, sofern kein
benutzerdefinierter Provider-Knoten das Präfix `google` verwendet.

Erwartet: entweder ein natives Gemini-Embedding mit einem Google-AI-Studio-Schlüssel beim
Provider `gemini` oder ein 400-Fehler, der die funktionierende OpenRouter-ID nennt.

Reproduktion (Bearer-Token schwärzen):

```bash
curl -sS -D- https://pusula.example/v1/embeddings \
  -H "Authorization: Bearer $PUSULA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gemini-embedding-2","input":["alpha","beta"]}'
```

Funktionierender Ersatz:

```bash
curl -sS https://pusula.example/v1/embeddings \
  -H "Authorization: Bearer $PUSULA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"openrouter/google/gemini-embedding-2","input":["alpha","beta"]}'
```

Das native `gemini-embedding-2` kann nicht allein über GitOps zum Funktionieren gebracht werden. Ein Google-AI-
Studio-Schlüssel muss als Provider-Verbindung vom Typ `gemini` hinzugefügt werden (Dashboard oder
in Pusula importierter `GEMINI_API_KEY`). Dieses Geheimnis befindet sich nicht in diesem Repository.

### Multimodaler Jina-Pfad

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

Verwenden Sie `POST /v1/embeddings`, bis ein Alias vorhanden ist.

### Jina-/Memorix-Bildobjekt

Kanonisches Pusula-Bildelement (28×28-PNG, 784 Pixel — Jina lehnt 1×1 ab):

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

Tatsächliches Ergebnis: HTTP **200**, 1 Vektor, 1024-dimensional.

Natives Format von Memorix 1.6.0 / Jina:

```json
{
  "model": "jina-ai/jina-embeddings-v5-omni-small",
  "input": [{ "image": "data:image/png;base64,<base64-png>" }]
}
```

Tatsächliches Ergebnis: HTTP **400**

```json
{
  "error": {
    "message": "Invalid request",
    "type": "invalid_request_error",
    "code": "bad_request"
  }
}
```

`{ "text": "..." }` gemischt mit `{ "image": "data:..." }` führt zum selben 400-Fehler.

## Hinweise zu Clients

### Hindsight 0.9.1

Hindsight-Embeddings unterstützen nur Text (`encode(list[str])`). Hindsight sendet keine
Bildobjekte. Richten Sie die OpenAI-kompatible Embeddings-Basis-URL von Hindsight auf
Pusula `/v1` und verwenden Sie eine funktionierende ID aus der obigen Tabelle
(`jina-ai/jina-embeddings-v5-omni-small` oder
`openrouter/google/gemini-embedding-2`). Setzen Sie das Modell nicht auf die bloße ID
`gemini-embedding-2`, sofern auf dem Gateway kein `gemini`-API-Schlüssel vorhanden ist.

### Memorix 1.6.0

Memorix behandelt nur eine mit `/jina\.ai/i` übereinstimmende `baseUrl` als native Medienquelle. Eine
Pusula-URL verbleibt auf dem Nur-Text-Pfad, selbst wenn das Modell Jina omni ist.
Dieses Gate ist ein Problem des Memorix-Clients. Unabhängig davon lehnt Pusula weiterhin
den Jina-Body `{image: "data:..."}` ab, den Memorix senden würde, wenn sich das Gate
öffnete. Daher können Jina-kompatible Clients ohne das kanonische Schema
`{type,source}` keine Bilder über Pusula einbetten.

Verwenden Sie `jina-ai/jina-embeddings-v5-omni-small` für Text. Richten Sie die Memorix-
`base_url` nicht auf `https://api.jina.ai` — behalten Sie Pusula als einzige Zwischenstation bei.
