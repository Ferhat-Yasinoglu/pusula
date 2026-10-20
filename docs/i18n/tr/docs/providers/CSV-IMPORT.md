# Import providers from a CSV or JSON file (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CSV-IMPORT.md) · 🇩🇪 [de](../../../de/docs/providers/CSV-IMPORT.md) · 🇮🇷 [fa](../../../fa/docs/providers/CSV-IMPORT.md)

---

Dashboard → Providers → **Dosyadan içe aktar**, bir CSV veya JSON listesinden API anahtarı bağlantıları oluşturur. Her satır farklı bir sağlayıcıyı hedefleyebilir. Kısmi hata, sözleşmenin bir parçasıdır: diğerleri başarısız olsa bile geçerli satırlar içe aktarılır ve modal pencere, başarısız satırların neden reddedildiğini listeler.

Bu içe aktarma işlemi yeni OpenAI/Anthropic uyumlu uç nokta düğümleri oluşturmaz. Önce bunları oluşturun (Dashboard → Providers → Add OpenAI-Compatible veya `pusula nodes add`), ardından `provider` sütunu ilgili düğümün kimliği olan satırları içe aktarın. Satır başına bir `baseUrl`, düğümün URL'sini yine de geçersiz kılabilir.

## CSV (konumsal)

Sütun adları yalnızca görseldir. Ayrıştırıcı her satırı böler ve değerlere dizindeki konumlarına göre erişir:

| Dizin | Alan       | Zorunlu | Notlar                                                                                                                               |
| ----- | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0     | `provider` | evet    | Mevcut yönetilen sağlayıcı kimliği (`openai`, `anthropic`, …) **veya** önceden kaydedilmiş OpenAI/Anthropic uyumlu **düğüm** kimliği |
| 1     | `name`     | evet    | Bağlantının görünen adı                                                                                                              |
| 2     | `apiKey`   | evet    | API anahtarı                                                                                                                         |
| 3     | `baseUrl`  | hayır   | Satıra özel URL geçersiz kılma değeri                                                                                                |
| 4     | `priority` | hayır   | 1–100 arasında tam sayı                                                                                                              |

İlk sütunu (büyük/küçük harf fark etmeksizin) tam olarak `provider` sözcüğü olan ilk satır, başlık olarak atlanır. Boş satırlar ve `#` yorumları atlanır.

İçe aktarma modal penceresinden bir başlangıç dosyası indirin (**CSV şablonunu indir**). Örnek:

```csv
# Pusula sağlayıcı içe aktarma dosyası (konumsal sütunlar)
provider,name,apiKey,baseUrl,priority
openai,Prod OpenAI,sk-your-openai-key,,1
```

`openai-compatible-chat-001` gibi uydurma bir kimlik, düğüm değildir. API bu satır için `Unknown or unsupported provider` hatasını döndürür; modal pencere bunu satır adının yanında gösterir.

## JSON

Aynı alanları (`provider`, `name`, `apiKey`, `baseUrl?`, `priority?`) içeren nesnelerden oluşan bir JSON dizisi. CSV'den farklı olarak JSON anahtarları adlandırılmıştır.

```json
[
  {
    "provider": "openai",
    "name": "Prod OpenAI",
    "apiKey": "sk-your-openai-key",
    "priority": 1
  }
]
```
