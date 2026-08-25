import { createHandler } from '@/lib/api/handler';
import { jsonOk } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { updateProfileSchema } from '@/features/auth/schema';
import { prisma } from '@/lib/db/prisma';
import { permissionsFor } from '@/lib/auth/rbac';

export const GET = createHandler(async () => {
  const { user } = await assertUser();
  return jsonOk({ user, permissions: permissionsFor(user.role) });
});

export const PATCH = createHandler(
  { body: updateProfileSchema },
  async ({ body }) => {
    const { user } = await assertUser();

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
        ...(body.nationalId !== undefined
          ? { nationalId: body.nationalId || null }
          : {}),
        ...(body.city !== undefined ? { city: body.city || null } : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        nationalId: true,
        city: true,
        role: true,
        creditBalance: true,
      },
    });

    return jsonOk({ user: updated });
  },
);

