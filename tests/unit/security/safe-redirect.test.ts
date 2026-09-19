import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/security/safe-redirect';

/**
 * إعادة التوجيه المفتوحة — #D-043
 *
 * الحمولات مبنية بـ`String.fromCharCode` لا بمحارف حرفية: أدوات الكتابة في
 * هذه البيئة تحوّل بعض التهريبات إلى محارف فعلية (CLAUDE.md #2).
 */

const BS = String.fromCharCode(92); // \
const TAB = String.fromCharCode(9);
const LF = String.fromCharCode(10);

describe('safeRedirectPath — يقبل مسارات الموقع', () => {
  it.each([
    ['/letters', '/letters'],
    ['/letters/abc123', '/letters/abc123'],
    ['/new?department=x', '/new?department=x'],
    ['/admin#users', '/admin#users'],
  ])('%s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it('يطبّع المسار كما يطبّعه المتصفح', () => {
    expect(safeRedirectPath('/letters/../dashboard')).toBe('/dashboard');
  });

  it('اسم نطاق بلا شرطة مسارٌ داخلي لا خروج', () => {
    // المتصفح يحلّه نسبياً على الموقع نفسه — صفحة غير موجودة، لا نطاق آخر.
    expect(safeRedirectPath('example.com')).toBe('/example.com');
  });
});

describe('safeRedirectPath — يرفض كل خروج من الموقع', () => {
  const attacks: Array<[string, string]> = [
    ['نطاق كامل', 'https://example.com'],
    ['بلا مخطط', '//example.com'],
    ['شرطة مائلة عكسية (ثُبتت فعلياً)', `/${BS}example.com`],
    ['عكسيتان', `${BS}${BS}example.com`],
    ['جدولة داخل الشرطتين (ثُبتت فعلياً)', `/${TAB}/example.com`],
    ['سطر جديد داخل الشرطتين', `/${LF}/example.com`],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,hi'],
    ['صعود يصنع //', '/..//example.com'],
  ];

  it.each(attacks)('%s', (_label, input) => {
    expect(safeRedirectPath(input)).toBe('/dashboard');
  });

  it('فارغ أو غائب ⇒ الافتراضي', () => {
    expect(safeRedirectPath('')).toBe('/dashboard');
    expect(safeRedirectPath(undefined)).toBe('/dashboard');
    expect(safeRedirectPath(null, '/letters')).toBe('/letters');
  });
});
