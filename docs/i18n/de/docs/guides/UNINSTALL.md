# Pusula — Uninstall Guide (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/UNINSTALL.md) · 🇮🇷 [fa](../../../fa/docs/guides/UNINSTALL.md) · 🇹🇷 [tr](../../../tr/docs/guides/UNINSTALL.md)

---

🌐 **Languages:** 🇺🇸 [English](../../../../guides/UNINSTALL.md) · 🇮🇷 [fa](../../../fa/docs/guides/UNINSTALL.md) · 🇹🇷 [tr](../../../tr/docs/guides/UNINSTALL.md)

Diese Anleitung beschreibt, wie Sie Pusula vollständig von Ihrem System entfernen.

---

## Schnelle Deinstallation (v3.6.2+)

Pusula bietet zwei integrierte Skripte für eine saubere Deinstallation:

### Daten behalten

```bash
npm run uninstall
```

Dadurch wird die Pusula-Anwendung entfernt, Ihre Datenbank, Konfigurationen, API-Schlüssel und Anbietereinstellungen in `~/.pusula/` bleiben jedoch **erhalten**. Verwenden Sie diese Option, wenn Sie Pusula später erneut installieren und Ihre Einrichtung beibehalten möchten.

### Vollständige Entfernung

```bash
npm run uninstall:full
```

Dadurch wird die Anwendung entfernt und es werden **alle Daten dauerhaft gelöscht**:

- Datenbank (`storage.sqlite`)
- Anbieterkonfigurationen und API-Schlüssel
- Sicherungsdateien
- Protokolldateien
- Alle Dateien im Verzeichnis `~/.pusula/`

> ⚠️ **Warnung:** `npm run uninstall:full` kann nicht rückgängig gemacht werden. Alle Ihre Anbieter-Verbindungen, Kombinationen, API-Schlüssel und Ihr Nutzungsverlauf werden dauerhaft gelöscht.

---

## Manuelle Deinstallation

### Globale NPM-Installation

```bash
# Globales Paket entfernen
npm uninstall -g pusula

# (Optional) Datenverzeichnis entfernen
rm -rf ~/.pusula
```

### Globale pnpm-Installation

```bash
pnpm uninstall -g pusula
rm -rf ~/.pusula
```

### Docker

```bash
# Container stoppen und entfernen
docker stop pusula
docker rm pusula

# Volume entfernen (löscht alle Daten)
docker volume rm pusula-data

# (Optional) Image entfernen
docker rmi ferhat-yasinoglu/pusula:latest
```

### Docker Compose

```bash
# Container stoppen und entfernen
docker compose down

# Zusätzlich Volumes entfernen (löscht alle Daten)
docker compose down -v
```

### Electron-Desktop-App

**Windows:**

- Öffnen Sie `Einstellungen → Apps → Pusula → Deinstallieren`
- Oder führen Sie das NSIS-Deinstallationsprogramm aus dem Installationsverzeichnis aus

**macOS:**

- Ziehen Sie `Pusula.app` aus `/Applications` in den Papierkorb
- Daten entfernen: `rm -rf ~/Library/Application Support/pusula`

**Linux:**

- Entfernen Sie die AppImage-Datei
- Daten entfernen: `rm -rf ~/.pusula`

### Installation aus dem Quellcode (git clone)

```bash
# Geklontes Verzeichnis entfernen
rm -rf /path/to/pusula

# (Optional) Datenverzeichnis entfernen
rm -rf ~/.pusula
```

---

## Datenverzeichnisse

Pusula speichert Daten standardmäßig an den folgenden Speicherorten:

| Plattform   | Standardpfad                        | Überschreibung                      |
| ----------- | ----------------------------------- | ----------------------------------- |
| Linux       | `~/.pusula/`                     | Umgebungsvariable `DATA_DIR`        |
| macOS       | `~/.pusula/`                     | Umgebungsvariable `DATA_DIR`        |
| Windows     | `%APPDATA%/pusula/`              | Umgebungsvariable `DATA_DIR`        |
| Docker      | `/app/data/` (eingebundenes Volume) | Umgebungsvariable `DATA_DIR`        |
| XDG-konform | `$XDG_CONFIG_HOME/pusula/`       | Umgebungsvariable `XDG_CONFIG_HOME` |

### Dateien im Datenverzeichnis

| Datei/Verzeichnis    | Beschreibung                                                       |
| -------------------- | ------------------------------------------------------------------ |
| `storage.sqlite`     | Hauptdatenbank (Anbieter, Kombinationen, Einstellungen, Schlüssel) |
| `storage.sqlite-wal` | SQLite-Write-Ahead-Protokoll (temporär)                            |
| `storage.sqlite-shm` | Gemeinsam genutzter SQLite-Speicher (temporär)                     |
| `call_logs/`         | Archive der Anfrage-Payloads                                       |
| `backups/`           | Automatische Datenbanksicherungen                                  |
| `log.txt`            | Veraltetes Anfrageprotokoll (optional)                             |

---

## Vollständige Entfernung überprüfen

Überprüfen Sie nach der Deinstallation, ob keine Dateien mehr vorhanden sind:

```bash
# Auf globales npm-Paket prüfen
npm list -g pusula 2>/dev/null

# Auf Datenverzeichnis prüfen
ls -la ~/.pusula/ 2>/dev/null

# Auf laufende Prozesse prüfen
pgrep -f pusula
```

Falls noch ein Prozess ausgeführt wird, beenden Sie ihn:

```bash
pkill -f pusula
```
