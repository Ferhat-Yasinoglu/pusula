# CLI Integrations (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/CLI-INTEGRATIONS.md) · 🇩🇪 [de](../../../de/docs/guides/CLI-INTEGRATIONS.md) · 🇹🇷 [tr](../../../tr/docs/guides/CLI-INTEGRATIONS.md)

---

Pusula مجموعهای از دستورات `setup-*` را ارائه میدهد که یک CLI کدنویسی (Codex, Claude Code, OpenCode, Cline, …) را برای استفاده از Pusula به عنوان بکاند خود پیکربندی میکنند — به طوری که ابزار با **یک** نقطه پایانی صحبت میکند و Pusula با قابلیت بازگشت خودکار (auto-fallback) به ارائهدهنده صحیح مسیردهی میکند. هر دستور کاتالوگ مدل **زنده** را از یک Pusula در حال اجرا (محلی یا از راه دور) میخواند و فایل پیکربندی خود ابزار را روی دستگاه **شما** مینویسد. کلید API در هر کجا که ابزار از آن پشتیبانی کند، توسط یک متغیر محیطی ارجاع داده میشود. دستوراتی که یک فایل محیطی محلی ابزار را پایدار میکنند، در زیر ذکر شدهاند.

همچنین یک راهانداز عمومی — `pusula run <target>` — وجود دارد که `claude`, `codex`, `aider`, `goose`, `opencode`, `qwen` یا `gemini` را با تزریق محیط صحیح، بدون نوشتن هیچ پیکربندیای، اجرا میکند. اهداف (Targets) و نامهای مستعار (aliases) آنها از مانیفست متعارف `bin/cli/cli-manifest.mjs` میآیند (`claude-code|cc|anthropic`, `codex-cli|openai-codex|openai`, `goose-cli`, `open-code`, `qwen-code`, `gemini-cli`)، و `pusula completion` همان کلمات هدف مشتق شده از مانیفست را ارائه میدهد. راهاندازهای قدیمیتر برای هر ابزار — `pusula launch` (Claude Code) و `pusula launch-codex` (Codex) — همچنان در دسترس هستند.

پذیرش ارائهدهنده (Provider onboarding) از همان بستر محلی/از راه دور در دسترس است. دستورات API-first زیر، احراز هویت مدیریت را از اعتبارنامههای ارائهدهنده جدا نگه میدارند و هرگز یک اعتبارنامه را در خروجی ساختاریافته چاپ نمیکنند:

```bash
pusula providers add glm --credential-env GLM_API_KEY --name work
pusula providers import ./providers.json --dry-run --json
pusula providers auth openai
pusula providers edit <connection-id> --default-model glm/glm-5.2
pusula providers remove <connection-id> --yes
```

برای اسکریپتها، `--credential-stdin` یا `--credential-env` را ترجیح دهید؛ `--credential` برای استفاده محلی کنترلشده حفظ شده است. `providers remove` در یک ترمینال غیرتعاملی به `--yes` نیاز دارد، و هر پنج دستور از بستر فعال یا گزینههای سراسری `--base-url`/`--api-key` پیروی میکنند.

انتخابگرهای ارائهدهنده، پیشوندهای ID، نامها یا نامهای ارائهدهنده مبهم را رد میکنند؛ هنگامی که چندین اتصال مطابقت دارند، از یک ID اتصال کامل استفاده کنید. دستورات ایجاد و ویرایش، اتصال ذخیرهشده را دوباره میخوانند، و حذف تأیید میکند که دیگر قابل خواندن نیست. یک واردات (import) از یک جفت ارائهدهنده/نام موجود صرف نظر میکند. ورودیهای وارد شده نمیتوانند نقطه پایانی مدیریت، بستر یا اعتبارنامههای مدیریتی ارائه شده به CLI را نادیده بگیرند.

برای راهاندازی پایه یکباره و دستی دو یکپارچهسازی غنیتر، به بررسیهای عمیق (deep dives) هر ابزار مراجعه کنید:

- [پیکربندی Claude Code](./CLAUDE-CODE-CONFIGURATION.md)
- [پیکربندی Codex CLI](./CODEX-CLI-CONFIGURATION.md)
- [حالت از راه دور](./REMOTE-MODE.md) — یک Pusula از راه دور (VPS / Tailnet) را از لپتاپ خود کنترل کنید

---

## جدول جامع

هر فرمان از **زمینه فعال** (که با `pusula connect` تنظیم میشود؛
[حالت راهدور](./REMOTE-MODE.md) را ببینید) یا پرچمهای صریح
`--remote <url> --api-key <key>` پیروی میکند.
منظور از «محلی در برابر راهدور» در ادامه این است: بدون هیچ پرچمی،
`http://localhost:20128` هدف قرار میگیرد؛ با `--remote` (یا یک زمینه راهدور
فعال)، کاتالوگ از آن سرور دریافت و پیکربندی بهصورت محلی نوشته میشود.

| فرمان                      | ابزار                       | آنچه مینویسد                                                                                                                                                                       | پرچمهای کلیدی                                                                                                                              | محلی یا راهدور |
| -------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------- |
| `pusula setup-codex`    | OpenAI Codex CLI            | `~/.codex/<name>.config.toml` — یک پروفایل برای هر مدل متنی سازگار (`codex --profile <name>`)                                                                                      | `--remote` `--api-key` `--only` `--dry-run` `--port` `--codex-home`                                                                        | هر دو          |
| `pusula setup-claude`   | Claude Code                 | `~/.claude/profiles/<name>/settings.json` — یک پروفایل برای هر مدل منطبق (`CLAUDE_CONFIG_DIR`)                                                                                     | `--remote` `--api-key` `--only` `--dry-run` `--port` `--claude-home`                                                                       | هر دو          |
| `pusula setup-opencode` | OpenCode (سازگار با openai) | `~/.config/opencode/opencode.json` — ارائهدهندهٔ `pusula` همراه با همهٔ مدلهای کاتالوگ (`opencode -m pusula/<model>`)                                                        | `--remote` `--api-key` `--only` `--model` `--dry-run` `--port`                                                                             | هر دو          |
| `pusula setup-cline`    | Cline                       | `~/.cline/data/{globalState,secrets}.json` (حالت CLI) + تنظیمات افزونهٔ VS Code را نمایش میدهد                                                                                     | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--cline-dir`                                                                | هر دو          |
| `pusula setup-kilo`     | Kilo Code                   | `~/.local/share/kilo/auth.json` (CLI) + در صورت وجود `settings.json` مربوط به VS Code، مقادیر `kilocode.*` را در آن ادغام میکند                                                    | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--auth-path` `--vscode-settings`                                            | هر دو          |
| `pusula setup-continue` | Continue / `cn` CLI         | `~/.continue/config.yaml` — مدلهای `provider: openai`، با کلید از طریق `${{ secrets.PUSULA_API_KEY }}`                                                                          | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | هر دو          |
| `pusula setup-cursor`   | Cursor                      | هیچچیز — مراحل درونبرنامهای را نمایش میدهد (پیکربندی Cursor یک SQLite غیرشفاف است)                                                                                                 | `--remote` `--api-key` `--only` `--port`                                                                                                   | هر دو          |
| `pusula setup-roo`      | Roo Code                    | `~/.pusula/roo-settings.json` (سند واردسازی) + در صورت وجود `settings.json` مربوط به VS Code، مقدار `roo-cline.autoImportSettingsPath` را تنظیم میکند                           | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--import-path` `--vscode-settings`                                          | هر دو          |
| `pusula setup-crush`    | Crush                       | `~/.config/crush/crush.json` — ارائهدهندهٔ `openai-compat`، با کلید از طریق `$PUSULA_API_KEY`                                                                                   | `--remote` `--api-key` `--only` `--dry-run` `--port` `--config-path`                                                                       | هر دو          |
| `pusula setup-goose`    | Goose                       | `~/.config/goose/config.yaml` (`GOOSE_PROVIDER`/`OPENAI_HOST`/`GOOSE_MODEL`) + دستورالعمل متغیرهای محیطی را نمایش میدهد                                                            | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | هر دو          |
| `pusula setup-aider`    | Aider                       | `~/.aider.conf.yml` (`openai-api-base` + `model: openai/<id>`) + دستورالعمل متغیرهای محیطی را نمایش میدهد                                                                          | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path`                                                              | هر دو          |
| `pusula setup-qwen`     | Qwen Code                   | `~/.qwen/settings.json` — آرایهٔ V4 به نام `modelProviders.openai` + متغیر `PUSULA_API_KEY` در `~/.qwen/.env`                                                                   | `--remote` `--api-key` `--model` `--yes` `--dry-run` `--port` `--config-path` `--env-path`                                                 | هر دو          |
| `pusula setup-5dive`    | 5dive (ناوگان عاملها)       | هیچچیز زیر `$HOME` — از طریق `5dive agent auth set` یک **پروفایل احراز هویت** 5dive (`/var/lib/5dive/auth-profiles/<name>/`) مینویسد؛ فقط برای root و روی میزبان ناوگان اجرا میشود | `--remote` `--api-key` `--model` `--auth-profile` `--agent` `--byo-provider` `--fivedive-bin` `--no-sudo` `--yes` `--dry-run` `--port`     | هر دو          |
| `pusula run <target>`   | اجرای زمان اجرا (عمومی)     | هیچچیز — `claude`/`codex`/`aider`/`goose`/`opencode`/`qwen`/`gemini` را با متغیرهای محیطی و آرگومانهای درست اجرا میکند؛ Qwen و Gemini از یک home موقت و ایزوله استفاده میکنند      | `--remote` `--base-url` `--context` `--provider` `--model` `--api-key` `--api-key-env` `--dry-run` `--json` `--port` `--profile` `--token` | هر دو          |
| `pusula launch`         | Claude Code                 | هیچچیز — `claude` را با تزریق `ANTHROPIC_BASE_URL`/`ANTHROPIC_AUTH_TOKEN` اجرا میکند                                                                                               | `--remote` `--api-key` `--token` `--profile` `--port`                                                                                      | هر دو          |
| `pusula launch-codex`   | OpenAI Codex CLI            | هیچچیز — `codex` را با ارائهدهندهٔ `pusula` که از طریق پرچمهای `-c` تزریق شده است اجرا میکند                                                                                    | `--remote` `--api-key` `--profile` (`-p`) `--port`                                                                                         | هر دو          |

نکاتی دربارهٔ فلگها (تأییدشده در کد منبع فرمان):

- `--remote <url>` — کاتالوگ را از یک Pusula راهدور دریافت میکند (`--port`
  و context فعال را نادیده میگیرد). `--api-key <key>` اعتبارنامهٔ آن
  سرور را فراهم میکند (مقدار پیشفرض، متغیر محیطی `PUSULA_API_KEY` یا توکن context فعال است).
- `--only <patterns>` — زیررشتههایی با جداکنندهٔ ویرگول؛ فقط شناسههای مدلی را نگه میدارد که مطابقت دارند
  (برای مثال `--only glm,kimi`). در `setup-codex`، `setup-claude`،
  `setup-opencode`، `setup-continue`، `setup-cursor` و `setup-crush` در دسترس است.
- `--dry-run` — دقیقاً آنچه را که قرار است نوشته شود، بدون دستزدن به
  سیستم فایل چاپ میکند. در تمام فرمانهای `setup-*` **بهجز** `setup-cursor`
  در دسترس است (که هیچگاه فایلی نمینویسد).
- `--model <id>` — برای ابزارهایی که کشف خودکار مدل ندارند، الزامی است (یا بهشکل تعاملی انتخاب میشود):
  Cline، Kilo، Roo، Goose، Qwen، Aider و 5dive. این ابزارها
  برای اجراهای غیرتعاملی، `--yes` را نیز میپذیرند (که در این صورت `--model` الزامی است).
  `setup-opencode` برای تنظیم مدل پیشفرض سطح بالا، `--model` را میپذیرد.
- `--model <id>` در `pusula run` از سیمبندی هر هدف در manifest
  (`bin/cli/cli-manifest.mjs`) پیروی میکند: **aider** مقدار `--model openai/<id>` و
  **opencode** مقدار `--model pusula/<id>` را دریافت میکند (پیشوند فقط زمانی افزوده میشود که شناسه
  از قبل آن را نداشته باشد)؛ **qwen** و **gemini** شناسه را عیناً دریافت میکنند؛
  **claude** آن را از طریق `ANTHROPIC_MODEL`، **goose** از طریق `GOOSE_MODEL` و
  **codex** از طریق آرگومانهای `-c model_providers.pusula.*` دریافت میکنند. **Qwen تنها هدف run است
  که وجود `--model` را بهصورت قطعی الزامی میکند** — اجرای `pusula run qwen` بدون آن
  با خطای صریح و کد `2` خارج میشود.
- `--port <port>` — پورت محلی Pusula (مقدار پیشفرض `20128` است و وقتی `--remote`
  تنظیم شده باشد، نادیده گرفته میشود). در تمام فرمانهای `setup-*` و هر دو launcher وجود دارد.
- کدهای خروج `pusula run`: کد خروج خود CLI فرزند عیناً
  منتقل میشود؛ `2` = آرگومانهای نامعتبر (هدف پشتیبانینشده، نبود `--model`
  الزامی، محافظ container)؛ `127` = فایل اجرایی هدف در `PATH` نیست؛
  `130`/`143`/`129` زمانی که اجرا با `SIGINT`/`SIGTERM`/`SIGHUP` پایان یابد؛
  `1` = سایر خطاهای زمان اجرای راهاندازی.
- دو launcher (`launch` و `launch-codex`) برای انتخاب profileای که
  `setup-claude` / `setup-codex` نوشته است، `--profile <name>` را میپذیرند؛ همچنین آرگومانهای عبوری
  برای فایل اجرایی زیربنایی `claude` / `codex` را قبول میکنند.

انتخابگر تعاملی نیز میان دستورالعملهای راهاندازی مشترک است:

```bash
# از کاتالوگ مدل محلی یا راهدور فعال انتخاب کنید و هدف را پیکربندی کنید.
pusula configure claude
pusula configure opencode --provider glm
pusula configure qwen --model qwen/qwen3.8-max-preview --yes
```

در حال حاضر `configure` اجرای دستورالعملهای آزمایششده برای `codex`، `claude`،
`opencode`، `qwen`، `aider`، `goose`، `cline`، `continue`، `kilo` و `5dive` را واگذار میکند.
ورودیهای کاتالوگِ مختص IDE،
MITM و صرفاً راهنما همچنان جریانهای صریح `setup-*`/دستی باقی میمانند و
بهعنوان اهداف قابل اجرا ارائه نمیشوند.

> `setup-opencode` یکپارچهسازی **سبکوزن و سازگار با openai** برای OpenCode است.
> یک یکپارچهسازی افزونهای غنیتر نیز وجود دارد — `pusula setup opencode` — که
> `@pusula/opencode-plugin` را نصب میکند. اینها فرمانهای متفاوتی هستند؛ جدول
> بالا `setup-opencode` را مستند میکند.
>
> این افزونه در دو package عرضه میشود، یکی برای هر نسخهٔ اصلی OpenCode، زیرا این دو
> loader انتظار entrypointهای متفاوتی دارند:
> `@pusula/opencode-plugin` برای OpenCode v1 و
> `@pusula/opencode-plugin-v2` برای OpenCode v2. package مربوط به v2 جدید است
> (`0.1.0`) و از قرارداد میزبانی پیروی میکند که هنوز در حال تغییر است؛ بنابراین بهجای فرضکردن یک ساختار،
> ساختاری را میخواند که OpenCode در پیشنویس کاتالوگ مقداردهی اولیه میکند. برای نصب
> آن، یک ورودی `plugins` به `opencode.json` اضافه کنید؛ `pusula setup opencode`
> همچنان package مربوط به v1 را نصب میکند. گزینهها و ترتیب جستوجوی اعتبارنامه در
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

## قراردادهای URL پایه (کدام ابزارها `/v1` را میخواهند)

Pusula رابط OpenAI را در `/v1`، رابط Anthropic را در ریشه،
و رابط بومی Gemini را در `/v1beta` ارائه میکند. هر یکپارچهسازی مطابق قالبی
پیکربندی شده است که ابزار مربوطه انتظار دارد (در کد منبع فرمان تأیید شده است):

| یکپارچهسازی                                                                | URL پایه ثبتشده | `/v1`؟                                                |
| -------------------------------------------------------------------------- | --------------- | ----------------------------------------------------- |
| `setup-cline` (`openAiBaseUrl`)                                            | ریشه            | خیر — Cline مسیر `/v1/chat/completions` را میافزاید   |
| `setup-goose` (`OPENAI_HOST`)                                              | ریشه            | خیر — Goose مسیر را میافزاید                          |
| `setup-aider` (`OPENAI_API_BASE`)                                          | ریشه            | خیر — LiteLLM مسیر `/v1/chat/completions` را میافزاید |
| `setup-kilo`, `setup-roo`, `setup-continue`, `setup-crush`, `setup-cursor` | همراه با `/v1`  | بله                                                   |
| `setup-claude` (`ANTHROPIC_BASE_URL`), `launch`                            | ریشه            | خیر — Claude Code مسیر `/v1/messages` را میافزاید     |
| `setup-codex`, `launch-codex` (`model_providers.pusula.base_url`)       | همراه با `/v1`  | بله                                                   |
| `setup-qwen` (`modelProviders.openai[].baseUrl`)                           | همراه با `/v1`  | بله                                                   |
| `run gemini` (`GOOGLE_GEMINI_BASE_URL`)                                    | ریشه            | خیر — SDK مسیر `/v1beta/models/…` را میافزاید         |
| `setup-5dive` (`ANTHROPIC_BASE_URL` در پروفایل احراز هویت)                 | ریشه            | خیر — Claude Code مسیر `/v1/messages` را میافزاید     |

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
