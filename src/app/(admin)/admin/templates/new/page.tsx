import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  EMPTY_TEMPLATE,
  TemplateEditor,
} from '@/features/admin/components/template-editor';
import { PageHeader } from '@/components/shared/states';
import { BackLink } from '@/features/admin/components/admin-form';

export const metadata: Metadata = { title: 'قالب جديد' };

export default async function NewTemplatePage() {
  await requirePermission('template:manage');

  const [departments, requestTypes] = await Promise.all([
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

  return (
    <>
      <BackLink href="/admin/templates" label="القوالب" />
      <PageHeader title="قالب جديد" />
      <TemplateEditor
        initial={EMPTY_TEMPLATE}
        departments={departments}
        requestTypes={requestTypes}
      />
    </>
  );
}
