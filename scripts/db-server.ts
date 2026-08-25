/**
 * خادم PostgreSQL محلي للتطوير — docs/DECISIONS.md #D-004
 *
 * يشغّل ثنائيات PostgreSQL 17 حقيقية بلا Docker وبلا صلاحيات مدير.
 *
 *   npm run db:start   ·   npm run db:stop   ·   npm run db:status
 *
 * ┌─ لماذا لا نستخدم واجهة `embedded-postgres` مباشرة؟ ─────────────────────┐
 * │ لأن ثنائياتها تعيش داخل node_modules تحت مسار هذا المشروع، ومسار        │
 * │ المشروع يحتوي أحرفاً عربية. ويندوز يمرّر مسار الملف التنفيذي بترميز      │
 * │ صفحة النظام (WIN1256)، فيرفضه خادم PostgreSQL المُهيّأ بترميز UTF-8      │
 * │ بخطأ: invalid byte sequence for encoding "UTF8".                        │
 * │                                                                        │
 * │ والتهيئة بترميز النظام ليست حلاً: قاعدة غير UTF-8 تفشل عند أول محرف     │
 * │ خارج تلك الصفحة، وتختلف سلوكياً عن قاعدة الإنتاج.                       │
 * │                                                                        │
 * │ الحل: نسخ الثنائيات مرة واحدة إلى مسار لاتيني بالكامل تحت مجلد          │
 * │ المستخدم، ثم تشغيل initdb و pg_ctl منه مباشرة.                          │
 * └────────────────────────────────────────────────────────────────────────┘
 */
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const PORT = 5433;
const USER = 'postgres';
const PASSWORD = 'postgres';
const DATABASES = ['maroudak', 'maroudak_test'];

const HOME = resolve(homedir(), '.maroudak');
const BIN_DIR = process.env.MAROUDAK_PGBIN ?? join(HOME, 'pg-bin');
const DATA_DIR = process.env.MAROUDAK_PGDATA ?? join(HOME, 'pgdata');
const LOG_FILE = join(HOME, 'postgres.log');
const STAMP_FILE = join(BIN_DIR, '.source-stamp');

const SOURCE_BIN = resolve(
  process.cwd(),
  'node_modules',
  '@embedded-postgres',
  'windows-x64',
  'native',
);

const exe = (name: string) => join(BIN_DIR, 'bin', `${name}.exe`);

/* -------------------------------------------------------------------------- */

function run(
  command: string,
  args: string[],
  options: { detachedChild?: boolean } = {},
): { ok: boolean; stdout: string; stderr: string } {
  /*
   * `pg_ctl start` يُطلق خادماً يبقى حياً بعد خروج pg_ctl نفسه، والخادم يرث
   * الأنابيب. لو التقطنا stdout بأنبوب، لظلّ spawnSync ينتظر إغلاقه — أي
   * إلى الأبد. لذلك نتجاهل المخرجات لهذا الأمر تحديداً، وسجل الخادم يذهب
   * إلى LOG_FILE على أي حال، ونتحقق من النجاح بـ pg_ctl status.
   */
  const result = spawnSync(command, args, {
    // مجلد عمل لاتيني — العمليات ترثه ويجب ألّا يحوي أحرفاً غير ASCII.
    cwd: HOME,
    encoding: 'utf8',
    windowsHide: true,
    stdio: options.detachedChild ? 'ignore' : 'pipe',
  });

  return {
    ok: result.status === 0,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? (result.error ? String(result.error) : ''),
  };
}

/** نسخ الثنائيات مرة واحدة، وإعادة النسخ إن تغيّر المصدر. */
function ensureBinaries(): void {
  if (!existsSync(SOURCE_BIN)) {
    throw new Error(
      `لم يُعثر على ثنائيات PostgreSQL في:\n  ${SOURCE_BIN}\n` +
        'شغّل `npm install` أولاً.',
    );
  }

  const stamp = SOURCE_BIN;
  const current = existsSync(STAMP_FILE)
    ? readFileSync(STAMP_FILE, 'utf8').trim()
    : '';

  if (current === stamp && existsSync(exe('initdb'))) return;

  console.log('› نسخ ثنائيات PostgreSQL إلى مسار لاتيني (مرة واحدة، ~100MB)…');
  mkdirSync(HOME, { recursive: true });
  rmSync(BIN_DIR, { recursive: true, force: true });
  cpSync(SOURCE_BIN, BIN_DIR, { recursive: true });
  writeFileSync(STAMP_FILE, stamp, 'utf8');
  console.log(`  ✓ ${BIN_DIR}`);
}

function isInitialised(): boolean {
  return existsSync(join(DATA_DIR, 'PG_VERSION'));
}

function initialise(): void {
  console.log('› أول تشغيل — تهيئة مجموعة بيانات PostgreSQL جديدة…');

  const passwordFile = join(tmpdir(), `mrd-pw-${randomBytes(6).toString('hex')}`);
  writeFileSync(passwordFile, `${PASSWORD}\n`, 'utf8');

  try {
    const result = run(exe('initdb'), [
      `--pgdata=${DATA_DIR}`,
      `--username=${USER}`,
      `--pwfile=${passwordFile}`,
      '--auth=scram-sha-256',
      // UTF-8 صريح — لا نرث محلية النظام أبداً.
      '--encoding=UTF8',
      '--locale=C',
      '--lc-messages=C',
    ]);

    if (!result.ok) {
      throw new Error(`فشل initdb:\n${result.stderr || result.stdout}`);
    }
  } finally {
    rmSync(passwordFile, { force: true });
  }

  console.log('  ✓ تمت التهيئة بترميز UTF8');
}

function pgCtl(action: 'start' | 'stop' | 'status'): ReturnType<typeof run> {
  const args = [`--pgdata=${DATA_DIR}`, action];

  if (action === 'start') {
    args.push(`--log=${LOG_FILE}`, '--wait', '--timeout=60', '-o', `-p ${PORT}`);
    return run(exe('pg_ctl'), args, { detachedChild: true });
  }
  if (action === 'stop') {
    args.push('--mode=fast', '--wait', '--timeout=60');
  }

  return run(exe('pg_ctl'), args);
}

function isRunning(): boolean {
  return pgCtl('status').ok;
}

async function ensureDatabases(): Promise<void> {
  const client = new pg.Client({
    host: 'localhost',
    port: PORT,
    user: USER,
    password: PASSWORD,
    database: 'postgres',
  });

  await client.connect();

  try {
    for (const name of DATABASES) {
      const existing = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [name],
      );

      if (existing.rowCount === 0) {
        // اسم قاعدة البيانات لا يقبل معاملات مُربطة، وهو ثابت في الشيفرة.
        await client.query(`CREATE DATABASE "${name}" ENCODING 'UTF8'`);
        console.log(`  ✓ أُنشئت قاعدة البيانات "${name}"`);
      } else {
        console.log(`  · قاعدة البيانات "${name}" موجودة`);
      }
    }
  } finally {
    await client.end();
  }
}

/* -------------------------------------------------------------------------- */

async function start(): Promise<void> {
  ensureBinaries();
  mkdirSync(HOME, { recursive: true });

  if (isRunning()) {
    console.log(`› الخادم يعمل بالفعل على المنفذ ${PORT}.`);
  } else {
    if (!isInitialised()) initialise();

    console.log(`› تشغيل PostgreSQL على المنفذ ${PORT}…`);
    const result = pgCtl('start');

    if (!result.ok) {
      const log = existsSync(LOG_FILE) ? readFileSync(LOG_FILE, 'utf8') : '';
      throw new Error(
        `فشل تشغيل الخادم:\n${result.stderr || result.stdout}\n\nسجل الخادم:\n${log.slice(-2000)}`,
      );
    }
  }

  await ensureDatabases();

  console.log('');
  console.log('  PostgreSQL جاهزة ✅');
  console.log(`  البيانات : ${DATA_DIR}`);
  console.log(`  السجل    : ${LOG_FILE}`);
  console.log(
    `  DATABASE_URL="postgresql://${USER}:${PASSWORD}@localhost:${PORT}/maroudak?schema=public"`,
  );
  console.log('');
  console.log('  الخادم يعمل في الخلفية. أوقفه بـ: npm run db:stop');
}

async function stop(): Promise<void> {
  ensureBinaries();

  if (!isRunning()) {
    console.log('› لا يوجد خادم قيد التشغيل.');
    return;
  }

  const result = pgCtl('stop');
  if (!result.ok) {
    throw new Error(`فشل إيقاف الخادم:\n${result.stderr || result.stdout}`);
  }

  console.log('› تم إيقاف PostgreSQL.');
}

async function status(): Promise<void> {
  ensureBinaries();
  const result = pgCtl('status');
  console.log(result.stdout.trim() || result.stderr.trim());
  console.log(
    isRunning()
      ? `\n  ✅ يعمل على المنفذ ${PORT}`
      : '\n  ⛔ متوقف — شغّله بـ: npm run db:start',
  );
}

const commands = { start, stop, status } as const;
const command = (process.argv[2] ?? 'start') as keyof typeof commands;
const handler = commands[command] ?? start;

handler().catch((error: unknown) => {
  console.error(
    `\n✗ ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exit(1);
});
