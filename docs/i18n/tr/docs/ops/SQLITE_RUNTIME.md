# SQLite Runtime Resolution (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/SQLITE_RUNTIME.md) · 🇩🇪 [de](../../../de/docs/ops/SQLITE_RUNTIME.md) · 🇮🇷 [fa](../../../fa/docs/ops/SQLITE_RUNTIME.md)

---

Pusula, başlangıçta SQLite sürücüsünü 5 adımlı bir geri dönüş zinciri üzerinden çözümler:

1. **Paketle birlikte gelen `better-sqlite3`** (`package.json` içindeki `dependencies` aracılığıyla)
   — en hızlı seçenektir, yerel ikili dosya kullanır ve derleme araçları mevcut olduğunda `npm install` tarafından yüklenir.

2. **Çalışma zamanında yüklenen `better-sqlite3`** (`~/.pusula/runtime/` içinde)
   — ilk çalıştırmada **VEYA** `scripts/build/postinstall.mjs → scripts/postinstall.mjs` tarafından ihtiyaç üzerine yüklenir.
   Bozuk veya yanlış platforma ait ikili dosyalara karşı koruma sağlamak için yüklemeden önce
   yerel `.node` sihirli baytlarını (ELF / Mach-O / PE) doğrular.

3. **`node:sqlite`** (Node ≥22.5 standart kitaplığı) — yerel derleme gerektirmez; her iki
   better-sqlite3 yolu da başarısız olduğunda kullanılır. Sınırlı bir özellik kümesine sahiptir.

4. **`sql.js`** (WASM) — son geri dönüş seçeneğidir. Her yerde çalışır ancak daha yavaştır
   ve verileri eşzamanlı olarak değil, belirli aralıklarla yazar.

## Bu karmaşıklık neden gerekli?

- **Windows EBUSY**: Önceki sürümün `better_sqlite3.node` dosyası çalışan bir süreç
  tarafından kilitlenmişse `npm install -g pusula@latest` başarısız olabilir.
  `~/.pusula/runtime/` içindeki çalışma zamanı yüklemesi, genel npm önbelleğini devre dışı bırakır.
- **Derleme araçlarının olmaması**: Bazı ortamlar (VS Build Tools bulunmayan kurumsal
  Windows sistemleri, minimal Docker imajları) `better-sqlite3` paketini derleyemez. Çalışma zamanı
  yükleyicisi, npm kayıt defterinden önceden derlenmiş bir ikili dosyayı çözümler; geri dönüş
  sürücüleri ise bu işlem başarısız olsa bile Pusula'un başlatılabilmesini sağlar.
- **Ağdan yalıtılmış sistemler**: npm kayıt defterine erişilemiyorsa `node:sqlite`
  veya `sql.js`, temel işlevselliği garanti eder.

## Sihirli bayt doğrulaması

Pusula, çalışma zamanında yüklenmiş bir `.node` dosyasını yüklemeden önce ilk 8
baytı okur ve bunları bilinen platform sihirli değerleriyle eşleştirir:

| Platform             | Baytlar (hex) | Etiket      |
| -------------------- | ------------- | ----------- |
| Linux                | `7F 45 4C 46` | `elf`       |
| macOS 64 bit BE      | `FE ED FA CF` | `macho`     |
| macOS 64 bit LE      | `CF FA ED FE` | `macho-le`  |
| macOS fat (evrensel) | `CA FE BA BE` | `macho-fat` |
| Windows              | `4D 5A` (MZ)  | `pe`        |

Sihirli değer eşleşmezse → dosya yok sayılır ve geri dönüş zincirindeki bir sonraki adıma geçilir.

## Etkin sürücüyü kontrol etme

```typescript
import { getDriverInfo } from "@/lib/db/core";

const info = getDriverInfo();
// { source: "bundled" | "runtime" | "runtime-installed-now" | "node-sqlite" | "sql-js",
//   kind: "better-sqlite3" | "node-sqlite" | "sql-js" }
```

## Manuel kontrol

```bash
# Hızlı CI kurulumları için postinstall ön ısıtmasını atla
PUSULA_SKIP_POSTINSTALL=1 npm install -g pusula

# Çalışma zamanı better-sqlite3 paketini yeniden yüklemeye zorla
rm -rf ~/.pusula/runtime
pusula  # bir sonraki başlangıçta yeniden yüklenir

# Hangi sürücünün etkin olduğunu kontrol et
pusula config db-info  # (CLI komutu mevcutsa)
```

## Eşzamanlı takılmaları tanılama

Eşzamanlı bağdaştırıcı zamanlamasını etkinleştirmek için `better-sqlite3` kullanırken
başlangıçtan önce `PUSULA_SQLITE_SLOW_MS=200` değerini ayarlayın. Varsayılan olarak
devre dışıdır. Tamamlanan bir işlem en az bu kadar milisaniye sürerse bağdaştırıcı
başına en fazla on saniyede bir `[SQLITE-SLOW]` uyarısı yayımlanır. Uyarı yalnızca
sürücüyü, işlem sınıfını (`prepare`, `get`, `all`, `run`, `exec`, `pragma`, işlem veya
bakım) ve geçen milisaniye sayısını içerir: SQL, bağlamalar, satırlar, yollar veya
istisna metni içermez.

Bu bir tanılama yardımcısıdır; zaman aşımı veya sorgu optimizasyonu değildir. Hiçbir
zaman dönmeyen bir işlemi bildiremez, CPU çalışmasını disk beklemelerinden ayıramaz,
tam SQL ifadesini belirleyemez veya ham sürücü tanıtıcısı üzerinden gerçekleştirilen
işlemleri gözlemleyemez. Eşzamansız yedekleme süresi özellikle kapsam dışı bırakılmıştır;
diğer SQLite sürücüleri bu isteğe bağlı ölçümle izlenmez. Değişkenin devre dışı
bırakılması, zamanlama sarmalayıcıları olmadan özgün bağdaştırıcıyı geri yükler.
Veritabanı şemasında veya depolanan yapılandırmada herhangi bir değişiklik yapılmaz.

`/healthz` gecikme uyarısı, kullanım ömrü ortalamasını değil, önceki örnekten bu yana
olay döngüsünde görülen en yüksek değeri bildirir. Bir takılmayı SQLite veya disk
arızasına bağlamadan önce zaman damgalarını yavaş işlem uyarıları ve ana makine/depolama
metrikleriyle ilişkilendirin.

## Referans

Uygulama:

- `bin/cli/runtime/magicBytes.mjs` — ikili dosya sihirli bayt doğrulama yardımcıları
- `bin/cli/runtime/sqliteRuntime.mjs` — 5 adımlı çalışma zamanı çözümleyicisi + ihtiyaç üzerine yükleyici
- `bin/cli/runtime/index.mjs` — başlangıç düzenleyicisi (`warmUpRuntimes()`)
- `scripts/postinstall.mjs` — npm yükleme sonrası kancası (başarısızlığı kritik olmayan ön ısıtma)
- `src/lib/db/core.ts` — `ensureDbInitialized()` / `getDriverInfo()` dışa aktarımları

## Tek yazıcılı topoloji (HA desteklenmez)

Yukarıdaki sürücü geri dönüş zinciri yine de **tek bir süreçte** çalışır. Varsayılan
SQLite yapılandırmasında Pusula **tek yazıcılıdır**:

- İki Pusula replikasını aynı `storage.sqlite` dosyasına bağlamayın.
- Bir konteyner yeniden başlatması, Recreate dağıtımı, OOM sonlandırması veya HEALTHCHECK
  yeniden başlatması, devam eden tüm SSE oturumlarını keser. Standart yolda oturumların
  kontrollü şekilde sonlandırılması yoktur.
- Yavaş bir `/healthz` yanıtını başarısızlık olarak değerlendiren orkestratör canlılık
  denetimi, tek replikayı sonlandırır. TCP canlılık denetimi + HTTP `/healthz` hazır olma
  denetimini tercih edin. Bkz.
  [Docker Kılavuzu — kullanılabilirlik](../guides/DOCKER_GUIDE.md#availability-default-sqlite-is-single-replica)
  ve [Kubernetes yoklama önerileri](./MONITORING_GUIDE.md#kubernetes-probe-recommendations).
