# CLI Tools — Pusula (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/CLI-TOOLS.md) · 🇩🇪 [de](../../../de/docs/reference/CLI-TOOLS.md) · 🇮🇷 [fa](../../../fa/docs/reference/CLI-TOOLS.md)

---

Son güncelleme: 2026-08-23

Pusula, üç özel pano sayfasına yayılmış üç CLI aracı kategorisiyle entegre olur:

| Sayfa          | Rota                    | Kavram                                                                                | Sayı                  |
| -------------- | ----------------------- | ------------------------------------------------------------------------------------- | --------------------- |
| **CLI Code's** | `/dashboard/cli-code`   | Pusula'a yönlendirdiğiniz kodlama araçları (İstemci → CLI → Pusula → Sağlayıcı) | 26                    |
| **CLI Agents** | `/dashboard/cli-agents` | Pusula'a yönlendirdiğiniz otonom ajanlar (aynı akış, daha geniş kapsam)            | 10                    |
| **ACP Agents** | `/dashboard/acp-agents` | Pusula'un stdio/ACP aracılığıyla arka uç olarak başlattığı CLI'lar (ters akış)     | kayıt defterine bakın |

Eski rotalar 308 ile yönlendirilir: `/dashboard/cli-tools` → `/dashboard/cli-code`, `/dashboard/agents` → `/dashboard/acp-agents`.

---

## Nasıl Çalışır?

```
CLI Code's / CLI Agents (tüketim akışı):
Claude / Codex / OpenCode / Cline / KiloCode / Continue / Hermes Agent / Goose / ...
           │
           ▼  (tümü Pusula'a yönlendirilir)
    http://YOUR_SERVER:20128/v1
           │
           ▼  (Pusula, isteği doğru sağlayıcıya yönlendirir)
    Anthropic / OpenAI / Gemini / DeepSeek / Groq / Mistral / ...

ACP Agents (ters başlatma akışı):
    İstemci isteği → Pusula → CLI'ı stdio/ACP aracılığıyla başlatır → yanıt
```

**Avantajlar:**

- Tüm araçları yönetmek için tek bir API anahtarı
- Panoda tüm CLI'lar genelinde maliyet takibi
- Her aracı yeniden yapılandırmadan model değiştirme
- Yerel olarak ve uzak sunucularda çalışır (VPS, Docker, Akamai, Cloudflare Tunnel)

---

## `setup-*` ile Otomatik Yapılandırma

Her aracın yapılandırmasını elle yazmak zorunda değilsiniz. Pusula, desteklenen her CLI için, çalışan bir Pusula'tan (yerel veya uzak) **canlı** model kataloğunu okuyan ve aracın kendi yapılandırmasını makinenize yazan bir `setup-*` komutu sunar:

```bash
pusula setup-codex        pusula setup-claude       pusula setup-opencode
pusula setup-cline        pusula setup-kilo         pusula setup-continue
pusula setup-cursor       pusula setup-roo          pusula setup-crush
pusula setup-goose        pusula setup-qwen         pusula setup-aider
pusula setup-5dive
```

Her biri `--remote <url> --api-key <key>` (uzak bir Pusula'a karşı yerel bir aracı yapılandırma), `--dry-run` (yazmadan önizleme) ve `--port` parametrelerini kabul eder. Model otomatik keşfi olmayan araçlar (Cline, Kilo, Roo, Goose, Aider, Qwen, 5dive) `--model <id>` (ve etkileşimsiz çalıştırmalar için `--yes`) parametresini alır. `setup-5dive`, `$HOME` altına yazmayan tek tariftir: filo ana bilgisayarında kök sahipli bir kimlik doğrulama profili yazarak bir 5dive aracı filosunu yapılandırır, bu nedenle `sudo` aracılığıyla yeniden yürütülür ve kendi uzak modu yoktur. Doğru ortam enjekte edilmiş ve hiç yapılandırma yazılmamış bir CLI başlatmak için genel `pusula run <target>` başlatıcısını kullanın (claude, codex, aider, goose, opencode, qwen, gemini — hedefler ve takma adlar `bin/cli/cli-manifest.mjs` dosyasından gelir); eski araç başına başlatıcılar `pusula launch` (Claude Code) ve `pusula launch-codex` (Codex) hala mevcuttur. Gemini CLI yalnızca başlatma amaçlıdır: bir `pusula run` hedefidir ancak `setup-*`/`configure` tarifi yoktur.

> **Tam referans:** her komutun ne yazdığı, her bayrak, yerel ve uzak arasındaki farklar ve hangi araçların `/v1` soneki istediği gibi ana tablo **[CLI Entegrasyonları](../guides/CLI-INTEGRATIONS.md)** bölümünde yer almaktadır.

### Bunları bir kapsayıcı içinde çalıştırma

Pusula kapsayıcısı içinde yürütülen bir `setup-*` komutu, kapsayıcının kendi ana dizinine yazar; bu dizin hiçbir ana bilgisayar CLI'si tarafından okunmaz ve kapsayıcıyla birlikte kaybolur. Pusula bunu algılar ve yazmak yerine talimatlarla birlikte `2` koduyla çıkar. İki desteklenen yol vardır — CLI'yi ana bilgisayara kurup kapsayıcıya `pusula connect` yapmak veya yapılandırma dizinlerini bağlayıp `CLI_CONFIG_HOME`'u (compose `host` profili) ayarlamak. Her `setup-*` komutu, ayrıca `pusula configure` ve `pusula config set`, kapsayıcının kendi CLI'larını yapılandırmak istediğinizde `--allow-container-write` parametresini kabul eder; `PUSULA_ALLOW_CONTAINER_CONFIG_WRITE=true` sunucu için de aynısını yapar. [Docker Kılavuzu → Ana bilgisayar CLI araçlarını yapılandırma](../guides/DOCKER_GUIDE.md#configuring-host-cli-tools-when-pusula-runs-in-docker) bölümüne bakın.

Kontrol panelinin **uygulama uç noktası** (`POST /api/cli-tools/apply`) aynı korumayı uygular: bir kapsayıcıda, hedefi ana bilgisayardan bağlanmamış bir yazma işlemi, `containerEphemeralTarget: true` ile **`422`** yanıtı verir, güvenli hata metni ve — ana bilgisayar tarifi olan araçlar için (claude, codex, opencode, cline, kilo, continue) — bunun yerine ana bilgisayarda çalıştırılacak bir `hostSetupCommand` (örn. `pusula setup-opencode`) sağlar; hiçbir şey yazılmaz. `dryRun: true` kapsayıcı modunda çalışmaya devam eder ve diske dokunmadan sansürlenmiş bir önizleme + hedef yolu döndürür. Önizleme içeriği, kopyalanacak veya içe aktarılacak kimlik bilgisi içeren bir yapılandırma değildir. Ana bilgisayarda orijinal araç/temel URL/API anahtarı/model girdileriyle uygulayın veya belirtilen ana bilgisayar tarafı kurulum komutunu kullanın. Önizleme başlığı ve istek sözleşmesi için [CLI yapılandırma güvenliği](../security/CLI-CONFIGURATION.md) bölümüne bakın. Bu davranış kasıtlıdır ve `tests/unit/api/cli-tools/apply-container-guard.test.ts` tarafından regresyonlara karşı korunmaktadır — bir 422 hatasını korumayı kaldırarak asla "düzeltmeyin".

---

## Doğruluk Kaynağı

Birleşik katalog, `src/shared/constants/cliTools.ts` dosyasında `CLI_TOOLS: Record<string, CliCatalogEntry>` olarak yer alır.

Her girdi şu alanlara sahiptir (`src/shared/schemas/cliCatalog.ts` içinde tanımlanmıştır):

| Alan                                            | Tür                                                          | Açıklama                                                     |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `category`                                      | `"code" \| "agent"`                                          | Aracın hangi sayfada göründüğü                               |
| `vendor`                                        | `string`                                                     | Aracın kaynağı ("Anthropic", "OSS (P. Gauthier)")            |
| `acpSpawnable`                                  | `boolean`                                                    | ACP Agent olarak da kullanılabilir (rozet gösterilir)        |
| `baseUrlSupport`                                | `"full" \| "partial" \| "none"`                              | Özel uç nokta destek düzeyi. `"none"` = MITM bekleme listesi |
| `configType`                                    | `"env" \| "custom" \| "guide" \| "custom-builder" \| "mitm"` | Yapılandırma mekanizması                                     |
| `id`, `name`, `color`, `description`, `docsUrl` | standart                                                     | Temel görüntüleme alanları                                   |

`baseUrlSupport: "none"` içeren girdiler pano sayfalarında **gösterilmez** — plan 11 için MITM bekleme listesine kaydedilirler (bkz. `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md`).

### Yetenek katmanları (kataloglanmış × algılanabilir × yapılandırılabilir × başlatılabilir)

Kataloglanan her araç algılanabilir, yapılandırılabilir veya başlatılabilir değildir. Her katmanın
tek bir bildirim kaynağı vardır ve bir sapma testi bunların uyumlu kalmasını sağlar:

| Katman                 | Anlamı                                                                                      | Bildirildiği yer                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Kataloglanmış**      | Pano kataloğunda görünür (ad, sağlayıcı, belgeler, yapılandırma türü)                       | `src/shared/constants/cliTools.ts` (`CLI_TOOLS`)                          |
| **Algılanabilir**      | İkili dosya/yapılandırma algılama, sistem durumu kontrolleri, yapılandırma yolları          | `src/shared/services/cliRuntime.ts` (`CLI_TOOLS` çalışma zamanı kataloğu) |
| **Yapılandırılabilir** | `pusula configure <cli>` tarafından desteklenir (kurulum tarifi mevcuttur)               | `bin/cli/cli-manifest.mjs` (`configure: true`)                            |
| **Başlatılabilir**     | `pusula run <target>` tarafından desteklenir (ortam/değişken enjeksiyonu tanımlanmıştır) | `bin/cli/cli-manifest.mjs` (`run: true`)                                  |

`bin/cli/cli-manifest.mjs`, CLI komut
yüzeyleri için kurallı çalıştırılabilir manifesttir: `run`, `configure` ve kabuk tamamlama oluşturucularının tümü
hedef listelerini, takma ad çözümlemesini (örneğin `kilocode`/`kilo-code`/`kilo_cli` → `kilo`)
ve `--model` bayrağı bağlantısını buradan türetir. Sapma koruması
`tests/unit/cli/cli-manifest-drift.test.ts`; manifestin, çalışma zamanı
kataloğunun, kullanıcı arayüzü kataloğunun ve her tüketici yüzeyinin senkronize kalmasını doğrular — yalnızca
bir yüzeye eklenen bir hedef, sessizce sapmak yerine test paketinin başarısız olmasına neden olur.

---

## 1. CLI Code Kataloğu (26 araç)

`/dashboard/cli-code` içinde görünen tüm araçlar. `baseUrlSupport: none` olanlar, özel bir temel URL yerine MITM veya manuel bir kılavuz üzerinden yapılandırılır:

| id           | ad                      | sağlayıcı             | baseUrlSupport | configType     | acpSpawnable |
| ------------ | ----------------------- | --------------------- | -------------- | -------------- | ------------ |
| claude       | Claude Code             | Anthropic             | full           | env            | true         |
| codex        | OpenAI Codex CLI        | OpenAI                | full           | custom         | true         |
| zcode        | ZCode (GLM Coding Plan) | Z.ai                  | none           | custom         | false        |
| cline        | Cline                   | OSS (eski Claude Dev) | full           | custom         | true         |
| kilo         | Kilo Code               | Kilo-Org              | full           | custom         | false        |
| roo          | Roo Code                | Roo (OSS)             | full           | guide          | false        |
| continue     | Continue                | continue.dev          | full           | guide          | false        |
| aider        | Aider                   | OSS (P. Gauthier)     | full           | guide          | true         |
| forge        | ForgeCode               | Antinomy HQ           | full           | custom         | true         |
| jcode        | jcode                   | 1jehuang (OSS)        | full           | custom         | false        |
| deepseek-tui | DeepSeek TUI            | Hunter Bown (OSS)     | full           | custom         | false        |
| codewhale    | CodeWhale               | Hmbown (OSS)          | full           | custom         | false        |
| opencode     | OpenCode                | Anomaly (eski SST)    | full           | guide          | true         |
| droid        | Factory Droid           | Factory AI            | partial        | guide          | false        |
| copilot      | GitHub Copilot CLI      | GitHub/MS             | full           | custom         | false        |
| cursor-cli   | Cursor CLI              | Anysphere             | partial        | guide          | true         |
| smelt        | Smelt                   | leonardcser (OSS)     | full           | custom         | false        |
| pi           | Pi (pi-coding-agent)    | M. Zechner (OSS)      | full           | custom         | false        |
| grok-build   | Grok Build              | xAI                   | full           | custom         | false        |
| crush        | Crush                   | OSS (Charm)           | full           | custom         | false        |
| qwen         | Qwen Code               | Alibaba               | full           | guide          | true         |
| cursor       | Cursor                  | Anysphere             | none           | guide          | false        |
| antigravity  | Antigravity             | Google                | none           | mitm           | false        |
| hermes       | Hermes                  | Nous Research         | none           | guide          | false        |
| kiro         | Kiro AI                 | Amazon                | none           | mitm           | false        |
| custom       | Özel CLI                | —                     | full           | custom-builder | false        |

`baseUrlSupport: "partial"` olan araçların kontrol paneli kartında "⚠ Kısmi Temel URL" rozeti gösterilir.
---

## 2. CLI Aracıları Kataloğu (10 araç)

`/dashboard/cli-agents` sayfasında görünen otonom aracılar:

| id           | ad               | sağlayıcı                | baseUrlSupport | acpSpawnable |
| ------------ | ---------------- | ------------------------ | -------------- | ------------ |
| hermes-agent | Hermes Agent     | Nous Research            | tam            | false        |
| openclaw     | OpenClaw         | OSS (P. Steinberger)     | tam            | true         |
| goose        | Goose            | Block / Linux Foundation | tam            | true         |
| interpreter  | Open Interpreter | OSS                      | tam            | true         |
| warp         | Warp AI          | Warp Inc.                | kısmi          | true         |
| agent-deck   | Agent Deck       | asheshgoplani (OSS)      | tam            | false        |
| omp          | Oh My Pi         | OSS                      | tam            | true         |
| letta        | Letta CLI        | Letta                    | tam            | false        |
| prime-agent  | Prime Agent      | Prime Intellect (OSS)    | tam            | false        |
| 5dive        | 5dive            | OSS (5dive-ai)           | tam            | false        |

---

## 3. ACP Aracıları (/dashboard/acp-agents)

Bu sayfa (önceki adı `/dashboard/agents`), Pusula'un stdio/ACP protokolü aracılığıyla arka uç yürütme motorları olarak **başlatabildiği** CLI'ları gösterir. Katalog, `src/lib/acp/registry.ts` içinde ayrı olarak tutulur ve `CLI_TOOLS` ile **aynı değildir**.

---

## 4. MITM İş Listesi (panoda gösterilmez)

Aşağıdaki CLI'lar özel temel URL'yi yerel olarak desteklemez ve CLI Code veya CLI Agents sayfalarında **listelenmez**. Bunlar, plan 11'de MITM müdahalesi için adaydır:

| CLI                 | Neden                                                              |
| ------------------- | ------------------------------------------------------------------ |
| windsurf            | BYOK, belirli Claude modelleri + kurumsal URL/token ile sınırlıdır |
| amp                 | Kapalı ekosistem (Sourcegraph)                                     |
| amazon-q / kiro-cli | AWS SSO kimlik doğrulaması, özel URL yoktur                        |
| cowork              | Anthropic Desktop, yapılandırılabilir uç nokta yoktur              |

Tam çapraz referans için `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` dosyasına bakın.

---

## 5. Toplu Algılama API'si

Tüm araç algılama işlemleri tek bir uç nokta aracılığıyla birleştirilir:

**`GET /api/cli-tools/all-statuses`**

- Kimlik doğrulama: `requireCliToolsAuth(request)` (diğer `/api/cli-tools/` rotalarıyla aynı)
- Döndürür: `Record<toolId, ToolBatchStatus>` (tür: `src/shared/types/cliBatchStatus.ts`)
- Strateji: Tüm araçlar üzerinde `Promise.all`, araç başına 5 saniye zaman aşımı
- Önbellek: Yapılandırma dosyasının `mtime` değerine göre indekslenen bellek içi LRU. `mtime` değiştiğinde önbellek geçersiz kılınır. Sunucu yeniden başlatıldığında sıfırlanır.

Araç başına yanıt yapısı:

```ts
interface ToolBatchStatus {
  detection: {
    installed: boolean;
    runnable: boolean;
    version?: string;
    command?: string;
    commandPath?: string;
    reason?: string;
  };
  config: {
    status: "configured" | "not_configured" | "not_installed" | "unknown" | "other";
    endpoint?: string | null;
    lastConfiguredAt?: string | null;
  };
  error?: string; // temizlenmiş, yığın izleri yok
}
```

---

## 6. Yeni Araçlar için Ayar İşleyicileri

`configType: "custom"` değerine sahip yeni araçların özel ayarlar API rotaları vardır:

| Rota                                        | Araç                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `POST /api/cli-tools/forge-settings`        | ForgeCode (.forge.toml)                                               |
| `POST /api/cli-tools/jcode-settings`        | jcode (--base-url bayrağı)                                            |
| `POST /api/cli-tools/deepseek-tui-settings` | DeepSeek TUI (OPENAI_BASE_URL, eski)                                  |
| `POST /api/cli-tools/codewhale-settings`    | CodeWhale (OPENAI_BASE_URL, birincil + eski `~/.deepseek` eşitlemesi) |
| `POST /api/cli-tools/smelt-settings`        | Smelt                                                                 |
| `POST /api/cli-tools/pi-settings`           | Pi kodlama ajanı                                                      |
| `POST /api/cli-tools/grok-build-settings`   | Grok Build (~/.grok/config.toml, `[model.pusula]`)                 |
| `POST /api/cli-tools/qwen-settings`         | Qwen Code (`~/.qwen/settings.json` + özel `.env` anahtarı)            |

Tüm rotalar, hata yanıtları için `sanitizeErrorMessage()` kullanır (Kesin Kural #12).

---

## 7. Kontrol Paneli Sayfalarının Mimarisi

### CLI Kodları (`/dashboard/cli-code`)

- `src/app/(dashboard)/dashboard/cli-code/page.tsx` — sunucu bileşeni
- `src/app/(dashboard)/dashboard/cli-code/CliCodePageClient.tsx` — istemci ızgarası
- `src/app/(dashboard)/dashboard/cli-code/[id]/page.tsx` — araç ayrıntı sayfası
- `src/app/(dashboard)/dashboard/cli-code/components/` — 12 özelleştirilmiş araç kartı + `ToolDetailClient.tsx`

### CLI Ajanları (`/dashboard/cli-agents`)

- `src/app/(dashboard)/dashboard/cli-agents/page.tsx` — sunucu bileşeni
- `src/app/(dashboard)/dashboard/cli-agents/CliAgentsPageClient.tsx` — istemci ızgarası
- `src/app/(dashboard)/dashboard/cli-agents/[id]/page.tsx` — `ToolDetailClient` bileşenini yeniden kullanır

### ACP Ajanları (`/dashboard/acp-agents`)

- `src/app/(dashboard)/dashboard/acp-agents/page.tsx` — sunucu bileşeni (`agents/` konumundan taşındı)

### Paylaşılan Kullanıcı Arayüzü Bileşenleri (`src/shared/components/cli/`)

| Dosya                   | Amaç                                                    |
| ----------------------- | ------------------------------------------------------- |
| `CliToolCard.tsx`       | Akıllı durum kartı (algılama + yapılandırma + uç nokta) |
| `CliConceptCard.tsx`    | Sayfa bazında kavram açıklama kartı                     |
| `CliComparisonCard.tsx` | CLI türleri arasında üç sütunlu karşılaştırma           |
| `BaseUrlSelect.tsx`     | Uç nokta açılır menüsü (Yerel/Bulut/Özel)               |
| `ApiKeySelect.tsx`      | API anahtarı seçici                                     |
| `ManualConfigModal.tsx` | Kopyalanabilir yapılandırma parçacığı modalı            |

### Paylaşılan Hook (`src/shared/hooks/cli/`)

| Dosya                     | Amaç                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `useToolBatchStatuses.ts` | `/api/cli-tools/all-statuses` verilerini getirir, yükleme/yenileme durumunu yönetir |

---

## 8. i18n

Plan 14 F9'da eklenen yeni ad alanları:

| Ad Alanı    | Amaç                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `cliCommon` | Paylaşılan dizeler (kart etiketleri, kavram/karşılaştırma metinleri, ayrıntı sayfası etiketleri) |
| `cliCode`   | CLI Code sayfası dizeleri                                                                        |
| `cliAgents` | CLI Agents sayfası dizeleri                                                                      |
| `acpAgents` | ACP Agents sayfası dizeleri                                                                      |

Eksiksiz PT-BR ve EN çevirileri sağlanmıştır. Diğer 39 yerel ayar, `src/i18n/request.ts` içindeki ad alanı düzeyindeki birleştirme aracılığıyla otomatik olarak EN diline geri döner.

---

## 9. Hızlı Başlangıç

### Adım 1 — Pusula API Anahtarı Alın

1. `/dashboard/api-manager` sayfasını açın → **API Anahtarı Oluştur**
2. Anahtara bir ad verin (ör. `cli-tools`) ve tüm izinleri seçin
3. Anahtarı kopyalayın — aşağıdaki her CLI için buna ihtiyacınız olacak

> Anahtarınız şuna benzer: `sk-xxxxxxxxxxxxxxxx-xxxxxxxxx`

---

### Adım 2 — CLI Araçlarını Yükleyin

npm tabanlı tüm araçlar Node.js 22.22.2+ veya 24.x gerektirir:

```bash
# Claude Code (Anthropic)
npm install -g @anthropic-ai/claude-code

# OpenAI Codex
npm install -g @openai/codex

# OpenCode
npm install -g opencode-ai

# Cline
npm install -g cline

# KiloCode
npm install -g kilocode

# Qwen Code
npm install -g @qwen-code/qwen-code

# Google Gemini CLI (`pusula run gemini` aracılığıyla başlatılabilir → /v1beta yüzeyi)
npm install -g @google/gemini-cli

# Aider
pip install aider-chat

# Smelt
cargo install smelt  # Rust tabanlı

# Pi kodlama aracısı
# kurulum için https://github.com/zechnerj/pi-coding-agent adresine bakın

# jcode
# kurulum için https://github.com/1jehuang/jcode adresine bakın
```

---

### Adım 3 — Kontrol Paneli Üzerinden Yapılandırın

1. `http://localhost:20128/dashboard/cli-code` adresine gidin
2. Izgarada aracınızı bulun
3. Araç ayrıntıları sayfasını açmak için karta tıklayın
4. API anahtarınızı ve temel URL'yi seçin
5. **Yapılandırmayı Uygula** seçeneğine tıklayın veya manuel yapılandırma kod parçacığını kopyalayın

---

### Adım 4 — Genel Ortam Değişkenlerini Ayarlayın

```bash
# Pusula Evrensel Uç Noktası
export OPENAI_BASE_URL="http://localhost:20128/v1"
export OPENAI_API_KEY="sk-your-pusula-key"
export ANTHROPIC_BASE_URL="http://localhost:20128"
export ANTHROPIC_AUTH_TOKEN="sk-your-pusula-key"
# Gemini CLI, GOOGLE_GEMINI_BASE_URL değerini KÖK düzeyinde okur (SDK'sı /v1beta/... yolunu kendisi ekler)
export GOOGLE_GEMINI_BASE_URL="http://localhost:20128"
export GEMINI_API_KEY="sk-your-pusula-key"
```

> **Uzak sunucu** için `localhost:20128` değerini sunucu IP'si veya etki alanıyla değiştirin,
> ör. `http://<your-server-ip>:20128`.

---

### Adım 4 — Her Aracı Yapılandırın

#### Claude Code

```bash
# ~/.claude/settings.json dosyasını oluşturun:
mkdir -p ~/.claude && cat > ~/.claude/settings.json << EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128",
    "ANTHROPIC_AUTH_TOKEN": "sk-your-pusula-key"
  }
}
EOF
```

Claude Code için birleştirilmiş Anthropic ağ geçidi kökünü kullanın. Buraya `/v1` eklemeyin.

**Test:** `claude "say hello"`

---

#### OpenAI Codex

Modern Codex (v0.137+) yalnızca `~/.codex/config.toml` dosyasını okur — eski
`config.yaml`, eski npm CLI'ına aittir ve sessizce yok sayılır. API
anahtarı dosyanın içinde değil, her zaman `PUSULA_API_KEY` ortam değişkeninde (`env_key`)
kalır:

```bash
mkdir -p ~/.codex && cat > ~/.codex/config.toml << EOF
model_provider = "pusula"

[model_providers.pusula]
name                 = "Pusula"
base_url             = "http://localhost:20128/v1"
env_key              = "PUSULA_API_KEY"
requires_openai_auth = false
EOF
export PUSULA_API_KEY="sk-your-pusula-key"
```

Tam başvuru (profiller, `wire_api`, bağlam pencereleri): [CODEX-CLI-CONFIGURATION.md](../guides/CODEX-CLI-CONFIGURATION.md).

**Test:** `codex "what is 2+2?"`

---

#### OpenCode

```bash
mkdir -p ~/.config/opencode && cat > ~/.config/opencode/opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "pusula": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Pusula",
      "options": {
        "baseURL": "http://localhost:20128/v1",
        "apiKey": "sk-your-pusula-key"
      },
      "models": {
        "claude-sonnet-4-5": { "name": "claude-sonnet-4-5" },
        "claude-sonnet-4-5-thinking": { "name": "claude-sonnet-4-5-thinking" },
        "gemini-3-flash": { "name": "gemini-3-flash" }
      }
    }
  }
}
EOF
```

**Test:** `opencode`

> Düşünme varyantlarını göndermek için
> `opencode run "your prompt" --model pusula/claude-sonnet-4-5-thinking --variant high`
> komutunu kullanın.

---

#### Cline (CLI veya VS Code)

**CLI modu:**

```bash
mkdir -p ~/.cline/data && cat > ~/.cline/data/globalState.json << EOF
{
  "apiProvider": "openai",
  "openAiBaseUrl": "http://localhost:20128/v1",
  "openAiApiKey": "sk-your-pusula-key"
}
EOF
```

**VS Code modu:**
Cline uzantısı ayarları → API Sağlayıcısı: `OpenAI Compatible` → Temel URL: `http://localhost:20128/v1`

Alternatif olarak Pusula kontrol panelini kullanın → **CLI Araçları → Cline → Yapılandırmayı Uygula**.

---

#### KiloCode (CLI veya VS Code)

**CLI modu:**

```bash
kilocode --api-base http://localhost:20128/v1 --api-key sk-your-pusula-key
```

**VS Code ayarları:**

```json
{
  "kilo-code.openAiBaseUrl": "http://localhost:20128/v1",
  "kilo-code.apiKey": "sk-your-pusula-key"
}
```

Alternatif olarak Pusula kontrol panelini kullanın → **CLI Araçları → KiloCode → Yapılandırmayı Uygula**.

---

#### Continue (VS Code Uzantısı)

`~/.continue/config.yaml` dosyasını düzenleyin:

```yaml
models:
  - name: Pusula
    provider: openai
    model: auto
    apiBase: http://localhost:20128/v1
    apiKey: sk-your-pusula-key
    default: true
```

Düzenleme işleminden sonra VS Code'u yeniden başlatın.

---

#### VS Code Insiders (`chatLanguageModels.json`)

VS Code Insiders özel uç nokta modelleri için yapılandırıldığında ve Pusula'un özel bir üst bilgi alanı olmadan çalışmasını istediğinizde bunu kullanın.

**Önerilen konum:**

- Linux: `~/.config/Code - Insiders/User/chatLanguageModels.json`
- Windows: `%APPDATA%/Code - Insiders/User/chatLanguageModels.json`

**Tokenleştirilmiş Pusula takma adını kullanan örnek:**

```json
[
  {
    "vendor": "customendpoint",
    "id": "auto",
    "name": "Pusula Auto",
    "family": "gpt-4",
    "version": "1.0.0",
    "url": "http://localhost:20128/api/v1/vscode/sk-your-pusula-key/chat/completions",
    "modelsUrl": "http://localhost:20128/api/v1/vscode/sk-your-pusula-key/models",
    "requestFormat": "openai-chat-completions",
    "contextWindow": 256000,
    "maxOutputTokens": 32768,
    "auth": {
      "type": "none"
    }
  }
]
```

**Notlar:**

- `sk-your-pusula-key` değerini Pusula'ta oluşturulan bir API anahtarıyla değiştirin.
- `url` alanı `/api/v1/vscode/{token}/chat/completions` yolunu göstermelidir.
- `modelsUrl` alanı `/api/v1/vscode/{token}/models` yolunu göstermelidir.
- İstemci özel başlıkları desteklediğinde normal `/v1` + Bearer başlığı akışını tercih edin.
- URL'ye gömülü token'lar uyumluluk için kullanılan bir geri dönüş seçeneğidir ve düzenleyici günlüklerinde veya proxy geçmişinde görünebilir.

---

#### Kiro CLI (Amazon)

```bash
# AWS/Kiro hesabınızda oturum açın:
kiro-cli login

# CLI kendi kimlik doğrulamasını kullanır — Kiro CLI'ın kendisi için arka uç olarak Pusula'a gerek yoktur.
# Diğer araçlar için kiro-cli'ı Pusula ile birlikte kullanın.
kiro-cli status
```

**Kiro IDE** masaüstü uygulaması için Pusula tarafından
`/dashboard/cli-tools → Kiro` altında sunulan MITM uç noktasını kullanın.

---

## 10. Dahili Pusula CLI

`pusula` ikili dosyası; sunucu yaşam döngüsü, kurulum, tanılama ve sağlayıcı yönetimi için komutlar sağlar. Giriş noktası: `bin/pusula.mjs`.

```bash
pusula                              # Sunucuyu başlatır (varsayılan port 20128)
pusula setup                        # Etkileşimli kurulum sihirbazı
pusula doctor                       # Yapılandırmayı, DB'yi, portları ve çalışma zamanını kontrol eder
pusula providers list               # Yapılandırılmış sağlayıcı bağlantıları
pusula providers test-all           # Her etkin bağlantıyı test eder
pusula reset-password               # Yönetici parolasını sıfırlar
pusula logs                         # İstek günlüklerini akış halinde gösterir
pusula health                       # Ayrıntılı sistem durumu (kesiciler, önbellek, bellek)
pusula --version                    # Sürümü yazdırır
pusula --help                       # Tüm komutları gösterir
```

### Kurulum ve Başlatma

```bash
pusula setup                        # Etkileşimli kurulum sihirbazı
pusula setup --non-interactive      # CI/otomasyon modu (ortam değişkenlerini + bayrakları okur)
pusula setup --password '<value>'   # Yönetici parolasını doğrudan ayarlar
pusula setup --add-provider \
  --provider openai \
  --api-key '<value>' \
  --test-provider                      # Tek seferde bir sağlayıcı ekler ve test eder
```

Etkileşimsiz kurulum için tanınan ortam değişkenleri:

| Değişken            | Amaç                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------- |
| `PUSULA_API_KEY` | Sağlayıcı API anahtarı (Commander `.env()` aracılığıyla `--api-key` seçeneğine bağlanır) |
| `DATA_DIR`          | Pusula veri dizinini geçersiz kılar                                                   |

Diğer tüm etkileşimsiz girdiler ortam değişkenleri olarak değil, bayraklar olarak geçirilir:
`--password`, `--provider`, `--provider-name`, `--provider-base-url`, `--default-model`
(yukarıdaki `pusula setup` seçeneklerine bakın).

### Tanılama

```bash
pusula doctor                       # Yapılandırmayı, DB'yi, portları, çalışma zamanını, belleği ve çalışırlığı kontrol eder
pusula doctor --json                # Makine tarafından okunabilir JSON
pusula doctor --no-liveness         # HTTP sistem durumu yoklamasını atlar
pusula doctor --host 0.0.0.0        # Çalışırlık ana makinesini geçersiz kılar
pusula doctor --liveness-url <url>  # Tam sistem durumu uç noktası URL'sini geçersiz kılar
```

Doctor şu kontrolleri çalıştırır: `Config`, `Database`, `Storage/encryption`,
`Port availability`, `Node runtime`, `Native binary` (better-sqlite3),
`Memory` ve `Server liveness`. Herhangi bir kontrol `fail` olursa sıfırdan farklı bir kodla çıkar.

### Sağlayıcı Yönetimi

```bash
pusula providers available                       # Pusula sağlayıcı kataloğu
pusula providers available --search openai       # Kataloğu kimliğe/ada/takma ada/kategoriye göre filtreler
pusula providers available --category api-key    # Kategoriye göre filtreler (api-key, oauth, free, ...)
pusula providers available --json                # Makine tarafından okunabilir JSON

pusula providers list                            # Yapılandırılmış sağlayıcı bağlantıları
pusula providers list --json

pusula providers test <id|name>                  # Yapılandırılmış bir bağlantıyı test eder
pusula providers test-all                        # Her etkin bağlantıyı test eder
pusula providers validate                        # Yalnızca yerel yapısal doğrulama
pusula providers add <provider> --credential-env PROVIDER_KEY
pusula providers import ./providers.json --dry-run --json
pusula providers auth <provider>                 # Mevcut OAuth akışı
pusula providers edit <id|name> --default-model <model>
pusula providers remove <id|name> --yes
```

`providers add/import/auth/edit/remove` öncelikli olarak API'yi kullanır ve bu nedenle
etkin yerel veya uzak bağlam üzerinde çalışır. Kimlik bilgisi girdisi için
`--credential-stdin` veya `--credential-env` kullanılmalıdır; `--dry-run --json` yalnızca
gizlenmiş varlık/yapı bilgilerini bildirir. `providers available`, Pusula kataloğunu okur;
`providers list/test/test-all/validate` yerel SQLite davranışlarını korur ve
sunucunun çalışmasını gerektirmez.

### Kurtarma ve Sıfırlama

```bash
pusula reset-password                # Yönetici parolasını sıfırlar (ayrıca: pusula-reset-password)
pusula reset-encrypted-columns       # Şifrelenmiş kimlik bilgilerini sıfırlamak için uyarı + deneme çalıştırması gösterir
pusula reset-encrypted-columns --force  # SQLite'taki şifrelenmiş kimlik bilgilerini gerçekten null yapar
```

### Kimlik Bilgilerini Dışa Aktarma (⚠ dikkatli kullanın)

```bash
pusula auth export                                 # Uyarı + onay geçidi gösterir — DB erişimi yoktur
pusula auth export --force                          # TÜM bağlantıların ŞİFRESİ ÇÖZÜLMÜŞ kimlik bilgilerini JSON olarak stdout'a aktarır
pusula auth export --force --id <id>                 # Yalnızca eşleşen bağlantıyı dışa aktarır
pusula auth export --force --format env               # PUSULA_<PROVIDER>_<FIELD>=<value> satırları üretir
pusula auth export --force --out creds.json           # Bir dosyaya yazar (0600 izinleriyle oluşturulur)
```

`auth export` **yalnızca yerel** olarak çalışır (doğrudan SQLite okuması, HTTP rotası yoktur) ve kasıtlı olarak
**düz metin** `apiKey`/`accessToken`/`refreshToken`/`idToken` değerlerini yazdırır/yazar — bu bir
hata değil, özelliktir. `--force` olmadan veritabanından hiçbir şey okunmaz ve hiçbir şeyin şifresi çözülmez. Herhangi bir düz metin yayımlanmadan önce stderr'e
her zaman bir uyarı başlığı yazdırılır. `STORAGE_ENCRYPTION_KEY` değişkeninin
ayarlanmış olması gerekir. Şifresi çözülemeyen bir alan (eski anahtar, bozuk şifreli metin), dışa aktarma işleminin tamamını iptal etmek veya temel hatayı sızdırmak yerine
`<field>DecryptFailed: true` olarak bildirilir.

### Diğer alt komutlar

Aksi belirtilmedikçe bunlar çalışan bir Pusula sunucusu gerektirir:

```bash
pusula status                       # Kapsamlı çalışma zamanı durumu
pusula logs                         # İstek günlüklerini akış halinde göster (--json, --search, --follow)
pusula config list                  # Yapılandırılmış CLI araçlarını göster

pusula provider list                # Kullanılabilir sağlayıcıları listele (providers list diğer adı)
pusula provider add                 # Pusula'u bir araca sağlayıcı olarak kaydet
pusula keys add | list | remove     # API anahtarlarını yönet
pusula models [provider]            # Modelleri listele (--json, --search)
pusula combo list | switch | create | delete

pusula backup                       # Yapılandırmanın ve veritabanının anlık görüntüsünü al
pusula restore                      # Önceki bir anlık görüntüden geri yükle

pusula health                       # Ayrıntılı sistem durumu (devre kesiciler, önbellek, bellek)
pusula quota                        # Sağlayıcı kota kullanımı
pusula cache                        # Önbellek durumu
pusula cache clear                  # Anlamsal ve imza önbelleklerini temizle

pusula mcp status | restart         # MCP sunucusu durumu / yeniden başlatma
pusula a2a status | card            # A2A sunucusu durumu / aracı kartı

pusula tunnel list | create | stop  # Tünelleri yönet (cloudflare/tailscale/ngrok)
pusula env show | get <k> | set <k> <v>  # Ortam değişkenlerini incele / ayarla (geçici)

pusula test                         # Sağlayıcı bağlantısı hızlı testi
pusula update                       # Güncellemeleri denetle
pusula completion                   # Kabuk tamamlama betiği oluştur
```

### Yaygın bayraklar

| Bayrak              | Açıklama                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `--no-open`         | Başlangıçta tarayıcıyı otomatik olarak açma                       |
| `--port <n>`        | API bağlantı noktasını geçersiz kıl (varsayılan 20128)            |
| `--mcp`             | stdio üzerinden MCP sunucusu olarak çalıştır (IDE'ler için)       |
| `--non-interactive` | CI modu (istem yoktur; ortam değişkenlerinden/bayraklardan okur)  |
| `--json`            | Makine tarafından okunabilir JSON çıktısı (doctor, providers vb.) |
| `--help`, `-h`      | Komuta özgü yardımı göster                                        |
| `--version`, `-v`   | Yüklü sürümü yazdır                                               |

---

## Kullanılabilir API Uç Noktaları

| Uç Nokta                   | Açıklama                           | Kullanım Alanı                  |
| -------------------------- | ---------------------------------- | ------------------------------- |
| `/v1/chat/completions`     | Standart sohbet (tüm sağlayıcılar) | Tüm modern araçlar              |
| `/v1/responses`            | Responses API (OpenAI biçimi)      | Codex, otonom iş akışları       |
| `/v1/completions`          | Eski metin tamamlamaları           | `prompt:` kullanan eski araçlar |
| `/v1/embeddings`           | Metin gömmeleri                    | RAG, arama                      |
| `/v1/images/generations`   | Görsel oluşturma                   | GPT-Image, Flux vb.             |
| `/v1/audio/speech`         | Metinden sese                      | ElevenLabs, OpenAI TTS          |
| `/v1/audio/transcriptions` | Konuşmadan metne                   | Deepgram, AssemblyAI            |

Token içeren bir Pusula URL'siyle kullanıma hazır örnekler:

```txt
Token örneği: sk-a3ab3c080beaee3a-69f4a4-070d71af

Standart OpenAI tabanı: http://localhost:20128/v1
VS Code modelleri: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/models
VS Code sohbeti: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/chat/completions
VS Code yanıtları: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/responses
Ollama etiketleri: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/tags
Ollama sohbeti: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/chat
```

---

## Sorun Giderme

| Hata                                             | Neden                         | Çözüm                                                         |
| ------------------------------------------------ | ----------------------------- | ------------------------------------------------------------- |
| `Connection refused`                             | Pusula çalışmıyor          | `pusula serve`                                             |
| `401 Unauthorized`                               | Yanlış API anahtarı           | `/dashboard/api-manager` bölümünden kontrol edin              |
| `No combo configured`                            | Etkin yönlendirme kombosu yok | `/dashboard/combos` bölümünde ayarlayın                       |
| CLI "not installed" gösteriyor                   | İkili dosya PATH'te değil     | `which <command>` komutuyla kontrol edin                      |
| Kurulumdan sonra panel "not detected" gösteriyor | Önbellek güncel değil         | Panelde "⟳ Algılamayı yenile" seçeneğine tıklayın             |
| Eski bağlantı `/dashboard/cli-tools`             | v3.8.6 öncesi yer imi         | `/dashboard/cli-code` adresine otomatik yönlendirilir (308)   |
| Eski bağlantı `/dashboard/agents`                | v3.8.6 öncesi yer imi         | `/dashboard/acp-agents` adresine otomatik yönlendirilir (308) |
