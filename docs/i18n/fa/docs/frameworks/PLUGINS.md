# Pusula CLI Plugin System (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/PLUGINS.md) · 🇩🇪 [de](../../../de/docs/frameworks/PLUGINS.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/PLUGINS.md)

---

CLI مربوط به `pusula` را بدون تغییر در هستهٔ آن گسترش دهید. افزونهها از قرارداد نامگذاری `pusula-cmd-*` پیروی میکنند؛ مشابه `gh extension` یا `kubectl plugin`.

## شروع سریع

```bash
# نصب یک افزونه از npm
pusula plugin install stripe

# نصب یک افزونهٔ محلی در حال توسعه
pusula plugin install ./my-plugin

# فهرستکردن افزونههای نصبشده
pusula plugin list

# ایجاد ساختار اولیهٔ یک افزونهٔ جدید
pusula plugin scaffold myplugin
cd pusula-cmd-myplugin
pusula plugin install .
```

## ساختار افزونه

افزونه یک بستهٔ npm با نام `pusula-cmd-<name>` (یا `@scope/pusula-cmd-<name>`) است.

```
pusula-cmd-myplugin/
├── package.json     # باید دارای "type": "module" و "main": "index.mjs" باشد
├── index.mjs        # register(program, ctx) و در صورت تمایل meta را صادر میکند
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
  description: "افزونهٔ من برای Pusula",
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

## API زمینهٔ افزونه

شیء `ctx` که به `register(program, ctx)` ارسال میشود:

| ویژگی                        | نوع              | توضیحات                                                    |
| ---------------------------- | ---------------- | ---------------------------------------------------------- |
| `ctx.apiFetch(path, opts)`   | `async function` | درخواست احراز هویتشده به سرور Pusula                    |
| `ctx.emit(data, opts)`       | `function`       | خروجی در قالب table/json/jsonl/csv بر اساس پرچم `--output` |
| `ctx.t(key)`                 | `async function` | جستوجوی ترجمهٔ i18n                                        |
| `ctx.withSpinner(label, fn)` | `async function` | اجرای تابع ناهمگام `fn` همراه با نشانگر چرخان ora          |
| `ctx.baseUrl`                | `string`         | URL پایهٔ نهاییشده                                         |
| `ctx.apiKey`                 | `string \| null` | کلید API، در صورت ارائه                                    |

## کشف افزونهها

افزونهها از مکانهای زیر کشف میشوند:

1. `~/.pusula/plugins/<name>/` — نصبهای محلی کاربر
2. متغیر محیطی `PUSULA_PLUGIN_PATH` — پوشهٔ سفارشی

هر دو **فقط مختص CLI** هستند. محیط اجرای افزونه در سمت سرور (افزونههای marketplace/`plugin.json`
که درون پراکسی اجرا میشوند) اسکنر مستقل خود را با مقدار جایگزین مخصوص خود،
`PUSULA_PLUGINS_DIR`، دارد — به
[PLUGIN_MARKETPLACE.md ← پوشهٔ افزونه](./PLUGIN_MARKETPLACE.md#plugin-directory)
مراجعه کنید. تنظیم یکی بر دیگری تأثیری ندارد.

خطاهای بارگذاری مدیریت شده و بهصورت هشدار نمایش داده میشوند — یک افزونهٔ خراب هرگز باعث از کار افتادن CLI نمیشود.

## امنیت

افزونهها با همان سطح دسترسی پردازش Node.js مربوط به `pusula` اجرا میشوند. فقط افزونههایی را از منابع مورد اعتماد نصب کنید. `pusula plugin install` یک هشدار صریح نمایش میدهد و به `--yes` یا تأیید تعاملی نیاز دارد.

## انتشار

1. مطمئن شوید `package.json` دارای `"keywords": ["pusula-plugin"]` است
2. طبق معمول `npm publish` را اجرا کنید
3. کاربران از طریق `pusula plugin search <query>` افزونهها را پیدا میکنند (رجیستری npm را جستوجو میکند)

## افزونهٔ نمونه

برای مشاهدهٔ یک نمونهٔ عملی حداقلی با `meta` و `register()`، به [`examples/pusula-cmd-hello/`](../../examples/pusula-cmd-hello/index.mjs) مراجعه کنید.
