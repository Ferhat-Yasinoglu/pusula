# Pusula Quota Telemetry (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_QUOTA_TELEMETRY.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_QUOTA_TELEMETRY.md) · 🇹🇷 [tr](../../tr/docs/PUSULA_QUOTA_TELEMETRY.md)

---

Pusula trennt die Telemetrie zu Anbieterquoten von der Ghostlight-Abrechnung.

## Wahrheitsgemäße Zustände

- `healthy` bedeutet, dass eine Quelle nutzbare verbleibende Kapazität gemeldet hat.
- `approaching_limit` bedeutet, dass eine Quelle eine verbleibende Kapazität gemeldet hat, die höchstens dem konfigurierten Schwellenwert entspricht.
- `exhausted` wird nur ausgegeben, wenn eine Quelle eine Kapazität von null oder eine Nutzung am Grenzwert meldet.
- `unavailable` bedeutet, dass eine unterstützte Quelle keine Daten zurückgeben konnte.
- `unknown` bedeutet, dass keine unterstützte Quelle vorhanden oder kein Anbieterlimit bekannt ist.

Unbekannt bedeutet nicht ausgeschöpft und deaktiviert keinen Anbieter.

Quellen werden in dieser Reihenfolge bevorzugt: offizielle Anbieter-API, authentifizierte Nutzungs-API, explizit zugeordnete Antwort-Header, Administratorkonfiguration, lokale Schätzungen, unbekannt. Lokale Schätzungen werden niemals als Abrechnungsdaten des Anbieters dargestellt.

Antwort-Header werden ausschließlich anhand einer expliziten Anbieterzuordnung ausgewertet. Generische Header-Namen werden nicht global vorausgesetzt.
