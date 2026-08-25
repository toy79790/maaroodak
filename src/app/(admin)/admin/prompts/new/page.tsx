import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { EMPTY_PROMPT, PromptEditor } from '@/features/admin/components/prompt-editor';
import { PageHeader } from '@/components/shared/states';
import { BackLink } from '@/features/admin/components/admin-form';
import { isAIConfigured } from '@/config/env';

export const metadata: Metadata = { title: 'موجّه جديد' };

export default async function NewPromptPage() {
  await requirePermission('prompt:manage');

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
      <BackLink href="/admin/prompts" label="الموجّهات" />
      <PageHeader title="موجّه جديد" />
      <PromptEditor
        initial={EMPTY_PROMPT}
        departments={departments}
        requestTypes={requestTypes}
        aiEnabled={isAIConfigured}
      />
    </>
  );
}
