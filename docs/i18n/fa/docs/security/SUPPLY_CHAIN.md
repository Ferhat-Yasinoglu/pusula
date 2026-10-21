# Supply-Chain Gates (Phase 8 · Block A) (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../security/SUPPLY_CHAIN.md) · 🇩🇪 [de](../../../de/docs/security/SUPPLY_CHAIN.md) · 🇹🇷 [tr](../../../tr/docs/security/SUPPLY_CHAIN.md)

---

Pusula آرتیفکتهای npm + Docker را منتشر میکند. این دروازهها اصالت (provenance)، موجودی (SBOM) و اسکن CVE را فراهم میکنند، که همگی متنباز (OSS) هستند و در جریانهای کاری انتشار (release workflows) ادغام شدهاند. رویکرد **مشاورهای-اول** — آنها اکنون گزارش میدهند، و پس از اولین انتشار موفق (green release) به حالت مسدودکننده ارتقا مییابند.

| دروازه                | ابزار                                          | کجا                           | مسدود میکند؟            | خروجی                                           |
| :-------------------- | :--------------------------------------------- | :---------------------------- | :---------------------- | :---------------------------------------------- |
| اصالت SLSA (npm)      | `npm --provenance` (OIDC)                      | `npm-publish.yml`             | فقط در صورت شکست انتشار | نشان npmjs / `npm audit signatures`             |
| SBOM npm              | `@cyclonedx/cyclonedx-npm`                     | `npm-publish.yml`             | فقط در صورت شکست تولید  | دارایی انتشار + آرتیفکت                         |
| SBOM ایمیج            | `anchore/sbom-action` (syft)                   | `docker-publish.yml` (merge)  | مشاورهای                | آرتیفکت CycloneDX                               |
| Trivy CVE (SARIF)     | `aquasecurity/trivy-action`                    | `docker-publish.yml` (merge)  | مشاورهای                | SARIF (HIGH+CRITICAL) → تب Security             |
| دروازه CRITICAL Trivy | `aquasecurity/trivy-action`                    | `docker-publish.yml` (merge)  | **مسدودکننده**          | `exit-code: '1'` در CRITICAL قابل رفع           |
| شمارش آسیبپذیری osv   | `osv-scanner` (`check:vuln-ratchet --ratchet`) | `ci.yml` (`quality-extended`) | **مسدودکننده**          | `metrics.vulnCount` را تنظیم میکند (جهت: نزولی) |
| کارت امتیازی OpenSSF  | `ossf/scorecard-action`                        | `scorecard.yml` (cron)        | مشاورهای                | SARIF → Security + نشان                         |

تنظیمکننده CVE ایمیج از **دو مرحله** در `docker-publish.yml` استفاده میکند: مرحله SARIF (`HIGH,CRITICAL`, `exit-code: 0`) موارد HIGH+CRITICAL را در تب Security بدون مسدود کردن قابل مشاهده نگه میدارد؛ مرحله _دروازه CRITICAL_ (`severity: CRITICAL`, `ignore-unfixed: true`, `exit-code: 1`) انتشار را در صورت وجود یک CVE از نوع CRITICAL **با راهحل موجود** با شکست مواجه میکند. `ignore-unfixed` از مسدود شدن انتشار برای یک CVE ایمیج پایه بدون پچ بالادستی جلوگیری میکند.

## ⚠️ واریانس CVE (مسدود کردن دروازههای osv/Trivy)

osv و Trivy وابستگیها را با پایگاههای داده CVE که **به طور مداوم در حال رشد هستند** مقایسه میکنند. یک PR که **هیچ وابستگیای را لمس نمیکند** میتواند ناگهان قرمز شود زیرا یک CVE جدید در یک وابستگی موجود افشا شده است (osv: `vulnCount` اندازهگیری شده > خط مبنا؛ Trivy: یک CRITICAL جدید قابل رفع در ایمیج). **این رفتار عملیاتی مورد انتظار یک دروازه CVE مسدودکننده است، نه یک رگرسیون محصول.**

هنگامی که osv یا Trivy به دلیل یک CVE تازه افشا شده قرمز میشوند، راهحل این است:

1.  **وابستگی آسیبدیده را ارتقا دهید** (ترجیحی) — به نسخه پچشده از طریق `overrides` در `package.json` (وابستگیهای گذرا) ارتقا دهید یا ایمیج را بر اساس یک پایه پچشده بازسازی کنید.
2.  **اگر راهحل بالادستی وجود ندارد:**
    - **osv:** `metrics.vulnCount` را در `config/quality/quality-baseline.json` دوباره خط مبنا قرار دهید (`npm run quality:ratchet -- --update` دروازههای اختصاصی را پوشش نمیدهد — مقدار را به صورت دستی ویرایش کنید، `direction:down`) با یک یادداشت توجیهی + مسئله پیگیری.
    - **Trivy:** یک ورودی در `.trivyignore` (CVE-ID در هر خط) با یک کامنت توجیهی + مسئله پیگیری اضافه کنید. `ignore-unfixed: true` به طور خودکار CVEهایی را که بدون پچ هستند پوشش میدهد.

هر دو دروازه در صورت عدم وجود ابزار یا شکست اندازهگیری (osv-scanner در PATH نیست، osv.dev/network غیرقابل دسترس است، JSON نامعتبر است) **به آرامی رد میشوند** (exit 0) — شکست **اندازهگیری** هرگز مسدود نمیکند، فقط یک رگرسیون **اندازهگیری شده** مسدود میکند.

## ریسکهای پذیرفتهشده شناختهشده

### extract-zip 2.0.1 — GHSA-7pqw-9j4j-h8q3 / GHSA-jmr9-qjv8-65gv (#14482)

`extract-zip@2.0.1` دارای دو مشاوره امنیتی وصلهنشده با شدت بالا در مورد پیمایش سیملینک (symlink-traversal) است.
بر اساس شاخه "عدم وجود راهحل بالادستی" (no upstream fix) از راهکار واریانس CVE در بالا، این یک
**ریسک پذیرفتهشده** است، نه یک ارتقا:

- **زنجیره:** `promptfoo` (devDependency) → `@openai/codex-security` → `extract-zip@2.0.1`.
  تایید شده از طریق `package-lock.json` — دقیقاً یک پکیج در کل درخت وابستگی
  (`@openai/codex-security`) `extract-zip` را اعلام میکند، و دقیقاً یک پکیج
  (`promptfoo`) `@openai/codex-security` را اعلام میکند.
- **هیچ نسخه ثابتی در هیچ کجای زنجیره وجود ندارد.** `extract-zip@2.0.1` (منتشر شده در ۲۰۲۰) آخرین نسخه منتشر شده این پکیج است — و بدون پشتیبانی است. `@openai/codex-security`
  نسخه فعلی npm-latest (`0.1.29`) همچنان `extract-zip@2.0.1` را فراخوانی میکند.
- **غیرقابل دسترس از محیط تولید.** `promptfoo` فقط وابستگی توسعه (devDependency-only) است (هرگز
  تحت `dependencies` لیست نشده است)، و هیچ فایلی در `src/`، `open-sse/`، یا `bin/` پکیج npm
  `extract-zip` را ایمپورت نمیکند — کمککننده `extractZip()` خود Pusula
  (`src/lib/versionManager/binaryManager.ts:93`) از `unzip`/`tar` بومی استفاده میکند
  و نامرتبط است. `@openai/codex-security` همچنین محافظ پیمایش سیملینک (symlink-traversal) خود را
  علاوه بر callback `onEntry` مربوط به `extract-zip` ارائه میدهد.
- **نام مستعار قرار ندهید** برای `extract-zip` از طریق `overrides` در `package.json` — تنها جایگزین قابل استفاده مستقیم
  (drop-in replacement) که موجود است، Electron-org-internal است و با بررسیهای `onEntry`/`defaultDirMode`/`defaultFileMode`
  خود `@openai/codex-security` ناسازگار با API است؛ جایگزینی آن بیصدا بررسیهای امنیتی آن پکیج را از کار میاندازد.
- **خط مبنا:** `vulnCount` اندازهگیری شده osv (3) در حال حاضر بسیار پایینتر از
  خط مبنای ثابت شده `config/quality/quality-baseline.json` (27) است — نیازی به تغییر ratchet نیست.
- **محافظ رگرسیون:** `tests/unit/extract-zip-14482-exposure.test.ts` زنجیره و ثابت عدم ایمپورت در تولید (no-production-import invariant) بالا را تایید میکند؛ در صورت شکست هر یک (مثلاً یک PR آینده `extract-zip` را از محیط تولید قابل دسترس کند)، CI را با خطا مواجه میکند.
- **وضعیت (promptfoo ≥ 0.124.1):** زنجیره دیگر وجود ندارد — promptfoo دیگر به `@openai/codex-security` وابسته نیست، بنابراین `extract-zip` اصلاً در `package-lock.json` حضور ندارد. محافظ رگرسیون تا زمانی که این پکیج غایب است مستقیماً پاس می‌شود و زنجیره را فقط در صورت بازگشت دوبارهٔ پکیج دوباره بررسی می‌کند.
- **پیگیری:** issue #14482.

## بکلاگ: مشاوره Scorecard → مسدودکننده

پس از اولین انتشار موفق (green release) با گزارش Scorecard:

- Scorecard: ratchet امتیاز (امتیاز اندازهگیری شده را ثابت میکند؛ نمیتواند کاهش یابد).

مکمل گیتهای فاز ۷ (osv-scanner, gitleaks, actionlint+zizmor) است: zizmor خود گردش کارها را ممیزی میکند؛ Scorecard وضعیت کلی مخزن را اندازهگیری میکند.
