# Pusula Provider Failover (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_PROVIDER_FAILOVER.md) · 🇩🇪 [de](../../de/docs/PUSULA_PROVIDER_FAILOVER.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_PROVIDER_FAILOVER.md)

---

Hatalar, yeniden deneme kararları verilmeden önce sınıflandırılır.

Zaman aşımı, ağ hataları, hız sınırları ve sağlayıcıdan gelen 5xx yanıtları gibi geçici hatalarda başka bir sağlayıcıya geçilebilir. Kimlik doğrulama hataları, izin hataları, geçersiz istekler, kullanılamayan modeller ve bilinmeyen hatalar için gözü kapalı yeniden deneme yapılmaz.

Varsayılan sağlayıcılar arası politika en fazla üç sağlayıcı denemesine izin verir, hız sınırı ve zaman aşımı durumlarında yeniden dener ve yönetimsel devre dışı bırakmayı geçici devre durumundan ayrı tutar.

Devre durumları `closed`, `open` ve `half_open` şeklindedir. Bekleme süresi, sınırlı bir yoklama planlar; başarılı bir yoklama devreyi kapatır, başarısız bir yoklama ise devreyi yeniden açar.
