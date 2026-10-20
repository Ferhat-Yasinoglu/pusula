# Monitoring & Costs — Navigation Structure (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../architecture/MONITORING_SECTIONS.md) · 🇮🇷 [fa](../../../fa/docs/architecture/MONITORING_SECTIONS.md) · 🇹🇷 [tr](../../../tr/docs/architecture/MONITORING_SECTIONS.md)

---

> Implementiert in Gruppe B (Plan 16). Siehe `src/shared/constants/sidebarVisibility.ts`.

---

## Navigation auf oberster Ebene

Die Dashboard-Seitenleiste (nach Gruppe B) enthält diese Bereiche auf oberster Ebene in der folgenden Reihenfolge:

```
Startseite
Anbieter
Kombinationen
API-Schlüssel
Einstellungen
Analysen
Kosten         ← NEU (Gruppe B, Plan 16)
Überwachung    ← NEU ORGANISIERT (Gruppe B, Plan 16)
...
```

---

## Bereich „Kosten“ (neu, Ebene 1)

Pfadpräfix: `/dashboard/costs/`

| Element            | URL                                  | Beschreibung                                            |
| ------------------ | ------------------------------------ | ------------------------------------------------------- |
| Übersicht          | `/dashboard/costs`                   | Aggregiertes Kosten-Dashboard (aus Analysen verschoben) |
| Preisgestaltung    | `/dashboard/costs/pricing`           | Preistabelle pro Modell                                 |
| Budget             | `/dashboard/costs/budget`            | Budgetschwellenwerte + Warnungen                        |
| Kontingentfreigabe | `/dashboard/costs/quota-share`       | Kontingentfreigabe-Pools + Nutzung                      |
| Plankonfiguration  | `/dashboard/costs/quota-share/plans` | Planspezifische Überschreibungen pro Anbieter           |

**Begründung**: Preisgestaltung, Budget und Kontingentfreigabe befanden sich zuvor unter
`Überwachung > Kostenparameter`. Durch die Verschiebung in einen eigenen Bereich
auf oberster Ebene sind sie leichter auffindbar, ohne durch die Observability-Werkzeuge
navigieren zu müssen.

---

## Bereich „Überwachung“ (neu organisiert)

Der Bereich „Überwachung“ enthält jetzt **Aktivität an oberster Stelle**, gefolgt von **3 Untergruppen**:

```
Überwachung
├── Aktivität                ← Zeitleisten-Feed (Element auf oberster Ebene)
├── Protokollgruppe
│   ├── Protokolle (alle)
│   ├── Proxy-Protokolle
│   └── Konsolenprotokolle
├── Auditgruppe
│   ├── Auditprotokoll
│   ├── MCP-Audit
│   └── A2A-Audit
└── Systemgruppe
    ├── Systemzustand
    └── Laufzeit
```

### Änderungen gegenüber der alten Struktur

| Vorher                                                                                                                | Nachher                                           |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Aktivität = Registerkarte innerhalb von „Protokolle“, die das Auditprotokoll anzeigte                                 | Aktivität = eigener Feed (`/dashboard/activity`)  |
| Gruppe „Kostenparameter“ unter „Überwachung“                                                                          | In den Bereich „Kosten“ verschoben                |
| Flache Liste: Protokolle, Aktivität (Protokolle), Audit, Systemzustand, Laufzeit, Preisgestaltung, Budget, Kontingent | Struktur mit 3 Gruppen + eigener Bereich „Kosten“ |

---

## Aktivität im Vergleich zum Auditprotokoll

Diese beiden Bereiche sind nun voneinander getrennt:

| Dimension                 | Aktivität (`/dashboard/activity`)                                 | Auditprotokoll (`/dashboard/audit`)        |
| ------------------------- | ----------------------------------------------------------------- | ------------------------------------------ |
| **Zweck**                 | Benutzerorientierter Ereignis-Feed („Was ist kürzlich passiert?“) | Compliance-/Sicherheitsprotokoll           |
| **Datenquelle**           | `GET /api/compliance/audit-log?level=high`                        | `GET /api/compliance/audit-log?level=all`  |
| **Format**                | Zeitleiste, nach Tag gruppiert, verständliche Verben + Symbole    | Dichte, paginierte Tabelle, 50/Seite       |
| **Filter**                | Ereignistypkategorie                                              | Aktion, Schweregrad, Akteur, Datumsbereich |
| **Export**                | Nicht verfügbar                                                   | JSON-Export                                |
| **Akteurfilter**          | Nicht anwendbar                                                   | Nach Akteur filterbar                      |
| **Angezeigte Ereignisse** | Nur übergeordnete Aktionen (Positivliste)                         | Alle Auditereignisse                       |

### Positivliste übergeordneter Aktionen

Definiert in `src/lib/audit/highLevelActions.ts`. Steuert, welche Ereignisse im
Aktivitäts-Feed angezeigt werden. Die Positivliste umfasst:

- Ereignisse zum Hinzufügen, Entfernen und Testen von Anbietern
- Erstellen, Aktualisieren und Löschen von Kombinationen
- Lebenszyklus von API-Schlüsseln (Erstellen, Widerrufen, Rotieren)
- Erreichen eines Budgetschwellenwerts
- Authentifizierungsanmeldung/-abmeldung
- Erstellung einer Cloud-Agent-Sitzung
- Registrierung von MCP-Werkzeugen
- Erstellen/Löschen von Webhooks
- Änderungen an Kontingentpools/-plänen (`quota.*`-Aktionen, Gruppe B)
- Plattformereignisse (Aktualisierung, Bereitstellung)
- Installieren/Entfernen von Skills

Ereignisse, die nicht in dieser Liste enthalten sind, erscheinen nur im Auditprotokoll.

### Hinzufügen einer neuen übergeordneten Aktion

Bearbeiten Sie `src/lib/audit/highLevelActions.ts` und fügen Sie die Aktionszeichenfolge zu
`HIGH_LEVEL_ACTIONS` hinzu. Dies erfordert einen PR (die Liste befindet sich im Code und ist nicht über die Datenbank konfigurierbar).
Das entsprechende Symbol kann zu `src/lib/audit/activityIcons.ts` hinzugefügt werden.

---

## Weiterleitung: `/dashboard/logs/activity`

Der alte Pfad `/dashboard/logs/activity` wird über `permanentRedirect()` in
`src/app/(dashboard)/dashboard/logs/activity/page.tsx` dauerhaft (HTTP 308) zu
`/dashboard/activity` weitergeleitet.

Die alte Seitenleisten-ID `logs-activity` bleibt in `HIDEABLE_SIDEBAR_ITEM_IDS`
erhalten (wurde jedoch aus `SIDEBAR_DEFINITIONS` entfernt), damit Benutzervoreinstellungen,
die auf die alte ID verweisen, nicht beschädigt werden.

---

## i18n

Von Gruppe B hinzugefügte Namespaces:

| Namespace-Schlüssel     | Abgedeckter Bereich                                                         |
| ----------------------- | --------------------------------------------------------------------------- |
| `sidebar.costsSection`  | Bezeichnung des Bereichs „Kosten“                                           |
| `sidebar.activity`      | Seitenleistenelement „Aktivität“                                            |
| `sidebar.logsGroup`     | Bezeichnung der Untergruppe „Protokolle“                                    |
| `sidebar.systemGroup`   | Bezeichnung der Untergruppe „System“                                        |
| `sidebar.costsOverview` | Element der Kostenübersicht                                                 |
| `activity.*`            | Alle Zeichenfolgen der Aktivitätsseite (Titel, Verben, Filter, Leerzustand) |

Die maßgebliche Quell-Locale ist `en`. Die drei anderen Locales (`de`, `fa`, `tr`) greifen über
den `next-intl`-Fallback-Mechanismus auf Englisch zurück (konfiguriert in `src/i18n/config.ts`).
