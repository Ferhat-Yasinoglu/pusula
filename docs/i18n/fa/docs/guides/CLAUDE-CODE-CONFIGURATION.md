# Claude Code CLI — Configuration with Pusula (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CLAUDE-CODE-CONFIGURATION.md) · 🇩🇪 [de](../../../de/docs/guides/CLAUDE-CODE-CONFIGURATION.md) · 🇹🇷 [tr](../../../tr/docs/guides/CLAUDE-CODE-CONFIGURATION.md)

---

رابط خط فرمان **Claude Code** (`claude`) را به Pusula — بهصورت محلی یا روی یک VPS راه دور —
با پروفایلهای جداگانه برای هر مدل متصل کنید؛ مشابه پیکربندی Codex.

---

## شروع سریع

```bash
# اجرای Claude Code با یک Pusula محلی (context فعال را بهصورت خودکار تشخیص میدهد)
pusula launch

# اتصال به یک Pusula راه دور (پس از `pusula connect <host>`، این کار خودکار است)
pusula launch --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# ایجاد پروفایلهای جداگانه برای هر مدل، سپس اجرای یکی از آنها
pusula setup-claude            # فایل ~/.claude/profiles/<name>/settings.json را مینویسد
pusula launch --profile glm52  # استفاده Claude Code از glm/glm-5.2 از طریق Pusula
```

---

## نحوه اتصال Claude Code به یک درگاه

Claude Code با **Anthropic Messages API** ارتباط برقرار میکند و از طریق متغیرهای
محیطی به یک endpoint سفارشی هدایت میشود (این ابزار گزینه `--base-url` ندارد):

| متغیر                                        | کاربرد                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_BASE_URL`                         | URL ریشه درگاه (Claude Code مسیر `/v1/messages` را به آن اضافه میکند). **بدون پسوند `/v1`.**          |
| `ANTHROPIC_AUTH_TOKEN`                       | بهشکل `Authorization: Bearer …` ارسال میشود — از توکن دسترسی یا کلید API مربوط به Pusula استفاده کنید |
| `ANTHROPIC_API_KEY`                          | جایگزین: بهشکل `x-api-key` ارسال میشود. اگر هر دو تنظیم شده باشند، `ANTHROPIC_AUTH_TOKEN` اولویت دارد |
| `ANTHROPIC_MODEL`                            | اجبار به استفاده از یک مدل مشخص (پیشفرض انتخابگر `/model` را نادیده میگیرد)                           |
| `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY` | `1` ← انتخابگر بومی `/model` مدلهای `claude*`/`anthropic*` را از `/v1/models` فهرست میکند             |
| `CLAUDE_CODE_MAX_OUTPUT_TOKENS`              | محدودکردن تعداد توکنهای خروجی در هر پاسخ (برای مثال `65536`)                                          |
| `CLAUDE_CODE_AUTO_COMPACT_WINDOW`            | آستانه توکن برای فشردهسازی خودکار                                                                     |

> متغیرهای محیطی فقط **یکبار هنگام راهاندازی** خوانده میشوند — پس از تغییر آنها، Claude Code را دوباره راهاندازی کنید.

`pusula launch` همه این موارد را برای شما تنظیم میکند: URL پایه و توکن را
از context فعال بهدست میآورد (بنابراین پس از `pusula connect <vps>`، اجرای
`pusula launch` بدون تنظیمات اضافه کار میکند)، سلامت سرور را بررسی میکند و
سپس `claude` را اجرا میکند.

---

## نامهای مستعار اکتشاف — نمایش مدلهای غیر Claude در انتخابگر `/model`

قابلیت اکتشاف مدل درگاه در Claude Code فقط شناسههایی را فهرست میکند که با
`claude` یا `anthropic` آغاز شوند؛ بنابراین با
`CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1`، انتخابگر بومی `/model` معمولاً
**فقط** مدلهای Claude/Anthropic در Pusula را نمایش میدهد — مدلهایی مانند
`kimi/kimi-k2.6` یا `glm/glm-5.2` هرگز ظاهر نمیشوند، حتی با اینکه مسیریابی آنها
بهدرستی انجام میشود.

Pusula میتواند هر مدل فعال (و combo) را با یک شناسه `claude/…` بازتاب دهد تا
از این فیلتر عبور کرده و در انتخابگر ظاهر شود:

```
kimi/kimi-k2.6            →  claude/kimi/kimi-k2.6      "Kimi K2.6 (Pusula)"
glm/glm-5.2              →  claude/glm/glm-5.2         "GLM 5.2 (Pusula)"
<combo "custo-otimizado"> →  claude/combo/custo-otimizado
```

هنگامی که یکی از این موارد را در Claude Code انتخاب میکنید، Pusula پیش از
مسیریابی، پوشش `claude/` را حذف کرده و شناسه واقعی را بازیابی میکند — یک شناسه
اصلی `claude/<real-claude-model>` (ارائهدهنده واقعی Claude OAuth) همیشه بدون
تغییر باقی میماند.

**این قابلیت بهصورت پیشفرض غیرفعال است** و توسط یک سازوکار سهسطحی کنترل میشود
(خاصترین سطح اولویت دارد). بنابراین یک Pusula معمولی برای کلاینتهایی که از
Claude Code استفاده نمیکنند، کاتالوگ خود را دوبرابر نمیکند:

| سطح        | محل                                                                                 |
| ---------- | ----------------------------------------------------------------------------------- |
| مدل        | صفحه جزئیات ارائهدهنده ← کلید جداگانه «نمایش در Claude Code» برای هر مدل            |
| ارائهدهنده | صفحه جزئیات ارائهدهنده ← کلید سطح ارائهدهنده (شامل همه مدلهای آن میشود)             |
| سراسری     | تنظیمات ← Feature Flags ← `EXPOSE_CC_DISCOVERY_ALIASES` (بهصورت پیشفرض غیرفعال است) |

متغیر محیطی `EXPOSE_CC_DISCOVERY_ALIASES` سطح سراسری را اجباراً فعال میکند و
بر مقدار تنظیمشده در داشبورد اولویت دارد (در این حالت، صفحه Feature Flags
یادداشت «فعال از طریق متغیر محیطی» را نمایش میدهد). کلیدهای هر ارائهدهنده و
هر مدل، تنظیم را از آن نقطه دقیقتر میکنند — برای مثال، اگر سطح سراسری خاموش
و ارائهدهنده Kimi روشن باشد، فقط مدلهای Kimi نمایش داده میشوند.

> ⚠️ **ناهماهنگی پنجره در مدلهای غیر Claude.** Claude Code برای هر شناسهای که
> نمیشناسد، یک پنجره context با اندازه 200K در نظر میگیرد (نمیتواند اندازه
> واقعی پنجره را از `/v1/models` بخواند). برای مدلی با پنجره بزرگتر (برای مثال
> پنجره 256K در Kimi K2)، مقدار `CLAUDE_CODE_AUTO_COMPACT_WINDOW` را پایینتر از
> اندازه واقعی پنجره مدل تنظیم کنید تا فشردهسازی خودکار زودتر از موعد اجرا نشود.
> پروفایلهای تولیدشده در بالا از قبل این مقدار را بهصورت جداگانه برای هر مدل
> تنظیم میکنند.

---

## بخش راهاندازی اولیه در داشبورد

کارت ابزار Claude (**Dashboard → CLI Code**) قطعه دقیق `settings.json` مربوط به این نمونه را در کنار دکمه اطلاعات نام مستعار شناسایی و همراه با یک دکمه کپی نمایش میدهد:

```jsonc
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://<Pusula شما>:20128",
    "ANTHROPIC_AUTH_TOKEN": "<کلید API مربوط به Pusula شما>",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
  },
}
```

URL پایه همان مقداری است که کارت تشخیص داده است (از جمله مقدار سفارشیای که وارد کردهاید) و از قبل نرمالسازی شده است — بدون پسوند `/v1` و بدون اسلش انتهایی. **کلید هرگز نمایش داده نمیشود**: این بلوک حاوی یک مقدار جایگزین است تا اسکرینشات یا قطعه کد جایگذاریشده نتواند کلیدی را افشا کند. کلید خود را جایگزین آن کنید.

برای هر مدلی که اندازه واقعی پنجره زمینه آن 200K نیست، `CLAUDE_CODE_AUTO_COMPACT_WINDOW` را در همان بلوک `env` اضافه کنید — Claude Code برای هر شناسهای که تشخیص نمیدهد، اندازه 200K را فرض میکند؛ بنابراین، در غیر این صورت فشردهسازی خودکار در نقطه نادرستی فعال میشود (هشدار بخش قبلی را ببینید). سازنده قطعه کد این مقدار را نیز میپذیرد؛ بنابراین فراخوانیکنندهای که اندازه پنجره مدل هدف را میداند، میتواند آن را مستقیماً تولید کند.

منبع: `src/shared/services/claudeCliConfig.ts::buildClaudeDiscoverySettingsSnippet` (سازندهای خالص و دارای آزمون واحد) که توسط `ClaudeGatewayOnboardingBlock` رندر میشود.

### پین کردن یک حساب (اختیاری)

برای ارسال همه درخواستهای Claude Code از طریق یک حساب مشخص ارائهدهنده، هدر `x-pusula-connection` را با استفاده از `ANTHROPIC_CUSTOM_HEADERS` در همان بلوک `env` اضافه کنید:

```jsonc
"ANTHROPIC_CUSTOM_HEADERS": "x-pusula-connection: <connection id>"
```

شناسه را از نشان `xxxxxxxx…` در ردیف اتصالِ صفحه ارائهدهنده کپی کنید. پین فقط برای شناسههای تکمدلی (`provider/model`) اعمال میشود، نه برای ترکیبها. برای اطلاع از رفتار دقیق در حالت بازگشت، به [پین کردن حساب برای هر درخواست](../reference/API_REFERENCE.md#account-pinning-per-request) مراجعه کنید.

---

## پروفایلها (`CLAUDE_CONFIG_DIR`)

Claude Code **فایل پروفایل بومی ندارد** (برخلاف `~/.codex/<name>.config.toml` در Codex).
سازوکار متعارف، `CLAUDE_CONFIG_DIR` است — یک دایرکتوری پیکربندی جداگانه برای هر
پروفایل که هرکدام `settings.json`، اعتبارنامهها، تاریخچه و کش مختص خود را دارند.

`pusula setup-claude` کاتالوگ زندهٔ `/v1/models` را دریافت میکند و برای هر مدل، یک
پروفایل در `~/.claude/profiles/<name>/settings.json` مینویسد و از
**همان نامهای `setup-codex`** (`glm52`، `kimi-k27`، `deepseek-pro`، …) استفاده میکند:

```jsonc
// ~/.claude/profiles/glm52/settings.json
{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "model": "glm/glm-5.2",
  "effortLevel": "xhigh",
  "env": {
    "ANTHROPIC_BASE_URL": "http://192.168.0.15:20128",
    "ANTHROPIC_MODEL": "glm/glm-5.2",
    "CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY": "1",
    "CLAUDE_CODE_AUTO_COMPACT_WINDOW": "190000",
  },
}
```

> **توکن احراز هویت هرگز در پروفایل نوشته نمیشود.** آن را با
> `pusula launch --profile <name>` اجرا کنید (این دستور `ANTHROPIC_AUTH_TOKEN` را از
> context فعال تزریق میکند)، یا خودتان `ANTHROPIC_AUTH_TOKEN` را export کرده و
> `CLAUDE_CONFIG_DIR=~/.claude/profiles/<name> claude` را اجرا کنید.

**همگامسازی خودکار پس از کشف مدل (اختیاری).** Pusula میتواند هر زمان که همگامسازی مدلهای
یک ارائهدهنده، کاتالوگ زنده را تغییر میدهد، همین فایلهای
`~/.claude/profiles/<name>/settings.json` را بهطور خودکار بازتولید کند — بنابراین مدلهای
جدید یا تغییرنامیافته بدون اجرای دوبارهٔ دستور، پروفایل دریافت میکنند. این قابلیت
**بهطور پیشفرض غیرفعال است**: آن را از **داشبورد CLI Code** («همگامسازی خودکار پروفایل
CLI» ← Claude Code) فعال کنید، یا `PUSULA_AUTO_SYNC_CLAUDE_PROFILES=true` را تنظیم کنید
(همچنین از `CLI_ALLOW_CONFIG_WRITES` پیروی میکند که بهطور پیشفرض فعال است). در صورت فعال
بودن، فقط فایلهای پروفایل را مینویسد؛ هرگز پیکربندی فعال/پیشفرض Claude، احراز هویت یا
`~/.claude/settings.json` شما را تغییر نمیدهد.

### تولید و استفاده از پروفایلها

```bash
# Pusula محلی
pusula setup-claude

# VPS راهدور (نشانی VPS را در هر پروفایل ثبت میکند)
pusula setup-claude --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# فقط برخی ارائهدهندگان
pusula setup-claude --only glm,kimi

# برای ارائهدهندگان CLI محلی (zcode، auggie، devin-cli-agentic،
# codex-app-server) که روی این میزبان شناسایی نشدهاند نیز پروفایل بنویس (برای یک مقصد محلی، بهطور پیشفرض نادیده گرفته میشوند)
pusula setup-claude --include-local

# پیشنمایش بدون نوشتن
pusula setup-claude --dry-run

# اجرای یک پروفایل
pusula launch --profile kimi-k27
```

---

## سطحهای مدل (اختیاری)

Claude Code درخواستها را به سطحهای مختلف قابلیت هدایت میکند. اگر میخواهید برای هر سطح از ارائهدهندهای متفاوت استفاده کنید، از طریق متغیرهای محیطی / تنظیمات، هر سطح را به یک مدل Pusula نگاشت کنید:

```bash
export ANTHROPIC_DEFAULT_OPUS_MODEL="glm/glm-5.2"
export ANTHROPIC_DEFAULT_SONNET_MODEL="kmc/kimi-k2.6"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="glm/glm-4.7-flash"
```

در غیر این صورت، یک `ANTHROPIC_MODEL` واحد (که پروفایلها تنظیم میکنند) برای همهچیز استفاده میشود.

---

## حالت راهدور

پس از اجرای `pusula connect <host>` (به
[حالت راهدور](./REMOTE-MODE.md) مراجعه کنید)، `pusula launch` و `pusula setup-claude`
بهطور خودکار آن سرور راهدور را هدف قرار میدهند و از توکن دسترسی محدودشدهٔ آن استفاده میکنند — هیچ
فلگ اضافهای لازم نیست. برای بازنویسی در هر بار اجرا، از `--remote` / `--api-key` استفاده کنید.

---

## عیبیابی

**Claude Code دروازه را نادیده میگیرد** — تأیید کنید که `ANTHROPIC_BASE_URL` شامل
`/v1` **نیست** و `claude` را دوباره راهاندازی کنید (متغیرهای محیطی فقط یکبار هنگام راهاندازی خوانده میشوند). `pusula launch`
این کار را برای شما انجام میدهد.

**انتخابگر `/model` خالی است / مدلهای دروازه وجود ندارند** — به Claude Code
v2.1.219+ و `CLAUDE_CODE_ENABLE_GATEWAY_MODEL_DISCOVERY=1` نیاز دارد. فقط شناسههای مدل `claude*` /
`anthropic*` در انتخابگر نمایش داده میشوند؛ هر مدل دیگری را با
`ANTHROPIC_MODEL=<id>` اجباری کنید (پروفایلها همین کار را انجام میدهند).

**`400 Ambiguous model 'claude-…'`** — Claude Code همیشه شناسههای مدل را **بدون پیشوند**
ارسال میکند (برای مثال `claude-opus-4-8`)، بنابراین وقتی هر دو ارائهدهندهٔ Claude Code (`cc/…`) و
Claude (`claude/…`) متصل باشند، شناسهٔ بدون پیشوند با دو مسیر مطابقت دارد و
Pusula از حدسزدن خودداری میکند. این مشکل را به یکی از دو روش برطرف کنید: یک شناسهٔ پیشونددار را با
`ANTHROPIC_MODEL=cc/claude-opus-4-8` ثابت کنید، یا گزینهٔ **ترجیح Claude Code برای
مدلهای Claude بدون پیشوند** را فعال کنید — این گزینه در صفحهٔ ارائهدهندهٔ Claude قرار دارد؛ یا
`PUSULA_PREFER_CLAUDE_CODE_FOR_UNPREFIXED_CLAUDE_MODELS=true` را تنظیم کنید (بهطور پیشفرض غیرفعال است؛
به [محیط](../reference/ENVIRONMENT.md) مراجعه کنید) — که شناسههای بدون پیشوند `claude-*`
را بهجای آن به Claude Code هدایت میکند. پیشوندهای صریح ارائهدهنده همیشه اولویت دارند.

**خطاهای احراز هویت** — پروفایل هیچ توکنی نگه نمیدارد. از `pusula launch --profile`
استفاده کنید (توکن را تزریق میکند) یا `ANTHROPIC_AUTH_TOKEN` را صادر کنید.

**پروفایلها ایزوله نیستند** — هر پروفایل یک `CLAUDE_CONFIG_DIR` مجزا دارد؛
بررسی کنید که خروجی `echo $CLAUDE_CONFIG_DIR` درون نشست به
`~/.claude/profiles/<name>` اشاره میکند.
