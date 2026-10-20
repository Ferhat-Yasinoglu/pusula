# CLI Tools — Pusula (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../reference/CLI-TOOLS.md) · 🇩🇪 [de](../../../de/docs/reference/CLI-TOOLS.md) · 🇹🇷 [tr](../../../tr/docs/reference/CLI-TOOLS.md)

---

آخرین بهروزرسانی: 2026-08-23

Pusula با سه دسته از ابزارهای CLI که در سه صفحهٔ اختصاصی داشبورد قرار دارند، یکپارچه میشود:

| صفحه           | مسیر                    | مفهوم                                                                                        | تعداد             |
| -------------- | ----------------------- | -------------------------------------------------------------------------------------------- | ----------------- |
| **CLI Code's** | `/dashboard/cli-code`   | ابزارهای کدنویسی که به Pusula متصل میکنید (Client → CLI → Pusula → Provider)           | 26                |
| **CLI Agents** | `/dashboard/cli-agents` | عاملهای خودمختاری که به Pusula متصل میکنید (همان جریان، با دامنهای گستردهتر)              | 10                |
| **ACP Agents** | `/dashboard/acp-agents` | ابزارهای CLI که Pusula آنها را از طریق stdio/ACP بهعنوان backend اجرا میکند (جریان معکوس) | رجیستری را ببینید |

مسیرهای قدیمی با کد 308 هدایت میشوند: `/dashboard/cli-tools` → `/dashboard/cli-code`، `/dashboard/agents` → `/dashboard/acp-agents`.

---

## نحوه کار

```
کدهای CLI / نمایندگان CLI (جریان مصرف):
Claude / Codex / OpenCode / Cline / KiloCode / Continue / Hermes Agent / Goose / ...
           │
           ▼  (همه به Pusula اشاره می‌کنند)
    http://YOUR_SERVER:20128/v1
           │
           ▼  (Pusula به ارائه‌دهنده صحیح هدایت می‌کند)
    Anthropic / OpenAI / Gemini / DeepSeek / Groq / Mistral / ...

نمایندگان ACP (جریان ایجاد معکوس):
    درخواست مشتری → Pusula → CLI را از طریق stdio/ACP ایجاد می‌کند → پاسخ
```

**مزایا:**

- یک کلید API برای مدیریت همه ابزارها
- ردیابی هزینه‌ها در تمام CLIها در داشبورد
- تغییر مدل بدون نیاز به پیکربندی مجدد هر ابزار
- کارکرد محلی و بر روی سرورهای از راه دور (VPS، Docker، Akamai، Cloudflare Tunnel)

---

## پیکربندی خودکار با `setup-*`

لازم نیست پیکربندی هر ابزار را به صورت دستی بنویسید. Pusula برای هر CLI پشتیبانی شده یک دستور `setup-*` ارائه میدهد که کاتالوگ مدل **زنده** را از یک Pusula در حال اجرا (محلی یا از راه دور) میخواند و پیکربندی خود ابزار را روی دستگاه شما مینویسد:

```bash
pusula setup-codex        pusula setup-claude       pusula setup-opencode
pusula setup-cline        pusula setup-kilo         pusula setup-continue
pusula setup-cursor       pusula setup-roo          pusula setup-crush
pusula setup-goose        pusula setup-qwen         pusula setup-aider
pusula setup-5dive
```

هر کدام `--remote <url> --api-key <key>` (پیکربندی یک ابزار محلی در برابر یک Pusula از راه دور)، `--dry-run` (پیشنمایش بدون نوشتن) و `--port` را میپذیرد. ابزارهایی که قابلیت کشف خودکار مدل را ندارند (Cline, Kilo, Roo, Goose, Aider, Qwen, 5dive) از `--model <id>` (و `--yes` برای اجرای غیرتعاملی) استفاده میکنند. `setup-5dive` تنها دستورالعملی است که در `$HOME` نمینویسد: این دستور با نوشتن یک پروفایل احراز هویت متعلق به روت روی هاست فلیت، یک فلیت عامل 5dive را پیکربندی میکند، بنابراین از طریق `sudo` مجدداً اجرا میشود و حالت از راه دور خاص خود را ندارد. برای راهاندازی یک CLI با تزریق محیط صحیح و بدون نوشتن هیچ پیکربندی، از راهانداز عمومی `pusula run <target>` استفاده کنید (claude, codex, aider, goose, opencode, qwen, gemini — اهداف و نامهای مستعار از `bin/cli/cli-manifest.mjs` میآیند)؛ راهاندازهای قدیمیتر برای هر ابزار `pusula launch` (Claude Code) و `pusula launch-codex` (Codex) همچنان در دسترس هستند. Gemini CLI فقط برای راهاندازی است: این یک هدف `pusula run` است اما دستورالعمل `setup-*`/`configure` ندارد.

> **مرجع کامل:** جدول اصلی — آنچه هر دستور مینویسد، هر پرچم، محلی در مقابل از راه دور، و کدام ابزارها به پسوند `/v1` نیاز دارند — در **[CLI Integrations](../guides/CLI-INTEGRATIONS.md)** قرار دارد.

### اجرای این موارد در داخل یک کانتینر

یک دستور `setup-*` که در داخل کانتینر Pusula اجرا میشود، در دایرکتوری خانگی خود کانتینر مینویسد، که هیچ CLI هاست آن را نمیخواند و با حذف کانتینر ناپدید میشود. Pusula این را تشخیص میدهد و به جای نوشتن، با کد `2` و دستورالعملها خارج میشود. دو راه حل پشتیبانی شده وجود دارد — CLI را روی هاست نصب کنید و با `pusula connect` به کانتینر متصل شوید، یا دایرکتوریهای پیکربندی را bind-mount کرده و `CLI_CONFIG_HOME` را تنظیم کنید (پروفایل `host` کامپوز). هر دستور `setup-*`، به علاوه `pusula configure` و `pusula config set`، پرچم `--allow-container-write` را میپذیرد، زمانی که منظور شما واقعاً پیکربندی CLIهای خود کانتینر است؛ `PUSULA_ALLOW_CONTAINER_CONFIG_WRITE=true` همین کار را برای سرور انجام میدهد. به [Docker Guide → Configuring host CLI tools](../guides/DOCKER_GUIDE.md#configuring-host-cli-tools-when-pusula-runs-in-docker) مراجعه کنید.

نقطه پایانی **apply** داشبورد (`POST /api/cli-tools/apply`) همان محافظ را اعمال میکند: در یک کانتینر، یک عملیات نوشتن که هدف آن از هاست bind-mount نشده باشد، با کد **`422`** و `containerEphemeralTarget: true`، متن خطای ایمن و — برای ابزارهایی با دستورالعمل هاست (claude, codex, opencode, cline, kilo, continue) — یک `hostSetupCommand` (مثلاً `pusula setup-opencode`) برای اجرا روی هاست به جای آن پاسخ میدهد؛ چیزی نوشته نمیشود. `dryRun: true` در حالت کانتینر به کار خود ادامه میدهد و یک پیشنمایش ویرایششده + مسیر هدف را بدون دست زدن به دیسک برمیگرداند. محتوای پیشنمایش یک پیکربندی حاوی اعتبارنامه برای کپی یا وارد کردن نیست. با ابزار اصلی/URL پایه/کلید API/ورودیهای مدل روی هاست اعمال کنید، یا از دستور راهاندازی سمت هاست که نشان داده شده است استفاده کنید. برای هدر پیشنمایش و قرارداد درخواست، به [CLI configuration security](../security/CLI-CONFIGURATION.md) مراجعه کنید. این رفتار عمدی است و توسط `tests/unit/api/cli-tools/apply-container-guard.test.ts` در برابر رگرسیون محافظت میشود — هرگز یک خطای 422 را با حذف محافظ "رفع" نکنید.

---

## منبع حقیقت

کاتالوگ یکپارچه در `src/shared/constants/cliTools.ts` به عنوان `CLI_TOOLS: Record<string, CliCatalogEntry>` وجود دارد.

هر ورودی دارای این فیلدها است (تعریف شده در `src/shared/schemas/cliCatalog.ts`):

| فیلد                                            | نوع                                                          | توضیحات                                                      |
| ----------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
| `category`                                      | `"code" \| "agent"`                                          | کدام صفحه ابزار را نمایش می‌دهد                              |
| `vendor`                                        | `string`                                                     | منبع ابزار ("Anthropic"، "OSS (P. Gauthier)")                |
| `acpSpawnable`                                  | `boolean`                                                    | همچنین به عنوان یک عامل ACP قابل استفاده است (نشان داده شده) |
| `baseUrlSupport`                                | `"full" \| "partial" \| "none"`                              | سطح پشتیبانی از نقطه پایانی سفارشی. `"none"` = MITM backlog  |
| `configType`                                    | `"env" \| "custom" \| "guide" \| "custom-builder" \| "mitm"` | مکانیزم پیکربندی                                             |
| `id`, `name`, `color`, `description`, `docsUrl` | استاندارد                                                    | فیلدهای اصلی نمایش                                           |

ورودی‌هایی با `baseUrlSupport: "none"` در صفحات داشبورد **نمایش داده نمی‌شوند** — آنها در MITM backlog برای طرح 11 ثبت شده‌اند (به `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` مراجعه کنید).

### سطوح قابلیت (کاتالوگ شده × قابل شناسایی × قابل پیکربندی × قابل راه‌اندازی)

هر ابزار کاتالوگ شده قابل شناسایی، قابل پیکربندی یا قابل راه‌اندازی نیست. هر سطح یک منبع اعلام کننده دارد و یک تست انحراف آنها را هم‌راستا نگه می‌دارد:

| سطح                 | معنی                                                                               | اعلام شده در                                                      |
| ------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **کاتالوگ شده**     | در کاتالوگ داشبورد ظاهر می‌شود (نام، فروشنده، مستندات، نوع پیکربندی)               | `src/shared/constants/cliTools.ts` (`CLI_TOOLS`)                  |
| **قابل شناسایی**    | شناسایی باینری/پیکربندی، بررسی سلامت، مسیرهای پیکربندی                             | `src/shared/services/cliRuntime.ts` (`CLI_TOOLS` runtime catalog) |
| **قابل پیکربندی**   | توسط `pusula configure <cli>` پشتیبانی می‌شود (دستورالعمل راه‌اندازی وجود دارد) | `bin/cli/cli-manifest.mjs` (`configure: true`)                    |
| **قابل راه‌اندازی** | توسط `pusula run <target>` پشتیبانی می‌شود (تزریق env/args تعریف شده)           | `bin/cli/cli-manifest.mjs` (`run: true`)                          |

`bin/cli/cli-manifest.mjs` مانفیست اجرایی رسمی برای دستورات CLI است: `run`، `configure` و تولیدکنندگان تکمیل شل همه لیست‌های هدف، حل نام مستعار (به عنوان مثال `kilocode`/`kilo-code`/`kilo_cli` → `kilo`) و اتصال پرچم `--model` را از آن استخراج می‌کنند. نگهبان انحراف
`tests/unit/cli/cli-manifest-drift.test.ts` تأیید می‌کند که مانفیست، کاتالوگ زمان اجرا، کاتالوگ UI و هر سطح مصرف‌کننده در همگام بمانند — هدفی که به یک سطح اضافه می‌شود بدون اینکه به دیگران اضافه شود، به جای انحراف بی‌صدا، آزمون را شکست می‌دهد.

## 1. کاتالوگ کد CLI (۲۶ ابزار)

تمام ابزارهایی که در `/dashboard/cli-code` ظاهر می‌شوند. آن‌هایی که `baseUrlSupport: none` دارند از طریق MITM یا یک راهنمای دستی به جای یک URL پایه سفارشی متصل شده‌اند:

| id           | name                     | vendor                      | baseUrlSupport | configType     | acpSpawnable |
| ------------ | ------------------------ | --------------------------- | -------------- | -------------- | ------------ |
| claude       | کد کلاود                 | Anthropic                   | full           | env            | true         |
| codex        | CLI کد OpenAI            | OpenAI                      | full           | custom         | true         |
| zcode        | ZCode (برنامه نویسی GLM) | Z.ai                        | none           | custom         | false        |
| cline        | Cline                    | OSS (توسعه‌دهنده ex-Claude) | full           | custom         | true         |
| kilo         | کد کیلو                  | Kilo-Org                    | full           | custom         | false        |
| roo          | کد رو                    | Roo (OSS)                   | full           | guide          | false        |
| continue     | ادامه                    | continue.dev                | full           | guide          | false        |
| aider        | Aider                    | OSS (P. Gauthier)           | full           | guide          | true         |
| forge        | ForgeCode                | Antinomy HQ                 | full           | custom         | true         |
| jcode        | jcode                    | 1jehuang (OSS)              | full           | custom         | false        |
| deepseek-tui | DeepSeek TUI             | Hunter Bown (OSS)           | full           | custom         | false        |
| codewhale    | CodeWhale                | Hmbown (OSS)                | full           | custom         | false        |
| opencode     | OpenCode                 | Anomaly (ex-SST)            | full           | guide          | true         |
| droid        | Factory Droid            | Factory AI                  | partial        | guide          | false        |
| copilot      | CLI کد GitHub Copilot    | GitHub/MS                   | full           | custom         | false        |
| cursor-cli   | CLI کد Cursor            | Anysphere                   | partial        | guide          | true         |
| smelt        | Smelt                    | leonardcser (OSS)           | full           | custom         | false        |
| pi           | Pi (عامل کدگذاری pi)     | M. Zechner (OSS)            | full           | custom         | false        |
| grok-build   | Grok Build               | xAI                         | full           | custom         | false        |
| crush        | Crush                    | OSS (Charm)                 | full           | custom         | false        |
| qwen         | کد Qwen                  | Alibaba                     | full           | guide          | true         |
| cursor       | Cursor                   | Anysphere                   | none           | guide          | false        |
| antigravity  | ضد جاذبه                 | Google                      | none           | mitm           | false        |
| hermes       | هرمس                     | Nous Research               | none           | guide          | false        |
| kiro         | Kiro AI                  | Amazon                      | none           | mitm           | false        |
| custom       | CLI سفارشی               | —                           | full           | custom-builder | false        |

ابزارهایی که `baseUrlSupport: "partial"` دارند در کارت داشبورد نشان "⚠ Base URL parcial" را نمایش می‌دهند.
---

## 2. کاتالوگ ابزارهای CLI (8 ابزار)

عامل‌های خودمختار که در `/dashboard/cli-agents` ظاهر می‌شوند:

| id           | name             | vendor                   | baseUrlSupport | acpSpawnable |
| ------------ | ---------------- | ------------------------ | -------------- | ------------ |
| hermes-agent | عامل هرمس        | Nous Research            | full           | false        |
| openclaw     | OpenClaw         | OSS (P. Steinberger)     | full           | true         |
| goose        | Goose            | Block / Linux Foundation | full           | true         |
| interpreter  | Open Interpreter | OSS                      | full           | true         |
| warp         | Warp AI          | Warp Inc.                | partial        | true         |
| agent-deck   | Agent Deck       | asheshgoplani (OSS)      | full           | false        |
| omp          | Oh My Pi         | OSS                      | full           | true         |
| letta        | Letta CLI        | Letta                    | full           | false        |

---

## 3. عامل‌های ACP (/dashboard/acp-agents)

این صفحه (که از `/dashboard/agents` تغییر نام داده است) CLIهایی را نشان می‌دهد که Pusula می‌تواند به عنوان موتورهای اجرایی backend از طریق پروتکل stdio/ACP **ایجاد** کند. کاتالوگ به طور جداگانه در `src/lib/acp/registry.ts` نگهداری می‌شود و **همانند** `CLI_TOOLS` نیست.

---

## 4. لیست معوقه MITM (در داشبورد نمایش داده نمی‌شود)

CLIهای زیر به طور طبیعی از URL پایه سفارشی پشتیبانی نمی‌کنند و در صفحات کد CLI یا عامل‌های CLI **فهرست نشده‌اند**. آن‌ها نامزدهای مداخله MITM در طرح 11 هستند:

| CLI                 | دلیل                                                   |
| ------------------- | ------------------------------------------------------ |
| windsurf            | BYOK محدود به مدل‌های انتخابی Claude + URL/token شرکتی |
| amp                 | اکوسیستم بسته (Sourcegraph)                            |
| amazon-q / kiro-cli | احراز هویت AWS SSO، بدون URL سفارشی                    |
| cowork              | Anthropic Desktop، بدون نقطه پایانی قابل تنظیم         |

برای مرجع کامل به `_tasks/features-v3.8.6/refactorpages/_orchestration/_plan11-mitm-backlog.md` مراجعه کنید.

---

## 5. API تشخیص دسته‌ای

تمام تشخیص ابزارها از طریق یک نقطه پایانی واحد تجمیع می‌شود:

**`GET /api/cli-tools/all-statuses`**

- Auth: `requireCliToolsAuth(request)` (همانند سایر مسیرهای `/api/cli-tools/`)
- Returns: `Record<toolId, ToolBatchStatus>` (نوع: `src/shared/types/cliBatchStatus.ts`)
- Strategy: `Promise.all` بر روی تمام ابزارها، 5 ثانیه زمان محدود برای هر ابزار
- Cache: در حافظه LRU با ایندکس فایل پیکربندی `mtime`. کش زمانی که mtime تغییر کند، نامعتبر می‌شود. در زمان راه‌اندازی مجدد سرور بازنشانی می‌شود.

شکل پاسخ برای هر ابزار:

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
  error?: string; // sanitized, no stack traces
}
```

## ۶. مدیریت تنظیمات برای ابزارهای جدید

ابزارهای جدید با `configType: "custom"` دارای مسیرهای API تنظیمات اختصاصی هستند:

| مسیر                                        | ابزار                                                            |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `POST /api/cli-tools/forge-settings`        | ForgeCode (.forge.toml)                                          |
| `POST /api/cli-tools/jcode-settings`        | jcode (--base-url flag)                                          |
| `POST /api/cli-tools/deepseek-tui-settings` | DeepSeek TUI (OPENAI_BASE_URL, legacy)                           |
| `POST /api/cli-tools/codewhale-settings`    | CodeWhale (OPENAI_BASE_URL, primary + legacy `~/.deepseek` sync) |
| `POST /api/cli-tools/smelt-settings`        | Smelt                                                            |
| `POST /api/cli-tools/pi-settings`           | Pi coding agent                                                  |
| `POST /api/cli-tools/grok-build-settings`   | Grok Build (~/.grok/config.toml, `[model.pusula]`)            |
| `POST /api/cli-tools/qwen-settings`         | Qwen Code (`~/.qwen/settings.json` + dedicated `.env` key)       |

تمام مسیرها از `sanitizeErrorMessage()` برای پاسخ‌های خطا استفاده می‌کنند (قانون سخت شماره ۱۲).

---

## ۷. معماری صفحات داشبورد

### کد CLI (`/dashboard/cli-code`)

- `src/app/(dashboard)/dashboard/cli-code/page.tsx` — کامپوننت سرور
- `src/app/(dashboard)/dashboard/cli-code/CliCodePageClient.tsx` — گرید کلاینت
- `src/app/(dashboard)/dashboard/cli-code/[id]/page.tsx` — صفحه جزئیات ابزار
- `src/app/(dashboard)/dashboard/cli-code/components/` — ۱۲ کارت ابزار تخصصی + `ToolDetailClient.tsx`

### عوامل CLI (`/dashboard/cli-agents`)

- `src/app/(dashboard)/dashboard/cli-agents/page.tsx` — کامپوننت سرور
- `src/app/(dashboard)/dashboard/cli-agents/CliAgentsPageClient.tsx` — گرید کلاینت
- `src/app/(dashboard)/dashboard/cli-agents/[id]/page.tsx` — استفاده مجدد از `ToolDetailClient`

### عوامل ACP (`/dashboard/acp-agents`)

- `src/app/(dashboard)/dashboard/acp-agents/page.tsx` — کامپوننت سرور (انتقال یافته از `agents/`)

### کامپوننت‌های UI مشترک (`src/shared/components/cli/`)

| فایل                    | هدف                                               |
| ----------------------- | ------------------------------------------------- |
| `CliToolCard.tsx`       | کارت وضعیت هوشمند (تشخیص + تنظیمات + نقطه پایانی) |
| `CliConceptCard.tsx`    | کارت توضیح مفهوم در هر صفحه                       |
| `CliComparisonCard.tsx` | مقایسه سه ستونی بین انواع CLI                     |
| `BaseUrlSelect.tsx`     | منوی کشویی نقطه پایانی (محلی/ابری/سفارشی)         |
| `ApiKeySelect.tsx`      | انتخاب‌کننده کلید API                             |
| `ManualConfigModal.tsx` | مدال قطعه کد تنظیمات قابل کپی                     |

### هوک مشترک (`src/shared/hooks/cli/`)

| فایل                      | هدف                                                                    |
| ------------------------- | ---------------------------------------------------------------------- |
| `useToolBatchStatuses.ts` | دریافت `/api/cli-tools/all-statuses`، مدیریت حالت بارگذاری/به‌روزرسانی |

## 8. i18n

فضاهای نام جدید در طرح 14 F9 اضافه شده‌اند:

| Namespace   | Purpose                                                                   |
| ----------- | ------------------------------------------------------------------------- |
| `cliCommon` | رشته‌های مشترک (برچسب‌های کارت، متون مفهوم/مقایسه، برچسب‌های صفحه جزئیات) |
| `cliCode`   | رشته‌های صفحه CLI Code                                                    |
| `cliAgents` | رشته‌های صفحه CLI Agents                                                  |
| `acpAgents` | رشته‌های صفحه ACP Agents                                                  |

ترجمه‌های کامل PT-BR و EN ارائه شده‌اند. 39 زبان دیگر به طور خودکار از طریق ادغام سطح فضای نام در `src/i18n/request.ts` به EN برمی‌گردند.

---

## 9. شروع سریع

### مرحله 1 — دریافت کلید API Pusula

1. به `/dashboard/api-manager` بروید → **ایجاد کلید API**
2. یک نام به آن بدهید (مثلاً `cli-tools`) و تمام مجوزها را انتخاب کنید
3. کلید را کپی کنید — شما به آن برای هر CLI زیر نیاز خواهید داشت

> کلید شما به شکل زیر است: `sk-xxxxxxxxxxxxxxxx-xxxxxxxxx`

---

### مرحله 2 — نصب ابزارهای CLI

تمام ابزارهای مبتنی بر npm به Node.js 22.22.2+ یا 24.x نیاز دارند:

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

# Google Gemini CLI (قابل راه‌اندازی از طریق `pusula run gemini` → /v1beta surface)
npm install -g @google/gemini-cli

# Aider
pip install aider-chat

# Smelt
cargo install smelt  # مبتنی بر Rust

# Pi coding agent
# برای نصب به https://github.com/zechnerj/pi-coding-agent مراجعه کنید

# jcode
# برای نصب به https://github.com/1jehuang/jcode مراجعه کنید
```

---

### مرحله 3 — پیکربندی از طریق داشبورد

1. به `http://localhost:20128/dashboard/cli-code` بروید
2. ابزار خود را در شبکه پیدا کنید
3. بر روی کارت کلیک کنید تا صفحه جزئیات ابزار باز شود
4. کلید API و URL پایه خود را انتخاب کنید
5. بر روی **اعمال پیکربندی** کلیک کنید یا قطعه کد پیکربندی دستی را کپی کنید

---

### مرحله 4 — تنظیم متغیرهای محیطی جهانی

```bash
# نقطه پایانی جهانی Pusula
export OPENAI_BASE_URL="http://localhost:20128/v1"
export OPENAI_API_KEY="sk-your-pusula-key"
export ANTHROPIC_BASE_URL="http://localhost:20128"
export ANTHROPIC_AUTH_TOKEN="sk-your-pusula-key"
# Gemini CLI در ROOT متغیر GOOGLE_GEMINI_BASE_URL را می‌خواند (SDK آن به طور خودکار /v1beta/... را اضافه می‌کند)
export GOOGLE_GEMINI_BASE_URL="http://localhost:20128"
export GEMINI_API_KEY="sk-your-pusula-key"
```

> برای **سرور از راه دور** `localhost:20128` را با IP یا دامنه سرور جایگزین کنید،
> مثلاً `http://<your-server-ip>:20128`.

---

### مرحله 4 — پیکربندی هر ابزار

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

از ریشه دروازه یکپارچه Anthropic برای Claude Code استفاده کنید. در اینجا `/v1` را اضافه نکنید.

**آزمایش:** `claude "say hello"`

---

#### OpenAI Codex

Codex مدرن (v0.137+) فقط `~/.codex/config.toml` را می‌خواند — `config.yaml` قدیمی متعلق به CLI قدیمی npm است و به طور خاموش نادیده گرفته می‌شود. کلید API در متغیر محیطی `PUSULA_API_KEY` (`env_key`) باقی می‌ماند و هرگز در داخل فایل نیست:

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

مرجع کامل (پروفایل‌ها، `wire_api`، پنجره‌های زمینه): [CODEX-CLI-CONFIGURATION.md](../guides/CODEX-CLI-CONFIGURATION.md).

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

> از `opencode run "your prompt" --model pusula/claude-sonnet-4-5-thinking --variant high`
> برای ارسال واریانت‌های تفکر استفاده کنید.

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
تنظیمات افزونه Cline → ارائه‌دهنده API: `OpenAI Compatible` → URL پایه: `http://localhost:20128/v1`

یا از داشبورد Pusula استفاده کنید → **CLI Tools → Cline → Apply Config**.

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

یا از داشبورد Pusula استفاده کنید → **CLI Tools → KiloCode → Apply Config**.

---

#### Continue (افزونه VS Code)

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

پس از ویرایش، VS Code را دوباره راه‌اندازی کنید.

---

#### VS Code Insiders (`chatLanguageModels.json`)

از این مورد زمانی استفاده کنید که VS Code Insiders برای مدل‌های نقطه پایانی سفارشی پیکربندی شده و می‌خواهید Pusula بدون فیلد هدر سفارشی کار کند.

**محل توصیه شده:**

- لینوکس: `~/.config/Code - Insiders/User/chatLanguageModels.json`
- ویندوز: `%APPDATA%/Code - Insiders/User/chatLanguageModels.json`

**مثال با استفاده از نام مستعار توکن‌شده Pusula:**

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

- `sk-your-pusula-key` را با کلید API ایجاد شده در Pusula جایگزین کنید.
- فیلد `url` باید به `/api/v1/vscode/{token}/chat/completions` اشاره کند.
- فیلد `modelsUrl` باید به `/api/v1/vscode/{token}/models` اشاره کند.
- در صورت پشتیبانی کلاینت از هدرهای سفارشی، از جریان معمول `/v1` + هدر Bearer استفاده کنید.
- توکن‌های جاسازی شده در URL یک بازگشت سازگاری هستند و ممکن است در لاگ‌های ویرایشگر یا تاریخچه پروکسی ظاهر شوند.

---

#### Kiro CLI (آمازون)

```bash
# به حساب AWS/Kiro خود وارد شوید:
kiro-cli login

# CLI از احراز هویت خود استفاده می‌کند — Pusula به عنوان backend برای Kiro CLI خود لازم نیست.
# از kiro-cli در کنار Pusula برای ابزارهای دیگر استفاده کنید.
kiro-cli status
```

برای برنامه دسکتاپ **Kiro IDE**، از نقطه پایانی MITM که توسط Pusula در زیر `/dashboard/cli-tools → Kiro` در دسترس است استفاده کنید.

---

## 10. رابط خط فرمان داخلی Pusula

فایل اجرایی `pusula` فرمانهایی را برای چرخه عمر سرور، راهاندازی، عیبیابی و مدیریت ارائهدهندگان فراهم میکند. نقطه ورود: `bin/pusula.mjs`.

```bash
pusula                              # راهاندازی سرور (پورت پیشفرض 20128)
pusula setup                        # جادوگر راهاندازی تعاملی
pusula doctor                       # بررسی پیکربندی، پایگاه داده، پورتها و محیط اجرا
pusula providers list               # اتصالهای پیکربندیشده ارائهدهندگان
pusula providers test-all           # آزمایش همه اتصالهای فعال
pusula reset-password               # بازنشانی گذرواژه مدیر
pusula logs                         # پخش زنده گزارشهای درخواست
pusula health                       # جزئیات سلامت (مدارشکنها، حافظه نهان، حافظه)
pusula --version                    # نمایش نسخه
pusula --help                       # نمایش همه فرمانها
```

### راهاندازی و مقداردهی اولیه

```bash
pusula setup                        # جادوگر راهاندازی تعاملی
pusula setup --non-interactive      # حالت CI/خودکارسازی (خواندن متغیرهای محیطی و فلگها)
pusula setup --password '<value>'   # تنظیم مستقیم گذرواژه مدیر
pusula setup --add-provider \
  --provider openai \
  --api-key '<value>' \
  --test-provider                      # افزودن و آزمایش یک ارائهدهنده در یک مرحله
```

متغیرهای محیطی شناختهشده برای راهاندازی غیرتعاملی:

| متغیر               | هدف                                                                   |
| ------------------- | --------------------------------------------------------------------- |
| `PUSULA_API_KEY` | کلید API ارائهدهنده (اتصال به `--api-key` از طریق Commander `.env()`) |
| `DATA_DIR`          | بازنویسی مسیر پوشه داده Pusula                                     |

سایر ورودیهای غیرتعاملی بهصورت فلگ ارسال میشوند، نه متغیر محیطی:
`--password`، `--provider`، `--provider-name`، `--provider-base-url`، `--default-model`
(گزینههای `pusula setup` در بالا را ببینید).

### عیبیابی

```bash
pusula doctor                       # بررسی پیکربندی، پایگاه داده، پورتها، محیط اجرا، حافظه و زندهبودن
pusula doctor --json                # JSON قابلخواندن توسط ماشین
pusula doctor --no-liveness         # رد کردن کاوش سلامت HTTP
pusula doctor --host 0.0.0.0        # بازنویسی میزبان بررسی زندهبودن
pusula doctor --liveness-url <url>  # بازنویسی کامل URL نقطه پایانی سلامت
```

فرمان doctor این بررسیها را اجرا میکند: `Config`، `Database`، `Storage/encryption`،
`Port availability`، `Node runtime`، `Native binary` (better-sqlite3)،
`Memory` و `Server liveness`. اگر هر یک از بررسیها دارای وضعیت `fail` باشد، با کد خروج غیرصفر خاتمه مییابد.

### مدیریت ارائهدهندگان

```bash
pusula providers available                       # کاتالوگ ارائهدهندگان Pusula
pusula providers available --search openai       # فیلتر کردن کاتالوگ بر اساس شناسه/نام/نام مستعار/دسته
pusula providers available --category api-key    # فیلتر بر اساس دسته (api-key، oauth، free، ...)
pusula providers available --json                # JSON قابلخواندن توسط ماشین

pusula providers list                            # اتصالهای پیکربندیشده ارائهدهندگان
pusula providers list --json

pusula providers test <id|name>                  # آزمایش یک اتصال پیکربندیشده
pusula providers test-all                        # آزمایش همه اتصالهای فعال
pusula providers validate                        # اعتبارسنجی ساختاری صرفاً محلی
pusula providers add <provider> --credential-env PROVIDER_KEY
pusula providers import ./providers.json --dry-run --json
pusula providers auth <provider>                 # جریان OAuth موجود
pusula providers edit <id|name> --default-model <model>
pusula providers remove <id|name> --yes
```

فرمانهای `providers add/import/auth/edit/remove` در درجه اول مبتنی بر API هستند و بنابراین روی
بافت فعال محلی یا راه دور کار میکنند. برای ورود اطلاعات اعتبارنامه باید از
`--credential-stdin` یا `--credential-env` استفاده شود؛ `--dry-run --json` فقط
وجود/ساختار سانسورشده را گزارش میکند. `providers available` کاتالوگ Pusula را میخواند؛
`providers list/test/test-all/validate` رفتار محلی SQLite خود را حفظ میکنند و
به در حال اجرا بودن سرور نیاز ندارند.

### بازیابی و بازنشانی

```bash
pusula reset-password                # بازنشانی گذرواژه مدیر (همچنین: pusula-reset-password)
pusula reset-encrypted-columns       # نمایش هشدار و اجرای آزمایشی برای بازنشانی اعتبارنامههای رمزگذاریشده
pusula reset-encrypted-columns --force  # تهی کردن واقعی اعتبارنامههای رمزگذاریشده در SQLite
```

### صدور اعتبارنامهها (⚠ با احتیاط استفاده کنید)

```bash
pusula auth export                                 # نمایش هشدار و درخواست تأیید — بدون دسترسی به پایگاه داده
pusula auth export --force                          # صدور اعتبارنامههای رمزگشاییشده همه اتصالها به stdout در قالب JSON
pusula auth export --force --id <id>                 # صدور فقط اتصال منطبق
pusula auth export --force --format env               # تولید خطوط PUSULA_<PROVIDER>_<FIELD>=<value>
pusula auth export --force --out creds.json           # نوشتن در فایل (ایجادشده با مجوزهای 0600)
```

`auth export` **صرفاً محلی** است (خواندن مستقیم SQLite، بدون مسیر HTTP) و عمداً مقادیر
**متن ساده** `apiKey`/`accessToken`/`refreshToken`/`idToken` را نمایش میدهد یا مینویسد — این یک قابلیت است، نه
اشکال. بدون `--force` هیچ چیزی از پایگاه داده خوانده و هیچ چیزی رمزگشایی نمیشود. پیش از تولید
هرگونه متن ساده، همیشه یک نوار هشدار در stderr نمایش داده میشود. لازم است `STORAGE_ENCRYPTION_KEY`
تنظیم شده باشد. فیلدی که رمزگشایی آن ناموفق باشد (کلید قدیمی، متن رمز خراب) بهجای متوقف کردن
کل فرایند صدور یا افشای خطای زیربنایی، بهصورت `<field>DecryptFailed: true` گزارش میشود.

### سایر زیرفرمانها

این فرمانها، مگر آنکه خلاف آن ذکر شده باشد، مستلزم در حال اجرا بودن سرور Pusula هستند:

```bash
pusula status                       # وضعیت جامع زمان اجرا
pusula logs                         # پخش زندهٔ گزارش درخواستها (--json، --search، --follow)
pusula config list                  # نمایش ابزارهای CLI پیکربندیشده

pusula provider list                # فهرست ارائهدهندگان موجود (نام مستعار providers list)
pusula provider add                 # ثبت Pusula بهعنوان ارائهدهنده در یک ابزار
pusula keys add | list | remove     # مدیریت کلیدهای API
pusula models [provider]            # فهرست مدلها (--json، --search)
pusula combo list | switch | create | delete

pusula backup                       # تهیهٔ اسنپشات از پیکربندی و DB
pusula restore                      # بازیابی از یک اسنپشات قبلی

pusula health                       # جزئیات سلامت (قطعکنندهها، کش، حافظه)
pusula quota                        # میزان استفاده از سهمیهٔ ارائهدهنده
pusula cache                        # وضعیت کش
pusula cache clear                  # پاکسازی کشهای معنایی و امضا

pusula mcp status | restart         # وضعیت / راهاندازی مجدد سرور MCP
pusula a2a status | card            # وضعیت سرور A2A / کارت عامل

pusula tunnel list | create | stop  # مدیریت تونلها (cloudflare/tailscale/ngrok)
pusula env show | get <k> | set <k> <v>  # بررسی / تنظیم متغیرهای محیطی (موقت)

pusula test                         # آزمون سریع اتصال به ارائهدهنده
pusula update                       # بررسی بهروزرسانیها
pusula completion                   # تولید تکمیل خودکار پوسته
```

### پرچمهای متداول

| پرچم                | توضیحات                                                     |
| ------------------- | ----------------------------------------------------------- |
| `--no-open`         | جلوگیری از باز شدن خودکار مرورگر هنگام شروع                 |
| `--port <n>`        | بازنویسی پورت API (پیشفرض 20128)                            |
| `--mcp`             | اجرا بهعنوان سرور MCP از طریق stdio (برای IDEها)            |
| `--non-interactive` | حالت CI (بدون اعلان؛ خواندن از متغیرهای محیطی/پرچمها)       |
| `--json`            | خروجی JSON قابلخواندن توسط ماشین (doctor، providers و غیره) |
| `--help`, `-h`      | نمایش راهنمای مختص فرمان                                    |
| `--version`, `-v`   | چاپ نسخهٔ نصبشده                                            |

---

## نقاط پایانی API موجود

| نقطه پایانی                | توضیحات                          | استفاده برای                                   |
| -------------------------- | -------------------------------- | ---------------------------------------------- |
| `/v1/chat/completions`     | چت استاندارد (همه ارائه‌دهندگان) | همه ابزارهای مدرن                              |
| `/v1/responses`            | API پاسخ‌ها (فرمت OpenAI)        | Codex، جریان‌های عاملی                         |
| `/v1/completions`          | تکمیل متن قدیمی                  | ابزارهای قدیمی که از `prompt:` استفاده می‌کنند |
| `/v1/embeddings`           | جاسازی‌های متنی                  | RAG، جستجو                                     |
| `/v1/images/generations`   | تولید تصویر                      | GPT-Image، Flux و غیره                         |
| `/v1/audio/speech`         | تبدیل متن به گفتار               | ElevenLabs، OpenAI TTS                         |
| `/v1/audio/transcriptions` | تبدیل گفتار به متن               | Deepgram، AssemblyAI                           |

نمونه‌های آماده برای چسباندن با یک URL Pusula توکن‌شده:

```txt
مثال توکن: sk-a3ab3c080beaee3a-69f4a4-070d71af

پایه استاندارد OpenAI: http://localhost:20128/v1
مدل‌های VS Code: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/models
چت VS Code: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/chat/completions
پاسخ‌های VS Code: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/responses
برچسب‌های Ollama: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/tags
چت Ollama: http://localhost:20128/api/v1/vscode/sk-a3ab3c080beaee3a-69f4a4-070d71af/api/chat
```

---

## عیب‌یابی

| خطا                                           | علت                                 | راه حل                                                  |
| --------------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| `Connection refused`                          | Pusula در حال اجرا نیست          | `pusula serve`                                       |
| `401 Unauthorized`                            | کلید API اشتباه                     | بررسی در `/dashboard/api-manager`                       |
| `No combo configured`                         | هیچ ترکیب مسیریابی فعالی وجود ندارد | تنظیم در `/dashboard/combos`                            |
| CLI نشان می‌دهد "not installed"               | باینری در PATH نیست                 | بررسی `which <command>`                                 |
| داشبورد بعد از نصب نشان می‌دهد "not detected" | کش قدیمی                            | کلیک بر روی "⟳ Refresh detection" در داشبورد            |
| لینک قدیمی `/dashboard/cli-tools`             | بوکمارک پیش از v3.8.6               | به طور خودکار به `/dashboard/cli-code` (308) هدایت شد   |
| لینک قدیمی `/dashboard/agents`                | بوکمارک پیش از v3.8.6               | به طور خودکار به `/dashboard/acp-agents` (308) هدایت شد |
