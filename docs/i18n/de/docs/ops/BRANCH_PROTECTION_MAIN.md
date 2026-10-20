# Branch protection — `main` (OpenSSF Scorecard: Branch-Protection) (Deutsch)

🌐 **Languages:** 🇺🇸 [English](../../../../ops/BRANCH_PROTECTION_MAIN.md) · 🇮🇷 [fa](../../../fa/docs/ops/BRANCH_PROTECTION_MAIN.md) · 🇹🇷 [tr](../../../tr/docs/ops/BRANCH_PROTECTION_MAIN.md)

---

Aktion des Eigentümers. Anwenden über Einstellungen → Branches → Regel hinzufügen oder:

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

Hebt den Scorecard-Wert für Branch Protection von 0 an. Mit `enforce_admins:false` bleibt der bestehende
Forward-Merge-Ablauf funktionsfähig; setzen Sie den Wert auf `true`, sobald der Ablauf stabil ist.
