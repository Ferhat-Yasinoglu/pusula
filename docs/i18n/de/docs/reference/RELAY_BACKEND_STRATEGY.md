# Relay Backend Strategy (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/RELAY_BACKEND_STRATEGY.md) · 🇮🇷 [fa](../../../fa/docs/reference/RELAY_BACKEND_STRATEGY.md) · 🇹🇷 [tr](../../../tr/docs/reference/RELAY_BACKEND_STRATEGY.md)

---

## Zusammenfassung

Pusula unterstützt jetzt drei Relay-Modi für `/api/v1/relay/chat/completions`:

- `ts`: Verwendet das TypeScript-Relay innerhalb des Prozesses.
- `bifrost`: Erzwingt die Verwendung des Bifrost-Gateways.
- `auto`: Bevorzugt Bifrost, wenn verfügbar, und fällt bei einem Fehler auf TypeScript zurück.

Bei einer hohen Anfragerate (große Anzahl von Tokens pro Tag, nahezu konstanter Durchsatz) besteht die beste Strategie darin, den Fallback-Pfad explizit und schnell zu halten, damit der Hauptpfad niemals durch einen ausgefallenen Sidecar blockiert wird.

## Verhalten der Modi

- `ts`
  - Geringste betriebliche Komplexität.
  - Das gesamte Routing und die gesamte Validierung werden in Node ausgeführt.
  - Keine Sidecar-Abhängigkeit für die Verfügbarkeit.
- `bifrost`
  - Erzwingt die Weiterleitung aller Anfragen über das Sidecar-Gateway.
  - Kein automatischer Fallback.
  - Nur sinnvoll, wenn Zustand und Latenz des Sidecars garantiert sind.
- `auto`
  - Der Sidecar wird verwendet, wenn er erreichbar und aktiviert ist.
  - Fehlgeschlagene Versuche lösen Fallback-Header aus und leiten den Datenverkehr zurück an TS, sodass der Anfrageerfolg innerhalb definierter Grenzen bleibt.
  - Dieser Modus ist die sicherste Wahl für den Produktivbetrieb, wenn die Verfügbarkeit wichtiger ist als ein striktes Routing ausschließlich über den Sidecar.

## 9router und CLIPROXYAPI im aktuellen Vergleich

9router und CLIPROXYAPI sind beides Integrationen, die traditionell Kompatibilitätspfade für Upstream-Provider bereitgestellt haben.

- 9router ist ein eingebetteter Pfad für die Upstream-Orchestrierung und das Kompatibilitätsverhalten.
- CLIPROXYAPI ist eine Proxy-API-Brücke für Datenverkehr im CLI-/SDK-Stil.
- Bifrost wird als externalisierter Pfad stabilisiert, wenn ein dedizierter Sidecar-ähnlicher Hop und eine lokale Weiterleitung mit geringer Latenz benötigt werden.

Wenn Sie derzeit 9router und CLIPROXYAPI vergleichen:

- Belassen Sie die Anfragesignierung, Allowlist-Prüfungen und DB-Richtlinienprüfungen vor der Übergabe in der API-Route.
- Wenn ein Workflow ein striktes Sidecar-Verhalten und eine geringere Varianz pro Anfrage erfordert, verwenden Sie `PUSULA_RELAY_BACKEND=bifrost`.
- Wenn Sie Sidecar-Resilienz mit kontrollierter Leistungsreduzierung unter Störungsbedingungen benötigen, verwenden Sie `PUSULA_RELAY_BACKEND=auto`.

## Vertrag der Backend-Grenze

Die stabile Produktgrenze ist die Pusula-Relay-API, nicht die Dashboard-Implementierung. Das Next.js-Dashboard kann lokale Dienste installieren, konfigurieren und überwachen, aber das Anfrage-Routing sollte über die Relay-API erfolgen und hinter dieser Grenze übergeben werden.

Langfristige Backend-Optionen:

- Behalten Sie das TypeScript-Relay als prozessinternen Richtlinien- und Fallback-Pfad bei. Authentifizierung, Allowlists, Anfragenormalisierung, Abrechnung und Sicherheitsprüfungen verbleiben hier, bevor eine Übergabe an ein Backend erfolgt.
- Verwenden Sie Bifrost als bevorzugten Tier-1-Sidecar mit hohem Durchsatz, wenn die Bereitstellung eine geringere Routing-Varianz, eine zentralisierte Provider-Rotation oder eine horizontale Skalierung über mehrere Pusula-Replikate hinweg erfordert.
- Behalten Sie 9router und CLIPROXYAPI als eingebettete Kompatibilitätsdienste bei. Sie werden als überwachte lokale Prozesse ausgeführt und sind sinnvoll, wenn ihr Provider-/CLI-Verhalten dem gewünschten Adapter entspricht. Sie sollten jedoch nicht zur standardmäßigen Tier-1-Routing-Engine werden.
- Lassen Sie das Dashboard keine beliebigen Service-URLs an den Hauptpfad übergeben. Von der Benutzeroberfläche bereitgestellte URLs sind Konfigurationseingaben. Der Routing-Code sollte registrierte, zustandsgeprüfte Backends anhand serverseitiger Einstellungen und des Supervisor-Status auflösen.
- Bevorzugen Sie derzeit Loopback-HTTP für überwachte Dienste, da die verwalteten Prozesse bereits HTTP-kompatible APIs bereitstellen, der Route-Guard die Grenze prüfen kann und das Fehler-/Fallback-Verhalten in den Anfragelogs sichtbar ist. Ein zukünftiger SDK- oder Socket-Transport lohnt sich nur, wenn er die p99-Routing-Latenz messbar reduziert, ohne die Isolation oder die Fallback-Semantik zu schwächen.

Für eine Bereitstellung mit sehr hohem Durchsatz lautet die Standardempfehlung daher `auto` mit aktiviertem Bifrost: Verwenden Sie den Go-Sidecar auf dem Hauptpfad und behalten Sie gleichzeitig den TypeScript-Fallback für eine hohe Erfolgsquote bei. Verwenden Sie `bifrost` nur, wenn ein striktes Sidecar-exklusives Verhalten wichtiger ist als eine kontrollierte Leistungsreduzierung.

## Empfehlungen für hohen Durchsatz

Für dauerhaft hohe RPM/RPS und ein striktes Erfolgs-SLO:

1. Verwenden Sie `auto` mit einer angemessenen Cooldown-Zeit und Fehlertelemetrie.
2. Belassen Sie die Upstream-Validierung und API-Schlüsselprüfungen an der Grenze der TypeScript-Route.
3. Aktivieren Sie explizite Header/Zähler, damit Ihr Alerting die Fallback-Häufigkeit und deren Ursachen erfasst.
4. Konfigurieren Sie Sidecar-Timeouts so, dass Fehler schnell gemeldet werden, anstatt unbegrenzt zu warten.
5. Halten Sie den automatischen Neustart des Dienstes und die Telemetrieschleife zur Zustandsüberwachung funktionsfähig, damit Fallbacks tatsächlich die Ausnahme bleiben.

## Empfohlene Basiskonfiguration

- `PUSULA_RELAY_BACKEND=auto`
- `BIFROST_ENABLED=1`
- Lassen Sie API-Schlüssel-, Allowlist-, Sanitizer- und Ratenbegrenzungsprüfungen in den Route-Handlern aktiviert; sie werden immer vor der Weiterleitung an nachgelagerte Systeme ausgeführt.
- Exportieren Sie Fallback-Metriken aus Ihrem Reverse-Proxy und den Anfragelogs, damit Sidecar-Ausfälle innerhalb einer Minute sichtbar werden.

## Vertrag für Provider-Plugins

Sidecars sollten Provider-Metadaten über das JSON-sichere Provider-Plugin-Manifest importieren, anstatt von den Interna des TypeScript-Executors abhängig zu sein. Informationen zum Vertrag für die Sidecar-Eignung und zu den Migrationsphasen finden Sie unter [Provider-Plugin-Manifest](./PROVIDER_PLUGIN_MANIFEST.md).
