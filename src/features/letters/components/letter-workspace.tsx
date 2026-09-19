'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ArrowRight,
  Eye,
  FileDown,
  FileText,
  Pencil,
  Printer,
  Save,
  Star,
  History,
  ThumbsUp,
  ThumbsDown,
  Check,
  Copy,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PaperPreview } from '@/features/letters/components/paper-preview';
import { QualityPanel, type GuardrailWarning } from '@/features/letters/components/quality-panel';
import { AiToolbar } from '@/features/letters/components/ai-toolbar';
import type { LetterEditorHandle } from '@/features/letters/components/letter-editor';
import { api, ApiError } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { htmlToText } from '@/features/letters/html';
import { AI_TOOL_LABELS, type AiTool } from '@/features/letters/ai-tools';
import type { QualityReport } from '@/services/ai/schemas';

/**
 * المحرر يُحمَّل عند الحاجة لا مع الصفحة.
 *
 * TipTap و ProseMirror تقاربان نصف ميجابايت غير مضغوطة، والوضع الافتراضي
 * هنا **المعاينة** لا التحرير — فأكثر الزوار لا يفتحون المحرر إطلاقاً، وكانوا
 * يدفعون ثمن تنزيله وتفسيره في كل مرة.
 *
 * `React.lazy` لا `next/dynamic`: المكوّن يُمرَّر إليه `ref` (لأمر الحفظ
 * والتحديد)، و`lazy` يمرّر الـref إلى مكوّن `forwardRef` بينما غلاف
 * `next/dynamic` يبتلعه.
 */
const LetterEditor = React.lazy(() =>
  import('@/features/letters/components/letter-editor').then((module) => ({
    default: module.LetterEditor,
  })),
);

/** هيكل بمقاس المحرر — يمنع قفزة التخطيط أثناء التحميل. */
function EditorSkeleton() {
  return (
    <div className="surface-card animate-pulse p-6" aria-hidden>
      <div className="h-9 w-full rounded-[var(--radius-field)] bg-surface-muted" />
      <div className="mt-4 space-y-3">
        {['w-full', 'w-11/12', 'w-full', 'w-10/12', 'w-full', 'w-9/12'].map((width) => (
          <div key={width} className={cn('h-3 rounded-full bg-surface-muted', width)} />
        ))}
      </div>
    </div>
  );
}

/**
 * مساحة عمل المعروض: معاينة ورقية · تحرير · أدوات ذكاء اصطناعي · تصدير.
 *
 * قرار تجربة الاستخدام: **المعاينة هي الوضع الافتراضي** لا المحرر.
 * أول ما يريده المستخدم بعد التوليد هو رؤية النتيجة كما ستُطبع، لا مواجهة
 * شريط أدوات تحرير.
 */

export interface LetterData {
  id: string;
  title: string;
  subject: string | null;
  contentHtml: string;
  status: string;
  isFavorite: boolean;
  currentVersion: number;
  qualityReport: QualityReport | null;
  department: { name: string };
  requestType: { name: string };
}

interface LetterWorkspaceProps {
  letter: LetterData;
  guardrails?: GuardrailWarning[];
  placeholders?: string[];
  creditBalance: number;
  /** أدوات الذكاء الاصطناعي المشمولة لهذا المعروض — #D-042 */
  toolsLimit: number;
  toolsRemaining: number;
  aiEnabled: boolean;
}

type Mode = 'preview' | 'edit';

export function LetterWorkspace({
  letter: initial,
  guardrails = [],
  placeholders = [],
  creditBalance: initialCredits,
  toolsLimit,
  toolsRemaining: initialToolsRemaining,
  aiEnabled,
}: LetterWorkspaceProps) {
  const router = useRouter();
  const editorRef = React.useRef<LetterEditorHandle>(null);

  const [mode, setMode] = React.useState<Mode>('preview');
  const [letter, setLetter] = React.useState(initial);
  const [draftHtml, setDraftHtml] = React.useState(initial.contentHtml);
  const [title, setTitle] = React.useState(initial.title);
  const [toolsRemaining, setToolsRemaining] = React.useState(initialToolsRemaining);
  const [selection, setSelection] = React.useState('');
  const [credits, setCredits] = React.useState(initialCredits);

  const [saving, setSaving] = React.useState(false);
  const [runningTool, setRunningTool] = React.useState<AiTool | null>(null);
  const [feedbackSent, setFeedbackSent] = React.useState(false);

  const isDirty =
    draftHtml !== letter.contentHtml || title.trim() !== letter.title;

  // تحذير قبل مغادرة الصفحة بتعديلات غير محفوظة.
  React.useEffect(() => {
    if (!isDirty) return;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  async function save() {
    if (!isDirty) return;
    setSaving(true);

    try {
      const response = await api.patch<LetterData>(`/api/letters/${letter.id}`, {
        title: title.trim(),
        contentHtml: draftHtml,
      });

      setLetter(response.data);
      setDraftHtml(response.data.contentHtml);
      setTitle(response.data.title);
      toast.success('تم حفظ التعديلات');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : 'تعذّر الحفظ.');
    } finally {
      setSaving(false);
    }
  }

  async function runTool(tool: AiTool) {
    // الحفظ أولاً: الأداة تعمل على النص المحفوظ في الخادم لا على المسودة.
    if (isDirty) {
      await save();
    }

    setRunningTool(tool);
    try {
      const response = await api.post<{
        contentHtml?: string;
        suggestions?: string[];
        warnings: string[];
        creditBalance: number;
        toolsRemaining: number;
      }>(`/api/letters/${letter.id}/ai-tool`, {
        tool,
        selection: selection.trim() || null,
      });

      setCredits(response.data.creditBalance);
      setToolsRemaining(response.data.toolsRemaining);

      if (response.data.suggestions) {
        toast.custom(
          () => (
            <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-4 shadow-lift">
              <p className="mb-2 text-sm font-medium">عناوين مقترحة</p>
              <ul className="space-y-1.5">
                {response.data.suggestions?.map((suggestion) => (
                  <li key={suggestion}>
                    <button
                      type="button"
                      onClick={() => {
                        setTitle(suggestion);
                        toast.dismiss();
                        toast.success('تم اختيار العنوان — لا تنسَ الحفظ');
                      }}
                      className="w-full rounded-lg px-2.5 py-1.5 text-start text-sm hover:bg-surface-muted"
                    >
                      {suggestion}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ),
          { duration: 15000 },
        );
      } else if (response.data.contentHtml) {
        setLetter((current) => ({
          ...current,
          contentHtml: response.data.contentHtml!,
        }));
        setDraftHtml(response.data.contentHtml);
        editorRef.current?.setHtml(response.data.contentHtml);
        setSelection('');
        toast.success(`تم تطبيق: ${AI_TOOL_LABELS[tool]}`);
        router.refresh();
      }

      for (const warning of response.data.warnings) {
        toast.warning(warning);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.code === 'INSUFFICIENT_CREDITS') {
          toast.error(error.message, {
            action: { label: 'شراء رصيد', onClick: () => router.push('/credits') },
          });
        } else if (error.code === 'QUOTA_EXCEEDED') {
          setToolsRemaining(0);
          toast.error(error.message);
        } else {
          toast.error(error.message);
        }
      } else {
        toast.error('تعذّر تنفيذ الأداة.');
      }
    } finally {
      setRunningTool(null);
    }
  }

  async function toggleFavorite() {
    const next = !letter.isFavorite;
    setLetter((current) => ({ ...current, isFavorite: next }));

    try {
      await api.post(`/api/letters/${letter.id}/favorite`, { value: next });
    } catch {
      setLetter((current) => ({ ...current, isFavorite: !next }));
      toast.error('تعذّر تحديث المفضلة.');
    }
  }

  async function sendFeedback(rating: 'THUMBS_UP' | 'THUMBS_DOWN') {
    setFeedbackSent(true);
    try {
      await api.post(`/api/letters/${letter.id}/feedback`, { rating });
      toast.success('شكراً لك — ملاحظتك تساعدنا على التحسين');
    } catch {
      setFeedbackSent(false);
      toast.error('تعذّر إرسال الملاحظة.');
    }
  }

  return (
    <div>
      {/* --- الترويسة --- */}
      <div className="mb-6 print-hidden">
        <Link
          href="/letters"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="size-4" aria-hidden />
          معاريضي
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            {mode === 'edit' ? (
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="عنوان المعروض"
                className="text-lg font-semibold"
              />
            ) : (
              <h1 className="truncate text-xl font-bold">{letter.title}</h1>
            )}

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone="brand">{letter.department.name}</Badge>
              <Badge tone="neutral">{letter.requestType.name}</Badge>
              <span className="tabular text-xs text-muted-foreground">
                النسخة {letter.currentVersion}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void toggleFavorite()}
              aria-label={letter.isFavorite ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}
              aria-pressed={letter.isFavorite}
            >
              <Star
                className={cn(
                  'size-5',
                  letter.isFavorite && 'fill-accent-500 text-accent-500',
                )}
              />
            </Button>

            <Button variant="secondary" size="sm" asChild>
              <Link href={`/letters/${letter.id}/versions`}>
                <History className="size-4" />
                <span className="max-sm:sr-only">النسخ</span>
              </Link>
            </Button>

            {isDirty ? (
              <Button size="sm" onClick={() => void save()} loading={saving}>
                <Save className="size-4" />
                حفظ
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* --- الجودة --- */}
      <div className="mb-6 print-hidden">
        <QualityPanel
          report={letter.qualityReport}
          guardrails={guardrails}
          placeholders={placeholders}
        />
      </div>

      {/* --- التبديل والتصدير --- */}
      <div className="mb-5 flex flex-wrap items-center gap-2 print-hidden">
        <div
          className="inline-flex rounded-[var(--radius-field)] border border-border bg-surface p-1"
          role="tablist"
          aria-label="وضع العرض"
        >
          {(
            [
              { value: 'preview', label: 'معاينة', icon: Eye },
              { value: 'edit', label: 'تحرير', icon: Pencil },
            ] as const
          ).map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={mode === tab.value}
              onClick={() => setMode(tab.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm transition-colors',
                mode === tab.value
                  ? 'bg-primary-subtle font-medium text-primary'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="size-4" aria-hidden />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              // المسودة الحالية لا المحفوظة: ما يراه المستخدم هو ما يُنسخ.
              navigator.clipboard
                .writeText(htmlToText(draftHtml))
                .then(() => toast.success('نُسخ نص المعروض'))
                .catch(() => toast.error('تعذّر النسخ — حدّد النص وانسخه يدوياً.'));
            }}
          >
            <Copy className="size-4" />
            نسخ النص
          </Button>
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" />
            طباعة / PDF
          </Button>
          <Button variant="secondary" size="sm" asChild>
            <a href={`/api/letters/${letter.id}/export?format=docx`} download>
              <FileDown className="size-4" />
              Word
            </a>
          </Button>
        </div>
      </div>

      {/* --- المحتوى --- */}
      {mode === 'preview' ? (
        <PaperPreview contentHtml={draftHtml} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
          <React.Suspense fallback={<EditorSkeleton />}>
            <LetterEditor
              ref={editorRef}
              initialHtml={letter.contentHtml}
              onChange={setDraftHtml}
              onSelectionChange={setSelection}
            />
          </React.Suspense>

          <div className="space-y-4">
            <AiToolbar
              onRun={(tool) => void runTool(tool)}
              running={runningTool}
              selectionText={selection}
              toolsLimit={toolsLimit}
              toolsRemaining={toolsRemaining}
              disabled={!aiEnabled || toolsRemaining <= 0}
              disabledReason={
                !aiEnabled
                  ? 'خدمة الذكاء الاصطناعي غير مُهيّأة على الخادم.'
                  : 'استخدمت التحسينات المشمولة لهذا المعروض. واصل التعديل يدوياً في المحرر بلا حدود.'
              }
            />

            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <p className="text-xs text-muted-foreground">رصيد المعاريض المتبقي</p>
              <p className="tabular mt-1 text-2xl font-bold">{credits}</p>
            </div>
          </div>
        </div>
      )}

      {/* --- التقييم --- */}
      <div className="mt-8 print-hidden">
        {feedbackSent ? (
          <p className="flex items-center justify-center gap-2 text-sm text-success">
            <Check className="size-4" aria-hidden />
            شكراً لملاحظتك
          </p>
        ) : (
          <div className="flex flex-col items-center gap-3 rounded-[var(--radius-card)] border border-dashed border-border-strong p-5">
            <p className="text-sm font-medium">هل أعجبك المعروض؟</p>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void sendFeedback('THUMBS_UP')}
              >
                <ThumbsUp className="size-4" />
                نعم
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void sendFeedback('THUMBS_DOWN')}
              >
                <ThumbsDown className="size-4" />
                يحتاج تحسيناً
              </Button>
            </div>
          </div>
        )}
      </div>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-subtle-foreground print-hidden">
        <FileText className="size-3.5" aria-hidden />
        راجع البيانات والأرقام قبل التقديم.
      </p>
    </div>
  );
}
