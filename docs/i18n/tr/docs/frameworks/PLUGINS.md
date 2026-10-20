# Pusula CLI Plugin System (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/PLUGINS.md) · 🇩🇪 [de](../../../de/docs/frameworks/PLUGINS.md) · 🇮🇷 [fa](../../../fa/docs/frameworks/PLUGINS.md)

---

Çekirdeğini değiştirmeden `pusula` CLI'ını genişletin. Eklentiler, `gh extension` veya `kubectl plugin` benzeri şekilde `pusula-cmd-*` adlandırma kuralını izler.

## Hızlı başlangıç

```bash
# npm'den bir eklenti yükleyin
pusula plugin install stripe

# Geliştirme aşamasındaki yerel bir eklentiyi yükleyin
pusula plugin install ./my-plugin

# Yüklü eklentileri listeleyin
pusula plugin list

# Yeni bir eklenti için başlangıç yapısı oluşturun
pusula plugin scaffold myplugin
cd pusula-cmd-myplugin
pusula plugin install .
```

## Eklenti yapısı

Bir eklenti, `pusula-cmd-<name>` (veya `@scope/pusula-cmd-<name>`) adlı bir npm paketidir.

```
pusula-cmd-myplugin/
├── package.json     # "type": "module" ve "main": "index.mjs" içermelidir
├── index.mjs        # register(program, ctx) ve isteğe bağlı meta dışa aktarır
└── README.md
```

### `package.json`

```json
{
  "name": "pusula-cmd-myplugin",
  "version": "0.1.0",
  "type": "module",
  "main": "index.mjs",
  "engines": { "pusula": ">=4.0.0" },
  "keywords": ["pusula-plugin", "pusula-cmd"]
}
```

### `index.mjs`

```js
export const meta = {
  name: "myplugin",
  version: "0.1.0",
  description: "Pusula için eklentim",
  pusulaApi: ">=4.0.0",
};

export function register(program, ctx) {
  program
    .command("myplugin")
    .description(meta.description)
    .option("-n, --name <name>")
    .action(async (opts, cmd) => {
      const gOpts = cmd.optsWithGlobals();
      const res = await ctx.apiFetch("/api/combos", {
        baseUrl: gOpts.baseUrl,
        apiKey: gOpts.apiKey,
      });
      const data = await res.json();
      ctx.emit(data, gOpts);
    });
}
```

## Eklenti bağlamı API'si

`register(program, ctx)` işlevine iletilen `ctx` nesnesi:

| Özellik                      | Tür              | Açıklama                                                       |
| ---------------------------- | ---------------- | -------------------------------------------------------------- |
| `ctx.apiFetch(path, opts)`   | `async function` | Pusula sunucusuna kimliği doğrulanmış fetch isteği          |
| `ctx.emit(data, opts)`       | `function`       | `--output` bayrağına göre table/json/jsonl/csv biçiminde çıktı |
| `ctx.t(key)`                 | `async function` | i18n çeviri araması                                            |
| `ctx.withSpinner(label, fn)` | `async function` | Async fn'yi ora ilerleme göstergesiyle sarmalar                |
| `ctx.baseUrl`                | `string`         | Çözümlenmiş temel URL                                          |
| `ctx.apiKey`                 | `string \| null` | Sağlanmışsa API anahtarı                                       |

## Keşif

Eklentiler şu konumlardan keşfedilir:

1. `~/.pusula/plugins/<name>/` — kullanıcıya özel yerel kurulumlar
2. `PUSULA_PLUGIN_PATH` ortam değişkeni — özel dizin

Her ikisi de **yalnızca CLI'a özeldir**. Sunucu tarafındaki eklenti çalışma zamanı (proxy içinde çalışan marketplace/`plugin.json` eklentileri), kendi geçersiz kılma ayarı olan `PUSULA_PLUGINS_DIR` ile kendi tarayıcısını kullanır — bkz.
[PLUGIN_MARKETPLACE.md → Eklenti dizini](./PLUGIN_MARKETPLACE.md#plugin-directory).
Birinin ayarlanması diğerini etkilemez.

Yükleme hataları yakalanır ve uyarı olarak yazdırılır — bozuk bir eklenti CLI'ın hiçbir zaman çökmesine neden olmaz.

## Güvenlik

Eklentiler, `pusula` ile aynı Node.js işlem ayrıcalıklarıyla çalışır. Yalnızca güvendiğiniz kaynaklardan eklenti yükleyin. `pusula plugin install` açık bir uyarı gösterir ve `--yes` seçeneğini veya etkileşimli onayı gerektirir.

## Yayımlama

1. `package.json` dosyasının `"keywords": ["pusula-plugin"]` içerdiğinden emin olun
2. Normal şekilde `npm publish` komutunu çalıştırın
3. Kullanıcılar `pusula plugin search <query>` aracılığıyla keşfeder (npm kayıt defterinde arama yapar)

## Örnek eklenti

`meta` + `register()` içeren, çalışan minimal bir örnek için [`examples/pusula-cmd-hello/`](../../examples/pusula-cmd-hello/index.mjs) dizinine bakın.
