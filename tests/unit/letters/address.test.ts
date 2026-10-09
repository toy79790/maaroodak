import { describe, expect, it } from 'vitest';
import { addressPronoun, findMismatchedPronouns } from '@/lib/utils/address';
import { scan } from '@/services/ai/guardrails';
import { buildGenerationPrompt, buildToolPrompt } from '@/services/ai/prompt-builder';
import { buildTemplateContext } from '@/services/templates/variables';
import { render } from '@/services/templates/engine';
import { TEMPLATES } from '../../../prisma/seed-data/templates';
import { DEPARTMENTS } from '../../../prisma/seed-data/departments';

/** ضمير مخاطبة الجهة في المتن — #D-051 */

describe('addressPronoun', () => {
  it.each([
    ['معالي', 'معاليكم'],
    ['سعادة', 'سعادتكم'],
    ['صاحب السمو الملكي', 'سموكم'],
    ['مقام', 'مقامكم الكريم'],
    ['فضيلة', 'فضيلتكم'],
  ])('«%s» ⟵ «%s»', (honorific, pronoun) => {
    expect(addressPronoun(honorific)).toBe(pronoun);
  });

  it('يرجع إلى «سعادتكم» حين يغيب اللقب أو لا يُعرف', () => {
    expect(addressPronoun(null)).toBe('سعادتكم');
    expect(addressPronoun('')).toBe('سعادتكم');
    expect(addressPronoun('الأستاذ')).toBe('سعادتكم');
  });

  it('يعرف كل لقب في كتالوج الجهات — لا جهة تسقط إلى الافتراضي خطأً', () => {
    for (const department of DEPARTMENTS) {
      const pronoun = addressPronoun(department.honorific);
      if (department.honorific !== 'سعادة') expect(pronoun, department.slug).not.toBe('سعادتكم');
    }
  });
});

describe('findMismatchedPronouns', () => {
  it('يرصد «مقامكم» في معروض إلى وزير — الخطأ الذي وُجد في معروض حقيقي', () => {
    const text = 'أتقدّم إلى مقامكم الكريم بهذا المعروض. وأفيد معاليكم بأنني…';
    expect(findMismatchedPronouns(text, 'معالي')).toEqual(['مقامكم']);
  });

  it('يرصد «سعادتكم» لوزير ولو بحرف جر أو تشكيل', () => {
    expect(findMismatchedPronouns('آمل من سَعادَتِكم التكرم', 'معالي')).toEqual(['سعادتكم']);
    expect(findMismatchedPronouns('أرفع لسعادتكم طلبي', 'معالي')).toEqual(['سعادتكم']);
  });

  it('لا يرصد اللقب بصيغة الغائب: «سعادة مدير الفرع» في معروض إلى وزير', () => {
    const text = 'وقد راجعت سعادة مدير الفرع، وألتمس من معاليكم التوجيه.';
    expect(findMismatchedPronouns(text, 'معالي')).toEqual([]);
  });

  it('يقبل الضمير الصحيح لكل جهة', () => {
    expect(findMismatchedPronouns('أرفع إلى مقامكم الكريم', 'مقام')).toEqual([]);
    expect(findMismatchedPronouns('أتقدم إلى سموكم', 'صاحب السمو الملكي')).toEqual([]);
    expect(findMismatchedPronouns('آمل من سعادتكم', 'سعادة')).toEqual([]);
  });
});

describe('scan — مخاطبة الجهة بغير لقبها', () => {
  it('يحجب «سعادتكم» لوزير فيُعاد التوليد مرة بتنبيه يسمّي الصيغة الصحيحة', () => {
    const result = scan({ output: 'آمل من سعادتكم النظر في طلبي.', facts: [], honorific: 'معالي' });
    const violation = result.violations.find((v) => v.kind === 'wrong_address');

    expect(violation?.severity).toBe('block');
    expect(violation?.message).toContain('معاليكم');
    expect(result.shouldRegenerate).toBe(true);
  });

  it('لا يفحص المخاطبة إن لم يُمرَّر اللقب', () => {
    const result = scan({ output: 'آمل من سعادتكم النظر في طلبي.', facts: [] });
    expect(result.violations.map((v) => v.kind)).not.toContain('wrong_address');
  });
});

describe('التوجيه يسمّي ضمير المخاطبة', () => {
  it('في التوليد', () => {
    const prompt = buildGenerationPrompt({
      department: { name: 'وزارة الداخلية', addressee: 'معالي وزير الداخلية', honorific: 'معالي' },
      requestType: { name: 'شكوى' },
      applicantName: 'مراجع',
      answers: {},
      questions: [],
      layers: { style: 'أسلوب' },
      subject: 'شكوى',
    });
    expect(prompt.user).toContain('«معاليكم»');
  });

  it('في أدوات التحرير', () => {
    const prompt = buildToolPrompt({
      instruction: 'اجعله أكثر رسمية',
      text: 'نص',
      department: { name: 'الديوان الملكي', honorific: 'مقام' },
    });
    expect(prompt.user).toContain('«مقامكم الكريم»');
  });
});

describe('قوالب الشكوى والتظلم', () => {
  const complaintTemplates = TEMPLATES.filter((t) =>
    ['complaint-grievance', 'grievance-formal'].includes(t.slug),
  );

  it('لا تثبّت ضمير مخاطبة في نصها', () => {
    expect(complaintTemplates).toHaveLength(2);
    for (const template of complaintTemplates) {
      expect(template.body, template.slug).not.toMatch(/سعادتكم|معاليكم|سموكم|مقامكم/);
      expect(template.body, template.slug).toContain('{{department_pronoun}}');
    }
  });

  it('تخاطب الوزير بـ«معاليكم» عند الرندر', () => {
    const context = buildTemplateContext({
      user: { name: 'مراجع' },
      department: { name: 'وزارة الداخلية', addressee: 'معالي وزير الداخلية', honorific: 'معالي' },
      requestType: { name: 'شكوى' },
      subject: 'تأخر تجديد الهوية',
      answers: {},
      questions: [],
      aiBody: 'متن',
    });
    const output = render(complaintTemplates[0]!.body, context).output;

    expect(output).toContain('آمل من معاليكم');
    expect(findMismatchedPronouns(output, 'معالي')).toEqual([]);
  });
});
