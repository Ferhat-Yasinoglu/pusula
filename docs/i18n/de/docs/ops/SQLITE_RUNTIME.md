# SQLite Runtime Resolution (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/SQLITE_RUNTIME.md) · 🇮🇷 [fa](../../../fa/docs/ops/SQLITE_RUNTIME.md) · 🇹🇷 [tr](../../../tr/docs/ops/SQLITE_RUNTIME.md)

---

Pusula ermittelt seinen SQLite-Treiber beim Start über eine 5-stufige Fallback-Kette:

1. **Mitgeliefertes `better-sqlite3`** (über `dependencies` in `package.json`)
   — am schnellsten, native Binärdatei, wird durch `npm install` installiert, wenn Build-Werkzeuge vorhanden sind.

2. **Zur Laufzeit installiertes `better-sqlite3`** (in `~/.pusula/runtime/`)
   — wird beim ersten Start **ODER** durch `scripts/build/postinstall.mjs → scripts/postinstall.mjs` verzögert installiert.
   Validiert vor dem Laden die Magic Bytes der nativen `.node`-Datei (ELF / Mach-O / PE),
   um vor beschädigten oder für die falsche Plattform bestimmten Binärdateien zu schützen.

3. **`node:sqlite`** (Node ≥22.5-Standardbibliothek) — kein nativer Build erforderlich; wird verwendet, wenn
   beide better-sqlite3-Pfade fehlschlagen. Eingeschränkter Funktionsumfang.

4. **`sql.js`** (WASM) — letzter Fallback. Funktioniert überall, ist jedoch langsamer
   und schreibt Daten in Intervallen statt synchron.

## Warum diese Komplexität?

- **Windows EBUSY**: `npm install -g pusula@latest` kann fehlschlagen, wenn die
  `better_sqlite3.node`-Datei der vorherigen Version durch einen laufenden Prozess gesperrt ist. Die Laufzeitinstallation
  in `~/.pusula/runtime/` umgeht den globalen npm-Cache.
- **Keine Build-Werkzeuge**: Einige Umgebungen (Unternehmens-Windows ohne VS Build
  Tools, minimale Docker-Images) können `better-sqlite3` nicht kompilieren. Das Laufzeit-Installationsprogramm
  bezieht eine vorkompilierte Binärdatei aus der npm-Registry; die Fallback-
  Treiber stellen sicher, dass Pusula selbst dann noch startet, wenn dies fehlschlägt.
- **Vom Netz getrennte Systeme**: Wenn die npm-Registry nicht erreichbar ist, gewährleisten `node:sqlite`
  oder `sql.js` eine grundlegende Funktionalität.

## Magic-Byte-Validierung

Vor dem Laden einer zur Laufzeit installierten `.node`-Datei liest Pusula die ersten 8
Bytes und gleicht sie mit bekannten plattformspezifischen Magic Bytes ab:

| Plattform              | Bytes (hex)   | Bezeichnung |
| ---------------------- | ------------- | ----------- |
| Linux                  | `7F 45 4C 46` | `elf`       |
| macOS 64-Bit BE        | `FE ED FA CF` | `macho`     |
| macOS 64-Bit LE        | `CF FA ED FE` | `macho-le`  |
| macOS Fat (universell) | `CA FE BA BE` | `macho-fat` |
| Windows                | `4D 5A` (MZ)  | `pe`        |

Nicht übereinstimmende Magic Bytes → Datei wird ignoriert, der Fallback wird mit dem nächsten Schritt fortgesetzt.

## Aktiven Treiber prüfen

```typescript
import { getDriverInfo } from "@/lib/db/core";

const info = getDriverInfo();
// { source: "bundled" | "runtime" | "runtime-installed-now" | "node-sqlite" | "sql-js",
//   kind: "better-sqlite3" | "node-sqlite" | "sql-js" }
```

## Manuelle Steuerung

```bash
# Postinstall-Aufwärmphase überspringen (für schnelle CI-Installationen)
PUSULA_SKIP_POSTINSTALL=1 npm install -g pusula

# better-sqlite3 für die Laufzeit zwangsweise neu installieren
rm -rf ~/.pusula/runtime
pusula  # wird beim nächsten Start neu installiert

# Prüfen, welcher Treiber aktiv ist
pusula config db-info  # (falls der CLI-Befehl vorhanden ist)
```

## Referenz

Implementierung:

- `bin/cli/runtime/magicBytes.mjs` — Hilfsfunktionen zur Validierung binärer Magic Bytes
- `bin/cli/runtime/sqliteRuntime.mjs` — 5-stufiger Laufzeit-Resolver + verzögertes Installationsprogramm
- `bin/cli/runtime/index.mjs` — Start-Orchestrator (`warmUpRuntimes()`)
- `scripts/postinstall.mjs` — npm-Postinstall-Hook (nicht fatale Aufwärmphase)
- `src/lib/db/core.ts` — Exporte von `ensureDbInitialized()` / `getDriverInfo()`

## Single-Writer-Topologie (HA nicht unterstützt)

Die oben beschriebene Treiber-Fallback-Kette läuft weiterhin in **einem Prozess**. Mit dem standardmäßigen SQLite
ist Pusula ein **Single Writer**:

- Verbinden Sie nicht zwei Pusula-Replikate mit derselben `storage.sqlite`-Datei.
- Ein Container-Neustart, ein Recreate-Deployment, ein OOM-Kill oder ein HEALTHCHECK-Neustart beendet
  jede laufende SSE-Sitzung. Im Standardpfad gibt es kein geordnetes Beenden von Sitzungen.
- Eine Orchestrator-Liveness-Prüfung, die ein langsames `/healthz` als Ausfall wertet, beendet das einzige
  Replikat. Bevorzugen Sie TCP-Liveness + HTTP-Readiness über `/healthz`. Siehe
  [Docker-Leitfaden — Verfügbarkeit](../guides/DOCKER_GUIDE.md#availability-default-sqlite-is-single-replica)
  und [Empfehlungen für Kubernetes-Probes](./MONITORING_GUIDE.md#kubernetes-probe-recommendations).
