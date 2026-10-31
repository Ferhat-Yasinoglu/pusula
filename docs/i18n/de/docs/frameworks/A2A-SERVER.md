# Pusula A2A Server Documentation (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/A2A-SERVER.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/A2A-SERVER.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/A2A-SERVER.md)

---

> Agent-to-Agent-Protokoll v0.3 — Pusula als intelligenter Routing-Agent

Die A2A-Schnittstelle hat zwei Ausprägungen:

- **JSON-RPC 2.0** unter `POST /a2a` (kanonischer Einstiegspunkt, definiert in `src/app/a2a/route.ts`).
- **REST** unter `/api/a2a/*` für Dashboards und Werkzeuge (Status, Aufgabenliste, Abbruch).

Aufgaben werden vom `A2ATaskManager` verwaltet (`src/lib/a2a/taskManager.ts`, standardmäßig 5 Minuten TTL). Skills werden über `A2A_SKILL_HANDLERS` in `src/lib/a2a/taskExecution.ts` weitergeleitet.

## Agentenerkennung

```bash
curl http://localhost:20128/.well-known/agent.json
```

Gibt die Agent Card zurück, die die Fähigkeiten, Skills und Authentifizierungsanforderungen von Pusula beschreibt.

Das Feld `version` der Agent Card wird aus `process.env.npm_package_version` bezogen (siehe `src/app/.well-known/agent.json/route.ts:13`), sodass es bei jeder Veröffentlichung automatisch mit `package.json` synchronisiert bleibt.

---

## Authentifizierung

Alle Anfragen an `/a2a` erfordern einen API-Schlüssel im Header `Authorization`:

```
Authorization: Bearer YOUR_PUSULA_API_KEY
```

Wenn auf dem Server kein API-Schlüssel konfiguriert ist, wird die Authentifizierung umgangen.

## Aktivierung

A2A wird über den Schalter **Endpoints → A2A** gesteuert und ist standardmäßig deaktiviert. Wenn es deaktiviert ist,
meldet `GET /api/a2a/status` den Wert `status: "disabled"` und `online: false`; JSON-RPC-Aufrufe an
`POST /a2a` geben HTTP 503 mit dem JSON-RPC-Fehlercode `-32000` zurück.

---

## JSON-RPC-2.0-Methoden

### `message/send` — Synchrone Ausführung

Sendet eine Nachricht an einen Skill und wartet auf die vollständige Antwort.

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "skill": "smart-routing",
      "messages": [{"role": "user", "content": "Write a hello world in Python"}],
      "metadata": {"model": "auto", "combo": "fast-coding"}
    }
  }'
```

**Antwort:**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "task": { "id": "uuid", "state": "completed" },
    "artifacts": [{ "type": "text", "content": "..." }],
    "metadata": {
      "routing_explanation": "Selected claude-sonnet via provider \"anthropic\" (latency: 1200ms, cost: $0.003)",
      "cost_envelope": {
        "estimated": 0.005,
        "actual": 0.003,
        "currency": "USD"
      },
      "resilience_trace": [
        {
          "event": "primary_selected",
          "provider": "anthropic",
          "timestamp": "..."
        }
      ],
      "policy_verdict": {
        "allowed": true,
        "reason": "within budget and quota limits"
      }
    }
  }
}
```

### `message/stream` — SSE-Streaming

Funktioniert wie `message/send`, gibt jedoch Server-Sent Events für das Echtzeit-Streaming zurück.

```bash
curl -N -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/stream",
    "params": {
      "skill": "smart-routing",
      "messages": [{"role": "user", "content": "Explain quantum computing"}]
    }
  }'
```

**SSE-Ereignisse:**

```
data: {"jsonrpc":"2.0","method":"message/stream","params":{"task":{"id":"...","state":"working"},"chunk":{"type":"text","content":"..."}}}

: heartbeat 2026-03-03T17:00:00Z

data: {"jsonrpc":"2.0","method":"message/stream","params":{"task":{"id":"...","state":"completed"},"metadata":{...}}}
```

### `tasks/get` — Aufgabenstatus abfragen

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tasks/get","params":{"taskId":"TASK_UUID"}}'
```

### `tasks/cancel` — Eine Aufgabe abbrechen

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tasks/cancel","params":{"taskId":"TASK_UUID"}}'
```

---

## Verfügbare Skills

Pusula stellt 6 A2A-Skills bereit, die in `src/lib/a2a/taskExecution.ts::A2A_SKILL_HANDLERS` verdrahtet sind. Jedes Skill-Modul befindet sich in `src/lib/a2a/skills/`.

| Skill                 | ID                   | Beschreibung                                                                                                                                                               | Tags                       | Beispiele                                          |
| :-------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :------------------------- | :------------------------------------------------- |
| Intelligentes Routing | `smart-routing`      | Leitet einen Prompt mithilfe der Combo-Engine und der Bewertung von Pusula über den optimalen Anbieter bzw. die optimale Kombination weiter                                | Routing, Anbieter          | „Diesen Prompt über das beste Modell weiterleiten“ |
| Kontingentverwaltung  | `quota-management`   | Meldet den Kontingentstatus pro Anbieter und hilft Aufrufern bei der Entscheidung, wann gedrosselt oder gewechselt werden sollte                                           | Kontingent, Anbieter       | „Kontingent für anthropic prüfen“                  |
| Anbietererkennung     | `provider-discovery` | Listet installierte Anbieter mit Funktionen, Angaben zu kostenlosen Tarifen und OAuth-Status auf                                                                           | Anbieter, Erkennung        | „Welche Anbieter sind verfügbar?“                  |
| Kostenanalyse         | `cost-analysis`      | Schätzt anhand des Katalogs und der jüngsten Nutzung die Kosten einer Anfrage bzw. Unterhaltung                                                                            | Kosten, Nutzung            | „Kosten für diese Unterhaltung schätzen“           |
| Zustandsbericht       | `health-report`      | Aggregiert den Status von Leistungsschaltern, Abkühlphasen und Sperren pro Anbieter                                                                                        | Zustand, Resilienz         | „Zustand aller Anbieter anzeigen“                  |
| Funktionen auflisten  | `list-capabilities`  | Gibt den vollständigen Katalog mit 45 Agent Skills (23 API + 21 CLI + 1 Konfiguration) als Markdown-Tabelle mit unverarbeiteten SKILL.md-URLs zur Kontexteinbindung zurück | Katalog, Erkennung, Skills | „Alle Pusula-Funktionen auflisten“                 |

> Die Agent Card sollte mit dem aktuellen Katalog von 374 Anbietern synchron gehalten werden; Anbieterzahlen und Metadaten zu kostenlosen bzw. ohne Authentifizierung nutzbaren Angeboten stammen aus der Laufzeitregistrierung.

### Details zum Skill `list-capabilities`

Der Skill `list-capabilities` ist besonders nützlich für externe Agenten, die ermitteln müssen, was Pusula bereitstellt, bevor sie API-Aufrufe senden. Er gibt ein strukturiertes Markdown-Tabellenartefakt zurück:

```
| ID | Name | Kategorie | Bereich | Endpunkte/Befehle | Unverarbeitete URL |
| --- | --- | --- | --- | --- | --- |
| pusula-auth | Authentifizierung und Sitzungen | api | auth | POST /api/auth/login, ... | https://raw.githubusercontent.com/... |
...
```

Jede Zeile enthält die Spalte `rawUrl`, sodass Agenten sofort die vollständige SKILL.md abrufen können. Das Feld `metadata.totalSkills` entspricht der Kataloggröße (derzeit 45). Implementierung: `src/lib/a2a/skills/listCapabilities.ts`. Siehe auch [AGENT-SKILLS.md](./AGENT-SKILLS.md).

---

## REST-API (ergänzend)

Der JSON-RPC-Endpunkt `/a2a` ist der kanonische A2A-Einstiegspunkt. Die folgenden REST-Endpunkte bieten ergänzenden Zugriff für Dashboards und externe Tools:

| Endpunkt                     | Methode | Beschreibung                                                             | Authentifizierung                            |
| :--------------------------- | :------ | :----------------------------------------------------------------------- | :------------------------------------------- |
| `/api/a2a/status`            | GET     | Serverstatus, registrierte Skills                                        | (öffentlich)                                 |
| `/api/a2a/tasks`             | GET     | Aufgaben mit Filtern auflisten                                           | Verwaltung                                   |
| `/api/a2a/tasks/[id]`        | GET     | Aufgabe nach ID abrufen                                                  | Verwaltung                                   |
| `/api/a2a/tasks/[id]/cancel` | POST    | Laufende Aufgabe abbrechen                                               | Verwaltung                                   |
| `/.well-known/agent.json`    | GET     | Agent Card (A2A-Erkennung)                                               | (öffentlich, 3600s zwischengespeichert)      |
| `/api/a2a/tasks`             | POST    | Eingehende Delegierung an die PusulaConductor-Flotte (Conductor PRD RF5) | Bearer gegen `PUSULA_API_KEY` + `a2aEnabled` |

**Eingehende Conductor-Delegierung (`POST /api/a2a/tasks`):** Externe A2A-Agenten delegieren Programmierarbeiten über Pusula an die PusulaConductor-Flotte. Body: `{ skill: "conductor" | "conductor-cli-<profile>", messages: [{role, content}], metadata: { conductor: { repo: { url, base_ref? }, mode?, cli?, model? } } }` — nur Skills der Conductor-Flotte (die auf der Agent Card angekündigten) können delegiert werden; `metadata.conductor.repo.url` ist erforderlich (die Flotte arbeitet mit git-Repositories). Die Route übersetzt die Anfrage in `POST /v1/tasks` des Hubs, wobei das serverseitige `CONDUCTOR_ORCHESTRATOR_TOKEN` (ersatzweise `CONDUCTOR_HUB_TOKEN`) verwendet wird, und gibt `201 { conductor_task_id, state: "submitted" }` zurück; Aufgabenstatus werden über die SSE→A2A-Spiegelung (RF1) zurückübertragen und sind über `GET /api/a2a/tasks?skill=conductor` sichtbar.

---

## Hinzufügen eines neuen Skills

1. **Skill-Datei erstellen:** `src/lib/a2a/skills/<your-skill>.ts`

   Exportieren Sie eine asynchrone Funktion `(task: A2ATask) => Promise<{ artifacts, metadata }>`. Orientieren Sie sich an der Struktur vorhandener Skills wie `smartRouting.ts`.

2. **Handler registrieren:** Fügen Sie in `src/lib/a2a/taskExecution.ts` einen Eintrag zu `A2A_SKILL_HANDLERS` hinzu:

   ```typescript
   export const A2A_SKILL_HANDLERS = {
     // ...vorhandene Skills
     "your-skill": async (task) => {
       const skillModule = await import("./skills/yourSkill");
       return skillModule.executeYourSkill(task);
     },
   };
   ```

3. **Auf der Agent Card veröffentlichen:** Ergänzen Sie in `src/app/.well-known/agent.json/route.ts` das Array `skills`:

   ```json
   {
     "id": "your-skill",
     "name": "Ihr Skill",
     "description": "Kurze, absichtsorientierte Beschreibung",
     "tags": ["routing", "quota"],
     "examples": ["Beispiel für einen natürlichsprachlichen Aufruf"]
   }
   ```

4. **Tests schreiben:** `tests/unit/a2a-<your-skill>.test.ts`. Decken Sie den Erfolgs- und den Fehlerfall ab.

5. **Dokumentieren Sie** den neuen Skill in der Tabelle `Available Skills` dieser Datei.

---

## Aufgaben-TTL

Aufgaben laufen nach `ttlMinutes` ab (standardmäßig 5 Minuten) — konfiguriert im Konstruktor von `A2ATaskManager` unter `src/lib/a2a/taskManager.ts:82`. Zur Anpassung können Sie die Instanziierung von `A2ATaskManager` forken und einen anderen Wert übergeben (z. B. `new A2ATaskManager(15)` für eine TTL von 15 Minuten). Ein Hintergrundintervall bereinigt abgelaufene Aufgaben alle 60 Sekunden.

---

## Aufgabenlebenszyklus

```
submitted → working → completed
                    → failed
                    → cancelled
```

- Aufgaben laufen standardmäßig nach 5 Minuten ab (siehe [Aufgaben-TTL](#task-ttl))
- Endzustände: `completed`, `failed`, `cancelled`
- Das Ereignisprotokoll erfasst jeden Zustandsübergang

---

## Fehlercodes

| Code   | Bedeutung                             |
| :----- | :------------------------------------ |
| -32700 | Parsing-Fehler (ungültiges JSON)      |
| -32600 | Ungültige Anfrage / Nicht autorisiert |
| -32601 | Methode oder Skill nicht gefunden     |
| -32602 | Ungültige Parameter                   |
| -32603 | Interner Fehler                       |
| -32000 | A2A-Endpunkt ist deaktiviert          |

---

## Integrationsbeispiele

### Python (requests)

```python
import requests

resp = requests.post("http://localhost:20128/a2a", json={
    "jsonrpc": "2.0", "id": "1",
    "method": "message/send",
    "params": {
        "skill": "smart-routing",
        "messages": [{"role": "user", "content": "Hello"}]
    }
}, headers={"Authorization": "Bearer YOUR_KEY"})

result = resp.json()["result"]
print(result["artifacts"][0]["content"])
print(result["metadata"]["routing_explanation"])
```

### TypeScript (fetch)

```typescript
const resp = await fetch("http://localhost:20128/a2a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer YOUR_KEY",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "1",
    method: "message/send",
    params: {
      skill: "smart-routing",
      messages: [{ role: "user", content: "Hello" }],
    },
  }),
});
const { result } = await resp.json();
console.log(result.metadata.routing_explanation);
```
