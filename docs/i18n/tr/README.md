# README (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../README.md) · 🇩🇪 [de](../de/README.md) · 🇮🇷 [fa](../fa/README.md)

---

<div align="center">

<img src="./docs/screenshots/MainPusula.png" alt="Pusula Kontrol Paneli" width="820"/>

<br/>
<br/>

# 🧭 Pusula — Ücretsiz Yapay Zeka Ağ Geçidi

<img src="./docs/diagrams/readme-hero.svg" width="100%" alt="Pusula — Kodlamayı asla bırakmayın. Her yapay zeka aracı → 358 sağlayıcı — 150'den fazlası ücretsiz — tek bir uç nokta üzerinden. Claude Code, Codex, Cursor, Cline, Copilot ve Antigravity'yi otomatik geri dönüş ile ÜCRETSİZ Claude / GPT / Gemini'ye dönüştürün. RTK + Caveman yığılmış sıkıştırma %15-95 token tasarrufu sağlar (ortalama ~%89) — asla limitlere takılmazsınız. 358 yapay zeka sağlayıcısı · 150'den fazla ücretsiz katman · ayda ~1.62 milyar ücretsiz token · 19 yönlendirme stratejisi · başlamak için 0 $."/>

</div>

<div align="center">

## 💰 Ayda ~1,62 Milyar Ücretsiz Token

</div>

> Ücretsiz katmanları elle bir araya getirmek zahmetlidir — onlarca SDK, onlarca hız sınırı ve gerçekte ne kadar kotanız olduğuna dair hiçbir fikir yok. Pusula, **35 yinelenen havuz anahtarında 489 ücretsiz katman girdisini** kataloglar ve token başlığını, **yayımlanmış pozitif aylık bütçeye sahip 17 havuz ile modele özel beş Groq sınırından**, ortak havuzları tekilleştirerek hesaplar. Yalnızca bölgesel kimlik doğrulamasından sonra kullanılabilen kotalar (bugün için: ModelScope) ayrı gösterilir; bölgesel kimlik doğrulamasının arkasındaki +~6M hiçbir zaman başlıktaki toplama dahil edilmez. Sonuç kontrol panelinde (`/dashboard/free-tiers`) görünür kalır.

<img src="./docs/diagrams/free-tier-budget.svg" width="100%" alt="Pusula ücretsiz katman bütçe kartı: ayda düzenli olarak ~1,62 milyar ücretsiz token; kayıt kredileriyle ilk ayda ~2,22 milyara kadar; tek bir uç noktanın arkasında kataloglanmış 489 ücretsiz katman girdisini kapsayan, belgelenmiş 35 yinelenen havuz anahtarından. Ortak havuzları tekilleştiren dürüst hesaplama — yayımlanmış pozitif aylık token bütçesine sahip 17 yinelenen havuz ve modele özel beş Groq sınırı dahil olmak üzere her ortak havuz yalnızca bir kez sayılır; koşul riski kataloğunda 13 sağlayıcı kaçınılacak olarak işaretlenmiştir, böylece kararı siz verirsiniz. Bütçe çubuğunda Mistral 1B, Nara 210M, LLM7 150M, xKiro 150M, Groq 30M (modele özel beş sınır) ve daha küçük havuzlar bulunur; ayrıca ilk ay kayıt kredileri ile kalıcı olarak ücretsiz ve token sınırı olmayan sağlayıcılar, başlıktaki sayıyı hiçbir zaman şişirmemeleri için ayrı gösterilir. Canlı kullanılan/kalan değerleri /dashboard/free-tiers üzerinde."/>

> Canlı `/dashboard/free-tiers` sayfasının animasyonlu özeti. Tam metodoloji (havuz tekilleştirme, kredi katmanları, sağlayıcı koşulları): **[docs/reference/FREE_TIERS.md](docs/reference/FREE_TIERS.md)**.
>
> <sub>Bu rakamlar, canlı katalogla karşılaştırılarak iki haftada bir yeniden denetlenir ve **her iki yönde de değişir** — bir sağlayıcı ücretsiz katmanını sonlandırırsa sayı düşer; yenisi eklenirse yükselir. Yuvarlanarak artırılmış en iyi senaryoyu değil, her zaman kataloğun gerçekten hesapladığı değeri yayımlarız.</sub>

<br/>

<div align="center">

<h3>

⭐ PUSULA para tasarrufu yapmanıza ve işinizi kolaylaştırmanıza yardımcı olduysa repoya yıldız verin.

</h3>

[![Yıldızlar](https://img.shields.io/github/stars/Ferhat-Yasinoglu/pusula?style=social)](https://github.com/Ferhat-Yasinoglu/pusula)

### 💬 Sorular ve destek

[![GitHub Issues](https://img.shields.io/badge/GitHub-Issues-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ferhat-Yasinoglu/pusula/issues)
[![GitHub Discussions](https://img.shields.io/badge/GitHub-Discussions-181717?style=for-the-badge&logo=github&logoColor=white)](https://github.com/Ferhat-Yasinoglu/pusula/discussions)

**Hata bildirimleri ve özellik istekleri → [GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues) · Sorular, sağlayıcı ipuçları ve fikir alışverişi → [GitHub Discussions](https://github.com/Ferhat-Yasinoglu/pusula/discussions)**

<br/>

## 🧩 Kullanılabilir

[![npm sürümü](https://img.shields.io/npm/v/pusula?color=cb3837&logo=npm)](https://www.npmjs.com/package/pusula)
![Aylık NPM](https://img.shields.io/npm/dm/pusula?label=npm/month&color=cb3837&logo=npm)
[![GHCR](https://img.shields.io/badge/GHCR-ghcr.io%2Fferhat--yasinoglu%2Fpusula-2496ED?logo=docker&logoColor=white)](https://github.com/Ferhat-Yasinoglu/pusula/pkgs/container/pusula)
[![Lisans: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
![Docker İndirmeleri](https://img.shields.io/docker/pulls/ferhat-yasinoglu/pusula?label=docker%20pulls&logo=docker&color=2496ED)
![Electron İndirmeleri](https://img.shields.io/github/downloads/ferhat-yasinoglu/pusula/total?style=flat&label=electron%20downloads&logo=electron&color=47848F)

<table>
  <tr>
    <td align="right"><b>🚀 Başlangıç</b></td>
    <td align="center"><a href="#-quick-start">🚀 Hızlı Başlangıç</a></td>
    <td align="center"><a href="#-more-install-methods--docker-source-pnpm-arch">📦 Kurulum</a></td>
    <td align="center"><a href="#-works-the-second-you-install-it--no-keys-no-config">🆓 Sıfır Yapılandırma</a></td>
  </tr>
  <tr>
    <td align="right"><b>💡 Öğrenin</b></td>
    <td align="center"><a href="#-the-promise">💥 Vaat</a></td>
    <td align="center"><a href="#-why-pusula">🤔 Neden Pusula?</a></td>
    <td align="center"><a href="#-what-sets-pusula-apart">🏆 Fark Yaratan Özellikler</a></td>
  </tr>
  <tr>
    <td align="right"><b>⚙️ Özellikler</b></td>
    <td align="center"><a href="#-combos--the-flagship">🎯 Kombolar</a></td>
    <td align="center"><a href="#-357-ai-providers--152-catalog-marked-free">🌐 Sağlayıcılar</a></td>
    <td align="center"><a href="#-full-cli--a2a--mcp">🔌 CLI ve MCP</a></td>
  </tr>
  <tr>
    <td align="right"></td>
    <td align="center"><a href="#%EF%B8%8F-save-1595-tokens--automatically">🗜️ Sıkıştırma</a></td>
    <td align="center"><a href="#%EF%B8%8F-where-pusula-runs--anywhere">🖥️ Nerede Çalışır?</a></td>
    <td align="center"><a href="#-private--local-first">🔒 Gizli</a></td>
  </tr>
  <tr>
    <td align="right"><b>👀 Görün</b></td>
    <td align="center"><a href="#-compatible-clis--coding-agents">🤖 Uyumlu CLI'lar</a></td>
    <td align="center"><a href="#-topluluk-ve-yardım">💬 Topluluk ve Yardım</a></td>
    <td align="center"><a href="#-katkıda-bulunma">👥 Katkıda Bulunma</a></td>
  </tr>
  <tr>
    <td align="right"><b>📦 Proje</b></td>
    <td align="center"><a href="#%EF%B8%8F-tech-stack">🛠️ Teknoloji Yığını</a></td>
    <td align="center"><a href="#-documentation">📖 Belgeler</a></td>
    <td align="center"><a href="#-lisans">📄 Lisans</a></td>
  </tr>
</table>

</div>

<div align="center">
  <b>🌐 4 dilde</b>
  <br/><br/>
  <a href="../../../README.md"><img src="../../assets/flags/us.svg" width="30" alt="English (en)" title="English (en)"></a>
  <a href="README.md"><img src="../../assets/flags/tr.svg" width="30" alt="Türkçe (tr)" title="Türkçe (tr)"></a>
  <a href="../de/README.md"><img src="../../assets/flags/de.svg" width="30" alt="Deutsch (de)" title="Deutsch (de)"></a>
  <a href="../fa/README.md"><img src="../../assets/flags/ir.svg" width="30" alt="فارسی (fa)" title="فارسی (fa)"></a>
</div>

<br/>
<br/>

<div align="center">

## 🆓 Yüklediğiniz anda çalışır — anahtar yok, yapılandırma yok

</div>

<img src="./docs/diagrams/works-zero-config.svg" width="100%" alt="Yüklediğiniz anda çalışır — sıfır yapılandırma. Üç adım: 1. Kurulum — npm i -g pusula, sunucu localhost:20128 üzerinde başlar. 2. Aracınızı http://localhost:20128/v1 adresine yönlendirin — herhangi bir OpenAI uyumlu araç (Claude Code, Cursor, Cline). 3. Cevap verir — anında yanıt için `auto` modelini çağırın, API anahtarı, kayıt veya yapılandırma yok. Anahtarsız sağlayıcı OpenCode Free, `auto` kombinasyonuna önceden bağlanmıştır, bu nedenle yeni bir kurulum kutudan çıktığı gibi yanıt verir."/>

```bash
# Yeni kurulum, sıfır kimlik bilgisi — `auto` zaten çalışıyor:
curl http://localhost:20128/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"auto","messages":[{"role":"user","content":"Hello!"}]}'
```

<sub>Belirli bir ücretsiz arka ucu mu tercih ediyorsunuz? `oc/…` (OpenCode Free) adresini doğrudan çağırın. Ardından `auto`'ya geçin ve Pusula'un seçmesine izin verin.</sub>

<sub>📦 **Python, Node.js, PHP ve cURL** için kopyala-yapıştır hızlı başlangıç betikleri → [`examples/quickstart/`](examples/quickstart/)</sub>

<br/>

<div align="center">

# 💥 Vaat

</div>

<img src="./docs/diagrams/promise-pillars.svg" width="100%" alt="Vaat — Tek bir uç nokta ve 358 sağlayıcı. Başka sağlıklı bir hedef mevcutken otomatik geri dönüş yönlendirmeyi sürdürür. Altı temel ilke: 358 sağlayıcı arasında esnek geri dönüş · uygun iş yüklerinde %95'e varan token tasarrufu · 150'den fazla ücretsiz katman ve 54 tekrarlayan/anahtarsız sonsuza dek ücretsiz sağlayıcı ile başlamak için 0 $ · tek bir yapılandırma ile 36 CLI/ajan entegrasyonu · /v1 adresinde OpenAI, Claude, Gemini ve Responses API uyumluluğu · devre kesiciler, TLS gizliliği, MCP 110 araçları, A2A, bellek, koruma kalkanları, değerlendirmeler ve 5.100'den fazla takip edilen test dosyasında 39.000'den fazla statik test bildirimi dahil üretim kontrolleri."/>

<br/>
<br/>

<div align="center">

# 🤔 Neden Pusula?

</div>

<img src="./docs/diagrams/why-pain-fix.svg" width="100%" alt="Neden Pusula — 10 panoyu, ölü API anahtarlarını ve sürpriz faturaları dengelemeyi bırakın. On günlük sorun ve çözümleri: kullanılmayan kota sona eriyor → abonelikleri maksimize edin; kodlama sırasında hız limitleri → 4 katmanlı otomatik geri dönüş (Abonelik → API → Ucuz → Ücretsiz); araç çıktıları token yakıyor → RTK + Caveman sıkıştırma (%15–95); pahalı API'ler → maliyet optimize edilmiş yönlendirme; her aracın kendi kurulumu → tek uç nokta, tek pano; yapay zeka engellendi → 3 seviyeli proxy + TLS gizliliği; ölü anahtarlar → 3 katmanlı esneklik (devre kesiciler, anahtar soğutma, model kilitleme); tek aboneliği paylaşan ekip → adil paylaşımlı kotalara sahip anahtar havuzları; birinin bulutu üzerinden istemler → AES-256-GCM şifreli anahtarlarla yerel öncelikli; harcama görünürlüğü yok → canlı analizler (kullanım, kota, tasarruf, p95 gecikme)."/>

<div align="center">

<img src="./docs/diagrams/tier-cascade.svg" width="100%" alt="Pusula istek akışı: IDE'niz veya CLI'nız (Claude Code, Cursor, Cline…) tek bir yerel uç noktayı (http://localhost:20128/v1) çağırır; Pusula Akıllı Yönlendirici (RTK + Caveman sıkıştırma, 19 yönlendirme stratejisi, devre kesiciler, TLS gizliliği, MCP, A2A, koruma kalkanları), uygun sağlıklı bir hedef kaldığı sürece 4 sağlayıcı katmanı arasında geri dönüş yapabilir — Katman 1 Abonelik, Katman 2 API Anahtarı, Katman 3 Ucuz ve Katman 4 Ücretsiz."/>

</div>

<br/>

<div align="center">

## 🎯 Kombolar — Amiral Gemisi

</div>

<img src="./docs/diagrams/strategies-grid.svg" width="100%" alt="All 19 combo routing strategies animated — one tile per strategy: priority, fill-first, weighted, round-robin, p2c, least-used, random, strict-random, cost-optimized, headroom, reset-window, reset-aware, context-relay, context-optimized, cache-optimized, lkgp, auto, fusion, pipeline. See the table above for what each one does."/>

> Bir **kombo**, Pusula'un **otomatik olarak** yönlendirme yaptığı model zinciridir. Kota bittiğinde, sağlayıcı çöktüğünde veya maliyetler fırladığında — kombo sessizce bir sonraki modele geçer. **Pusula'u kesintisiz kılan şey budur.** 🛡️

### ⚡ Sıfır yapılandırma — sadece `auto` kullanın

Oluşturulacak bir kombo yok. Modelinizi `auto` (veya bir varyantı) olarak ayarlayın; Pusula bağlı sağlayıcılarınızdan canlı olarak puanlanan sanal bir kombo oluşturur:

<table>
  <tr><th align="left">Model ID</th><th align="left">Neyi optimize eder</th></tr>
  <tr><td align="left" nowrap><code>auto</code></td><td align="left">🎯 Dengeli varsayılan (LKGP — son başarılı sağlayıcınıza sadık kalır)</td></tr>
  <tr><td align="left" nowrap><code>auto/coding</code></td><td align="left">🧑‍💻 Kod üretimi için kalite öncelikli ağırlıklar</td></tr>
  <tr><td align="left" nowrap><code>auto/fast</code></td><td align="left">⚡ Öncelikli olarak en düşük gecikme süresi</td></tr>
  <tr><td align="left" nowrap><code>auto/cheap</code></td><td align="left">💰 Öncelikli olarak token başına en ucuz model</td></tr>
  <tr><td align="left" nowrap><code>auto/offline</code></td><td align="left">🔋 Öncelikli olarak en fazla kota / hız sınırı payı olan model</td></tr>
  <tr><td align="left" nowrap><code>auto/smart</code></td><td align="left">🔭 Kalite öncelikli + daha iyi modeller keşfetmek için %10 keşif payı</td></tr>
</table>

##

### 🔀 Veya kendinizinkini oluşturun — 19 yönlendirme stratejisi

Tüm **19** strateji — kombo adımı başına karıştırın ve eşleştirin:

<table>
  <tr>
    <th>#</th>
    <th align="left">Strateji</th>
    <th align="left">Ne yapar</th>
  </tr>
  <tr>
    <td align="center">1</td>
    <td nowrap><code>priority</code></td>
    <td>İlk hedeften sıralı liste — sonrakine geçmeden önce her birini tüketir 🥇</td>
  </tr>
  <tr>
    <td align="center">2</td>
    <td nowrap><code>fill-first</code></td>
    <td>Devam etmeden önce her hedefin kotasını tamamen doldurur</td>
  </tr>
  <tr>
    <td align="center">3</td>
    <td nowrap><code>weighted</code></td>
    <td>Hedef başına ağırlığa göre ağırlıklı rastgele seçim</td>
  </tr>
  <tr>
    <td align="center">4</td>
    <td nowrap><code>round-robin</code></td>
    <td>Hedefler arasında sırayla döner</td>
  </tr>
  <tr>
    <td align="center">5</td>
    <td nowrap><code>p2c</code></td>
    <td>İki seçenekli güç (power-of-two-choices) rastgele yük dengeleme</td>
  </tr>
  <tr>
    <td align="center">6</td>
    <td nowrap><code>least-used</code></td>
    <td>Mevcut yükü en düşük olan hedefi seçer</td>
  </tr>
  <tr>
    <td align="center">7</td>
    <td nowrap><code>random</code></td>
    <td>Tekdüze rastgele seçim (tekilleştirilmiş)</td>
  </tr>
  <tr>
    <td align="center">8</td>
    <td nowrap><code>strict-random</code></td>
    <td>Tekrarları tekilleştirmeden rastgele seçim 🎲</td>
  </tr>
  <tr>
    <td align="center">9</td>
    <td nowrap><code>cost-optimized</code></td>
    <td>Canlı katalog fiyatlandırması üzerinden istek başına maliyeti ($) en aza indirir 💸</td>
  </tr>
  <tr>
    <td align="center">10</td>
    <td nowrap><code>headroom</code></td>
    <td>En çok kalan kotası olan hedefi seçer</td>
  </tr>
  <tr>
    <td align="center">11</td>
    <td nowrap><code>reset-window</code></td>
    <td>Kota penceresi en erken sıfırlanacak hedefi tercih eder</td>
  </tr>
  <tr>
    <td align="center">12</td>
    <td nowrap><code>reset-aware</code></td>
    <td>Kota sıfırlama süresine göre sıralar — kısa pencereler önce 📊</td>
  </tr>
  <tr>
    <td align="center">13</td>
    <td nowrap><code>context-relay</code></td>
    <td>Uzun konuşmalarda bağlamı hedefler arasında devreder 🧠</td>
  </tr>
  <tr>
    <td align="center">14</td>
    <td nowrap><code>context-optimized</code></td>
    <td>Mevcut bağlam boyutu için en uygun modeli seçer</td>
  </tr>
  <tr>
    <td align="center">15</td>
    <td nowrap><code>cache-optimized</code></td>
    <td>Her yeniden kullanılabilir istem önekini aynı hesaba sabitler — istem önbelleği (prompt-cache) isabetlerini maksimize eder 🎯</td>
  </tr>
  <tr>
    <td align="center">16</td>
    <td nowrap><code>lkgp</code></td>
    <td>Son Bilinen İyi Yol (Last-Known-Good Path) — son başarılı hedefe bağlı kalır</td>
  </tr>
  <tr>
    <td align="center">17</td>
    <td nowrap><code>auto</code></td>
    <td>Tüm bağlantılar arasında 14 faktörlü canlı puanlama 🤖</td>
  </tr>
  <tr>
    <td align="center">18</td>
    <td nowrap><code>fusion</code></td>
    <td>Bir model paneline paralel dağıtır + bir hakem model tek bir nihai yanıt sentezler 🧬</td>
  </tr>
  <tr>
    <td align="center">19</td>
    <td nowrap><code>pipeline</code></td>
    <td>Adımları birbirine bağlar — her hedefin çıktısı sonrakini besler 🔗</td>
  </tr>
</table>

<sub>Auto-Combo motoru her adayı **14 faktör** üzerinden puanlar (sağlık, kota, maliyet, gecikme, başarı oranı, tazelik…) — bkz. [`docs/routing/AUTO-COMBO.md`](docs/routing/AUTO-COMBO.md).</sub>

##

### 🧱 Dayanıklılık yerleşiktir (3 bağımsız katman)

<img src="./docs/diagrams/resilience-layers.svg" width="100%" alt="Pusula resilience — 3 independent self-healing layers, the right layer for the right failure. Layer 1 provider circuit breaker (whole provider): trips only on 408/5xx, thresholds OAuth 10× / API-key 15× / local 2×, resets 60s/30s/15s into a HALF-OPEN probe, lazy recovery; while OPEN the combo reroutes to the next provider. Layer 2 connection cooldown (one key/account): base 5s OAuth / 3s API-key, exponential ×2 backoff with anti-thundering-herd guard, 429 honors Retry-After, success clears all error state; one cooling key is skipped while sibling keys keep serving. Layer 3 model lockout (one model): per-model 429, local 404 or mode denials lock just that model — never the whole connection. Terminal states (banned, expired, credits exhausted) are for the operator, not cooldowns."/>

<sub>📖 [Auto-Combo Motoru](docs/routing/AUTO-COMBO.md) · [Dayanıklılık Kılavuzu](docs/architecture/RESILIENCE_GUIDE.md)</sub>

<br/>

<div align="center">

## 🏆 Pusula'u Farklı Kılan Nedir

</div>

<img src="./docs/diagrams/comparison-table.svg" width="100%" alt="Pusula'u farklı kılan nedir — 9router, OpenRouter, CLIProxyAPI ve LiteLLM'e karşı 13 yetenek üzerinden eski tarihli bir özellik anlık görüntüsü. Pusula: 358 sağlayıcı, 150'den fazla yerleşik ücretsiz katman, 19 yönlendirme stratejisi, 12 motorlu token sıkıştırma, 110 araçlı yerleşik MCP sunucusu, A2A aracı protokolü, kalıcı bellek, güvenlik önlemleri, bulut aracıları, TLS parmak izi gizliliği, Masaüstü/Termux/PWA ve 42 uluslararası kullanıcı arayüzü yerel ayarı. Pusula MIT lisanslıdır ve kendi kendine barındırılabilir. Rakip yetenekleri ve sayıları değişebilir; bağlantılı metodolojiye bakın."/>

<sub>📊 Tam metodoloji ve özellik bazında detay vs 9router, OpenRouter, CLIProxyAPI &amp; LiteLLM → [`docs/comparison/PUSULA_VS_ALTERNATIVES.md`](docs/comparison/PUSULA_VS_ALTERNATIVES.md)</sub>

<br/>

<div align="center">

## 🤖 Uyumlu CLI'lar ve Kodlama Ajanları

> Tek bir yapılandırma — `http://localhost:20128/v1` — ile **tüm** yapay zekâ IDE'leri veya CLI'ları ücretsiz ve düşük maliyetli modellerde çalışır.

<div align="center">
<table>
  <tr>
    <td align="center" width="76"><a href="https://github.com/anthropics/claude-code"><img src="./public/providers/claude.svg" width="40" alt="Claude Code"/><br/><sub><b>Claude Code</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><a href="https://github.com/openai/codex"><img src="./public/providers/codex.svg" width="40" alt="Codex CLI"/><br/><sub><b>Codex CLI</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/cline.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/cline.svg" width="40" alt="Cline"/></picture><br/><sub><b>Cline</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><a href="https://github.com/Kilo-Org/kilocode"><img src="./public/providers/cli-generic.svg" width="40" alt="Kilo Code"/><br/><sub><b>Kilo Code</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><a href="https://github.com/Zoo-Code-Org/Zoo-Code"><img src="./public/providers/cli-generic.svg" width="40" alt="Zoo Code"/><br/><sub><b>Zoo Code</b></sub><br/><sub>                           </sub></a></td>
    <td align="center" width="76"><img src="./public/providers/continue.svg" width="40" alt="Continue"/><br/><sub><b>Continue</b></sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Aider"/><br/><sub><b>Aider</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="ForgeCode"/><br/><sub><b>ForgeCode</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="jcode"/><br/><sub><b>jcode</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/deepseek.svg" width="40" alt="DeepSeek TUI"/><br/><sub><b>DeepSeek TUI</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="CodeWhale"/><br/><sub><b>CodeWhale</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><a href="https://github.com/anomalyco/opencode"><img src="./public/providers/cli-generic.svg" width="40" alt="OpenCode"/><br/><sub><b>OpenCode</b></sub><br/><sub>                           </sub></a></td>
  </tr>
  <tr>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Factory Droid"/><br/><sub><b>Factory Droid</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/copilot.svg" width="40" alt="GitHub Copilot CLI"/><br/><sub><b>Copilot CLI</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cursor.svg" width="40" alt="Cursor CLI"/><br/><sub><b>Cursor CLI</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Smelt"/><br/><sub><b>Smelt</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Pi (pi-coding-agent)"/><br/><sub><b>Pi</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/grok.svg" width="40" alt="Grok Build (xAI)"/><br/><sub><b>Grok Build</b></sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="76"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/nousresearch.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/nousresearch.svg" width="40" alt="Hermes Agent (Nous Research)"/></picture><br/><sub><b>Hermes Agent</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/openclaw.svg" width="40" alt="OpenClaw"/><br/><sub><b>OpenClaw</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/goose.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/goose.svg" width="40" alt="Goose"/></picture><br/><sub><b>Goose</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Open Interpreter"/><br/><sub><b>Open Interpreter</b></sub><br/><sub>                           </sub></td>
    <td align="center" width="76"><img src="./public/providers/cli-generic.svg" width="40" alt="Warp AI"/><br/><sub><b>Warp AI</b></sub><br/><sub>                           </sub></td>
  </tr>
</table>
</div>

<div align="center">
<b>＋ ayrıca şunlarla da çalışır:</b> · Agent Deck · Kiro · Command Code · Antigravity · Windsurf · AMP · <b>OpenAI uyumlu herhangi bir araç</b>
</div>

<sub>📖 36 aracın tümü için araç bazında kurulum (26 CLI Code + 10 CLI Agent) → [`docs/reference/CLI-TOOLS.md`](docs/reference/CLI-TOOLS.md) · 🧩 OpenCode eklentisi → [`@pusula/opencode-provider`](https://www.npmjs.com/package/@pusula/opencode-provider)</sub>

</div>

<br/>

**Desteklenen herhangi bir CLI'ı Pusula üzerinden tek komutla başlatın** — hiçbir yapılandırma dosyası yazılmaz,
kimlik bilgileri işlem bazında enjekte edilir, Qwen/Gemini geçici ve yalıtılmış bir ana dizin kullanır:

```bash
pusula run claude   --model openai/gpt-5.4          # Claude Code
pusula run codex    --model glm/glm-5.2             # OpenAI Codex CLI
pusula run aider    --model glm/glm-5.2 -- --message "reply OK"
pusula run goose    --model glm/glm-5.2
pusula run opencode --model glm/glm-5.2 -- run "reply OK"
pusula run qwen     --model glm/glm-5.2 -- -p "reply OK"
pusula run gemini   --model glm/glm-5.2 -- --skip-trust -p "reply OK"

# Veya sağlayıcı+modeli etkileşimli olarak seçip aracın kendi yapılandırmasını yazın:
pusula configure codex          # ayrıca: claude opencode qwen aider goose gemini cline continue kilo
```

Her komut etkin uzak bağlama (`pusula connect <host>`) uyar; `--dry-run`,
çalıştırmadan tam ortam değişkenlerini/argümanları önizler ve `--api-key-env NAME`, gizli bilgileri
kabuk geçmişinizin dışında tutar. → [CLI Entegrasyonları](docs/guides/CLI-INTEGRATIONS.md)

<br/>

<div align="center">

## 🌐 357 AI Sağlayıcısı — 152'si Katalogda Ücretsiz Olarak İşaretli

</div>

> Standart sohbet, medya, arama, yerel, bulut aracısı ve sistem koleksiyonlarında **357 kayıtlı sağlayıcı** bulunuyor; bunların **152'si `hasFree: true` keşif meta verisi taşıyor**. Sohbet modeli kayıt defteri **229 sağlayıcıyı / 2.554 farklı sağlayıcı-model çiftini / 1.283 ham model kimliğini** kapsıyor; ayrı ücretsiz kullanım bütçesi kataloğunda ise **model başına 491 satır**, **35 yenilenen havuz** ve **54 yenilenen/API anahtarı gerektirmeyen, sonsuza kadar ücretsiz sağlayıcı** bulunuyor. Bunlar tasarım gereği farklı paydalardır; tanımlar ve havuz tekilleştirmeli hesaplamalar [Sağlayıcı Referansı](docs/reference/PROVIDER_REFERENCE.md) ve [Ücretsiz Katmanlar](docs/reference/FREE_TIERS.md) sayfalarında yer alır.

<div align="center">

### 🏢 Tüm büyük laboratuvarlar — tek bir uç nokta üzerinden

<table>
  <tr>
    <td align="center" width="80"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/openai.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/openai.svg" width="40" alt="OpenAI"/></picture><br/><sub>OpenAI</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/claude-color.svg" width="40" alt="Anthropic"/><br/><sub>Anthropic</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/gemini-color.svg" width="40" alt="Gemini"/><br/><sub>Gemini</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/grok.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/grok.svg" width="40" alt="xAI Grok"/></picture><br/><sub>xAI Grok</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/deepseek-color.svg" width="40" alt="DeepSeek"/><br/><sub>DeepSeek</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/mistral-color.svg" width="40" alt="Mistral"/><br/><sub>Mistral</sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/qwen-color.svg" width="40" alt="Qwen"/><br/><sub>Qwen</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/meta-color.svg" width="40" alt="Meta Llama"/><br/><sub>Meta Llama</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><picture><source media="(prefers-color-scheme:dark)" srcset="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-png@1.91.0/dark/groq.png"/><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/groq.svg" width="40" alt="Groq"/></picture><br/><sub>Groq</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/nvidia-color.svg" width="40" alt="NVIDIA"/><br/><sub>NVIDIA</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/minimax-color.svg" width="40" alt="MiniMax"/><br/><sub>MiniMax</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/cohere-color.svg" width="40" alt="Cohere"/><br/><sub>Cohere</sub><br/><sub>                           </sub></td>
  </tr>
  <tr>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/perplexity-color.svg" width="40" alt="Perplexity"/><br/><sub>Perplexity</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/huggingface-color.svg" width="40" alt="Hugging Face"/><br/><sub>HuggingFace</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/together-color.svg" width="40" alt="Together"/><br/><sub>Together</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/fireworks-color.svg" width="40" alt="Fireworks"/><br/><sub>Fireworks</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/cloudflare-color.svg" width="40" alt="Cloudflare"/><br/><sub>Cloudflare</sub><br/><sub>                           </sub></td>
    <td align="center" width="80"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/baidu-color.svg" width="40" alt="Baidu"/><br/><sub>Baidu</sub><br/><sub>                           </sub></td>
  </tr>
</table>

<sub>…ve 330'dan fazlası — her simge doğrudan kontrol panelinin sağlayıcı kataloğundan yüklenir. 📖 [Sağlayıcı Referansı](docs/reference/PROVIDER_REFERENCE.md)</sub>

<br/>

### 🆓 Sonsuza Kadar Ücretsiz — $0, kart gerekmez

<table>
  <tr>
    <td align="center" width="150"><img src="./public/providers/cli-generic.svg" width="42" alt="OpenCode Zen"/><br/><b>OpenCode Zen</b><br/><sub>DeepSeek V4, Nemotron 3<br/>Token sınırı yok</sub></td>
    <td align="center" width="150"><img src="./public/providers/cli-generic.svg" width="42" alt="Kilo Code"/><br/><b>Kilo Code</b><br/><sub>Otomatik yönlendirici, Tencent Hy3<br/>Sonsuza kadar ücretsiz</sub></td>
    <td align="center" width="150"><img src="./public/providers/requesty.svg" width="42" alt="Requesty"/><br/><b>Requesty</b><br/><sub>GPT-OSS 120B, Nemotron<br/>Sonsuza kadar ücretsiz</sub></td>
    <td align="center" width="150"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/siliconcloud-color.svg" width="42" alt="SiliconFlow"/><br/><b>SiliconFlow</b><br/><sub>DeepSeek V3.2 / R1<br/>Ücretsiz katman</sub></td>
    <td align="center" width="150"><img src="./public/providers/zhipu.svg" width="42" alt="Z.AI GLM"/><br/><b>Z.AI GLM</b><br/><sub>GLM-4.7 / 4.5-Flash<br/>Sonsuza kadar ücretsiz</sub></td>
    <td align="center" width="150"><img src="./public/providers/baidu.svg" width="42" alt="Baidu ERNIE"/><br/><b>Baidu ERNIE</b><br/><sub>ERNIE 4.0<br/>Sonsuza kadar ücretsiz</sub></td>
  </tr>
  <tr>
    <td align="center" width="150"><img src="https://cdn.jsdelivr.net/npm/@lobehub/icons-static-svg@1.91.0/icons/qoder-color.svg" width="42" alt="Qoder AI"/><br/><b>Qoder AI</b><br/><sub>Qwen3-Max, Kimi-K2<br/>Sınırsız ÜCRETSİZ</sub></td>
    <td align="center" width="150"><img src="./public/providers/pollinations.svg" width="42" alt="Pollinations"/><br/><b>Pollinations</b><br/><sub>GPT, Llama, Claude<br/>Anahtar gerekmez</sub></td>
    <td align="center" width="150"><img src="./public/providers/cloudflare.svg" width="42" alt="Cloudflare AI"/><br/><b>Cloudflare AI</b><br/><sub>50+ model<br/>Günde 10K nöron</sub></td>
    <td align="center" width="150"><img src="./public/providers/nvidia.svg" width="42" alt="NVIDIA NIM"/><br/><b>NVIDIA NIM</b><br/><sub>GLM, MiniMax<br/>Ücretsiz ~40 RPM</sub></td>
    <td align="center" width="150"><img src="./public/providers/cerebras.svg" width="42" alt="Cerebras"/><br/><b>Cerebras</b><br/><sub>GLM 4.7, GPT-OSS<br/>Günde 1M token</sub></td>
    <td align="center" width="150"><img src="./public/providers/openrouter.svg" width="42" alt="OpenRouter"/><br/><b>OpenRouter</b><br/><sub>:free modeller<br/>+$10 → daha yüksek RPM</sub></td>
  </tr>
</table>

📖 Makine tarafından okunabilir tam katalog → [`docs/reference/PROVIDER_REFERENCE.md`](docs/reference/PROVIDER_REFERENCE.md)

<br/>
</div>

<div align="center">

## 🖥️ Pusula Nerede Çalışır — Her Yerde

</div>

> Aynı uygulama, sizin makineniz, sizin kurallarınız. Global npm kurulumundan Termux aracılığıyla **telefonunuza** kadar.

<table>
  <tr><th align="left">Platform</th><th align="left">Kurulum</th><th align="left">Öne Çıkanlar</th></tr>
  <tr><td align="left" nowrap>📦 <b>npm (global)</b></td><td align="left" nowrap><code>npm install -g pusula</code></td><td align="left">Tek komut, her işletim sistemi</td></tr>
  <tr><td align="left" nowrap>🐳 <b>Docker</b></td><td align="left" nowrap><code>docker run … ferhat-yasinoglu/pusula</code></td><td align="left">Çoklu mimari desteği: <b>AMD64 + ARM64</b></td></tr>
  <tr><td align="left" nowrap>🖥️ <b>Masaüstü (Electron)</b></td><td align="left" nowrap><code>npm run electron:build</code></td><td align="left">Yerel pencere + sistem tepsisi — <b>Windows / macOS / Linux</b></td></tr>
  <tr><td align="left" nowrap>💪 <b>ARM</b></td><td align="left" nowrap>yerel <code>arm64</code></td><td align="left">Raspberry Pi, ARM sunucuları, Apple Silicon</td></tr>
  <tr><td align="left" nowrap>📱 <b>Android (Termux)</b></td><td align="left" nowrap><code>pkg install nodejs && npx -y pusula</code></td><td align="left"><b>Telefonunuzda</b> 7/24 çalışır, root gerektirmez</td></tr>
  <tr><td align="left" nowrap>📲 <b>PWA</b></td><td align="left" nowrap>"Ana Ekrana Ekle"</td><td align="left">Tam ekran, çevrimdışı, tarayıcıdan kurulabilir</td></tr>
  <tr><td align="left" nowrap>🧩 <b>OpenCode eklentisi</b></td><td align="left" nowrap><code>@pusula/opencode-provider</code></td><td align="left">Yerel OpenCode entegrasyonu</td></tr>
  <tr><td align="left" nowrap>🛠️ <b>Kaynak koddan</b></td><td align="left" nowrap><code>npm install && npm run dev</code></td><td align="left">Üzerinde çalışın, katkıda bulunun</td></tr>
</table>

<sub>📖 [Docker Rehberi](docs/guides/DOCKER_GUIDE.md) · [Masaüstü](electron/README.md) · [Termux](docs/guides/TERMUX_GUIDE.md) · [PWA](docs/guides/PWA_GUIDE.md) · [OpenCode](docs/frameworks/OPENCODE.md)</sub>

<br/>

<div align="center">

## 🔒 Gizli ve Önce Yerel (Local-First)

</div>

<img src="./docs/diagrams/privacy-local.svg" width="100%" alt="Private and local-first — your keys, your machine, your data; Pusula is a local proxy that never phones home. Eleven guarantees: runs 100% on your hardware (0 cloud hops), zero telemetry by default, credentials encrypted at rest (AES-256-GCM), no account or sign-up, hardened gateway (API-key scoping, IP filtering, rate limits, prompt-injection guard), loopback-only process routes, upstream header scrubbing, strictly opt-in PII redaction, sanitized errors that never leak internals, a local audit trail in your own SQLite, and MIT-licensed fully open-source code."/>

<sub>📖 [Yetkilendirme](docs/architecture/AUTHZ_GUIDE.md) · [Güvenlik Önlemleri](docs/security/GUARDRAILS.md) · [Uyumluluk](docs/security/COMPLIANCE.md)</sub>

<br/>

<div align="center">

## 🔌 Tam CLI + A2A ve MCP

</div>

> Sunucunun ötesinde, Pusula **80'den fazla komuta** sahip **kapsamlı bir komut satırı kokpitidir**; ayrıca bir yapay zeka ajanının onu **kendi başına** yönetebilmesi için açık ajan protokollerine sahiptir.

### ⌨️ Gerçek bir CLI (yalnızca `start` değil)

```bash
pusula               # ağ geçidini + panoyu sunar (port 20128)
pusula chat          # etkileşimli TUI sohbet istemcisi (komutlar: /model /combo /skill /memory)
pusula setup         # rehberli ilk çalıştırma sihirbazı
pusula doctor        # sağlayıcıları, portları ve yerel bağımlılıkları denetler
```

### 🛰️ Uzak mod — CLI'ı burada, Pusula'u bir VPS üzerinde çalıştırın

Pusula bir sunucuda mı kurulu? Dizüstü bilgisayarınızdan **aynı CLI** ile yönetin. Kapsamlı bir erişim tokenıyla bir kez oturum açın; ardından her komut uzak sunucuyu hedefler.

```bash
pusula connect 192.168.0.15            # şifre → kapsamlı token, bağlam olarak kaydedilir
pusula models list                     # ← UZAK sunucuya karşı çalışır
pusula configure codex                 # ← uzak bir model seçer, yerel bir Codex profili yazar
pusula tokens create --name ci --scope read   # diğer makineler için daha dar kapsamlı tokenlar üretir
pusula contexts use default            # ← yerel sunucuya geri döner
```

Tokenlar `read` / `write` / `admin` kapsamlarına sahiptir; süreç başlatan rotalar yalnızca yerel döngüde (loopback) kalır.
<sub>📖 [Uzak Mod](docs/guides/REMOTE-MODE.md)</sub>

<div align="left">

<img src="./docs/diagrams/cli-terminal.svg" width="50%" alt="Animated terminal demoing the Pusula CLI — pusula providers list, pusula combo list, pusula health — cycling over the 80+ command surface: providers · oauth · keys · combo · nodes · models · cache · compression · cost · usage · quota · health · resilience · telemetry · logs · audit · mcp · a2a · cloud · memory · skills · eval · tunnel · backup · sync · webhooks · policy · pricing · translator · simulate …"/>

</div>

### 🤝 Bir ajan bağlayın — ve Pusula'un kendisini yönetsin

Pusula'u **MCP**, **A2A**, bir **REST API**, **webhook'lar** veya bir **uzak CLI** üzerinden kullanıma açın — yetenekli herhangi bir ajan (veya kendi kodunuz) tüm ağ geçidinin anahtarlarını alır: yönlendirme, sağlayıcılar, kombolar, önbellek, sıkıştırma, bellek — tamamen özerk bir şekilde. Aşağıdaki HTTP uç noktaları `http://localhost:20128` altında sunulur.

<table>
  <tr><th align="left">Arayüz</th><th align="left">Uç nokta / komut</th><th align="left">Kullanım amacı</th></tr>
  <tr><td align="left" nowrap>🧰 <b>MCP (stdio)</b></td><td align="left" nowrap><code>pusula --mcp</code></td><td align="left">Claude Desktop, Cursor veya herhangi bir MCP istemcisine bağlayın</td></tr>
  <tr><td align="left" nowrap>🌊 <b>MCP (HTTP)</b></td><td align="left" nowrap><code>/api/mcp/stream</code></td><td align="left">Uzak MCP — <b>110 araç</b>, 33 kapsam, eksiksiz denetim kaydı</td></tr>
  <tr><td align="left" nowrap>📡 <b>MCP (SSE)</b></td><td align="left" nowrap><code>/api/mcp/sse</code></td><td align="left">Akışlı MCP taşıması</td></tr>
  <tr><td align="left" nowrap>🤝 <b>A2A</b></td><td align="left" nowrap><code>/.well-known/agent.json</code></td><td align="left">Ajandan ajana (Agent-to-agent), <b>JSON-RPC 2.0</b> + SSE, 6 yetenek</td></tr>
  <tr><td align="left" nowrap>🌐 <b>REST API</b></td><td align="left" nowrap><code>/v1/*</code></td><td align="left">OpenAI uyumlu — sohbet, embeddings, görseller, ses, OCR</td></tr>
  <tr><td align="left" nowrap>🔔 <b>Webhook'lar</b></td><td align="left" nowrap><code>/api/webhooks</code></td><td align="left">Olayları (kullanım, kota, hatalar, yönlendirme) URL'nize iletin</td></tr>
  <tr><td align="left" nowrap>🛰️ <b>Uzak CLI</b></td><td align="left" nowrap><code>pusula connect &lt;host&gt;</code></td><td align="left">Kapsamlı erişim tokenlarıyla uzak bir örneği yönetin</td></tr>
</table>

```bash
# Claude Code'a MCP üzerinden tam Pusula araç setini verin:
claude mcp add-server pusula --type http --url http://localhost:20128/api/mcp/stream
```

<sub>📖 [MCP Sunucusu](docs/frameworks/MCP-SERVER.md) · [A2A Sunucusu](docs/frameworks/A2A-SERVER.md) · [Ajan Protokolleri](docs/frameworks/AGENT_PROTOCOLS_GUIDE.md)</sub>

<br/>

<div align="center">

## 🗜️ Tokenlardan %15–95 Tasarruf Edin — Otomatik Olarak

</div>

### 📖 Nasıl çalışır — işlem hattı, mimari ve tasarruf matematiği

<img src="./docs/diagrams/compression-pipeline.svg" width="100%" alt="Pusula compression pipeline: a client request of 10,000 tokens passes through 12 stacked engines — Session-Dedup, CCR, Lite, RTK, Responses Tool Output, Headroom, Relevance, Caveman, Aggressive, LLMLingua-2, Ultra, OmniGlyph — and reaches the provider at about 1,080 tokens, up to 95% saved. Code, URLs and JSON are always preserved byte-perfect."/>

Varsayılan katmanlı kombo `RTK → Caveman` çalıştırır. Her ikisi de aynı araç/bağlam yükü üzerinde çalıştığında, tasarruflar katlanarak artar:

```txt
combined = 1 − (1 − RTK) × (1 − Caveman_input)
average  = 1 − (1 − 0.80) × (1 − 0.46) = 89.2%
range    = 78.4 – 94.6%
```

Kod blokları, URL'ler, JSON ve yapılandırılmış veriler koruma motoru tarafından **her zaman korunur**.

> **Az token işi görüyorsa neden çok token kullanasınız?** Her istek Pusula'un sıkıştırma hattından **şeffaf bir şekilde** geçer — istemci değişikliği gerekmez. Artık sırayla çalışan ve yönlendirme kombosu başına karıştırılıp eşleştirilebilen **12 birleştirilebilir motordan oluşan bir yığındır** — [RTK](https://github.com/rtk-ai/rtk), [Caveman](https://github.com/JuliusBrussee/caveman) (⭐ 90K+), [LLMLingua-2](https://github.com/microsoft/LLMLingua) ve [Troglodita](https://github.com/leninejunior/troglodita) (PT-BR) fikirleri üzerine inşa edilmiştir.

### 🧱 12 motorlu sıkıştırma yığını

Motorlar işlem hattı sırasına göre çalışır; her biri bağımsız olarak açılıp kapatılabilir ve kombo başına yapılandırılabilir:

<table>
  <tr><th align="center">#</th><th align="left">Motor</th><th align="left">Ne yapar</th></tr>
  <tr><td align="center" nowrap>1</td><td align="left" nowrap><b>Session-Dedup</b></td><td align="left">Turlar arasında tekrarlanan içerikleri çıkarır (içerik adresli, turlar arası)</td></tr>
  <tr><td align="center" nowrap>2</td><td align="left" nowrap><b>CCR</b></td><td align="left">Büyük blokları geri getirme işaretçilerinin arkasında arşivler, talep üzerine getirir</td></tr>
  <tr><td align="center" nowrap>3</td><td align="left" nowrap><b>Lite</b></td><td align="left">Boşluklar + görsel URL'lerini kırpar (düşük gecikmeli temel hat)</td></tr>
  <tr><td align="center" nowrap>4</td><td align="left" nowrap><b>RTK</b></td><td align="left">Akıllı araç sonucu filtreleme, tekilleştirme ve kırpma (komut duyarlı)</td></tr>
  <tr><td align="center" nowrap>5</td><td align="left" nowrap><b>Responses Tool Output</b></td><td align="left">Kabuk/yama/arama/derleme çıktıları için kayıpsız öncelikli JSON + sınırlı tanısal sıkıştırma (Responses API)</td></tr>
  <tr><td align="center" nowrap>6</td><td align="left" nowrap><b>Headroom</b></td><td align="left">Yerleşik bir <b>GCF</b> codec'i aracılığıyla JSON dizilerinin kayıpsız tablosal sıkıştırılması (~%30)</td></tr>
  <tr><td align="center" nowrap>7</td><td align="left" nowrap><b>Relevance</b></td><td align="left">Son kullanıcı sorgusuna göre çıkarımsal cümle puanlaması</td></tr>
  <tr><td align="center" nowrap>8</td><td align="left" nowrap><b>Caveman</b></td><td align="left">Kural tabanlı düz yazı sıkıştırması (çıktıda ~%65–75)</td></tr>
  <tr><td align="center" nowrap>9</td><td align="left" nowrap><b>Aggressive</b></td><td align="left">Özetleme + eski turların kademeli yaşlandırılması</td></tr>
  <tr><td align="center" nowrap>10</td><td align="left" nowrap><b>LLMLingua-2</b></td><td align="left">MobileBERT ONNX aracılığıyla ML anlamsal budama — kod güvenli, asenkron</td></tr>
  <tr><td align="center" nowrap>11</td><td align="left" nowrap><b>Ultra</b></td><td align="left">İsteğe bağlı küçük model (SLM) katmanıyla sezgisel token budama</td></tr>
  <tr><td align="center" nowrap>12</td><td align="left" nowrap><b>OmniGlyph</b></td><td align="left">Doğrudan Anthropic kablosu üzerindeki ölçülen Claude Fable 5 için deneysel görüntü olarak bağlam kodlama; GPT 5.6 dönüştürücüleri sağlayıcı dekontları beklenirken kapalı kalır. Dört sıkıştırma profili (agresif varsayılan, dengeli, kodlama güvenli, doğrudan geçiş) (en agresif; isteğe bağlı)</td></tr>
</table>

Kod blokları, URL'ler ve yapılandırılmış veriler **her zaman byte düzeyinde kusursuz korunur**. **Tek tıkla hazır önayarlar** motorları birleştirir:

<table>
  <tr><th align="left">Mod</th><th align="left">Tasarruf</th><th align="left">En uygun kullanım</th></tr>
  <tr><td align="left" nowrap>🪶 <b>Lite</b></td><td align="left" nowrap>~%15</td><td align="left">Her zaman açık güvenli varsayılan</td></tr>
  <tr><td align="left" nowrap>🪨 <b>Standard (Caveman)</b></td><td align="left" nowrap>~%30</td><td align="left">Günlük kodlama</td></tr>
  <tr><td align="left" nowrap>⚡ <b>Aggressive</b></td><td align="left" nowrap>~%50</td><td align="left">Uzun araç yoğun oturumlar</td></tr>
  <tr><td align="left" nowrap>🔥 <b>Ultra</b></td><td align="left" nowrap>~%75</td><td align="left">Maksimum tasarruf</td></tr>
  <tr><td align="left" nowrap>🧰 <b>RTK</b></td><td align="left" nowrap>%60–90</td><td align="left">Kabuk/test/derleme/git çıktısı</td></tr>
  <tr><td align="left" nowrap>🔗 <b>Katmanlı (RTK → Caveman)</b></td><td align="left" nowrap><b>%78–95</b></td><td align="left">Karışık istemler + araç günlükleri</td></tr>
</table>

**Gerçek örnek — Standard mod:**

> **Önce (69 token):** _"The reason your React component is re-rendering is likely because you're creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. I would recommend using useMemo to memoize the object."_
>
> **Sonra (19 token):** _"New object ref each render. Inline object prop = new ref = re-render. Wrap in useMemo."_
>
> **Aynı yanıt. %72 daha az token. Sıfır doğruluk kaybı.** ✅

**PT-BR örneği — [Troglodita](https://github.com/leninejunior/troglodita) modu:**

> **Antes (42 tokens):** _"O problema é que o componente está re-renderizando porque uma nova referência de objeto está sendo criada em cada ciclo de renderização. Eu recomendaria usar useMemo."_
>
> **Depois (12 tokens):** _"Re-render: ref nova cada ciclo (objeto inline recriado). Usar `useMemo`."_
>
> **Mesma resposta. ~70% menos tokens. Precisão técnica intacta.** ✅

<br/>

### 🎚️ Motorların ötesinde — çıktı stilleri, uyarlanabilir kadran ve istek başına kontrol

Yukarıdaki 12 motor içeri giren metni küçültür. Üç ek katman ise **nasıl**, **ne zaman** ve **neyin** çıkacağını şekillendirir:

- **🪄 Çıktı Stilleri** _(çıktı ekseninde yönlendirme)_ — deterministik, önbellek güvenli yanıt şekillendirme talimatları enjekte eder; birleştirilebilir, her biri `lite` / `full` / `ultra` yoğunluğundadır. Yeni bir stil eklemek tek satırlık bir kayıt işlemidir:
  - **Terse prose** — dolgu sözcükleri / makaleleri / tereddütlü ifadeleri çıkarır; teknik içeriği eksiksiz korur.
  - **Less code** — "tembel kıdemli geliştirici" YAGNI yaklaşımı: istenmeyen iskele kodları olmadan çalışan en küçük değişiklik.
  - **Terse CJK (文言)** — klasik Çince ultra kısa stil (`zh` diline kilitli).
- **🎯 Uyarlanabilir bağlam bütçesi** _(kadran)_ — tek bir açık/kapalı token eşiği yerine, yalnızca **modelin bağlam penceresine sığması için** gereken en ucuz ve en kayıpsız motorları kademeli olarak devreye sokar. İlke: `reserve-output` (varsayılan, model duyarlı) · `percentage` · `absolute`. Mod: `floor` (uyumu garanti eder) · `replace-autotrigger` (açık seçiminiz kazanır) · `off` (eski eşik).
- **🎛️ Sıkıştırmaya nerede karar verilir** _(öncelik sırası, yüksekten düşüğe)_ — istek başına `x-pusula-compression` başlığı › yönlendirme kombosu geçersiz kılma › aktif adlandırılmış profil › uyarlanabilir / otomatik tetikleyici › panel varsayılanı › kapalı. Uygulanan plan `X-Pusula-Compression: <mode>; source=<source>` yanıt başlığında geri döndürülür.

Token eşiğine göre otomatik tetikleyin, uyarlanabilir kadranı açın, adlandırılmış bir profil sabitleyin, istek başına tek seferlik ayarlayın veya yönlendirme kombosu başına bir işlem hattı atayın — iş yüküne hangisi uyuyorsa. İsteğe bağlı bir çevrimdışı **değerlendirme aracı** (`npm run eval:compression`), bir değişikliği yayımlamadan önce sabit bir külliyat üzerinde doğruluk ile tasarrufu puanlar.

📖 [`COMPRESSION_GUIDE.md`](docs/compression/COMPRESSION_GUIDE.md) · [`RTK_COMPRESSION.md`](docs/compression/RTK_COMPRESSION.md) · [`COMPRESSION_ENGINES.md`](docs/compression/COMPRESSION_ENGINES.md)

<br/>

<div align="center">

# ⚡ Hızlı Başlangıç

</div>

**1) Kurun ve çalıştırın**

```bash
npm install -g pusula
pusula
```

> 💡 `npm warn ERESOLVE` veya eş bağımlılık (peer-dep) uyarıları mı görüyorsunuz? [Zararsızdırlar](docs/guides/TROUBLESHOOTING.md#npm-install-warnings-eresolve--peer--deprecated).

Pano: `http://localhost:20128` · API: `http://localhost:20128/v1`.

**2) ÜCRETSİZ bir sağlayıcı bağlayın (kayıt gerekmez)**

Pano → **Sağlayıcılar (Providers)** → **Kiro AI** (ücretsiz Claude, hesap başına aylık ~50 kredi) veya **OpenCode Free** (kimlik doğrulama yok) bağlayın → tamamlandı.

**3) Kodlama aracınızı yönlendirin**

```txt
Base URL: http://localhost:20128/v1
API Key:  [Pano → Uç Noktalar sayfasından kopyalayın]
Model:    auto            (sıfır yapılandırmalı akıllı yönlendirme — veya herhangi bir sağlayıcı/model)
```

**4) Çalıştığını doğrulayın**

```bash
curl http://localhost:20128/v1/models -H "Authorization: Bearer YOUR_KEY"
```

Bağlı modellerinizi listelenmiş olarak görmelisiniz. 🎉 İşte bu kadar — kodlamaya başlayın, gerisini Pusula otomatik yönlendirsin ve gerektiğinde diğerine geçsin.

İstemciniz özel başlıklar (custom headers) gönderemiyorsa, Pusula belirteçli uyumluluk takma adları da sunar:

```txt
OpenAI catalog:   http://localhost:20128/vscode/YOUR_KEY/
OpenAI models:    http://localhost:20128/vscode/YOUR_KEY/models
OpenAI chat:      http://localhost:20128/vscode/YOUR_KEY/chat/completions
OpenAI responses: http://localhost:20128/vscode/YOUR_KEY/responses
Ollama chat:      http://localhost:20128/vscode/YOUR_KEY/api/chat
Ollama tags:      http://localhost:20128/vscode/YOUR_KEY/api/tags
```

Bunları yalnızca `Authorization: Bearer ...` ekleyemeyen istemciler için kullanın. Başlık kimlik doğrulaması tercih edilen mod olmaya devam eder.

<br/>

## 📦 Daha fazla kurulum yöntemi — Docker, kaynak kod, pnpm, Arch

**🐳 Docker**

```bash
docker run -d --name pusula --restart unless-stopped --stop-timeout 40 \
  -p 127.0.0.1:20128:20128 -v pusula-data:/app/data ferhat-yasinoglu/pusula:latest
```

`:latest` etiketi **yayımlanmış** en yüksek kararlı SemVer sürümünü takip eder. Git `main` dalını takip etmez. GitOps için `:X.Y.Z` sürümünü sabitleyin. Bkz. [Docker Sürüm Kanalları](docs/guides/DOCKER_GUIDE.md#release-channels). İmaj **`PUSULA_MEMORY_MB=1024`** değerini sabitler. Bu, pano ve hafif bir sohbet için yeterlidir. **Kodlama ajanları** (Claude Code, Codex, Grok, vb.'den gelen `POST /v1/responses`), çok daha büyük bir V8 heap alanına ihtiyaç duyar; aksi takdirde iki örtüşen uzun bağlam altında süreç ~12 GiB seviyesinde `FATAL ERROR` verir. Konteyneri heap boyutunun üzerinde boyutlandırın (yerel arabellekler V8'in dışında yer alır):

| İş Yükü                            | Heap (`-e PUSULA_MEMORY_MB`) | Konteyner (`--memory`) |
| ---------------------------------- | ---------------------------- | ---------------------- |
| Pano / hafif sohbet                | `1024` (imaj varsayılanı)    | ≥2 g                   |
| Tek bir kodlama ajanı              | `8192`                       | ≥10 g                  |
| İki eşzamanlı uzun `/v1/responses` | `10240`–`12288`              | ≥12–16 g               |

```bash
docker run -d --name pusula --restart unless-stopped --stop-timeout 40 \
  -e PUSULA_MEMORY_MB=8192 --memory=10g \
  -p 127.0.0.1:20128:20128 -v pusula-data:/app/data ferhat-yasinoglu/pusula:latest
```

Tam tablo: [Docker Kılavuzu — çalışma zamanı RAM](docs/guides/DOCKER_GUIDE.md#runtime-ram-for-coding-agents).

> **Ön sürüm Docker kanalı:** `ferhat-yasinoglu/pusula:next` ve
> `ferhat-yasinoglu/pusula:next-web` geçerli varsayılan `release/v*`
> dalını takip eder. Bu değişken etiketler yalnızca yayımlanmamış düzeltmeleri test etmek içindir ve
> **üretim ortamı için desteklenmez**. Bkz.
> [Docker Sürüm Kanalları](docs/guides/DOCKER_GUIDE.md#release-channels).

**🥟 Bun**

Standart `bun install` ve genel kurulum (`bun install -g pusula`), Bun çalışma zamanı algılamasıyla desteklenir:

- **Yerleşik `bun:sqlite`**: Pusula, Bun altında çalışırken Bun'ın yerleşik `bun:sqlite` sürücüsünü kullanır; Node.js altında `better-sqlite3` veya `sql.js`'e geri döner.
- **Otomatik Webpack paketleyici seçimi**: Geliştirme (`bun run dev`) ve üretim derlemeleri (`bun run build`), Bun'ı otomatik olarak algılar ve yerel V8 bağlama uyumsuzluklarını önlemek için Turbopack yerine Webpack'i seçer.
- **Özel Bun Dockerfile**: Yerel Bun üretim dağıtımları için çok aşamalı `Dockerfile.bun` (`docker build -f Dockerfile.bun -t pusula:bun .`).

```bash
# Bun ile kurun ve çalıştırın
bun install
bun run dev
```

**🛠️ Kaynak koddan**

```bash
cp .env.example .env && npm install
PORT=20128 npm run dev
```

**📦 pnpm**

```bash
pnpm add -g pusula@latest --allow-build=better-sqlite3 --allow-build=@swc/core && pusula
```

**🐧 Arch Linux (AUR)**

```bash
yay -S pusula-bin && systemctl --user enable --now pusula.service
```

**🔧 Nix (Flake)**

```bash
# Nix flakes kullanarak
nix develop
npm run dev

# Veya devbox kullanarak
devbox run npm run dev
```

📖 [Docker Kılavuzu](docs/guides/DOCKER_GUIDE.md) — Compose profilleri, Caddy HTTPS, Cloudflare tünelleri.

**🦭 Podman**

```bash
# 1. Bind-mount veri dizinini hazırlayın
mkdir -p data

# 2. Yalnızca Linux + yerel rootless Podman (asla uzak Podman Machine istemcisi değil):
podman unshare chown 1000:1000 ./data

# 3. Çalışma zamanı ipucunu ayarlayın, yerel Compose imajını derleyin ve başlatın
echo "CONTAINER_HOST=podman" >> .env
podman compose --profile base up -d --build
```

macOS veya Windows üzerinde Podman uzak bir Podman Machine kullanır: `podman unshare` adımını atlayın ve
[topolojiye özel veri dizini rehberini](contrib/podman/README.md#data-directory-permissions-by-topology) izleyin.

📖 [Podman Kılavuzu](contrib/podman/README.md) — Compose derlemeleri, Podman Machine ve
Linux/systemd Quadlet kurulumu.

**⚡ Daha hızlı / daha hafif kurulum (yerel derlemeyi atlayın)**

Yerel SQLite motoru (`better-sqlite3`) **isteğe bağlı** bir bağımlılıktır; bu nedenle genel bir
kurulum asla kaynak koddan derlemeyi beklemez: platformunuza/Node sürümünüze uygun önceden derlenmiş bir ikili dosya olduğunda onu kullanır, aksi takdirde şeffaf bir şekilde saf JS motoruna
(Node 22+ üzerinde `node:sqlite`, aksi halde paketlenmiş `sql.js` WASM) geri döner — derleme araçları gerekmez.

Kurulum sonrası yerel ısınmayı tamamen atlamak için (CI, headless veya yavaş makineler):

```bash
PUSULA_SKIP_POSTINSTALL=1 npm install -g pusula   # CI=1 de bunu atlar
```

En hızlı kurulumlar için **pnpm** tercih edin (içerik adresli depolama + hard linkler — yukarıya bakın).
Panosuz, headless bir çalışma zamanı için Docker `base` profilini (yukarıda) veya
[Termux kılavuzunu](docs/guides/TERMUX_GUIDE.md) kullanın. CLI ve web panosu aynı port üzerinde
aynı süreç tarafından sunulur, bu nedenle bugün için ayrı bir yalnızca CLI paketi bulunmamaktadır.

<br/>

<div align="center">

# 📧 Topluluk ve Yardım

> Sorularınız, hata bildirimleriniz ve önerileriniz için her şey GitHub üzerinde — bir issue açın veya bir tartışma başlatın.

| Kanal                                      | Nerede / Nasıl                                                                                                              |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| 🐛 **Hata bildirimi ve özellik istekleri** | [GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues) — `npm run system-info` çıktısını ekleyin                |
| 💬 **Sorular, ipuçları ve tartışmalar**    | [GitHub Discussions](https://github.com/Ferhat-Yasinoglu/pusula/discussions)                                                |
| 📦 **Kaynak Kod**                          | [github.com/Ferhat-Yasinoglu/pusula](https://github.com/Ferhat-Yasinoglu/pusula)                                            |
| 🤝 **Katkıda Bulunun**                     | [CONTRIBUTING.md](CONTRIBUTING.md) · [Dallanma ve Sürüm Modeli](docs/ops/BRANCHING_MODEL.md) · bir `good first issue` seçin |

</div>

---

<br/>
<div align="center">

## 🛠️ Teknoloji Yığını

</div>

<table>
  <tr><th align="left">Katman</th><th align="left">Teknoloji</th></tr>
  <tr><td nowrap><b>Çalışma Zamanı</b></td><td>Node.js 22.x / 24.x LTS — <code>&gt;=22.22.2 &lt;23 || &gt;=24.0.0 &lt;27</code></td></tr>
  <tr><td nowrap><b>Dil</b></td><td>TypeScript 6.0 — <code>src/</code> ve <code>open-sse/</code> genelinde <b>%100 TypeScript</b> (v2.0'dan beri çekirdekte sıfır <code>any</code>)</td></tr>
  <tr><td nowrap><b>Çerçeve</b></td><td>Next.js 16 + React 19 + Tailwind CSS 4</td></tr>
  <tr><td nowrap><b>Veritabanı</b></td><td>better-sqlite3 (SQLite, WAL journaling) + LowDB (JSON legacy) — 122 alan modülü, 209 migrasyon</td></tr>
  <tr><td nowrap><b>Bellek</b></td><td>SQLite FTS5 tam metin + int8-nicelenmiş vektör gömüleri, tipik bozunma</td></tr>
  <tr><td nowrap><b>Şemalar</b></td><td>Zod 4 — MCP araç G/Ç doğrulama + API sözleşmeleri</td></tr>
  <tr><td nowrap><b>Protokoller</b></td><td>MCP (stdio / HTTP / SSE) + A2A v0.3 (JSON-RPC 2.0 + SSE)</td></tr>
  <tr><td nowrap><b>Akış</b></td><td>Server-Sent Events (SSE) + WebSocket köprüsü (<code>/v1/ws</code>)</td></tr>
  <tr><td nowrap><b>Sıkıştırma</b></td><td>12 motorlu boru hattı — RTK, Caveman, LLMLingua-2 (MobileBERT ONNX), GCF, OmniGlyph</td></tr>
  <tr><td nowrap><b>Kimlik Doğrulama &amp; Güvenlik</b></td><td>OAuth 2.0 (PKCE) + JWT + API Anahtarları + MCP kapsamlı kimlik doğrulama · Beklemede AES-256-GCM · DOMPurify</td></tr>
  <tr><td nowrap><b>Gizlilik</b></td><td>wreq-js — JA3 / JA4 TLS parmak izi taklidi, 3 seviyeli proxy</td></tr>
  <tr><td nowrap><b>Esneklik</b></td><td>Devre kesici, üstel geri çekilme, anti-thundering-herd, otomatik-kombo kendi kendini onarma</td></tr>
  <tr><td nowrap><b>Günlükleme</b></td><td>pino — istek bağlamıyla yapılandırılmış JSON günlükleri</td></tr>
  <tr><td nowrap><b>Test</b></td><td>Node.js test çalıştırıcısı + Vitest — 5.100'den fazla izlenen test dosyasında (birim, entegrasyon, E2E, güvenlik, ekosistem) <b>39.000'den fazla statik test bildirimi</b></td></tr>
  <tr><td nowrap><b>Platformlar</b></td><td>Masaüstü (Electron) · Android (Termux) · PWA (herhangi bir tarayıcı)</td></tr>
  <tr><td nowrap><b>CI/CD</b></td><td>GitHub Actions — sürümde otomatik npm yayınlama + GHCR</td></tr>
  <tr><td nowrap><b>Bağlantılar</b></td><td><a href="https://github.com/Ferhat-Yasinoglu/pusula">GitHub</a> · <a href="https://www.npmjs.com/package/pusula">npm</a> · <a href="https://github.com/Ferhat-Yasinoglu/pusula/pkgs/container/pusula">GHCR</a></td></tr>
</table>

<div align="center">

<br/>

## 📖 Dokümantasyon

</div>

### 📘 Başlarken

<table>
  <tr><th align="left">Belge</th><th align="left">Açıklama</th></tr>
  <tr><td nowrap><b><a href="docs/guides/USER_GUIDE.md">Kullanıcı Kılavuzu</a></b></td><td>Sağlayıcılar, kombinasyonlar, CLI entegrasyonu, dağıtım</td></tr>
  <tr><td nowrap><b><a href="docs/guides/SETUP_GUIDE.md">Kurulum Kılavuzu</a></b></td><td>Tüm kurulum yöntemleri, CLI aracı yapılandırmaları, protokol kurulumu, zaman aşımı ayarları</td></tr>
  <tr><td nowrap><b><a href="docs/reference/CLI-TOOLS.md">CLI Araçları Kılavuzu</a></b></td><td>Claude Code, Codex, Cursor, Cline, OpenClaw, Kilo ve Copilot için araca özel kurulum</td></tr>
  <tr><td nowrap><b><a href="docs/guides/REMOTE-MODE.md">Uzak Mod</a></b></td><td>Kapsamlı erişim belirteçleri aracılığıyla dizüstü bilgisayarınızın CLI'ından uzaktaki bir Pusula'u (VPS) yönetin</td></tr>
  <tr><td nowrap><b><a href="docs/guides/CLAUDE-CODE-CONFIGURATION.md">Claude Code Yapılandırması</a></b></td><td><code>launch</code> ve model başına profillerle Claude Code'u Pusula'a (yerel/uzak) yönlendirin</td></tr>
  <tr><td nowrap><b><a href="README.md#-quick-start">Hızlı Başlangıç</a></b></td><td>3 adımda kurulum → bağlantı → yapılandırma</td></tr>
</table>

### 🔧 Operasyonlar ve Dağıtım

<table>
  <tr><th align="left">Belge</th><th align="left">Açıklama</th></tr>
  <tr><td nowrap><b><a href="docs/guides/DOCKER_GUIDE.md">Docker Kılavuzu</a></b></td><td>Docker çalıştırma, Compose profilleri, Caddy HTTPS, tüneller, imaj etiketleri</td></tr>
  <tr><td nowrap><b><a href="contrib/podman/README.md">Podman Kılavuzu</a></b></td><td>Quadlet systemd entegrasyonu, podman-compose, SELinux</td></tr>
  <tr><td nowrap><b><a href="docs/ops/VM_DEPLOYMENT_GUIDE.md">VM Dağıtımı</a></b></td><td>Eksiksiz kılavuz: VM + nginx + Cloudflare kurulumu</td></tr>
  <tr><td nowrap><b><a href="docs/ops/FLY_IO_DEPLOYMENT_GUIDE.md">Fly.io Dağıtımı</a></b></td><td>Kalıcı depolama ile Fly.io'ya dağıtım</td></tr>
  <tr><td nowrap><b><a href="docs/guides/TERMUX_GUIDE.md">Termux Kılavuzu</a></b></td><td>Pusula'u Termux aracılığıyla Android'de çalıştırın</td></tr>
  <tr><td nowrap><b><a href="docs/guides/PWA_GUIDE.md">PWA Kılavuzu</a></b></td><td>Progresif Web Uygulaması kurulumu, önbelleğe alma, mimari</td></tr>
  <tr><td nowrap><b><a href="docs/guides/UNINSTALL.md">Kaldırma Kılavuzu</a></b></td><td>Tüm kurulum yöntemleri için temiz kaldırma</td></tr>
  <tr><td nowrap><b><a href="docs/reference/ENVIRONMENT.md">Ortam Yapılandırması</a></b></td><td>Tüm <code>.env</code> değişkenleri ve referansları</td></tr>
</table>

### 🧠 Özellikler ve Mimari

<table>
  <tr><th align="left">Belge</th><th align="left">Açıklama</th></tr>
  <tr><td nowrap><b><a href="docs/architecture/ARCHITECTURE.md">Mimari</a></b></td><td>Sistem mimarisi, veri akışı ve iç işleyiş</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_GUIDE.md">Sıkıştırma Kılavuzu</a></b></td><td>7 seçenekli işlem hattı: kapalı / hafif / standart / agresif / ultra / RTK / yığınlı</td></tr>
  <tr><td nowrap><b><a href="docs/compression/RTK_COMPRESSION.md">RTK Sıkıştırması</a></b></td><td>Komut çıktısı sıkıştırması, filtreler, güven, doğrulama, ham çıktı kurtarma</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_ENGINES.md">Sıkıştırma Motorları</a></b></td><td>Caveman, RTK, yığınlı işlem hatları, pano/API/MCP arayüzleri</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_RULES_FORMAT.md">Sıkıştırma Kuralları Biçimi</a></b></td><td>Caveman ve RTK filtreleri için JSON kural paketi şemaları</td></tr>
  <tr><td nowrap><b><a href="docs/compression/COMPRESSION_LANGUAGE_PACKS.md">Sıkıştırma Dil Paketleri</a></b></td><td>Dil algılama ve Caveman kural paketi yazımı</td></tr>
  <tr><td nowrap><b><a href="docs/architecture/RESILIENCE_GUIDE.md">Dayanıklılık Kılavuzu</a></b></td><td>Devre kesiciler, bekleme süreleri, kuyruk, yoğun istek yığını önleme, TLS sahteciliği</td></tr>
  <tr><td nowrap><b><a href="docs/routing/AUTO-COMBO.md">Otomatik Kombinasyon Motoru</a></b></td><td>16 faktörlü puanlama, mod paketleri, kendi kendini iyileştirme</td></tr>
  <tr><td nowrap><b><a href="docs/ops/PROXY_GUIDE.md">Proxy Kılavuzu</a></b></td><td>3 seviyeli proxy sistemi, 1proxy pazaryeri, kayıt defteri CRUD işlemleri</td></tr>
  <tr><td nowrap><b><a href="docs/reference/FREE_TIERS.md">Ücretsiz Katmanlar</a></b></td><td>Birleştirilmiş dizin: belgelenmiş 35 yinelenen havuz / kataloglanmış 489 ücretsiz katman girdisi</td></tr>
  <tr><td nowrap><b><a href="docs/guides/FEATURES.md">Özellik Galerisi</a></b></td><td>Ekran görüntüleriyle görsel pano turu</td></tr>
  <tr><td nowrap><b><a href="docs/architecture/CODEBASE_DOCUMENTATION.md">Kod Tabanı Dokümantasyonu</a></b></td><td>Yeni başlayanlara uygun kod tabanı tanıtımı</td></tr>
</table>

### 🤖 Protokoller ve API'ler

<table>
  <tr><th align="left">Belge</th><th align="left">Açıklama</th></tr>
  <tr><td nowrap><b><a href="docs/reference/API_REFERENCE.md">API Referansı</a></b></td><td>Örneklerle birlikte tüm uç noktalar</td></tr>
  <tr><td nowrap><b><a href="docs/openapi.yaml">OpenAPI Belirtimi</a></b></td><td>OpenAPI 3.0 belirtimi</td></tr>
  <tr><td nowrap><b><a href="open-sse/mcp-server/README.md">MCP Sunucusu</a></b></td><td>110 MCP aracı, IDE yapılandırmaları, Python/TS/Go istemcileri</td></tr>
  <tr><td nowrap><b><a href="docs/frameworks/MCP-SERVER.md">MCP Sunucusu Kılavuzu</a></b></td><td>MCP kurulumu, aktarımlar ve araç referansı</td></tr>
  <tr><td nowrap><b><a href="src/lib/a2a/README.md">A2A Sunucusu</a></b></td><td>JSON-RPC 2.0 protokolü, beceriler, akış, görev yönetimi</td></tr>
  <tr><td nowrap><b><a href="docs/frameworks/A2A-SERVER.md">A2A Sunucusu Kılavuzu</a></b></td><td>A2A aracı kartı, görevler, beceriler ve akış</td></tr>
</table>

### 📋 Proje ve Kalite

<table>
  <tr><th align="left">Belge</th><th align="left">Açıklama</th></tr>
  <tr><td nowrap><b><a href="CONTRIBUTING.md">Katkıda Bulunma</a></b></td><td>Geliştirme kurulumu ve yönergeleri</td></tr>
  <tr><td nowrap><b><a href="docs/ops/BRANCHING_MODEL.md">Dallanma ve Sürüm Modeli</a></b></td><td>PR'lerin hedeflediği yer (<code>release/*</code>) ile <code>main</code> ve etiketlerin anlamı</td></tr>
  <tr><td nowrap><b><a href="CHANGELOG.md">Değişiklik Günlüğü</a></b></td><td>Sürüm bazında eksiksiz yayın geçmişi</td></tr>
  <tr><td nowrap><b><a href="SECURITY.md">Güvenlik Politikası</a></b></td><td>Güvenlik açıklarını bildirme ve güvenlik uygulamaları</td></tr>
  <tr><td nowrap><b><a href="docs/guides/I18N.md">i18n Kılavuzu</a></b></td><td>42 dil desteği, çeviri iş akışı, RTL</td></tr>
  <tr><td nowrap><b><a href="docs/ops/RELEASE_CHECKLIST.md">Sürüm Kontrol Listesi</a></b></td><td>Sürüm öncesi doğrulama adımları</td></tr>
  <tr><td nowrap><b><a href="docs/ops/COVERAGE_PLAN.md">Kapsama Planı</a></b></td><td>5.100'den fazla izlenen test dosyasındaki 39.000'den fazla statik test bildirimi için test kapsamı stratejisi</td></tr>
</table>

<br/>

<div align="center">

## 👥 Katkıda bulunma

</div>

### Nasıl Katkıda Bulunulur

1. Depoyu forklayın
2. **Aktif** `release/vX.Y.Z` dalından (`main` değil) bir dal oluşturun — bkz. [Dallanma ve Sürüm Modeli](docs/ops/BRANCHING_MODEL.md)
3. Özellik dalınızı oluşturun (`git checkout -b feat/harika-ozellik`)
4. Değişikliklerinizi commit edin (`git commit -m 'feat: harika ozellik ekle'`)
5. Dalınıza push edin (`git push origin feat/harika-ozellik`)
6. **Hedef dal = ilgili `release/vX.Y.Z` dalı** olacak şekilde bir Pull Request açın

Ayrıntılı yönergeler için [CONTRIBUTING.md](CONTRIBUTING.md) dosyasına bakın.

### Yeni Bir Sürüm Yayımlama

```bash
# Bir sürüm oluşturun — npm yayını otomatik olarak gerçekleşir
gh release create v3.8.2 --title "v3.8.2" --generate-notes
```

<br/>

<div align="center">

## 🙏 Teşekkürler

</div>

Pusula devlerin omuzlarında yükselmektedir. **[9router](https://github.com/decolua/9router)** projesinin bir çatalı ve Go projesi **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)**'nin bir TypeScript uyarlaması olarak başladı — ve oradan itibaren aşağıdaki her alt sistem, oraya ilk ulaşan bir açık kaynak projesinden ilham aldı. Her biri Pusula'un somut bir parçasını şekillendirdi. Hepsine teşekkür ederiz. 🙏

> ⭐ Temmuz 2026 itibarıyla yıldız sayıları — bu projelere de bir yıldız verin.

### 🧬 Köken ve ağ geçidi

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/decolua/9router">9router</a></b></td><td align="center">22.7k</td><td>Bu çatalın üzerine inşa edildiği orijinal proje — çok modlu API'ler ve tam bir TypeScript yeniden yazımı ile burada genişletildi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/router-for-me/CLIProxyAPI">CLIProxyAPI</a></b></td><td align="center">43.6k</td><td>Bu JavaScript / TypeScript uyarlamasına ilham veren Go uygulaması.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/BerriAI/litellm">LiteLLM</a></b></td><td align="center">54.0k</td><td>Kamuya açık fiyatlandırma veri seti maliyet takibi senkronizasyonumuzu besleyen ve sağlayıcı normalizasyon modeli yönlendirmemize rehberlik eden yapay zeka ağ geçidi.</td></tr>
</table>

### 🗜️ Bağlam ve token sıkıştırması — motorlar

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/JuliusBrussee/caveman">Caveman</a></b></td><td align="center">90.8k</td><td>Viral olan "az token işi görüyorsa neden çok token kullanasınız" projesi — mağara adamı dili felsefesi standart sıkıştırma modumuza ve 30'dan fazla dolgu/yoğunlaştırma kuralımıza güç verir.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/rtk-ai/rtk">RTK – Rust Token Killer</a></b></td><td align="center">71.8k</td><td>Yüksek performanslı komut çıktısı sıkıştırması — RTK motorumuza, JSON filtre DSL'imize, ham çıktı kurtarmaya ve katmanlı RTK → Caveman işlem hattına ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/headroomlabs-ai/headroom">headroom</a></b></td><td align="center">60.1k</td><td>Geri döndürülebilir bağlam sıkıştırması (SmartCrusher) — <code>headroom</code> motorumuza ve <code>ccr</code> geri getirme işaretçisi modeline ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/microsoft/LLMLingua">LLMLingua</a></b></td><td align="center">6.5k</td><td>İstem sıkıştırma araştırması (LLMLingua / LLMLingua-2) — asenkron, kod güvenli, başarısızlık durumunda açık (fail-open) <code>llmlingua</code> motorumuza ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/atjsh/llmlingua-2-js">llmlingua-2-js</a></b></td><td align="center">30</td><td>LLMLingua motorumuz için çalışan iş parçacığı (worker-thread) arka ucu olarak kullanılan JS/ONNX portu (MobileBERT / XLM-RoBERTa).</td></tr>
  <tr><td nowrap><b><a href="https://github.com/leninejunior/troglodita">Troglodita</a></b></td><td align="center">26</td><td>PT-BR token sıkıştırması — pt-BR dil paketimize güç verir: Brezilya Portekizcesi gramerine göre ayarlanmış anlatım bozukluğu azaltma ve dolgu sözcük temizleme.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/DietrichGebert/ponytail">ponytail</a></b></td><td align="center">86.0k</td><td>Viral olan "tembel kıdemli geliştirici" YAGNI kodlama yeteneği — <b>less-code</b> Çıktı Stilimize ilham verdi: _üretilen_ kodu azaltan çalışan en küçük değişiklik yönlendirmesi (Caveman'in kısa düz yazısının çıktı eksenindeki eşleniği).</td></tr>
</table>

### 🧩 Kompakt formatlar, token araştırmaları ve kod duyarlı araçlar

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/toon-format/toon">TOON</a></b></td><td align="center">24.9k</td><td>Token-Oriented Object Notation — sütunlu, başlık artı satırlar modeli tablosal sıkıştırma aşamamızı şekillendirdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/blackwell-systems/gcf">GCF – Graph Compact Format</a></b></td><td align="center">22</td><td>İlk olarak tablosal sıkıştırma aşamamıza ilham verdi; artık sıfır bağımlılıklı, kayıpsız genel profil kodlayıcısı doğrudan Headroom codec'i olarak <b>yerleşik olarak (vendored)</b> sunulmaktadır (MIT, SPDX işaretli), daha sonraki sayısal alan ve sayı uyumsuzluğu doğruluk düzeltmeleriyle birlikte.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ooples/token-optimizer-mcp">token-optimizer-mcp</a></b></td><td align="center">444</td><td>Brotli/SQLite önbelleği + oturum başına bağlam deltası — <code>session-dedup</code> motorumuza ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/Mibayy/token-savior">token-savior</a></b></td><td align="center">1.1k</td><td>Bash çıktısı sıkıştırması + MCP profilleri — sıkıştırmadan vazgeçme disiplinimize ve MCP araç bildirimi küçültmesine ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/ppgranger/token-saver">token-saver</a></b></td><td align="center">117</td><td>Hata duyarlı vazgeçme özelliğine sahip içerik duyarlı, dosya türü başına çıktı sıkıştırması — tür başına dağıtımımızı ve minimum kazanç atlamamızı doğruladı.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/alexgreensh/token-optimizer">token-optimizer</a></b></td><td align="center">1.7k</td><td>"Hayalet tokenları bulun" — boşaltma + kurtarılabilir tanıtıcı modeli CCR boşaltma düşüncemizi besledi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/Shweta-Mishra-ai/tokenmizer">TokenMizer</a></b></td><td align="center">16</td><td>Oturum grafiği + turlar arası satır tekilleştirme taslağı session-dedup tasarımımızı besledi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/jessefreitas/OmniCompress">OmniCompress</a></b></td><td align="center">3</td><td>Rust sütunlu JSON + içerik adresli geri getirme + mesajlar arası tekilleştirme — <code>headroom</code>/<code>ccr</code>/<code>session-dedup</code> motor tasarımımızı ve önbellek kararlı "sıkıştırılmış form konumdan bağımsızdır" kuralımızı doğruladı.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/atlassian-labs/mcp-compressor">mcp-compressor</a></b></td><td align="center">98</td><td>MCP araç şeması/açıklama sıkıştırması — MCP araç bildirimi kardinalite azaltmamızı besledi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/pdavis68/RepoMapper">RepoMapper</a></b></td><td align="center">187</td><td>Aider tarzı depo haritası sıralaması — depo haritası / getirme sıralaması keşfimizi besledi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/mrsimpson/quiet-shell-mcp">quiet-shell-mcp</a></b></td><td align="center">4</td><td>MCP üzerinden bildirimsel kabuk çıktısı azaltma — bildirimsel bash çıktısı sıkıştırmamızı doğruladı.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/dsherret/ts-morph">ts-morph</a></b></td><td align="center">6.1k</td><td>TypeScript Compiler API araç seti — dize, şablon ve regex sabit değerlerini koruyan ayrıştırıcı tabanlı yorum satırı temizlememize ilham verdi.</td></tr>
</table>

### 🧠 Bellek ve RAG

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/mem0ai/mem0">Mem0</a></b></td><td align="center">61.2k</td><td>Evrensel bellek katmanı — yazma/okuma sınırı olarak proxy modeli bellek mimarimizi şekillendirdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/letta-ai/letta">Letta (MemGPT)</a></b></td><td align="center">23.9k</td><td>Kademeli belleğe sahip durum bilgisi tutan ajanlar — Bağlam Kontrolü ve Kurtarma (CCR) kademeli modelimize ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/onestardao/WFGY">WFGY</a></b></td><td align="center">1.8k</td><td>16 tekrarlayan RAG/LLM hata modunun ProblemMap sınıflandırması — sorun giderme kılavuzumuzdaki paylaşılan terminoloji.</td></tr>
</table>

### 🛰️ Trafik denetimi, MITM ve şeffaf proxy

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/chouzz/llm-interceptor">llm-interceptor</a></b></td><td align="center">49</td><td>Kodlama asistanı ↔ LLM trafiğinin MITM yakalaması/analizi — Trafik Denetçimiz bunun SSE birleştirmesini, konuşma normalizasyonunu, ana bilgisayar doğrudan geçişini ve sır maskelemesini uyarladı (MIT).</td></tr>
  <tr><td nowrap><b><a href="https://github.com/InterceptSuite/ProxyBridge">ProxyBridge</a></b></td><td align="center">5.5k</td><td>Süreç bazında şeffaf proxy yönlendirmesi — çökmeye dayanıklı MITM kapatma, soket boşta kalma zaman aşımları, <code>/proc</code> süreç atıfı ve TPROXY yakalamamıza ilham verdi.</td></tr>
</table>

### 📚 Model verileri, gözlemlenebilirlik ve arayüz

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/anomalyco/models.dev">models.dev</a></b></td><td align="center">6.0k</td><td>Yapay zeka modeli özellikleri, fiyatlandırması ve yeteneklerinin açık veritabanı — model kataloğumuzla yerel olarak senkronize edilir.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/xyflow/xyflow">React Flow / xyflow</a></b></td><td align="center">37.7k</td><td>Gerçek zamanlı Sıkıştırma Stüdyomuzu ve Kombo/Yönlendirme Stüdyomuzu destekleyen düğüm tabanlı grafik kütüphanesi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/langchain-ai/langgraph">LangGraph</a></b></td><td align="center">37.6k</td><td>LangGraph Studio'nun canlı iş akışı grafiği görselleştirmesi, Stüdyolarımızın gerçek zamanlı basamaklı görünümüne ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/langfuse/langfuse">Langfuse</a></b></td><td align="center">31.4k</td><td>İzleme → aralık → üretim gözlemlenebilirlik modeli Sıkıştırma Stüdyosu şelale görünümümüzü şekillendirdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/kiali/kiali">Kiali</a></b></td><td align="center">3.6k</td><td>Istio servis ağı (service-mesh) gözlemlenebilirliği — Yönlendirme/Kombo Stüdyosundaki devre kesici rozetlerimize ve hata kenarı görsellerimize ilham verdi.</td></tr>
  <tr><td nowrap><b><a href="https://github.com/lobehub/lobe-icons">lobe-icons</a></b></td><td align="center">2.2k</td><td>Panomuz genelinde sağlayıcı simgelerini oluşturan yapay zeka/LLM marka logoları.</td></tr>
</table>

### 🛡️ Güvenlik

<table>
  <tr><th align="left">Proje</th><th align="center">⭐</th><th align="left">Pusula'a nasıl ilham verdi</th></tr>
  <tr><td nowrap><b><a href="https://github.com/tldrsec/awesome-secure-defaults">awesome-secure-defaults</a></b></td><td align="center">710</td><td>Güvenlik tercihlerimize rehberlik eden, varsayılan olarak güvenli kütüphanelerin derlenmiş listesi (Helmet.js, DOMPurify, ssrf-req-filter, safe-regex, Google Tink).</td></tr>
</table>

## 📄 Lisans

MIT Lisansı - ayrıntılar için [LICENSE](LICENSE) dosyasına bakın.

---

<div align="center">

**[⬆ Başa dön](#-pusula--ücretsiz-yapay-zeka-ağ-geçidi)** · Açık kaynaklı yapay zeka topluluğu için ❤️ ile geliştirildi.

<sub>Pusula v3.8.49 · Node ≥22.22.2 · MIT Lisansı · <a href="https://github.com/Ferhat-Yasinoglu/pusula">github.com/Ferhat-Yasinoglu/pusula</a></sub>

</div>
<!-- GitHub Discussions enabled for community Q&A -->
