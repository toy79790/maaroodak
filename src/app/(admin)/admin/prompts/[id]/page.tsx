import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { PromptEditor } from '@/features/admin/components/prompt-editor';
import { PageHeader } from '@/components/shared/states';
import { BackLink } from '@/features/admin/components/admin-form';
import { isAIConfigured } from '@/config/env';

export const metadata: Metadata = { title: 'تعديل الموجّه' };

export default async function EditPromptPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission('prompt:manage');
  const { id } = await params;

  const [prompt, departments, requestTypes] = await Promise.all([
    prisma.prompt.findFirst({
      where: { id, deletedAt: null },
      select: {
        key: true,
        name: true,
        description: true,
        type: true,
        content: true,
        model: true,
        maxTokens: true,
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

  if (!prompt) notFound();

  return (
    <>
      <BackLink href="/admin/prompts" label="الموجّهات" />
      <PageHeader
        title="تعديل الموجّه"
        description={`${prompt.name} — النسخة ${prompt.version}`}
      />
      <PromptEditor
        promptId={id}
        departments={departments}
        requestTypes={requestTypes}
        aiEnabled={isAIConfigured}
        initial={{
          key: prompt.key,
          name: prompt.name,
          description: prompt.description ?? '',
          type: prompt.type,
          content: prompt.content,
          model: prompt.model ?? '',
          maxTokens: prompt.maxTokens,
          departmentId: prompt.departmentId ?? '',
          requestTypeId: prompt.requestTypeId ?? '',
          isActive: prompt.isActive,
        }}
      />
    </>
  );
}
