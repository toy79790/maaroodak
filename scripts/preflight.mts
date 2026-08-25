/**
 * فحص ما قبل النشر.
 *
 *   npx tsx scripts/preflight.mts
 *
 * يفحص ما يمكن فحصه **قبل** الوصول إلى منصة الاستضافة، فلا تُكتشف المشاكل
 * بعد فشل النشر. لا يتصل بأي خدمة خارجية ولا يقرأ أسراراً حقيقية.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

interface Check {
  name: string;
  run: () => { ok: boolean; detail?: string };
}

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const CHECKS: Check[] = [
  {
    name: '.env مستثنى من Git',
    run: () => {
      const ignore = read('.gitignore');
      const ok = /^\.env$/m.test(ignore);
      return { ok, detail: ok ? undefined : 'أضف .env إلى .gitignore' };
    },
  },
  {
    name: '.env.example موجود ومكتمل',
    run: () => {
      const example = read('.env.example');
      const required = [
        'APP_ENV',
        'NEXT_PUBLIC_APP_URL',
        'DATABASE_URL',
        'SESSION_SECRET',
        'ANTHROPIC_API_KEY',
        'STORAGE_DRIVER',
      ];
      const missing = required.filter((key) => !example.includes(`${key}=`));
      return {
        ok: missing.length === 0,
        detail: missing.length ? `ينقص: ${missing.join('، ')}` : undefined,
      };
    },
  },
  {
    name: 'الترحيلات موجودة',
    run: () => {
      const dir = 'prisma/migrations';
      if (!existsSync(dir)) return { ok: false, detail: 'لا مجلد ترحيلات' };

      const migrations = readdirSync(dir).filter((entry) =>
        existsSync(join(dir, entry, 'migration.sql')),
      );

      return {
        ok: migrations.length > 0,
        detail: `${migrations.length} ترحيل`,
      };
    },
  },
  {
    name: 'ملفات الترحيل بلا BOM',
    run: () => {
      // BOM في بداية ملف SQL يُفشل الترحيل بخطأ صياغة غامض على PostgreSQL.
      const dir = 'prisma/migrations';
      if (!existsSync(dir)) return { ok: true };

      const withBom = readdirSync(dir)
        .map((entry) => join(dir, entry, 'migration.sql'))
        .filter((path) => existsSync(path))
        .filter((path) => readFileSync(path)[0] === 0xef);

      return {
        ok: withBom.length === 0,
        detail: withBom.length ? withBom.join('، ') : undefined,
      };
    },
  },
  {
    name: 'db push غير مستخدم في الأوامر',
    run: () => {
      const pkg = JSON.parse(read('package.json'));
      const scripts: Record<string, string> = pkg.scripts ?? {};
      const offenders = Object.entries(scripts)
        .filter(([, value]) => value.includes('db push'))
        .map(([key]) => key);

      return {
        ok: offenders.length === 0,
        detail: offenders.length ? `أوامر تستخدمه: ${offenders.join('، ')}` : undefined,
      };
    },
  },
  {
    name: 'أمر النشر يطبّق الترحيلات',
    run: () => {
      const pkg = JSON.parse(read('package.json'));
      const build: string = pkg.scripts?.['vercel-build'] ?? '';
      const ok = build.includes('migrate deploy');
      return {
        ok,
        detail: ok ? undefined : 'أضف prisma migrate deploy إلى أمر البناء',
      };
    },
  },
  {
    name: 'لا نطاق مكتوب في الشيفرة',
    run: () => {
      const files = ['src/config/site.ts', 'src/app/sitemap.ts', 'src/app/robots.ts'];
      const offenders = files.filter((file) => /https?:\/\/(?!localhost)/.test(read(file)));
      return {
        ok: offenders.length === 0,
        detail: offenders.length ? offenders.join('، ') : undefined,
      };
    },
  },
  {
    name: 'لا أسرار في متغيرات العميل',
    run: () => {
      const example = read('.env.example');
      const offenders = [...example.matchAll(/^(NEXT_PUBLIC_\w+)=/gm)]
        .map((match) => match[1] ?? '')
        .filter((key) => /(KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)$/.test(key));

      return {
        ok: offenders.length === 0,
        detail: offenders.length ? offenders.join('، ') : undefined,
      };
    },
  },
  {
    name: 'الفحص الصحي موجود',
    run: () => ({ ok: existsSync('src/app/api/health/route.ts') }),
  },
  {
    name: 'CI مضبوط',
    run: () => ({ ok: existsSync('.github/workflows/ci.yml') }),
  },
];

console.log('\nفحص ما قبل النشر\n');

let failures = 0;

for (const check of CHECKS) {
  const result = check.run();

  if (result.ok) {
    console.log(`  ✓ ${check.name}${result.detail ? ` — ${result.detail}` : ''}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${check.name}${result.detail ? ` — ${result.detail}` : ''}`);
  }
}

console.log(
  failures === 0
    ? '\n✅ جاهز للنشر — راجع docs/PRODUCTION_CHECKLIST.md للبنود اليدوية\n'
    : `\n❌ ${failures} بند يحتاج إصلاحاً قبل النشر\n`,
);

process.exit(failures === 0 ? 0 : 1);
