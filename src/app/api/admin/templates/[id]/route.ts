import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { templateSchema } from '@/features/admin/schema';
import { saveTemplate } from '@/features/admin/service';
import { prisma } from '@/lib/db/prisma';
import { errors } from '@/lib/api/errors';

type Params = { id: string };

export const GET = createAdminHandler<undefined, Params>(
  { permission: 'template:manage' },
  async ({ params }) => {
    const template = await prisma.template.findFirst({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        body: true,
        isDefault: true,
        isActive: true,
        version: true,
        departmentId: true,
        requestTypeId: true,
      },
    });

    if (!template) return jsonError(errors.notFound('القالب غير موجود.'));
    return jsonOk(template);
  },
);

export const PATCH = createAdminHandler<
  ReturnType<typeof templateSchema.parse>,
  Params
>(
  { permission: 'template:manage', body: templateSchema },
  async ({ body, params, admin }) => {
    const result = await saveTemplate(admin, body, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
