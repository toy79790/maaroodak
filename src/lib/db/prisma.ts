import { PrismaClient } from '@prisma/client';
import { isDevelopment } from '@/config/env';

/**
 * عميل Prisma وحيد.
 *
 * في التطوير يعيد Next.js تحميل الوحدات عند كل تعديل، فبلا هذا التخزين
 * على `globalThis` تُنشأ عشرات الاتصالات حتى تنفد حصة القاعدة.
 *
 * ⚠️ لا يُستورد هذا الملف خارج `lib/db/repositories/**` — انظر ARCHITECTURE.md §2.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

try {
  prismaInstance =
    globalForPrisma.prisma ??
    new PrismaClient({
      log: isDevelopment ? ['warn', 'error'] : ['error'],
    });
} catch {
  console.warn('[AI Studio] Database not connected — using mock');
  const noOp = {
    findMany: async () => [],
    findFirst: async () => null,
    findUnique: async () => null,
    create: async (d?: { data?: Record<string, unknown> }) => d?.data ?? {},
    update: async (d?: { data?: Record<string, unknown> }) => d?.data ?? {},
    delete: async () => ({}),
    count: async () => 0,
    groupBy: async () => [],
  };
  prismaInstance = new Proxy({}, {
    get: () => new Proxy({}, { get: () => noOp }),
  }) as unknown as PrismaClient;
}

export const prisma = prismaInstance;

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}
