# #7778 hierarchical admission cleanup plan (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../plans/7778-hierarchical-admission.md) · 🇮🇷 [fa](../../../fa/docs/plans/7778-hierarchical-admission.md) · 🇹🇷 [tr](../../../tr/docs/plans/7778-hierarchical-admission.md)

---

1. Sichern Sie den bestehenden Semaphorvertrag für einzelne Schlüssel und den neuen atomaren Vertrag für mehrere Schlüssel mit gezielten Tests ab: keine Teilreservierungen, FIFO-Warteschlangenreihenfolge, Abbruch, Zeitüberschreitung, volle Warteschlange, idempotente Freigabe, Statistiken und Bereinigung.
2. Verallgemeinern Sie den bestehenden Konto-Semaphor direkt. Behalten Sie `acquire()` als Kompatibilitäts-Wrapper um `acquireMany()` bei; fügen Sie weder einen zweiten Scheduler noch eine Abhängigkeit hinzu.
3. Ersetzen Sie die ausschließlich kontobezogene Akquisition in `chatCore` unmittelbar vor `withRateLimit` durch eine kumulative globale/anbieterbezogene/kontobezogene Akquisition. Akquirieren Sie den gesamten Satz erneut, sobald eine Kontorotation die Verbindung ändert, und behalten Sie die Freigabe bis zum Abschluss des Streamings bei.
4. Erweitern Sie die bestehende Verarbeitungskette für Resilienz-Einstellungen (Typen, Standardwerte, Normalisierung, Schema, API-Antwort, Benutzeroberfläche und Übersetzungen) um die globalen und anbieterbezogenen Obergrenzen. Benennen Sie die bisherige Bottleneck-Nebenläufigkeitssteuerung in verbindungs-/quotenbereichsbezogene Nebenläufigkeit um, damit ihr tatsächlicher Geltungsbereich deutlich wird.
5. Führen Sie gezielte Tests, Linting, Typprüfung, statische Prüfungen und die vollständige Testsuite aus; dokumentieren Sie die Verhaltensänderung im Changelog.

Bewusst beibehaltenes Verhalten: Eine Nebenläufigkeit von null/`null` umgeht eine Sperre, ausschließlich kontobezogene Aufrufer verwenden weiterhin `acquire()`, Steuerelemente für blockierte Konten behalten ihr Schlüsselformat und ihre API bei, und das Verhalten der Warteschlange für Anbieter-Ratenbegrenzungen bleibt unverändert.
