# agentrouter.org WAF (Web Application Firewall) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../security/AGENTROUTER_WAF.md) · 🇩🇪 [de](../../../de/docs/security/AGENTROUTER_WAF.md) · 🇮🇷 [fa](../../../fa/docs/security/AGENTROUTER_WAF.md)

---

`agentrouter` üst ağ geçidi, `messages[].content` üzerinde anahtar kelime tabanlı bir içerik filtresi çalıştırır. Filtre kısmen deterministiktir (belirli ifadeleri her zaman engeller) ve kısmen olasılıksaldır (ani istek yoğunluğuna duyarlıdır — hızlı isteklerden sonra daha agresif hâle gelir ve bir bekleme süresinin ardından normale döner).

WAF bir isteği engellediğinde şu yanıtı döndürür:

```
HTTP/1.1 400 Bad Request
{"error":{"code":"content-blocked","message":"content-blocked (request id: ...)","param":"","type":"agent_router_api_error"}}
```

## Filtrenin kapsamı

WAF yalnızca `messages[].content` alanını inceler. Şunları **incelemez**:

- `system` istemi
- Yapılandırılmış içerik blokları (`tool_result`, `tool_use`, `thinking`, `image`)
- Araçların `description` ve `input_schema` alanları
- İstek meta verileri, üstbilgiler veya model kimliği

## Her zaman engellenen kalıplar (büyük/küçük harfe duyarsız)

| Kalıp                               | Notlar                                               |
| ----------------------------------- | ---------------------------------------------------- |
| Herhangi bir `Lorem ipsum` varyantı | Latince lorem sözcük dağarcığının tamamı engellenir  |
| `language model` (tek başına)       | "the language model" ve "large language model" geçer |
| `virtual assistant`                 | "AI assistant" geçer                                 |
| `I'm here to help`                  | "here to help" ifadesi tek başına da engellenir      |
| `Claude, made by Anthropic`         | Yalnızca tam ifade                                   |

## Neredeyse her zaman engellenen kalıplar

| Kalıp                                                          | Notlar                                                     |
| -------------------------------------------------------------- | ---------------------------------------------------------- |
| `placeholder`                                                  | Tek başına kullanıldığında (parametre adı vb. olmadığında) |
| `dummy data`                                                   | Fikstürler için yaygın başlangıç ifadesi                   |
| `foo bar baz`                                                  | Standart yer tutucu ifade                                  |
| Tekrarlanan kısa belirteçler (`AAA BBB CCC`, `test test test`) | Anahtar kelime doldurma algılayıcısı                       |

## Yük altındaki davranış

Kısa bir zaman aralığında yaklaşık 5 hızlı istekten sonra WAF, normalde geçecek içerikleri engellemeye başlar. Kota, yaklaşık 5–10 saniyelik boşta kalma süresinin ardından gevşer. Bu, Claude Code veya Codex CLI art arda hızlı biçimde birden fazla araç kullanımı / mesaj gönderme çağrısı yaptığında aralıklı `400 content-blocked` hatalarına neden olan, IP ve anahtara bağlı aynı hız sınırlayıcıdır.

## Pusula'ta hâlihazırda uygulanan önlemler

1. **`open-sse/services/wafRateLimit.ts`** — herhangi bir `agentrouter:*` URL'sine yapılan giden istekler arasında en az 500 ms boşluk olmasını zorunlu kılan ani yük koruması. Bu boşluk, insanların gecikmeyi algılama eşiğinin oldukça altındadır ve WAF'nin normal trafikte etkinleşmesini önler.

2. **`BaseExecutor.WAF_RETRY_CONFIG`** — üst servis `400 content-blocked` döndürdüğünde yürütücü, üstel geri çekilmeyle aynı URL'yi yeniden dener (1,5 sn, 3,0 sn, en fazla 2 deneme). Geri çekilme süresinin ardından WAF genellikle gevşer ve yeniden deneme başarılı olur.

3. **`tests/unit/compression/harness.test.ts`** — test fikstürü `longInput`, `"lorem ipsum dolor sit amet ".repeat(40)` değerinden `"example content for testing purposes ".repeat(40)` değerine değiştirildi; böylece Claude Code bu dosyayı `Read` aracıyla okuduğunda dosya içeriği bir `tool_result` bloğu üzerinden geri akıp WAF'yi tetiklemez.

## İstemler ve araç çıktıları için rehber

Bir Claude Code veya Codex CLI oturumu tekrar tekrar `400 content-blocked` hatasıyla karşılaşıyorsa en son kullanıcı mesajında ve en son araç sonucunda yukarıdaki kalıplardan herhangi birinin bulunup bulunmadığını kontrol edin ve ifadeyi yeniden yazın. Yaygın geçici çözümler:

- `Lorem ipsum …` ifadesini `example text …` ile veya testin ya da fikstürün modellemeye çalıştığı gerçek içerikle değiştirin.
- Tek başına kullanılan `placeholder` ifadesini `example value`, `sample value` veya gerçek değerle değiştirin.
- `language model` ifadesini `large language model` veya `the model` ile değiştirin.
- `dummy data` ifadesini `sample data` veya gerçekçi başlangıç değerleriyle değiştirin.
- `I'm here to help` / `here to help` ifadelerini daha belirli bir açılışla değiştirin (ör. "I'll review the file you mentioned").

## Yanlış pozitifleri üst servise bildirme

Mevcut filtre aşırı agresiftir — operatörün bir istem enjekte etmeyi amaçlamadığı açık olsa bile `tool_result` bloklarındaki "Lorem ipsum" ifadesini engeller. Bunun kaynağında düzeltilmesini isteyen operatörler, yanlış pozitifleri bildirmek için `agentrouter.org` ile iletişime geçmelidir. Yukarıdaki engelleme listesi, 2026-08-03 itibarıyla üst serviste yapılan incelemelerin ampirik sonucudur.
