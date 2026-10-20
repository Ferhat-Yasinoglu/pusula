# README (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../README.md) · 🇮🇷 [fa](../fa/README.md) · 🇹🇷 [tr](../tr/README.md)

---

<div align="center">

<img src="./docs/screenshots/MainPusula.png" alt="Pusula Dashboard" width="820"/>

<br/>
<br/>

# 🧭 Pusula — Das kostenlose KI-Gateway

<img src="./docs/diagrams/readme-hero.svg" width="100%" alt="Pusula — Hören Sie nie auf zu programmieren. Jedes KI-Tool → 358 Anbieter — 150+ kostenlos — über einen Endpunkt. Claude Code, Codex, Cursor, Cline, Copilot & Antigravity in KOSTENLOSES Claude / GPT / Gemini mit automatischem Fallback. RTK + Caveman gestapelte Komprimierung spart 15–95% Tokens (~89% im Durchschnitt) — nie wieder Limits erreichen. 358 KI-Anbieter · 150+ kostenlose Stufen · ~1,62 Mrd. kostenlose Tokens/Monat · 19 Routing-Strategien · $0 zum Start."/>

</div>

<div align="center">

## 💰 ~1,62 Mrd. kostenlose Tokens / Monat

</div>

> Kostenlose Kontingente manuell zu kombinieren ist mühsam — Dutzende SDKs, Dutzende Ratenbegrenzungen und keine Ahnung, wie viel tatsächlich verfügbar ist. Pusula katalogisiert **489 Einträge mit kostenlosen Kontingenten über 35 wiederkehrende Pool-Schlüssel hinweg** und berechnet die angegebene Token-Gesamtmenge aus den **17 Pools mit einem veröffentlichten positiven monatlichen Budget sowie fünf modellspezifischen Groq-Obergrenzen**, wobei gemeinsam genutzte Pools dedupliziert werden. Kontingente, die erst nach einer regionalen Identitätsprüfung verfügbar werden (derzeit: ModelScope), werden separat ausgewiesen — +~6 Mio. hinter einer regionalen Identitätsprüfung — und niemals in die Gesamtangabe einbezogen. Das Ergebnis bleibt im Dashboard (`/dashboard/free-tiers`) sichtbar.

<img src="./docs/diagrams/free-tier-budget.svg" width="100%" alt="Pusula-Karte für kostenlose Kontingente: dauerhaft ~1,62 Mrd. kostenlose Tokens pro Monat, im ersten Monat mit Registrierungsguthaben bis zu ~2,22 Mrd., aus 35 dokumentierten wiederkehrenden Pool-Schlüsseln, die 489 katalogisierte Einträge mit kostenlosen Kontingenten hinter einem einzigen Endpunkt abdecken. Ehrliche, nach Pools deduplizierte Berechnung — jeder gemeinsam genutzte Pool wird nur einmal gezählt, einschließlich 17 wiederkehrender Pools mit einem veröffentlichten positiven monatlichen Token-Budget sowie fünf modellspezifischen Groq-Obergrenzen; 13 Anbieter sind im Katalog für Nutzungsbedingungen-Risiken als zu vermeiden gekennzeichnet, damit du selbst entscheiden kannst. Der Budgetbalken umfasst Mistral 1 Mrd., Nara 210 Mio., LLM7 150 Mio., xKiro 150 Mio., Groq 30 Mio. (fünf modellspezifische Obergrenzen) und kleinere Pools sowie Registrierungsguthaben für den ersten Monat; dauerhaft kostenlose Anbieter ohne Token-Obergrenze werden separat angezeigt, damit sie die Gesamtangabe niemals künstlich erhöhen. Live-Anzeige von verbrauchten/verbleibenden Tokens unter /dashboard/free-tiers."/>

> Animierte Zusammenfassung der Live-Seite `/dashboard/free-tiers`. Vollständige Methodik (Pool-Deduplizierung, Guthabenstufen, Nutzungsbedingungen der Anbieter): **[docs/reference/FREE_TIERS.md](docs/reference/FREE_TIERS.md)**.
>
> <sub>Diese Zahlen werden alle zwei Wochen anhand des Live-Katalogs erneut geprüft und **können in beide Richtungen schwanken** — beendet ein Anbieter sein kostenloses Kontingent, sinkt die Zahl; kommt ein neues hinzu, steigt sie. Wir veröffentlichen, was der Katalog tatsächlich berechnet, niemals einen aufgerundeten Bestfall.</sub>

<br/>

<div align="center">

<h3>

⭐ Gib dem Repository einen Stern, wenn PUSULA dir geholfen hat, Geld zu sparen und deine Arbeit zu erleichtern.

</h3>

[![Sterne](https://img.shields.io/github/stars/Ferhat-Yasinoglu/pusula?style=social)](https://github.com/Ferhat-Yasinoglu/pusula)

### 💬 Fragen & Support

[![GitHub Issues](https://img.shields.io/badge/GitHub-Issues-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ferhat-Yasinoglu/pusula/issues)
[![GitHub Discussions](https://img.shields.io/badge/GitHub-Discussions-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ferhat-Yasinoglu/pusula/discussions)

**Fehler melden und Fragen stellen → [GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues) · Ideen, Anbietertipps und Austausch → [GitHub Discussions](https://github.com/Ferhat-Yasinoglu/pusula/discussions)**

<br/>

## 🧩 Verfügbar

[![npm-Version](https://img.shields.io/npm/v/pusula?color=cb3837&logo=npm)](https://www.npmjs.com/package/pusula)
![NPM monatlich](https://img.shields.io/npm/dm/pusula?label=npm/month&color=cb3837&logo=npm)
[![GHCR](https://img.shields.io/badge/GHCR-ghcr.io%2Fferhat--yasinoglu%2Fpusula-2496ED?logo=docker&logoColor=white)](https://github.com/Ferhat-Yasinoglu/pusula/pkgs/container/pusula)
[![Lizenz: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Docker-Downloads](https://img.shields.io/docker/pulls/ferhat-yasinoglu/pusula?label=docker%20pulls&logo=docker&color=2496ED)
![Electron-Downloads](https://img.shields.io/github/downloads/ferhat-yasinoglu/pusula/total?style=flat&label=electron%20downloads&logo=electron&color=47848F)

<table>
  <tr>
    <td align="right"><b>🚀 Einstieg</b></td>
    <td align="center"><a href="#-quick-start">🚀 Schnellstart</a></td>
    <td align="center"><a href="#-more-install-methods--docker-source-pnpm-arch">📦 Installation</a></td>
    <td align="center"><a href="#-works-the-second-you-install-it--no-keys-no-config">🆓 Ohne Konfiguration</a></td>
  </tr>
  <tr>
    <td align="right"><b>💡 Mehr erfahren</b></td>
    <td align="center"><a href="#-the-promise">💥 Das Versprechen</a></td>
    <td align="center"><a href="#-why-pusula">🤔 Warum Pusula?</a></td>
    <td align="center"><a href="#-what-sets-pusula-apart">🏆 Was Pusula auszeichnet</a></td>
  </tr>
  <tr>
    <td align="right"><b>⚙️ Funktionen</b></td>
    <td align="center"><a href="#-combos--the-flagship">🎯 Combos</a></td>
    <td align="center"><a href="#-357-ai-providers--152-catalog-marked-free">🌐 Anbieter</a></td>
    <td align="center"><a href="#-full-cli--a2a--mcp">🔌 CLI &amp; MCP</a></td>
  </tr>
  <tr>
    <td align="right"></td>
    <td align="center"><a href="#%EF%B8%8F-save-1595-tokens--automatically">🗜️ Komprimierung</a></td>
    <td align="center"><a href="#%EF%B8%8F-where-pusula-runs--anywhere">🖥️ Ausführungsumgebungen</a></td>
    <td align="center"><a href="#-private--local-first">🔒 Privat</a></td>
  </tr>
  <tr>
    <td align="right"><b>🧰 Ökosystem</b></td>
    <td align="center"><a href="#-kompatible-clis--coding-agenten">🤖 Kompatible CLIs</a></td>
    <td align="center"><a href="#-community--hilfe">💬 Community &amp; Hilfe</a></td>
    <td align="center"><a href="#-mitwirken">👥 Mitwirken</a></td>
  </tr>
  <tr>
    <td align="right"><b>📦 Projekt</b></td>
    <td align="center"><a href="#%EF%B8%8F-tech-stack">🛠️ Technologie-Stack</a></td>
    <td align="center"><a href="#-documentation">📖 Dokumentation</a></td>
    <td align="center"><a href="#-lizenz">📄 Lizenz</a></td>
  </tr>
</table>

</div>

<div align="center">
  <b>🌐 In 4 Sprachen</b>
  <br/><br/>
  <a href="../../../README.md"><img src="../../assets/flags/us.svg" width="30" alt="English (en)" title="English (en)"></a>
  <a href="../tr/README.md"><img src="../../assets/flags/tr.svg" width="30" alt="Türkçe (tr)" title="Türkçe (tr)"></a>
  <a href="README.md"><img src="../../assets/flags/de.svg" width="30" alt="Deutsch (de)" title="Deutsch (de)"></a>
  <a href="../fa/README.md"><img src="../../assets/flags/ir.svg" width="30" alt="فارسی (fa)" title="فارسی (fa)"></a>
</div>

<br/>
<br/>

<div align="center">

## 🆓 Funktioniert sofort nach der Installation – keine Schlüssel, keine Konfiguration

</div>

<img src="./docs/diagrams/works-zero-config.svg" width="100%" alt="Funktioniert sofort nach der Installation – keine Konfiguration. Drei Schritte: 1. Installieren – npm i -g pusula, Server startet auf localhost:20128. 2. Richten Sie Ihr Tool auf http://localhost:20128/v1 aus – jedes OpenAI-kompatible Tool (Claude Code, Cursor, Cline). 3. Es antwortet – rufen Sie das Modell auto für eine sofortige Antwort auf, ohne API-Schlüssel, ohne Registrierung, ohne Konfiguration. Der schlüssellose Anbieter OpenCode Free ist bereits in die auto-Kombination integriert, sodass eine Neuinstallation sofort funktioniert."/>

```bash
# Neuinstallation, keine Anmeldeinformationen – `auto` funktioniert bereits:
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello!"}]}'
```

<sub>Bevorzugen Sie ein bestimmtes kostenloses Backend? Rufen Sie `oc/…` (OpenCode Free) direkt auf. Wechseln Sie dann zu `auto` und lassen Sie Pusula wählen.</sub>

<sub>📦 Copy-Paste-Schnellstart-Skripte für **Python, Node.js, PHP und cURL** → [`examples/quickstart/`](examples/quickstart/)</sub>

<br/>

<div align="center">

# 💥 Das Versprechen

</div>

<img src="./docs/diagrams/promise-pillars.svg" width="100%" alt="Das Versprechen – Ein Endpunkt und 358 Anbieter. Automatisches Fallback hält das Routing aufrecht, solange ein anderes funktionierendes Ziel verfügbar ist. Sechs Säulen: widerstandsfähiges Fallback über 358 Anbieter hinweg · bis zu 95 % Token-Einsparungen bei geeigneten Workloads · 0 $ Startkosten mit über 150 kostenlosen Stufen und 54 wiederkehrenden/schlüssellosen, dauerhaft kostenlosen Anbietern · 36 CLI-/Agenten-Integrationen über eine Konfiguration · OpenAI-, Claude-, Gemini- und Responses-API-Kompatibilität unter /v1 · Produktionskontrollen einschließlich Circuit Breaker, TLS-Stealth, MCP 110 Tools, A2A, Speicher, Guardrails, Evals und über 39.000 statische Testdeklarationen über mehr als 5.100 verfolgte Testdateien."/>

<br/>
<br/>

<div align="center">

# 🤔 Warum Pusula?

</div>

<img src="./docs/diagrams/why-pain-fix.svg" width="100%" alt="Warum Pusula – Schluss mit dem Jonglieren von 10 Dashboards, abgelaufenen API-Schlüsseln und unerwarteten Rechnungen. Zehn tägliche Probleme vs. Lösungen: ungenutzte Quoten laufen ab → Abonnements maximieren; Ratenbegrenzungen mitten im Coding → 4-stufiges Auto-Fallback (Abonnement → API → Günstig → Kostenlos); Tool-Ausgaben verbrennen Tokens → RTK + Caveman-Kompression (15–95 %); teure APIs → kostenoptimiertes Routing; jedes Tool hat seine eigene Einrichtung → ein Endpunkt, ein Dashboard; KI blockiert → 3-stuiger Proxy + TLS-Stealth; tote Schlüssel → 3-Schicht-Resilienz (Circuit Breaker, Schlüssel-Cooldown, Modell-Sperre); Team teilt ein Abonnement → Schlüsselpools mit Fair-Share-Quoten; Prompts über die Cloud eines anderen → Local-First mit AES-256-GCM verschlüsselten Schlüsseln; keine Ausgabentransparenz → Live-Analysen (Nutzung, Quote, Einsparungen, p95-Latenz)."/>

<div align="center">

<img src="./docs/diagrams/tier-cascade.svg" width="100%" alt="Pusula-Anfragefluss: Ihre IDE oder CLI (Claude Code, Cursor, Cline…) ruft einen lokalen Endpunkt auf (http://localhost:20128/v1); der Pusula Smart Router (RTK + Caveman-Kompression, 19 Routing-Strategien, Circuit Breaker, TLS-Stealth, MCP, A2A, Guardrails) kann über 4 Anbieterstufen hinweg zurückgreifen, solange ein geeignetes, funktionierendes Ziel verfügbar ist – Stufe 1 Abonnement, Stufe 2 API-Schlüssel, Stufe 3 Günstig und Stufe 4 Kostenlos."/>

</div>

<br/>

<div align="center">

## 🎯 Combos — Das Flaggschiff

</div>

<img src="./docs/diagrams/strategies-grid.svg" width="100%" alt="Alle 19 Combo-Routing-Strategien animiert — eine Kachel pro Strategie: priority, fill-first, weighted, round-robin, p2c, least-used, random, strict-random, cost-optimized, headroom, reset-window, reset-aware, context-relay, context-optimized, cache-optimized, lkgp, auto, fusion, pipeline. In der Tabelle oben steht, was die einzelnen Strategien bewirken."/>

> Ein **Combo** ist eine Kette von Modellen, zwischen denen Pusula **automatisch** routet. Wenn das Kontingent erschöpft ist, ein Anbieter ausfällt oder die Kosten sprunghaft steigen, kann das Combo zum nächsten geeigneten und funktionsfähigen Modell wechseln. 🛡️

### ⚡ Keine Konfiguration — einfach `auto` verwenden

Es muss kein Combo erstellt werden. Setze dein Modell auf `auto` (oder eine Variante), und Pusula erstellt aus deinen verbundenen Anbietern ein virtuelles Combo, das in Echtzeit bewertet wird:

<table>
  <tr><th align="left">Modell-ID</th><th align="left">Wofür es optimiert ist</th></tr>
  <tr><td align="left" nowrap><code>auto</code></td><td align="left">🎯 Ausgewogener Standard (LKGP — bleibt bei deinem letzten funktionierenden Anbieter)</td></tr>
  <tr><td align="left" nowrap><code>auto/coding</code></td><td align="left">🧑💻 Qualitätsorientierte Gewichtung für die Codegenerierung</td></tr>
  <tr><td align="left" nowrap><code>auto/fast</code></td><td align="left">⚡ Niedrigste Latenz zuerst</td></tr>
  <tr><td align="left" nowrap><code>auto/cheap</code></td><td align="left">💰 Niedrigste Kosten pro Token zuerst</td></tr>
  <tr><td align="left" nowrap><code>auto/offline</code></td><td align="left">🔋 Größter Spielraum bei Kontingenten und Ratenbegrenzungen zuerst</td></tr>
  <tr><td align="left" nowrap><code>auto/smart</code></td><td align="left">🔭 Qualität zuerst + 10 % Exploration, um bessere Modelle zu entdecken</td></tr>
  <tr><td align="left" nowrap><code>auto/lkgp</code></td><td align="left">📌 Explizite Bindung an den letzten bekanntermaßen funktionierenden Anbieter</td></tr>
  <tr><td align="left" nowrap><code>auto/chaos</code></td><td align="left">🧪 Gewichtung für Fehlerinjektion zur Resilienzprüfung (Chaos Engineering)</td></tr>
</table>

##

### 🔀 Oder erstelle dein eigenes — 19 Routing-Strategien

Alle **19** Strategien — pro Combo-Schritt frei kombinierbar:

<table>
  <tr>
    <th>#</th>
    <th align="left">Strategie</th>
    <th align="left">Funktionsweise</th>
  </tr>
  <tr>
    <td align="center">1</td>
    <td nowrap><code>priority</code></td>
    <td>Geordnete Liste mit bevorzugtem Ziel — jedes Ziel wird vor dem nächsten vollständig ausgeschöpft 🥇</td>
  </tr>
  <tr>
    <td align="center">2</td>
    <td nowrap><code>fill-first</code></td>
    <td>Das Kontingent jedes Ziels vollständig ausschöpfen, bevor zum nächsten gewechselt wird</td>
  </tr>
  <tr>
    <td align="center">3</td>
    <td nowrap><code>weighted</code></td>
    <td>Gewichtete Zufallsauswahl anhand der Gewichtung pro Ziel</td>
  </tr>
  <tr>
    <td align="center">4</td>
    <td nowrap><code>round-robin</code></td>
    <td>Ziele der Reihe nach durchlaufen</td>
  </tr>
  <tr>
    <td align="center">5</td>
    <td nowrap><code>p2c</code></td>
    <td>Zufälliger Lastenausgleich nach dem „Power of Two Choices“-Prinzip</td>
  </tr>
  <tr>
    <td align="center">6</td>
    <td nowrap><code>least-used</code></td>
    <td>Das Ziel mit der aktuell geringsten Auslastung auswählen</td>
  </tr>
  <tr>
    <td align="center">7</td>
    <td nowrap><code>random</code></td>
    <td>Gleichverteilte Zufallsauswahl (ohne Duplikate)</td>
  </tr>
  <tr>
    <td align="center">8</td>
    <td nowrap><code>strict-random</code></td>
    <td>Zufallsauswahl, ohne Wiederholungen zu entfernen 🎲</td>
  </tr>
  <tr>
    <td align="center">9</td>
    <td nowrap><code>cost-optimized</code></td>
    <td>Kosten pro Anfrage anhand aktueller Katalogpreise minimieren 💸</td>
  </tr>
  <tr>
    <td align="center">10</td>
    <td nowrap><code>headroom</code></td>
    <td>Das Ziel mit dem größten verbleibenden Kontingent auswählen</td>
  </tr>
  <tr>
    <td align="center">11</td>
    <td nowrap><code>reset-window</code></td>
    <td>Das Ziel bevorzugen, dessen Kontingentfenster am frühesten zurückgesetzt wird</td>
  </tr>
  <tr>
    <td align="center">12</td>
    <td nowrap><code>reset-aware</code></td>
    <td>Nach dem Zeitpunkt der Kontingent-Rücksetzung priorisieren — kurze Zeitfenster zuerst 📊</td>
  </tr>
  <tr>
    <td align="center">13</td>
    <td nowrap><code>context-relay</code></td>
    <td>Kontext bei langen Unterhaltungen zwischen Zielen übergeben 🧠</td>
  </tr>
  <tr>
    <td align="center">14</td>
    <td nowrap><code>context-optimized</code></td>
    <td>Das am besten zur aktuellen Kontextgröße passende Ziel auswählen</td>
  </tr>
  <tr>
    <td align="center">15</td>
    <td nowrap><code>cache-optimized</code></td>
    <td>Jedes wiederverwendbare Prompt-Präfix demselben Konto zuordnen — Treffer im Prompt-Cache maximieren 🎯</td>
  </tr>
  <tr>
    <td align="center">16</td>
    <td nowrap><code>lkgp</code></td>
    <td>Last-Known-Good Path — bindet Anfragen an den letzten erfolgreichen Anbieter und greift anschließend auf Regeln zurück</td>
  </tr>
  <tr>
    <td align="center">17</td>
    <td nowrap><code>auto</code></td>
    <td>Echtzeitbewertung aller Verbindungen anhand von 16 Faktoren 🤖</td>
  </tr>
  <tr>
    <td align="center">18</td>
    <td nowrap><code>fusion</code></td>
    <td>Anfragen parallel an ein Modellgremium senden; ein Bewertungsmodell fasst die Ergebnisse zu einer Antwort zusammen 🧬</td>
  </tr>
  <tr>
    <td align="center">19</td>
    <td nowrap><code>pipeline</code></td>
    <td>Schritte verketten — die Ausgabe jedes Ziels dient als Eingabe für das nächste 🔗</td>
  </tr>
</table>

<sub>Die Auto-Combo-Engine bewertet jeden Kandidaten anhand von **16 Faktoren** (Zustand, Kontingent, Kosten, Latenz, Aufgabeneignung, Qualität, Sitzungsverfügbarkeit …) — siehe [`docs/routing/AUTO-COMBO.md`](docs/routing/AUTO-COMBO.md).</sub>

##

### 🧱 Resilienz ist integriert (3 unabhängige Ebenen)

<img src="./docs/diagrams/resilience-layers.svg" width="100%" alt="Pusula-Ausfallsicherheit — 3 unabhängige Selbstheilungsebenen, die richtige Ebene für den jeweiligen Fehler. Ebene 1: Provider-Schutzschalter (gesamter Provider): Wird nur bei 408/5xx ausgelöst, Schwellenwerte OAuth 8× / API-Schlüssel 12× / lokal 2×, wird nach 60s/30s/15s für einen HALF-OPEN-Test zurückgesetzt, verzögerte Wiederherstellung; während OPEN leitet die Kombination zum nächsten Provider um. Ebene 2: Verbindungs-Cooldown (ein Schlüssel/Konto): Basiswert 5s für OAuth / 3s für API-Schlüssel, exponentieller ×2-Backoff mit Schutz vor gleichzeitigem Wiederanlauf, bei 429 wird Retry-After berücksichtigt, ein Erfolg löscht den gesamten Fehlerstatus; ein Schlüssel im Cooldown wird übersprungen, während weitere Schlüssel weiterhin Anfragen bedienen. Ebene 3: Modellsperre (ein Modell): Modellbezogene 429-Fehler, lokale 404-Fehler oder Modusverweigerungen sperren nur dieses Modell — niemals die gesamte Verbindung. Endzustände (gesperrt, abgelaufen, Guthaben aufgebraucht) sind für den Betreiber bestimmt, nicht für Cooldowns."/>

<sub>📖 [Auto-Combo-Engine](docs/routing/AUTO-COMBO.md) · [Ausfallsicherheitsleitfaden](docs/architecture/RESILIENCE_GUIDE.md)</sub>

<br/>

<div align="center">

## 🏆 Was Pusula auszeichnet

</div>

<img src="./docs/diagrams/comparison-table.svg" width="100%" alt="Was Pusula auszeichnet – ein veralteter Feature-Snapshot im Vergleich zu 9router, OpenRouter, CLIProxyAPI und LiteLLM über 13 Funktionen hinweg. Pusula: 358 Anbieter, über 150 integrierte kostenlose Tarife, 19 Routing-Strategien, 12-Engine-Token-Kompression, integrierter MCP-Server mit 110 Tools, A2A-Agentenprotokoll, persistenter Speicher, Guardrails, Cloud-Agenten, TLS-Fingerprint-Stealth, Desktop/Termux/PWA und 42 i18n UI-Sprachversionen. Pusula ist MIT-lizenziert und selbst-hostbar. Die Funktionen und Anzahlen der Wettbewerber können sich ändern; siehe die verlinkte Methodik."/>

<sub>📊 Vollständige Methodik &amp; Details pro Funktion im Vergleich zu 9router, OpenRouter, CLIProxyAPI &amp; LiteLLM → [`docs/comparison/PUSULA_VS_ALTERNATIVES.md`](docs/comparison/PUSULA_VS_ALTERNATIVES.md)</sub>

<br/>

<div align="center">

## 🤖 Kompatible CLIs & Coding-Agenten

> Eine Konfiguration — `http://localhost:20128/v1` — und **jede** KI-IDE oder CLI läuft mit kostenlosen und kostengünstigen Modellen.

<div align="center">
<table>
  <tr>
    <td align="center" width="76"><a href="https://github.com/anthropics/claude-code"><img src="./public/providers/claude.svg" width="40" alt="Claude Code"/><br/><sub><b>Claude Code</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><a href="https://github.com/openai/codex"><img src="./public/providers/codex.svg" width="40" alt="Codex CLI"/><br/><sub><b>Codex CLI</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/cline.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/cline.svg" width="40" alt="Cline"/></picture><br/><sub><b>Cline</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><a href="https://github.com/Kilo-Org/kilocode"><img src="./public/providers/cli-generic.svg" width="40" alt="Kilo Code"/><br/><sub><b>Kilo Code</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><a href="https://github.com/Zoo-Code-Org/Zoo-Code"><img src="./public/providers/cli-generic.svg" width="40" alt="Zoo Code"/><br/><sub><b>Zoo Code</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><img src="./public/providers/continue.svg" width="40" alt="Continue"/><br/><sub><b>Continue</b></sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Aider"/><br/><sub><b>Aider</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="ForgeCode"/><br/><sub><b>ForgeCode</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="jcode"/><br/><sub><b>jcode</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/deepseek.svg" width="40" alt="DeepSeek TUI"/><br/><sub><b>DeepSeek TUI</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="CodeWhale"/><br/><sub><b>CodeWhale</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><a href="https://github.com/anomalyco/opencode"><img src="./public/providers/cli-generic.svg" width="40" alt="OpenCode"/><br/><sub><b>OpenCode</b></sub><br/><sub>                           </sub></a></td>
  </tr>
  <tr>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Factory Droid"/><br/><sub><b>Factory Droid</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/copilot.svg" width="40" alt="GitHub Copilot CLI"/><br/><sub><b>Copilot CLI</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cursor.svg" width="40" alt="Cursor CLI"/><br/><sub><b>Cursor CLI</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Smelt"/><br/><sub><b>Smelt</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Pi (pi-coding-agent)"/><br/><sub><b>Pi</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/grok.svg" width="40" alt="Grok Build (xAI)"/><br/><sub><b>Grok Build</b></sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="76"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/nousresearch.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/nousresearch.svg" width="40" alt="Hermes Agent (Nous Research)"/></picture><br/><sub><b>Hermes Agent</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/openclaw.svg" width="40" alt="OpenClaw"/><br/><sub><b>OpenClaw</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/goose.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/goose.svg" width="40" alt="Goose"/></picture><br/><sub><b>Goose</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Open Interpreter"/><br/><sub><b>Open Interpreter</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Warp AI"/><br/><sub><b>Warp AI</b></sub><br/><sub>                           </sub></td>
  </tr>
</table>
</div>

<div align="center">
<b>＋ funktioniert auch mit</b> · Agent Deck · Kiro · Command Code · Antigravity · Windsurf · AMP · <b>jedem OpenAI-kompatiblen Tool</b>
</div>

<sub>📖 Einrichtung aller 36 Tools (26 CLI-Codes + 10 CLI-Agenten) → [`docs/reference/CLI-TOOLS.md`](docs/reference/CLI-TOOLS.md) · 🧩 OpenCode-Plugin → [`@pusula/opencode-provider`](https://www.npmjs.com/package/@pusula/opencode-provider)</sub>

</div>

<br/>

**Starten Sie jede unterstützte CLI mit nur einem Befehl über Pusula** — ohne dass Konfigurationsdateien geschrieben werden,
Anmeldedaten werden pro Prozess injiziert, und Qwen/Gemini erhalten ein temporäres, isoliertes Home-Verzeichnis:

```bash
pusula run claude   --model openai/gpt-5.4          # Claude Code
pusula run codex    --model glm/glm-5.2             # OpenAI Codex CLI
pusula run aider    --model glm/glm-5.2 -- --message "reply OK"
pusula run goose    --model glm/glm-5.2
pusula run opencode --model glm/glm-5.2 -- run "reply OK"
pusula run qwen     --model glm/glm-5.2 -- -p "reply OK"
pusula run gemini   --model glm/glm-5.2 -- --skip-trust -p "reply OK"

# Oder wählen Sie Anbieter und Modell interaktiv aus und schreiben Sie die eigene Konfiguration des Tools:
pusula configure codex          # ebenfalls: claude opencode qwen aider goose gemini cline continue kilo
```

Jeder Befehl berücksichtigt den aktiven Remote-Kontext (`pusula connect <host>`), `--dry-run`
zeigt die exakten Umgebungsvariablen/Argumente als Vorschau an, ohne sie auszuführen, und `--api-key-env NAME` hält Geheimnisse
aus Ihrem Shell-Verlauf heraus. → [CLI-Integrationen](docs/guides/CLI-INTEGRATIONS.md)

<br/>

<div align="center">

## 🌐 357 KI-Anbieter — 152 im Katalog als kostenlos gekennzeichnet

</div>

> **357 registrierte Anbieter** in den kanonischen Sammlungen für Chat, Medien, Suche, lokale Dienste, Cloud-Agenten und Systeme, darunter **152 mit den Discovery-Metadaten `hasFree: true`**. Das Chat-Modellregister umfasst **229 Anbieter / 2.554 eindeutige Anbieter-Modell-Paare / 1.283 ursprüngliche Modell-IDs**; der separate Katalog für kostenlose Kontingente enthält **491 modellspezifische Einträge**, **35 wiederkehrende Pools** und **54 wiederkehrende/schlüssellose, dauerhaft kostenlose Anbieter**. Diese Nenner unterscheiden sich bewusst; Definitionen und poolbereinigte Berechnungen finden Sie in der [Anbieterreferenz](docs/reference/PROVIDER_REFERENCE.md) und unter [Kostenlose Kontingente](docs/reference/FREE_TIERS.md).

<div align="center">

### 🏢 Jedes große Forschungslabor — über einen einzigen Endpunkt

<table>
  <tr>
    <td align="center" width="80"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/openai.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/openai.svg" width="40" alt="OpenAI"/></picture><br/><sub>OpenAI</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/claude-color.svg" width="40" alt="Anthropic"/><br/><sub>Anthropic</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/gemini-color.svg" width="40" alt="Gemini"/><br/><sub>Gemini</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/grok.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/grok.svg" width="40" alt="xAI Grok"/></picture><br/><sub>xAI Grok</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/deepseek-color.svg" width="40" alt="DeepSeek"/><br/><sub>DeepSeek</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/mistral-color.svg" width="40" alt="Mistral"/><br/><sub>Mistral</sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/qwen-color.svg" width="40" alt="Qwen"/><br/><sub>Qwen</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/meta-color.svg" width="40" alt="Meta Llama"/><br/><sub>Meta Llama</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/gq.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/groq.svg" width="40" alt="Groq"/></picture><br/><sub>Groq</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/nvidia-color.svg" width="40" alt="NVIDIA"/><br/><sub>NVIDIA</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/minimax-color.svg" width="40" alt="MiniMax"/><br/><sub>MiniMax</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/cohere-color.svg" width="40" alt="Cohere"/><br/><sub>Cohere</sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/perplexity-color.svg" width="40" alt="Perplexity"/><br/><sub>Perplexity</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/huggingface-color.svg" width="40" alt="Hugging Face"/><br/><sub>HuggingFace</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/together-color.svg" width="40" alt="Together"/><br/><sub>Together</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/fireworks-color.svg" width="40" alt="Fireworks"/><br/><sub>Fireworks</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/cloudflare-color.svg" width="40" alt="Cloudflare"/><br/><sub>Cloudflare</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/baidu-color.svg" width="40" alt="Baidu"/><br/><sub>Baidu</sub><br/><sub>                           </sub></td>
  </tr>
</table>

<sub>…und mehr als 330 weitere — jedes Symbol wird live aus dem Anbieterkatalog des Dashboards geladen. 📖 [Anbieterreferenz](docs/reference/PROVIDER_REFERENCE.md)</sub>

<br/>

### 🆓 Dauerhaft kostenlos — 0 $, keine Karte erforderlich

<table>
  <tr>
    <td align="center" width="150"><img src="./public/providers/cli-generic.svg" width="42" alt="OpenCode Zen"/><br/><b>OpenCode Zen</b><br/><sub>DeepSeek V4, Nemotron 3<br/>Keine Token-Begrenzung</sub></td>
    <td align="center" width="150"><img src="./public/providers/cli-generic.svg" width="42" alt="Kilo Code"/><br/><b>Kilo Code</b><br/><sub>Auto-Router, Tencent Hy3<br/>Für immer kostenlos</sub></td>
    <td align="center" width="150"><img src="./public/providers/requesty.svg" width="42" alt="Requesty"/><br/><b>Requesty</b><br/><sub>GPT-OSS 120B, Nemotron<br/>Für immer kostenlos</sub></td>
    <td align="center" width="150"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/siliconcloud-color.svg" width="42" alt="SiliconFlow"/><br/><b>SiliconFlow</b><br/><sub>DeepSeek V3.2 / R1<br/>Kostenloses Kontingent</sub></td>
    <td align="center" width="150"><img src="./public/providers/zhipu.svg" width="42" alt="Z.AI GLM"/><br/><b>Z.AI GLM</b><br/><sub>GLM-4.7 / 4.5-Flash<br/>Für immer kostenlos</sub></td>
    <td align="center" width="150"><img src="./public/providers/baidu.svg" width="42" alt="Baidu ERNIE"/><br/><b>Baidu ERNIE</b><br/><sub>ERNIE 4.0<br/>Für immer kostenlos</sub></td>
  </tr>
  <tr>
    <td align="center" width="150"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/qoder-color.svg" width="42" alt="Qoder AI"/><br/><b>Qoder AI</b><br/><sub>Qwen3-Max, Kimi-K2<br/>Unbegrenzt KOSTENLOS</sub></td>
    <td align="center" width="150"><img src="./public/providers/pollinations.svg" width="42" alt="Pollinations"/><br/><b>Pollinations</b><br/><sub>GPT, Llama, Claude<br/>Kein Schlüssel erforderlich</sub></td>
    <td align="center" width="150"><img src="./public/providers/cloudflare.svg" width="42" alt="Cloudflare AI"/><br/><b>Cloudflare AI</b><br/><sub>Über 50 Modelle<br/>10.000 Neuronen/Tag</sub></td>
    <td align="center" width="150"><img src="./public/providers/nvidia.svg" width="42" alt="NVIDIA NIM"/><br/><b>NVIDIA NIM</b><br/><sub>GLM, MiniMax<br/>~40 RPM kostenlos</sub></td>
    <td align="center" width="150"><img src="./public/providers/cerebras.svg" width="42" alt="Cerebras"/><br/><b>Cerebras</b><br/><sub>GLM 4.7, GPT-OSS<br/>1 Mio. Token/Tag</sub></td>
    <td align="center" width="150"><img src="./public/providers/openrouter.svg" width="42" alt="OpenRouter"/><br/><b>OpenRouter</b><br/><sub>:free-Modelle<br/>+$10 → höhere RPM</sub></td>
  </tr>
</table>

📖 Vollständiger maschinenlesbarer Katalog → [`docs/reference/PROVIDER_REFERENCE.md`](docs/reference/PROVIDER_REFERENCE.md)

<br/>
</div>

<div align="center">

## 🖥️ Wo Pusula läuft — überall

</div>

> Dieselbe App, dein Rechner, deine Regeln. Von einer globalen npm-Installation bis hin zu **deinem Smartphone** über Termux.

<table>
  <tr><th align="left">Plattform</th><th align="left">Installation</th><th align="left">Highlights</th></tr>
  <tr><td align="left" nowrap>📦 <b>npm (global)</b></td><td align="left" nowrap><code>npm install -g pusula</code></td><td align="left">Ein Befehl, jedes Betriebssystem</td></tr>
  <tr><td align="left" nowrap>🐳 <b>Docker</b></td><td align="left" nowrap><code>docker run … ferhat-yasinoglu/pusula</code></td><td align="left">Multi-Architektur: <b>AMD64 + ARM64</b></td></tr>
  <tr><td align="left" nowrap>🖥️ <b>Desktop (Electron)</b></td><td align="left" nowrap><code>npm run electron:build</code></td><td align="left">Natives Fenster + Taskleiste — <b>Windows / macOS / Linux</b></td></tr>
  <tr><td align="left" nowrap>💪 <b>ARM</b></td><td align="left" nowrap>nativ für <code>arm64</code></td><td align="left">Raspberry Pi, ARM-Server, Apple Silicon</td></tr>
  <tr><td align="left" nowrap>📱 <b>Android (Termux)</b></td><td align="left" nowrap><code>pkg install nodejs && npx -y pusula</code></td><td align="left">Läuft <b>auf deinem Smartphone</b>, rund um die Uhr, ohne Root-Zugriff</td></tr>
  <tr><td align="left" nowrap>📲 <b>PWA</b></td><td align="left" nowrap>„Zum Startbildschirm hinzufügen“</td><td align="left">Vollbildmodus, offline, über den Browser installierbar</td></tr>
  <tr><td align="left" nowrap>🧩 <b>OpenCode-Plugin</b></td><td align="left" nowrap><code>@pusula/opencode-provider</code></td><td align="left">Native OpenCode-Integration</td></tr>
  <tr><td align="left" nowrap>🛠️ <b>Aus dem Quellcode</b></td><td align="left" nowrap><code>npm install && npm run dev</code></td><td align="left">Anpassen und mitwirken</td></tr>
</table>

<sub>📖 [Docker-Anleitung](docs/guides/DOCKER_GUIDE.md) · [Desktop](electron/README.md) · [Termux](docs/guides/TERMUX_GUIDE.md) · [PWA](docs/guides/PWA_GUIDE.md) · [OpenCode](docs/frameworks/OPENCODE.md)</sub>

<br/>

<div align="center">

## 🔒 Privat & Local-First

</div>

<img src="./docs/diagrams/privacy-local.svg" width="100%" alt="Privat und Local-First — Gateway und Steuerungsebene von Pusula laufen auf Ihrem Rechner. Prompts werden an den für jede Anfrage ausgewählten Upstream-Anbieter gesendet; Pusula fügt keinen gehosteten Zwischenschritt zur Prompt-Verarbeitung hinzu, und Telemetrie ist standardmäßig deaktiviert. Zugangsdaten werden im Ruhezustand mit AES-256-GCM verschlüsselt; zu den Schutzmaßnahmen gehören die Einschränkung von API-Schlüsseln, IP-Filterung, Ratenbegrenzungen, Schutz vor Prompt-Injection, die Bereinigung von Upstream-Headern, optionale PII-Schwärzung, bereinigte Fehlermeldungen und ein lokales SQLite-Audit-Protokoll. Pusula ist MIT-lizenziert und kann selbst gehostet werden."/>

<sub>📖 [Autorisierung](docs/architecture/AUTHZ_GUIDE.md) · [Schutzmechanismen](docs/security/GUARDRAILS.md) · [Compliance](docs/security/COMPLIANCE.md)</sub>

<br/>

<div align="center">

## 🔌 Vollständige CLI + A2A & MCP

</div>

> Neben dem Server ist Pusula eine **vollständige Kommandozeilen-Schaltzentrale** mit **über 80 Befehlen** sowie offenen Agentenprotokollen, sodass ein KI-Agent sie **eigenständig** steuern kann.

### ⌨️ Eine echte CLI (nicht nur `start`)

```bash
pusula               # Gateway + Dashboard bereitstellen (Port 20128)
pusula chat          # interaktiver TUI-Chat-Client (Slash-Befehle: /model /combo /skill /memory)
pusula setup         # geführter Assistent für die Ersteinrichtung
pusula doctor        # Anbieter, Ports und native Abhängigkeiten diagnostizieren
```

### 🛰️ Remote-Modus — CLI hier ausführen, Pusula auf einem VPS

Pusula auf einem Server? Steuern Sie es von Ihrem Laptop aus mit **derselben CLI**. Melden Sie sich einmal
mit einem eingeschränkten Zugriffstoken an; anschließend wird jeder Befehl an das Remote-System gesendet.

```bash
pusula connect 192.168.0.15            # Passwort → eingeschränktes Token, als Kontext gespeichert
pusula models list                     # ← wird auf dem REMOTE-Server ausgeführt
pusula configure codex                 # ← wählt ein Remote-Modell aus und schreibt ein lokales Codex-Profil
pusula tokens create --name ci --scope read   # eingeschränktere Token für andere Rechner erstellen
pusula contexts use default            # ← zurück zum lokalen Server wechseln
```

Token sind auf `read` / `write` / `admin` beschränkt; Routen, die Prozesse starten, bleiben ausschließlich über Loopback erreichbar.
<sub>📖 [Remote-Modus](docs/guides/REMOTE-MODE.md)</sub>

<div align="left">

<img src="./docs/diagrams/cli-terminal.svg" width="50%" alt="Animierte Terminal-Demo der Pusula-CLI — pusula providers list, pusula combo list und pusula health — wechselt durch die 86 Top-Level-Befehle: providers · oauth · keys · combo · nodes · models · cache · compression · cost · usage · quota · health · resilience · telemetry · logs · audit · mcp · a2a · cloud · memory · skills · eval · tunnel · backup · sync · webhooks · policy · pricing · translator · simulate …"/>

</div>

### 🤝 Einen Agenten verbinden — und er steuert Pusula selbst

Stellen Sie Pusula über **MCP**, **A2A**, eine **REST API**, **Webhooks** oder eine **Remote-CLI** bereit — jeder geeignete Agent (oder Ihr eigener Code) erhält die Kontrolle über das gesamte Gateway: Routing, Anbieter, Kombinationen, Cache, Komprimierung und Speicher — autonom. Die nachfolgenden HTTP-Endpunkte werden unter `http://localhost:20128` bereitgestellt.

<table>
  <tr><th align="left">Schnittstelle</th><th align="left">Endpunkt / Befehl</th><th align="left">Verwendungszweck</th></tr>
  <tr><td align="left" nowrap>🧰 <b>MCP (stdio)</b></td><td align="left" nowrap><code>pusula --mcp</code></td><td align="left">In Claude Desktop, Cursor oder jeden beliebigen MCP-Client integrieren</td></tr>
  <tr><td align="left" nowrap>🌊 <b>MCP (HTTP)</b></td><td align="left" nowrap><code>/api/mcp/stream</code></td><td align="left">Remote-MCP — <b>110 Werkzeuge</b>, 33 Berechtigungsbereiche (Durchsetzung optional), vollständiges Audit-Protokoll</td></tr>
  <tr><td align="left" nowrap>📡 <b>MCP (SSE)</b></td><td align="left" nowrap><code>/api/mcp/sse</code></td><td align="left">Streaming-Transport für MCP</td></tr>
  <tr><td align="left" nowrap>🤝 <b>A2A</b></td><td align="left" nowrap><code>/.well-known/agent.json</code></td><td align="left">Agent-zu-Agent-Kommunikation, <b>JSON-RPC 2.0</b> + SSE, 6 Fähigkeiten</td></tr>
  <tr><td align="left" nowrap>🌐 <b>REST API</b></td><td align="left" nowrap><code>/v1/*</code></td><td align="left">OpenAI-kompatibel — Chat, Einbettungen, Bilder, Audio, OCR</td></tr>
  <tr><td align="left" nowrap>🔔 <b>Webhooks</b></td><td align="left" nowrap><code>/api/webhooks</code></td><td align="left">Anfrage- und Kontingentereignisse an Slack, andere Chat-Dienste oder eine beliebige URL senden</td></tr>
  <tr><td align="left" nowrap>🛰️ <b>Remote-CLI</b></td><td align="left" nowrap><code>pusula connect <host></code></td><td align="left">Eine Remote-Instanz mit eingeschränkten Zugriffstoken steuern</td></tr>
</table>

```bash
# Claude Code über MCP den vollständigen Pusula-Werkzeugsatz bereitstellen:
claude mcp add-server pusula --type http --url http://localhost:20128/api/mcp/stream
```

<sub>📖 [MCP-Server](docs/frameworks/MCP-SERVER.md) · [A2A-Server](docs/frameworks/A2A-SERVER.md) · [Agentenprotokolle](docs/frameworks/AGENT_PROTOCOLS_GUIDE.md)</sub>

<br/>

<div align="center">

## 🗜️ Automatisch 15–95 % Tokens sparen

</div>

### 📖 Funktionsweise — Pipeline, Architektur & Berechnung der Einsparungen

<img src="./docs/diagrams/compression-pipeline.svg" width="100%" alt="Pusula-Komprimierungspipeline: Eine beispielhafte Client-Anfrage mit 10.000 Tokens durchläuft 12 kombinierbare Engines — Session-Dedup, CCR, Lite, RTK, Responses Tool Output, Headroom, Relevance, Caveman, Aggressive, LLMLingua-2, Ultra und OmniGlyph — und kann im dokumentierten kombinierten Beispiel den Anbieter mit etwa 1.080 Tokens erreichen. Strukturierte Inhalte werden durch Schutzmechanismen zur Erhaltung und Integritätsprüfungen nach jedem Schritt geschützt; explizit verlustbehaftete oder experimentelle Modi können geeignete Inhalte transformieren."/>

Die standardmäßig kombinierte Konfiguration führt `RTK → Caveman` aus. Wenn beide dieselben Tool-/Kontextdaten verarbeiten, multiplizieren sich die Einsparungen:

```txt
kombiniert   = 1 − (1 − RTK) × (1 − Caveman_Eingabe)
Durchschnitt = 1 − (1 − 0.80) × (1 − 0.46) = 89.2%
Spanne       = 78.4 – 94.6%
```

Codeblöcke, URLs, JSON und strukturierte Daten werden durch die Schutz-Engine **immer geschützt**.

> **Warum viele Tokens verwenden, wenn wenige ausreichen?** Jede Anfrage durchläuft Pusulas Komprimierungspipeline **transparent** — ohne Änderungen am Client. Sie besteht jetzt aus einem **Stack aus 12 kombinierbaren Engines**, die der Reihe nach ausgeführt und je nach Routing-Kombination flexibel zusammengestellt werden — basierend auf Ideen von [RTK](https://github.com/rtk-ai/rtk), [Caveman](https://github.com/JuliusBrussee/caveman) (⭐ 90K+), [LLMLingua-2](https://github.com/microsoft/LLMLingua) und [Troglodita](https://github.com/leninejunior/troglodita) (PT-BR).

### 🧱 Der Stack aus 12 Engines

Die Engines werden in der Reihenfolge der Pipeline ausgeführt; jede kann unabhängig aktiviert oder deaktiviert und je Kombination konfiguriert werden:

<table>
  <tr><th align="center">#</th><th align="left">Engine</th><th align="left">Funktionsweise</th></tr>
  <tr><td align="center" nowrap>1</td><td align="left" nowrap><b>Session-Dedup</b></td><td align="left">Entfernt über mehrere Interaktionen hinweg wiederholte Inhalte (inhaltsadressiert, interaktionsübergreifend)</td></tr>
  <tr><td align="center" nowrap>2</td><td align="left" nowrap><b>CCR</b></td><td align="left">Archiviert große Blöcke hinter Abrufmarkierungen, die bei Bedarf abgerufen werden</td></tr>
  <tr><td align="center" nowrap>3</td><td align="left" nowrap><b>Lite</b></td><td align="left">Reduziert Leerraum und Bild-URLs (latenzarme Basisvariante)</td></tr>
  <tr><td align="center" nowrap>4</td><td align="left" nowrap><b>RTK</b></td><td align="left">Intelligentes Filtern, Deduplizieren und Kürzen von Tool-Ergebnissen (befehlsabhängig)</td></tr>
  <tr><td align="center" nowrap>5</td><td align="left" nowrap><b>Responses Tool Output</b></td><td align="left">Primär verlustfreie JSON-Komprimierung plus begrenzte Diagnosekomprimierung für Shell-/Patch-/Such-/Build-Ausgaben (Responses API)</td></tr>
  <tr><td align="center" nowrap>6</td><td align="left" nowrap><b>Headroom</b></td><td align="left">Verlustfreie tabellarische Komprimierung von JSON-Arrays (~30 %) über einen eingebundenen <b>GCF</b>-Codec</td></tr>
  <tr><td align="center" nowrap>7</td><td align="left" nowrap><b>Relevance</b></td><td align="left">Extraktive Bewertung von Sätzen anhand der letzten Benutzeranfrage</td></tr>
  <tr><td align="center" nowrap>8</td><td align="left" nowrap><b>Caveman</b></td><td align="left">Regelbasierte Textkomprimierung (~65–75 % bei der Ausgabe)</td></tr>
  <tr><td align="center" nowrap>9</td><td align="left" nowrap><b>Aggressive</b></td><td align="left">Zusammenfassung und schrittweise Alterung früherer Interaktionen</td></tr>
  <tr><td align="center" nowrap>10</td><td align="left" nowrap><b>LLMLingua-2</b></td><td align="left">Semantische ML-Bereinigung über MobileBERT ONNX — codesicher, asynchron</td></tr>
  <tr><td align="center" nowrap>11</td><td align="left" nowrap><b>Ultra</b></td><td align="left">Heuristische Token-Bereinigung mit optionaler Small-Model-Stufe (SLM)</td></tr>
  <tr><td align="center" nowrap>12</td><td align="left" nowrap><b>OmniGlyph</b></td><td align="left">Experimentelle Kodierung von Kontext als Bild für das gemessene Claude Fable 5 über die direkte Anthropic-Verbindung; GPT 5.6 Transformers bleiben bis zum Vorliegen von Anbieterbelegen nach dem Fail-Closed-Prinzip deaktiviert. Vier Komprimierungsprofile (standardmäßig aggressiv, ausgewogen, codesicher, unverändert) (am aggressivsten; optionale Aktivierung)</td></tr>
</table>

Codeblöcke, URLs und strukturierte Daten bleiben **immer** bytegenau erhalten. **Ein-Klick-Voreinstellungen** kombinieren die Engines:

<table>
  <tr><th align="left">Modus</th><th align="left">Einsparungen</th><th align="left">Am besten geeignet für</th></tr>
  <tr><td align="left" nowrap>🪶 <b>Lite</b></td><td align="left" nowrap>~15 %</td><td align="left">Sichere, dauerhaft aktive Standardeinstellung</td></tr>
  <tr><td align="left" nowrap>🪨 <b>Standard (Caveman)</b></td><td align="left" nowrap>~30 %</td><td align="left">Tägliche Programmierarbeit</td></tr>
  <tr><td align="left" nowrap>⚡ <b>Aggressive</b></td><td align="left" nowrap>~50 %</td><td align="left">Lange Sitzungen mit intensiver Tool-Nutzung</td></tr>
  <tr><td align="left" nowrap>🔥 <b>Ultra</b></td><td align="left" nowrap>~75 %</td><td align="left">Maximale Einsparungen</td></tr>
  <tr><td align="left" nowrap>🧰 <b>RTK</b></td><td align="left" nowrap>60–90 %</td><td align="left">Shell-/Test-/Build-/git-Ausgaben</td></tr>
  <tr><td align="left" nowrap>🔗 <b>Kombiniert (RTK → Caveman)</b></td><td align="left" nowrap><b>78–95 %</b></td><td align="left">Gemischte Prompts und Tool-Protokolle</td></tr>
</table>

**Praxisbeispiel — Standardmodus:**

> **Vorher (69 Tokens):** _„Der Grund dafür, dass deine React-Komponente erneut gerendert wird, liegt wahrscheinlich darin, dass du bei jedem Renderzyklus eine neue Objektreferenz erstellst. Wenn du ein Inline-Objekt als Prop übergibst, erkennt Reacts flacher Vergleich es jedes Mal als ein anderes Objekt, was ein erneutes Rendern auslöst. Ich würde empfehlen, useMemo zu verwenden, um das Objekt zu memoizieren.“_
>
> **Nachher (19 Tokens):** _„Neue Objektreferenz bei jedem Rendern. Inline-Objekt-Prop = neue Referenz = erneutes Rendern. Mit useMemo umschließen.“_
>
> **Gleiche Antwort. 72 % weniger Tokens. Kein Genauigkeitsverlust.** ✅

**PT-BR-Beispiel — [Troglodita](https://github.com/leninejunior/troglodita)-Modus:**

> **Vorher (42 Tokens):** _„Das Problem ist, dass die Komponente erneut gerendert wird, weil in jedem Renderzyklus eine neue Objektreferenz erstellt wird. Ich würde empfehlen, useMemo zu verwenden.“_
>
> **Nachher (12 Tokens):** _„Erneutes Rendern: neue Referenz je Zyklus (Inline-Objekt neu erstellt). `useMemo` verwenden.“_
>
> **Gleiche Antwort. ~70 % weniger Tokens. Technische Präzision unverändert.** ✅

<br/>

### 🎚️ Mehr als nur Engines — Ausgabestile, die adaptive Steuerung und Kontrolle pro Anfrage

Die 12 Engines oben reduzieren, was **hineingeht**. Drei weitere Ebenen bestimmen, **wie**, **wann** und was **herauskommt**:

- **🪄 Ausgabestile** _(Steuerung der Ausgabeachse)_ — fügen deterministische, Cache-sichere Anweisungen zur Antwortgestaltung ein; kombinierbar, jeweils mit der Intensität `lite` / `full` / `ultra`. Zum Hinzufügen eines Stils genügt ein einzeiliger Registry-Eintrag:
  - **Knappe Prosa** — Füllwörter / Artikel / Einschränkungen weglassen; technische Substanz exakt beibehalten.
  - **Weniger Code** — „fauler Senior-Entwickler“-YAGNI: kleinste funktionierende Änderung, kein nicht angefordertes Gerüst.
  - **Pferdeschwanz (fauler Senior-Entwickler)** — die YAGNI-Leiter erklimmen, die eigentliche Ursache beheben, kleinster funktionierender Diff.
  - **Ich habe ADHS (handlungsorientiert)** — nächste Aktion zuerst, nummerierte Schritte, ein konkreter nächster Schritt, keine Einleitung.
  - **Knappes CJK (文言)** — ultraknapper Stil in klassischem Chinesisch (durch Gebietsschema auf `zh` beschränkt).
- **🎯 Adaptives Kontextbudget** _(die Steuerung)_ — statt eines einzelnen Ein-/Aus-Token-Schwellenwerts werden die günstigsten Engines mit den geringsten Verlusten nur so weit hochgestuft, wie nötig ist, damit alles **in das Kontextfenster des Modells passt**. Richtlinie: `reserve-output` (Standard, modellabhängig) · `percentage` · `absolute`. Modus: `floor` (garantiert die Einhaltung) · `replace-autotrigger` (Ihre explizite Auswahl hat Vorrang) · `off` (veralteter Schwellenwert).
- **🎛️ Wo über die Komprimierung entschieden wird** _(Priorität, hoch → niedrig)_ — `x-pusula-compression`-Header pro Anfrage › Überschreibung durch Routing-Kombination › aktives benanntes Profil › adaptiv / automatische Auslösung › Panel-Standard › aus. Der angewendete Plan wird im Antwort-Header `X-Pusula-Compression: <mode>; source=<source>` zurückgegeben.

Automatische Auslösung anhand eines Token-Schwellenwerts, Aktivierung der adaptiven Steuerung, Festlegen eines benannten Profils, einmalige Einstellung pro Anfrage oder Zuweisen einer Pipeline pro Routing-Kombination — je nachdem, was zur Arbeitslast passt. Ein optionales lokales **Evaluierungswerkzeug** (`npm run eval:compression`) bewertet die Wiedergabetreue im Verhältnis zur Einsparung anhand eines festgelegten Korpus, bevor Sie eine Änderung übernehmen.

📖 [`COMPRESSION_GUIDE.md`](docs/compression/COMPRESSION_GUIDE.md) · [`RTK_COMPRESSION.md`](docs/compression/RTK_COMPRESSION.md) · [`COMPRESSION_ENGINES.md`](docs/compression/COMPRESSION_ENGINES.md)

<br/>

<div align="center">

# ⚡ Schnellstart

</div>

**1) Installieren und ausführen**

```bash
npm install -g pusula
pusula
```

> 💡 Sehen Sie `npm warn ERESOLVE` oder Peer-Dependency-Warnungen? [Sie sind harmlos](docs/guides/TROUBLESHOOTING.md#npm-install-warnings-eresolve--peer--deprecated).

Dashboard unter `http://localhost:20128` · API unter `http://localhost:20128/v1`.

**2) Einen KOSTENLOSEN Anbieter verbinden (keine Registrierung)**

Dashboard → **Anbieter** → **Kiro AI** (kostenloses Claude, ~50 Credits/Monat pro Konto) oder **OpenCode Free** (keine Authentifizierung) verbinden → fertig.

**3) Ihr Programmierwerkzeug konfigurieren**

```txt
Basis-URL:      http://localhost:20128/v1
API-Schlüssel:  [aus Dashboard → Endpunkte kopieren]
Modell:         auto            (intelligentes Routing ohne Konfiguration — oder beliebiger Anbieter/beliebiges Modell)
```

**4) Funktion überprüfen**

```bash
curl http://localhost:20128/v1/models -H "Authorization: Bearer YOUR_KEY"
```

Ihre verbundenen Modelle sollten aufgelistet werden. 🎉 Das war's — beginnen Sie mit dem Programmieren; Pusula übernimmt automatisch das Routing und weicht bei Bedarf auf Alternativen aus.

Falls Ihr Client keine benutzerdefinierten Header senden kann, stellt Pusula außerdem tokenisierte Kompatibilitätsaliase bereit:

```txt
OpenAI-Katalog:  http://localhost:20128/vscode/YOUR_KEY/
OpenAI-Modelle:  http://localhost:20128/vscode/YOUR_KEY/models
OpenAI-Chat:     http://localhost:20128/vscode/YOUR_KEY/chat/completions
OpenAI-Antworten: http://localhost:20128/vscode/YOUR_KEY/responses
Ollama-Chat:     http://localhost:20128/vscode/YOUR_KEY/api/chat
Ollama-Tags:     http://localhost:20128/vscode/YOUR_KEY/api/tags
```

Verwenden Sie diese nur für Clients, die `Authorization: Bearer ...` nicht anhängen können. Die Authentifizierung per Header bleibt der bevorzugte Modus.

<br/>

## 📦 Weitere Installationsmethoden — Docker, Quellcode, pnpm, Arch

**🐳 Docker**

```bash
docker run -d --name pusula --restart unless-stopped --stop-timeout 40 \
  -p 127.0.0.1:20128:20128 -v pusula-data:/app/data ferhat-yasinoglu/pusula:latest
```

`:latest` folgt der höchsten **veröffentlichten** stabilen SemVer-Version. Es folgt nicht dem Git-Branch `main`. Verwenden Sie für GitOps eine feste Version mit `:X.Y.Z`. Siehe [Docker-Veröffentlichungskanäle](docs/guides/DOCKER_GUIDE.md#release-channels). Das Image setzt **`PUSULA_MEMORY_MB=1024`** fest. Das reicht für das Dashboard und einen einfachen Chat. **Coding-Agenten** (`POST /v1/responses` von Claude Code, Codex, Grok, …) benötigen einen wesentlich größeren V8-Heap, andernfalls kommt es bei zwei sich überschneidenden langen Kontexten bei etwa 12 GiB zu einem `FATAL ERROR`. Dimensionieren Sie den Container größer als den Heap (native Puffer befinden sich außerhalb von V8):

| Arbeitslast                              | Heap (`-e PUSULA_MEMORY_MB`) | Container (`--memory`) |
| ---------------------------------------- | ------------------------------- | ---------------------- |
| Dashboard / einfacher Chat               | `1024` (Image-Standardwert)     | ≥2 g                   |
| Ein Coding-Agent                         | `8192`                          | ≥10 g                  |
| Zwei gleichzeitige lange `/v1/responses` | `10240`–`12288`                 | ≥12–16 g               |

```bash
docker run -d --name pusula --restart unless-stopped --stop-timeout 40 \
  -e PUSULA_MEMORY_MB=8192 --memory=10g \
  -p 127.0.0.1:20128:20128 -v pusula-data:/app/data ferhat-yasinoglu/pusula:latest
```

Vollständige Tabelle: [Docker-Leitfaden — Laufzeit-RAM](docs/guides/DOCKER_GUIDE.md#runtime-ram-for-coding-agents).

> **Docker-Kanal für Vorabversionen:** `ferhat-yasinoglu/pusula:next` und
> `ferhat-yasinoglu/pusula:next-web` folgen dem aktuellen standardmäßigen `release/v*`-
> Branch. Diese veränderlichen Tags sind ausschließlich zum Testen unveröffentlichter Korrekturen vorgesehen und
> werden **für den Produktionseinsatz nicht unterstützt**. Siehe
> [Docker-Veröffentlichungskanäle](docs/guides/DOCKER_GUIDE.md#release-channels).

**🥟 Bun**

Die standardmäßige Installation mit `bun install` sowie die globale Installation (`bun install -g pusula`) werden über die Bun-Laufzeiterkennung unterstützt:

- **Integriertes `bun:sqlite`**: Pusula verwendet bei der Ausführung unter Bun dessen integrierten `bun:sqlite`-Treiber und greift unter Node.js auf `better-sqlite3` oder `sql.js` zurück.
- **Automatische Auswahl des Webpack-Bundlers in der Entwicklungsumgebung**: Die Entwicklungsumgebung (`bun run dev`) erkennt Bun automatisch und deaktiviert Turbopack zugunsten von Webpack, um Inkompatibilitäten mit nativen V8-Bindings zu vermeiden. Produktions-Builds (`bun run build`) folgen `PUSULA_USE_TURBOPACK` genau wie unter Node: standardmäßig Turbopack, mit `PUSULA_USE_TURBOPACK=0` wird mit Webpack gebaut (`Dockerfile.bun` stellt dies als `--build-arg` bereit).
- **Dediziertes Bun-Dockerfile**: Mehrstufiges `Dockerfile.bun` für native Bun-Produktionsbereitstellungen (`docker build -f Dockerfile.bun -t pusula:bun .`).

```bash
# Mit Bun installieren und ausführen
bun install
bun run dev
```

**🛠️ Aus dem Quellcode**

```bash
cp .env.example .env && npm install
PORT=20128 npm run dev
```

**📦 pnpm**

```bash
pnpm add -g pusula@latest --allow-build=better-sqlite3 --allow-build=@swc/core && pusula
```

**🐧 Arch Linux (AUR)**

```bash
yay -S pusula-bin && systemctl --user enable --now pusula.service
```

**🔧 Nix (Flake)**

```bash
# Mit Nix-Flakes
nix develop
npm run dev

# Oder mit devbox
devbox run npm run dev
```

📖 [Docker-Leitfaden](docs/guides/DOCKER_GUIDE.md) — Compose-Profile, Caddy HTTPS, Cloudflare-Tunnel.

**🦭 Podman**

```bash
# 1. Das per Bind-Mount eingebundene Datenverzeichnis vorbereiten
mkdir -p data

# 2. Nur unter Linux + lokalem Rootless-Podman (niemals mit einem entfernten Podman-Machine-Client):
podman unshare chown 1000:1000 ./data

# 3. Den Laufzeithinweis festlegen, das lokale Compose-Image erstellen und starten
echo "CONTAINER_HOST=podman" >> .env
podman compose --profile base up -d --build
```

Unter macOS oder Windows verwendet Podman eine entfernte Podman Machine: Überspringen Sie `podman unshare` und
befolgen Sie die [topologiespezifischen Hinweise zum Datenverzeichnis](contrib/podman/README.md#data-directory-permissions-by-topology).

📖 [Podman-Leitfaden](contrib/podman/README.md) — Compose-Builds, Podman Machine und
Linux/systemd-Quadlet-Einrichtung.

**⚡ Schnellere / schlankere Installation (nativen Build überspringen)**

Die native SQLite-Engine (`better-sqlite3`) ist eine **optionale** Abhängigkeit, daher wird eine globale
Installation niemals durch die Kompilierung aus dem Quellcode blockiert: Sie verwendet ein vorkompiliertes Binärprogramm, wenn eines zu
Ihrer Plattform/Node-Version passt, und greift andernfalls transparent auf eine reine JS-Engine zurück
(`node:sqlite` unter Node 22+, andernfalls das mitgelieferte `sql.js`-WASM) — keine Build-Werkzeuge erforderlich.

So überspringen Sie die native Aufwärmphase nach der Installation vollständig (CI, Headless-Systeme oder langsame Rechner):

```bash
PUSULA_SKIP_POSTINSTALL=1 npm install -g pusula   # CI=1 überspringt sie ebenfalls
```

Für die schnellsten Installationen empfiehlt sich **pnpm** (inhaltsadressierter Speicher + Hardlinks — siehe oben).
Für eine Headless-Laufzeitumgebung ohne Dashboard verwenden Sie das Docker-Profil `base` (siehe oben) oder den
[Termux-Leitfaden](docs/guides/TERMUX_GUIDE.md). Die CLI und das Web-Dashboard werden vom
gleichen Prozess über einen einzigen Port bereitgestellt, daher gibt es derzeit kein separates reines CLI-Paket.

<br/>

<div align="center">

# 📧 Community & Hilfe

> Fragen, Fehlerberichte und Ideen laufen direkt über GitHub — ein Issue oder eine Diskussion genügt.

| Kanal                    | Wo / wie                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 🐛 **Fehler melden**     | [GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues) — Ausgabe von `npm run system-info` anhängen                       |
| 💬 **Fragen & Ideen**    | [GitHub Discussions](https://github.com/Ferhat-Yasinoglu/pusula/discussions)                                                          |
| 🔒 **Sicherheitslücken** | [Security Advisory erstellen](https://github.com/Ferhat-Yasinoglu/pusula/security/advisories/new) — siehe [SECURITY.md](SECURITY.md) |
| 📦 **Quellcode**         | [github.com/Ferhat-Yasinoglu/pusula](https://github.com/Ferhat-Yasinoglu/pusula)                                                      |
| 🤝 **Mitwirken**         | [CONTRIBUTING.md](CONTRIBUTING.md) · [Branching- & Release-Modell](docs/ops/BRANCHING_MODEL.md) · ein `good first issue` auswählen   |

</div>

---

<br/>
<div align="center">

## 🛠️ Tech Stack

</div>

<table>
  <tr><th align="left">Schicht</th><th align="left">Technologie</th></tr>
  <tr><td nowrap><b>Laufzeit</b></td><td>Node.js 22.x / 24.x LTS — <code>&gt;=22.22.2 &lt;23 || &gt;=24.0.0 &lt;27</code></td></tr>
  <tr><td nowrap><b>Sprache</b></td><td>TypeScript 6.0 — <b>100% TypeScript</b> in <code>src/</code> und <code>open-sse/</code> (kein <code>any</code> im Kern seit v2.0)</td></tr>
  <tr><td nowrap><b>Framework</b></td><td>Next.js 16 + React 19 + Tailwind CSS 4</td></tr>
  <tr><td nowrap><b>Datenbank</b></td><td>better-sqlite3 (SQLite, WAL Journaling) + LowDB (JSON Legacy) — 122 Domänenmodule, 183 Migrationen</td></tr>
  <tr><td nowrap><b>Speicher</b></td><td>SQLite FTS5 Volltext + int8-quantisierte Vektor-Embeddings, typisierter Zerfall</td></tr>
  <tr><td nowrap><b>Schemata</b></td><td>Zod 4 — MCP Tool I/O-Validierung + API-Verträge</td></tr>
  <tr><td nowrap><b>Protokolle</b></td><td>MCP (stdio / HTTP / SSE) + A2A v0.3 (JSON-RPC 2.0 + SSE)</td></tr>
  <tr><td nowrap><b>Streaming</b></td><td>Server-Sent Events (SSE) + WebSocket-Brücke (<code>/v1/ws</code>)</td></tr>
  <tr><td nowrap><b>Kompression</b></td><td>12-Engine-Pipeline — RTK, Caveman, LLMLingua-2 (MobileBERT ONNX), GCF, OmniGlyph</td></tr>
  <tr><td nowrap><b>Authentifizierung &amp; Sicherheit</b></td><td>OAuth 2.0 (PKCE) + JWT + API-Schlüssel + MCP-bereichsbezogene Authentifizierung · AES-256-GCM im Ruhezustand · DOMPurify</td></tr>
  <tr><td nowrap><b>Stealth</b></td><td>wreq-js — JA3 / JA4 TLS-Fingerprint-Impersonation, 3-stufiger Proxy</td></tr>
  <tr><td nowrap><b>Resilienz</b></td><td>Leistungsschalter, exponentieller Backoff, Anti-Thundering-Herd, Auto-Combo-Selbstheilung</td></tr>
  <tr><td nowrap><b>Protokollierung</b></td><td>pino — strukturierte JSON-Logs mit Anfragekontext</td></tr>
  <tr><td nowrap><b>Testen</b></td><td>Node.js Test-Runner + Vitest — <b>über 39.000 statische Testdeklarationen</b> in über 5.100 verfolgten Testdateien (Unit, Integration, E2E, Sicherheit, Ökosystem)</td></tr>
  <tr><td nowrap><b>Plattformen</b></td><td>Desktop (Electron) · Android (Termux) · PWA (jeder Browser)</td></tr>
  <tr><td nowrap><b>CI/CD</b></td><td>GitHub Actions — automatische npm-Veröffentlichung + GHCR bei Release</td></tr>
  <tr><td nowrap><b>Links</b></td><td><a href="https://github.com/Ferhat-Yasinoglu/pusula">GitHub</a> · <a href="https://www.npmjs.com/package/pusula">npm</a> · <a href="https://github.com/Ferhat-Yasinoglu/pusula/pkgs/container/pusula">GHCR</a></td></tr>
</table>

<div align="center">

<br/>

## 📖 Dokumentation

</div>

### 📘 Erste Schritte

<table>
  <tr><th align="left">Dokument</th><th align="left">Beschreibung</th></tr>
  <tr><td nowrap><b><a href="docs/guides/USER_GUIDE.md">Benutzerhandbuch</a></b></td><td>Anbieter, Kombinationen, CLI-Integration, Bereitstellung</td></tr>
  <tr><td nowrap><b><a href="docs/guides/SETUP_GUIDE.md">Einrichtungsanleitung</a></b></td><td>Alle Installationsmethoden, Konfigurationen für CLI-Tools, Protokolleinrichtung, Zeitüberschreitungsoptimierung</td></tr>
  <tr><td nowrap><b><a href="docs/reference/CLI-TOOLS.md">Leitfaden für CLI-Tools</a></b></td><td>Toolspezifische Einrichtung für Claude Code, Codex, Cursor, Cline, OpenClaw, Kilo und Copilot</td></tr>
  <tr><td nowrap><b><a href="docs/guides/REMOTE-MODE.md">Remote-Modus</a></b></td><td>Eine entfernte Pusula-Instanz (VPS) über die Laptop-CLI mithilfe von Zugriffstokens mit begrenztem Gültigkeitsbereich steuern</td></tr>
  <tr><td nowrap><b><a href="docs/guides/CLAUDE-CODE-CONFIGURATION.md">Claude-Code-Konfiguration</a></b></td><td>Claude Code über <code>launch</code> und modellspezifische Profile mit Pusula (lokal/remote) verbinden</td></tr>
  <tr><td nowrap><b><a href="README.md#-quick-start">Schnellstart</a></b></td><td>Installation in 3 Schritten → verbinden → konfigurieren</td></tr>
</table>

### 🔧 Betrieb & Bereitstellung

<table>
  <tr><th align="left">Dokument</th><th align="left">Beschreibung</th></tr>
  <tr><td nowrap><b><a href="docs/guides/DOCKER_GUIDE.md">Docker-Leitfaden</a></b></td><td>Docker-Ausführung, Compose-Profile, Caddy-HTTPS, Tunnel, Image-Tags</td></tr>
  <tr><td nowrap><b><a href="contrib/podman/README.md">Podman-Leitfaden</a></b></td><td>Quadlet-systemd-Integration, podman-compose, SELinux</td></tr>
  <tr><td nowrap><b><a href="docs/ops/VM_DEPLOYMENT_GUIDE.md">VM-Bereitstellung</a></b></td><td>Vollständiger Leitfaden: Einrichtung von VM + nginx + Cloudflare</td></tr>
  <tr><td nowrap><b><a href="docs/ops/FLY_IO_DEPLOYMENT_GUIDE.md">Fly.io-Bereitstellung</a></b></td><td>Bereitstellung auf Fly.io mit persistentem Speicher</td></tr>
  <tr><td nowrap><b><a href="docs/guides/TERMUX_GUIDE.md">Termux-Leitfaden</a></b></td><td>Pusula über Termux unter Android ausführen</td></tr>
  <tr><td nowrap><b><a href="docs/guides/PWA_GUIDE.md">PWA-Leitfaden</a></b></td><td>Installation, Caching und Architektur der Progressive Web App</td></tr>
  <tr><td nowrap><b><a href="docs/guides/UNINSTALL.md">Deinstallationsanleitung</a></b></td><td>Saubere Entfernung für alle Installationsmethoden</td></tr>
  <tr><td nowrap><b><a href="docs/reference/ENVIRONMENT.md">Umgebungskonfiguration</a></b></td><td>Vollständige <code>.env</code>-Variablen und Referenzen</td></tr>
</table>

### 🧠 Funktionen & Architektur

<table>
  <tr><th align="left">Dokument</th><th align="left">Beschreibung</th></tr>
  <tr><td nowrap><b><a href="docs/architecture/ARCHITECTURE.md">Architektur</a></b></td><td>Systemarchitektur, Datenfluss und interne Abläufe</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_GUIDE.md">Komprimierungsleitfaden</a></b></td><td>Pipeline mit 7 Optionen: aus / leicht / Standard / aggressiv / ultra / RTK / gestapelt</td></tr>
  <tr><td nowrap><b><a href="docs/compression/RTK_COMPRESSION.md">RTK-Komprimierung</a></b></td><td>Komprimierung von Befehlsausgaben, Filter, Vertrauen, Verifizierung, Wiederherstellung der Rohausgabe</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_ENGINES.md">Komprimierungs-Engines</a></b></td><td>Caveman, RTK, gestapelte Pipelines, Dashboard-/API-/MCP-Oberflächen</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_RULES_FORMAT.md">Format der Komprimierungsregeln</a></b></td><td>JSON-Schemata für Regelpakete von Caveman- und RTK-Filtern</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_LANGUAGE_PACKS.md">Komprimierungs-Sprachpakete</a></b></td><td>Spracherkennung und Erstellung von Caveman-Regelpaketen</td></tr>
  <tr><td nowrap><b><a href="docs/architecture/RESILIENCE_GUIDE.md">Resilienzleitfaden</a></b></td><td>Leistungsschalter, Abkühlzeiten, Warteschlange, Schutz vor Anfragestürmen, TLS-Spoofing</td></tr>
  <tr><td nowrap><b><a href="docs/routing/AUTO-COMBO.md">Auto-Combo-Engine</a></b></td><td>Bewertung anhand von 16 Faktoren, Moduspakete, Selbstheilung</td></tr>
  <tr><td nowrap><b><a href="docs/ops/PROXY_GUIDE.md">Proxy-Leitfaden</a></b></td><td>3-stufiges Proxy-System, 1proxy-Marktplatz, CRUD für die Registry</td></tr>
  <tr><td nowrap><b><a href="docs/reference/FREE_TIERS.md">Kostenlose Tarife</a></b></td><td>Konsolidiertes Verzeichnis: 35 dokumentierte wiederkehrende Pools / 489 katalogisierte Gratis-Tarif-Einträge</td></tr>
  <tr><td nowrap><b><a href="docs/guides/FEATURES.md">Funktionsgalerie</a></b></td><td>Visuelle Dashboard-Tour mit Screenshots</td></tr>
  <tr><td nowrap><b><a href="docs/architecture/CODEBASE_DOCUMENTATION.md">Codebasis-Dokumentation</a></b></td><td>Einsteigerfreundliche Einführung in die Codebasis</td></tr>
</table>

### 🤖 Protokolle & APIs

<table>
  <tr><th align="left">Dokument</th><th align="left">Beschreibung</th></tr>
  <tr><td nowrap><b><a href="docs/reference/API_REFERENCE.md">API-Referenz</a></b></td><td>Alle Endpunkte mit Beispielen</td></tr>
  <tr><td nowrap><b><a href="docs/openapi.yaml">OpenAPI-Spezifikation</a></b></td><td>OpenAPI-3.0-Spezifikation</td></tr>
  <tr><td nowrap><b><a href="open-sse/mcp-server/README.md">MCP-Server</a></b></td><td>110 MCP-Tools, IDE-Konfigurationen, Python-/TS-/Go-Clients</td></tr>
  <tr><td nowrap><b><a href="docs/frameworks/MCP-SERVER.md">MCP-Server-Leitfaden</a></b></td><td>MCP-Installation, Übertragungsarten und Tool-Referenz</td></tr>
  <tr><td nowrap><b><a href="src/lib/a2a/README.md">A2A-Server</a></b></td><td>JSON-RPC-2.0-Protokoll, Fähigkeiten, Streaming, Aufgabenverwaltung</td></tr>
  <tr><td nowrap><b><a href="docs/frameworks/A2A-SERVER.md">A2A-Server-Leitfaden</a></b></td><td>A2A-Agentenkarte, Aufgaben, Fähigkeiten und Streaming</td></tr>
</table>

### 📋 Projekt & Qualität

<table>
  <tr><th align="left">Dokument</th><th align="left">Beschreibung</th></tr>
  <tr><td nowrap><b><a href="CONTRIBUTING.md">Mitwirken</a></b></td><td>Einrichtung der Entwicklungsumgebung und Richtlinien</td></tr>
  <tr><td nowrap><b><a href="docs/ops/BRANCHING_MODEL.md">Branching- und Release-Modell</a></b></td><td>Auf welche Branches PRs abzielen (<code>release/*</code>) und welche Bedeutung <code>main</code> und Tags haben</td></tr>
  <tr><td nowrap><b><a href="CHANGELOG.md">Änderungsprotokoll</a></b></td><td>Vollständiger Release-Verlauf nach Version</td></tr>
  <tr><td nowrap><b><a href="SECURITY.md">Sicherheitsrichtlinie</a></b></td><td>Meldung von Schwachstellen und Sicherheitspraktiken</td></tr>
  <tr><td nowrap><b><a href="docs/guides/I18N.md">i18n-Leitfaden</a></b></td><td>Unterstützung für 42 Sprachen, Übersetzungsworkflow, RTL</td></tr>
  <tr><td nowrap><b><a href="docs/ops/RELEASE_CHECKLIST.md">Release-Checkliste</a></b></td><td>Validierungsschritte vor dem Release</td></tr>
  <tr><td nowrap><b><a href="docs/ops/COVERAGE_PLAN.md">Testabdeckungsplan</a></b></td><td>Testabdeckungsstrategie für mehr als 39.000 statische Testdeklarationen in mehr als 5.100 erfassten Testdateien</td></tr>
</table>

<br/>

<div align="center">

## 👥 Mitwirken

</div>

### So können Sie beitragen

1. Forken Sie das Repository
2. Erstellen Sie Ihren Branch von der Spitze des **aktiven** `release/vX.Y.Z`-Branches (nicht von `main`) — siehe [Branching- und Release-Modell](docs/ops/BRANCHING_MODEL.md)
3. Erstellen Sie Ihren Feature-Branch (`git checkout -b feat/amazing-feature`)
4. Committen Sie Ihre Änderungen (`git commit -m 'feat: add amazing feature'`)
5. Pushen Sie in den Branch (`git push origin feat/amazing-feature`)
6. Öffnen Sie einen Pull Request mit **base = diesem `release/vX.Y.Z`-Branch**

Ausführliche Richtlinien finden Sie in [CONTRIBUTING.md](CONTRIBUTING.md).

### Veröffentlichung einer neuen Version

```bash
# Release erstellen — npm publish erfolgt automatisch
VERSION=x.y.z
gh release create "v${VERSION}" --title "v${VERSION}" --generate-notes
```

<br/>

<div align="center">

## 🙏 Danksagungen

</div>

Pusula steht auf den Schultern von Giganten. Es begann als Fork von **[9router](https://github.com/decolua/9router)** und als TypeScript-Portierung des Go-Projekts **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** — und von da an wurde jedes der unten aufgeführten Subsysteme von einem Open-Source-Projekt inspiriert, das diesen Weg bereits zuvor beschritten hatte. Jedes davon hat einen konkreten Teil von Pusula geprägt. Dies ist unser Dank an sie alle. 🙏

> ⭐ Die Anzahl der Sterne wurde am 24. August 2026 über die REST API von GitHub verifiziert — gebt diesen Projekten einen Stern. Die Angaben sind eine exakte, datierte Momentaufnahme und werden sich selbstverständlich ändern.

### 🧬 Abstammung & Gateway

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/decolua/9router">9router</a></b></td><td align="center">26,161</td><td>Das ursprüngliche Projekt, auf dem dieser Fork basiert — hier um multimodale APIs erweitert und vollständig in TypeScript neu geschrieben.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/router-for-me/CLIProxyAPI">CLIProxyAPI</a></b></td><td align="center">48,497</td><td>Die Go-Implementierung, die als Inspiration für diese JavaScript-/TypeScript-Portierung diente.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/BerriAI/litellm">LiteLLM</a></b></td><td align="center">57,100</td><td>Das KI-Gateway, dessen öffentlicher Preisdatenbestand unsere Synchronisierung zur Kostenverfolgung speist und dessen Modell zur Anbieter-Normalisierung unser Routing geprägt hat.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/miuuyy/codex-chatgpt-web">codex-chatgpt-web</a></b></td><td align="center">1,410</td><td>MIT-lizenzierter Quellcode, der für die integrierte Brücke von ChatGPT Web zu Codex Responses angepasst wurde, einschließlich Adaptern für Browsersitzungen, Antwortformatierung, Nutzung und Websuche.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/Alishahryar1/free-claude-code">free-claude-code</a></b></td><td align="center">48,112</td><td>Muster, die in die Stream-Wiederherstellung, Aliasse ohne Denkmodus, die ersatzweise Websuche, Sliding-Window-Limits, die Schwärzung von Protokolldaten und gehärtete Startabläufe portiert wurden.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/standardagents/composer-api">composer-api</a></b></td><td align="center">322</td><td>Muster von Cursor Composer für Werkzeugauswahl, Ausgabebeschränkungen und Werkzeugübermittlung, die für den nativen Cursor-Executor angepasst wurden.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ndycode/codex-multi-auth">codex-multi-auth</a></b></td><td align="center">457</td><td>Muster für Neuanmeldung und Refresh-Token-Rotation, die in die erneute Codex-OAuth-Authentifizierung portiert wurden.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ex-machina-co/opencode-anthropic-auth">opencode-anthropic-auth</a></b></td><td align="center">510</td><td>Claude-Code-kompatible Transformationsvorgaben und das Verhalten von Abrechnungs-Headern, die in Pusulas konfigurationsgesteuerter Brücke verallgemeinert wurden.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/520mmxx/grok2api-merged">grok2api-merged</a></b></td><td align="center">2</td><td>Seine Grok-Modellzuordnungen, der Fake-TypeError-Statsig-Generator, Anfrage- und Gerätevorgaben sowie der NDJSON-Antwortprozessor wurden in wesentlichem Umfang für Pusulas Grok-Web-Executor angepasst.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/TQZHR/grok2api">TQZHR/grok2api</a></b></td><td align="center">705</td><td>Die wichtigste transitive Codequelle hinter grok2api-merged; ihre Implementierungen für Modelle, Header, Nutzlasten, Statsig und Prozessoren bleiben in der Entwicklungslinie von Grok Web erhalten.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/chenyme/grok2api">chenyme/grok2api</a></b></td><td align="center">7,520</td><td>Der zugrunde liegende MIT-lizenzierte Quellcode für Grok-Nutzlast- und Gerätevorgaben, den Statsig-Generator und den über TQZHR und grok2api-merged übernommenen <code>result.response</code>-Prozessor.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/miuzhaii/grok2api-pro">grok2api-pro</a></b></td><td align="center">27</td><td>Eine transitive Quelle, die von grok2api-merged für dessen Proxy-Pool-Schicht genannt wird; Pusula bewahrt diesen Herkunftshinweis, beansprucht jedoch keine Portierung des Proxy-Pools in seinem klar abgegrenzten Grok-Web-Executor.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/CNFlyCat/GrokProxy">GrokProxy</a></b></td><td align="center">50</td><td>Sein Cookie-authentifizierter Grok-Proxy und sein Streaming-Muster mit <code>result.response.token</code> dienten als Grundlage für Pusulas Grok-Web-Transport.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/lianying1716/GrokBridge">GrokBridge</a></b></td><td align="center">5</td><td>Bei der ursprünglichen Grok-Web-Implementierung wurde dessen HTTP-/Browser-Upstream-Design herangezogen; da sein direkter HTTP-Pfad von GrokProxy abgeleitet ist, wird keine eigenständige Codeportierung beansprucht.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/imjustprism/grok-web-api">grok-web-api</a></b></td><td align="center">14</td><td>Seine Rust-Schemas für <code>ChatOptions</code> und Antwortumschläge dienten als Grundlage für Pusulas TypeScript-Typen für Grok-Anfragen und Streaming-Antworten.</td></tr>
</table>

### 🗜️ Kontext- und Token-Komprimierung — Engines

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/JuliusBrussee/caveman">Caveman</a></b></td><td align="center">100,538</td><td>Das virale „warum viele Token verwenden, wenn wenige Token reichen“-Projekt — seine Höhlenmenschen-Sprech-Philosophie bildet die Grundlage unseres Standardkomprimierungsmodus und von mehr als 30 Regeln zur Entfernung von Füllwörtern und zur Verdichtung.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/rtk-ai/rtk">RTK – Rust Token Killer</a></b></td><td align="center">77,185</td><td>Hochleistungsfähige Komprimierung von Befehlsausgaben — inspirierte unsere RTK-Engine, die JSON-Filter-DSL, die Wiederherstellung von Rohausgaben und die gestapelte RTK-→-Caveman-Pipeline.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/headroomlabs-ai/headroom">headroom</a></b></td><td align="center">67,310</td><td>Reversible Kontextkomprimierung (SmartCrusher) — inspirierte unsere <code>headroom</code>-Engine und das <code>ccr</code>-Abrufmarkermuster.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/microsoft/LLMLingua">LLMLingua</a></b></td><td align="center">6,598</td><td>Forschung zur Prompt-Komprimierung (LLMLingua / LLMLingua-2) — inspirierte unsere asynchrone, codesichere und nach dem Fail-open-Prinzip arbeitende <code>llmlingua</code>-Engine.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/atjsh/llmlingua-2-js">llmlingua-2-js</a></b></td><td align="center">31</td><td>Der JS/ONNX-Port (MobileBERT / XLM-RoBERTa), der als Worker-Thread-Backend für unsere LLMLingua-Engine verwendet wird.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/leninejunior/troglodita">Troglodita</a></b></td><td align="center">40</td><td>PT-BR-Tokenkomprimierung — bildet die Grundlage unseres pt-BR-Sprachpakets: Reduzierung von Pleonasmen und Entfernung von Füllwörtern, abgestimmt auf die brasilianisch-portugiesische Grammatik.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/DietrichGebert/ponytail">ponytail</a></b></td><td align="center">108,957</td><td>Der virale „faule Senior-Entwickler“-YAGNI-Coder-Skill — inspirierte unseren <b>less-code</b>-Ausgabestil: Ausrichtung auf die kleinstmögliche funktionierende Änderung, die den _generierten_ Code reduziert (das Pendant auf der Ausgabeachse zu Cavemans knapper Prosa).</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ayghri/i-have-adhd">i-have-adhd</a></b></td><td align="center">23,526</td><td>Sein handlungsorientierter, ADHS-freundlicher Antwortstil wurde für Pusulas prägnanten Ausgabestil in fünf Sprachen adaptiert.</td></tr>
</table>

### 🧩 Kompakte Formate, Token-Forschung & codebewusste Werkzeuge

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/toon-format/toon">TOON</a></b></td><td align="center">25,233</td><td>Token-Oriented Object Notation — sein spaltenorientiertes Modell aus Kopfzeile und Zeilen prägte unsere tabellarische Komprimierungsstufe.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/blackwell-systems/gcf">GCF – Graph Compact Format</a></b></td><td align="center">41</td><td>Sein kompaktes Graphformat und das generische Profildesign flossen in Pusulas tabellarische Komprimierung und das Headroom-Codec-Format ein.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/blackwell-systems/gcf-typescript">gcf-typescript</a></b></td><td align="center">4</td><td>Die MIT-TypeScript-Implementierung, die direkt eingebunden und als generischer Headroom-Profil-Codec erweitert wurde.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ooples/token-optimizer-mcp">token-optimizer-mcp</a></b></td><td align="center">494</td><td>Brotli/SQLite-Cache + sitzungsbezogene Kontextdeltas — inspirierte unsere <code>session-dedup</code>-Engine.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/Mibayy/token-savior">token-savior</a></b></td><td align="center">1,122</td><td>Komprimierung von Bash-Ausgaben + MCP-Profile — inspirierte unsere disziplinierte Abbruchstrategie bei der Komprimierung und die Reduzierung von MCP-Werkzeugmanifesten.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ppgranger/token-saver">token-saver</a></b></td><td align="center">138</td><td>Inhaltsabhängige Ausgabekomprimierung pro Dateityp mit fehlertoleranter Abbruchstrategie — bestätigte unsere typabhängige Weiterleitung und das Überspringen bei zu geringem Gewinn.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/alexgreensh/token-optimizer">token-optimizer</a></b></td><td align="center">1,951</td><td>„Finde die Geister-Token“ — sein Muster aus Auslagerung und wiederherstellbarem Handle prägte unsere Überlegungen zur CCR-Auslagerung.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/Shweta-Mishra-ai/tokenmizer">TokenMizer</a></b></td><td align="center">28</td><td>Eine Blaupause aus Sitzungsgraph und rundenübergreifender Zeilendeduplizierung, die unser session-dedup-Design prägte.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/jessefreitas/OmniCompress">OmniCompress</a></b></td><td align="center">3</td><td>Spaltenorientiertes JSON in Rust + inhaltsadressierter Abruf + nachrichtenübergreifende Deduplizierung — bestätigte das Design unserer <code>headroom</code>/<code>ccr</code>/<code>session-dedup</code>-Engines und die cache-stabile Invariante „die komprimierte Form ist positionsunabhängig“.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/atlassian-labs/mcp-compressor">mcp-compressor</a></b></td><td align="center">113</td><td>Komprimierung von MCP-Werkzeugschemata und -beschreibungen — floss in unsere Kardinalitätsreduktion von MCP-Werkzeugmanifesten ein.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/pdavis68/RepoMapper">RepoMapper</a></b></td><td align="center">197</td><td>Repository-Karten-Rangfolge im Aider-Stil — floss in unsere Erkundung von Repository-Karten und Abrufrangfolgen ein.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/mrsimpson/quiet-shell-mcp">quiet-shell-mcp</a></b></td><td align="center">4</td><td>Deklarative Reduzierung von Shell-Ausgaben über MCP — bestätigte unsere deklarative Komprimierung von Bash-Ausgaben.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/dsherret/ts-morph">ts-morph</a></b></td><td align="center">6,162</td><td>Toolkit für die TypeScript Compiler API — inspirierte unsere parserbasierte Entfernung von Kommentaren, bei der String-, Template- und Regex-Literale erhalten bleiben.</td></tr>
</table>

### 🧠 Speicher & RAG

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/mem0ai/mem0">Mem0</a></b></td><td align="center">63,902</td><td>Universelle Speicherschicht — ihr Proxy-Modell als Schreib-/Lesegrenze prägte unsere Speicherarchitektur.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/letta-ai/letta">Letta (MemGPT)</a></b></td><td align="center">24,382</td><td>Zustandsbehaftete Agenten mit mehrstufigem Speicher — inspirierten unser mehrstufiges Modell für Context Control & Recovery (CCR).</td></tr>
  <tr><td nowrap><b><a href="https://github.com/onestardao/WFGY">WFGY</a></b></td><td align="center">1,781</td><td>Die ProblemMap-Taxonomie von 16 wiederkehrenden RAG-/LLM-Fehlermodi — das gemeinsame Vokabular in unserem Leitfaden zur Fehlerbehebung.</td></tr>
</table>

### 🛰️ Datenverkehrsanalyse, MITM & transparenter Proxy

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/chouzz/llm-interceptor">llm-interceptor</a></b></td><td align="center">66</td><td>Die MITM-Überwachung/-Analyse des Datenverkehrs zwischen Programmierassistenten und LLMs floss in die frühen Anforderungen an den Traffic Inspector ein. Vier zuvor abgeleitete Module — SSE-Zusammenführung, Konversationsnormalisierung, Maskierung geheimer Daten und Header-Bereinigung — wurden durch unabhängige Clean-Room-Implementierungen ersetzt, die auf öffentlichen Protokollstandards basieren. Die beiden Oberflächen für Host-Passthrough (<code>passthrough.ts</code> und <code>_internal/bypass.cjs</code>) bleiben interne Pusula-Implementierungen, die unabhängig klassifiziert sind; sie wurden im Rahmen dieser Ersetzung nicht neu geschrieben.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/InterceptSuite/ProxyBridge">ProxyBridge</a></b></td><td align="center">5,995</td><td>Transparente, prozessbezogene Proxy-Weiterleitung — inspirierte unseren absturzsicheren MITM-Abbau, Socket-Leerlaufzeitüberschreitungen, die Prozesszuordnung über <code>/proc</code> und die TPROXY-Erfassung.</td></tr>
</table>

### 📚 Modelldaten, Observability & Benutzeroberfläche

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/anomalyco/models.dev">models.dev</a></b></td><td align="center">6,555</td><td>Offene Datenbank mit Spezifikationen, Preisen und Fähigkeiten von KI-Modellen — wird nativ mit unserem Modellkatalog synchronisiert.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/xyflow/xyflow">React Flow / xyflow</a></b></td><td align="center">38,108</td><td>Die knotenbasierte Graphbibliothek, auf der unser Compression Studio und Combo/Routing Studio in Echtzeit basieren.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/langchain-ai/langgraph">LangGraph</a></b></td><td align="center">40,314</td><td>Die Live-Visualisierung von Workflow-Graphen in LangGraph Studio inspirierte die Echtzeit-Kaskadenansicht unserer Studios.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/langfuse/langfuse">Langfuse</a></b></td><td align="center">33,592</td><td>Sein Observability-Modell „Trace → Span → Generation“ prägte die Wasserfallansicht unseres Compression Studio.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/kiali/kiali">Kiali</a></b></td><td align="center">3,631</td><td>Observability für Istio-Service-Meshes — inspirierte unsere Circuit-Breaker-Badges und die visuelle Darstellung von Fehlerkanten im Routing/Combo Studio.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/lobehub/lobe-icons">lobe-icons</a></b></td><td align="center">2,428</td><td>KI-/LLM-Markenlogos, die zur Darstellung der Anbieter-Symbole in unserem Dashboard dienen.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/lipis/flag-icons">flag-icons</a></b></td><td align="center">12,354</td><td>Stellt die MIT-lizenzierten SVG-Flaggen bereit, die von der Sprachauswahl in der README verwendet werden.</td></tr>
</table>

### 🛡️ Sicherheit

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/tldrsec/awesome-secure-defaults">awesome-secure-defaults</a></b></td><td align="center">721</td><td>Eine kuratierte Liste standardmäßig sicherer Bibliotheken, die unsere Sicherheitsentscheidungen leitet (Helmet.js, DOMPurify, ssrf-req-filter, safe-regex, Google Tink).</td></tr>
</table>

### 🧭 Ergänzende Werkzeuge

<table>
  <tr><th align="left">Projekt</th><th align="center">⭐</th><th align="left">Wie es Pusula inspiriert hat</th></tr>
  <tr><td nowrap><b><a href="https://github.com/BlockRunAI/ClawRouter">ClawRouter</a></b></td><td align="center">6,564</td><td>Inspirierte die Deduplizierung von Anfragen, einen kostenlosen Notfall-Fallback, austauschbare Auto-Combo-Strategien und die mehrsprachige Absichtsklassifizierung.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/lbjlaq/Antigravity-Manager">Antigravity-Manager</a></b></td><td align="center">30,652</td><td>Seine kontobasierte Modellneuzuordnung, die Validierung ausführbarer Pfade und das Verhalten von Tarifbezeichnungen flossen in die Antigravity-Laufzeitumgebung von Pusula ein.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/jlcodes99/vscode-antigravity-cockpit">vscode-antigravity-cockpit</a></b></td><td align="center">4,817</td><td>Sein kompaktes Countdown-Format für das Zurücksetzen von Kontingenten inspirierte die entsprechende Anzeige von Anbieterlimits in Pusula.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/iOfficeAI/AionUi">AionUi</a></b></td><td align="center">32,230</td><td>Seine ACP-Integrationen inspirierten die automatische Erkennung installierter CLI-Agenten durch Pusula.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/steipete/CodexBar">CodexBar</a></b></td><td align="center">20,507</td><td>Identifizierte die Grok-Build-Kontingentschnittstelle; Pusula überprüfte und korrigierte anschließend das aktuelle Übertragungsformat unabhängig.</td></tr>
</table>

## 📄 Lizenz

MIT-Lizenz – Details finden Sie unter [LICENSE](LICENSE).

---

<div align="center">

**[⬆ Zurück nach oben](#-pusula)** · Mit ❤️ für die Open-Source-KI-Community entwickelt.

<sub>Pusula · Node ≥22.22.2 · MIT-Lizenz · <a href="https://github.com/Ferhat-Yasinoglu/pusula">github.com/Ferhat-Yasinoglu/pusula</a></sub>

</div>
<!-- GitHub Discussions für Fragen und Antworten der Community aktiviert -->
