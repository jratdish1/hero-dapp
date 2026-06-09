---
name: github-ops
origin: local-ecc-inspired
---

# Github Ops

Standard GitHub operations and collaboration patterns.

## Branch Strategy

- `main` / `master` — production-ready code only.
- `develop` — integration branch for features.
- `feature/*` — individual feature branches.
- `hotfix/*` — urgent production fixes.

## PR Requirements

- All PRs require at least one review.
- CI must pass before merge.
- Security-sensitive changes require security review.
- Squash merge preferred for clean history.

## Issue Templates

- Bug reports require reproduction steps.
- Feature requests require acceptance criteria.
- Security issues use private disclosure.

