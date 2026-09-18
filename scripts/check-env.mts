/**
 * فحص إعدادات البيئة قبل النشر.
 *
 *   npx tsx scripts/check-env.mts
 *
 * يشغّل نفس تحقق `src/config/env.ts` على المتغيرات الحالية ويطبع النتيجة
 * بوضوح. يُستخدم للتأكد من إعدادات الإنتاج **قبل** الدفع، لا بعد فشل النشر.
 */
import { spawnSync } from 'node:child_process';

interface Scenario {
  name: string;
  env: Record<string, string>;
  expect: 'pass' | 'fail';
}

const BASE = {
  DATABASE_URL: 'postgresql://user:pass@db.example.com:5432/prod?sslmode=require',
  SESSION_SECRET: 'a'.repeat(48),
  NEXT_PUBLIC_APP_URL: 'https://www.example.com',
};

const SCENARIOS: Scenario[] = [
  {
    name: 'إعداد إنتاج سليم',
    env: { ...BASE, APP_ENV: 'production' },
    expect: 'pass',
  },
  {
    name: 'رفض السرّ الافتراضي',
    env: {
      ...BASE,
      APP_ENV: 'production',
      SESSION_SECRET: 'change-me-to-a-long-random-string-at-least-32-chars',
    },
    expect: 'fail',
  },
  {
    name: 'رفض HTTP في الإنتاج',
    env: { ...BASE, APP_ENV: 'production', NEXT_PUBLIC_APP_URL: 'http://example.com' },
    expect: 'fail',
  },
  {
    name: 'رفض localhost في الإنتاج',
    env: {
      ...BASE,
      APP_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://localhost:3000',
    },
    expect: 'fail',
  },
  {
    // Oracle: القاعدة على المضيف نفسه (#D-033، #D-038) — يجب أن تُقبل.
    name: 'قبول قاعدة إنتاج على localhost:5432',
    env: {
      ...BASE,
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://maroudak:Str0ng-Pass@localhost:5432/maroudak?schema=public',
    },
    expect: 'pass',
  },
  {
    name: 'رفض قاعدة التطوير في الإنتاج',
    env: {
      ...BASE,
      APP_ENV: 'production',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5433/maroudak?schema=public',
    },
    expect: 'fail',
  },
  {
    name: 'رفض التخزين السحابي بلا بيانات اعتماد',
    env: { ...BASE, APP_ENV: 'production', STORAGE_DRIVER: 's3' },
    expect: 'fail',
  },
  {
    name: 'رفض سرّ قصير',
    env: { ...BASE, APP_ENV: 'production', SESSION_SECRET: 'short' },
    expect: 'fail',
  },
  {
    name: 'التطوير يتسامح مع HTTP',
    env: {
      ...BASE,
      APP_ENV: 'development',
      NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    },
    expect: 'pass',
  },
];

const LOADER = `
  process.env.NEXT_PHASE = '';
  const { env } = await import('./src/config/env.ts');
  console.log('LOADED:' + env.APP_ENV);
`;

let failures = 0;

console.log('\nفحص تحققات البيئة\n');

for (const scenario of SCENARIOS) {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--input-type=module', '-e', LOADER],
    {
      // بيئة نظيفة تماماً — لا يتسرّب إليها .env المحلي.
      env: {
        PATH: process.env.PATH ?? '',
        NODE_ENV: 'production',
        ...scenario.env,
      },
      encoding: 'utf8',
      cwd: process.cwd(),
    },
  );

  const loaded = result.stdout.includes('LOADED:');
  const passed = loaded === (scenario.expect === 'pass');

  if (passed) {
    console.log(`  ✓ ${scenario.name}`);
  } else {
    failures += 1;
    console.log(`  ✗ ${scenario.name}`);
    console.log(`     متوقّع: ${scenario.expect} · النتيجة: ${loaded ? 'pass' : 'fail'}`);
    const detail = (result.stderr || '').split('\n').find((line) => line.includes('Error'));
    if (detail) console.log(`     ${detail.trim().slice(0, 140)}`);
  }
}

console.log(
  failures === 0
    ? '\n✅ كل التحققات تعمل\n'
    : `\n❌ ${failures} تحقق لا يعمل كما هو متوقّع\n`,
);

process.exit(failures === 0 ? 0 : 1);
