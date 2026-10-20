# Account-Ban / Banned-Keyword Detection (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../security/BAN_DETECTION.md) · 🇩🇪 [de](../../../de/docs/security/BAN_DETECTION.md) · 🇮🇷 [fa](../../../fa/docs/security/BAN_DETECTION.md)

---

Pusula, bir sağlayıcı **hesabının kalıcı olarak devre dışı** olduğunu (askıya alınmış / devre dışı bırakılmış / kullanım koşulları ihlali nedeniyle yasaklanmış) gösteren sinyalleri bulmak için yukarı akış hata yanıtlarını tarar ve eşleşme bulunduğunda bu bağlantıyı, artık istekler için seçilmemesi amacıyla **terminal `banned` durumuna** geçirir. **Security → Banned Keywords** ayar kartı bunu yapılandırır ("Kalıcı hesap yasağı algılamasını tetikleyen ek anahtar kelimeler. Yerleşik anahtar kelimeler her zaman uygulanır.").

Bu sayfa; yerleşik listeyi, algılama akışını, kapsamını, özel anahtar kelimelerin güvenli biçimde nasıl ekleneceğini ve işaretlenmiş bir bağlantının nasıl kurtarılacağını açıklar. Terminal durumun kendisi dayanıklılık modelinin bir parçasıdır — bkz.
[RESILIENCE_GUIDE](../architecture/RESILIENCE_GUIDE.md) ("Terminal durumlar").

**Doğru bilginin kaynağı:** `open-sse/services/accountFallback.ts`
(`ACCOUNT_DEACTIVATED_SIGNALS`, `getMergedBannedSignals()`, `isAccountDeactivated()`).

## Yerleşik anahtar kelimeler

Bu 8 alt dize, özel listelerden bağımsız olarak her zaman uygulanır (büyük/küçük harfe duyarsız):

```
account_deactivated
account has been deactivated
account has been disabled
your account has been suspended
this account is deactivated
verify your account to continue                                 (Antigravity / Google Cloud Code)
this service has been disabled in this account for violation    (Antigravity)
this service has been disabled in this account                  (Antigravity)
```

> Sağlayıcılar yasaklama ifadelerini değiştirdikçe bu liste de gelişir. Yetkili
> kopya, `open-sse/services/accountFallback.ts` içindeki `ACCOUNT_DEACTIVATED_SIGNALS`
> değeridir; yukarıdaki bloğu anlık bir görüntü olarak değerlendirin.

Aynı dosyada bitişik olarak bulunan iki **ayrı** sinyal tablosu, yasaklanmış anahtar kelime algılamasının bir parçası _değildir_:

- `CREDITS_EXHAUSTED_SIGNALS` — faturalandırma/kota tükenmiş (`insufficient_quota`,
  `credit_balance_too_low`, `payment required`, …) → terminal `credits_exhausted`.
- `OAUTH_INVALID_TOKEN_SIGNALS` — **terminal değildir**; token yenileme ile kurtarılabilir.

Not: **`rate limit`** / `429` gibi yaygın geçici ifadeler, hız sınırı / bağlantı bekleme süresi yolu tarafından işlenir ve yasaklama sinyali **değildir**.

## Algılama akışı

```
yukarı akış hata yanıtı
  → gövde dizeye dönüştürülür + küçük harfe çevrilir
  → isAccountDeactivated(body): getMergedBannedSignals().some(sig => body.includes(sig))   [alt dize eşleşmesi]
  → eşleşme var mı?
      → bağlantı testStatus = "banned"      (kalıcı — 1 yıllık bekleme süresi, asla otomatik olarak kurtarılmaz)
      → `autoDisableBannedAccounts` ayarı açıksa ve `autoDisableBannedScope`
        bu bağlantıyı kapsıyorsa (`all` veya OAuth/cookie/session için `subscription`)
        → ayrıca isActive = false. Kapsam `subscription` olduğunda ön ödemeli API anahtarları
        etkin kalır.
      → hesap seçimi sırasında bağlantı atlanır (birleşik QUOTA_BLOCKING durumları)
```

- Eşleşme, yanıt **gövdesinde** büyük/küçük harfe duyarsız bir **alt dize** aramasıdır
  (`isAccountDeactivated`, `accountFallback.ts`).
- Kalıcı `banned` terminalleştirmesi, yasaklama sinyali içeren bir gövdede **herhangi
  bir HTTP durumunda** tetiklenir (`markAccountUnavailable` → `checkFallbackError`
  aracılığıyla). Daha dar kapsamlı **`deactivated`** etiketi (bağlantıda yedek API
  anahtarı olmadığında `isActive=false`), satır içi `chatCore.ts` yolu tarafından
  **HTTP 401 / 403** durumlarında yazılır (`classifyProviderError` →
  `ACCOUNT_DEACTIVATED` aracılığıyla sınıflandırılır). `markAccountUnavailable()`
  yolunun aynı `ACCOUNT_DEACTIVATED` sinyali için (`resolveTerminalConnectionStatus`
  aracılığıyla) _farklı_ bir terminal durum — **`expired`** — yazdığını unutmayın;
  dolayısıyla aynı yasak, yanıtı hangi yolun işlediğine bağlı olarak `deactivated`
  veya `expired` biçiminde görünebilir. (Eski kod açıklaması "bir 401 gövdesi bu
  dizeleri içerdiğinde" der — bu, mevcut davranışın kapsamını olduğundan dar
  gösterir.)
- Terminal durumların filtrelendiği her yerde `banned` durumundaki bir bağlantı
  seçimden çıkarılır (`isTerminalConnectionStatus`, birleşik `QUOTA_BLOCKING_CONNECTION_STATUSES`).

## Kapsam — hangi sağlayıcılar taranır

**Tüm sağlayıcılar.** Kontrol, başarısız olan her upstream isteğin geçtiği genel
hata işleme işlem hattında çalışır — yalnızca OAuth/abonelik scraper'larıyla
sınırlı **değildir**. Ortaya çıkan terminal durum sağlayıcı başına değil,
**bağlantı** başınadır.

Bununla birlikte, yerleşik _dizeler_ gerçek yasaklanma riski taşıyan
abonelik/OAuth sağlayıcılarına yöneliktir (ChatGPT Web Codex, Claude Web, Codex,
Muse Spark, Antigravity). API anahtarı kullanan bir sağlayıcı, yalnızca hata
gövdesi alt dizelerden birini harfi harfine içeriyorsa algılayıcıyı tetikler.

`autoDisableBannedScope` (`all` | `subscription`, varsayılan `all`), bir eşleşmenin
aynı zamanda `isActive=false` yapıp yapmayacağını kontrol eder. `subscription`,
oturum açma türündeki lisansları (web cookie oturumları dahil ücretli abonelikler
ve ücretsiz hesaplar) ifade eder. Ön ödemeli API anahtarları için yine
`testStatus=banned` kaydeder ancak bunları yönlendirme havuzunda bırakır. Kalıcı
tasarım, sağlayıcı ve hesap başına geçersiz kılma seçeneğidir; global enum ilk
uygulamadır.

## Özel yasaklanma anahtar sözcükleri

**Security → Banned Keywords** bölümünden anahtar sözcük ekleyin veya kaldırın
(`PATCH /api/settings` aracılığıyla global `customBannedSignals` ayarı olarak
kalıcılaştırılır). Bunlar yerleşik listeye **eklenir** — hiçbir zaman listenin
yerine geçmez — ve kaydetme sırasında (ayrıca başlangıçta)
`setCustomBannedSignals()` aracılığıyla anında yeniden yüklenir. Her anahtar
sözcük en fazla 200 karakter olabilir; dizi uzunluğu sınırı yoktur.

**⚠ Yanlış pozitif riski — belirli ifadeler seçin.** Algılama, yanıt gövdesinin
tamamında ham alt dize eşleşmesi yapar ve eşleşme **kalıcıdır** (1 yıllık bekleme
süresi, manuel kurtarma). Fazla genel bir anahtar sözcük, tamamen sağlıklı bir
bağlantının yasaklanmasına neden olabilir:

- **Kötü:** `quota`, `limit`, `error`, `denied` — birçok geçici hatada görülür.
- **İyi:** tam yasaklanma cümleleri; ör. `your account has been suspended for`,
  `account permanently banned`, `violation of our terms`.

Sağlayıcının gerçek bir yasaklanma durumunda döndürdüğü, belirsizlik içermeyen en
uzun ifadeyi tercih edin. Emin değilseniz önce bağlantının `lastError` değerini
izleyin, ardından kullanılan ifadeyi tam olarak ekleyin.

## İşaretlenmiş bir bağlantıyı kurtarma

Terminal `banned` / `deactivated` durumları **hiçbir zaman otomatik olarak
kurtarılmaz** (proaktif kurtarma döngüsünün dışında tutulurlar — yalnızca
`unavailable` bekleme süreleri kendiliğinden sona erer). Bir operatör bunları
açıkça temizlemelidir:

1. **Bağlantıyı yeniden test edin** — panodaki **Test** eylemi
   (`POST /api/providers/{id}/test`); başarılı bir yoklama `testStatus` değerini
   `active` olarak sıfırlar ve hata alanlarını temizler.
2. **Yeniden kimlik doğrulayın / kimlik bilgilerini düzenleyin** — OAuth
   sağlayıcıları için oturum açma / yenileme akışını yeniden çalıştırın;
   sağlayıcı oluşturma/içe aktarma rotaları `isActive = true` olarak ayarlar.
3. **Bağlantıyı yeniden etkinleştirin** — otomatik devre dışı bırakma işlemi
   `isActive = false` yaptıysa (`all` kapsamı veya bir OAuth/cookie/oturum
   bağlantısı için `subscription`), hesabı düzelttikten sonra bağlantıyı tekrar
   açın.

Ayrı bir "yasak işaretini temizle" düğmesi yoktur — kurtarma; yeniden test etme,
yeniden kimlik doğrulama veya yeniden etkinleştirme yoluyla gerçekleştirilir ve
[RESILIENCE_GUIDE](../architecture/RESILIENCE_GUIDE.md) içindeki genel terminal
durum kuralıyla uyumludur.

## Yoklama yalıtımı (model test-all)

`runAsProbe` içinde yürütülen model test-all / sağlık kontrolü gönderimlerinden
kaynaklanan bir **yoklama kökenli hata**, bağlantıyı hiçbir zaman havuzdan
çıkarmaz (#9817): hata **görünürlük için kaydedilir** (`last_error`,
`last_error_type`, `error_code`, `last_error_at`) ancak **tüm** yönlendirme
değişiklikleri atlanır — bekleme süreleri, terminal durum (`banned` /
`deactivated` / `credits_exhausted`), model başına kilitlemeler, sağlayıcı devre
kesicisi, 5 dakikalık kota önbelleği, OAuth token yenileme ve otomatik devre dışı
bırakma. Yalnızca gerçek istek yolundaki bir hata devre dışı bırakmaya neden
olur. Kaydedilen hata, işaretlenmiş bir hesabın trafiğe hizmet vermeye devam
ederken panoda görünmesini sağlar.

Tek karar noktası `shouldIsolateProbeFailures()`
(`src/shared/utils/probeOrigin.ts`) olup yoklama kökenli bir hatadan dolayı
yönlendirme durumunu değiştirebilecek **her** noktada buna başvurulur:

- `markAccountUnavailable` (`auth.ts`) — yalnızca kayıt (`lastError` ham metni,
  `lastErrorType`, `errorCode`, `lastErrorAt`; seçim zamanındaki otomatik
  azaltmayı tetikleyip kaydı silecek olan `backoffLevel` özellikle **yoktur**)
- `maybeAutoDisableBannedAccount` — otomatik devre dışı bırakma yok
- `chatCore` — FORBIDDEN, ACCOUNT_DEACTIVATED, QUOTA_EXHAUSTED (yalnızca kayıt,
  terminal `credits_exhausted` yok), GEO_BLOCKED (24 saatlik hariç tutma yok),
  MODEL_NOT_FOUND (`lockModel` yok), codex 429 hesap döndürme yük devri
  (`markCodexScopeRateLimited` yok, kalıcılaştırılan `rate_limited_until` yok,
  oturum yakınlığı temizliği yok), `persistCodexQuotaState` (kota durumu yazımı
  yok, önbellek geçersiz kılma yok), `recordKeyHealthStatus` (anahtar sağlığı
  döndürücüsüne dokunulmaz)
- OAuth yenileme — hem executor tabanındaki proaktif yenileme
  (`base.ts` `execute()`, refresh token döndürmesi tüketilmez) hem de
  `chatCore` içindeki reaktif 401/403 yolu (`expired` devre dışı bırakması yok)
- `chat.ts` — sağlayıcı devre kesicisi ve 5 dakikalık kota önbelleği
  (`markAccountExhaustedFrom429`) hiçbir zaman zayıflatılmaz

Kaydedilen hata, işaretlenmiş bir hesabın trafiğe hizmet vermeye devam ederken
panoda görünmesini sağlar. Not: Yoklama kaydı, gerçek yolun `slice(0,100)`
kısaltmasının aksine **ham** (kesilmemiş) hata metnini saklar.

Test-all özelliğini bakım aracı olarak kullanan operatörler, geçmiş davranışı
(yoklamanın gerçek bir üretim olarak sayılması) aşağıdakilerden biri aracılığıyla
geri yükleyebilir:

- `probeCanDisable` ayarı (`{"probeCanDisable": true}` ile
  `POST /api/settings` veya doğrudan bir `key_value` DB düzenlemesi) ya da
- **`PROBE_CAN_DISABLE=true`** özellik bayrağı (env veya DB geçersiz kılması;
  ayara göre önceliklidir).

Güvenli hata davranışı: Bayrak veya ayar araması hata verirse yalıtım AÇIK kalır.

## Kaynak dosyalar

| Konu                                              | Dosya                                                                                                         |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Sinyal tabloları + eşleşme                        | `open-sse/services/accountFallback.ts`                                                                        |
| Sonlandırma / kalıcılık                           | `src/sse/services/auth.ts` (`markAccountUnavailable`, `resolveTerminalConnectionStatus`, `clearAccountError`) |
| Otomatik devre dışı bırakma kapsamı               | `src/shared/utils/autoDisableBanned.ts`, `src/sse/services/autoDisableBannedAccount.ts`                       |
| Satır içi sınıflandırma                           | `open-sse/handlers/chatCore.ts`, `open-sse/services/errorClassifier.ts`                                       |
| Terminal durum kurtarma dışlaması                 | `src/lib/quota/connectionRecovery.ts`                                                                         |
| Özel anahtar kelimeleri çalışma zamanında yükleme | `src/lib/config/runtimeSettings.ts` (`setCustomBannedSignals`)                                                |
| Ayarlar kullanıcı arayüzü                         | `src/app/(dashboard)/dashboard/settings/components/SecurityTab.tsx`                                           |
