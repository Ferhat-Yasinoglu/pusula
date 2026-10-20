# Release-Green: keeping the queue and release branch green (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/RELEASE_GREEN.md) · 🇩🇪 [de](../../../de/docs/ops/RELEASE_GREEN.md) · 🇮🇷 [fa](../../../fa/docs/ops/RELEASE_GREEN.md)

---

## Bunun çözdüğü sorun

**Tam geçit** (`.github/workflows/ci.yml` — birim testi parçaları, vitest, ratchet'lar,
`package-artifact`, SonarQube, E2E) **yalnızca release PR'ında** (PR → `main`) çalışır. Hedefi
`release/**` olan PR'lar **hızlı geçitlerden** (`quality.yml`: TIA'dan etkilenen testler + tür denetimi + lint)
ve kod değişiklikleri için **tavsiye niteliğinde** bir production derlemesinden geçer. Sonuç olarak: yalnızca release'te ortaya çıkan kırmızılar release branch'inde sessizce birikebilir ve release zamanında
**her seferinde bir tane olmak üzere yaklaşık 40 dakikalık katmanlar hâlinde patlayabilir**.

"release-green ailesi", bu kırmızıları **önceden tespit etmek** için vardır — tam geçidin eşdeğerini
istenilen herhangi bir zamanda **yerel olarak / release dışında** doğrular; böylece release PR'ı ilk CI çalıştırmasında
zaten yeşil olur.

> **Tartışmaya kapalı ilke:** Bunların hiçbiri katkıda bulunan kişiyi engellemez. PR'larının başarısız olmasına neden olan
> zorunlu bir kontrol eklemeyiz. **Sapma** (ratchet'lar), bakım sorumlusunun release sırasında yeniden temel değer belirlemesi içindir —
> hiçbir zaman katkıda bulunan kişinin sorunu değildir. Hiçbir parça bir PR'ı **kapatmaz** (emeğin başkasına mal edilmesi) veya
> geçmesi için bir testi **zayıflatmaz**.

## Aile (4 parça) — ve her birinin bağımsız olarak nasıl çalıştığı

| Parça                                                                   | Nedir                                                                            | Ne zaman çalıştırılır                                                                       | Kapsam                             |
| ----------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------- |
| **`/green-prs`** (Çözüm A)                                              | Bakım sorumlusu tarafından **açık PR kuyruğunda** isteğe bağlı tarama            | **Bağımsız olarak, periyodik biçimde** — ve özellikle bir `/generate-release` **öncesinde** | Tüm PR kuyruğu → `release/**`      |
| **`/validate-release-green`** (Çözüm C — `npm run check:release-green`) | Doğrulama motoru: tam geçidi bir branch VEYA merge adayı üzerinde yeniden üretir | Bağımsız olarak, istenilen herhangi bir zamanda                                             | Belirli bir branch veya merge PR'ı |
| **`/babysit <PR#>`**                                                    | **Tek** bir PR'ın **canlı CI** sürecini yeşile ulaşana kadar yönlendirir         | Bağımsız olarak, PR başına                                                                  | Tek bir PR                         |
| **`nightly-release-green.yml`** (Çözüm D)                               | Otomatik gecelik workflow; HARD kırmızı durumunda issue açar                     | Otomatik (cron)                                                                             | Etkin release branch'i             |

**"Bu yalnızca release'ler için mi?" sorusunun kısa yanıtı:** **hayır.** `/green-prs`,
**release'ler arasında periyodik olarak** çalıştırılmak üzere tasarlanmıştır. Bağımsız olarak çalıştırılması normal kullanımdır — release yalnızca
onu çalıştırmanın en fazla değer sağladığı andır.

## PR'dan sürüme yönelik danışma amaçlı derleme

`quality.yml` artık taslak olmayan kod PR'ları ve Mergify kuyruk dalları için `Build (advisory)` işini içeriyor.
Bu iş, `ci.yml` dosyasındaki üretim derleme tarifini yansıtır: Node 24, `npm-ci-retry`,
`check:node-runtime` ve `PUSULA_USE_TURBOPACK=1` ile `npm run build`. Bu iş akışında sonraki hiçbir kalite işi bir derleme çıktısını kullanmadığından, kasıtlı olarak derleme çıktısı yüklemez.
Sinyalin PR'dan sürüme geçişi engelleyen bir kapı hâline gelmesi için bir haftalık kararlı sürüm PR'ı çalıştırmalarının ardından `continue-on-error` seçeneğini kaldırın.

## Çözüm C — `npm run check:release-green` (motor)

Mevcut çalışma ağacına karşı sürümle eşdeğer doğrulamayı yeniden üretir ve her başarısız sonucu sınıflandırır:

- **HARD** (typecheck, lint hataları, unit, vitest, db-rules, public-creds, isteğe bağlı
  `package-artifact`) → **gerçek kusur**; `exit 1`. Kaynak dalda düzeltilir (TDD, Kural #18).
- **DRIFT** (eslint **uyarıları**, cognitive-complexity, file-size) → döngü sırasında biriken eşik sapmasıdır,
  **katkıda bulunan kişinin hatası değildir**; yalnızca raporlanır ve **sürüm sırasında bakım sorumlusu tarafından
  yeniden temel alınır**. DRIFT çıkış kodunu **asla** değiştirmez; dolayısıyla hiç kimseyi engellemez.

```bash
npm run check:release-green                 # mevcut dal (çalışma ağacı)
node scripts/quality/validate-release-green.mjs --json   # yapılandırılmış çıktı
node scripts/quality/validate-release-green.mjs --quick  # unit+vitest'i atlar (yalnızca drift+typecheck+lint)
node scripts/quality/validate-release-green.mjs --with-build  # package-artifact'ı içerir (yavaş)
```

Yalnızca tanılama yapar ve **raporlar** (otomatik düzeltme yoktur). Yeşile düzeltme orkestrasyonu
`/green-prs` ve `/review-prs` içinde bulunur.

## Çözüm A — `/green-prs` (kuyruk taraması)

Prosedür (özet — ayrıntılar için `green-prs` becerisine bakın):

1. Aktif sürüm dalına yönelik açık PR kuyruğunun **envanterini çıkarın**.
2. Her PR'ı **triyajdan geçirin** (uygulanabilir / reddedilmeye uygun / yazar müdahalesi gerekli) — reddedilmeye uygun/yazar müdahalesi gerekli olanlar
   **raporlanır, kapatılmaz** (kararı yazar verir).
3. Her uygulanabilir PR'ı **yalıtılmış bir worktree** içinde (Kural #19) sürüm dalının en son noktasına taşıyın ve
   `npm run check:release-green` komutunu çalıştırın:
   - **HARD** → ortak yazarlık yoluyla **katkıda bulunan kişinin dalında** düzeltin (yazarın "Merged" durumunu korur),
     tüm HARD sonuçları giderilene kadar yeniden çalıştırın.
   - **DRIFT** → olduğu gibi bırakın; sürüm sırasında yeniden temel alınacaktır.
4. PR × (karar, HARD sonuçları, düzeltildi mi?, DRIFT, şu anda release-green mi?) tablosunu **raporlayın**.

Kuyruğu birleştirme yapmadan **hazırlayabilir**; yalnızca açıkça istendiğinde birleştirir ve hiçbir PR'ı kapatmaz.

## Önerilen çalışma sıklığı

- **`/green-prs` komutunu düzenli aralıklarla** (ör. haftalık) ve **her
  `/generate-release` öncesinde** çalıştırın.
- Sürekli bir sinyal olarak **`nightly-release-green.yml`** dosyasını (Çözüm D) koruyun: bir
  HARD başarısızlık sorunu açtığında tarama zamanı gelmiştir.
- Bir dalı veya belirli bir birleştirme adayını kontrol etmek için gerektiğinde **`/validate-release-green`** kullanın.
- Belirli bir PR'ın canlı CI üzerinde yeşile ulaştırılması gerektiğinde **`/babysit <PR#>`** kullanın.

## Sürümle ilişkisi

- `/generate-release`, doğrulamayı **Aşama 0'da (ön kontrol)** çağırır: sürüm PR'ını açmadan önce DRIFT sonuçlarını yeniden temel alır ve
  HARD sonuçlarını düzeltir.
- `/review-prs`, birleştirme kararı adımında release-green kapısını kullanır (birleştirmeden önce yeşil).

Tüm parçaların amacı aynıdır: sürüm gününde 40 dakikalık katmanlar hâlinde başarısız sonuçların peşinde koşmak yerine **ilk CI çalıştırmasında yeşil bir sürüm PR'ı** elde etmek.
