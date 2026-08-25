import type { Metadata } from 'next';
import { ScrollText } from 'lucide-react';
import { requirePermission } from '@/lib/auth/guards';
import { listAuditLogs } from '@/features/admin/service';
import { PageHeader, EmptyState } from '@/components/shared/states';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = { title: 'سجل التدقيق' };

const ACTION_LABELS: Record<string, string> = {
  'department.create': 'إنشاء جهة',
  'department.update': 'تعديل جهة',
  'department.delete': 'حذف جهة',
  'requestType.create': 'إنشاء نوع طلب',
  'requestType.update': 'تعديل نوع طلب',
  'question.create': 'إنشاء سؤال',
  'question.update': 'تعديل سؤال',
  'question.delete': 'حذف سؤال',
  'question.reorder': 'إعادة ترتيب الأسئلة',
  'template.create': 'إنشاء قالب',
  'template.update': 'تعديل قالب',
  'prompt.create': 'إنشاء موجّه',
  'prompt.update': 'تعديل موجّه',
  'user.update': 'تعديل مستخدم',
  'setting.update': 'تعديل إعداد',
};

function tone(action: string) {
  if (action.endsWith('.delete')) return 'danger' as const;
  if (action.endsWith('.create')) return 'success' as const;
  return 'neutral' as const;
}

export default async function AdminAuditLogsPage() {
  await requirePermission('audit:read');
  const logs = await listAuditLogs(150);

  return (
    <>
      <PageHeader
        title="سجل التدقيق"
        description="كل عملية إدارية مُسجَّلة بفاعلها ووقتها. آخر 150 عملية."
      />

      {logs.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="لا توجد عمليات مسجّلة"
          description="ستظهر هنا كل عملية إدارية فور تنفيذها."
        />
      ) : (
        <Card className="divide-y divide-border p-0">
          {logs.map((log) => (
            <div key={log.id} className="flex flex-wrap items-center gap-3 p-4">
              <Badge tone={tone(log.action)}>
                {ACTION_LABELS[log.action] ?? log.action}
              </Badge>

              <span className="min-w-0 flex-1 truncate text-sm">
                {log.actor?.name ?? 'نظام'}
                <span className="text-muted-foreground"> · {log.entity}</span>
              </span>

              {log.entityId ? (
                <code className="hidden text-xs text-subtle-foreground sm:block" dir="ltr">
                  {log.entityId.slice(0, 12)}…
                </code>
              ) : null}

              <time
                dateTime={log.createdAt.toISOString()}
                className="tabular shrink-0 text-xs text-muted-foreground"
              >
                {log.createdAt.toLocaleString('ar-SA', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}
              </time>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
