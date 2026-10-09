import { normalizeArabic } from '@/lib/utils/arabic';

/**
 * ضمير المخاطبة في متن المعروض بحسب لقب الجهة — docs/DECISIONS.md #D-051
 *
 * لقب الجهة (`honorific`) يحدّد صيغة المخاطبة في الترويسة، لكن المتن يخاطب
 * الجهة بضمير: «أتقدم إلى معاليكم». كان القالب يثبّت «سعادتكم» لكل الجهات،
 * فخاطب الوزراء والديوان الملكي بغير لقبهم. مصدر واحد للضمير يستعمله القالب
 * والتوجيه والضوابط معاً.
 */

interface AddressForm {
  /** يُطابَق داخل اللقب كما يُدخله المسؤول («معالي»، «صاحب السمو الملكي»…). */
  honorific: string;
  /** الضمير كما يُكتب في المتن. */
  pronoun: string;
  /** جذر الضمير بلا وصف — ما يُبحث عنه في النص («مقامكم» من «مقامكم الكريم»). */
  stem: string;
}

// الترتيب مهم: «صاحب السمو» تُفحص قبل «سعادة» لأن المسؤول قد يكتب لقباً مركّباً.
const ADDRESS_FORMS: readonly AddressForm[] = [
  { honorific: 'مقام', pronoun: 'مقامكم الكريم', stem: 'مقامكم' },
  { honorific: 'سمو', pronoun: 'سموكم', stem: 'سموكم' },
  { honorific: 'معالي', pronoun: 'معاليكم', stem: 'معاليكم' },
  { honorific: 'سماحة', pronoun: 'سماحتكم', stem: 'سماحتكم' },
  { honorific: 'فضيلة', pronoun: 'فضيلتكم', stem: 'فضيلتكم' },
  { honorific: 'سعادة', pronoun: 'سعادتكم', stem: 'سعادتكم' },
];

/** الأعم والأسلم حين لا يُعرف اللقب. */
const FALLBACK = ADDRESS_FORMS[ADDRESS_FORMS.length - 1]!;

function formFor(honorific: string | null | undefined): AddressForm {
  const normalized = normalizeArabic(honorific ?? '');
  if (!normalized) return FALLBACK;
  return (
    ADDRESS_FORMS.find((form) => normalized.includes(normalizeArabic(form.honorific))) ??
    FALLBACK
  );
}

/** «معالي» ⟵ «معاليكم» · «صاحب السمو الملكي» ⟵ «سموكم» · غير المعروف ⟵ «سعادتكم». */
export function addressPronoun(honorific: string | null | undefined): string {
  return formFor(honorific).pronoun;
}

/**
 * ضمائر المخاطبة الواردة في النص ولا تناسب لقب الجهة.
 *
 * يُبحث عن الضمير لا عن اللقب: «سعادة مدير الفرع» بصيغة الغائب في معروض
 * إلى وزير صحيحة، أما «سعادتكم» فمخاطبة للوزير نفسه بغير لقبه.
 */
export function findMismatchedPronouns(
  text: string,
  honorific: string | null | undefined,
): string[] {
  const expected = formFor(honorific);
  const normalized = normalizeArabic(text);
  return ADDRESS_FORMS.filter(
    (form) => form !== expected && normalized.includes(normalizeArabic(form.stem)),
  ).map((form) => form.stem);
}
