# Pusula Allocation Handoff (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_ALLOCATION_HANDOFF.md) · 🇩🇪 [de](../../de/docs/PUSULA_ALLOCATION_HANDOFF.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_ALLOCATION_HANDOFF.md)

---

Tahsis, sağlayıcı kotası değildir.

Kota havuzları, hangi API anahtarlarının bir sağlayıcı havuzunu ne ölçüde kullanabileceğini ve katı, esnek veya ani artış politikalarının nasıl uygulanacağını tanımlar. Sağlayıcı kotası, bir sağlayıcı tarafından bildirilen veya açıkça yapılandırılmış bir kaynak tarafından belirtilen harici kapasitedir. Ghostlight dahili bütçeleri, yönetici tarafından tanımlanan yönetişim sınırlarıdır.

`ensurePool` işlemi idempotenttir: aynı havuz değişmeden kalır, değişmiş bir tahsis güncellenir ve eksik bir havuz oluşturulur. Bu işlem, otomasyon ve sınırlandırılmış API istemcileri için tasarlanmıştır.

Salt okunur durum uç noktası `GET /api/pusula/status` şeklindedir. Doğrulama komutu `npm run pusula:verify` şeklindedir; bu komut canlı bir model isteğinde bulunmaz.
