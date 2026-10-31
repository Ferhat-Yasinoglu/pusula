# 🐳 Docker Guide — Pusula (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/DOCKER_GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/guides/DOCKER_GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/guides/DOCKER_GUIDE.md)

---

> Vollständige Referenz für die Docker-Bereitstellung. Für einen schnellen Einstieg siehe den [Docker-Abschnitt der README](../README.md#-docker).

## Inhaltsverzeichnis

- [Schnellstart](#quick-run)
- [Mit Umgebungsdatei](#with-environment-file)
- [Docker Compose](#docker-compose)
- [Verfügbare Profile](#available-profiles)
- [Konfiguration von CLI-Tools auf dem Host, wenn Pusula in Docker ausgeführt wird](#configuring-host-cli-tools-when-pusula-runs-in-docker)
- [Redis-Sidecar](#redis-sidecar)
- [Produktions-Compose](#production-compose)
- [Dockerfile-Stufen](#dockerfile-stages)
- [Kritische Umgebungsvariablen](#critical-environment-variables)
- [Docker Compose mit Caddy (HTTPS)](#docker-compose-with-caddy-https-auto-tls)
- [Cloudflare Quick Tunnel](#cloudflare-quick-tunnel)
- [Image-Tags](#image-tags)
- [Dashboard-Aktualisierungen in Docker](#dashboard-updates-in-docker)
- [Verfügbarkeit: Standard-SQLite unterstützt nur eine Replik](#availability-default-sqlite-is-single-replica)
- [Regionale Gemini-Fehler innerhalb von Docker](#gemini-regional-errors-inside-docker)
- [Wichtige Hinweise](#important-notes)

---

## Schnellstart

> **Self-Hosting mit einem einzigen Befehl?** Siehe den
> [Self-Hosting-Leitfaden](../getting-started/SELF_HOST_GUIDE.md) —
> `docker compose -f docker-compose.selfhost.yml up -d` (veröffentlichtes Image +
> Redis, nur über Loopback erreichbar, keine Profilauswahl). Der nachfolgende Schnellstart
> beschreibt die Einzelcontainer-Variante für Benutzer, die Redis bereits an anderer Stelle betreiben.

```bash
docker run -d \
  --name pusula \
  --restart unless-stopped \
  --stop-timeout 40 \
  -p 20128:20128 \
  -v pusula-data:/app/data \
  ferhat-yasinoglu/pusula:latest
```

## Mit Umgebungsdatei

```bash
# Zuerst .env kopieren und bearbeiten
cp .env.example .env

docker run -d \
  --name pusula \
  --restart unless-stopped \
  --stop-timeout 40 \
  --env-file .env \
  -p 20128:20128 \
  -v pusula-data:/app/data \
  ferhat-yasinoglu/pusula:latest
```

## Docker Compose

```bash
# Basisprofil (ohne CLI-Tools)
docker compose --profile base up -d

# CLI-Profil (Claude Code, Codex und OpenClaw integriert)
docker compose --profile cli up -d

# Host-Profil (primär für Linux; bindet CLI-Binärdateien des Hosts schreibgeschützt ein)
docker compose --profile host up -d

# Webprofil (Chromium/Playwright für Websitzungsanbieter)
docker compose --profile web up -d

# CLI und CLIProxyAPI-Sidecar kombinieren
docker compose --profile cli --profile cliproxyapi up -d
```

## Verfügbare Profile

Pusula enthält Compose-Profile für die wichtigsten Bereitstellungsszenarien. Wählen Sie das Profil aus, das zu Ihrer Umgebung passt.

| Profil            | Dienst        | Verwendungszweck                                                                                                                                                    | Befehl                                       |
| ----------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `base` (Standard) | `pusula-base` | Headless-Server/minimale Laufzeitumgebung, keine Anbieter-CLIs enthalten                                                                                            | `docker compose --profile base up -d`        |
| `cli`             | `pusula-cli`  | Agentenbasierte Workflows, die `pusula providers/setup/doctor` und integrierte CLIs (Codex, Claude Code, Droid, OpenClaw) aufrufen                                  | `docker compose --profile cli up -d`         |
| `host`            | `pusula-host` | Linux-Hosts, die durch schreibgeschütztes Einbinden von `~/.local/bin`, `~/.codex`, `~/.claude` usw. einen `network_mode`-ähnlichen Zugriff auf Host-CLIs benötigen | `docker compose --profile host up -d`        |
| `cliproxyapi`     | `cliproxyapi` | Den [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)-Sidecar auf Port `8317` für Upstream-CLI-Proxying ausführen                                         | `docker compose --profile cliproxyapi up -d` |
| `web`             | `pusula-web`  | Websitzungsanbieter, die einen Browser benötigen: `gemini-web`, `claude-web`, `claude-turnstile` (erstellt `runner-web`, Chromium enthalten)                        | `docker compose --profile web up -d`         |

> Mehrere Profile können kombiniert werden: `docker compose --profile cli --profile cliproxyapi up -d`.

## Konfigurieren von Host-CLI-Tools, wenn Pusula in Docker ausgeführt wird

`pusula setup-codex`, `setup-claude`, `config set <tool>` und die Schaltfläche
**Konfiguration speichern** im Dashboard schreiben jeweils Dateien wie `~/.codex/*.config.toml`. Diese Pfade
sind nur auf dem Rechner relevant, auf dem die CLI tatsächlich ausgeführt wird. Werden die Befehle innerhalb
des Containers ausgeführt, landen die Schreibvorgänge im Home-Verzeichnis des Containers (`/home/node` —
das Image wird mit `USER node` ausgeführt), wo keine Host-CLI sie jemals liest und wo sie
verworfen werden, sobald der Container neu erstellt wird.

Pusula erkennt dies und verweigert den Schreibvorgang mit entsprechenden Anweisungen, statt
einen nicht nutzbaren Erfolg zu melden: Die CLI wird mit `2` beendet und die API antwortet mit `422`
und `containerEphemeralTarget: true`.

### Empfohlen: CLI auf dem Host, Pusula in Docker ausführen

Der Container stellt die API bereit; die CLI konfiguriert Ihre Host-Tools.

```bash
docker compose --profile base up -d

npm install -g pusula
pusula connect http://localhost:20128   # CLI auf den Container ausrichten
pusula setup-codex                      # schreibt in das tatsächliche ~/.codex auf Ihrem Host
```

Dies ist die richtige Wahl, wenn Codex, Claude Code, Cursor oder ähnliche Tools auf Ihrem
Laptop ausgeführt werden — was der üblichen Konfiguration entspricht.

### Alternative: Host-Konfigurationsverzeichnisse per Bind-Mount einbinden (`host`-Profil)

Wenn der Container selbst Ihre Host-Konfiguration schreiben soll, binden Sie die
Verzeichnisse ein und lassen Sie `CLI_CONFIG_HOME` auf das Wurzelverzeichnis des Mounts verweisen. Das `host`-Profil
übernimmt dies bereits:

```yaml
environment:
  - CLI_CONFIG_HOME=/host-home
  - CLI_ALLOW_CONFIG_WRITES=true
volumes:
  - ~/.codex:/host-home/.codex:rw
  - ~/.claude:/host-home/.claude:rw
```

Ein Bind-Mount macht den Pfad vertrauenswürdig: Pusula liest
`/proc/self/mountinfo` und erlaubt Schreibvorgänge in eingehängte Pfade (sowie in Verzeichnisse,
deren Unterverzeichnisse Mounts sind, was exakt der oben gezeigten Struktur von `/host-home` entspricht), während
Schreibvorgänge in nicht eingehängte Pfade weiterhin verweigert werden.

### Ausweichoption: Die containerinternen CLIs konfigurieren (sparsam verwenden)

Wenn sich die CLIs tatsächlich innerhalb des Containers befinden (das `cli`-Profil), ist der Schreibvorgang
beabsichtigt. Übergeben Sie `--allow-container-write` an einen beliebigen `setup-*`-Befehl oder setzen Sie
`PUSULA_ALLOW_CONTAINER_CONFIG_WRITE=true` für den Server. Der Schreibvorgang wird
mit einer Warnung fortgesetzt, dass die Änderungen den Container nicht überdauern.

> **Sicherheitswarnung — `cli`-Profil + `docker.sock`-Mount.**
> Das `cli`-Profil bindet `/var/run/docker.sock` per Bind-Mount ein, damit der containerinterne
> automatische Updater den Stack über den Host-Daemon neu erstellen kann
> (`src/lib/system/autoUpdate.ts` prüft, ob dieser Socket vorhanden ist, und überspringt den
> Docker-Pfad, wenn er fehlt). Dieser Socket ist **eine Vertrauensgrenze mit Host-Root-Rechten**:
> Alles, was darauf zugreifen kann, steuert den Docker-Daemon des Hosts als
> root — es kann jeden Container auf dem Host erstellen, untersuchen, stoppen und entfernen.
> Auswirkungen:
>
> 1. **Geben Sie den Port des `cli`-Profils niemals für das Netzwerk frei.** Veröffentlichen
>    Sie ihn unter `127.0.0.1` (`ports: "127.0.0.1:${DASHBOARD_PORT:-20128}:..."`)
>    — ein im LAN erreichbares `cli`-Profil macht jede RCE auf Dashboard-Ebene zu einer
>    vollständigen Kompromittierung des Hosts.
> 2. **Binden Sie keine zusätzlichen Host-Verzeichnisse in das `cli`-Profil ein.**
>    Der Docker-Socket zusammen mit jedem weiteren Mount gewährt dem Container vollständigen
>    Lese-/Schreibzugriff auf Ihr Dateisystem und Ihre Host-Konfiguration. Wenn ein Tool
>    auf ein Projekt zugreifen muss, führen Sie es lokal mit dem CLI-Binary aus — binden Sie es nicht
>    in den `cli`-Container ein.
>
> Wenn Sie keine containerinterne automatische Aktualisierung benötigen, lassen Sie das `cli`-Profil deaktiviert
> (`COMPOSE_PROFILES=core,redis` oder kürzer). Die anderen Profile binden
> den Docker-Socket nicht ein.
>
> Siehe `docs/security/MITM-TPROXY-DECRYPT.md` (git; nicht in `/docs` kompiliert) für das zugehörige Bedrohungsmodell
> rund um MITM sowie `docs/security/SUPPLY_CHAIN.md` für die
> Herkunftskette der Binärdateien `codex`/`claude-code`/`droid`/`openclaw`.

## Redis-Sidecar

Pusula verwendet Redis als Backend für den verteilten Rate-Limiter und den gemeinsam genutzten Cache. Der Dienst `redis` ist in `docker-compose.yml` **immer definiert** (er ist an kein Profil gebunden) und wird zusammen mit jedem anderen Profil gestartet.

| Detail                        | Wert                                          |
| ----------------------------- | --------------------------------------------- |
| Image                         | `redis:7-alpine`                              |
| Containername                 | `pusula-redis`                                |
| Interner Port                 | `6379`                                        |
| Host-Port (überschreibbar)    | `REDIS_PORT` (Standardwert: `6379`)           |
| Host-Bindung (überschreibbar) | `REDIS_BIND_HOST` (Standardwert: `127.0.0.1`) |
| Volume                        | `pusula-redis-data` → `/data`                 |
| Healthcheck                   | `redis-cli ping` (10-Sekunden-Intervall)      |

Zugehörige Umgebungsvariablen:

- `REDIS_URL` — in die Anwendung injizierte Verbindungszeichenfolge (standardmäßig `redis://redis:6379`).
- `REDIS_PORT` — hostseitige Portzuordnung für den Redis-Container.
- `REDIS_BIND_HOST` — Host-Schnittstelle, auf der der Port veröffentlicht wird. Standardmäßig `127.0.0.1`.

> **Warum standardmäßig Loopback verwendet wird:** Der Sidecar wird ohne `requirepass`
> ausgeführt, und die Anwendungscontainer erreichen ihn über das Compose-Netzwerk
> (`redis:6379`) — der veröffentlichte Port ist nur für hostseitige Werkzeuge
> (`redis-cli`, ein lokales `npm run dev`) vorgesehen. Eine Veröffentlichung auf
> `0.0.0.0` würde eine nicht authentifizierte Redis-Instanz für jeden Host in Ihrem LAN
> zugänglich machen. Wenn Sie `REDIS_BIND_HOST=0.0.0.0` festlegen, fügen Sie außerdem
> `--requirepass` zum `command:` des Dienstes hinzu.

Das **Deaktivieren von Redis** wird nicht empfohlen (der Rate-Limiter wechselt auf einen speicherinternen Fallback mit eingeschränkter Funktionalität). Falls es dennoch erforderlich ist, entfernen Sie entweder den Dienstblock `redis:` aus `docker-compose.yml` bzw. kommentieren Sie ihn aus, oder skalieren Sie ihn auf null:

```bash
docker compose up -d --scale redis=0
```

## Produktions-Compose

Verwenden Sie `docker-compose.prod.yml` für einen isolierten Produktions-Snapshot, der parallel zur Entwicklungsumgebung ausgeführt wird.

| Detail                         | Wert                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------------------- |
| Datei                          | `docker-compose.prod.yml`                                                                         |
| Standardmäßiger Dashboard-Port | `PROD_DASHBOARD_PORT=20130` (dem internen `${DASHBOARD_PORT:-20128}` zugeordnet)                  |
| Standardmäßiger API-Port       | `PROD_API_PORT=20131`                                                                             |
| Image                          | `pusula:prod` (aus dem Target `runner-cli` erstellt)                                              |
| Redis-Container                | `pusula-redis-prod` (`redis:8.6.2`, dediziertes Volume `redis-prod-data`)                         |
| Daten-Volume                   | `pusula-prod-data` (benannt, bleibt über Neuerstellungen hinweg erhalten)                         |
| Healthchecks                   | `node healthcheck.mjs` + `redis-cli ping`, wobei `depends_on` vom Redis-Integritätsstatus abhängt |

Verwendung:

```bash
# Produktions-Stack erstellen und starten
docker compose -f docker-compose.prod.yml up -d --build

# Logs fortlaufend anzeigen
docker compose -f docker-compose.prod.yml logs -f

# Herunterfahren (Volumes beibehalten)
docker compose -f docker-compose.prod.yml down
```

Der Produktions-Stack wird parallel zum Entwicklungs-Compose ausgeführt (mit unterschiedlichen Containernamen, Ports und Volumes), sodass Sie lokal weiterarbeiten können, während die Produktionsumgebung aktiv bleibt.

## Dockerfile-Stages

Das Repository enthält ein mehrstufiges Dockerfile (`Dockerfile`). Vier Stages stehen zur Verfügung; wählen Sie das passende `target` für Ihren Anwendungsfall.

| Stage         | Basis-Image           | Zweck                                                                                                                                                                                                                                                                                                                           |
| ------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `builder`     | `node:26-trixie-slim` | Installiert Abhängigkeiten (`npm ci --legacy-peer-deps`) und führt `npm run build` aus (standardmäßig Turbopack — siehe „Ressourcen zur Build-Zeit“ weiter unten)                                                                                                                                                               |
| `runner-base` | `node:26-trixie-slim` | Produktionslaufzeitumgebung mit der eigenständigen Next.js-Ausgabe. **Keine Anbieter-CLIs enthalten.**                                                                                                                                                                                                                          |
| `runner-cli`  | `runner-base`         | Fügt `git`, `docker.io`, `docker-compose` und globale CLIs hinzu: `@openai/codex`, `@anthropic-ai/claude-code`, `droid`, `openclaw`. **Wählen Sie dies für agentenbasierte Workflows.**                                                                                                                                         |
| `runner-web`  | `runner-base`         | Fügt Playwright und einen Chromium-Browser (`--with-deps`) für Websitzungsanbieter hinzu: `gemini-web`, `claude-web`, `claude-turnstile`. **Wählen Sie dies, wenn Sie diese Anbieter verwenden** — ohne diese Erweiterung schlägt das einfache Image zur Anfragezeit fehl (siehe den Hinweis zu `-web` unter „Release-Kanäle“). |

Ein bestimmtes Target manuell bauen:

```bash
docker build --target runner-base -t pusula:base .
docker build --target runner-cli  -t pusula:cli  .
docker build --target runner-web  -t pusula:web  .
```

### Ressourcen zur Build-Zeit

Drei Build-Argumente steuern den Ressourcenbedarf des `builder`-Stages. Sie gelten ausschließlich zur Build-Zeit —
`PUSULA_MEMORY_MB` (weiter unten) ist eine separate Laufzeitoption.

| Build-Argument           | Standardwert | Auswirkung                                                                                            |
| ------------------------ | ------------ | ----------------------------------------------------------------------------------------------------- |
| `PUSULA_USE_TURBOPACK`   | `0`          | `0` baut mit webpack: geringerer Spitzenspeicherbedarf, aber langsamer. `1` aktiviert Turbopack.      |
| `PUSULA_BUILD_MEMORY_MB` | `6144`       | Obergrenze für den V8-Heap (`--max-old-space-size`) des gestarteten `next build`.                     |
| `PUSULA_BUILD_WORKERS`   | `2`          | Setzt `CIRCLE_NODE_TOTAL`; Next leitet daraus `workers = N - 1` für die Erfassung der Seitendaten ab. |

`PUSULA_BUILD_WORKERS` sollten Sie auf einem leistungsstarken Builder erhöhen und
bei einem fehlgeschlagenen ressourcenbeschränkten Build als Ursache vermuten, wenn dieser **nach**
`✓ Compiled successfully` abbricht. Jeder Seitendaten-Worker ist ein eigener Prozess,
ebenso wie der übergeordnete `next build`-Prozess selbst; eine Live-Reproduktion auf
einem VPS (Issue #7518) maß für jeden Prozess unabhängig vom Heap-Flag in
`NODE_OPTIONS` einen maximalen RSS von ~4,5 GB (Turbopack kompiliert in
nativem/Rust-Speicher außerhalb des V8-Heaps). Der Standardwert `2` (→ 1 Worker,
insgesamt 2 Prozesse) ist für die von der Veröffentlichungs-Pipeline verwendeten,
von GitHub gehosteten Runner mit 16 GB / 4 vCPUs ausgelegt. Bei `8` (→ 7 Worker)
ging diesem Runner der Arbeitsspeicher aus, und buildkit ließ den Schritt mit
`ResourceExhausted: ... cannot allocate memory` fehlschlagen; `3` (→ 2 Worker)
passte ebenfalls nicht mehr, nachdem der RSS pro Prozess direkt gemessen statt
abgeleitet worden war. `tests/unit/docker-build-memory-budget.test.ts` führt die
Berechnung anhand des gemessenen Werts durch und schlägt fehl, wenn eine der
beiden Einstellungen die Kapazität des Runners überschreitet.

Turbopack kompiliert in nativem Rust-Speicher, der **außerhalb** des V8-Heaps liegt,
sodass `PUSULA_BUILD_MEMORY_MB` diesen nicht begrenzt. Auf einem Host mit einer
Speicherobergrenze wird der Build dann vom OOM-Killer per SIGKILL beendet, ohne
jeglichen Fehlertext — er stoppt einfach mitten in `Creating an optimized production build`,
was eher wie ein Hängenbleiben als wie ein Speichermangel wirkt. Deshalb verwendet
das `Dockerfile` standardmäßig webpack (`PUSULA_USE_TURBOPACK=0`), anders als
`npm run dev` / `npm run build`, bei denen Turbopack standardmäßig im Code aktiviert
ist: Ein einfaches `docker build .` ohne Build-Argumente (wie es Railway und andere
One-Click-Hosts ausführen) darf auf einem speicherbegrenzten Builder nicht lautlos
abbrechen. Die veröffentlichten Images übergeben bereits explizit
`PUSULA_USE_TURBOPACK=0` in `docker-publish.yml`. Auf einem Builder mit reichlich
Arbeitsspeicher können Sie Turbopack für einen schnelleren Build aktivieren:

```bash
docker build --target runner-base \
  --build-arg PUSULA_USE_TURBOPACK=1 \
  -t pusula:base .
```

`webpackBuildWorker` ist aktiviert, sodass `next build` einen übergeordneten Prozess
**und** einen Worker-Prozess ausführt und jeder `PUSULA_BUILD_MEMORY_MB` separat
berücksichtigt. Legen Sie die Speicherobergrenze des Containers auf etwas mehr als
das Doppelte dieses Werts fest, nicht nur auf den einfachen Wert.

Auf diesem Quellstand gemessen (`--target runner-base`, `PUSULA_BUILD_MEMORY_MB=6144`):

| Bundler   | Container-Obergrenze | Ergebnis                              |
| --------- | -------------------- | ------------------------------------- |
| Turbopack | 8 GiB / 16 GiB       | bei beiden lautlos durch OOM beendet  |
| webpack   | 8 GiB                | Build-Worker per SIGKILL beendet      |
| webpack   | 12 GiB               | erfolgreich, Spitzenwert bei 11,1 GiB |

### Laufzeitstandardwerte

Von `runner-base` exportierte Standardwerte: `PORT=20128`, `HOSTNAME=0.0.0.0`, `PUSULA_MEMORY_MB=1024`, `NODE_OPTIONS=--max-old-space-size=1024`, `DATA_DIR=/app/data`, `PUSULA_MIGRATIONS_DIR=/app/migrations`.

Speicherverhalten in Docker:

- Das Image setzt `PUSULA_MEMORY_MB=1024` und leitet daraus `NODE_OPTIONS=--max-old-space-size=1024` ab.
- Der eigentliche Serverprozess wird vom Standalone-Launcher gestartet, der `PUSULA_MEMORY_MB` liest und `--max-old-space-size=<PUSULA_MEMORY_MB>` anhängt.
- Node verwendet bei mehrfach angegebenem `--max-old-space-size` den letzten Wert. Daher steuert `PUSULA_MEMORY_MB` das effektive Docker-Heap-Limit.
- Da das Image diesen Wert immer setzt, greift der RAM-basierte Fallback des Launchers unter Docker nie. Erhöhen Sie ihn explizit entsprechend der Arbeitslast (siehe Tabelle unten). `2048` ist für `/v1/responses` von Coding-Agenten weiterhin zu klein.

### Laufzeit-RAM für Coding-Agenten

Der Docker-Standardwert von 1 GiB ist eine Untergrenze für das Dashboard und einfache Chats, keine Größe für den Produktionseinsatz. Lange `POST /v1/responses`-Bodies (Hunderte Nachrichten, Dutzende Tools) halten während der Komprimierung mehrere In-Memory-Graphen vor. Zwei sich überschneidende Anfragen mit jeweils ~3 MiB bzw. ~750k Token haben V8 bei einem Old-Space von **12 GiB** zum Abbruch gebracht (`FATAL ERROR: Reached heap limit`) und außerdem ein cgroup-OOM bei 16 GiB ausgelöst. Siehe [#7849](https://github.com/Ferhat-Yasinoglu/pusula/issues/7849).

Dimensionieren Sie den **cgroup-Speicher mit `--memory` oberhalb des Heaps** — native Puffer, SQLite und Zwischenwerte der Komprimierung befinden sich außerhalb von V8.

| Arbeitslast                                 | `PUSULA_MEMORY_MB`          | Container / cgroup       | Hinweise                                                                                                                             |
| ------------------------------------------- | --------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Dashboard, ein einfacher Chat               | `1024` (Image-Standardwert) | ≥2 GiB                   |                                                                                                                                      |
| Ein Coding-Agent (Claude/Codex/Grok)        | `8192`                      | ≥10 GiB                  | Typische `/v1/responses`-Einzelsitzung                                                                                               |
| Zwei gleichzeitige lange `/v1/responses`    | `10240`–`12288`             | ≥12–16 GiB               | Gemessener V8-Abbruch bei ~12 GiB Heap                                                                                               |
| Drei oder mehr gleichzeitige lange Kontexte | nicht in einem Prozess      | serialisieren / mehr RAM | Standardmäßig ist eine rechenintensive Anfrage gleichzeitig zugelassen; eine Erhöhung ohne zusätzlichen RAM führt erneut zum Abbruch |

`pusula serve` auf Bare Metal kalibriert auf ~35 % des RAM (begrenzt auf `[512, 4096]`), wenn `PUSULA_MEMORY_MB` **nicht gesetzt** ist. Docker setzt immer `1024`, daher wird diese Kalibrierung im offiziellen Image nie ausgeführt.

```bash
docker run -d --name pusula --restart unless-stopped --stop-timeout 40 \
  -e PUSULA_MEMORY_MB=8192 --memory=10g \
  -p 127.0.0.1:20128:20128 -v pusula-data:/app/data ferhat-yasinoglu/pusula:latest
```

## Kritische Umgebungsvariablen

Über die in [ENVIRONMENT.md](../reference/ENVIRONMENT.md) dokumentierten Standardwerte hinaus sind die folgenden Variablen beim Betrieb unter Docker besonders wichtig:

| Variable                      | Zweck                                                                                                                                                                                                                                                                             | Standard                              |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `PUSULA_WS_BRIDGE_SECRET`     | Gemeinsames Geheimnis für die WebSocket-Bridge. **In der Produktion erforderlich** — auf eine starke zufällige Zeichenfolge setzen.                                                                                                                                               | nicht gesetzt (muss angegeben werden) |
| `REDIS_URL`                   | Verbindungszeichenfolge für das Backend des Rate-Limiters/Caches                                                                                                                                                                                                                  | `redis://redis:6379`                  |
| `REDIS_PORT`                  | Hostseitiger Port für den mitgelieferten Redis-Container                                                                                                                                                                                                                          | `6379`                                |
| `REDIS_BIND_HOST`             | Hostschnittstelle, an der der Port des mitgelieferten Redis-Containers veröffentlicht wird (Loopback, sofern Sie nicht AUTH hinzufügen)                                                                                                                                           | `127.0.0.1`                           |
| `AUTO_UPDATE_HOST_REPO_DIR`   | Hostpfad, der für Self-Update-Workflows im Profil `cli` unter `/workspace/pusula` eingehängt wird                                                                                                                                                                                 | `.` (aktuelles Verzeichnis)           |
| `PUSULA_MEMORY_MB`            | Obergrenze des Node-Heaps zur Laufzeit für den eigenständigen Docker-Server; überschreibt den obigen Standardwert des Images. Coding-Agenten: `8192`+ (siehe [Laufzeit-RAM](#runtime-ram-for-coding-agents)).                                                                     | `1024`                                |
| `DASHBOARD_PORT` / `API_PORT` | Überschreibt die veröffentlichten Ports für Dashboard (20128) und API (20129)                                                                                                                                                                                                     | `20128` / `20129`                     |
| `APP_BIND_HOST`               | Hostschnittstelle, an der docker-compose die Dashboard-/API-/Live-WS-Ports veröffentlicht. Bei `REQUIRE_API_KEY=false` (Standard) macht `0.0.0.0` den anonymen `/v1`-Proxy im LAN zugänglich — nur mit `REQUIRE_API_KEY=true` oder einem vorgeschalteten Reverse-Proxy erweitern. | `127.0.0.1`                           |
| `CLIPROXY_BIND_HOST`          | Hostschnittstelle, an der docker-compose den Sidecar `cliproxyapi` veröffentlicht — sein Daten-Volume enthält die Anmeldedaten des Providers.                                                                                                                                     | `127.0.0.1`                           |
| `PUSULA_PLUGINS_DIR`          | Verzeichnis, das der Laufzeit-Plugin-Scanner liest und in dem er installiert. Festlegen, wenn Plugins per Bind-Mount eingebunden werden: Der Standardwert folgt `HOME`, das ein Image nicht zwingend exportiert.                                                                  | `~/.pusula/plugins`                   |
| `PUSULA_BASE_PATH`            | URL-Unterpfad, wenn die App hinter einem Reverse-Proxy veröffentlicht wird (z. B. `/pusula`)                                                                                                                                                                                      | _(leer = Stammverzeichnis)_           |
| `NEXT_PUBLIC_BASE_URL`        | Öffentlicher Browser-Ursprung einschließlich des Unterpfads (z. B. `https://host/pusula`)                                                                                                                                                                                         | nicht gesetzt                         |
| `PROD_DASHBOARD_PORT`         | Hostseitiger Dashboard-Port für `docker-compose.prod.yml`                                                                                                                                                                                                                         | `20130`                               |
| `CLIPROXYAPI_PORT`            | Hostseitiger Port für den Sidecar `cliproxyapi`                                                                                                                                                                                                                                   | `8317`                                |

## Reverse-Proxy auf einem Unterpfad (Traefik / nginx)

Der Next.js-`basePath` wird in das Standalone-Bundle kompiliert. Pusula speichert den fest
eingebetteten Wert in einer Sentinel-Datei im Stammverzeichnis der App (geschrieben während
`npm run build`; gelesen von `scripts/docker/ensure-docker-base-path.mjs`) und vergleicht ihn
beim Start des Containers mit `PUSULA_BASE_PATH`. Wenn die Werte voneinander abweichen und
das Image für den Domain-Stammpfad gebaut wurde, schreibt der Entrypoint die Standalone-Manifeste,
die eingebetteten `basePath`-/`assetPrefix`-Literale (Next 16 generiert SSR-Asset-URLs
ausschließlich aus `assetPrefix` — der Patcher übernimmt den Unterpfad auch dort hinein), die
fest eingebetteten `/_next/static`-Asset-URLs (Client-Reference-Manifeste, Medienimporte,
vorgerenderte Fehlerseiten) und den clientseitigen `process.env`-Shim um, bevor
`node dev/run-standalone.mjs` ausgeführt wird.

### Compose-Build (empfohlen)

Setzen Sie beide Variablen in `.env` und erstellen Sie das Image anschließend neu, damit
Image und Laufzeitumgebung übereinstimmen:

```bash
# .env
PUSULA_BASE_PATH=/pusula
NEXT_PUBLIC_BASE_URL=https://myhostname.example.com/pusula
```

```bash
docker compose --profile base up -d --build
```

`docker-compose.yml` leitet `PUSULA_BASE_PATH` sowohl als Docker-Build-Argument als
auch als Laufzeit-Umgebungsvariable weiter.

### Vorgefertigtes Root-Image + Laufzeit-Unterpfad

Veröffentlichte `ferhat-yasinoglu/pusula:*`-Images werden für den Domain-Stammpfad gebaut.
Sie können `PUSULA_BASE_PATH` dennoch zur Laufzeit setzen; der Container patcht das
Bundle beim Start einmalig. Kombinieren Sie dies mit dem passenden öffentlichen Ursprung:

```yaml
services:
  pusula:
    image: ferhat-yasinoglu/pusula:latest
    environment:
      PUSULA_BASE_PATH: /pusula
      NEXT_PUBLIC_BASE_URL: https://myhostname.example.com/pusula
```

Konfigurieren Sie den Reverse-Proxy so, dass er den **vollständigen** externen Pfad
weiterleitet (entfernen Sie das Präfix nicht). Traefik sollte `PathPrefix(`/pusula`)`
ohne `StripPrefix` an den Container weiterleiten, sodass Next.js
`/pusula/...` empfängt und Assets unter `/pusula/_next/...` bereitstellt.

Der Docker-Healthcheck prüft den schlanken Lifecycle-Endpunkt `/healthz`, dem der aktive
`PUSULA_BASE_PATH` vorangestellt wird. `/api/monitoring/health` bleibt für die
Diagnose durch Benutzer oder Dashboards verfügbar. Um den Container-HEALTHCHECK wieder
darauf auszurichten (beispielsweise zur Durchsetzung einer umfassenden
Zustandsprüfung), setzen Sie
`PUSULA_HEALTHCHECK_PATH=/api/monitoring/health`. Dieser Pfad führt eine
**umfassende** Prüfung durch (Datenbank + Monitoring-Zusammenfassung) — geeignet für
Dockers selten ausgeführten `HEALTHCHECK`, wenn Sie sich dafür entscheiden, jedoch
**nicht** für die Intervalle einer Kubernetes-`livenessProbe`.

Für Orchestratoren (Kubernetes, Nomad usw.):

| Probe           | Bevorzugen                                                         | Vermeiden                                                          |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Liveness        | HTTP `GET /livez` oder TCP am Hauptport (`PORT`, Standard `20128`) | `/api/monitoring/health` als Liveness-Prüfung                      |
| Readiness       | HTTP `GET /healthz`                                                | Kurze Timeouts, die eine ausgelastete Event-Loop als tot einstufen |
| Deep / Blackbox | `/api/monitoring/health`                                           | —                                                                  |

`/healthz` meldet den Prozess-Lifecycle (`ok` / `starting` / `stopping`). `/livez`
prüft lediglich, ob der Prozess aktiv ist (200, wann immer der Handler ausgeführt werden
kann; der Endpunkt wartet nicht auf die Betriebsbereitschaft). Beide laufen weiterhin
auf derselben Node-Event-Loop wie die Anfrageverarbeitung, sodass CPU-intensive
Katalog- oder Komprimierungsarbeiten sie verzögern können — ausgelastet ≠ tot.
Bevorzugen Sie TCP-Liveness-Prüfungen, wenn HTTP-Probes einen Timeout erreichen.
Vollständige Hinweise zu Probes:
[Monitoring-Leitfaden — Empfehlungen für Kubernetes-Probes](../ops/MONITORING_GUIDE.md#kubernetes-probe-recommendations).

## Docker Compose mit Caddy (automatisches HTTPS-TLS)

Pusula kann mithilfe der automatischen SSL-Bereitstellung von Caddy sicher veröffentlicht werden. Stellen Sie sicher, dass der DNS-A-Eintrag Ihrer Domain auf die IP-Adresse Ihres Servers verweist.

```yaml
services:
  pusula:
    image: ferhat-yasinoglu/pusula:latest
    container_name: pusula
    restart: unless-stopped
    volumes:
      - pusula-data:/app/data
    environment:
      - PORT=20128
      # Für den Browser sichtbarer Ursprung für OAuth-Callbacks, Dashboard-Links und generierte öffentliche URLs.
      - NEXT_PUBLIC_BASE_URL=https://your-domain.com
      # Interne Server-zu-Server-URL für geplante Aufgaben und Selbstabfragen.
      - BASE_URL=http://pusula:20128
      - AUTH_COOKIE_SECURE=true

  caddy:
    image: caddy:latest
    container_name: caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    command: caddy reverse-proxy --from https://your-domain.com --to http://pusula:20128

volumes:
  pusula-data:
```

Caddy setzt die standardmäßigen Weiterleitungs-Header für den Upstream-Container. Pusula verwendet
`NEXT_PUBLIC_BASE_URL` als kanonischen öffentlichen Ursprung für OAuth-Callbacks und generierte öffentliche
Links; authentifizierte Schreibvorgänge im Dashboard verwenden Same-Origin-Anfragen sowie sitzungsgebundenen CSRF-
Schutz. Aktivieren Sie `PUSULA_TRUST_PROXY` nur für erweiterte Bereitstellungen, bei denen Pusula den
öffentlichen Ursprung bewusst aus vertrauenswürdigen weitergeleiteten Headern statt aus einer expliziten
Konfiguration ableiten soll.

## Cloudflare Quick Tunnel

Die Dashboard-Unterstützung für Docker-Bereitstellungen umfasst unter `Dashboard → Endpoints` einen **Cloudflare Quick Tunnel** mit nur einem Klick. Bei der ersten Aktivierung wird `cloudflared` nur bei Bedarf heruntergeladen, ein temporärer Tunnel zu Ihrem aktuellen `/v1`-Endpunkt gestartet und die generierte URL `https://*.trycloudflare.com/v1` direkt unter Ihrer normalen öffentlichen URL angezeigt.

Endpunkt-Tunnelbereiche (Cloudflare, Tailscale, ngrok) können unter `Settings → Appearance` ein- oder ausgeblendet werden, ohne den aktiven Tunnelstatus zu ändern.

### Hinweise zu Tunneln

- Quick-Tunnel-URLs sind temporär und ändern sich nach jedem Neustart.
- Quick Tunnels werden nach einem Neustart von Pusula oder des Containers nicht automatisch wiederhergestellt. Aktivieren Sie sie bei Bedarf erneut über das Dashboard.
- Die verwaltete Installation unterstützt derzeit Linux, macOS und Windows auf `x64` / `arm64`.
- Verwaltete Quick Tunnels verwenden standardmäßig HTTP/2 als Transportprotokoll, um störende QUIC-UDP-Pufferwarnungen in eingeschränkten Containerumgebungen zu vermeiden. Setzen Sie `CLOUDFLARED_PROTOCOL=quic` oder `auto`, wenn Sie ein anderes Transportprotokoll verwenden möchten.
- Docker-Images enthalten die CA-Stammzertifikate des Systems und übergeben sie an das verwaltete `cloudflared`. Dadurch werden TLS-Vertrauensfehler vermieden, wenn der Tunnel innerhalb des Containers initialisiert wird.
- Setzen Sie `CLOUDFLARED_BIN=/absolute/path/to/cloudflared`, wenn Pusula eine vorhandene Binärdatei verwenden soll, anstatt eine herunterzuladen.

## Image-Tags

| Image                     | Tag      | Größe  | Beschreibung                                                  |
| ------------------------- | -------- | ------ | ------------------------------------------------------------- |
| `ferhat-yasinoglu/pusula` | `latest` | ~250MB | Höchste **veröffentlichte** stabile SemVer (nicht Git `main`) |
| `ferhat-yasinoglu/pusula` | `3.8.0`  | ~250MB | Diese Tag-Klasse für GitOps festschreiben                     |

Plattformübergreifendes Manifest: natives `linux/amd64` + `linux/arm64` (Apple Silicon, AWS Graviton, Raspberry Pi). Docker wählt die passende Architektur automatisch aus; übergeben Sie `--platform linux/amd64`, wenn Sie auf ARM-Hosts die AMD64-Emulation erzwingen müssen.

### Veröffentlichungskanäle

Pusula veröffentlicht separate Docker-Kanäle für stabile Releases, Tests des aktiven Release-Branches und Entwicklungs-Builds.

| Kanal                           | Quelle                                        | Veränderbarkeit                    | Empfohlene Verwendung                                                                                                                              |
| ------------------------------- | --------------------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:<version>` / `:<version>-web` | Signiertes/versioniertes Release              | Unveränderlich                     | Produktionsbereitstellungen, die auf ein bestimmtes Release festgeschrieben sind                                                                   |
| `:latest` / `:latest-web`       | Höchste **veröffentlichte** stabile SemVer    | Veränderlicher stabiler Zeiger     | Folgt stabilen Releases **nach** einem SemVer-Veröffentlichungsauftrag – verfolgt **weder** `main` **noch** unveröffentlichte `release/v*`-Commits |
| `:next` / `:next-web`           | Aktueller standardmäßiger `release/v*`-Branch | Veränderlicher Vorabversionszeiger | Testen von Korrekturen, die im aktiven Release-Branch enthalten, aber noch nicht Teil eines stabilen Releases sind                                 |
| `:main` / `:main-web`           | `main`-Branch                                 | Veränderlicher Entwicklungszeiger  | Nur für Entwicklungs- und Integrationstests                                                                                                        |

#### Websitzungsanbieter: die `-web`-Images

Jeder oben aufgeführte Kanal ist auch als `-web`-Tag verfügbar (`:latest-web`, `:<version>-web`, `:next-web`, `:main-web`) und wird aus der Stufe `runner-web` erstellt – dasselbe Image, ergänzt um Playwright und einen Chromium-Browser. Das reguläre Image wird **ohne** Chromium ausgeliefert; `gemini-web`, `claude-web` und `claude-turnstile` benötigen ihn.

Der Fehler tritt verzögert und nicht beim Start auf: Diese Anbieter führen ihre Modelle auf und werden im Dashboard als verbunden angezeigt; erst die erste Anfrage schlägt mit folgender Meldung fehl:

```
[500]: Failed to load external module playwright: Error: Cannot find module
'/app/node_modules/playwright/node_modules/playwright-core/browsers.json'
```

Wenn Sie diese Anbieter verwenden, laden Sie den `-web`-Tag des Kanals herunter, den Sie bereits verwenden – ansonsten ändert sich nichts. Bei einer npm-/CLI-Installation (ohne Docker-Image) fehlt entsprechend die Browser-Binärdatei: Führen Sie auf dem Host `npx playwright install chromium` aus.

#### Verwendung des Vorabversionskanals

Der Kanal `next` wird bei jedem Push in den aktuellen standardmäßigen Branch `release/v*` neu erstellt und sowohl für AMD64 als auch für ARM64 veröffentlicht. Ältere Wartungsbranches können ihn nicht überschreiben. Der Kanal stellt ein abrufbares Image für Fehlerbehebungen bereit, die vor der Erstellung des nächsten stabilen Tags in den aktiven Release-Branch gemergt wurden.

```bash
docker pull ferhat-yasinoglu/pusula:next
docker pull ferhat-yasinoglu/pusula:next-web
```

Überschreiben Sie für Docker Compose den vom ausgewählten Profil verwendeten Image-Tag, rufen Sie dann das Image ab und erstellen Sie den Dienst neu:

```yaml
services:
  pusula:
    image: ferhat-yasinoglu/pusula:next
```

```bash
docker compose pull
docker compose up -d
```

#### Sicherheit und Rollback

`next` ist ein dynamischer Vorabversionskanal. Er kann sich bei jedem Push in den aktiven Release-Branch ändern und wird **nicht für den Produktionseinsatz unterstützt**. Pinnen Sie den Image-Digest, während Sie einen bestimmten Build evaluieren:

```bash
docker pull ferhat-yasinoglu/pusula:next
docker image inspect ferhat-yasinoglu/pusula:next --format '{{index .RepoDigests 0}}'
```

Sichern Sie vor dem Testen das Pusula-Daten-Volume oder das per Bind-Mount eingebundene Datenverzeichnis. Stellen Sie für einen Rollback die zuvor verwendete stabile Version oder den zuvor verwendeten Digest wieder her und erstellen Sie den Container neu:

```bash
docker pull ferhat-yasinoglu/pusula:<stable-version>
docker compose up -d
```

Ein Build aus einem Release-Branch kann `latest` niemals verschieben; nur eine geeignete stabile semantische Version darf den stabilen Zeiger aktualisieren. Für die `next`-Images gelten weiterhin die Prüfung des Release-Images sowie die blockierende Sicherheitsprüfung auf CRITICAL-Schwachstellen.

**`latest` ist keine Aktualitätsgarantie für Git.** Gemergte Fehlerbehebungen auf `main` oder im aktiven Branch `release/v*` sind **nicht** in `:latest` enthalten, bis ein stabiles SemVer-Image veröffentlicht wurde und der Veröffentlichungsjob `:latest` aktualisiert hat (mit demselben Digest wie diese SemVer-Version). Wenn `latest` unverändert erscheint, obwohl GitHub die Fehlerbehebung bereits anzeigt, rufen Sie `:next` ab, um den Release-Branch zu testen, oder warten Sie auf den SemVer-Tag.

| Gewünschtes Ziel                                                                                 | Verwendung                         |
| ------------------------------------------------------------------------------------------------ | ---------------------------------- |
| GitOps/Produktion ohne Abweichungen                                                              | `:X.Y.Z` (oder den Image-Digest)   |
| Veröffentlichte stabile Versionen verfolgen und bei jedem Release eine Neuerstellung akzeptieren | `:latest`                          |
| Unveröffentlichte Commits aus `release/v*` testen                                                | `:next` (nicht für die Produktion) |
| `main` testen                                                                                    | `:main` (nicht für die Produktion) |

## Dashboard-Updates in Docker

Ein Container aus einem veröffentlichten Image kann sich nicht selbst ersetzen. Wenn Pusula erkennt, dass es innerhalb eines Containers ausgeführt wird (kein `.git`-Checkout, keine npm-Installation), zeigt das Update-Banner des Start-Dashboards anstelle der npm-/git-Anweisungen den auszuführenden Host-Befehl mit einer Kopierschaltfläche an:

```bash
docker compose pull pusula && docker compose up -d --force-recreate pusula
```

Der Dienstname stammt aus `AUTO_UPDATE_SERVICE` (Standardwert `pusula`, der Dienst in `docker-compose.selfhost.yml`). `pull` aktualisiert nur ein gleitendes Tag (`latest`, `next`); bei einem festgelegten `:X.Y.Z`-Tag muss zuerst das Tag geändert werden.

### Ein-Klick-Updates mit einer Host-Triggerdatei

Damit **Jetzt aktualisieren** weiterhin funktioniert, ohne `/var/run/docker.sock` einzubinden (wodurch der Container Root-Zugriff auf dem Host erhält — siehe die Warnung zum `cli`-Profil oben), setzen Sie `DOCKER_UPDATE_TRIGGER_FILE` für den Pusula-Dienst und führen Sie einen Watcher auf dem Host aus:

```yaml
services:
  pusula:
    environment:
      DOCKER_UPDATE_TRIGGER_FILE: /app/data/update/docker-update.request
    volumes:
      - ./data:/app/data
```

Der Pfad muss sich innerhalb von `DATA_DIR` befinden (relative Werte werden relativ dazu aufgelöst); alle anderen Pfade werden abgelehnt. **Jetzt aktualisieren** schreibt dann `{ "requestedAt": "...", "targetVersion": "X.Y.Z" }` in diese Datei, antwortet mit `202`, und das Dashboard fragt `/api/system/version` ab, bis die neue Version aktiv ist, und lädt anschließend neu. Pusula führt in diesem Modus niemals einen Shell- oder Docker-Befehl aus. Wie bei jeder Update-Aktion wird die Anfrage nur von Loopback-/LAN-Clients akzeptiert.

Ein per Bind-Mount eingebundenes Datenverzeichnis stellt dem Host einen stabilen zu überwachenden Pfad bereit. Beispielhafte `systemd`-Units (passen Sie `/srv/pusula` an das Verzeichnis an, das Ihre Compose-Datei und `data/` enthält):

```ini
# /etc/systemd/system/pusula-update.path
[Unit]
Description=Auf Update-Anfragen des Pusula-Dashboards warten

[Path]
PathExists=/srv/pusula/data/update/docker-update.request

[Install]
WantedBy=multi-user.target
```

```ini
# /etc/systemd/system/pusula-update.service
[Unit]
Description=Pusula-Container abrufen und neu erstellen

[Service]
Type=oneshot
WorkingDirectory=/srv/pusula
ExecStartPre=/usr/bin/rm -f /srv/pusula/data/update/docker-update.request
ExecStart=/bin/sh -c 'docker compose pull pusula || (sleep 15 && docker compose pull pusula)'
ExecStart=/usr/bin/docker compose up -d --force-recreate pusula
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now pusula-update.path
```

Der Dienst entfernt die Anfrage vor dem Abruf, damit ein fehlgeschlagener Durchlauf keine Schleife verursacht. Ohne `DOCKER_UPDATE_TRIGGER_FILE` behält das Dashboard den Ablauf mit dem manuellen Befehl bei.

## Verfügbarkeit: Standard-SQLite unterstützt nur eine Replik

Die standardmäßige Docker-/Kubernetes-Bereitstellung von Pusula besteht aus **einem Node-Prozess + einem SQLite-Schreibprozess**. Hochverfügbarkeit wird bei dieser Topologie **nicht unterstützt**.

| Einschränkung                                  | Auswirkung                                                                                                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Einzelner Schreibprozess                       | Führen Sie **nicht** mehrere Repliken mit derselben SQLite-Datei aus. Dadurch wird die Datenbank beschädigt.                                                                                                                                                                                                                                                                       |
| Neuerstellung / Neustart / HEALTHCHECK-Abbruch | **Vollständiger Ausfall** laufender SSE-Verbindungen, Dashboard-Sitzungen und des In-Memory-Zustands. Die Verbindung aller verbundenen Clients wird getrennt. Neue Anfragen während des Zeitfensters ohne Endpunkt erhalten vom Reverse-Proxy **`502 Bad Gateway: Unknown error`** statt Pusula-JSON — Clients können dies nicht von einem Providerausfall unterscheiden (#11015). |
| Dieselbe Event-Loop wie `/healthz`             | Ein ausgelasteter Katalog- oder Komprimierungszyklus kann Probes verzögern; ein kurzes Timeout startet dann die **einzige** Replik neu.                                                                                                                                                                                                                                            |

**Probe-Matrix** (siehe auch [Empfehlungen für Kubernetes-Probes](../ops/MONITORING_GUIDE.md#kubernetes-probe-recommendations)):

| Probe                    | Ziel                                                               | Nicht verwenden                                                            |
| ------------------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Liveness                 | TCP auf `PORT` (Standardwert `20128`) oder weiches HTTP `/healthz` | `/api/monitoring/health`                                                   |
| Readiness                | HTTP `GET /healthz`                                                | Kurze Timeouts, die eine ausgelastete Event-Loop als ausgefallen behandeln |
| Tiefenprüfung / Menschen | `/api/monitoring/health`                                           | Automatisierte kubelet-Liveness                                            |

**Upgrades:** Rechnen Sie damit, dass jede Sitzung getrennt wird. Leiten Sie Clients nach Möglichkeit kontrolliert ab; mit der standardmäßigen SQLite-Konfiguration gibt es kein Rolling Update. Compose `restart: unless-stopped` zusammen mit Docker `HEALTHCHECK` ersetzt außerdem den einzigen Prozess, wenn der Container den Status „Unhealthy“ hat — mit demselben Auswirkungsumfang.

Kubernetes-Ausschnitt für eine **einzelne Replik** (`Recreate` ist erforderlich; erhöhen Sie `replicas` nicht für eine einzelne SQLite-Datei):

```yaml
spec:
  replicas: 1
  strategy:
    type: Recreate
  template:
    spec:
      terminationGracePeriodSeconds: 90
      containers:
        - name: pusula
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sleep", "15"]
          readinessProbe:
            httpGet:
              path: /healthz
              port: 20128
            periodSeconds: 5
          livenessProbe:
            tcpSocket:
              port: 20128
            periodSeconds: 20
```

Der `preStop`-Sleep ermöglicht es kube, Service-Endpunkte vor SIGTERM zu entfernen, sodass **neuer** Traffic nicht mehr an den sich beendenden Prozess gesendet wird. Laufende `/v1/responses`-SSE-Verbindungen werden über Heavyweight-Zulassungs-Leases (#11015) bis zu `SHUTDOWN_TIMEOUT_MS` (standardmäßig 30 s) geordnet beendet. Neue Anfragen, die den Prozess dennoch erreichen, erhalten `503` + `Retry-After: 5`. Die durch Recreate entstehende Lücke ohne Endpunkte, bis der Ersatz Ready ist, bleibt ein vollständiger Ausfall — das liegt an der SQLite-Topologie und nicht an einer Fehlkonfiguration der Probes.

Externes Postgres bzw. Multi-Writer-HA ist **kein** dokumentierter Standardweg. Wenn Sie HA benötigen, verwenden Sie weiterhin ein einzelnes Replikat oder betreiben Sie eine Topologie, die das Projekt separat getestet und dokumentiert hat. Die Arbeiten an Postgres/MySQL werden in [#8075](https://github.com/Ferhat-Yasinoglu/pusula/issues/8075) behandelt. Bis diese Funktion verfügbar ist, besteht die einzige unterstützte Möglichkeit, die Kapazität für **große** `/v1/responses` zu vervielfachen, in N unabhängigen Prozessen (nächster Abschnitt), nicht in `replicas > 1` auf einem Volume.

## Horizontale Skalierung: N unabhängige Prozesse

Ein Node-Prozess entspricht **einem V8-Heap**. Zwei sich überschneidende Coding-Agent-Anfragen `POST /v1/responses` (RTK + Caveman) mit jeweils ~3 MiB / ~750.000 Token führen bei ~12 Gi zum Abbruch dieses Heaps (`FATAL ERROR: Reached heap limit`) und können in einer 16-Gi-cgroup einen OOM verursachen. Siehe [#7849](https://github.com/Ferhat-Yasinoglu/pusula/issues/7849). Diese Messung ist eine Warnung bezüglich des **Speicherbudgets** und keine produktseitige harte Obergrenze von zwei gleichzeitigen langen `/v1/responses`. Die Zulassung ressourcenintensiver Chats wird durch ein automatisch abgeleitetes Byte-Budget für eingehende Anfragen (`PUSULA_CHAT_MAX_INFLIGHT_BYTES`, `src/shared/middleware/admissionBudget.ts`) gesteuert, das anhand derselben V8-/cgroup-Obergrenze dimensioniert wird. Wird dieser Wert nach oben überschrieben (oder die veraltete, auf der Anfrageanzahl basierende Obergrenze `PUSULA_CHAT_MAX_HEAVY_IN_FLIGHT` festgelegt), führt dies bei einem bereits entsprechend dimensionierten Prozess erneut zum Abbruch. Kleine Chats, `/healthz`, `/v1/models` und MCP fallen **nicht** unter diese Obergrenze.

### Ein Prozess: mehr als zwei lange `/v1/responses`

Ein **fehlerfreier** Prozess (Heap unter `PUSULA_CHAT_ADMISSION_HEAP_SHED_RATIO`, standardmäßig `0.75`) **kann** mehr als zwei gleichzeitige lange `POST /v1/responses` ausführen, wenn im prozessweiten Byte-Budget für laufende Anfragen (`PUSULA_CHAT_MAX_INFLIGHT_BYTES` / #10110) noch Kapazität vorhanden ist. Bodies mit mindestens `PUSULA_CHAT_LARGE_BODY_BYTES` (standardmäßig 256 KiB) belegen dieselbe Heavyweight-Lease wie strukturell aufwendige Anfragen und verwenden denselben `tryAcquireHealthyHeadroom`-Ausweichmechanismus aus [#10437](https://github.com/Ferhat-Yasinoglu/pusula/pull/10437) (`PUSULA_CHAT_ADMISSION_HEALTHY_HEADROOM`). Dutzende gleichzeitige langlebige SSE-Clients (Betreiber benötigen häufig 40–50) sind eine Frage des **Speicherbudgets** – Heap + primäre/Headroom-Slots + `PUSULA_CHAT_MAX_INFLIGHT_BYTES` – und keine harte produktseitige Obergrenze von „maximal 2“. Ein unter Druck stehender Heap weist Anfragen weiterhin mit einem wiederholbaren `503` zurück, damit #7849 nicht erneut auftritt.

Um **Heaps zu vervielfachen** (unabhängige V8-Old-Spaces), gilt **derzeit**:

| Empfohlen                                                                                                                                                                | Nicht empfohlen                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| **N Container/Pods** ausführen, jeweils mit einem **eigenen** `DATA_DIR` / Volume                                                                                        | `replicas > 1` für eine einzige SQLite-Datei festlegen                 |
| Heavy-In-Flight + Healthy-Headroom anhand des Heap-/Inflight-Byte-Budgets dimensionieren; 1–2 ist der konservative Standardwert aus #7849, keine harte Produktobergrenze | Einem Prozess 8× RAM und eine unbegrenzte Anzahlobergrenze geben       |
| Optional: `QUOTA_STORE_DRIVER=redis` + `QUOTA_STORE_REDIS_URL` für **gemeinsam genutzte Kontingentzähler**                                                               | Redis als gemeinsam genutztes SQLite behandeln – das ist es nicht      |
| Provider-Secrets in jede Instanz duplizieren (oder getrennte Dashboards akzeptieren)                                                                                     | Ein gemeinsames Dashboard / Anrufprotokoll für alle Instanzen erwarten |
| Einen beliebigen Load-Balancer vorschalten; Sitzungsaffinität nach API-Schlüssel oder Sitzung genügt                                                                     | Eine anbieterspezifische, größenabhängige Middleware voraussetzen      |

Hardware: Die Anzahl gleichzeitig laufender langer `/v1/responses` pro Instanz ist eine Frage des **Speicherbudgets** (Heap + Inflight-Byte / #10110). `N` unabhängige `DATA_DIR`s vervielfachen weiterhin die Heaps: Der Host-RAM muss `N × cgroup` abdecken und nicht „einen 16-Gi-Pod mit N=8“. Niemals `replicas > 1` für eine einzige SQLite-Datei verwenden.

Compose-Beispiel (zwei Heaps, zwei Volumes – nicht `deploy.replicas: 2`):

```yaml
services:
  pusula-a:
    image: ferhat-yasinoglu/pusula:3.8.49
    environment:
      DATA_DIR: /app/data
      PUSULA_MEMORY_MB: "12288"
      QUOTA_STORE_DRIVER: redis
      QUOTA_STORE_REDIS_URL: redis://redis:6379
    volumes: [pusula-a-data:/app/data]
    ports: ["20128:20128"]
  pusula-b:
    image: ferhat-yasinoglu/pusula:3.8.49
    environment:
      DATA_DIR: /app/data
      PUSULA_MEMORY_MB: "12288"
      QUOTA_STORE_DRIVER: redis
      QUOTA_STORE_REDIS_URL: redis://redis:6379
    volumes: [pusula-b-data:/app/data]
    ports: ["20138:20128"]
volumes:
  pusula-a-data:
  pusula-b-data:
```

Die prozessinterne Dichte (Komprimierung außerhalb des HTTP-Isolats) wird in [#11023](https://github.com/Ferhat-Yasinoglu/pusula/issues/11023) behandelt. Ein logischer Cluster auf gemeinsam genutztem persistentem Zustand wird in [#8075](https://github.com/Ferhat-Yasinoglu/pusula/issues/8075) behandelt.

## Regionale Gemini-Fehler innerhalb von Docker

Google AI Studio / Gemini API kann HTTP 400 mit FAILED_PRECONDITION und
`User location is not supported for the API use.` zurückgeben. Eine erfolgreiche Anfrage auf dem Host
beweist nicht, dass der Container dieselbe ausgehende Route verwendet. DNS-Reihenfolge,
IPv4-/IPv6-Konnektivität, VPN-Routing und konfigurierte Proxys können sich unterscheiden. Prüfen Sie
[Googles unterstützte Regionen](https://ai.google.dev/gemini-api/docs/available-regions)
sowie die tatsächliche Verbindungsroute; dieser Fehler allein weist nicht auf einen ungültigen API-Schlüssel hin.

### Verbindungsspezifischen Proxy bevorzugen

Verwenden Sie die [Proxy-Konfiguration pro Verbindung](../ops/PROXY_GUIDE.md#4-level-proxy-system)
von Pusula für die betroffene Gemini-Verbindung und wiederholen Sie anschließend **Verbindung testen** sowie eine kleine Anfrage
mit demselben Modell. Dadurch bleibt die Routing-Änderung auf diese Verbindung beschränkt. Stellen Sie sicher,
dass der Proxy vom Container aus erreichbar ist und dass die Verbindung ihn tatsächlich auswählt.
Eine Änderung der Route garantiert nicht, dass die regionalen Voraussetzungen des Upstream-Dienstes erfüllt sind.

### Netzwerk des Hosts und Containers vergleichen

Verwenden Sie beim Vergleich authentifizierter Ergebnisse denselben Schlüssel, dasselbe Modell und dieselbe Anfrage; fügen Sie niemals
Anmeldedaten, Proxy-Passwörter oder vollständige Autorisierungsheader in ein Issue ein.
Prüfen Sie zunächst, welche Adressfamilien der Resolver des Betriebssystems bereitstellt, und verwenden Sie dazu denselben Befehl
auf dem Host und innerhalb des Containers:

```bash
node -e 'require("node:dns").lookup("generativelanguage.googleapis.com", {all: true}, (error, addresses) => { if (error) { console.error(error.code); process.exitCode = 1; return; } console.log(addresses.map(({family}) => family)); })'
docker compose exec pusula node -e 'require("node:dns").lookup("generativelanguage.googleapis.com", {all: true}, (error, addresses) => { if (error) { console.error(error.code); process.exitCode = 1; return; } console.log(addresses.map(({family}) => family)); })'
```

Ersetzen Sie `pusula` durch den von Ihnen ausgeführten Dienst (zum Beispiel `pusula-web`). Diese
Befehle geben Adressfamilien ohne Anmeldedaten oder IP-Adressen aus. Eine zurückgegebene `6`
zeigt lediglich ein IPv6-DNS-Ergebnis an: Sie beweist **weder** eine nutzbare IPv6-Route noch den API-Zugriff.
Wenn `curl` installiert ist, vergleichen Sie `curl -4 -I https://generativelanguage.googleapis.com`
mit `curl -6 -I https://generativelanguage.googleapis.com` in beiden Umgebungen.
Eine HTTP-Antwort belegt die Konnektivität für diesen Test, auch wenn es sich um einen nicht authentifizierten
Fehler handelt; nur die authentifizierte Modellanfrage prüft die Gemini-Berechtigung.

### Alternative auf Host-Ebene: funktionierendes IPv6 und Resolver-Richtlinie

Der Melder von [#12762](https://github.com/Ferhat-Yasinoglu/pusula/issues/12762) stellte
den Zugriff in seiner Umgebung wieder her, indem er IPv6 für Container aktivierte und die glibc-Adressauswahl
änderte. Betrachten Sie dies als umgebungsspezifische Alternative. Vergewissern Sie sich, dass
IPv6 auf dem Host, der ausgehende Datenverkehr bzw. das Routing des Containers und die Firewall-Regeln funktionieren, bevor Sie die Resolver-Einstellungen anpassen.
Eine private ULA-Adresse allein stellt keine öffentliche IPv6-Konnektivität her.

Für Dienste, die bereits mit dem Standardnetzwerk von Compose verbunden sind, aktiviert dieses Fragment
IPv6 in diesem Netzwerk; behalten Sie die übrigen Dienst-, Port-, Volume- und Konfigurationseinstellungen bei:

```yaml
networks:
  default:
    enable_ipv6: true
```

Aktivieren Sie IPv6 bei einem benannten Netzwerk in dem Netzwerk, mit dem der Dienst tatsächlich verbunden ist. Docker kann
ein ULA-Subnetz zuweisen; wählen Sie nur dann ein explizites, nicht überlappendes Subnetz aus, wenn Ihr Netzwerk
dies erfordert. Siehe [IPv6-Netzwerke in Docker](https://docs.docker.com/engine/daemon/ipv6/)
und [Compose-Netzwerkoptionen](https://docs.docker.com/reference/compose-file/networks/#enable_ipv6).

Bei einem **glibc-basierten Image** kann `/etc/gai.conf` die Adressauswahl ändern. Das aktuelle
Dockerfile des Repositorys verwendet Debian; benutzerdefinierte musl-basierte Images nutzen diesen Mechanismus nicht.
Die gemeldete Anpassung ändert das ULA-Label von `label fc00::/7 6` in
`label fc00::/7 1`. Gehen Sie von der vollständigen Richtlinientabelle des Images aus und behalten Sie deren übrige
Einträge bei: Das Hinzufügen eines `label`- oder `precedence`-Eintrags ersetzt diese Standardtabelle, sodass eine Datei,
die nur die geänderte Zeile enthält, nicht ausreicht. Die
[glibc-Konfigurationsreferenz](https://github.com/bminor/glibc/blob/master/posix/gai.conf)
dokumentiert diese Semantik. Binden Sie die geprüfte Datei schreibgeschützt unter `/etc/gai.conf` ein
und erstellen Sie den Dienst neu, um sie anzuwenden.

Dadurch ändert sich die Adressauswahl des Betriebssystems für **den gesamten ausgehenden Datenverkehr in diesem Container**.
Es zwingt nicht jede Anwendung dazu, IPv6 auszuwählen: Auch die DNS-Reihenfolge und
Verbindungsauswahl von Node sind relevant. Insbesondere bevorzugt `--dns-result-order=ipv4first` IPv4 und
ist keine Lösung für einen reinen IPv4-Fehler. Siehe [DNS-Reihenfolge in Node](https://nodejs.org/api/dns.html#dnssetdefaultresultorderorder).

Testen Sie Gemini und Ihre anderen Anbieter nach jeder Änderung auf Host-Ebene erneut. Um die Änderung rückgängig zu machen,
entfernen Sie den benutzerdefinierten `gai.conf`-Mount, stellen Sie die vorherige Netzwerkkonfiguration wieder her und
erstellen Sie den betroffenen Dienst bzw. das betroffene Netzwerk während eines Wartungsfensters neu. Das Neuerstellen eines Netzwerks
kann andere damit verbundene Container unterbrechen; löschen Sie nicht das persistente Daten-Volume.

## Wichtige Hinweise

- **SQLite-WAL-Modus:** `docker stop` sollte vollständig ausgeführt werden, damit Pusula die neuesten Änderungen per Checkpoint in `storage.sqlite` zurückschreiben kann. Die mitgelieferten Compose-Dateien legen bereits eine Karenzzeit von 40 Sekunden für das Stoppen fest. Wenn Sie das Image direkt ausführen, behalten Sie `--stop-timeout 40` bei.
- **`DISABLE_SQLITE_AUTO_BACKUP`:** Setzen Sie die Variable auf `true`, wenn routinemäßige bzw. vor Schreibvorgängen erstellte Backups extern verwaltet werden. Migrationen bestehender Datenbanken erfordern weiterhin einen eigenen dauerhaften Sicherheits-Snapshot und einen Schutzmechanismus für Massenmigrationen.
- **Datenpersistenz:** Binden Sie immer ein Volume unter `/app/data` ein, damit Ihre Datenbank, Schlüssel und Konfigurationen auch nach Container-Neustarts erhalten bleiben.
- **Portkonfiguration:** Überschreiben Sie die Umgebungsvariable `PORT`, um den Standardport `20128` zu ändern.

## Siehe auch

- [Anleitung zur VM-Bereitstellung](../ops/VM_DEPLOYMENT_GUIDE.md) — Einrichtung mit VM + nginx + Cloudflare
- [Anleitung zur Bereitstellung auf Fly.io](../ops/FLY_IO_DEPLOYMENT_GUIDE.md) — Bereitstellung auf Fly.io
- [Umgebungskonfiguration](../reference/ENVIRONMENT.md) — Vollständige `.env`-Referenz
