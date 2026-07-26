#!/usr/bin/env python3
from pathlib import Path
import sys

if len(sys.argv) != 3:
    raise SystemExit("usage: patch-host-finalizer-v6.py INPUT OUTPUT")

text = Path(sys.argv[1]).read_text()

lock_old = '''exec 9>/var/lock/vets-herobase-host-prep.lock
flock -w 7200 9 || exit 75
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
'''
lock_new = '''exec 9>/var/lock/vets-herobase-host-prep.lock
flock -w 7200 9 || exit 75
# /var/www is a shared web root. Keep it root-owned; delegate only the app tree.
install -d -m 755 -o root -g root /var/www
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
'''
if text.count(lock_old) != 1:
    raise SystemExit(f"shared-web-root lock anchor count was {text.count(lock_old)}, expected 1")
text = text.replace(lock_old, lock_new, 1)

stage_old = '''  rm -rf "$STAGE"; install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/www
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" git clone --no-tags https://github.com/jratdish1/hero-dapp.git "$STAGE"
'''
stage_new = '''  rm -rf "$STAGE"
  install -d -m 755 -o root -g root /var/www
  install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$STAGE"
  runuser -u "$DEPLOY_USER" -- env HOME="/home/$DEPLOY_USER" git clone --no-tags https://github.com/jratdish1/hero-dapp.git "$STAGE"
'''
if text.count(stage_old) != 1:
    raise SystemExit(f"stage ownership anchor count was {text.count(stage_old)}, expected 1")
text = text.replace(stage_old, stage_new, 1)

swap_old = '''  mv "$STAGE" "$APP_DIR"; CANONICAL_SWAPPED=true; chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
  test "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER"; test -z "$(git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all)"
'''
swap_new = '''  mv "$STAGE" "$APP_DIR"; CANONICAL_SWAPPED=true; chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
  chown root:root /var/www
  chmod 755 /var/www
  test "$(stat -c '%U' /var/www)" = root
  test "$(stat -c '%U' "$APP_DIR")" = "$DEPLOY_USER"; test -z "$(git -C "$APP_DIR" status --porcelain=v1 --untracked-files=all)"
'''
if text.count(swap_old) != 1:
    raise SystemExit(f"canonical swap anchor count was {text.count(swap_old)}, expected 1")
text = text.replace(swap_old, swap_new, 1)

if 'install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" /var/www' in text:
    raise SystemExit("unsafe shared-web-root ownership mutation remains")
if 'test "$(stat -c \'%U\' /var/www)" = root' not in text:
    raise SystemExit("root ownership verification missing")
Path(sys.argv[2]).write_text(text)
