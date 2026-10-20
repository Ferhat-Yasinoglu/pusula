# Pusula Quota Telemetry (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_QUOTA_TELEMETRY.md) · 🇩🇪 [de](../../de/docs/PUSULA_QUOTA_TELEMETRY.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_QUOTA_TELEMETRY.md)

---

Pusula, sağlayıcı kota telemetrisini Ghostlight hesaplamasından ayırır.

## Gerçeği yansıtan durumlar

- `healthy`, bir kaynağın kullanılabilir kalan kapasite bildirdiği anlamına gelir.
- `approaching_limit`, bir kaynağın yapılandırılmış eşiğe eşit veya bu eşiğin altında kalan kapasite bildirdiği anlamına gelir.
- `exhausted`, yalnızca bir kaynak sıfır kapasite veya sınırına ulaşmış kullanım bildirdiğinde oluşturulur.
- `unavailable`, desteklenen bir kaynağın veri döndüremediği anlamına gelir.
- `unknown`, desteklenen bir kaynağın bulunmadığı veya bilinen bir sağlayıcı sınırının olmadığı anlamına gelir.

Bilinmeyen durumu, tükenmiş anlamına gelmez ve bir sağlayıcıyı devre dışı bırakmaz.

Kaynaklar şu sırayla tercih edilir: resmi sağlayıcı API'si, kimliği doğrulanmış kullanım API'si, açıkça eşlenmiş yanıt başlıkları, yönetici yapılandırması, yerel tahminler, bilinmeyen. Yerel tahminler hiçbir zaman sağlayıcı faturalandırma verileri olarak sunulmaz.

Yanıt başlıkları yalnızca açık bir sağlayıcı eşlemesi üzerinden ayrıştırılır. Genel başlık adlarının küresel olarak geçerli olduğu varsayılmaz.
