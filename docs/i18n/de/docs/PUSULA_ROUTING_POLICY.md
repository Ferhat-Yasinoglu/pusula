# Pusula Routing Policy (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_ROUTING_POLICY.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_ROUTING_POLICY.md) · 🇹🇷 [tr](../../tr/docs/PUSULA_ROUTING_POLICY.md)

---

Das Routing behält die bestehende Logik zur Auswahl von Fähigkeiten und Kombinationen bei und wendet anschließend Faktoren für Zuweisung, Zustand, Schaltkreise, Kontingente, Latenz, Zuverlässigkeit, Modellpräferenz und Kostenpräferenz an.

Der adaptive Score ist nachvollziehbar und gibt sowohl den ausgewählten Kandidaten als auch alle nach Rangfolge sortierten Kandidaten zurück. Kandidaten mit ausgeschöpftem Kontingent, verweigerter Zuweisung oder offenen Schaltkreisen sind nicht auswählbar. Kandidaten mit unbekanntem Kontingent bleiben mit einem neutralen Kontingentfaktor auswählbar.

Die Routenvorschau ist deterministisch und führt keine Anfragen an vorgelagerte Modelle aus:

`POST /api/pusula/route/preview`

Die Antwort enthält Kandidaten-Scores, Faktoren, Gründe, den ausgewählten Anbieter und `liveRequestExecuted: false`.
