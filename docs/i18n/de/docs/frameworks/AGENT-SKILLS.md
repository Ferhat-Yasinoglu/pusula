# Pusula Agent Skills Catalog (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/AGENT-SKILLS.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/AGENT-SKILLS.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/AGENT-SKILLS.md)

---

> **Maßgebliche Quelle:** `src/lib/agentSkills/` (Katalog, Generator, Parser) + Verzeichnis `skills/` (SKILL.md-Dateien)
> **Zuletzt aktualisiert:** 2026-08-02 — v3.8.50

Agent Skills sind strukturierte SKILL.md-Dateien, die externen Agenten, MCP-Clients und A2A-Orchestratoren vermitteln, wie die REST-API und CLI von Pusula verwendet werden. Im Gegensatz zu [Pusula Skills](./SKILLS.md) (LLM-Tooldefinitionen, die innerhalb von Pusula ausgeführt werden) sind Agent Skills ein _Dokumentationskatalog_ — statisches Markdown, das direkt in den Kontext eines Agenten eingebunden werden kann.

---

## Übersicht

Der Katalog enthält **45 Agent Skills** (23 für die REST-API + 21 für die CLI + 1 Konfigurations-Workflow). Jeder Skill verfügt über:

- Eine **kanonische ID** (`pusula-auth`, `cli-serve` usw.)
- Eine **SKILL.md-Datei** unter `skills/{id}/SKILL.md` mit YAML-Frontmatter (`name`, `description`) und einem ausführlichen Markdown-Inhalt
- **REST-Endpunkte** (API-Skills) oder **CLI-Unterbefehle** (CLI-Skills), die aus der OpenAPI-Spezifikation und der CLI-Registry abgeleitet werden
- Eine **GitHub-Raw-URL** zum direkten Abruf: `https://raw.githubusercontent.com/Ferhat-Yasinoglu/pusula/refs/heads/main/skills/{id}/SKILL.md`

---

## Architektur

```
src/shared/constants/agentSkills.ts    — Kuratierte Liste mit 45 Einträgen (Name/Beschreibung/Kategorie/Bereich/Symbol)
src/lib/agentSkills/
  catalog.ts                           — getCatalog(), getSkillById(), filterCatalog(), computeCoverage()
  generator.ts                         — generateAgentSkills() schreibt SKILL.md nach skills/{id}/
  openapiParser.ts                     — Extrahiert REST-Endpunkte aus docs/openapi.yaml
  cliRegistryParser.ts                 — Extrahiert CLI-Unterbefehle aus bin/cli-registry.ts
  schemas.ts                           — Zod-Schemas: AgentSkillSchema, SkillCoverageSchema usw.
  types.ts                             — TypeScript-Schnittstellen: AgentSkill, SkillCoverage usw.

skills/{id}/SKILL.md                   — Generierte und kuratierte Markdown-Dateien (insgesamt 45)

src/app/api/agent-skills/
  route.ts                             — GET /api/agent-skills
  [id]/route.ts                        — GET /api/agent-skills/{id}
  [id]/raw/route.ts                    — GET /api/agent-skills/{id}/raw (text/markdown)
  coverage/route.ts                    — GET /api/agent-skills/coverage
  generate/route.ts                    — POST /api/agent-skills/generate (Authentifizierung erforderlich)

open-sse/mcp-server/tools/agentSkillTools.ts  — 3 MCP-Tools (Auflisten, Abrufen, Abdeckung)
src/lib/a2a/skills/listCapabilities.ts        — A2A-Skill: list-capabilities
```

---

## SKILL.md-Format

```markdown
---
name: pusula-providers
description: "Anbieterverbindungen verwalten: Anmeldedaten hinzufügen, testen, rotieren und entfernen."
---

<!-- generiert von src/lib/agentSkills/generator.ts; manuelle Änderungen werden überschrieben -->

## Übersicht

...

## Authentifizierung

...

## Endpunkte

...

<!-- skill:custom-start -->

## Benutzerdefinierter Abschnitt (bleibt bei der Neugenerierung erhalten)

...

<!-- skill:custom-end -->
```

Der Generator behält bei der Neugenerierung den Inhalt zwischen `<!-- skill:custom-start -->` und `<!-- skill:custom-end -->` bei. Zehn Skills verfügen über kuratierte benutzerdefinierte Blöcke:

`pusula-mcp`, `pusula-compression`, `cli-providers`, `cli-eval`, `pusula-agents-a2a`, `pusula-combos-routing`, `pusula-auth`, `pusula-resilience`, `pusula-inference`, `cli-serve`.

---

## REST-API-Erkennung

| Endpunkt                     | Methode | Beschreibung                                                          | Authentifizierung |
| :--------------------------- | :------ | :-------------------------------------------------------------------- | :---------------- |
| `/api/agent-skills`          | GET     | Katalog auflisten (optional `?category=api\|cli\|config&area=<area>`) | keine             |
| `/api/agent-skills/{id}`     | GET     | Metadaten einer einzelnen Fähigkeit abrufen                           | keine             |
| `/api/agent-skills/{id}/raw` | GET     | SKILL.md als `text/markdown` abrufen                                  | keine             |
| `/api/agent-skills/coverage` | GET     | Abdeckungsstatistiken (Anzahl der vorhandenen SKILL.md-Dateien)       | keine             |
| `/api/agent-skills/generate` | POST    | Generator auslösen (dryRun/prune/onlyIds)                             | Verwaltung        |

Beispiel — alle API-Fähigkeiten auflisten:

```bash
curl "http://localhost:20128/api/agent-skills?category=api"
```

Beispiel — eine einzelne SKILL.md abrufen:

```bash
curl -H "Accept: text/markdown" "http://localhost:20128/api/agent-skills/pusula-providers/raw"
```

---

## MCP-Erkennung

Drei MCP-Werkzeuge sind unter dem Geltungsbereich `read:catalog` registriert:

| Werkzeug                          | Beschreibung                                                      |
| :-------------------------------- | :---------------------------------------------------------------- |
| `pusula_agent_skills_list`     | Fähigkeiten auflisten (optionale Filter `category` / `area`)      |
| `pusula_agent_skills_get`      | Metadaten + SKILL.md für eine Fähigkeit anhand ihrer `id` abrufen |
| `pusula_agent_skills_coverage` | Abdeckungsstatistiken (vorhandene/gesamte API-/CLI-Fähigkeiten)   |

Informationen zur Verknüpfung von Geltungsbereichen und zur Authentifizierung finden Sie unter [MCP-SERVER.md](./MCP-SERVER.md).

---

## A2A-Erkennung

Die A2A-Fähigkeit `list-capabilities` gibt den vollständigen Katalog mit 45 Fähigkeiten als Markdown-Tabellenartefakt zurück. Externe Orchestratoren können sie wie folgt aufrufen:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "skill": "list-capabilities",
    "messages": [{ "role": "user", "content": "List all capabilities" }]
  }
}
```

Protokolldetails finden Sie unter [A2A-SERVER.md](./A2A-SERVER.md).

---

## Katalog — 45 Fähigkeits-IDs

### API-Fähigkeiten (23)

| ID                     | Bereich         | Einstiegspunkt                             |
| :--------------------- | :-------------- | :----------------------------------------- |
| `pusula-auth`            | auth            | Authentifizierungs- und Sitzungsverwaltung |
| `pusula-providers`       | providers       | Verwaltung von Anbieter-Verbindungen       |
| `pusula-models`          | models          | Modellkatalog und Funktionen               |
| `pusula-combos-routing`  | combos-routing  | Combo-Routing-Strategien                   |
| `pusula-api-keys`        | api-keys        | API-Schlüsselverwaltung                    |
| `pusula-usage-logs`      | usage-logs      | Nutzungs- und Kostenprotokolle             |
| `pusula-budget`          | budget          | Budgetbegrenzungen                         |
| `pusula-settings`        | settings        | Globale Einstellungen                      |
| `pusula-proxies`         | proxies         | Proxy-Pool-Verwaltung                      |
| `pusula-cache`           | cache           | Semantischer Cache + Prompt-Cache          |
| `pusula-compression`     | compression     | Engines zur Kontextkomprimierung           |
| `pusula-context-rtk`     | context-rtk     | RTK-Komprimierung                          |
| `pusula-resilience`      | resilience      | Leistungsschalter + Abkühlzeiten           |
| `pusula-cli-tools`       | cli-tools       | REST-Proxy für CLI-Werkzeuge               |
| `pusula-tunnels`         | tunnels         | Tunnelverwaltung                           |
| `pusula-sync-cloud`      | sync-cloud      | Cloud-Synchronisierung                     |
| `pusula-db-backups`      | db-backups      | Datenbanksicherungen                       |
| `pusula-webhooks`        | webhooks        | Dispatcher für Webhook-Ereignisse          |
| `pusula-mcp`             | mcp             | MCP-Server (110 Werkzeuge, 3 Transporte)   |
| `pusula-agents-a2a`      | agents-a2a      | A2A-Agentenprotokoll                       |
| `pusula-version-manager` | version-manager | Versions- und Aktualisierungsverwaltung    |
| `pusula-inference`       | inference       | Direkte Inferenz / Vervollständigungen     |

### CLI-Fähigkeiten (21)

| ID                    | Bereich            | CLI-Befehlsstamm        |
| :-------------------- | :----------------- | :---------------------- |
| `cli-serve`           | cli-serve          | `pusula serve`       |
| `cli-health`          | cli-health         | `pusula health`      |
| `cli-providers`       | cli-providers      | `pusula providers`   |
| `cli-keys`            | cli-keys           | `pusula keys`        |
| `cli-models`          | cli-models         | `pusula models`      |
| `cli-chat`            | cli-chat           | `pusula chat`        |
| `cli-routing`         | cli-routing        | `pusula routing`     |
| `cli-resilience`      | cli-resilience     | `pusula resilience`  |
| `cli-compression`     | cli-compression    | `pusula compression` |
| `cli-contexts`        | cli-contexts       | `pusula contexts`    |
| `cli-cost-usage`      | cli-cost-usage     | `pusula cost`        |
| `cli-mcp`             | cli-mcp            | `pusula mcp`         |
| `cli-a2a`             | cli-a2a            | `pusula a2a`         |
| `cli-tunnel`          | cli-tunnel         | `pusula tunnel`      |
| `cli-backup-sync`     | cli-backup-sync    | `pusula backup`      |
| `cli-policy-audit`    | cli-policy-audit   | `pusula policy`      |
| `cli-batches`         | cli-batches        | `pusula batch`       |
| `cli-eval`            | cli-eval           | `pusula eval`        |
| `cli-plugins-skills`  | cli-plugins-skills | `pusula plugins`     |
| `cli-setup`           | cli-setup          | `pusula setup`       |
| `cli-skill-collector` | cli-setup          | `pusula skills`      |

### Konfigurationsworkflow (1)

| ID                 | Bereich          | Einstiegspunkt                       |
| :----------------- | :--------------- | :----------------------------------- |
| `config-codex-cli` | config-codex-cli | Konfigurationsworkflow der Codex CLI |

---

## Wie externe Agenten Skills verwenden

### 1. Ermittlung über REST

```bash
# Den vollständigen Katalog abrufen
curl "http://your-pusula/api/agent-skills" | jq '.skills[] | {id, name, category}'

# SKILL.md zur Kontexteinspeisung abrufen
curl "http://your-pusula/api/agent-skills/pusula-providers/raw" > pusula-providers.md
```

### 2. Ermittlung über MCP

```typescript
// In einem Claude-Desktop-/Cursor-MCP-Client:
const result = await client.callTool("pusula_agent_skills_list", {
  category: "api",
});
// result.skills → Array von AgentSkill, jeweils mit rawUrl
```

### 3. Ermittlung über A2A

```python
import requests

resp = requests.post("http://your-pusula/a2a", json={
    "jsonrpc": "2.0", "id": "1",
    "method": "message/send",
    "params": {"skill": "list-capabilities", "messages": [{"role": "user", "content": "list"}]}
})
table = resp.json()["result"]["artifacts"][0]["content"]
# table ist eine Markdown-Tabelle mit allen 45 Skill-IDs und rawUrl-Spalten
```

### 4. Direkter GitHub-Raw-Abruf (kein Server erforderlich)

```bash
BASE="https://raw.githubusercontent.com/Ferhat-Yasinoglu/pusula/refs/heads/main/skills"
curl "${BASE}/pusula-providers/SKILL.md"
```

---

## Generator

Der Generator liest den kuratierten Katalog, die OpenAPI-Spezifikation und die CLI-Registry und schreibt für jeden Eintrag `skills/{id}/SKILL.md`:

```bash
# Vorschau (Testlauf, keine Schreibvorgänge)
curl -X POST http://localhost:20128/api/agent-skills/generate \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# Vollständige Neugenerierung
curl -X POST http://localhost:20128/api/agent-skills/generate \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"prune":false}'

# Bestimmte IDs neu generieren
curl -X POST http://localhost:20128/api/agent-skills/generate \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"onlyIds":["pusula-providers","cli-serve"]}'
```

Die Antwort des Generators ist ein `GeneratorReport`:

```json
{
  "generated": ["pusula-providers", "cli-serve"],
  "unchanged": [],
  "pruned": [],
  "orphansDetected": [],
  "errors": []
}
```

---

## Abdeckungs-API

```bash
curl "http://localhost:20128/api/agent-skills/coverage"
```

```json
{
  "api": { "have": 23, "total": 23 },
  "cli": { "have": 21, "total": 21 },
  "config": { "have": 1, "total": 1 },
  "totalSkills": 45,
  "generatedAt": "2026-08-02T00:00:00.000Z"
}
```

---

## Verwandte Inhalte

- [SKILLS.md](./SKILLS.md) — Pusula-Skills-Framework (LLM-Tool-Injektion + Marktplatz)
- [MCP-SERVER.md](./MCP-SERVER.md) — MCP-Tool-Katalog (`pusula_agent_skills_*`-Tools)
- [A2A-SERVER.md](./A2A-SERVER.md) — A2A-Protokoll (`list-capabilities`-Skill)
- `src/lib/agentSkills/` — Katalog, Generator, Parser
- `skills/` — generierte SKILL.md-Dateien (45 Einträge)
