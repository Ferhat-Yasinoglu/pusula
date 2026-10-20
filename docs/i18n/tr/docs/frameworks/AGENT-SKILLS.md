# Pusula Agent Skills Catalog (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/AGENT-SKILLS.md) · 🇩🇪 [de](../../../de/docs/frameworks/AGENT-SKILLS.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/AGENT-SKILLS.md)

---

> **Doğruluk kaynağı:** `src/lib/agentSkills/` (katalog, oluşturucu, ayrıştırıcılar) + `skills/` dizini (SKILL.md dosyaları)
> **Son güncelleme:** 2026-08-02 — v3.8.50

Agent Skills; harici agent'lara, MCP istemcilerine ve A2A orkestratörlerine Pusula'un REST API'sini ve CLI'ını nasıl kullanacaklarını öğreten, yapılandırılmış SKILL.md dosyalarıdır. [Pusula Skills](./SKILLS.md)'den (Pusula içinde yürütülen LLM araç tanımlarıdır) farklı olarak Agent Skills, doğrudan agent bağlamına aktarılabilen statik markdown içeriğinden oluşan bir _dokümantasyon kataloğudur_.

---

## Genel Bakış

Katalogda **45 Agent Skill** bulunur (23 REST API + 21 CLI + 1 yapılandırma iş akışı). Her skill şunlara sahiptir:

- Bir **standart ID** (`pusula-auth`, `cli-serve` vb.)
- YAML frontmatter (`name`, `description`) ve zengin bir markdown gövdesi içeren `skills/{id}/SKILL.md` konumundaki bir **SKILL.md** dosyası
- OpenAPI spesifikasyonundan ve CLI kayıt defterinden türetilen **REST endpoint'leri** (API skill'leri) veya **CLI alt komutları** (CLI skill'leri)
- Canlı erişim için bir **GitHub ham içerik URL'si**: `https://raw.githubusercontent.com/Ferhat-Yasinoglu/pusula/refs/heads/main/skills/{id}/SKILL.md`

---

## Mimari

```
src/shared/constants/agentSkills.ts    — 45 girdiden oluşan, özenle hazırlanmış liste (ad/açıklama/kategori/alan/simge)
src/lib/agentSkills/
  catalog.ts                           — getCatalog(), getSkillById(), filterCatalog(), computeCoverage()
  generator.ts                         — generateAgentSkills(), SKILL.md dosyasını skills/{id}/ konumuna yazar
  openapiParser.ts                     — REST endpoint'lerini docs/openapi.yaml dosyasından çıkarır
  cliRegistryParser.ts                 — CLI alt komutlarını bin/cli-registry.ts dosyasından çıkarır
  schemas.ts                           — Zod şemaları: AgentSkillSchema, SkillCoverageSchema vb.
  types.ts                             — TypeScript arayüzleri: AgentSkill, SkillCoverage vb.

skills/{id}/SKILL.md                   — Oluşturulmuş ve özenle düzenlenmiş markdown dosyaları (toplam 45)

src/app/api/agent-skills/
  route.ts                             — GET /api/agent-skills
  [id]/route.ts                        — GET /api/agent-skills/{id}
  [id]/raw/route.ts                    — GET /api/agent-skills/{id}/raw (text/markdown)
  coverage/route.ts                    — GET /api/agent-skills/coverage
  generate/route.ts                    — POST /api/agent-skills/generate (kimlik doğrulama gereklidir)

open-sse/mcp-server/tools/agentSkillTools.ts  — 3 MCP aracı (listeleme, getirme, kapsam)
src/lib/a2a/skills/listCapabilities.ts        — A2A skill'i: list-capabilities
```

---

## SKILL.md Biçimi

```markdown
---
name: pusula-providers
description: "Sağlayıcı bağlantılarını yönetin: kimlik bilgilerini ekleyin, test edin, döndürün ve kaldırın."
---

<!-- src/lib/agentSkills/generator.ts tarafından oluşturuldu; manuel düzenlemelerin üzerine yazılacaktır -->

## Genel Bakış

...

## Kimlik Doğrulama

...

## Endpoint'ler

...

<!-- skill:custom-start -->

## Özel Bölüm (yeniden oluşturma sırasında korunur)

...

<!-- skill:custom-end -->
```

Oluşturucu, yeniden oluşturma sırasında `<!-- skill:custom-start -->` ile `<!-- skill:custom-end -->` arasındaki içeriği korur. On skill, özenle hazırlanmış özel bloklara sahiptir:

`pusula-mcp`, `pusula-compression`, `cli-providers`, `cli-eval`, `pusula-agents-a2a`, `pusula-combos-routing`, `pusula-auth`, `pusula-resilience`, `pusula-inference`, `cli-serve`.

---

## REST API Keşfi

| Uç Nokta                     | Yöntem | Açıklama                                                                 | Kimlik Doğrulama |
| :--------------------------- | :----- | :----------------------------------------------------------------------- | :--------------- |
| `/api/agent-skills`          | GET    | Kataloğu listele (isteğe bağlı `?category=api\|cli\|config&area=<area>`) | yok              |
| `/api/agent-skills/{id}`     | GET    | Tek bir yeteneğin meta verilerini al                                     | yok              |
| `/api/agent-skills/{id}/raw` | GET    | SKILL.md dosyasını `text/markdown` olarak getir                          | yok              |
| `/api/agent-skills/coverage` | GET    | Kapsam istatistikleri (kaç adet SKILL.md dosyasının bulunduğu)           | yok              |
| `/api/agent-skills/generate` | POST   | Oluşturucuyu tetikle (dryRun/prune/onlyIds)                              | yönetim          |

Örnek — tüm API yeteneklerini listeleme:

```bash
curl "http://localhost:20128/api/agent-skills?category=api"
```

Örnek — tek bir SKILL.md dosyasını getirme:

```bash
curl -H "Accept: text/markdown" "http://localhost:20128/api/agent-skills/pusula-providers/raw"
```

---

## MCP Keşfi

`read:catalog` kapsamı altında üç MCP aracı kayıtlıdır:

| Araç                              | Açıklama                                                           |
| :-------------------------------- | :----------------------------------------------------------------- |
| `pusula_agent_skills_list`     | Yetenekleri listele (isteğe bağlı `category` / `area` filtreleri)  |
| `pusula_agent_skills_get`      | `id` ile tek bir yeteneğin meta verilerini + SKILL.md dosyasını al |
| `pusula_agent_skills_coverage` | Kapsam istatistikleri (API/CLI mevcut/toplam)                      |

Kapsam bağlantıları ve kimlik doğrulama için [MCP-SERVER.md](./MCP-SERVER.md) belgesine bakın.

---

## A2A Keşfi

A2A `list-capabilities` yeteneği, 45 yeteneğin tamamını içeren kataloğu bir markdown tablo yapıtı olarak döndürür. Harici orkestratörler bunu şu şekilde çağırabilir:

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "method": "message/send",
  "params": {
    "skill": "list-capabilities",
    "messages": [{ "role": "user", "content": "Tüm yetenekleri listele" }]
  }
}
```

Protokol ayrıntıları için [A2A-SERVER.md](./A2A-SERVER.md) belgesine bakın.

---

## Katalog — 45 Yetenek Kimliği

### API Yetenekleri (23)

| Kimlik                 | Alan            | Giriş Noktası                        |
| :--------------------- | :-------------- | :----------------------------------- |
| `pusula-auth`            | auth            | Kimlik doğrulama + oturum yönetimi   |
| `pusula-providers`       | providers       | Sağlayıcı bağlantısı yönetimi        |
| `pusula-models`          | models          | Model kataloğu ve yetenekleri        |
| `pusula-combos-routing`  | combos-routing  | Kombinasyon yönlendirme stratejileri |
| `pusula-api-keys`        | api-keys        | API anahtarı yönetimi                |
| `pusula-usage-logs`      | usage-logs      | Kullanım ve maliyet günlükleri       |
| `pusula-budget`          | budget          | Bütçe korumaları                     |
| `pusula-settings`        | settings        | Genel ayarlar                        |
| `pusula-proxies`         | proxies         | Proxy havuzu yönetimi                |
| `pusula-cache`           | cache           | Anlamsal + istem önbelleği           |
| `pusula-compression`     | compression     | Bağlam sıkıştırma motorları          |
| `pusula-context-rtk`     | context-rtk     | RTK sıkıştırması                     |
| `pusula-resilience`      | resilience      | Devre kesiciler + bekleme süreleri   |
| `pusula-cli-tools`       | cli-tools       | CLI araçları REST proxy'si           |
| `pusula-tunnels`         | tunnels         | Tünel yönetimi                       |
| `pusula-sync-cloud`      | sync-cloud      | Bulut senkronizasyonu                |
| `pusula-db-backups`      | db-backups      | Veritabanı yedekleri                 |
| `pusula-webhooks`        | webhooks        | Webhook olay dağıtıcısı              |
| `pusula-mcp`             | mcp             | MCP sunucusu (110 araç, 3 aktarım)   |
| `pusula-agents-a2a`      | agents-a2a      | A2A aracı protokolü                  |
| `pusula-version-manager` | version-manager | Sürüm ve güncelleme yönetimi         |
| `pusula-inference`       | inference       | Doğrudan çıkarım / tamamlamalar      |

### CLI Yetenekleri (21)

| Kimlik                | Alan               | CLI Komut Kökü          |
| :-------------------- | :----------------- | :---------------------- |
| `cli-serve`           | cli-serve          | `pusula serve`       |
| `cli-health`          | cli-health         | `pusula health`      |
| `cli-providers`       | cli-providers      | `pusula providers`   |
| `cli-keys`            | cli-keys           | `pusula keys`        |
| `cli-models`          | cli-models         | `pusula models`      |
| `cli-chat`            | cli-chat           | `pusula chat`        |
| `cli-routing`         | cli-routing        | `pusula routing`     |
| `cli-resilience`      | cli-resilience     | `pusula resilience`  |
| `cli-compression`     | cli-compression    | `pusula compression` |
| `cli-contexts`        | cli-contexts       | `pusula contexts`    |
| `cli-cost-usage`      | cli-cost-usage     | `pusula cost`        |
| `cli-mcp`             | cli-mcp            | `pusula mcp`         |
| `cli-a2a`             | cli-a2a            | `pusula a2a`         |
| `cli-tunnel`          | cli-tunnel         | `pusula tunnel`      |
| `cli-backup-sync`     | cli-backup-sync    | `pusula backup`      |
| `cli-policy-audit`    | cli-policy-audit   | `pusula policy`      |
| `cli-batches`         | cli-batches        | `pusula batch`       |
| `cli-eval`            | cli-eval           | `pusula eval`        |
| `cli-plugins-skills`  | cli-plugins-skills | `pusula plugins`     |
| `cli-setup`           | cli-setup          | `pusula setup`       |
| `cli-skill-collector` | cli-setup          | `pusula skills`      |

### Yapılandırma iş akışı (1)

| ID                 | Alan             | Giriş Noktası                   |
| :----------------- | :--------------- | :------------------------------ |
| `config-codex-cli` | config-codex-cli | Codex CLI yapılandırma iş akışı |

---

## Harici Aracılar Skill'leri Nasıl Kullanır

### 1. REST ile Keşif

```bash
# Tam kataloğu alın
curl "http://your-pusula/api/agent-skills" | jq '.skills[] | {id, name, category}'

# Bağlam enjeksiyonu için SKILL.md dosyasını alın
curl "http://your-pusula/api/agent-skills/pusula-providers/raw" > pusula-providers.md
```

### 2. MCP ile Keşif

```typescript
// Bir Claude Desktop / Cursor MCP istemcisinde:
const result = await client.callTool("pusula_agent_skills_list", {
  category: "api",
});
// result.skills → her biri rawUrl içeren AgentSkill dizisi
```

### 3. A2A ile Keşif

```python
import requests

resp = requests.post("http://your-pusula/a2a", json={
    "jsonrpc": "2.0", "id": "1",
    "method": "message/send",
    "params": {"skill": "list-capabilities", "messages": [{"role": "user", "content": "list"}]}
})
table = resp.json()["result"]["artifacts"][0]["content"]
# table, 45 skill kimliğinin tamamını ve rawUrl sütunlarını içeren bir markdown tablosudur
```

### 4. Doğrudan GitHub raw getirme (sunucu gerekmez)

```bash
BASE="https://raw.githubusercontent.com/Ferhat-Yasinoglu/pusula/refs/heads/main/skills"
curl "${BASE}/pusula-providers/SKILL.md"
```

---

## Oluşturucu

Oluşturucu, düzenlenmiş kataloğu + OpenAPI belirtimini + CLI kayıt defterini okur ve her girdi için `skills/{id}/SKILL.md` dosyasını yazar:

```bash
# Önizleme (deneme çalıştırması, yazma işlemi yok)
curl -X POST http://localhost:20128/api/agent-skills/generate \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}'

# Tam yeniden oluşturma
curl -X POST http://localhost:20128/api/agent-skills/generate \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"prune":false}'

# Belirli kimlikleri yeniden oluşturun
curl -X POST http://localhost:20128/api/agent-skills/generate \
  -H "Authorization: Bearer <admin-key>" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":false,"onlyIds":["pusula-providers","cli-serve"]}'
```

Oluşturucu yanıtı bir `GeneratorReport` nesnesidir:

```json
{
  "generated": ["pusula-providers", "cli-serve"],
  "unchanged": [],
  "pruned": [],
  "orphansDetected": [],
  "errors": []
}
```

---

## Kapsam API'si

```bash
curl "http://localhost:20128/api/agent-skills/coverage"
```

```json
{
  "api": { "have": 23, "total": 23 },
  "cli": { "have": 21, "total": 21 },
  "config": { "have": 1, "total": 1 },
  "totalSkills": 45,
  "generatedAt": "2026-08-02T00:00:00.000Z"
}
```

---

## İlgili Kaynaklar

- [SKILLS.md](./SKILLS.md) — Pusula Skills çerçevesi (LLM araç enjeksiyonu + pazar yeri)
- [MCP-SERVER.md](./MCP-SERVER.md) — MCP araç kataloğu (`pusula_agent_skills_*` araçları)
- [A2A-SERVER.md](./A2A-SERVER.md) — A2A protokolü (`list-capabilities` skill'i)
- `src/lib/agentSkills/` — katalog, oluşturucu, ayrıştırıcılar
- `skills/` — oluşturulan SKILL.md dosyaları (45 girdi)
