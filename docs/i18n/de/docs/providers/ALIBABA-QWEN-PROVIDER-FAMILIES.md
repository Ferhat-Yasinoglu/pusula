# Alibaba and Qwen provider families (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/ALIBABA-QWEN-PROVIDER-FAMILIES.md) · 🇮🇷 [fa](../../../fa/docs/providers/ALIBABA-QWEN-PROVIDER-FAMILIES.md) · 🇹🇷 [tr](../../../tr/docs/providers/ALIBABA-QWEN-PROVIDER-FAMILIES.md)

---

Dieses Dokument hält die Implementierungsentscheidung für
[Issue #7854](https://github.com/Ferhat-Yasinoglu/pusula/issues/7854) fest. Die öffentlichen Produkte werden
als vier Anbieterfamilien dargestellt. Die Region gehört zu den Verbindungsdaten und ist kein eigenständiges Produkt.

## Entscheidung

| Anbieterfamilie                                           | Pusula-ID            | Globale Region | Region China |
| --------------------------------------------------------- | ----------------------- | -------------- | ------------ |
| Alibaba Cloud Model Studio (nutzungsabhängige Abrechnung) | `alibaba`               | Singapur       | Peking       |
| Alibaba Cloud Token Plan                                  | `bailian-coding-plan`   | Singapur       | Peking       |
| Qwen Cloud (nutzungsabhängige Abrechnung)                 | `qwen-cloud`            | Global         | Peking       |
| Qwen Cloud Token Plan                                     | `qwen-cloud-token-plan` | Singapur       | Peking       |

Die vorhandene ID `alibaba-cn` bleibt als Laufzeitkompatibilitätsalias für gespeicherte Verbindungen, Modellrouten,
Kombinationen und historische Nutzungsdaten bestehen. Die zugehörige Dashboard-Karte wird in `alibaba` integriert; eine
Neuschreibung der Datenbank ist nicht erforderlich.

Qwen Cloud mit nutzungsabhängiger Abrechnung und Alibaba Cloud Model Studio verwenden derzeit dieselben DashScope-kompatiblen
Laufzeit-Hosts, bleiben jedoch separate Anbieteridentitäten, da Benutzer Schlüssel über unterschiedliche Produktoberflächen beziehen und
Konten dort verwalten. Die Token-Plan-Produkte von Alibaba und Qwen Cloud verwenden
unterschiedliche Endpunktfamilien, weshalb alle vier Produkte separate Anbieter-IDs behalten.

## Endpunktmatrix

| Anbieterfamilie         | `global-sg`                                                              | `china-beijing`                                                      | Übertragungsformat |
| ----------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- | ------------------ |
| `alibaba`               | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`                 | `https://dashscope.aliyuncs.com/compatible-mode/v1`                  | OpenAI             |
| `bailian-coding-plan`   | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/apps/anthropic/v1`  | `https://token-plan.cn-beijing.maas.aliyuncs.com/apps/anthropic/v1`  | Anthropic          |
| `qwen-cloud`            | `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`                 | `https://dashscope.aliyuncs.com/compatible-mode/v1`                  | OpenAI             |
| `qwen-cloud-token-plan` | `https://token-plan.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1` | `https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` | OpenAI             |

Der API-Schlüssel und der Endpunkt müssen zum selben Produkt und zur selben Region gehören. Durch die Auswahl einer Region wird
der voreingestellte Endpunkt geändert, der für die Validierung und normale Anfragen verwendet wird.

## Verbindungsvertrag

Neue Verbindungen speichern den stabilen Regionsschlüssel in `providerSpecificData`:

```json
{
  "region": "global-sg"
}
```

Zulässige Werte sind `global-sg` und `china-beijing`. Der Endpunkt wird zentral aus der
Anbieter-ID und der Region abgeleitet. Ein nicht voreingestellter Wert in `providerSpecificData.baseUrl` bleibt eine explizite
Betreiberüberschreibung und hat Vorrang, während alte gespeicherte voreingestellte URLs wieder anhand der regionalen
Matrix normalisiert werden.

Dadurch bleibt das Verbindungsschema erweiterbar: Dem Resolver kann eine weitere Region hinzugefügt werden, ohne
eine weitere Anbieterkarte zu erstellen oder gespeicherte Anbieter-IDs zu ändern.

## Kompatibilität und Rollout

1. Fügen Sie den regionalen Endpunkt-Resolver hinzu und behalten Sie die aktuellen globalen Standardwerte bei.
2. Verwenden Sie die Live-Ermittlung über den regionalen DashScope-Endpunkt `/models` für `alibaba`, dessen Kompatibilitäts-ID `alibaba-cn` und `qwen-cloud`. Deren Antworten durchlaufen zunächst einen Filter für Textgenerierung, da der generische Endpunkt auch Bild-, Video-, Audio-, Embedding- und andere Nicht-Chat-Modelle zurückgibt. `qwen-cloud` wendet anschließend die gepflegte Allowlist an, die in seiner Provider-Registry deklariert ist. Alibaba Model Studio und Qwen Cloud behalten separate kuratierte Kataloge, obwohl sie derzeit dieselben Runtime-Hosts verwenden.
3. Registrieren Sie `qwen-cloud-token-plan` mit der aktuellen Allowlist für Textmodelle des Token Plan.
4. Fügen Sie den Dialogen zum Hinzufügen und Bearbeiten von Verbindungen eine typisierte Regionsauswahl hinzu.
5. Blenden Sie die doppelte Karte `alibaba-cn` aus und zeigen Sie deren vorhandene Verbindungen auf der Provider-Seite von `alibaba` an.
6. Lassen Sie benutzerdefinierte Endpunktüberschreibungen für fortgeschrittene und arbeitsbereichsspezifische Bereitstellungen verfügbar.

Die Medienmodelle des Token Plan bleiben außerhalb des Chat-Katalogs, da sie dedizierte Endpunkte verwenden.
`wan2.7-image` und `wan2.7-image-pro` sind in `open-sse/config/imageRegistry.ts` registriert;
`happyhorse-1.1-i2v`, `happyhorse-1.1-t2v` und `happyhorse-1.1-r2v` sind in
`open-sse/config/videoRegistry.ts` registriert. Beide Registries verwenden die Verbindungsidentität
`qwen-cloud-token-plan` und deren regionsspezifische Anmeldedaten erneut.

Der reguläre Qwen Cloud verfügt unter der Identität `qwen-cloud` über separate nutzungsbasierte Bild- und Videokataloge. Seine Bildmodelle sind `wan2.7-image-pro`, `wan2.7-image`, `qwen-image-3.0-pro`,
`qwen-image-2.0-pro-2026-06-22`, `qwen-image-2.0-2026-03-03` und `z-image-turbo`. Seine Videomodelle
sind `happyhorse-1.1-i2v`, `happyhorse-1.1-t2v`, `happyhorse-1.1-r2v`,
`happyhorse-1.0-video-edit`, `wan2.7-t2v`, `wan2.7-i2v`, `wan2.7-r2v-2026-06-12` und
`wan2.7-videoedit`. Diese Modelle verwenden ausschließlich die reguläre Verbindung `qwen-cloud` und den regionalen DashScope-Medienendpunkt. Die Registries für Token Plan und nutzungsbasierte Abrechnung übernehmen oder vereinigen die Modelllisten der jeweils anderen Registry nicht.

Die Identität `bailian-coding-plan` verfügt ebenfalls über eigene Medien-Allowlists:
`wan2.7-image`, `wan2.7-image-pro`, `qwen-image-2.0` und `qwen-image-2.0-pro` für die Bildgenerierung sowie
`happyhorse-1.1-i2v`, `happyhorse-1.1-t2v` und `happyhorse-1.1-r2v` für die Videogenerierung. Sie verwendet ausschließlich die Verbindung des Bailian Coding Plan und den regionalen Coding-Plan-Endpunkt.
Ihre Bild- und Video-Registries übernehmen oder vereinigen keine Einträge aus bzw. mit einem der beiden Qwen-Cloud-Provider.

Die reguläre Identität `alibaba` verfügt über separate Bild- und Video-Allowlists. Ihre Bildmodelle sind
`qwen-image-3.0-pro`, `qwen-image-2.0-pro-2026-06-22`, `qwen-image-2.0`,
`z-image-turbo` und `wan2.6-t2i`. Ihre zusätzlich aufgenommenen Videomodelle sind `happyhorse-1.1-i2v`,
`happyhorse-1.1-t2v`, `happyhorse-1.1-r2v`, `happyhorse-1.0-video-edit`,
`wan2.7-i2v-2026-04-25`, `wan2.6-i2v-flash`, `wan2.7-t2v-2026-06-12`,
`wan2.7-r2v-2026-06-12` und `wan2.7-videoedit`. Diese Modelle verwenden ausschließlich die Verbindung von Alibaba Model Studio und den zugehörigen ausgewählten regionalen Medienendpunkt. Sie werden keiner Coding-Plan- oder Qwen-Cloud-Registry hinzugefügt.

Der Chat-Katalog des Qwen Cloud Token Plan folgt der Text-Allowlist des Individual-Tarifs mit exakt übereinstimmenden Zeichenfolgen:
`qwen3.8-max-preview`, `qwen3.7-max`, `qwen3.7-plus`, `qwen3.6-flash`, `glm-5.2` und
`deepseek-v4-pro`. Wan- und HappyHorse-Einträge gehören zu den separaten APIs für die Bild- und Videogenerierung.

Alibaba Token Plan stellt dieselben sechs aktuellen Modell-IDs für die Textgenerierung über seinen Anthropic-kompatiblen Endpunkt bereit. Die Option Singapur speichert den bestehenden Regionsschlüssel `global-sg`; nur die für Benutzer sichtbare Bezeichnung unterscheidet sich von Provider-Familien, die die Region „Global“ nennen.

Der reguläre Chat-Katalog von Qwen Cloud ist bewusst enger gefasst als die vollständige Live-Antwort für Textmodelle. Seine gepflegte Allowlist befindet sich in `open-sse/config/providers/registry/qwen-cloud/index.ts`; die Live-Ermittlung gibt nur IDs zurück, die sowohl in der Upstream-Antwort als auch in dieser Registry-Liste enthalten sind.

Alibaba Model Studio folgt derselben Regel zur Schnittmenge mit Live-Daten und verwendet dabei seine unabhängig gepflegte Allowlist in `open-sse/config/providers/registry/alibaba/index.ts`. Der Kompatibilitäts-Provider `alibaba-cn` verwendet diesen Katalog erneut, führt die Ermittlung jedoch über den Pekinger Endpunkt aus.

## Maßgebliche Quellen

- [Basis-URLs von Alibaba Cloud Model Studio](https://www.alibabacloud.com/help/en/model-studio/base-url)
- [Übersicht über den Alibaba Cloud Token Plan](https://www.alibabacloud.com/help/en/model-studio/token-plan-overview)
- [Schnellstart für den Alibaba Cloud Token Plan](https://www.alibabacloud.com/help/en/model-studio/token-plan-quickstart)
- [Übersicht über den China Token Plan](https://help.aliyun.com/zh/model-studio/token-plan-overview)
- [Qwen Cloud Global Token Plan](https://www.qwencloud.com/pricing/token-plan)
- [Positivliste der einzelnen Modelle für den Qwen Cloud Token Plan](https://docs.qwencloud.com/token-plan/personal/token-plan-personal-overview)
- [Qwen Cloud China Token Plan](https://platform.qianwenai.com/pricing/token-plan)
- [OpenAI-Kompatibilität von Qwen Cloud](https://docs.qwencloud.com/api-reference/toolkitframework/openai-compatible/overview)

Die Quellen auf Codeebene sind `src/shared/constants/alibabaProviderRegions.ts`,
`open-sse/config/providers/registry/alibaba/index.ts`,
`open-sse/config/providers/registry/bailian-coding-plan/index.ts`,
`open-sse/config/providers/registry/qwen-cloud/index.ts` und
`open-sse/config/providers/registry/qwen-cloud-token-plan/index.ts`.
