# Cursor Image Generation (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/CURSOR_IMAGE.md) · 🇩🇪 [de](../../../de/docs/providers/CURSOR_IMAGE.md) · 🇹🇷 [tr](../../../tr/docs/providers/CURSOR_IMAGE.md)

---

Pusula قابلیت **تولید تصویر** در پلن Cursor را از طریق `POST /v1/images/generations` و با همان شناسه ارائهدهنده چت ارائه میکند: `cursor` (نام مستعار `cu`).

| فیلد                    | مقدار                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| شناسه `IMAGE_PROVIDERS` | `cursor`                                                                                      |
| قالب                    | `cursor-agent-image`                                                                          |
| احراز هویت              | همان اتصال OAuth / کلید API مورد استفاده برای چت (`provider_connections.provider = "cursor"`) |
| مدلها                   | `cursor/auto`، `cursor/composer-2`، `cursor/composer-2.5`                                     |

## چرا Agent CLI

چت Cursor در Pusula از `agent.v1.AgentService/Run` (protobuf) استفاده میکند. این مسیر ابزارهای داخلی کلاینت (shell، write، …) را **رد میکند**. تولید تصویر یک ابزار بومی Cursor است که توسط **CLI به نام `agent`** و با استفاده از seat اجرا میشود. بنابراین، هندلر تصویر `agent` را با یک پرامپت قفلشده و یک فضای کاری موقت برای هر درخواست اجرا میکند (با همان ساختار بریجهای seat جامعه) و سپس `b64_json` سازگار با OpenAI را برمیگرداند.

## محدودیت دسترسی (قواعد قطعی #15 + #17)

این تنها قالب `IMAGE_PROVIDERS` است که یک فرایند فرزند (باینری `agent`) را اجرا میکند. از آنجا که `POST /v1/images/generations` بین حدود ۴۰ ارائهدهنده دیگر تصویر که فرایند اجرا نمیکنند و فراخوانهای راهدور بهطور مجاز از آنها استفاده میکنند مشترک است، کل این مسیر در دسته `LOCAL_ONLY` طبقهبندی **نمیشود** — در عوض، `handleCursorAgentImageGeneration` گیت اختصاصی خود را با استفاده از نتیجه قابلاعتماد `AUTHZ_HEADER_PEER_LOCALITY` اعمال میکند که پایپلاین authz روی هر درخواست درج میکند (بر اساس همتای واقعی TCP، نه هدر جعلپذیر `Host`): فقط فراخوانهای `loopback` و `lan` میتوانند به اجرای فرایند دسترسی پیدا کنند؛ تمام موارد دیگر (از جمله کلید API افشاشدهای که از طریق یک تونل عمومی بازپخش شده باشد) پیش از هرگونه جستوجوی اعتبارنامه یا اجرای فرایند، پاسخ `403` دریافت میکنند. برای مشاهده همین سیاست که بر سایر بخشهای سطح `LOCAL_ONLY` اعمال شده است، به `src/server/authz/policies/management.ts` مراجعه کنید.

## گیت همزمانی در سطح ماژول است (محدودیت تکنمونهای)

`CURSOR_IMG_MAX_CONCURRENT` توسط یک شمارنده/صف درونحافظهای و محدود به نمونه ماژول Node (`open-sse/handlers/imageGeneration/providers/cursorAgentImage.ts`) اعمال میشود. این سازوکار تعداد اجرای همزمان `agent` را درون یک فرایند Pusula بهدرستی محدود میکند، اما بین چندین فرایند/نمونه که از یک seat مشترک Cursor استفاده میکنند (برای مثال، یک استقرار چندرپلیکایی) هماهنگی ایجاد **نمیکند** — هر نمونه محدودیت مستقل خود را اعمال میکند. برای استقرار تکنمونهای (حالت پیشفرض)، این محدودیت دقیق است؛ استقرارهای مقیاسپذیریافته افقی باید مقدار `CURSOR_IMG_MAX_CONCURRENT` را در هر نمونه محافظهکارانه نگه دارند یا ترافیک تصویر Cursor را به یک نمونه واحد هدایت کنند.

## الزامات

1. یک حساب Cursor متصلشده در داشبورد (OAuth یا کلید API با قالب `crsr_…`).
2. در دسترس بودن باینری Cursor Agent برای فرایند Pusula:
   - متغیر محیطی `CURSOR_AGENT_BIN=/path/to/agent`، یا
   - `~/.local/bin/agent`، یا
   - `providerSpecificData.agentBin` در اتصال Cursor.

تنظیمات اختیاری:

| متغیر محیطی                 | پیشفرض                 | مفهوم                             |
| --------------------------- | ---------------------- | --------------------------------- |
| `CURSOR_IMG_TIMEOUT_MS`     | `210000`               | محدودیت زمانی واقعی برای هر تصویر |
| `CURSOR_IMG_MAX_CONCURRENT` | `2`                    | گیت همزمانی برای seat مشترک       |
| `CURSOR_IMG_MODEL`          | (مدل درخواست / `auto`) | بازنویسی `--model` در CLI         |

## مثال

```bash
curl -sS https://<host>/v1/images/generations \
  -H "Authorization: Bearer <pusula-api-key>" \
  -H "Content-Type: application/json" \
  -d '{"model":"cursor/auto","prompt":"a lantern in fog","size":"1024x1024"}'
```

تولید تصویر معمولاً ۱ تا ۲ دقیقه طول میکشد. استفاده از یک مسیر شبکه داخلی توصیه میشود؛ پراکسیهای لبه با مهلت زمانی حدود ۱۰۰ ثانیه ناموفق خواهند بود.

## LiteLLM

یک مدل تصویر را با `mode: image_generation`،‏ `api_base: http://pusula:20128/v1` و `model: openai/cursor/auto` (یا صرفاً `cursor/auto`، بسته به نسخه LiteLLM شما) ثبت کنید.
