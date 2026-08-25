import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { questionSchema } from '@/features/admin/schema';
import { deleteQuestion, saveQuestion } from '@/features/admin/service';
import { prisma } from '@/lib/db/prisma';
import { errors } from '@/lib/api/errors';

type Params = { id: string };

export const GET = createAdminHandler<undefined, Params>(
  { permission: 'question:manage' },
  async ({ params }) => {
    const question = await prisma.question.findFirst({
      where: { id: params.id, deletedAt: null },
      select: {
        id: true,
        key: true,
        label: true,
        description: true,
        type: true,
        required: true,
        placeholder: true,
        helpText: true,
        groupKey: true,
        order: true,
        aiHint: true,
        validation: true,
        isActive: true,
        departmentId: true,
        requestTypeId: true,
        options: {
          orderBy: { order: 'asc' },
          select: { value: true, label: true },
        },
        conditions: {
          orderBy: { order: 'asc' },
          select: { action: true, logic: true, clauses: true },
        },
      },
    });

    if (!question) return jsonError(errors.notFound('السؤال غير موجود.'));
    return jsonOk(question);
  },
);

export const PATCH = createAdminHandler<
  ReturnType<typeof questionSchema.parse>,
  Params
>(
  { permission: 'question:manage', body: questionSchema },
  async ({ body, params, admin }) => {
    const result = await saveQuestion(admin, body, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data);
  },
);

export const DELETE = createAdminHandler<undefined, Params>(
  { permission: 'question:manage' },
  async ({ params, admin }) => {
    const result = await deleteQuestion(admin, params.id);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(null);
  },
);
