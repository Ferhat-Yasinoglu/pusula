# Merge Queue & Manual Merge-Train Runbook (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/MERGE_TRAIN.md) · 🇩🇪 [de](../../../de/docs/ops/MERGE_TRAIN.md) · 🇮🇷 [fa](../../../fa/docs/ops/MERGE_TRAIN.md)

---

v3.8.49'dan (kalite/hız planının WS3.2/WS3.4'ü) bu yana, incelenmiş PR'ların
`release/vX.Y.Z` dalına varsayılan birleştirme yolu **Mergify birleştirme kuyruğudur**
(`.mergify.yml`); aşağıda belgelenen **manuel birleştirme treni** ise olaylar,
sürüm dondurmaları sırasında veya Mergify Open Source planı değişirse kullanılan YEDEK YOLDUR.

## Varsayılan yol: Mergify kuyruğu

1. PR, kampanyalar tarafından incelenir/yeşil duruma getirilir ve sahibinin birleştirme
   öncesi ⭐ kapısından onay alır (rapor + öğe başına karar — bkz. `/merge-prs` Adım 0.75).
2. Sahip (veya sahibin kararına göre hareket eden oturum) **`queue`** etiketini uygular.
   Etiket, birleştirme onayının KENDİSİDİR; Mergify yalnızca bunu yürütür.
3. Mergify, kuyruğa alınmış en fazla 10 PR'ı gruplar, grubu hızlı kapılara göre doğrular
   ve birleştirir (squash). Kırmızı bir grup **otomatik olarak ikiye bölünür** — soruna
   neden olan PR, yaklaşık log2(N) yeniden doğrulamayla yalıtılır ve kuyruktan çıkarılır;
   geri kalanlar devam eder.
4. Birleştirme sonrasında sürekli release-green iş akışı, push sırasında yeni uç
   noktasını doğrular ve kombinasyon gerilemeye yol açtıysa bir ilişkilendirme issue'su
   açar (asla otomatik geri alma yapmaz).

Korkuluklar (`CLAUDE.md` Katı Kuralları #21/#22 ile aynıdır):

- **Sürüm dondurması etkin** → dondurulmuş dalı hedefleyen PR'ları etiketlemeyin;
  önce etkin `release/vX+1` dalına yeniden hedefleyin.
- **Başka bir oturumun devam eden PR'ı** → bunu asla etiketlemeyin; yalnızca sahibi
  olan oturum kendi çalışmasını kuyruğa alır.
- Yalnızca test değişiklikleri içeren ve `hotfix` etiketi taşıyan PR'lar zaten
  azaltılmış CI çalıştırır (bkz. `RELEASE_CHECKLIST.md` → Hotfix Fast-Lane);
  kuyruk koşulları gerçekten çalışmış olan kontrol kümesini kabul eder
  (`#check-failure=0` + `#check-pending=0`).

## Yedek yol: manuel birleştirme treni

Kuyruk kullanılamadığında kullanılır. Bu, v3.8.47 döngüsü sırasında bir günde 33 PR'ı
tamamlayan uygulamayı standartlaştırır:

1. **Grubu oluşturun** (yaklaşık 10–30 incelenmiş+onaylanmış PR). `linked:`
   çakışmalarını (aynı `tap.testFiles`, aynı CHANGELOG bölümleri) kontrol edin ve
   bunları sırayla işleyin.
2. **BİR KEZ doğrulayın**: sürüm dalının ucundan oluşturulmuş yalıtılmış bir
   worktree'de tüm grup başlarını yerel olarak birleştirin, ardından sürümle eşdeğer
   paketi çalıştırın (`npm run check:release-green`; sürümden önce `--with-build`
   ekleyin). `scripts/release/merge-train.sh <base> <PR#>…`, 1–2. adımları otomatikleştirir
   (çakışan PR'lar çıkarılır, tren devam eder). Tam mod, `npm run test:unit` komutunu
   çalıştırır — 16 çekirdekli bir makinenin baskın aşamada yaklaşık %25 kapasiteyle
   çalışmasına neden olan iki sıralı 4 çekirdekli CI shard'ını değil, makine için
   ayarlanmış runner'ı (`--test-concurrency=20`) kullanır (2026-07-18 tarihinde
   düzeltildi). `--fast` (gün içi mega tren boşaltmaları, sahip tarafından
   2026-07-18 tarihinde onaylandı) her statik kapıyı + vitest'i korur ancak yalnızca
   trene alınan PR'lar tarafından değiştirilmiş node:test dosyalarını çalıştırır;
   TAM paket yine de biriken uç üzerinde günde en az bir kez çalıştırılmalıdır
   (`--fast` olmadan bir tren).
3. **Yeşil** → PR'ları sırayla birleştirin (her birinden önce `state,headRefOid`
   değerlerini yeniden kontrol edin — başı değişmiş bir PR yeniden incelemeye girer).
   Her birleştirmenin net diff'inin PR'ın kendi değişikliği olduğunu kanıtlayın
   (otomatik çözümlemeyle geri alma yoktur: kapsam dışı silmeler için
   `git diff --stat` çıktısını denetleyin).
4. **Kırmızı** → tek tek yeniden doğrulamak yerine grubu yarılara bölün (her yarıyı
   doğrulayın); soruna neden olan PR'ı kanıtlarla birlikte inceleme kuyruğuna geri
   gönderin.
5. **Asla yapmayın**: dondurma sırasında dondurulmuş dala birleştirme; herhangi bir
   yerde `git stash`; kırmızı bir sonucun kaybolacağını umarak CI'ı topluca yeniden
   çalıştırma (kural: kırmızı sonuç bilgidir).

## Katmanlandırma (kuyruğun yalnızca hızlı kapılarla neden güvenli olduğu)

- **PR başına** (quality.yml hızlı kapıları): TIA'dan etkilenen testler + tam birim
  4-shard + vitest + lint paketi + typecheck + dokümantasyon/changelog bütünlüğü.
- **Grup/uç başına** (sürekli release-green): sürüm dalına yapılan her push'ta
  `--quick` KATI kapıları; günde 3 kez tam `--with-build --full-ci` taramaları.
- **Sürüm başına** (sürüm PR'ındaki ci.yml): E2E ×9, package-artifact + tarball
  boot-smoke ve coverage/ratchets dahil eksiksiz matris.

Hiçbir şey eskisinden daha az doğrulanmaz — ağır yüzey yalnızca PR başına değil,
grup/uç başına çalışır; O(N) gidiş gelişleri ortadan kaldıran da budur.
