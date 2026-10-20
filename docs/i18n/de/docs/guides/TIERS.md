# Pusula Tiers — User Guide (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/TIERS.md) · 🇮🇷 [fa](../../../fa/docs/guides/TIERS.md) · 🇹🇷 [tr](../../../tr/docs/guides/TIERS.md)

---

Pusula organisiert die 352 unterstützten Anbieter in 3 wirtschaftliche Stufen. Jede
Anfrage durchläuft sie der Reihe nach, bis eine erfolgreich beantwortet wird — so
erhalten Sie die günstigste geeignete Antwort, ohne jemals Fallback-Code schreiben zu müssen.

## Stufe 1 — Abonnement

**Anbieter, für die Sie bereits bezahlen.** Pusula nutzt das gesamte Kontingent, bevor
es verfällt.

| Anbieter                          | Warum Stufe 1                                        |
| --------------------------------- | ---------------------------------------------------- |
| Claude Code OAuth                 | Anthropic Pro/Team — Pauschaltarif, oft ungenutzt    |
| OpenAI Codex (ChatGPT-Abonnement) | Plus/Team enthält Codex-Kontingent                   |
| GitHub Copilot                    | Pro Nutzer — Kontingent wird monatlich zurückgesetzt |
| Cursor IDE                        | Kontingent des Pro-Tarifs                            |
| Antigravity / Devin Desktop       | Integrierte Kontingente                              |

**Strategie**: Leiten Sie jede Anfrage, die zu den Stärken des Modells passt, zuerst
hierhin. Der Kontingent-Tracker überwacht bevorstehende Zurücksetzungen, und die
Kombinationsstrategie `reset-aware` priorisiert entsprechend. Um zuerst an Stufe 1
weiterzuleiten und nur dann auf kostenpflichtige Stufen auszuweichen, wenn das Kontingent
erschöpft ist, verwenden Sie die ID `auto/thrifty` — oder `auto/subscription`, um
ausschließlich die im Tarif enthaltene Kapazität zu nutzen und andernfalls kontrolliert
abzubrechen. Siehe
[Abonnementorientiertes Routing](../routing/SUBSCRIPTION_LADDER.md).

## Stufe 2 — Günstig

**Pay-per-Token-Anbieter unter $1/1 Mio. Token.** Reserviert für Aufgaben mit hohem
Volumen oder für den Fall, dass die Kontingente von Stufe 1 ausgeschöpft sind.

| Anbieter                    | Preis (Eingabe/Ausgabe)  | Stärken                     |
| --------------------------- | ------------------------ | --------------------------- |
| DeepSeek V4 Pro             | $0.27 / $1.10 pro 1 Mio. | Code, logisches Denken      |
| GLM-4.5                     | $0.60 / $2.20 pro 1 Mio. | Langer Kontext              |
| MiniMax M1                  | $0.20 / $1.10 pro 1 Mio. | Geschwindigkeit             |
| Qwen Coder                  | $0.30 / $1.20 pro 1 Mio. | Code                        |
| OpenRouter (preisoptimiert) | variabel                 | Über 100 Modelle, dynamisch |

**Strategie**: Die Kombination `cost-optimized` wählt das Modell mit den niedrigsten
Kosten pro Token, das die Funktionsanforderungen der Aufgabe erfüllt (Bildverarbeitung,
JSON-Modus, Tools, maximaler Kontext).

## Stufe 3 — Kostenlos

**Kostenlose Anbieter** — kostenlose Tarife, Guthabenprogramme, tägliche OAuth-Kontingente.

| Anbieter         | Kostenloses Kontingent / Guthaben               |
| ---------------- | ----------------------------------------------- |
| Kiro AI          | Kostenloser Claude-Tarif (großzügige Fair Use)  |
| OpenCode Free    | Keine Authentifizierung, großzügige Ratenlimits |
| Qoder            | Kostenloses OAuth                               |
| Google Vertex AI | $300 Guthaben für neue Konten                   |
| Amazon Q         | Kostenloser Tarif für AWS-Benutzer              |
| Pollinations     | Offene öffentliche API                          |
| Cloudflare AI    | Kostenloser Workers-AI-Tarif                    |

**Strategie**: Die Kombination `auto` mit Budgetobergrenze leitet Anfragen hierhin,
wenn Stufe 1 und 2 fehlschlagen oder wenn `useFreeOnly=true` gesetzt ist. Kostenlose
Anbieter haben häufig strengere Ratenlimits — der Circuit Breaker nimmt sie nach
einer Wartezeit wieder in Betrieb.

## Stufen konfigurieren

Dashboard → **Stufen** → weisen Sie Ihre Anbieter zu. Die Standardwerte (aus `tierDefaults.json`) sind
sinnvoll; bearbeiten Sie sie, wenn Sie bestimmte Abonnements priorisieren oder Anbieter ausschließen möchten.

Die 16-Faktoren-Bewertung von Auto-Combo berücksichtigt ebenfalls die Stufe. Siehe
[`docs/routing/AUTO-COMBO.md`](../routing/AUTO-COMBO.md).

## Telemetrie

Dashboard → **Nutzung** zeigt die pro Stufe und Tag verbrauchten Token. Verwenden Sie diese Ansicht, um:

- zu bestätigen, dass Stufe 1 vollständig genutzt wird (andernfalls verschwenden Sie Abonnementwert)
- zu ermitteln, welche Modelle aus Stufe 2 am häufigsten ausgewählt werden (auf 1–2 konsolidieren)
- zu überprüfen, ob Stufe 3 bei Test- und Explorationsaufgaben Kosten spart

## Häufige Muster

### Ausschließlich kostenlose Verarbeitung

```json
{
  "strategy": "auto",
  "config": { "auto": { "weights": { "costInv": 0.5, "tierPriority": 0.3 } } }
}
```

Bevorzugt stark Stufe 3; verwendet Stufe 2 nur, wenn Stufe 3 nicht verfügbar ist.

### Abonnement zuerst, mit günstigem Fallback

```json
{
  "strategy": "priority",
  "targets": [
    { "provider": "claude-code-oauth", "weight": 1 },
    { "provider": "deepseek", "weight": 1 },
    { "provider": "kiro", "weight": 1 }
  ]
}
```

Explizite geordnete Liste gemäß Stufe 1 → Stufe 2 → Stufe 3.
