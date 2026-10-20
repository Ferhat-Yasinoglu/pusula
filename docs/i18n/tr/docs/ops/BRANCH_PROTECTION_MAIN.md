# Branch protection — `main` (OpenSSF Scorecard: Branch-Protection) (Türkçe)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/BRANCH_PROTECTION_MAIN.md) · 🇩🇪 [de](../../../de/docs/ops/BRANCH_PROTECTION_MAIN.md) · 🇮🇷 [fa](../../../fa/docs/ops/BRANCH_PROTECTION_MAIN.md)

---

Sahip işlemi. Settings → Branches → Add rule üzerinden veya aşağıdaki komutla uygulayın:

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

Scorecard Branch-Protection puanını 0'dan yükseltir. `enforce_admins:false`, mevcut
ileri birleştirme akışının çalışmasını sürdürür; kararlı hâle geldiğinde `true` olarak sıkılaştırın.
