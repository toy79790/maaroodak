import { describe, expect, it } from 'vitest';
import { replaceTextInHtml, sanitizeHtml, textToHtml } from '@/features/letters/html';

/**
 * استبدال التحديد داخل HTML — #D-045
 *
 * أدوات الذكاء الاصطناعي على تحديد كانت تعيد بناء المعروض كله من نص مسطّح
 * (فتمسح التنسيق)، ولا تطابق أي تحديد يمتد على فقرتين.
 */

describe('replaceTextInHtml', () => {
  it('يستبدل داخل فقرة واحدة ويُبقي باقي التنسيق', () => {
    const html =
      '<h2>الموضوع</h2><p style="text-align: center">أتقدم بطلب جدولة المديونية.</p><ul><li><p>بند أول</p></li></ul>';

    const result = replaceTextInHtml(html, 'بطلب جدولة', 'بالتماس جدولة');

    expect(result).toBe(
      '<h2>الموضوع</h2><p style="text-align: center">أتقدم بالتماس جدولة المديونية.</p><ul><li><p>بند أول</p></li></ul>',
    );
  });

  it('يطابق تحديداً يمتد على فقرتين رغم اختلاف فواصل الأسطر', () => {
    // المحرر يفصل الفقرات بسطر واحد، والنص المخزّن بسطرين.
    const html = '<p>الفقرة الأولى هنا.</p>\n<p>الفقرة الثانية هنا.</p>\n<p>الخاتمة.</p>';

    const result = replaceTextInHtml(html, 'الأولى هنا.\nالفقرة الثانية', 'المدموجة');

    // الفاصل بين الفقرتين كان داخل التحديد فحُذف — لا أثر له في العرض.
    expect(result).toBe('<p>الفقرة المدموجة</p><p> هنا.</p>\n<p>الخاتمة.</p>');
  });

  it('يحذف الكتل التي فرغت بالكامل داخل التحديد', () => {
    const html = '<p>أ ب</p><p>ج د</p><p>هـ و</p><p>ز</p>';

    const result = replaceTextInHtml(html, 'ب\nج د\nهـ و', 'بديل');

    expect(result).toBe('<p>أ بديل</p><p>ز</p>');
  });

  it('يُبقي الوسوم السطرية متوازنة حين يقطعها التحديد', () => {
    const html = '<p>نص <strong>عريض جداً</strong> ثم عادي</p>';

    const result = replaceTextInHtml(html, 'جداً ثم', 'بديل');

    expect(result).toBe('<p>نص <strong>عريض بديل</strong> عادي</p>');
  });

  it('يهرّب البديل ولا يفسّر رموز $ الخاصة', () => {
    const html = '<p>المبلغ المطلوب.</p>';

    const result = replaceTextInHtml(html, 'المطلوب', "$& و $' <b>");

    expect(result).toBe("<p>المبلغ $&amp; و $' &lt;b&gt;.</p>");
  });

  it('يفكّ الكيانات عند المطابقة ويحفظها في الناتج', () => {
    const html = '<p>شركة أ &amp; ب للتجارة</p>';

    const result = replaceTextInHtml(html, 'أ & ب', 'س & ص');

    expect(result).toBe('<p>شركة س &amp; ص للتجارة</p>');
  });

  it('يتعامل مع فواصل <br /> داخل الفقرة', () => {
    const html = textToHtml('السطر الأول\nالسطر الثاني');

    const result = replaceTextInHtml(html, 'الأول\nالسطر', 'واحد،');

    expect(result).toBe('<p>السطر واحد، الثاني</p>');
  });

  it('لا يرمي عند كيان رقمي خارج مدى يونيكود', () => {
    const html = '<p>رمز &#99999999; ثم &#x110000; ثم نص</p>';

    const result = replaceTextInHtml(html, 'ثم نص', 'بديل');

    // الكيان التالف يبقى خاماً كما هو، والاستبدال يجري طبيعياً.
    expect(result).toBe('<p>رمز &#99999999; ثم &#x110000; بديل</p>');
  });

  it('يُرجع null حين لا يوجد النص', () => {
    expect(replaceTextInHtml('<p>نص</p>', 'غير موجود', 'x')).toBeNull();
    expect(replaceTextInHtml('<p>نص</p>', '   ', 'x')).toBeNull();
  });

  it('ناتجه يمرّ من التعقيم دون تغيير', () => {
    const html = '<h1>عنوان</h1><p dir="rtl">نص <em>مائل</em> هنا</p>';

    const result = replaceTextInHtml(html, 'مائل', 'مائل جديد');

    expect(result).not.toBeNull();
    expect(sanitizeHtml(result ?? '')).toBe(result);
  });
});
