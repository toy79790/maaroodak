import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * حارس بنيوي: كل معالِج API مُغيِّر يجب أن يفحص أصل الطلب.
 *
 * سبب وجود هذا الاختبار حادثة حقيقية: `createHandler` يفرض فحص Origin،
 * لكن توقيعه لا يمرّر معاملات المسار الديناميكي (`[id]`)، فكُتبت تسعة
 * مسارات يدوياً وفقدت الفحص كله بلا أن يلاحظه أحد — والمراجعة البشرية لا
 * تلتقط غياب سطر.
 *
 * الفحص ثابت (يقرأ الملفات) لا سلوكي عمداً: يعمل في أجزاء من الثانية،
 * ويفشل عند كتابة المسار لا عند استغلاله.
 */

const API_ROOT = join(process.cwd(), 'src/app/api');

/** الطرق التي تُغيّر حالة الخادم — وحدها تحتاج دفاع CSRF. */
const MUTATING = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** يمرّان بالحارس داخلياً، فلا يحتاج مسارهما نداءً صريحاً. */
const FACTORIES = ['createHandler', 'createAdminHandler'];

function routeFiles(dir: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...routeFiles(path));
    } else if (entry === 'route.ts') {
      found.push(path);
    }
  }

  return found;
}

interface RouteAudit {
  file: string;
  mutatingHandlers: number;
  guards: number;
  usesFactory: boolean;
}

function audit(file: string): RouteAudit {
  const source = readFileSync(file, 'utf8');

  const declared = MUTATING.flatMap((method) => [
    ...source.matchAll(new RegExp(`export\\s+async\\s+function\\s+${method}\\b`, 'g')),
  ]);

  return {
    file: file.replace(process.cwd(), '').replace(/\\/g, '/'),
    mutatingHandlers: declared.length,
    guards: [...source.matchAll(/assertSameOrigin\s*\(/g)].length,
    usesFactory: FACTORIES.some((name) => source.includes(name)),
  };
}

describe('حماية CSRF على مسارات الـ API', () => {
  const audits = routeFiles(API_ROOT).map(audit);

  it('يجد مسارات API لِيفحصها', () => {
    expect(audits.length).toBeGreaterThan(20);
  });

  it('كل معالِج مُغيِّر مكتوب يدوياً يفحص أصل الطلب', () => {
    const unguarded = audits.filter(
      (route) =>
        !route.usesFactory &&
        route.mutatingHandlers > 0 &&
        route.guards < route.mutatingHandlers,
    );

    expect(
      unguarded.map((r) => `${r.file} (${r.mutatingHandlers} مُغيِّر · ${r.guards} حارس)`),
    ).toEqual([]);
  });

  it('لا مسار إداري خارج مصنعه', () => {
    const admin = audits.filter((route) => route.file.includes('/api/admin/'));

    expect(admin.length).toBeGreaterThan(0);
    expect(admin.filter((route) => !route.usesFactory).map((r) => r.file)).toEqual([]);
  });
});
