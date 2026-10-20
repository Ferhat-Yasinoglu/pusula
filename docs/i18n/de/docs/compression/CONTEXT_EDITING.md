# Delegated Context Editing (Anthropic) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../compression/CONTEXT_EDITING.md) · 🇮🇷 [fa](../../../fa/docs/compression/CONTEXT_EDITING.md) · 🇹🇷 [tr](../../../tr/docs/compression/CONTEXT_EDITING.md)

---

Delegiertes **Context Editing** ist eine ausschließlich für Claude verfügbare Funktion zur Kontextverwaltung. Im Gegensatz zu den lokalen Komprimierungs-Engines von Pusula (Caveman, RTK, LLMLingua, gestapelte Pipelines) — die den Request-Body umschreiben, _bevor_ er den Proxy verlässt — weist Context Editing den **Provider** an, veraltete Tool-Use-/Tool-Result-Blöcke aus seinem eigenen laufenden Kontextfenster zu entfernen. Pusula fügt lediglich einen Body-Parameter (`context_management.edits[]`) hinzu; Claude führt die eigentliche Bereinigung anhand seines eigenen Tokenizers durch.

Diese Funktion ist ihrem Wesen nach delegiert: Andere Provider lehnen den Parameter ab, daher beschränkt Pusula sie strikt auf Claude und Claude-Code-kompatible Relays.

Verbindliche Referenz: `open-sse/config/contextEditing.ts` (Strategie-IDs, Body-Injektion, Telemetrieextraktion), `open-sse/executors/base.ts` (Injektions-Gate + 400-Fallback) und `open-sse/services/compression/types.ts` (Konfigurationsstruktur + Standardwert).

## Funktionsweise von `clear_tool_uses`

Pusula injiziert eine einzelne Bearbeitung in den ausgehenden Anthropic-Messages-Body:

```json
{
  "context_management": {
    "edits": [
      {
        "type": "clear_tool_uses_20250919",
        "trigger": { "type": "input_tokens", "value": 100000 },
        "keep": { "type": "tool_uses", "value": 3 }
      }
    ]
  }
}
```

- `type: "clear_tool_uses_20250919"` — die datierte Anthropic-Strategie-ID (`CLEAR_TOOL_USES_STRATEGY`).
- `trigger.value: 100000` — sobald die Eingabe-Tokens des Requests diesen Schwellenwert überschreiten, beginnt Claude damit, alte Tool-Use-/Result-Paare zu entfernen (`CONTEXT_EDITING_DEFAULT_TRIGGER_TOKENS`, der Standardwert von Anthropic).
- `keep.value: 3` — die N neuesten Tool-Use-/Result-Paare bleiben unverändert erhalten (`CONTEXT_EDITING_DEFAULT_KEEP_TOOL_USES`).

Die Beta wird über den Header `anthropic-beta: context-management-2025-06-27` angekündigt, den Pusula bereits bei Claude-Requests ausgibt.

Die Injektion erfolgt durch `applyContextEditingToBody()` und ist **idempotent**: Wenn im Body bereits eine `clear_tool_uses`-Bearbeitung vorhanden ist (durch einen vorherigen Aufruf hinzugefügt oder vom Client bereitgestellt), bleibt der Body unverändert. Wenn außerdem eine `clear_thinking_20251015`-Bearbeitung vorhanden ist, sortiert Pusula die `clear_thinking`-Bearbeitung stabil an den Anfang, da Anthropic verlangt, dass `clear_thinking` vor `clear_tool_uses` im Array `edits[]` steht.

## Der Aktivierungsschalter pro Kombination

Context Editing ist **standardmäßig deaktiviert** und muss explizit aktiviert werden. Der Schalter ist ein einzelner boolescher Wert in der Komprimierungskonfiguration:

- Einstellungsschlüssel: `contextEditing.enabled` (camelCase — **nicht** `context_editing` / `context-editing`).
- Typ: `ContextEditingConfig { enabled: boolean }` in `open-sse/services/compression/types.ts`.
- Standardwert: `DEFAULT_CONTEXT_EDITING_CONFIG = { enabled: false }`.
- Zod-Schema: `contextEditingConfigSchema` in `src/shared/validation/compressionConfigSchemas.ts`.
- Speicherung: Wird zusammen mit den übrigen Komprimierungseinstellungen persistiert (normalisiert in `src/lib/db/compression.ts`).

Im Dashboard befindet sich der Schalter im Komprimierungs-Hub (`src/app/(dashboard)/dashboard/context/combos/CompressionHub.tsx`) und schreibt über `saveSettings()` den Wert `{ contextEditing: { enabled: … } }` zurück. Da er Teil des Objekts für Komprimierungseinstellungen ist, wird er mit dem Komprimierungsprofil der jeweiligen Kombination zusammengeführt, anstatt eine vollständig unabhängige Einstellungsoberfläche zu bilden — die Konfiguration enthält nur das Ein-/Aus-Flag; sämtliche Schwellenwerte (`trigger`, `keep`) entsprechen den oben dokumentierten Konstanten.

## Nur-Claude-Gating

Die Injektion erfolgt nur für echte Claude- oder Claude-Code-kompatible Relays. Das Gate in
`open-sse/executors/base.ts` lautet:

```ts
if (
  (this.provider === "claude" || isClaudeCodeCompatible(this.provider)) &&
  contextEditing?.enabled &&
  !contextEditingDisabled
) {
  applyContextEditingToBody(transformedBody, { enabled: true });
}
```

- `this.provider === "claude"` — echter Anthropic-Schlüssel/OAuth.
- `isClaudeCodeCompatible(this.provider)` — Relays, deren Provider-ID mit dem Präfix
  `anthropic-compatible-cc-` beginnt (sie weisen Claude-Code-Kompatibilität aus und sind daher die
  Relays, die die Beta am wahrscheinlichsten akzeptieren). Siehe `open-sse/services/provider.ts`.

Bewusst **ausgeschlossen**:

- `claude-web` — ein Browser-Relay mit einer `create_conversation_params`-Anfragestruktur, die
  `context_management` nie sieht.
- Generische `anthropic-compatible-*`-Relays (ohne das Präfix `-cc-`) — Drittanbieter-Endpunkte mit
  ungewisser Beta-Unterstützung.

Nicht-Claude-Provider erhalten den Parameter `context_management` niemals, selbst wenn der Schalter aktiviert ist.

## Der 400-Fallback / Relay-Abdeckung

Ein Claude-kompatibles Relay kann die Beta ausweisen, den Parameter `context_management` jedoch
trotzdem mit HTTP 400 ablehnen. Um die Funktionalität kontrolliert zu reduzieren, statt die Anfrage
fehlschlagen zu lassen, entfernt der Executor den Parameter und wiederholt die Anfrage an dieselbe
URL **einmal**:

```ts
if (
  response.status === HTTP_STATUS.BAD_REQUEST &&
  contextEditing?.enabled &&
  !contextEditingDisabled &&
  transformedBody?.context_management !== undefined
) {
  const errText = await response
    .clone()
    .text()
    .catch(() => "");
  if (/context[_-]management|context editing/i.test(errText)) {
    contextEditingDisabled = true;
    delete transformedBody.context_management;
    let retryBody = JSON.stringify(transformedBody);
    if (isClaudeCodeCompatible(this.provider) || this.provider === "claude") {
      retryBody = await signRequestBody(retryBody);
    }
    response = await fetch(url, { ...fetchOptions, body: retryBody });
  }
}
```

Verhalten:

1. Wird nur bei einem `400` ausgelöst, während Context Editing aktiviert ist und der Body tatsächlich
   `context_management` enthält.
2. Der 400-Body wird über einen `clone()` gelesen, sodass die ursprüngliche Antwort für den nicht
   übereinstimmenden Pfad intakt bleibt.
3. Der Fehlertext muss auf `/context[_-]management|context editing/i` passen — ein nicht
   zusammenhängender 400-Fehler (z. B. `max_tokens must be >= 1`) löst den Fallback **nicht** aus;
   der ursprüngliche Fehler wird weitergegeben.
4. Bei einer Übereinstimmung setzt der Code `contextEditingDisabled = true` (wodurch eine erneute
   Injektion unterdrückt wird, falls später für eine Wiederholungs-/Fallback-URL ein neuer
   `transformedBody` erstellt wird), löscht `context_management`, signiert den Body für Claude /
   Claude-Code-kompatible Relays erneut (`signRequestBody`) und wiederholt die Anfrage an dieselbe
   URL einmal.

Echtes Claude führt die Beta in `ANTHROPIC_BETA_BASE` mit und gelangt nicht auf diesen Fallback-Pfad.

## `applied_edits`-Telemetrie

Nach einer Claude-Antwort zeichnet Pusula auf, wie viel Kontext der Provider tatsächlich
gelöscht hat. Dies wird **nicht** gestreamt — die Daten werden nach bestem Bemühen aus dem
nicht gestreamten Antwort-Body extrahiert und wirken sich niemals auf die Antwort aus
(Telemetriefehler werden unterdrückt).

- Extraktion: `extractContextEditingTelemetry(responseBody)` in `open-sse/config/contextEditing.ts`.
  Die Funktion prüft `applied_edits` defensiv an drei Stellen innerhalb der Antwortstruktur:
  - `context_management.applied_edits`
  - `usage.context_management.applied_edits`
  - `usage.applied_edits`
- Pro Eintrag gelesene Felder: `cleared_input_tokens` und `cleared_tool_uses`
  (snake_case, Anthropic-nativ), mit den camelCase-Fallbacks `clearedInputTokens` /
  `clearedToolUses`.
- Gibt `null` zurück, wenn kein `applied_edits`-Array gefunden wird oder tatsächlich nichts gelöscht
  wurde.

Die Belegstruktur ist `ContextEditingTelemetry { editCount, clearedInputTokens, clearedToolUses }`.
Die Aufzeichnung erfolgt in `open-sse/handlers/chatCore.ts` (beschränkt auf
`provider === "claude"`) über `recordContextEditingTelemetry()`
(`src/lib/db/compressionAnalytics.ts`), das eine Zeile für die Komprimierungsanalyse mit folgenden
Kennzeichnungen schreibt:

- `mode: "context-editing"`
- `engine: "context-editing"`
- `tokens_saved` / `original_tokens` = Anzahl der gelöschten Eingabe-Token
- `request_id` mit dem Suffix `::context-editing`

Somit erscheint die delegierte Löschung in der Komprimierungsanalyse neben den lokalen Engines
unter der Engine-Bezeichnung `context-editing` und kann von Einsparungen durch
RTK/Caveman/LLMLingua unterschieden werden.

## Beziehung zu den lokalen Komprimierungs-Engines

| Aspekt              | Lokale Engines (Caveman / RTK / LLMLingua / stacked) | Delegierte Kontextbearbeitung                              |
| ------------------- | ---------------------------------------------------- | ---------------------------------------------------------- |
| Ausführungsort      | In Pusula, bevor die Anfrage den Proxy verlässt   | Beim Anbieter (Claude), serverseitig                       |
| Bearbeiteter Inhalt | Prompt-/Kontext-/Tool-Ergebnistext                   | Alte Tool-Aufruf-/Tool-Ergebnisblöcke                      |
| Anbieterumfang      | Alle Anbieter                                        | Nur `claude` + `anthropic-compatible-cc-*`                 |
| Umschalter          | Einstellungen des Komprimierungsmodus                | `contextEditing.enabled`                                   |
| Fehlerverhalten     | Fail-open (Originaltext)                             | 400-Fallback: Parameter entfernen, einmal erneut versuchen |
| Einsparungsmetrik   | `engine: <engine id>`                                | `engine: "context-editing"`                                |

Beide Ansätze ergänzen sich: Lokale Engines komprimieren die von Pusula gesendeten Bytes; die Kontextbearbeitung ermöglicht es
Claude, den laufenden Kontext über mehrere Interaktionen hinweg zu bereinigen. Beide können gleichzeitig aktiviert werden.

## Siehe auch

- [COMPRESSION_ENGINES.md](./COMPRESSION_ENGINES.md) — Engine-Registry und die lokalen Komprimierungs-
  Engines
- [RTK_COMPRESSION.md](./RTK_COMPRESSION.md) — Komprimierung von Befehls-/Tool-Ausgaben
- [../frameworks/MCP-SERVER.md](../frameworks/MCP-SERVER.md) — Komprimierung von MCP-Beschreibungen und
  Reduzierung der Tool-Kardinalität
- Quelle: `open-sse/config/contextEditing.ts`, `open-sse/executors/base.ts`,
  `open-sse/services/compression/types.ts`, `src/lib/db/compressionAnalytics.ts`
