# Management Authentication (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/MANAGEMENT-AUTH.md) · 🇮🇷 [fa](../../../fa/docs/guides/MANAGEMENT-AUTH.md) · 🇹🇷 [tr](../../../tr/docs/guides/MANAGEMENT-AUTH.md)

---

Pusula verfügt über **vier Anmeldedatenfamilien**, die Verwaltungsrouten autorisieren können.
Sie sind nicht austauschbar. Inferenz-API-Schlüssel (`sk-…`) verwalten den
Server **nicht**, sofern ihnen nicht ausdrücklich der Geltungsbereich `manage` oder `admin` gewährt wurde.

Kanonische Implementierung: `src/lib/api/requireManagementAuth.ts`.

| Anmeldedaten                      | Typische Form                            | Erstellt unter                                             | Vorgesehene Verwendung         | Verwaltungsberechtigung                                                                            |
| --------------------------------- | ---------------------------------------- | ---------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------- |
| Dashboard-JWT-Sitzung             | `auth_token`-Cookie                      | Dashboard-Anmeldung                                        | Browser-Benutzeroberfläche     | Vollständige Dashboard-Verwaltung gemäß den Regeln für CSRF, Lokalität und stets geschützte Routen |
| CLI-Machine-ID-Token              | intern / lokal                           | CLI-Bootstrap (`pusula` auf demselben Rechner)          | Lokale CLI                     | Nur lokale Verwaltung                                                                              |
| Zugriffstoken mit Geltungsbereich | `oma_live_…`                             | **Einstellungen → Zugriffstoken** oder `pusula connect` | Remote-CLI und Verwaltungs-API | Muss den für die Route erforderlichen Geltungsbereich `read`, `write` oder `admin` erfüllen        |
| Inferenz-API-Schlüssel            | `sk-…` (und andere API-Schlüsselpräfixe) | **API-Manager / API-Schlüssel**                            | `/v1/*`-Inferenz               | **Keine**, sofern die Schlüsselmetadaten nicht `manage` oder `admin` enthalten                     |

`oma_`-Anmeldedaten sind Verwaltungs-/CLI-Anmeldedaten. Sie sind **keine** Inferenz-API-Schlüssel.

Wenn die Anmeldung/API-Schlüssel-Authentifizierung für den Server deaktiviert ist, akzeptieren einige Verwaltungsrouten möglicherweise
nicht authentifizierte Aufrufe. Ausschließlich lokale und stets geschützte Routen wenden weiterhin
ihre eigenen Regeln an. Die Angabe einer dieser Anmeldedaten ist daher nicht generell
zwingend erforderlich, und ihr Besitz ist ohne den erforderlichen
Geltungsbereich und die entsprechende Routenlokalität nicht generell ausreichend.

Siehe auch: [Remote-Modus](./REMOTE-MODE.md) (wie `oma_live_…` für eine Remote-CLI ausgestellt wird).

---

## Scope-Matrizen

Scopes für die API-Schlüsselverwaltung und Access-Token-Scopes verwenden unterschiedliche Vokabulare.
MCP-Tool-Scopes bilden ein drittes Vokabular und werden mit `scopeMatches` statt mit
einer der Funktionen in den nachstehenden Tabellen geprüft. Gegenüberstellung:
[Drei Scope-Namespaces](../frameworks/MCP-SERVER.md#three-scope-namespaces).

### Access-Token-Scopes (`oma_live_…`)

| Scope   | Typische Operationen                                                                                  |
| ------- | ----------------------------------------------------------------------------------------------------- |
| `read`  | Listen-/Status-GETs, die das Token sehen darf                                                         |
| `write` | Mutationen (Erstellen/Aktualisieren/Löschen) unterhalb von Admin                                      |
| `admin` | Vollständige Remote-CLI / Verbindungs-Token (Passwort-Bootstrap verwendet standardmäßig diesen Scope) |

Ein Token mit `read` kann keine `write`-Route aufrufen. Format der Laufzeitmeldung:
`Access token scope '<have>' is insufficient; '<need>' required.`

### Scopes für die API-Schlüsselverwaltung

| Scope    | Bedeutung                                                                                           |
| -------- | --------------------------------------------------------------------------------------------------- |
| (keiner) | Nur Inferenz. Verwaltungsrouten geben 403 zurück.                                                   |
| `manage` | Verwaltungs-API (dieselbe Zugriffsschranke wie der API-Schlüssel-Zweig von `requireManagementAuth`) |
| `admin`  | Erfüllt auch `hasManageScope` (wird als verwaltungsfähig behandelt)                                 |

Aktivieren Sie `manage` für den Schlüssel in der Benutzeroberfläche „API Keys / API Manager“. Verwenden Sie einen
Chat-Client-Schlüssel nicht für die Automatisierung, es sei denn, Sie haben ihm diesen Scope bewusst gewährt.

---

## Erstellen und Widerrufen

### Dashboard-JWT-Sitzung

1. Öffnen Sie `/login` und melden Sie sich mit dem Verwaltungspasswort an (`INITIAL_PASSWORD` beim ersten Start).
2. Das Cookie `auth_token` ist HttpOnly. Das Browser-Dashboard verwendet es automatisch.
3. Melden Sie sich über `/api/auth/logout` ab. Es gibt kein langlebiges Geheimnis, das kopiert werden könnte.

### CLI-Machine-ID-Token

1. Führen Sie `pusula` auf **demselben Host** wie den Server aus (Loopback).
2. Die CLI erstellt ein Machine-ID-Token unter `~/.pusula/` (chmod 600).
3. Dies funktioniert **nicht** von einem anderen Rechner aus. Verwenden Sie für eine Remote-CLI ein Zugriffstoken.

### Zugriffstoken mit Geltungsbereich (`oma_live_…`)

1. Dashboard: **Einstellungen → Zugriffstoken** → erstellen (Name + Geltungsbereich). **Das Geheimnis wird nur einmal angezeigt.**
2. Oder per CLI: `pusula connect <host>` (Passwort → Token). Siehe [Remote-Modus](./REMOTE-MODE.md).
3. Header: `Authorization: Bearer oma_live_…`
4. Widerrufen Sie es auf derselben Zugriffstoken-Seite (oder löschen Sie den CLI-Kontext).
5. Der Server speichert nur einen Hash. Behandeln Sie den Klartext wie ein Passwort.

### API-Schlüssel mit `manage`-Geltungsbereich

1. Dashboard: **API-Manager / API-Schlüssel** → einen Schlüssel erstellen oder bearbeiten → `manage` (oder `admin`) aktivieren.
2. Header: `Authorization: Bearer sk-…` (das tatsächliche Präfix des Schlüssels).
3. Widerrufen Sie den Schlüssel oder entfernen Sie `manage` in derselben Benutzeroberfläche.
4. Prinzip der geringsten Rechte für Automatisierungen, bei denen es sich nicht um die CLI handelt: Bevorzugen Sie ein `read`-Zugriffstoken für reine GET-Aufgaben; verwenden Sie `manage` für einen API-Schlüssel nur, wenn der Aufrufer sowohl `/v1` als auch die Verwaltung ansprechen muss.

---

## Header-Format

```http
Authorization: Bearer oma_live_<secret>
Authorization: Bearer sk-<secret>
Cookie: auth_token=<dashboard-jwt>
```

Fügen Sie Verwaltungszugangsdaten nicht in den URL-Pfad oder die Abfragezeichenfolge ein. Die Authentifizierung für die Verwaltung erfolgt ausschließlich per Header/Cookie.

---

## Beispiele zum Kopieren und Einfügen

Schreibgeschützt (Anbieter auflisten). Verwenden Sie ein `read`-Zugriffstoken:

```bash
curl -sS "$PUSULA_URL/api/providers" \
  -H "Authorization: Bearer oma_live_<read-token>"
```

Ändernd (eine Anbieterverbindung erstellen). Verwenden Sie ein `write`-/`admin`-Zugriffstoken oder einen API-Schlüssel mit `manage`-Berechtigungsumfang:

```bash
curl -sS -X POST "$PUSULA_URL/api/providers" \
  -H "Authorization: Bearer oma_live_<write-or-admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"provider":"openai","apiKey":"<upstream-key>"}'
```

Inferenz (keine Verwaltung). Regulärer API-Schlüssel, kein `manage` erforderlich:

```bash
curl -sS "$PUSULA_URL/v1/models" \
  -H "Authorization: Bearer sk-<inference-key>"
```

---

## Aktuelle Laufzeitfehler (keine Geheimnisse ausgeben)

| Situation                                                        | Typischer Status | Meldung (bereinigt)                                                                                        |
| ---------------------------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Keine Anmeldedaten                                               | 401              | `Authentifizierung erforderlich`                                                                           |
| Ungültiges/abgelaufenes `oma_live_…`                             | 401              | `Ungültiges oder abgelaufenes Zugriffstoken`                                                               |
| Gültiger API-Schlüssel ohne `manage`/`admin`                     | 403              | `Dem API-Schlüssel fehlt der Geltungsbereich 'manage'. Aktivieren Sie ihn im Dashboard für API-Schlüssel.` |
| Ungültiger gewöhnlicher API-Schlüssel auf einer Verwaltungsroute | 403              | `Ungültiges Verwaltungstoken`                                                                              |
| Geltungsbereich des Zugriffstokens zu niedrig                    | 403              | `Der Geltungsbereich '<have>' des Zugriffstokens reicht nicht aus; '<need>' ist erforderlich.`             |

„Ungültiges Verwaltungstoken“ bedeutet, dass das Bearer-Token **nicht** als
Verwaltungsanmeldedaten akzeptiert wurde. Daraus geht **nicht** hervor, welche Art
Sie erstellen müssen. Verwenden Sie die obige Tabelle: Inferenzschlüssel benötigen
den Geltungsbereich `manage`; die Remote-CLI benötigt `oma_live_…`; das Dashboard
verwendet das Sitzungscookie.

---

## Empfohlene Wahl nach dem Prinzip der geringsten Berechtigung

| Aufrufer                                                   | Verwendung                                                              |
| ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Browser                                                    | Dashboard-Sitzung                                                       |
| CLI auf dem Serverhost                                     | Maschinen-Token                                                         |
| CLI auf einem Laptop mit Verbindung zu einem Remote-Server | `oma_live_…` aus `pusula connect`                                    |
| CI / Skripte (nur Verwaltung)                              | `oma_live_…` mit dem kleinstmöglichen ausreichenden Berechtigungsumfang |
| CI, die sowohl `/v1` als auch `/api` aufrufen muss         | API-Schlüssel mit `manage` **oder** zwei Anmeldedaten                   |
