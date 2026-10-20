# Devin Claude Bridge (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../DEVIN_CLAUDE_BRIDGE.md) · 🇩🇪 [de](../../de/docs/DEVIN_CLAUDE_BRIDGE.md) · 🇮🇷 [fa](../../fa/docs/DEVIN_CLAUDE_BRIDGE.md)

---

`devin-cli-agentic`, resmi Devin CLI model yanıtlarını ACP stdio üzerinden sağlarken gerçek Claude Code çalışma zamanının Pusula'un yerel Anthropic Messages uç noktasını kullanmasına olanak tanır. Mevcut Anthropic, Claude OAuth, Claude Web veya `devin-cli` sağlayıcılarını değiştirmez.

> **Geçerli durum: Claude Code `2.1.258` sürümüne sabitlenmiştir; çevrimdışı ve canlı doğrulama en son `2.1.220` üzerinde kaydedilmiştir.** `2.1.220` sabitlemesi, Devin CLI `3000.2.17` ve `swe-1-7-lightning` modeli üzerinden üç yalıtılmış senaryoyu tamamladı; bu son canlı çalıştırma, istemcinin yönettiği `Read`, `Edit` ve `Bash` adımlarını, başarılı `npm test` sonuçlarını, proje komutu ve beceri keşfini, yalnızca Devin'e yönelik yönlendirmeyi ve Claude'a sıfır çıkışı kanıtladı. Ardından sabitleme `2.1.258` sürümüne yükseltildi (Pusula'un Claude kimliğinin taklit ettiği CLI nesli ve Fable 5.1 katmanını yerel olarak sunan ilk seri). Yeni sabitlemede, sabitlenmiş temel imaj üzerinde kurulum katmanı ve `claude --version` doğrulandı; köprü birim test paketi, `compose config` ve statik yalıtım kanıtı başarılı oldu — ancak çevrimdışı sahte senaryo ve canlı üç senaryolu test paketi henüz yeniden çalıştırılmadı. Bu sabitlemeyle köprüye güvenmeden önce bunları yeniden çalıştırın (bkz. "Sabitlenmiş araçları güncelleme").

## Mimari

```text
Claude Code 2.1.258 (yalıtılmış, root olmayan Linux konteyneri)
  -> http://pusula:20128/v1/messages
  -> devin-cli-agentic (Claude biçimi, kimlik doğrulamasız sağlayıcı)
  -> devin acp --agent-type summarizer (resmi ACP stdio, Devin araçları yok)
  -> ayrılmış devin-auth birimindeki Devin hesabı
```

Resmi CLI'ın varsayılan ACP aracısı kendi araçlarını çalıştırabildiğinden bu köprü onu kullanmaz. Köprü, resmi CLI modunda hiçbir aracı bulunmayan sabit `summarizer` ACP aracısını başlatır ve serileştirilmiş Anthropic isteğini bir yürütme izi olarak çerçeveler. Claude tarafından yönetilen başka bir eylem gerektiğinde yanıt tam olarak bir istemci araç zarfı içermelidir. Herhangi bir ACP `tool_call` veya `tool_call_update`, yanıt başarılı olarak bildirilmeden önce reddedilir.

`open-sse/executors/devin-agentic/serializer.ts` içindeki serileştirici; `system`, `text`, `tool_use`, `tool_result`, `thinking`, `redacted_thinking`, `tool_choice` ve Claude Code tarafından sağlanan araçları korur. Görseller ve bilinmeyen bloklar açıkça başarısız olur. Büyük araç sonuçlarında görünür bir kırpma işareti kullanılır.

Ayrıştırıcı, model adımı başına bağımsız bir `<tool>{...}</tool>` zarfı kabul eder. Adı isteğin araç listesine göre denetler, bağımsız değişkenleri ilgili aracın JSON Schema'sına göre doğrular, anlatı ile eylemlerin karıştırılmasını reddeder ve sınırlandırılmış tek bir düzeltmeye izin verir. Ardından Claude Code, ortaya çıkan Anthropic `tool_use` öğesini yerel olarak çalıştırır ve `tool_result` sonucunu Pusula üzerinden geri gönderir.

## Yalıtım ve tehdit modeli

Ana makinedeki Claude kurulumu, hesabı ve yapılandırması kapsam dışıdır ve yasaklı kabul edilir. Compose hizmetleri:

- UID/GID `10001:10001` olarak, salt okunur kök dosya sistemi, kaldırılmış yetenekler ve `no-new-privileges` ile çalışır;
- özel bir `/home/bridge`, ayrılmış bir Claude yapılandırma birimi, yalıtılmış Pusula verileri ve ayrı bir `devin-auth` birimi kullanır;
- yalnızca tek kullanımlık `.sandbox` çalışma alanlarını/kanıtlarını bağlar;
- ana makinenin ev dizinini, Keychain'i, SSH'yi, bulut kimlik bilgilerini veya Docker soketini bağlamaz;
- açık ortamlar oluşturur ve Anthropic API/OAuth/yönlendirme değişkenlerini kaldırır;
- Claude Code çıkarımını yalnızca yerel bir anahtarla `http://pusula:20128` adresine yönlendirir.

Çevrimdışı profil dahili bir ağ kullanır. Canlı profilde Pusula, resmi Devin uç noktalarına yalnızca `network-guard` üzerinden erişir; ilgisiz hedefler reddedilir. Claude Code'un tüm çıkışları reddeden ayrı bir çıkış koruması vardır ve yalnızca `NO_PROXY` üzerinden yerel Pusula hizmetine erişebilir. Koruma denetim dosyaları yalnızca ilgili koruma süreci tarafından bağlanır. Betikler, belirteç içermeyen kanıtları dışa aktarmadan önce dosya sahipliğini, modunu, bağlantı sayısını ve her kararı doğrular.

Yalıtım kanıtını bağımsız olarak çalıştırın:

```bash
./scripts/devin-bridge/verify-anthropic-isolation
```

Topolojiyi, adlandırılmış bağlamaları, root olmayan/salt okunur ayarları, açık yerel yönlendirmeyi, hassas ortam değişkenlerinin bulunmadığını, Docker soketinin bulunmadığını, `api.anthropic.com` ve `claude.ai` erişiminin engellendiğini, yalnızca Devin sağlayıcısının seçildiğini ve ACP arka ucu kullanılamadığında açıkça hata oluştuğunu doğrular.

## İlk kurulum ve normal kullanım

Sabitlenmiş imajı oluşturun:

```bash
./scripts/devin-bridge/build
```

Yalnızca izole edilmiş Devin biriminin kimlik doğrulamasını yapın:

```bash
ENABLE_LIVE_DEVIN_TESTS=1 ./scripts/devin-bridge/login-devin
```

Oturum açma komutu, uzak/konteyner ortamları için tasarlanmış resmi manuel belirteç akışını kullanır. Değer doğrudan CLI istemine girilir; süreç argümanı olarak aktarılmaz, Git'e yazılmaz veya ana makineden kopyalanmaz.

İzole edilmiş Claude Code çalışma zamanını başlatın:

```bash
./scripts/devin-bridge/launch
```

`launch`, konteynerleştirilmiş Claude Code'u başlatmadan önce izolasyonu, Devin kimlik doğrulamasını ve model keşfini yeniden denetler. Ana makinenin Claude yürütülebilir dosyasını hiçbir zaman çalıştırmaz. Model takma adları `.env.devin-bridge` içinde ayarlanabilir; yapılandırılan her değer `devin-cli-agentic/` önekini korumalıdır.

## Doğrulama komutları

Yeniden üretilebilir çevrimdışı yol, Devin hesabı gerektirmez ve çalışma zamanında İnternet erişimine sahip değildir:

```bash
./scripts/devin-bridge/test-unit
./scripts/devin-bridge/test-contract
./scripts/devin-bridge/test-e2e-mock
./scripts/devin-bridge/verify-anthropic-isolation
```

Kimlik doğrulamalı ve isteğe bağlı canlı yol şöyledir:

```bash
ENABLE_LIVE_DEVIN_TESTS=1 ./scripts/devin-bridge/test-live-devin
```

Canlı çalıştırıcı, ACP oturumlarını arka arkaya açmaktan kaçınmak için senaryolar arasında bekler ve metinsel iddialara güvenmek yerine yapılandırılmış Claude akış olaylarını doğrular. Üç senaryosu şunları kanıtlar:

1. doğrudan proje okumaları ve hata analizi;
2. gerçek bir `Edit`, istemciye ait bir `Bash` `npm test` işlemi ve nihai sonuç;
3. `/bridge-check` ile `bridge-proof` keşfi, proje okumaları, istemciye ait başka bir başarılı `npm test` işlemi ve bekleyen iş olmadan tamamlanma.

Son geçit ayrıca Devin ağ denetimini kontrol eder ve Claude çıkış trafiği denetiminin boş kalmasını gerektirir.

## Sabitlenmiş araçları güncelleme

İmaj; Node, Claude Code ve Devin CLI sürümlerini `docker/devin-bridge/Dockerfile` içinde sabitler. Güncellemek için:

1. açıkça belirtilen sürümleri değiştirin;
2. mimariye özgü her iki Devin arşiv sağlama toplamını da resmi yapıta ait değerlerle değiştirin;
3. yeniden oluşturun ve tüm çevrimdışı doğrulama komutlarını çalıştırın;
4. imaj içindeki sürümleri doğrulayın;
5. kimlik doğrulamalı üç senaryolu canlı paketi yeniden çalıştırın.

Her iki CLI'yi de ana makineye global olarak kurmayın veya sağlama toplamı doğrulamasını doğrulanmamış bir indirmeyle değiştirmeyin.

## Tanılama ve temizleme

- `docker compose -f docker/devin-bridge/compose.yml --profile offline logs pusula`
  yerel yönlendirmeyi ve hassas bilgilerden arındırılmış yürütücü hatalarını gösterir.
- `.sandbox/evidence/mock-acp.jsonl`, deterministik sahte ACP eylemlerini kaydeder.
- `.sandbox/evidence/claude-stream.jsonl`, gerçek Claude Code çevrimdışı çalışmasını kaydeder.
- `.sandbox/evidence/live-*.jsonl`, doğrulanan üç canlı akışı kaydeder.
- `.sandbox/evidence/egress.jsonl` ve `.sandbox/evidence/claude-egress.jsonl`, koruma denetimlerinin doğrulanmış ve belirteç içermeyen kopyalarıdır.

Oturum açma/yapılandırma birimlerini koruyarak sahip olunan konteynerleri ve ağları durdurun:

```bash
./scripts/devin-bridge/clean
```

Adlandırılmış birimler dahil olmak üzere köprüye ait ortamın tamamını kaldırın:

```bash
./scripts/devin-bridge/clean --all
```

## Sınırlamalar

- Köprü, sabit ve araç kullanmayan `summarizer` rolüne dayanır; çünkü Devin CLI `3000.2.17`, araç kullanmayan nötr bir ACP aracısı sunmaz. Bağdaştırıcı, özet biçimindeki ara yanıtları telafi eder ancak sınırlandırılmış tek bir düzeltme yine de açıkça başarısız olabilir.
- Canlı ACP çağrıları geçici `502`/`504` yanıtları döndürebilir. Test düzeneği senaryoların arasına zaman koyar; kalıcı başarısızlıkta sistem kapalı kalarak güvenli şekilde hata verir ve hiçbir zaman başka bir sağlayıcı seçmez.
- ACP bağlamı her Anthropic isteğinden yeniden oluşturulur; süreç/oturum yakınlığı yoktur.
- Model yanıtı başına bir araç çağrısı desteklenir; paralel çağrılar reddedilir.
- Görüntüler açıkça desteklenmez. Görü, düşünme çıktısı, efor denetimleri ve 1M bağlam penceresi desteklenen özellikler olarak belirtilmez.
- SSE, geçerli Anthropic yaşam döngüsü olaylarını kullanır ancak sınırlandırılmış ACP etkileşimi toplandıktan sonra yayınlanır; ACP parçaları artımlı olarak iletilmez.
