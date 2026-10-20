# Supply-Chain Gates (Phase 8 · Block A) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../security/SUPPLY_CHAIN.md) · 🇮🇷 [fa](../../../fa/docs/security/SUPPLY_CHAIN.md) · 🇹🇷 [tr](../../../tr/docs/security/SUPPLY_CHAIN.md)

---

Pusula veröffentlicht npm + Docker Artefakte. Diese Gates bieten Provenienz, Inventar (SBOM) und CVE-Scanning, alles OSS, integriert in Release-Workflows.
**Advisory-first**-Haltung — sie melden jetzt, stufen auf blockierend hoch nach dem 1. grünen Release.

| Gate                  | Tool                                           | Wo                            | Blockiert?                            | Ausgabe                                           |
| :-------------------- | :--------------------------------------------- | :---------------------------- | :------------------------------------ | :------------------------------------------------ |
| SLSA Provenienz (npm) | `npm --provenance` (OIDC)                      | `npm-publish.yml`             | nur wenn Veröffentlichung fehlschlägt | Badge npmjs / `npm audit signatures`              |
| SBOM npm              | `@cyclonedx/cyclonedx-npm`                     | `npm-publish.yml`             | nur wenn Generierung fehlschlägt      | Release-Asset + Artefakt                          |
| SBOM Image            | `anchore/sbom-action` (syft)                   | `docker-publish.yml` (merge)  | beratend                              | CycloneDX-Artefakt                                |
| Trivy CVE (SARIF)     | `aquasecurity/trivy-action`                    | `docker-publish.yml` (merge)  | beratend                              | SARIF (HIGH+CRITICAL) → Sicherheits-Tab           |
| Trivy CRITICAL Gate   | `aquasecurity/trivy-action`                    | `docker-publish.yml` (merge)  | **blockierend**                       | `exit-code: '1'` bei behebbarem CRITICAL          |
| osv vulnCount         | `osv-scanner` (`check:vuln-ratchet --ratchet`) | `ci.yml` (`quality-extended`) | **blockierend**                       | rastet `metrics.vulnCount` ein (Richtung:abwärts) |
| OpenSSF Scorecard     | `ossf/scorecard-action`                        | `scorecard.yml` (cron)        | beratend                              | SARIF → Sicherheit + Badge                        |

Die Image-CVE-Ratsche verwendet **zwei Schritte** in `docker-publish.yml`: der SARIF-Schritt
(`HIGH,CRITICAL`, `exit-code: 0`) hält HIGH+CRITICAL im Sicherheits-Tab sichtbar,
ohne zu blockieren; der _CRITICAL Gate_-Schritt (`severity: CRITICAL`, `ignore-unfixed: true`,
`exit-code: 1`) lässt das Release bei einem CRITICAL CVE **mit verfügbarem Fix** fehlschlagen. `ignore-unfixed`
verhindert das Blockieren des Releases für einen Basis-Image-CVE ohne Upstream-Patch.

## ⚠️ CVE-Varianz (blockierende osv/Trivy Gates)

osv und Trivy vergleichen Abhängigkeiten mit CVE-Datenbanken, die **kontinuierlich wachsen**. Ein PR,
der **keine Abhängigkeiten berührt**, kann plötzlich rot werden, weil eine neue CVE
in einer bestehenden Abhängigkeit offengelegt wurde (osv: gemessener `vulnCount` > Baseline; Trivy: ein neuer
behebbarer CRITICAL im Image). **Dies ist ERWARTETES Betriebsverhalten eines blockierenden
CVE-Gates, keine Produktregression.**

Wenn osv oder Trivy aufgrund einer neu offengelegten CVE rot werden, ist die Abhilfe:

1.  **Betroffene Abhängigkeit aktualisieren** (bevorzugt) — Upgrade auf die gepatchte Version über `package.json`
    `overrides` (transitive Abhängigkeiten) oder Neuerstellung des Images auf einer gepatchten Basis.
2.  **Wenn kein Upstream-Fix verfügbar ist:**
    - **osv:** Re-Baseline von `metrics.vulnCount` in `config/quality/quality-baseline.json`
      (`npm run quality:ratchet -- --update` deckt dedizierte Gates nicht ab — Wert manuell bearbeiten,
      `direction:down`) mit einer Begründung + Tracking-Issue.
    - **Trivy:** Eintrag in `.trivyignore` hinzufügen (CVE-ID pro Zeile) mit einem Begründungskommentar
      - Tracking-Issue. `ignore-unfixed: true` deckt CVEs ohne Patches bereits automatisch ab.

Beide Gates **überspringen elegant** (exit 0), wenn das Tool fehlt oder die Messung
fehlschlägt (osv-scanner nicht im PATH, osv.dev/Netzwerk unerreichbar, ungültiges JSON) — ein
**Messfehler** blockiert nie, nur eine **gemessene** Regression blockiert.

## Bekannte akzeptierte Risiken

### extract-zip 2.0.1 — GHSA-7pqw-9j4j-h8q3 / GHSA-jmr9-qjv8-65gv (#14482)

`extract-zip@2.0.1` weist zwei ungepatchte, hochkritische Symlink-Traversal-Sicherheitslücken auf. Gemäß dem oben genannten „keine Upstream-Behebung“-Zweig der CVE-Varianz-Abhilfe ist dies ein **akzeptiertes Risiko**, keine Aktualisierung:

- **Kette:** `promptfoo` (devDependency) → `@openai/codex-security` → `extract-zip@2.0.1`. Bestätigt über `package-lock.json` – genau ein Paket im gesamten Abhängigkeitsbaum (`@openai/codex-security`) deklariert `extract-zip`, und genau ein Paket (`promptfoo`) deklariert `@openai/codex-security`.
- **Keine behobene Version existiert irgendwo in der Kette.** `extract-zip@2.0.1` (veröffentlicht 2020) ist die letzte Veröffentlichung des Pakets – es wird nicht mehr gewartet. `@openai/codex-security`s aktuelle npm-latest (`0.1.29`) zieht immer noch `extract-zip@2.0.1`.
- **Aus der Produktion nicht erreichbar.** `promptfoo` ist nur eine Entwicklungsabhängigkeit (nie unter `dependencies` aufgeführt), und keine Datei unter `src/`, `open-sse/` oder `bin/` importiert das `extract-zip` npm-Paket – Pusulas eigener `extractZip()`-Helfer (`src/lib/versionManager/binaryManager.ts:93`) greift auf native `unzip`/`tar` zurück und ist nicht verwandt. `@openai/codex-security` liefert auch einen eigenen Symlink-Traversal-Schutz zusätzlich zum `onEntry`-Callback von `extract-zip`.
- **Nicht** `extract-zip` über `package.json` `overrides` aliasen – der einzig praktikable Drop-in-Ersatz ist Electron-org-intern und API-inkompatibel mit den eigenen `onEntry`/`defaultDirMode`/`defaultFileMode`-Prüfungen von `@openai/codex-security`; ein Überschreiben würde die Sicherheitsprüfungen dieses Pakets stillschweigend außer Kraft setzen.
- **Baseline:** Der gemessene osv `vulnCount` (3) liegt bereits deutlich unter der eingefrorenen `config/quality/quality-baseline.json`-Baseline (27) – keine Ratschenänderung erforderlich.
- **Regressionsschutz:** `tests/unit/extract-zip-14482-exposure.test.ts` bestätigt die Kette und die oben genannte Invariante des Nicht-Produktionsimports; es lässt CI fehlschlagen, falls eine davon jemals bricht (z.B. ein zukünftiger PR `extract-zip` aus der Produktion erreichbar macht).
- **Verfolgung:** Issue #14482.

## Backlog: Scorecard-Hinweis → blockierend

Nach der 1. grünen Veröffentlichung mit Scorecard-Berichterstattung:

- Scorecard: Score-Ratsche (friert den gemessenen Score ein; kann nicht sinken).

Ergänzt die Phase-7-Gates (osv-scanner, gitleaks, actionlint+zizmor): zizmor prüft die Workflows selbst; Scorecard misst die Repository-Haltung insgesamt.
