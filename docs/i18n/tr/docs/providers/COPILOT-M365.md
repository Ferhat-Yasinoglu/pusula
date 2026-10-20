# Providers — Microsoft 365 Copilot (BizChat) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/COPILOT-M365.md) · 🇩🇪 [de](../../../de/docs/providers/COPILOT-M365.md) · 🇮🇷 [fa](../../../fa/docs/providers/COPILOT-M365.md)

---

`copilot-m365-web` (`m365copilot` diğer adıyla), OpenAI biçimindeki sohbet isteklerini
`m365.cloud.microsoft/chat` adresindeki kimliği doğrulanmış bir Microsoft 365 Copilot
BizChat tarayıcı oturumu üzerinden gönderir. Bu, resmî olmayan bir entegrasyondur.

> **Web Cookie sağlayıcılarını ilk kez mi kullanıyorsunuz?**
>
> Bu sağlayıcıya özel kılavuzu izlemeden önce genel kurulum süreci, kimlik doğrulama
> yönergeleri, sınırlamalar ve sorun giderme için
> **`docs/getting-started/WEB-COOKIE-GUIDE.md`** dosyasını okuyun.
>
> **Önemli:** Bu sağlayıcının kimlik bilgisi **bir çerez değildir**. `m365.cloud.microsoft`
> adresinden çerez kopyalamayın. Kimlik bilgisi, her ikisi de DevTools Network
> sekmesinden okunan bir WebSocket URL sorgu parametresi ve yol parçasıdır.

## Ön koşullar

- `m365.cloud.microsoft/chat` adresindeki BizChat'e erişimi olan bir Microsoft 365 hesabı
- DevTools WebSocket incelemesi için Chromium tabanlı bir tarayıcı (Chrome, Edge)
- Bir M365 Copilot lisansı (birçok Microsoft 365 Business/Enterprise planına dahildir)

## Kimlik bilgilerini alma (WebSocket yöntemi)

1. `https://m365.cloud.microsoft/chat` adresinde oturum açın ve bir konuşma başlatın.
2. **DevTools → Network** bölümünü açın.
3. **WS** (WebSocket) ile filtreleyin.
4. Chathub WebSocket bağlantısına tıklayın. Şununla başlayan bir URL arayın:
   `wss://substrate.office.com/m365Copilot/Chathub/`.
5. **Request URL** değerinden şunları kopyalayın:
   - `access_token` sorgu parametresinin değeri (kısa ömürlü bir JWT).
   - `/Chathub/` sonrasındaki Chathub yol parçası (ör. `<oid>@<tenant>`).

Tam URL şu biçimdedir:

```
wss://substrate.office.com/m365Copilot/Chathub/<oid>@<tenant>?...&access_token=<jwt>
```

6. Pusula'ta **Providers → Add Provider** bölümüne gidin, **Microsoft 365 Copilot
   (BizChat)** seçeneğini belirleyin ve kimlik bilgisini şu biçimde yapıştırın:

```
access_token=<jwt>; chathubPath=<oid>@<tenant>
```

7. **Test Connection** ve ardından **Save** düğmesine tıklayın.

## Kimlik bilgilerini alma (HAR içe aktarma)

WebSocket URL'sindeki değerleri elle kopyalamak yerine bir DevTools HAR dosyasını dışa
aktarabilirsiniz:

1. **DevTools → Network** bölümünü açın.
2. Bir BizChat konuşması başlatın veya mevcut konuşmayı sürdürün (bu işlem WebSocket bağlantısını tetikler).
3. Network panelinde sağ tıklayın ve **Save all as HAR with content** seçeneğini belirleyin.
4. Pusula'taki sağlayıcı bağlantısı iletişim kutusunda **Import .har file** düğmesini kullanın.

Pusula, HAR dosyasında Chathub WebSocket URL'sini tarar, `access_token` ve
`chathubPath` değerlerini çıkarır ve kimlik bilgisi alanlarını otomatik olarak doldurur.
HAR içe aktarma işlemi, JWT sona erme zamanını çözümler ve belirtecin kalan kullanım
süresini gösterir.

> **Gerçek bir HAR dışa aktarımını, erişim belirtecini veya yenileme belirtecini asla
> depoya işlemeyin.** Test ve dokümantasyon değerleri her zaman yer tutucu olmalıdır.

## Belirteç kullanım süresi ve yenileme

`access_token` kısa ömürlüdür (genellikle **~75 dakika**). Süresi dolduktan sonra sağlayıcı
bir bağlantı hatası bildirir ve kimlik bilgisini yeniden almanız gerekir.

### `refreshToken` ile otomatik yenileme

Elle yeniden alma gereksinimini önlemek için Microsoft yenileme belirtecini bağlantının
**Advanced Settings → providerSpecificData** bölümünde saklayabilirsiniz:

| Alan           | Açıklama                                                                      |
| -------------- | ----------------------------------------------------------------------------- |
| `refreshToken` | `substrate.office.com/sydney` kapsamı için Microsoft OAuth yenileme belirteci |
| `tier`         | `individual` (varsayılan), `edu` veya `enterprise`                            |

Yenileme belirtecini, `substrate.office.com/sydney` kapsamına sahip bir Microsoft
cihaz kodu veya yetkilendirme kodu akışından edinin. `refreshToken` ayarlandığında
Pusula, her istekten önce `access_token` değerini önceden yeniler; böylece her
~75 dakikalık süre dolumundan sonra kimlik bilgisini yeniden almanız gerekmez.

`refreshToken` ayarlanmamışsa her süre dolumundan sonra WebSocket kimlik bilgisini
elle yeniden almanız gerekir.

### Katman seçimi

| Katman       | Diğer ad       | Yüzey                    |
| ------------ | -------------- | ------------------------ |
| `individual` | _(varsayılan)_ | Bireysel M365 Copilot    |
| `edu`        | `included`     | Eğitim için M365 Copilot |
| `enterprise` | `work`         | İş için M365 Copilot     |

Katmanı **Advanced Settings → providerSpecificData → tier** bölümünde ayarlayın. Katman,
BizChat yönlendirmesini ve model erişimini etkiler.

## Güvenlik modeli

- **Resmî olmayan entegrasyon.** Bu sağlayıcı, BizChat WebSocket
  protokolünü tersine mühendislikle çözümler. Microsoft uç noktayı değiştirdiğinde
  önceden bildirimde bulunulmaksızın çalışmayı durdurabilir.
- `subscriptionRisk: true` bayrağı, entegrasyonun belgelenmemiş bir
  uç noktaya dayandığını belirtir. Hesap kısıtlamaları olasıdır ancak doğrulanmamıştır.
- Erişim belirteci kısa ömürlü bir JWT'dir. Bunu bir parola gibi değerlendirin:
  depoya göndermeyin, günlüğe kaydetmeyin veya paylaşmayın.
- Yenileme belirteci, BizChat yüzeyine uzun süreli erişim sağlar. Bunu bir
  API anahtarıyla aynı özeni göstererek saklayın.

## Sorun giderme

### Kimlik doğrulama hemen başarısız oluyor

- Bir XHR/Fetch isteğinden değil, **WebSocket URL'sinden** kopyaladığınızı doğrulayın.
  Kimlik bilgisi, Chathub WebSocket bağlantısının `access_token` sorgu
  parametresindedir; `Authorization: Bearer` başlığında değildir.
- `chathubPath` değerinin URL yolundaki tam `<oid>@<tenant>` bölümünü
  içerdiğinden emin olun.

### Belirteç yaklaşık 75 dakika sonra sona eriyor

Bu beklenen bir durumdur. `refreshToken` olmadan erişim belirteci kısa ömürlüdür. Şunlardan birini yapın:

- Kimlik bilgisini DevTools'tan yeniden yakalayın veya
- Otomatik yenileme için Gelişmiş Ayarlar'da bir `refreshToken` yapılandırın.

### Bağlantıyı Test Et başarılı oluyor ancak sohbet 401 döndürüyor

Belirtecin süresi doğrulama ile ilk istek arasında dolmuş olabilir. Yeni bir
kimlik bilgisini yeniden yakalayın.

### Copilot sağlayıcı listesinde görünmüyor

**Kontrol Paneli → Sağlayıcılar** bölümünde `copilot-m365-web` seçeneğinin etkinleştirildiğinden emin olun. Sağlayıcı,
bazı katmanlarda varsayılan olarak gizli olabilir.

## Referanslar

- Sorun: [#12779](https://github.com/Ferhat-Yasinoglu/pusula/issues/12779)
- Tartışma: [#12756](https://github.com/Ferhat-Yasinoglu/pusula/discussions/12756)
- Kaynak: `src/shared/constants/providers/web-cookie.ts` (sağlayıcı tanımı)
- HAR içe aktarma: `src/shared/utils/m365HarImport.ts`
- Kimlik bilgisi alanları: `src/shared/providers/webSessionCredentials.ts`
- Katman modalı: `src/app/(dashboard)/dashboard/providers/[id]/components/modals/m365Tier.ts`
