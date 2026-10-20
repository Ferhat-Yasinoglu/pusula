# Providers — Microsoft 365 Copilot (BizChat) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/COPILOT-M365.md) · 🇮🇷 [fa](../../../fa/docs/providers/COPILOT-M365.md) · 🇹🇷 [tr](../../../tr/docs/providers/COPILOT-M365.md)

---

`copilot-m365-web` (Alias `m365copilot`) sendet Chatanfragen im OpenAI-Format über eine
authentifizierte Microsoft 365 Copilot BizChat-Browsersitzung unter
`m365.cloud.microsoft/chat`. Dies ist eine inoffizielle Integration.

> **Noch keine Erfahrung mit Web-Cookie-Anbietern?**
>
> Lesen Sie **`docs/getting-started/WEB-COOKIE-GUIDE.md`**, um sich über den allgemeinen Einrichtungsprozess, Hinweise zur Authentifizierung, Einschränkungen und Fehlerbehebung zu informieren, bevor Sie dieser anbieterspezifischen Anleitung folgen.
>
> **Wichtig:** Die Anmeldeinformation für diesen Anbieter ist **kein Cookie**. Kopieren Sie keine
> Cookies von `m365.cloud.microsoft`. Die Anmeldeinformation besteht aus einem Abfrageparameter
> einer WebSocket-URL und einem Pfadsegment, die beide auf der Registerkarte „Network“ der DevTools ausgelesen werden.

## Voraussetzungen

- Ein Microsoft 365-Konto mit Zugriff auf BizChat unter `m365.cloud.microsoft/chat`
- Ein Chromium-basierter Browser (Chrome, Edge) zur WebSocket-Untersuchung mit den DevTools
- Eine M365 Copilot-Lizenz (in vielen Microsoft 365 Business-/Enterprise-Tarifen enthalten)

## Erfassen der Anmeldeinformationen (WebSocket-Methode)

1. Melden Sie sich unter `https://m365.cloud.microsoft/chat` an und starten Sie eine Unterhaltung.
2. Öffnen Sie **DevTools → Network**.
3. Filtern Sie nach **WS** (WebSocket).
4. Klicken Sie auf die Chathub-WebSocket-Verbindung. Suchen Sie nach einer URL, die mit
   `wss://substrate.office.com/m365Copilot/Chathub/` beginnt.
5. Kopieren Sie aus der **Request URL**:
   - Den Wert des Abfrageparameters `access_token` (ein kurzlebiges JWT).
   - Das Chathub-Pfadsegment nach `/Chathub/` (z. B. `<oid>@<tenant>`).

Die vollständige URL hat folgendes Format:

```
wss://substrate.office.com/m365Copilot/Chathub/<oid>@<tenant>?...&access_token=<jwt>
```

6. Navigieren Sie in Pusula zu **Providers → Add Provider**, wählen Sie **Microsoft 365 Copilot
   (BizChat)** aus und fügen Sie die Anmeldeinformationen in folgendem Format ein:

```
access_token=<jwt>; chathubPath=<oid>@<tenant>
```

7. Klicken Sie auf **Test Connection** und **Save**.

## Erfassen der Anmeldeinformationen (HAR-Import)

Anstatt die Werte manuell aus der WebSocket-URL zu kopieren, können Sie eine HAR-Datei
aus den DevTools exportieren:

1. Öffnen Sie **DevTools → Network**.
2. Starten Sie eine BizChat-Unterhaltung oder setzen Sie sie fort (dadurch wird die WebSocket-Verbindung hergestellt).
3. Klicken Sie mit der rechten Maustaste in den Network-Bereich und wählen Sie **Save all as HAR with content**.
4. Verwenden Sie in Pusula die Schaltfläche **Import .har file** im Dialogfeld für die Anbieterverbindung.

Pusula durchsucht die HAR-Datei nach der Chathub-WebSocket-URL, extrahiert
`access_token` und `chathubPath` und füllt die Felder für die Anmeldeinformationen automatisch aus. Beim
HAR-Import wird das Ablaufdatum des JWT decodiert und die verbleibende Token-Lebensdauer angezeigt.

> **Übertragen Sie niemals einen echten HAR-Export, ein Zugriffstoken oder ein Aktualisierungstoken in ein Repository.** Werte für Tests und
> Dokumentation müssen immer Platzhalter sein.

## Token-Lebensdauer und Aktualisierung

Das `access_token` ist kurzlebig (normalerweise **~75 Minuten**). Nach Ablauf meldet der Anbieter
einen Verbindungsfehler, und Sie müssen die Anmeldeinformationen erneut erfassen.

### Automatische Aktualisierung mit `refreshToken`

Um eine manuelle Neuerfassung zu vermeiden, können Sie ein Microsoft-Aktualisierungstoken unter
**Advanced Settings → providerSpecificData** der Verbindung speichern:

| Feld           | Beschreibung                                                                       |
| -------------- | ---------------------------------------------------------------------------------- |
| `refreshToken` | Microsoft OAuth-Aktualisierungstoken für den Bereich `substrate.office.com/sydney` |
| `tier`         | `individual` (Standard), `edu` oder `enterprise`                                   |

Rufen Sie das Aktualisierungstoken über einen Microsoft-Gerätecode- oder Autorisierungscode-Flow
mit dem Bereich `substrate.office.com/sydney` ab. Wenn `refreshToken` festgelegt ist, aktualisiert Pusula
das `access_token` vor jeder Anfrage vorab, sodass Sie die Anmeldeinformationen nicht
nach jedem Ablauf nach ~75 Minuten erneut erfassen müssen.

Wenn `refreshToken` nicht festgelegt ist, müssen Sie die WebSocket-Anmeldeinformationen
nach jedem Ablauf manuell erneut erfassen.

### Tarifauswahl

| Tarif        | Alias        | Oberfläche                    |
| ------------ | ------------ | ----------------------------- |
| `individual` | _(Standard)_ | M365 Copilot für Privatkunden |
| `edu`        | `included`   | M365 Copilot für Bildung      |
| `enterprise` | `work`       | M365 Copilot für Unternehmen  |

Legen Sie den Tarif unter **Advanced Settings → providerSpecificData → tier** fest. Der Tarif beeinflusst
das BizChat-Routing und den Modellzugriff.

## Sicherheitsmodell

- **Inoffizielle Integration.** Dieser Anbieter verwendet ein durch Reverse Engineering erschlossenes BizChat-WebSocket-
  Protokoll. Die Integration kann ohne Vorankündigung ausfallen, wenn Microsoft den Endpunkt ändert.
- Das Flag `subscriptionRisk: true` weist darauf hin, dass die Integration auf einem
  undokumentierten Endpunkt basiert. Kontoeinschränkungen sind möglich, aber nicht bestätigt.
- Das Zugriffstoken ist ein kurzlebiges JWT. Behandeln Sie es wie ein Passwort: Übertragen Sie es nicht
  in ein Repository, protokollieren oder teilen Sie es nicht.
- Das Aktualisierungstoken gewährt langfristigen Zugriff auf die BizChat-Oberfläche. Bewahren Sie es mit der
  gleichen Sorgfalt wie einen API-Schlüssel auf.

## Fehlerbehebung

### Authentifizierung schlägt sofort fehl

- Vergewissern Sie sich, dass Sie die Anmeldedaten aus der **WebSocket-URL** und nicht aus einer XHR-/Fetch-Anfrage kopiert haben. Die
  Anmeldedaten befinden sich im Abfrageparameter `access_token` der Chathub-WebSocket-
  Verbindung – nicht in einem `Authorization: Bearer`-Header.
- Stellen Sie sicher, dass `chathubPath` das vollständige Segment `<oid>@<tenant>` aus dem URL-
  Pfad enthält.

### Token läuft nach ~75 Minuten ab

Dies ist das erwartete Verhalten. Ohne ein `refreshToken` ist das Zugriffstoken kurzlebig. Sie können entweder:

- Die Anmeldedaten erneut über DevTools erfassen oder
- in den erweiterten Einstellungen ein `refreshToken` zur automatischen Aktualisierung konfigurieren.

### Verbindungstest erfolgreich, aber Chat gibt 401 zurück

Das Token ist möglicherweise zwischen der Validierung und der ersten Anfrage abgelaufen. Erfassen Sie erneut
aktuelle Anmeldedaten.

### Copilot wird nicht in der Anbieterliste angezeigt

Stellen Sie sicher, dass `copilot-m365-web` unter **Dashboard → Anbieter** aktiviert ist. Der Anbieter kann
in einigen Tarifen standardmäßig ausgeblendet sein.

## Referenzen

- Issue: [#12779](https://github.com/Ferhat-Yasinoglu/pusula/issues/12779)
- Diskussion: [#12756](https://github.com/Ferhat-Yasinoglu/pusula/discussions/12756)
- Quellcode: `src/shared/constants/providers/web-cookie.ts` (Anbieterdefinition)
- HAR-Import: `src/shared/utils/m365HarImport.ts`
- Anmeldedatenfelder: `src/shared/providers/webSessionCredentials.ts`
- Tarifdialog: `src/app/(dashboard)/dashboard/providers/[id]/components/modals/m365Tier.ts`
