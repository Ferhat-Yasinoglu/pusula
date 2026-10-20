# Agent Protocols Guide (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/AGENT_PROTOCOLS_GUIDE.md) · 🇩🇪 [de](../../../de/docs/frameworks/AGENT_PROTOCOLS_GUIDE.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/AGENT_PROTOCOLS_GUIDE.md)

---

> **Kaynak:** `src/lib/{a2a,acp,cloudAgent}/`, `src/app/api/{a2a,acp,cloud}/`, `src/app/api/v1/agents/`
> **Son güncelleme:** 2026-06-28 — v3.8.40

Pusula, ajanlarla ilgili üç farklı arayüz sunar. İlk bakışta benzer görünseler de farklı sorunları çözerler. Doğru olanı seçmek için bu sayfayı kullanın.

## Kısaca

| Arayüz                       | En uygun kullanım                                                                                                                       | Aktarım                                  | Standart                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------ |
| **A2A — Ajandan Ajana**      | A2A protokolünü kullanan eş ajanlarla ajanlar arası iş birliği                                                                          | HTTP üzerinden JSON-RPC 2.0              | A2A v0.3 (açık standart) |
| **ACP — CLI Ajanları Kaydı** | Kullanıcının makinesinde yüklü CLI kodlama ajanlarını (Cursor, Cline, Codex CLI, Claude Code, Aider vb.) algılama / kaydetme / başlatma | HTTP REST                                | Pusula'a özgü         |
| **Bulut Ajanları**           | Uzun süren kodlama görevlerini harici bulut hizmetlerine (Codex Cloud, Devin, Jules, Cursor Cloud) gönderme                             | HTTP REST + veritabanı destekli görevler | Pusula'a özgü         |

Bu üçü birbirinden bağımsızdır — istediğiniz herhangi bir alt kümeyi seçebilirsiniz.

## Karar Ağacı

```
Bu makinenin dışında iş yapmak için bir bulut hizmetine (Codex Cloud / Cursor Cloud / Devin / Jules) ihtiyacınız var mı?
├─ EVET → Bulut Ajanları (POST /api/v1/agents/tasks)
└─ HAYIR → Devam edin
    │
    A2A kullanan ve iş birliği yapmak isteyen bir eş ajanınız var mı?
    ├─ EVET → A2A (POST /a2a)
    └─ HAYIR → Devam edin
        │
        Yerel olarak yüklü CLI kodlama ajanlarını listelemeniz / yapılandırmanız gerekiyor mu?
        ├─ EVET → ACP (GET /api/acp/agents)
        └─ HAYIR → Standart /v1/chat/completions kullanın
```

## 1. A2A — Ajandan Ajana

**Standart:** [A2A v0.3](https://a2a-protocol.org)
**Pusula uç noktası:** `POST /a2a` (JSON-RPC 2.0)
**Ajan Kartı:** `GET /.well-known/agent.json`

### Ne zaman kullanılmalı?

- Pusula'un eşlerden biri olduğu çok ajanlı bir sistem oluştururken
- Pusula'un yönlendirme zekâsını (akıllı yönlendirme, kota yönetimi vb.) Google ADK gibi çerçevelerdeki veya genel ajan ağlarındaki ajanlara sunarken
- Pusula'u standart bir keşif + çağırma arayüzünün arkasında sarmalarken

### Yöntemler

- `message/send` — bir mesaj gönderir ve eşzamanlı yanıt alır
- `message/stream` — mesaj gönderir ve SSE ile aktarılan ilerleme olaylarını alır
- `tasks/get` — görevi kimliğine göre okur
- `tasks/cancel` — çalışan bir görevi iptal eder

### Yerleşik beceriler (6)

- `smart-routing` — bir istemi en uygun kombinasyon üzerinden yönlendirir
- `quota-management` — sağlayıcı başına kota durumunu bildirir
- `provider-discovery` — yüklü sağlayıcıları yetenekleriyle birlikte listeler
- `cost-analysis` — bir isteğin/görüşmenin maliyetini tahmin eder
- `health-report` — sağlayıcı başına devre kesici/bekleme/kilitleme durumunu toplu olarak bildirir
- `list-capabilities` — ajanın kullanılabilir becerilerini ve meta verilerini sıralar

### Ayrıntılı inceleme

Aktarım ayrıntıları, ajan kartı yapısı, görev TTL yapılandırması ve yeni beceriler ekleme şablonu için [A2A-SERVER.md](./A2A-SERVER.md) belgesine bakın.

## 2. ACP — CLI Aracıları Kayıt Defteri

**Pusula uç noktası:** `GET /api/acp/agents`
**Kaynak:** `src/lib/acp/{index,manager,registry}.ts`

### Nedir?

ACP, Pusula'un **yerel CLI aracısı envanteridir**. Ana makinede hangi kodlama CLI'larının yüklü olduğunu (Cursor, Cline, Claude Code, Codex CLI, Continue vb.) algılar, sürümlerini belirler ve kullanıcının her CLI'ı Pusula'u işaret edecek şekilde yapılandırabilmesi için bunları panoda gösterir.

Bu harici bir protokol DEĞİLDİR; "CLI Tools" kullanıcı arayüzünü ve CLI parmak izi takibini destekleyen dahili bir kayıt defteridir (bkz. [CLI-TOOLS.md](../reference/CLI-TOOLS.md)).

### Ne yapar?

- Ana makinede yüklü CLI ikili dosyalarını tarar (işletim sistemine göre `which` / `where` kullanır)
- Her CLI'ın sürümünü okur (`<bin> --version` çağrısını yapar)
- İsteğe bağlı olarak kullanıcı tanımlı özel aracıları kabul eder (ikili dosya yolu + sürüm sorgusu + başlatma argümanları)
- Özel aracıları ayarlarda kalıcı olarak saklar
- Birleştirilmiş listeyi panoya döndürür

### REST API

| Uç nokta          | Yöntem | Açıklama                                                          | Kimlik doğrulama |
| ----------------- | ------ | ----------------------------------------------------------------- | ---------------- |
| `/api/acp/agents` | GET    | Algılanan + özel aracıları listeler (yüklü/toplam sayıları)       | API anahtarı     |
| `/api/acp/agents` | POST   | Özel aracı ekler/günceller/kaldırır (gövdede eylem ayırt edicisi) | API anahtarı     |

POST için gövde yapısı (`src/app/api/acp/agents/route.ts` içindeki `customAgentBodySchema`):

```json
{
  "action": "add|update|remove",
  "id": "cursor",
  "name": "Cursor",
  "binary": "/usr/local/bin/cursor",
  "versionCommand": "--version",
  "providerAlias": "cursor",
  "spawnArgs": ["--api-base", "http://localhost:20128"],
  "protocol": "stdio"
}
```

### Kullanım alanları

- Panodaki "CLI Tools" sayfası, yüklü olanları listeler ve her birini Pusula'u işaret edecek şekilde yapılandırmanıza yardımcı olur
- Özel aracılar, ileri düzey kullanıcıların Pusula'un varsayılan olarak tanımadığı dahili/tescilli CLI'ları kaydetmesine olanak tanır
- Algılama sonucu, `cli-tools` parmak izi matrisini besler

### ACP ne zaman KULLANILMAMALIDIR?

- ACP görevleri _çalıştırmaz_. Yalnızca CLI'ları algılar ve yapılandırır. Bir CLI'ı gerçekten çağırmak için Pusula'un sağladığı ortam değişkenleriyle (`OPENAI_BASE_URL`, `OPENAI_API_KEY` vb.) kendiniz başlatmanız gerekir.

## 3. Bulut Aracıları

**Pusula uç noktaları:** `/api/v1/agents/tasks/*` (yaşam döngüsü) + `/api/cloud/*` (altyapı)
**Kaynak:** `src/lib/cloudAgent/`

### Nedir?

Üçüncü taraf bulut kodlama aracıları üzerinde birleşik bir arayüzdür. Bir istem + depo URL'si gönderirsiniz; Pusula bunu doğru bulut aracısına iletir, durumu yoklar ve sonuçları döndürür.

### Desteklenen aracılar (3, tümü `src/lib/cloudAgent/agents/` içinde doğrulanmıştır)

- `codex-cloud` — OpenAI Codex Cloud
- `devin` — Cognition Devin
- `jules` — Google Jules

### Yaşam döngüsü

```
POST /api/v1/agents/tasks
  → Aracı sınıfı başına BaseAgent.createTask()
  → harici hizmet çalışmaya başlar
  → DB'de görev satırı oluşturulur (cloud_agent_tasks)
  ↓
GET /api/v1/agents/tasks/[id]
  → sağlayıcıdan tembel durum eşitlemesi
  → mevcut durumu + planı + etkinlik günlüğünü döndürür
  ↓
POST /api/v1/agents/tasks/[id]   (eylem: "approve" | "message" | "cancel")
  → sağlayıcıya iletir (veya yerel olarak iptal edildi şeklinde işaretler)
  ↓
DELETE /api/v1/agents/tasks/[id]
  → yerel iptal
```

### Kimlik doğrulama

⚠️ **Tüm `/api/v1/agents/tasks/*` uç noktaları yönetim kimlik doğrulaması gerektirir** (`588a0333` kaydı). Yalnızca Bearer kullanan çağrılar, v3.8.0 sürümünden beri 401 yanıtı alır.

### Ayrıntılı inceleme

`CloudAgentBase` sözleşmesi, aracıya özgü ayrıntılar, şema detayları ve kimlik bilgileri altyapısı uç noktaları için [CLOUD_AGENT.md](./CLOUD_AGENT.md) dosyasına bakın.

## Karşılaştırma: A2A ve Cloud Agents

Her ikisi de "uzun süren görevler" sunar, ancak farklı katmanlarda:

| Unsur                   | A2A                                                                                               | Cloud Agents                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| Standart                | Açık A2A v0.3                                                                                     | Pusula'a özgü                                    |
| İşlemin çalıştığı yer   | Pusula içinde (yapılandırılmış kombinasyonları kullanır)                                       | Harici (Codex / Devin / Jules sunucuları)           |
| Görev süresi            | Varsayılan TTL 5 dk. (`TaskManager` içinde yapılandırılabilir)                                    | Dakikalardan saatlere                               |
| Depo bilgisine sahip mi | Hayır (yalnızca istemleri iletir)                                                                 | Evet (depo URL'si + dal)                            |
| Kullanım alanı          | Ajanlar arası iş birliği, hizmet olarak akıllı yönlendirme                                        | "Y deposunda X özelliğini uygula" görevini devretme |
| Kimlik doğrulama        | `/a2a` için isteğe bağlı `PUSULA_API_KEY`; `/api/a2a/*` REST yardımcıları için yönetim erişimi | Her zaman yönetim erişimi                           |

## Entegrasyon Örnekleri

### Pusula'un A2A yeteneklerini keşfetme

```bash
curl http://localhost:20128/.well-known/agent.json
```

Tüm 6 beceriyi, aktarım yöntemlerini ve sürümü içeren Ajan Kartı'nı döndürür.

### Pusula'u bir A2A ajanı olarak çağırma

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "message/send",
    "params": {
      "messages": [{"role": "user", "content": "Bu istemi yönlendir"}],
      "skill": "smart-routing"
    },
    "id": 1
  }'
```

### ACP aracılığıyla yüklü CLI ajanlarını listeleme

```bash
curl http://localhost:20128/api/acp/agents \
  -H "Authorization: Bearer <api-key>"
```

### Özel bir CLI ajanı ekleme

```bash
curl -X POST http://localhost:20128/api/acp/agents \
  -H "Authorization: Bearer <api-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "add",
    "id": "my-custom-cli",
    "name": "My Custom CLI",
    "binary": "/opt/mycli/bin/mycli",
    "versionCommand": "--version",
    "providerAlias": "openai"
  }'
```

### Bir Cloud Agent görevi gönderme

```bash
curl -X POST http://localhost:20128/api/v1/agents/tasks \
  -H "Cookie: auth_token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "devin",
    "prompt": "Y deposunda X özelliğini uygula",
    "source": {
      "repoName": "user/repo",
      "repoUrl": "https://github.com/user/repo",
      "branch": "main"
    }
  }'
```

### Bulut görevinin durumunu düzenli olarak sorgulama

```bash
curl http://localhost:20128/api/v1/agents/tasks/<task-id> \
  -H "Cookie: auth_token=..."
```

## Hangisi Ne Zaman Kullanılmalı?

- **Sohbet botu / copilot ön yüzü** → `/v1/chat/completions` (OpenAI uyumlu — bir ajan protokolü değildir)
- **Çok ajanlı iş birliği** → A2A
- **Yerel CLI'ları kontrol panelinde listeleme** → ACP
- **Uzun süren kodlama görevlerini bulut hizmetlerine devretme** → Cloud Agents

## İç Mimari

```
                ┌─────────────────────┐
                │   Pusula Core    │
                └─────────────────────┘
                  ↑       ↑        ↑
        ┌─────────┘       │        └─────────┐
        │                 │                  │
    ┌───────┐        ┌─────────┐       ┌────────────┐
    │  A2A  │        │   ACP   │       │  Bulut     │
    │ (/a2a)│        │ (/acp)  │       │  Ajanları  │
    └───────┘        └─────────┘       │ (/v1/agents│
        │                 │            │  /tasks)   │
        ↓                 ↓            └────────────┘
   A2A v0.3        Ana makinedeki           │
   kullanan harici yerel CLI                ↓
   eş ajanlar      ikilileri           Codex Cloud, Cursor,
                                        Devin, Jules
```

## Ayrıca Bkz.

- [A2A-SERVER.md](./A2A-SERVER.md) — A2A hakkında ayrıntılı inceleme
- [CLOUD_AGENT.md](./CLOUD_AGENT.md) — Bulut Ajanları hakkında ayrıntılı inceleme
- [CLI-TOOLS.md](../reference/CLI-TOOLS.md) — Harici CLI entegrasyonları (ACP kullanır)
- [SKILLS.md](./SKILLS.md) — Yetenekler çerçevesi (A2A yeteneklerinden farklıdır — yerel yürütme korumalı alanı)
- [API_REFERENCE.md](../reference/API_REFERENCE.md#agents-protocol) — uç nokta referansı
- Kaynak: `src/lib/{a2a,acp,cloudAgent}/`
