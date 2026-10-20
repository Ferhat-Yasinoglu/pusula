# Pusula Routing Policy (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../PUSULA_ROUTING_POLICY.md) · 🇩🇪 [de](../../de/docs/PUSULA_ROUTING_POLICY.md) · 🇮🇷 [fa](../../fa/docs/PUSULA_ROUTING_POLICY.md)

---

Yönlendirme, mevcut yetenek ve kombinasyon seçim mantığını korur; ardından tahsis, sağlık, devre, kota, gecikme, güvenilirlik, model tercihi ve maliyet tercihi faktörlerini uygular.

Uyarlanabilir skor açıklanabilirdir ve hem seçilen adayı hem de sıralanan tüm adayları döndürür. Kotası tükenmiş, tahsisi reddedilmiş ve devresi açık olan adaylar uygun değildir. Kotası bilinmeyen adaylar, nötr bir kota faktörüyle uygun kalır.

Yönlendirme önizlemesi deterministiktir ve üst akış modeline sıfır istek gönderir:

`POST /api/pusula/route/preview`

Yanıt; aday skorlarını, faktörleri, nedenleri, seçilen sağlayıcıyı ve `liveRequestExecuted: false` değerini içerir.
