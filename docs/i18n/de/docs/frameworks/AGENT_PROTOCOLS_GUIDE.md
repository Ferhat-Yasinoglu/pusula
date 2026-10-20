# Agent Protocols Guide (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/AGENT_PROTOCOLS_GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/AGENT_PROTOCOLS_GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/AGENT_PROTOCOLS_GUIDE.md)

---

> **Quelle:** `src/lib/{a2a,acp,cloudAgent}/`, `src/app/api/{a2a,acp,cloud}/`, `src/app/api/v1/agents/`
> **Zuletzt aktualisiert:** 2026-06-28 — v3.8.40

Pusula stellt drei verschiedene agentenbezogene Schnittstellen bereit. Auf den ersten Blick sehen sie ähnlich aus, lösen jedoch unterschiedliche Probleme. Verwenden Sie diese Seite, um die richtige auszuwählen.

## Kurzfassung

| Schnittstelle                 | Optimal für                                                                                                                                                       | Transport                         | Standard                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------- |
| **A2A — Agent-to-Agent**      | Agentenübergreifende Zusammenarbeit mit Peer-Agenten, die das A2A-Protokoll unterstützen                                                                          | JSON-RPC 2.0 über HTTP            | A2A v0.3 (offene Spezifikation) |
| **ACP — CLI-Agentenregister** | Erkennen, Registrieren und Starten von CLI-Coding-Agenten, die auf dem Rechner des Benutzers installiert sind (Cursor, Cline, Codex CLI, Claude Code, Aider usw.) | HTTP REST                         | Pusula-spezifisch            |
| **Cloud-Agenten**             | Übermitteln lang laufender Coding-Aufgaben an externe Cloud-Dienste (Codex Cloud, Devin, Jules, Cursor Cloud)                                                     | HTTP REST + DB-gestützte Aufgaben | Pusula-spezifisch            |

Die drei Schnittstellen sind unabhängig voneinander — wählen Sie eine beliebige Kombination aus.

## Entscheidungsbaum

```
Benötigen Sie einen Cloud-Dienst, der Arbeiten außerhalb dieses Rechners ausführt (Codex Cloud / Cursor Cloud / Devin / Jules)?
├─ JA → Cloud-Agenten (POST /api/v1/agents/tasks)
└─ NEIN → Weiter
    │
    Haben Sie einen Peer-Agenten, der A2A unterstützt und zusammenarbeiten möchte?
    ├─ JA → A2A (POST /a2a)
    └─ NEIN → Weiter
        │
        Müssen Sie lokal installierte CLI-Coding-Agenten auflisten oder konfigurieren?
        ├─ JA → ACP (GET /api/acp/agents)
        └─ NEIN → Verwenden Sie einfach /v1/chat/completions
```

## 1. A2A — Agent-to-Agent

**Spezifikation:** [A2A v0.3](https://a2a-protocol.org)
**Pusula-Endpunkt:** `POST /a2a` (JSON-RPC 2.0)
**Agentenkarte:** `GET /.well-known/agent.json`

### Einsatzgebiete

- Aufbau eines Multi-Agenten-Systems, in dem Pusula einer der Peer-Agenten ist
- Bereitstellung der Routing-Intelligenz von Pusula (intelligentes Routing, Kontingentverwaltung usw.) für Agenten in Frameworks wie Google ADK oder generischen Agentennetzwerken
- Einbindung von Pusula hinter einer standardisierten Schnittstelle für Erkennung und Aufruf

### Methoden

- `message/send` — eine Nachricht übermitteln und eine synchrone Antwort empfangen
- `message/stream` — eine Nachricht übermitteln und per SSE gestreamte Fortschrittsereignisse empfangen
- `tasks/get` — eine Aufgabe anhand ihrer ID abrufen
- `tasks/cancel` — eine laufende Aufgabe abbrechen

### Integrierte Fähigkeiten (6)

- `smart-routing` — einen Prompt über die optimale Kombination routen
- `quota-management` — den Kontingentstatus für jeden Anbieter melden
- `provider-discovery` — installierte Anbieter mit ihren Funktionen auflisten
- `cost-analysis` — die Kosten einer Anfrage oder Unterhaltung schätzen
- `health-report` — den Status von Schutzschaltern, Abklingzeiten und Sperren für jeden Anbieter aggregieren
- `list-capabilities` — die verfügbaren Fähigkeiten und Metadaten des Agenten auflisten

### Vertiefung

Weitere Informationen zu Transportdetails, zur Struktur der Agentenkarte, zur TTL-Konfiguration von Aufgaben und zur Vorlage für das Hinzufügen neuer Fähigkeiten finden Sie unter [A2A-SERVER.md](./A2A-SERVER.md).

## 2. ACP — CLI-Agenten-Registry

**Pusula-Endpunkt:** `GET /api/acp/agents`
**Quelle:** `src/lib/acp/{index,manager,registry}.ts`

### Was es ist

ACP ist Pusulas **lokales Inventar für CLI-Agenten**. Es erkennt, welche Coding-CLIs auf dem Host installiert sind (Cursor, Cline, Claude Code, Codex CLI, Continue usw.), ermittelt deren Versionen und zeigt sie im Dashboard an, damit Benutzer jede CLI so konfigurieren können, dass sie auf Pusula verweist.

Dies ist KEIN externes Protokoll — es handelt sich um eine interne Registry, die die Benutzeroberfläche „CLI Tools“ und die Verfolgung von CLI-Fingerprints unterstützt (siehe [CLI-TOOLS.md](../reference/CLI-TOOLS.md)).

### Funktionsweise

- Prüft den Host auf installierte CLI-Binärdateien (verwendet je nach Betriebssystem `which` / `where`)
- Liest die Version jeder CLI aus (ruft `<bin> --version` auf)
- Akzeptiert optional benutzerdefinierte Agenten (Binärdateipfad + Versionsprüfung + Startargumente)
- Speichert benutzerdefinierte Agenten in den Einstellungen
- Gibt die zusammengeführte Liste an das Dashboard zurück

### REST-API

| Endpunkt          | Methode | Beschreibung                                                                    | Authentifizierung |
| ----------------- | ------- | ------------------------------------------------------------------------------- | ----------------- |
| `/api/acp/agents` | GET     | Erkannte + benutzerdefinierte Agenten auflisten (installiert/Gesamtanzahl)      | API-Schlüssel     |
| `/api/acp/agents` | POST    | Benutzerdefinierten Agenten hinzufügen/aktualisieren/entfernen (Aktion im Body) | API-Schlüssel     |

Body-Format für POST (`customAgentBodySchema` in `src/app/api/acp/agents/route.ts`):

```json
{
  "action": "add|update|remove",
  "id": "cursor",
  "name": "Cursor",
  "binary": "/usr/local/bin/cursor",
  "versionCommand": "--version",
  "providerAlias": "cursor",
  "spawnArgs": ["--api-base", "http://localhost:20128"],
  "protocol": "stdio"
}
```

### Anwendungsfälle

- Die Dashboard-Seite „CLI Tools“ listet auf, was installiert ist, und hilft dabei, die einzelnen Tools auf Pusula zu verweisen
- Mit benutzerdefinierten Agenten können erfahrene Benutzer interne/proprietäre CLIs registrieren, die Pusula standardmäßig nicht kennt
- Das Erkennungsergebnis dient als Grundlage für die `cli-tools`-Fingerprint-Matrix

### Wann ACP NICHT verwendet werden sollte

- ACP führt keine Aufgaben _aus_. Es erkennt und konfiguriert lediglich CLIs. Um eine CLI tatsächlich aufzurufen, starten Sie sie selbst mit den von Pusula bereitgestellten Umgebungsvariablen (`OPENAI_BASE_URL`, `OPENAI_API_KEY` usw.).

## 3. Cloud-Agenten

**Pusula-Endpunkte:** `/api/v1/agents/tasks/*` (Lebenszyklus) + `/api/cloud/*` (Infrastruktur)
**Quelle:** `src/lib/cloudAgent/`

### Was es ist

Eine einheitliche Schnittstelle für Cloud-Coding-Agenten von Drittanbietern. Sie übermitteln einen Prompt + eine Repository-URL, Pusula leitet die Anfrage an den richtigen Cloud-Agenten weiter, fragt den Status ab und gibt die Ergebnisse zurück.

### Unterstützte Agenten (4, alle in `src/lib/cloudAgent/agents/` bestätigt)

- `codex-cloud` — OpenAI Codex Cloud
- `devin` — Cognition Devin
- `jules` — Google Jules

### Lebenszyklus

```
POST /api/v1/agents/tasks
  → BaseAgent.createTask() je Agentenklasse
  → externer Dienst beginnt mit der Arbeit
  → Aufgabenzeile wird in der DB erstellt (cloud_agent_tasks)
  ↓
GET /api/v1/agents/tasks/[id]
  → verzögerte Statussynchronisierung mit dem Anbieter
  → gibt aktuellen Status + Plan + Aktivitätsprotokoll zurück
  ↓
POST /api/v1/agents/tasks/[id]   (Aktion: "approve" | "message" | "cancel")
  → leitet die Anfrage an den Anbieter weiter (oder markiert sie lokal als abgebrochen)
  ↓
DELETE /api/v1/agents/tasks/[id]
  → lokaler Abbruch
```

### Authentifizierung

⚠️ **Alle `/api/v1/agents/tasks/*`-Endpunkte erfordern eine Management-Authentifizierung** (Commit `588a0333`). Aufrufer, die ausschließlich Bearer-Authentifizierung verwenden, erhalten seit v3.8.0 den Statuscode 401.

### Ausführliche Informationen

Siehe [CLOUD_AGENT.md](./CLOUD_AGENT.md) für den `CloudAgentBase`-Vertrag, agentenspezifische Details, Schemadetails und Endpunkte für die Anmeldedaten-Infrastruktur.

## Vergleich: A2A vs. Cloud Agents

Beide unterstützen „lang laufende Aufgaben“, jedoch auf unterschiedlichen Ebenen:

| Aspekt                 | A2A                                                                                        | Cloud Agents                                          |
| ---------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Standard               | Offenes A2A v0.3                                                                           | Pusula-spezifisch                                  |
| Ausführungsort         | Innerhalb von Pusula (verwendet konfigurierte Kombinationen)                            | Extern (Codex-/Devin-/Jules-Server)                   |
| Aufgabendauer          | Standard-TTL: 5 Min. (in `TaskManager` konfigurierbar)                                     | Minuten bis Stunden                                   |
| Repository-Verständnis | Nein (übergibt nur Prompts)                                                                | Ja (Repository-URL + Branch)                          |
| Anwendungsfall         | Agentenübergreifende Zusammenarbeit, intelligentes Routing als Dienst                      | „Feature X in Repository Y implementieren“ delegieren |
| Authentifizierung      | Optionaler `PUSULA_API_KEY` für `/a2a`; Verwaltungszugriff für `/api/a2a/*`-REST-Helfer | Immer Verwaltungszugriff                              |

## Integrationsbeispiele

### A2A-Funktionen von Pusula ermitteln

```bash
curl http://localhost:20128/.well-known/agent.json
```

Gibt die Agent Card mit allen 6 Fähigkeiten, Transporten und der Version zurück.

### Pusula als A2A-Agent aufrufen

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "messages": [{"role": "user", "content": "Route this prompt"}],
      "skill": "smart-routing"
    },
    "id": 1
  }'
```

### Installierte CLI-Agenten über ACP auflisten

```bash
curl http://localhost:20128/api/acp/agents \
  -H "Authorization: Bearer <api-key>"
```

### Einen benutzerdefinierten CLI-Agenten hinzufügen

```bash
curl -X POST http://localhost:20128/api/acp/agents \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "id": "my-custom-cli",
    "name": "My Custom CLI",
    "binary": "/opt/mycli/bin/mycli",
    "versionCommand": "--version",
    "providerAlias": "openai"
  }'
```

### Eine Cloud-Agent-Aufgabe übermitteln

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "devin",
    "prompt": "Implement feature X in repo Y",
    "source": {
      "repoName": "user/repo",
      "repoUrl": "https://github.com/user/repo",
      "branch": "main"
    }
  }'
```

### Status einer Cloud-Aufgabe abfragen

```bash
curl http://localhost:20128/api/v1/agents/tasks/<task-id> \
  -H "Cookie: auth_token=..."
```

## Wann was verwendet werden sollte

- **Chatbot-/Copilot-Frontend** → `/v1/chat/completions` (OpenAI-kompatibel – kein Agentenprotokoll)
- **Zusammenarbeit mehrerer Agenten** → A2A
- **Lokale CLIs im Dashboard auflisten** → ACP
- **Lang laufende Programmieraufgaben an Cloud-Dienste delegieren** → Cloud Agents

## Interne Architektur

```
                ┌─────────────────────┐
                │   Pusula Core    │
                └─────────────────────┘
                  ↑       ↑        ↑
        ┌─────────┘       │        └─────────┐
        │                 │                  │
    ┌───────┐        ┌─────────┐       ┌────────────┐
    │  A2A  │        │   ACP   │       │  Cloud-    │
    │ (/a2a)│        │ (/acp)  │       │  Agenten   │
    └───────┘        └─────────┘       │ (/v1/agents│
        │                 │            │  /tasks)   │
        ↓                 ↓            └────────────┘
   Externe Peer-     Lokale CLI-             │
   Agenten, die      Binärdateien auf         ↓
   A2A v0.3          dem Host           Codex Cloud, Cursor,
   unterstützen                         Devin, Jules
```

## Siehe auch

- [A2A-SERVER.md](./A2A-SERVER.md) — ausführliche Informationen zu A2A
- [CLOUD_AGENT.md](./CLOUD_AGENT.md) — ausführliche Informationen zu Cloud-Agenten
- [CLI-TOOLS.md](../reference/CLI-TOOLS.md) — externe CLI-Integrationen (verwenden ACP)
- [SKILLS.md](./SKILLS.md) — Skills-Framework (unterscheidet sich von A2A-Skills — lokale Ausführungs-Sandbox)
- [API_REFERENCE.md](../reference/API_REFERENCE.md#agents-protocol) — Endpunktreferenz
- Quelle: `src/lib/{a2a,acp,cloudAgent}/`
