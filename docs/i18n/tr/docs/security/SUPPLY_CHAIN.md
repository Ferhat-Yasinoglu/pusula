# Supply-Chain Gates (Phase 8 · Block A) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../security/SUPPLY_CHAIN.md) · 🇩🇪 [de](../../../de/docs/security/SUPPLY_CHAIN.md) · 🇮🇷 [fa](../../../fa/docs/security/SUPPLY_CHAIN.md)

---

Pusula, npm ve Docker yapıtları yayınlar. Bu geçitler, tümü OSS olan, yayın iş akışlarına entegre edilmiş menşe, envanter (SBOM) ve CVE taraması sağlar.
**Önce danışmanlık** duruşu — şimdi raporlarlar, ilk
yeşil yayından sonra engellemeye yükseltirler.

| Geçit              | Araç                                           | Nerede                           | Engelliyor mu?                   | Çıktı                                            |
| ------------------ | ---------------------------------------------- | -------------------------------- | -------------------------------- | ------------------------------------------------ |
| SLSA menşei (npm)  | `npm --provenance` (OIDC)                      | `npm-publish.yml`                | yalnızca yayın başarısız olursa  | badge npmjs / `npm audit signatures`             |
| SBOM npm           | `@cyclonedx/cyclonedx-npm`                     | `npm-publish.yml`                | yalnızca üretim başarısız olursa | Yayın varlığı + yapıt                            |
| SBOM imajı         | `anchore/sbom-action` (syft)                   | `docker-publish.yml` (birleştir) | danışmanlık                      | CycloneDX yapıtı                                 |
| Trivy CVE (SARIF)  | `aquasecurity/trivy-action`                    | `docker-publish.yml` (birleştir) | danışmanlık                      | SARIF (YÜKSEK+KRİTİK) → Güvenlik sekmesi         |
| Trivy KRİTİK geçit | `aquasecurity/trivy-action`                    | `docker-publish.yml` (birleştir) | **engelliyor**                   | düzeltilebilir KRİTİK üzerinde `exit-code: '1'`  |
| osv vulnCount      | `osv-scanner` (`check:vuln-ratchet --ratchet`) | `ci.yml` (`quality-extended`)    | **engelliyor**                   | `metrics.vulnCount` (yön:aşağı) değerini artırır |
| OpenSSF Scorecard  | `ossf/scorecard-action`                        | `scorecard.yml` (cron)           | danışmanlık                      | SARIF → Güvenlik + rozet                         |

İmaj CVE mandalı, `docker-publish.yml` içinde **iki adım** kullanır: SARIF adımı
(`HIGH,CRITICAL`, `exit-code: 0`) YÜKSEK+KRİTİK'i Güvenlik sekmesinde engellemeden görünür tutar;
_KRİTİK geçit_ adımı (`severity: CRITICAL`, `ignore-unfixed: true`,
`exit-code: 1`), **düzeltmesi mevcut olan** KRİTİK bir CVE'de yayını başarısız kılar. `ignore-unfixed`
yukarı akış yaması olmayan bir temel imaj CVE'si için yayının engellenmesini önler.

## ⚠️ CVE Varyansı (osv/Trivy geçitlerini engelleme)

osv ve Trivy, bağımlılıkları **sürekli büyüyen** CVE veritabanlarına karşı karşılaştırır.
**Hiçbir bağımlılığa dokunmayan** bir PR, mevcut bir bağımlılıkta yeni bir CVE
açıklandığı için aniden kırmızıya dönebilir (osv: ölçülen `vulnCount` > temel çizgi; Trivy:
imajda yeni düzeltilebilir bir KRİTİK). **Bu, engelleme yapan bir CVE geçidinin BEKLENEN
operasyonel davranışıdır, bir ürün gerilemesi değildir.**

Yeni açıklanan bir CVE nedeniyle osv veya Trivy kırmızıya döndüğünde, çözüm şudur:

1. **Etkilenen bağımlılığı yükseltin** (tercih edilen) — `package.json`
   `overrides` (geçişli bağımlılıklar) aracılığıyla yamalı sürüme yükseltin veya yamalı bir temel üzerinde imajı yeniden oluşturun.
2. **Yukarı akışta bir düzeltme yoksa:**
   - **osv:** `config/quality/quality-baseline.json` içindeki `metrics.vulnCount` değerini yeniden temel alın
     (`npm run quality:ratchet -- --update` özel geçitleri kapsamaz — değeri elle düzenleyin,
     `direction:down`) bir gerekçe notu + takip sorunu ile.
   - **Trivy:** `.trivyignore` dosyasına (her satırda CVE-ID) bir gerekçe
     yorum + takip sorunu ile bir giriş ekleyin. `ignore-unfixed: true` zaten
     yaması olmayan CVE'leri otomatik olarak kapsar.

Her iki geçit de araç yoksa veya ölçüm başarısız olursa (osv-scanner PATH'de yok,
osv.dev/ağ erişilemez, geçersiz JSON) **zarifçe ATLAR** (çıkış 0) — bir
**ölçüm** hatası asla engellemez, yalnızca **ölçülen** bir gerileme engeller.

## Bilinen Kabul Edilmiş Riskler

### extract-zip 2.0.1 — GHSA-7pqw-9j4j-h8q3 / GHSA-jmr9-qjv8-65gv (#14482)

`extract-zip@2.0.1` iki adet yamalanmamış yüksek önem dereceli sembolik bağlantı geçişi danışmanlığı içermektedir.
Yukarıdaki CVE Varyans çözümünün "üst akım düzeltmesi yok" dalına göre, bu bir **kabul edilmiş risktir**, bir yükseltme değildir:

- **Zincir:** `promptfoo` (devDependency) → `@openai/codex-security` → `extract-zip@2.0.1`.
  `package-lock.json` aracılığıyla doğrulandı — tüm bağımlılık ağacında tam olarak bir paket (`@openai/codex-security`) `extract-zip`'i bildiriyor ve tam olarak bir paket (`promptfoo`) `@openai/codex-security`'yi bildiriyor.
- **Zincirin hiçbir yerinde sabit bir sürüm mevcut değil.** `extract-zip@2.0.1` (2020'de yayınlandı) paketin son sürümüdür — bakımı yapılmamaktadır. `@openai/codex-security`'nin
  mevcut npm-latest (`0.1.29`) hala `extract-zip@2.0.1`'i çekiyor.
- **Üretimden ulaşılamaz.** `promptfoo` yalnızca devDependency'dir (asla `dependencies` altında listelenmez) ve `src/`, `open-sse/` veya `bin/` altındaki hiçbir dosya
  `extract-zip` npm paketini içe aktarmaz — Pusula'un kendi `extractZip()` yardımcısı
  (`src/lib/versionManager/binaryManager.ts:93`) yerel `unzip`/`tar`'a kabuk komutu gönderir ve ilgisizdir. `@openai/codex-security` ayrıca extract-zip'in onEntry geri çağrısının üzerine kendi sembolik bağlantı geçişi korumasını da gönderir.
- `package.json` `overrides` aracılığıyla `extract-zip`'i takma ad olarak **kullanmayın** — tek uygun
  yerine geçen Electron-org-internal'dır ve `@openai/codex-security`'nin kendi onEntry/defaultDirMode/defaultFileMode kontrolleriyle API uyumlu değildir;
  onu geçersiz kılmak, o paketin güvenlik kontrollerini sessizce bozacaktır.
- **Temel:** ölçülen osv `vulnCount` (3) zaten dondurulmuş
  `config/quality/quality-baseline.json` temelinin (27) oldukça altındadır — mandal değişikliğine gerek yoktur.
- **Regresyon koruması:** `tests/unit/extract-zip-14482-exposure.test.ts` zinciri ve yukarıdaki üretim dışı içe aktarma değişmezini doğrular; eğer bunlardan herhangi biri bozulursa (örneğin, gelecekteki bir PR `extract-zip`'i üretimden erişilebilir hale getirirse) CI'yi başarısız kılar.
- **Takip:** sorun #14482.

## Bekleyenler: Scorecard danışmanlığı → engelleme

Scorecard raporlamasıyla ilk yeşil sürümden sonra:

- Scorecard: puan mandalı (ölçülen puanı dondurur; azalmaz).

Aşama 7 geçitlerini (osv-scanner, gitleaks, actionlint+zizmor) tamamlar: zizmor
iş akışlarının kendilerini denetler; Scorecard, depo duruşunu toplu olarak ölçer.
