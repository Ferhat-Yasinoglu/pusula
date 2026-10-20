# Pusula Allocation Handoff (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_ALLOCATION_HANDOFF.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_ALLOCATION_HANDOFF.md) · 🇹🇷 [tr](../../tr/docs/PUSULA_ALLOCATION_HANDOFF.md)

---

Eine Zuweisung ist kein Provider-Kontingent.

Kontingentpools legen fest, welche API-Schlüssel einen Provider-Pool in welchem Umfang nutzen dürfen und wie Hard-, Soft- oder Burst-Richtlinien angewendet werden. Das Provider-Kontingent ist die externe Kapazität, die von einem Provider oder einer explizit konfigurierten Quelle gemeldet wird. Interne Ghostlight-Budgets sind vom Administrator festgelegte Governance-Grenzwerte.

Die Operation `ensurePool` ist idempotent: Ein identischer Pool bleibt unverändert, eine geänderte Zuweisung wird aktualisiert und ein fehlender Pool wird erstellt. Dies ist für Automatisierung und API-Aufrufer mit begrenztem Umfang vorgesehen.

Der schreibgeschützte Statusendpunkt lautet `GET /api/pusula/status`. Der Verifizierungsbefehl lautet `npm run pusula:verify`; er sendet keine Live-Modellanfrage.
