#!/usr/bin/env bash
# ==============================================================================
#  البيانات الأولية لـ«معروضي» — الجهات · أنواع الطلبات · الأسئلة · القوالب ·
#  الموجّهات · الخطط · إعدادات النظام
#
#      sudo -u maroudak /srv/maroudak/scripts/seed.sh
#
#  شغّله **مرة واحدة** عند الإعداد الأول. لا يُكرّر السجلات لو أُعيد، لكنه
#  يُعيد الجهات وأنواع الطلبات والأسئلة المبذورة إلى قيمها الأصلية — فيمحو
#  تعديلات اللوحة عليها ويُعيد تفعيل ما حُذف منها. الفئات والإعدادات لا تُمسّ.
#  لا يُنشئ حسابات تجريبية على قاعدة الإنتاج (انظر seedAccounts في prisma/seed.ts).
#
#  لماذا سكربت لا أمر مباشر: البذر يحتاج ملف البيئة (رابط القاعدة) واعتماديات
#  التطوير (tsx)، وكلاهما موجود في مجلد الإصدار العامل لا في نسخة المستودع.
# ==============================================================================
set -Eeuo pipefail

APP_DIR=/srv/maroudak
SHARED="$APP_DIR/shared"
CURRENT="$APP_DIR/current"

fail() { printf '\n\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

[[ -f "$SHARED/.env" ]] || fail "ملف البيئة مفقود: $SHARED/.env"

CURRENT_PATH=$(readlink -f "$CURRENT" 2>/dev/null || echo "")
[[ -n "$CURRENT_PATH" ]] || fail "لا إصدار منشور بعد — شغّل deploy.sh أولاً."

# current يشير إلى <release>/.next/standalone — نصعد مستويين للإصدار نفسه.
RELEASE=$(dirname "$(dirname "$CURRENT_PATH")")
[[ -f "$RELEASE/prisma/seed.ts" ]] || fail "ملف البذر غير موجود في $RELEASE"

set -a; . "$SHARED/.env"; set +a

cd "$RELEASE"
npx tsx prisma/seed.ts
