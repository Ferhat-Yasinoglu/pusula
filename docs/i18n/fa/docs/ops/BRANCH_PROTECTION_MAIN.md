# Branch protection — `main` (OpenSSF Scorecard: Branch-Protection) (فارسی)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/BRANCH_PROTECTION_MAIN.md) · 🇩🇪 [de](../../../de/docs/ops/BRANCH_PROTECTION_MAIN.md) · 🇹🇷 [tr](../../../tr/docs/ops/BRANCH_PROTECTION_MAIN.md)

---

اقدام مالک. از مسیر تنظیمات → شاخهها → افزودن قانون اعمال کنید، یا:

```bash
gh api -X PUT repos/Ferhat-Yasinoglu/pusula/branches/main/protection \
  --input - <<'JSON'
{ "required_status_checks": { "strict": true, "contexts": ["Quality Ratchet", "Quality Gates (Extended)", "Fast Quality Gates"] },
  "enforce_admins": false,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false }
JSON
```

امتیاز Scorecard Branch-Protection را از 0 بالاتر میبرد. `enforce_admins:false` باعث میشود روند فعلی ادغام روبهجلو همچنان قابلاستفاده بماند؛ پس از پایدار شدن، آن را به `true` تغییر دهید.
