# Monitoring & Costs — Navigation Structure (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../architecture/MONITORING_SECTIONS.md) · 🇩🇪 [de](../../../de/docs/architecture/MONITORING_SECTIONS.md) · 🇮🇷 [fa](../../../fa/docs/architecture/MONITORING_SECTIONS.md)

---

> Grup B'de (plan 16) uygulandı. Bkz. `src/shared/constants/sidebarVisibility.ts`.

---

## Üst Düzey Gezinme

Pano kenar çubuğu (Grup B sonrasında) sırasıyla şu üst düzey bölümleri içerir:

```
Ana Sayfa
Sağlayıcılar
Kombolar
API Anahtarları
Ayarlar
Analizler
Maliyetler      ← YENİ (Grup B, plan 16)
İzleme           ← YENİDEN DÜZENLENDİ (Grup B, plan 16)
...
```

---

## Maliyetler bölümü (yeni, düzey 1)

Yol öneki: `/dashboard/costs/`

| Öğe                 | URL                                  | Açıklama                                     |
| ------------------- | ------------------------------------ | -------------------------------------------- |
| Genel Bakış         | `/dashboard/costs`                   | Toplu maliyet panosu (Analizler'den taşındı) |
| Fiyatlandırma       | `/dashboard/costs/pricing`           | Model bazında fiyatlandırma tablosu          |
| Bütçe               | `/dashboard/costs/budget`            | Bütçe eşikleri + uyarılar                    |
| Kota Paylaşımı      | `/dashboard/costs/quota-share`       | Kota Paylaşımı havuzları + kullanım          |
| Plan Yapılandırması | `/dashboard/costs/quota-share/plans` | Sağlayıcı bazında plan geçersiz kılmaları    |

**Gerekçe**: Fiyatlandırma, Bütçe ve Kota Paylaşımı daha önce
`İzleme > Maliyet Parametreleri` altında bulunuyordu. Bunların özel bir üst düzey
bölüme taşınması, gözlemlenebilirlik araçları arasında gezinmeden bulunabilmelerini
sağlar.

---

## İzleme bölümü (yeniden düzenlendi)

İzleme bölümünde artık en üstte **Etkinlik**, ardından **3 alt grup** bulunur:

```
İzleme
├── Etkinlik             ← Zaman çizelgesi akışı (üst düzey öğe)
├── Günlükler grubu
│   ├── Günlükler (tümü)
│   ├── Proxy Günlükleri
│   └── Konsol Günlükleri
├── Denetim grubu
│   ├── Denetim Günlüğü
│   ├── MCP Denetimi
│   └── A2A Denetimi
└── Sistem grubu
    ├── Sağlık
    └── Çalışma Zamanı
```

### Eski yapıya göre değişiklikler

| Önce                                                                                                    | Sonra                                           |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Etkinlik = Günlükler içinde Denetim Günlüğü'nü oluşturan sekme                                          | Etkinlik = özel akış (`/dashboard/activity`)    |
| İzleme içindeki Maliyet Parametreleri grubu                                                             | Maliyetler bölümüne taşındı                     |
| Düz liste: Günlükler, Etkinlik (günlükler), Denetim, Sağlık, Çalışma Zamanı, Fiyatlandırma, Bütçe, Kota | Yapılandırılmış 3 grup + özel Maliyetler bölümü |

---

## Etkinlik ve Denetim Günlüğü

Bu ikisi artık birbirinden farklıdır:

| Boyut                  | Etkinlik (`/dashboard/activity`)                                         | Denetim Günlüğü (`/dashboard/audit`)           |
| ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------- |
| **Amaç**               | Kullanıcı odaklı olay akışı ("yakın zamanda ne oldu")                    | Uyumluluk / güvenlik günlüğü                   |
| **Veri kaynağı**       | `GET /api/compliance/audit-log?level=high`                               | `GET /api/compliance/audit-log?level=all`      |
| **Biçim**              | Güne göre gruplandırılmış zaman çizelgesi, okunabilir fiiller + simgeler | Yoğun, sayfalandırılmış tablo, sayfa başına 50 |
| **Filtreler**          | Olay türü kategorisi                                                     | Eylem, önem derecesi, aktör, tarih aralığı     |
| **Dışa aktarma**       | Kullanılamaz                                                             | JSON dışa aktarma                              |
| **Aktör filtresi**     | Uygulanamaz                                                              | Aktöre göre filtrelenebilir                    |
| **Gösterilen olaylar** | Yalnızca üst düzey eylemler (izin verilenler listesi)                    | Tüm denetim olayları                           |

### Üst Düzey Eylemler izin verilenler listesi

`src/lib/audit/highLevelActions.ts` içinde tanımlanır. Etkinlik akışında hangi
olayların görüneceğini denetler. İzin verilenler listesi şunları içerir:

- Sağlayıcı ekleme/kaldırma/test etme olayları
- Kombo oluşturma/güncelleme/silme
- API anahtarı yaşam döngüsü (oluşturma, iptal etme, döndürme)
- Bütçe eşiğine ulaşılması
- Kimlik doğrulama ile giriş/çıkış
- Bulut aracısı oturumu oluşturma
- MCP aracı kaydı
- Webhook oluşturma/silme
- Kota havuzu/planı değişiklikleri (`quota.*` eylemleri, Grup B)
- Platform olayları (güncelleme, dağıtım)
- Beceri yükleme/kaldırma

Bu listede bulunmayan olaylar yalnızca Denetim Günlüğü'nde görünür.

### Yeni bir üst düzey eylem ekleme

`src/lib/audit/highLevelActions.ts` dosyasını düzenleyin ve eylem dizesini
`HIGH_LEVEL_ACTIONS` öğesine ekleyin. Bunun için bir PR gerekir (liste koddadır,
DB üzerinden yapılandırılamaz). İlgili simge `src/lib/audit/activityIcons.ts`
dosyasına eklenebilir.

---

## Yönlendirme: `/dashboard/logs/activity`

Eski `/dashboard/logs/activity` yolu,
`src/app/(dashboard)/dashboard/logs/activity/page.tsx` içindeki
`permanentRedirect()` aracılığıyla kalıcı olarak (HTTP 308)
`/dashboard/activity` yoluna yönlendirilir.

Eski kimliğe başvuran kullanıcı ön ayarlarının bozulmasını önlemek için eski
kenar çubuğu kimliği `logs-activity`, `HIDEABLE_SIDEBAR_ITEM_IDS` içinde korunur
(ancak `SIDEBAR_DEFINITIONS` içinden kaldırılmıştır).

---

## i18n

Grup B tarafından eklenen ad alanları:

| Ad alanı anahtarı       | Kapsam                                                                |
| ----------------------- | --------------------------------------------------------------------- |
| `sidebar.costsSection`  | Maliyetler bölümü etiketi                                             |
| `sidebar.activity`      | Etkinlik kenar çubuğu öğesi                                           |
| `sidebar.logsGroup`     | Günlükler alt grubu etiketi                                           |
| `sidebar.systemGroup`   | Sistem alt grubu etiketi                                              |
| `sidebar.costsOverview` | Maliyetler genel bakış öğesi                                          |
| `activity.*`            | Tüm Etkinlik sayfası dizeleri (başlık, fiiller, filtreler, boş durum) |

Ana kaynak yerel ayarı: `en`. Diğer üç yerel ayar (`de`, `fa`, `tr`),
`next-intl` geri dönüş mekanizması (`src/i18n/config.ts` içinde yapılandırılmıştır)
aracılığıyla İngilizceye geri döner.
