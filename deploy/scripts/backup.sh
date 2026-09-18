#!/usr/bin/env bash
# ==============================================================================
#  نسخة احتياطية لقاعدة البيانات → تخزين كائنات OCI (٢٠ جيجا مجاناً، نفس المنطقة)
#
#      /srv/maroudak/scripts/backup.sh
#
#  يُشغَّل يومياً عبر systemd timer (انظر deploy/README.md).
#
#  ⚠️ نسخة لم تُختبر استعادتها ليست نسخة. جرّب الاستعادة على قاعدة منفصلة
#     مرة واحدة على الأقل قبل الإطلاق — الأمر في آخر هذا الملف.
# ==============================================================================
set -Eeuo pipefail

SHARED=/srv/maroudak/shared
BACKUP_DIR=/srv/maroudak/backups
BUCKET="${OCI_BACKUP_BUCKET:-maroudak-backups}"
KEEP_LOCAL_DAYS=7

set -a; . "$SHARED/.env"; set +a

STAMP=$(date +%Y-%m-%d-%H%M)
FILE="$BACKUP_DIR/maroudak-$STAMP.dump"

mkdir -p "$BACKUP_DIR"

# --format=custom يتيح استعادة انتقائية وضغطاً داخلياً — أفضل من SQL خام.
# ⚠️ نحذف معاملات الاستعلام: `?schema=public` يخصّ Prisma، وlibpq يرفضه
#    بـ«invalid URI query parameter» فتفشل كل نسخة بصمت في المؤقّت.
pg_dump "${DATABASE_URL%%\?*}" --format=custom --no-owner --file="$FILE"

SIZE=$(stat -c%s "$FILE")
[[ "$SIZE" -gt 10000 ]] || { echo "النسخة صغيرة بشكل مريب ($SIZE بايت) — أُلغيت." >&2; rm -f "$FILE"; exit 1; }

# --- الرفع إلى تخزين الكائنات -------------------------------------------------
# يتطلب: oci-cli مهيّأ بمبدأ نسخة (Instance Principal) — بلا مفاتيح على القرص.
if command -v oci >/dev/null 2>&1; then
    oci os object put \
        --bucket-name "$BUCKET" \
        --file "$FILE" \
        --name "db/$(basename "$FILE")" \
        --auth instance_principal \
        --force >/dev/null
    echo "رُفعت: db/$(basename "$FILE")"
else
    echo "تحذير: oci-cli غير مثبَّت — النسخة محلية فقط، وقرص واحد ليس نسخاً احتياطياً." >&2
fi

# --- تنظيف المحلي -------------------------------------------------------------
find "$BACKUP_DIR" -name 'maroudak-*.dump' -mtime +$KEEP_LOCAL_DAYS -delete

echo "تمّت: $FILE ($(numfmt --to=iec "$SIZE"))"

# ==============================================================================
#  الاستعادة — اختبرها مرة قبل أن تحتاجها
#
#    sudo -u postgres createdb -O maroudak maroudak_restore_test
#    sudo -u postgres pg_restore --dbname=maroudak_restore_test --no-owner --role=maroudak ملف.dump
#    sudo -u postgres psql -d maroudak_restore_test -c 'SELECT count(*) FROM "Letter";'
#    sudo -u postgres dropdb maroudak_restore_test
#
#  الخطوات الكاملة (ومنها الاستعادة الفعلية): deploy/README.md §10
# ==============================================================================
