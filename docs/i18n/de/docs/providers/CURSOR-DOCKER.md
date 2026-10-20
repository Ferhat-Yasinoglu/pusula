# Cursor Provider in Docker Environments (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CURSOR-DOCKER.md) · 🇮🇷 [fa](../../../fa/docs/providers/CURSOR-DOCKER.md) · 🇹🇷 [tr](../../../tr/docs/providers/CURSOR-DOCKER.md)

---

Wenn Pusula innerhalb von Docker ausgeführt wird, schlagen die veralteten Abläufe **Import aus Cursor IDE** /
`cursor-agent` fehl, da der Container nicht auf die Cursor-Installation des Hosts
zugreifen kann. Verwenden Sie stattdessen **Mit Cursor anmelden** (Deep-Control-PKCE).

## Warum der IDE-/CLI-Import in Docker fehlschlägt

1. **Dateisystemisolierung** — Der automatische Import sucht nach Linux-Pfaden wie
   `~/.config/Cursor/User/globalStorage/state.vscdb` _innerhalb_ des Containers.
   Unter Docker Desktop für macOS wird die IDE-Datenbank des Hosts standardmäßig nicht eingebunden, und
   das Betriebssystem des Containers ist Linux, selbst wenn auf dem Host Darwin ausgeführt wird.
2. **Keine `cursor-agent`-Binärdatei** — Offizielle Pusula-Images enthalten
   `cursor-agent` nicht. „Verfügbare Modelle“ führte zuvor
   `cursor-agent --list-models` in einer Shell aus und griff ersatzweise auf einen statischen Katalog zurück.
3. **Falsche Binärdatei** — Binden Sie **keinen** macOS-`cursor-agent` in einen Linux-
   Container ein. Er kann dort nicht ausgeführt werden.

## Empfohlen: Mit Cursor anmelden

1. Öffnen Sie **Dashboard → Anbieter → Cursor**.
2. Wählen Sie den Tab **Mit Cursor anmelden**.
3. Klicken Sie auf **Mit Cursor anmelden** — Pusula öffnet
   `https://cursor.com/loginDeepControl?…` im Browser Ihres **Hosts**.
4. Bestätigen Sie die Anmeldung im Browser und kehren Sie anschließend zum Dashboard zurück. Pusula
   fragt `api2.cursor.sh/auth/poll` ab, bis die Token eintreffen.
5. Pusula speichert **Zugriffs- und Aktualisierungs-Token** und aktualisiert sie über
   `https://api2.cursor.sh/auth/exchange_user_api_key`.

Dieser Weg erfordert weder Cursor IDE noch `cursor-agent` innerhalb des Containers.

## Modellerkennung

Bei einer angemeldeten Verbindung bevorzugt **Verfügbare Modelle / Automatische Synchronisierung** den
HTTP-Katalog `AiService/AvailableModels` von Cursor unter Verwendung des Bearer-Tokens der Verbindung.
Falls dies fehlschlägt, versucht Pusula weiterhin, den `cursor-agent` des Hosts zu verwenden (sofern vorhanden), und greift danach
auf den statischen Registry-Ausgangsbestand zurück.

Pusula stellt im Katalog immer **`auto`** bereit (Anzeige „Auto“), zusätzlich zu den
OpenCodex-artigen Routermodi **`auto-cost`**, **`auto-balance`** und
**`auto-intelligence`**. Bei der Übertragung werden diese dem Cursor-Modell `default`
zugeordnet (mit einem `optimization`-ModelParameter für die drei Varianten). Bevorzugen Sie
`cu/auto`, wenn die Nutzung der Premium-Modelle ausgeschöpft ist — Auto verfügt häufig noch über Kontingent.

### Der Live-Katalog ist nach der Synchronisierung exklusiv

Nach einer erfolgreichen Cursor-Modellsynchronisierung (`cursor-agent --list-models` → dauerhaft gespeicherter
synchronisierter Katalog oder der oben beschriebene, per Bearer authentifizierte Abruf von `AvailableModels`) führen
das **Dashboard**, **`/v1/models`** und **Alle testen** Folgendes auf:

1. Von der Live-Synchronisierung zurückgegebene Modelle
2. Hinzugefügte Auto-Router-IDs: `auto`, `auto-cost`, `auto-balance`, `auto-intelligence`
3. **Benutzerdefinierte** Modelle des Betreibers (Import / manuell) — werden durch die Synchronisierung niemals entfernt

Die umfangreiche statische Registry unter
`open-sse/config/providers/registry/cursor/` dient **nur als Offline-Ausweichlösung**. Wenn
die synchronisierte Liste leer ist (oder die Erkennung fehlschlägt), greift die Auflistung auf diese Registry zurück.

IDs mit Aufwands-Suffix (zum Beispiel `claude-4.6-sonnet-high`) können zur Laufzeit weiterhin
**angefordert** werden: `resolveRequestedModel` entfernt das Suffix und überführt es in einen
`ModelParameter` für die Übertragung. Die exklusive Auflistung blendet diese statischen Varianten absichtlich
aus „Alle testen“ aus, damit die Prüfungen den Modellen entsprechen, die Cursor tatsächlich als verfügbar zurückgibt.

### Hilfsfunktionen

- `providerUsesExclusiveSyncedListing("cursor"|"cu")` —
  `src/lib/providers/modelListingCapability.ts`
- `mergeProviderModelListing` — Zusammenführung für das Dashboard
- `ensureCursorAutoCatalogEntry` — Einfügen von auto* bei Erkennung und Auflistung
- `shouldSuppressStaticModelForExclusiveListing` — statische Schleife von `/v1/models`

## Anbieterlimits (Kontingent)

**Nutzung → Anbieterlimits** verwendet für Cursor Bearer-APIs auf `api2.cursor.sh`
(`GetCurrentPeriodUsage` → Nutzungsübersicht → auth/usage) nach PKCE oder Token-
Import. Der veraltete Dashboard-Weg über Cookies/`cursor.com` bleibt als letzte Ausweichlösung
für ältere, aus der IDE importierte Sitzungen bestehen.

Die Zeitfenster umfassen üblicherweise **Gesamt**, **Auto + Composer** und **API**. Wenn
die Limits leer erscheinen, führen Sie **Mit Cursor anmelden** erneut aus oder importieren Sie die Token erneut (ein IDE-Import
allein ist nicht mehr erforderlich).

## Leere Durchläufe / Nutzung ausgeschöpft

Wenn Cursor einen Lauf akzeptiert, aber keinen Assistententext zurückgibt (was häufig vorkommt, wenn die Premium-
Nutzung ausgeschöpft ist), zeigt Pusula einen handlungsorientierten **429**-Fehler (Kontingenthinweise) oder
**502**-Fehler mit Hinweisen an — nicht lediglich „Anbieter hat leeren Inhalt zurückgegeben“. Streaming-
Fehler wie `not_found: AI Model Not Found` (Nutzungszeitfenster ausgeschöpft) werden als
**Cursor-Ratenlimit / Nutzung überschritten** klassifiziert und behalten diese Meldung
über die gesamte SSE-Pipeline hinweg bei (die gemeinsame Schutzprüfung für leere Streams überschreibt keinen
bereits ausgegebenen Fehler). Prüfen Sie die Anbieterlimits, versuchen Sie das Modell **`auto`** oder erhöhen Sie
die Limits Ihres Cursor-Tarifs.

## Clientversion (headless)

Ohne eine lokale `cursor-agent`-Installation ermittelt Pusula
`x-cursor-client-version` zunächst über die Umgebungsvariable `CURSOR_AGENT_CLI_VERSION`, dann über einen auf dem Datenträger zwischengespeicherten
Abruf des Cursor-Installationsskripts und schließlich über eine fest vorgegebene Build-ID. Überschreiben Sie den Wert bei
Bedarf mit `CURSOR_AGENT_CLI_VERSION`.

## Ausweichlösung: Manueller Token-Import

Wenn Sie die Browseranmeldung nicht abschließen können:

1. Extrahieren Sie auf dem Host die Token aus `state.vscdb`:

   ```bash
   sqlite3 "$HOME/Library/Application Support/Cursor/User/globalStorage/state.vscdb" \
     "SELECT key, value FROM ItemTable WHERE key IN ('cursorAuth/accessToken','cursorAuth/refreshToken','storage.serviceMachineId');"
   ```

2. Öffnen Sie **Token importieren** im Cursor-Authentifizierungsdialog.
3. Fügen Sie das **Zugriffs-Token** und, sofern verfügbar, das **Aktualisierungs-Token** ein (für die
   automatische Aktualisierung erforderlich). Die Maschinen-ID ist optional.

Importe, die nur ein Zugriffs-Token enthalten, funktionieren weiterhin, laufen jedoch ohne Aktualisierungs-Token ab —
importieren Sie erneut, wenn der Chat Authentifizierungsfehler zurückgibt.

## Verwandte Themen

- Zed-Docker-Anleitung: [`docs/providers/ZED-DOCKER.md`](./ZED-DOCKER.md)
- OpenCodex-Referenz zur Cursor-Anmeldung (extern):
  https://github.com/lidge-jun/opencodex/blob/main/src/oauth/cursor.ts
