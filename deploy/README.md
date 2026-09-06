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

sudo -u maroudak git clone https://github.com/toy79790/maaroodak.git /srv/maroudak/repo
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

```bash
sudo -u maroudak nano /srv/maroudak/shared/.env
sudo chmod 600 /srv/maroudak/shared/.env
```

```env
APP_ENV=production
NODE_ENV=production

NEXT_PUBLIC_APP_URL=https://maroud.sa
NEXT_PUBLIC_SUPPORT_EMAIL=support@maroud.sa

# ⚠️ none لا www: Nginx يتولّى التوحيد، وضبطهما معاً يعني تحويلاً مزدوجاً.
CANONICAL_HOST_MODE=none

# لا مُجمِّع مع قاعدة على المضيف نفسه، فالرابطان متطابقان (#D-032).
DATABASE_URL=postgresql://maroudak:كلمة-المرور@localhost:5432/maroudak?schema=public
DIRECT_DATABASE_URL=postgresql://maroudak:كلمة-المرور@localhost:5432/maroudak?schema=public

# ولّد جديداً: node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
SESSION_SECRET=

ANTHROPIC_API_KEY=
LOG_LEVEL=info
```

> `NEXT_PUBLIC_APP_URL` **يُدمج وقت البناء**. أي تغيير فيه يتطلب `deploy.sh`
> من جديد، لا إعادة تشغيل.

## 7. الخدمة و Nginx

```bash
sudo cp /srv/maroudak/repo/deploy/systemd/maroudak.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable maroudak

sudo cp /srv/maroudak/repo/deploy/nginx/00-maroudak-zones.conf /etc/nginx/conf.d/
sudo cp /srv/maroudak/repo/deploy/nginx/maroudak.conf /etc/nginx/sites-available/maroudak
sudo ln -sf /etc/nginx/sites-available/maroudak /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

sudo sed -i 's/maroud\.sa/نطاقك-هنا/g' /etc/nginx/sites-available/maroudak
sudo nginx -t
```

## 8. DNS ثم الشهادة

| النوع | الاسم | القيمة |
|---|---|---|
| A | `@` | عنوان الجهاز العام |
| A | `www` | العنوان نفسه |

انتظر الانتشار (`dig +short maroud.sa`) **قبل** طلب الشهادة — Let's Encrypt
تفشل وتستهلك محاولة إن لم يصلها DNS.

```bash
sudo mkdir -p /var/www/certbot
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d maroud.sa -d www.maroud.sa
systemctl list-timers | grep certbot     # التجديد تلقائي
```

## 9. أول نشر

```bash
sudo -u maroudak /srv/maroudak/scripts/deploy.sh origin/main
```

السكربت يبني، يطبّق الترحيلات، يبدّل الرابط، ويفحص `/api/health`.
**فشل الفحص يُرجع الإصدار السابق تلقائياً.**

ثم البذور مرة واحدة، وترقية حسابك:

```bash
cd /srv/maroudak/repo && sudo -u maroudak npx tsx prisma/seed.ts
# سجّل حسابك من الموقع أولاً، ثم:
sudo -u postgres psql -d maroudak -c \
  "UPDATE \"User\" SET role='SUPER_ADMIN' WHERE email='بريدك';"
```

## 10. النسخ الاحتياطي اليومي

```bash
sudo tee /etc/systemd/system/maroudak-backup.service >/dev/null <<'EOF'
[Unit]
Description=نسخة احتياطية لقاعدة معروضك
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
```

للرفع إلى تخزين الكائنات بلا مفاتيح على القرص: أنشئ Dynamic Group للجهاز
وسياسة `allow dynamic-group ... to manage objects in compartment ...`، ثم
`sudo apt install oci-cli`.

---

## التشغيل اليومي

```bash
sudo -u maroudak /srv/maroudak/scripts/deploy.sh          # نشر
sudo -u maroudak /srv/maroudak/scripts/rollback.sh        # رجوع
sudo journalctl -u maroudak -f                            # السجلات
curl -s https://maroud.sa/api/health | jq                 # الصحة
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
