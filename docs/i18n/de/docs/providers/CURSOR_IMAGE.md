# Cursor Image Generation (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CURSOR_IMAGE.md) · 🇮🇷 [fa](../../../fa/docs/providers/CURSOR_IMAGE.md) · 🇹🇷 [tr](../../../tr/docs/providers/CURSOR_IMAGE.md)

---

Pusula stellt die **Bildgenerierung** des Cursor-Tarifs unter `POST /v1/images/generations` über dieselbe Anbieter-ID wie für den Chat bereit: `cursor` (Alias `cu`).

| Feld                 | Wert                                                                                                |
| -------------------- | --------------------------------------------------------------------------------------------------- |
| `IMAGE_PROVIDERS`-ID | `cursor`                                                                                            |
| Format               | `cursor-agent-image`                                                                                |
| Authentifizierung    | Dieselbe OAuth-/API-Schlüssel-Verbindung wie beim Chat (`provider_connections.provider = "cursor"`) |
| Modelle              | `cursor/auto`, `cursor/composer-2`, `cursor/composer-2.5`                                           |

## Warum die Agent CLI verwendet wird

Der Cursor-Chat in Pusula verwendet `agent.v1.AgentService/Run` (protobuf). Dieser Pfad **lehnt** integrierte Client-Tools (Shell, Schreiben, …) ab. Die Bildgenerierung ist ein natives Cursor-Tool, das von der **`agent` CLI** unter Nutzung des Benutzerplatzes ausgeführt wird. Der Bild-Handler startet daher `agent` mit einem fest vorgegebenen Prompt und einem temporären Arbeitsbereich pro Anfrage (analog zu Community-Bridges für Benutzerplätze) und gibt anschließend OpenAI-kompatibles `b64_json` zurück.

## Zugriffsbeschränkung (Feste Regeln #15 + #17)

Dies ist das einzige `IMAGE_PROVIDERS`-Format, das einen untergeordneten Prozess (das
`agent`-Binary) startet. Da `POST /v1/images/generations` von ca. 40 weiteren, keine
Prozesse startenden Bildanbietern gemeinsam genutzt wird, die legitimerweise von
externen Aufrufern verwendet werden, ist nicht die gesamte Route als **`LOCAL_ONLY`**
klassifiziert. Stattdessen erzwingt `handleCursorAgentImageGeneration` eine eigene
Zugriffssperre mithilfe des vertrauenswürdigen `AUTHZ_HEADER_PEER_LOCALITY`-Urteils,
das die Authz-Pipeline jeder Anfrage zuweist (basierend auf dem tatsächlichen TCP-Peer,
niemals auf dem fälschbaren `Host`-Header): Nur Aufrufer aus `loopback` und `lan` dürfen
den Prozessstart erreichen; alle anderen (einschließlich eines geleakten API-Schlüssels,
der über einen öffentlichen Tunnel erneut verwendet wird) erhalten den Status `403`,
bevor eine Suche nach Zugangsdaten oder ein Prozessstart erfolgt. Siehe
`src/server/authz/policies/management.ts` für dieselbe Richtlinie, die auf den übrigen
`LOCAL_ONLY`-Bereich angewendet wird.

## Nebenläufigkeitssperre auf Modulebene (Einschränkung auf eine einzelne Instanz)

`CURSOR_IMG_MAX_CONCURRENT` wird durch einen speicherinternen Zähler/eine Warteschlange
durchgesetzt, dessen bzw. deren Gültigkeitsbereich auf die Node-Modulinstanz
(`open-sse/handlers/imageGeneration/providers/cursorAgentImage.ts`) beschränkt ist.
Dadurch wird die Anzahl gleichzeitiger `agent`-Prozessstarts innerhalb eines einzelnen
Pusula-Prozesses korrekt begrenzt, aber es findet **keine** Koordination zwischen
mehreren Prozessen/Instanzen statt, die denselben Cursor-Benutzerplatz gemeinsam nutzen
(z. B. bei einer Bereitstellung mit mehreren Replikaten) — jede Instanz setzt ihr
eigenes unabhängiges Limit durch. Für eine Bereitstellung mit einer einzelnen Instanz
(der Standard) ist dies exakt; horizontal skalierte Bereitstellungen sollten
`CURSOR_IMG_MAX_CONCURRENT` pro Instanz konservativ festlegen oder Cursor-Bildanfragen
an eine einzelne Instanz weiterleiten.

## Voraussetzungen

1. Ein im Dashboard verbundenes Cursor-Konto (OAuth oder `crsr_…`-API-Schlüssel).
2. Das Cursor-Agent-Binary muss für den Pusula-Prozess verfügbar sein:
   - Umgebungsvariable `CURSOR_AGENT_BIN=/path/to/agent`, oder
   - `~/.local/bin/agent`, oder
   - `providerSpecificData.agentBin` in der Cursor-Verbindung.

Optionale Feinabstimmung:

| Umgebungsvariable           | Standardwert             | Bedeutung                                                        |
| --------------------------- | ------------------------ | ---------------------------------------------------------------- |
| `CURSOR_IMG_TIMEOUT_MS`     | `210000`                 | Maximale Laufzeit pro Bild                                       |
| `CURSOR_IMG_MAX_CONCURRENT` | `2`                      | Nebenläufigkeitssperre für den gemeinsam genutzten Benutzerplatz |
| `CURSOR_IMG_MODEL`          | (Anfragemodell / `auto`) | Überschreibt `--model` der CLI                                   |

## Beispiel

```bash
curl -sS https://<host>/v1/images/generations \
  -H "Authorization: Bearer <pusula-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","prompt":"a lantern in fog","size":"1024x1024"}'
```

Die Generierung dauert üblicherweise 1–2 Minuten. Bevorzugen Sie einen internen Netzwerkpfad; Edge-Proxys mit Timeouts von ca. 100 Sekunden schlagen fehl.

## LiteLLM

Registrieren Sie ein Bildmodell mit `mode: image_generation`, `api_base: http://pusula:20128/v1` und `model: openai/cursor/auto` (oder nur `cursor/auto`, abhängig von Ihrer LiteLLM-Version).
