'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import * as Dialog from '@radix-ui/react-dialog';
import { Coins, ShieldCheck, UserCog, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormError, FormField } from '@/components/shared/form-field';
import { DataTable, type Column } from '@/features/admin/components/data-table';
import { Toggle, adminSelectClass, useFormErrors } from '@/features/admin/components/admin-form';
import { api, ApiError } from '@/lib/api/client';
import { formatArabicDate } from '@/lib/utils/arabic';

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  creditBalance: number;
  letterCount: number;
  createdAt: string;
  lastLoginAt: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  USER: 'مستخدم',
  ADMIN: 'مدير',
  SUPER_ADMIN: 'مدير عام',
};

const ROLE_TONES: Record<string, 'neutral' | 'brand' | 'warning'> = {
  USER: 'neutral',
  ADMIN: 'brand',
  SUPER_ADMIN: 'warning',
};

export function UsersTable({
  rows,
  currentUserId,
  canManage,
}: {
  rows: readonly UserRow[];
  currentUserId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<UserRow | null>(null);
  const [role, setRole] = React.useState('USER');
  const [isActive, setIsActive] = React.useState(true);
  const [adjustment, setAdjustment] = React.useState('');
  const [note, setNote] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const { formError, fieldErrors, reset, apply } = useFormErrors();

  const isSelf = editing?.id === currentUserId;

  function open(row: UserRow) {
    reset();
    setEditing(row);
    setRole(row.role);
    setIsActive(row.isActive);
    setAdjustment('');
    setNote('');
  }

  async function save() {
    if (!editing) return;
    reset();
    setPending(true);

    const amount = Number(adjustment);

    const payload = {
      // الخادم يرفض تعديل المسؤول لدوره أو تعطيل نفسه — نُخفي الحقول أيضاً.
      ...(isSelf ? {} : { role, isActive }),
      ...(Number.isFinite(amount) && amount !== 0
        ? { creditAdjustment: amount, adjustmentNote: note }
        : {}),
    };

    try {
      await api.patch(`/api/admin/users/${editing.id}`, payload);
      toast.success('تم حفظ التعديلات');
      setEditing(null);
      router.refresh();
    } catch (error) {
      apply(error instanceof ApiError ? error : undefined);
    } finally {
      setPending(false);
    }
  }

  const columns: Array<Column<UserRow>> = [
    {
      key: 'user',
      header: 'المستخدم',
      searchText: (row) => `${row.name} ${row.email}`,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.name}</p>
          <p className="mt-0.5 truncate text-xs text-subtle-foreground" dir="ltr">
            {row.email}
          </p>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'الدور',
      searchText: (row) => ROLE_LABELS[row.role] ?? row.role,
      cell: (row) => (
        <Badge tone={ROLE_TONES[row.role] ?? 'neutral'}>
          {row.role !== 'USER' ? <ShieldCheck className="size-3" aria-hidden /> : null}
          {ROLE_LABELS[row.role] ?? row.role}
        </Badge>
      ),
    },
    {
      key: 'credits',
      header: 'الرصيد',
      className: 'tabular',
      cell: (row) => row.creditBalance,
    },
    {
      key: 'letters',
      header: 'المعاريض',
      className: 'tabular',
      cell: (row) => row.letterCount,
    },
    {
      key: 'status',
      header: 'الحالة',
      cell: (row) =>
        row.isActive ? (
          <Badge tone="success">نشط</Badge>
        ) : (
          <Badge tone="danger">معطّل</Badge>
        ),
    },
    {
      key: 'lastLogin',
      header: 'آخر دخول',
      className: 'whitespace-nowrap text-xs text-muted-foreground',
      cell: (row) =>
        row.lastLoginAt ? formatArabicDate(new Date(row.lastLoginAt)) : '—',
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            className: 'w-16',
            cell: (row: UserRow) => (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => open(row)}
                  aria-label={`إدارة ${row.name}`}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                >
                  <UserCog className="size-4" />
                </button>
              </div>
            ),
          } satisfies Column<UserRow>,
        ]
      : []),
  ];

  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        getRowId={(row) => row.id}
        searchPlaceholder="ابحث بالاسم أو البريد…"
        emptyTitle="لا يوجد مستخدمون"
      />

      <Dialog.Root open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-sand-950/40" />
          <Dialog.Content className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-md -translate-y-1/2 rounded-[var(--radius-card)] border border-border bg-surface p-6 shadow-lift">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <Dialog.Title className="font-semibold">إدارة المستخدم</Dialog.Title>
                <Dialog.Description className="mt-0.5 truncate text-sm text-muted-foreground">
                  {editing?.name} · {editing?.email}
                </Dialog.Description>
              </div>
              <Dialog.Close
                aria-label="إغلاق"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-muted"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <FormError message={formError} />

            {isSelf ? (
              <p className="mb-4 rounded-[var(--radius-field)] border border-warning/40 bg-warning-subtle px-3.5 py-2.5 text-xs text-warning">
                لا يمكنك تعديل دورك أو تعطيل حسابك — حماية من قفل نفسك خارج اللوحة.
              </p>
            ) : null}

            <div className="space-y-4">
              {!isSelf ? (
                <>
                  <FormField id="u-role" label="الدور" error={fieldErrors.role}>
                    {(props) => (
                      <select
                        {...props}
                        value={role}
                        onChange={(event) => setRole(event.target.value)}
                        className={adminSelectClass}
                      >
                        {Object.entries(ROLE_LABELS).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    )}
                  </FormField>

                  <Toggle
                    checked={isActive}
                    onChange={setIsActive}
                    label="الحساب نشط"
                    description="تعطيل الحساب يُبطل جلساته فوراً."
                  />
                </>
              ) : null}

              <FormField
                id="u-credits"
                label="تعديل الرصيد"
                description={`الرصيد الحالي: ${editing?.creditBalance ?? 0}. موجب للمنح وسالب للسحب.`}
                error={fieldErrors.creditAdjustment}
              >
                {(props) => (
                  <Input
                    {...props}
                    type="number"
                    value={adjustment}
                    onChange={(event) => setAdjustment(event.target.value)}
                    placeholder="0"
                  />
                )}
              </FormField>

              {adjustment && Number(adjustment) !== 0 ? (
                <FormField id="u-note" label="سبب التعديل">
                  {(props) => (
                    <Input
                      {...props}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="تعويض عن عملية فاشلة"
                    />
                  )}
                </FormField>
              ) : null}
            </div>

            <div className="mt-6 flex gap-3">
              <Button onClick={() => void save()} loading={pending} block>
                <Coins className="size-4" />
                حفظ
              </Button>
              <Dialog.Close asChild>
                <Button variant="secondary">إلغاء</Button>
              </Dialog.Close>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
