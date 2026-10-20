# Homologation Suite (`npm run homolog`) (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/HOMOLOGATION.md) · 🇩🇪 [de](../../../de/docs/ops/HOMOLOGATION.md) · 🇹🇷 [tr](../../../tr/docs/ops/HOMOLOGATION.md)

---

اعتبارسنجی E2E در محیط واقعی برای استقرار Pusula که روی VPS همولوگیشن اجرا میشود
(`HOMOLOG_BASE_URL`، برای مثال `http://127.0.0.1:20128`). یک فرمان، چکلیست دستی
STOP #2 انتشار را با اجرایی خودکار و تولیدکننده شواهد جایگزین میکند.

## موارد تحت پوشش

| لایه                          | مواردی که بررسی میکند                                                                                                                                                                                        | پیادهسازی                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| L0 — سلامت/همخوانی            | `/api/monitoring/health` با کد `200`، مقدار `status: "healthy"` و نسخه مورد انتظار پاسخ میدهد                                                                                                                | `scripts/homolog/lib/parity.mjs`                                              |
| L1a — کلید موقت               | ورود مدیر → `POST /api/keys` یک کلید API با دامنه محدود برای اجرای جاری ایجاد میکند که، فارغ از نتیجه، در بلوک `finally` با (`DELETE /api/keys/:id`) لغو میشود                                               | `scripts/homolog/lib/adminClient.mjs`                                         |
| L1b — سطح API                 | کاتالوگ `/v1/models`، یک تکمیل چت واقعی و غیرجریانی (مدل حیاتی برای سطح، `max_tokens: 5`)، پاسخ `401` برای کلید نامعتبر و مسیر عمومی `/api/monitoring/health`                                                | `tests/homolog/api/core.http` (httpYac)                                       |
| L1c — جریان SSE               | تکمیل چت جریانی واقعی؛ `text/event-stream`، وجود حداقل یک دلتا از محتوا و یک پایاندهنده `[DONE]` را بررسی میکند                                                                                              | `scripts/homolog/lib/sseCheck.mjs`                                            |
| L2 — ارائهدهندگان واقعی       | بهازای هر ارائهدهنده حیاتی موجود در کاتالوگ زنده `/v1/models`، یک درخواست چت با حداقل هزینه که در لحظه از طریق promptfoo تولید میشود                                                                         | `scripts/homolog/gen-promptfoo.mjs` + `scripts/homolog/lib/providerTiers.mjs` |
| L4a — احراز هویت رابط کاربری  | یکبار از طریق فرم ورود واقعی وارد میشود و نشست (`storageState`) را در سراسر لایه رابط کاربری بازاستفاده میکند                                                                                                | `tests/homolog/ui/auth.setup.ts`                                              |
| L4b — مسیرهای رابط کاربری     | هر فایل ایستای `page.tsx` زیر `src/app/(dashboard)/dashboard` (کشفشده از سیستم فایل؛ مسیرهای پویای `[param]` نادیده گرفته میشوند) بدون خطای HTTP، خطای صفحه یا مرز خطای Next.js بارگذاری میشود               | `tests/homolog/ui/routes.spec.ts`                                             |
| L4c — جریان حیاتی رابط کاربری | یک کلید API را از طریق رابط کاربری داشبورد ایجاد کرده و دوباره لغو میکند (هیچ اثری روی VPS باقی نمیگذارد)                                                                                                    | `tests/homolog/ui/api-key-flow.spec.ts`                                       |
| L5 — گزارش یکپارچه            | httpYac (از طریق `junit-to-ctrf`)، مبدل promptfoo→CTRF و گزارشگر CTRF مربوط به Playwright را در یک فایل `homolog-ctrf.json` ادغام میکند و همچنین یک فایل خوانای انسانی در `homolog-report/summary.md` میسازد | `scripts/homolog/run.mjs`                                                     |

خود بازپخش هیچگونه دخالتی از LLM ندارد — این یک مجموعه آزمون رگرسیون قطعی است،
نه یک ارزیابی. هوش مصنوعی فقط در کارهای نگهداری آینده وارد میشود (بخش نقشه راه در ادامه را ببینید).

## پیشنیازها

1. فایل `.env.homolog.example` را در `.env.homolog` کپی کنید (توسط git نادیده گرفته میشود — هرگز آن را commit نکنید) و موارد زیر را تکمیل کنید:
   - `HOMOLOG_BASE_URL` — استقرار هدف، برای مثال `http://127.0.0.1:20128`.
   - `HOMOLOG_ADMIN_PASSWORD` — گذرواژه مدیریت داشبورد برای آن استقرار.
   - `HOMOLOG_CRITICAL_PROVIDERS` — پیشوندهای provider با جداکننده ویرگول که یک درخواست واقعی
     smoke chat دریافت میکنند (برای مثال `openai,anthropic,gemini,codex,grok,glm,deepseek,openrouter`).
   - `HOMOLOG_API_KEY` — در اجراهای عادی خالی بگذارید؛ مجموعه آزمون کلید موقتی خودش را ایجاد و لغو
     میکند. این مقدار را فقط برای اشکالزدایی یک لایه بهصورت مجزا تنظیم کنید.
2. در مخزن `npm install` را اجرا کنید (وابستگیهای مجموعه آزمون — `httpyac`، `promptfoo`،
   `playwright-ctrf-json-reporter`، `junit-to-ctrf`، `ctrf` — همگی devDependencies معمولی هستند).
3. اگر فایلهای باینری مرورگر از قبل موجود نیستند، `npx playwright install` را اجرا کنید.

## نحوه اجرا

```bash
npm run homolog
```

برای اعتبارسنجی در برابر استقراری که نسخه آن با `package.json` محلی مطابقت ندارد
(برای مثال، محیط homologation که هنوز روی یک patch release قبلی است)، نسخه مورد انتظار
را صراحتاً بازنویسی کنید:

```bash
HOMOLOG_EXPECT_VERSION=3.8.47 npm run homolog
```

اگر هر لایهای شکست بخورد، اجرای برنامه با کد خروج غیرصفر پایان مییابد و همیشه تلاش میکند کلید
API موقتی ایجادشده را حتی در صورت شکست لغو کند (`finally` block در `scripts/homolog/run.mjs`).

## خواندن گزارش

تمام خروجیها در `homolog-report/` قرار میگیرند (توسط git نادیده گرفته میشود):

- `summary.md` — همان جدولی که در stdout چاپ میشود، با یک ردیف برای هر لایه (✅/❌ + جزئیات).
- `homolog-ctrf.json` — گزارش یکپارچه CTRF (ادغام نتایج API/SSE، provider-smoke و
  UI) — این artifact باید به چکلیست STOP #2 انتشار پیوست شود.
- `httpyac-junit.xml`، `api-ctrf.json`، `providers-ctrf.json`، `ui-ctrf.json` — گزارشهای
  خام/میانی هر لایه.
- `promptfooconfig.yaml`، `provider-misses.json` — پیکربندی promptfoo تولیدشده برای
  اجرای فعلی و هر provider حیاتی که در کاتالوگ زنده موجود نبوده است.

شکست L0 بلافاصله اجرا را متوقف میکند (هیچ کلید موقتی ایجاد نمیشود)، زیرا عدم تطابق
نسخه/سلامت به این معناست که هر لایه پاییندستی، استقرار اشتباهی را اعتبارسنجی خواهد کرد.

## ایجاد مجدد خط مبنا هنگام تغییر موجه UI

L4b (route smoke) و L4c (جریان UI کلید API) توسط locatorهای واقعی DOM هدایت میشوند، نه
snapshotها؛ بنابراین بیشتر تغییرات موجه UI نیازی به بهروزرسانی مجموعه آزمون ندارند. هنگامی که تغییری
باعث خرابی یک locator میشود (برای مثال، تغییر نام برچسب یک دکمه یا جابهجایی صفحه تنظیمات):

1. locator را دوباره با کد منبع فعلی تطبیق دهید (specها از قبل مستند کردهاند که هر
   locator در برابر کدام فایل/خط تأیید شده است — همان الگو را دنبال کنید، حدس نزنید).
2. spec موجود در `tests/homolog/ui/` را بهروزرسانی کنید.
3. `npm run homolog` (یا فقط spec تحت تأثیر Playwright) را دوباره در برابر VPS اجرا کنید تا
   اصلاح تأیید شود، سپس commit کنید.

در این مجموعه آزمون هیچ خط مبنای بصری/پیکسلی وجود ندارد (F1) — برای آن Roadmap را ببینید.

## نقشه راه (F2 / F3)

طراحی و عرضه مرحلهای در spec برنامهریزی داخلی
`_tasks/superpowers/specs/2026-07-13-homolog-e2e-suite-design.md` قرار دارد (لینک نشده است — یک
artifact داخلی در `_tasks/` که بخشی از مستندات ردیابیشده این مخزن نیست). خلاصه:

- **F2** — ضبط کامل walkthrough ← Playwright Test Agents (`planner`/`generator`)
  آن را به specهای جریان تبدیل میکنند (ایجاد combo، آزمایش provider، ویرایش تنظیمات، ابزارهای MCP) +
  خط مبنای رگرسیون بصری (Lost Pixel) با mask روی دادههای پویا (متریکها،
  timestampها، logها) + یک روال نگهداری `healer` برای هر انتشار.
- **F3** — پوشش تابآوری/قرارداد/wiring: toxiproxy + یک provider جعلی سازگار با OpenAI
  روی devbox، یک combo با نام `homolog-resilience` روی VPS که به آن اشاره میکند
  (تزریق timeout ← بررسی fallback + باز/بستهشدن circuit breaker از طریق
  `/api/monitoring/health`)؛ آزمون قراردادی gated با Schemathesis در برابر
  `docs/openapi.yaml` (`--max-examples` کم، seedهای ثابت، فقط endpointهای غیر LLM)؛ و
  اتصال `npm run homolog` + فایل `summary.md` آن به مرحله STOP #2 در `/generate-release`.
