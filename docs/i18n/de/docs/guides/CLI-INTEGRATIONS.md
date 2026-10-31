# CLI Integrations (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CLI-INTEGRATIONS.md) · 🇮🇷 [fa](../../../fa/docs/guides/CLI-INTEGRATIONS.md) · 🇹🇷 [tr](../../../tr/docs/guides/CLI-INTEGRATIONS.md)

---

Informationen zum gemeinsamen Manifest für ausführbare Dateien, zu eingeschränkten untergeordneten Umgebungen und zur persistenten
Gemini-Einrichtung finden Sie unter [CLI-Startverträge](./CLI-LAUNCH-CONTRACTS.md).

Pusula umfasst eine Familie von `setup-*`-Befehlen, die eine Coding-
CLI (Codex, Claude Code, OpenCode, Cline, …) so konfigurieren, dass sie Pusula als Backend verwendet — dadurch
kommuniziert das Tool mit **einem** Endpunkt, und Pusula leitet Anfragen mit
automatischem Fallback an den richtigen Anbieter weiter. Jeder Befehl liest den **aktuellen** Modellkatalog aus einer laufenden
Pusula-Instanz (lokal oder remote) und schreibt die eigene Konfigurationsdatei des Tools auf **Ihrem**
Computer. Der API-Schlüssel wird über eine Umgebungsvariable referenziert, sofern das Tool
dies unterstützt. Befehle, die eine lokale Umgebungsdatei für das Tool dauerhaft speichern, sind unten entsprechend gekennzeichnet.

Darüber hinaus gibt es einen generischen Starter — `pusula run <target>` —, der
`claude`, `codex`, `aider`, `goose`, `opencode`, `qwen` oder `gemini` mit den
korrekt gesetzten Umgebungsvariablen startet, ohne irgendeine Konfiguration zu schreiben. Ziele und ihre
Aliasse stammen aus dem kanonischen Manifest `bin/cli/cli-manifest.mjs`
(`claude-code|cc|anthropic`, `codex-cli|openai-codex|openai`, `goose-cli`,
`open-code`, `qwen-code`, `gemini-cli`), und `pusula completion` bietet dieselben
aus dem Manifest abgeleiteten Zielbegriffe an. Die bisherigen tool-spezifischen Starter —
`pusula launch` (Claude Code) und `pusula launch-codex` (Codex) — bleiben
verfügbar.

Das Onboarding von Anbietern ist aus demselben lokalen oder Remote-Kontext verfügbar. Die
folgenden API-orientierten Befehle halten die Verwaltungsauthentifizierung von den Anbieter-
Anmeldedaten getrennt und geben Anmeldedaten niemals in strukturierter Ausgabe aus:

```bash
pusula providers add glm --credential-env GLM_API_KEY --name work
pusula providers import ./providers.json --dry-run --json
pusula providers auth openai
pusula providers edit <connection-id> --default-model glm/glm-5.2
pusula providers remove <connection-id> --yes
```

Für Skripte sollten Sie `--credential-stdin` oder `--credential-env` bevorzugen; `--credential`
bleibt für die kontrollierte lokale Verwendung erhalten. `providers remove` erfordert auf einem
nicht interaktiven Terminal `--yes`, und alle fünf Befehle berücksichtigen den aktiven Kontext oder die
globalen Optionen `--base-url`/`--api-key`.

Anbieterselektoren weisen mehrdeutige ID-Präfixe, Namen oder Anbieternamen zurück; verwenden Sie
eine vollständige Verbindungs-ID, wenn mehrere Verbindungen übereinstimmen. Befehle zum Erstellen und Bearbeiten lesen
die gespeicherte Verbindung erneut ein, und beim Entfernen wird überprüft, dass sie nicht mehr ausgelesen werden kann.
Bei einem Import wird ein bereits vorhandenes Anbieter-/Namenspaar übersprungen. Importierte Einträge können
den Verwaltungsendpunkt, den Kontext oder die Verwaltungsanmeldedaten, die der CLI bereitgestellt wurden, nicht überschreiben.

Die einmalige, manuelle Basiseinrichtung der beiden umfangreichsten Integrationen wird in den
tool-spezifischen ausführlichen Anleitungen beschrieben:

- [Claude Code Konfiguration](./CLAUDE-CODE-CONFIGURATION.md)
- [Codex CLI Konfiguration](./CODEX-CLI-CONFIGURATION.md)
- [Remote-Modus](./REMOTE-MODE.md) — steuern Sie ein Remote-Pusula (VPS / Tailnet) von Ihrem Laptop aus

---

## Haupttabelle

Jeder Befehl berücksichtigt den **aktiven Kontext** (festgelegt mit `pusula connect`, siehe
[Remote-Modus](./REMOTE-MODE.md)) oder die expliziten Optionen `--remote <url> --api-key <key>`.
„Lokal vs. remote“ bedeutet im Folgenden: Ohne Optionen wird `http://localhost:20128`
verwendet; mit `--remote` (oder einem aktiven Remote-Kontext) wird der Katalog von diesem
Server abgerufen und die Konfiguration lokal gespeichert.

| Befehl                  | Tool                         | Was geschrieben wird                                                                                                                                                                                       | Wichtige Flags                                                                                                                             | Lokal vs. Remote |
| ----------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `pusula setup-codex`    | OpenAI Codex CLI             | `~/.codex/<name>.config.toml` — ein Profil pro kompatiblem Textmodell (`codex --profile <name>`)                                                                                                           | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home`                                                                        | Beides           |
| `pusula setup-claude`   | Claude Code                  | `~/.claude/profiles/<name>/settings.json` — ein Profil pro übereinstimmendem Modell (`CLAUDE_CONFIG_DIR`)                                                                                                  | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home`                                                                       | Beides           |
| `pusula setup-opencode` | OpenCode (OpenAI-kompatibel) | `~/.config/opencode/opencode.json` — `pusula`-Provider mit jedem Katalogmodell (`opencode -m pusula/<model>`)                                                                                              | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port`                                                                             | Beides           |
| `pusula setup-cline`    | Cline                        | `~/.cline/data/{globalState,secrets}.json` (CLI-Modus) + gibt die Einstellungen für die VS-Code-Erweiterung aus                                                                                            | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir`                                                                | Beides           |
| `pusula setup-kilo`     | Kilo Code                    | `~/.local/share/kilo/auth.json` (CLI) + führt `kilocode.*` mit der VS-Code-Datei `settings.json` zusammen, sofern vorhanden                                                                                | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings`                                            | Beides           |
| `pusula setup-continue` | Continue / `cn` CLI          | `~/.continue/config.yaml` — Modelle mit `provider: openai`, Schlüssel über `${{ secrets.PUSULA_API_KEY }}`                                                                                                 | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | Beides           |
| `pusula setup-cursor`   | Cursor                       | Nichts — gibt die in der App auszuführenden Schritte aus (die Cursor-Konfiguration ist undurchsichtiges SQLite)                                                                                            | `--remote` `--api-key` `--only` `--port`                                                                                                   | Beides           |
| `pusula setup-roo`      | Roo Code                     | `~/.pusula/roo-settings.json` (Importdokument) + setzt `roo-cline.autoImportSettingsPath`, wenn eine VS-Code-Datei `settings.json` vorhanden ist                                                           | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings`                                          | Beides           |
| `pusula setup-crush`    | Crush                        | `~/.config/crush/crush.json` — `openai-compat`-Provider, Schlüssel über `$PUSULA_API_KEY`                                                                                                                  | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | Beides           |
| `pusula setup-zed`      | Zed                          | `~/.config/zed/settings.json` — `openai_compatible.pusula`-Provider (≤ 25 Tool-fähige Modelle), Schlüssel über `$PUSULA_API_KEY`                                                                           | `--remote` `--api-key` `--only` `--reset` `--dry-run` `--port` `--config-path`                                                             | Beides           |
| `pusula setup-goose`    | Goose                        | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + gibt eine Anleitung für Umgebungsvariablen aus                                                                              | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | Beides           |
| `pusula setup-aider`    | Aider                        | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + gibt eine Anleitung für Umgebungsvariablen aus                                                                                            | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | Beides           |
| `pusula setup-qwen`     | Qwen Code                    | `~/.qwen/settings.json` — V4-Array `modelProviders.openai` + `PUSULA_API_KEY` in `~/.qwen/.env`                                                                                                            | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` `--env-path`                                                 | Beides           |
| `pusula setup-5dive`    | 5dive (Agentenflotte)        | Nichts unter `$HOME` — schreibt über `5dive agent auth set` ein 5dive-**Authentifizierungsprofil** (`/var/lib/5dive/auth-profiles/<name>/`); nur für root, wird auf dem Flotten-Host ausgeführt            | `--remote` `--api-key` `--model` `--auth-profile` `--agent` `--byo-provider` `--fivedive-bin` `--no-sudo` `--yes` `--dry-run` `--port`     | Beide            |
| `pusula run <target>`   | Laufzeitstart (generisch)    | Nichts — startet `claude`/`codex`/`aider`/`goose`/`opencode`/`qwen`/`gemini` mit der richtigen Umgebung und den richtigen Argumenten; Qwen und Gemini verwenden ein temporäres isoliertes Home-Verzeichnis | `--remote` `--base-url` `--context` `--provider` `--model` `--api-key` `--api-key-env` `--dry-run` `--json` `--port` `--profile` `--token` | Beide            |
| `pusula launch`         | Claude Code                  | Nichts — startet `claude` mit injiziertem `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN`                                                                                                                      | `--remote` `--api-key` `--token` `--profile` `--port`                                                                                      | Beide            |
| `pusula launch-codex`   | OpenAI Codex CLI             | Nichts — startet `codex` mit dem über `-c`-Flags injizierten `pusula`-Provider                                                                                                                             | `--remote` `--api-key` `--profile` (`-p`) `--port`                                                                                         | Beide            |

Hinweise zu den Flags (im Quellcode des Befehls verifiziert):

- `--remote <url>` — ruft den Katalog von einer entfernten Pusula-Instanz ab (überschreibt `--port`
  und den aktiven Kontext). `--api-key <key>` stellt die Anmeldedaten für diesen
  Server bereit (standardmäßig aus der Umgebungsvariable `PUSULA_API_KEY` oder dem Token des aktiven Kontexts).
- `--only <patterns>` — kommagetrennte Teilzeichenfolgen; behält nur übereinstimmende Modell-IDs
  bei (z. B. `--only glm,kimi`). Verfügbar für `setup-codex`, `setup-claude`,
  `setup-opencode`, `setup-continue`, `setup-cursor`, `setup-crush`, `setup-zed`.
- `--dry-run` — gibt exakt aus, was geschrieben würde, ohne das
  Dateisystem zu verändern. Verfügbar für jeden `setup-*`-Befehl **außer** `setup-cursor`
  (der niemals eine Datei schreibt).
- `--model <id>` — erforderlich (oder interaktiv ausgewählt) für die Werkzeuge, die keine
  automatische Modellerkennung besitzen: Cline, Kilo, Roo, Goose, Qwen, Aider, 5dive. Diese Werkzeuge
  akzeptieren für nicht interaktive Ausführungen außerdem `--yes` (wobei dann `--model` erforderlich ist).
  `setup-opencode` verwendet `--model`, um das standardmäßige Modell auf oberster Ebene festzulegen.
- `--model <id>` für `pusula run` folgt der zielspezifischen Verdrahtung des Manifests
  (`bin/cli/cli-manifest.mjs`): **aider** erhält `--model openai/<id>` und
  **opencode** `--model pusula/<id>` (das Präfix wird nur hinzugefügt, wenn die ID
  es nicht bereits enthält); **qwen** und **gemini** erhalten die ID unverändert;
  **claude** erhält sie über `ANTHROPIC_MODEL`, **goose** über `GOOSE_MODEL` und
  **codex** über `-c model_providers.pusula.*`-Argumente. **Qwen ist das einzige Ausführungsziel,
  für das `--model` zwingend erforderlich ist** — `pusula run qwen` ohne dieses Flag wird
  mit dem Exit-Code `2` und einer ausdrücklichen Fehlermeldung beendet.
- `--port <port>` — lokaler Pusula-Port (standardmäßig `20128`, wird ignoriert, wenn `--remote`
  gesetzt ist). Bei allen `setup-*`-Befehlen und beiden Launchern vorhanden.
- Exit-Codes von `pusula run`: Der eigene Exit-Code der untergeordneten CLI wird
  unverändert weitergegeben; `2` = ungültige Argumente (nicht unterstütztes Ziel, fehlendes erforderliches
  `--model`, Container-Schutzprüfung); `127` = die Ziel-Binärdatei befindet sich nicht in `PATH`;
  `130`/`143`/`129`, wenn der Start durch `SIGINT`/`SIGTERM`/`SIGHUP` beendet wird;
  `1` = sonstiger Fehler beim Laufzeitstart.
- Die beiden Launcher (`launch`, `launch-codex`) akzeptieren `--profile <name>`, um
  ein von `setup-claude` / `setup-codex` geschriebenes Profil auszuwählen, sowie durchgereichte Argumente für
  die zugrunde liegende `claude`- / `codex`-Binärdatei.

Die interaktive Auswahl wird auch von den Einrichtungsrezepten gemeinsam verwendet:

```bash
# Aus dem aktiven lokalen oder entfernten Modellkatalog auswählen und das Ziel konfigurieren.
pusula configure claude
pusula configure opencode --provider glm
pusula configure qwen --model qwen/qwen3.8-max-preview --yes
```

`configure` delegiert derzeit an die getesteten Rezepte für `codex`, `claude`,
`opencode`, `qwen`, `aider`, `goose`, `cline`, `continue`, `kilo` und `5dive`.
Katalogeinträge, die ausschließlich für IDEs, MITM oder Anleitungen vorgesehen sind, bleiben explizite `setup-*`-/manuelle Abläufe und
werden nicht als ausführbare Ziele angeboten.

> `setup-opencode` ist die **leichtgewichtige OpenAI-kompatible** OpenCode-Integration.
> Daneben gibt es eine umfangreichere Plugin-Integration — `pusula setup opencode` —, die
> `@pusula/opencode-plugin` installiert. Es handelt sich um unterschiedliche Befehle; die obige Tabelle
> dokumentiert `setup-opencode`.
>
> Das Plugin ist in zwei Paketen verfügbar, eines pro OpenCode-Hauptversion, da die beiden
> Loader unterschiedliche Einstiegspunkte erwarten:
> `@pusula/opencode-plugin` für OpenCode v1 und
> `@pusula/opencode-plugin-v2` für OpenCode v2. Das v2-Paket ist neu
> (`0.1.0`) und folgt einem Host-Vertrag, der sich noch verändert. Daher liest es die
> Struktur, die OpenCode in den Katalogentwurf einträgt, statt eine bestimmte Struktur vorauszusetzen. Installieren
> Sie es, indem Sie `opencode.json` einen `plugins`-Eintrag hinzufügen; `pusula setup opencode`
> installiert weiterhin das v1-Paket. Optionen und die Reihenfolge bei der Suche nach Anmeldedaten sind in
> der README des Pakets dokumentiert.

---

## Lokale Verwendung

Wenn Pusula auf `localhost:20128` läuft, führen Sie einfach den Einrichtungsbefehl für Ihr
Tool aus. Der Katalog wird vom lokalen Server abgerufen.

```bash
# Codex: Für jedes passende Modell ein Profil unter ~/.codex/ schreiben
pusula setup-codex
codex --profile glm52            # ein generiertes Profil verwenden

# Claude Code: Modellspezifische Profile schreiben und anschließend eines starten
pusula setup-claude
pusula launch --profile glm52

# OpenCode: Den OpenAI-kompatiblen Provider mit allen Katalogmodellen schreiben
pusula setup-opencode
export PUSULA_API_KEY=sk-...  # wird über {env:PUSULA_API_KEY} referenziert, niemals auf der Festplatte gespeichert
opencode -m pusula/glm/glm-5.2 "..."

# Tools ohne automatische Erkennung benötigen ein explizites Modell:
pusula setup-aider --model glm/glm-5.2
pusula setup-qwen --model qwen/qwen3.8-max-preview

# Vorschau, ohne etwas zu schreiben:
pusula setup-continue --dry-run
```

Starten, ohne irgendeine Konfiguration zu schreiben (nur Umgebungsvariablen-Injektion):

```bash
pusula launch                 # Claude Code → lokales Pusula
pusula launch-codex           # Codex CLI → lokales Pusula
pusula launch-codex --profile glm52
pusula run claude --model openai/gpt-5.4
pusula run codex --model openai/gpt-5.4 --dry-run --json
pusula run aider --model glm/glm-5.2 -- --message "reply OK"
pusula run goose --model glm/glm-5.2
pusula run opencode --model glm/glm-5.2 -- run "reply OK"
pusula run qwen --model glm/glm-5.2 -- -p "reply OK"
pusula run gemini --model glm/glm-5.2 -- --skip-trust -p "reply OK"

# Expliziter Befehlspfad: Alles nach -- unverändert weiterreichen
pusula run claude -- --print-system-prompt "review this diff"
```

---

## Remote-Verwendung

Richten Sie jeden Einrichtungsbefehl mit `--remote` + `--api-key` auf ein entferntes Pusula. Der
Katalog wird vom Remote-System abgerufen; die Konfiguration wird auf Ihrem lokalen Rechner geschrieben.

```bash
# OpenCode für einen Remote-VPS; nur glm/kimi-Modelle behalten
pusula setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx \
  --only glm,kimi
opencode -m pusula/glm/glm-5.2 "..."   # zuerst PUSULA_API_KEY exportieren

# Codex-Profile aus einem Remote-Katalog
pusula setup-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# Eine CLI direkt für das Remote-System starten
pusula launch       --remote http://192.168.0.15:20128 --api-key oma_live_xxx
pusula launch-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

Statt `--remote`/`--api-key` jedes Mal zu übergeben, melden Sie sich einmal an und lassen Sie
sie automatisch durch den **aktiven Kontext** bereitstellen:

```bash
pusula connect 192.168.0.15        # erstellt ein Token mit begrenztem Gültigkeitsbereich und speichert den Kontext
pusula setup-codex                 # ← verwendet jetzt den Remote-Katalog
pusula setup-opencode              # ← ebenso
pusula launch                      # ← Claude Code für das Remote-System
```

Informationen zu Kontexten, Gültigkeitsbereichen und Token-Verwaltung finden Sie unter [Remote-Modus](./REMOTE-MODE.md).

---

## 5dive-Agentenflotten

[5dive](https://5dive.ai) betreibt eine Flotte langlebiger Coding-Agenten, von denen jeder als
systemd-Unit unter einem eigenen Unix-Benutzer ausgeführt wird. Es ist selbst keine Coding-CLI, daher gibt es
für `pusula run` nichts zu starten — `5dive` ist ein Ziel, das **nur konfiguriert** wird.

```bash
pusula configure 5dive --model failover-demo --yes
pusula setup-5dive --model failover-demo --auth-profile pusula --agent worker1
```

Beide Varianten schreiben ein 5dive-**Authentifizierungsprofil**, und jeder an dieses
Profil gebundene `claude`-Seat kommuniziert anschließend mit Pusula. Drei Aspekte sind speziell für dieses Ziel:

- **Es wird auf dem Flottenhost als root ausgeführt.** Die Befehle von 5dive wirken auf lokale systemd-Units
  und ein root gehörendes Statusverzeichnis; einen Remote-Modus gibt es nicht. Das Rezept führt sich über
  `sudo` erneut aus, wenn es nicht bereits als root läuft (`--no-sudo` deaktiviert dies und gibt stattdessen den
  Befehl aus).
- **Der Endpunkt muss `https://` verwenden, sofern es sich nicht um eine Loopback-Adresse handelt.** Der API-Schlüssel des Agenten
  wird bei jeder Anfrage über diese URL übertragen, und 5dive lehnt einen unverschlüsselten externen Endpunkt ab.
  Eine private LAN-Adresse stellt keine Ausnahme dar.
- **Die eigene Modellfestlegung jedes Seats hat Vorrang vor dem Profil.** Das Profil enthält
  `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL`, aber ein Seat, der weiterhin auf eine Standard-
  Modell-ID festgelegt ist, bricht seinen ersten Durchlauf mit _"There's an issue with the selected model"_ ab.
  Übergeben Sie `--agent <name>` (wiederholbar), um auch die Seats festzulegen; andernfalls gibt das Rezept den
  entsprechenden Befehl aus.

Der API-Schlüssel wird 5dive über **stdin** (`--api-key=-`) übergeben, sodass er niemals in der
Ausgabe von `ps` erscheint.

Indem das Profil statt auf ein einzelnes Modell auf eine Pusula-**Kombination** verweist,
erhält die Flotte Provider-Failover: Als der primäre Endpunkt während des in
[#11578](https://github.com/Ferhat-Yasinoglu/pusula/issues/11578) dokumentierten Durchlaufs mitten in einer Ausführung
vollständig ausfiel, führte der Agent seine verbleibenden Schritte über das Fallback aus, ohne
den Ausfall offenzulegen.

---

## Konventionen für Basis-URLs (welche Tools `/v1` benötigen)

Pusula stellt die OpenAI-Schnittstelle unter `/v1`, die Anthropic-Schnittstelle im Stammverzeichnis
und eine native Gemini-Schnittstelle unter `/v1beta` bereit. Jede Integration ist für die Form konfiguriert,
die das jeweilige Tool erwartet (im Quellcode des Befehls verifiziert):

| Integration                                                                | Eingetragene Basis-URL | `/v1`?                                         |
| -------------------------------------------------------------------------- | ---------------------- | ---------------------------------------------- |
| `setup-cline` (`openAiBaseUrl`)                                            | Stammverzeichnis       | Nein — Cline hängt `/v1/chat/completions` an   |
| `setup-goose` (`OPENAI_HOST`)                                              | Stammverzeichnis       | Nein — Goose hängt den Pfad an                 |
| `setup-aider` (`OPENAI_API_BASE`)                                          | Stammverzeichnis       | Nein — LiteLLM hängt `/v1/chat/completions` an |
| `setup-kilo`, `setup-roo`, `setup-continue`, `setup-crush`, `setup-cursor` | mit `/v1`              | Ja                                             |
| `setup-zed` (`language_models.openai_compatible.pusula.api_url`)           | mit `/v1`              | Ja                                             |
| `setup-claude` (`ANTHROPIC_BASE_URL`), `launch`                            | Stammverzeichnis       | Nein — Claude Code hängt `/v1/messages` an     |
| `setup-codex`, `launch-codex` (`model_providers.pusula.base_url`)          | mit `/v1`              | Ja                                             |
| `setup-qwen` (`modelProviders.openai[].baseUrl`)                           | mit `/v1`              | Ja                                             |
| `run gemini` (`GOOGLE_GEMINI_BASE_URL`)                                    | Stammverzeichnis       | Nein — das SDK hängt `/v1beta/models/…` an     |
| `setup-5dive` (`ANTHROPIC_BASE_URL` im Authentifizierungsprofil)           | Stammverzeichnis       | Nein — Claude Code hängt `/v1/messages` an     |

---

## Native Abhängigkeiten bei Updates beibehalten: `--include=optional`

Wenn Sie mit `pusula update` aktualisieren (nach einer Bestätigung oder mit `--apply`),
führt Pusula die Installation mit dem fest integrierten Parameter `--include=optional` aus:

```bash
npm install -g pusula@latest --include=optional
```

Dies ist **kein** Parameter, den Sie an `pusula update` übergeben — er wird vom
Updater immer angewendet. Dadurch ist gewährleistet, dass die `optionalDependencies`
(`better-sqlite3`, `keytar`, `tls-client`, der LLMLingua-SLM-Stack) das Update überstehen,
selbst wenn in Ihrer npm-Konfiguration `omit=optional` festgelegt ist. Andernfalls würden
der native SQLite-Treiber und die Betriebssystem-Schlüsselbundanbindung ohne Hinweis
entfernt. So zeigen Sie den genauen Befehl in der Vorschau an, ohne ihn auszuführen:

```bash
pusula update --dry-run
# [TESTLAUF] Würde Folgendes ausführen: npm install -g pusula@latest --include=optional
```

Weitere Parameter für `pusula update` (im Quellcode verifiziert): `--check` (Beenden mit
Status 1, wenn veraltet), `--apply` (ohne Rückfrage installieren), `--changelog`, `--no-backup`,
`--yes`.

---

## Google Gemini CLI über `pusula run gemini`

Der Vertrag wurde anhand von `@google/gemini-cli` 0.50.0 verifiziert: Die CLI berücksichtigt
`GOOGLE_GEMINI_BASE_URL` und sendet `POST /v1beta/models/<model>:generateContent`
(und `:streamGenerateContent?alt=sse`) dorthin — exakt die native Gemini-Schnittstelle
von Pusula (`/v1beta`). `pusula run gemini` konfiguriert dies automatisch:

- `GOOGLE_GEMINI_BASE_URL` → die aktive Pusula-Base-URL (Stammverzeichnis, kein `/v1`);
- `GEMINI_API_KEY` → die aufgelösten Pusula-Anmeldedaten (Option/Umgebung/Kontext);
- ein **temporäres, isoliertes `GEMINI_CLI_HOME`**, dessen `.gemini/settings.json`
  die Authentifizierung `gemini-api-key` auswählt, sodass eine gespeicherte Google-OAuth-Sitzung
  (Code Assist) den an Pusula gerichteten Start niemals überschreibt — nach dem Beenden entfernt;
- **Umgebungshygiene**: Aus der Kindprozessumgebung werden `GOOGLE_API_KEY`,
  `GOOGLE_GENAI_USE_VERTEXAI` und `GOOGLE_GENAI_USE_GCA` entfernt (da diese die
  Authentifizierung zu Vertex/Code Assist umleiten würden), und
  `GEMINI_DEFAULT_AUTH_TYPE=gemini-api-key` wird als zusätzliche Absicherung gesetzt —
  die anderen `run`-Ziele werden für ihre jeweiligen kollidierenden Variablen genauso behandelt;
- Einfügung von `--model <id>` aus `--provider`/`--model`.

```bash
pusula run gemini --model glm/glm-5.2 -- --skip-trust -p "hello"
```

Geminis Schutzmechanismus für das Vertrauen in Arbeitsbereiche gilt weiterhin im Headless-Modus —
übergeben Sie selbst `--skip-trust` (oder vertrauen Sie dem Verzeichnis interaktiv); der Launcher
umgeht diesen Schutz bewusst nicht. Dieser Launcher unterscheidet sich von der **ACP-Registrierung**
(`src/lib/acp/registry.ts`, `gemini --acp`), die weiterhin die Agentenprotokoll-Integration für
`/dashboard/acp-agents` darstellt.

---

## Echter Smoke-Durchlauf (Opt-in)

Deterministische Regressionstests für den Startplan werden in CI ausgeführt (`tests/unit/cli/run-command.test.ts`,
`tests/unit/cli/run-execution.test.ts`). Um die ECHTEN Binärdateien gegen einen ECHTEN
Pusula-Server zu validieren, steht unter
`tests/integration/upstream-cli-smoke.int.test.ts` ein optionales Test-Harness zur Verfügung. Es wird niemals automatisch ausgeführt
(jeder Untertest wird übersprungen, sofern nicht `RUN_CLI_SMOKE=1` gesetzt ist), übergibt die Anmeldedaten über den NAMEN der Umgebungsvariable
(niemals über den Wert), schwärzt schlüsselähnliche Zeichenfolgen in allen aufgezeichneten Ausgaben, überspringt
Ziele, deren Binärdatei nicht installiert ist, und klassifiziert Fehler als
Authentifizierungs- / Upstream- / Konfigurationsfehler statt als einfachen booleschen Wert:

```bash
RUN_CLI_SMOKE=1 \
PUSULA_SMOKE_BASE_URL="http://localhost:20128" \
PUSULA_SMOKE_MODEL="<provider/model>" \
PUSULA_SMOKE_API_KEY_ENV="PUSULA_API_KEY" \
node --import tsx/esm --test tests/integration/upstream-cli-smoke.int.test.ts
```

Optional: `PUSULA_SMOKE_TARGETS="codex,opencode,qwen"` beschränkt den Durchlauf;
`PUSULA_SMOKE_TIMEOUT_MS` überschreibt das Zeitlimit von 120 Sekunden pro Ziel.

---

## Siehe auch

- [Claude-Code-Konfiguration](./CLAUDE-CODE-CONFIGURATION.md) — der ausführlichere Leitfaden zu Claude Code
- [Codex-CLI-Konfiguration](./CODEX-CLI-CONFIGURATION.md) — die einmalige Basiseinrichtung von `[model_providers.pusula]`
- [Remote-Modus](./REMOTE-MODE.md) — Kontexte, bereichsgebundene Zugriffstoken und die Steuerung eines Remote-Servers
- [CLI-Tools-Referenz](../reference/CLI-TOOLS.md) — der vollständige Katalog der unterstützten Tools und Dashboard-Seiten
- [Einrichtungsleitfaden](./SETUP_GUIDE.md) — Installationsmethoden und Ersteinrichtung
