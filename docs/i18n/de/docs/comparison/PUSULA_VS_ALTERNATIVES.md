# Pusula vs Alternatives (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../comparison/PUSULA_VS_ALTERNATIVES.md) · 🇮🇷 [fa](../../../fa/docs/comparison/PUSULA_VS_ALTERNATIVES.md) · 🇹🇷 [tr](../../../tr/docs/comparison/PUSULA_VS_ALTERNATIVES.md)

---

Objektiver Funktionsvergleich mit beliebten Open-Source-KI-Routern.

> **Methodik**: Öffentliche Repositories wurden im 2. Quartal 2026 geprüft. Versionen wie angegeben.
> Reichen Sie Korrekturen per PR ein — uns ist wichtig, dass diese Angaben korrekt sind.

| Funktion                                                       |                 Pusula 3.8                  |    LiteLLM 1.x    | OpenRouter (SaaS) |      Portkey       |
| -------------------------------------------------------------- | :-----------------------------------------: | :---------------: | :---------------: | :----------------: |
| **Anbieter**                                                   |                   **329**                   |       ~100        |        ~50        |        ~30         |
| **Kostenlose/ohne Authentifizierung nutzbare Katalogeinträge** |                   **155**                   |       k. A.       |   Weiterleitung   |       k. A.        |
| **Selbst hostbar**                                             |                     ✅                      |        ✅         |        ❌         | ⚠ kostenpflichtig  |
| **OAuth-Katalogeinträge**                                      |                   **23**                    |     teilweise     |        ❌         |         ❌         |
| **Automatische Fallback-Kombinationen**                        |              **19 Strategien**              | prioritätsbasiert |   stufenbasiert   |     gewichtet      |
| **Fusion (paralleles Panel + Judge-Synthese)**                 |                     ✅                      |        ❌         |        ❌         |         ❌         |
| **Tier-1/2/3-Fallback (Abonnement→günstig→kostenlos)**         |                   ✅ + UI                   |      manuell      |       k. A.       |      manuell       |
| **Token-Komprimierung**                                        | 12-Engine-Stack (RTK + Caveman + LLMLingua) |       keine       |       keine       |       keine        |
| **Multimodale Generierung (Sprache/Musik/Video)**              |                     ✅                      |        ❌         |   Weiterleitung   |         ❌         |
| **Integrierter MCP-Server**                                    |           ✅ 110 Tools, 33 Scopes           |        ❌         |        ❌         |         ❌         |
| **A2A-Protokoll**                                              |              ✅ 6 Fähigkeiten               |        ❌         |        ❌         |         ❌         |
| **Speicher (FTS5 + Vektor)**                                   |                     ✅                      |        ❌         |        ❌         |         ❌         |
| **Schutzmechanismen (PII, Injection, Bildverarbeitung)**       |                     ✅                      |     teilweise     |        ❌         | ✅ kostenpflichtig |
| **Cloud-Agent-Integrationen**                                  |         Codex, Cursor, Devin, Jules         |        ❌         |        ❌         |         ❌         |
| **Circuit Breaker pro Anbieter**                               | ✅ 3 Zustände, verzögerte Wiederherstellung |    grundlegend    |        ❌         |         ✅         |
| **TLS-Fingerprint-Tarnung (JA3/JA4)**                          |                 ✅ wreq-js                  |        ❌         |        ❌         |         ❌         |
| **Evaluierungsframework**                                      |                ✅ integriert                |        ❌         |        ❌         | ⚠ kostenpflichtig  |
| **MITM-Proxy (fängt Cursor/Antigravity ab)**                   |          ✅ plattformübergreifend           |        ❌         |        ❌         |         ❌         |
| **CLI mit System-Tray (ohne Electron)**                        |                     ✅                      |        ❌         |       k. A.       |       k. A.        |
| **Automatische CLI-Authentifizierung per Maschinen-ID**        |                     ✅                      |        ❌         |       k. A.       |       k. A.        |
| **Dashboard**                                                  |                 Next.js 16                  |    grundlegend    |    proprietär     |     proprietär     |
| **i18n**                                                       |                **4 Locales**                |        ❌         |        ❌         |         ⚠          |
| **Öffentliche Agent-Fähigkeiten (SKILL.md)**                   |                    ✅ 45                    |        ❌         |        ❌         |         ❌         |
| **Tunnel-Unterstützung (Cloudflared, Tailscale, Ngrok)**       |                     ✅                      |        ❌         |       k. A.       |       k. A.        |
| **Lizenz**                                                     |                     MIT                     |        MIT        |    proprietär     |     proprietär     |

## Wann Sie Pusula wählen sollten

- Sie hosten selbst und möchten **maximale Anbieterabdeckung** (374 Anbieter, 155 kostenlose Katalogeinträge ohne Authentifizierung)
- Sie benötigen einen **integrierten MCP-Server** (LLM-Tools, Speicher und Fähigkeiten werden als Tools bereitgestellt)
- Sie benötigen das **A2A-Protokoll** für Agent-zu-Agent-Workflows
- Sie möchten **Fingerabdruckverschleierung** (JA3/JA4), um die Erkennung durch vorgelagerte CAPTCHAs zu vermeiden
- Sie benötigen **Enterprise-Funktionen** (Leitplanken, Evaluierungen, Audit-Trail) ohne SaaS-Rechnung

## Wann Sie LiteLLM wählen sollten

- Sie setzen **primär auf Python** und benötigen eine enge Integration mit `litellm.completion()`
- Sie benötigen **ausgereifte Bereitstellungsrezepte für den Produktivbetrieb** (k8s, Helm-Charts)
- Ihr Team betreibt bereits Python-Microservices

## Wann Sie OpenRouter (SaaS) wählen sollten

- Sie möchten nicht selbst hosten
- Sie sind bereit, pro Token einschließlich SaaS-Aufschlag zu bezahlen
- Sie benötigen eine **einzige Zahlungsmethode** für alle Anbieter

## Wann Sie Portkey wählen sollten

- Sie benötigen ein **kommerzielles SLA** mit Verfügbarkeitsgarantien
- Sie bevorzugen ein **verwaltetes Dashboard** ohne Betriebsaufwand
- Sie benötigen sofort einsatzbereite **Enterprise-Compliance-Funktionen**

---

_Zuletzt aktualisiert: 2026-08-02. Reichen Sie Korrekturen per PR ein, damit diese Tabelle korrekt bleibt._
