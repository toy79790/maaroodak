import { describe, expect, it } from 'vitest';
import { readJsonBody } from '@/lib/api/request';
import { AppError } from '@/lib/api/errors';

/** جسم تالف خطأ العميل (400) لا خطأ خادم (500) — #D-046 */

function post(body: string) {
  return new Request('http://localhost/api/x', { method: 'POST', body });
}

describe('readJsonBody', () => {
  it('يقرأ JSON صالحاً', async () => {
    await expect(readJsonBody(post('{"a":1}'))).resolves.toEqual({ a: 1 });
  });

  it('الجسم الفارغ كائن فارغ', async () => {
    await expect(readJsonBody(post(''))).resolves.toEqual({});
  });

  it('الجسم التالف خطأ تحقق 400', async () => {
    const error = await readJsonBody(post('{"a":')).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(AppError);
    expect((error as AppError).code).toBe('VALIDATION');
    expect((error as AppError).status).toBe(400);
  });
});
