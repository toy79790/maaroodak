import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { promptSchema } from '@/features/admin/schema';
import { savePrompt } from '@/features/admin/service';
import { prisma } from '@/lib/db/prisma';
import { errors } from '@/lib/api/errors';

type Params = { id: string };

export const GET = createAdminHandler<undefined, Params>(
  { permission: 'prompt:manage' },
  async ({ params }) => {
    const prompt = await prisma.prompt.findFirst({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        type: true,
        content: true,
        model: true,
        maxTokens: true,
        isActive: true,
        version: true,
        departmentId: true,
        requestTypeId: true,
      },
    });

    if (!prompt) return jsonError(errors.notFound('الموجّه غير موجود.'));
    return jsonOk(prompt);
  },
);

export const PATCH = createAdminHandler<
  ReturnType<typeof promptSchema.parse>,
  Params
>(
  { permission: 'prompt:manage', body: promptSchema },
  async ({ body, params, admin }) => {
    const result = await savePrompt(admin, body, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);
