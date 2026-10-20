# Free Provider Rankings (Arena ELO) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/FREE_PROVIDER_RANKINGS.md) · 🇮🇷 [fa](../../../fa/docs/guides/FREE_PROVIDER_RANKINGS.md) · 🇹🇷 [tr](../../../tr/docs/guides/FREE_PROVIDER_RANKINGS.md)

---

> **TL;DR**: Pusula bewertet seine **kostenlosen** Anbieter anhand der Modellqualität mithilfe von **Arena AI-
> ELO-Werten (im LMArena-Stil)**. Öffnen Sie im Dashboard die Seite **Rangliste kostenloser Anbieter**, um zu sehen, welche kostenlosen Anbieter die leistungsstärksten Modelle für Ihre Aufgabe bereitstellen —
> entweder insgesamt oder nach Kategorie gefiltert (Programmierung, Review, Dokumentation, Debugging).

---

## Was es ist

Pusula registriert 329 Anbieter, darunter 155 Katalogeinträge, die als **kostenlos/ohne Authentifizierung**
gekennzeichnet sind (ohne Authentifizierung,
kostenloses OAuth-Kontingent oder kostenloses API-Key-Kontingent — siehe den
[Leitfaden zu kostenlosen Kontingenten](../getting-started/FREE-TIERS-GUIDE.md) und das vollständige
[Verzeichnis kostenloser Kontingente](../reference/FREE_TIERS.md)). Der Haken: Die Modellqualität kostenloser Anbieter
variiert stark. Ein Anbieter ohne Authentifizierung, der ein Frontier-Modell bereitstellt, ist wesentlich nützlicher
als einer, der ein kleines älteres Modell anbietet.

**Rangliste kostenloser Anbieter** beantwortet die Frage „**Welcher kostenlose Anbieter bietet mir das beste Modell?**“, indem
der Katalog jedes kostenlosen Anbieters mit **Crowdsourcing-basierten Qualitätswerten** aus der
**Arena AI-Rangliste** verknüpft wird (ELO auf Basis menschlicher Präferenzen, nach demselben Prinzip wie die LMArena-
Chatbot-Arena). Die Anbieter werden anschließend anhand der Leistungsfähigkeit ihres **besten kostenlosen Modells** eingestuft.

Die Rangliste wird aus drei realen Quellen berechnet:

1. Den Listen kostenloser Anbieter — `NOAUTH_PROVIDERS` sowie mit `hasFree` gekennzeichneten Einträgen in `OAUTH_PROVIDERS` /
   `APIKEY_PROVIDERS`
   (`src/shared/constants/providers.ts`).
2. Dem Modellkatalog jedes Anbieters aus der Anbieterregistrierung
   (`open-sse/config/providerRegistry.ts`).
3. Aus ELO abgeleiteten Werten zur Aufgabeneignung, die von der
   Arena-ELO-Synchronisierungs-Engine (`src/lib/arenaEloSync.ts`) in der DB-Tabelle `model_intelligence` gespeichert werden.

Die Verknüpfungslogik befindet sich in `src/lib/freeProviderRankings.ts`.

---

## Zugriff

### Dashboard-Seite

Öffnen Sie das Dashboard und gehen Sie zu **Kosten → Rangliste kostenloser Anbieter**, oder rufen Sie direkt folgenden Pfad auf:

```
/dashboard/free-provider-rankings
```

Die Seite (`src/app/(dashboard)/dashboard/free-provider-rankings/page.tsx`) zeigt:

- Ein **Top-3-Podium** (🥇 🥈 🥉) der am besten bewerteten kostenlosen Anbieter.
- Eine vollständige **Ranglistentabelle** mit den Spalten: **Rang**, **Anbieter**, **Topmodell**,
  **Wert**, **Durchschnittswert**, **Modelle**, **Typ**.
- **Kategorie-Filter-Schaltflächen**: _Alle Kategorien_, _Standard_, _Programmierung_, _Review_,
  _Dokumentation_, _Debugging_.

Das **Typ**-Badge jedes Anbieters zeigt, auf welche Weise er kostenlos ist:

| Badge    | Bedeutung                                               |
| -------- | ------------------------------------------------------- |
| `NOAUTH` | Immer kostenlos, keine Zugangsdaten erforderlich        |
| `OAUTH`  | OAuth-Anbieter mit kostenlosem Kontingent (`hasFree`)   |
| `APIKEY` | API-Key-Anbieter mit kostenlosem Kontingent (`hasFree`) |

Die Werte werden als leicht verständliche Bezeichnungen (z. B. _Elite_, _Ausgezeichnet_, _Sehr gut_,
_Gut_, _Durchschnittlich_) statt als Rohzahlen angezeigt, da der zugrunde liegende Wert eine relative
Qualitätsbewertung und keinen Prozentsatz darstellt.

### API-Endpunkt

Die Seite wird von einem öffentlichen Lese-Endpunkt bereitgestellt
(`src/app/api/free-provider-rankings/route.ts`):

```
GET /api/free-provider-rankings
GET /api/free-provider-rankings?category=coding
GET /api/free-provider-rankings?category=coding&limit=20
```

Abfrageparameter (mit Zod validiert):

| Parameter  | Typ    | Standardwert | Hinweise                                                                                                        |
| ---------- | ------ | ------------ | --------------------------------------------------------------------------------------------------------------- |
| `category` | string | (keiner)     | Einer von `default`, `coding`, `review`, `documentation`, `debugging`. Für die kombinierte Rangliste weglassen. |
| `limit`    | number | `50`         | Auf den Bereich `1–100` begrenzt.                                                                               |

Antwortstruktur:

```json
{
  "rankings": [
    {
      "id": "<provider-id>",
      "name": "<provider name>",
      "icon": "<icon>",
      "color": "<hex color>",
      "textIcon": "<short label>",
      "category": "noauth | oauth | apikey",
      "topModel": {
        "modelId": "<registry model id>",
        "modelName": "<model display name>",
        "score": 0.0,
        "eloRaw": 0,
        "confidence": "high | medium | low",
        "category": "<task category>"
      },
      "averageScore": 0.0,
      "modelCount": 0
    }
  ]
}
```

`eloRaw` ist der ursprüngliche Arena-ELO-Wert; `score` ist der normalisierte Wert für die Aufgabeneignung
(siehe unten). Anbieter ohne bewertete Modelle werden in der Antwort nicht berücksichtigt.

---

## Funktionsweise der Bewertungen

### Quelle: Arena-AI-Bestenliste

Die Arena-ELO-Synchronisierungs-Engine (`src/lib/arenaEloSync.ts`) ruft zwei Bestenlisten — `text`
und `code` — von der Arena-AI-Bestenlisten-API
(`https://api.wulong.dev/arena-ai-leaderboards/v1/leaderboard`) ab. Jeder Bestenlisteneintrag
enthält einen Modellnamen, Anbieter, ELO-`score`, ein Konfidenzintervall und die Anzahl der Stimmen.

Die Bestenlistenkategorien werden den Pusula-Aufgabenkategorien wie folgt zugeordnet:

| Arena-Bestenliste | Pusula-Aufgabenkategorien                      |
| ----------------- | ------------------------------------------------- |
| `text`            | `default`, `review`, `documentation`, `debugging` |
| `code`            | `coding`                                          |

### Normalisierung (Aufgabeneignungswert)

Die ELO-Rohwerte werden pro Bestenliste auf einen **Aufgabeneignungswert in `[0.4, 0.98]`** normalisiert:

```
taskFit = 0.4 + 0.58 * ((elo - minElo) / (maxElo - minElo))
```

Der Wert erreicht nie `0` oder `1`, sodass Spielraum für benutzerdefinierte Überschreibungen bleibt. Dies ist das
Feld `score`, das in der API-Antwort angezeigt wird, sowie die auf dem Dashboard dargestellte Bezeichnung.

### Konfidenz

Jeder Eintrag erhält basierend auf der Anzahl der Arena-Stimmen eine Konfidenzstufe:

| Konfidenz | Stimmen |
| --------- | ------- |
| `high`    | ≥ 5.000 |
| `medium`  | ≥ 1.000 |
| `low`     | < 1.000 |

### Speicherung und Aktualität

Normalisierte Einträge werden mit `source = "arena_elo"` in die DB-Tabelle `model_intelligence`
geschrieben (`src/lib/db/modelIntelligence.ts`). Einträge **laufen nach
7 Tagen ab**, sodass ein Anbieter, der nicht mehr synchronisiert wird, schließlich entfernt wird, anstatt
veraltete Daten bereitzustellen.

Die Synchronisierung ist **standardmäßig aktiviert**:

- Sie wird einmal beim Serverstart und anschließend in regelmäßigen Abständen ausgeführt
  (`src/lib/arenaEloSync.ts`, eingebunden über `src/instrumentation-node.ts`).
- Sie ist **nicht blockierend und niemals fatal** — wenn der Abruf von der vorgelagerten Quelle fehlschlägt, läuft Pusula
  weiter, und die Ranglisten zeigen einfach die letzten gültigen Daten an (oder einen leeren Zustand).

Sie wird durch zwei Umgebungsvariablen gesteuert (dokumentiert in
[`docs/reference/ENVIRONMENT.md`](../reference/ENVIRONMENT.md)):

| Variable                  | Standardwert  | Zweck                                                              |
| ------------------------- | ------------- | ------------------------------------------------------------------ |
| `ARENA_ELO_SYNC_ENABLED`  | `true`        | Auf `false` setzen, um die ausgehende Synchronisierung abzulehnen. |
| `ARENA_ELO_SYNC_INTERVAL` | `86400` (24h) | Synchronisierungsintervall in Sekunden.                            |

### Manuelle Synchronisierung / Status / Löschen

Für Betreiber stellt ein authentifizierter Verwaltungsendpunkt eine manuelle Steuerung bereit
(`src/app/api/intelligence/sync/route.ts` — erfordert Verwaltungsauthentifizierung):

```
GET    /api/intelligence/sync          # aktueller Synchronisierungsstatus (enabled, lastSync, nextSync, intervalMs)
POST   /api/intelligence/sync          # manuelle Synchronisierung auslösen; Body: { "dryRun": true } für eine Vorschau ohne Schreibvorgang
DELETE /api/intelligence/sync          # alle synchronisierten arena_elo-Intelligence-Einträge löschen
```

Wenn die Ranglistenseite leer ist, wird sie durch ein manuelles `POST /api/intelligence/sync` (oder einfach
durch einen Neustart des Servers) wieder befüllt.

### Abgleich von Modellen mit der Bestenliste

Modell-IDs aus der Registry und Arena-Modellnamen stimmen nicht immer exakt überein. Die Rangliste verwendet
einen flexiblen Abgleich (`findMatchingIntelligence` in `src/lib/freeProviderRankings.ts`):

1. Exakte Übereinstimmung mit der normalisierten Modell-ID.
2. Übereinstimmung nach Entfernen eines abschließenden Versionssuffixes (z. B. `kimi-k2.6` → `kimi-k2`).
3. Präfixübereinstimmung (ein Modellname aus der Bestenliste ist ein Präfix der Registry-ID).

Auf der Synchronisierungsseite werden bekannte Anbieterpräfixe (`anthropic/`, `openai/`, `google/`, …)
entfernt, und eine kleine Alias-Zuordnung erweitert kanonische Namen um die Varianten, die Pusula
intern verwendet, sodass Modelle unter jedem Namen auffindbar bleiben.

### Einstufung eines Anbieters

Für jeden kostenlosen Anbieter bewertet die Engine jedes Modell in dessen Katalog und bestimmt anschließend:

- **Bestes Modell** = das Modell des Anbieters mit der höchsten Bewertung.
- **Durchschnittswert** = der Mittelwert über alle bewerteten Modelle dieses Anbieters.
- **Modelle** = die Anzahl der Modelle des Anbieters, für die eine Arena-Bewertung vorlag.

Anbieter werden zuerst nach der **Bewertung des besten Modells** und anschließend nach dem Durchschnittswert sortiert. Dadurch wird ein
Anbieter belohnt, der mindestens ein leistungsstarkes kostenloses Modell anbietet.

---

## Kostenlose Anbieter auswählen

1. **Wählen Sie die richtige Kategorie.** Verwenden Sie den Filter **Coding** für agentenbasierte/Coding-Workloads oder
   belassen Sie ihn für allgemeine Chats auf **All Categories** / **Default**. Derselbe Anbieter kann
   je nach Kategorie unterschiedlich eingestuft sein, da sich sein bestes Modell je nach Bestenliste unterscheidet.
2. **Bevorzugen Sie für einmalige Einrichtungen die Podiumsplätze.** Wenn Sie nur einen oder zwei kostenlose
   Anbieter verbinden möchten, beginnen Sie mit den höchstplatzierten Anbietern Ihrer Kategorie.
3. **Prüfen Sie das Type-Abzeichen.** `NOAUTH`-Anbieter lassen sich am schnellsten verbinden (keine
   Zugangsdaten erforderlich). Kostenlose Tarife mit `OAUTH` / `APIKEY` erfordern eine kurze Registrierung, bieten jedoch häufig
   leistungsfähigere Modelle. Eine Anleitung zum Verbinden finden Sie im [Leitfaden zu kostenlosen Tarifen](../getting-started/FREE-TIERS-GUIDE.md).
4. **Verbinden Sie mehrere Anbieter und lassen Sie Auto-Combo entscheiden.** Dieselben Arena-ELO-Daten, auf denen
   diese Seite basiert, fließen auch in den **Aufgabeneignungsfaktor** der Auto-Combo-Bewertungs-Engine ein
   (`open-sse/services/autoCombo/taskFitness.ts`, Auflösungsreihenfolge
   `user_override → arena_elo → models_dev_tier → static table`). Nachdem Sie also
   die besten kostenlosen Anbieter verbunden haben, bevorzugt das Routing mit `model: "auto"` (z. B. `auto/coding`)
   automatisch die qualitativ hochwertigeren kostenlosen Modelle für jede Anfrage. Die vollständige Bewertung anhand von 16 Faktoren finden Sie unter
   [Auto-Combo](../routing/AUTO-COMBO.md).

---

## Zugehörige Dokumentation

- [Leitfaden zu kostenlosen Tarifen](../getting-started/FREE-TIERS-GUIDE.md) — Anleitung zum Verbinden kostenloser
  Anbieter, keine Kreditkarte erforderlich.
- [Verzeichnis kostenloser Tarife](../reference/FREE_TIERS.md) — vollständiger Katalog kostenloser Anbieter
  und ihrer Limits.
- [Auto-Combo](../routing/AUTO-COMBO.md) — die Routing-Engine mit 16 Faktoren, die dieselben
  Arena-ELO-Daten zur Aufgabeneignung verwendet.
- [Umgebungsvariablen](../reference/ENVIRONMENT.md) — Referenz zu `ARENA_ELO_SYNC_ENABLED` /
  `ARENA_ELO_SYNC_INTERVAL`.
