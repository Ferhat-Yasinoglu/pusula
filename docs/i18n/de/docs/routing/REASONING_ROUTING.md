# Reasoning Routing (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../routing/REASONING_ROUTING.md) · 🇮🇷 [fa](../../../fa/docs/routing/REASONING_ROUTING.md) · 🇹🇷 [tr](../../../tr/docs/routing/REASONING_ROUTING.md)

---

Regeln für das Reasoning-Routing erweitern das bestehende Modell- und Combo-Routing. Wenn keine aktive Regel übereinstimmt, bleiben das bestehende Verhalten für Thinking, Suffixe, Verbindungsstandards und Provider-Übersetzungen unverändert.

## Verwaltung

Die Regelverwaltung ist unter **Einstellungen → Globales Routing** verfügbar. Der API-Schlüssel-Editor bietet dieselbe Verwaltungsoberfläche, gefiltert nach dem ausgewählten Schlüssel.

Die Verwaltungs-API wird über folgende Routen bereitgestellt:

- `GET` und `POST` unter `/api/settings/reasoning-routing-rules`
- `GET`, `PATCH` und `DELETE` unter `/api/settings/reasoning-routing-rules/[id]`
- `POST` unter `/api/settings/reasoning-routing-rules/simulate`

Alle Routen verwenden `requireManagementAuth`. Eingaben werden mit den Schemas in `src/shared/validation/schemas/reasoningRouting.ts` validiert. Der Simulator führt niemals einen Upstream-Aufruf durch.

## Regelauflösung

Die frühe Auswertung wählt genau eine Regel aus. Gültigkeitsbereiche werden in dieser Reihenfolge geprüft:

1. `apiKey`
2. `combo`
3. `model`
4. `global`

Innerhalb eines Gültigkeitsbereichs gewinnt zuerst die höhere `priority`, gefolgt von einer exakten Modellübereinstimmung gegenüber einem Glob-Muster und anschließend einer stabilen Sortierung nach `createdAt` und `id`. `requestTags` werden ausschließlich aus `metadata.tags` gelesen und unterstützen die Übereinstimmungsmodi `any` oder `all`.

Eine `connection`-Regel wird nur ausgewertet, wenn keine frühe Regel gewonnen hat und bereits eine konkrete Provider-Verbindung ausgewählt wurde. Sie darf nur Aufwand und Budget ändern.

## Aufwand und Budget

`sourceEffort` akzeptiert `any`, `missing`, `none`, `low`, `medium`, `high`, `xhigh`, `max` und `ultra`. `missing` bedeutet, dass die Anfrage weder einen diskreten Aufwand noch einen Thinking-Schalter oder ein Thinking-Budget enthält. Ein ausschließliches Budgetsignal wird daher nur von `any` erfasst.

`effortMode` hat drei Varianten:

- `inherit` behält den Aufwand des Clients bei, erlaubt aber weiterhin eine Änderung des Modells oder der Combo.
- `default` setzt `targetEffort` nur, wenn kein explizites Reasoning-Signal vorhanden ist.
- `force` ersetzt den diskreten Aufwand durch `targetEffort`.

Unabhängig davon kann `budgetAction` den Wert `preserve`, `remove` oder `set` haben. `force` mit `none` entfernt alle erkannten Aufwands- und Budgetfelder. `none` zusammen mit `set` ist ungültig.

Anfragen an bekanntermaßen inkompatible Modelle werden vor dem Upstream-Aufruf abgelehnt. Bei Combo-Zielen werden inkompatible Einträge entfernt; wenn keine Einträge übrig bleiben, gibt die Anfrage den Status `400` zurück. Unbekannte Fähigkeitsdaten erzeugen eine Warnung und lassen die Regel aktiv.

## Sicherheit und Übertragungswege

Das Quell- und Zielmodell beziehungsweise die Quell- und Ziel-Combo unterliegen weiterhin der bestehenden API-Schlüsselrichtlinie. Eine Reasoning-Regel erweitert niemals Modell-, Combo- oder Kontingentberechtigungen.

Die Engine ist in Chat Completions, Responses, Anthropic Messages und den internen Codex-WebSocket-Pfad integriert. Der WebSocket-Pfad akzeptiert nur Codex-Zielmodelle; Combo-Ziele können dort nicht ausgeführt werden. Die Regelentscheidung wird ohne Geheimnisse im bestehenden Routing-Trace gespeichert.

## Persistenz

Die Migration `src/lib/db/migrations/126_reasoning_routing_rules.sql` erstellt die Tabelle `reasoning_routing_rules`. Regeln verweisen auf gespeicherte API-Schlüssel, Combos und Provider-Verbindungen. Beim Löschen werden zugehörige Regeln bereinigt. Die Datenbankzugriffsschicht in `src/lib/db/reasoningRoutingRules.ts` verwaltet einen invalidierbaren Cache für den Anfragepfad.

Regeln sind in SQLite-Sicherungen, im vollständigen Datenbankexport und im Config-Sync-Bundle enthalten. `reconcileReasoningRulesForSync` deaktiviert importierte Regeln mit fehlenden Referenzen und meldet diese Konflikte.
