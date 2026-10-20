---
title: "Pusula — Uninstall Guide"
version: 3.8.40
lastUpdated: 2026-06-28
---

# Pusula — Uninstall Guide

🌐 **Languages:** 🇺🇸 [English](./UNINSTALL.md) | 🇩🇪 [Deutsch](../i18n/de/docs/guides/UNINSTALL.md) | 🇮🇷 [فارسی](../i18n/fa/docs/guides/UNINSTALL.md) | 🇹🇷 [Türkçe](../i18n/tr/docs/guides/UNINSTALL.md)

This guide covers how to cleanly remove Pusula from your system.

---

## Quick Uninstall (v3.6.2+)

Pusula provides two built-in scripts for clean removal:

### Keep Your Data

```bash
npm run uninstall
```

This removes the Pusula application but **preserves** your database, configurations, API keys, and provider settings in `~/.pusula/`. Use this if you plan to reinstall later and want to keep your setup.

### Full Removal

```bash
npm run uninstall:full
```

This removes the application **and permanently erases** all data:

- Database (`storage.sqlite`)
- Provider configurations and API keys
- Backup files
- Log files
- All files in the `~/.pusula/` directory

> ⚠️ **Warning:** `npm run uninstall:full` is irreversible. All your provider connections, combos, API keys, and usage history will be permanently deleted.

---

## Manual Uninstall

### NPM Global Install

```bash
# Remove the global package
npm uninstall -g pusula

# (Optional) Remove data directory
rm -rf ~/.pusula
```

### pnpm Global Install

```bash
pnpm uninstall -g pusula
rm -rf ~/.pusula
```

### Docker

```bash
# Stop and remove the container
docker stop pusula
docker rm pusula

# Remove the volume (deletes all data)
docker volume rm pusula-data

# (Optional) Remove the image
docker rmi ferhat-yasinoglu/pusula:latest
```

### Docker Compose

```bash
# Stop and remove containers
docker compose down

# Also remove volumes (deletes all data)
docker compose down -v
```

### Electron Desktop App

**Windows:**

- Open `Settings → Apps → Pusula → Uninstall`
- Or run the NSIS uninstaller from the install directory

**macOS:**

- Drag `Pusula.app` from `/Applications` to Trash
- Remove data: `rm -rf ~/Library/Application Support/pusula`

**Linux:**

- Remove the AppImage file
- Remove data: `rm -rf ~/.pusula`

### Source Install (git clone)

```bash
# Remove the cloned directory
rm -rf /path/to/pusula

# (Optional) Remove data directory
rm -rf ~/.pusula
```

---

## Data Directories

Pusula stores data in the following locations by default:

| Platform      | Default Path                  | Override                  |
| ------------- | ----------------------------- | ------------------------- |
| Linux         | `~/.pusula/`               | `DATA_DIR` env var        |
| macOS         | `~/.pusula/`               | `DATA_DIR` env var        |
| Windows       | `%APPDATA%/pusula/`        | `DATA_DIR` env var        |
| Docker        | `/app/data/` (mounted volume) | `DATA_DIR` env var        |
| XDG-compliant | `$XDG_CONFIG_HOME/pusula/` | `XDG_CONFIG_HOME` env var |

### Files in the data directory

| File/Directory       | Description                                       |
| -------------------- | ------------------------------------------------- |
| `storage.sqlite`     | Main database (providers, combos, settings, keys) |
| `storage.sqlite-wal` | SQLite write-ahead log (temporary)                |
| `storage.sqlite-shm` | SQLite shared memory (temporary)                  |
| `call_logs/`         | Request payload archives                          |
| `backups/`           | Automatic database backups                        |
| `log.txt`            | Legacy request log (optional)                     |

---

## Verify Complete Removal

After uninstalling, verify there are no remaining files:

```bash
# Check for global npm package
npm list -g pusula 2>/dev/null

# Check for data directory
ls -la ~/.pusula/ 2>/dev/null

# Check for running processes
pgrep -f pusula
```

If any process is still running, stop it:

```bash
pkill -f pusula
```
