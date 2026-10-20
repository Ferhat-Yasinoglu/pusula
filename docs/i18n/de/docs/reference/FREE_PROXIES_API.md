# Free Proxies API (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/FREE_PROXIES_API.md) · 🇮🇷 [fa](../../../fa/docs/reference/FREE_PROXIES_API.md) · 🇹🇷 [tr](../../../tr/docs/reference/FREE_PROXIES_API.md)

---

Pusula wird mit einem kuratierten Pool kostenloser Proxys in der Tabelle `free_proxies` ausgeliefert,
der mit externen Anbietern (1proxy, proxifly, iplocate, webshare) synchronisiert wird. Das
Dashboard zeigt diese unter **Einstellungen → Kostenlose Proxys** an. Dieses Dokument
beschreibt die serverseitige Filterung, Sortierung, Zählung und Meldung von Synchronisierungsfehlern,
die von der Listenroute bereitgestellt werden.

## Listenroute — `GET /api/settings/free-proxies`

Gibt einen gefilterten, sortierten und paginierten Ausschnitt sowie die Gesamtanzahl zurück. Filterung und
Zählung erfolgen in SQL, sodass die Benutzeroberfläche die tatsächliche Gesamtanzahl (z. B. `Gesamt: 0`)
anzeigen kann, ohne jede Zeile in den Arbeitsspeicher laden zu müssen.

### Abfrageparameter

| Parameter         | Typ                                | Standardwert | Bedeutung                                                                                                                    |
| ----------------- | ---------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `search`          | Zeichenfolge                       | `""`         | Groß-/Kleinschreibung berücksichtigendes `LIKE` für die Host- und Quellspalte.                                               |
| `protocol`        | Zeichenfolge                       | `""`         | `type`-Filter: `http` / `https` / `socks4` / `socks5`. Leer = alle.                                                          |
| `country`         | Zeichenfolge                       | `""`         | `countryCode`-Filter (ISO-2). Leer = alle.                                                                                   |
| `minQuality`      | Zahl                               | `0`          | Nur Zeilen mit `qualityScore >= minQuality`. `0` = keine Untergrenze.                                                        |
| `disabledSources` | Zeichenfolge                       | `""`         | Durch Kommas getrennte auszuschließende Quell-IDs (z. B. `proxifly,webshare`).                                               |
| `sortBy`          | `quality` \| `latency` \| `recent` | `quality`    | `quality` = Bewertung absteigend; `latency` = Latenz aufsteigend (Nullwerte zuletzt); `recent` = `lastValidated` absteigend. |
| `offset`          | Zahl                               | `0`          | Beginn der Paginierung.                                                                                                      |
| `limit`           | Zahl                               | `50`         | Seitengröße (serverseitig begrenzt).                                                                                         |

### Antwort

```json
{
  "success": true,
  "data": {
    "proxies": [/* FreeProxyRecord[] */],
    "total": 137,
    "hasMore": true
  },
  "stats": {
    "total": 137,
    "inPool": 12,
    "avgQuality": 64.2,
    "bySource": [{ "source": "1proxy", "count": 90 }],
    "lastSyncAt": "2026-07-11T09:30:00.000Z"
  },
  "syncErrors": {
    "proxifly": ["HTTP 429 from upstream"],
    "webshare": ["network timeout"]
  }
}
```

`total` gibt die gefilterte Gesamtanzahl **vor** der Paginierung an, sodass die Benutzeroberfläche
`Gesamt: N` und `hasMore` unabhängig voneinander darstellen kann. `syncErrors` ist nach Quell-ID
strukturiert und wird nur für Quellen befüllt, deren letzte Synchronisierung fehlgeschlagen ist — ein Ergebnis
von `Gesamt: 0` bleibt niemals ohne Fehlermeldung.

## Zum Pool hinzufügen — `POST /api/settings/free-proxies/[id]/add-to-pool`

Überführt einen kostenlosen Proxy in den verwalteten Pool `proxy_registry`. Validiert zunächst den
Upstream; bei Erfolg werden die neue Pool-Proxy-ID und die gemessene Latenz zurückgegeben.

## Synchronisierung — `POST /api/settings/free-proxies/sync`

Ruft alle aktivierten Quellen erneut ab (oder die Teilmenge in `{ "sources": [...] }`). Jede
Quelle wird unabhängig synchronisiert; eine fehlgeschlagene Quelle wird in `syncErrors` erfasst, während die
anderen dennoch abgeschlossen werden, sodass Teilsynchronisierungen niemals zuvor gültige Daten löschen.

## Statistiken — `GET /api/settings/free-proxies/stats`

Gibt das Aggregat `total / inPool / avgQuality / bySource / lastSyncAt`
ohne die Zeilendaten zurück — es wird von den Header-Widgets des Dashboards verwendet.
