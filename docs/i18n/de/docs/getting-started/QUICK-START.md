# Quick Start: Get Pusula Running in 3 Minutes (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/QUICK-START.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/QUICK-START.md) · 🇹🇷 [tr](../../../tr/docs/getting-started/QUICK-START.md)

---

> **Kurz gesagt**: Installieren → Einen berechtigten Anbieter verbinden → Ihre IDE auf Pusula verweisen. Fertig.

---

## Schritt 1: Pusula installieren

Wählen Sie Ihre bevorzugte Methode:

### Option A: npm (empfohlen)

```bash
npm install -g pusula
```

### Option B: Docker

```bash
docker run -d --name pusula -p 20128:20128 ferhat-yasinoglu/pusula:latest
```

`:latest` ist die höchste **veröffentlichte** stabile SemVer-Version. Das Tag folgt **nicht** dem Git-Branch `main`. Verwenden Sie für GitOps eine feste Version wie `ferhat-yasinoglu/pusula:X.Y.Z`. Siehe [Image-Tags/Release-Kanäle](../guides/DOCKER_GUIDE.md#release-channels).

### Option C: Aus dem Quellcode

```bash
git clone https://github.com/Ferhat-Yasinoglu/pusula.git
cd Pusula
npm install
npm run dev
```

---

## Schritt 2: Pusula starten

```bash
pusula
```

Pusula startet unter `http://localhost:20128`. Das Dashboard wird automatisch geöffnet.

---

## Schritt 3: Einen geeigneten Anbieter verbinden

Wählen Sie einen Anbieter, dessen Bedingungen und Kontingent Ihren Anforderungen entsprechen. Verbinden Sie unter **Dashboard → Providers** Ihr eigenes Konto oder Ihren API-Schlüssel und testen Sie anschließend die Verbindung. Kostenloser Zugriff und eine Verfügbarkeit ohne Schlüssel sind nicht garantiert.

`auto` schließt Anbieter, die mit `tos: avoid` gekennzeichnet sind, darunter Kiro, standardmäßig aus. Das Verbinden eines Kontos ändert diese Richtlinie nicht. Die Einwilligung unter **Dashboard → Combos** gilt für alle automatischen Kombinationen. Lesen Sie den [Leitfaden zu kostenlosen Kontingenten](./FREE-TIERS-GUIDE.md), bevor Sie einen Anbieter auswählen.

---

## Schritt 4: Funktion überprüfen

Erstellen Sie unter [API-Schlüssel](http://localhost:20128/dashboard/api-manager) einen neuen Schlüssel. Speichern Sie diesen Schlüssel, da er später nicht erneut angezeigt wird. Beachten Sie, dass dieser Schlüssel Tools den Zugriff auf Pusula ermöglicht und nicht für den Zugriff auf vorgelagerte Anbieter bestimmt ist.

```bash
curl http://localhost:20128/v1/models -H "Authorization: Bearer YOUR_KEY"
```

Ihre verbundenen Modelle sollten nun aufgelistet werden.

---

## Schritt 5: Ihre IDE oder CLI auf Pusula verweisen

Legen Sie in Ihrer IDE oder Ihrem CLI-Tool Folgendes fest:

```
Basis-URL:    http://localhost:20128/v1
API-Schlüssel: [aus Dashboard → Endpunkte kopieren]
Modell:        auto
```

Das war's! Ihre IDE verwendet nun Pusula mit automatischer Anbieterauswahl.

### IDE-Beispiel: VSCode/Continue.dev

1. Installieren Sie in VSCode die Erweiterung [Continue.dev](https://marketplace.visualstudio.com/items?itemName=Continue.continue).
2. Aktualisieren Sie Ihre Datei `~/.continue/config.yaml`, indem Sie die folgenden Zeilen hinzufügen:

```
  - name: Pusula - Auto
    provider: openai
    model: auto
    apiBase: http://localhost:20128/v1
    apiKey: <YOUR_KEY>
```

3. Wählen Sie im Chatbereich von Continue.dev `Pusula - Auto` aus, um Anfragen an Pusula zu senden.
4. (Optional) Übung für die Leser: Lassen Sie Ihre IDE die Datei `config.yaml` mit allen anderen vorkonfigurierten Konfigurationen aktualisieren 😊

### CLI-Beispiel: Codex CLI

1. Legen Sie die Umgebungsvariable dauerhaft in Ihrem Betriebssystem fest.
   Für macOS/Linux (zu Ihrer `~/.bashrc` oder `~/.zshrc` hinzufügen):

```bash
export PUSULA_API_KEY="<YOUR_KEY>"
```

Für Windows (Eingabeaufforderung):

```
setx PUSULA_API_KEY <YOUR_KEY>
```

2. Starten wir nun Codex, allerdings für Pusula konfiguriert. Führen Sie Folgendes aus:

```
pusula launch-codex --model auto
```

Sie können dies manuell über `codex` und Befehlszeilenparameter erledigen, um Endpunkt und API-Schlüssel anzugeben. Mit dem obigen Befehl übernimmt Pusula jedoch alles für Sie.

Der Start mit einem einzigen Befehl funktioniert über den generischen Launcher auch für andere CLIs: `pusula run <target>` unterstützt `claude`, `codex`, `aider`, `goose`, `opencode`, `qwen` und `gemini` (siehe [CLI-Integrationen](../guides/CLI-INTEGRATIONS.md)).

3. Die CLI sollte nun Anfragen an Pusula senden.

### Prüfen, ob Ihr Tool Anfragen an Pusula weiterleitet

Sie können die Details der Anfrage einsehen, indem Sie in der linken Seitenleiste auf [Überwachung/Protokolle](http://localhost:20128/dashboard/logs) klicken. Durch Anklicken der Einträge werden weitere Details angezeigt. Nebenbei können Sie sehen, welche Informationen von Ihrem bevorzugten Tool übertragen werden. Dies ist sowohl zu Lern- als auch zu Debugging-Zwecken hilfreich.

---

## Wie geht es weiter?

- **[Auto-Combo-Leitfaden](./AUTO-COMBO-GUIDE.md)** — Lassen Sie Pusula die beste KI für Sie auswählen
- **[Anbieterleitfaden](./PROVIDERS-GUIDE.md)** — Verbinden Sie weitere Anbieter (kostenlos und kostenpflichtig)
- **[Leitfaden zu kostenlosen Tarifen](./FREE-TIERS-GUIDE.md)** — Prüfen Sie die Bedingungen der Anbieter und die Limits der kostenlosen Tarife
- **[Fehlerbehebung](../guides/TROUBLESHOOTING.md)** — Beheben Sie häufige Probleme

---

## Häufig gestellte Fragen

### „Benötige ich einen API-Schlüssel?“

Der Pusula-API-Schlüssel authentifiziert Ihre Tools. Die Anmeldedaten für vorgelagerte Dienste hängen vom jeweiligen Anbieter ab: Einige erfordern einen API-Schlüssel oder eine Kontoanmeldung. Ein kostenloser Zugriff ist nicht garantiert.

### „Was ist `auto`?“

`auto` weist Pusula an, für jede Anfrage automatisch den besten Anbieter auszuwählen. Dabei werden Geschwindigkeit, Kosten, Qualität und Verfügbarkeit berücksichtigt. Weitere Informationen finden Sie im [Auto-Combo-Leitfaden](./AUTO-COMBO-GUIDE.md).

### „Wie viel kostet es?“

Pusula selbst ist **kostenlos und quelloffen**. Sie zahlen nur für die Anbieter, die Sie nutzen. Viele Anbieter bieten kostenlose Tarife an – siehe den [Leitfaden zu kostenlosen Tarifen](./FREE-TIERS-GUIDE.md).

### „Kann ich es mit Claude Code / Cursor / Copilot verwenden?“

**Ja!** Pusula funktioniert mit jedem Tool, das das OpenAI-Format unterstützt. Setzen Sie einfach die Basis-URL auf `http://localhost:20128/v1`. Konkrete Einrichtungsanweisungen finden Sie im [Leitfaden für CLI-Tools](../reference/CLI-TOOLS.md).

### „Was passiert, wenn ein Anbieter ausfällt?“

Pusula überspringt fehlgeschlagene Anbieter automatisch und versucht es mit dem nächsten. Sie müssen nichts tun. Weitere Informationen finden Sie im [Auto-Combo-Leitfaden](./AUTO-COMBO-GUIDE.md).

---

## Benötigen Sie Hilfe?

- **[Fehlerbehebung](../guides/TROUBLESHOOTING.md)** — Häufige Probleme und Lösungen
- **[GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues)** — Fehler melden
