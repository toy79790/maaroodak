import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { TemplateEditor } from '@/features/admin/components/template-editor';
import { PageHeader } from '@/components/shared/states';
import { BackLink } from '@/features/admin/components/admin-form';

export const metadata: Metadata = { title: 'تعديل القالب' };

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('template:manage');
  const { id } = await params;

  const [template, departments, requestTypes] = await Promise.all([
    prisma.template.findFirst({
      where: { id, deletedAt: null },
      select: {
        slug: true,
        name: true,
        description: true,
        body: true,
        isDefault: true,
        isActive: true,
        version: true,
        departmentId: true,
        requestTypeId: true,
      },
    }),
    prisma.department.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.requestType.findMany({
      where: { deletedAt: null },
      orderBy: { order: 'asc' },
      select: { id: true, name: true },
    }),
  ]);

  if (!template) notFound();

  return (
    <>
      <BackLink href="/admin/templates" label="القوالب" />
      <PageHeader
        title="تعديل القالب"
        description={`${template.name} — النسخة ${template.version}`}
      />
      <TemplateEditor
        templateId={id}
        departments={departments}
        requestTypes={requestTypes}
        initial={{
          slug: template.slug,
          name: template.name,
          description: template.description ?? '',
          body: template.body,
          departmentId: template.departmentId ?? '',
          requestTypeId: template.requestTypeId ?? '',
          isDefault: template.isDefault,
          isActive: template.isActive,
        }}
      />
    </>
  );
}
