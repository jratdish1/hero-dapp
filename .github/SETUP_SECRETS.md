# GitHub Actions Deploy - Secret Setup

## Required Secrets

Run these commands from any machine with `gh` CLI authenticated:

```bash
# VDS-M host IP (jump host)
gh secret set VDS_HOST --body "147.93.183.207" --repo jratdish1/hero-dapp

# VDS-M SSH private key (ed25519 - the contabo_vds key)
gh secret set VDS_SSH_KEY < ~/.ssh/contabo_vds --repo jratdish1/hero-dapp
```

## Or via GitHub Web UI

1. Go to: https://github.com/jratdish1/hero-dapp/settings/secrets/actions
2. Add `VDS_HOST` = `147.93.183.207`
3. Add `VDS_SSH_KEY` = contents of `/root/.ssh/contabo_vds` from VDS-M

## How It Works

1. GitHub Actions SSHs into VDS-M (jump host)
2. VDS-M SSHs into VPS1 (herobase.io server)
3. Runs: git pull → pnpm install → build → pm2 reload
4. Purges Cloudflare cache using env_architecture vars on VDS-M
5. Verifies all routes return HTTP 200

## Auto-Setup Script (run from VDS-M)

```bash
# From VDS-M root shell:
cat /root/.ssh/contabo_vds | gh secret set VDS_SSH_KEY --repo jratdish1/hero-dapp
echo "147.93.183.207" | gh secret set VDS_HOST --repo jratdish1/hero-dapp
```
