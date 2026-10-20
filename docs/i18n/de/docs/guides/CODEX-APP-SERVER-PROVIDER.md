# OpenAI Codex — App-Server provider (`codex-app-server`) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CODEX-APP-SERVER-PROVIDER.md) · 🇮🇷 [fa](../../../fa/docs/guides/CODEX-APP-SERVER-PROVIDER.md) · 🇹🇷 [tr](../../../tr/docs/guides/CODEX-APP-SERVER-PROVIDER.md)

---

Pusula bietet **zwei** Möglichkeiten, OpenAI Codex zu verwenden:

| Anbieter               | Art der Kommunikation mit OpenAI                                                                                                                                                                               | Nutzungseinschränkung                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| **`codex`**            | Leitet dein ChatGPT-/OpenAI-OAuth-Token direkt an die Responses API weiter                                                                                                                                     | **Ja** — die offizielle Sitzung ist nicht für die Nutzung über Proxys/Router autorisiert |
| **`codex-app-server`** | Steuert den **CLI-eigenen `codex app-server` von Codex** über JSON-RPC/WebSocket; die CLI verwaltet und aktualisiert ihr OAuth (`~/.codex/auth.json`) selbst, genau wie bei einer interaktiven `codex`-Sitzung | **Nein** — Pusula leitet niemals ein Token an die API weiter                          |

Da `codex-app-server` niemals ein Token weiterleitet, gilt für ihn die
Nutzungseinschränkung bezüglich der Sitzungsweiterleitung nicht. Er erfordert
jedoch eine **Codex CLI, die unter der konfigurierten App-Server-URL erreichbar
ist**, und diese CLI muss **angemeldet** sein.

---

## 1. Architektur

```
┌─ Pusula-App ──────────────────┐        ┌─ codex-app-server-Sidecar ─────────┐
│  CodexAppServerExecutor          │  WS    │  codex app-server                   │
│  ws://codex-app-server:1456 ─────┼───────▶│  --listen ws://0.0.0.0:1456         │
│  (+ Berechtigungstoken)           │  JSON  │  --ws-auth capability-token         │
│                                  │  RPC   │  verwaltet OpenAI OAuth selbst      │
└──────────────────────────────────┘        │  (~/.codex/auth.json, autom. Aktual.)│
        │ gemeinsam genutzt                 └─────────────────────────────────────┘
        │ (Compose-Volumes)
        ▼
  codex-appserver-token   → das WS-Berechtigungstoken (von beiden eingebunden)
  codex-appserver-home    → ~/.codex (auth.json wird vom Dashboard geschrieben
                             und vom codex app-server des Sidecars gelesen)
```

- Der Sidecar lauscht **nur** im internen Compose-Netzwerk
  (`ws://codex-app-server:1456`) und ist durch ein Berechtigungstoken geschützt.
  Er wird **niemals** für den Host oder das Internet veröffentlicht.
- Die Codex CLI ist in `pusula:base` integriert, sodass bei Verwendung des
  Sidecars keine Codex-Installation auf dem Host oder dem Rechner des Benutzers
  erforderlich ist.

## 2. Starten

```bash
# Stack MIT dem Sidecar-Profil für den codex app-server starten:
docker compose --profile base --profile codex-app-server up -d
# (podman: podman compose --profile base --profile codex-app-server up -d)
```

Der Sidecar erstellt beim ersten Start sein WS-Berechtigungstoken (im gemeinsam
genutzten Volume `codex-appserver-token`), und die App liest dasselbe Token über
`PUSULA_CODEX_APPSERVER_WS_TOKEN_FILE`. Eine manuelle Token-Konfiguration ist
nicht erforderlich.

## 3. Verbinden + anmelden

1. Füge im Dashboard eine Verbindung für **OpenAI Codex (App-Server)** hinzu. Es
   ist weder ein API-Schlüssel noch ein Token erforderlich (es handelt sich um
   einen Anbieter ohne Authentifizierung — der Sidecar übernimmt die
   Authentifizierung).
2. Falls die Codex CLI des Sidecars **noch nicht angemeldet** ist, meldet die
   Zustandsprüfung der Verbindung _„läuft, aber nicht angemeldet“_ (keinen roten
   Authentifizierungsfehler). Verwende **Mit ChatGPT anmelden**: Dadurch wird das
   standardmäßige Geräte-OAuth von Codex in deinem Browser ausgeführt und
   anschließend `~/.codex/auth.json` über **Authentifizierung anwenden** in das
   gemeinsam genutzte Volume geschrieben (dieselbe Anmeldung dient sowohl dem
   Anbieter `codex` als auch `codex-app-server`).
3. Nach der Anmeldung wird die Zustandsprüfung grün (sie prüft sowohl `/readyz`
   **als auch** `account/read` — also, ob der Server aktiv _und_ authentifiziert
   ist), und die Verarbeitung beginnt.

Das Dashboard überschreibt niemals eine intakte vorhandene
`~/.codex/auth.json` — es schreibt nur, wenn die Datei fehlt oder ihr Token
veraltet ist (es wird immer eine Sicherung erstellt).

## 4. Bereitstellungsszenarien

- **Betreiber mit einer bereits authentifizierten Codex CLI** — binde dein
  `~/.codex` vom Host in den Sidecar (`codex-appserver-home`) ein und überspringe
  den Anmeldeschritt.
- **Öffentlicher Benutzer ohne lokal installiertes Codex** — irrelevant: Der
  Sidecar enthält die CLI. Der Benutzer authentifiziert sich lediglich über das
  Dashboard.
- **Bare-Metal-Pusula (kein Sidecar, Codex auf dem Host)** — setze
  `PUSULA_CODEX_APPSERVER_WS` auf deinen eigenen `codex app-server` und stelle
  sicher, dass Codex auf dem Host angemeldet ist; der Hinweis „Codex ist nicht
  installiert“ erscheint, wenn die Binärdatei fehlt.

## 5. Privater / UDP-Egress (optionale Betreiberkonfiguration, nicht enthalten)

Der generische Sidecar oben verwendet für den Egress das normale Netzwerk des
Containers. Ein Betreiber, der den Codex-Datenverkehr über einen **privaten
Ausgangspunkt** leiten muss (z. B. einen TUN-Tailscale-Sidecar, der TCP +
UDP/QUIC transportiert), führt diesen als separate Compose-Überschreibung aus;
er ist bewusst **nicht** Bestandteil des ausgelieferten Profils
`codex-app-server`. Einzelheiten zu dieser Einrichtung findest du im internen
Betriebshandbuch.
