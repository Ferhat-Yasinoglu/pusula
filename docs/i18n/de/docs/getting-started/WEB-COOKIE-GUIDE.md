# Web Cookie Providers (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/WEB-COOKIE-GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/WEB-COOKIE-GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/getting-started/WEB-COOKIE-GUIDE.md)

---

Web-Cookie-Provider ermöglichen Pusula, einen KI-Dienst über Ihre bestehende Browsersitzung statt über einen API-Schlüssel zu verwenden. Sie sind nützlich, wenn Sie bereits über die Website eines Dienstes Zugriff darauf haben und möchten, dass Pusula dieselbe authentifizierte Sitzung verwendet.

Im Gegensatz zu API-Schlüssel-Providern authentifizieren sich Web-Cookie-Provider mithilfe der Anmeldedaten, die Ihr Browser an die Website sendet.

---

# Bevor Sie beginnen

> **Wichtig:** Kopieren Sie Anmeldedaten immer aus einer **aktiven Netzwerkanfrage** und **nicht** aus dem Cookie-Speicher Ihres Browsers.

Viele Authentifizierungsprobleme entstehen dadurch, dass Cookies von der falschen Stelle kopiert werden.

## Nicht aus dem Cookie-Speicher kopieren

Die meisten Browser zeigen gespeicherte Cookies hier an:

```
Entwicklertools
→ Anwendung (oder Speicher)
→ Cookies
```

Obwohl diese Cookies korrekt aussehen, können sie:

- veraltet sein
- unvollständig sein
- Cookies nicht enthalten, die nur bei authentifizierten Anfragen gesendet werden

Die Verwendung dieser Werte kann zu Authentifizierungsfehlern führen, selbst wenn sie gültig erscheinen.

## Aus einer aktiven Anfrage kopieren

Verwenden Sie stattdessen die Cookies aus einer erfolgreichen Anfrage:

```
Entwicklertools
→ Netzwerk
→ Seite aktualisieren
→ Eine Chat- oder Konversationsanfrage öffnen
→ Anfrage-Header
→ Cookie
```

Der Anfrage-Header `Cookie` enthält genau die Authentifizierungsinformationen, die Ihr Browser erfolgreich verwendet hat.

Bei den meisten Web-Cookie-Providern ist dies der Wert, der in Pusula eingefügt werden sollte.

---

# Allgemeine Einrichtung

Der Einrichtungsprozess ist bei den meisten Web-Cookie-Providern identisch.

1. Melden Sie sich auf der Website des Providers an.
2. Öffnen Sie die Entwicklertools des Browsers.
3. Öffnen Sie die Registerkarte **Netzwerk**.
4. Aktualisieren Sie die Seite.
5. Öffnen Sie eine authentifizierte Chat- oder Konversationsanfrage.
6. Kopieren Sie die erforderlichen Authentifizierungsdaten.
7. Öffnen Sie Pusula.
8. Navigieren Sie zu **Provider → Provider hinzufügen**.
9. Wählen Sie Ihren Web-Cookie-Provider aus.
10. Fügen Sie die Anmeldedaten ein.
11. Klicken Sie auf **Verbindung testen**.
12. Speichern Sie den Provider.

Welche Anmeldedaten genau erforderlich sind, hängt vom Provider ab.

---

# Formate der Provider-Anmeldedaten

Verschiedene Websites speichern Authentifizierungsdaten auf unterschiedliche Weise. Einige benötigen nur Cookies, während andere zusätzliche Header oder Token erfordern.

| Provider                        | Anmeldedatenformat                    | Provider-Anleitung               |
| ------------------------------- | ------------------------------------- | -------------------------------- |
| Claude Web                      | Vollständiger `Cookie`-Anfrage-Header | `docs/providers/CLAUDE_WEB.md`   |
| ChatGPT Web (Codex)             | Vollständiger `Cookie`-Header         | `docs/providers/CHATGPT_WEB.md`  |
| Gemini Web                      | _(überprüfen)_                        |                                  |
| Copilot Web                     | _(überprüfen)_                        | `docs/providers/COPILOT-M365.md` |
| Microsoft 365 Copilot (BizChat) | WS-`access_token` + `chathubPath`     | `docs/providers/COPILOT-M365.md` |
| Grok Web                        | _(überprüfen)_                        |                                  |
| ...                             | ...                                   | ...                              |

> Aktualisieren Sie diese Tabelle, wenn neue Web-Cookie-Provider hinzugefügt werden oder bestehende Provider ihre Authentifizierungsanforderungen ändern.

---

# Was Web-Cookie-Provider können und was nicht

Web-Cookie-Provider verwenden die Chat-Oberfläche einer Website erneut. Sie bieten **nicht** dieselben Funktionen wie offizielle APIs.

## Unterstützt

- Authentifizierung mit Ihrer bestehenden Browsersitzung
- Zugriff auf die über Ihr Konto verfügbaren Modelle
- Streaming von Chat-Antworten
- Kein API-Schlüssel erforderlich

## Nicht unterstützt

- Funktionsaufrufe
- Tool-Aufrufe
- Automatische Dateibearbeitung
- Agentenbasierte IDE-Workflows
- Funktionen, die nur über APIs verfügbar sind

Dies ist das erwartete Verhalten und **kein** Fehler.

Wenn Sie die Ausführung von Tools, automatische Dateibearbeitung oder andere Agenten-Workflows benötigen, verwenden Sie statt eines Web-Cookie-Providers einen **API-Schlüssel-Provider**.

---

# Einschränkung bei der Validierung

Eine erfolgreiche **Verbindungsprüfung** oder Cookie-Validierung bestätigt lediglich, dass die bereitgestellten Anmeldedaten dem erwarteten Format zu entsprechen scheinen.

Bis Issue #7857 behoben ist, **garantiert** eine erfolgreiche Validierung **nicht**, dass sich der Provider erfolgreich authentifizieren kann.

Wenn die Authentifizierung weiterhin fehlschlägt, überprüfen Sie, ob Sie die Anmeldedaten aus einer aktiven Netzwerkanfrage und nicht aus dem Cookie-Speicher des Browsers kopiert haben.

---

# Fehlerbehebung

## Authentifizierung schlägt fehl

Überprüfen Sie, ob die Anmeldedaten von hier kopiert wurden:

```
Netzwerk
→ Anfrage-Header
→ Cookie
```

und **nicht** von hier:

```
Anwendung
→ Cookies
```

---

## Cookie funktioniert im Browser, aber nicht in Pusula

Einige Provider verwenden Cookies, die nur bei authentifizierten Anfragen gesendet werden.

Kopieren Sie die Anmeldedaten erneut aus einer neuen Netzwerkanfrage, nachdem Sie erfolgreich eine Konversation geöffnet haben.

---

## Sitzung abgelaufen

Web-Cookie-Provider verwenden Ihre bestehende Browsersitzung.

Wenn Ihre Browsersitzung abläuft oder Sie sich abmelden, müssen Sie neue Anmeldedaten kopieren.

---

## Verbindungsprüfung erfolgreich, aber Anfragen schlagen fehl

Bis Issue #7857 behoben ist, garantiert eine erfolgreiche Validierung nicht, dass die Authentifizierungsanfrage erfolgreich sein wird.

Kopieren Sie Ihre Anmeldedaten erneut aus einer neuen authentifizierten Anfrage, bevor Sie mit der weiteren Fehlerbehebung fortfahren.

---

# Provider-Beispiel

Eine vollständige providerspezifische Schritt-für-Schritt-Anleitung finden Sie hier:

- **Claude Web** — `docs/providers/CLAUDE_WEB.md`

Die Anleitung zu Claude Web zeigt den vollständigen Einrichtungsprozess für einen Web-Cookie-Provider und dient als Referenzimplementierung.

---

# Bewährte Vorgehensweisen

- Kopieren Sie Anmeldedaten aus einer neuen authentifizierten Anfrage.
- Vermeiden Sie die Wiederverwendung alter Cookies.
- Lassen Sie Ihre Browsersitzung aktiv, während Sie Web-Cookie-Provider verwenden.
- Behandeln Sie kopierte Cookies als vertrauliche Anmeldedaten.
- Verwenden Sie API-Schlüssel-Provider, wenn Sie Funktionsaufrufe oder Agenten-Workflows benötigen.
