#!/usr/bin/env bash
# ==============================================================================
#  نشر إصدار جديد من «معروضك»
#
#      sudo -u maroudak /srv/maroudak/scripts/deploy.sh [ref]
#
#  ref: فرع أو وسم أو SHA. الافتراضي origin/main.
#
#  المبدأ: الإصدار الجديد يُبنى **كاملاً** قبل أن يمسّ الإصدار العامل. تبديل
#  الرابط الرمزي هو اللحظة الوحيدة التي يتغيّر فيها ما يراه المستخدم، وهي
#  عملية ذرّية. أي فشل قبلها لا يؤثر على الموقع الحيّ إطلاقاً.
# ==============================================================================
set -Eeuo pipefail

APP_DIR=/srv/maroudak
REPO_DIR="$APP_DIR/repo"
RELEASES="$APP_DIR/releases"
SHARED="$APP_DIR/shared"
CURRENT="$APP_DIR/current"
KEEP_RELEASES=5
HEALTH_URL="http://127.0.0.1:3000/api/health"
HEALTH_RETRIES=20

REF="${1:-origin/main}"

log()  { printf '\n\033[1;32m›\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$SHARED/.env" ]] || fail "ملف البيئة مفقود: $SHARED/.env"

# ------------------------------------------------------------------ 1) الشيفرة
log "جلب $REF"
git -C "$REPO_DIR" fetch --all --prune --tags
SHA=$(git -C "$REPO_DIR" rev-parse --short "$REF")
RELEASE="$RELEASES/$(date +%Y%m%d%H%M%S)-$SHA"

log "تجهيز الإصدار $SHA"
mkdir -p "$RELEASE"
git -C "$REPO_DIR" archive "$REF" | tar -x -C "$RELEASE"

cd "$RELEASE"
ln -sfn "$SHARED/.env" "$RELEASE/.env"

# ------------------------------------------------------- 2) الاعتماديات والبناء
log "تثبيت الاعتماديات"
npm ci --no-audit --no-fund

log "توليد عميل Prisma"
npx prisma generate

# ⚠️ الترحيل قبل البناء لا بعده: لو فشل، لا نكون قد بنينا شيئاً بلا داعٍ.
# `migrate deploy` يطبّق المُودَع فقط ولا يحذف شيئاً من تلقائه.
log "تطبيق الترحيلات"
set -a; . "$SHARED/.env"; set +a
npx prisma migrate deploy

log "البناء"
npm run build

# خرج standalone لا ينسخ الأصول الثابتة تلقائياً — بدونها تعمل الصفحة بلا CSS.
log "تجميع الخرج المستقل"
cp -r "$RELEASE/.next/static" "$RELEASE/.next/standalone/.next/static"
[[ -d "$RELEASE/public" ]] && cp -r "$RELEASE/public" "$RELEASE/.next/standalone/public"

# server.js يتوقّع أن يكون جذر التشغيل هو standalone.
STANDALONE="$RELEASE/.next/standalone"
[[ -f "$STANDALONE/server.js" ]] || fail "server.js مفقود — تحقق من output:'standalone'"

# --------------------------------------------------- 3) التبديل والفحص الصحي
PREVIOUS=$(readlink -f "$CURRENT" 2>/dev/null || echo "")

log "تبديل الإصدار العامل"
ln -sfn "$STANDALONE" "$CURRENT"
sudo systemctl restart maroudak

log "فحص صحي"
healthy=false
for i in $(seq 1 $HEALTH_RETRIES); do
    sleep 1
    body=$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null) || continue
    if grep -q '"status":"ok"' <<<"$body"; then healthy=true; break; fi
    printf '  محاولة %s/%s…\n' "$i" "$HEALTH_RETRIES"
done

if [[ "$healthy" != true ]]; then
    printf '\n\033[1;31m✗ الفحص الصحي فشل — رجوع تلقائي\033[0m\n' >&2
    if [[ -n "$PREVIOUS" && -d "$PREVIOUS" ]]; then
        ln -sfn "$PREVIOUS" "$CURRENT"
        sudo systemctl restart maroudak
        printf '  رجعنا إلى %s\n' "$(basename "$(dirname "$(dirname "$PREVIOUS")")")" >&2
    else
        printf '  لا إصدار سابق للرجوع إليه.\n' >&2
    fi
    printf '\n  آخر السجلات:\n' >&2
    sudo journalctl -u maroudak -n 40 --no-pager >&2
    exit 1
fi

# ⚠️ الترحيلات لا تُرجَع تلقائياً. لو رجعنا بعد ترحيل هادم، فالإصدار السابق
# يواجه مخططاً لا يعرفه. اكتب الترحيلات متوافقةً مع الإصدار السابق دائماً
# (أضف عموداً، لا تحذفه في نفس الإصدار). انظر docs/DATABASE.md §9

# ------------------------------------------------------------ 4) تنظيف الأقدم
log "حذف الإصدارات القديمة (نُبقي $KEEP_RELEASES)"
ls -1dt "$RELEASES"/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf

printf '\n\033[1;32m✓ نُشر %s بنجاح\033[0m\n\n' "$SHA"
