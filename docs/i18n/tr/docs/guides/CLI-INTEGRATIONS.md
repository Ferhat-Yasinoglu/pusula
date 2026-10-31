# CLI Integrations (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CLI-INTEGRATIONS.md) · 🇩🇪 [de](../../../de/docs/guides/CLI-INTEGRATIONS.md) · 🇮🇷 [fa](../../../fa/docs/guides/CLI-INTEGRATIONS.md)

---

Paylaşılan çalıştırılabilir dosya manifesti, kısıtlanmış alt ortamlar ve kalıcı
Gemini kurulumu için [CLI başlatma sözleşmeleri](./CLI-LAUNCH-CONTRACTS.md) belgesine bakın.

Pusula, bir kodlama CLI'ını (Codex, Claude Code, OpenCode, Cline, …) arka uç
olarak Pusula'u kullanacak şekilde yapılandıran bir `setup-*` komutları ailesi
sunar; böylece araç **tek** bir uç noktayla iletişim kurar ve Pusula, otomatik
yedek sağlayıcıya geçiş özelliğiyle istekleri doğru sağlayıcıya yönlendirir. Her
komut, çalışan bir Pusula'tan (yerel veya uzak) **canlı** model kataloğunu okur
ve aracın kendi yapılandırma dosyasını **sizin** makinenize yazar. Araç desteklediği
sürece API anahtarına bir ortam değişkeni üzerinden başvurulur. Araca özgü kalıcı
bir ortam dosyası oluşturan komutlar aşağıda belirtilmiştir.

Ayrıca hiçbir yapılandırma yazmadan doğru ortam değişkenlerini ekleyerek `claude`,
`codex`, `aider`, `goose`, `opencode`, `qwen` veya `gemini` süreçlerini başlatan
genel bir başlatıcı da vardır: `pusula run <target>`. Hedefler ve bunların
takma adları, standart `bin/cli/cli-manifest.mjs` manifestinden gelir
(`claude-code|cc|anthropic`, `codex-cli|openai-codex|openai`, `goose-cli`,
`open-code`, `qwen-code`, `gemini-cli`) ve `pusula completion` aynı şekilde
manifestten türetilen hedef sözcüklerini sunar. Araç başına eski başlatıcılar olan
`pusula launch` (Claude Code) ve `pusula launch-codex` (Codex) kullanılmaya
devam edilebilir.

Sağlayıcı ekleme işlemi de aynı yerel/uzak bağlamdan gerçekleştirilebilir. Aşağıdaki
API öncelikli komutlar, yönetim kimlik doğrulamasını sağlayıcı kimlik bilgilerinden
ayrı tutar ve yapılandırılmış çıktıda hiçbir zaman kimlik bilgisi göstermez:

```bash
pusula providers add glm --credential-env GLM_API_KEY --name work
pusula providers import ./providers.json --dry-run --json
pusula providers auth openai
pusula providers edit <connection-id> --default-model glm/glm-5.2
pusula providers remove <connection-id> --yes
```

Betikler için `--credential-stdin` veya `--credential-env` seçeneğini tercih edin;
`--credential`, denetimli yerel kullanım için korunmuştur. `providers remove`,
etkileşimli olmayan bir terminalde `--yes` seçeneğini gerektirir ve beş komutun
tümü etkin bağlamı veya genel `--base-url`/`--api-key` seçeneklerini dikkate alır.

Sağlayıcı seçicileri belirsiz kimlik öneklerini, adları veya sağlayıcı adlarını
reddeder; birden fazla bağlantı eşleştiğinde tam bağlantı kimliğini kullanın.
Oluşturma ve düzenleme komutları kaydedilen bağlantıyı yeniden okur; kaldırma
işlemi ise bağlantının artık okunamadığını doğrular. İçe aktarma işlemi, mevcut
bir sağlayıcı/ad çiftini atlar. İçe aktarılan girdiler, CLI'a sağlanan yönetim uç
noktasını, bağlamı veya yönetim kimlik bilgilerini geçersiz kılamaz.

En kapsamlı iki entegrasyonun tek seferlik, elle yazılan temel kurulumu için araç
başına ayrıntılı kılavuzlara bakın:

- [Claude Code yapılandırması](./CLAUDE-CODE-CONFIGURATION.md)
- [Codex CLI yapılandırması](./CODEX-CLI-CONFIGURATION.md)
- [Uzak Mod](./REMOTE-MODE.md) — dizüstü bilgisayarınızdan uzak bir Pusula'u (VPS / Tailnet) yönetin

---

## Ana tablo

Her komut, **etkin bağlama** (`pusula connect` ile ayarlanır; bkz.
[Uzak Mod](./REMOTE-MODE.md)) veya açıkça belirtilen `--remote <url> --api-key <key>` bayraklarına uyar.
Aşağıdaki "yerel ve uzak" ifadesi şu anlama gelir: hiçbir bayrak kullanılmadığında `http://localhost:20128`
hedeflenir; `--remote` kullanıldığında (veya etkin bir uzak bağlam mevcut olduğunda) katalog söz konusu
sunucudan alınır ve yapılandırma yerel olarak yazılır.

| Komut                   | Araç                            | Yazdığı yer                                                                                                                                                                                             | Temel bayraklar                                                                                                                            | Yerel ve uzak |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------- |
| `pusula setup-codex`    | OpenAI Codex CLI                | `~/.codex/<name>.config.toml` — uyumlu her metin modeli için bir profil (`codex --profile <name>`)                                                                                                      | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home`                                                                        | Her ikisi     |
| `pusula setup-claude`   | Claude Code                     | `~/.claude/profiles/<name>/settings.json` — eşleşen her model için bir profil (`CLAUDE_CONFIG_DIR`)                                                                                                     | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home`                                                                       | Her ikisi     |
| `pusula setup-opencode` | OpenCode (OpenAI uyumlu)        | `~/.config/opencode/opencode.json` — katalogdaki tüm modelleri içeren `pusula` sağlayıcısı (`opencode -m pusula/<model>`)                                                                               | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port`                                                                             | Her ikisi     |
| `pusula setup-cline`    | Cline                           | `~/.cline/data/{globalState,secrets}.json` (CLI modu) + VS Code uzantısı ayarlarını yazdırır                                                                                                            | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir`                                                                | Her ikisi     |
| `pusula setup-kilo`     | Kilo Code                       | `~/.local/share/kilo/auth.json` (CLI) + varsa `kilocode.*` ayarlarını VS Code `settings.json` dosyasıyla birleştirir                                                                                    | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings`                                            | Her ikisi     |
| `pusula setup-continue` | Continue / `cn` CLI             | `~/.continue/config.yaml` — `provider: openai` modelleri, anahtar `${{ secrets.PUSULA_API_KEY }}` üzerinden                                                                                             | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | Her ikisi     |
| `pusula setup-cursor`   | Cursor                          | Hiçbir şey — uygulama içi adımları yazdırır (Cursor yapılandırması opak SQLite biçimindedir)                                                                                                            | `--remote` `--api-key` `--only` `--port`                                                                                                   | Her ikisi     |
| `pusula setup-roo`      | Roo Code                        | `~/.pusula/roo-settings.json` (içe aktarma belgesi) + bir VS Code `settings.json` dosyası varsa `roo-cline.autoImportSettingsPath` değerini ayarlar                                                     | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings`                                          | Her ikisi     |
| `pusula setup-crush`    | Crush                           | `~/.config/crush/crush.json` — `openai-compat` sağlayıcısı, anahtar `$PUSULA_API_KEY` üzerinden                                                                                                         | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | Her ikisi     |
| `pusula setup-zed`      | Zed                             | `~/.config/zed/settings.json` — `openai_compatible.pusula` sağlayıcısı (araç kullanabilen ≤ 25 model), anahtar `$PUSULA_API_KEY` üzerinden                                                              | `--remote` `--api-key` `--only` `--reset` `--dry-run` `--port` `--config-path`                                                             | Her ikisi     |
| `pusula setup-goose`    | Goose                           | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + ortam değişkeni tarifini yazdırır                                                                                        | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | Her ikisi     |
| `pusula setup-aider`    | Aider                           | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + ortam değişkeni tarifini yazdırır                                                                                                      | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | Her ikisi     |
| `pusula setup-qwen`     | Qwen Code                       | `~/.qwen/settings.json` — V4 `modelProviders.openai` dizisi + `~/.qwen/.env` içinde `PUSULA_API_KEY`                                                                                                    | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` `--env-path`                                                 | Her ikisi     |
| `pusula setup-5dive`    | 5dive (ajan filosu)             | `$HOME` altında hiçbir şey yok — `5dive agent auth set` aracılığıyla bir 5dive **kimlik doğrulama profili** (`/var/lib/5dive/auth-profiles/<name>/`) yazar; yalnızca root, filo ana makinesinde çalışır | `--remote` `--api-key` `--model` `--auth-profile` `--agent` `--byo-provider` `--fivedive-bin` `--no-sudo` `--yes` `--dry-run` `--port`     | Her ikisi de  |
| `pusula run <target>`   | Çalışma zamanı başlatma (genel) | Hiçbir şey — doğru ortam ve bağımsız değişkenlerle `claude`/`codex`/`aider`/`goose`/`opencode`/`qwen`/`gemini` işlemini başlatır; Qwen ve Gemini geçici, yalıtılmış bir ana dizin kullanır              | `--remote` `--base-url` `--context` `--provider` `--model` `--api-key` `--api-key-env` `--dry-run` `--json` `--port` `--profile` `--token` | Her ikisi de  |
| `pusula launch`         | Claude Code                     | Hiçbir şey — `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` eklenmiş olarak `claude` işlemini başlatır                                                                                                     | `--remote` `--api-key` `--token` `--profile` `--port`                                                                                      | Her ikisi de  |
| `pusula launch-codex`   | OpenAI Codex CLI                | Hiçbir şey — `-c` bayrakları aracılığıyla `pusula` sağlayıcısı eklenmiş olarak `codex` işlemini başlatır                                                                                                | `--remote` `--api-key` `--profile` (`-p`) `--port`                                                                                         | Her ikisi de  |

Bayraklarla ilgili notlar (komut kaynağında doğrulanmıştır):

- `--remote <url>` — kataloğu uzak bir Pusula'tan alır (`--port`
  ve etkin bağlamı geçersiz kılar). `--api-key <key>`, söz konusu
  sunucu için kimlik bilgilerini sağlar (varsayılan olarak `PUSULA_API_KEY` ortam değişkeni veya etkin bağlamın belirteci kullanılır).
- `--only <patterns>` — virgülle ayrılmış alt dizeler; yalnızca eşleşen model kimliklerini
  tutar (ör. `--only glm,kimi`). `setup-codex`, `setup-claude`,
  `setup-opencode`, `setup-continue`, `setup-cursor`, `setup-crush`, `setup-zed` üzerinde kullanılabilir.
- `--dry-run` — dosya sistemine dokunmadan tam olarak nelerin yazılacağını
  yazdırır. `setup-cursor` (**hiçbir zaman** dosya yazmaz)
  dışındaki tüm `setup-*` komutlarında kullanılabilir.
- `--model <id>` — otomatik model keşfi olmayan araçlar için gereklidir
  (veya etkileşimli olarak seçilir): Cline, Kilo, Roo, Goose, Qwen, Aider, 5dive. Bu araçlar
  etkileşimsiz çalıştırmalar için `--yes` seçeneğini de kabul eder (bu durumda `--model` gereklidir).
  `setup-opencode`, varsayılan üst düzey modeli ayarlamak için `--model` seçeneğini alır.
- `pusula run` üzerindeki `--model <id>`, manifestin hedef başına bağlantı yapılandırmasını
  (`bin/cli/cli-manifest.mjs`) izler: **aider**, `--model openai/<id>` ve
  **opencode**, `--model pusula/<id>` alır (önek yalnızca kimlik
  zaten bu öneki taşımıyorsa eklenir); **qwen** ve **gemini** kimliği olduğu gibi alır;
  **claude** bunu `ANTHROPIC_MODEL`, **goose** ise `GOOSE_MODEL` aracılığıyla,
  **codex** de `-c model_providers.pusula.*` bağımsız değişkenleri aracılığıyla alır. **Qwen, `--model` seçeneğini
  kesin olarak gerektiren tek çalıştırma hedefidir** — bu seçenek olmadan `pusula run qwen`,
  açık bir hatayla `2` koduyla sonlanır.
- `--port <port>` — yerel Pusula bağlantı noktası (varsayılan `20128`; `--remote`
  ayarlandığında yok sayılır). Tüm `setup-*` komutlarında ve her iki başlatıcıda bulunur.
- `pusula run` çıkış kodları: alt CLI'ın kendi çıkış kodu
  olduğu gibi aktarılır; `2` = geçersiz bağımsız değişkenler (desteklenmeyen hedef, gerekli
  `--model` seçeneğinin eksik olması, konteyner koruması); `127` = hedef ikili dosya `PATH` içinde değil;
  başlatma `SIGINT`/`SIGTERM`/`SIGHUP` ile sonlandırıldığında `130`/`143`/`129`;
  `1` = diğer çalışma zamanı başlatma hataları.
- İki başlatıcı (`launch`, `launch-codex`), `setup-claude` / `setup-codex`
  tarafından yazılmış bir profili seçmek için `--profile <name>` seçeneğini ve ayrıca temel
  `claude` / `codex` ikili dosyasına aktarılacak bağımsız değişkenleri kabul eder.

Etkileşimli seçici, kurulum tarifleri tarafından da ortak olarak kullanılır:

```bash
# Etkin yerel veya uzak model kataloğundan seçim yapın ve hedefi yapılandırın.
pusula configure claude
pusula configure opencode --provider glm
pusula configure qwen --model qwen/qwen3.8-max-preview --yes
```

`configure` şu anda `codex`, `claude`,
`opencode`, `qwen`, `aider`, `goose`, `cline`, `continue`, `kilo` ve `5dive` için test edilmiş tariflere yetki devreder.
Yalnızca IDE'ye yönelik,
MITM ve yalnızca kılavuz niteliğindeki katalog girdileri açık `setup-*`/manuel akışlar olarak kalır ve
başlatılabilir hedefler olarak sunulmaz.

> `setup-opencode`, **hafif openai uyumlu** OpenCode entegrasyonudur.
> Ayrıca `@pusula/opencode-plugin` paketini
> yükleyen daha zengin bir eklenti entegrasyonu da vardır — `pusula setup opencode`. Bunlar farklı komutlardır; yukarıdaki tablo
> `setup-opencode` komutunu belgeler.
>
> Eklenti, iki yükleyici farklı giriş noktaları
> beklediği için her OpenCode ana sürümüne bir tane olmak üzere iki paket hâlinde sunulur:
> OpenCode v1 için `@pusula/opencode-plugin` ve
> OpenCode v2 için `@pusula/opencode-plugin-v2`. v2 paketi yenidir
> (`0.1.0`) ve hâlâ değişmekte olan bir ana makine sözleşmesini izler; bu nedenle belirli bir yapı varsaymak yerine
> OpenCode'un katalog taslağına yerleştirdiği yapıyı okur.
> `opencode.json` dosyasına bir `plugins` girdisi ekleyerek yükleyin; `pusula setup opencode`
> hâlâ v1 paketini yükler. Seçenekler ve kimlik bilgisi arama sırası
> paket README dosyasında yer alır.

---

## Yerel kullanım

Pusula `localhost:20128` üzerinde çalışırken aracınız için kurulum komutunu çalıştırmanız yeterlidir. Katalog yerel sunucudan alınır.

```bash
# Codex: eşleşen her model için ~/.codex/ içine bir profil yaz
pusula setup-codex
codex --profile glm52            # oluşturulan bir profili kullan

# Claude Code: model başına profilleri yaz, ardından birini başlat
pusula setup-claude
pusula launch --profile glm52

# OpenCode: openai uyumlu sağlayıcıyı tüm katalog modelleriyle yaz
pusula setup-opencode
export PUSULA_API_KEY=sk-...  # {env:PUSULA_API_KEY} üzerinden başvurulur, asla diske yazılmaz
opencode -m pusula/glm/glm-5.2 "..."

# Otomatik keşif özelliği olmayan araçlar açıkça belirtilen bir modele ihtiyaç duyar:
pusula setup-aider --model glm/glm-5.2
pusula setup-qwen --model qwen/qwen3.8-max-preview

# Hiçbir şey yazmadan önizle:
pusula setup-continue --dry-run
```

Hiçbir yapılandırma yazmadan başlatın (yalnızca ortam değişkeni enjeksiyonu):

```bash
pusula launch                 # Claude Code → yerel Pusula
pusula launch-codex           # Codex CLI → yerel Pusula
pusula launch-codex --profile glm52
pusula run claude --model openai/gpt-5.4
pusula run codex --model openai/gpt-5.4 --dry-run --json
pusula run aider --model glm/glm-5.2 -- --message "reply OK"
pusula run goose --model glm/glm-5.2
pusula run opencode --model glm/glm-5.2 -- run "reply OK"
pusula run qwen --model glm/glm-5.2 -- -p "reply OK"
pusula run gemini --model glm/glm-5.2 -- --skip-trust -p "reply OK"

# Açık komut yolu: -- sonrasında gelen her şeyi olduğu gibi aktar
pusula run claude -- --print-system-prompt "review this diff"
```

---

## Uzak kullanım

Herhangi bir kurulum komutunu `--remote` + `--api-key` ile uzak bir Pusula'a yönlendirin. Katalog uzak sunucudan alınır; yapılandırma ise yerel makinenize yazılır.

```bash
# Uzak bir VPS üzerindeki OpenCode; yalnızca glm/kimi modellerini tut
pusula setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx \
  --only glm,kimi
opencode -m pusula/glm/glm-5.2 "..."   # önce PUSULA_API_KEY değerini dışa aktar

# Uzak bir katalogdan Codex profilleri
pusula setup-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# Bir CLI'ı doğrudan uzak sunucuya karşı başlat
pusula launch       --remote http://192.168.0.15:20128 --api-key oma_live_xxx
pusula launch-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

Her seferinde `--remote`/`--api-key` geçirmek yerine bir kez oturum açın ve **etkin bağlamın** bunları otomatik olarak sağlamasına izin verin:

```bash
pusula connect 192.168.0.15        # kapsamlı bir belirteç oluşturur, bağlamı saklar
pusula setup-codex                 # ← artık uzak kataloğu kullanır
pusula setup-opencode              # ← aynı şekilde
pusula launch                      # ← uzak sunucuya karşı Claude Code
```

Bağlamlar, kapsamlar ve belirteç yönetimi için [Uzak Mod](./REMOTE-MODE.md) bölümüne bakın.

---

## 5dive ajan filoları

[5dive](https://5dive.ai), her biri kendi Unix kullanıcısı altında bir systemd birimi olan, uzun süre çalışan kodlama ajanlarından oluşan bir filo çalıştırır. Kendisi bir kodlama CLI'ı değildir; dolayısıyla `pusula run` tarafından başlatılacak bir şey yoktur — `5dive` **yalnızca yapılandırma** hedefidir.

```bash
pusula configure 5dive --model failover-demo --yes
pusula setup-5dive --model failover-demo --auth-profile pusula --agent worker1
```

Her iki biçim de bir 5dive **kimlik doğrulama profili** yazar ve bu profile bağlı her `claude` lisansı bundan sonra Pusula ile iletişim kurar. Bu hedefe özgü üç nokta vardır:

- **Filo ana makinesinde root olarak çalışır.** 5dive komutları yerel systemd birimleri ve root'a ait bir durum dizini üzerinde işlem yapar; uzak mod yoktur. Tarif, zaten root olarak çalışmıyorsa `sudo` üzerinden kendini yeniden çalıştırır (`--no-sudo` bunu devre dışı bırakır ve bunun yerine komutu yazdırır).
- **Geri döngü adresi olmadığı sürece uç nokta `https://` olmalıdır.** Ajanın API anahtarı her istekte bu URL üzerinden taşınır ve 5dive, makine dışındaki şifrelenmemiş bir uç noktayı reddeder. Özel bir LAN adresi de istisna değildir.
- **Her lisansın kendi model sabitlemesi, profile göre önceliklidir.** Profil `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` değerlerini taşır; ancak standart bir model kimliğine sabitlenmiş bir lisans, ilk turunda _"Seçilen modelle ilgili bir sorun var"_ hatasıyla başarısız olur. Lisansları da sabitlemek için `--agent <name>` seçeneğini (tekrarlanabilir) geçirin; bunu yapmadığınızda tarif komutu yazdırır.

API anahtarı 5dive'a **stdin** üzerinden (`--api-key=-`) verildiği için hiçbir zaman `ps` çıktısında görünmez.

Profili tek bir model yerine bir Pusula **kombosuna** yönlendirmek, filoya sağlayıcı yük devretme özelliğini kazandırır: [#11578](https://github.com/Ferhat-Yasinoglu/pusula/issues/11578) üzerinde kaydedilen çalıştırmada birincil uç nokta turun ortasında tamamen devre dışı kaldığında ajan, kalan adımlarını yedek uç noktada tamamladı ve kesintiyi hiçbir zaman kullanıcıya yansıtmadı.

---

## Temel URL kuralları (hangi araçlar `/v1` ister)

Pusula, OpenAI yüzeyini `/v1` konumunda, Anthropic yüzeyini kök dizinde
ve yerel Gemini yüzeyini `/v1beta` konumunda sunar. Her entegrasyon, aracın
beklediği biçime göre yapılandırılmıştır (komut kaynağında doğrulanmıştır):

| Entegrasyon                                                                | Yazılan temel URL | `/v1`?                                       |
| -------------------------------------------------------------------------- | ----------------- | -------------------------------------------- |
| `setup-cline` (`openAiBaseUrl`)                                            | kök               | Hayır — Cline `/v1/chat/completions` ekler   |
| `setup-goose` (`OPENAI_HOST`)                                              | kök               | Hayır — Goose yolu ekler                     |
| `setup-aider` (`OPENAI_API_BASE`)                                          | kök               | Hayır — LiteLLM `/v1/chat/completions` ekler |
| `setup-kilo`, `setup-roo`, `setup-continue`, `setup-crush`, `setup-cursor` | `/v1` ile         | Evet                                         |
| `setup-zed` (`language_models.openai_compatible.pusula.api_url`)           | `/v1` ile         | Evet                                         |
| `setup-claude` (`ANTHROPIC_BASE_URL`), `launch`                            | kök               | Hayır — Claude Code `/v1/messages` ekler     |
| `setup-codex`, `launch-codex` (`model_providers.pusula.base_url`)          | `/v1` ile         | Evet                                         |
| `setup-qwen` (`modelProviders.openai[].baseUrl`)                           | `/v1` ile         | Evet                                         |
| `run gemini` (`GOOGLE_GEMINI_BASE_URL`)                                    | kök               | Hayır — SDK `/v1beta/models/…` ekler         |
| `setup-5dive` (kimlik doğrulama profilindeki `ANTHROPIC_BASE_URL`)         | kök               | Hayır — Claude Code `/v1/messages` ekler     |

---

## Güncelleme sırasında yerel bağımlılıkları koruma: `--include=optional`

`pusula update` ile güncelleme yaptığınızda (onayladıktan sonra veya `--apply`
ile), Pusula kurulumu yerleşik olarak `--include=optional` seçeneğiyle çalıştırır:

```bash
npm install -g pusula@latest --include=optional
```

Bu, `pusula update` komutuna ilettiğiniz bir seçenek **değildir** — güncelleyici
tarafından her zaman uygulanır. npm yapılandırmanızda `omit=optional` ayarlanmış
olsa bile `optionalDependencies` bağımlılıklarının (`better-sqlite3`, `keytar`,
`tls-client`, LLMLingua SLM yığını) güncelleme sonrasında korunmasını garanti eder;
aksi takdirde yerel SQLite sürücüsü ve işletim sistemi anahtarlığı bağlaması sessizce
kaldırılırdı. Uygulamadan tam komutu önizlemek için:

```bash
pusula update --dry-run
# [KURU ÇALIŞTIRMA] Çalıştırılacak komut: npm install -g pusula@latest --include=optional
```

Diğer `pusula update` seçenekleri (kaynakta doğrulanmıştır): `--check` (güncel
değilse 1 koduyla çık), `--apply` (sormadan kur), `--changelog`, `--no-backup`,
`--yes`.

---

## `pusula run gemini` aracılığıyla Google Gemini CLI

Sözleşme `@google/gemini-cli` 0.50.0 ile doğrulanmıştır: CLI,
`GOOGLE_GEMINI_BASE_URL` değişkenini dikkate alır ve buna karşı
`POST /v1beta/models/<model>:generateContent` (ve
`:streamGenerateContent?alt=sse`) isteklerini gönderir — bu, Pusula'un yerel
Gemini yüzeyiyle (`/v1beta`) tam olarak eşleşir. `pusula run gemini` bunu
otomatik olarak yapılandırır:

- `GOOGLE_GEMINI_BASE_URL` → etkin Pusula temel URL'si (kök, `/v1` olmadan);
- `GEMINI_API_KEY` → çözümlenen Pusula kimlik bilgisi (seçenek/ortam/bağlam);
- `.gemini/settings.json` dosyası `gemini-api-key` kimlik doğrulamasını seçen
  **geçici ve yalıtılmış bir `GEMINI_CLI_HOME`**; böylece saklanan bir Google OAuth
  oturumu (Code Assist), Pusula'a yönlendirilen başlatmayı hiçbir zaman geçersiz
  kılmaz — çıkıştan sonra kaldırılır;
- **ortam hijyeni**: alt işlemin ortamından `GOOGLE_API_KEY`,
  `GOOGLE_GENAI_USE_VERTEXAI` ve `GOOGLE_GENAI_USE_GCA` kaldırılır (bunlar kimlik
  doğrulamayı Vertex/Code Assist'e yönlendirirdi) ve ek güvence olarak
  `GEMINI_DEFAULT_AUTH_TYPE=gemini-api-key` ayarlanır — diğer `run` hedefleri de
  kendi çakışan değişkenleri için aynı işleme tabi tutulur;
- `--provider`/`--model` üzerinden `--model <id>` ekleme.

```bash
pusula run gemini --model glm/glm-5.2 -- --skip-trust -p "hello"
```

Gemini'nin çalışma alanı güven koruması başsız modda da geçerlidir — `--skip-trust`
seçeneğini kendiniz iletin (veya dizine etkileşimli olarak güvenin); başlatıcı bunu
bilerek atlamaz. Bu başlatıcı, `/dashboard/acp-agents` için aracı protokolü
entegrasyonu olarak kalmaya devam eden **ACP kaydından**
(`src/lib/acp/registry.ts`, `gemini --acp`) farklıdır.

---

## Gerçek smoke taraması (isteğe bağlı)

Deterministik başlatma planı regresyon testleri CI'da (`tests/unit/cli/run-command.test.ts`,
`tests/unit/cli/run-execution.test.ts`) çalışır. GERÇEK çalıştırılabilir dosyaları GERÇEK bir
Pusula sunucusuna karşı doğrulamak için
`tests/integration/upstream-cli-smoke.int.test.ts` konumunda isteğe bağlı bir test düzeneği bulunur. Bu düzenek hiçbir zaman otomatik olarak çalışmaz
(`RUN_CLI_SMOKE=1` ayarlanmadıkça her alt test atlanır), kimlik bilgisini DEĞER olarak değil, ortam değişkeni ADI olarak iletir, kaydedilen tüm çıktılardaki anahtar biçimli dizeleri maskeler, çalıştırılabilir dosyası yüklü olmayan hedefleri atlar ve hataları yalnızca bir mantıksal değer yerine
kimlik doğrulama / upstream / yapılandırma olarak sınıflandırır:

```bash
RUN_CLI_SMOKE=1 \
PUSULA_SMOKE_BASE_URL="http://localhost:20128" \
PUSULA_SMOKE_MODEL="<provider/model>" \
PUSULA_SMOKE_API_KEY_ENV="PUSULA_API_KEY" \
node --import tsx/esm --test tests/integration/upstream-cli-smoke.int.test.ts
```

İsteğe bağlı: `PUSULA_SMOKE_TARGETS="codex,opencode,qwen"` taramayı belirtilen hedeflerle sınırlar;
`PUSULA_SMOKE_TIMEOUT_MS`, hedef başına 120 saniyelik zaman aşımını geçersiz kılar.

---

## Ayrıca bkz.

- [Claude Code yapılandırması](./CLAUDE-CODE-CONFIGURATION.md) — ayrıntılı Claude Code kılavuzu
- [Codex CLI yapılandırması](./CODEX-CLI-CONFIGURATION.md) — tek seferlik `[model_providers.pusula]` temel kurulumu
- [Uzak Mod](./REMOTE-MODE.md) — bağlamlar, kapsamlı erişim token'ları ve uzak bir sunucunun yönetilmesi
- [CLI Araçları referansı](../reference/CLI-TOOLS.md) — desteklenen araçların ve pano sayfalarının eksiksiz kataloğu
- [Kurulum Kılavuzu](./SETUP_GUIDE.md) — yükleme yöntemleri ve ilk çalıştırma süreci
