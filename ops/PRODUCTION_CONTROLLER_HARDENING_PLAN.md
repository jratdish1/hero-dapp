# Production Controller Hardening Plan

Temporary implementation plan for the bounded follow-up PR. Remove this file before merge.

Required final scope:

1. `.github/workflows/deploy.yml`
2. `.github/workflows/vets-production-command.yml`
3. `DEPLOY_INSTRUCTIONS.md`

Required corrections:

- Prove normal deploys came from an owner-authored Issue #43 command; a collaborator must not be able to manually self-assert a correlation.
- Make child dispatch idempotent and reject duplicate correlations.
- Do not let pending eligible owner commands silently replace one another through a shared concurrency group.
- If the command monitor expires, cancel and force-cancel the child before reporting terminal failure.
- Use bounded connect and overall timeouts for every GitHub and Cloudflare API attempt.
- Query exact historical SHA push runs so intentional rollback does not depend on the newest 100 runs.
- Preserve final active SHA and every rollback attempted/succeeded/failed state in durable artifacts and Issue #43 receipts.
- Keep authorization outside the protected environment; keep VPS1/Cloudflare secrets only inside the protected production job.
- Retain strict SSH, non-root user, exact origin and SHA, clean tracked/untracked tree, frozen pnpm, PM2 exact-SHA, public exact-SHA health, Cloudflare purge validation, rollback, and no-rerun gates.
- Update operator instructions for normal release and intentional rollback.
- Delete this temporary plan before final audit.

No deployment or infrastructure mutation is authorized by this branch.