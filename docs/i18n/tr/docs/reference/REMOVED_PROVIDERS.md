# Providers removed at their operator's request (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/REMOVED_PROVIDERS.md) · 🇩🇪 [de](../../../de/docs/reference/REMOVED_PROVIDERS.md) · 🇮🇷 [fa](../../../fa/docs/reference/REMOVED_PROVIDERS.md)

---

Bazı hizmetler Pusula'a entegre edilmiş, ancak daha sonra bunları işleten kişilerin talebi
üzerine kaldırılmıştır. Bu sayfa, söz konusu kaldırma işlemlerinin kalıcı kaydıdır. Tek amacı,
bunların yanlışlıkla geri eklenmesini önlemektir: eski bir fork, önbelleğe alınmış bir npm
tarball'ı, arşivlenmiş bir issue veya "X sağlayıcısını geri yükle" talebi bulan bir katkıda
bulunanın, **yeniden eklemeyin** diyen tek bir yere ihtiyacı vardır.

Bu sayfa, artık çalışmayan veya kullanımdan kaldırılmış hizmetlerin bir listesi **değildir**.
Bunlar [`FREE_TIERS.md`](FREE_TIERS.md) içinde ("Kaldırıldı / ücretsiz katman yok") takip edilir
ve hizmet geri dönerse yeniden eklenebilir. Aşağıdaki girdiler yalnızca talepte adı geçen
operatörün yazılı izniyle geri eklenebilir ve bu izne girdiden bağlantı verilmelidir.

## Politika

1. **Bir hizmet operatöründen gelen kaldırma talebi yerine getirilir, müzakere edilmez.**
   Pusula, hiçbir üst kaynak hizmetle bağlantılı değildir. Bir hizmetin operatörü
   entegrasyonun kaldırılmasını istediğinde, entegrasyon resmi bir API kullanmış olsun veya
   olmasın kaldırılır.
2. **"Kaldırıldı", Pusula'un kontrol ettiği her alan anlamına gelir.** Yürütücü, kayıt
   girdisi, sağlayıcı id'si ve alias'ı, model listesi, endpoint'ler, ortam değişkenleri, simge,
   dashboard kartları, oluşturulan sağlayıcı referansı, `FREE_TIERS.md`, ortam referansı,
   README sayıları, `llm.txt` yansıları, özel testler ve golden snapshot'lar, kod yorumları,
   CHANGELOG maddeleri (kayıt altına alınmış bir mutabakatla; bkz.
   `config/release/changelog-reconciliations.json`), GitHub Releases notları, wiki ve konusu
   söz konusu sağlayıcı olan GitHub issue'ları, discussion'ları ve pull request'leri (issue'lar
   ve discussion'lar silinir; GitHub pull request'leri silemediği için pull request'lerin
   başlıkları değiştirilir, açıklamaları değiştirilir ve ileti dizileri kilitlenir).
3. **Bu sayfadaki bir girdiyi yazılı izin olmadan asla yeniden eklemeyin.** Buna id veya
   alias'ın herhangi bir sağlayıcı kataloğuna geri eklenmesi, domain'lerin bir yürütücüye
   eklenmesi, onu "geri yükleyen" bir katkıda bulunan PR'ının kabul edilmesi, ücretsiz model
   kataloğuna eklenmesi veya Pusula üzerinden ona ulaşmanın manuel bir yolunun
   belgelenmesi dahildir. Bu tür PR'ları ve issue'ları bu sayfaya bağlantı vererek kapatın.
4. **Girdiyi minimum düzeyde tutun.** Yalnızca bir inceleyenin yeniden eklemeyi tanıması için
   gerekenleri kaydedin: tanımlayıcılar, domain'ler, tarihler ve kaldırma işlemini
   gerçekleştiren pull request. Entegrasyonun nasıl çalıştığını açıklamayın.
5. **Regresyon koruması `tests/unit/removed-providers-blocklist.test.ts` dosyasıdır.** Aşağıdaki
   herhangi bir tanımlayıcı veya domain sağlayıcı kataloglarında, yürütücü eşlemesinde ya da
   sağlayıcı kayıt defteri kaynaklarında yeniden göründüğünde başarısız olur. Yeni
   tanımlayıcıları, buraya bir satır ekleyen aynı PR içinde bu teste ekleyin.

## Kayıt

| Kaldırılma tarihi | Sağlayıcı kimliği | Takma ad | Alan adları                                                                    | Talep eden                                                                                                                                                 | Kaldırma PR'ı                                                   | Notlar                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------- | ----------------- | -------- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-12        | `puter`           | `pu`     | `puter.com`                                                                    | Puter'ın sahibi (Nariman Jelveh)                                                                                                                           | [#10210](https://github.com/Ferhat-Yasinoglu/pusula/pull/10210) | API anahtarlı sağlayıcı. `152_remove_puter_provider.sql` migrasyonu, saklanan yapılandırmayı temizler.                                                                                                                                                                                                                                                                                                                                                      |
| 2026-09-02        | `theoldllm`       | `tllm`   | `theoldllm.com`, `theoldllm.vercel.app`                                        | Hizmet operatörü (destek e-postası)                                                                                                                        | [#12440](https://github.com/Ferhat-Yasinoglu/pusula/pull/12440) | Anahtarsız sağlayıcı. Yazılı talep 2026-08-30 tarihinde alındı. İlgili sorun kayıtları ve tartışma silindi, PR'ların başlıkları değiştirildi.                                                                                                                                                                                                                                                                                                               |
| 2026-09-21        | `gemini-business` | `gembiz` | `business.gemini.google`                                                       | Proje sahibinin kararı (sorun [#14217](https://github.com/Ferhat-Yasinoglu/pusula/issues/14217))                                                           | [#14467](https://github.com/Ferhat-Yasinoglu/pusula/pull/14467) | Çerez tabanlı web sağlayıcısı. Google, yürütücünün hedeflediği `BardFrontendService/StreamGenerate` uç noktasını kullanımdan kaldırdı; yerine gelen (`biz-discoveryengine.googleapis.com` `widgetStreamAssist`, `__Secure-C_SES`/`csesidx` üzerinden önyüklenen Bearer JWT), projede bulunmayan etkin bir Gemini Enterprise/Workspace hesabı olmadan oluşturulamaz veya doğrulanamaz. Doğrulanmamış şekilde yeniden yazılmak yerine kullanımdan kaldırıldı. |
| 2026-09-21        | `suno`            | `suno`   | `studio-api.suno.ai`, `studio-api-prod.suno.com`                               | Proje sahibinin kararı (`#14224`)                                                                                                                          | [#14468](https://github.com/Ferhat-Yasinoglu/pusula/pull/14468) | Çerez kimlik doğrulamalı sağlayıcıdır; operatörün kaldırma talebi değildir. `studio-api.suno.ai` askıya alındı (503); etkin ana makine, Clerk JWT alışverişinin yanı sıra Pusula'un tek bir müzik sağlayıcısı için eklememeyi tercih ettiği ücretli bir hCaptcha çözme bağımlılığı gerektirir. `kie/suno-v4.0` ve `kie/suno-v3.5` (kie.ai üzerinde barındırılır) etkilenmemiştir ve desteklenmeye devam etmektedir.                                         |
| 2026-10-10        | `opencode`        | `oc`     | `opencode.ai/zen/v1` (ücretsiz katman; ana makine `opencode-zen` ile ortaktır) | OpenCode operatörünün üst kaynak 9router projesine yönelik herkese açık kaldırma talebine (2026-09-19) uyularak önleyici kaldırma (proje sahibinin kararı) | [#16310](https://github.com/Ferhat-Yasinoglu/pusula/pull/16310) | Yalnızca anahtarsız "OpenCode Free" sağlayıcısı kaldırılmıştır. Kimliği doğrulanmış `opencode-zen` ve `opencode-go`, tüm Zen katalog modelleri ve bunların istek sözleşmeleri, OpenCode istemci entegrasyonları ve `@pusula/opencode-plugin*` korunmuştur. `207_remove_opencode_free_provider.sql` migrasyonu, API anahtarı taşıyan eski bağlantıları Zen'e taşır ve anahtarsız yapılandırmayı temizler.                                                    |

## Girdi ekleme

Yeni bir kaldırma talebi geldiğinde:

1. Talebin hizmet operatöründen (destek adresinden veya kontrol ettikleri bir domain'den)
   geldiğini doğrulayın ve mesajı özel olarak saklayın.
2. Politikanın 2. maddesindeki kontrol listesini izleyerek entegrasyonu kaldırın. Anahtarsız
   bir sağlayıcı için [#12440](https://github.com/Ferhat-Yasinoglu/pusula/pull/12440), saklanan
   bağlantılara sahip API anahtarlı bir sağlayıcı için
   [#10210](https://github.com/Ferhat-Yasinoglu/pusula/pull/10210) referansını kullanın (bir
   migration ekleyin).
3. Aynı PR içinde yukarıdaki tabloya bir satır, tanımlayıcıları da
   `tests/unit/removed-providers-blocklist.test.ts` dosyasına ekleyin.
4. PR birleştirildikten sonra operatöre yanıt vererek nelerin kaldırıldığını ve Pusula'un
   neleri değiştiremeyeceğini (önceden yayımlanmış npm ve Docker sürümleri, git geçmişi,
   üçüncü taraf fork'ları) listeleyin.
