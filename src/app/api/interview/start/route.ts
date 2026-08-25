import { z } from 'zod';
import { createHandler } from '@/lib/api/handler';
import { jsonOk, jsonError } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { startInterview } from '@/features/interview/service';

const schema = z.object({
  departmentId: z.string().min(1, 'اختر الجهة'),
  requestTypeId: z.string().min(1, 'اختر نوع الطلب'),
});

export const POST = createHandler({ body: schema }, async ({ body }) => {
  const { user } = await assertUser();

  const result = await startInterview(
    user.id,
    { organizationId: user.organizationId },
    body,
  );

  if (!result.ok) return jsonError(result.error);
  return jsonOk(result.data, { status: 201 });
});
