# Compression Language Packs (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../compression/COMPRESSION_LANGUAGE_PACKS.md) · 🇩🇪 [de](../../../de/docs/compression/COMPRESSION_LANGUAGE_PACKS.md) · 🇹🇷 [tr](../../../tr/docs/compression/COMPRESSION_LANGUAGE_PACKS.md)

---

فشردهسازی Caveman میتواند علاوه بر قواعد داخلی انگلیسی، بستههای قواعد مختص هر زبان را نیز بارگذاری کند.
این قابلیت موتور اصلی را پایدار نگه میدارد و در عین حال اجازه میدهد بستههای زبان پرتغالی، اسپانیایی، آلمانی، فرانسوی، ایتالیایی، ژاپنی و
زبانهای آینده بهطور مستقل تکامل یابند.

## محل قرارگیری

بستههای زبان در مسیر زیر قرار دارند:

```txt
open-sse/services/compression/rules/<language>/
```

بستههای ارائهشده فعلی (بر اساس محتوای دایرکتوری `rules/` تأیید شدهاند):

| زبان            | دایرکتوری      | دستهبندیهای قواعد موجود                             |
| --------------- | -------------- | --------------------------------------------------- |
| انگلیسی         | `rules/en/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| اسپانیایی       | `rules/es/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| پرتغالی (برزیل) | `rules/pt-BR/` | `context`, `dedup`, `filler`, `structural`, `ultra` |
| اندونزیایی      | `rules/id/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| ایتالیایی       | `rules/it/`    | `context`, `dedup`, `filler`, `structural`, `ultra` |
| آلمانی          | `rules/de/`    | `context`, `filler`, `structural`                   |
| فرانسوی         | `rules/fr/`    | `context`, `filler`, `structural`                   |
| ژاپنی           | `rules/ja/`    | `context`, `filler`, `structural`                   |

> **نکته درباره همترازی:** بستههای `en`، `es`، `pt-BR`، `id` و `it` هر ۵ دستهبندی را بهطور کامل دارند؛ بستههای `de`، `fr` و `ja` با ۳ دستهبندی ارائه میشوند. دستهبندیهای موجودنیست `dedup` و `ultra` بدون نمایش خطا از قواعد داخلی انگلیسی استفاده میکنند. از مشارکت برای افزودن `dedup.json` و `ultra.json` به بستههای کوچکتر استقبال میشود.
>
> بسته `pt-BR` بر پایه **[Troglodita](https://github.com/leninejunior/troglodita)** اثر Lenine Júnior است — یک سیستم فشردهسازی که از ابتدا برای دستور زبان پرتغالی برزیلی طراحی شده است (کاهش حشو، حذف عبارات زائد PT-BR و اختصارات فنی برای جامعه توسعهدهندگان برزیلی).
>
> فهرست مرجع دستهبندیها و طرحواره هر دستهبندی در [`open-sse/services/compression/rules/_schema.json`](../../open-sse/services/compression/rules/_schema.json) قرار دارد (JSON Schema پیشنویس 2020-12).

## تشخیص زبان

`languageDetector.ts` از روشهای اکتشافی سبک برای استنباط زبان از متن پرامپت استفاده میکند. زبان پیشفرض
پیکربندیشده همچنان رعایت میشود و در صورت نیاز به کنترل دقیق، تشخیص زبان را میتوان از طریق پیکربندی
غیرفعال کرد.

خروجی تشخیص فقط برای انتخاب بستههای قواعد استفاده میشود. این خروجی مسیریابی ارائهدهنده، انتخاب
محلیسازی یا زبان رابط کاربری را تغییر نمیدهد.

## ساختار پیکربندی

تنظیمات فشردهسازی میتواند شامل موارد زیر باشد:

```json
{
  "languageConfig": {
    "enabled": true,
    "defaultLanguage": "en",
    "autoDetect": true,
    "enabledPacks": ["en", "pt-BR", "es", "id", "de", "fr", "ja"]
  },
  "cavemanConfig": {
    "language": "en",
    "autoDetectLanguage": true,
    "enabledLanguagePacks": ["en", "pt-BR", "es", "id", "de", "fr", "ja"]
  }
}
```

`languageConfig` پیشفرضهای داشبورد/پیشنمایش را کنترل میکند. `cavemanConfig` پیکربندی موتور در زمان اجرا است
که هنگام فشردهسازی متن پیامها توسط Caveman استفاده میشود.

## افزودن بستهٔ زبان

1. فایل `open-sse/services/compression/rules/<language>/<pack>.json` را ایجاد کنید.
2. از قالب قواعد Caveman در `docs/compression/COMPRESSION_RULES_FORMAT.md` استفاده کنید.
3. جایگزینیها را محافظهکارانه نگه دارید و از تغییر کد، شناسهها، URLها یا JSON خودداری کنید.
4. آزمونهای مربوط به انتخاب زبان و رفتار جایگزینی را اضافه یا بهروزرسانی کنید.
5. اگر زبان در انتخابگرهای رابط کاربری ظاهر میشود، برچسبهای جدید داشبورد/i18n را ارائه کنید.

## API

بستههای موجود را میتوان با دستور زیر استعلام کرد:

```bash
curl http://localhost:20128/api/compression/language-packs
```

نقطهٔ پایانی پیشنمایش، بازنویسیهای پیکربندی زبان را میپذیرد:

```bash
curl -X POST http://localhost:20128/api/compression/preview \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "standard",
    "text": "Por favor, eu gostaria que voce basicamente resumisse isso.",
    "config": {
      "languageConfig": {
        "defaultLanguage": "pt-BR",
        "autoDetect": true
      }
    }
  }'
```

## SHARED_BOUNDARIES (v3.8.0)

در v3.8.0، یک بند `SHARED_BOUNDARIES` به هر ۶ بستهٔ زبان اضافه شد که در همهٔ شدتهای
Caveman (LITE، FULL، ULTRA) اعمال میشود. این بند به موتور دستور میدهد که الگوهای زیر را،
صرفنظر از حذف کلمات زائد پیرامونشان، عیناً حفظ کند:

| نوع الگو                   | مثال                                   |
| -------------------------- | -------------------------------------- |
| بلوکهای کد حصاردار         | ` ```python\n...\n``` `                |
| کد درونخطی                 | `` `my_var` ``                         |
| URLها                      | `https://example.com/path`             |
| مسیرهای فایل (مطلق + نسبی) | `/etc/hosts`, `./src/index.ts`         |
| سرآیندهای خطا              | `Error:`, `TypeError:`, `SyntaxError:` |
| خطوط ردگیری پشته           | `  at functionName (file.ts:12:3)`     |

این الگوها در `DEFAULT_CAVEMAN_CONFIG.preservePatterns` (که پیشتر `[]` بود) قرار داده میشوند. این
ثابت در `open-sse/services/compression/types.ts` قرار دارد.

### چرا این موضوع مهم است

بدون SHARED_BOUNDARIES، حالتهای تهاجمی Caveman ممکن بود محتوایی را حذف کنند که شبیه نثر تکراری
به نظر میرسید، اما در واقع قطعهکد، مسیر فایل یا پشتهٔ خطا بود. SHARED_BOUNDARIES بهعنوان یک
شبکهٔ ایمنی مستقل از زبان عمل میکند که پیش از اجرای قواعد حذف کلمات زائد اعمال میشود.

### سفارشیسازی preservePatterns

میتوان الگوهای بیشتری را هنگام اجرا از طریق تنظیمات فشردهسازی اضافه کرد:

````json
{
  "cavemanConfig": {
    "preservePatterns": [
      "```[\\s\\S]*?```",
      "`[^`]+`",
      "https?://\\S+",
      "(?:/|\\./)[^\\s]+",
      "\\b(?:Error|TypeError|SyntaxError|RangeError):",
      "\\s+at\\s+\\S+\\s+\\(\\S+:\\d+:\\d+\\)"
    ]
  }
}
````

الگوهای سفارشی، ۶ الگوی پیشفرض را گسترش میدهند (و جایگزین آنها نمیشوند).

---

## نکات عملیاتی

- هنگامی که یک بستهٔ زبان موجود نباشد، قواعد داخلی انگلیسی همچنان بهعنوان گزینهٔ جایگزین استفاده میشوند.
- بستههای JSON داخلی نامعتبر در اعتبارسنجی شکست میخورند تا کیفیت داراییهای انتشار بدون هشدار کاهش نیابد.
- بستههای قواعد فقط شامل داده هستند و نباید کدی را وارد کنند یا منطق دلخواهی را اجرا کنند.
- لایهٔ تحلیل فشردهسازی، حالت و موتور انتخابشده را ثبت میکند، نه متن کامل پرامپت را.
