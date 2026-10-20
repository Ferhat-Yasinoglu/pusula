# Remote Mode (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/REMOTE-MODE.md) · 🇩🇪 [de](../../../de/docs/guides/REMOTE-MODE.md) · 🇮🇷 [fa](../../../fa/docs/guides/REMOTE-MODE.md)

---

Pusula'un kendisi başka bir yerde (bir VPS, ev sunucusu veya Tailnet'inizdeki başka bir makine) çalışırken `pusula` CLI'ını dizüstü bilgisayarınızda çalıştırın.
`pusula connect` ile bir kez oturum açarsınız ve bundan sonra **her** CLI komutu
o uzak sunucuyu hedefler — aynı komutlar, aynı çıktı; yalnızca uzak sunucu üzerinde yürütülür.

Kurulacak ikinci bir araç yoktur: uzak mod, standart `pusula` CLI'ı ile
kapsamlandırılmış **erişim token'larını** kullanır.

```bash
npm install -g pusula                 # standart CLI
pusula connect 192.168.0.15           # oturum açın (parola → kapsamlandırılmış token)
pusula models list                    # ← artık UZAK sunucunun modellerini listeler
pusula configure codex                # ← uzak katalogdan yerel bir Codex profili yazar
```

---

## Nasıl çalışır?

```
dizüstü bilgisayarınız                   uzak Pusula (VPS)
┌────────────────────┐                   ┌───────────────────────────────┐
│ pusula CLI      │  POST /api/cli/connect  (parola → token)           │
│  bağlam: vps       │ ───────────────►  │ kapsamlandırılmış erişim       │
│  baseUrl, token    │  Authorization: Bearer oma_live_…                  │
│                    │ ───────────────►  │ token'ı oluşturur; her yönetim │
│ yapılandırmaları   │ ◄───────────────  │ rotası token kapsamına göre    │
│ YERELDE yazar      │                   │ denetlenir                     │
└────────────────────┘                   └───────────────────────────────┘
```

- **Bağlamlar**, her biri bir sunucuyu saklar (`~/.pusula/config.json`, `chmod 600`).
  `pusula contexts use <name>` etkin sunucuyu değiştirir; `default` yereldir.
- **Erişim token'ları** (`oma_live_…`) yönetim komutlarını yetkilendirir. Bunlar,
  çıkarım API anahtarlarından (`sk-…`, `/v1/chat/completions` için kullanılır) farklıdır.
- Bir token'ın yalnızca SHA-256 özeti sunucu tarafında saklanır. Düz metin değer
  oluşturma sırasında **bir kez** gösterilir.

---

## Bağlanma

### Yönetim parolasıyla (ilk kurulum)

```bash
pusula connect 192.168.0.15
# http://192.168.0.15:20128 için yönetim parolası: ********
# ✔ http://192.168.0.15:20128 adresine bağlanıldı — bağlam '192.168.0.15' (kapsam: admin)
```

Parola akışı varsayılan olarak bir **admin** token'ı oluşturur (parola sizde olduğundan
zaten tam denetime sahipsiniz). Kapsamı `--scope` ile daraltın:

```bash
pusula connect 192.168.0.15 --scope write
```

Seçenekler: `--port <p>` (ana bilgisayarda port belirtilmediğinde), `--name <ctx>` (bağlam adı),
`--scope read|write|admin`. Tam URL olduğu gibi kullanılır:
`pusula connect https://omni.example.com`.

### Önceden oluşturulmuş bir token ile

Kontrol panelinde (veya `pusula tokens create` ile) kapsamlandırılmış bir token oluşturup
yapıştırın — parola gerekmez:

```bash
pusula connect 192.168.0.15 --key oma_live_xxxxxxxx
```

CLI, token'ı `GET /api/cli/whoami` aracılığıyla doğrular ve etkin bağlam olarak kaydeder.

---

## Kapsamlar

Hiyerarşik üç seviye (`admin ⊃ write ⊃ read`):

| Kapsam  | Yapabilecekleri                                                                            |
| ------- | ------------------------------------------------------------------------------------------ |
| `read`  | listeleme/inceleme — `models list`, `providers status`, `logs`, `usage`, `cost`            |
| `write` | read **+** yapılandırma/uygulama — `setup-codex`, `keys add`, `config set`, kombinasyonlar |
| `admin` | write **+** yönetim — `tokens` CRUD, sağlayıcı ekleme, servisler, politika, oauth          |

Sunucu, her rotanın gerektirdiği kapsamı HTTP yönteminden
(`GET`→read, değişiklikler→write) ve hassas yüzeylere yönelik bir admin izin listesinden
(`/api/cli/tokens`, `/api/providers` değişiklikleri, `/api/oauth`, `/api/services`, …)
çıkarır. Kapsamı yetersiz bir token, açık bir mesajla birlikte `403` alır.

> İşlem başlatan rotalar (`/api/services/*`, `/api/mcp/*`, …)
> **yalnızca loopback** erişimine açık kalır — uzak bir token, kapsamı ne olursa olsun bunlara asla erişemez.

---

## Uzak bir kurulumda Antigravity'yi bağlama

Antigravity, Google'ın birinci taraf/yerel uygulama izin ekranını kullanır. Google,
yetkilendirme kodunu yalnızca **geri döngü yönlendirmesine**
(`http://127.0.0.1:<port>/callback`) **oturum açmayı onaylayan tarayıcıdan
erişilebildiğinde** sağlar. Uzak bir VPS kurulumunda bu geri döngü sizin
makinenizde değil sunucuda bulunur; dolayısıyla izin ekranı **sonsuza kadar takılır
ve hiçbir zaman kod üretmez** — normal "geri çağırma URL'sini yapıştırın" yedeğinde
yapıştırılacak hiçbir şey olmaz. (Bu, Google taraflı bir kısıtlamadır: aynı takılma,
yalnızca Pusula'ta değil, paketlenmiş Antigravity masaüstü istemcisini kullanan
tüm proxy'lerde gerçekleşir.)

Pano, takılıp kalmanızdan önce bunu algılar: localhost dışındaki bir adresten
**Providers → Antigravity → Connect** seçeneğini açtığınızda genel "geri çağırma
URL'sini kopyalayın" bildiriminin yerine aşağıdaki iki çözüm gösterilir ve her
birinde ana makineniz ile bağlantı noktanız önceden doldurulmuş olur. (LAN adresleri
de buna dahildir — bu geri çağırma açısından `192.168.x.x`, localhost değildir.)

Antigravity'yi uzak bir Pusula'a bağlamanın desteklenen iki yolu vardır.

### Seçenek A — yerel oturum açma yardımcısı (önerilen)

OAuth işlemini, `127.0.0.1` adresine erişilebilen **kendi bilgisayarınızda**
çalıştırın. Yardımcı doğrudan Google ile iletişim kurduğundan izin işlemi, panodaki
sürümün tamamlayamadığı yerde tamamlanır.

**Zaten bağlıysanız** (`pusula connect <host>`), kopyalamanız gereken hiçbir şey
yoktur — yardımcı, kimlik bilgisini sizin için ilgili kuruluma iletir:

```bash
# YEREL makinenizde (Node.js + bir tarayıcı gerektirir):
pusula connect 192.168.0.15        # bir kez — yönetici kapsamlı bir bağlam belirteci üretir
npx pusula login antigravity
#   ↳ Google izin ekranını açar, geri çağırmayı yerel bir geri döngü bağlantı noktasında yakalar,
#     takasını gerçekleştirir ve kimlik bilgisini etkin bağlama POST eder:
#
#   Antigravity, http://192.168.0.15:20128 üzerinde bağlandı (bağlantı abc123).
#   Yapıştırılacak hiçbir şey yok — bu terminali kapatabilirsiniz.
```

Etkin bağlam başka bir makineyi gösterdiğinde gönderim otomatik olarak gerçekleşir.
Her iki yöndeki davranışı `--push` / `--no-push` ile zorlayabilir veya
`--context <name>` ile belirli bir bağlamı hedefleyebilirsiniz.

**Makineniz VPS'ye erişemiyorsa** (güvenlik duvarı nedeniyle, SSH yoksa veya
çalışma masanız ağdan yalıtılmışsa) yardımcı yine de çalışır — yalnızca Google'a
_ihtiyaç duyar_. `--no-push` kullanın veya gönderimin başarısız olmasına izin verin:
daha önce tamamladığınız bir yetkilendirmeyi atmak yerine blob'u yazdırmaya geri
döner.

```bash
npx pusula login antigravity --no-push
#   pusula-cred-v1.eyJ2IjoxLCJ...
```

Ardından **uzak** panoda **Providers → Antigravity → Connect** bölümüne gidin ve
`pusula-cred-v1.…` blob'unu **Step 2** alanına yapıştırın (geri çağırma URL'si
veya kimlik bilgisi blob'u kabul eder). Pusula bunun kodunu çözer, Cloud Code
ilk katılım işlemini sunucu tarafında çalıştırır ve bağlantıyı kalıcı olarak
kaydeder.

> Blob bir yenileme belirteci içerir — ona parola gibi davranın. Gönderim yolunda,
> bağlamınızın kimliği doğrulanmış bağlantısı üzerinden bir kez gönderilir;
> yapıştırma yolunda ise pano bağlantınız üzerinden gönderilir. Her iki durumda da
> depolama sırasında şifrelenir ve başarılı bir gönderimde terminalinize hiçbir
> zaman yazdırılmaz.

Bayraklar: `--no-browser` (otomatik olarak açmak yerine URL'yi yazdırır),
`--port <n>` (geri döngü bağlantı noktasını sabitler), `--timeout <ms>`,
`--push` / `--no-push` (otomatik iletimi geçersiz kılar), `--context <name>`
(belirli bir bağlamı hedefler).

### Seçenek B — SSH yerel yönlendirme tüneli

VPS'ye SSH erişiminiz varsa geri döngü geri çağırmasının tünel üzerinden tekrar
sunucuya ulaşması için pano bağlantı noktasını yönlendirin:

```bash
# YEREL makinenizde:
ssh -L 20128:127.0.0.1:20128 user@your-vps
# ardından YEREL tarayıcınızda http://localhost:20128 adresini açın ve Antigravity'yi
# normal şekilde bağlayın — 127.0.0.1:20128/callback yönlendirmesi artık VPS'ye SSH üzerinden ulaşır.
```

Panoya `localhost:20128` üzerinden ulaştığınız için Google izin işlemi tamamlanır
ve geri çağırma aynı tünel üzerinden sunucuya iletilir — blob gerekmez. Bağlantı
etkin görünene kadar tüneli açık tutun.

Aşağıdaki sabit geri döngülü sağlayıcıların aksine burada **tek bir yönlendirme
yeterlidir**: Antigravity geri çağırması doğrudan pano bağlantı noktasını
kullandığından tünellenecek, sağlayıcıya özgü ikinci bir bağlantı noktası yoktur.

> Tamamen başsız bir alternatif olarak (yardımcı ve tünel olmadan) **kendi**
> Google OAuth web kimlik bilgilerinizi ve genel bir temel URL'yi
> yapılandırabilirsiniz; sağlayıcının OAuth ortam değişkenlerine bakın. Yukarıdaki
> iki seçenek için ek bir Google kurulumu gerekmez.

---

## Uzak bir kurulumda Codex / Grok bağlantısı kurma (sabit geri döngü sağlayıcıları)

Codex, xAI (`xai-oauth`) ve Grok CLI (`grok-cli`), üst OAuth uygulamalarında **sabit** bir geri döngü
`redirect_uri` kaydeder. Pusula bunu değiştiremez — sağlayıcı, tarayıcıyı her zaman
aynı sabit kodlanmış adrese geri gönderir:

| Sağlayıcı   | Sağlayıcının yönlendirdiği sabit geri çağırma adresi |
| ----------- | ---------------------------------------------------- |
| `codex`     | `http://localhost:1455/auth/callback`                |
| `xai-oauth` | `http://127.0.0.1:56121/callback`                    |
| `grok-cli`  | `http://127.0.0.1:56122/callback`                    |

Buradaki `localhost`, **tarayıcının çalıştığı makine** anlamına gelirken Pusula'un PKCE
geri çağırma sunucusu **sunucunun** geri döngü arayüzünde dinler. Panoyu
`http://192.168.0.15:20128` gibi bir LAN adresinden açtığınızda ikisi asla buluşmaz: yetkilendirme
kodu kendi dizüstü bilgisayarınızın `localhost:1455` adresine teslim edilir; burada hiçbir şey dinlemediği
için sağlayıcı, herhangi bir hata göstermeden oturum açma işlemini başarısız kılar.

Pano, açılır pencereyi açmadan önce bunu algılar ve oturum açma işleminin sessizce başarısız olmasına
izin vermek yerine tünel komutunu gösterir (#8046).

### Çözüm — **her iki** portu da yönlendirin

```bash
# TARAYICININ çalıştığı makinede:
ssh -L 20128:127.0.0.1:20128 -L 1455:127.0.0.1:1455 <user>@192.168.0.15
# ardından http://localhost:20128 adresine gidin ve Codex'i buradan bağlayın
```

İki yönlendirme gereklidir ve yalnızca birini yönlendirmek yine başarısız olur:

- **`20128`** (pano portu), kaynağı gerçekten localhost yapar; Pusula'un PKCE
  geri çağırma sunucusunu başlatmasını sağlayan budur — bir LAN kaynağı bu
  dala hiçbir zaman ulaşmaz.
- **`1455`** (sağlayıcının sabit geri çağırma portu), tarayıcının geri gönderildiği
  yerdir; buradan sunucunun geri döngü arayüzüne tünellenmesi gerekir.

xAI veya Grok CLI bağlarken `1455` yerine `56121`/`56122`, `20128` yerine de
gerçek pano portunuzu kullanın. Bağlantı etkin olarak görünene kadar tüneli açık
tutun.

> **SSH erişiminiz yok mu?** Codex ve Grok CLI, yapıştırılan bir belirteci de kabul eder — bağlantı iletişim
> kutusundaki **API Anahtarını Yapıştır** / **auth.json İçe Aktar** sekmesi. Bu yolda geri döngü
> geri çağırması bulunmadığından herhangi bir kaynaktan çalışır. Codex ayrıca yalın bir erişim
> belirtecini veya `~/.codex/auth.json` oturum verisini de kabul eder.

---

## Belirteçleri yönetme

```bash
pusula tokens create --name "laptop" --scope write [--expires 30]
#   ↳ gizli değeri YALNIZCA BİR KEZ yazdırır — şimdi kopyalayın
pusula tokens list                 # maskelenmiş: kimlik, ad, kapsam, ön ek, durum, süre sonu
pusula tokens revoke <id|prefix>   # hemen iptal et
pusula tokens scopes               # üç kapsamı açıkla
```

`tokens` komutları bir **admin** kimlik bilgisi gerektirir. Belirteçleri
panoda **Ayarlar → Erişim Belirteçleri** altında da yönetebilirsiniz (oluşturma, iptal etme, tek seferlik kopyalama).

---

## Uzak katalogdan bir kodlama CLI'ını yapılandırma

`pusula configure`, **etkin sunucunun** canlı model kataloğunu okur ve
**sizin** makinenize bir yapılandırma yazar.

```bash
pusula configure codex
#   Sağlayıcılar: glm, kmc, ollamacloud, opencode-go, …
#   Sağlayıcı: glm
#   Model kimliği: glm/glm-5.2
#   ✔ ~/.codex/glm52.config.toml yazıldı
#   Kullanım:  codex --profile glm52

# etkileşimsiz
pusula configure codex --provider glm --model glm/glm-5.2 --name glm52

# sık kullanılan bir modeli etkileşimli seçicinin en üstünde tut
pusula configure codex --provider glm --model glm/glm-5.2 --favorite --yes
```

Seçici, yerel `model-preferences.json` dosyasında yalnızca model kimliklerini
(URL'leri veya kimlik bilgilerini asla değil), bağlama ve CLI hedefine göre kapsamlandırılmış şekilde tutar. Favoriler,
son seçimlerden önce gösterilir; seçilen bir modeli ilgili bağlam/hedef listesinden
kaldırmak için `--unfavorite` kullanın.

Yazılan profil, çıkarım anahtarına env var
(`PUSULA_API_KEY`) aracılığıyla başvurur — gizli değer hiçbir zaman diske yazılmaz. Tek seferlik
temel Codex kurulumu (`[model_providers.pusula]` bloğu) için
[CODEX-CLI-CONFIGURATION.md](./CODEX-CLI-CONFIGURATION.md) belgesine bakın.

### Uzak sunucuya karşı bir CLI başlatma (yapılandırma yazılmaz)

`pusula run <target>` da etkin bağlamı dikkate alır: uzak temel URL
ve bağlam kimlik bilgisi yalnızca başlatılan sürece eklenir.

```bash
pusula connect 192.168.0.15
pusula run claude   --model openai/gpt-5.4          # Claude Code → uzak sunucu
pusula run gemini   --model glm/glm-5.2 -- --skip-trust -p "hello"
pusula run opencode --model glm/glm-5.2 -- run "reply OK"

# Tam olarak neyin başlatılacağını önizleyin (yalnızca env ANAHTAR ADLARI, değerler asla gösterilmez):
pusula run codex --dry-run --json
```

Hedefler: `claude`, `codex`, `aider`, `goose`, `opencode`, `qwen`, `gemini`
(tek kaynak: `bin/cli/cli-manifest.mjs`). Qwen ve Gemini, çıkışta kaldırılan
geçici ve yalıtılmış bir ana dizinle çalışır; böylece başlatma işlemi kişisel araç
yapılandırmanıza hiçbir zaman dokunmaz veya ona veri sızdırmaz.

### CLI'a özgü kurulum komutları

Desteklenen her CLI'ın uzak sunucuyu destekleyen bir kurulum komutu vardır (tümü etkin
bağlamı veya `--remote <url> --api-key <key>` seçeneklerini dikkate alır):

| CLI         | Komut                      | Yazdığı yer/içerik                                                                                                                                                                                            |
| ----------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Codex       | `pusula setup-codex`    | `~/.codex/<name>.config.toml` profilleri (model başına)                                                                                                                                                       |
| Claude Code | `pusula setup-claude`   | `~/.claude/profiles/<name>/settings.json` (model başına)                                                                                                                                                      |
| OpenCode    | `pusula setup-opencode` | Her katalog modelini içeren, openai uyumlu `pusula` sağlayıcısı için `~/.config/opencode/opencode.json` (`opencode -m pusula/<model>` komutunu çalıştırın)                                              |
| Cline       | `pusula setup-cline`    | `~/.cline/data/{globalState,secrets}.json` (CLI modu) + yapıştırılacak VS Code uzantısı ayarlarını yazdırır (OpenAI uyumlu, `/v1` **olmadan** Temel URL)                                                      |
| Kilo Code   | `pusula setup-kilo`     | `~/.local/share/kilo/auth.json` (CLI) + VS Code `kilocode.*` ayarları — OpenAI uyumlu, `/v1` **içeren** Temel URL                                                                                             |
| Continue    | `pusula setup-continue` | `~/.continue/config.yaml` (VS Code/JetBrains + `cn` CLI) — `provider: openai`, `/v1` **içeren** `apiBase`, `${{ secrets.PUSULA_API_KEY }}` üzerinden anahtar                                               |
| Cursor      | `pusula setup-cursor`   | Uygulama içi adımları yazdırır (Ayarlar → Modeller → `/v1` **içeren** OpenAI Temel URL'sini Geçersiz Kıl + anahtar + model). Cursor yapılandırması opak SQLite'tır — yalnızca sohbet paneli                   |
| Roo Code    | `pusula setup-roo`      | Bir Roo içe aktarma JSON'u (`~/.pusula/roo-settings.json`) yazar + `roo-cline.autoImportSettingsPath` ayarını belirler + kullanıcı arayüzü adımlarını yazdırır (OpenAI uyumlu, `/v1` **içeren** Temel URL) |
| Crush       | `pusula setup-crush`    | `~/.config/crush/crush.json` — `openai-compat` sağlayıcısı, `/v1` **içeren** `base_url`, `$PUSULA_API_KEY` üzerinden anahtar                                                                               |
| Goose       | `pusula setup-goose`    | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER=openai` + `/v1` **olmadan** `OPENAI_HOST` + `GOOSE_MODEL`) + ortam değişkeni tarifi                                                                            |
| Aider       | `pusula setup-aider`    | `~/.aider.conf.yml` (`/v1` **olmadan** `openai-api-base` + `model: openai/<id>`) + ortam değişkeni tarifi (`aider --message --yes`)                                                                           |
| Qwen Code   | `pusula setup-qwen`     | `~/.qwen/settings.json` V4 `modelProviders.openai` girdisi + `~/.qwen/.env` içinde `PUSULA_API_KEY`                                                                                                        |

```bash
# OpenCode (openai uyumlu sağlayıcı, tüm katalog modelleri, uzak VPS)
pusula setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx
pusula setup-opencode --only glm,kimi        # yalnızca eşleşen modelleri tut
opencode -m pusula/glm/glm-5.2 "..."          # önce PUSULA_API_KEY değişkenini dışa aktarın
```

> OpenCode ayrıca daha zengin bir **eklenti** entegrasyonuna sahiptir: `pusula setup opencode`
> (artık `--remote` aracılığıyla uzak bağlantıları destekler) `@pusula/opencode-plugin` paketini yükler.
> `setup-opencode`, hafif openai uyumlu alternatiftir. API anahtarına
> `{env:PUSULA_API_KEY}` aracılığıyla başvurulur — hiçbir zaman diske yazılmaz.
>
> OpenCode v2'de bunun yerine `@pusula/opencode-plugin-v2` kullanın: aynı katalog,
> farklı yükleyici sözleşmesi. Entegrasyon bağlandığında anahtarı OpenCode'un kendi kimlik bilgisi
> deposundan okur; dolayısıyla uzak ağ geçidi için `opencode.json` dosyasında hiçbir anahtar gerekmez.

---

## Bağlamları Yönetme (sunucular arasında geçiş yapma)

Bir **bağlam**, kaydedilmiş bir sunucudur (baseUrl + kimlik bilgisi + kapsam). `pusula connect` bir bağlam oluşturur ve onu etkin hale getirir; bundan sonra her komut bu bağlamı hedefler. `pusula contexts` ile bunları yönetin ve aralarında geçiş yapın:

```bash
pusula contexts list            # tüm bağlamlar; etkin olan ● ile işaretlenmiştir
pusula contexts current         # etkin sunucu, kimlik doğrulama durumu, kapsam
```

```text
  | Name    | Base URL                  | Auth  | Scope | Description
● | vps     | http://100.67.86.91:20128 | token | admin | Remote Pusula (…)
  | default | http://localhost:20128    | ✗     |       |
```

**Sunucular arasında geçiş yapın** — sonraki her komut etkin bağlamı takip eder:

```bash
pusula contexts use vps         # → tüm komutlar artık uzak VPS'e ulaşır
pusula tokens list              #   (VPS'e karşı çalışır)

pusula contexts use default     # → localhost'a geri dön
pusula tokens list              #   (yerel sunucuya karşı çalışır)
```

**Manuel olarak bir bağlam ekleyin** (`connect` yerine), inceleyin veya yeniden adlandırın:

```bash
pusula contexts add staging --url https://staging.example.com:20128 \
  --access-token oma_live_xxxx --scope write --description "staging box"
pusula contexts show staging    # bir bağlam için tüm detaylar
pusula contexts rename staging stg
```

**Bir bağlamı kaldırın** — onay ister; bunu atlamak için `--yes` parametresini kullanın (aksi takdirde güvenli bir şekilde reddeden betikler / etkileşimli olmayan kabuklar için gereklidir):

```bash
pusula contexts remove stg --yes
```

> `default` (localhost) kaldırılamaz. Etkin bağlamı kaldırmak `default` bağlamına geri döner. İpucu: bir bağlamı kaldırmak yalnızca **yerel** olarak kaydedilmiş kimlik bilgisini düşürür — erişimi tamamen sonlandırmak için sunucudaki belirteci `pusula tokens revoke <id>` ile iptal edin.

**Bağlamları dışa aktarın / içe aktarın** (örn. makineler arasında taşımak için). Dışa aktarımlar, dosya yedeklemesiyle depolanan kimlik bilgileri de dahil olmak üzere, varsayılan olarak kimlik bilgilerini atlar. Taşınabilir, kimlik bilgisi içeren bir yedeklemeye ihtiyaç duyulduğunda `--include-secrets` parametresini açıkça kullanın:

```bash
pusula contexts export --out contexts.json     # gizlenmiş; varsayılan hedef: stdout
pusula contexts export --include-secrets --out private-contexts.json
pusula contexts import contexts.json            # üzerine yaz; mevcut olanları korumak için --merge
pusula contexts migrate --yes                  # eski düz metin belirteçlerini anahtarlığa taşı
```

`--include-secrets`, dışa aktarmadan önce anahtarlık referanslarını çözer ve başvurulan herhangi bir kimlik bilgisi okunamıyorsa başarısız olur. `--no-secrets` her zaman önceliklidir. Dışa aktarma dosyaları `0600` moduyla atomik olarak yazılır. Açıkça sır içeren bir dışa aktarımı gizli materyal olarak ele alın. Kullanılabilir bir işletim sistemi anahtarlığı olmayan başsız sistemlerde, CLI `config.json` dosyasına `0600` moduyla geri döner ve bir kerelik bir uyarı yazdırır; bu modda varsayılan bir dışa aktarım gizli kalır.

---

## Hızlı uçtan uca kontrol

Uzak bir kurulumu sıfırdan doğrulamak için kopyalayıp yapıştırabileceğiniz bir yaşam döngüsü:
bağlanın, kapsamlı bir token oluşturun, bir komutu yönlendirin, geri dönün ve kurulumu kaldırın.
`192.168.0.15` değerini sunucunuzun ana makine adı/IP adresiyle (Tailscale, LAN veya herkese
açık bir `https://…` URL'si) değiştirin.

```bash
# 1. Bağlan (parola → admin token'ı; etkin hâle gelen bir bağlam olarak kaydedilir)
pusula connect 192.168.0.15                 # veya: --key oma_live_xxxx  (parola yok)
pusula contexts current                     # uzak sunucuyu ve kapsamı gösterir

# 2. Kullan — yönetim komutları artık uzak sunucuya karşı çalışır
pusula tokens create --name laptop --scope read   # daha dar kapsamlı bir token oluştur
pusula tokens list                                 # uzak sunucudan maskelenmiş liste

# 3. İleri ve geri geçiş yap
pusula contexts use default                 # → yerel
pusula contexts use 192-168-0-15            # → yeniden uzak (`contexts list` içindeki ad)

# 4. Kurulumu kaldır. NOT: `contexts remove` yalnızca YEREL kimlik bilgisini siler —
#    sunucudaki token'ı iptal ETMEZ. Erişimi gerçekten sonlandırmak istiyorsanız
#    önce sunucu tarafında iptal edin.
pusula tokens revoke <id|prefix>            # sunucudaki erişimi sonlandırır
pusula contexts remove 192-168-0-15 --yes   # yerel bağlamı siler (etkin olsa bile → default'a geri döner), onay istemez
```

> `--yes`, `contexts remove` komutunu etkileşimsiz hâle getirir (betiklerde/CI'da
> gereklidir; bu seçenek olmadan etkileşimsiz bir kabuk, takılı kalmak yerine güvenli
> biçimde reddeder). **Etkin** bağlam kaldırıldığında otomatik olarak `default`
> bağlamına geri dönülür.

---

## Güvenlik notları

- Token'ın düz metin hâli yalnızca bir kez gösterilir; sadece SHA-256 özeti kalıcı olarak saklanır (API anahtarlarıyla aynı şekilde).
- `pusula connect`, oturum açma kaba kuvvet saldırılarına karşı kilitleme ve denetim günlüğü mekanizmalarını yeniden kullanır.
- Aktarım için tercihen HTTPS veya bir Tailnet kullanın; yalnızca ana makine belirtilirse LAN/Tailscale kolaylığı için varsayılan olarak `http://` kullanılır — TLS için tam bir `https://…` URL'si sağlayın.
- Tercih edilen yerel bağlam dosyası, yalnızca bir `credentialRef` içeren `~/.pusula/config.json` (`chmod 600`) dosyasıdır; token'ın kendisi işletim sistemi anahtar zincirinde (`keytar`) saklanır ve günlüklere hiçbir zaman yazdırılmaz. Çalışan bir yerel anahtar zinciri bulunmayan başsız kurulumlar, açık bir geri dönüş mekanizması olarak aynı `0600` dosyasını kullanır ve bir kez uyarı verir. Bir anahtar zinciri arka ucu kurduktan sonra `pusula contexts migrate --yes` komutunu kullanın.

---

## API uç noktaları (referans)

| Yöntem | Rota                  | Kimlik doğrulama | Kapsam                            |
| ------ | --------------------- | ---------------- | --------------------------------- |
| POST   | `/api/cli/connect`    | yönetim parolası | — (herkese açık, parola korumalı) |
| GET    | `/api/cli/whoami`     | erişim token'ı   | okuma                             |
| GET    | `/api/cli/tokens`     | erişim token'ı   | yönetici                          |
| POST   | `/api/cli/tokens`     | erişim token'ı   | yönetici                          |
| DELETE | `/api/cli/tokens/:id` | erişim token'ı   | yönetici                          |

Tüm şemalar için [openapi.yaml](../openapi.yaml) dosyasına bakın.
