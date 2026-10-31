# Quick Start: Get Pusula Running in 3 Minutes (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../getting-started/QUICK-START.md) · 🇩🇪 [de](../../../de/docs/getting-started/QUICK-START.md) · 🇮🇷 [fa](../../../fa/docs/getting-started/QUICK-START.md)

---

> **Kısaca**: Kurun → Uygun bir sağlayıcı bağlayın → IDE'nizi Pusula'a yönlendirin. İşte bu kadar.

---

## 1. Adım: Pusula'u Kurun

Tercih ettiğiniz yöntemi seçin:

### Seçenek A: npm (Önerilen)

```bash
npm install -g pusula
```

### Seçenek B: Docker

```bash
docker run -d --name pusula -p 20128:20128 ferhat-yasinoglu/pusula:latest
```

`:latest`, **yayımlanmış** en yüksek kararlı SemVer sürümüdür. git `main` dalını takip **etmez**. GitOps için `ferhat-yasinoglu/pusula:X.Y.Z` sürümünü sabitleyin. Bkz. [İmaj Etiketleri / Sürüm Kanalları](../guides/DOCKER_GUIDE.md#release-channels).

### Seçenek C: Kaynak Koddan

```bash
git clone https://github.com/Ferhat-Yasinoglu/pusula.git
cd Pusula
npm install
npm run dev
```

---

## 2. Adım: Pusula'u Başlatın

```bash
pusula
```

Pusula, `http://localhost:20128` adresinde başlatılır. Kontrol paneli otomatik olarak açılır.

---

## Adım 3: Uygun Bir Sağlayıcı Bağlayın

Koşulları ve kotası ihtiyaçlarınıza uygun bir sağlayıcı seçin. **Dashboard → Providers** bölümünde kendi hesabınızı veya API anahtarınızı bağlayın, ardından bağlantıyı test edin. Ücretsiz erişim ve anahtarsız kullanılabilirlik garanti edilmez.

`auto`, varsayılan olarak Kiro dahil `tos: avoid` şeklinde işaretlenmiş sağlayıcıları hariç tutar. Bir hesap bağlamak bu politikayı değiştirmez. **Dashboard → Combos** bölümündeki katılım tercihi tüm otomatik kombinasyonlar için geçerlidir. Bir sağlayıcı seçmeden önce [Ücretsiz Katmanlar Kılavuzu](./FREE-TIERS-GUIDE.md) belgesini inceleyin.

---

## 4. Adım: Çalıştığını Doğrulayın

[API Keys](http://localhost:20128/dashboard/api-manager) bölümünden yeni bir anahtar oluşturun. Bu anahtar tekrar görüntülenmeyeceği için güvenli bir yerde saklayın. Bu anahtarın üst sağlayıcılara erişmek için değil, araçların Pusula'a erişmesi için kullanıldığını unutmayın.

```bash
curl http://localhost:20128/v1/models -H "Authorization: Bearer YOUR_KEY"
```

Bağlı modellerinizin listelendiğini görmelisiniz.

---

## 5. Adım: IDE'nizi veya CLI Aracınızı Pusula'a Yönlendirin

IDE'nizde veya CLI aracınızda şunları ayarlayın:

```
Temel URL:  http://localhost:20128/v1
API Anahtarı:  [Kontrol Paneli → Endpoints bölümünden kopyalayın]
Model:      auto
```

Hepsi bu! IDE'niz artık otomatik sağlayıcı seçimiyle Pusula'u kullanıyor.

### IDE Örneği: VSCode/Continue.dev

1. VSCode'a [Continue.dev](https://marketplace.visualstudio.com/items?itemName=Continue.continue) uzantısını yükleyin.
2. Aşağıdaki satırları eklemek için `~/.continue/config.yaml` dosyanızı güncelleyin:

```
  - name: Pusula - Auto
    provider: openai
    model: auto
    apiBase: http://localhost:20128/v1
    apiKey: <YOUR_KEY>
```

3. Continue.dev sohbet panelinde `Pusula - Auto` seçeneğini belirlediğinizde istekleriniz Pusula'a gönderilir.
4. (İsteğe bağlı) Okuyucu için alıştırma: IDE'nizin `config.yaml` dosyasını diğer tüm önceden oluşturulmuş yapılandırmalarla güncellemesini sağlayın 😊

### CLI Örneği: Codex CLI

1. İşletim sisteminizde ortam değişkenini kalıcı olarak ayarlayın.
   macOS/Linux için (`~/.bashrc` veya `~/.zshrc` dosyanıza ekleyin):

```bash
export PUSULA_API_KEY="<YOUR_KEY>"
```

Windows için (Komut İstemi):

```
setx PUSULA_API_KEY <YOUR_KEY>
```

2. Şimdi Codex'i Pusula için yapılandırılmış şekilde başlatalım. Şunu çalıştırın:

```
pusula launch-codex --model auto
```

Uç noktayı ve API anahtarını belirtmek için bunu `codex` ve komut satırı parametreleri aracılığıyla manuel olarak yapabilirsiniz; ancak yukarıdaki komutla Pusula sizin için her şeyi halleder.

Aynı tek komutla başlatma yöntemi, genel başlatıcı üzerinden diğer CLI'lar için de çalışır: `pusula run <target>`; `claude`, `codex`, `aider`, `goose`, `opencode`, `qwen` ve `gemini` seçeneklerini destekler (bkz. [CLI Entegrasyonları](../guides/CLI-INTEGRATIONS.md)).

3. CLI artık istekleri Pusula'a gönderiyor olmalıdır.

### Aracınızın Pusula'a yönlendirme yaptığını doğrulayın

Sol kenar çubuğundaki [Monitoring/Logs](http://localhost:20128/dashboard/logs) seçeneğine tıklayarak isteğin ayrıntılarını görebilirsiniz. İsteğe tıklayarak daha fazla ayrıntı görüntüleyebilirsiniz. Ayrıca, kullandığınız istemci aracından hangi bilgilerin gönderildiğini de görebilirsiniz. Bu, öğrenme ve hata ayıklama açısından faydalıdır.

---

## Sırada Ne Var?

- **[Otomatik Kombinasyon Kılavuzu](./AUTO-COMBO-GUIDE.md)** — Pusula'un sizin için en iyi yapay zekâyı seçmesine izin verin
- **[Sağlayıcılar Kılavuzu](./PROVIDERS-GUIDE.md)** — Daha fazla sağlayıcı bağlayın (ücretsiz ve ücretli)
- **[Ücretsiz Katmanlar Kılavuzu](./FREE-TIERS-GUIDE.md)** — Sağlayıcı koşullarını ve ücretsiz katman sınırlarını inceleyin
- **[Sorun Giderme](../guides/TROUBLESHOOTING.md)** — Yaygın sorunları düzeltin

---

## Sık Sorulan Sorular

### "Bir API anahtarına ihtiyacım var mı?"

Pusula API anahtarı, araçlarınızın kimliğini doğrular. Üst sağlayıcı kimlik bilgileri sağlayıcıya göre değişir: bazıları API anahtarı veya hesapla oturum açma gerektirir. Ücretsiz erişim garanti edilmez.

### "`auto` nedir?"

`auto`, Pusula'a her istek için en iyi sağlayıcıyı otomatik olarak seçmesini söyler. Hız, maliyet, kalite ve kullanılabilirliği dikkate alır. Ayrıntılar için [Otomatik Kombinasyon Kılavuzu](./AUTO-COMBO-GUIDE.md) belgesine bakın.

### "Maliyeti ne kadar?"

Pusula'un kendisi **ücretsiz ve açık kaynaklıdır**. Yalnızca kullandığınız sağlayıcılar için ödeme yaparsınız. Birçok sağlayıcının ücretsiz kullanım katmanları vardır — [Ücretsiz Kullanım Katmanları Kılavuzu](./FREE-TIERS-GUIDE.md) belgesine bakın.

### "Claude Code / Cursor / Copilot ile kullanabilir miyim?"

**Evet!** Pusula, OpenAI biçimini destekleyen tüm araçlarla çalışır. Temel URL'yi `http://localhost:20128/v1` olarak ayarlamanız yeterlidir. Kuruluma özel talimatlar için [CLI Araçları Kılavuzu](../reference/CLI-TOOLS.md) belgesine bakın.

### "Bir sağlayıcı devre dışı kalırsa ne olur?"

Pusula, başarısız olan sağlayıcıları otomatik olarak atlar ve bir sonrakini dener. Herhangi bir şey yapmanız gerekmez. Ayrıntılar için [Otomatik Kombinasyon Kılavuzu](./AUTO-COMBO-GUIDE.md) belgesine bakın.

---

## Yardıma mı İhtiyacınız Var?

- **[Sorun Giderme](../guides/TROUBLESHOOTING.md)** — Yaygın sorunlar ve çözümler
- **[GitHub Issues](https://github.com/Ferhat-Yasinoglu/pusula/issues)** — Hataları bildirin
