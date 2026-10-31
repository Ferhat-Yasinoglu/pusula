# Release Checklist (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/RELEASE_CHECKLIST.md) · 🇩🇪 [de](../../../de/docs/ops/RELEASE_CHECKLIST.md) · 🇮🇷 [fa](../../../fa/docs/ops/RELEASE_CHECKLIST.md)

---

> **Son güncelleme:** 2026-08-28 — v3.8.51
> Otomasyon için Claude Code becerilerinden yararlanan, sadeleştirilmiş sürüm akışı.
>
> **Sürümler arasında kuyruğu/dalı sorunsuz tutun:** bkz. [RELEASE_GREEN.md](./RELEASE_GREEN.md)
> (`/green-prs` ailesi + `npm run check:release-green` + `/babysit` + gecelik çalışma). Bunu düzenli olarak
> ve özellikle bu kontrol listesinden **önce** çalıştırmak, sürüm PR'ının sorunsuz başlamasını sağlar.

## Kısaca

```bash
# 1. Sürümü yükseltin + CHANGELOG oluşturun (beceri)
/version-bump-cc patch    # veya minor/major

# 2. Kalite kapısını yerel olarak çalıştırın
npm run check              # lint + testler
npm run test:coverage      # tam kapsam kapısı (60/60/60/60)

# 3. Derleyin ve temel işlevleri doğrulayın
npm run build
npm run test:e2e           # isteğe bağlıdır ancak önerilir

# 4. Sürümü oluşturun (beceri)
/generate-release-cc

# 5. Dağıtın (beceri)
/deploy-vps-both-cc        # veya akamai-cc / local-cc

# 6. Sürüm kanıtlarını yakalayın (beceri)
/capture-release-evidences-cc
```

## npm Trusted Publishing (v3.8.51'den beri varsayılan) — istek üzerine aşamalı, yedek seçenek olarak doğrudan

`npm-publish.yml`, varsayılan olarak **npm Trusted Publishing (OIDC)** üzerinden yayımlar:
`stage-npm` işi (GitHub tarafından barındırılan), GitHub'ın id-token'ını o çalıştırmaya özel kısa ömürlü bir npm
kimlik bilgisiyle değiştirir — depo gizli bilgilerinde uzun ömürlü npm token'ı yoktur, 2FA istemi yoktur ve kaynak doğrulama bilgisi eklenir.
2FA'yı atlayan token'lar kullanımdan kaldırıldığı için npm'in artık izin verdiği atlatma yöntemi budur;
WS1.3 garantisini korurken (sızdırılmış bir token tek başına yayımlama yapamaz — çünkü token yoktur)
projenin v3.8.48'e kadar sahip olduğu tamamen otomatik akışı geri getirir.

**Tek seferlik kurulum (sahip):** npmjs.com → `pusula` paketi → Settings → _Trusted
Publisher_ → GitHub: owner `Ferhat-Yasinoglu`, repo `pusula`, workflow `npm-publish.yml`
(environment: none). Bu yapılandırma mevcut olana kadar otomatik adım `ENEEDAUTH` ile başarısız
olur: `publish_mode=staged` (aşağıda) veya `direct` ile yeniden tetikleyin.

### Aşamalı yayımlama (istek üzerine — `publish_mode=staged`)

npm-publish iş akışı artık doğrudan yayımlama yapmaz: paketlenmiş tarball'ı başlatır
(`check:pack-boot`) ve ardından `npm stage publish` komutunu çalıştırır — birebir aynı baytlar kayıt
defterinde bekletilir ve sahip onaylayana kadar **yüklenemez**. İnsan tarafından gerçekleştirilen 2FA kapısı
kanıttan önce değil, SONRASINA taşınmıştır.

**İş akışı sorunsuz tamamlandıktan sonra sahip akışı:**

1. `npm stage list pusula` — aşama kimliğini bulun (iş akışı özetinde de yazdırılır).
2. Aşamaya alınmış baytları doğrulayın (önerilir): `npm stage download <id>`, ardından indirilen
   tarball'ı geçici bir öneke yükleyip başlatın (`npm run check:pack-boot`, CI'da aynı
   paketle→yükle→başlat kararını otomatikleştirir).
3. `npm stage approve <id>` — 2FA istemi yayım işleminin KENDİSİDİR. `npm stage reject <id>` işlemi iptal eder.
4. Yayım sonrası güvenlik ağı: yayım sonrası doğrulayıcı (v3.8.49 planının WS1.4'ü), yayımlanan
   sürümü herkese açık kayıt defterinden temiz bir konteynere yükler ve başlatır.

**Acil durum yedek seçeneği:** `publish_mode=direct` ile `workflow_dispatch`, eski
anında `npm publish` davranışını geri getirir (yalnızca aşamaya alma işleminin kendisi hatalı çalışırsa kullanın; nedenini kaydedin).

**Tek seferlik sağlamlaştırma (sahip, npmjs.com):** `pusula` için Trusted Publisher'ı
yalnızca aşamaya alma modunda yapılandırın; böylece sızdırılmış uzun ömürlü bir token hiçbir yerden
doğrudan `npm publish` çalıştıramaz — CI yalnızca aşamaya alabilir; yalnızca sahibin 2FA'sı yayımlamayı gerçekleştirir.

**Bozuk yapıt prosedürü (değişmedi):** varsayılan ilk tepki olarak
`npm deprecate pusula@<bad> "<reason> — use <fixed>"` kullanın (dakikalar içinde uygulanır, geri alınabilir);
`npm unpublish` yalnızca 72 saatlik/bağımlısı olmayan paketler penceresinde ve asla ilk hamle olarak kullanılmamalıdır.
Docker: bir sürüm etiketini asla yeniden yazmayın — geri alma, `latest` etiketini son sağlam özete yeniden yönlendirmektir.

**GHCR `latest` (her kararlı SemVer yayımında zorunludur):**
`docker-publish` iş akışı **hem** `X.Y.Z` etiketini **hem de**
`should-promote-latest.sh` bunun en yüksek kararlı SemVer olduğunu doğruladığında `:latest`
etiketini eklemelidir. İşten sonra: Hub'daki `latest` özeti yeni SemVer özetiyle eşleşmeli
ve `last_updated` ilerlemiş olmalıdır. Sürüm notlarında yalnızca git üzerinde bulunan
düzeltmelerden bahsedilirken `:latest` etiketini eski bir derlemede bırakmayın. Compose
hızlı başlangıçları `:latest` kullanır; GitOps ise `X.Y.Z` sürümüne sabitlemeye devam etmelidir. Bkz.
[Docker sürüm kanalları](../guides/DOCKER_GUIDE.md#release-channels) ve #10317.

## Hotfix Hızlı Hattı (`hotfix` etiketi)

`hotfix` etiketi taşıyan bir PR, ağır CI matrisini (9 parçalı E2E, kapsam mandalı,
quality-gate, quality-extended) atlar ve hızlı, yüksek sinyalli kontrolleri korur: derleme,
birim parçaları, entegrasyon, vitest, lint/typecheck, docs-sync, `check:pack-artifact`
ve tarball açılış duman testi (`check:pack-boot`). Hedef: ~33 dakika yerine ≤15 dakikada yeşil.

**Giriş politikası — dördü de zorunludur (Chromium/VS Code/Node acil durum hatları örnek alınmıştır):**

1. **Önem derecesi**: üretim bozuk olmalıdır — yayımlanmış bir artefakt açılışta çöküyordur /
   bir güvenlik düzeltmesi söz konusudur / sürümün tüm kullanıcıları etkileniyordur. "Önemli", "bozuk" demek değildir.
2. **Yetki**: `hotfix` etiketini yalnızca depo sahibi uygular. Etiket, onayın KENDİSİDİR —
   bir kampanya PR'ında asla kendi kendine uygulanamaz.
3. **Kanıt**: PR gövdesi, daha önce tamamen yeşil olan ağır çalıştırmaya (atlanmış işlerin
   yeniden doğrulayacağı paket) ve düzeltmenin önce başarısız, ardından başarılı olan kendi testine bağlantı verir.
4. **Kapsam**: yalnızca cherry-pick — asgari düzeltme; yeniden düzenleme veya araya sıkıştırılmış ek değişiklik yoktur.

Atlanan kapsam/mandal yüzeyi, sürüm dalındaki bir sonraki tam çalıştırmada
(sürekli sürüm yeşilliği) yeniden doğrulanır — hat yalnızca BEKLEMEYİ atlar, doğrulamayı asla atlamaz.
Yalnızca test değişiklikleri (`tests/e2e/` altında olmayan, tamamı `tests/` altındaki dosyalar)
E2E matrisini herhangi bir etiket olmadan otomatik olarak atlar.

## Ayrıntılı Kontrol Listesi

### Sürüm Öncesi

- [ ] Bu sürümü hedefleyen tüm PR'lar `release/vX.Y.0` dalıyla birleştirildi
- [ ] Bu sürüm için açık olan tüm Linear/sorun öğeleri kapatıldı veya bir sonraki kilometre taşına taşındı
- [ ] `release/vX.Y.0` dalında CI başarılı
- [ ] Kodda `TODO(release)` işaretçisi yok: `grep -r "TODO(release)" src/ open-sse/`
- [ ] Docker temel imajı güncel (şu anda `node:24.15.0-trixie-slim`)

### Sürüm ve Değişiklik Günlüğü

- [ ] `/version-bump-cc <patch|minor|major>` komutunu çalıştırın (Claude Code becerisi)
  - `package.json`, `electron/package.json` sürümlerini yükseltir
  - Son etiketten bu yana yapılan git commit'lerinden `CHANGELOG.md` dosyasını yeniden oluşturur
  - README.md rozetlerini günceller
- [ ] CHANGELOG.md dosyasını elle inceleyin ve gerekirse commit mesajlarını düzenleyin
- [ ] `CHANGELOG.md` içindeki en son semver bölümünün `package.json` sürümüne eşit olduğundan emin olun
- [ ] Gelecekteki çalışmalar için `## [Unreleased]` bölümünü değişiklik günlüğünün ilk bölümü olarak tutun
- [ ] `docs/openapi.yaml` dosyasını güncelleyin → `info.version`, `package.json` sürümüne eşit olmalıdır

### Kod Kalitesi

- [ ] `npm run lint` — 0 hata (uyarılar önceden mevcuttur)
- [ ] `npm run typecheck:core` — temiz
- [ ] `npm run typecheck:noimplicit:core` — temiz (katı)
- [ ] `npm run check:cycles:ratchet` — sabitlenmiş `metrics.cycles` üst sınırı içinde (`check:cycles` tek başına herhangi bir döngüde 1 koduyla çıkar, #15281)
- [ ] `npm run check:any-budget:t11` — bütçe içinde
- [ ] `npm run check:route-validation:t06` — temiz
- [ ] `npm run check:node-runtime` — desteklenen çalışma zamanı alt sınırı karşılanıyor (`>=22.22.2 <23`, `>=24.0.0 <27`; `src/shared/utils/nodeRuntimeSupport.ts` içindeki `SUPPORTED_NODE_RANGE` uyarınca; `package.json` içindeki `engines` ile uyumlu)

### Test

- [ ] `npm run test:unit` — başarılı
- [ ] `npm run test:vitest` — başarılı (MCP sunucusu, autoCombo, önbellek)
- [ ] `npm run test:coverage` — 60/60/60/60 eşiği karşılanıyor (ifadeler/satırlar/fonksiyonlar/dallar)
- [ ] `npm run test:integration` — başarılı (değişiklikler DB / işleyicileri etkiliyorsa)
- [ ] `npm run test:combo:matrix` — başarılı (combo stratejisi matrisi: 19 genel yönlendirme stratejisinin tamamının seçim kararlarını deterministik olarak kanıtlar; combo yönlendirmesi, strateji çözümlemesi veya geri dönüş mantığı değiştirildiğinde çalıştırın)
- [ ] `RUN_COMBO_LIVE=1 npm run test:combo:live` — **isteğe bağlı/manuel** (kapılı gerçek üst akış duman testi; VPS `root@<your-server>` üzerinden salt okunur bir DB anlık görüntüsü alır; gerçek sağlayıcılara istek gönderir, kredi tüketir; CI'da asla çalışmaz; kapı olmadan sorunsuz biçimde atlanır)
- [ ] `npm run test:combo:live:vps` — **isteğe bağlı/manuel** (3. Aşama VPS canlı duman testi: canlı `.15` sunucusuna düz Node ESM aracılığıyla gönderilen 7 HTTP senaryosu; `ssh root@<your-server>` gerektirir; yalnızca `__live_test__*` combo'larını oluşturur/siler; gerçek sağlayıcılara istek gönderir; CI'da asla çalışmaz)
- [ ] `npm run test:e2e` — başarılı (UI değişiklikleri)
- [ ] `npm run test:protocols:e2e` — başarılı (MCP/A2A değişiklikleri)
- [ ] `npm run test:ecosystem` — başarılı

### Hook'lar (Husky ile Doğrulandı)

Husky hook'ları `.husky/` içinde bulunur ve git işlemlerinde otomatik olarak çalışır.

- **pre-commit:** `npx lint-staged + node scripts/check/check-docs-sync.mjs + npm run check:any-budget:t11`
- **pre-push:** hızlı deterministik geçitler — `npm run check:any-budget:t11 && npm run check:tracked-artifacts` (2026-06-13 tarihinde etkinleştirildi). `test:unit` kasıtlı olarak hariç tutulur (yavaş; CI `test-unit` işi tarafından kapsanır).
  - Sürüm dallarını göndermeden önce `npm run test:unit` komutunu elle çalıştırın.

Bir hook başarısız olursa temel sorunu düzeltin; `--no-verify` ile atlamayın.

### Conventional Commits

Sürüme dahil edilecek tüm commit'ler `type(scope): subject` biçimine uymalıdır.

**Geçerli türler:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `style`, `ci`

**Geçerli kapsamlar:** `db`, `sse`, `oauth`, `dashboard`, `api`, `cli`, `docker`, `ci`, `mcp`, `a2a`, `memory`, `skills`, `cloud-agent`, `guardrails`, `compression`, `auto-combo`, `resilience`, `providers`, `executors`, `translator`, `domain`, `authz`

Kırıcı değişiklikler: `BREAKING CHANGE:` alt bilgisini veya kapsamdan sonra `!` ekleyin (ör. `feat(api)!: drop /v0`).

### Dokümantasyon

- [ ] `npm run check:docs-sync` başarılı (pre-commit tarafından otomatik çalıştırılır)
- [ ] `npm run check:docs-all` başarılı (şemsiye komut: docs-sync + docs-counts + env-doc-sync + deprecated-versions + doc-links)
- [ ] `npm run check:env-doc-sync` 0 koduyla çıkar — kod ↔ `.env.example` ↔ `docs/reference/ENVIRONMENT.md` ortam sözleşmesi sağlamdır
- [ ] `npm run check:doc-links` 0 koduyla çıkar — yeniden yapılandırma sonrasında bozuk dahili markdown referansı yoktur
- [ ] `docs/architecture/ARCHITECTURE.md`, depolama/çalışma zamanı sapması açısından incelendi
- [ ] `docs/guides/TROUBLESHOOTING.md`, ortam değişkeni ve operasyonel sapma açısından incelendi
- [ ] `.env.example` değiştiyse: `docs/reference/ENVIRONMENT.md` güncellendi
- [ ] Yeni özelliğin bir UI'ı varsa: `docs/guides/USER_GUIDE.md` dosyasında belirtiliyor
- [ ] Yeni özelliğin bir API'si varsa: `docs/reference/API_REFERENCE.md` + `docs/openapi.yaml` güncellendi
- [ ] Yeni özellik bir modülse: özel bir `docs/<MODULE>.md` dosyası mevcut
- [ ] Kırıcı değişiklik varsa: `docs/guides/TROUBLESHOOTING.md` bir geçiş notu içeriyor

### i18n

- [ ] `npm run i18n:check` 0 koduyla çıkar — çeviri durumu (`.i18n-state.json`) kaynak belgelerle senkronizedir (katı modda sapmış kaynak yoktur; son dakika belge düzeltmeleri için uyarı modu önerisi kabul edilebilir, ancak etiketlemeden önce 0 olmalıdır)
- [ ] `npm run i18n:check-ui-coverage` 0 koduyla çıkar — her UI yerel ayarı %80 kapsam alt sınırında veya üzerindedir
- [ ] `npm run i18n:sync-ui:dry`, 66 hedef yerel ayarın tamamında 0 eksik anahtar bildirir (`en` kaynağı dışındaki her yerel ayar)
- [ ] Kaynak İngilizce belgeler değiştiyse etiketlemeden önce `npm run i18n:run` komutunu çalıştırın (`.env` içinde `PUSULA_TRANSLATION_API_KEY` gerektirir)
- [ ] Küçük çaplıysa çeviri katkıları bir sonraki sürüme ertelenebilir (CHANGELOG içinde takip edin)

### Veritabanı Geçişleri

- [ ] `src/lib/db/migrations/` içinde yeni dosyalar varsa:
  - [ ] Her geçiş idempotent'tir (`CREATE TABLE IF NOT EXISTS` vb.)
  - [ ] Geçişler transaction'lar içine alınmıştır
  - [ ] Doğru şekilde numaralandırılmıştır (sırada boşluk yoktur)
- [ ] Yeni kurulumda test edin: `~/.pusula/pusula.db` dosyasını silin ve `npm run dev` komutunu çalıştırın
- [ ] Mevcut kurulumda test edin: DB'yi yedekleyin, geçişi çalıştırın, şemayı doğrulayın
- [ ] Geçiş tabloları yeniden yazıyorsa WAL dosyaları (`-wal`, `-shm`) doğru şekilde işlenir

### Sağlayıcı Kataloğu (Zod ile doğrulanmış)

- [ ] `src/shared/constants/providers.ts` Zod şeması yükleme sırasında geçerli
  - [ ] Tüm sağlayıcılarda gerekli alanlar (`id`, `label`, `kind` vb.) mevcut
  - [ ] Yeni ücretsiz sağlayıcılar için `freeNote` sağlanmış
  - [ ] OAuth sağlayıcılarının `oauthConfig` yapılandırması `src/lib/oauth/constants/oauth.ts` içinde kayıtlı
- [ ] Yeni sağlayıcı eklendiyse: `open-sse/executors/` içinde karşılık gelen yürütücü mevcut
- [ ] OpenAI dışı bir biçim kullanılıyorsa: `open-sse/translator/` içinde çevirici mevcut
- [ ] Modeller `open-sse/config/providerRegistry.ts` içinde kayıtlı
- [ ] `tests/unit/` içindeki birim testleri sağlayıcı sınıflandırmasını ve yönlendirmeyi kapsıyor

### Masaüstü (Electron)

`electron/` değiştirildiyse:

- [ ] `npm run electron:smoke:packaged` başarılı
- [ ] Derlemeler `:win`, `:mac`, `:linux` seçeneklerinden en az biri için test edildi
- [ ] Kod imzalama sertifikalarının süresi dolmamış (imzalama yapılıyorsa)
- [ ] `electron/package.json` sürümü, kök dizindeki `package.json` sürümüyle eşleşiyor
- [ ] `stable` kanalında yayımlanıyorsa otomatik güncelleme kanal işaretçisi güncellendi

### Derleme Düzeni

Depo üç ayrı çıktı dizini kullanır — bunları asla birbirine karıştırmayın:

| Dizin     | Amaç                                                      | İzleniyor mu?      |
| --------- | --------------------------------------------------------- | ------------------ |
| `src/`    | Uygulama kaynağı (TypeScript / TSX)                       | Evet               |
| `.build/` | Derleme ara çıktıları — `next build` çıktısı (`distDir`)  | Hayır (gitignored) |
| `dist/`   | Dağıtılabilir npm paketi — `assembleStandalone` oluşturur | Hayır (gitignored) |

> **Operatör notu:** uzak VPS görüntü dizini `/usr/lib/node_modules/pusula/app/` olarak kalır.
> Yalnızca **depo içindeki** derleme çıktısı taşındı (`app/` → `dist/`). Dağıtım becerileri,
> `dist/` içeriğini uzak `app/` dizinine rsync ile aktarır — VPS yollarında değişiklik gerekmez.

**Tek derleme akışı:**

```
npm run build:release
  └─ rm -rf .build dist          (temizleme)
  └─ next build → .build/next/   (ara çıktılar)
  └─ assembleStandalone          (standalone + static + public + natives içeriklerini → dist/ dizinine kopyalar)
  └─ writes dist/BUILD_SHA       (HEAD doğrulama işareti)
```

Dağıtım için `npm run build` komutunu ve ardından ayrı bir `npm run build:cli` komutunu ÇALIŞTIRMAYIN —
tek komutla temiz bir yeniden derleme ve doğrulama işareti oluşturan `npm run build:release` komutunu kullanın.

### Yapıt Doğrulaması

- [ ] `npm run build:release` başarılı ve `dist/BUILD_SHA` == `git rev-parse --short HEAD`
- [ ] `npm run check:pack-artifact` temiz — `app.__qa_backup`, `scripts/scratch`, `package-lock.json` veya başka yerel kalıntı yok
- [ ] Derlemeden sonra `dist/server.js` mevcut
- [ ] İsteğe bağlı yerel paketlenmiş çalışma zamanı duman testi: `npm run dev:candidate -- build` sonrasında `npm run dev:candidate -- validate`, paketlenmiş tarball'ı yalıtılmış bir `DATA_DIR` üzerinde başlatır ve `/api/health` + `/v1/models` uçlarını kontrol eder (bkz. [Katkı İçin Önerilen Yol](CONTRIBUTION_GOLDEN_PATH.md#local-candidate-loop))

### Etiketleme ve Sürüm Yayımlama

- [ ] `/generate-release-cc` komutunu çalıştırın (Claude Code becerisi):
  - `vX.Y.Z` etiketini oluşturur
  - Etiketi ve dalı gönderir
  - Değişiklik günlüğü gövdesiyle bir GitHub Release açar
  - Electron yükleyicilerini ekler (derlendiyse)
- [ ] Alternatif olarak manuel biçimde:
  ```bash
  git tag -a vX.Y.Z -m "Release vX.Y.Z"
  git push origin vX.Y.Z
  gh release create vX.Y.Z --notes-from-tag
  ```

### Dağıtım

Dağıtım becerileri hafif rsync akışını kullanır — `npm pack` veya `npm i -g` kullanılmaz:

- [ ] Hedefle eşleşen dağıtım becerisini kullanın:
  - `/deploy-vps-local-cc` — yerel VPS (192.168.0.15)
  - `/deploy-vps-akamai-cc` — Akamai VPS (69.164.221.35)
  - `/deploy-vps-both-cc` — her ikisi
- [ ] Dağıtımdan önce `dist/BUILD_SHA` == `git rev-parse --short HEAD` olduğunu doğrulayın
- [ ] Derleme, `node_modules` dizininin gerçek olduğu yerde çalıştırılmalıdır (ana çalışma kopyası veya `npm ci` çalıştırılmış worktree — sembolik bağlantılı bir worktree DEĞİL)
- [ ] Dağıtılan örnekte duman testi gerçekleştirin:
  - `/dashboard/health` sayfasını açın → sürüm dizesinin yayımlanan sürümle eşleştiğini kontrol edin
  - Bilinen bir sağlayıcıya karşı `/v1/chat/completions` isteği çalıştırın
  - `/api/monitoring/health` yanıtının `CLOSED` devre kesicileri döndürdüğünü doğrulayın
  - MCP aktarımlarının yanıt verdiğini doğrulayın (`/mcp` HTTP, `/mcp-sse` SSE)

### Sürüm Sonrası

- [ ] `/capture-release-evidences-cc` komutunu çalıştırın (Claude Code becerisi)
  - Yeni özelliklerin WebP ekran görüntülerini/kayıtlarını alır
  - Sürüm notlarına / blog gönderisine ekler
- [ ] GitHub Discussions'ı sürüm duyurusuyla güncelleyin
- [ ] Sonraki sürüm için kilometre taşı açın
- [ ] Kritikse: tartışmayı sabitleyin veya uygulama içi banner için `news.json` içinde gönderi yayımlayın

### Radar genel kullanıma açma kapısı

Radar duyurusu kasıtlı olarak `active: false` ile kaydedilmiştir. Etkinleştirme, aşağıdaki her madde
kanıtlandıktan sonra yapılacak ayrı bir değişikliktir:

- [ ] Yığınlanmış tüm Radar PR'ları birleştirildi ve sürüm ucu CI durumu yeşil
- [ ] `RADAR_ENABLED` varsayılan olarak hâlâ kapalıyken açık kaynaklı Radar rotalarını dağıtın ve temel işlev testinden geçirin
- [ ] Yedekten geri yüklemenin çalıştığını ve gözetimli, bütçesi sınırlandırılmış bir araştırma çalıştırmasını kanıtlayın
- [ ] Yeni `news.json` kimliğini yalnızca önceki geçitler tamamlandıktan sonra etkinleştirin
- [ ] Ana Sayfa banner'ının yerelleştirilmiş metin kullandığını ve eski bir kimlik kapatıldıktan sonra yeni bir kimliğin yeniden göründüğünü doğrulayın

## Gömülü Hizmetler smoke testi (v3.8.4+)

Gömülü hizmet değişiklikleri içeren herhangi bir sürümü yayımlamadan önce şunları doğrulayın:

### Yeni veritabanıyla başlatma (migration çakışmalarını yakalar — v3.8.4 hotfix'inden sonra eklendi)

- [ ] `DATA_DIR=$(mktemp -d) npm start &` — başlatma için 10 sn bekleyin
- [ ] `curl -s http://127.0.0.1:20128/api/services/9router/status | jq '.tool'`, `"9router"` döndürür (404 DEĞİL, 500 DEĞİL). `071_services.sql` migration'ının uygulandığını ve satırın oluşturulduğunu doğrular.
- [ ] `sqlite3 $DATA_DIR/storage.sqlite "PRAGMA table_info(version_manager);" | grep -E "provider_expose|logs_buffer_path|last_sync_at"` 3 satır döndürür.
- [ ] `sqlite3 $DATA_DIR/storage.sqlite "PRAGMA table_info(webhooks);" | grep -E "kind|metadata_encrypted"` 2 satır döndürür (`070_webhooks_kind_metadata.sql` migration'ının uygulandığını doğrular).
- [ ] `node --import tsx/esm --test tests/unit/db/no-migration-collisions.test.ts` başarılı olur — gelecekteki çakışmalara karşı koruma sağlar.

### 9Router

- [ ] `POST /api/services/9router/install`, 2 dakikadan kısa sürede `installedVersion` ile 200 döndürür
- [ ] `POST /api/services/9router/start`, 30 sn'den kısa sürede 200 ve `state: "running"` döndürür
- [ ] `GET /api/services/9router/status`, `health: "healthy"` bildirir
- [ ] `"model": "9router/auto/..."` ile `POST /v1/chat/completions`, 200 döndürür (9Router üzerinden uçtan uca yönlendirme)
- [ ] `GET /dashboard/providers/services/9router/embed/dashboard`, 9Router'ın yerel kullanıcı arayüzünü proxy içinde oluşturur (doğrudan `127.0.0.1:port` iframe'i kullanılmaz)
- [ ] `POST /api/services/9router/rotate-key`, `{ keyRotated: true }` döndürür ve hizmet sorunsuz şekilde yeniden başlatılır
- [ ] `POST /api/services/9router/stop`, 200 ve `state: "stopped"` döndürür
- [ ] `GET /api/services/9router/logs?tail=50`, son satırları içeren `snapshot` olayına sahip bir SSE akışı döndürür
- [ ] PATH içinde `npm` bulunmayan bir ortamda kurulum, kullanıcı dostu (stack trace içermeyen) bir hata mesajıyla 500 döndürür

### CLIProxyAPI

- [ ] `POST /api/services/cliproxy/install`, 2 dakikadan kısa sürede 200 döndürür
- [ ] `POST /api/services/cliproxy/start`, 30 sn'den kısa sürede 200 ve `state: "running"` döndürür
- [ ] `GET /api/services/cliproxy/status`, `health: "healthy"` bildirir
- [ ] `POST /api/services/cliproxy/stop`, 200 ve `state: "stopped"` döndürür
- [ ] `GET /api/services/cliproxy/logs?tail=50`, bir SSE akışı döndürür

### Güvenlik regresyonu

- [ ] `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:20128/api/services/9router/start`, `403 LOCAL_ONLY` döndürür
- [ ] `curl -H "X-Forwarded-For: 1.2.3.4" http://localhost:20128/api/services/cliproxy/start`, `403 LOCAL_ONLY` döndürür
- [ ] `/api/services/*` kaynaklı hata yanıtları `err.stack` veya mutlak dosya yolları içermez

## v3.8.0+ kontrolleri

Herhangi bir v3.8.x sürümünü yayımlamadan önce şu ek öğeleri doğrulayın:

- [ ] `pusula --tray`, macOS'ta başlatılır (systray2, `~/.pusula/runtime/` içine yüklenmiş olmalıdır)
- [ ] `pusula --tray`, Linux'ta başlatılır (DISPLAY gerektirir; ayarlanmamışsa düzgün bir hata verir)
- [ ] `pusula --tray`, Windows'ta başlatılır (PowerShell NotifyIcon, ek binary yoktur)
- [ ] `pusula config tray enable`, otomatik başlatma girdisi oluşturur; devre dışı bırakma işlemi bunu kaldırır
- [ ] `npm install -g pusula@<this-version>`, postinstall işlemini ölümcül bir çıkış olmadan çalıştırır
- [ ] Güncelleme yolu isteğe bağlı bağımlılıkları korur: `pusula update --apply` ve otomatik güncelleyici,
      `npm install -g … --include=optional` komutunu çalıştırır; böylece `optionalDependencies` (better-sqlite3,
      keytar, tls-client ve llmlingua SLM yığını: `@atjsh/llmlingua-2@2.0.5`,
      `js-tiktoken`) güncellemeden sonra korunur. Ultra `modelPath` SLM katmanı ayrıca ilk kullanımda
      `${DATA_DIR}/models/llmlingua` konumuna otomatik olarak indirilen tinybert modeline ihtiyaç duyar. Ardından postinstall
      (`scripts/build/colocateOptionals.mjs`), SLM isteğe bağlı bağımlılık kümesini `dist/node_modules`
      içine birlikte yerleştirir; böylece worker, TEK bir `@huggingface/transformers` ^4.2.0
      örneğini çözümler — bağımsız trace yalnızca transformers'ı paketler, dinamik olarak içe aktarılan
      isteğe bağlı bağımlılıkları değil; bu işlem olmadan worker, llmlingua-2'yi kök dizindeki transformers
      ile yükler ve SLM katmanı sessizce açık kalacak şekilde başarısız olur.
- [ ] `pusula status`, `.env` olmadan çalışır (CLI token yolu, yalnızca loopback)
- [ ] `curl http://localhost:20128/api/shutdown`, 401 döndürür (her zaman korunan route)
- [ ] `curl -H "host: evil.com" http://localhost:20128/api/mcp/sse`, 401 döndürür (loopback koruması)
- [ ] SQLite runtime, ilk çalıştırmada `bundled` olarak çözümlenir (paketlenmiş binary platform için geçerlidir)
- [ ] `node_modules/better-sqlite3` silindiğinde SQLite runtime, `runtime` seçeneğine geri döner
- [ ] Akıllı MCP filtresi, gerçek `playwright-mcp browser_snapshot` çıktısını sıkıştırır (≥%50 azalma)
- [ ] 10 `skills/pusula*/SKILL.md` dosyasının tamamına ham GitHub URL'si üzerinden herkese açık olarak erişilebilir
- [ ] İlk kurulumda onboarding sihirbazı, "Nasıl Çalışır" katman tanıtım adımını gösterir
- [ ] Ana dashboard'daki katman kapsamı widget'ı, yapılandırılmış/etkin sayılarını gösterir

---

## 3.9.0 LTS ayrımı (3.8.58'de prova edildi)

v3.8.59'dan sonraki sürüm 3.9.0'dır ve bu sürümün uç noktası iki uzun ömürlü dala dönüşür:
`stable/v3` (v3 LTS hattı, npm `latest`) ve `develop` (v4, 4.0.0'a yükseltilmiş, npm
`nightly`). Dal/kanal modeli, ileri taşıma ve etiketler
[RELEASE_STRATEGY.md](./RELEASE_STRATEGY.md) dosyasında; plan ise [ROADMAP](../../ROADMAP.md) (Aşama 3) içindedir. Ayrım bir kez çalıştırılır;
3.8.58 bunu bir fork üzerinde baştan sona prova eder ve 3.8.59
[GO/NO-GO kontrol listesi](./LTS_GO_NO_GO.md) ile kapanır.

### Deneme çalıştırması (salt okunur, her zaman güvenli)

```bash
npm run release:dry-run-lts-cut                       # gerçek ayrım: HEAD'den 3.9.0, önceki etiket v3.8.59
npm run release:dry-run-lts-cut -- --from <3.9.0-tip> # kaynak commit'i sabitle
```

`scripts/release/dry-run-lts-cut.mjs` hiçbir şeyi yürütmez: git ve `gh` verilerini okur ve
tüm diziyi yazdırır — önkoşullar (kaynak çözümleniyor, kaynak depo eksiksiz geçmişe sahip —
sığ bir klon `stable/v3` dalını gönderemez; alıcı taraf paketi ilk
aşılanmış üst commit'te reddeder, bu nedenle ayrımı eksiksiz bir klondan yapın veya önce
`git fetch --unshallow origin` çalıştırın — önceki etiket mevcut, `package.json` hedef
sürümde, açık bir `release-freeze` kaydı var, mevcut bir yayın dalında açık
`Release branch not green` kaydı yok — mevcut olmayan bir dal `?` bilinmiyor olarak
raporlanır, hiçbir zaman yeşil sayılmaz — Mergify `release` kuyruğu yapılandırılmış
(G11: `queue_rules`, `checks_timeout`, `queue` etiketi), `release/*` kural kümesi silmeyi ve
zorlamalı göndermeyi hâlâ engelliyor ve `stable/v3` ile `develop` henüz mevcut değil), iki
dal adımı, hangi atıl iş akışı tetikleyicilerinin ve `if:` koşullarının doğru hâle geldiği
(ve hangilerinin bir depo değişkeni tarafından engellenmeye devam ettiği veya kanonik
depoya sabitlendiği), beklenen dist-tag'ler (`latest` → 3.9.0, `next` ve `nightly` boş)
ve geri alma işlemi. Çıkış kodu `0` = `RESULT: READY`, `1` = engelleyici bir önkoşul
başarısız oldu (`✗`), `2` = kullanım hatası. `--advisory <id,...>`, bir denetimi gizlemeden
uyarı (`!`) düzeyine indirger.

Gerçek ayrımın deneme çalıştırmasını 3.9.0 yayın dondurması hâlâ açıkken çalıştırın — dallar
etiketten sonra ve Aşama 12c dondurmayı kaldırmadan önce oluşturulur.

### 3.8.58 provası (yalnızca fork)

```bash
# 1. Geçerli uç noktada prova parametreleriyle deneme çalıştırması
npm run release:dry-run-lts-cut -- --target-version 3.8.58 --previous-tag v3.8.57 \
  --advisory freeze,base-green

# 2. Bir FORK uzak deposuna karşı yürütün (origin veya URL'si kanonik depo olan
#    herhangi bir uzak depo reddedilir; her adım terminalde onay ister)
git remote add rehearsal https://github.com/<you>/Pusula.git
node scripts/release/dry-run-lts-cut.mjs --execute --remote rehearsal \
  --target-version 3.8.58 --previous-tag v3.8.57 --advisory freeze,base-green

# 3. Fork'taki atıl iş akışlarını çalıştırın (deneme çalıştırmasının kanonik depo
#    sabitlemesi raporladığı yerlerde workflow_dispatch), ardından geri alın
node scripts/release/dry-run-lts-cut.mjs --execute --rollback --remote rehearsal \
  --target-version 3.8.58 --previous-tag v3.8.57 --advisory freeze,base-green
```

develop yükseltme commit'i git tesisatıyla oluşturulur (çalışma ağacına dokunulmaz) ve
döngü açılış commit'iyle aynı beş dosyayı yükseltir: `package.json`,
`open-sse/package.json`, `electron/package.json`, `package-lock.json` ve
`docs/openapi.yaml`. `[4.0.0]` CHANGELOG bölümü ve bunun i18n yansıları daha sonra,
ilk PR'ından önce `develop` üzerinde açılır. Betik npm dist-tag'lerini hiçbir zaman
değiştirmez — bunları geçici bir paket üzerinde prova edin.

### PR önizleme yapıtı (bir kez derleyin, aynı baytları terfi ettirin)

`.github/workflows/preview-artifact.yml`, bir PR uç noktasından tek bir üretim tarball'ı
derler ve tam olarak bu derlemeyi doğrular (#8084 dilimi (a)). Yalnızca aynı depodaki
PR'lar; hiçbir şey yayımlanmaz.

```bash
gh workflow run preview-artifact.yml -f pr_number=<N>   # veya `preview-artifact` etiketini ekleyin
gh run download <run-id> --name preview-artifact-pr<N>-<sha7> --dir preview
cd preview && sha256sum -c SHA256SUMS
gh attestation verify pusula-*.tgz --repo Ferhat-Yasinoglu/pusula
npm install -g ./pusula-*.tgz                          # önizleme kurulumu
```

Çalıştırma; `npm ci`, `npm run build:release` ve `npm run check:pack-artifact` komutlarını
yürütür, tarball'ı paketler, `npm run check:pack-boot` komutunu çalıştırır (sahte gizli
değerler, geçici veri dizini), yeniden paketler ve özet aynı değilse başarısız olur;
ardından `artifact-identity.json` dosyasını (uç SHA, temel SHA, kilit dosyası karması,
platform, mimari, node ABI, paketleyici, derleme ilkesi —
`scripts/release/artifact-identity.mjs`) kaydeder ve ayrı bir işte tarball için tasdik
oluşturur. Bir önizlemeyi terfi ettirmek, söz konusu tarball'ı kurmak anlamına gelir:
asla kaynaktan yeniden derlemeyin.

### Ayrım (3.9.0, GO sonrasında)

1. GO, [LTS_GO_NO_GO.md](./LTS_GO_NO_GO.md) dosyasına kaydedilir.
2. `npm run release:dry-run-lts-cut -- --from v3.9.0`, `RESULT: READY` çıktısını verir.
3. Dalları, deneme çalıştırmasının yazdırdığı komutlarla `origin` üzerinde elle oluşturun —
   betik `origin` hedefine göndermeyi reddeder. İncelenmiş bir develop commit'ini yeniden
   kullanmak için önce 3.9.0 uç noktasında fork'unuza karşı `--execute` provasını çalıştırın;
   bu işlem her iki SHA'yı da yazdırır ve aynı commit'ler gönderilebilir:

   ```bash
   git push origin <stable-sha>:refs/heads/stable/v3 <develop-sha>:refs/heads/develop
   ```

4. İlk PR birleştirilmeden önce `stable/v3` ve `develop` dallarını koruyun (kural kümeleri + birleştirme kuyruğu).
5. Etkin olmayan iş akışları, dalların varlığıyla etkinleşir: `forward-port.yml` (`stable/v3` dalına push),
   `validate-stable-pr.yml` (`stable/v3` dalına yönelik PR'lar) ve `nightly-v4-build.yml`
   (`develop` dalını derler). Canlıya geçmeden önce `secrets.FORWARD_PORT_TOKEN` depo gizli
   bilgisini ayarlayın (böylece CI, ileri taşıma PR'larında çalışır); gecelik yayımlama, depo
   sahibi `vars.NIGHTLY_PUBLISH` depo değişkenini `true` olarak ayarlayana ve npm Trusted Publishing
   `nightly-v4-build.yml` dosyasını kabul edene kadar kapalı kalır. Kanal çözümlemesi,
   `npm-publish.yml` tarafından da kullanılan aynı çözümleyici olan `scripts/release/dist-tag.mjs`
   tarafından gerçekleştirilir.
6. Kanalları doğrulayın: `npm view pusula dist-tags --json`, `latest` = 3.9.0 değerini gösterir ve
   v4 yayımlanana kadar `next` / `nightly` bulunmaz.
7. Gerekirse geri alın: `git push origin --delete refs/heads/stable/v3 refs/heads/develop`
   ve `npm dist-tag add pusula@3.8.59 latest`.

---

## Geri Alma

Sürümde kritik bir sorun varsa:

1. `gh release edit vX.Y.Z --prerelease` (en son sürüm olarak işaretlenmesini kaldırır)
2. `git tag -d vX.Y.Z && git push --delete origin vX.Y.Z` (yalnızca kullanıcılar tarafından henüz benimsenmediyse)
3. Veya: `release/vX.Y.0` üzerinde düzeltme → yama sürümü `vX.Y.(Z+1)`
4. GitHub Discussions üzerinden derhal iletişim kurun

## Kesin Kurallar

- Asla doğrudan `main` dalına commit yapmayın
- `main` veya `release/*` dallarında asla `git push --force` kullanmayın
- Husky hook'larını asla atlamayın (`--no-verify`)
- Gizli bilgileri, kimlik bilgilerini veya `.env` dosyalarını asla commit etmeyin
- Kapsama oranı ≥60/60/60/60 (ifadeler/satırlar/fonksiyonlar/dallar) olarak kalmalıdır
- `src/`, `open-sse/`, `electron/` veya `bin/` içindeki üretim kodunu değiştirirken her zaman testleri ekleyin veya güncelleyin

## Otomatik Senkronizasyon Kontrolü

Bir PR açmadan önce dokümantasyon senkronizasyon korumasını yerel olarak çalıştırın:

```bash
npm run check:docs-sync
```

CI da bu kontrolü `.github/workflows/ci.yml` içinde çalıştırır (lint işi).
