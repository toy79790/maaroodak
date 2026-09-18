# النشر على Oracle Cloud — جدة

تهيئة خادم واحد من الصفر إلى موقع يعمل بـHTTPS.

**المعمارية:** Nginx (TLS · تحديد معدّل · ضغط) ← Node (خرج `standalone` تحت
systemd) ← PostgreSQL على الجهاز نفسه. النسخ الاحتياطي إلى تخزين كائنات OCI
في المنطقة ذاتها.

**القرارات وأسبابها:** `docs/DECISIONS.md #D-033`.

---

## 0. قبل أن تبدأ

| المتطلب | ملاحظة |
|---|---|
| حساب Oracle Cloud | ⚠️ **المنطقة الأم تُختار مرة واحدة عند التسجيل ولا تتغيّر** — اختر `me-jeddah-1` |
| نطاق مسجَّل | مع إمكانية تعديل سجلات DNS |
| مفتاح SSH | `ssh-keygen -t ed25519` — ارفع العام عند إنشاء الجهاز |

الطبقة المجانية اليوم: **٢ نواة · ١٢ جيجا** لـAmpere A1 (خُفّضت من ٤/٢٤ في
١٥ يونيو ٢٠٢٦) · ٢٠٠ جيجا تخزين كتل · ٢٠ جيجا تخزين كائنات · ١٠ تيرابايت صادر.

---

## 1. إنشاء الجهاز

Console → Compute → Instances → Create.

| الحقل | القيمة |
|---|---|
| Image | **Ubuntu 24.04 (aarch64)** |
| Shape | `VM.Standard.A1.Flex` · **2 OCPU · 12 GB** |
| Boot volume | 100 GB (من ٢٠٠ المجانية) |
| VCN | أنشئ جديدة بشبكة فرعية عامة |

> **`Out of host capacity`؟** شائع على A1. جرّب نطاق توفّر آخر، أو أعد
> المحاولة بعد ساعات، أو حوّل الحساب إلى Pay-as-you-go — يرفع أولويتك
> ويبقى استخدامك داخل الحد المجاني بلا فاتورة.

## 2. الشبكة — **في مكانين لا مكان واحد**

هذا المطبّ يوقف الجميع: صور Ubuntu على OCI تأتي بجدار `iptables` محمَّل
مسبقاً. فتح المنفذ في السحابة وحدها يعطي «انتهت المهلة» بلا سبب ظاهر.

**أ) قائمة الأمان** — VCN → Security Lists → Ingress:

| المصدر | المنفذ | الغرض |
|---|---|---|
| `0.0.0.0/0` | 80 | ACME + التحويل |
| `0.0.0.0/0` | 443 | الموقع |
| `<عنوانك>/32` | 22 | SSH — **لا تفتحه للعالم** |

**ب) داخل الجهاز:**

```bash
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

## 3. تهيئة النظام

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib git curl ufw fail2ban unattended-upgrades

# Node 22 لـarm64
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v          # تأكّد: v22.x · aarch64

# تحديثات أمنية تلقائية
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

## 4. المستخدم والمجلدات

```bash
sudo useradd -r -m -d /srv/maroudak -s /bin/bash maroudak
sudo -u maroudak mkdir -p /srv/maroudak/{releases,shared,scripts,backups}

# المستودع خاص: الخادم يحتاج مفتاح قراءة فقط (Deploy key) لا حسابك.
sudo -u maroudak ssh-keygen -t ed25519 -N '' -f /srv/maroudak/.ssh/id_ed25519 -C maroudak-deploy
sudo -u maroudak cat /srv/maroudak/.ssh/id_ed25519.pub
# ↑ انسخه إلى: GitHub → المستودع → Settings → Deploy keys → Add deploy key
#   (اترك «Allow write access» غير محدّد)
sudo -u maroudak ssh -o StrictHostKeyChecking=accept-new -T git@github.com   # رسالة ترحيب = يعمل

sudo -u maroudak git clone git@github.com:toy79790/maaroodak.git /srv/maroudak/repo
sudo -u maroudak cp /srv/maroudak/repo/deploy/scripts/*.sh /srv/maroudak/scripts/
sudo chmod +x /srv/maroudak/scripts/*.sh

# النشر يحتاج إعادة تشغيل الخدمة دون كلمة مرور — وهذا فقط
echo 'maroudak ALL=(root) NOPASSWD: /bin/systemctl restart maroudak, /bin/systemctl status maroudak, /bin/journalctl -u maroudak *' \
  | sudo tee /etc/sudoers.d/maroudak
sudo chmod 440 /etc/sudoers.d/maroudak
```

## 5. قاعدة البيانات

```bash
sudo -u postgres psql <<'SQL'
CREATE USER maroudak WITH PASSWORD 'ضع-كلمة-مرور-قوية-هنا';
CREATE DATABASE maroudak OWNER maroudak;
SQL
```

ضبط لـ١٢ جيجا مشتركة مع Node — في `/etc/postgresql/16/main/postgresql.conf`:

```conf
listen_addresses = 'localhost'   # ⚠️ لا تكشفها للشبكة أبداً
shared_buffers = 2GB
effective_cache_size = 6GB
work_mem = 16MB
maintenance_work_mem = 512MB
max_connections = 100
```

```bash
sudo systemctl restart postgresql
```

## 6. ملف البيئة

القيم الجاهزة في ملفك المحلي `.env.production.local` (غير مرفوع إلى Git) —
انسخها ثم ضع كلمة مرور القاعدة من الخطوة 5:

```bash
sudo -u maroudak nano /srv/maroudak/shared/.env
sudo chmod 600 /srv/maroudak/shared/.env
```

```env
APP_ENV=production
NODE_ENV=production

NEXT_PUBLIC_APP_URL=https://maroody.com
NEXT_PUBLIC_SUPPORT_EMAIL=بريد-الدعم

# ⚠️ none لا www: Nginx يتولّى التوحيد، وضبطهما معاً يعني تحويلاً مزدوجاً.
CANONICAL_HOST_MODE=none

# لا مُجمِّع مع قاعدة على المضيف نفسه، فالرابطان متطابقان (#D-032).
DATABASE_URL=postgresql://maroudak:كلمة-المرور@localhost:5432/maroudak?schema=public
DIRECT_DATABASE_URL=postgresql://maroudak:كلمة-المرور@localhost:5432/maroudak?schema=public

# ولّد جديداً: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
SESSION_SECRET=

ANTHROPIC_API_KEY=

# «نسيت كلمة المرور» لا تعمل بدونه — smtps://USER:PASS@host:465
SMTP_URL=
MAIL_FROM=no-reply@maroody.com

# اختياريان — انظر قسم «Google» أدناه
NEXT_PUBLIC_GA_MEASUREMENT_ID=
NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION=

LOG_LEVEL=info
```

> `NEXT_PUBLIC_*` **تُدمج وقت البناء**. أي تغيير فيها يتطلب `deploy.sh`
> من جديد، لا إعادة تشغيل.
>
> التطبيق **يرفض الإقلاع** إن كان `SESSION_SECRET` قيمة التطوير، أو
> `NEXT_PUBLIC_APP_URL` بلا HTTPS، أو `DATABASE_URL` هي قاعدة التطوير.

## 7. الخدمة و Nginx (مرحلة التمهيد)

الإعداد الكامل يشير إلى ملفات شهادة لا توجد قبل إصدارها، فيرفضه `nginx -t`.
لذلك نبدأ بإعداد تمهيدي على المنفذ 80 فقط، يخدم تحدّي Let's Encrypt:

```bash
sudo cp /srv/maroudak/repo/deploy/systemd/maroudak.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable maroudak

sudo mkdir -p /var/www/certbot
sudo cp /srv/maroudak/repo/deploy/nginx/00-maroudak-zones.conf /etc/nginx/conf.d/
sudo cp /srv/maroudak/repo/deploy/nginx/maroudak-bootstrap.conf /etc/nginx/sites-available/maroudak
sudo ln -sf /etc/nginx/sites-available/maroudak /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

## 8. DNS ثم الشهادة ثم HTTPS

**أ) DNS** — في لوحة مسجّل النطاق (الخطوات التفصيلية لمسجّلك تُكتب عند الشراء):

| النوع | الاسم | القيمة | TTL |
|---|---|---|---|
| A | `@` | عنوان IP العام للجهاز (Compute → Instances) | 300 |
| A | `www` | العنوان نفسه | 300 |

**احذف** أي سجل `A` أو `AAAA` أو `CNAME` موجود مسبقاً على `@` أو `www`
(صفحات «الدومين للبيع» الافتراضية). **لا تمسّ** سجلات `MX` و`TXT` إن كان لديك
بريد على النطاق.

انتظر الانتشار **قبل** طلب الشهادة — Let's Encrypt تفشل وتستهلك محاولة إن لم
يصلها DNS:

```bash
dig +short maroody.com        # يجب أن يطبع عنوان الجهاز
dig +short www.maroody.com    # والعنوان نفسه
curl -I http://maroody.com    # 503 «قيد التجهيز» = Nginx التمهيدي يستجيب
```

**ب) الشهادة** — `certonly --webroot` لا `--nginx`: لا نسمح لـcertbot بتعديل
ملفات Nginx، فيبقى الإعداد في المستودع مصدر الحقيقة:

```bash
sudo apt install -y certbot
sudo certbot certonly --webroot -w /var/www/certbot \
  -d maroody.com -d www.maroody.com \
  --email بريدك --agree-tos --no-eff-email \
  --deploy-hook "systemctl reload nginx"
```

`--deploy-hook` يُحفظ مع الشهادة: كل تجديد تلقائي يُعيد تحميل Nginx بالشهادة
الجديدة. تحقّق من المؤقّت: `systemctl list-timers | grep certbot`.

**ج) الإعداد الكامل** — HTTPS، وتحويل `http` و`www` إلى `https://maroody.com`:

```bash
sudo cp /srv/maroudak/repo/deploy/nginx/maroudak-tls.conf /etc/nginx/snippets/
sudo cp /srv/maroudak/repo/deploy/nginx/maroudak.conf /etc/nginx/sites-available/maroudak
sudo nginx -t && sudo systemctl reload nginx
```

## 9. أول نشر

```bash
sudo -u maroudak /srv/maroudak/scripts/deploy.sh origin/main
```

السكربت يبني، يطبّق الترحيلات، يبدّل الرابط، ويفحص `/api/health`.
**فشل الفحص يُرجع الإصدار السابق تلقائياً.**

ثم البيانات الأولية **مرة واحدة**، وترقية حسابك:

```bash
sudo -u maroudak /srv/maroudak/scripts/seed.sh
# سجّل حسابك من الموقع أولاً، ثم:
sudo -u postgres psql -d maroudak -c \
  "UPDATE \"User\" SET role='SUPER_ADMIN' WHERE email='بريدك';"
```

البذر لا يُنشئ الحسابات التجريبية (`admin@maroudak.sa`) على قاعدة الإنتاج.

**تحقّق من HTTPS:**

```bash
curl -sI http://maroody.com      | grep -i '^location'   # https://maroody.com/
curl -sI https://www.maroody.com | grep -i '^location'   # https://maroody.com/
curl -sI https://maroody.com     | grep -i strict-transport
curl -s  https://maroody.com/api/health
```

## 10. النسخ الاحتياطي

| السؤال | الجواب |
|---|---|
| ماذا يُنسخ؟ | قاعدة البيانات كاملة (`pg_dump` بصيغة custom مضغوطة): المستخدمون، المعاريض ونسخها، الكتالوج، الإعدادات، سجل التدقيق |
| ما لا يُنسخ | الشيفرة (في GitHub) · ملف البيئة (احفظ نسخته في مدير كلمات مرور) |
| كم مرة؟ | يومياً 3 صباحاً عبر `systemd timer` — `Persistent=true` يعوّض ما فات إن كان الجهاز مطفأً |
| أين؟ | ٧ أيام محلياً في `/srv/maroudak/backups` + نسخة في تخزين كائنات OCI بالمنطقة نفسها (تبقى البيانات في السعودية) |
| الاحتفاظ السحابي | اضبط في الـBucket قاعدة Lifecycle: حذف ما يزيد على ٣٠ يوماً |

```bash
sudo tee /etc/systemd/system/maroudak-backup.service >/dev/null <<'EOF'
[Unit]
Description=نسخة احتياطية لقاعدة معروضي
[Service]
Type=oneshot
User=maroudak
ExecStart=/srv/maroudak/scripts/backup.sh
EOF

sudo tee /etc/systemd/system/maroudak-backup.timer >/dev/null <<'EOF'
[Unit]
Description=نسخة يومية 3 صباحاً
[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true
[Install]
WantedBy=timers.target
EOF

sudo systemctl enable --now maroudak-backup.timer
sudo systemctl start maroudak-backup.service   # نسخة فورية للتجربة
ls -lh /srv/maroudak/backups
```

**الرفع إلى السحابة بلا مفاتيح على القرص:** أنشئ Bucket باسم `maroudak-backups`،
ثم Dynamic Group تضم الجهاز، وسياسة `allow dynamic-group <اسمها> to manage
objects in compartment <اسمه>`. ثبّت OCI CLI بالطريقة الرسمية
(docs.oracle.com ← «Installing the CLI»). بدونه تبقى النسخ محلية فقط، ويطبع
السكربت تحذيراً.

**الاستعادة** — جرّبها مرة قبل الإطلاق على قاعدة منفصلة:

```bash
# 1) تجربة آمنة: استعادة إلى قاعدة مؤقتة وعدّ المعاريض
sudo -u postgres createdb -O maroudak maroudak_restore_test
sudo -u postgres pg_restore --dbname=maroudak_restore_test --no-owner --role=maroudak /srv/maroudak/backups/maroudak-<التاريخ>.dump
sudo -u postgres psql -d maroudak_restore_test -c 'SELECT count(*) FROM "Letter";'
sudo -u postgres dropdb maroudak_restore_test

# 2) استعادة فعلية (كارثة): أوقف التطبيق، استعد فوق القاعدة، شغّل
sudo systemctl stop maroudak
sudo -u postgres pg_restore --dbname=maroudak --clean --if-exists --no-owner --role=maroudak <الملف>.dump
sudo systemctl start maroudak
```

## Google

**Search Console:** search.google.com/search-console ← Add property ← **URL prefix**
`https://maroody.com` ← طريقة **HTML tag** ← انسخ قيمة `content` فقط إلى
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` ← `deploy.sh` ← Verify. ثم Sitemaps ←
`sitemap.xml`.

**Analytics:** أنشئ خاصية GA4 ← Web stream ← انسخ `G-XXXXXXXXXX` إلى
`NEXT_PUBLIC_GA_MEASUREMENT_ID` ← `deploy.sh`. ثم **لازم**: Admin ← Data
streams ← Enhanced measurement ← عطّل **Page changes based on browser history
events** — وإلا قاس GA صفحات الحساب والمعاريض متجاوزاً فلتر الخصوصية (#D-037).

---

## التشغيل اليومي

```bash
sudo -u maroudak /srv/maroudak/scripts/deploy.sh          # نشر
sudo -u maroudak /srv/maroudak/scripts/rollback.sh        # رجوع
sudo journalctl -u maroudak -f                            # السجلات
curl -s https://maroody.com/api/health | jq                 # الصحة
sudo systemctl status maroudak postgresql nginx
```

## حين يقع خطب

| العرض | الفحص |
|---|---|
| انتهت مهلة الاتصال | المنفذ مفتوح في **قائمة الأمان و`iptables` معاً**؟ |
| 502 Bad Gateway | `systemctl status maroudak` — الخدمة ساقطة أو المنفذ مختلف |
| 429 مبكراً جداً | حدود `limit_req` — راجع `00-maroudak-zones.conf` |
| الموقع بلا تنسيق | `.next/static` لم يُنسخ — يفعله `deploy.sh` تلقائياً |
| `/api/health` يعطي 503 | قاعدة البيانات ساقطة: `systemctl status postgresql` |
