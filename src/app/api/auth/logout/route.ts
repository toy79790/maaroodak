import { createHandler } from '@/lib/api/handler';
import { jsonOk } from '@/lib/api/response';
import { destroySession } from '@/lib/auth/session';

export const POST = createHandler(async () => {
  await destroySession();
  return jsonOk(null);
});
