# agentrouter.org WAF (Web Application Firewall) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../security/AGENTROUTER_WAF.md) · 🇮🇷 [fa](../../../fa/docs/security/AGENTROUTER_WAF.md) · 🇹🇷 [tr](../../../tr/docs/security/AGENTROUTER_WAF.md)

---

Das vorgelagerte Gateway `agentrouter` führt einen schlüsselwortbasierten Inhaltsfilter für
`messages[].content` aus. Der Filter ist teilweise deterministisch (bestimmte
Formulierungen werden immer blockiert) und teilweise probabilistisch
(lastabhängig — nach schnell aufeinanderfolgenden Anfragen wird er
aggressiver und normalisiert sich nach einer Abkühlphase wieder).

Wenn die WAF eine Anfrage blockiert, gibt sie Folgendes zurück:

```
HTTP/1.1 400 Bad Request
{"error":{"code":"content-blocked","message":"content-blocked (request id: ...)","param":"","type":"agent_router_api_error"}}
```

## Umfang des Filters

Die WAF prüft ausschließlich `messages[].content`. Folgendes wird **nicht** geprüft:

- Der `system`-Prompt
- Strukturierte Inhaltsblöcke (`tool_result`, `tool_use`, `thinking`, `image`)
- Die Felder `description` und `input_schema` von Tools
- Anfragemetadaten, Header oder Modell-ID

## Immer blockierte Muster (Groß-/Kleinschreibung wird ignoriert)

| Muster                           | Hinweise                                                          |
| -------------------------------- | ----------------------------------------------------------------- |
| Jede Variante von `Lorem ipsum`  | Das vollständige lateinische Lorem-Vokabular wird blockiert       |
| `language model` (alleinstehend) | „the language model“ und „large language model“ werden zugelassen |
| `virtual assistant`              | „AI assistant“ wird zugelassen                                    |
| `I'm here to help`               | Auch „here to help“ allein wird blockiert                         |
| `Claude, made by Anthropic`      | Nur die vollständige Formulierung                                 |

## Fast immer blockierte Muster

| Muster                                                     | Hinweise                                           |
| ---------------------------------------------------------- | -------------------------------------------------- |
| `placeholder`                                              | Wenn es alleinsteht (nicht etwa als Parametername) |
| `dummy data`                                               | Häufige Seed-Formulierung für Fixtures             |
| `foo bar baz`                                              | Kanonische Platzhalterformulierung                 |
| Wiederholte kurze Tokens (`AAA BBB CCC`, `test test test`) | Erkennung von Keyword-Stuffing                     |

## Verhalten unter Last

Nach ungefähr 5 schnell aufeinanderfolgenden Anfragen innerhalb eines kurzen
Zeitfensters beginnt die WAF, Inhalte zu blockieren, die normalerweise
zugelassen würden. Der Bucket normalisiert sich nach etwa 5–10 Sekunden
Inaktivität. Dabei handelt es sich um denselben an IP-Adresse und Schlüssel
gebundenen Rate-Limiter, der zeitweise `400 content-blocked`-Fehler verursacht,
wenn Claude Code oder Codex CLI mehrere Tool-Aufrufe bzw. Nachrichten
schnell hintereinander sendet.

## Bereits in Pusula umgesetzte Gegenmaßnahmen

1. **`open-sse/services/wafRateLimit.ts`** — ein Burst-Schutz, der zwischen
   ausgehenden Anfragen an eine beliebige `agentrouter:*`-URL einen
   Mindestabstand von 500 ms erzwingt. Dieser Abstand liegt deutlich unterhalb
   der für Menschen wahrnehmbaren Latenz und verhindert, dass die WAF bei
   normalem Datenverkehr aktiviert wird.

2. **`BaseExecutor.WAF_RETRY_CONFIG`** — wenn ein vorgelagertes System
   `400 content-blocked` zurückgibt, wiederholt der Executor die Anfrage an
   dieselbe URL mit exponentiellem Backoff (1,5 s, 3,0 s, maximal 2 Versuche).
   Nach dem Backoff hat sich die WAF normalerweise wieder normalisiert und
   der erneute Versuch ist erfolgreich.

3. **`tests/unit/compression/harness.test.ts`** — das Test-Fixture
   `longInput` wurde von `"lorem ipsum dolor sit amet ".repeat(40)`
   in `"example content for testing purposes ".repeat(40)` geändert. Dadurch
   werden die Dateiinhalte nicht über einen `tool_result`-Block zurückgeleitet
   und lösen die WAF nicht aus, wenn Claude Code diese Datei mit dem Tool
   `Read` liest.

## Hinweise für Prompts und Tool-Ausgaben

Wenn eine Sitzung von Claude Code oder Codex CLI wiederholt auf
`400 content-blocked` stößt, sollten die neueste Benutzernachricht und das
neueste Tool-Ergebnis auf die oben genannten Muster geprüft und entsprechend
umformuliert werden. Häufige Umgehungsmöglichkeiten:

- `Lorem ipsum …` durch `example text …` oder durch den tatsächlichen Inhalt
  ersetzen, den der Test oder das Fixture modellieren soll.
- `placeholder` (wenn es alleinsteht) durch `example value`,
  `sample value` oder den tatsächlichen Wert ersetzen.
- `language model` durch `large language model` oder `the model` ersetzen.
- `dummy data` durch `sample data` oder realistische Seed-Werte ersetzen.
- `I'm here to help` bzw. `here to help` durch eine spezifischere
  Einleitung ersetzen (z. B. „I'll review the file you mentioned“).

## Meldung der Fehlalarme an den vorgelagerten Anbieter

Der aktuelle Filter ist übermäßig aggressiv — er blockiert „Lorem ipsum“ in
`tool_result`-Blöcken, obwohl der Betreiber eindeutig nicht beabsichtigt hat,
einen Prompt einzuschleusen. Betreiber, die eine Behebung an der Quelle
wünschen, sollten sich an `agentrouter.org` wenden und die Fehlalarme melden.
Die obige Sperrliste ist das empirische Ergebnis einer Untersuchung des
vorgelagerten Systems mit Stand vom 2026-08-03.
