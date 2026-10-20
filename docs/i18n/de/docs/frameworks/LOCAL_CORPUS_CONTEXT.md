# Local Corpus Context Source (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/LOCAL_CORPUS_CONTEXT.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/LOCAL_CORPUS_CONTEXT.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/LOCAL_CORPUS_CONTEXT.md)

---

> **Maßgebliche Quelle:** `src/lib/localCorpus/index.ts` (begrenzter Textindex),
> `src/lib/localCorpus/configured.ts` (konfigurierte Laufzeit),
> `src/lib/db/localCorpus.ts` (Persistenz des Stammpfads),
> `open-sse/mcp-server/tools/localCorpusTools.ts` (3 schreibgeschützte MCP-Tools) und
> `src/app/api/settings/local-corpus/route.ts` (Einstellungs-API).

## Was es ist

Local Corpus ermöglicht es einem Betreiber, ein ausdrücklich genehmigtes Verzeichnis mit Textdateien für den MCP-Server von Pusula bereitzustellen. Die Dateien verbleiben in ihrem ursprünglichen Verzeichnis: Pusula speichert lediglich den kanonischen Stammpfad in SQLite und verwaltet einen Suchindex im Arbeitsspeicher. Korpusinhalte werden weder in das Repository noch in die Datenbank kopiert.

Der Index wird inkrementell aktualisiert. Unveränderte Dateien werden anhand ihrer Größe und Änderungszeit wiederverwendet, geänderte Dateien werden erneut eingelesen und mit SHA-256 gehasht, und gelöschte Dateien werden entfernt. Bei einer Suche wird ein Index aktualisiert, der älter als 30 Sekunden ist; Aufrufer können außerdem eine sofortige Aktualisierung anfordern.

## Quelle konfigurieren

Die Einstellungsroute erfordert dieselbe Verwaltungsauthentifizierung wie andere Einstellungs-APIs. Der übermittelte Pfad muss bereits vorhanden und ein absoluter Verzeichnispfad sein.

```bash
# Ein genehmigtes Verzeichnis verbinden
curl -X POST http://localhost:20128/api/settings/local-corpus \
  -H "Content-Type: application/json" \
  -d '{"rootPath":"/absolute/path/to/approved-text"}'

# Konfiguration und Indexstatus prüfen
curl http://localhost:20128/api/settings/local-corpus

# Verbindung trennen, ohne Quelldateien zu ändern
curl -X DELETE http://localhost:20128/api/settings/local-corpus
```

## MCP-Tools

Alle drei Tools erfordern `read:local-corpus`. Die Tool-Antworten geben relative Pfade und den Basisnamen des Stammverzeichnisses aus, niemals dessen absoluten Pfad.

| Tool                  | Beschreibung                                                                                              |
| :-------------------- | :-------------------------------------------------------------------------------------------------------- |
| `local_corpus_status` | Konfigurationsstatus, Indexgröße, Grenzwerte und Zeitpunkt der letzten Aktualisierung melden              |
| `local_corpus_search` | Indizierten Text durchsuchen und begrenzte, zeilenbezogene Ausschnitte zurückgeben (bis zu 20 Ergebnisse) |
| `local_corpus_read`   | Einen begrenzten Zeilenbereich aus einer zulässigen, zum Korpus relativen Datei lesen                     |

Beispiele für MCP-Eingaben:

```json
{ "query": "Red River monitoring", "limit": 10, "refresh": false }
```

```json
{ "relativePath": "hydrology/stations.md", "startLine": 20, "endLine": 80 }
```

## Sicherheitsgrenzen

- Die Positivliste ist auf Textformate ausgerichtet: `.cfg`, `.csv`, `.geojson`, `.htm`, `.html`, `.ini`,
  `.js`, `.json`, `.jsonl`, `.jsx`, `.log`, `.md`, `.mjs`, `.ps1`, `.py`, `.sh`,
  `.sql`, `.toml`, `.ts`, `.tsx`, `.txt`, `.xml`, `.yaml` und `.yml`.
- Symbolische Links werden übersprungen. Lesepfade werden kanonisiert und müssen innerhalb des
  konfigurierten Stammverzeichnisses verbleiben; absolute Pfade und Traversierungsversuche werden abgelehnt.
- Vertrauliche und generierte Verzeichnisnamen werden ausgeschlossen: `.build`, `.codex`, `.env`,
  `.git`, `.next`, `.pusula`, `.ssh`, `coverage`, `dist`, `node_modules` und
  `secrets`.
- Die standardmäßigen Grenzwerte betragen 5.000 Dateien, 1 MiB pro Datei, insgesamt 64 MiB indizierte Inhalte,
  ungefähr 4.000 Zeichen pro Suchabschnitt und 400 Zeilen pro Lesevorgang.
- Dateien, die NUL-Zeichen enthalten, werden als Nicht-Textdateien behandelt und übersprungen oder abgelehnt.

Binärdokumente wie PDF-, DOCX- und Bilddateien sowie Archive werden absichtlich nicht unterstützt.
Konvertieren Sie sie vor der Indizierung im konfigurierten Verzeichnis in ein zulässiges Textformat.

## Betriebshinweise

- Durch das Ändern oder Löschen des konfigurierten Stammverzeichnisses wird der gemeinsame Index im Arbeitsspeicher geleert.
- Bei einem Prozessneustart wird der Index verworfen; die nächste Suche erstellt ihn aus der konfigurierten
  Quelle neu.
- `local_corpus_status` erzwingt keinen Scan. Verwenden Sie `local_corpus_search` mit
  `refresh: true`, wenn ein sofortiger erneuter Scan erforderlich ist.
- Scan- und Lesefehler werden gezählt oder als bereinigte Fehlermeldungen zurückgegeben; Quelldateien werden
  niemals verändert.
