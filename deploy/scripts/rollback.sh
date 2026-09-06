#!/usr/bin/env bash
# ==============================================================================
#  الرجوع إلى إصدار سابق
#
#      sudo -u maroudak /srv/maroudak/scripts/rollback.sh          # السابق مباشرة
#      sudo -u maroudak /srv/maroudak/scripts/rollback.sh 20260906… # إصدار بعينه
#
#  الرجوع لحظي: الإصدارات القديمة مبنية بالفعل، فلا بناء ولا تثبيت — تبديل
#  رابط وإعادة تشغيل.
#
#  ⚠️ لا يُرجع الترحيلات. إن كان الإصدار الجديد قد طبّق ترحيلاً هادماً (حذف
#     عمود، تغيير نوع)، فالرجوع يضع شيفرةً قديمة أمام مخطط جديد. استعِد نسخة
#     القاعدة الاحتياطية عندها، ولا تعتمد على هذا السكربت وحده.
# ==============================================================================
set -Eeuo pipefail

APP_DIR=/srv/maroudak
RELEASES="$APP_DIR/releases"
CURRENT="$APP_DIR/current"
HEALTH_URL="http://127.0.0.1:3000/api/health"

log()  { printf '\n\033[1;32m›\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

CURRENT_PATH=$(readlink -f "$CURRENT" 2>/dev/null || echo "")
# current يشير إلى <release>/.next/standalone — نصعد مستويين للإصدار نفسه.
CURRENT_RELEASE=$(dirname "$(dirname "$CURRENT_PATH")")

if [[ -n "${1:-}" ]]; then
    TARGET=$(ls -1d "$RELEASES"/"$1"* 2>/dev/null | head -1)
    [[ -n "$TARGET" ]] || fail "لا إصدار يطابق: $1"
else
    TARGET=$(ls -1dt "$RELEASES"/*/ | grep -v "^$CURRENT_RELEASE/$" | head -1)
    [[ -n "$TARGET" ]] || fail "لا إصدار سابق."
fi

TARGET="${TARGET%/}"
[[ -f "$TARGET/.next/standalone/server.js" ]] || fail "الإصدار غير مكتمل: $TARGET"

log "الرجوع من $(basename "$CURRENT_RELEASE") إلى $(basename "$TARGET")"
ln -sfn "$TARGET/.next/standalone" "$CURRENT"
sudo systemctl restart maroudak

for i in $(seq 1 15); do
    sleep 1
    if curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null | grep -q '"status":"ok"'; then
        printf '\n\033[1;32m✓ رجعنا إلى %s\033[0m\n\n' "$(basename "$TARGET")"
        exit 0
    fi
done

fail "الإصدار السابق لا يستجيب أيضاً — راجع: journalctl -u maroudak -n 60"
