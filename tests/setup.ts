/**
 * إعداد بيئة الاختبار.
 * قيم وهمية ثابتة حتى لا يعتمد أي اختبار على .env المحلي للمطوّر.
 *
 * `process.env` يُكتب عبر Object.assign لأن أنواع Node تعرّف NODE_ENV
 * للقراءة فقط.
 */
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  DATABASE_URL:
    'postgresql://postgres:postgres@localhost:5433/maroudak_test?schema=public',
  APP_URL: 'http://localhost:3000',
};

for (const [key, value] of Object.entries(defaults)) {
  if (!process.env[key]) {
    Object.assign(process.env, { [key]: value });
  }
}
