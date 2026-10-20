# OpenCode Integration (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/OPENCODE.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/OPENCODE.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/OPENCODE.md)

---

> **Status:** Allgemein verfügbar.
> **Zielgruppe:** Betreiber, die OpenCode mit einer Pusula-Bereitstellung verbinden.
> **Maßgebliche Quelle (Konfigurationsschema):** `src/shared/services/opencodeConfig.ts`
> **Maßgebliche Quelle (npm-Paket):** `@pusula/opencode-provider/` (veröffentlichbarer Workspace)

[OpenCode](https://opencode.ai) ist ein agentischer KI-Client für CLI und Desktop. Er liest seinen Anbieterkatalog aus `~/.config/opencode/opencode.json` (oder `opencode.jsonc`) und folgt dem Schema unter `https://opencode.ai/config.json`. Pusula stellt sich OpenCode als einer dieser Anbieter zur Verfügung — jede Anfrage läuft über die standardmäßige OpenAI-kompatible `/v1`-Schnittstelle von Pusula, sodass OpenCode automatisch von Auto-Combo-Routing, Circuit Breakern, Schlüsselrichtlinien, Beobachtbarkeit usw. profitiert.

Es gibt **zwei unterstützte Integrationswege**. Wählen Sie einen davon — beide erzeugen dieselbe Konfiguration.

---

## Pfad 1 — CLI-Generator (keine npm-Installation)

Für Endbenutzer empfohlen. Wird mit Pusula ausgeliefert. Schreibt `opencode.json` direkt.

```bash
# Nach der Installation von Pusula (npm i -g @pusula/cli oder lokaler Klon)
pusula config opencode \
  --base-url http://localhost:20128 \
  --api-key "$PUSULA_API_KEY"
```

Im Hintergrund ruft die CLI `mergeOpenCodeConfigText()` (`src/shared/services/opencodeConfig.ts:104`) auf, sodass bei einer vorhandenen `opencode.json` die anderen Anbieter und Kommentare erhalten bleiben. Der Pusula-Eintrag wird atomar hinzugefügt oder ersetzt.

Ergebnisdatei (standardmäßiger Modellkatalog):

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "pusula": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Pusula",
      "options": {
        "baseURL": "http://localhost:20128/v1",
        "apiKey": "<your-key>",
      },
      "models": {
        "claude-opus-4-5-thinking": { "name": "claude-opus-4-5-thinking" },
        "claude-sonnet-4-5-thinking": { "name": "claude-sonnet-4-5-thinking" },
        "gemini-3.1-pro-high": { "name": "gemini-3.1-pro-high" },
        "gemini-3-flash": { "name": "gemini-3-flash" },
      },
    },
  },
}
```

---

## Pfad 2 — npm-Paket `@pusula/opencode-provider`

Empfohlen, wenn Sie die Konfiguration über Node/TS skripten (CI-Pipelines, Monorepos, benutzerdefinierte Installationsabläufe).

```bash
npm install --save-dev @pusula/opencode-provider
```

```ts
import { writeFileSync } from "node:fs";
import { buildPusulaOpenCodeConfig } from "@pusula/opencode-provider";

const config = buildPusulaOpenCodeConfig({
  baseURL: "http://localhost:20128",
  apiKey: process.env.PUSULA_API_KEY ?? "sk_pusula",
  // Optional: den für OpenCode bereitgestellten Modellkatalog überschreiben
  models: ["auto", "claude-opus-4-7", "gpt-5.5"],
  modelLabels: { auto: "Auto-Combo" },
});

writeFileSync("opencode.json", JSON.stringify(config, null, 2));
```

Für eine nicht destruktive Zusammenführung mit einer vorhandenen Datei können Sie `mergeOpenCodeConfigText()` aus `opencodeConfig.ts` nachbilden oder den CLI-Generator aufrufen.

Die vollständige API finden Sie in der [README des Pakets](../../@pusula/opencode-provider/README.md).

---

## Was die Laufzeit tatsächlich tut

Beide Pfade erzeugen denselben Eintrag `provider.pusula.npm: "@ai-sdk/openai-compatible"`. Zur Laufzeit lädt OpenCode `@ai-sdk/openai-compatible` (bereits eine transitive Abhängigkeit von OpenCode) und konfiguriert es mit `baseURL` + `apiKey`. Von dort aus verläuft der Ablauf wie folgt:

```
OpenCode-Benutzeroberfläche/-Agent
   → @ai-sdk/openai-compatible
      → HTTP POST {baseURL}/chat/completions          (OpenAI-Schnittstelle von Pusula)
         → Pusula-Handler für /v1/chat/completions (open-sse/handlers/chatCore.ts)
            → Combo-Routing / Auto-Combo / Executor
               → vorgelagerter Anbieter
```

Das Plugin greift niemals auf HTTP zu. Es gibt ausschließlich Konfiguration aus.

---

## Standardwerte des Modellkatalogs

```ts
export const PUSULA_DEFAULT_OPENCODE_MODELS = [
  "claude-opus-4-5-thinking",
  "claude-sonnet-4-5-thinking",
  "gemini-3.1-pro-high",
  "gemini-3-flash",
] as const;
```

Sie können dies über `models: [...]` überschreiben. Empfohlene Ergänzungen:

- `"auto"` — macht Pusulas konfigurationsfreien [Auto-Combo](../routing/AUTO-COMBO.md)-Router verfügbar. Ermöglicht OpenCode, „das beste verfügbare Modell“ auszuwählen, ohne dass Sie den Katalog fest codieren müssen.
- `"<combo-name>"` — eine beliebige Combo, die Sie im Dashboard definiert haben; Pusula löst sie transparent auf.

---

## URL-Normalisierung

Die Hilfsfunktion akzeptiert beide Formen und gibt genau ein `/v1` aus:

| Eingabe                        | Ausgabe (`options.baseURL`) |
| ------------------------------ | --------------------------- |
| `http://localhost:20128`       | `http://localhost:20128/v1` |
| `http://localhost:20128/`      | `http://localhost:20128/v1` |
| `http://localhost:20128/v1`    | `http://localhost:20128/v1` |
| `http://localhost:20128/v1///` | `http://localhost:20128/v1` |

Diese Deduplizierung ist **die häufigste Fehlerursache** bei älteren Konfigurationen. Wenn Sie eine `opencode.json` aus der Zeit vor v3.8.0 haben, die auf `/v1/v1/...` verweist, führen Sie den Generator erneut aus oder rufen Sie `createPusulaProvider` erneut auf.

---

## Authentifizierungsmodi

| Pusula-Einstellung                      | Empfohlener `apiKey`-Wert                                               |
| ------------------------------------------ | ----------------------------------------------------------------------- |
| `REQUIRE_API_KEY=false` (lokaler Standard) | `sk_pusula` (wörtlicher Platzhalter)                                 |
| `REQUIRE_API_KEY=true`                     | Ein echter benutzerspezifischer API-Schlüssel aus Dashboard → API Keys. |

Bei Clients im Anthropic-Stil, die `x-api-key` + `anthropic-version` senden, berücksichtigt Pusulas `extractApiKey` auch den Schlüssel aus `x-api-key`. OpenCode verwendet die OpenAI-Schnittstelle und sendet daher immer `Authorization: Bearer ${apiKey}` — hier gilt kein Anthropic-Sonderfall.

---

## Fehlerbehebung

| Symptom                                                 | Ursache                                                                              | Behebung                                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `404` bei jeder Anfrage mit `/v1/v1/` in der URL        | Veraltete Konfiguration eines Plugins vor v3.8, das `/v1` doppelt anfügte.           | Über Pfad 1 oder 2 neu generieren.                                                                                             |
| `401 Invalid API key`                                   | Bei Pusula ist `REQUIRE_API_KEY=true` gesetzt und der Schlüssel unbekannt.        | Erstellen Sie den Schlüssel im Dashboard oder setzen Sie `REQUIRE_API_KEY=false` (nur lokal) und verwenden Sie `sk_pusula`. |
| Modellliste in der OpenCode-Benutzeroberfläche leer     | Alle 4 Standardmodelle sind in der Provider-Sichtbarkeit von Pusula ausgeblendet. | Übergeben Sie `models: ["auto", ...]`, um die von Ihnen aktivierten Modelle verfügbar zu machen.                               |
| OpenCode-500-Fehler mit `cannot read property 'models'` | Ältere OpenCode-Versionen (< 0.1.x) akzeptierten `models` nicht inline.              | Aktualisieren Sie OpenCode auf eine Version, die dem v1-Schema (`opencode.ai/config.json`) entspricht.                         |

---

## Siehe auch

- [API-Referenz](../reference/API_REFERENCE.md) — vollständige Pusula-REST-Schnittstelle
- [Auto-Combo](../routing/AUTO-COMBO.md) — was `model: "auto"` bedeutet
- [`@pusula/opencode-provider`-README](../../@pusula/opencode-provider/README.md)
- Quellcode: `src/shared/services/opencodeConfig.ts`, `src/lib/cli-helper/config-generator/opencode.ts`, `@pusula/opencode-provider/src/index.ts`
