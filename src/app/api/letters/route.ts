import type { LetterStatus } from '@prisma/client';
import { createHandler } from '@/lib/api/handler';
import { jsonOk } from '@/lib/api/response';
import { assertUser } from '@/lib/auth/guards';
import { listLetters } from '@/features/letters/service';

export const GET = createHandler(async ({ request }) => {
  const { user } = await assertUser();
  const params = request.nextUrl.searchParams;

  const result = await listLetters(user.id, {
    q: params.get('q') ?? undefined,
    departmentId: params.get('departmentId') ?? undefined,
    requestTypeId: params.get('requestTypeId') ?? undefined,
    status: (params.get('status') as LetterStatus | null) ?? undefined,
    favorite: params.get('favorite') === 'true',
    cursor: params.get('cursor') ?? undefined,
    limit: Number(params.get('limit')) || undefined,
  });

  return jsonOk(result.items, { meta: { nextCursor: result.nextCursor } });
});
