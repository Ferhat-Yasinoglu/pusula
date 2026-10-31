# CLI Tools — Pusula (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/CLI-TOOLS.md) · 🇩🇪 [de](../../../de/docs/reference/CLI-TOOLS.md) · 🇮🇷 [fa](../../../fa/docs/reference/CLI-TOOLS.md)

---

Son güncelleme: 2026-08-23

Pusula, üç özel pano sayfasına dağıtılmış üç CLI aracı kategorisiyle entegre olur:

| Sayfa             | Rota                    | Kavram                                                                          | Sayı                  |
| ----------------- | ----------------------- | ------------------------------------------------------------------------------- | --------------------- |
| **CLI Kodları**   | `/dashboard/cli-code`   | Pusula'a yönlendirdiğiniz kodlama araçları (İstemci → CLI → Pusula → Sağlayıcı) | 26                    |
| **CLI Aracıları** | `/dashboard/cli-agents` | Pusula'a yönlendirdiğiniz otonom aracılar (aynı akış, daha geniş kapsam)        | 10                    |
| **ACP Aracıları** | `/dashboard/acp-agents` | Pusula'un stdio/ACP aracılığıyla arka uç olarak başlattığı CLI'lar (ters akış)  | kayıt defterine bakın |

Eski rotalar 308 aracılığıyla yönlendirilir: `/dashboard/cli-tools` → `/dashboard/cli-code`, `/dashboard/agents` → `/dashboard/acp-agents`.

---

## Nasıl Çalışır?

```
CLI Kodları / CLI Aracıları (tüketim akışı):
Claude / Codex / OpenCode / Cline / KiloCode / Continue / Hermes Agent / Goose / ...
           │
           ▼  (tümü Pusula'a yönlendirilir)
    http://YOUR_SERVER:20128/v1
           │
           ▼  (Pusula, isteği doğru sağlayıcıya yönlendirir)
    Anthropic / OpenAI / Gemini / DeepSeek / Groq / Mistral / ...

ACP Aracıları (ters başlatma akışı):
    İstemci isteği → Pusula → CLI'ı stdio/ACP aracılığıyla başlatır → yanıt
```

**Avantajlar:**

- Tüm araçları yönetmek için tek bir API anahtarı
- Panoda tüm CLI'lar genelinde maliyet takibi
- Her aracı yeniden yapılandırmadan model değiştirme
- Yerel olarak ve uzak sunucularda çalışır (VPS, Docker, Akamai, Cloudflare Tunnel)

---

## `setup-*` ile otomatik yapılandırma

Her aracın yapılandırmasını elle yazmanız gerekmez. Pusula, desteklenen her CLI için çalışan bir Pusula'tan (yerel veya uzak) **canlı** model kataloğunu okuyan ve aracın kendi yapılandırmasını makinenize yazan bir `setup-*` komutu sağlar:

```bash
pusula setup-codex        pusula setup-claude       pusula setup-opencode
pusula setup-cline        pusula setup-kilo         pusula setup-continue
pusula setup-cursor       pusula setup-roo          pusula setup-crush
pusula setup-goose        pusula setup-qwen         pusula setup-aider
pusula setup-5dive        pusula setup-zed
```

Her biri `--remote <url> --api-key <key>` (yerel bir aracı uzak bir Pusula'a göre yapılandırır), `--dry-run` (yazmadan önizleme yapar) ve `--port` seçeneklerini kabul eder. Otomatik model keşfi olmayan araçlar (Cline, Kilo, Roo, Goose, Aider, Qwen, 5dive), `--model <id>` seçeneğini (ve etkileşimsiz çalıştırmalar için `--yes` seçeneğini) alır. `setup-5dive`, `$HOME` altına yazmayan tek reçetedir: filo ana makinesine root sahipliğinde bir kimlik doğrulama profili yazarak bir 5dive ajan filosunu yapılandırır; bu nedenle `sudo` üzerinden kendisini yeniden çalıştırır ve kendine ait bir uzak modu yoktur. Bir CLI'ı doğru ortam değişkenleri enjekte edilmiş şekilde ve hiçbir yapılandırma yazmadan başlatmak için genel `pusula run <target>` başlatıcısını kullanın (claude, codex, aider, goose, opencode, qwen, gemini — hedefler ve takma adlar `bin/cli/cli-manifest.mjs` dosyasından gelir); araç başına eski başlatıcılar olan `pusula launch` (Claude Code) ve `pusula launch-codex` (Codex) kullanılabilir olmaya devam eder. Gemini CLI yalnızca başlatma amaçlıdır: bir `pusula run` hedefidir ancak `setup-*`/`configure` reçetesi yoktur.

> **Tam referans:** her komutun ne yazdığını, tüm seçenekleri, yerel ve uzak kullanım farklarını ve hangi araçların `/v1` son ekini gerektirdiğini gösteren ana tablo
> **[CLI Entegrasyonları](../guides/CLI-INTEGRATIONS.md)** belgesinde yer alır.

### Bunları bir container içinde çalıştırma

Pusula container'ı içinde yürütülen bir `setup-*` komutu, container'ın kendi home dizinine yazar; hiçbir ana makine CLI'ı burayı okumaz ve bu dizin container ile birlikte kaybolur. Pusula bunu algılar ve yazmak yerine yönergelerle birlikte `2` çıkış koduyla sonlanır. Desteklenen iki çözüm vardır: CLI'ı ana makineye kurup container'a `pusula connect` ile bağlanmak veya yapılandırma dizinlerini bind-mount ile bağlayıp `CLI_CONFIG_HOME` değişkenini ayarlamak (compose `host` profili). Her `setup-*` komutu ile birlikte `pusula configure` ve `pusula config set`, gerçekten container'ın kendi CLI'larını yapılandırmak istediğiniz durumlar için `--allow-container-write` seçeneğini kabul eder; `PUSULA_ALLOW_CONTAINER_CONFIG_WRITE=true` sunucu için aynı işlevi görür. Bkz.
[Docker Kılavuzu → Ana makine CLI araçlarını yapılandırma](../guides/DOCKER_GUIDE.md#configuring-host-cli-tools-when-pusula-runs-in-docker).

Panodaki **uygulama uç noktası** (`POST /api/cli-tools/apply`) aynı korumayı uygular: bir container içinde, hedefi ana makineden bind-mount ile bağlanmamış bir yazma isteğine güvenli hata metni ve `containerEphemeralTarget: true` ile birlikte **`422`** yanıtı verir; ayrıca ana makine reçetesi bulunan araçlar (claude, codex, opencode, cline, kilo, continue) için ana makinede çalıştırılacak bir `hostSetupCommand` (ör. `pusula setup-opencode`) döndürür. Hiçbir şey yazılmaz. `dryRun: true`, container modunda çalışmaya devam eder ve diske dokunmadan hassas bilgileri gizlenmiş bir önizleme ile hedef yolu döndürür. Önizleme içeriği, kopyalanacak veya içe aktarılacak kimlik bilgileri içeren bir yapılandırma değildir. Orijinal araç/temel URL/API anahtarı/model girdileriyle ana makinede uygulayın veya belirtilen ana makine tarafı kurulum komutunu kullanın. Önizleme başlığı ve istek sözleşmesi için [CLI yapılandırma güvenliği](../security/CLI-CONFIGURATION.md) belgesine bakın. Bu davranış kasıtlıdır ve
`tests/unit/api/cli-tools/apply-container-guard.test.ts` tarafından regresyonlara karşı korunur — korumayı kaldırarak bir 422 hatasını asla "düzeltmeyin".

---

## Doğruluğun Ana Kaynağı

Birleştirilmiş katalog, `src/shared/constants/cliTools.ts` dosyasında `CLI_TOOLS: Record<string, CliCatalogEntry>` olarak bulunur.

Her giriş şu alanlara sahiptir (`src/shared/schemas/cliCatalog.ts` içinde tanımlanmıştır):

| Alan                                            | Tür                                                          | Açıklama                                                |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------- |
| `category`                                      | `"code" \| "agent"`                                          | Aracın hangi sayfada göründüğü                          |
| `vendor`                                        | `string`                                                     | Aracın kaynağı ("Anthropic", "OSS (P. Gauthier)")       |
| `acpSpawnable`                                  | `boolean`                                                    | ACP Agent olarak da kullanılabilir (rozet gösterilir)   |
| `baseUrlSupport`                                | `"full" \| "partial" \| "none"`                              | Özel uç nokta destek düzeyi. `"none"` = MITM iş listesi |
| `configType`                                    | `"env" \| "custom" \| "guide" \| "custom-builder" \| "mitm"` | Yapılandırma mekanizması                                |
| `id`, `name`, `color`, `description`, `docsUrl` | standart                                                     | Temel görüntüleme alanları                              |

`baseUrlSupport: "none"` olan girişler kontrol paneli sayfalarında **gösterilmez** — bunlar plan 11 için MITM iş listesine kaydedilir (bkz. `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md`).

### Yetenek katmanları (kataloglanmış × algılanabilir × yapılandırılabilir × başlatılabilir)

Kataloglanmış her araç algılanabilir, yapılandırılabilir veya başlatılabilir değildir. Her katmanın
tek bir bildirim kaynağı vardır ve bir sapma testi bunların uyumlu kalmasını sağlar:

| Katman                 | Anlamı                                                                                   | Bildirildiği yer                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **Kataloglanmış**      | Kontrol paneli kataloğunda görünür (ad, sağlayıcı, belgeler, yapılandırma türü)          | `src/shared/constants/cliTools.ts` (`CLI_TOOLS`)                          |
| **Algılanabilir**      | İkili/yapılandırma algılama, durum denetimleri, yapılandırma yolları                     | `src/shared/services/cliRuntime.ts` (`CLI_TOOLS` çalışma zamanı kataloğu) |
| **Yapılandırılabilir** | `pusula configure <cli>` tarafından desteklenir (kurulum tarifi mevcuttur)               | `bin/cli/cli-manifest.mjs` (`configure: true`)                            |
| **Başlatılabilir**     | `pusula run <target>` tarafından desteklenir (ortam/değişken enjeksiyonu tanımlanmıştır) | `bin/cli/cli-manifest.mjs` (`run: true`)                                  |

`bin/cli/cli-manifest.mjs`, CLI komut
yüzeyleri için kanonik çalıştırılabilir manifesttir: `run`, `configure` ve kabuk tamamlama oluşturucularının tümü
hedef listelerini, diğer ad çözümlemelerini (örneğin `kilocode`/`kilo-code`/`kilo_cli` → `kilo`)
ve `--model` bayrağı bağlantılarını buradan türetir. Sapma koruması
`tests/unit/cli/cli-manifest-drift.test.ts`, manifestin, çalışma zamanı
kataloğunun, kullanıcı arayüzü kataloğunun ve tüm tüketici yüzeylerinin senkronize kaldığını doğrular — bir
yüzeye eklenip diğerlerine eklenmeyen bir hedef, sessizce sapmaya yol açmak yerine test paketinin başarısız olmasına neden olur.

---

## 1. CLI Code Kataloğu (27 araç)

`/dashboard/cli-code` içinde görünen tüm araçlar. `baseUrlSupport: none` olanlar, özel bir temel URL yerine MITM veya manuel bir rehber aracılığıyla yapılandırılır:

| id           | name                    | vendor                | baseUrlSupport | configType     | acpSpawnable |
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
| zed          | Zed                     | Zed Industries        | full           | guide          | false        |
| cursor       | Cursor                  | Anysphere             | none           | guide          | false        |
| antigravity  | Antigravity             | Google                | none           | mitm           | false        |
| hermes       | Hermes                  | Nous Research         | none           | guide          | false        |
| kiro         | Kiro AI                 | Amazon                | none           | mitm           | false        |
| custom       | Özel CLI                | —                     | full           | custom-builder | false        |

`baseUrlSupport: "partial"` olan araçların kontrol paneli kartında "⚠ Kısmi Temel URL" rozeti gösterilir.
---

## 2. CLI Aracıları Kataloğu (10 araç)

`/dashboard/cli-agents` sayfasında görünen otonom aracılar:

| id           | ad               | sağlayıcı                | baseUrl desteği | ACP ile başlatılabilir |
| ------------ | ---------------- | ------------------------ | --------------- | ---------------------- |
| hermes-agent | Hermes Agent     | Nous Research            | full            | false                  |
| openclaw     | OpenClaw         | OSS (P. Steinberger)     | full            | true                   |
| goose        | Goose            | Block / Linux Foundation | full            | true                   |
| interpreter  | Open Interpreter | OSS                      | full            | true                   |
| warp         | Warp AI          | Warp Inc.                | partial         | true                   |
| agent-deck   | Agent Deck       | asheshgoplani (OSS)      | full            | false                  |
| omp          | Oh My Pi         | OSS                      | full            | true                   |
| letta        | Letta CLI        | Letta                    | full            | false                  |
| prime-agent  | Prime Agent      | Prime Intellect (OSS)    | full            | false                  |
| 5dive        | 5dive            | OSS (5dive-ai)           | full            | false                  |

---

## 3. ACP Aracıları (/dashboard/acp-agents)

Bu sayfa (önceki adı `/dashboard/agents`), Pusula'un stdio/ACP protokolü üzerinden arka uç yürütme motorları olarak **başlatabildiği** CLI'ları gösterir. Katalog, `src/lib/acp/registry.ts` içinde ayrı olarak yönetilir ve `CLI_TOOLS` ile **aynı değildir**.

---

## 4. MITM İş Listesi (kontrol panelinde gösterilmez)

Aşağıdaki CLI'lar özel temel URL'yi yerel olarak desteklemez ve CLI Code ya da CLI Agents sayfalarında **listelenmez**. Bunlar, plan 11'de MITM müdahalesi için adaydır:

| CLI                 | Neden                                                           |
| ------------------- | --------------------------------------------------------------- |
| windsurf            | BYOK, belirli Claude modelleri + kurumsal URL/token ile sınırlı |
| amp                 | Kapalı ekosistem (Sourcegraph)                                  |
| amazon-q / kiro-cli | AWS SSO kimlik doğrulaması, özel URL yok                        |
| cowork              | Anthropic Desktop, yapılandırılabilir uç nokta yok              |

Tam çapraz referans için `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` dosyasına bakın.

---

## 5. Toplu Algılama API'si

Tüm araç algılama işlemleri tek bir uç nokta üzerinden toplanır:

**`GET /api/cli-tools/all-statuses`**

- Kimlik doğrulama: `requireCliToolsAuth(request)` (diğer `/api/cli-tools/` rotalarıyla aynı)
- Döndürür: `Record<toolId, ToolBatchStatus>` (tür: `src/shared/types/cliBatchStatus.ts`)
- Strateji: tüm araçlar üzerinde `Promise.all`, araç başına 5 saniyelik zaman aşımı
- Önbellek: yapılandırma dosyasının `mtime` değerine göre indekslenen bellek içi LRU. `mtime` değiştiğinde önbellek geçersiz kılınır. Sunucu yeniden başlatıldığında sıfırlanır.

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
  error?: string; // temizlenmiş, yığın izleri içermez
}
```

---

## 6. Yeni Araçlar için Ayar İşleyicileri

`configType: "custom"` kullanan yeni araçların kendilerine özel ayarlar API rotaları vardır:

| Rota                                        | Araç                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------- |
| `POST /api/cli-tools/forge-settings`        | ForgeCode (.forge.toml)                                               |
| `POST /api/cli-tools/jcode-settings`        | jcode (--base-url bayrağı)                                            |
| `POST /api/cli-tools/deepseek-tui-settings` | DeepSeek TUI (OPENAI_BASE_URL, eski)                                  |
| `POST /api/cli-tools/codewhale-settings`    | CodeWhale (OPENAI_BASE_URL, birincil + eski `~/.deepseek` eşitlemesi) |
| `POST /api/cli-tools/smelt-settings`        | Smelt                                                                 |
| `POST /api/cli-tools/pi-settings`           | Pi kodlama aracısı                                                    |
| `POST /api/cli-tools/grok-build-settings`   | Grok Build (~/.grok/config.toml, `[model.pusula]`)                    |
| `POST /api/cli-tools/qwen-settings`         | Qwen Code (`~/.qwen/settings.json` + özel `.env` anahtarı)            |

Tüm rotalar, hata yanıtları için `sanitizeErrorMessage()` kullanır (Kesin Kural #12).

---

## 7. Pano Sayfalarının Mimarisi

### CLI Kodları (`/dashboard/cli-code`)

- `src/app/(dashboard)/dashboard/cli-code/page.tsx` — sunucu bileşeni
- `src/app/(dashboard)/dashboard/cli-code/CliCodePageClient.tsx` — istemci ızgarası
- `src/app/(dashboard)/dashboard/cli-code/[id]/page.tsx` — araç ayrıntı sayfası
- `src/app/(dashboard)/dashboard/cli-code/components/` — 12 özel araç kartı + `ToolDetailClient.tsx`

### CLI Aracıları (`/dashboard/cli-agents`)

- `src/app/(dashboard)/dashboard/cli-agents/page.tsx` — sunucu bileşeni
- `src/app/(dashboard)/dashboard/cli-agents/CliAgentsPageClient.tsx` — istemci ızgarası
- `src/app/(dashboard)/dashboard/cli-agents/[id]/page.tsx` — `ToolDetailClient` bileşenini yeniden kullanır

### ACP Aracıları (`/dashboard/acp-agents`)

- `src/app/(dashboard)/dashboard/acp-agents/page.tsx` — sunucu bileşeni (`agents/` dizininden taşındı)

### Paylaşılan Kullanıcı Arayüzü Bileşenleri (`src/shared/components/cli/`)

| Dosya                   | Amaç                                                      |
| ----------------------- | --------------------------------------------------------- |
| `CliToolCard.tsx`       | Akıllı durum kartı (algılama + yapılandırma + uç nokta)   |
| `CliConceptCard.tsx`    | Sayfa başına kavram açıklama kartı                        |
| `CliComparisonCard.tsx` | CLI türleri arasında üç sütunlu karşılaştırma             |
| `BaseUrlSelect.tsx`     | Uç nokta açılır menüsü (Yerel/Bulut/Özel)                 |
| `ApiKeySelect.tsx`      | API anahtarı seçici                                       |
| `ManualConfigModal.tsx` | Kopyalanabilir yapılandırma kod parçacığı iletişim kutusu |

### Paylaşılan Hook (`src/shared/hooks/cli/`)

| Dosya                     | Amaç                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------- |
| `useToolBatchStatuses.ts` | `/api/cli-tools/all-statuses` verilerini getirir, yükleme/yenileme durumunu yönetir |

---

## 8. i18n

Plan 14 F9 kapsamında eklenen yeni ad alanları:

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

> Anahtarınız şu şekilde görünür: `sk-xxxxxxxxxxxxxxxx-xxxxxxxxx`

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
2. Aracınızı ızgarada bulun
3. Araç ayrıntı sayfasını açmak için karta tıklayın
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
# Gemini CLI, GOOGLE_GEMINI_BASE_URL değerini KÖK düzeyinde okur (SDK'sı /v1beta/... kısmını kendisi ekler)
export GOOGLE_GEMINI_BASE_URL="http://localhost:20128"
export GEMINI_API_KEY="sk-your-pusula-key"
```

> **Uzak sunucu** için `localhost:20128` kısmını sunucu IP'si veya alan adıyla değiştirin,
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

Claude Code için birleşik Anthropic ağ geçidi kökünü kullanın. Buraya `/v1` eklemeyin.

**Test:** `claude "say hello"`

---

#### OpenAI Codex

Modern Codex (v0.137+) yalnızca `~/.codex/config.toml` dosyasını okur — eski
`config.yaml`, eski npm CLI'ye aittir ve herhangi bir uyarı verilmeden yok sayılır. API
anahtarı hiçbir zaman dosyanın içinde değil, `PUSULA_API_KEY` ortam değişkeninde (`env_key`)
tutulur:

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
> `opencode run "your prompt" --model pusula/claude-sonnet-4-5-thinking --variant high` kullanın.

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

Düzenledikten sonra VS Code'u yeniden başlatın.

---

#### VS Code Insiders (`chatLanguageModels.json`)

VS Code Insiders özel uç nokta modelleri için yapılandırılmışsa ve Pusula'un özel bir üstbilgi alanı olmadan çalışmasını istiyorsanız bunu kullanın.

**Önerilen konum:**

- Linux: `~/.config/Code - Insiders/User/chatLanguageModels.json`
- Windows: `%APPDATA%/Code - Insiders/User/chatLanguageModels.json`

**Tokenize edilmiş Pusula takma adını kullanan örnek:**

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
- İstemci özel üst bilgileri destekliyorsa normal `/v1` + Bearer üst bilgisi akışını tercih edin.
- URL'ye gömülü token'lar, uyumluluk için kullanılan bir geri dönüş seçeneğidir ve düzenleyici günlüklerinde veya proxy geçmişinde görünebilir.

---

#### Kiro CLI (Amazon)

```bash
# AWS/Kiro hesabınızda oturum açın:
kiro-cli login

# CLI kendi kimlik doğrulamasını kullanır — Kiro CLI'ın kendisi için arka uç olarak Pusula gerekli değildir.
# Diğer araçlar için kiro-cli'ı Pusula ile birlikte kullanın.
kiro-cli status
```

**Kiro IDE** masaüstü uygulaması için Pusula tarafından
`/dashboard/cli-tools → Kiro` altında sunulan MITM uç noktasını kullanın.

---

## 10. Dahili Pusula CLI

`pusula` ikili dosyası; sunucu yaşam döngüsü, kurulum, tanılama ve sağlayıcı yönetimi için komutlar sunar. Giriş noktası: `bin/pusula.mjs`.

```bash
pusula                              # Sunucuyu başlatır (varsayılan port 20128)
pusula setup                        # Etkileşimli kurulum sihirbazı
pusula doctor                       # Yapılandırmayı, veritabanını, portları ve çalışma zamanını denetler
pusula providers list               # Yapılandırılmış sağlayıcı bağlantıları
pusula providers test-all           # Tüm etkin bağlantıları test eder
pusula reset-password               # Yönetici parolasını sıfırlar
pusula logs                         # İstek günlüklerini akış halinde gösterir
pusula health                       # Ayrıntılı sistem durumu (devre kesiciler, önbellek, bellek)
pusula --version                    # Sürümü yazdırır
pusula --help                       # Tüm komutları gösterir
```

### Kurulum ve Başlatma

```bash
pusula setup                        # Etkileşimli kurulum sihirbazı
pusula setup --non-interactive      # CI/otomasyon modu (ortam değişkenlerini ve bayrakları okur)
pusula setup --password '<value>'   # Yönetici parolasını doğrudan ayarlar
pusula setup --add-provider \
  --provider openai \
  --api-key '<value>' \
  --test-provider                      # Tek adımda bir sağlayıcı ekler ve test eder
```

Etkileşimsiz kurulum için tanınan ortam değişkenleri:

| Değişken         | Amaç                                                                                   |
| ---------------- | -------------------------------------------------------------------------------------- |
| `PUSULA_API_KEY` | Sağlayıcı API anahtarı (Commander `.env()` aracılığıyla `--api-key` ile bağlantılıdır) |
| `DATA_DIR`       | Pusula veri dizinini geçersiz kılar                                                    |

Diğer tüm etkileşimsiz girdiler ortam değişkenleri olarak değil, bayraklar olarak iletilir:
`--password`, `--provider`, `--provider-name`, `--provider-base-url`, `--default-model`
(yukarıdaki `pusula setup` seçeneklerine bakın).

### Tanılama

```bash
pusula doctor                       # Yapılandırmayı, veritabanını, portları, çalışma zamanını, belleği ve çalışırlığı denetler
pusula doctor --json                # Makine tarafından okunabilir JSON
pusula doctor --no-liveness         # HTTP sistem durumu yoklamasını atlar
pusula doctor --host 0.0.0.0        # Çalışırlık ana makinesini geçersiz kılar
pusula doctor --liveness-url <url>  # Tam sistem durumu uç noktası URL'sini geçersiz kılar
```

Doctor şu denetimleri çalıştırır: `Config`, `Database`, `Storage/encryption`,
`Port availability`, `Node runtime`, `Native binary` (better-sqlite3),
`Memory` ve `Server liveness`. Herhangi bir denetim `fail` olursa sıfır olmayan bir kodla çıkar.

### Sağlayıcı Yönetimi

```bash
pusula providers available                       # Pusula sağlayıcı kataloğu
pusula providers available --search openai       # Kataloğu kimliğe/ada/takma ada/kategoriye göre filtreler
pusula providers available --category api-key    # Kategoriye göre filtreler (api-key, oauth, free, ...)
pusula providers available --json                # Makine tarafından okunabilir JSON

pusula providers list                            # Yapılandırılmış sağlayıcı bağlantıları
pusula providers list --json

pusula providers test <id|name>                  # Yapılandırılmış tek bir bağlantıyı test eder
pusula providers test-all                        # Tüm etkin bağlantıları test eder
pusula providers validate                        # Yalnızca yerel yapısal doğrulama
pusula providers add <provider> --credential-env PROVIDER_KEY
pusula providers import ./providers.json --dry-run --json
pusula providers auth <provider>                 # Mevcut OAuth akışı
pusula providers edit <id|name> --default-model <model>
pusula providers remove <id|name> --yes
```

`providers add/import/auth/edit/remove` öncelikle API'yi kullanır ve bu nedenle
etkin yerel veya uzak bağlama karşı çalışır. Kimlik bilgisi girişi için
`--credential-stdin` veya `--credential-env` kullanılmalıdır; `--dry-run --json`
yalnızca sansürlenmiş varlık/biçim bilgilerini bildirir. `providers available`,
Pusula kataloğunu okur; `providers list/test/test-all/validate` ise yerel SQLite
davranışını korur ve sunucunun çalışmasını gerektirmez.

Özel bir OpenAI uyumlu veya Anthropic uyumlu düğüm için kimlik bilgilerini
`pusula nodes add` tarafından döndürülen düğüm kimliğine
`pusula keys add "$NODE_ID" --stdin` komutunu kullanarak iliştirin.
Bu işlem, çalışan bir sunucu ve etkin bağlam için yönetim kimlik doğrulaması gerektirir.
CLI, düğümü doğrulayan ve uç nokta ayarlarını bağlantıya kopyalayan
`POST /api/providers` isteğini kullanır. Eksik bir düğüm, yetkilendirme hatası veya
kullanılamayan bir sunucu, yerel bir yedek kimlik bilgisi oluşturmadan hata döndürür.

`nodes add --base-url`, düğüm uç noktasını ayarlar; bu, `PUSULA_BASE_URL`
içindeki sunucu adresinden farklıdır. OpenAPI dosyaları için
`pusula openapi dump --format json --out ./openapi.json` komutunu kullanın; genel
`--output`, hedef dosya adını değil CLI görüntüleme biçimini seçer.

### Kurtarma ve Sıfırlama

```bash
pusula reset-password                # Yönetici parolasını sıfırlar (diğer adı: pusula-reset-password)
pusula reset-encrypted-columns       # Şifrelenmiş kimlik bilgilerini sıfırlamak için uyarı ve deneme çalıştırması gösterir
pusula reset-encrypted-columns --force  # SQLite içindeki şifrelenmiş kimlik bilgilerini gerçekten null olarak ayarlar
```

### Kimlik Bilgilerini Dışa Aktarma (⚠ dikkatli kullanın)

```bash
pusula auth export                                 # Uyarı ve onay geçidini gösterir — veritabanına erişmez
pusula auth export --force                          # TÜM bağlantıların ŞİFRESİ ÇÖZÜLMÜŞ kimlik bilgilerini JSON olarak stdout'a aktarır
pusula auth export --force --id <id>                 # Yalnızca eşleşen bağlantıyı dışa aktarır
pusula auth export --force --format env               # PUSULA_<PROVIDER>_<FIELD>=<value> satırları üretir
pusula auth export --force --out creds.json           # Bir dosyaya yazar (0600 izinleriyle oluşturulur)
```

`auth export` **yalnızca yerel olarak** çalışır (doğrudan SQLite okuması yapar, HTTP rotası kullanmaz) ve kasıtlı olarak
**düz metin** `apiKey`/`accessToken`/`refreshToken`/`idToken` değerlerini yazdırır veya dosyaya yazar — bu bir
hata değil, özelliktir. `--force` olmadan veritabanından hiçbir şey okunmaz ve hiçbir şeyin şifresi çözülmez. Herhangi bir düz metin çıktılanmadan önce stderr'e
her zaman bir uyarı bandı yazdırılır. `STORAGE_ENCRYPTION_KEY` değişkeninin
ayarlanmış olması gerekir. Şifresi çözülemeyen bir alan (eski anahtar, bozuk şifreli metin), tüm dışa aktarma işlemini iptal etmek veya temel hatayı sızdırmak yerine
`<field>DecryptFailed: true` olarak bildirilir.

### Diğer alt komutlar

Aksi belirtilmedikçe bunlar, çalışan bir Pusula sunucusunun bulunduğunu varsayar:

```bash
pusula status                       # Kapsamlı çalışma zamanı durumu
pusula logs                         # İstek günlüklerini akış halinde göster (--json, --search, --follow)
pusula config list                  # Yapılandırılmış CLI araçlarını görüntüle

pusula provider list                # Kullanılabilir sağlayıcıları listele (providers list için takma ad)
pusula provider add                 # Pusula'u bir araçta sağlayıcı olarak kaydet
pusula keys add | list | remove     # API anahtarlarını yönet
pusula models [provider]            # Modelleri listele (--json, --search)
pusula combo list | switch | create | delete

pusula backup                       # Yapılandırma + DB anlık görüntüsü oluştur
pusula restore                      # Önceki bir anlık görüntüden geri yükle

pusula health                       # Ayrıntılı sistem sağlığı (devre kesiciler, önbellek, bellek)
pusula quota                        # Sağlayıcı kota kullanımı
pusula cache                        # Önbellek durumu
pusula cache clear                  # Anlamsal + imza önbelleklerini temizle

pusula mcp status | restart         # MCP sunucusu durumu / yeniden başlatma
pusula a2a status | card            # A2A sunucusu durumu / aracı kartı

pusula tunnel list | create | stop  # Tünelleri yönet (cloudflare/tailscale/ngrok)
pusula env show | get <k> | set <k> <v>  # Ortam değişkenlerini incele / ayarla (geçici)

pusula test                         # Sağlayıcı bağlantısı hızlı testi
pusula update                       # Güncellemeleri denetle
pusula completion                   # Kabuk tamamlama betiği oluştur
```

### Ortak bayraklar

| Bayrak              | Açıklama                                                          |
| ------------------- | ----------------------------------------------------------------- |
| `--no-open`         | Başlatma sırasında tarayıcıyı otomatik olarak açma                |
| `--port <n>`        | API portunu geçersiz kıl (varsayılan 20128)                       |
| `--mcp`             | stdio üzerinden MCP sunucusu olarak çalıştır (IDE'ler için)       |
| `--non-interactive` | CI modu (istem yoktur; ortam değişkenlerinden/bayraklardan okur)  |
| `--json`            | Makine tarafından okunabilir JSON çıktısı (doctor, providers vb.) |
| `--help`, `-h`      | Komuta özgü yardımı göster                                        |
| `--version`, `-v`   | Yüklü sürümü yazdır                                               |

---

## Kullanılabilir API Uç Noktaları

| Uç Nokta                   | Açıklama                           | Kullanım Amacı                  |
| -------------------------- | ---------------------------------- | ------------------------------- |
| `/v1/chat/completions`     | Standart sohbet (tüm sağlayıcılar) | Tüm modern araçlar              |
| `/v1/responses`            | Responses API (OpenAI biçimi)      | Codex, ajan tabanlı iş akışları |
| `/v1/completions`          | Eski metin tamamlamaları           | `prompt:` kullanan eski araçlar |
| `/v1/embeddings`           | Metin gömmeleri                    | RAG, arama                      |
| `/v1/images/generations`   | Görüntü oluşturma                  | GPT-Image, Flux vb.             |
| `/v1/audio/speech`         | Metinden konuşmaya                 | ElevenLabs, OpenAI TTS          |
| `/v1/audio/transcriptions` | Konuşmadan metne                   | Deepgram, AssemblyAI            |

Belirteç içeren bir Pusula URL'siyle kullanıma hazır örnekler:

```txt
Belirteç örneği: sk-a3ab3c080beaee3a-69f4a4-070d71af

Standart OpenAI taban adresi: http://localhost:20128/v1
VS Code modelleri: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/models
VS Code sohbeti: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/chat/completions
VS Code yanıtları: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/responses
Ollama etiketleri: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/tags
Ollama sohbeti: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/chat
```

---

## Sorun Giderme

| Hata                                            | Neden                         | Çözüm                                                                |
| ----------------------------------------------- | ----------------------------- | -------------------------------------------------------------------- |
| `Connection refused`                            | Pusula çalışmıyor             | `pusula serve`                                                       |
| `401 Unauthorized`                              | Yanlış API anahtarı           | `/dashboard/api-manager` içinde kontrol edin                         |
| `No combo configured`                           | Etkin yönlendirme kombosu yok | `/dashboard/combos` içinde ayarlayın                                 |
| CLI "not installed" gösteriyor                  | İkili dosya PATH içinde değil | `which <command>` komutunu kontrol edin                              |
| Kurulumdan sonra pano "not detected" gösteriyor | Önbellek güncel değil         | Panoda "⟳ Refresh detection" seçeneğine tıklayın                     |
| Eski bağlantı `/dashboard/cli-tools`            | v3.8.6 öncesinden yer imi     | Otomatik olarak `/dashboard/cli-code` adresine yönlendirilir (308)   |
| Eski bağlantı `/dashboard/agents`               | v3.8.6 öncesinden yer imi     | Otomatik olarak `/dashboard/acp-agents` adresine yönlendirilir (308) |

## Çıkarım anahtarı politikasını Pusula CLI ile yönetin

Mevcut bir çıkarım anahtarını kimliğine göre incelemek veya güncellemek için kimliği doğrulanmış bir yönetim bağlamı kullanın (bkz. [Uzak Mod](../guides/REMOTE-MODE.md)):

```bash
pusula --output json keys policy show KEY_ID
pusula keys policy set KEY_ID --unrestricted
pusula --output json keys policy show KEY_ID
```

`--unrestricted`, `--model-access-mode all` için bir diğer addır. Güncelleme, model izin listesini temizler. Kapsamları, bağlantı kurallarını, engellenen modelleri, hız sınırlarını ve maliyet sınırlarını korur; dolayısıyla bu diğer denetimler bir isteği yine de reddedebilir. Açıkça belirtilen `--allowed-models ""` de `all` seçeneğini belirler; izin verilen modeli olmayan kısıtlanmış bir anahtarı korumak için bunu `--model-access-mode restricted` ile birleştirin. Boş olmayan, virgülle ayrılmış bir liste, açıkça aksi belirtilmedikçe `restricted` seçeneğini belirler. Çelişkili bir şekilde `all` ile boş olmayan bir izin listesinin birlikte kullanılması, istek gönderilmeden önce reddedilir.

`--rate-limit 30`, dakika başına istek sayısını ayarlar ve diğer zaman aralıklarına yönelik kuralları korur. `--max-cost 5`, haftalık üst sınırı değiştirmeden günlük USD üst sınırını etkinleştirir; `--max-cost 0`, günlük üst sınırı kaldırır ve mevcut kullanım sınırı ayarıyla haftalık üst sınırı korur. Belirtilmeyen politika alanları değiştirilmeden kalır. Hız değişiklikleri önce mevcut politikayı okur; aynı anahtarın hız sınırı dizisinde eş zamanlı düzenlemeler yapmaktan kaçının.

Politika komutları, kimliği doğrulanmış `GET`/`PATCH /api/keys/{id}` kullanır ve etkin bağlama ve genel `--api-key` seçeneğine uyar. JSON çıktısı yalnızca politika alanlarını içerir; saklanan anahtarı veya anahtarın maskelenmiş gösterimini içermez. Yalnızca çıkarım için kullanılan bir kimlik bilgisi, yönetim değişikliklerine yetki veremez. 401/403 yanıtı, yönetim kimlik bilgisinin ve bağlamın kontrol edilmesini gerektirir; yerel bir CLI belirteci veya salt hatasını kanıtlamaz. Ayrı yerel kimlik doğrulama sözleşmesi için [CLI Belirteci](../security/CLI_TOKEN.md) bölümüne bakın.
