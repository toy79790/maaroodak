#!/usr/bin/env bash
# ==============================================================================
#  تثبيت إعداد Nginx والشهادة لـ«معروضي» — بالنطاق المأخوذ من ملف البيئة
#
#      sudo bash /srv/maroudak/repo/deploy/scripts/nginx-setup.sh bootstrap
#      sudo bash /srv/maroudak/repo/deploy/scripts/nginx-setup.sh cert  بريدك@example.com
#      sudo bash /srv/maroudak/repo/deploy/scripts/nginx-setup.sh full
#
#  لماذا سكربت: النطاق يُكتب في مكان واحد فقط — NEXT_PUBLIC_APP_URL في
#  /srv/maroudak/shared/.env. ملفات Nginx في المستودع تحمل __DOMAIN__ ويُستبدل
#  هنا، فتغيير النطاق (maroody.duckdns.org → maroody.com) = تعديل سطر واحد في
#  البيئة ثم: cert · full · deploy.sh. لا تعديل يدوي لملفات Nginx.
#
#  المراحل (بالترتيب في أول تثبيت):
#    bootstrap  HTTP فقط على المنفذ 80 — يخدم تحدّي Let's Encrypt قبل وجود شهادة
#    cert       يصدر الشهادة للنطاق و www.النطاق (certonly --webroot)
#    full       HTTPS كامل + تحويل http و www إلى https://النطاق
# ==============================================================================
set -Eeuo pipefail

MODE="${1:-}"
ENV_FILE=/srv/maroudak/shared/.env
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/../nginx" && pwd)"
WEBROOT=/var/www/certbot

log()  { printf '\n\033[1;32m›\033[0m %s\n' "$*"; }
fail() { printf '\n\033[1;31m✗\033[0m %s\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "شغّله بـ sudo."
[[ -f "$ENV_FILE" ]] || fail "ملف البيئة مفقود: $ENV_FILE (deploy/README.md §6)"

# --- النطاق من NEXT_PUBLIC_APP_URL --------------------------------------------
URL=$(grep -E '^NEXT_PUBLIC_APP_URL=' "$ENV_FILE" | tail -1 | cut -d= -f2- | tr -d "\"' \r")
[[ "$URL" == https://* ]] || fail "NEXT_PUBLIC_APP_URL يجب أن يبدأ بـ https:// — القيمة الحالية: '$URL'"

DOMAIN="${URL#https://}"
DOMAIN="${DOMAIN%%/*}"
[[ "$DOMAIN" =~ ^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$ ]] \
  || fail "نطاق غير صالح: '$DOMAIN'"
[[ "$DOMAIN" != www.* ]] \
  || fail "اجعل NEXT_PUBLIC_APP_URL النطاق الجذري بلا www — Nginx يحوّل www إليه."

log "النطاق: $DOMAIN (و www.$DOMAIN)"

render() { sed "s/__DOMAIN__/$DOMAIN/g" "$1" > "$2"; }

reload_nginx() {
  nginx -t || fail "nginx -t رفض الإعداد — لم يُعَد التحميل، والإعداد السابق ما زال يعمل."
  systemctl reload nginx
}

case "$MODE" in
  bootstrap)
    mkdir -p "$WEBROOT"
    cp "$SRC/00-maroudak-zones.conf" /etc/nginx/conf.d/
    render "$SRC/maroudak-bootstrap.conf" /etc/nginx/sites-available/maroudak
    ln -sfn /etc/nginx/sites-available/maroudak /etc/nginx/sites-enabled/maroudak
    rm -f /etc/nginx/sites-enabled/default
    reload_nginx
    log "Nginx التمهيدي يعمل. تحقّق: curl -I http://$DOMAIN  (المتوقع 503 «قيد التجهيز»)"
    ;;

  cert)
    EMAIL="${2:-}"
    [[ "$EMAIL" == *@* ]] || fail "أعطِ بريدك لتنبيهات انتهاء الشهادة: nginx-setup.sh cert بريدك@example.com"
    command -v certbot >/dev/null || fail "certbot غير مثبّت: sudo apt install -y certbot"

    # DNS أولاً — Let's Encrypt تفشل وتستهلك محاولة إن لم يصل إليها.
    PUBLIC_IP=$(curl -fsS --max-time 10 https://api.ipify.org || true)
    for host in "$DOMAIN" "www.$DOMAIN"; do
      RESOLVED=$(getent ahostsv4 "$host" | awk 'NR==1{print $1}')
      [[ -n "$RESOLVED" ]] || fail "$host لا يُحلّ بعد — انتظر انتشار DNS."
      if [[ -n "$PUBLIC_IP" && "$RESOLVED" != "$PUBLIC_IP" ]]; then
        fail "$host يشير إلى $RESOLVED، وعنوان هذا الخادم $PUBLIC_IP — صحّح DNS أولاً."
      fi
    done

    certbot certonly --webroot -w "$WEBROOT" \
      -d "$DOMAIN" -d "www.$DOMAIN" \
      --email "$EMAIL" --agree-tos --no-eff-email \
      --deploy-hook "systemctl reload nginx"
    log "الشهادة صدرت. التالي: nginx-setup.sh full"
    ;;

  full)
    [[ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]] \
      || fail "لا شهادة لـ $DOMAIN بعد — شغّل: nginx-setup.sh cert بريدك@example.com"
    cp "$SRC/00-maroudak-zones.conf" /etc/nginx/conf.d/
    render "$SRC/maroudak-tls.conf" /etc/nginx/snippets/maroudak-tls.conf
    render "$SRC/maroudak.conf" /etc/nginx/sites-available/maroudak
    ln -sfn /etc/nginx/sites-available/maroudak /etc/nginx/sites-enabled/maroudak
    reload_nginx
    log "HTTPS يعمل على https://$DOMAIN"
    ;;

  *)
    fail "الاستخدام: nginx-setup.sh bootstrap | cert <بريد> | full"
    ;;
esac
