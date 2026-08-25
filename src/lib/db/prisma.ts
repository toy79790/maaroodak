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

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDevelopment ? ['warn', 'error'] : ['error'],
  });

if (isDevelopment) {
  globalForPrisma.prisma = prisma;
}
