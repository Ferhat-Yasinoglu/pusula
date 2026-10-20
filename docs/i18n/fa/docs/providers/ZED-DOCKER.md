# Zed IDE Integration in Docker Environments (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../providers/ZED-DOCKER.md) · 🇩🇪 [de](../../../de/docs/providers/ZED-DOCKER.md) · 🇹🇷 [tr](../../../tr/docs/providers/ZED-DOCKER.md)

---

وقتی Pusula داخل Docker اجرا میشود، فرایند استاندارد «وارد کردن از Zed Keychain» با شکست مواجه میشود، زیرا کانتینر نمیتواند به سرویس مدیریت کلید سیستمعامل میزبان دسترسی پیدا کند (`libsecret` در Linux،‏ Keychain در macOS و Credential Manager در Windows) و دایرکتوریهای پیکربندی Zed روی فایلسیستم میزبان نیز بهطور پیشفرض داخل کانتینر قابل مشاهده نیستند.

## چرا وارد کردن از Keychain در Docker شکست میخورد

دو مشکل بازدارنده در داخل کانتینر رخ میدهد:

1. **جداسازی فایلسیستم** — تابع `isZedInstalled()` بهدنبال `~/.config/zed` در Linux،‏
   `~/Library/Application Support/Zed` در macOS یا مسیر معادل آن در Windows میگردد. این مسیرها
   روی میزبان قرار دارند و تا زمانی که صراحتاً بهصورت volume متصل نشوند، در دسترس نیستند.
2. **جداسازی IPC** — حتی وقتی دایرکتوری پیکربندی متصل شده باشد، ماژول بومی `keytar`
   از طریق یک سوکت Unix یا نشست D-Bus با سرویس مدیریت کلید سیستمعامل ارتباط برقرار میکند.
   هیچکدام از این موارد بهطور پیشفرض به داخل کانتینر پل زده نمیشوند، بنابراین خواندن اطلاعات اعتبارسنجی همیشه شکست میخورد.

Pusula محیط Docker را با استفاده از دو روش اکتشافی تشخیص میدهد:

- وجود `/.dockerenv` که هنگام شروع کانتینر توسط daemon مربوط به Docker نوشته میشود.
- وجود رشته `docker` در `/proc/1/cgroup` در Linux cgroup v1.

وقتی هرکدام از این روشها نتیجه مثبت داشته باشد، مسیر وارد کردن پاسخ HTTP 422 را با
`zedDockerEnvironment: true` و پیامی برمیگرداند که شما را به زبانه وارد کردن دستی توکن هدایت میکند.

## استفاده از زبانه وارد کردن دستی توکن

1. **Dashboard → Providers → Zed** را باز کنید.
2. پنل **Manual Token Import** زیر کارت وارد کردن از keychain ظاهر میشود. وقتی
   Pusula وجود Docker را تشخیص دهد، این پنل پس از اولین تلاش ناموفق برای
   وارد کردن از keychain بهطور خودکار باز میشود.
3. ارائهدهنده را از فهرست کشویی انتخاب کنید (OpenAI،‏ Anthropic،‏ Google،‏ Mistral،‏ xAI،
   OpenRouter یا DeepSeek).
4. کلید API را در فیلد رمز عبور جایگذاری کنید.
5. روی **Import** کلیک کنید.

کلید بهعنوان یک اتصال جدید ارائهدهنده با نام
`Zed Manual Import (<provider>)` ذخیره میشود.

## محل ذخیره کلیدهای API مربوط به Zed روی میزبان

Zed کلیدهای ارائهدهندگان هوش مصنوعی را در keychain سیستمعامل و تحت نام سرویسهایی مانند
`zed-openai`،‏ `ai.zed.openai`،‏ `zed-anthropic` و غیره ذخیره میکند. برای بازیابی آنها جهت
وارد کردن دستی، در مکانهای زیر جستوجو کنید:

**Linux**

```
~/.config/zed/settings.json
```

بخش `language_models` شامل پیکربندیهای ارائهدهندگان است. کلیدهایی که از طریق رابط کاربری
Zed در keychain ذخیره شدهاند، بهصورت متن ساده در `settings.json` قرار ندارند؛ آنها را با
یک نمایشدهنده keychain مانند GNOME Keyring / Seahorse یا با اجرای دستور زیر بازیابی کنید:

```bash
secret-tool lookup service zed-openai account api-key
```

**macOS**

```
~/Library/Application Support/Zed/settings.json
```

ورودیهای keychain را میتوان با جستوجوی `zed` در **Keychain Access.app** پیدا کرد.

## گزینه اتصال Volume (پیشرفته)

میتوانید دایرکتوری پیکربندی Zed را بهصورت فقطخواندنی به کانتینر متصل کنید.
این کار مشکل keychain را برطرف نمیکند، اما ممکن است برای قابلیتهای آینده که مقادیر
غیرمحرمانه پیکربندی Zed را میخوانند، مفید باشد؛ برای مثال، ترجیحات مدل.

```yaml
# بخشی از docker-compose.yml
services:
  pusula:
    image: pusula:latest
    volumes:
      # میزبان Linux
      - "${HOME}/.config/zed:/host-zed-config:ro"
      # میزبان macOS (بهجای مورد بالا، این خط را از حالت توضیح خارج کنید)
      # - "${HOME}/Library/Application Support/Zed:/host-zed-config:ro"
    environment:
      # قابلیت آینده: ZED_CONFIG_PATH=/host-zed-config
      PORT: "20128"
```

توجه: در حال حاضر، بازنویسی مسیر با استفاده از متغیر محیطی `ZED_CONFIG_PATH` پیادهسازی نشده است. این
قطعه بهعنوان مرجعی برای زمانی ارائه شده است که این قابلیت اضافه شود.

## API وارد کردن دستی

نقطه پایانی وارد کردن دستی را میتوان مستقیماً نیز فراخوانی کرد:

```
POST /api/providers/zed/manual-import
Content-Type: application/json
Authorization: Bearer <oma_live_or_manage_scoped_api_key>

{
  "provider": "openai",
  "token": "sk-...",
  "label": "کلید OpenAI متعلق به Zed من"   // اختیاری
}
```

در صورت موفقیت، پاسخ زیر برگردانده میشود:

```json
{ "success": true, "connectionId": "...", "provider": "openai" }
```

## عیبیابی

| نشانه                               | علت                             | راهحل                                            |
| ----------------------------------- | ------------------------------- | ------------------------------------------------ |
| 422 + `zedDockerEnvironment: true`  | اجرا در داخل Docker             | از زبانه وارد کردن دستی توکن استفاده کنید        |
| 404 + `zedInstalled: false`         | Zed روی میزبان نصب نشده است     | Zed را نصب کنید یا وارد کردن دستی را بهکار ببرید |
| 403 + دسترسی به keychain رد شده است | سیستمعامل دسترسی را رد کرده است | در پیام سیستمعامل مجوز لازم را اعطا کنید         |
| 404 + سرویس keychain در دسترس نیست  | `libsecret` در Linux موجود نیست | `libsecret-1-dev` را نصب کنید                    |
