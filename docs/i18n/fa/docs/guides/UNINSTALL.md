# Pusula — Uninstall Guide (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../guides/UNINSTALL.md) · 🇩🇪 [de](../../../de/docs/guides/UNINSTALL.md) · 🇹🇷 [tr](../../../tr/docs/guides/UNINSTALL.md)

---

🌐 **Languages:** 🇺🇸 [English](../../../../guides/UNINSTALL.md) · 🇩🇪 [de](../../../de/docs/guides/UNINSTALL.md) · 🇹🇷 [tr](../../../tr/docs/guides/UNINSTALL.md)

این راهنما نحوه حذف کامل و تمیز Pusula از سیستم شما را توضیح میدهد.

---

## حذف سریع (v3.6.2+)

Pusula دو اسکریپت داخلی برای حذف پاک و کامل ارائه میدهد:

### حفظ دادههای شما

```bash
npm run uninstall
```

این فرمان برنامه Pusula را حذف میکند، اما پایگاه داده، پیکربندیها، کلیدهای API و تنظیمات ارائهدهندگان شما را در `~/.pusula/` **حفظ میکند**. اگر قصد دارید بعداً برنامه را دوباره نصب کنید و میخواهید تنظیمات فعلی خود را نگه دارید، از این گزینه استفاده کنید.

### حذف کامل

```bash
npm run uninstall:full
```

این فرمان برنامه را حذف میکند و همه دادهها را نیز **برای همیشه پاک میکند**:

- پایگاه داده (`storage.sqlite`)
- پیکربندیهای ارائهدهندگان و کلیدهای API
- فایلهای پشتیبان
- فایلهای گزارش
- همه فایلهای موجود در پوشه `~/.pusula/`

> ⚠️ **هشدار:** فرمان `npm run uninstall:full` برگشتناپذیر است. همه اتصالهای ارائهدهندگان، ترکیبها، کلیدهای API و تاریخچه استفاده شما برای همیشه حذف خواهند شد.

---

## حذف دستی

### نصب سراسری با NPM

```bash
# حذف بسته سراسری
npm uninstall -g pusula

# (اختیاری) حذف پوشه دادهها
rm -rf ~/.pusula
```

### نصب سراسری با pnpm

```bash
pnpm uninstall -g pusula
rm -rf ~/.pusula
```

### Docker

```bash
# توقف و حذف کانتینر
docker stop pusula
docker rm pusula

# حذف volume (همه دادهها را پاک میکند)
docker volume rm pusula-data

# (اختیاری) حذف image
docker rmi ferhat-yasinoglu/pusula:latest
```

### Docker Compose

```bash
# توقف و حذف کانتینرها
docker compose down

# حذف volumeها نیز انجام شود (همه دادهها را پاک میکند)
docker compose down -v
```

### برنامه دسکتاپ Electron

**Windows:**

- مسیر `Settings → Apps → Pusula → Uninstall` را باز کنید
- یا حذفکننده NSIS را از پوشه نصب اجرا کنید

**macOS:**

- فایل `Pusula.app` را از `/Applications` به سطل زباله بکشید
- حذف دادهها: `rm -rf ~/Library/Application Support/pusula`

**Linux:**

- فایل AppImage را حذف کنید
- حذف دادهها: `rm -rf ~/.pusula`

### نصب از منبع (git clone)

```bash
# حذف پوشه کلونشده
rm -rf /path/to/pusula

# (اختیاری) حذف پوشه دادهها
rm -rf ~/.pusula
```

---

## پوشههای داده

Pusula بهطور پیشفرض دادهها را در مکانهای زیر ذخیره میکند:

| پلتفرم        | مسیر پیشفرض                   | بازنویسی                      |
| ------------- | ----------------------------- | ----------------------------- |
| Linux         | `~/.pusula/`               | متغیر محیطی `DATA_DIR`        |
| macOS         | `~/.pusula/`               | متغیر محیطی `DATA_DIR`        |
| Windows       | `%APPDATA%/pusula/`        | متغیر محیطی `DATA_DIR`        |
| Docker        | `/app/data/` (volume متصلشده) | متغیر محیطی `DATA_DIR`        |
| سازگار با XDG | `$XDG_CONFIG_HOME/pusula/` | متغیر محیطی `XDG_CONFIG_HOME` |

### فایلهای موجود در پوشه دادهها

| فایل/پوشه            | توضیحات                                                   |
| -------------------- | --------------------------------------------------------- |
| `storage.sqlite`     | پایگاه داده اصلی (ارائهدهندگان، ترکیبها، تنظیمات، کلیدها) |
| `storage.sqlite-wal` | گزارش پیشنویس SQLite (موقت)                               |
| `storage.sqlite-shm` | حافظه اشتراکی SQLite (موقت)                               |
| `call_logs/`         | بایگانی محتوای درخواستها                                  |
| `backups/`           | نسخههای پشتیبان خودکار پایگاه داده                        |
| `log.txt`            | گزارش قدیمی درخواستها (اختیاری)                           |

---

## تأیید حذف کامل

پس از حذف نصب، بررسی کنید که هیچ فایلی باقی نمانده باشد:

```bash
# بررسی پکیج سراسری npm
npm list -g pusula 2>/dev/null

# بررسی پوشه دادهها
ls -la ~/.pusula/ 2>/dev/null

# بررسی فرایندهای در حال اجرا
pgrep -f pusula
```

اگر فرایندی همچنان در حال اجرا است، آن را متوقف کنید:

```bash
pkill -f pusula
```
