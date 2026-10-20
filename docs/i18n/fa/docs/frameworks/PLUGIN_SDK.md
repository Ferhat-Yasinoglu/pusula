# Pusula Plugin SDK (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../frameworks/PLUGIN_SDK.md) · 🇩🇪 [de](../../../de/docs/frameworks/PLUGIN_SDK.md) · 🇹🇷 [tr](../../../tr/docs/frameworks/PLUGIN_SDK.md)

---

## شروع سریع

```ts
import { definePlugin } from "pusula/plugins/sdk";

export default definePlugin({
  name: "my-plugin",
  priority: 50,
  onRequest: async (ctx) => {
    console.log(`Request ${ctx.requestId} for ${ctx.model}`);
  },
  onResponse: async (ctx, response) => {
    console.log(`Response for ${ctx.requestId}`);
    return response;
  },
  onError: async (ctx, error) => {
    console.error(`Error: ${error.message}`);
  },
});
```

## مرجع API

### `definePlugin(def: PluginDefinition): Plugin`

تابع سازندهای که یک شیء Plugin را با مقادیر پیشفرض ایجاد میکند.

**پارامترها:**

- `name` (رشته، الزامی) — نام افزونه با قالب kebab-case
- `priority` (عدد، اختیاری، پیشفرض: 100) — مقدار کمتر زودتر اجرا میشود
- `enabled` (بولی، اختیاری، پیشفرض: true) — آیا در ابتدا فعال باشد؟
- `onRequest` (تابع، اختیاری) — پیش از کنترلکنندهٔ چت اجرا میشود
- `onResponse` (تابع، اختیاری) — پس از کنترلکنندهٔ چت اجرا میشود
- `onError` (تابع، اختیاری) — هنگام بروز خطا در کنترلکننده اجرا میشود

### `blockRequest(response?): BlockingHookResult`

درخواست را مسدود کرده و در صورت نیاز، یک پاسخ سفارشی بازمیگرداند.

```ts
onRequest: (ctx) => {
  if (!ctx.headers["authorization"]) {
    return blockRequest({ error: "Unauthorized", status: 401 });
  }
};
```

### `modifyBody(body): PluginResult`

بدنهٔ درخواست را پیش از رسیدن به ارائهدهنده تغییر میدهد.

```ts
onRequest: (ctx) => {
  return modifyBody({ ...ctx.body, temperature: 0.7 });
};
```

### `addMetadata(metadata): PluginResult`

فراداده را به زمینهٔ درخواست پیوست میکند.

```ts
onRequest: (ctx) => {
  return addMetadata({ source: "my-plugin", version: "1.0.0" });
};
```

## زمینهٔ افزونه (`PluginContext`)

| فیلد        | نوع                       | توضیحات                 |
| ----------- | ------------------------- | ----------------------- |
| `requestId` | `string`                  | شناسهٔ یکتای درخواست    |
| `model`     | `string`                  | نام مدل درخواستی        |
| `provider`  | `string`                  | شناسهٔ ارائهدهندهٔ مقصد |
| `body`      | `Record<string, unknown>` | بدنهٔ درخواست           |
| `headers`   | `Record<string, string>`  | سرآیندهای درخواست       |
| `metadata`  | `Record<string, unknown>` | فرادادهٔ قابلتغییر      |
| `timestamp` | `number`                  | برچسب زمانی درخواست     |

## مانیفست (`plugin.json`)

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "A sample plugin",
  "author": "your-name",
  "main": "index.js",
  "hooks": {
    "onRequest": { "enabled": true, "priority": 50 },
    "onResponse": true,
    "onError": false
  },
  "requires": {
    "permissions": ["network", "file-read"]
  },
  "enabledByDefault": false,
  "configSchema": {
    "apiKey": {
      "type": "string",
      "description": "API key for external service"
    },
    "maxRetries": { "type": "number", "min": 1, "max": 10, "default": 3 },
    "debug": { "type": "boolean", "default": false },
    "mode": { "type": "string", "enum": ["fast", "slow"], "default": "fast" }
  }
}
```

### اولویت هوکها

هوکها را میتوان با اولویت پیکربندی کرد (مقدار کمتر = اجرای زودتر):

```json
{
  "hooks": {
    "onRequest": { "enabled": true, "priority": 10 },
    "onResponse": { "enabled": true, "priority": 100 }
  }
}
```

یا بهصورت مقادیر بولی ساده (اولویت پیشفرض 100):

```json
{
  "hooks": {
    "onRequest": true,
    "onResponse": true
  }
}
```

## سیستم مجوزها

افزونهها در یک محیط VM ایزولهشده اجرا میشوند. دسترسی به منابع خارجی نیازمند مجوزهای صریح است:

| مجوز         | امکانات اعطاشده                                              |
| ------------ | ------------------------------------------------------------ |
| `network`    | `fetch`، `AbortController`، `Headers`، `Request`، `Response` |
| `file-read`  | `fs.readFile`، `fs.readdir`، `fs.stat`                       |
| `file-write` | `fs.writeFile`، `fs.mkdir`، `fs.rm`                          |
| `env`        | پراکسی فقطخواندنی `process.env`                              |
| `exec`       | `child_process.exec`، `child_process.execSync`               |

بدون یک مجوز، متغیرهای سراسری مربوطه بهسادگی در محیط ایزولهشده در دسترس نخواهند بود.

## طرحواره پیکربندی

تنظیمات قابل پیکربندی را در `configSchema` تعریف کنید:

```json
{
  "configSchema": {
    "apiKey": { "type": "string", "description": "کلید API خارجی" },
    "maxRetries": { "type": "number", "min": 1, "max": 10, "default": 3 },
    "debug": { "type": "boolean", "default": false },
    "mode": { "type": "string", "enum": ["fast", "slow"], "default": "fast" }
  }
}
```

انواع فیلد: `string`، `number`، `boolean`، `select`

گزینههای فیلد: `default`، `min`، `max`، `enum`، `description`

مقادیر پیکربندی در پایگاه داده ذخیره میشوند و از طریق صفحه پیکربندی داشبورد قابل دسترسی هستند.

## رویدادهای داخلی

| رویداد            | زمان وقوع                            | داده ارسالی                   |
| ----------------- | ------------------------------------ | ----------------------------- |
| `onRequest`       | پیش از مدیریتکننده چت                | زمینه درخواست                 |
| `onResponse`      | پس از مدیریتکننده چت                 | داده پاسخ                     |
| `onError`         | هنگام خطای مدیریتکننده               | شیء خطا                       |
| `onModelSelect`   | هنگام انتخاب مدل برای مسیریابی       | اطلاعات مدل                   |
| `onComboResolve`  | هنگام تعیین مسیریابی ترکیبی          | مقصدهای ترکیبی                |
| `onRateLimit`     | هنگام رسیدن به محدودیت نرخ           | اطلاعات محدودیت               |
| `onQuotaExhaust`  | هنگام اتمام سهمیه                    | اطلاعات سهمیه                 |
| `onProviderError` | هنگام بازگرداندن خطا توسط ارائهدهنده | جزئیات خطا                    |
| `onStreamStart`   | هنگام شروع جریان SSE                 | اطلاعات جریان                 |
| `onStreamEnd`     | هنگام پایان جریان SSE                | آمار جریان                    |
| `onInstall`       | هنگام نصب افزونه                     | `{ name, version, manifest }` |
| `onActivate`      | هنگام فعالسازی افزونه                | `{ name, version, manifest }` |
| `onDeactivate`    | هنگام غیرفعالسازی افزونه             | `{ name, version, manifest }` |
| `onUninstall`     | هنگام حذف افزونه (پیش از حذف فایلها) | `{ name, version, manifest }` |

## نمونهها

### ثبتکننده درخواست

```ts
import { definePlugin } from "pusula/plugins/sdk";

export default definePlugin({
  name: "request-logger",
  onRequest: async (ctx) => {
    console.log(`[${new Date().toISOString()}] ${ctx.method} ${ctx.model} -> ${ctx.provider}`);
  },
});
```

### محدودکننده نرخ

```ts
import { definePlugin, blockRequest } from "pusula/plugins/sdk";

const requests = new Map<string, number[]>();

export default definePlugin({
  name: "rate-limiter",
  priority: 10,
  onRequest: async (ctx) => {
    const key = ctx.headers["x-api-key"] || "anonymous";
    const now = Date.now();
    const window = 60000; // ۱ دقیقه
    const maxRequests = 100;

    const timestamps = (requests.get(key) || []).filter((t) => t > now - window);
    timestamps.push(now);
    requests.set(key, timestamps);

    if (timestamps.length > maxRequests) {
      return blockRequest({ error: "Rate limit exceeded", status: 429 });
    }
  },
});
```

### تبدیلکننده پاسخ

```ts
import { definePlugin } from "pusula/plugins/sdk";

export default definePlugin({
  name: "response-transformer",
  onResponse: async (ctx, response) => {
    if (response.choices) {
      response.choices = response.choices.map((c: any) => ({
        ...c,
        message: { ...c.message, content: c.message.content.trim() },
      }));
    }
    return response;
  },
});
```
