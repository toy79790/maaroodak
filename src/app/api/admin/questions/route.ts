import { createAdminHandler } from '@/lib/api/admin-handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { questionSchema } from '@/features/admin/schema';
import { saveQuestion } from '@/features/admin/service';
import { listQuestionsAdmin } from '@/features/admin/queries';

export const GET = createAdminHandler(
  { permission: 'question:manage' },
  async ({ request }) => {
    const params = request.nextUrl.searchParams;
    return jsonOk(
      await listQuestionsAdmin({
        departmentId: params.get('departmentId') ?? undefined,
        requestTypeId: params.get('requestTypeId') ?? undefined,
      }),
    );
  },
);

export const POST = createAdminHandler(
  { permission: 'question:manage', body: questionSchema },
  async ({ body, admin }) => {
    const result = await saveQuestion(admin, body);
    if (!result.ok) return jsonError(result.error);
    return jsonOk(result.data, { status: 201 });
  },
);
