# Model Exposure Allow/Deny List (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../routing/MODEL_EXPOSURE_LIST.md) · 🇮🇷 [fa](../../../fa/docs/routing/MODEL_EXPOSURE_LIST.md) · 🇹🇷 [tr](../../../tr/docs/routing/MODEL_EXPOSURE_LIST.md)

---

> Opt-in, standardmäßig deaktiviert (wenn `modelVisibilityAllowlist`/`modelVisibilityDenylist` beide leer sind, bleiben
> der `/v1/models`-Katalog UND jeder `auto/*`-Kandidatenpool byte-identisch). Eine Ergänzung zu
> `hidePaidModels`/`hideAutoCombos` (`src/lib/db/settings.ts`) für Betreiber, die aus Gründen, die
> nichts mit Kosten zu tun haben, eine kuratierte Modellliste wünschen.

## Warum dies existiert

`hidePaidModels` beantwortet „Ist dieses Modell kostenlos?“ und `hideAutoCombos` beantwortet „Sollen virtuelle
`auto/*`-IDs überhaupt angeboten werden?“ — keine der beiden Einstellungen ermöglicht es einem Betreiber, eine beliebige Teilmenge von
Modellen zu kuratieren (z. B. genau die Modelle bereitzustellen, die ein bestimmter Claude Code-/OpenCode-Client sehen soll,
unabhängig von der Preisgestaltung). #11481 fügt dies in Form von zwei unabhängigen, optional aktivierbaren String-Array-Einstellungen hinzu.

## Einstellungen

| Schlüssel                  | Typ        | Standardwert | Bedeutung                                                                                          |
| -------------------------- | ---------- | ------------ | -------------------------------------------------------------------------------------------------- |
| `modelVisibilityDenylist`  | `string[]` | `[]`         | Einträge, die mit einem Kandidaten übereinstimmen, blenden ihn aus dem Katalog/Kandidatenpool aus. |
| `modelVisibilityAllowlist` | `string[]` | `[]`         | Wenn nicht leer, bleiben NUR Kandidaten sichtbar, die mit einem Eintrag übereinstimmen.            |

Beide akzeptieren bis zu 500 Einträge mit jeweils bis zu 200 Zeichen (Zod-validiert in
`src/shared/validation/settingsSchemas.ts`). Ein Eintrag ist entweder:

- eine exakte Katalog-ID — `"gpt-4o"` (reine Modell-ID) oder `"openai/gpt-4o"` (mit Anbieterpräfix), oder
- ein Glob-Muster mit `*`/`?` — z. B. `"openai/gpt-4*"` oder `"anthropic/*"` — das über denselben
  gemeinsamen `globToRegex()`-Matcher (`src/shared/utils/globPattern.ts`) aufgelöst wird, der bereits von
  den modellspezifischen Combo-Zuordnungen von `ModelRoutingSection` und `freeModels.ts::matchesOnlyPaidModels` verwendet wird.

Priorität: Die Denylist wird zuerst geprüft (ein abgelehnter Eintrag wird immer ausgeblendet, selbst wenn er auch
mit der Allowlist übereinstimmt); wenn die Allowlist nicht leer ist, bleiben nur Einträge erhalten, mit denen sie übereinstimmt.

## Zwei Engstellen, nicht nur eine

Die Erkenntnis aus #6512 (ein reiner `hidePaidModels`-Katalogfilter ließ weiterhin zu, dass `auto/*` an ein
kostenpflichtiges Modell weiterleitete, da der Combo-Kandidatenpool unabhängig aufgebaut wurde) gilt hier genauso.
Das Übereinstimmungsprädikat `isModelExposureAllowed()` (`src/shared/utils/modelExposureList.ts`) wird an BEIDEN Stellen
aufgerufen:

- `src/app/api/v1/models/catalog.ts` — die `/v1/models`-Auflistung selbst, an denselben 5 quellspezifischen
  Engstellen, die bereits durch `shouldHidePaid()` gesteuert werden (statische `PROVIDER_MODELS`, synchronisierte Anbieterzeilen,
  benutzerdefinierte Zeilen, aliasgestützte Zeilen, verwaltete Fallback-Zeilen).
- `open-sse/services/autoCombo/modelExposureFilter.ts::filterModelExposureCandidates()` — wird
  aus `virtualFactory.ts::buildPreparedPool` unmittelbar nach dem entsprechenden
  `filterPaidOnlyCandidates()`-Aufruf aufgerufen, sodass ein abgelehntes Modell auch niemals für einen `auto/*`-
  Kandidatenpool ausgewählt werden kann.

## Was NICHT gefiltert wird

Entspricht dem bestehenden Verhalten von `hideAutoCombos`: Eine **explizit** gesendete Modell-ID (nicht über `auto/*`
und nicht über die Katalogauflistung ermittelt) wird bei der Weiterleitung niemals blockiert — gefiltert werden nur
die angebotenen Modelle bzw. die Mitgliedschaft im Kandidatenpool. Dies ist unabhängig von `hidePaidModels`;
ein Betreiber kann aus Gründen, die nichts mit Kosten zu tun haben, eine kuratierte Auswahl wünschen, daher werden beide
Einstellungen als unabhängige, mit UND verknüpfte Filter kombiniert, genau wie bei der bestehenden Kombination mehrerer Flags in
`catalog.ts`.

Der Einstellungsexport (`GET /api/settings/export-json`) enthält beide Arrays unverändert, wie jedes andere
Einstellungsfeld — anders als beim Combo-Schritt-Exportfilter von `hidePaidModels` besteht hier kein Risiko einer
erneuten Übernahme: Eine abgelehnte ID, die in einen exportierten Combo-Schritt eingebettet ist, stellt die explizite Routing-
Entscheidung des Betreibers dar und ist nichts, was an der Exportgrenze entfernt werden muss.
