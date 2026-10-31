# Search Tools Studio (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/SEARCH_TOOLS_STUDIO.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/SEARCH_TOOLS_STUDIO.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/SEARCH_TOOLS_STUDIO.md)

---

> **Feature:** Search Tools Studio — einheitlicher Arbeitsbereich für Web-Tools unter `/dashboard/search-tools`.
> **Pläne:** `18-search-tools-studio-redesign.plan.md` + `_orchestration/master-plan-group-C.md`
> **Status:** Veröffentlicht in v3.8.6

---

## Übersicht

Search Tools Studio verwandelt `/dashboard/search-tools` von einer einfachen Suchumgebung in ein
Studio mit drei Tabs, das Websuche, Web-Scraping und den direkten Anbietervergleich vereint.

```
┌ Search Tools ──────────────────────────────────────────────────────────┐
│ [🔍 Suche] [📄 Scraping] [⚖ Vergleich]          142ms · $0.001  </>    │
│ ⓘ [Leitfaden zu Modalitäten]                                          │
├──────────────────────────────────────────┬─────────────────────────────┤
│  {Inhalt des aktiven Tabs}               │ ─ Konfiguration            │
│                                          │ Anbieter [auto ∨]          │
│                                          │   🟢 Serper  $0.001        │
│                                          │   🟢 Tavily  $0.008        │
│                                          │   🔥 Firecrawl (Abruf)     │
│                                          │ Typ    [web | news]        │
│                                          │ Ganze Seite [ ] (Scraping) │
│                                          │ Format [md|text|html]      │
│                                          │ Rerank-Modell [∨]          │
└──────────────────────────────────────────┴─────────────────────────────┘
```

---

## Tabs

### Such-Tab

Entwickelt das bestehende `SearchForm` + `ResultsPanel` + `RerankPanel` zu einem Tab weiter:

- Abfrage → Ergebnisse (Titel, URL, Ausschnitt, Relevanzbewertung).
- Anbieter-Metadaten im Konfigurationsbereich (Kosten, Kontingent, Status).
- Rerank-Bereich: Rerank-Modell auswählen, Ergebnisse neu sortieren, `positionDelta` anzeigen.
- Leerer Zustand mit CTA, wenn keine Suchanbieter konfiguriert sind.
- Suchverlauf über `SearchHistory.tsx`.
- Ruft `POST /v1/search` auf (bestehender Endpunkt, keine Änderungen).

### Scrape-Tab

Neuer Tab zum Extrahieren von Inhalten aus einer URL über `POST /v1/web/fetch` (erstellt in Plan 05):

- Eingabe: URL + Umschalter für vollständige Seite + Formatauswahl (Markdown / Text / HTML).
- Absenden → abrufen → `ScrapeResult.tsx` rendern.
- `ScrapeResult` rendert eine Markdown-Vorschau + Umschalter für Rohdaten.
- Begrenzung: Wenn der Antworttext größer als **256 KB** ist, zeigt die Benutzeroberfläche `(gekürzt, Rohdaten anzeigen)` an und öffnet die Rohdaten in einem Monaco-Modal (D21).
- Metadatenbereich: Anbieter (firecrawl/jina-reader/tavily-search/tinyfish/nimble-search/anysearch-search/parallel-search), Latenz, Kosten, Antwortgröße, Anzahl der Links.
- Verwendet den Hook `useScrapeFetch.ts`.

### Vergleichs-Tab

Führt dieselbe Abfrage/URL bei bis zu **4 Anbietern parallel** aus (D22):

- Nebeneinander angeordnete Spalten pro Anbieter.
- Metriken: Latenz, Kosten, Anzahl der Ergebnisse, Antwortgröße.
- Berechnung der URL-Überschneidung für die Suche (Anzahl gemeinsam vorkommender URLs im Vergleich zum ursprünglichen Ergebnis).
- Ruft pro Anbieter `POST /v1/search` (Suche) oder `POST /v1/web/fetch` (Scraping) auf.

---

## Konfigurationsbereich (gemeinsam)

`SearchToolsConfigPane.tsx` — immer sichtbar, einklappbar.

| Feld          | Hinweise                                                                                    |
| ------------- | ------------------------------------------------------------------------------------------- |
| Anbieter      | Dropdown mit Status-Badge (konfiguriert / fehlt / ratenbegrenzt)                            |
| Typ           | `web` oder `news` (nur Suche)                                                               |
| Ganze Seite   | Umschalter für Scraping — ruft die gesamte Seite statt nur des zuerst sichtbaren Inhalts ab |
| Format        | `markdown`, `text` oder `html` (nur Scraping)                                               |
| Rerank-Modell | Optionales Modell für das Reranking nach der Suche                                          |
| Verlauf       | Einklappbarer Bereich für den Suchverlauf                                                   |

---

## SearchConceptCard

`SearchConceptCard.tsx` — immer sichtbar, einklappbares Akkordeon. Erläutert:

| Konzept               | Kurzbeschreibung                                                                |
| --------------------- | ------------------------------------------------------------------------------- |
| **Suche**             | Ruft eine Liste von Web-Ergebnissen ab (Titel, URL, Snippet, Relevanzbewertung) |
| **Scraping**          | Extrahiert den vollständigen Inhalt einer URL (Markdown, Text oder HTML)        |
| **Vergleich**         | Führt dieselbe Abfrage parallel bei N Anbietern aus                             |
| **Neusortierung**     | Ordnet Ergebnisse mithilfe eines LLM neu, um die Abfragerelevanz zu verbessern  |
| **Auto (günstigste)** | Wählt automatisch den günstigsten verfügbaren Anbieter aus                      |

---

## Anbieter-Katalog

`ProviderCatalog.tsx` stellt die vollständige Anbieterliste aus `GET /api/search/providers` bereit
(in F4 um Abrufanbieter erweitert):

| `kind` | `"search"` (20 Anbieter) oder `"fetch"` (firecrawl, jina-reader, tavily-search, tinyfish, nimble-search, anysearch-search, parallel-search) |

Der Status wird **zum Zeitpunkt der Anfrage abgeleitet**, indem geprüft wird, ob Anmeldedaten vorhanden sind und ob
sich derzeit alle Schlüssel in der Abklingzeit befinden.

---

## Code exportieren

`ExportCodeModal` (aus Playground Studio importiert) und `codeExport.ts` generieren
curl-/Python-/TypeScript-Codeausschnitte für Aufrufe von `/v1/search` und `/v1/web/fetch`.
Der Platzhalter für den API-Schlüssel ist immer `$PUSULA_API_KEY` (D11, gemeinsam mit Playground Studio verwendet).

---

## Backend-Änderungen

Für dieses Feature war nur eine Backend-Änderung erforderlich:

### Erweitertes `GET /api/search/providers`

`src/app/api/search/providers/route.ts` wurde erweitert, um:

- Jeden Fetch-Provider (`firecrawl`, `jina-reader`, `tavily-search`, `tinyfish`, `nimble-search`, `anysearch-search`, `parallel-search`) in das Array aufzunehmen.
- Jedem Element `kind: "search" | "fetch"` hinzuzufügen.
- `status: "configured" | "missing" | "rate_limited"` hinzuzufügen, abgeleitet aus dem aktuellen Status der Anmeldedaten.
- Die Abwärtskompatibilität zu wahren — bestehende Felder (`id`, `name` usw.) bleiben unverändert.

---

## Wichtige Dateien

| Pfad                                                                              | Zweck                                              |
| --------------------------------------------------------------------------------- | -------------------------------------------------- |
| `src/app/(dashboard)/dashboard/search-tools/SearchToolsClient.tsx`                | Studio-Rahmen, Tab-Orchestrierung                  |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchToolsTopBar.tsx`     | Tabs + Metriken + Exportschaltfläche               |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchToolsConfigPane.tsx` | Gemeinsames Konfigurationspanel                    |
| `src/app/(dashboard)/dashboard/search-tools/components/SearchConceptCard.tsx`     | Erklärungskarten (immer sichtbar)                  |
| `src/app/(dashboard)/dashboard/search-tools/components/ProviderCatalog.tsx`       | Anbieterliste mit Metadaten                        |
| `src/app/(dashboard)/dashboard/search-tools/components/ScrapeResult.tsx`          | Markdown-Vorschau + Rohdaten-Umschalter            |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/SearchTab.tsx`        | Tab für Suche + Neusortierung                      |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/ScrapeTab.tsx`        | Scraping-Tab                                       |
| `src/app/(dashboard)/dashboard/search-tools/components/tabs/CompareTab.tsx`       | Tab für den Vergleich mehrerer Anbieter            |
| `src/app/(dashboard)/dashboard/search-tools/hooks/useScrapeFetch.ts`              | Scraping-Abruf-Hook                                |
| `src/app/api/search/providers/route.ts`                                           | Um `kind` + `status` + Abrufanbieter erweitert     |
| `open-sse/config/searchRegistry.ts`                                               | Maßgebliche Quelle für Metadaten von Suchanbietern |

---

## Fehlerbehebung

| Symptom                                                 | Ursache                                         | Lösung                                                                                                                             |
| ------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Im Scrape-Tab wird „Endpunkt nicht verfügbar“ angezeigt | `/v1/web/fetch` nicht angebunden                | Prüfen Sie, ob Plan 05 zusammengeführt wurde und `src/app/api/v1/web/fetch/route.ts` vorhanden ist                                 |
| Im Anbieterkatalog werden alle als „fehlend“ angezeigt  | Zugangsdaten nicht konfiguriert                 | Fügen Sie unter `/dashboard/providers` Zugangsdaten hinzu                                                                          |
| Scrape-Inhalt ist abgeschnitten                         | Antwort überschreitet die Obergrenze von 256 KB | Erwartetes Verhalten (D21). Verwenden Sie die Schaltfläche „Rohdaten anzeigen“, um den vollständigen Inhalt anzuzeigen             |
| Im Vergleichen-Tab werden nur 2 Anbieter angezeigt      | Ratenbegrenzung aktiv                           | Zwei oder mehr Anbieter befinden sich möglicherweise in einer Abklingzeit — prüfen Sie den Anbieterstatus im Konfigurationsbereich |
| „Größe“ wird als Rohschlüssel in der Tabelle angezeigt  | Fehlender i18n-Schlüssel                        | Prüfen Sie, ob `search.size` in der Locale-Datei vorhanden ist; erstellen Sie i18n neu                                             |

---

## Referenzen

- Masterplan: `_tasks/features-v3.8.6/refactorpages/_orchestration/master-plan-group-C.md`
- Funktionsplan: `_tasks/features-v3.8.6/refactorpages/18-search-tools-studio-redesign.plan.md`
- Suchanbieter-Registry: `open-sse/config/searchRegistry.ts`
- Playground Studio (gemeinsam genutztes `ExportCodeModal` + `codeExport.ts`): `docs/frameworks/PLAYGROUND_STUDIO.md`
- Web-Fetch-Backend: `src/app/api/v1/web/fetch/route.ts`
