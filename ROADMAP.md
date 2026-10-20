---
title: "Pusula Roadmap"
version: 1.0.0
lastUpdated: 2026-10-20
---

# Pusula Roadmap

> Version-gated, not date-gated: a release ships when its quality gates pass.
> Current line: **1.0.0** — the first Pusula release. Last updated: 2026-10-20.

Pusula is a free, MIT-licensed AI gateway maintained by
[Ferhat Yasinoğlu](https://github.com/Ferhat-Yasinoglu). This page lists what shipped in
1.0.0 and where the 1.x line is heading. Ideas and questions go to
[GitHub Discussions](https://github.com/Ferhat-Yasinoglu/pusula/discussions); bugs and
concrete feature requests to
[GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues).

## 1.0.0 — first release

The feature set described in the [README](README.md):

- **One endpoint for every tool** — an OpenAI-, Claude-, Gemini- and Responses-API-compatible
  `/v1` surface for Claude Code, Codex, Cursor, Cline, Copilot, Antigravity and any
  OpenAI-compatible client.
- **Provider catalog** — 350+ registered providers, 150+ of them with free tiers, a documented
  pool-deduplicated free-token budget (`/dashboard/free-tiers`) and a keyless `auto` route that
  answers right after install.
- **Combos & routing** — 19 routing strategies, the 16-factor Auto-Combo engine (`auto`,
  `auto/coding`, `auto/fast`, `auto/cheap`, …) and 4-tier fallback
  (Subscription → API Key → Cheap → Free).
- **Resilience** — provider circuit breakers, per-connection cooldowns and per-model lockouts as
  three independent layers, plus quota-aware scheduling and live quota telemetry.
- **Token compression** — the 12-engine pipeline (Session-Dedup, CCR, Lite, RTK, Responses Tool
  Output, Headroom, Relevance, Caveman, Aggressive, LLMLingua-2, Ultra, OmniGlyph), output
  styles and the adaptive context-budget dial.
- **CLI, MCP & A2A** — an 80+ command CLI with remote mode and scoped tokens, an MCP server
  (stdio / HTTP / SSE) with 110 tools, an A2A agent card, a REST API and webhooks.
- **Private & local-first** — AES-256-GCM encrypted credentials, an authz pipeline, guardrails
  (PII masking, prompt-injection guard, credential masking), opt-in memory and a local SQLite
  audit trail.
- **Runs anywhere** — npm, Docker (AMD64 + ARM64), Electron desktop, Bun, pnpm, Nix, Arch (AUR),
  Podman, Android via Termux and PWA.
- **Four languages** — the dashboard and the README ship in English, Turkish, German and
  Persian.

## 1.x — what comes next

Minor releases on the 1.x line are additive and backward compatible. Focus areas:

| Area                   | Plan                                                                                                                                                                                                        |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Provider catalog**   | Keep the catalog current: add new providers and models, retire dead endpoints, and re-audit free-tier quotas and terms on a regular cadence so the free-token headline stays honest.                        |
| **Documentation**      | Keep the English, Turkish, German and Persian documentation sets in sync (README, guides, dashboard strings) and expand the setup guides for the most-used coding tools.                                     |
| **Desktop builds**     | Publish Electron desktop builds for Windows, macOS and Linux with each release, and make the tray-based always-on gateway the recommended desktop setup.                                                     |
| **Performance**        | Lower startup time and memory footprint, speed up `/v1/models` catalog assembly, reduce streaming latency in the SSE pipeline, and enforce build-size budgets in CI.                                         |
| **Security hardening** | Tighten the authz pipeline and route-guard tiers, broaden guardrail coverage, keep dependencies and supply-chain scans clean, and ship fixes through private security advisories.                            |

Patch releases (1.0.x, 1.1.x, …) carry bug fixes, provider updates and documentation only.

## For contributors

| You are sending…   | Target                                                                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Bug fix / security | the active `release/vX.Y.Z` branch                                                                                                 |
| Provider update    | the active `release/vX.Y.Z` branch                                                                                                 |
| Docs / i18n        | the active `release/vX.Y.Z` branch                                                                                                 |
| New feature        | open a [discussion](https://github.com/Ferhat-Yasinoglu/pusula/discussions) first, then target the active release branch           |

See [CONTRIBUTING.md](CONTRIBUTING.md) for the golden path per change type and
[docs/ops/BRANCHING_MODEL.md](docs/ops/BRANCHING_MODEL.md) for the branching model.
