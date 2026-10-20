# Import providers from a CSV or JSON file (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CSV-IMPORT.md) · 🇮🇷 [fa](../../../fa/docs/providers/CSV-IMPORT.md) · 🇹🇷 [tr](../../../tr/docs/providers/CSV-IMPORT.md)

---

Dashboard → Anbieter → **Aus Datei importieren** erstellt API-Schlüssel-Verbindungen aus einer CSV- oder JSON-Liste. Jede Zeile kann auf einen anderen Anbieter verweisen. Teilweise Fehler sind ausdrücklich vorgesehen: Gültige Zeilen werden auch dann importiert, wenn andere fehlschlagen, und das Modal zeigt an, warum die fehlgeschlagenen Zeilen abgelehnt wurden.

Dieser Import erstellt **keine** neuen OpenAI-/Anthropic-kompatiblen Endpunktknoten. Erstellen Sie diese zuerst (Dashboard → Anbieter → OpenAI-kompatiblen Anbieter hinzufügen oder `pusula nodes add`) und importieren Sie anschließend Zeilen, deren Spalte `provider` die ID dieses Knotens enthält. Ein zeilenspezifischer Wert für `baseUrl` kann die URL des Knotens weiterhin überschreiben.

## CSV (positionsbasiert)

Die Spaltennamen sind rein kosmetisch. Der Parser teilt jede Zeile auf und weist die Werte anhand ihres Index zu:

| Index | Feld       | Erforderlich | Hinweise                                                                                                                                                |
| ----- | ---------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `provider` | ja           | ID eines vorhandenen verwalteten Anbieters (`openai`, `anthropic`, …) **oder** ID eines bereits registrierten OpenAI-/Anthropic-kompatiblen **Knotens** |
| 1     | `name`     | ja           | Anzeigename der Verbindung                                                                                                                              |
| 2     | `apiKey`   | ja           | API-Schlüssel                                                                                                                                           |
| 3     | `baseUrl`  | nein         | Zeilenspezifische URL-Überschreibung                                                                                                                    |
| 4     | `priority` | nein         | Ganzzahl zwischen 1 und 100                                                                                                                             |

Eine erste Zeile, deren erste Spalte das exakte Wort `provider` enthält (Groß-/Kleinschreibung wird nicht berücksichtigt), wird als Kopfzeile übersprungen. Leerzeilen und `#`-Kommentare werden übersprungen.

Laden Sie über das Import-Modal eine Ausgangsdatei herunter (**CSV-Vorlage herunterladen**). Beispiel:

```csv
# Pusula-Anbieterimport (positionsbasierte Spalten)
provider,name,apiKey,baseUrl,priority
openai,Prod OpenAI,sk-your-openai-key,,1
```

Eine frei erfundene ID wie `openai-compatible-chat-001` ist kein Knoten. Die API gibt für diese Zeile `Unknown or unsupported provider` zurück; das Modal zeigt die Meldung neben dem Zeilennamen an.

## JSON

Ein JSON-Array aus Objekten mit denselben Feldern (`provider`, `name`, `apiKey`, `baseUrl?`, `priority?`). Anders als bei CSV werden JSON-Schlüssel namentlich angegeben.

```json
[
  {
    "provider": "openai",
    "name": "Prod OpenAI",
    "apiKey": "sk-your-openai-key",
    "priority": 1
  }
]
```
