# Changelog (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../CHANGELOG.md) · 🇮🇷 [fa](../fa/CHANGELOG.md) · 🇹🇷 [tr](../tr/CHANGELOG.md)

---

# Changelog

Alle wesentlichen Änderungen an Pusula werden in dieser Datei festgehalten. Das Format
folgt [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), die Versionen folgen
[Semantic Versioning](https://semver.org/lang/de/).

## [Unreleased]

### ✨ Neue Funktionen

- **feat(access):** Besucher können über das neue Formular „Zugang anfragen“ auf der Startseite (Name, E-Mail, optionaler Grund) Zugang anfragen. Der Betreiber prüft die Anfragen unter API-Verwaltung → Zugangsanfragen; eine Genehmigung erzeugt einen API-Schlüssel mit täglichem und wöchentlichem USD-Limit (Standard $1 / $5) und zeigt ihn einmal zum Weitergeben an. Der öffentliche Endpunkt ist pro Adresse ratenbegrenzt, ignoriert Honeypot-Einsendungen und nimmt ab 200 offenen Anfragen keine neuen mehr an.

### 🔧 CI / Build

- **ci(fly):** Der Workflow `Deploy to Fly.io` wurde entfernt. Ohne `FLY_API_TOKEN` hat er nie deployt, und die öffentliche Instanz läuft auf unserem eigenen Server; bei jedem Push auf `main` lief er also ins Leere.

## [1.0.0] - 2026-10-20

### ✨ Neue Funktionen

- **feat(core):** Erste öffentliche Version von Pusula: ein OpenAI-kompatibler Endpunkt vor Hunderten von KI-Anbietern, mit automatischem Fallback, kontingentbewussten Routing-Strategien und Combos.
- **feat(compression):** Gestapelte Prompt-Kompression mit RTK + Caveman und adaptivem Kontextbudget-Regler.
- **feat(apps):** Dashboard, CLI, MCP/A2A-Server, Desktop-App (Electron) und PWA.
- **feat(i18n):** Oberfläche und Dokumentation auf Englisch, Türkisch, Deutsch und Persisch.
