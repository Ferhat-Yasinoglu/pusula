# Pusula A2A Server Documentation (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/A2A-SERVER.md) · 🇩🇪 [de](../../../de/docs/frameworks/A2A-SERVER.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/A2A-SERVER.md)

---

> Agent-to-Agent Protocol v0.3 — Akıllı bir yönlendirme aracısı olarak Pusula

A2A yüzeyi iki arayüze sahiptir:

- `POST /a2a` adresinde **JSON-RPC 2.0** (standart giriş noktası, `src/app/a2a/route.ts` içinde tanımlanmıştır).
- Panolar ve araçlar için `/api/a2a/*` altında **REST** (durum, görev listesi, iptal).

Görevler `A2ATaskManager` tarafından izlenir (`src/lib/a2a/taskManager.ts`, varsayılan TTL 5 dakikadır). Yetenekler, `src/lib/a2a/taskExecution.ts` içindeki `A2A_SKILL_HANDLERS` aracılığıyla yönlendirilir.

## Aracı Keşfi

```bash
curl http://localhost:20128/.well-known/agent.json
```

Pusula'un kabiliyetlerini, yeteneklerini ve kimlik doğrulama gereksinimlerini açıklayan Aracı Kartı'nı döndürür.

Aracı Kartı'nın `version` alanı `process.env.npm_package_version` kaynağından alınır (bkz. `src/app/.well-known/agent.json/route.ts:13`); böylece her sürümde `package.json` ile otomatik olarak senkronize kalır.

---

## Kimlik Doğrulama

Tüm `/a2a` istekleri, `Authorization` üstbilgisi aracılığıyla bir API anahtarı gerektirir:

```
Authorization: Bearer YOUR_PUSULA_API_KEY
```

Sunucuda herhangi bir API anahtarı yapılandırılmamışsa kimlik doğrulama atlanır.

## Etkinleştirme

A2A, **Endpoints → A2A** anahtarıyla kontrol edilir ve varsayılan olarak devre dışıdır. Devre dışı olduğunda,
`GET /api/a2a/status`, `status: "disabled"` ve `online: false` bildirir; `POST /a2a` adresine yapılan JSON-RPC çağrıları,
`-32000` JSON-RPC hata koduyla HTTP 503 döndürür.

---

## JSON-RPC 2.0 Yöntemleri

### `message/send` — Eşzamanlı Yürütme

Bir yeteneğe mesaj gönderir ve yanıtın tamamlanmasını bekler.

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/send",
    "params": {
      "skill": "smart-routing",
      "messages": [{"role": "user", "content": "Write a hello world in Python"}],
      "metadata": {"model": "auto", "combo": "fast-coding"}
    }
  }'
```

**Yanıt:**

```json
{
  "jsonrpc": "2.0",
  "id": "1",
  "result": {
    "task": { "id": "uuid", "state": "completed" },
    "artifacts": [{ "type": "text", "content": "..." }],
    "metadata": {
      "routing_explanation": "Selected claude-sonnet via provider \"anthropic\" (latency: 1200ms, cost: $0.003)",
      "cost_envelope": {
        "estimated": 0.005,
        "actual": 0.003,
        "currency": "USD"
      },
      "resilience_trace": [
        {
          "event": "primary_selected",
          "provider": "anthropic",
          "timestamp": "..."
        }
      ],
      "policy_verdict": {
        "allowed": true,
        "reason": "within budget and quota limits"
      }
    }
  }
}
```

### `message/stream` — SSE Akışı

`message/send` ile aynıdır ancak gerçek zamanlı akış için Sunucu Tarafından Gönderilen Olaylar döndürür.

```bash
curl -N -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{
    "jsonrpc": "2.0",
    "id": "1",
    "method": "message/stream",
    "params": {
      "skill": "smart-routing",
      "messages": [{"role": "user", "content": "Explain quantum computing"}]
    }
  }'
```

**SSE Olayları:**

```
data: {"jsonrpc":"2.0","method":"message/stream","params":{"task":{"id":"...","state":"working"},"chunk":{"type":"text","content":"..."}}}

: heartbeat 2026-03-03T17:00:00Z

data: {"jsonrpc":"2.0","method":"message/stream","params":{"task":{"id":"...","state":"completed"},"metadata":{...}}}
```

### `tasks/get` — Görev Durumunu Sorgulama

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":"2","method":"tasks/get","params":{"taskId":"TASK_UUID"}}'
```

### `tasks/cancel` — Bir Görevi İptal Etme

```bash
curl -X POST http://localhost:20128/a2a \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"jsonrpc":"2.0","id":"3","method":"tasks/cancel","params":{"taskId":"TASK_UUID"}}'
```

---

## Kullanılabilir Beceriler

Pusula, `src/lib/a2a/taskExecution.ts::A2A_SKILL_HANDLERS` içinde bağlanmış 6 A2A becerisi sunar. Her beceri modülü `src/lib/a2a/skills/` içinde yer alır.

| Beceri               | ID                   | Açıklama                                                                                                                                                                  | Etiketler                   | Örnekler                                     |
| :------------------- | :------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------- | :------------------------------------------- |
| Akıllı Yönlendirme   | `smart-routing`      | Pusula'un kombinasyon motoru ve puanlama sistemini kullanarak bir istemi en uygun sağlayıcı/kombinasyon üzerinden yönlendirir                                             | yönlendirme, sağlayıcılar   | "Bu istemi en iyi model üzerinden yönlendir" |
| Kota Yönetimi        | `quota-management`   | Sağlayıcı başına kota durumunu bildirir, çağrı yapanların ne zaman hız sınırlaması uygulayacağına/sağlayıcı değiştireceğine karar vermesine yardımcı olur                 | kota, sağlayıcılar          | "anthropic için kotayı kontrol et"           |
| Sağlayıcı Keşfi      | `provider-discovery` | Yüklü sağlayıcıları yetenekleri, ücretsiz katman bayrakları ve OAuth durumlarıyla listeler                                                                                | sağlayıcılar, keşif         | "Hangi sağlayıcılar kullanılabilir?"         |
| Maliyet Analizi      | `cost-analysis`      | Katalog ve son kullanıma göre bir isteğin/konuşmanın maliyetini tahmin eder                                                                                               | maliyet, kullanım           | "Bu konuşmanın maliyetini tahmin et"         |
| Sistem Durumu Raporu | `health-report`      | Sağlayıcı başına devre kesici, bekleme süresi ve kilitlenme durumlarını toplar                                                                                            | sistem durumu, dayanıklılık | "Tüm sağlayıcıların durumunu göster"         |
| Yetenekleri Listele  | `list-capabilities`  | Bağlam ekleme amacıyla ham SKILL.md URL'leri içeren bir markdown tablosu olarak 45 girdilik Agent Skills kataloğunun tamamını (23 API + 21 CLI + 1 yapılandırma) döndürür | katalog, keşif, beceriler   | "Tüm Pusula yeteneklerini listele"           |

> Agent Card, güncel 374 sağlayıcılı katalogla uyumlu tutulmalıdır; sağlayıcı sayıları ve ücretsiz/kimlik doğrulamasız kullanım meta verileri çalışma zamanı kayıt defterinden alınır.

### `list-capabilities` Beceri Ayrıntıları

`list-capabilities` becerisi, API çağrıları göndermeden önce Pusula'un neler sunduğunu keşfetmesi gereken harici aracılar için özellikle kullanışlıdır. Yapılandırılmış bir markdown tablo yapıtı döndürür:

```
| ID | Ad | Kategori | Alan | Uç Noktalar/Komutlar | Ham URL |
| --- | --- | --- | --- | --- | --- |
| pusula-auth | Kimlik Doğrulama ve Oturumlar | api | kimlik doğrulama | POST /api/auth/login, ... | https://raw.githubusercontent.com/... |
...
```

Her satır, aracıların SKILL.md dosyasının tamamını hemen getirebilmesi için `rawUrl` sütununu içerir. `metadata.totalSkills` alanı, katalog boyutunu yansıtır (bugün 45). Uygulama: `src/lib/a2a/skills/listCapabilities.ts`. Ayrıca bkz. [AGENT-SKILLS.md](./AGENT-SKILLS.md).

---

## REST API (yardımcı)

JSON-RPC uç noktası `/a2a`, standart A2A giriş noktasıdır. Aşağıdaki REST uç noktaları, panolar ve harici araçlar için yardımcı erişim sağlar:

| Uç Nokta                     | Yöntem | Açıklama                                                      | Kimlik Doğrulama                           |
| :--------------------------- | :----- | :------------------------------------------------------------ | :----------------------------------------- |
| `/api/a2a/status`            | GET    | Sunucu durumu, kayıtlı yetenekler                             | (herkese açık)                             |
| `/api/a2a/tasks`             | GET    | Görevleri filtrelerle listeleme                               | yönetim                                    |
| `/api/a2a/tasks/[id]`        | GET    | Görevi kimliğe göre alma                                      | yönetim                                    |
| `/api/a2a/tasks/[id]/cancel` | POST   | Çalışan görevi iptal etme                                     | yönetim                                    |
| `/.well-known/agent.json`    | GET    | Agent Card (A2A keşfi)                                        | (herkese açık, 3600 sn önbelleğe alınır)   |
| `/api/a2a/tasks`             | POST   | PusulaConductor filosuna gelen delegasyon (Conductor PRD RF5) | Bearer ile `PUSULA_API_KEY` + `a2aEnabled` |

**Gelen Conductor delegasyonu (`POST /api/a2a/tasks`):** Harici A2A ajanları, kodlama işlerini Pusula üzerinden PusulaConductor filosuna devreder. Gövde: `{ skill: "conductor" | "conductor-cli-<profile>", messages: [{role, content}], metadata: { conductor: { repo: { url, base_ref? }, mode?, cli?, model? } } }` — yalnızca Conductor filosu yetenekleri (Agent Card üzerinde duyurulanlar) devredilebilir; `metadata.conductor.repo.url` zorunludur (filo, git depoları üzerinde çalışır). Rota, sunucu tarafındaki `CONDUCTOR_ORCHESTRATOR_TOKEN` (yedek olarak `CONDUCTOR_HUB_TOKEN`) kullanılarak hub'ın `POST /v1/tasks` çağrısına dönüştürülür ve `201 { conductor_task_id, state: "submitted" }` döndürür; görev durumları SSE→A2A yansıtıcısı (RF1) üzerinden geri aktarılır ve `GET /api/a2a/tasks?skill=conductor` aracılığıyla görüntülenebilir.

---

## Yeni Bir Yetenek Ekleme

1. **Yetenek dosyasını oluşturun:** `src/lib/a2a/skills/<your-skill>.ts`

   `(task: A2ATask) => Promise<{ artifacts, metadata }>` biçiminde bir async fonksiyon dışa aktarın. `smartRouting.ts` gibi mevcut yeteneklerin yapısını izleyin.

2. **İşleyiciyi kaydedin:** `src/lib/a2a/taskExecution.ts` içinde `A2A_SKILL_HANDLERS` öğesine bir girdi ekleyin:

   ```typescript
   export const A2A_SKILL_HANDLERS = {
     // ...mevcut yetenekler
     "your-skill": async (task) => {
       const skillModule = await import("./skills/yourSkill");
       return skillModule.executeYourSkill(task);
     },
   };
   ```

3. **Agent Card içinde kullanıma sunun:** `src/app/.well-known/agent.json/route.ts` içinde `skills` dizisine ekleyin:

   ```json
   {
     "id": "your-skill",
     "name": "Yeteneğiniz",
     "description": "Kısa, amaca odaklı açıklama",
     "tags": ["yönlendirme", "kota"],
     "examples": ["Örnek doğal dil çağrısı"]
   }
   ```

4. **Testleri yazın:** `tests/unit/a2a-<your-skill>.test.ts`. Başarılı senaryoyu ve hata senaryosunu kapsayın.

5. Yeni yeteneği bu dosyadaki `Kullanılabilir Yetenekler` tablosunda **belgeleyin**.

---

## Görev TTL'si

Görevlerin süresi `ttlMinutes` sonrasında (varsayılan 5 dakika) dolar — bu değer `src/lib/a2a/taskManager.ts:82` konumundaki `A2ATaskManager` constructor'ında yapılandırılır. Özelleştirmek için `A2ATaskManager` örneklemesini fork'layın ve farklı bir değer iletin (ör. 15 dakikalık TTL için `new A2ATaskManager(15)`). Bir arka plan aralığı, süresi dolmuş görevleri her 60 saniyede bir temizler.

---

## Görev Yaşam Döngüsü

```
gönderildi → çalışıyor → tamamlandı
                       → başarısız
                       → iptal edildi
```

- Görevlerin süresi varsayılan olarak 5 dakika sonra dolar (bkz. [Görev TTL'si](#task-ttl))
- Sonlandırıcı durumlar: `completed`, `failed`, `cancelled`
- Olay günlüğü her durum geçişini izler

---

## Hata Kodları

| Kod    | Anlamı                            |
| :----- | :-------------------------------- |
| -32700 | Ayrıştırma hatası (geçersiz JSON) |
| -32600 | Geçersiz istek / Yetkisiz         |
| -32601 | Yöntem veya beceri bulunamadı     |
| -32602 | Geçersiz parametreler             |
| -32603 | Dahili hata                       |
| -32000 | A2A uç noktası devre dışı         |

---

## Entegrasyon Örnekleri

### Python (requests)

```python
import requests

resp = requests.post("http://localhost:20128/a2a", json={
    "jsonrpc": "2.0", "id": "1",
    "method": "message/send",
    "params": {
        "skill": "smart-routing",
        "messages": [{"role": "user", "content": "Hello"}]
    }
}, headers={"Authorization": "Bearer YOUR_KEY"})

result = resp.json()["result"]
print(result["artifacts"][0]["content"])
print(result["metadata"]["routing_explanation"])
```

### TypeScript (fetch)

```typescript
const resp = await fetch("http://localhost:20128/a2a", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer YOUR_KEY",
  },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: "1",
    method: "message/send",
    params: {
      skill: "smart-routing",
      messages: [{ role: "user", content: "Hello" }],
    },
  }),
});
const { result } = await resp.json();
console.log(result.metadata.routing_explanation);
```
