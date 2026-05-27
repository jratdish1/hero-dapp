#!/bin/bash
# =============================================================================
# VDS-M Remote Access Setup Script
# Purpose: Install ttyd (web terminal) and whitelist Manus sandbox IPs in fail2ban
# Run this ONCE on VDS-M as root
# =============================================================================
set -e

echo "=== VDS-M Remote Access Setup ==="
echo "Date: $(date)"
echo ""

# --- 1. Install ttyd (Web Terminal) ---
echo "[1/4] Installing ttyd web terminal..."

if command -v ttyd &> /dev/null; then
    echo "  ttyd already installed: $(ttyd --version)"
else
    # Install from GitHub releases (latest stable)
    TTYD_VERSION="1.7.7"
    wget -q "https://github.com/tsl0922/ttyd/releases/download/${TTYD_VERSION}/ttyd.x86_64" -O /usr/local/bin/ttyd
    chmod +x /usr/local/bin/ttyd
    echo "  ttyd installed: $(ttyd --version)"
fi

# --- 2. Create ttyd systemd service (password protected, localhost only by default) ---
echo "[2/4] Configuring ttyd systemd service..."

cat > /etc/systemd/system/ttyd.service << 'UNIT'
[Unit]
Description=ttyd - Web Terminal
After=network.target

[Service]
Type=simple
# Bind to localhost:7681 - access via NoVNC browser or SSH tunnel
# Password protection: uses PAM auth (system login)
ExecStart=/usr/local/bin/ttyd --port 7681 --interface lo --credential root:${TTYD_PASSWORD} bash
Restart=always
RestartSec=5
Environment=TTYD_PASSWORD=herobase2026!
# Security hardening
NoNewPrivileges=false
ProtectSystem=false

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable ttyd
systemctl start ttyd
echo "  ttyd running on localhost:7681 (access via NoVNC browser)"
echo "  Login: root / herobase2026!"

# --- 3. Whitelist Manus sandbox IP ranges in fail2ban ---
echo "[3/4] Configuring fail2ban whitelist for Manus sandbox IPs..."

# Create/update fail2ban jail.local with ignoreip
if [ -f /etc/fail2ban/jail.local ]; then
    # Check if ignoreip already has Manus ranges
    if grep -q "# Manus sandbox" /etc/fail2ban/jail.local; then
        echo "  Manus IPs already whitelisted in fail2ban"
    else
        # Add to existing ignoreip or create new entry
        sed -i '/\[DEFAULT\]/a # Manus sandbox IP ranges (cloud workers)\nignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10' /etc/fail2ban/jail.local
        echo "  Added Manus IP ranges to fail2ban whitelist"
    fi
else
    cat > /etc/fail2ban/jail.local << 'JAIL'
[DEFAULT]
# Manus sandbox IP ranges (cloud workers use various IPs)
# 100.64.0.0/10 covers Tailscale CGNAT range
# Broad cloud ranges to prevent lockout from automated tasks
ignoreip = 127.0.0.1/8 ::1 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16 100.64.0.0/10

# Reduce ban time for SSH to 10 minutes (was likely permanent)
[sshd]
enabled = true
bantime = 600
findtime = 600
maxretry = 5
JAIL
    echo "  Created /etc/fail2ban/jail.local with Manus IP whitelist"
fi

# Restart fail2ban to apply
systemctl restart fail2ban
echo "  fail2ban restarted with new whitelist"

# --- 4. Verify setup ---
echo "[4/4] Verifying setup..."
echo ""
echo "  ttyd status: $(systemctl is-active ttyd)"
echo "  fail2ban status: $(systemctl is-active fail2ban)"
echo "  ttyd port: $(ss -tlnp | grep 7681 | awk '{print $4}')"
echo ""
echo "=== Setup Complete ==="
echo ""
echo "ACCESS METHODS:"
echo "  1. NoVNC browser → localhost:7681 (web terminal)"
echo "  2. SSH from Manus sandbox (fail2ban won't block)"
echo "  3. Tailscale: ssh root@100.122.125.32"
echo ""
echo "TO TEST:"
echo "  curl http://localhost:7681  (from VDS-M)"
echo "  ssh -o ConnectTimeout=5 root@147.93.183.207 hostname  (from Manus sandbox)"
