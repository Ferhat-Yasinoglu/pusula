# Devin Claude Bridge (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../DEVIN_CLAUDE_BRIDGE.md) · 🇮🇷 [fa](../../fa/docs/DEVIN_CLAUDE_BRIDGE.md) · 🇹🇷 [tr](../../tr/docs/DEVIN_CLAUDE_BRIDGE.md)

---

`devin-cli-agentic` ermöglicht es der echten Claude-Code-Laufzeit, den lokalen Anthropic-
Messages-Endpunkt von Pusula zu verwenden, während die offizielle Devin CLI die Modellantworten
über ACP-stdio bereitstellt. Die bestehenden Anbieter für Anthropic, Claude OAuth, Claude Web oder
`devin-cli` werden dabei nicht verändert.

Leiten Sie Aufrufe von clientseitig ausgeführten Tools über `devin-cli-agentic` (Alias `dva`),
den Tool-fähigen Anbieter im Claude-Format. Der ältere ACP-Executor `devin-cli` (`dv`) ist
rein textbasiert: Er führt Devins Summarizer ohne Tools aus und kann keine Tool-Aufrufe zurückgeben.
Seine Modellmetadaten sind entsprechend gekennzeichnet, sodass Combo-Routing, das Tools erfordert,
ihn vermeidet.

> **Aktueller Status: Claude Code ist auf `2.1.258` festgesetzt; die letzte Offline- und
> Live-Validierung wurde für `2.1.220` protokolliert.** Mit der Festsetzung auf `2.1.220`
> wurden drei isolierte Szenarien über Devin CLI `3000.2.17` und das Modell
> `swe-1-7-lightning` abgeschlossen; dieser abschließende Live-Lauf bestätigte clientseitig
> ausgeführte `Read`-, `Edit`- und `Bash`-Interaktionen, erfolgreiche `npm test`-Ergebnisse,
> die Erkennung von Projektbefehlen und Skills, ausschließliches Routing über Devin sowie
> keinerlei ausgehenden Datenverkehr zu Claude. Anschließend wurde die festgesetzte Version
> auf `2.1.258` angehoben (die CLI-Generation, deren Claude-Identität Pusula imitiert, und
> die erste Versionslinie, die die Stufe Fable 5.1 nativ bereitstellt). Mit der neuen
> festgesetzten Version wurden die Installationsschicht und `claude --version` auf dem
> festgesetzten Basis-Image überprüft. Außerdem bestehen die Unit-Test-Suite der Bridge,
> `compose config` und der statische Isolationsnachweis – das Offline-Mock-Szenario und die
> Live-Suite mit drei Szenarien wurden jedoch noch nicht erneut ausgeführt. Führen Sie diese
> erneut aus (siehe „Aktualisieren festgesetzter Tools“), bevor Sie sich mit dieser
> festgesetzten Version auf die Bridge verlassen.

## Architektur

```text
Claude Code 2.1.258 (isolierter Linux-Container ohne Root-Rechte)
  -> http://pusula:20128/v1/messages
  -> devin-cli-agentic (Claude-Format, Anbieter ohne Authentifizierung)
  -> devin acp --agent-type summarizer (offizielles ACP-stdio, keine Devin-Tools)
  -> Devin-Konto im dedizierten devin-auth-Volume
```

Der standardmäßige ACP-Agent der offiziellen CLI kann seine eigenen Tools ausführen, daher
verwendet diese Bridge ihn nicht. Sie startet den fest vorgegebenen ACP-Agenten `summarizer`,
dessen offizieller CLI-Modus keine Tools besitzt, und rahmt die serialisierte Anthropic-Anfrage
als Ausführungsprotokoll ein. Wenn eine weitere von Claude ausgeführte Aktion erforderlich ist,
muss die Antwort genau einen Client-Tool-Umschlag enthalten. Jeder ACP-`tool_call` oder jedes
ACP-`tool_call_update` wird abgelehnt, bevor eine Antwort als erfolgreich gemeldet werden kann.

Der Serialisierer in `open-sse/executors/devin-agentic/serializer.ts` bewahrt `system`,
`text`, `tool_use`, `tool_result`, `thinking`, `redacted_thinking`, `tool_choice` und die
von Claude Code bereitgestellten Tools. Bilder und unbekannte Blöcke führen explizit zu einem
Fehler. Große Tool-Ergebnisse verwenden eine sichtbare Kürzungsmarkierung.

Der Parser akzeptiert pro Modellinteraktion einen eigenständigen `<tool>{...}</tool>`-Umschlag.
Er gleicht den Namen mit der Tool-Liste der Anfrage ab, validiert die Argumente anhand des
JSON-Schemas dieses Tools, lehnt Mischungen aus Erläuterungen und Aktionen ab und erlaubt
einen begrenzten Reparaturversuch. Claude Code führt anschließend den resultierenden
Anthropic-`tool_use` lokal aus und sendet das `tool_result` über Pusula zurück.

## Automatisches Routing

Der Anbieter kann in den `auto/*`-Kandidatenpools von Pusula berücksichtigt werden, sofern
er nicht blockiert ist. Die Eignung als Kandidat garantiert keine Auswahl: Die Routing-Strategie
der Combo (beispielsweise „last-known-good“) kann einen anderen Anbieter bevorzugen. Verwenden
Sie `dva/<model>` oder eine Combo mit Devin-Priorität, wenn jede Anfrage über Devin geleitet
werden muss.

## Isolation und Bedrohungsmodell

Die Claude-Installation, das Konto und die Konfiguration des Hosts liegen außerhalb des Geltungsbereichs und werden als verboten behandelt. Die Compose-Dienste:

- werden mit UID/GID `10001:10001`, einem schreibgeschützten Root-Dateisystem, verworfenen Berechtigungen und `no-new-privileges` ausgeführt;
- verwenden ein privates `/home/bridge`, ein dediziertes Claude-Konfigurations-Volume, isolierte Pusula-Daten und ein separates `devin-auth`-Volume;
- binden nur kurzlebige `.sandbox`-Arbeitsbereiche/-Nachweise ein;
- binden weder das Home-Verzeichnis des Hosts noch Keychain, SSH-, Cloud-Anmeldedaten oder den Docker-Socket ein;
- erstellen explizite Umgebungen und entfernen Anthropic-API-/OAuth-/Routing-Variablen;
- leiten Claude-Code-Inferenz ausschließlich mit einem nur lokal gültigen Schlüssel an `http://pusula:20128` weiter.

Das Offline-Profil verwendet ein internes Netzwerk. Im Live-Profil erreicht Pusula die offiziellen Devin-Endpunkte ausschließlich über `network-guard`; nicht zugehörige Ziele werden verweigert. Claude Code verfügt über eine separate Egress-Sperre, die sämtlichen ausgehenden Datenverkehr verweigert, und kann nur über `NO_PROXY` auf den lokalen Pusula-Dienst zugreifen. Guard-Auditdateien werden ausschließlich in den jeweiligen Guard-Prozess eingebunden. Die Skripte überprüfen Dateieigentümer, Modus, Linkanzahl und jede Entscheidung, bevor sie tokenfreie Nachweise exportieren.

Führen Sie den Isolationsnachweis unabhängig aus:

```bash
./scripts/devin-bridge/verify-anthropic-isolation
```

Dabei werden Topologie, benannte Einbindungen, Nicht-Root-/Schreibschutzeinstellungen, explizites lokales Routing, das Fehlen sensibler Umgebungsvariablen, das Fehlen des Docker-Sockets, der blockierte Zugriff auf `api.anthropic.com` und `claude.ai`, die ausschließliche Auswahl des Devin-Anbieters sowie ein expliziter Fehler bei Nichtverfügbarkeit des ACP-Backends validiert.

## Ersteinrichtung und normale Verwendung

Erstellen Sie das fest versionierte Image:

```bash
./scripts/devin-bridge/build
```

Authentifizieren Sie ausschließlich das isolierte Devin-Volume:

```bash
ENABLE_LIVE_DEVIN_TESTS=1 ./scripts/devin-bridge/login-devin
```

Der Anmeldebefehl verwendet den offiziellen manuellen Token-Ablauf, der für Remote-/Containerumgebungen vorgesehen ist. Der Wert wird direkt in die CLI-Eingabeaufforderung eingegeben; er wird weder als Prozessargument übergeben noch in Git geschrieben oder vom Host kopiert.

Starten Sie die isolierte Claude-Code-Laufzeitumgebung:

```bash
./scripts/devin-bridge/launch
```

`launch` überprüft vor dem Start des containerisierten Claude Code erneut die Isolation, die Devin-Authentifizierung und die Modellerkennung. Dabei wird niemals die Claude-Programmdatei des Hosts ausgeführt. Modellaliase können in `.env.devin-bridge` festgelegt werden; jeder konfigurierte Wert muss das Präfix `devin-cli-agentic/` beibehalten.

## Validierungsbefehle

Der reproduzierbare Offline-Pfad erfordert kein Devin-Konto und hat während der Ausführung keinen Internetzugriff:

```bash
./scripts/devin-bridge/test-unit
./scripts/devin-bridge/test-contract
./scripts/devin-bridge/test-e2e-mock
./scripts/devin-bridge/verify-anthropic-isolation
```

Der authentifizierte, optionale Live-Pfad lautet:

```bash
ENABLE_LIVE_DEVIN_TESTS=1 ./scripts/devin-bridge/test-live-devin
```

Der Live-Runner wartet zwischen den Szenarien, um ACP-Sitzungen nicht schubweise zu öffnen, und validiert strukturierte Claude-Stream-Ereignisse, anstatt textuellen Behauptungen zu vertrauen. Seine drei Szenarien weisen Folgendes nach:

1. direkte Projektlesezugriffe und Fehleranalyse;
2. eine echte `Edit`-Operation, einen clientseitig ausgeführten `Bash`-Befehl `npm test` und ein abschließendes Ergebnis;
3. die Erkennung von `/bridge-check` und `bridge-proof`, Projektlesezugriffe, einen weiteren erfolgreichen clientseitig ausgeführten `npm test` und den Abschluss ohne ausstehende Arbeit.

Die abschließende Prüfung kontrolliert außerdem das Devin-Netzwerk-Audit und verlangt, dass das Claude-Egress-Audit leer bleibt.

## Aktualisieren fixierter Tools

Das Image fixiert Node, Claude Code und Devin CLI in
`docker/devin-bridge/Dockerfile`. So aktualisieren Sie sie:

1. Ändern Sie die expliziten Versionen;
2. ersetzen Sie beide architekturspezifischen Prüfsummen der Devin-Archive durch die Werte des offiziellen
   Artefakts;
3. erstellen Sie das Image neu und führen Sie jeden Offline-Validierungsbefehl aus;
4. bestätigen Sie die Versionen innerhalb des Images;
5. führen Sie die authentifizierte Live-Suite mit drei Szenarien erneut aus.

Installieren Sie keine der beiden CLIs global auf dem Host und ersetzen Sie die Prüfsummenverifizierung nicht durch einen
nicht verifizierten Download.

## Diagnose und Bereinigung

- `docker compose -f docker/devin-bridge/compose.yml --profile offline logs pusula`
  zeigt lokales Routing und bereinigte Executor-Fehler.
- `.sandbox/evidence/mock-acp.jsonl` zeichnet deterministische Mock-ACP-Aktionen auf.
- `.sandbox/evidence/claude-stream.jsonl` zeichnet den echten Offline-Lauf von Claude Code auf.
- `.sandbox/evidence/live-*.jsonl` zeichnet die drei validierten Live-Streams auf.
- `.sandbox/evidence/egress.jsonl` und `.sandbox/evidence/claude-egress.jsonl` sind validierte,
  tokenfreie Kopien der Guard-Audits.

Beenden Sie zugehörige Container und Netzwerke, während Anmelde-/Konfigurations-Volumes erhalten bleiben:

```bash
./scripts/devin-bridge/clean
```

Entfernen Sie die vollständige Bridge-eigene Umgebung einschließlich benannter Volumes:

```bash
./scripts/devin-bridge/clean --all
```

## Einschränkungen

- Die Bridge verwendet die festgelegte `summarizer`-Rolle ohne Tools, da Devin CLI `3000.2.17`
  keinen neutralen ACP-Agenten ohne Tools bereitstellt. Der Adapter gleicht zusammenfassungsartige
  Zwischenantworten aus, aber ein einzelner begrenzter Reparaturversuch kann dennoch explizit fehlschlagen.
- Live-ACP-Aufrufe können vorübergehend `502`- bzw. `504`-Antworten zurückgeben. Das Testsystem lässt Abstände zwischen den Szenarien;
  bei anhaltenden Fehlern wird weiterhin nach dem Fail-Closed-Prinzip verfahren und niemals ein anderer Anbieter ausgewählt.
- Der ACP-Kontext wird aus jeder Anthropic-Anfrage rekonstruiert; es besteht keine Prozess-/Sitzungsaffinität.
- Pro Modellantwort wird ein Tool-Aufruf unterstützt; parallele Aufrufe werden abgelehnt.
- Bilder werden ausdrücklich nicht unterstützt. Vision, Thinking-Ausgaben, Effort-Steuerungen und ein Kontextfenster mit 1M
  werden nicht angeboten.
- SSE verwendet gültige Anthropic-Lebenszyklusereignisse, wird jedoch erst ausgegeben, nachdem der begrenzte ACP-Durchlauf
  vollständig erfasst wurde; ACP-Chunks werden nicht inkrementell weitergeleitet.
