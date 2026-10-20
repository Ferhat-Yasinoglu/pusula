# Free Proxies API (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/FREE_PROXIES_API.md) · 🇩🇪 [de](../../../de/docs/reference/FREE_PROXIES_API.md) · 🇮🇷 [fa](../../../fa/docs/reference/FREE_PROXIES_API.md)

---

Pusula, harici sağlayıcılardan (1proxy, proxifly, iplocate, webshare) senkronize edilen, özenle seçilmiş ücretsiz proxy havuzunu `free_proxies` tablosunda sunar.
Kontrol paneli bunları **Ayarlar → Ücretsiz Proxy'ler** altında gösterir. Bu belge,
liste rotasının sunduğu sunucu taraflı filtreleme, sıralama, sayma ve senkronizasyon hatası raporlamasını
kapsar.

## Liste rotası — `GET /api/settings/free-proxies`

Filtrelenmiş, sıralanmış ve sayfalandırılmış bir kesitle birlikte toplam sayıyı döndürür. Filtreleme ve
sayma işlemleri SQL'de gerçekleşir; böylece kullanıcı arayüzü, her satırı belleğe yüklemeden
gerçek toplamı (ör. `Toplam: 0`) gösterebilir.

### Sorgu parametreleri

| Parametre         | Tür                                | Varsayılan | Anlamı                                                                                                       |
| ----------------- | ---------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `search`          | string                             | `""`       | Host (ve kaynak) sütununda büyük/küçük harfe duyarlı `LIKE`.                                                 |
| `protocol`        | string                             | `""`       | `type` filtresi: `http` / `https` / `socks4` / `socks5`. Boş = tümü.                                         |
| `country`         | string                             | `""`       | `countryCode` filtresi (ISO-2). Boş = tümü.                                                                  |
| `minQuality`      | number                             | `0`        | Yalnızca `qualityScore >= minQuality` olan satırlar. `0` = alt sınır yok.                                    |
| `disabledSources` | string                             | `""`       | Hariç tutulacak, virgülle ayrılmış kaynak kimlikleri (ör. `proxifly,webshare`).                              |
| `sortBy`          | `quality` \| `latency` \| `recent` | `quality`  | `quality` = puan azalan; `latency` = gecikme artan (null değerler sonda); `recent` = `lastValidated` azalan. |
| `offset`          | number                             | `0`        | Sayfalandırma başlangıcı.                                                                                    |
| `limit`           | number                             | `50`       | Sayfa boyutu (sunucu tarafında sınırlandırılır).                                                             |

### Yanıt

```json
{
  "success": true,
  "data": {
    "proxies": [/* FreeProxyRecord[] */],
    "total": 137,
    "hasMore": true
  },
  "stats": {
    "total": 137,
    "inPool": 12,
    "avgQuality": 64.2,
    "bySource": [{ "source": "1proxy", "count": 90 }],
    "lastSyncAt": "2026-07-11T09:30:00.000Z"
  },
  "syncErrors": {
    "proxifly": ["Üst kaynaktan HTTP 429"],
    "webshare": ["ağ zaman aşımı"]
  }
}
```

`total`, sayfalandırmadan **önceki** filtrelenmiş toplamı yansıtır; böylece kullanıcı arayüzü
`Toplam: N` ve `hasMore` değerlerini birbirinden bağımsız olarak görüntüleyebilir. `syncErrors`, kaynak kimliğine göre
anahtarlanır ve yalnızca son senkronizasyonu başarısız olan kaynaklar için doldurulur — `Toplam: 0` sonucu
hiçbir zaman açıklamasız bırakılmaz.

## Havuza ekleme — `POST /api/settings/free-proxies/[id]/add-to-pool`

Ücretsiz bir proxy'yi yönetilen `proxy_registry` havuzuna yükseltir. Önce
üst kaynağı doğrular; başarılı olduğunda yeni havuz proxy kimliğini ve ölçülen gecikmeyi döndürür.

## Senkronizasyon — `POST /api/settings/free-proxies/sync`

Etkinleştirilmiş tüm kaynakları (veya `{ "sources": [...] }` içindeki alt kümeyi) yeniden çeker. Her
kaynak bağımsız olarak senkronize edilir; başarısız olan bir kaynak `syncErrors` içine kaydedilir ve
diğerleri tamamlanmaya devam eder, böylece kısmi senkronizasyonlar önceki geçerli verileri hiçbir zaman silmez.

## İstatistikler — `GET /api/settings/free-proxies/stats`

Satır yükü olmadan `total / inPool / avgQuality / bySource / lastSyncAt` toplamlarını
döndürür — kontrol paneli başlık bileşenleri tarafından kullanılır.
