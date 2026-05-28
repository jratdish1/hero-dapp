#!/bin/bash
# Fix nginx config for dao.vicfoundation.com
# This script is called by the app startup or manually
NGINX_CONF=$(find /etc/nginx/sites-enabled/ -type f -exec grep -l 'herobase.io' {} \; 2>/dev/null | head -1)
if [ -n "$NGINX_CONF" ]; then
  if ! grep -q 'dao.vicfoundation.com' "$NGINX_CONF" 2>/dev/null; then
    sed -i 's/server_name.*herobase.io[^;]*/& dao.vicfoundation.com/' "$NGINX_CONF"
    echo "[nginx-fix] Added dao.vicfoundation.com to server_name in $NGINX_CONF"
    nginx -t 2>/dev/null && nginx -s reload && echo "[nginx-fix] Nginx reloaded"
  else
    echo "[nginx-fix] dao.vicfoundation.com already configured"
  fi
else
  echo "[nginx-fix] WARNING: Could not find herobase.io nginx config"
fi
