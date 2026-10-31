# #7778 hierarchical admission cleanup plan (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../plans/7778-hierarchical-admission.md) · 🇮🇷 [fa](../../../fa/docs/plans/7778-hierarchical-admission.md) · 🇹🇷 [tr](../../../tr/docs/plans/7778-hierarchical-admission.md)

---

1. Sichern Sie den bestehenden Single-Key-Semaphor-Vertrag und den neuen atomaren Multi-Key-Vertrag mit gezielten Tests ab: keine Teilreservierungen, FIFO-Warteschlangen, Abbruch, Zeitüberschreitung, volle Warteschlange, idempotente Freigabe, Statistiken und Bereinigung.
2. Verallgemeinern Sie den bestehenden Account-Semaphor direkt. Behalten Sie `acquire()` als Kompatibilitäts-Wrapper um `acquireMany()` bei; fügen Sie weder einen zweiten Scheduler noch eine Abhängigkeit hinzu.
3. Ersetzen Sie die ausschließlich Account-bezogene Reservierung in `chatCore` durch eine einzige kumulative globale/provider-/accountbezogene Reservierung unmittelbar vor `withRateLimit`. Reservieren Sie die gesamte Menge erneut, sobald eine Account-Rotation die Verbindung ändert, und behalten Sie die Reservierung bis zum Abschluss des Streamings bei.
4. Erweitern Sie die bestehende Verarbeitungskette für Resilienz-Einstellungen (Typen, Standardwerte, Normalisierung, Schema, API-Antwort, Benutzeroberfläche und Übersetzungen) um die globalen und providerbezogenen Obergrenzen. Benennen Sie die alte Bottleneck-Parallelitätssteuerung in verbindungs-/kontingentbereichsbezogene Parallelität um, damit ihr tatsächlicher Geltungsbereich deutlich wird.
5. Führen Sie gezielte Tests, Linting, Typprüfung, statische Prüfungen und die vollständige Testsuite aus; dokumentieren Sie die Verhaltensänderung im Changelog.

Bewusst beibehaltenes Verhalten: Eine Parallelität von null/`null` umgeht eine Begrenzung, ausschließlich Account-bezogene Aufrufer verwenden weiterhin `acquire()`, Steuerelemente für blockierte Accounts behalten ihr Schlüsselformat und ihre API bei, und das Verhalten der Provider-Warteschlange zur Ratenbegrenzung bleibt unverändert.
