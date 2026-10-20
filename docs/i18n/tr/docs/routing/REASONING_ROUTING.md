# Reasoning Routing (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../routing/REASONING_ROUTING.md) · 🇩🇪 [de](../../../de/docs/routing/REASONING_ROUTING.md) · 🇮🇷 [fa](../../../fa/docs/routing/REASONING_ROUTING.md)

---

Akıl yürütme yönlendirme kuralları, mevcut model ve combo yönlendirmesini genişletir. Etkin hiçbir kural eşleşmediğinde mevcut düşünme, son ek, bağlantı varsayılanı ve sağlayıcı çevirisi davranışı değişmeden kalır.

## Yönetim

Kural yönetimine **Ayarlar → Global Yönlendirme** altından erişilebilir. API anahtarı düzenleyicisi, seçilen anahtara göre filtrelenmiş aynı yönetim arayüzünü sunar.

Yönetim API'si şu rotalar üzerinden kullanıma sunulur:

- `/api/settings/reasoning-routing-rules` adresinde `GET` ve `POST`
- `/api/settings/reasoning-routing-rules/[id]` adresinde `GET`, `PATCH` ve `DELETE`
- `/api/settings/reasoning-routing-rules/simulate` adresinde `POST`

Tüm rotalar `requireManagementAuth` kullanır. Girdiler, `src/shared/validation/schemas/reasoningRouting.ts` içindeki şemalarla doğrulanır. Simülatör hiçbir zaman yukarı akış çağrısı yapmaz.

## Kural Çözümleme

Erken değerlendirme tam olarak bir kural seçer. Kapsamlar şu sırayla kontrol edilir:

1. `apiKey`
2. `combo`
3. `model`
4. `global`

Bir kapsam içinde önce daha yüksek `priority` değerine sahip olan kazanır; ardından glob kalıbına kıyasla tam model eşleşmesi, sonrasında ise kararlı `createdAt` ve `id` sıralaması dikkate alınır. `requestTags` yalnızca `metadata.tags` alanından okunur ve `any` ya da `all` eşleştirmesini destekler.

Bir `connection` kuralı, yalnızca hiçbir erken kural kazanmadığında ve somut bir sağlayıcı bağlantısı zaten seçilmiş olduğunda değerlendirilir. Yalnızca eforu ve bütçeyi değiştirebilir.

## Efor ve Bütçe

`sourceEffort`; `any`, `missing`, `none`, `low`, `medium`, `high`, `xhigh`, `max` ve `ultra` değerlerini kabul eder. `missing`, isteğin ne ayrık bir efor ne de bir düşünme anahtarı veya düşünme bütçesi içerdiği anlamına gelir. Bu nedenle yalnızca bütçe sinyali, sadece `any` tarafından eşleştirilir.

`effortMode` üç varyanta sahiptir:

- `inherit`, modelin veya combo'nun değişmesine yine de izin verirken istemci eforunu korur.
- `default`, yalnızca açık bir akıl yürütme sinyali mevcut olmadığında `targetEffort` değerini ayarlar.
- `force`, ayrık eforu `targetEffort` ile değiştirir.

Bundan bağımsız olarak `budgetAction`; `preserve`, `remove` veya `set` olabilir. `none` ile birlikte kullanılan `force`, tanınan tüm efor ve bütçe alanlarını kaldırır. `none` ile `set` kombinasyonu geçersizdir.

Uyumsuz olduğu bilinen modelleri hedefleyen istekler, yukarı akış çağrısından önce reddedilir. Combo hedeflerinde uyumsuz girdiler kaldırılır; hiçbiri kalmazsa istek `400` durum koduyla sonuçlanır. Bilinmeyen yetenek verileri bir uyarı üretir ve kuralı etkin bırakır.

## Güvenlik ve Aktarımlar

Kaynak ve hedef model ya da kaynak ve hedef combo, mevcut API anahtarı politikasına tabi olmaya devam eder. Bir akıl yürütme kuralı model, combo veya kota izinlerini hiçbir zaman genişletmez.

Motor; Chat Completions, Responses, Anthropic Messages ve dahili Codex WebSocket yoluna entegre edilmiştir. WebSocket yolu yalnızca Codex hedef modellerini kabul eder; combo hedefleri burada yürütülemez. Kural kararı, gizli bilgiler olmadan mevcut rota izine kaydedilir.

## Kalıcılık

`src/lib/db/migrations/126_reasoning_routing_rules.sql` migrasyonu, `reasoning_routing_rules` tablosunu oluşturur. Kurallar; depolanan API anahtarlarına, combo'lara ve sağlayıcı bağlantılarına referans verir. Silme işlemleri ilişkili kuralları temizler. `src/lib/db/reasoningRoutingRules.ts` içindeki veritabanı erişim katmanı, istek yolu için geçersiz kılınabilir bir önbellek tutar.

Kurallar; SQLite yedeklerine, tam veritabanı dışa aktarımına ve yapılandırma eşitleme paketine dahil edilir. `reconcileReasoningRulesForSync`, eksik referanslara sahip içe aktarılmış kuralları devre dışı bırakır ve bu çakışmaları raporlar.
