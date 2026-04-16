# GitHub Access Configuration
## Repository: jratdish1/hero-dapp
## Last Updated: 2026-04-16

### Push Access
- VDS: PAT stored in ~/.git-credentials (credential.helper=store)
- VPS1: PAT embedded in git remote URL (auto-push capable)

### How to Push Updates
\`\`\`bash
cd /root/hero-dapp
git add -A
git commit -m "your message"
git push origin main
\`\`\`

### If Token Expires
1. Generate new PAT at https://github.com/settings/tokens
2. On VDS: Update ~/.git-credentials
3. On VPS1: git remote set-url origin https://USER:NEW_TOKEN@github.com/jratdish1/hero-dapp.git
