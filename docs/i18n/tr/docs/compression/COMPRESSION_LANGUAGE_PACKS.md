# Compression Language Packs (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../compression/COMPRESSION_LANGUAGE_PACKS.md) · 🇩🇪 [de](../../../de/docs/compression/COMPRESSION_LANGUAGE_PACKS.md) · 🇮🇷 [fa](../../../fa/docs/compression/COMPRESSION_LANGUAGE_PACKS.md)

---

Caveman sıkıştırması, yerleşik İngilizce kurallara ek olarak dile özgü kural paketlerini yükleyebilir.
Bu, temel motoru kararlı tutarken Portekizce, İspanyolca, Almanca, Fransızca, İtalyanca, Japonca ve
gelecekteki dil paketlerinin bağımsız olarak gelişmesine olanak tanır.

## Konum

Dil paketleri şu dizinin altında bulunur:

```txt
open-sse/services/compression/rules/<language>/
```

Mevcut olarak sunulan paketler (`rules/` dizininin içeriğiyle doğrulanmıştır):

| Dil                   | Dizin          | Mevcut kural kategorileri                           |
| --------------------- | -------------- | --------------------------------------------------- |
| İngilizce             | `rules/en/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| İspanyolca            | `rules/es/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| Portekizce (Brezilya) | `rules/pt-BR/` | `context`, `dedup`, `filler`, `structural`, `ultra` |
| Endonezce             | `rules/id/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| İtalyanca             | `rules/it/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| Almanca               | `rules/de/`    | `context`, `filler`, `structural`                   |
| Fransızca             | `rules/fr/`    | `context`, `filler`, `structural`                   |
| Japonca               | `rules/ja/`    | `context`, `filler`, `structural`                   |

> **Eşitlik notu:** `en`, `es`, `pt-BR`, `id` ve `it` paketleri 5 kategorinin tamamına sahiptir; `de`, `fr`, `ja` ise 3 kategoriyle sunulur. Eksik `dedup` ve `ultra` kategorileri sessizce yerleşik İngilizce kurallara geri döner. Daha küçük paketlere `dedup.json` ve `ultra.json` eklemek için katkılarınızı bekliyoruz.
>
> `pt-BR` paketi, Lenine Júnior tarafından geliştirilen **[Troglodita](https://github.com/leninejunior/troglodita)** temel alınarak hazırlanmıştır — Brezilya Portekizcesi dilbilgisi için sıfırdan tasarlanmış bir sıkıştırma sistemidir (gereksiz yineleme azaltma, PT-BR dolgu ifadelerini kaldırma, Brezilyalı geliştirici topluluğuna yönelik teknik kısaltmalar).
>
> Standart kategori listesi ve kategori başına şema [`open-sse/services/compression/rules/_schema.json`](../../open-sse/services/compression/rules/_schema.json) dosyasında bulunur (JSON Schema taslağı 2020-12).

## Dil Algılama

`languageDetector.ts`, istem metninden dili belirlemek için basit sezgisel yöntemler kullanır. Yapılandırılmış
varsayılan dil yine dikkate alınır ve kesin denetim gerektiğinde algılama, yapılandırma üzerinden devre dışı
bırakılabilir.

Algılama çıktısı yalnızca kural paketlerini seçmek için kullanılır. Sağlayıcı yönlendirmesini, yerel ayar
seçimini veya kullanıcı arayüzü dilini değiştirmez.

## Yapılandırma Biçimi

Sıkıştırma ayarları şunları içerebilir:

```json
{
  "languageConfig": {
    "enabled": true,
    "defaultLanguage": "en",
    "autoDetect": true,
    "enabledPacks": ["en", "pt-BR", "es", "id", "de", "fr", "ja"]
  },
  "cavemanConfig": {
    "language": "en",
    "autoDetectLanguage": true,
    "enabledLanguagePacks": ["en", "pt-BR", "es", "id", "de", "fr", "ja"]
  }
}
```

`languageConfig`, kontrol paneli/önizleme varsayılanlarını denetler. `cavemanConfig`, Caveman mesaj metnini
sıkıştırırken kullanılan çalışma zamanı motoru yapılandırmasıdır.

## Dil Paketi Ekleme

1. `open-sse/services/compression/rules/<language>/<pack>.json` dosyasını oluşturun.
2. `docs/compression/COMPRESSION_RULES_FORMAT.md` içindeki Caveman kural biçimini kullanın.
3. Değişiklikleri ölçülü tutun ve kodu, tanımlayıcıları, URL'leri veya JSON'u değiştirmekten kaçının.
4. Dil seçimi ve değiştirme davranışı için testler ekleyin veya mevcut testleri güncelleyin.
5. Dil, kullanıcı arayüzü seçicilerinde görünüyorsa yeni pano/i18n etiketlerini kullanıma sunun.

## API

Kullanılabilir paketler şu şekilde sorgulanabilir:

```bash
curl http://localhost:20128/api/compression/language-packs
```

Önizleme uç noktası, dil yapılandırması geçersiz kılmalarını kabul eder:

```bash
curl -X POST http://localhost:20128/api/compression/preview \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "standard",
    "text": "Por favor, eu gostaria que voce basicamente resumisse isso.",
    "config": {
      "languageConfig": {
        "defaultLanguage": "pt-BR",
        "autoDetect": true
      }
    }
  }'
```

## SHARED_BOUNDARIES (v3.8.0)

6 dil paketinin tamamı v3.8.0'da her Caveman yoğunluğunda (LITE, FULL, ULTRA) uygulanan bir `SHARED_BOUNDARIES` maddesi aldı. Bu madde, çevresindeki dolgu ifadelerinin kaldırılmasından bağımsız olarak motorun şu kalıpları olduğu gibi korumasını sağlar:

| Kalıp türü                      | Örnek                                  |
| ------------------------------- | -------------------------------------- |
| Çitle çevrili kod blokları      | ` ```python\n...\n``` `                |
| Satır içi kod                   | `` `my_var` ``                         |
| URL'ler                         | `https://example.com/path`             |
| Dosya yolları (mutlak + göreli) | `/etc/hosts`, `./src/index.ts`         |
| Hata başlıkları                 | `Error:`, `TypeError:`, `SyntaxError:` |
| Yığın izleme satırları          | `  at functionName (file.ts:12:3)`     |

Bu kalıplar, `DEFAULT_CAVEMAN_CONFIG.preservePatterns` içinde doldurulur (önceden `[]` idi). Sabit, `open-sse/services/compression/types.ts` içinde yer alır.

### Bunun önemi

SHARED_BOUNDARIES olmadan, agresif Caveman modları yinelenen düz yazı gibi görünen ancak aslında kod parçacığı, dosya yolu veya hata yığını olan içeriği kaldırabilirdi. SHARED_BOUNDARIES, dolgu kuralları çalıştırılmadan önce uygulanan, dilden bağımsız bir güvenlik ağı görevi görür.

### preservePatterns'ı özelleştirme

Sıkıştırma ayarları aracılığıyla çalışma zamanında ek kalıplar eklenebilir:

````json
{
  "cavemanConfig": {
    "preservePatterns": [
      "```[\\s\\S]*?```",
      "`[^`]+`",
      "https?://\\S+",
      "(?:/|\\./)[^\\s]+",
      "\\b(?:Error|TypeError|SyntaxError|RangeError):",
      "\\s+at\\s+\\S+\\s+\\(\\S+:\\d+:\\d+\\)"
    ]
  }
}
````

Özel kalıplar, 6 varsayılan kalıbın yerine geçmez; onları genişletir.

---

## Operasyonel Notlar

- Bir dil paketi eksik olduğunda yerleşik İngilizce kurallar yedek seçenek olarak kullanılmaya devam eder.
- Geçersiz yerleşik JSON paketleri doğrulamada başarısız olur; böylece sürüm varlıklarının kalitesi sessizce düşmez.
- Kural paketleri yalnızca veri içermelidir ve kod içe aktarmamalı veya rastgele mantık çalıştırmamalıdır.
- Sıkıştırma analitiği katmanı, tam istem metnini değil, seçilen modu ve motoru kaydeder.
