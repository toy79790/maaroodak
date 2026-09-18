import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { getUsageSummary, getCostByModel, getCostByOperation } from '@/services/ai/usage-tracker';
import { getFunnel } from '@/services/analytics/analytics-service';

/**
 * استعلامات لوحة الإدارة.
 *
 * ⚠️ لا يُقرأ محتوى المعاريض هنا. الإدارة تحتاج الإحصاءات والبيانات الوصفية،
 * لا قراءة خطابات الناس (docs/SECURITY.md §11 · rbac `letter:readContent`).
 */

export interface AdminOverview {
  users: { total: number; activeThisMonth: number; newThisMonth: number };
  letters: { total: number; thisMonth: number; completed: number };
  interviews: { started: number; abandoned: number; completionRate: number };
  feedback: { up: number; down: number; satisfaction: number };
  catalog: { departments: number; requestTypes: number; questions: number };
}

function startOfMonth(): Date {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function getAdminOverview(): Promise<AdminOverview> {
  const monthStart = startOfMonth();

  const [
    totalUsers,
    newUsers,
    activeUsers,
    totalLetters,
    lettersThisMonth,
    completedLetters,
    interviewsStarted,
    interviewsAbandoned,
    interviewsConverted,
    thumbsUp,
    thumbsDown,
    departments,
    requestTypes,
    questions,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: monthStart } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: monthStart } } }),
    prisma.letter.count({ where: { deletedAt: null } }),
    prisma.letter.count({
      where: { deletedAt: null, createdAt: { gte: monthStart } },
    }),
    prisma.letter.count({
      where: { deletedAt: null, status: { in: ['COMPLETED', 'EDITED'] } },
    }),
    prisma.interviewSession.count(),
    prisma.interviewSession.count({ where: { status: 'ABANDONED' } }),
    prisma.interviewSession.count({ where: { status: 'CONVERTED' } }),
    prisma.feedback.count({ where: { rating: 'THUMBS_UP' } }),
    prisma.feedback.count({ where: { rating: 'THUMBS_DOWN' } }),
    prisma.department.count({ where: { deletedAt: null } }),
    prisma.requestType.count({ where: { deletedAt: null } }),
    prisma.question.count({ where: { deletedAt: null } }),
  ]);

  const totalFeedback = thumbsUp + thumbsDown;

  return {
    users: {
      total: totalUsers,
      activeThisMonth: activeUsers,
      newThisMonth: newUsers,
    },
    letters: {
      total: totalLetters,
      thisMonth: lettersThisMonth,
      completed: completedLetters,
    },
    interviews: {
      started: interviewsStarted,
      abandoned: interviewsAbandoned,
      completionRate:
        interviewsStarted === 0 ? 0 : interviewsConverted / interviewsStarted,
    },
    feedback: {
      up: thumbsUp,
      down: thumbsDown,
      satisfaction: totalFeedback === 0 ? 0 : thumbsUp / totalFeedback,
    },
    catalog: { departments, requestTypes, questions },
  };
}

/** توزيع المعاريض حسب الجهة — يكشف أي الجهات تستحق مزيد استثمار في الأسئلة. */
export async function getLettersByDepartment(limit = 10) {
  const grouped = await prisma.letter.groupBy({
    by: ['departmentId'],
    where: { deletedAt: null },
    _count: { departmentId: true },
    orderBy: { _count: { departmentId: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const departments = await prisma.department.findMany({
    where: { id: { in: grouped.map((row) => row.departmentId) } },
    select: { id: true, name: true },
  });

  const names = new Map(departments.map((d) => [d.id, d.name]));

  return grouped.map((row) => ({
    id: row.departmentId,
    name: names.get(row.departmentId) ?? 'محذوفة',
    count: row._count.departmentId,
  }));
}

export async function getLettersByRequestType(limit = 10) {
  const grouped = await prisma.letter.groupBy({
    by: ['requestTypeId'],
    where: { deletedAt: null },
    _count: { requestTypeId: true },
    orderBy: { _count: { requestTypeId: 'desc' } },
    take: limit,
  });

  if (grouped.length === 0) return [];

  const types = await prisma.requestType.findMany({
    where: { id: { in: grouped.map((row) => row.requestTypeId) } },
    select: { id: true, name: true },
  });

  const names = new Map(types.map((t) => [t.id, t.name]));

  return grouped.map((row) => ({
    id: row.requestTypeId,
    name: names.get(row.requestTypeId) ?? 'محذوف',
    count: row._count.requestTypeId,
  }));
}

export async function getAiCostReport(since: Date) {
  const [summary, byModel, byOperation] = await Promise.all([
    getUsageSummary(since),
    getCostByModel(since),
    getCostByOperation(since),
  ]);

  const letterCount = await prisma.letter.count({
    where: { createdAt: { gte: since }, deletedAt: null },
  });

  return {
    ...summary,
    byModel,
    byOperation,
    /** أهم رقم في وحدة الاقتصاد: كم يكلّفنا المعروض الواحد. */
    costPerLetterUsd:
      letterCount === 0 ? 0 : Number((summary.totalCostUsd / letterCount).toFixed(4)),
    letterCount,
  };
}

export { getFunnel };

// ---------------------------------------------------------------------------
// إدارة الكتالوج
// ---------------------------------------------------------------------------

/** خيارات الفئة لنموذج الجهة — المعطّلة تبقى ظاهرة حتى لا تفقد جهةٌ فئتها الحالية. */
export async function listCategoryOptions() {
  return prisma.departmentCategory.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, isActive: true },
  });
}

export async function listCategoriesAdmin() {
  return prisma.departmentCategory.findMany({
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      order: true,
      isActive: true,
      _count: { select: { departments: { where: { deletedAt: null } } } },
    },
  });
}

export async function listDepartmentsAdmin() {
  return prisma.department.findMany({
    where: { deletedAt: null },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      category: { select: { name: true } },
      isActive: true,
      order: true,
      organizationId: true,
      _count: { select: { requestTypes: true, letters: true } },
    },
  });
}

export async function listRequestTypesAdmin() {
  return prisma.requestType.findMany({
    where: { deletedAt: null },
    orderBy: [{ order: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      isActive: true,
      order: true,
      _count: { select: { departments: true, questions: true } },
    },
  });
}

export async function listQuestionsAdmin(filters: {
  departmentId?: string;
  requestTypeId?: string;
} = {}) {
  return prisma.question.findMany({
    where: {
      deletedAt: null,
      ...(filters.departmentId ? { departmentId: filters.departmentId } : {}),
      ...(filters.requestTypeId ? { requestTypeId: filters.requestTypeId } : {}),
    },
    orderBy: [{ order: 'asc' }],
    select: {
      id: true,
      key: true,
      label: true,
      type: true,
      required: true,
      order: true,
      isActive: true,
      department: { select: { id: true, name: true } },
      requestType: { select: { id: true, name: true } },
      _count: { select: { options: true, conditions: true } },
    },
  });
}

export async function listPromptsAdmin() {
  return prisma.prompt.findMany({
    where: { deletedAt: null },
    orderBy: [{ type: 'asc' }, { key: 'asc' }],
    select: {
      id: true,
      key: true,
      name: true,
      type: true,
      isActive: true,
      model: true,
      updatedAt: true,
      department: { select: { name: true } },
      requestType: { select: { name: true } },
    },
  });
}

export async function listTemplatesAdmin() {
  return prisma.template.findMany({
    where: { deletedAt: null },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      slug: true,
      name: true,
      isDefault: true,
      isActive: true,
      updatedAt: true,
      department: { select: { name: true } },
      requestType: { select: { name: true } },
      _count: { select: { letters: true } },
    },
  });
}

export async function listUsersAdmin(query?: string) {
  return prisma.user.findMany({
    where: query
      ? {
          OR: [
            { email: { contains: query, mode: 'insensitive' } },
            { name: { contains: query, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      creditBalance: true,
      createdAt: true,
      lastLoginAt: true,
      _count: { select: { letters: true } },
    },
  });
}
