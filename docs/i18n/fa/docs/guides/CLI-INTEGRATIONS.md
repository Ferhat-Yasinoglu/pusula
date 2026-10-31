# CLI Integrations (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CLI-INTEGRATIONS.md) · 🇩🇪 [de](../../../de/docs/guides/CLI-INTEGRATIONS.md) · 🇹🇷 [tr](../../../tr/docs/guides/CLI-INTEGRATIONS.md)

---

برای مانیفست اجرایی مشترک، محیطهای فرزند محدودشده و راهاندازی پایدار
Gemini، به [قراردادهای اجرای CLI](./CLI-LAUNCH-CONTRACTS.md) مراجعه کنید.

Pusula مجموعهای از فرمانهای `setup-*` را ارائه میکند که یک CLI
برنامهنویسی (Codex، Claude Code، OpenCode، Cline، …) را برای استفاده از Pusula بهعنوان بکاند خود پیکربندی میکنند — بنابراین
ابزار با **یک** نقطه پایانی ارتباط برقرار میکند و Pusula درخواست را با
بازگشت خودکار به ارائهدهنده مناسب هدایت میکند. هر فرمان، کاتالوگ **فعال** مدلها را از یک
Pusula در حال اجرا (محلی یا راهدور) میخواند و فایل پیکربندی خود ابزار را روی دستگاه
**شما** مینویسد. هرجا ابزار پشتیبانی کند، کلید API از طریق یک متغیر محیطی ارجاع داده میشود.
فرمانهایی که فایل محیطی محلی ابزار را بهصورت ماندگار ذخیره میکنند، در ادامه مشخص شدهاند.

همچنین یک اجراکننده عمومی وجود دارد — `pusula run <target>` — که
`claude`، `codex`، `aider`، `goose`، `opencode`، `qwen` یا `gemini` را با
تزریق متغیرهای محیطی مناسب اجرا میکند، بدون اینکه هیچ پیکربندیای نوشته شود. اهداف و
نامهای مستعار آنها از مانیفست مرجع `bin/cli/cli-manifest.mjs`
(`claude-code|cc|anthropic`، `codex-cli|openai-codex|openai`، `goose-cli`،
`open-code`، `qwen-code`، `gemini-cli`) گرفته میشوند و `pusula completion` نیز همان
واژههای هدف استخراجشده از مانیفست را ارائه میدهد. اجراکنندههای قدیمی مختص هر ابزار —
`pusula launch` (Claude Code) و `pusula launch-codex` (Codex) — همچنان
در دسترس هستند.

راهاندازی ارائهدهنده نیز از همان زمینه محلی/راهدور در دسترس است. فرمانهای
API-محور زیر، احراز هویت مدیریتی را از اطلاعات محرمانه ارائهدهنده جدا نگه میدارند
و هرگز اطلاعات محرمانه را در خروجی ساختیافته چاپ نمیکنند:

```bash
pusula providers add glm --credential-env GLM_API_KEY --name work
pusula providers import ./providers.json --dry-run --json
pusula providers auth openai
pusula providers edit <connection-id> --default-model glm/glm-5.2
pusula providers remove <connection-id> --yes
```

برای اسکریپتها، `--credential-stdin` یا `--credential-env` را ترجیح دهید؛
`--credential` برای استفاده کنترلشده محلی حفظ شده است. `providers remove` در یک
ترمینال غیرتعاملی به `--yes` نیاز دارد و هر پنج فرمان از زمینه فعال یا گزینههای
سراسری `--base-url`/`--api-key` پیروی میکنند.

گزینشگرهای ارائهدهنده، پیشوندهای مبهم شناسه، نامها یا نام ارائهدهندگان را رد میکنند؛ هنگامی که
چند اتصال مطابقت دارند، از شناسه کامل اتصال استفاده کنید. فرمانهای ایجاد و ویرایش،
اتصال ذخیرهشده را دوباره میخوانند و حذف نیز بررسی میکند که اتصال دیگر قابل خواندن نباشد.
فرایند وارد کردن، جفت ارائهدهنده/نام موجود را رد میکند. ورودیهای واردشده نمیتوانند
نقطه پایانی مدیریتی، زمینه یا اطلاعات محرمانه مدیریتی ارائهشده به CLI را بازنویسی کنند.

برای راهاندازی پایه یکباره و دستی دو یکپارچهسازی کاملتر، به راهنماهای تفصیلی
هر ابزار مراجعه کنید:

- [پیکربندی Claude Code](./CLAUDE-CODE-CONFIGURATION.md)
- [پیکربندی Codex CLI](./CODEX-CLI-CONFIGURATION.md)
- [حالت از راه دور](./REMOTE-MODE.md) — یک Pusula از راه دور (VPS / Tailnet) را از لپتاپ خود کنترل کنید

---

## جدول اصلی

هر فرمان از **زمینهٔ فعال** پیروی میکند (که با `pusula connect` تنظیم میشود؛
به [حالت راه دور](./REMOTE-MODE.md) مراجعه کنید) یا از گزینههای صریح `--remote <url> --api-key <key>` استفاده میکند.
منظور از «محلی در برابر راه دور» در ادامه این است: بدون هیچ گزینهای، مقصد آن `http://localhost:20128` است؛
با `--remote` (یا یک زمینهٔ راه دور فعال)، کاتالوگ را از آن
سرور دریافت میکند و پیکربندی را بهصورت محلی مینویسد.

| فرمان                   | ابزار                       | آنچه مینویسد                                                                                                                                                                         | پرچمهای کلیدی                                                                                                                              | محلی یا راهدور |
| ----------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `pusula setup-codex`    | OpenAI Codex CLI            | `~/.codex/<name>.config.toml` — یک پروفایل برای هر مدل متنی سازگار (`codex --profile <name>`)                                                                                        | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home`                                                                        | هر دو          |
| `pusula setup-claude`   | Claude Code                 | `~/.claude/profiles/<name>/settings.json` — یک پروفایل برای هر مدل منطبق (`CLAUDE_CONFIG_DIR`)                                                                                       | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home`                                                                       | هر دو          |
| `pusula setup-opencode` | OpenCode (سازگار با openai) | `~/.config/opencode/opencode.json` — ارائهدهندهٔ `pusula` با همهٔ مدلهای کاتالوگ (`opencode -m pusula/<model>`)                                                                      | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port`                                                                             | هر دو          |
| `pusula setup-cline`    | Cline                       | `~/.cline/data/{globalState,secrets}.json` (حالت CLI) + تنظیمات افزونهٔ VS Code را چاپ میکند                                                                                         | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir`                                                                | هر دو          |
| `pusula setup-kilo`     | Kilo Code                   | `~/.local/share/kilo/auth.json` (CLI) + در صورت وجود `settings.json` مربوط به VS Code، تنظیمات `kilocode.*` را در آن ادغام میکند                                                     | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings`                                            | هر دو          |
| `pusula setup-continue` | Continue / `cn` CLI         | `~/.continue/config.yaml` — مدلهای `provider: openai`، با کلید از طریق `${{ secrets.PUSULA_API_KEY }}`                                                                               | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | هر دو          |
| `pusula setup-cursor`   | Cursor                      | هیچچیز — مراحل درونبرنامهای را چاپ میکند (پیکربندی Cursor یک SQLite غیرشفاف است)                                                                                                     | `--remote` `--api-key` `--only` `--port`                                                                                                   | هر دو          |
| `pusula setup-roo`      | Roo Code                    | `~/.pusula/roo-settings.json` (سند واردکردنی) + در صورت وجود `settings.json` مربوط به VS Code، مقدار `roo-cline.autoImportSettingsPath` را تنظیم میکند                               | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings`                                          | هر دو          |
| `pusula setup-crush`    | Crush                       | `~/.config/crush/crush.json` — ارائهدهندهٔ `openai-compat`، با کلید از طریق `$PUSULA_API_KEY`                                                                                        | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | هر دو          |
| `pusula setup-zed`      | Zed                         | `~/.config/zed/settings.json` — ارائهدهندهٔ `openai_compatible.pusula` (حداکثر ۲۵ مدل دارای قابلیت استفاده از ابزار)، با کلید از طریق `$PUSULA_API_KEY`                              | `--remote` `--api-key` `--only` `--reset` `--dry-run` `--port` `--config-path`                                                             | هر دو          |
| `pusula setup-goose`    | Goose                       | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + دستورالعمل متغیرهای محیطی را چاپ میکند                                                                | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | هر دو          |
| `pusula setup-aider`    | Aider                       | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + دستورالعمل متغیرهای محیطی را چاپ میکند                                                                              | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | هر دو          |
| `pusula setup-qwen`     | Qwen Code                   | `~/.qwen/settings.json` — آرایهٔ V4 به نام `modelProviders.openai` + متغیر `PUSULA_API_KEY` در `~/.qwen/.env`                                                                        | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` `--env-path`                                                 | هر دو          |
| `pusula setup-5dive`    | 5dive (ناوگان عاملها)       | هیچچیز در `$HOME` — یک **پروفایل احراز هویت** 5dive (`/var/lib/5dive/auth-profiles/<name>/`) را از طریق `5dive agent auth set` مینویسد؛ فقط برای root و روی میزبان ناوگان اجرا میشود | `--remote` `--api-key` `--model` `--auth-profile` `--agent` `--byo-provider` `--fivedive-bin` `--no-sudo` `--yes` `--dry-run` `--port`     | هر دو          |
| `pusula run <target>`   | اجرای زمان اجرا (عمومی)     | هیچچیز — `claude`/`codex`/`aider`/`goose`/`opencode`/`qwen`/`gemini` را با متغیرهای محیطی و آرگومانهای مناسب اجرا میکند؛ Qwen و Gemini از یک home موقت و ایزوله استفاده میکنند       | `--remote` `--base-url` `--context` `--provider` `--model` `--api-key` `--api-key-env` `--dry-run` `--json` `--port` `--profile` `--token` | هر دو          |
| `pusula launch`         | Claude Code                 | هیچچیز — `claude` را با `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` تزریقشده اجرا میکند                                                                                              | `--remote` `--api-key` `--token` `--profile` `--port`                                                                                      | هر دو          |
| `pusula launch-codex`   | OpenAI Codex CLI            | هیچچیز — `codex` را با provider مربوط به `pusula` که از طریق فلگهای `-c` تزریق شده است اجرا میکند                                                                                    | `--remote` `--api-key` `--profile` (`-p`) `--port`                                                                                         | هر دو          |

نکات مربوط به فلگها (در منبع فرمان تأیید شدهاند):

- `--remote <url>` — کاتالوگ را از یک Pusula راهدور دریافت میکند (`--port`
  و context فعال را نادیده میگیرد). `--api-key <key>` اطلاعات اعتبارسنجی آن
  سرور را فراهم میکند (مقدار پیشفرض، متغیر محیطی `PUSULA_API_KEY` یا token مربوط به context فعال است).
- `--only <patterns>` — زیررشتههای جداشده با ویرگول؛ فقط شناسههای مدلی را نگه میدارد که مطابقت دارند
  (برای مثال `--only glm,kimi`). در `setup-codex`، `setup-claude`،
  `setup-opencode`، `setup-continue`، `setup-cursor`، `setup-crush` و `setup-zed` موجود است.
- `--dry-run` — بدون تغییر در
  فایلسیستم، دقیقاً آنچه را که نوشته میشد چاپ میکند. در همه فرمانهای `setup-*` بهجز `setup-cursor`
  موجود است (که هرگز فایلی نمینویسد).
- `--model <id>` — برای ابزارهایی که
  کشف خودکار مدل ندارند الزامی است (یا بهصورت تعاملی انتخاب میشود): Cline، Kilo، Roo، Goose، Qwen، Aider و 5dive. این ابزارها
  همچنین برای اجراهای غیرتعاملی `--yes` را میپذیرند (که در این حالت `--model` الزامی است).
  `setup-opencode` برای تنظیم مدل پیشفرض سطحبالا، `--model` را میپذیرد.
- `--model <id>` در `pusula run` از سیمکشی اختصاصی هر target در manifest
  (`bin/cli/cli-manifest.mjs`) پیروی میکند: **aider** مقدار `--model openai/<id>` و
  **opencode** مقدار `--model pusula/<id>` را دریافت میکند (پیشوند فقط زمانی اضافه میشود که شناسه
  از قبل آن را نداشته باشد)؛ **qwen** و **gemini** شناسه را بدون تغییر دریافت میکنند؛
  **claude** آن را از طریق `ANTHROPIC_MODEL`، **goose** از طریق `GOOSE_MODEL` و
  **codex** از طریق آرگومانهای `-c model_providers.pusula.*` دریافت میکند. **Qwen تنها target اجرایی
  است که `--model` را اکیداً الزامی میداند** — اجرای `pusula run qwen` بدون آن، با
  خطای صریح و کد `2` خاتمه مییابد.
- `--port <port>` — پورت محلی Pusula (پیشفرض `20128`، و هنگام تنظیم بودن `--remote`
  نادیده گرفته میشود). در همه فرمانهای `setup-*` و هر دو launcher وجود دارد.
- کدهای خروج `pusula run`: کد خروج خود CLI فرزند بدون تغییر منتقل میشود؛
  `2` = آرگومانهای نامعتبر (target پشتیبانینشده، نبودن `--model` الزامی،
  محافظ container)؛ `127` = فایل اجرایی target در `PATH` نیست؛
  `130`/`143`/`129` هنگامی که اجرا توسط `SIGINT`/`SIGTERM`/`SIGHUP` پایان مییابد؛
  `1` = سایر خطاهای اجرای زمان اجرا.
- دو launcher (`launch`، `launch-codex`) گزینه `--profile <name>` را برای انتخاب
  پروفایلی که توسط `setup-claude` / `setup-codex` نوشته شده است میپذیرند، بههمراه آرگومانهای عبوری برای
  فایل اجرایی زیربنایی `claude` / `codex`.

انتخابگر تعاملی نیز بین دستورالعملهای راهاندازی مشترک است:

```bash
# از کاتالوگ مدل محلی یا راهدور فعال انتخاب کنید و target را پیکربندی کنید.
pusula configure claude
pusula configure opencode --provider glm
pusula configure qwen --model qwen/qwen3.8-max-preview --yes
```

`configure` در حال حاضر کار را به دستورالعملهای آزمودهشده برای `codex`، `claude`،
`opencode`، `qwen`، `aider`، `goose`، `cline`، `continue`، `kilo` و `5dive` واگذار میکند.
ورودیهای کاتالوگ مختص IDE،
MITM و صرفاً راهنما همچنان بهصورت جریانهای صریح `setup-*`/دستی باقی میمانند و
بهعنوان targetهای قابل اجرا ارائه نمیشوند.

> `setup-opencode` یک یکپارچهسازی **سبکوزن و سازگار با openai** برای OpenCode است.
> یک یکپارچهسازی غنیتر مبتنی بر plugin نیز وجود دارد — `pusula setup opencode` — که
> `@pusula/opencode-plugin` را نصب میکند. اینها فرمانهای متفاوتی هستند؛ جدول
> بالا `setup-opencode` را مستند میکند.
>
> این plugin در دو package عرضه میشود، یکی برای هر نسخه اصلی OpenCode، زیرا این دو
> loader انتظار entrypointهای متفاوتی دارند:
> `@pusula/opencode-plugin` برای OpenCode v1 و
> `@pusula/opencode-plugin-v2` برای OpenCode v2. package مربوط به v2 جدید است
> (`0.1.0`) و از قراردادی با host پیروی میکند که هنوز در حال تغییر است؛ بنابراین بهجای فرض کردن یک ساختار، ساختاری را میخواند که
> OpenCode در پیشنویس کاتالوگ قرار میدهد. برای نصب آن، یک ورودی `plugins` به `opencode.json` اضافه کنید؛ `pusula setup opencode`
> همچنان package مربوط به v1 را نصب میکند. گزینهها و ترتیب جستوجوی اطلاعات اعتبارسنجی در
> README مربوط به package آمدهاند.

---

## استفادهٔ محلی

درحالیکه Pusula روی `localhost:20128` در حال اجرا است، کافی است فرمان راهاندازی ابزار خود را اجرا کنید. کاتالوگ از سرور محلی دریافت میشود.

```bash
# Codex: برای هر مدل منطبق، یک پروفایل در ~/.codex/ بنویس
pusula setup-codex
codex --profile glm52            # استفاده از یک پروفایل تولیدشده

# Claude Code: پروفایلهای جداگانه برای هر مدل بنویس، سپس یکی را اجرا کن
pusula setup-claude
pusula launch --profile glm52

# OpenCode: ارائهدهندهٔ سازگار با openai را با همهٔ مدلهای کاتالوگ بنویس
pusula setup-opencode
export PUSULA_API_KEY=sk-...  # از طریق {env:PUSULA_API_KEY} ارجاع داده میشود و هرگز روی دیسک ذخیره نمیشود
opencode -m pusula/glm/glm-5.2 "..."

# ابزارهای فاقد کشف خودکار به یک مدل صریح نیاز دارند:
pusula setup-aider --model glm/glm-5.2
pusula setup-qwen --model qwen/qwen3.8-max-preview

# پیشنمایش بدون نوشتن هیچچیز:
pusula setup-continue --dry-run
```

اجرا بدون نوشتن هیچ پیکربندیای (فقط تزریق متغیرهای محیطی):

```bash
pusula launch                 # Claude Code ← Pusula محلی
pusula launch-codex           # Codex CLI ← Pusula محلی
pusula launch-codex --profile glm52
pusula run claude --model openai/gpt-5.4
pusula run codex --model openai/gpt-5.4 --dry-run --json
pusula run aider --model glm/glm-5.2 -- --message "reply OK"
pusula run goose --model glm/glm-5.2
pusula run opencode --model glm/glm-5.2 -- run "reply OK"
pusula run qwen --model glm/glm-5.2 -- -p "reply OK"
pusula run gemini --model glm/glm-5.2 -- --skip-trust -p "reply OK"

# مسیر صریح فرمان: هرآنچه پس از -- میآید بدون تغییر عبور داده شود
pusula run claude -- --print-system-prompt "review this diff"
```

---

## استفادهٔ راهدور

هر فرمان راهاندازی را با `--remote` + `--api-key` به یک Pusula راهدور متصل کنید. کاتالوگ از سرور راهدور دریافت میشود؛ پیکربندی روی دستگاه محلی شما نوشته میشود.

```bash
# استفاده از OpenCode با یک VPS راهدور و نگهداشتن فقط مدلهای glm/kimi
pusula setup-opencode --remote http://192.168.0.15:20128 --api-key oma_live_xxx \
  --only glm,kimi
opencode -m pusula/glm/glm-5.2 "..."   # ابتدا PUSULA_API_KEY را export کنید

# پروفایلهای Codex از یک کاتالوگ راهدور
pusula setup-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx

# اجرای مستقیم یک CLI روی سرور راهدور
pusula launch       --remote http://192.168.0.15:20128 --api-key oma_live_xxx
pusula launch-codex --remote http://192.168.0.15:20128 --api-key oma_live_xxx
```

بهجای ارسال هربارهٔ `--remote`/`--api-key`، یکبار وارد شوید و اجازه دهید **زمینهٔ فعال** آنها را بهطور خودکار فراهم کند:

```bash
pusula connect 192.168.0.15        # یک توکن محدود صادر و زمینه را ذخیره میکند
pusula setup-codex                 # ← اکنون از کاتالوگ راهدور استفاده میکند
pusula setup-opencode              # ← مشابه مورد بالا
pusula launch                      # ← اجرای Claude Code روی سرور راهدور
```

برای آشنایی با زمینهها، محدودهها و مدیریت توکن، به [حالت راهدور](./REMOTE-MODE.md) مراجعه کنید.

---

## ناوگان عاملهای 5dive

[5dive](https://5dive.ai) ناوگانی از عاملهای کدنویسی طولانیمدت را اجرا میکند که هریک یک واحد systemd تحت کاربر Unix اختصاصی خود هستند. خود آن یک CLI کدنویسی نیست، بنابراین چیزی وجود ندارد که `pusula run` آن را اجرا کند — `5dive` هدفی **صرفاً برای پیکربندی** است.

```bash
pusula configure 5dive --model failover-demo --yes
pusula setup-5dive --model failover-demo --auth-profile pusula --agent worker1
```

هر دو شکل، یک **پروفایل احراز هویت** 5dive مینویسند و سپس هر جایگاه `claude` متصل به آن پروفایل با Pusula ارتباط برقرار میکند. سه مورد مختص این هدف هستند:

- **این هدف روی میزبان ناوگان و با کاربر root اجرا میشود.** افعال 5dive روی واحدهای محلی systemd و یک دایرکتوری وضعیت متعلق به root عمل میکنند؛ حالت راهدور وجود ندارد. دستورالعمل، هنگامی که از قبل root نباشد، از طریق `sudo` دوباره اجرا میشود (`--no-sudo` این رفتار را غیرفعال میکند و در عوض فرمان را نمایش میدهد).
- **نقطهٔ پایانی باید `https://` باشد، مگر آنکه loopback باشد.** کلید API عامل در هر درخواست از طریق آن URL ارسال میشود و 5dive یک نقطهٔ پایانی خارج از میزبان با متن ساده را نمیپذیرد. یک نشانی LAN خصوصی نیز استثنا نیست.
- **مدل تثبیتشدهٔ خود هر جایگاه، بر پروفایل اولویت دارد.** پروفایل شامل `ANTHROPIC_DEFAULT_{OPUS,SONNET,HAIKU}_MODEL` است، اما جایگاهی که همچنان به یک شناسهٔ مدل استاندارد تثبیت شده باشد، در نخستین نوبت خود با خطای _"مدل انتخابشده مشکلی دارد"_ مواجه میشود. برای تثبیت جایگاهها نیز `--agent <name>` را ارسال کنید (قابل تکرار است)؛ اگر این کار را نکنید، دستورالعمل فرمان را نمایش میدهد.

کلید API از طریق **stdin** (`--api-key=-`) به 5dive تحویل داده میشود، بنابراین هرگز در خروجی `ps` ظاهر نمیشود.

هدایت پروفایل به یک **ترکیب** Pusula بهجای یک مدل منفرد، همان چیزی است که قابلیت جابهجایی هنگام خرابی ارائهدهنده را برای ناوگان فراهم میکند: هنگامی که نقطهٔ پایانی اصلی در میانهٔ یک نوبت از اجرای ثبتشده در
[#11578](https://github.com/Ferhat-Yasinoglu/pusula/issues/11578) بهطور کامل از دسترس خارج شد، عامل مراحل باقیماندهٔ خود را روی گزینهٔ جایگزین به پایان رساند و قطعی را هرگز به کاربر نشان نداد.

---

## قراردادهای URL پایه (اینکه کدام ابزارها `/v1` میخواهند)

Pusula رابط OpenAI را در `/v1`، رابط Anthropic را در ریشه،
و رابط بومی Gemini را در `/v1beta` ارائه میکند. هر یکپارچهسازی متناسب با قالبی پیکربندی شده است که
ابزار مربوطه انتظار دارد (در کد منبع فرمان تأیید شده است):

| یکپارچهسازی                                                                | URL پایه ثبتشده | `/v1`؟                                                   |
| -------------------------------------------------------------------------- | --------------- | -------------------------------------------------------- |
| `setup-cline` (`openAiBaseUrl`)                                            | ریشه            | خیر — Cline مسیر `/v1/chat/completions` را اضافه میکند   |
| `setup-goose` (`OPENAI_HOST`)                                              | ریشه            | خیر — Goose مسیر را اضافه میکند                          |
| `setup-aider` (`OPENAI_API_BASE`)                                          | ریشه            | خیر — LiteLLM مسیر `/v1/chat/completions` را اضافه میکند |
| `setup-kilo`، `setup-roo`، `setup-continue`، `setup-crush`، `setup-cursor` | همراه با `/v1`  | بله                                                      |
| `setup-zed` (`language_models.openai_compatible.pusula.api_url`)           | همراه با `/v1`  | بله                                                      |
| `setup-claude` (`ANTHROPIC_BASE_URL`)، `launch`                            | ریشه            | خیر — Claude Code مسیر `/v1/messages` را اضافه میکند     |
| `setup-codex`، `launch-codex` (`model_providers.pusula.base_url`)          | همراه با `/v1`  | بله                                                      |
| `setup-qwen` (`modelProviders.openai[].baseUrl`)                           | همراه با `/v1`  | بله                                                      |
| `run gemini` (`GOOGLE_GEMINI_BASE_URL`)                                    | ریشه            | خیر — SDK مسیر `/v1beta/models/…` را اضافه میکند         |
| `setup-5dive` (`ANTHROPIC_BASE_URL` در پروفایل احراز هویت)                 | ریشه            | خیر — Claude Code مسیر `/v1/messages` را اضافه میکند     |

---

## حفظ وابستگیهای بومی هنگام بهروزرسانی: `--include=optional`

هنگامی که با `pusula update` بهروزرسانی میکنید (پس از تأیید، یا با `--apply`)،
Pusula نصب را بهگونهای اجرا میکند که `--include=optional` از پیش در آن گنجانده شده است:

```bash
npm install -g pusula@latest --include=optional
```

این **پرچمی نیست** که به `pusula update` بدهید — بهروزرسان همیشه آن را
اعمال میکند. این کار تضمین میکند که `optionalDependencies` (`better-sqlite3`، `keytar`،
`tls-client` و پشته SLM مربوط به LLMLingua) پس از بهروزرسانی باقی بمانند، حتی اگر
در پیکربندی npm شما `omit=optional` تنظیم شده باشد؛ تنظیمی که در غیر این صورت،
درایور بومی SQLite و اتصال حلقهکلید سیستمعامل را بدون هیچ هشداری حذف میکرد.
برای پیشنمایش فرمان دقیق بدون اعمال آن:

```bash
pusula update --dry-run
# [اجرای آزمایشی] فرمانی که اجرا میشد: npm install -g pusula@latest --include=optional
```

سایر پرچمهای `pusula update` (تأییدشده در کد منبع): `--check` (اگر نسخه
قدیمی باشد با کد 1 خارج میشود)، `--apply` (نصب بدون درخواست تأیید)، `--changelog`، `--no-backup`،
`--yes`.

---

## Google Gemini CLI از طریق `pusula run gemini`

این قرارداد در برابر `@google/gemini-cli` 0.50.0 تأیید شده است: CLI متغیر
`GOOGLE_GEMINI_BASE_URL` را رعایت میکند و درخواست `POST /v1beta/models/<model>:generateContent`
(و `:streamGenerateContent?alt=sse`) را به آن ارسال میکند — دقیقاً مطابق رابط بومی
Gemini در Pusula (`/v1beta`). فرمان `pusula run gemini` این موارد را بهصورت خودکار تنظیم میکند:

- `GOOGLE_GEMINI_BASE_URL` ← URL پایه فعال Pusula (ریشه، بدون `/v1`)؛
- `GEMINI_API_KEY` ← اعتبارنامه حلشده Pusula (گزینه/محیط/زمینه)؛
- یک **`GEMINI_CLI_HOME` موقت و ایزوله** که فایل `.gemini/settings.json` آن
  احراز هویت `gemini-api-key` را انتخاب میکند؛ بنابراین نشست ذخیرهشده Google OAuth
  (Code Assist) هرگز اجرای هدایتشده به Pusula را بازنویسی نمیکند — و پس از خروج حذف میشود؛
- **پاکسازی محیط**: متغیرهای `GOOGLE_API_KEY`،
  `GOOGLE_GENAI_USE_VERTEXAI` و `GOOGLE_GENAI_USE_GCA` از محیط فرایند فرزند حذف میشوند
  (زیرا احراز هویت را به Vertex/Code Assist هدایت میکنند) و
  `GEMINI_DEFAULT_AUTH_TYPE=gemini-api-key` نیز بهعنوان راهکار احتیاطی مضاعف تنظیم
  میشود — سایر اهداف `run` نیز برای متغیرهای متداخل خود همین رفتار را دارند؛
- تزریق `--model <id>` از `--provider`/`--model`.

```bash
pusula run gemini --model glm/glm-5.2 -- --skip-trust -p "hello"
```

محافظ اعتماد به فضای کاری Gemini همچنان در حالت بدون رابط تعاملی اعمال میشود — خودتان
`--skip-trust` را ارسال کنید (یا دایرکتوری را بهصورت تعاملی مورد اعتماد قرار دهید)؛ راهانداز
عمداً آن را دور نمیزند. این راهانداز با **ثبت ACP**
(`src/lib/acp/registry.ts`، `gemini --acp`) متفاوت است؛ ثبت ACP همچنان
یکپارچهسازی پروتکل عامل برای `/dashboard/acp-agents` محسوب میشود.

---

## اجرای واقعی آزمونهای دود (اختیاری)

آزمونهای قطعی رگرسیونِ برنامه راهاندازی در CI اجرا میشوند (`tests/unit/cli/run-command.test.ts`،
`tests/unit/cli/run-execution.test.ts`). برای اعتبارسنجی فایلهای اجرایی واقعی در برابر یک سرور واقعی
Pusula، یک چارچوب آزمون اختیاری در
`tests/integration/upstream-cli-smoke.int.test.ts` وجود دارد. این آزمون هرگز بهطور خودکار اجرا نمیشود
(هر زیرآزمون، مگر اینکه `RUN_CLI_SMOKE=1` باشد، نادیده گرفته میشود)، نام متغیر محیطیِ حاوی اعتبارنامه
(و هرگز مقدار آن) را ارسال میکند، رشتههای دارای الگوی کلید را از هر خروجی ثبتشده حذف میکند، اهدافی
را که فایل اجرایی آنها نصب نشده است نادیده میگیرد و شکستها را بهجای یک مقدار بولی ساده، در دستههای
احراز هویت / بالادستی / پیکربندی طبقهبندی میکند:

```bash
RUN_CLI_SMOKE=1 \
PUSULA_SMOKE_BASE_URL="http://localhost:20128" \
PUSULA_SMOKE_MODEL="<provider/model>" \
PUSULA_SMOKE_API_KEY_ENV="PUSULA_API_KEY" \
node --import tsx/esm --test tests/integration/upstream-cli-smoke.int.test.ts
```

اختیاری: `PUSULA_SMOKE_TARGETS="codex,opencode,qwen"` دامنه آزمونها را محدود میکند؛
`PUSULA_SMOKE_TIMEOUT_MS` مهلت زمانی 120 ثانیهای هر هدف را بازنویسی میکند.

---

## همچنین ببینید

- [پیکربندی Claude Code](./CLAUDE-CODE-CONFIGURATION.md) — راهنمای جامعتر Claude Code
- [پیکربندی Codex CLI](./CODEX-CLI-CONFIGURATION.md) — راهاندازی اولیه و یکباره `[model_providers.pusula]`
- [حالت راه دور](./REMOTE-MODE.md) — زمینهها، توکنهای دسترسی محدودشده و کنترل یک سرور راه دور
- [مرجع ابزارهای CLI](../reference/CLI-TOOLS.md) — فهرست کامل ابزارهای پشتیبانیشده + صفحات داشبورد
- [راهنمای راهاندازی](./SETUP_GUIDE.md) — روشهای نصب و فرایند شروع اولیه
