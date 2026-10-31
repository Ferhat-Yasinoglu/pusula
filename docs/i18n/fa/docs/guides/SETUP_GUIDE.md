# 📖 Setup Guide — Pusula (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/SETUP_GUIDE.md) · 🇩🇪 [de](../../../de/docs/guides/SETUP_GUIDE.md) · 🇹🇷 [tr](../../../tr/docs/guides/SETUP_GUIDE.md)

---

> مرجع کامل راهاندازی Pusula. برای نسخه سریع، به [شروع سریع در README](../README.md#-quick-start) مراجعه کنید.

## فهرست مطالب

- [روشهای نصب](#install-methods)
- [پیکربندی ابزار CLI](#cli-tool-configuration)
- [راهاندازی پروتکلها (MCP + A2A)](#protocol-setup-mcp--a2a)
- [پیکربندی مهلت زمانی](#timeout-configuration)
- [حالت پورت مجزا](#split-port-mode)
- [Void Linux (xbps-src)](#void-linux-xbps-src-template)
- [حذف نصب](#uninstalling)

---

## روشهای نصب

### npm (پیشنهادشده)

```bash
npm install -g pusula
pusula
```

داشبورد در `http://localhost:20128` باز میشود و URL پایه API برابر با `http://localhost:20128/v1` است.

### pnpm

```bash
pnpm add -g pusula@latest --allow-build=better-sqlite3 --allow-build=@swc/core
pusula
```

> **کاربران pnpm:** پرچم `--allow-build` برای فعالسازی اسکریپتهای ساخت بومی `better-sqlite3` و `@swc/core` ضروری است. فرمان `pnpm approve-builds -g` برای نصبهای سراسری در pnpm v11 پشتیبانی نمیشود.

### Arch Linux (AUR)

```bash
yay -S pusula-bin
systemctl --user enable --now pusula.service
```

[بسته AUR](https://aur.archlinux.org/packages/pusula-bin)، Pusula را نصب میکند و یک سرویس کاربری systemd ارائه میدهد.

### ساخت از کد منبع

```bash
npm install
PORT=20128 DASHBOARD_PORT=20129 NEXT_PUBLIC_BASE_URL=http://localhost:20129 npm run dev
```

> **نکته برای Windows:** بهطور پیشفرض، وقتی پوشه قدیمی `%USERPROFILE%\.pusula` وجود نداشته باشد، Pusula از `%APPDATA%\pusula` استفاده میکند. برای انتخاب محل دیگری برای پوشه داده، `DATA_DIR` را تنظیم کنید.

> **نکته:** در اولین اجرا، `npm install` بهطور خودکار فایل `.env` را از روی `.env.example` ایجاد میکند. نصبهای بعدی فایل `.env` موجود را بازنویسی نمیکنند؛ بنابراین سفارشیسازیها حفظ میشوند. برای ایجاد مجدد، پیش از اجرای دوباره، `.env` را حذف کنید.

### Docker

برای راهاندازی کامل Docker، شامل پروفایلهای Compose و HTTPS با Caddy، به [راهنمای Docker](./DOCKER_GUIDE.md) مراجعه کنید.

### برنامه دسکتاپ (Electron)

Pusula همراه با یک پوسته دسکتاپ مبتنی بر Electron 41 + electron-builder 26.10 عرضه میشود. اسکریپتهای موجود (در ریشه workspace):

```bash
npm run electron:dev          # اجرای نسخه دسکتاپ با بارگذاری مجدد خودکار
npm run electron:build        # ساخت برای سیستمعامل فعلی (با تشخیص خودکار)
npm run electron:build:win    # نصبکننده Windows (NSIS + نسخه قابلحمل)
npm run electron:build:mac    # macOS (dmg + zip، arm64+x64)
npm run electron:build:linux  # Linux (AppImage + deb + rpm)
npm run electron:smoke:packaged  # آزمون دود نسخه بستهبندیشده
```

نسخههای منتشرشده نصبکنندههای دسکتاپ به GitHub Releases پیوست میشوند. برای بررسی عمیق و کامل Electron (امضای دیجیتال، پل IPC و توزیعها)، به [`ELECTRON_GUIDE.md`](./ELECTRON_GUIDE.md) مراجعه کنید _(در مرحلهای بعد ایجاد شده است)_.

### سرور بدون رابط گرافیکی (CI/اتوماسیون)

برای راهاندازیهای بدون نظارت (Docker، Kubernetes و CI)، از موارد زیر استفاده کنید:

```bash
pusula setup --non-interactive
pusula providers test-batch
```

در ترکیب با متغیرهای محیطی (`INITIAL_PASSWORD`، `PUSULA_WS_BRIDGE_SECRET` و غیره)، این امکان را به شما میدهد که یک نمونه Pusula را بهصورت کاملاً اسکریپتپذیر راهاندازی کنید.

### گزینههای CLI

| فرمان                | توضیحات                                                               |
| -------------------- | --------------------------------------------------------------------- |
| `pusula`             | راهاندازی سرور (`PORT=20128`، API و داشبورد روی یک پورت)              |
| `pusula setup`       | راهاندازی هدایتشده CLI برای گذرواژه و اولین ارائهدهنده                |
| `pusula doctor`      | اجرای بررسیهای سلامت محلی بدون راهاندازی سرور                         |
| `pusula providers`   | شناسایی، فهرستکردن، اعتبارسنجی و آزمایش ارائهدهندگان از طریق CLI      |
| `pusula config`      | پیکربندی ابزار CLI — فهرستکردن، دریافت، تنظیم و اعتبارسنجی پیکربندیها |
| `pusula status`      | داشبورد وضعیت آفلاین — نسخه، DB، ابزارها و پیکربندی                   |
| `pusula logs`        | پخش زنده گزارشهای استفاده از API (با پشتیبانی از `--follow`)          |
| `pusula update`      | بررسی یا اعمال بهروزرسانیهای Pusula                                   |
| `pusula provider`    | مدیریت اتصال ارائهدهندگان — افزودن، فهرستکردن، حذف، آزمایش و پیشفرض   |
| `pusula --port 3000` | تنظیم پورت اصلی/API روی 3000                                          |
| `pusula --mcp`       | راهاندازی سرور MCP (انتقال stdio)                                     |
| `pusula --no-open`   | جلوگیری از بازشدن خودکار مرورگر                                       |
| `pusula --help`      | نمایش راهنما                                                          |

راهاندازی بدون رابط گرافیکی را میتوان با پرچمها یا متغیرهای محیطی اسکریپتنویسی کرد:

```bash
pusula setup --non-interactive --password "$PUSULA_PASSWORD"
pusula setup --non-interactive --add-provider --provider openai --api-key "$OPENAI_API_KEY"
pusula setup --non-interactive --add-provider --provider openai --api-key "$OPENAI_API_KEY" --test-provider
```

عیبیابی محلی را بدون بازکردن داشبورد اجرا کنید:

```bash
pusula doctor
pusula doctor --json
pusula doctor --no-liveness
```

ارائهدهندگان را از طریق SSH یا اسکریپتها و بدون بازکردن داشبورد مدیریت کنید:

```bash
pusula providers available
pusula providers available --search openai
pusula providers available --category api-key
pusula providers list
pusula providers test <id-or-name>
pusula providers test-all
pusula providers validate
```

---

## پیکربندی ابزار CLI

### 1) اتصال ارائهدهندگان و ایجاد کلید API

1. داشبورد → `Providers` را باز کنید و حداقل یک ارائهدهنده را متصل کنید (OAuth یا کلید API).
2. داشبورد → `Endpoints` را باز کنید و یک کلید API بسازید.
3. (اختیاری) داشبورد → `Combos` را باز کنید و زنجیره جایگزین خود را تنظیم کنید.

### 2) هدایت ابزار کدنویسی شما

```txt
نشانی پایه: http://localhost:20128/v1
کلید API:  [از صفحه Endpoint کپی کنید]
مدل:    if/qwen3.8-max-preview (یا هر پیشوند ارائهدهنده/مدل دیگر)
```

اگر ویرایشگر شما نمیتواند `Authorization: Bearer ...` را ارسال کند، بهجای آن از نشانی پایه سازگاریِ توکندار استفاده کنید:

```txt
نشانی پایه: http://localhost:20128/api/v1/vscode/YOUR_KEY/
نشانی مدلها: http://localhost:20128/api/v1/vscode/YOUR_KEY/models
نشانی چت: http://localhost:20128/api/v1/vscode/YOUR_KEY/chat/completions
نشانی برچسبهای Ollama: http://localhost:20128/api/v1/vscode/YOUR_KEY/api/tags
```

با Claude Code، Codex CLI، Cursor، Cline، OpenClaw، OpenCode و SDKهای سازگار با OpenAI کار میکند.

#### پیکربندی خودکار با `setup-*`

بهجای وارد کردن دستی نشانی پایه و کلید، اجازه دهید Pusula پیکربندی اختصاصی هر ابزار را
از کاتالوگ زنده مدلها بنویسد. برای هر ابزار یک فرمان:

```bash
pusula setup-codex        # پروفایلهای ~/.codex/<name>.config.toml
pusula setup-claude       # ~/.claude/profiles/<name>/settings.json
pusula setup-opencode     # ~/.config/opencode/opencode.json (سازگار با OpenAI)
pusula setup-cline        # تنظیمات Cline CLI و افزونه VS Code
pusula setup-kilo         # Kilo Code
pusula setup-continue     # ~/.continue/config.yaml (Continue / cn)
pusula setup-cursor       # مراحل درونبرنامهای Cursor را نمایش میدهد
pusula setup-roo          # درونریزی Roo Code و اشارهگر autoImport
pusula setup-crush        # ~/.config/crush/crush.json
pusula setup-zed          # ~/.config/zed/settings.json (openai_compatible)
pusula setup-goose        # ~/.config/goose/config.yaml
pusula setup-aider        # ~/.aider.conf.yml
pusula setup-qwen         # ~/.qwen/settings.json + ~/.qwen/.env
```

هرکدام برای پیکربندی یک ابزار محلی جهت استفاده از یک Pusula
**راهدور**، گزینههای `--remote <url> --api-key <key>` و برای پیشنمایش گزینه `--dry-run` را میپذیرند. برای اجرای یک CLI با
متغیرهای محیطی مناسب، بدون نوشتن هیچگونه پیکربندی، از اجراکننده عمومی
`pusula run <target>` (claude، codex، aider، goose، opencode، qwen، gemini) استفاده کنید؛
اجراکنندههای قدیمی مختص هر ابزار، یعنی `pusula launch` (Claude Code) و
`pusula launch-codex` (Codex)، همچنان در دسترس هستند.

برای مشاهده جدول کامل (اینکه هر فرمان چه چیزی مینویسد، همه گزینهها، حالت محلی در برابر راهدور و قراردادهای نشانی پایه
`/v1`)، به **[یکپارچهسازیهای CLI](./CLI-INTEGRATIONS.md)** مراجعه کنید.

برای پیکربندی تفصیلی هر ابزار (Claude Code، Codex CLI، Cursor، Cline، OpenClaw، Kilo Code، Copilot و موارد دیگر)، به **[راهنمای ابزارهای CLI](../reference/CLI-TOOLS.md)** اختصاصی مراجعه کنید.

---

## راهاندازی پروتکل (MCP + A2A)

### راهاندازی MCP (پروتکل زمینه مدل)

انتقال MCP را در حالت stdio آغاز کنید:

```bash
pusula --mcp
```

روند پیشنهادی اعتبارسنجی:

```bash
# 1. سرور MCP را راهاندازی کنید
pusula --mcp

# 2. از کلاینت MCP خود، موارد زیر را فراخوانی کنید:
pusula_get_health        # باید سلامت سیستم را برگرداند
pusula_list_combos       # باید ترکیبهای فعال را برگرداند

# 3. یا مجموعه کامل E2E را اجرا کنید:
npm run test:protocols:e2e
```

#### پیکربندی کلاینت MCP

**Claude Code:**

```bash
claude mcp add-server pusula --type http --url http://localhost:20128/api/mcp/stream
```

**Cursor / Cline:**

این مورد را به تنظیمات MCP خود اضافه کنید:

```json
{
  "mcpServers": {
    "pusula": {
      "command": "pusula",
      "args": ["--mcp"],
      "env": {}
    }
  }
}
```

**مستندات کامل MCP:** [README سرور MCP](../../open-sse/mcp-server/README.md) — شامل 110 ابزار، پیکربندیهای IDE و کلاینتهای Python/TS/Go.

### راهاندازی A2A (پروتکل عاملبهعامل)

کارت عامل را بررسی کنید:

```bash
curl http://localhost:20128/.well-known/agent.json
```

یک وظیفه ارسال کنید:

```bash
curl -X POST http://localhost:20128/a2a \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":"quickstart","method":"message/send","params":{"skill":"quota-management","messages":[{"role":"user","content":"Give me a short quota summary."}]}}'
```

**مستندات کامل A2A:** [README سرور A2A](../../src/lib/a2a/README.md) — شامل JSON-RPC 2.0، مهارتها، استریم و چرخه عمر وظیفه.

---

## پیکربندی مهلت زمانی

### مهلتهای زمانی پایه

برای بیشتر استقرارها، فقط به این دو متغیر نیاز دارید:

| متغیر                    | مقدار پیشفرض                         | هدف                                                                                                                 |
| ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `REQUEST_TIMEOUT_MS`     | `600000`                             | مبنای مشترک برای مهلت شروع پاسخ بالادست، مهلتهای پنهان Undici، درخواستهای اثرانگشت TLS و مهلت درخواست/پراکسی پل API |
| `STREAM_IDLE_TIMEOUT_MS` | از `REQUEST_TIMEOUT_MS` به ارث میبرد | حداکثر فاصله بین قطعههای استریم پیش از آنکه Pusula استریم SSE را متوقف کند                                          |

سازگاری با نسخههای پیشین حفظ شده است: متغیرهای مهلت زمانی موجود مانند `FETCH_TIMEOUT_MS`،‏ `API_BRIDGE_PROXY_TIMEOUT_MS` و سایر متغیرهای مهلت زمانی مختص هر لایه همچنان کار میکنند و مقدار مبنای مشترک را بازنویسی میکنند.

### نکات مختص ارائهدهنده

برای سرویسهای بالادست سازگار با Claude Code (`anthropic-compatible-cc-*`)، Pusula هدر خروجی `X-Stainless-Timeout` را از مهلت واکشی نهاییشده استخراج میکند تا مهلتهای خواندن در سمت ارائهدهنده با پیکربندی محیطی شما همراستا بمانند.

برای پراکسیهای معکوس شخص ثالثِ سازگار با Claude Code، Pusula مجموعه پیشفرض `anthropic-beta` را محافظهکارانه نگه میدارد و هنگامی که `Client Cache Control` روی `Auto` باقی مانده باشد، فقط نشانگرهای `cache_control` ارائهشده توسط کلاینت را ارسال میکند. گزینه «Enable redact-thinking beta» را برای هر اتصال تنها زمانی فعال کنید که سرویس بالادست مشخصاً به استریمهای تفکر ویرایششده Claude نیاز داشته باشد.

### بازنویسیهای پیشرفته مهلت زمانی

| متغیر                                    | مقدار پیشفرض                                     | هدف                                                                     |
| ---------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| `FETCH_TIMEOUT_MS`                       | از `REQUEST_TIMEOUT_MS` به ارث میبرد             | مهلت شروع پاسخ بالادست که تا زمان دریافت هدرهای پاسخ استفاده میشود      |
| `FETCH_HEADERS_TIMEOUT_MS`               | از `FETCH_TIMEOUT_MS` به ارث میبرد               | محدودیت زمانی Undici برای دریافت هدرهای پاسخ بالادست                    |
| `FETCH_BODY_TIMEOUT_MS`                  | از `FETCH_TIMEOUT_MS` به ارث میبرد               | محدودیت زمانی Undici بین قطعههای بدنه بالادست (`0` آن را غیرفعال میکند) |
| `FETCH_CONNECT_TIMEOUT_MS`               | `30000`                                          | مهلت اتصال TCP در Undici                                                |
| `FETCH_KEEPALIVE_TIMEOUT_MS`             | `4000`                                           | مهلت سوکت keep-alive بیکار در Undici                                    |
| `TLS_CLIENT_TIMEOUT_MS`                  | از `FETCH_TIMEOUT_MS` به ارث میبرد               | مهلت درخواستهای اثرانگشت TLS که از طریق `wreq-js` انجام میشوند          |
| `API_BRIDGE_PROXY_TIMEOUT_MS`            | از `REQUEST_TIMEOUT_MS` یا `600000` به ارث میبرد | مهلت ارسال پراکسی `/v1` از پورت API به پورت داشبورد                     |
| `API_BRIDGE_SERVER_REQUEST_TIMEOUT_MS`   | `max(API_BRIDGE_PROXY_TIMEOUT_MS, 300000)`       | مهلت درخواست ورودی در سرور پل API                                       |
| `API_BRIDGE_SERVER_HEADERS_TIMEOUT_MS`   | `60000`                                          | مهلت هدر ورودی در سرور پل API                                           |
| `API_BRIDGE_SERVER_KEEPALIVE_TIMEOUT_MS` | `5000`                                           | مهلت keep-alive در سرور پل API                                          |
| `API_BRIDGE_SERVER_SOCKET_TIMEOUT_MS`    | `0`                                              | مهلت عدم فعالیت سوکت در سرور پل API (`0` آن را غیرفعال میکند)           |

> **نکته:** برای درخواستهای استریم، `FETCH_TIMEOUT_MS` فقط برپایی اتصال / انتظار برای نخستین پاسخ بالادست را پوشش میدهد. پس از فعال شدن استریم، Pusula فقط در صورت توقف واقعی (`STREAM_IDLE_TIMEOUT_MS`) یا عدم فعالیت بدنه Undici (`FETCH_BODY_TIMEOUT_MS`) آن را متوقف میکند.

### سازگاری با پراکسی معکوس

اگر Pusula را پشت Nginx، Caddy، Cloudflare یا پراکسی معکوس دیگری اجرا میکنید، مطمئن شوید مهلتهای پراکسی نیز از مهلتهای استریم/واکشی Pusula بیشتر هستند.

---

## حالت پورتهای مجزا

برای سناریوهای پیشرفته (پروکسی معکوس، شبکهسازی کانتینر)، API و داشبورد را روی پورتهای جداگانه اجرا کنید:

```bash
PORT=20128 DASHBOARD_PORT=20129 pusula
# API:       http://localhost:20128/v1
# داشبورد: http://localhost:20129
```

---

## قالب Void Linux ‏(`xbps-src`)

کاربران Void Linux میتوانند با استفاده از `xbps-src` یک بستهٔ بومی بسازند. این بلوک را با مسیر `srcpkgs/pusula/template` ذخیره کنید:

```bash
# فایل قالب برای 'pusula'
pkgname=pusula
version=3.8.0
revision=1
hostmakedepends="nodejs python3 make"
depends="openssl"
short_desc="Universal AI gateway with smart routing for multiple LLM providers"
maintainer="zenobit <zenobit@disroot.org>"
license="MIT"
homepage="https://github.com/Ferhat-Yasinoglu/pusula"
distfiles="https://github.com/Ferhat-Yasinoglu/pusula/archive/refs/tags/v${version}.tar.gz"
# برای هر انتشار، checksum را با دستور زیر دوباره تولید کنید:
#   curl -L -o /tmp/pusula.tar.gz "https://github.com/Ferhat-Yasinoglu/pusula/archive/refs/tags/v${version}.tar.gz" && sha256sum /tmp/pusula.tar.gz
checksum=PLACEHOLDER_REGENERATE_PER_RELEASE
system_accounts="_pusula"
pusula_homedir="/var/lib/pusula"
export NODE_ENV=production
export npm_config_engine_strict=false
export npm_config_loglevel=error
export npm_config_fund=false
export npm_config_audit=false

do_build() {
	local _gyp_arch
	case "$XBPS_TARGET_MACHINE" in
		aarch64*) _gyp_arch=arm64 ;;
		armv7*|armv6*) _gyp_arch=arm ;;
		i686*) _gyp_arch=ia32 ;;
		*) _gyp_arch=x64 ;;
	esac

	NODE_ENV=development npm ci --ignore-scripts
	npm run build
	cp -r .next/static .next/standalone/.next/static
	[ -d public ] && cp -r public .next/standalone/public || true

	local _node_gyp=/usr/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js
	(cd node_modules/better-sqlite3 && node "$_node_gyp" rebuild --arch="$_gyp_arch")

	local _bs3_release=.next/standalone/node_modules/better-sqlite3/build/Release
	mkdir -p "$_bs3_release"
	cp node_modules/better-sqlite3/build/Release/better_sqlite3.node "$_bs3_release/"

	rm -rf .next/standalone/node_modules/@img

	for _mod in pino-abstract-transport split2 process-warning; do
		cp -r "node_modules/$_mod" .next/standalone/node_modules/
	done
}

do_check() {
	npm run test:unit
}

do_install() {
	vmkdir usr/lib/pusula/.next
	vcopy .next/standalone/. usr/lib/pusula/.next/standalone

	for _d in \
		.next/standalone/.next/server/app/dashboard \
		.next/standalone/.next/server/app/dashboard/settings \
		.next/standalone/.next/server/app/dashboard/providers; do
		touch "${DESTDIR}/usr/lib/pusula/${_d}/.keep"
	done

	cat > "${WRKDIR}/pusula" <<'EOF'
#!/bin/sh
export PORT="${PORT:-20128}"
export DATA_DIR="${DATA_DIR:-${XDG_DATA_HOME:-${HOME}/.local/share}/pusula}"
export APP_LOG_TO_FILE="${APP_LOG_TO_FILE:-false}"
mkdir -p "${DATA_DIR}"
exec node /usr/lib/pusula/.next/standalone/server.js "$@"
EOF
	vbin "${WRKDIR}/pusula"
}

post_install() {
	vlicense LICENSE
}
```

---

## حذف نصب

| فرمان                    | عملکرد                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------- |
| `npm run uninstall`      | برنامهٔ سیستمی را حذف میکند، اما **پایگاه داده و پیکربندیهای شما** را در `~/.pusula` نگه میدارد.   |
| `npm run uninstall:full` | برنامه را حذف میکند و همچنین **تمام پیکربندیها، کلیدها و پایگاههای داده را برای همیشه پاک میکند**. |

> برای مشاهدهٔ دستورالعملهای دقیق حذف نصب برای همهٔ روشها، به [UNINSTALL.md](./UNINSTALL.md) مراجعه کنید.
