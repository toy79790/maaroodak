import bcrypt from 'bcryptjs';
import { BCRYPT_COST } from '@/config/constants';

/**
 * تجزئة كلمات المرور — docs/SECURITY.md §2
 *
 * bcryptjs (تنفيذ JS خالص) اختير عمداً على bcrypt الأصلي: لا خطوة بناء أصلية
 * تكسر النشر على منصات مختلفة. التكلفة 12 ⇒ نحو 250 مللي ثانية لكل تحقق،
 * وهو ما يُبطئ التخمين دون أن يُلاحظه المستخدم.
 */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * تحقق دائم الزمن مضاد لتعداد الحسابات.
 *
 * لو تخطّينا المقارنة عند عدم وجود المستخدم، لأصبح الرد أسرع بشكل ملحوظ،
 * فيستدلّ المهاجم على البريد المسجّل من زمن الاستجابة وحده. نُجري مقارنة
 * وهمية بنفس التكلفة لنُبقي الزمن ثابتاً.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEeO2q0kNhI7VqEo7rGwK1YvJ0PGVeCq2Rm';

export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null | undefined,
): Promise<boolean> {
  if (!hash) {
    await bcrypt.compare(plain, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(plain, hash);
}

/** كلمات مرور شائعة جداً — تُرفض مهما بلغ طولها. */
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123',
  'qwerty123', 'qwertyui', '11111111', '00000000', 'abc12345', 'iloveyou',
  'admin123', 'welcome1', 'letmein1', 'sunshine', 'princess', 'football',
  'password!', '123123123', 'aaaaaaaa', 'qwertyuiop', '87654321',
]);

export function isCommonPassword(plain: string): boolean {
  return COMMON_PASSWORDS.has(plain.toLowerCase());
}
