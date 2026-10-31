# Providers Guide: Connect AI Models to Pusula (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/PROVIDERS-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/PROVIDERS-GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/getting-started/PROVIDERS-GUIDE.md)

---

> **Kurzfassung**: Ein Anbieter stellt eine Verbindung zu einem KI-Dienst (wie OpenAI, Anthropic oder Google) her. Sie benötigen mindestens einen Anbieter, um Pusula zu verwenden.

---

## Was ist ein Anbieter?

Stellen Sie sich einen Anbieter wie einen **Mobilfunkanbieter** vor. So wie Sie einen Mobilfunkanbieter benötigen, um Anrufe zu tätigen, benötigen Sie einen KI-Anbieter, um KI-Modelle zu verwenden. Pusula ist wie ein Telefon, das mit **allen Mobilfunkanbietern** funktioniert — Sie können automatisch zwischen ihnen wechseln.

### Arten von Anbietern

| Typ               | Beschreibung                      | Beispiele                       | Kosten                       |
| ----------------- | --------------------------------- | ------------------------------- | ---------------------------- |
| **Kostenlos**     | Keine Zahlung erforderlich        | Kiro, Pollinations              | $0                           |
| **API-Schlüssel** | Sie benötigen einen API-Schlüssel | OpenAI, Anthropic, Google       | Nutzungsabhängige Abrechnung |
| **OAuth**         | Anmeldung mit Ihrem Konto         | Claude Code, GitHub Copilot     | Abonnement                   |
| **Web-Cookie**    | Verwendet Ihre Browser-Sitzung    | ChatGPT Web (Codex), Gemini Web | $0 (verwendet Ihr Konto)     |

### Web-Cookie-Anbieter

Allgemeine Einrichtungsanweisungen, Einschränkungen, Hinweise zur Fehlerbehebung und anbieterspezifische Anleitungen zur Authentifizierung finden Sie unter **[WEB-COOKIE-GUIDE.md](./WEB-COOKIE-GUIDE.md)**.
---

## Schnellstart: Verbinden Sie Ihren ersten Anbieter

### Optionale Ersteinrichtung kostenloser Anbieter

Der Assistent für den ersten Start bietet eine ausdrückliche Karte **Kostenlose Anbieter einrichten**. Er leitet die aktuelle
Liste geeigneter Anbieter aus der Registry von Pusula für Anbieter ohne Authentifizierung ab und ermöglicht Ihnen anschließend, jeden
Anbieter vor der Bestätigung zu überprüfen und abzuwählen. Pusula zeigt den Warnhinweis des Anbieters sowie einen Link zu dessen Website an,
damit Sie zunächst die Bedingungen, den Datenschutz, die Verfügbarkeit und die Ratenbegrenzungen des Drittanbieters prüfen können.

Diese Aktion ist optional: Beim Abschließen des Assistenten werden niemals unbemerkt Verbindungen zu kostenlosen Anbietern erstellt.
Es werden nur Anbieter erstellt, die noch fehlen; vorhandene, individuell angepasste Verbindungen bleiben
unverändert. Erstellte, bereits konfigurierte und fehlgeschlagene Anbieter werden jeweils einzeln gemeldet. Nach einem Teilerfolg können Sie
bedenkenlos nur die fehlgeschlagenen Vorgänge erneut versuchen.

### Option A: Kostenloser Anbieter (keine Kreditkarte)

1. Öffnen Sie das Dashboard unter `http://localhost:20128`
2. Gehen Sie zu **Anbieter** → **Anbieter hinzufügen**
3. Wählen Sie einen dieser kostenlosen Anbieter aus:
   - **Kiro AI** — Kostenlose Claude-Modelle (keine Authentifizierung erforderlich)
   - **Pollinations** — Kostenloses GPT-5, Claude und Gemini (kein Schlüssel erforderlich)
   - **LongCat** — 10 Mio. Token kostenlos (einmalige Zuteilung, Konto und KYC erforderlich)
   - **Cloudflare AI** — Über 50 Modelle, 10.000 Neuronen/Tag
   - **MLX Gemma 26B** — Lokales Apple-Silicon-Modell (~38,5 Token/s, ~15,9 GB RAM)
   - **MLX Qwen 3.8 27B** — Lokales Apple-Silicon-Modell (~9,1 Token/s, ~13,1 GB RAM)
4. Klicken Sie auf **Verbinden**
5. Fertig! Sie haben jetzt kostenlosen KI-Zugriff.

### Option B: Anbieter mit API-Schlüssel (kostenpflichtig)

1. Rufen Sie auf der Website des Anbieters einen API-Schlüssel ab:
   - **OpenAI**: https://platform.openai.com/api-keys
   - **Anthropic**: https://console.anthropic.com/
   - **Google**: https://aistudio.google.com/apikey
   - **DeepSeek**: https://platform.deepseek.com/
   - **Groq**: https://console.groq.com/
2. Öffnen Sie das Dashboard unter `http://localhost:20128`
3. Gehen Sie zu **Anbieter** → **Anbieter hinzufügen**
4. Wählen Sie Ihren Anbieter aus
5. Fügen Sie Ihren API-Schlüssel ein
6. Klicken Sie auf **Verbinden**
7. Fertig! Sie haben jetzt Zugriff auf die Modelle dieses Anbieters.

### Option C: OAuth-Anbieter (Abonnement)

1. Öffnen Sie das Dashboard unter `http://localhost:20128`
2. Gehen Sie zu **Anbieter** → **Anbieter hinzufügen**
3. Wählen Sie Ihren Anbieter aus (z. B. Claude Code, GitHub Copilot)
4. Klicken Sie auf **Mit OAuth verbinden**
5. Melden Sie sich mit Ihrem Konto an
6. Fertig! Sie haben jetzt Zugriff auf die Modelle Ihres Abonnements.

### Option D: Lokale MLX-Modelle (Apple Silicon)

Für Apple-Silicon-Macs mit gemeinsamem Arbeitsspeicher unterstützt Pusula die Verbindung mit lokalen MLX-Modellen, die über `mlx-lm.server` ausgeführt werden, als reguläre OpenAI-kompatible lokale Anbieter.

#### Voraussetzungen

- **Apple-Silicon-Mac** (M1/M2/M3/M4) mit mindestens 24 GB gemeinsamem Arbeitsspeicher empfohlen
- **uv**-Paketmanager: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **mlx-lm**: `uv pip install mlx-lm`

#### Schnellstart

1. **Abhängigkeiten installieren**:

   ```bash
   # uv installieren, falls noch nicht installiert
   curl -LsSf https://astral.sh/uv/install.sh | sh

   # mlx-lm installieren
   uv pip install mlx-lm
   ```

2. **MLX-Server manuell starten** (in separaten Terminals):

   ```bash
   # Terminal 1: Gemma 4 26B A4B IT-QAT (Port 11435)
   uv run mlx_lm.server --model mlx-community/gemma-4-26B-A4B-it-qat-q4_0-mlx-aligned --port 11435 --host 127.0.0.1

   # Terminal 2: Qwen 3.8 27B MLX Mixed (Port 11436)
   uv run mlx_lm.server --model maglun/Qwen3.8-27B-MLX-Mixed-3.80bpw --port 11436 --host 127.0.0.1
   ```

3. **Im Pusula-Dashboard verbinden**:
   - Gehen Sie zu **Anbieter** → **Anbieter hinzufügen**
   - Wählen Sie **MLX Gemma 26B** oder **MLX Qwen 3.8 27B**
   - Klicken Sie auf **Verbinden** (kein API-Schlüssel erforderlich)

4. **Mit OpenCode verwenden**:
   ```bash
   # OpenCode für die Verwendung von Pusula konfigurieren
   opencode config set api.base_url http://localhost:20128/v1
   opencode config set api.key <Ihr-Pusula-API-Schlüssel>

   # MLX-Modelle verwenden
   opencode run --model mlx-gemma/gemma-4-26b
   opencode run --model mlx-qwen/qwen3.8-27b
   ```

#### Speicherverwaltung

**Wichtig**: Bei 24 GB gemeinsamem Arbeitsspeicher kann jeweils nur **ein großes MLX-Modell gleichzeitig ausgeführt werden**.

- Gemma 26B: ~15,9 GB Spitzenspeicherbedarf
- Qwen 3.8 27B: ~13,1 GB Spitzenspeicherbedarf

Sie müssen dies manuell verwalten:

- Führen Sie jeweils nur einen MLX-Server gleichzeitig aus oder
- führen Sie beide auf separaten Rechnern aus oder
- stoppen Sie einen, bevor Sie den anderen starten

Pusula verwaltet MLX-Serverprozesse nicht automatisch — es leitet Anfragen lediglich an die von Ihnen konfigurierten OpenAI-kompatiblen Endpunkte weiter.

#### Unterstützung für Werkzeugaufrufe

Beide Modelle unterstützen OpenAI-kompatible Werkzeugaufrufe. Testen Sie dies mit:

```bash
curl -X POST http://localhost:20128/v1/chat/completions \
  -H "Authorization: Bearer <Schlüssel>" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mlx-gemma/gemma-4-26b",
    "messages": [{"role": "user", "content": "Was ist 2+2? Verwende das Rechner-Werkzeug."}],
    "tools": [{"type": "function", "function": {"name": "calculator", "description": "Berechnen", "parameters": {"type": "object", "properties": {"expression": {"type": "string"}}, "required": ["expression"]}}}]
  }'
```

#### Fehlerbehebung

| Problem                        | Lösung                                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Server startet nicht           | Prüfen Sie `uv run mlx_lm.server --help` und verifizieren Sie die Modell-IDs                                         |
| Nicht genügend Arbeitsspeicher | Stellen Sie sicher, dass nur ein Modell ausgeführt wird; schließen Sie andere Apps; prüfen Sie die Aktivitätsanzeige |
| Verbindung abgelehnt           | Vergewissern Sie sich, dass der Server auf dem richtigen Port (11435/11436) ausgeführt wird                          |
| Langsame Antworten             | Bei der ersten Anfrage wird das Modell in den Speicher geladen (~30–60 s); nachfolgende Anfragen sind schnell        |
| Werkzeugaufruf schlägt fehl    | Stellen Sie sicher, dass das Modell Werkzeuge unterstützt; prüfen Sie die Pusula-Protokolle auf Übersetzungsfehler   |

---

## Beste kostenlose Anbieter

Diese Anbieter bieten **kostenlosen Zugang** ohne Kreditkarte:

| Anbieter          | Kostenloses Kontingent      | Modelle                                  | Verbindungsart                       |
| ----------------- | --------------------------- | ---------------------------------------- | ------------------------------------ |
| **Kiro AI**       | 50 Credits/Monat            | Claude Sonnet 4.5, Haiku 4.5, Opus 4.6   | Keine Authentifizierung erforderlich |
| **Pollinations**  | Kein Schlüssel erforderlich | GPT-5, Claude, Gemini, DeepSeek, Llama 4 | Keine Authentifizierung erforderlich |
| **LongCat**       | Einmalig 10 Mio.            | LongCat-2.0                              | API-Schlüssel + KYC                  |
| **Cloudflare AI** | 10.000 Neuronen/Tag         | Über 50 Modelle                          | Keine Authentifizierung erforderlich |
| **NVIDIA NIM**    | ~40 RPM                     | 129 Modelle                              | API-Schlüssel erforderlich           |
| **Cerebras**      | $5 Startguthaben            | GLM 4.7, GPT-OSS 120B                    | API-Schlüssel + Kreditkarte          |

**Tipp**: Verbinden Sie mehrere kostenlose Anbieter, um **unbegrenzt kostenlose KI** mit automatischem Fallback zu erhalten!

---

## Beste kostenpflichtige Anbieter

Diese Anbieter bieten **hochwertige Modelle** mit API-Schlüsseln:

| Anbieter      | Beste Modelle               | Kosten                     | Kostenloses Kontingent       |
| ------------- | --------------------------- | -------------------------- | ---------------------------- |
| **OpenAI**    | GPT-5, GPT-4o               | $2.50-$10/1 Mio. Tokens    | $5 kostenloses Guthaben      |
| **Anthropic** | Claude Opus 4.6, Sonnet 4.6 | $3-$15/1 Mio. Tokens       | $5 kostenloses Guthaben      |
| **Google**    | Gemini 2.5 Pro, Flash       | $0.075-$1.25/1 Mio. Tokens | 1.500 Anfragen/Tag kostenlos |
| **DeepSeek**  | DeepSeek V4                 | $0.14-$0.28/1 Mio. Tokens  | 5 Mio. kostenlose Tokens     |
| **Groq**      | Llama 4, Mixtral            | $0.05-$0.27/1 Mio. Tokens  | 30 RPM kostenlos             |
| **xAI**       | Grok 3                      | $0.30-$0.60/1 Mio. Tokens  | —                            |

---

## Einen Anbieter verbinden (Schritt für Schritt)

### Schritt 1: Dashboard öffnen

Rufen Sie in Ihrem Browser `http://localhost:20128` auf.

### Schritt 2: Zu den Anbietern wechseln

Klicken Sie in der Seitenleiste auf **Anbieter**.

### Schritt 3: „Anbieter hinzufügen“ anklicken

Klicken Sie auf die Schaltfläche **+ Anbieter hinzufügen**.

### Schritt 4: Anbieter auswählen

Durchsuchen Sie die Liste oder suchen Sie nach Ihrem Anbieter. Klicken Sie darauf.

### Schritt 5: Zugangsdaten eingeben

- **Kostenlose Anbieter**: Keine Zugangsdaten erforderlich — klicken Sie einfach auf **Verbinden**
- **Anbieter mit API-Schlüssel**: Fügen Sie Ihren API-Schlüssel ein
- **OAuth-Anbieter**: Klicken Sie auf **Mit OAuth verbinden** und melden Sie sich an

### Schritt 6: Verbindung testen

Klicken Sie auf **Verbindung testen**, um zu überprüfen, ob sie funktioniert.

### Schritt 7: Fertig!

Ihr Anbieter ist jetzt verbunden. Sie können ihn mit `model: "auto"` verwenden oder den Anbieter direkt angeben.

---

## Verwendung mehrerer Anbieter

Pusula funktioniert am besten mit **mehreren Anbietern**. Das bietet Ihnen:

- **Automatisches Fallback** — Wenn ein Anbieter ausfällt, versucht Pusula den nächsten
- **Kostenoptimierung** — Pusula wählt für jede Anfrage den günstigsten Anbieter aus
- **Geschwindigkeitsoptimierung** — Pusula wählt für jede Anfrage den schnellsten Anbieter aus
- **Qualitätsoptimierung** — Pusula wählt für jede Aufgabe den besten Anbieter aus

### Empfohlene Einrichtung

Verbinden Sie für ein optimales Nutzungserlebnis mindestens **3 Anbieter**:

1. **Einen kostenlosen Anbieter** (Kiro oder Pollinations) — Immer verfügbar
2. **Einen schnellen Anbieter** (Groq, Cerebras) — Für schnelle Antworten
3. **Einen hochwertigen Anbieter** (OpenAI, Anthropic, Google) — Für komplexe Aufgaben

Verwenden Sie anschließend `model: "auto"`, und Pusula wählt automatisch den besten Anbieter für jede Anfrage aus.

---

## Anbieterspezifische Einrichtung

### OpenAI

1. API-Schlüssel abrufen: https://platform.openai.com/api-keys
2. In Pusula: Anbieter → Anbieter hinzufügen → OpenAI
3. API-Schlüssel einfügen → Verbinden

### Anthropic

1. API-Schlüssel abrufen: https://console.anthropic.com/
2. In Pusula: Anbieter → Anbieter hinzufügen → Anthropic
3. API-Schlüssel einfügen → Verbinden

### Google (Gemini)

1. API-Schlüssel abrufen: https://aistudio.google.com/apikey
2. In Pusula: Anbieter → Anbieter hinzufügen → Gemini
3. API-Schlüssel einfügen → Verbinden

### DeepSeek

1. API-Schlüssel abrufen: https://platform.deepseek.com/
2. In Pusula: Anbieter → Anbieter hinzufügen → DeepSeek
3. API-Schlüssel einfügen → Verbinden

### Qoder: Anmeldedatenübertragung auswählen

Qoder erfordert Anmeldedaten. Die beiden Übertragungsarten bieten unterschiedliche Funktionen; anhand eines Modellnamens
allein lässt sich nicht erkennen, wozu eine bestimmte Verbindung in der Lage ist.

| Anmeldedaten                               | Pusula-Übertragung                             | Tool-Aufrufe durch den Aufrufer                                       | Streaming                                                                                       |
| ------------------------------------------ | ---------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mit `pt-` beginnendes PAT                  | Lokaler `qodercli`-Prozess auf dem Pusula-Host | Nicht unterstützt                                                     | Gepuffert: SSE wird erst ausgegeben, nachdem die CLI die vollständige Antwort zurückgegeben hat |
| Nicht-PAT-Zugriffstoken oder API-Schlüssel | DashScope-HTTP-Endpunkt, kompatibel mit OpenAI | Wird vorbehaltlich des vorgelagerten Modells/Schlüssels durchgereicht | Vorgelagerter HTTP-/SSE-Pfad                                                                    |

Installieren Sie für ein PAT die Qoder CLI auf demselben Host oder in demselben Container wie Pusula. Die ausführbare Datei
muss als `qodercli` auffindbar sein; alternativ können Sie `CLI_QODER_BIN` auf den Pfad der ausführbaren Datei setzen. Eine CLI,
die nur auf dem Docker-Host installiert ist, ist nicht automatisch im Container vorhanden. Fehlende
Binärdateien führen zu einer expliziten Fehlermeldung, die auf die Installation oder die Pfadeinstellung verweist.

Der PAT-Chat-Pfad hat ein Prozess-Timeout von 45 Sekunden. Er fasst die Unterhaltung zu einem
Prompt zusammen und ruft die CLI im nicht streamenden Ausgabemodus auf. Die Anforderung von `stream: true` ändert
die Antwortstruktur zu SSE; sie ermöglicht keine inkrementelle Token-Übertragung vom vorgelagerten Dienst.
Für die CLI-Validierung/Modellauflistung gilt ein separates Timeout von 20 Sekunden. Dies sind die aktuellen
Standardwerte im Code und keine konfigurierbaren Dashboard-Einstellungen.

Verwenden Sie PAT-Verbindungen für einfachen Chat. Agentenanfragen, die `tools` oder das veraltete `functions`
enthalten, schließen PAT-Konten bei der Auswahl der Anmeldedaten aus, einschließlich fest zugewiesener Kombinationsziele. Ein gemischter
Qoder-Pool kann weiterhin sein HTTP-Konto auswählen. Direkte Aufrufe des PAT-Executors schlagen ebenfalls
explizit fehl, bevor die CLI gestartet wird, anstatt Tool-Definitionen stillschweigend zu verwerfen. Diese
Einschränkung betrifft Tools, die vom API-Aufrufer bereitgestellt werden, nicht interne Tools, die die Qoder
CLI möglicherweise selbst verwendet. Ein HTTP-Schlüssel garantiert nicht, dass jedes Modell Tools unterstützt; die normalen
Prüfungen der Modellfunktionen gelten weiterhin.

Browser-OAuth ist nur verfügbar, wenn der Administrator alle fünf Einstellungen konfiguriert:
`QODER_OAUTH_AUTHORIZE_URL`, `QODER_OAUTH_TOKEN_URL`, `QODER_OAUTH_USERINFO_URL`,
`QODER_OAUTH_CLIENT_ID` und `QODER_OAUTH_CLIENT_SECRET`. Ihre Standardwerte sind leer; eine
nicht konfigurierte Installation sollte einen unterstützten Import von Anmeldedaten verwenden, anstatt davon auszugehen,
dass der Anmeldevorgang im Browser einsatzbereit ist.

Implementierungsreferenzen: [Qoder-Executor](../../open-sse/executors/qoder.ts),
[CLI-Laufzeit](../../open-sse/services/qoderCli.ts) und
[OAuth-Konfiguration](../../src/lib/oauth/constants/oauth.ts). Inkrementelles PAT-Streaming
und ein konfigurierbares Timeout sind separate Erweiterungen; dieses Verhalten stellt sie nicht in Aussicht.

### Groq

1. API-Schlüssel abrufen: https://console.groq.com/
2. In Pusula: Anbieter → Anbieter hinzufügen → Groq
3. API-Schlüssel einfügen → Verbinden

---

## Häufig gestellte Fragen

### „Muss ich für die Nutzung von Pusula bezahlen?“

**Nein!** Pusula ist kostenlos und Open Source. Du kannst kostenlose Anbieter (Kiro, Pollinations) nutzen, ohne etwas zu bezahlen. Kosten entstehen nur, wenn du kostenpflichtige Anbieter verwendest.

### „Mit welchem Anbieter sollte ich beginnen?“

Beginne mit **Kiro AI** – der Anbieter ist kostenlos, erfordert keinen API-Schlüssel und ermöglicht dir den Zugriff auf Claude-Modelle. Füge anschließend bei Bedarf weitere Anbieter hinzu.

### „Kann ich mehrere Anbieter gleichzeitig nutzen?“

**Ja!** Genau das ist der Zweck von Pusula. Verbinde mehrere Anbieter und verwende `model: "auto"`, damit Pusula für jede Anfrage den besten Anbieter auswählt.

### „Was passiert, wenn ein Anbieter ausfällt?“

Pusula überspringt fehlgeschlagene Anbieter automatisch und versucht es mit dem nächsten. Du musst nichts weiter tun.

### „Wie trenne ich die Verbindung zu einem Anbieter?“

Gehe zu Anbieter → klicke auf den Anbieter → klicke auf **Verbindung trennen**.

### „Kann ich meine vorhandenen API-Schlüssel verwenden?“

**Ja!** Wenn du bereits API-Schlüssel für OpenAI, Anthropic, Google usw. hast, kannst du sie in Pusula verwenden. Füge sie einfach ein, wenn du den Anbieter verbindest.

---

## Wie geht es weiter?

- **[Anleitung zur automatischen Kombination](./AUTO-COMBO-GUIDE.md)** — Lassen Sie Pusula die beste KI für Sie auswählen
- **[Leitfaden zu kostenlosen Kontingenten](./FREE-TIERS-GUIDE.md)** — Nutzen Sie kostenlose KI ohne Kreditkarte
- **[Fehlerbehebung](../guides/TROUBLESHOOTING.md)** — Beheben Sie häufige Probleme
- **[Anbieterreferenz](../reference/PROVIDER_REFERENCE.md)** — Vollständige Liste mit 226 Anbietern

## Cursor-Bilder

Bilder des Cursor-Tarifs verwenden `IMAGE_PROVIDERS.cursor` (`cursor-agent-image`). Siehe [CURSOR_IMAGE.md](../providers/CURSOR_IMAGE.md).
