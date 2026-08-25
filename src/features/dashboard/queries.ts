import 'server-only';

import { prisma } from '@/lib/db/prisma';

/**
 * استعلامات لوحة التحكم.
 *
 * كلها مقيّدة بـ `userId` **داخل شرط الاستعلام** لا بعد الجلب — منعاً لـ IDOR
 * (docs/SECURITY.md §3).
 */

export interface DashboardStats {
  totalLetters: number;
  lettersThisMonth: number;
  drafts: number;
  completed: number;
  creditBalance: number;
}

export interface RecentLetter {
  id: string;
  title: string;
  status: string;
  createdAt: Date;
  departmentName: string;
  requestTypeName: string;
}

export interface TopDepartment {
  id: string;
  name: string;
  count: number;
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalLetters, lettersThisMonth, drafts, completed, user] =
    await Promise.all([
      prisma.letter.count({ where: { userId, deletedAt: null } }),
      prisma.letter.count({
        where: { userId, deletedAt: null, createdAt: { gte: startOfMonth } },
      }),
      prisma.letter.count({
        where: { userId, deletedAt: null, status: 'DRAFT' },
      }),
      prisma.letter.count({
        where: { userId, deletedAt: null, status: { in: ['COMPLETED', 'EDITED'] } },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: { creditBalance: true },
      }),
    ]);

  return {
    totalLetters,
    lettersThisMonth,
    drafts,
    completed,
    creditBalance: user?.creditBalance ?? 0,
  };
}

export async function getRecentLetters(
  userId: string,
  take = 5,
): Promise<RecentLetter[]> {
  const letters = await prisma.letter.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      department: { select: { name: true } },
      requestType: { select: { name: true } },
    },
  });

  return letters.map((letter) => ({
    id: letter.id,
    title: letter.title,
    status: letter.status,
    createdAt: letter.createdAt,
    departmentName: letter.department.name,
    requestTypeName: letter.requestType.name,
  }));
}

export async function getTopDepartments(
  userId: string,
  take = 4,
): Promise<TopDepartment[]> {
  const grouped = await prisma.letter.groupBy({
    by: ['departmentId'],
    where: { userId, deletedAt: null },
    _count: { departmentId: true },
    orderBy: { _count: { departmentId: 'desc' } },
    take,
  });

  if (grouped.length === 0) return [];

  const departments = await prisma.department.findMany({
    where: { id: { in: grouped.map((g) => g.departmentId) } },
    select: { id: true, name: true },
  });

  const nameById = new Map(departments.map((d) => [d.id, d.name]));

  return grouped.map((group) => ({
    id: group.departmentId,
    name: nameById.get(group.departmentId) ?? 'جهة محذوفة',
    count: group._count.departmentId,
  }));
}

/** مقابلة غير مكتملة يمكن استئنافها — أهم عنصر في اللوحة إن وُجد. */
export async function getResumableInterview(userId: string) {
  return prisma.interviewSession.findFirst({
    where: { userId, status: 'IN_PROGRESS' },
    orderBy: { lastActiveAt: 'desc' },
    select: {
      id: true,
      currentStep: true,
      lastActiveAt: true,
      department: { select: { name: true } },
      requestType: { select: { name: true } },
    },
  });
}
