# Pusula Provider Failover (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_PROVIDER_FAILOVER.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_PROVIDER_FAILOVER.md) · 🇹🇷 [tr](../../tr/docs/PUSULA_PROVIDER_FAILOVER.md)

---

Fehler werden klassifiziert, bevor Entscheidungen über Wiederholungsversuche getroffen werden.

Bei vorübergehenden Fehlern wie Zeitüberschreitungen, Netzwerkfehlern, Ratenbegrenzungen und 5xx-Antworten von Anbietern kann auf einen anderen Anbieter ausgewichen werden. Authentifizierungsfehler, Berechtigungsfehler, ungültige Anfragen, nicht verfügbare Modelle und unbekannte Fehler werden nicht ohne Weiteres erneut versucht.

Die standardmäßige anbieterübergreifende Richtlinie erlaubt bis zu drei Anbieterversuche, wiederholt Anfragen bei Ratenbegrenzungen und Zeitüberschreitungen und behandelt die administrative Deaktivierung getrennt vom temporären Schaltkreiszustand.

Die Schaltkreiszustände sind `closed`, `open` und `half_open`. Eine Abkühlphase plant eine begrenzte Testanfrage; bei einer erfolgreichen Testanfrage wird der Schaltkreis geschlossen, bei einer fehlgeschlagenen erneut geöffnet.
