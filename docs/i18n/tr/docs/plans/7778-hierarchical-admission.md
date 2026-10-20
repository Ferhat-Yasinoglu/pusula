# #7778 hierarchical admission cleanup plan (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../plans/7778-hierarchical-admission.md) · 🇩🇪 [de](../../../de/docs/plans/7778-hierarchical-admission.md) · 🇮🇷 [fa](../../../fa/docs/plans/7778-hierarchical-admission.md)

---

1. Mevcut tek anahtarlı semafor sözleşmesini ve yeni atomik çok anahtarlı
   sözleşmeyi odaklanmış testlerle güvence altına alın: kısmi rezervasyon olmaması,
   FIFO kuyruklama, iptal, zaman aşımı, kuyruk doluluğu, idempotent serbest bırakma,
   istatistikler ve temizlik.
2. Mevcut hesap semaforunu yerinde genelleştirin. `acquire()` yöntemini
   `acquireMany()` etrafında bir uyumluluk sarmalayıcısı olarak koruyun; ikinci
   bir zamanlayıcı veya bağımlılık eklemeyin.
3. `chatCore` içindeki yalnızca hesaba yönelik edinimi, `withRateLimit` çağrısından
   hemen önce gerçekleştirilen tek bir kümülatif global/sağlayıcı/hesap edinimiyle
   değiştirin. Hesap rotasyonu bağlantıyı her değiştirdiğinde tüm kümeyi yeniden
   edinin ve serbest bırakmayı akış tamamlanana kadar erteleyin.
4. Mevcut dayanıklılık ayarları işlem hattını (türler, varsayılanlar,
   normalleştirme, şema, API yanıtı, kullanıcı arayüzü ve çeviriler) global ve
   sağlayıcı sınırlarıyla genişletin. Eski Bottleneck eşzamanlılık denetimini,
   gerçek kapsamı açık olacak şekilde bağlantı/kota kapsamı eşzamanlılığı olarak
   yeniden etiketleyin.
5. Odaklanmış testleri, lint işlemini, tür denetimini, statik denetimleri ve tam
   test paketini çalıştırın; davranış değişikliğini değişiklik günlüğünde
   belgeleyin.

Kasıtlı olarak korunan davranış: sıfır/null eşzamanlılık bir geçidi atlar,
yalnızca hesap kullanan çağıranlar `acquire()` kullanmaya devam eder, engellenen
hesap denetimleri anahtar biçimlerini ve API'lerini korur ve sağlayıcı hız sınırı
kuyruğu davranışı değişmeden kalır.
