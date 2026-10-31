# CLI Tools — Pusula (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/CLI-TOOLS.md) · 🇩🇪 [de](../../../de/docs/reference/CLI-TOOLS.md) · 🇹🇷 [tr](../../../tr/docs/reference/CLI-TOOLS.md)

---

آخرین بهروزرسانی: 2026-08-23

Pusula با سه دسته از ابزارهای CLI که در سه صفحه اختصاصی داشبورد قرار دارند، یکپارچه میشود:

| صفحه           | مسیر                    | مفهوم                                                                                   | تعداد             |
| -------------- | ----------------------- | --------------------------------------------------------------------------------------- | ----------------- |
| **CLI Code's** | `/dashboard/cli-code`   | ابزارهای کدنویسی که به Pusula متصل میکنید (Client → CLI → Pusula → Provider)            | 26                |
| **CLI Agents** | `/dashboard/cli-agents` | عاملهای خودمختاری که به Pusula متصل میکنید (همان جریان، با دامنه گستردهتر)              | 10                |
| **ACP Agents** | `/dashboard/acp-agents` | ابزارهای CLI که Pusula آنها را از طریق stdio/ACP بهعنوان بکاند اجرا میکند (جریان معکوس) | رجیستری را ببینید |

مسیرهای قدیمی از طریق 308 هدایت میشوند: `/dashboard/cli-tools` → `/dashboard/cli-code`، `/dashboard/agents` → `/dashboard/acp-agents`.

---

## نحوه کار

```
CLI Code's / CLI Agents (جریان مصرف):
Claude / Codex / OpenCode / Cline / KiloCode / Continue / Hermes Agent / Goose / ...
           │
           ▼  (همگی به Pusula متصل میشوند)
    http://YOUR_SERVER:20128/v1
           │
           ▼  (Pusula درخواست را به ارائهدهنده مناسب هدایت میکند)
    Anthropic / OpenAI / Gemini / DeepSeek / Groq / Mistral / ...

ACP Agents (جریان اجرای معکوس):
    درخواست Client → Pusula → اجرای CLI از طریق stdio/ACP → پاسخ
```

**مزایا:**

- یک کلید API برای مدیریت همه ابزارها
- ردیابی هزینه همه CLIها در داشبورد
- تغییر مدل بدون پیکربندی مجدد تکتک ابزارها
- قابل استفاده بهصورت محلی و روی سرورهای راه دور (VPS، Docker، Akamai، Cloudflare Tunnel)

---

## پیکربندی خودکار با `setup-*`

لازم نیست پیکربندی هر ابزار را بهصورت دستی بنویسید. Pusula برای هر CLI پشتیبانیشده یک فرمان `setup-*` ارائه میکند که کاتالوگ **زنده** مدلها را از یک Pusula در حال اجرا (محلی یا راهدور) میخواند و پیکربندی خود ابزار را روی دستگاه شما مینویسد:

```bash
pusula setup-codex        pusula setup-claude       pusula setup-opencode
pusula setup-cline        pusula setup-kilo         pusula setup-continue
pusula setup-cursor       pusula setup-roo          pusula setup-crush
pusula setup-goose        pusula setup-qwen         pusula setup-aider
pusula setup-5dive        pusula setup-zed
```

هرکدام از آنها گزینههای `--remote <url> --api-key <key>` (برای پیکربندی یک ابزار محلی جهت استفاده از Pusula راهدور)، `--dry-run` (پیشنمایش بدون نوشتن) و `--port` را میپذیرند. ابزارهایی که قابلیت کشف خودکار مدل را ندارند (Cline، Kilo، Roo، Goose، Aider، Qwen، 5dive)، گزینه `--model <id>` را دریافت میکنند (و برای اجراهای غیرتعاملی نیز `--yes`). `setup-5dive` تنها روشی است که چیزی را زیر `$HOME` نمینویسد: این فرمان با نوشتن یک پروفایل احراز هویت متعلق به root روی میزبان ناوگان، مجموعهای از عاملهای 5dive را پیکربندی میکند؛ بنابراین از طریق `sudo` خود را دوباره اجرا میکند و حالت راهدور مستقلی ندارد. برای اجرای یک CLI با متغیرهای محیطی صحیح و بدون نوشتن هیچگونه پیکربندی، از راهانداز عمومی `pusula run <target>` استفاده کنید (claude، codex، aider، goose، opencode، qwen، gemini — مقصدها و نامهای مستعار از `bin/cli/cli-manifest.mjs` میآیند)؛ راهاندازهای قدیمی مختص هر ابزار، یعنی `pusula launch` (Claude Code) و `pusula launch-codex` (Codex)، همچنان در دسترس هستند. Gemini CLI فقط قابلیت راهاندازی دارد: یک مقصد برای `pusula run` است، اما هیچ دستور `setup-*`/`configure` ندارد.

> **مرجع کامل:** جدول اصلی — شامل اینکه هر فرمان چه چیزی مینویسد، تمام گزینهها، حالت محلی در برابر راهدور، و اینکه کدام ابزارها به پسوند `/v1` نیاز دارند — در
> **[یکپارچهسازیهای CLI](../guides/CLI-INTEGRATIONS.md)** قرار دارد.

### اجرای این فرمانها درون کانتینر

فرمان `setup-*` که درون کانتینر Pusula اجرا شود، در دایرکتوری خانگی خود کانتینر مینویسد؛ مسیری که هیچ CLI روی میزبان آن را نمیخواند و با حذف کانتینر نیز از بین میرود. Pusula این وضعیت را تشخیص میدهد و بهجای نوشتن، همراه با دستورالعملها با کد `2` خارج میشود. دو راهکار پشتیبانیشده وجود دارد — CLI را روی میزبان نصب کنید و با `pusula connect` به کانتینر متصل شوید، یا دایرکتوریهای پیکربندی را بهصورت bind-mount متصل کرده و `CLI_CONFIG_HOME` را تنظیم کنید (پروفایل `host` در compose). تمام فرمانهای `setup-*`، بههمراه `pusula configure` و `pusula config set`، گزینه `--allow-container-write` را میپذیرند تا در صورتی که واقعاً قصدتان پیکربندی CLIهای خود کانتینر است، امکان نوشتن فراهم شود؛ `PUSULA_ALLOW_CONTAINER_CONFIG_WRITE=true` نیز همین کار را برای سرور انجام میدهد. رجوع کنید به
[راهنمای Docker ← پیکربندی ابزارهای CLI میزبان](../guides/DOCKER_GUIDE.md#configuring-host-cli-tools-when-pusula-runs-in-docker).

**نقطه پایانی اعمال** داشبورد (`POST /api/cli-tools/apply`) نیز همین محدودیت را اعمال میکند: در یک کانتینر، اگر مقصد نوشتن از میزبان بهصورت bind-mount متصل نشده باشد، پاسخ **`422`** با `containerEphemeralTarget: true`، متن خطای ایمن و — برای ابزارهایی که دستورالعمل میزبان دارند (claude، codex، opencode، cline، kilo، continue) — یک `hostSetupCommand` (برای مثال `pusula setup-opencode`) ارائه میشود تا بهجای آن روی میزبان اجرا شود؛ هیچچیزی نوشته نمیشود. `dryRun: true` در حالت کانتینر همچنان کار میکند و بدون دستزدن به دیسک، یک پیشنمایش پاکسازیشده + مسیر مقصد را بازمیگرداند. محتوای پیشنمایش یک پیکربندی حاوی اطلاعات اعتبارسنجی برای کپی یا واردکردن نیست. عملیات اعمال را با ورودیهای اصلی ابزار/نشانی پایه/API key/مدل روی میزبان انجام دهید، یا از فرمان راهاندازی سمت میزبان که مشخص شده است استفاده کنید. برای سربرگ پیشنمایش و قرارداد درخواست، به [امنیت پیکربندی CLI](../security/CLI-CONFIGURATION.md) مراجعه کنید. این رفتار عمدی است و با آزمون
`tests/unit/api/cli-tools/apply-container-guard.test.ts` در برابر پسرفت محافظت میشود — هرگز با حذف این محدودیت، خطای 422 را «رفع» نکنید.

---

## منبع حقیقت

کاتالوگ یکپارچه در `src/shared/constants/cliTools.ts` و بهصورت `CLI_TOOLS: Record<string, CliCatalogEntry>` قرار دارد.

هر ورودی دارای فیلدهای زیر است (که در `src/shared/schemas/cliCatalog.ts` تعریف شدهاند):

| فیلد                                            | نوع                                                          | توضیحات                                                               |
| ----------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| `category`                                      | `"code" \| "agent"`                                          | ابزار در کدام صفحه نمایش داده میشود                                   |
| `vendor`                                        | `string`                                                     | منشأ ابزار ("Anthropic"، "OSS (P. Gauthier)")                         |
| `acpSpawnable`                                  | `boolean`                                                    | آیا بهعنوان یک ACP Agent نیز قابل استفاده است (نشان نمایش داده میشود) |
| `baseUrlSupport`                                | `"full" \| "partial" \| "none"`                              | سطح پشتیبانی از نقطه پایانی سفارشی. `"none"` = فهرست انتظار MITM      |
| `configType`                                    | `"env" \| "custom" \| "guide" \| "custom-builder" \| "mitm"` | سازوکار پیکربندی                                                      |
| `id`, `name`, `color`, `description`, `docsUrl` | استاندارد                                                    | فیلدهای اصلی نمایش                                                    |

ورودیهای دارای `baseUrlSupport: "none"` در صفحات داشبورد **نمایش داده نمیشوند** — آنها برای طرح 11 در فهرست انتظار MITM ثبت شدهاند (به `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` مراجعه کنید).

### سطوح قابلیت (کاتالوگشده × قابلشناسایی × قابلپیکربندی × قابلاجرا)

هر ابزار کاتالوگشده لزوماً قابلشناسایی، قابلپیکربندی یا قابلاجرا نیست. هر سطح یک
منبع تعریفکننده دارد و یک آزمون انحراف، همراستایی آنها را حفظ میکند:

| سطح              | معنا                                                                           | محل تعریف                                                            |
| ---------------- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| **کاتالوگشده**   | در کاتالوگ داشبورد ظاهر میشود (نام، ارائهدهنده، مستندات، نوع پیکربندی)         | `src/shared/constants/cliTools.ts` (`CLI_TOOLS`)                     |
| **قابلشناسایی**  | شناسایی فایل اجرایی/پیکربندی، بررسیهای سلامت، مسیرهای پیکربندی                 | `src/shared/services/cliRuntime.ts` (کاتالوگ زمان اجرای `CLI_TOOLS`) |
| **قابلپیکربندی** | توسط `pusula configure <cli>` پشتیبانی میشود (دستورالعمل راهاندازی موجود است)  | `bin/cli/cli-manifest.mjs` (`configure: true`)                       |
| **قابلاجرا**     | توسط `pusula run <target>` پشتیبانی میشود (تزریق محیط/آرگومانها تعریف شده است) | `bin/cli/cli-manifest.mjs` (`run: true`)                             |

`bin/cli/cli-manifest.mjs` مانیفست اجرایی مرجع برای سطوح فرمان CLI است:
`run`، `configure` و مولدهای تکمیل خودکار پوسته، همگی فهرست اهداف، تفکیک نامهای مستعار
(برای مثال `kilocode`/`kilo-code`/`kilo_cli` → `kilo`) و سیمکشی پرچم `--model`
را از آن استخراج میکنند. محافظ انحراف
`tests/unit/cli/cli-manifest-drift.test.ts` بررسی میکند که مانیفست، کاتالوگ زمان اجرا،
کاتالوگ رابط کاربری و تمام سطوح مصرفکننده همگام باقی بمانند — اگر هدفی بدون افزودن
به سایر سطوح به یک سطح اضافه شود، مجموعه آزمون بهجای ایجاد انحراف خاموش با شکست مواجه میشود.

---

## 1. فهرست کدهای CLI ‏(27 ابزار)

تمام ابزارهایی که در `/dashboard/cli-code` نمایش داده میشوند. ابزارهایی که دارای `baseUrlSupport: none` هستند، بهجای URL پایهٔ سفارشی، از طریق MITM یا یک راهنمای دستی متصل میشوند:

| id           | name                    | vendor              | baseUrlSupport | configType     | acpSpawnable |
| ------------ | ----------------------- | ------------------- | -------------- | -------------- | ------------ |
| claude       | Claude Code             | Anthropic           | full           | env            | true         |
| codex        | OpenAI Codex CLI        | OpenAI              | full           | custom         | true         |
| zcode        | ZCode (GLM Coding Plan) | Z.ai                | none           | custom         | false        |
| cline        | Cline                   | OSS (ex-Claude Dev) | full           | custom         | true         |
| kilo         | Kilo Code               | Kilo-Org            | full           | custom         | false        |
| roo          | Roo Code                | Roo (OSS)           | full           | guide          | false        |
| continue     | Continue                | continue.dev        | full           | guide          | false        |
| aider        | Aider                   | OSS (P. Gauthier)   | full           | guide          | true         |
| forge        | ForgeCode               | Antinomy HQ         | full           | custom         | true         |
| jcode        | jcode                   | 1jehuang (OSS)      | full           | custom         | false        |
| deepseek-tui | DeepSeek TUI            | Hunter Bown (OSS)   | full           | custom         | false        |
| codewhale    | CodeWhale               | Hmbown (OSS)        | full           | custom         | false        |
| opencode     | OpenCode                | Anomaly (ex-SST)    | full           | guide          | true         |
| droid        | Factory Droid           | Factory AI          | partial        | guide          | false        |
| copilot      | GitHub Copilot CLI      | GitHub/MS           | full           | custom         | false        |
| cursor-cli   | Cursor CLI              | Anysphere           | partial        | guide          | true         |
| smelt        | Smelt                   | leonardcser (OSS)   | full           | custom         | false        |
| pi           | Pi (pi-coding-agent)    | M. Zechner (OSS)    | full           | custom         | false        |
| grok-build   | Grok Build              | xAI                 | full           | custom         | false        |
| crush        | Crush                   | OSS (Charm)         | full           | custom         | false        |
| qwen         | Qwen Code               | Alibaba             | full           | guide          | true         |
| zed          | Zed                     | Zed Industries      | full           | guide          | false        |
| cursor       | Cursor                  | Anysphere           | none           | guide          | false        |
| antigravity  | Antigravity             | Google              | none           | mitm           | false        |
| hermes       | Hermes                  | Nous Research       | none           | guide          | false        |
| kiro         | Kiro AI                 | Amazon              | none           | mitm           | false        |
| custom       | Custom CLI              | —                   | full           | custom-builder | false        |

ابزارهایی با `baseUrlSupport: "partial"` نشان «⚠ پشتیبانی جزئی از URL پایه» را در کارت داشبورد نمایش میدهند.
---

## ۲. فهرست عاملهای CLI (۱۰ ابزار)

عاملهای خودکاری که در `/dashboard/cli-agents` نمایش داده میشوند:

| id           | نام              | ارائهدهنده               | پشتیبانی از baseUrl | قابل اجرا توسط ACP |
| ------------ | ---------------- | ------------------------ | ------------------- | ------------------ |
| hermes-agent | Hermes Agent     | Nous Research            | full                | false              |
| openclaw     | OpenClaw         | متنباز (P. Steinberger)  | full                | true               |
| goose        | Goose            | Block / Linux Foundation | full                | true               |
| interpreter  | Open Interpreter | متنباز                   | full                | true               |
| warp         | Warp AI          | Warp Inc.                | partial             | true               |
| agent-deck   | Agent Deck       | asheshgoplani (متنباز)   | full                | false              |
| omp          | Oh My Pi         | متنباز                   | full                | true               |
| letta        | Letta CLI        | Letta                    | full                | false              |
| prime-agent  | Prime Agent      | Prime Intellect (متنباز) | full                | false              |
| 5dive        | 5dive            | متنباز (5dive-ai)        | full                | false              |

---

## 3. عاملهای ACP (/dashboard/acp-agents)

این صفحه (که نام آن از `/dashboard/agents` تغییر کرده است) رابطهای خط فرمانی را نمایش میدهد که Pusula میتواند آنها را از طریق پروتکل stdio/ACP بهعنوان موتورهای اجرای بکاند **راهاندازی** کند. این فهرست بهصورت جداگانه در `src/lib/acp/registry.ts` نگهداری میشود و با `CLI_TOOLS` **یکسان نیست**.

---

## 4. فهرست کارهای باقیمانده MITM (در داشبورد نمایش داده نمیشود)

رابطهای خط فرمان زیر بهصورت بومی از URL پایهٔ سفارشی پشتیبانی نمیکنند و در صفحات CLI Code یا CLI Agents **فهرست نشدهاند**. آنها گزینههایی برای رهگیری MITM در طرح ۱۱ هستند:

| CLI                 | دلیل                                                       |
| ------------------- | ---------------------------------------------------------- |
| windsurf            | BYOK محدود به مدلهای منتخب Claude بههمراه URL/توکن سازمانی |
| amp                 | اکوسیستم بسته (Sourcegraph)                                |
| amazon-q / kiro-cli | احراز هویت AWS SSO، بدون URL سفارشی                        |
| cowork              | Anthropic Desktop، بدون نقطهٔ پایانی قابل پیکربندی         |

برای ارجاع متقابل کامل، به `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` مراجعه کنید.

---

## 5. API تشخیص دستهای

تشخیص همهٔ ابزارها از طریق یک نقطهٔ پایانی واحد تجمیع میشود:

**`GET /api/cli-tools/all-statuses`**

- احراز هویت: `requireCliToolsAuth(request)` (همانند سایر مسیرهای `/api/cli-tools/`)
- خروجی: `Record<toolId, ToolBatchStatus>` (نوع: `src/shared/types/cliBatchStatus.ts`)
- راهبرد: اجرای `Promise.all` برای همهٔ ابزارها، با مهلت زمانی ۵ ثانیه برای هر ابزار
- حافظهٔ نهان: LRU درونحافظهای که با `mtime` فایل پیکربندی نمایهسازی میشود. با تغییر mtime، حافظهٔ نهان نامعتبر میشود. با راهاندازی مجدد سرور بازنشانی میشود.

ساختار پاسخ برای هر ابزار:

```ts
interface ToolBatchStatus {
  detection: {
    installed: boolean;
    runnable: boolean;
    version?: string;
    command?: string;
    commandPath?: string;
    reason?: string;
  };
  config: {
    status: "configured" | "not_configured" | "not_installed" | "unknown" | "other";
    endpoint?: string | null;
    lastConfiguredAt?: string | null;
  };
  error?: string; // پاکسازیشده، بدون ردپای پشته
}
```

---

## ۶. مدیریتکنندههای تنظیمات برای ابزارهای جدید

ابزارهای جدید با `configType: "custom"` دارای مسیرهای اختصاصی API برای تنظیمات هستند:

| مسیر                                        | ابزار                                                             |
| ------------------------------------------- | ----------------------------------------------------------------- |
| `POST /api/cli-tools/forge-settings`        | ForgeCode (.forge.toml)                                           |
| `POST /api/cli-tools/jcode-settings`        | jcode (فلگ --base-url)                                            |
| `POST /api/cli-tools/deepseek-tui-settings` | DeepSeek TUI (OPENAI_BASE_URL، قدیمی)                             |
| `POST /api/cli-tools/codewhale-settings`    | CodeWhale (OPENAI_BASE_URL، همگامسازی اصلی + قدیمی `~/.deepseek`) |
| `POST /api/cli-tools/smelt-settings`        | Smelt                                                             |
| `POST /api/cli-tools/pi-settings`           | عامل کدنویسی Pi                                                   |
| `POST /api/cli-tools/grok-build-settings`   | Grok Build (~/.grok/config.toml، `[model.pusula]`)                |
| `POST /api/cli-tools/qwen-settings`         | Qwen Code (`~/.qwen/settings.json` + کلید اختصاصی `.env`)         |

همه مسیرها برای پاسخهای خطا از `sanitizeErrorMessage()` استفاده میکنند (قانون سختگیرانه شماره ۱۲).

---

## ۷. معماری صفحات داشبورد

### CLI Code's (`/dashboard/cli-code`)

- `src/app/(dashboard)/dashboard/cli-code/page.tsx` — مؤلفه سرور
- `src/app/(dashboard)/dashboard/cli-code/CliCodePageClient.tsx` — شبکه سمت کلاینت
- `src/app/(dashboard)/dashboard/cli-code/[id]/page.tsx` — صفحه جزئیات ابزار
- `src/app/(dashboard)/dashboard/cli-code/components/` — ۱۲ کارت تخصصی ابزار + `ToolDetailClient.tsx`

### عاملهای CLI (`/dashboard/cli-agents`)

- `src/app/(dashboard)/dashboard/cli-agents/page.tsx` — مؤلفه سرور
- `src/app/(dashboard)/dashboard/cli-agents/CliAgentsPageClient.tsx` — شبکه سمت کلاینت
- `src/app/(dashboard)/dashboard/cli-agents/[id]/page.tsx` — از `ToolDetailClient` مجدداً استفاده میکند

### عاملهای ACP (`/dashboard/acp-agents`)

- `src/app/(dashboard)/dashboard/acp-agents/page.tsx` — مؤلفه سرور (از `agents/` منتقل شده است)

### مؤلفههای رابط کاربری مشترک (`src/shared/components/cli/`)

| فایل                    | هدف                                                |
| ----------------------- | -------------------------------------------------- |
| `CliToolCard.tsx`       | کارت هوشمند وضعیت (تشخیص + پیکربندی + نقطه پایانی) |
| `CliConceptCard.tsx`    | کارت توضیح مفهوم برای هر صفحه                      |
| `CliComparisonCard.tsx` | مقایسه سهستونه میان انواع CLI                      |
| `BaseUrlSelect.tsx`     | فهرست کشویی نقطه پایانی (محلی/ابری/سفارشی)         |
| `ApiKeySelect.tsx`      | انتخابگر کلید API                                  |
| `ManualConfigModal.tsx` | پنجره محاورهای قطعه پیکربندی قابل کپی              |

### هوک مشترک (`src/shared/hooks/cli/`)

| فایل                      | هدف                                                                             |
| ------------------------- | ------------------------------------------------------------------------------- |
| `useToolBatchStatuses.ts` | `/api/cli-tools/all-statuses` را دریافت و وضعیت بارگذاری/نوسازی را مدیریت میکند |

---

## 8. بینالمللیسازی

فضاهای نام جدید اضافهشده در طرح 14 F9:

| فضای نام    | هدف                                                                          |
| ----------- | ---------------------------------------------------------------------------- |
| `cliCommon` | رشتههای مشترک (برچسبهای کارت، متنهای مفهومی/مقایسهای، برچسبهای صفحهٔ جزئیات) |
| `cliCode`   | رشتههای صفحهٔ CLI Code                                                       |
| `cliAgents` | رشتههای صفحهٔ CLI Agents                                                     |
| `acpAgents` | رشتههای صفحهٔ ACP Agents                                                     |

ترجمههای کامل PT-BR و EN ارائه شدهاند. 39 زبان دیگر از طریق ادغام در سطح فضای نام در `src/i18n/request.ts` بهطور خودکار از EN استفاده میکنند.

---

## 9. شروع سریع

### مرحلهٔ 1 — دریافت کلید API از Pusula

1. `/dashboard/api-manager` را باز کنید ← **ایجاد کلید API**
2. نامی برای آن تعیین کنید (برای مثال `cli-tools`) و همهٔ مجوزها را انتخاب کنید
3. کلید را کپی کنید — برای تمام CLIهای زیر به آن نیاز خواهید داشت

> کلید شما به این شکل است: `sk-xxxxxxxxxxxxxxxx-xxxxxxxxx`

---

### مرحلهٔ 2 — نصب ابزارهای CLI

همهٔ ابزارهای مبتنی بر npm به Node.js 22.22.2+ یا 24.x نیاز دارند:

```bash
# Claude Code (Anthropic)
npm install -g @anthropic-ai/claude-code

# OpenAI Codex
npm install -g @openai/codex

# OpenCode
npm install -g opencode-ai

# Cline
npm install -g cline

# KiloCode
npm install -g kilocode

# Qwen Code
npm install -g @qwen-code/qwen-code

# Google Gemini CLI (قابل اجرا از طریق `pusula run gemini` ← سطح /v1beta)
npm install -g @google/gemini-cli

# Aider
pip install aider-chat

# Smelt
cargo install smelt  # مبتنی بر Rust

# عامل کدنویسی Pi
# برای نصب، https://github.com/zechnerj/pi-coding-agent را ببینید

# jcode
# برای نصب، https://github.com/1jehuang/jcode را ببینید
```

---

### مرحلهٔ 3 — پیکربندی از طریق داشبورد

1. به `http://localhost:20128/dashboard/cli-code` بروید
2. ابزار خود را در شبکه پیدا کنید
3. روی کارت کلیک کنید تا صفحهٔ جزئیات ابزار باز شود
4. کلید API و URL پایهٔ خود را انتخاب کنید
5. روی **اعمال پیکربندی** کلیک کنید یا قطعهکد پیکربندی دستی را کپی کنید

---

### مرحلهٔ 4 — تنظیم متغیرهای محیطی سراسری

```bash
# نقطهٔ پایانی همگانی Pusula
export OPENAI_BASE_URL="http://localhost:20128/v1"
export OPENAI_API_KEY="sk-your-pusula-key"
export ANTHROPIC_BASE_URL="http://localhost:20128"
export ANTHROPIC_AUTH_TOKEN="sk-your-pusula-key"
# Gemini CLI مقدار GOOGLE_GEMINI_BASE_URL را در ریشه میخواند (SDK آن خودش /v1beta/... را اضافه میکند)
export GOOGLE_GEMINI_BASE_URL="http://localhost:20128"
export GEMINI_API_KEY="sk-your-pusula-key"
```

> برای یک **سرور راه دور**، `localhost:20128` را با IP یا دامنهٔ سرور جایگزین کنید،
> برای مثال `http://<your-server-ip>:20128`.

---

### مرحلهٔ 4 — پیکربندی هر ابزار

#### Claude Code

```bash
# ایجاد ~/.claude/settings.json:
mkdir -p ~/.claude && cat > ~/.claude/settings.json << EOF
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:20128",
    "ANTHROPIC_AUTH_TOKEN": "sk-your-pusula-key"
  }
}
EOF
```

برای Claude Code از ریشهٔ یکپارچهٔ درگاه Anthropic استفاده کنید. در اینجا `/v1` را اضافه نکنید.

**آزمایش:** `claude "say hello"`

---

#### OpenAI Codex

Codex مدرن (v0.137+) فقط `~/.codex/config.toml` را میخواند — فایل قدیمی
`config.yaml` متعلق به CLI قدیمی npm است و بدون نمایش هیچ پیامی نادیده گرفته میشود. کلید API
در متغیر محیطی `PUSULA_API_KEY` (`env_key`) باقی میماند و هرگز
داخل فایل قرار نمیگیرد:

```bash
mkdir -p ~/.codex && cat > ~/.codex/config.toml << EOF
model_provider = "pusula"

[model_providers.pusula]
name                 = "Pusula"
base_url             = "http://localhost:20128/v1"
env_key              = "PUSULA_API_KEY"
requires_openai_auth = false
EOF
export PUSULA_API_KEY="sk-your-pusula-key"
```

مرجع کامل (پروفایلها، `wire_api`، پنجرههای زمینه): [CODEX-CLI-CONFIGURATION.md](../guides/CODEX-CLI-CONFIGURATION.md).

**آزمایش:** `codex "what is 2+2?"`

---

#### OpenCode

```bash
mkdir -p ~/.config/opencode && cat > ~/.config/opencode/opencode.json << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "provider": {
    "pusula": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "Pusula",
      "options": {
        "baseURL": "http://localhost:20128/v1",
        "apiKey": "sk-your-pusula-key"
      },
      "models": {
        "claude-sonnet-4-5": { "name": "claude-sonnet-4-5" },
        "claude-sonnet-4-5-thinking": { "name": "claude-sonnet-4-5-thinking" },
        "gemini-3-flash": { "name": "gemini-3-flash" }
      }
    }
  }
}
EOF
```

**آزمایش:** `opencode`

> برای ارسال گونههای دارای قابلیت تفکر، از
> `opencode run "your prompt" --model pusula/claude-sonnet-4-5-thinking --variant high`
> استفاده کنید.

---

#### Cline (CLI یا VS Code)

**حالت CLI:**

```bash
mkdir -p ~/.cline/data && cat > ~/.cline/data/globalState.json << EOF
{
  "apiProvider": "openai",
  "openAiBaseUrl": "http://localhost:20128/v1",
  "openAiApiKey": "sk-your-pusula-key"
}
EOF
```

**حالت VS Code:**
تنظیمات افزونهٔ Cline ← ارائهدهندهٔ API: `OpenAI Compatible` ← URL پایه: `http://localhost:20128/v1`

یا از داشبورد Pusula ← **ابزارهای CLI ← Cline ← اعمال پیکربندی** استفاده کنید.

---

#### KiloCode (CLI یا VS Code)

**حالت CLI:**

```bash
kilocode --api-base http://localhost:20128/v1 --api-key sk-your-pusula-key
```

**تنظیمات VS Code:**

```json
{
  "kilo-code.openAiBaseUrl": "http://localhost:20128/v1",
  "kilo-code.apiKey": "sk-your-pusula-key"
}
```

یا از داشبورد Pusula ← **ابزارهای CLI ← KiloCode ← اعمال پیکربندی** استفاده کنید.

---

#### Continue (افزونهٔ VS Code)

فایل `~/.continue/config.yaml` را ویرایش کنید:

```yaml
models:
  - name: Pusula
    provider: openai
    model: auto
    apiBase: http://localhost:20128/v1
    apiKey: sk-your-pusula-key
    default: true
```

پس از ویرایش، VS Code را مجدداً راهاندازی کنید.

---

#### VS Code Insiders (`chatLanguageModels.json`)

زمانی از این روش استفاده کنید که VS Code Insiders برای مدلهای دارای نقطهٔ پایانی سفارشی پیکربندی شده است و میخواهید Pusula بدون فیلد هدر سفارشی کار کند.

**محل پیشنهادی:**

- Linux: `~/.config/Code - Insiders/User/chatLanguageModels.json`
- Windows: `%APPDATA%/Code - Insiders/User/chatLanguageModels.json`

**مثال با استفاده از نام مستعار توکنیشدهٔ Pusula:**

```json
[
  {
    "vendor": "customendpoint",
    "id": "auto",
    "name": "Pusula Auto",
    "family": "gpt-4",
    "version": "1.0.0",
    "url": "http://localhost:20128/api/v1/vscode/sk-your-pusula-key/chat/completions",
    "modelsUrl": "http://localhost:20128/api/v1/vscode/sk-your-pusula-key/models",
    "requestFormat": "openai-chat-completions",
    "contextWindow": 256000,
    "maxOutputTokens": 32768,
    "auth": {
      "type": "none"
    }
  }
]
```

**نکات:**

- `sk-your-pusula-key` را با یک کلید API ساختهشده در Pusula جایگزین کنید.
- فیلد `url` باید به `/api/v1/vscode/{token}/chat/completions` اشاره کند.
- فیلد `modelsUrl` باید به `/api/v1/vscode/{token}/models` اشاره کند.
- هنگامی که کلاینت از هدرهای سفارشی پشتیبانی میکند، جریان معمول `/v1` بههمراه هدر Bearer را ترجیح دهید.
- توکنهای تعبیهشده در URL یک راهکار سازگاری جایگزین هستند و ممکن است در گزارشهای ویرایشگر یا سابقهٔ پروکسی ظاهر شوند.

---

#### Kiro CLI (Amazon)

```bash
# به حساب AWS/Kiro خود وارد شوید:
kiro-cli login

# CLI از احراز هویت خودش استفاده میکند — خود Kiro CLI به Pusula بهعنوان بکاند نیاز ندارد.
# برای ابزارهای دیگر، از kiro-cli در کنار Pusula استفاده کنید.
kiro-cli status
```

برای برنامهٔ دسکتاپ **Kiro IDE**، از نقطهٔ پایانی MITM ارائهشده توسط Pusula
در مسیر `/dashboard/cli-tools → Kiro` استفاده کنید.

---

## 10. رابط خط فرمان داخلی Pusula

فایل اجرایی `pusula` فرمانهایی را برای چرخهٔ عمر سرور، راهاندازی، عیبیابی و مدیریت ارائهدهندگان فراهم میکند. نقطهٔ ورود: `bin/pusula.mjs`.

```bash
pusula                              # راهاندازی سرور (پورت پیشفرض 20128)
pusula setup                        # راهنمای تعاملی راهاندازی
pusula doctor                       # بررسی پیکربندی، پایگاه داده، پورتها و محیط اجرا
pusula providers list               # اتصالهای پیکربندیشدهٔ ارائهدهندگان
pusula providers test-all           # آزمایش همهٔ اتصالهای فعال
pusula reset-password               # بازنشانی گذرواژهٔ مدیر
pusula logs                         # پخش زندهٔ گزارشهای درخواست
pusula health                       # وضعیت سلامت با جزئیات (قطعکنندهها، حافظهٔ نهان، حافظه)
pusula --version                    # نمایش نسخه
pusula --help                       # نمایش همهٔ فرمانها
```

### راهاندازی و مقداردهی اولیه

```bash
pusula setup                        # راهنمای تعاملی راهاندازی
pusula setup --non-interactive      # حالت CI/خودکارسازی (خواندن متغیرهای محیطی + پرچمها)
pusula setup --password '<value>'   # تنظیم مستقیم گذرواژهٔ مدیر
pusula setup --add-provider \
  --provider openai \
  --api-key '<value>' \
  --test-provider                      # افزودن و آزمایش یک ارائهدهنده در یک مرحله
```

متغیرهای محیطی شناختهشده برای راهاندازی غیرتعاملی:

| متغیر            | کاربرد                                                                   |
| ---------------- | ------------------------------------------------------------------------ |
| `PUSULA_API_KEY` | کلید API ارائهدهنده (از طریق Commander `.env()` به `--api-key` متصل است) |
| `DATA_DIR`       | بازنویسی پوشهٔ دادهٔ Pusula                                              |

سایر ورودیهای غیرتعاملی بهصورت پرچم ارسال میشوند، نه متغیر محیطی:
`--password`، `--provider`، `--provider-name`، `--provider-base-url`، `--default-model`
(گزینههای `pusula setup` در بالا را ببینید).

### عیبیابی

```bash
pusula doctor                       # بررسی پیکربندی، پایگاه داده، پورتها، محیط اجرا، حافظه و زندهبودن
pusula doctor --json                # JSON قابلخواندن توسط ماشین
pusula doctor --no-liveness         # رد کردن کاوش سلامت HTTP
pusula doctor --host 0.0.0.0        # بازنویسی میزبان بررسی زندهبودن
pusula doctor --liveness-url <url>  # بازنویسی کامل URL نقطهٔ پایانی سلامت
```

فرمان doctor این بررسیها را اجرا میکند: `Config`، `Database`، `Storage/encryption`،
`Port availability`، `Node runtime`، `Native binary` (better-sqlite3)،
`Memory` و `Server liveness`. اگر نتیجهٔ هر بررسی `fail` باشد، با کد خروج غیرصفر خاتمه مییابد.

### مدیریت ارائهدهندگان

```bash
pusula providers available                       # کاتالوگ ارائهدهندگان Pusula
pusula providers available --search openai       # فیلتر کاتالوگ براساس شناسه/نام/نام مستعار/دستهبندی
pusula providers available --category api-key    # فیلتر براساس دستهبندی (api-key، oauth، free، ...)
pusula providers available --json                # JSON قابلخواندن توسط ماشین

pusula providers list                            # اتصالهای پیکربندیشدهٔ ارائهدهندگان
pusula providers list --json

pusula providers test <id|name>                  # آزمایش یک اتصال پیکربندیشده
pusula providers test-all                        # آزمایش همهٔ اتصالهای فعال
pusula providers validate                        # اعتبارسنجی ساختاری صرفاً محلی
pusula providers add <provider> --credential-env PROVIDER_KEY
pusula providers import ./providers.json --dry-run --json
pusula providers auth <provider>                 # جریان OAuth موجود
pusula providers edit <id|name> --default-model <model>
pusula providers remove <id|name> --yes
```

فرمانهای `providers add/import/auth/edit/remove` در وهلهٔ اول مبتنی بر API هستند و بنابراین روی
زمینهٔ فعال محلی یا راهدور کار میکنند. برای ورود اطلاعات اعتبارنامه باید از
`--credential-stdin` یا `--credential-env` استفاده شود؛ `--dry-run --json` فقط
وجود/ساختار سانسورشده را گزارش میکند. `providers available` کاتالوگ Pusula را میخواند؛
`providers list/test/test-all/validate` رفتار محلی SQLite خود را حفظ میکنند و
به در حال اجرا بودن سرور نیازی ندارند.

برای یک گره سفارشی سازگار با OpenAI یا Anthropic، با استفاده از `pusula keys add "$NODE_ID" --stdin`
اعتبارنامهها را به شناسهٔ گره بازگرداندهشده توسط `pusula nodes add` متصل کنید.
این کار به یک سرور در حال اجرا و احراز هویت مدیریتی برای زمینهٔ فعال نیاز دارد.
رابط خط فرمان از `POST /api/providers` استفاده میکند که گره را اعتبارسنجی کرده و تنظیمات نقطهٔ پایانی آن را
در اتصال کپی میکند. نبود گره، شکست مجوزدهی یا در دسترس نبودن سرور
بدون ایجاد اعتبارنامهٔ جایگزین محلی، خطا برمیگرداند.

`nodes add --base-url` نقطهٔ پایانی گره را تنظیم میکند؛ این مقدار با نشانی سرور
در `PUSULA_BASE_URL` متفاوت است. برای فایلهای OpenAPI، از
`pusula openapi dump --format json --out ./openapi.json` استفاده کنید؛ گزینهٔ سراسری `--output`
قالببندی نمایش رابط خط فرمان را انتخاب میکند، نه نام فایل مقصد را.

### بازیابی و بازنشانی

```bash
pusula reset-password                # بازنشانی گذرواژهٔ مدیر (همچنین: pusula-reset-password)
pusula reset-encrypted-columns       # نمایش هشدار + اجرای آزمایشی برای بازنشانی اعتبارنامههای رمزگذاریشده
pusula reset-encrypted-columns --force  # تهی کردن واقعی اعتبارنامههای رمزگذاریشده در SQLite
```

### صدور اعتبارنامهها (⚠ با احتیاط انجام دهید)

```bash
pusula auth export                                 # نمایش هشدار + مرحلهٔ تأیید — بدون دسترسی به پایگاه داده
pusula auth export --force                          # صدور اعتبارنامههای رمزگشاییشدهٔ همهٔ اتصالها به stdout بهصورت JSON
pusula auth export --force --id <id>                 # صدور فقط اتصال منطبق
pusula auth export --force --format env               # تولید خطوط PUSULA_<PROVIDER>_<FIELD>=<value>
pusula auth export --force --out creds.json           # نوشتن در فایل (ایجادشده با مجوزهای 0600)
```

`auth export` **فقط بهصورت محلی** عمل میکند (خواندن مستقیم SQLite، بدون مسیر HTTP) و عمداً مقادیر
**متن ساده**ی `apiKey`/`accessToken`/`refreshToken`/`idToken` را چاپ میکند یا مینویسد — این یک قابلیت است، نه
یک باگ. بدون `--force`، هیچچیز از پایگاه داده خوانده و هیچچیز رمزگشایی نمیشود. پیش از انتشار هرگونه متن ساده، همیشه
یک بنر هشدار در stderr چاپ میشود. لازم است `STORAGE_ENCRYPTION_KEY`
تنظیم شده باشد. فیلدی که رمزگشایی آن ناموفق باشد (کلید قدیمی، متن رمزنگاریشدهی خراب)، بهجای لغو کل فرایند برونبری یا افشای خطای زیربنایی، بهصورت
`<field>DecryptFailed: true` گزارش میشود.

### زیرفرمانهای دیگر

این موارد، مگر آنکه خلافش ذکر شده باشد، وجود یک سرور Pusula در حال اجرا را فرض میکنند:

```bash
pusula status                       # وضعیت جامع زمان اجرا
pusula logs                         # پخش جریانی گزارشهای درخواست (--json، --search، --follow)
pusula config list                  # نمایش ابزارهای CLI پیکربندیشده

pusula provider list                # فهرست ارائهدهندگان موجود (نام مستعار providers list)
pusula provider add                 # ثبت Pusula بهعنوان ارائهدهنده در یک ابزار
pusula keys add | list | remove     # مدیریت کلیدهای API
pusula models [provider]            # فهرست مدلها (--json، --search)
pusula combo list | switch | create | delete

pusula backup                       # تهیه تصویر لحظهای از پیکربندی + DB
pusula restore                      # بازیابی از یک تصویر لحظهای قبلی

pusula health                       # جزئیات سلامت (قطعکنندهها، حافظه نهان، حافظه)
pusula quota                        # میزان استفاده از سهمیه ارائهدهنده
pusula cache                        # وضعیت حافظه نهان
pusula cache clear                  # پاککردن حافظههای نهان معنایی + امضا

pusula mcp status | restart         # وضعیت / راهاندازی مجدد سرور MCP
pusula a2a status | card            # وضعیت سرور A2A / کارت عامل

pusula tunnel list | create | stop  # مدیریت تونلها (cloudflare/tailscale/ngrok)
pusula env show | get <k> | set <k> <v>  # بررسی / تنظیم متغیرهای محیطی (موقت)

pusula test                         # آزمون سریع اتصال ارائهدهنده
pusula update                       # بررسی بهروزرسانیها
pusula completion                   # تولید تکمیل خودکار پوسته
```

### پرچمهای رایج

| پرچم                | توضیحات                                                     |
| ------------------- | ----------------------------------------------------------- |
| `--no-open`         | مرورگر هنگام شروع بهطور خودکار باز نشود                     |
| `--port <n>`        | بازنویسی پورت API (پیشفرض 20128)                            |
| `--mcp`             | اجرا بهعنوان سرور MCP از طریق stdio (برای IDEها)            |
| `--non-interactive` | حالت CI (بدون درخواست تعاملی؛ خواندن از محیط/پرچمها)        |
| `--json`            | خروجی JSON قابلخواندن توسط ماشین (doctor، providers و غیره) |
| `--help`, `-h`      | نمایش راهنمای مختص فرمان                                    |
| `--version`, `-v`   | چاپ نسخه نصبشده                                             |

---

## نقاط پایانی API موجود

| نقطه پایانی                | توضیحات                         | کاربرد                                          |
| -------------------------- | ------------------------------- | ----------------------------------------------- |
| `/v1/chat/completions`     | چت استاندارد (همه ارائهدهندگان) | همه ابزارهای مدرن                               |
| `/v1/responses`            | API پاسخها (با قالب OpenAI)     | Codex، گردشکارهای عاملمحور                      |
| `/v1/completions`          | تکمیل متن قدیمی                 | ابزارهای قدیمیتر که از `prompt:` استفاده میکنند |
| `/v1/embeddings`           | تعبیهسازیهای متنی               | RAG، جستوجو                                     |
| `/v1/images/generations`   | تولید تصویر                     | GPT-Image، Flux و غیره                          |
| `/v1/audio/speech`         | تبدیل متن به گفتار              | ElevenLabs، OpenAI TTS                          |
| `/v1/audio/transcriptions` | تبدیل گفتار به متن              | Deepgram، AssemblyAI                            |

نمونههای آماده برای جایگذاری با URL توکندار Pusula:

```txt
نمونه توکن: sk-a3ab3c080beaee3a-69f4a4-070d71af

پایه استاندارد OpenAI: http://localhost:20128/v1
مدلهای VS Code: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/models
چت VS Code: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/chat/completions
پاسخهای VS Code: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/responses
برچسبهای Ollama: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/tags
چت Ollama: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/chat
```

---

## عیبیابی

| خطا                                                 | علت                                 | راهحل                                                      |
| --------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- |
| `Connection refused`                                | Pusula در حال اجرا نیست             | `pusula serve`                                             |
| `401 Unauthorized`                                  | کلید API اشتباه است                 | در `/dashboard/api-manager` بررسی کنید                     |
| `No combo configured`                               | هیچ ترکیب مسیریابی فعالی وجود ندارد | در `/dashboard/combos` تنظیم کنید                          |
| CLI عبارت «نصب نشده» را نشان میدهد                  | فایل اجرایی در PATH نیست            | `which <command>` را بررسی کنید                            |
| داشبورد پس از نصب عبارت «شناسایی نشد» را نشان میدهد | حافظه نهان قدیمی است                | در داشبورد روی «⟳ تازهسازی شناسایی» کلیک کنید              |
| پیوند قدیمی `/dashboard/cli-tools`                  | نشانک مربوط به پیش از v3.8.6        | بهصورت خودکار به `/dashboard/cli-code` هدایت میشود (308)   |
| پیوند قدیمی `/dashboard/agents`                     | نشانک مربوط به پیش از v3.8.6        | بهصورت خودکار به `/dashboard/acp-agents` هدایت میشود (308) |

## مدیریت خطمشی کلید استنتاج با CLI مربوط به Pusula

برای بررسی یا بهروزرسانی یک کلید استنتاج موجود با استفاده از شناسه آن، از یک زمینه مدیریتی احراز هویتشده استفاده کنید ([حالت راه دور](../guides/REMOTE-MODE.md) را ببینید):

```bash
pusula --output json keys policy show KEY_ID
pusula keys policy set KEY_ID --unrestricted
pusula --output json keys policy show KEY_ID
```

`--unrestricted` نام مستعاری برای `--model-access-mode all` است. این بهروزرسانی فهرست مجاز مدلها را پاک میکند. دامنهها، قوانین اتصال، مدلهای مسدودشده، محدودیتهای نرخ و محدودیتهای هزینه حفظ میشوند؛ بنابراین این کنترلهای دیگر همچنان میتوانند یک درخواست را رد کنند. تعیین صریح `--allowed-models ""` نیز حالت `all` را انتخاب میکند؛ آن را با `--model-access-mode restricted` ترکیب کنید تا کلید محدودشدهای بدون هیچ مدل مجازی حفظ شود. یک فهرست غیرخالی جداشده با ویرگول، مگر اینکه صراحتاً خلاف آن مشخص شود، حالت `restricted` را انتخاب میکند. ترکیب متناقض `all` با یک فهرست مجاز غیرخالی، پیش از ارسال درخواست رد میشود.

`--rate-limit 30` تعداد درخواست در دقیقه را تنظیم میکند و قوانین سایر بازههای زمانی را حفظ میکند. `--max-cost 5` سقف هزینه روزانه برحسب USD را بدون تغییر سقف هفتگی فعال میکند؛ `--max-cost 0` سقف روزانه را حذف کرده و وضعیت فعلی فعالسازی محدودیت مصرف و سقف هفتگی را حفظ میکند. فیلدهای خطمشی که مشخص نشدهاند بدون تغییر باقی میمانند. تغییرات نرخ ابتدا خطمشی فعلی را میخوانند؛ از ویرایش همزمان آرایه محدودیت نرخ یک کلید یکسان خودداری کنید.

فرمانهای خطمشی از `GET`/`PATCH /api/keys/{id}` احراز هویتشده استفاده میکنند و زمینه فعال و گزینه سراسری `--api-key` را رعایت میکنند. خروجی JSON فقط شامل فیلدهای خطمشی است و کلید ذخیرهشده یا نمایش پوشاندهشده آن را شامل نمیشود. یک اعتبارنامه صرفاً مخصوص استنتاج نمیتواند تغییرات مدیریتی را مجاز کند. خطای 401/403 مستلزم بررسی اعتبارنامه و زمینه مدیریتی است؛ این خطا نشاندهنده خرابی توکن محلی CLI یا salt نیست. برای قرارداد جداگانه احراز هویت محلی، [توکن CLI](../security/CLI_TOKEN.md) را ببینید.
