import type { Metadata } from 'next';
import Link from 'next/link';
import { Plus, FileCode2, Star } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { listTemplatesAdmin } from '@/features/admin/queries';
import { PageHeader } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/states';
import { formatArabicDate } from '@/lib/utils/arabic';

export const metadata: Metadata = { title: 'القوالب' };

export default async function AdminTemplatesPage() {
  await requirePermission('template:manage');
  const templates = await listTemplatesAdmin();

  return (
    <>
      <PageHeader
        title="القوالب"
        description="القالب يحدّد الهيكل الرسمي للمعروض — المخاطبة والافتتاحية والخاتمة. المحتوى يكتبه الذكاء الاصطناعي داخل {{ai_body}}."
        actions={
          <Button asChild>
            <Link href="/admin/templates/new">
              <Plus className="size-4.5" />
              قالب جديد
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={FileCode2}
          title="لا توجد قوالب"
          description="أضف قالباً افتراضياً على الأقل ليعمل التوليد."
          action={
            <Button asChild>
              <Link href="/admin/templates/new">قالب جديد</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((template) => (
            <Card key={template.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/admin/templates/${template.id}`}
                  className="min-w-0 flex-1"
                >
                  <p className="truncate font-medium hover:text-primary hover:underline">
                    {template.name}
                  </p>
                  <code className="mt-0.5 block text-xs text-subtle-foreground" dir="ltr">
                    {template.slug}
                  </code>
                </Link>

                {template.isDefault ? (
                  <Badge tone="brand">
                    <Star className="size-3" aria-hidden />
                    افتراضي
                  </Badge>
                ) : null}
                {!template.isActive ? <Badge tone="danger">معطّل</Badge> : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {template.department ? (
                  <Badge tone="neutral">{template.department.name}</Badge>
                ) : null}
                {template.requestType ? (
                  <Badge tone="info">{template.requestType.name}</Badge>
                ) : null}
                {!template.department && !template.requestType ? (
                  <span className="text-xs text-muted-foreground">عام</span>
                ) : null}
              </div>

              <p className="mt-4 flex items-center gap-3 text-xs text-subtle-foreground">
                <span className="tabular">{template._count.letters} معروض</span>
                <span aria-hidden>·</span>
                <span>{formatArabicDate(template.updatedAt)}</span>
              </p>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
