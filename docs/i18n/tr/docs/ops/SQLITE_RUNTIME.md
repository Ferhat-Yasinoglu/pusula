# SQLite Runtime Resolution (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/SQLITE_RUNTIME.md) · 🇩🇪 [de](../../../de/docs/ops/SQLITE_RUNTIME.md) · 🇮🇷 [fa](../../../fa/docs/ops/SQLITE_RUNTIME.md)

---

Pusula, başlangıçta SQLite sürücüsünü 5 adımlı bir geri dönüş zinciri aracılığıyla çözümler:

1. **Paketle birlikte gelen `better-sqlite3`** (`package.json` içindeki `dependencies` aracılığıyla)
   — en hızlı seçenektir; yerel ikili dosyayı kullanır ve derleme araçları mevcut olduğunda `npm install` tarafından yüklenir.

2. **Çalışma zamanında yüklenen `better-sqlite3`** (`~/.pusula/runtime/` içinde)
   — ilk çalıştırmada **VEYA** `scripts/build/postinstall.mjs → scripts/postinstall.mjs` tarafından gerektiğinde yüklenir.
   Bozuk veya yanlış platforma ait ikili dosyalara karşı koruma sağlamak amacıyla yüklemeden önce
   yerel `.node` sihirli baytlarını (ELF / Mach-O / PE) doğrular.

3. **`node:sqlite`** (Node ≥22.5 standart kitaplığı) — yerel derleme gerektirmez; her iki
   better-sqlite3 yolu da başarısız olduğunda kullanılır. Sınırlı bir özellik kümesine sahiptir.

4. **`sql.js`** (WASM) — son geri dönüş seçeneğidir. Her yerde çalışır ancak daha yavaştır
   ve verileri eşzamanlı olarak değil, belirli aralıklarla yazar.

## Bu karmaşıklık neden gerekli?

- **Windows EBUSY**: Önceki sürümün `better_sqlite3.node` dosyası çalışan bir işlem
  tarafından kilitlenmişse `npm install -g pusula@latest` başarısız olabilir. Çalışma zamanı
  yüklemesinin `~/.pusula/runtime/` içinde yapılması, global npm önbelleğini devre dışı bırakır.
- **Derleme araçlarının bulunmaması**: Bazı ortamlar (VS Build Tools bulunmayan kurumsal Windows
  sistemleri, minimal Docker imajları) `better-sqlite3` paketini derleyemez. Çalışma zamanı
  yükleyicisi npm kayıt defterinden önceden derlenmiş bir ikili dosya çözümler; geri dönüş
  sürücüleri ise bu işlem başarısız olsa bile Pusula'un başlatılabilmesini sağlar.
- **İnternete kapalı sistemler**: npm kayıt defterine erişilemiyorsa `node:sqlite`
  veya `sql.js`, temel işlevselliği garanti eder.

## Sihirli bayt doğrulaması

Pusula, çalışma zamanında yüklenmiş bir `.node` dosyasını yüklemeden önce ilk 8
baytı okur ve bilinen platform sihirli değerleriyle eşleştirir:

| Platform             | Baytlar (onaltılık) | Etiket      |
| -------------------- | ------------------- | ----------- |
| Linux                | `7F 45 4C 46`       | `elf`       |
| macOS 64 bit BE      | `FE ED FA CF`       | `macho`     |
| macOS 64 bit LE      | `CF FA ED FE`       | `macho-le`  |
| macOS fat (evrensel) | `CA FE BA BE`       | `macho-fat` |
| Windows              | `4D 5A` (MZ)        | `pe`        |

Sihirli değer eşleşmezse dosya yok sayılır ve geri dönüş zincirindeki bir sonraki adıma geçilir.

## Etkin sürücüyü kontrol etme

```typescript
import { getDriverInfo } from "@/lib/db/core";

const info = getDriverInfo();
// { source: "bundled" | "runtime" | "runtime-installed-now" | "node-sqlite" | "sql-js",
//   kind: "better-sqlite3" | "node-sqlite" | "sql-js" }
```

## Manuel kontrol

```bash
# Hızlı CI yüklemeleri için yükleme sonrası hazırlığı atla
PUSULA_SKIP_POSTINSTALL=1 npm install -g pusula

# Çalışma zamanı better-sqlite3 paketini yeniden yüklemeye zorla
rm -rf ~/.pusula/runtime
pusula  # bir sonraki başlatmada yeniden yüklenir

# Hangi sürücünün etkin olduğunu kontrol et
pusula config db-info  # (CLI komutu mevcutsa)
```

## Referans

Uygulama:

- `bin/cli/runtime/magicBytes.mjs` — ikili dosya sihirli baytlarını doğrulama yardımcıları
- `bin/cli/runtime/sqliteRuntime.mjs` — 5 adımlı çalışma zamanı çözümleyicisi + gerektiğinde yükleyici
- `bin/cli/runtime/index.mjs` — başlangıç düzenleyicisi (`warmUpRuntimes()`)
- `scripts/postinstall.mjs` — npm yükleme sonrası kancası (başarısızlığı kritik olmayan hazırlık)
- `src/lib/db/core.ts` — `ensureDbInitialized()` / `getDriverInfo()` dışa aktarımları

## Tek yazıcılı topoloji (HA desteklenmez)

Yukarıdaki sürücü geri dönüş zinciri yine de **tek bir işlemde** çalışır. Varsayılan SQLite
yapılandırmasında Pusula **tek yazıcılıdır**:

- İki Pusula replikasını aynı `storage.sqlite` dosyasına bağlamayın.
- Bir konteynerin yeniden başlatılması, Recreate dağıtımı, OOM nedeniyle sonlandırma veya HEALTHCHECK
  yeniden başlatması, devam eden tüm SSE oturumlarını sonlandırır. Standart çalışma yolunda oturumların kontrollü biçimde boşaltılması yoktur.
- Yavaş bir `/healthz` yanıtını sistemin çalışmadığı şeklinde yorumlayan orkestratör canlılık kontrolü, tek
  replikayı sonlandırır. TCP canlılık kontrolü + HTTP `/healthz` hazır olma kontrolünü tercih edin. Bkz.
  [Docker Kılavuzu — kullanılabilirlik](../guides/DOCKER_GUIDE.md#availability-default-sqlite-is-single-replica)
  ve [Kubernetes probe önerileri](./MONITORING_GUIDE.md#kubernetes-probe-recommendations).
