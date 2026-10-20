# Pusula vs Alternatives (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../comparison/PUSULA_VS_ALTERNATIVES.md) · 🇩🇪 [de](../../../de/docs/comparison/PUSULA_VS_ALTERNATIVES.md) · 🇮🇷 [fa](../../../fa/docs/comparison/PUSULA_VS_ALTERNATIVES.md)

---

Popüler açık kaynaklı yapay zekâ yönlendiricileriyle nesnel özellik karşılaştırması.

> **Metodoloji**: Herkese açık depolar 2026-Q2 döneminde denetlendi. Sürümler listelendiği gibidir.
> Düzeltmeleri PR aracılığıyla gönderin — bunun doğru olmasını istiyoruz.

| Özellik                                             |                Pusula 3.8                 |   LiteLLM 1.x   | OpenRouter (SaaS) |  Portkey   |
| --------------------------------------------------- | :------------------------------------------: | :-------------: | :---------------: | :--------: |
| **Sağlayıcılar**                                    |                   **329**                    |      ~100       |        ~50        |    ~30     |
| **Ücretsiz/kimlik doğrulamasız katalog girdileri**  |                   **155**                    |       yok       |  doğrudan geçiş   |    yok     |
| **Kendi sunucunuzda barındırılabilir**              |                      ✅                      |       ✅        |        ❌         | ⚠ ücretli  |
| **OAuth katalog girdileri**                         |                    **23**                    |      kısmi      |        ❌         |     ❌     |
| **Otomatik yedekleme kombinasyonları**              |               **19 strateji**                | öncelik tabanlı |  kademe tabanlı   | ağırlıklı  |
| **Birleştirme (paralel panel + hakem sentezi)**     |                      ✅                      |       ❌        |        ❌         |     ❌     |
| **Kademe 1/2/3 yedekleme (abonelik→ucuz→ücretsiz)** |                   ✅ + UI                    |     manuel      |        yok        |   manuel   |
| **Token sıkıştırma**                                | 12 motorlu yığın (RTK + Caveman + LLMLingua) |       yok       |        yok        |    yok     |
| **Çok modlu üretim (konuşma/müzik/video)**          |                      ✅                      |       ❌        |  doğrudan geçiş   |     ❌     |
| **Yerleşik MCP sunucusu**                           |            ✅ 110 araç, 33 kapsam            |       ❌        |        ❌         |     ❌     |
| **A2A protokolü**                                   |                 ✅ 6 beceri                  |       ❌        |        ❌         |     ❌     |
| **Bellek (FTS5 + vektör)**                          |                      ✅                      |       ❌        |        ❌         |     ❌     |
| **Koruma önlemleri (PII, enjeksiyon, görsel)**      |                      ✅                      |      kısmi      |        ❌         | ✅ ücretli |
| **Bulut ajanı entegrasyonları**                     |         Codex, Cursor, Devin, Jules          |       ❌        |        ❌         |     ❌     |
| **Sağlayıcı başına devre kesici**                   |       ✅ 3 durumlu, gecikmeli kurtarma       |      temel      |        ❌         |     ✅     |
| **TLS parmak izi gizleme (JA3/JA4)**                |                  ✅ wreq-js                  |       ❌        |        ❌         |     ❌     |
| **Değerlendirme çerçevesi**                         |                 ✅ yerleşik                  |       ❌        |        ❌         | ⚠ ücretli  |
| **MITM proxy (Cursor/Antigravity'yi yakalar)**      |             ✅ platformlar arası             |       ❌        |        ❌         |     ❌     |
| **Sistem tepsili CLI (Electron olmadan)**           |                      ✅                      |       ❌        |        yok        |    yok     |
| **CLI makine kimliğiyle otomatik doğrulama**        |                      ✅                      |       ❌        |        yok        |    yok     |
| **Kontrol paneli**                                  |                  Next.js 16                  |      temel      |     tescilli      |  tescilli  |
| **i18n**                                            |              **42 yerel ayar**               |       ❌        |        ❌         |     ⚠      |
| **Herkese açık ajan becerileri (SKILL.md)**         |                    ✅ 45                     |       ❌        |        ❌         |     ❌     |
| **Tünel desteği (Cloudflared, Tailscale, Ngrok)**   |                      ✅                      |       ❌        |        yok        |    yok     |
| **Lisans**                                          |                     MIT                      |       MIT       |     tescilli      |  tescilli  |

## Pusula ne zaman tercih edilmeli?

- Kendi sunucunuzda barındırıyor ve **azami sağlayıcı kapsamı** istiyorsanız (329 sağlayıcı, 155 ücretsiz/kimlik doğrulamasız katalog girdisi)
- **Yerleşik bir MCP sunucusuna** ihtiyacınız varsa (araç olarak sunulan LLM araçları, bellek ve beceriler)
- Ajanlar arası iş akışları için **A2A protokolüne** ihtiyacınız varsa
- Üst sistemlerdeki CAPTCHA'lar tarafından algılanmamak için **parmak izi gizleme** (JA3/JA4) istiyorsanız
- SaaS faturası olmadan **kurumsal özelliklere** (koruma önlemleri, değerlendirmeler, denetim izi) ihtiyacınız varsa

## LiteLLM ne zaman tercih edilmeli?

- Önceliğiniz **Python** ise ve `litellm.completion()` ile sıkı entegrasyona ihtiyacınız varsa
- **Olgun üretim dağıtımı reçetelerine** (k8s, Helm chart'ları) ihtiyacınız varsa
- Ekibiniz hâlihazırda Python mikro hizmetleri çalıştırıyorsa

## OpenRouter (SaaS) ne zaman tercih edilmeli?

- Kendi sunucunuzda barındırmak istemiyorsanız
- SaaS kâr marjıyla token başına ödeme yapmak sizin için uygunsa
- Tüm sağlayıcılarda **tek bir ödeme yöntemine** ihtiyacınız varsa

## Portkey ne zaman tercih edilmeli?

- Çalışma süresi garantileri içeren **ticari bir SLA'ya** ihtiyacınız varsa
- Operasyon yükü olmadan **yönetilen bir kontrol panelini** tercih ediyorsanız
- Kullanıma hazır **kurumsal uyumluluk** özelliklerine ihtiyacınız varsa

---

_Son güncelleme: 2026-08-02. Bu tabloyu doğru tutmak için düzeltmeleri PR aracılığıyla gönderin._
