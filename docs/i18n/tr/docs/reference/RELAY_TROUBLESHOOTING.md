# Relay Troubleshooting (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/RELAY_TROUBLESHOOTING.md) · 🇩🇪 [de](../../../de/docs/reference/RELAY_TROUBLESHOOTING.md) · 🇮🇷 [fa](../../../fa/docs/reference/RELAY_TROUBLESHOOTING.md)

---

Relay'ler (Vercel, Deno, Cloudflare), sunucusuz bir arka uçta üst akış bağlantısını sonlandırır; böylece Pusula, sağlayıcı API anahtarını sunucu tarafında tutarken kararlı bir bölgeden çıkış yapabilir. Bu belge, operatörlerin üretimde karşılaştığı iki hata modunu ve Pusula'un her biri için sunduğu kurtarma yollarını ele almaktadır.

## Relay kimlik doğrulamasının saklanma biçimi

**Settings → Proxy Pool → Deploy Relay** üzerinden bir relay dağıttığınızda, dağıtım akışı relay'in kimlik doğrulama belirtecini proxy'nin `notes` JSON alanında saklar:

- `STORAGE_ENCRYPTION_KEY` ayarlanmışsa belirteç, `relayAuthEnc` olarak
  (bekleme durumunda AES ile şifrelenmiş biçimde) yazılır.
- Aksi takdirde düz metin olarak `relayAuth` içine yazılır.

İstek sırasında `extractRelayAuth(notes)`, mevcut olan biçimi döndürür; böylece relay yeniden başlatmalar sonrasında çalışmaya devam eder.

## Hata modu 1 — anahtar rotasyonu sonrasında şifresi çözülemeyen belirteç

**Belirti:** daha önce çalışan relay'ler, ortamda veya gizli bilgi yöneticisinde yapılan
`STORAGE_ENCRYPTION_KEY` rotasyonundan sonra üst akıştan `401`/kimlik doğrulama
hataları döndürmeye başlar. Saklanan `relayAuthEnc` verisinin şifresi artık
çözülemediğinden `extractRelayAuth` boş bir dize döndürür ve relay hiçbir
kimlik doğrulama bilgisi göndermez.

**Kurtarma — yerinde onarım (yeniden dağıtım gerekmez):**

1. **Settings → Proxy Pool** bölümünü açın.
2. Kimlik doğrulama bilgisi eksik olan relay satırlarında sarı bir `auth missing` rozeti ve
   **Repair** düğmesi gösterilir.
3. **Repair** düğmesine tıklayın. Pusula,
   `POST /api/settings/proxies/[id]/repair-relay` çağrısını yapar; bu çağrı:
   - `relayAuthEnc` verisinin şifresini **geçerli** anahtarla çözer,
   - düz metin `relayAuth` değerini yeniden `notes` içine yazar,
   - `{ repaired: true, mode: "recovered" }` döndürür.

Relay, herhangi bir dağıtım kimlik bilgisini yeniden girmeye gerek kalmadan hizmet vermeye devam eder.

Bu işlem yalnızca geçerli `STORAGE_ENCRYPTION_KEY`, verinin şifresini hâlâ çözebiliyorsa çalışır. Anahtarı bir geçiş işlemi **olmadan** döndürdüyseniz veri kurtarılamaz.

## Hata modu 2 — kurtarılamayan belirteç (eski anahtar artık mevcut değil)

**Belirti:** **Repair** düğmesine tıkladınız ve
`{ repaired: false, mode: "redeploy", status: 409 }` yanıtını aldınız.

**Kurtarma — yeniden dağıtım:**

Saklanan belirteç geçerli anahtarla kurtarılamaz. Relay'i ilk başta kullandığınız
aynı iletişim kutusundan yeniden dağıtın (**Deploy Relay** menüsü → Vercel / Deno
/ Cloudflare). Dağıtım akışı yeni bir belirteç yazar (geçerli anahtarla
şifrelenmiş olarak) ve satırdaki `auth missing` rozeti kaldırılır.

Kullanıcı arayüzünde, belirteç kurtarılamadığında **Repair** düğmesinin kendisi
yeniden dağıtım iletişim kutusunu açar; böylece bu seçeneği elle aramanız gerekmez.

## Hata modu 3 — relay erişilebilir ancak sağlıksız

**Belirti:** proxy testi (`speed` düğmesi) relay'in çalışır durumda olduğunu gösterir ancak istekler
yine de aralıklı olarak başarısız olur.

Pusula'un otomatik test yoklaması tarafından döndürülen relay farkındalık üstbilgilerini
kontrol edin (**Settings → Proxy Pool** bölümüne ve `relayTested` / `relayAlive` sayaçlarına bakın):

- `x-relay-url` — hangi relay arka ucunun yanıt verdiği.
- `x-relay-mode` — ilgili istek için `ts` | `bifrost` | `auto`.
- `x-relay-attempts` — başarıdan önce kaç relay atlamasının denendiği.
- `x-relay-fallback` — istek tercih edilen arka uçtan TypeScript relay'ine
  geri döndüğünde `true`.

Düşük `relayAlive` ile birlikte yüksek bir `x-relay-fallback` oranı, sidecar
arka ucunun sağlıksız olduğu anlamına gelir; bu durumda arka ucu düzeltmeli veya relay arka uç
stratejisini `ts` olarak değiştirmelisiniz (`RELAY_BACKEND_STRATEGY.md` belgesine bakın).

## API referansı

| Yöntem | Yol                                       | Gövde                   | Başarı                                                                                                                               | Hata                                                                                   |
| ------ | ----------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| `POST` | `/api/settings/proxies/[id]/repair-relay` | `{ "id": "<proxyId>" }` | Yeniden türetildiğinde `200 { repaired: true, mode: "recovered" }`; düz metin zaten mevcutsa `200 { repaired: false, mode: "noop" }` | Kurtarılamazsa `409 { mode: "redeploy" }`; relay türü değilse `400`; bulunamazsa `404` |

Liste rotası `GET /api/settings/proxies`, her öğeye gizli bilgi içermeyen bir
`relayInfo: { isRelay, authMissing, repairMode }` ekler; böylece pano, belirteci hiçbir zaman
ifşa etmeden onarım seçeneğini görüntüleyebilir.
