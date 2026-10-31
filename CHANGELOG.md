# Changelog

All notable changes to Pusula are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and versions follow
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### 🔧 CI / Build

- **ci(fly):** removed the `Deploy to Fly.io` workflow. It never deployed without a `FLY_API_TOKEN` and the public instance runs on our own server, so it was a no-op on every push to `main`.

## [1.0.0] - 2026-10-20

### ✨ New Features

- **feat(core):** first public release of Pusula — one OpenAI-compatible endpoint in front of hundreds of AI providers, with automatic fallback, quota-aware routing strategies and combos.
- **feat(compression):** RTK + Caveman stacked prompt compression with the adaptive context-budget dial.
- **feat(apps):** dashboard, CLI, MCP/A2A servers, desktop app (Electron) and PWA.
- **feat(i18n):** interface and documentation in English, Turkish, German and Persian.
