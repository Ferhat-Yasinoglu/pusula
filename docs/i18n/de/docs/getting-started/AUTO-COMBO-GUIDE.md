# Auto-Combo: Let Pusula Pick the Best AI for You (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/AUTO-COMBO-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/AUTO-COMBO-GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/getting-started/AUTO-COMBO-GUIDE.md)

---

> **Kurz gesagt**: Setzen Sie Ihr Modell auf `auto`, und Pusula wählt automatisch den besten KI-Anbieter für jede Anfrage aus. Keine Konfiguration erforderlich.

---

## Funktionsweise

Anstatt ein bestimmtes KI-Modell auszuwählen (wie GPT-4o oder Claude), können Sie Pusula für jede Anfrage **automatisch das beste auswählen lassen**. Dabei werden folgende Faktoren berücksichtigt:

- **Verfügbarkeit** — Funktioniert der Anbieter gerade?
- **Geschwindigkeit** — Wie schnell ist er?
- **Kosten** — Wie viel kostet er?
- **Qualität** — Eignet er sich für diese Art von Aufgabe?
- **Kapazität** — Ist noch Kontingent verfügbar?

Pusula bewertet alle Ihre verbundenen Anbieter und wählt den besten aus. Wenn dieser ausfällt, wird automatisch der nächste ausprobiert.

---

## Schnellstart

**Schritt 1**: Setzen Sie Ihr Modell in Ihrer IDE oder CLI auf `auto`:

```
model: "auto"
```

**Schritt 2**: Das war's! Pusula übernimmt den Rest.

**Schritt 3** (optional): Verwenden Sie für bestimmte Aufgaben eine Variante:

```
model: "auto/coding"    # Am besten für Code
model: "auto/fast"      # Schnellste Antwort
model: "auto/cheap"     # Günstigste Option
```

---

## Welches „auto“ sollte ich verwenden?

| Wenn Sie Folgendes möchten... | Verwenden Sie  | Am besten geeignet für             | Funktionsweise                                   |
| ----------------------------- | -------------- | ---------------------------------- | ------------------------------------------------ |
| **Insgesamt am besten**       | `auto`         | Allgemeine Fragen, Chats           | Gleicht Geschwindigkeit, Kosten und Qualität aus |
| **Bester Code**               | `auto/coding`  | Code schreiben, Fehlerbehebung     | Wählt Modelle aus, die sich gut für Code eignen  |
| **Schnellste Antwort**        | `auto/fast`    | Schnelle Antworten, geringe Latenz | Priorisiert Geschwindigkeit vor allem anderen    |
| **Günstigste Option**         | `auto/cheap`   | Geld sparen                        | Wählt den günstigsten Anbieter aus               |
| **Intelligentestes Modell**   | `auto/smart`   | Komplexe Aufgaben                  | Qualität zuerst + erkundet neue Modelle          |
| **Höchste Verfügbarkeit**     | `auto/offline` | Wenn Anbieter ausgelastet sind     | Wählt Anbieter mit der größten Kapazität aus     |

### Beispiele

```bash
# Allgemeiner Chat — ausgewogen
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello!"}]}'

# Codegenerierung — Qualität zuerst
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto/coding","messages":[{"role":"user","content":"Write a Python function"}]}'

# Schnelle Antwort — Geschwindigkeit zuerst
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto/fast","messages":[{"role":"user","content":"What is 2+2?"}]}'
```

---

## Funktionsweise (vereinfachte Version)

Wenn Sie eine Anfrage mit `model: "auto"` senden, führt Pusula folgende Schritte aus:

1. **Alle Ihre verbundenen Anbieter prüfen** — Jeden von Ihnen hinzugefügten Anbieter (OpenAI, Anthropic, Google usw.)
2. **Jeden Anbieter bewerten**, wobei unter anderem Folgendes berücksichtigt wird:
   - Funktioniert er? (Verfügbarkeit)
   - Verfügt er über Kapazität? (Kontingent)
   - Wie viel kostet er? (Preis)
   - Wie schnell ist er? (Geschwindigkeit)
   - Eignet er sich für diese Aufgabe? (Qualität)
3. **Den besten Anbieter auswählen** — Der Anbieter mit der höchsten Bewertung erhält Ihre Anfrage
4. **Automatische Wiederherstellung** — Wenn er ausfällt, versucht Pusula automatisch den nächsten

### Das Bewertungssystem

Jeder Anbieter erhält eine Bewertung von 0 bis 1. Je höher die Bewertung, desto besser die Eignung.

| Faktor          | Gewichtung | Bedeutung                                                 |
| --------------- | ---------- | --------------------------------------------------------- |
| Verfügbarkeit   | 20%        | Funktioniert der Anbieter? (Zustand des Circuit Breakers) |
| Kontingent      | 15%        | Ist noch Kapazität verfügbar?                             |
| Kosten          | 15%        | Wie teuer ist er? (günstiger = höhere Bewertung)          |
| Geschwindigkeit | 12%        | Wie schnell ist er? (geringere Latenz = höhere Bewertung) |
| Aufgabeneignung | 8%         | Eignet er sich für diese Art von Aufgabe?                 |
| Stabilität      | 5%         | Ist er zuverlässig? (niedrige Fehlerrate)                 |
| Stufe           | 5%         | Kontostufe (Ultra > Pro > Free)                           |
| Sonstiges       | 20%        | Kontextaffinität, Verbindungsdichte usw.                  |

### So verändern Varianten die Bewertung

Jede Variante verwendet unterschiedliche Gewichtungen:

| Variante       | Priorisiert          | Zentrale Gewichtungen           |
| -------------- | -------------------- | ------------------------------- |
| `auto`         | Ausgewogenheit       | health=20%, quota=15%, cost=15% |
| `auto/coding`  | Qualität             | taskFit=37%, stability=15%      |
| `auto/fast`    | Geschwindigkeit      | latency=32%, health=28%         |
| `auto/cheap`   | Kosten               | cost=37%                        |
| `auto/smart`   | Qualität + Erkundung | taskFit=37%, exploration=10%    |
| `auto/offline` | Kapazität            | quota=37%, health=28%           |

---

## Umgang mit Ausfällen

Pusula verfügt über **drei Schutzebenen**:

### 1. Automatischer Fallback

Wenn der beste Anbieter ausfällt, versucht Pusula automatisch den nächsten. Sie müssen nichts tun.

### 2. Selbstheilung

Wenn ein Anbieter wiederholt ausfällt:

- **Score < 0.2** → Wird für 5 Minuten ausgeschlossen
- **Circuit Breaker offen** → Wird automatisch ausgeschlossen
- **Mehr als 50 % der Anbieter ausgefallen** → Vorfallmodus (keine Exploration)

### 3. Notfall-Fallback

Wenn alle Anbieter ausfallen, leitet Pusula als letzten Ausweg Anfragen an stabile kostenlose Anbieter (wie Kiro oder Qoder) weiter.

---

## Unterstützung mehrerer Konten

Wenn Sie mehrere Konten beim selben Anbieter haben (z. B. zwei OpenAI-Schlüssel), behandelt Pusula jedes davon als **separaten Kandidaten**. Das bedeutet:

- Konto A hat noch Kontingent → verwenden
- Konto B ist ratenbegrenzt → überspringen
- Konto C ist günstiger → bevorzugen

Jedes Konto wird unabhängig anhand seines eigenen Zustands, Kontingents und seiner Geschwindigkeit bewertet.

---

## Bandit-Exploration

Pusula **erkundet** gelegentlich neue Anbieter, um bessere Optionen zu finden:

- **Standard**: 5 % der Anfragen werden an zufällige Anbieter gesendet
- **Auto/smart**: Explorationsrate von 10 %
- **Deaktiviert**, wenn mehr als 50 % der Anbieter nicht funktionsfähig sind

Dies hilft Pusula dabei, zu lernen, welche Anbieter für Ihre Nutzungsmuster am besten geeignet sind.

---

## Häufig gestellte Fragen

### „Wird immer das teuerste Modell ausgewählt?“

**Nein.** Die Kosten machen standardmäßig nur 15 % des Scores aus. Ein günstiger, schneller und zuverlässiger Anbieter kann einen teuren Anbieter übertreffen. Verwenden Sie `auto/cheap`, wenn Sie die Kosten noch stärker priorisieren möchten.

### „Was passiert, wenn ein Anbieter ausfällt?“

Pusula überspringt ihn automatisch und versucht den nächsten. Wenn ein Anbieter wiederholt ausfällt, wird er vorübergehend ausgeschlossen (5–30 Minuten). Sie müssen nichts tun.

### „Kann ich sehen, welcher Anbieter verwendet wurde?“

Prüfen Sie die Antwort-Header — Pusula gibt in jeder Antwort den verwendeten Anbieter und das verwendete Modell an.

### „Lernt es aus meiner Nutzung?“

Ja! Das Bewertungssystem verwendet historische Daten (Latenz, Fehlerraten, Erfolgsraten), um im Laufe der Zeit bessere Entscheidungen zu treffen.

### „Was ist der Unterschied zwischen `auto` und `auto/smart`?“

- `auto` — Ausgewogen, 5 % Exploration
- `auto/smart` — Qualität an erster Stelle (dieselbe Gewichtung wie bei `auto/coding`), 10 % Exploration

Verwenden Sie `auto/smart`, wenn Sie die beste Qualität wünschen und gelegentliche Exploration für Sie in Ordnung ist.

### „Kann ich einen bestimmten Anbieter erzwingen?“

Ja! Verwenden Sie statt `auto` eine Kombination mit der Strategie `priority` und senden Sie dann den **exakten Namen** der Kombination als Feld `model` (z. B. `model: "my-combo"` — nicht `auto`). Weitere Informationen finden Sie in der [Technischen Referenz](../routing/AUTO-COMBO.md).

### „Wie unterscheidet sich das von Round-Robin?“

Round-Robin durchläuft die Anbieter der Reihe nach. Auto-Combo **bewertet jeden Anbieter** und wählt den besten aus. Es ist intelligenter — Zustand, Geschwindigkeit, Kosten und Qualität werden berücksichtigt.

---

## Wie geht es weiter?

- **[Anbieter verbinden](./PROVIDERS-GUIDE.md)** — Fügen Sie Ihren ersten KI-Anbieter hinzu
- **[Leitfaden zu kostenlosen Tarifen](./FREE-TIERS-GUIDE.md)** — Nutzen Sie kostenlose KI ohne Kreditkarte
- **[Fehlerbehebung](../guides/TROUBLESHOOTING.md)** — Beheben Sie häufige Probleme
- **[Technische Referenz](../routing/AUTO-COMBO.md)** — Detaillierter Einblick in den Bewertungsalgorithmus

---

## Weitere Informationen

Entwickler und Mitwirkende finden in der [technischen Referenz zu Auto-Combo](../routing/AUTO-COMBO.md) weitere Informationen zu:

- Vollständigem Bewertungsalgorithmus mit 16 Faktoren
- Gewichtungstabellen für Moduspakete
- Dateipfaden der Implementierung
- API-Endpunkten
- Details zum Selbstheilungsalgorithmus
