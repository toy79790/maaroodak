'use client';

import * as React from 'react';
import {
  Sparkles,
  Wand2,
  Landmark,
  Minimize2,
  Maximize2,
  Target,
  RefreshCw,
  Heading,
  ArrowUpToLine,
  ArrowDownToLine,
  SpellCheck,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  AI_TOOL_LABELS,
  WHOLE_LETTER_ONLY_TOOLS,
  type AiTool,
} from '@/features/letters/ai-tools';

/**
 * أدوات الذكاء الاصطناعي العشر — docs/AI_SYSTEM.md §10
 *
 * الأداة تُطبَّق على التحديد إن وُجد، وهذا يظهر صراحةً في الواجهة:
 * تطبيق أداة على النص كاملاً بينما يظن المستخدم أنها على تحديده = فقدان عمل.
 */

const TOOL_ICONS: Record<AiTool, typeof Wand2> = {
  IMPROVE: Wand2,
  FORMALIZE: Landmark,
  SHORTEN: Minimize2,
  EXPAND: Maximize2,
  CLARIFY: Target,
  REWRITE: RefreshCw,
  TITLE: Heading,
  INTRO: ArrowUpToLine,
  CONCLUSION: ArrowDownToLine,
  PROOFREAD: SpellCheck,
};

const TOOL_ORDER: readonly AiTool[] = [
  'IMPROVE',
  'FORMALIZE',
  'PROOFREAD',
  'SHORTEN',
  'EXPAND',
  'CLARIFY',
  'REWRITE',
  'INTRO',
  'CONCLUSION',
  'TITLE',
];

export function AiToolbar({
  onRun,
  running,
  selectionText,
  disabled,
  disabledReason,
  toolsLimit,
  toolsRemaining,
}: {
  onRun: (tool: AiTool) => void;
  running: AiTool | null;
  selectionText: string;
  disabled?: boolean;
  disabledReason?: string;
  toolsLimit: number;
  toolsRemaining: number;
}) {
  const hasSelection = selectionText.trim().length > 0;

  return (
    <section
      aria-label="أدوات الذكاء الاصطناعي"
      className="rounded-[var(--radius-card)] border border-border bg-surface p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <Sparkles className="size-4.5 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">أدوات الذكاء الاصطناعي</h2>
        <span
          className="tabular ms-auto text-xs text-muted-foreground"
          title={`مشمولة مع المعروض: حتى ${toolsLimit} تحسينات`}
        >
          مشمولة · متبقٍ {toolsRemaining} من {toolsLimit}
        </span>
      </div>

      {hasSelection ? (
        <p className="mb-3 rounded-lg bg-primary-subtle px-3 py-2 text-xs text-primary">
          ستُطبَّق الأداة على النص المحدَّد ({selectionText.trim().length} حرفاً).
        </p>
      ) : (
        <p className="mb-3 text-xs text-muted-foreground">
          حدّد جزءاً من النص لتطبيق الأداة عليه، أو اتركه بلا تحديد لتطبيقها على
          المعروض كاملاً.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TOOL_ORDER.map((tool) => {
          const Icon = TOOL_ICONS[tool];
          const isRunning = running === tool;
          const ignoresSelection = hasSelection && WHOLE_LETTER_ONLY_TOOLS.has(tool);

          return (
            <button
              key={tool}
              type="button"
              onClick={() => onRun(tool)}
              disabled={disabled || running !== null}
              title={
                ignoresSelection
                  ? `${AI_TOOL_LABELS[tool]} — تُطبَّق على المعروض كاملاً`
                  : AI_TOOL_LABELS[tool]
              }
              className={cn(
                'flex items-center gap-2 rounded-[var(--radius-field)] border border-border px-3 py-2.5 text-start text-xs',
                'transition-colors hover:border-primary hover:bg-primary-subtle/50',
                'disabled:pointer-events-none disabled:opacity-50',
                isRunning && 'border-primary bg-primary-subtle',
              )}
            >
              {isRunning ? (
                <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
              ) : (
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="min-w-0 truncate">{AI_TOOL_LABELS[tool]}</span>
            </button>
          );
        })}
      </div>

      {disabled && disabledReason ? (
        <p className="mt-3 text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </section>
  );
}
