# Relay Troubleshooting (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/RELAY_TROUBLESHOOTING.md) · 🇮🇷 [fa](../../../fa/docs/reference/RELAY_TROUBLESHOOTING.md) · 🇹🇷 [tr](../../../tr/docs/reference/RELAY_TROUBLESHOOTING.md)

---

Relays (Vercel, Deno, Cloudflare) beenden die Upstream-Verbindung auf einem
serverlosen Backend, sodass Pusula den ausgehenden Datenverkehr über eine stabile Region
leiten kann, während der API-Schlüssel des Anbieters serverseitig verbleibt. Dieses Dokument behandelt die beiden Fehlerfälle,
die im Produktionsbetrieb auftreten, sowie die von Pusula jeweils bereitgestellten
Wiederherstellungsverfahren.

## Speicherung der Relay-Authentifizierung

Wenn Sie ein Relay über **Einstellungen → Proxy-Pool → Relay bereitstellen** bereitstellen,
speichert der Bereitstellungsprozess das Authentifizierungstoken des Relays im JSON-Feld `notes`
des Proxys:

- Wenn `STORAGE_ENCRYPTION_KEY` gesetzt ist, wird das Token als `relayAuthEnc`
  gespeichert (im Ruhezustand mit AES verschlüsselt).
- Andernfalls wird es als Klartext in `relayAuth` gespeichert.

Zum Zeitpunkt der Anfrage gibt `extractRelayAuth(notes)` die jeweils vorhandene Form zurück,
sodass das Relay auch nach Neustarts weiter funktioniert.

## Fehlerfall 1 — Token kann nach Schlüsselrotation nicht entschlüsselt werden

**Symptom:** Relays, die zuvor funktioniert haben, geben nun Upstream-`401`- bzw.
Authentifizierungsfehler zurück, nachdem `STORAGE_ENCRYPTION_KEY` in der Umgebung
oder im Secret-Manager rotiert wurde. Der gespeicherte `relayAuthEnc`-Blob kann nicht mehr
entschlüsselt werden, sodass `extractRelayAuth` eine leere Zeichenfolge zurückgibt und das Relay
keine Authentifizierungsdaten sendet.

**Wiederherstellung — direkt reparieren (keine erneute Bereitstellung):**

1. Öffnen Sie **Einstellungen → Proxy-Pool**.
2. Relay-Zeilen, bei denen die Authentifizierung fehlt, zeigen ein gelbes Badge `Authentifizierung fehlt` und eine
   Schaltfläche **Reparieren** an.
3. Klicken Sie auf **Reparieren**. Pusula ruft
   `POST /api/settings/proxies/[id]/repair-relay` auf. Dabei wird:
   - `relayAuthEnc` mit dem **aktuellen** Schlüssel entschlüsselt,
   - der Klartext `relayAuth` wieder in `notes` geschrieben,
   - `{ repaired: true, mode: "recovered" }` zurückgegeben.

Das Relay nimmt den Betrieb wieder auf, ohne dass Anmeldedaten für die Bereitstellung erneut eingegeben werden müssen.

Dies funktioniert nur, wenn der aktuelle `STORAGE_ENCRYPTION_KEY` den Blob weiterhin entschlüsseln
kann. Wenn Sie den Schlüssel **ohne** Migration rotiert haben, kann der Blob nicht
wiederhergestellt werden.

## Fehlerfall 2 — nicht wiederherstellbares Token (alter Schlüssel nicht mehr verfügbar)

**Symptom:** Sie haben auf **Reparieren** geklickt und
`{ repaired: false, mode: "redeploy", status: 409 }` erhalten.

**Wiederherstellung — erneut bereitstellen:**

Das gespeicherte Token kann mit dem aktuellen Schlüssel nicht wiederhergestellt werden. Stellen Sie das Relay
über denselben Dialog erneut bereit, den Sie ursprünglich verwendet haben (Menü **Relay bereitstellen** → Vercel / Deno
/ Cloudflare). Der Bereitstellungsprozess speichert ein neues Token (mit dem aktuellen
Schlüssel verschlüsselt), und das Badge `Authentifizierung fehlt` in der Zeile wird ausgeblendet.

In der Benutzeroberfläche öffnet die Schaltfläche **Reparieren** selbst den Dialog für die erneute Bereitstellung, wenn das
Token nicht wiederhergestellt werden kann, sodass Sie nicht manuell danach suchen müssen.

## Fehlerfall 3 — Relay erreichbar, aber fehlerhaft

**Symptom:** Der Proxy-Test (Schaltfläche `speed`) zeigt an, dass das Relay erreichbar ist, aber Anfragen
schlagen weiterhin sporadisch fehl.

Prüfen Sie die von Pusulas automatischer Testanfrage zurückgegebenen Relay-Status-Header
(siehe **Einstellungen → Proxy-Pool** und die Zähler `relayTested` / `relayAlive`):

- `x-relay-url` — welches Relay-Backend geantwortet hat.
- `x-relay-mode` — `ts` | `bifrost` | `auto` für diese Anfrage.
- `x-relay-attempts` — wie viele Relay-Stationen vor dem Erfolg versucht wurden.
- `x-relay-fallback` — `true`, wenn die Anfrage vom bevorzugten
  Backend auf das TypeScript-Relay zurückgefallen ist.

Eine hohe `x-relay-fallback`-Rate bei einem niedrigen `relayAlive`-Wert bedeutet, dass das Sidecar-
Backend fehlerhaft ist. Sie sollten es entweder reparieren oder die Relay-Backend-
Strategie auf `ts` umstellen (siehe `RELAY_BACKEND_STRATEGY.md`).

## API-Referenz

| Methode | Pfad                                      | Body                    | Erfolg                                                                                                                                           | Fehler                                                                                         |
| ------- | ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `POST`  | `/api/settings/proxies/[id]/repair-relay` | `{ "id": "<proxyId>" }` | `200 { repaired: true, mode: "recovered" }` bei erneuter Ableitung; `200 { repaired: false, mode: "noop" }`, wenn bereits Klartext vorhanden ist | `409 { mode: "redeploy" }` nicht wiederherstellbar; `400` kein Relay-Typ; `404` nicht gefunden |

Die Listenroute `GET /api/settings/proxies` fügt jedem Element ein geheimnisfreies
`relayInfo: { isRelay, authMissing, repairMode }` hinzu, sodass das Dashboard
die Reparaturoption darstellen kann, ohne jemals das Token offenzulegen.
