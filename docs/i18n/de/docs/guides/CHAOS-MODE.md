# Chaos Mode (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CHAOS-MODE.md) · 🇮🇷 [fa](../../../fa/docs/guides/CHAOS-MODE.md) · 🇹🇷 [tr](../../../tr/docs/guides/CHAOS-MODE.md)

---

> **Dashboard:** **Chaos Mode** (Seitenleiste) → `/dashboard/chaos`  
> **API:** `GET` / `PUT` `/api/chaos/config` · `POST /api/chaos/run` (Dashboard-Sitzung) · `POST /api/skills/collect/chaos` (API-Schlüssel)  
> **Quellcode:** `src/lib/chaos/chaosExecutor.ts`, `src/lib/chaos/chaosConfig.ts`

Chaos Mode sendet **eine Aufgabe gleichzeitig an mehrere Anbieter** — jeder beteiligte Anbieter
steuert eine Modellinstanz bei, und Sie erhalten alle Antworten nebeneinander (oder verkettet). Es
handelt sich um eine Ausführungsoberfläche für mehrere Modelle, nicht um eine Routing-Strategie: Ihr normaler
`/v1/chat/completions`-Datenverkehr wird davon niemals beeinflusst.

**Begriffsklärung — drei verschiedene Dinge werden mit „chaos“ im Namen ausgeliefert:**

| Element                   | Beschreibung                                                                                                                                                                         | Dokumentation                                |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| **Chaos Mode**            | Die hier beschriebene Dashboard-Seite und API: Eine Aufgabe wird auf viele Anbieter verteilt (parallel oder kollaborativ).                                                           | Dieser Leitfaden                             |
| `auto/chaos`              | Auto-Combo-Modell-ID: parallele Verteilung, ein Modell pro Anbieter, jeweils ein Upstream-Aufruf. Keine Fehlerinjektion ([Details](#autochaos-parallel-fan-out)).                    | [AUTO-COMBO.md](../routing/AUTO-COMBO.md)    |
| Chaos-Combo-Konfiguration | Eine persistierte Combo mit `config.chaos.enabled` verteilt Anfragen auf dieselbe Weise (nur per API); `judgeModel` wählt lediglich die endgültige Antwort aus, ohne Syntheseaufruf. | `open-sse/services/autoCombo/chaosEngine.ts` |

### `auto/chaos`: parallele Verteilung

`auto/chaos` ist **kein** Mechanismus zur Fehlerinjektion oder zum Testen der Ausfallsicherheit. Eine Anfrage
mit `model: "auto/chaos"` an `/v1/chat/completions`:

1. Erstellt ein Panel aus **einem Modell pro Anbieter**: dem ersten Kandidaten jedes
   verbundenen Anbieters, in der Reihenfolge des Kandidatenpools, mit bis zu 5 Mitgliedern
   (`PUSULA_CHAOS_MAX_PANEL`, begrenzt auf 10)
   (`open-sse/services/autoCombo/virtualFactory.ts`). Das `chaos-mode`-Gewichtungspaket
   legt lediglich den `weight` jedes Mitglieds fest; die Verteilung wertet ihn nicht aus.
2. Sendet dieselbe Anfrage **parallel** an jedes Panelmitglied, sodass eine Anfrage
   einen Upstream-Aufruf pro Panelmitglied verursacht
   (`open-sse/services/autoCombo/chaosEngine.ts`, ausgelöst durch
   `open-sse/services/combo.ts`).
3. Streamt für jedes Panelmitglied bei dessen Eintreffen eine Statuszeile: standardmäßig
   einen SSE-Kommentar (`: chaos <index> ok|fail <model>`) sowie ein `pusula-chaos-part`-Ereignis
   (`model`, `index`, `ok`, `error`), wenn die Anfrage
   `stream_options.include_chaos_parts: true` setzt. Diese enthalten keinen Antworttext.
4. Sendet **eine** Panelantwort als finalen Chunk im OpenAI-Stil: die Antwort des ersten
   Panelmitglieds (`auto/chaos` legt es als `judgeModel` fest), wenn dieses erfolgreich ist,
   andernfalls die des letzten erfolgreichen Mitglieds. Die anderen Panelantworten werden nicht
   zurückgegeben, sodass Sie für N Aufrufe bezahlen und eine Vervollständigung erhalten.

## Einrichtung

1. Öffnen Sie **Dashboard → Chaos Mode** (`/dashboard/chaos`).
2. **Aktivieren** Sie den Modus — Chaos Mode wird **standardmäßig deaktiviert** ausgeliefert (`enabled: false` in
   `src/lib/chaos/chaosConfig.ts`). Solange er deaktiviert ist, antwortet `POST /api/chaos/run` mit
   `400 — "Chaos Mode ist nicht aktiviert. Aktivieren Sie ihn unter Dashboard → Chaos Mode."`.
3. Wählen Sie die Teilnehmer und Standardwerte aus (werden pro Instanz über den Einstellungsspeicher persistiert):

   | Feld                | Bedeutung                                                           | Standardwert / Grenzwerte              |
   | ------------------- | ------------------------------------------------------------------- | -------------------------------------- |
   | `enabled`           | Hauptschalter                                                       | `false`                                |
   | `defaultMode`       | `parallel` oder `collaborative` (siehe unten)                       | `parallel`                             |
   | `providerOverrides` | Teilnahme je Anbieter (`providerId`, optional `modelId`, `enabled`) | leer = jeder aktive Anbieter, max. 200 |
   | `systemPrompt`      | Überschreibung für den integrierten Chaos-System-Prompt             | optional, max. 10.000 Zeichen          |
   | `timeoutMs`         | Maximale Dauer pro Modellaufruf                                     | `120000` (5.000–600.000)               |
   | `maxTokens`         | `max_tokens` pro Modellaufruf                                       | `4096` (256–128.000)                   |

4. Führen Sie **einen Test direkt auf der Seite** aus — der Ergebnisbereich zeigt die Antwort,
   den Status und die Dauer jedes Anbieters an.

## Ausführungsmodi

- **`parallel`** — jedes Modell erhält gleichzeitig dieselbe Aufgabe; Sie erhalten alle Antworten
  unabhängig voneinander.
- **`collaborative`** — die Modelle werden **in einer Kette** ausgeführt: Jedes Modell sieht die Ausgabe des
  vorherigen Modells und wird gebeten, sie zu verfeinern, zu erweitern, zu kritisieren oder eine Alternative anzubieten. Das Feld `summary`
  der Antwort verkettet die erfolgreichen Ausgaben in der Reihenfolge der Kette (parallele Ausführungen haben kein `summary`).

## API

### `POST /api/chaos/run` — Dashboard-Sitzung

Cookie-authentifiziert (die Verwaltungssitzung — siehe
[MANAGEMENT-AUTH.md](MANAGEMENT-AUTH.md)); wird von der Dashboard-Seite verwendet.

```jsonc
// Anfragekörper
{
  "task": "Compare approaches to X", // erforderlich
  "providers": ["glm", "kimi"], // optionaler Filter
  "mode": "parallel", // optional — überschreibt defaultMode
  "systemPrompt": "…", // optionale Überschreibung
  "maxTokens": 4096, // optionale Überschreibung
}
```

### `POST /api/skills/collect/chaos` — API-Schlüssel

Bearer-Token-Variante für externe Aufrufer. Der Schlüssel muss über die **Chaos-Mode-Berechtigung**
(`chaosModeEnabled`) verfügen, die **standardmäßig deaktiviert** ist — aktivieren Sie sie für jeden Schlüssel unter
**Dashboard → API Manager → Schlüssel bearbeiten → Berechtigungen → Chaos Mode**. Derselbe Anfragekörper wie oben.

```bash
curl -X POST http://localhost:20128/api/skills/collect/chaos \
  -H "Authorization: Bearer $PUSULA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"task":"Compare approaches to X","mode":"parallel"}'
```

Beide Endpunkte geben dieselbe Struktur zurück:

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
  "summary": "…", // nur im kollaborativen Modus
}
```

## Fehlerbehebung

- **`400 Chaos Mode is not enabled`** — siehe Schritt 2 oben: Der globale Schalter ist deaktiviert.
- **Der API-Schlüssel wird bei `/api/skills/collect/chaos` abgelehnt** — dem Schlüssel fehlt die schlüsselspezifische
  Berechtigung `chaosModeEnabled` (standardmäßig deaktiviert; dies ist eine Einstellung, kein Fehler).
- **Ein erwarteter Anbieter fehlt in den Ergebnissen** — überprüfen Sie `providerOverrides` auf der
  Chaos-Mode-Seite (eine deaktivierte Überschreibung schließt ihn aus) und ob die Anbieterverbindung
  aktiv ist.
