import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowLeft,
  Coins,
  FileEdit,
  FilePlus2,
  Files,
  CalendarDays,
  CheckCircle2,
  PlayCircle,
} from 'lucide-react';
import { requireUser } from '@/lib/auth/guards';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState, PageHeader } from '@/components/shared/states';
import { LETTER_STATUS_LABEL, LETTER_STATUS_TONE } from '@/features/letters/labels';
import { formatArabicDate } from '@/lib/utils/arabic';
import {
  getDashboardStats,
  getRecentLetters,
  getResumableInterview,
  getTopDepartments,
} from '@/features/dashboard/queries';

export const metadata: Metadata = { title: 'لوحة التحكم' };

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number;
  icon: typeof Files;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-subtle text-primary">
          <Icon className="size-4.5" aria-hidden />
        </span>
      </div>
      <p className="tabular mt-3 text-3xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

export default async function DashboardPage() {
  const { user } = await requireUser();

  const [stats, recentLetters, topDepartments, resumable] = await Promise.all([
    getDashboardStats(user.id),
    getRecentLetters(user.id),
    getTopDepartments(user.id),
    getResumableInterview(user.id),
  ]);

  const firstName = user.name.split(/\s+/)[0] ?? user.name;

  return (
    <>
      <PageHeader
        title={`أهلاً، ${firstName}`}
        description="ابدأ معروضاً جديداً أو تابع ما بدأته."
        actions={
          <Button asChild>
            <Link href="/new">
              <FilePlus2 className="size-4.5" />
              معروض جديد
            </Link>
          </Button>
        }
      />

      {resumable ? (
        <Card className="mb-8 border-primary/30 bg-primary-subtle/40 p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <PlayCircle className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium">لديك معروض لم يكتمل</p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {resumable.requestType.name} · {resumable.department.name} — آخر
                  نشاط في {formatArabicDate(resumable.lastActiveAt)}
                </p>
              </div>
            </div>
            <Button asChild className="sm:shrink-0">
              <Link href={`/new/${resumable.id}`}>
                أكمل المقابلة
                <ArrowLeft className="size-4.5" />
              </Link>
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="إجمالي المعاريض" value={stats.totalLetters} icon={Files} />
        <StatCard
          label="هذا الشهر"
          value={stats.lettersThisMonth}
          icon={CalendarDays}
        />
        <StatCard label="المسودات" value={stats.drafts} icon={FileEdit} />
        <StatCard
          label="الرصيد المتبقي"
          value={stats.creditBalance}
          icon={Coins}
          hint="معروض واحد = رصيد واحد"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">آخر المعاريض</h2>
            {recentLetters.length > 0 ? (
              <Link
                href="/letters"
                className="text-sm text-primary hover:underline"
              >
                عرض الكل
              </Link>
            ) : null}
          </div>

          {recentLetters.length === 0 ? (
            <EmptyState
              icon={Files}
              title="لم تكتب معروضاً بعد"
              description="ابدأ بمعروضك الأول — لن يستغرق الأمر أكثر من دقائق."
              action={
                <Button asChild>
                  <Link href="/new">
                    <FilePlus2 className="size-4.5" />
                    ابدأ الآن
                  </Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {recentLetters.map((letter) => (
                <li key={letter.id}>
                  <Link
                    href={`/letters/${letter.id}`}
                    className="flex items-center gap-4 rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-muted/50"
                  >
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground">
                      <Files className="size-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {letter.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {letter.departmentName} · {letter.requestTypeName} ·{' '}
                        {formatArabicDate(letter.createdAt)}
                      </span>
                    </span>
                    <Badge tone={LETTER_STATUS_TONE[letter.status] ?? 'neutral'}>
                      {LETTER_STATUS_LABEL[letter.status] ?? letter.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="mb-4 font-semibold">الجهات الأكثر استخداماً</h2>
          {topDepartments.length === 0 ? (
            <Card className="p-5">
              <p className="text-sm text-muted-foreground">
                ستظهر هنا الجهات التي تخاطبها أكثر بعد إنشاء أول معروض.
              </p>
            </Card>
          ) : (
            <Card className="divide-y divide-border p-0">
              {topDepartments.map((department) => (
                <div
                  key={department.id}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <span className="min-w-0 truncate text-sm">{department.name}</span>
                  <Badge tone="brand" className="tabular shrink-0">
                    {department.count}
                  </Badge>
                </div>
              ))}
            </Card>
          )}

          <Card className="mt-4 p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4.5 text-success" aria-hidden />
              <p className="text-sm font-medium">معاريض مكتملة</p>
            </div>
            <p className="tabular mt-2 text-2xl font-bold">{stats.completed}</p>
          </Card>
        </section>
      </div>
    </>
  );
}
