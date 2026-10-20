# Local Corpus Context Source (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/LOCAL_CORPUS_CONTEXT.md) · 🇩🇪 [de](../../../de/docs/frameworks/LOCAL_CORPUS_CONTEXT.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/LOCAL_CORPUS_CONTEXT.md)

---

> **Doğruluk kaynağı:** `src/lib/localCorpus/index.ts` (sınırlandırılmış metin dizini),
> `src/lib/localCorpus/configured.ts` (yapılandırılmış çalışma zamanı),
> `src/lib/db/localCorpus.ts` (kök yol kalıcılığı),
> `open-sse/mcp-server/tools/localCorpusTools.ts` (3 salt okunur MCP aracı) ve
> `src/app/api/settings/local-corpus/route.ts` (ayarlar API'si).

## Nedir?

Local Corpus, bir operatörün açıkça onaylanmış tek bir metin dosyaları dizinini
Pusula'un MCP sunucusuna sunmasına olanak tanır. Dosyalar özgün dizinlerinde kalır:
Pusula, SQLite'ta yalnızca kanonik kök yolu depolar ve bellek içi bir arama dizini
tutar. Corpus içeriğini depoya veya veritabanına kopyalamaz.

Dizin yenileme işlemi artımlıdır. Değişmeyen dosyalar boyut ve değiştirilme zamanına
göre yeniden kullanılır, değişen dosyalar yeniden okunur ve SHA-256 ile özetlenir,
silinen dosyalar ise kaldırılır. Arama, 30 saniyeden eski bir dizini yeniler; çağıranlar
ayrıca anında yenileme isteğinde bulunabilir.

## Kaynağı yapılandırma

Ayarlar rotası, diğer ayarlar API'leriyle aynı yönetim kimlik doğrulamasını gerektirir.
Gönderilen yol hâlihazırda mevcut olmalı ve mutlak bir dizin yolu olmalıdır.

```bash
# Onaylanmış bir dizini bağlayın
curl -X POST http://localhost:20128/api/settings/local-corpus \
  -H "Content-Type: application/json" \
  -d '{"rootPath":"/absolute/path/to/approved-text"}'

# Yapılandırmayı ve dizin durumunu kontrol edin
curl http://localhost:20128/api/settings/local-corpus

# Kaynak dosyaları değiştirmeden bağlantıyı kesin
curl -X DELETE http://localhost:20128/api/settings/local-corpus
```

## MCP araçları

Üç aracın tümü `read:local-corpus` gerektirir. Araç yanıtları mutlak yolu hiçbir zaman
göstermez; yalnızca göreli yolları ve kök dizinin temel adını gösterir.

| Araç                  | Açıklama                                                                                                        |
| :-------------------- | :-------------------------------------------------------------------------------------------------------------- |
| `local_corpus_status` | Yapılandırma durumunu, dizin boyutunu, sınırları ve son yenileme zamanını bildirir                              |
| `local_corpus_search` | Dizine alınmış metinde arama yapar ve satır kapsamlı, sınırlandırılmış parçacıklar döndürür (en fazla 20 sonuç) |
| `local_corpus_read`   | İzin verilen, corpus'a göreli bir dosyadan sınırlandırılmış bir satır aralığı okur                              |

Örnek MCP girdileri:

```json
{ "query": "Red River monitoring", "limit": 10, "refresh": false }
```

```json
{ "relativePath": "hydrology/stations.md", "startLine": 20, "endLine": 80 }
```

## Güvenlik sınırları

- İzin verilenler listesi metin odaklıdır: `.cfg`, `.csv`, `.geojson`, `.htm`, `.html`,
  `.js`, `.json`, `.jsonl`, `.jsx`, `.log`, `.md`, `.mjs`, `.ps1`, `.py`, `.sh`,
  `.sql`, `.toml`, `.ts`, `.tsx`, `.txt`, `.xml`, `.yaml` ve `.yml`.
- Sembolik bağlantılar atlanır. Okuma yolları kanonikleştirilir ve yapılandırılmış kök
  içinde kalmalıdır; mutlak yollar ve dizin geçişi girişimleri reddedilir.
- Hassas ve oluşturulmuş dizin adları hariç tutulur: `.build`, `.codex`, `.env`,
  `.git`, `.next`, `.pusula`, `.ssh`, `coverage`, `dist`, `node_modules` ve
  `secrets`.
- Varsayılan sınırlar 5.000 dosya, dosya başına 1 MiB, toplam 64 MiB dizine alınmış
  içerik, arama parçası başına yaklaşık 4.000 karakter ve okuma başına 400 satırdır.
- NUL içeren dosyalar metin dışı kabul edilir ve atlanır veya reddedilir.

PDF, DOCX, görüntüler ve arşivler gibi ikili belgeler kasıtlı olarak desteklenmez.
Dizine almadan önce bunları yapılandırılmış dizin içinde onaylanmış bir metin biçimine
dönüştürün.

## Operasyonel notlar

- Yapılandırılmış kökün değiştirilmesi veya silinmesi, paylaşılan bellek içi dizini
  temizler.
- İşlem yeniden başlatıldığında dizin atılır; bir sonraki arama, dizini yapılandırılmış
  kaynaktan yeniden oluşturur.
- `local_corpus_status` taramayı zorlamaz. Anında yeniden tarama gerektiğinde
  `refresh: true` ile `local_corpus_search` kullanın.
- Tarama ve okuma hataları sayılır veya arındırılmış hatalar olarak döndürülür; kaynak
  dosyalar hiçbir zaman değiştirilmez.
