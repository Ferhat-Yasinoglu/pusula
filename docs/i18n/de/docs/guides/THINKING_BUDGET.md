# Thinking Budget (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/THINKING_BUDGET.md) · 🇮🇷 [fa](../../../fa/docs/guides/THINKING_BUDGET.md) · 🇹🇷 [tr](../../../tr/docs/guides/THINKING_BUDGET.md)

---

> **Dashboard:** Einstellungen → **KI** → Thinking-Budget  
> **API:** `GET` / `PUT` `/api/settings/thinking-budget`  
> **Quelle:** `open-sse/services/thinkingBudget.ts`

Das Thinking-Budget steuert, ob Pusula **die Thinking-/Reasoning-Parameter des Clients umschreibt**, bevor Anfragen an die Provider weitergeleitet werden. Es aktiviert oder deaktiviert **weder** Komprimierung noch Routing oder Prompt-Cache.

## Modi

| Modus                        | Verhalten von Pusula                                                                                              | Verwendungszweck                                                                                                                                                                                  |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **`passthrough`** (Standard) | Lässt Client-Felder unverändert (`reasoning`, `reasoning_effort`, Claude `thinking`, Gemini `thinking_config` usw.). | **Codex / Desktop / jeder Client, der Aufwand und Reasoning-Zusammenfassungen selbst steuern soll.** Erforderlich für sichtbare Thinking-Bereiche, wenn der Client `reasoning.summary` anfordert. |
| **`auto`**                   | **Entfernt alle** Thinking-/Reasoning-Felder aus dem Request-Body, bevor die Anfrage an den Upstream gesendet wird.  | Nur, wenn der **Provider** bewusst Standardwerte festlegen soll und kein clientgesteuertes Thinking benötigt wird. Bedeutet **nicht** „Thinking automatisch anzeigen“.                            |
| **`custom`**                 | Überschreibt jede Anfrage mit einem festen Token-Budget für Thinking.                                                | Harte Obergrenze für Thinking-Tokens im gesamten Datenverkehr.                                                                                                                                    |
| **`adaptive`**               | Skaliert das Budget ausgehend von einem Basisaufwand anhand der Nachrichtenanzahl, der Tools und der Prompt-Länge.   | Flexible Token-Steuerung, ohne die Absicht des Clients vollständig zu verwerfen.                                                                                                                  |

### Was `auto` entfernt

Wenn der Modus `auto` ist, löscht `stripThinkingConfig()` unter anderem:

- OpenAI / Responses: `reasoning`, `reasoning_effort`
- Claude: `thinking` sowie `output_config.effort`, sofern vorhanden
- Gemini: `generationConfig.thinking_config` / `thinkingConfig`

Wenn ein Client (z. B. Codex Desktop) `reasoning: { effort: "ultra", summary: "detailed" }` gesendet hat, **verwirft `auto` dieses Objekt**. Der Upstream kann weiterhin einige Reasoning-Tokens abrechnen, gibt jedoch häufig **leere oder ausschließlich verschlüsselte** Reasoning-Elemente zurück – sodass die Benutzeroberfläche keinen brauchbaren Thinking-Stream anzeigt.

## Was dies **nicht** ist

| Funktion                                           | Beziehung                                                                                                                                 |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Komprimierung** (Caveman, RTK, stacked, …)       | Separate Pipeline. Funktioniert in jedem Thinking-Budget-Modus.                                                                           |
| **Prompt-/semantischer Cache**                     | Separat. Vom Thinking-Budget-Modus nicht betroffen.                                                                                       |
| **Combo-Routing / Fallbacks**                      | Separat. Nicht betroffen.                                                                                                                 |
| **Token-Limits für API-Schlüssel / Kostenbudgets** | Separat. Nicht betroffen.                                                                                                                 |
| **Reasoning-Replay-Cache**                         | Multi-Turn-Wiedereinspeisung für strikte Provider (DeepSeek, Kimi, Qwen-thinking, …). Nicht dasselbe wie „Thinking anzeigen“ in Desktop.  |
| **Entschlüsselung von `encrypted_content`**        | **Unmöglich.** Private Reasoning-Blobs von OpenAI/Codex sind undurchsichtig. Pusula entschlüsselt sie niemals (#7095 / #7176 / #7304). |

## Sichtbarer Denkprozess (Codex-/Responses-Clients)

Damit ein Client den Denktext anzeigen kann, benötigen Sie **alles** Folgende:

1. Thinking-Budget-Modus = **`passthrough`** (oder `custom`/`adaptive`, sofern Zusammenfassungsanforderungen für den verwendeten Pfad ausreichend unverändert bleiben).
2. Der Client fordert eine Zusammenfassung an, z. B. Codex `model_reasoning_summary = "detailed"` / `auto` (nicht `none`).
3. Der Upstream streamt tatsächlich `response.reasoning_summary_text.*` (oder das Element enthält ein nicht leeres `reasoning.summary`).

Wenn Sie nur einen „verschlüsselten privaten Denkprozess“ erhalten, gilt entweder:

- Der Modus war **`auto`** (die Client-Anforderung wurde entfernt), oder
- der Upstream gab `encrypted_content` ohne Zusammenfassungstext zurück (Einschränkung des Anbieters; Pusula kann nur einen Platzhalter anzeigen, keinen Klartext).

## API-Beispiele

```bash
# Lesen
curl -sS https://localhost:20128/api/settings/thinking-budget \
  -H "Authorization: Bearer $PUSULA_TOKEN"

# Empfohlen für die Sichtbarkeit des Denkprozesses in Codex / Desktop
curl -sS -X PUT https://localhost:20128/api/settings/thinking-budget \
  -H "Authorization: Bearer $PUSULA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"passthrough","customBudget":10240,"effortLevel":"medium"}'
```

Schema (`updateThinkingBudgetSchema`): `mode` ∈ `passthrough|auto|custom|adaptive`; optional `customBudget`, `effortLevel`, `baseBudget`, `complexityMultiplier`.

### Persistenz / Neustart

Der Wert wird unter dem Einstellungsschlüssel `thinkingBudget` gespeichert und beim Prozessstart geladen (`hydrateThinkingBudgetConfig`). Starten Sie nach Änderungen über die Datenbank oder bestimmte Pfade außerhalb der API **den Pusula-Prozess neu**, damit der In-Memory-Singleton dem Datenträgerstand entspricht.

## Checkliste für Betreiber

- [ ] Codex-/Desktop-Benutzer: Modus = **passthrough**
- [ ] Lassen Sie die Komprimierung aktiviert, wenn Sie bei **Nachrichten** Tokens sparen möchten, nicht durch das Entfernen des Denkprozesses
- [ ] Erwarten Sie nicht, dass `auto` „mehr Denkprozess anzeigt“
- [ ] Nur verschlüsselte Zusammenfassungen sind ein Verhalten des **Anbieters**; `passthrough` kann sie nicht entschlüsseln

## Zugehörige Dokumentation

- [REASONING_REPLAY.md](../routing/REASONING_REPLAY.md) — mehrstufiger `reasoning_content`-Cache
- [USER_GUIDE.md](./USER_GUIDE.md) — Registerkarten des Einstellungs-Dashboards
- [API_REFERENCE.md](../reference/API_REFERENCE.md) — Einstellungs-Endpunkte
