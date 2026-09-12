import { describe, expect, it } from 'vitest';
import { buildTemplateContext } from '@/services/templates/variables';
import type { QuestionDef } from '@/types/questions';

/** سؤال نصّي مبسّط — المحرك لا يحتاج أكثر من هذا لبناء السياق. */
function textQuestion(key: string, order: number): QuestionDef {
  return {
    id: key,
    key,
    label: key,
    type: 'TEXT',
    required: false,
    order,
    options: [],
    scopeSpecificity: 0,
  };
}

const QUESTIONS: QuestionDef[] = [
  textQuestion('full_name', 1),
  textQuestion('national_id', 2),
  textQuestion('phone', 3),
  textQuestion('city', 4),
];

const DEPARTMENT = { name: 'وزارة الداخلية', addressee: 'معالي وزير الداخلية' };
const REQUEST_TYPE = { name: 'طلب وظيفة' };

describe('buildTemplateContext — أسبقية بيانات الهوية (#D-034)', () => {
  it('يُقدّم إجابة المقابلة على اسم الملف الشخصي', () => {
    const context = buildTemplateContext({
      user: { name: 'مدير المنصة', nationalId: null, phone: null, city: null },
      department: DEPARTMENT,
      requestType: REQUEST_TYPE,
      subject: 'طلب وظيفة',
      answers: { full_name: 'طارق حمد العنزي' },
      questions: QUESTIONS,
    });

    expect(context.full_name).toBe('طارق حمد العنزي');
  });

  it('يملأ الهوية والجوال من الإجابات حين يكون الملف ناقصاً', () => {
    const context = buildTemplateContext({
      user: { name: 'مدير المنصة', nationalId: null, phone: null, city: null },
      department: DEPARTMENT,
      requestType: REQUEST_TYPE,
      subject: 'طلب وظيفة',
      answers: { national_id: '1132254242', phone: '0557920898', city: 'الرياض' },
      questions: QUESTIONS,
    });

    expect(context.national_id).toBe('1132254242');
    expect(context.phone).toBe('0557920898');
    expect(context.city).toBe('الرياض');
  });

  it('يرجع إلى الملف الشخصي حين لا توجد إجابة', () => {
    const context = buildTemplateContext({
      user: { name: 'محمد السالم', nationalId: '1010101010', phone: '0500000000', city: 'جدة' },
      department: DEPARTMENT,
      requestType: REQUEST_TYPE,
      subject: 'طلب وظيفة',
      answers: {},
      questions: QUESTIONS,
    });

    expect(context.full_name).toBe('محمد السالم');
    expect(context.national_id).toBe('1010101010');
    expect(context.phone).toBe('0500000000');
    expect(context.city).toBe('جدة');
  });

  it('لا يسمح لإجابة فارغة أو مسافات بمحو قيمة الملف الشخصي', () => {
    const context = buildTemplateContext({
      user: { name: 'محمد السالم', nationalId: '1010101010', phone: '0500000000', city: 'جدة' },
      department: DEPARTMENT,
      requestType: REQUEST_TYPE,
      subject: 'طلب وظيفة',
      answers: { full_name: '   ', national_id: '', phone: null },
      questions: QUESTIONS,
    });

    expect(context.full_name).toBe('محمد السالم');
    expect(context.national_id).toBe('1010101010');
    expect(context.phone).toBe('0500000000');
  });

  it('يُبقي نسخة الإجابة بالبادئة متاحة كما هي', () => {
    const context = buildTemplateContext({
      user: { name: 'مدير المنصة', nationalId: null, phone: null, city: null },
      department: DEPARTMENT,
      requestType: REQUEST_TYPE,
      subject: 'طلب وظيفة',
      answers: { full_name: 'طارق حمد العنزي' },
      questions: QUESTIONS,
    });

    expect(context['a.full_name']).toBe('طارق حمد العنزي');
  });
});
