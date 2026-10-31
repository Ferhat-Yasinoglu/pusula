# Developer environment notes (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../DEVELOPER-ENVIRONMENT.md) · 🇮🇷 [fa](../../fa/docs/DEVELOPER-ENVIRONMENT.md) · 🇹🇷 [tr](../../tr/docs/DEVELOPER-ENVIRONMENT.md)

---

Diese Seite erläutert das lokale Verhalten der `.env`-Datei des Projekts und beschreibt den Umgang mit Umgebungsdateien und Geheimnissen bei der Entwicklung von Pusula.

## Verhalten von .env bei postinstall

Das Projekt kann während `npm install` / `postinstall` zur Vereinfachung der Entwicklung eine lokale `.env`-Datei erzeugen. Diese Datei ist ausschließlich für die lokale Entwicklung und für Tests vorgesehen und darf niemals in die Versionsverwaltung eingecheckt werden.

Wichtige Punkte:

- Die `.gitignore` des Repositorys ignoriert bereits `.env*`-Dateien (siehe den entsprechenden Eintrag in der `.gitignore`). Entfernen oder ändern Sie diese Regel nur, wenn Sie bewusst eine bestimmte Beispieldatei einchecken möchten und dafür über einen dokumentierten Prozess verfügen.
- Wenn versehentlich ein echtes Geheimnis in das Repository eingecheckt wird, rotieren/widerrufen Sie die Zugangsdaten umgehend und entfernen Sie sie aus dem Repository-Verlauf, beispielsweise mit `git filter-repo` oder einem gleichwertigen Bereinigungsverfahren. Wenden Sie sich an die für Sicherheit zuständige Kontaktperson, wenn Sie Hilfe benötigen.
- Verwenden Sie für CI und Produktion CI-Geheimnisse oder eine Geheimnisverwaltung wie GitHub Actions Secrets, Azure Key Vault oder HashiCorp Vault, anstatt Geheimnisse in Dateien einzuchecken.

## Empfohlener lokaler Arbeitsablauf

- Bewahren Sie `.env` ausschließlich in Ihrem lokalen Arbeitsbereich auf. Verwenden Sie die bereits versionierte `.env.example`, um erforderliche Variablen und zulässige Beispielwerte zu dokumentieren.
- Wenn Sie lokal Tests ausführen, die geheimnisähnliche Werte erfordern, verwenden Sie vorzugsweise synthetische Platzhalter oder zur Laufzeit erzeugte temporäre Schlüssel anstelle echter Zugangsdaten.
- Fügen Sie Tests, die Platzhalter verwenden, einen kurzen Kommentar hinzu, damit Prüfende erkennen, dass es sich um synthetische Testdaten handelt.

## Hinweise zu Scannern

- Einige kompilierte oder binäre Ressourcen, z. B. eingebettete Base64-WASM-Blobs, können ASCII-Teilzeichenfolgen enthalten, die wie Zugangsdaten aussehen und textbasierte Geheimnisscanner auslösen. Wenn diese Ressourcen legitim sind, nehmen Sie sie entweder in die Zulassungsliste des Scanners auf oder schließen Sie die entsprechenden Verzeichnisse in der Scannerkonfiguration aus.

## Wenn Sie ein Leck entdecken

1. Rotieren/widerrufen Sie den Schlüssel umgehend.
2. Entfernen Sie das Geheimnis aus dem Verlauf und erzwingen Sie bei Bedarf das Pushen eines bereinigten Branches.
3. Benachrichtigen Sie die Verantwortlichen und befolgen Sie die Checkliste Ihrer Organisation für die Reaktion auf Sicherheitsvorfälle.
