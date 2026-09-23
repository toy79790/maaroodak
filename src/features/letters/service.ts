import 'server-only';

import type { LetterStatus, Prisma, VersionSource } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { AppError, errors, fail, ok, type Result } from '@/lib/api/errors';
import { htmlToText, sanitizeHtml } from '@/features/letters/html';
import { recordEvent } from '@/services/analytics/analytics-service';
import { LIMITS } from '@/config/constants';
import { searchKey } from '@/lib/utils/arabic';

/**
 * إدارة المعاريض — القراءة والتعديل والنسخ.
 *
 * كل استعلام مقيّد بـ `userId` **داخل شرط الاستعلام** (docs/SECURITY.md §3).
 * ولا يُفرَّق بين «غير موجود» و«ليس لك»: كلاهما 404 منعاً للتعداد.
 */

const LETTER_SELECT = {
  id: true,
  title: true,
  subject: true,
  contentHtml: true,
  contentText: true,
  answers: true,
  status: true,
  qualityReport: true,
  currentVersion: true,
  aiToolUses: true,
  isFavorite: true,
  createdAt: true,
  updatedAt: true,
  department: { select: { id: true, name: true, slug: true, addressee: true } },
  requestType: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.LetterSelect;

export type LetterDetail = Prisma.LetterGetPayload<{ select: typeof LETTER_SELECT }>;

export async function getLetter(
  userId: string,
  letterId: string,
): Promise<Result<LetterDetail>> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId, deletedAt: null },
    select: LETTER_SELECT,
  });

  if (!letter) return fail(errors.notFound('المعروض غير موجود.'));
  return ok(letter);
}

// ---------------------------------------------------------------------------
// القائمة
// ---------------------------------------------------------------------------

export interface ListLettersInput {
  q?: string;
  departmentId?: string;
  requestTypeId?: string;
  status?: LetterStatus;
  favorite?: boolean;
  cursor?: string;
  limit?: number;
}

export interface LetterListItem {
  id: string;
  title: string;
  status: LetterStatus;
  isFavorite: boolean;
  createdAt: Date;
  departmentName: string;
  requestTypeName: string;
  excerpt: string;
}

export async function listLetters(
  userId: string,
  input: ListLettersInput = {},
): Promise<{ items: LetterListItem[]; nextCursor: string | null }> {
  const limit = Math.min(input.limit ?? LIMITS.pageSizeDefault, LIMITS.pageSizeMax);

  const where: Prisma.LetterWhereInput = {
    userId,
    deletedAt: null,
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.requestTypeId ? { requestTypeId: input.requestTypeId } : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.favorite ? { isFavorite: true } : {}),
    ...(input.q
      ? {
          OR: [
            { title: { contains: input.q, mode: 'insensitive' } },
            { contentText: { contains: input.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const rows = await prisma.letter.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    // نجلب واحداً زائداً لنعرف إن كان هناك المزيد بلا استعلام عدّ إضافي.
    take: limit + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      title: true,
      status: true,
      isFavorite: true,
      createdAt: true,
      contentText: true,
      department: { select: { name: true } },
      requestType: { select: { name: true } },
    },
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    items: page.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      isFavorite: row.isFavorite,
      createdAt: row.createdAt,
      departmentName: row.department.name,
      requestTypeName: row.requestType.name,
      excerpt: buildExcerpt(row.contentText, input.q),
    })),
    nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** مقتطف حول موضع البحث إن وُجد، وإلا بداية النص. */
function buildExcerpt(text: string, query?: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();

  if (query) {
    const index = searchKey(clean).indexOf(searchKey(query));
    if (index > 40) {
      return `…${clean.slice(index - 40, index + 120)}…`;
    }
  }

  return clean.length > 160 ? `${clean.slice(0, 160)}…` : clean;
}

// ---------------------------------------------------------------------------
// التعديل والنسخ
// ---------------------------------------------------------------------------

export interface UpdateLetterInput {
  title?: string;
  contentHtml?: string;
  note?: string;
  /**
   * النسخة التي بُني عليها التعديل. إن تغيّر المعروض بعدها يُرفض التعديل
   * بـ CONFLICT بدل أن يكتب فوق ما حُفظ في الأثناء — #D-047.
   */
  expectedVersion?: number;
}

/**
 * تعديل المعروض — ينشئ نسخة جديدة دائماً.
 *
 * لا تعديل في مكانه: سجل النسخ هو ما يجعل المستخدم يجرّب بحرية، وأي
 * تعديل بلا نسخة يعني فقداناً لا رجعة فيه.
 */
export async function updateLetter(
  userId: string,
  letterId: string,
  input: UpdateLetterInput,
  source: VersionSource = 'USER_EDIT',
  /**
   * عمل إضافي داخل معاملة التعديل نفسها (خصم أداة AI مثلاً). رميُه يُلغي
   * التعديل كله؛ ويُرمى AppError فيُعاد كما هو.
   */
  withinTransaction?: (tx: Prisma.TransactionClient) => Promise<void>,
): Promise<Result<LetterDetail>> {
  const existing = await prisma.letter.findFirst({
    where: { id: letterId, userId, deletedAt: null },
    select: { id: true, title: true, contentHtml: true },
  });

  if (!existing) return fail(errors.notFound('المعروض غير موجود.'));

  const title = input.title?.trim() || existing.title;
  const contentHtml =
    input.contentHtml === undefined
      ? existing.contentHtml
      : sanitizeHtml(input.contentHtml);

  const unchanged =
    title === existing.title && contentHtml === existing.contentHtml;

  if (contentHtml.length > LIMITS.letterHtml) {
    return fail(
      errors.validation({ contentHtml: 'المحتوى تجاوز الحد الأقصى المسموح.' }),
    );
  }

  try {
    if (unchanged) {
      if (withinTransaction) await prisma.$transaction(withinTransaction);
      return getLetter(userId, letterId);
    }

    const letter = await prisma.$transaction(async (tx) => {
      /*
       * رقم النسخة من الزيادة الذرّية لا من قراءة سابقة — #D-046
       *
       * كان `currentVersion + 1` يُحسب من قراءة خارج المعاملة، فتعديلان
       * متزامنان (حفظ يدوي وأداة AI) يُدخلان النسخة نفسها ويصطدمان بـ
       * `@@unique([letterId, version])` فيرجع 500. `increment` يقفل الصف،
       * فالثاني ينتظر الأول ويأخذ الرقم التالي.
       */
      const updated = await tx.letter.update({
        where: { id: existing.id },
        data: {
          title,
          contentHtml,
          contentText: htmlToText(contentHtml),
          currentVersion: { increment: 1 },
          status: 'EDITED',
        },
        select: LETTER_SELECT,
      });

      // الزيادة أعلاه أقفلت الصف، فالرقم الناتج يكشف أي تعديل سبقنا.
      if (
        input.expectedVersion !== undefined &&
        updated.currentVersion !== input.expectedVersion + 1
      ) {
        throw errors.conflict('تغيّر المعروض أثناء التنفيذ. لم يُطبَّق أي تعديل.');
      }

      await tx.letterVersion.create({
        data: {
          letterId: existing.id,
          version: updated.currentVersion,
          title,
          contentHtml,
          source,
          note: input.note ?? null,
          createdById: userId,
        },
      });

      if (withinTransaction) await withinTransaction(tx);

      return updated;
    });

    await recordEvent('letter_edited', {
      userId,
      props: { letterId, version: letter.currentVersion, source },
    });

    return ok(letter);
  } catch (thrown) {
    if (thrown instanceof AppError) return fail(thrown);
    throw thrown;
  }
}

export async function listVersions(userId: string, letterId: string) {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!letter) return fail(errors.notFound());

  const versions = await prisma.letterVersion.findMany({
    where: { letterId },
    orderBy: { version: 'desc' },
    select: {
      id: true,
      version: true,
      title: true,
      source: true,
      note: true,
      createdAt: true,
    },
  });

  return ok(versions);
}

/**
 * استعادة نسخة سابقة — تُنشئ نسخة **جديدة** بمحتوى القديمة.
 * لا نحذف شيئاً: الاستعادة نفسها قابلة للتراجع.
 */
export async function restoreVersion(
  userId: string,
  letterId: string,
  version: number,
): Promise<Result<LetterDetail>> {
  const target = await prisma.letterVersion.findFirst({
    where: { letterId, version, letter: { userId, deletedAt: null } },
    select: { title: true, contentHtml: true, version: true },
  });

  if (!target) return fail(errors.notFound('النسخة غير موجودة.'));

  return updateLetter(
    userId,
    letterId,
    {
      title: target.title,
      contentHtml: target.contentHtml,
      note: `استعادة النسخة ${target.version}`,
    },
    'RESTORED',
  );
}

export async function setFavorite(
  userId: string,
  letterId: string,
  value: boolean,
): Promise<Result<{ isFavorite: boolean }>> {
  const updated = await prisma.letter.updateMany({
    where: { id: letterId, userId, deletedAt: null },
    data: { isFavorite: value },
  });

  if (updated.count === 0) return fail(errors.notFound());
  return ok({ isFavorite: value });
}

/** حذف ناعم — docs/DECISIONS.md #D-020 */
export async function deleteLetter(
  userId: string,
  letterId: string,
): Promise<Result<null>> {
  const updated = await prisma.letter.updateMany({
    where: { id: letterId, userId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  if (updated.count === 0) return fail(errors.notFound());
  return ok(null);
}

export async function duplicateLetter(
  userId: string,
  letterId: string,
): Promise<Result<{ id: string }>> {
  const source = await prisma.letter.findFirst({
    where: { id: letterId, userId, deletedAt: null },
    select: {
      title: true,
      subject: true,
      contentHtml: true,
      contentText: true,
      answers: true,
      departmentId: true,
      requestTypeId: true,
      templateId: true,
      organizationId: true,
    },
  });

  if (!source) return fail(errors.notFound());

  const created = await prisma.$transaction(async (tx) => {
    const letter = await tx.letter.create({
      data: {
        ...source,
        userId,
        title: `${source.title} (نسخة)`,
        answers: source.answers as Prisma.InputJsonValue,
        status: 'DRAFT',
        currentVersion: 1,
      },
      select: { id: true, title: true, contentHtml: true },
    });

    await tx.letterVersion.create({
      data: {
        letterId: letter.id,
        version: 1,
        title: letter.title,
        contentHtml: letter.contentHtml,
        source: 'USER_EDIT',
        note: 'نسخة من معروض سابق',
        createdById: userId,
      },
    });

    return letter;
  });

  return ok({ id: created.id });
}

export async function submitFeedback(
  userId: string,
  letterId: string,
  input: { rating: 'THUMBS_UP' | 'THUMBS_DOWN'; comment?: string; categories?: string[] },
): Promise<Result<null>> {
  const letter = await prisma.letter.findFirst({
    where: { id: letterId, userId, deletedAt: null },
    select: { id: true },
  });

  if (!letter) return fail(errors.notFound());

  await prisma.feedback.create({
    data: {
      letterId,
      userId,
      rating: input.rating,
      comment: input.comment?.slice(0, LIMITS.feedbackComment) ?? null,
      categories: input.categories ?? [],
    },
  });

  await recordEvent('feedback_submitted', {
    userId,
    props: { letterId, rating: input.rating },
  });

  return ok(null);
}
