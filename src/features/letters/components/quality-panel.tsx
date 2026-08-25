'use client';

import * as React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Info,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { QUALITY_CHECK_LABELS, type QualityReport } from '@/services/ai/schemas';

/**
 * عرض تقرير الجودة والضوابط — docs/AI_SYSTEM.md §7
 *
 * مبدأ العرض: **الفحص يُبلغ ولا يُعدّل**. لا زر «أصلح تلقائياً» هنا؛
 * القرار للمستخدم لأن النص نصّه ومسؤوليته.
 */

export interface GuardrailWarning {
  kind: string;
  severity: 'block' | 'warn' | 'info';
  message: string;
  evidence: string[];
}

interface QualityPanelProps {
  report: QualityReport | null;
  guardrails?: GuardrailWarning[];
  placeholders?: string[];
  onRegenerate?: () => void;
  regenerating?: boolean;
}

const SEVERITY_STYLE = {
  critical: {
    icon: XCircle,
    box: 'border-danger/30 bg-danger-subtle',
    text: 'text-danger',
  },
  warning: {
    icon: AlertTriangle,
    box: 'border-warning/40 bg-warning-subtle',
    text: 'text-warning',
  },
  info: { icon: Info, box: 'border-info/30 bg-info-subtle', text: 'text-info' },
  none: {
    icon: CheckCircle2,
    box: 'border-success/30 bg-success-subtle',
    text: 'text-success',
  },
} as const;

export function QualityPanel({
  report,
  guardrails = [],
  placeholders = [],
  onRegenerate,
  regenerating,
}: QualityPanelProps) {
  const [expanded, setExpanded] = React.useState(false);

  const blocking = guardrails.filter((item) => item.severity === 'block');
  const warnings = guardrails.filter((item) => item.severity === 'warn');

  const failedChecks = report
    ? QUALITY_CHECK_LABELS.filter(({ key }) => !report[key].passed)
    : [];

  const criticalChecks = failedChecks.filter(
    ({ key }) => report && report[key].severity === 'critical',
  );

  const hasCritical = blocking.length > 0 || criticalChecks.length > 0;
  const hasAnything =
    hasCritical ||
    warnings.length > 0 ||
    failedChecks.length > 0 ||
    placeholders.length > 0;

  // كل شيء سليم — شارة صغيرة، لا لوحة كاملة.
  if (!hasAnything) {
    if (!report) return null;
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-field)] border border-success/30 bg-success-subtle px-4 py-2.5 text-sm text-success">
        <ShieldCheck className="size-4.5 shrink-0" aria-hidden />
        <span>تم فحص المعروض ولم تُرصد ملاحظات.</span>
        {report.overallScore ? (
          <span className="tabular ms-auto font-semibold">
            {report.overallScore}/100
          </span>
        ) : null}
      </div>
    );
  }

  const tone = hasCritical ? 'critical' : 'warning';
  const style = SEVERITY_STYLE[tone];
  const Icon = style.icon;

  return (
    <div className={cn('rounded-[var(--radius-card)] border', style.box)}>
      <div className="flex items-start gap-3 p-4">
        <Icon className={cn('mt-0.5 size-5 shrink-0', style.text)} aria-hidden />

        <div className="min-w-0 flex-1">
          <p className={cn('font-medium', style.text)}>
            {hasCritical
              ? 'يحتاج المعروض مراجعتك قبل التقديم'
              : 'ملاحظات على المعروض'}
          </p>

          {/* المعلومات الناقصة أولاً — أكثر ما يحتاج المستخدم فعله. */}
          {placeholders.length > 0 ? (
            <div className="mt-2.5">
              <p className="text-sm text-foreground/80">
                معلومات ناقصة يجب تعبئتها في النص:
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {placeholders.map((placeholder) => (
                  <li
                    key={placeholder}
                    className="rounded-md bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700"
                  >
                    {placeholder}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="mt-2.5 space-y-1.5 text-sm">
            {blocking.map((item) => (
              <li key={item.kind} className="text-danger">
                {item.message}
              </li>
            ))}
            {criticalChecks.map(({ key, label }) => (
              <li key={key} className="text-danger">
                <span className="font-medium">{label}:</span>{' '}
                {report?.[key].message}
              </li>
            ))}
            {!expanded && (warnings.length > 0 || failedChecks.length > criticalChecks.length) ? (
              <li>
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  عرض بقية الملاحظات
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              </li>
            ) : null}
          </ul>

          {expanded ? (
            <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
              {warnings.map((item) => (
                <li key={item.kind}>{item.message}</li>
              ))}
              {failedChecks
                .filter(({ key }) => report && report[key].severity !== 'critical')
                .map(({ key, label }) => (
                  <li key={key}>
                    <span className="font-medium">{label}:</span>{' '}
                    {report?.[key].message}
                  </li>
                ))}
            </ul>
          ) : null}

          {report?.summary ? (
            <p className="mt-3 border-t border-current/10 pt-2.5 text-xs text-muted-foreground">
              {report.summary}
            </p>
          ) : null}

          {hasCritical && onRegenerate ? (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={regenerating}
              className="mt-3 rounded-[var(--radius-field)] border border-current/25 bg-surface px-3.5 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-60"
            >
              {regenerating ? 'جارٍ إعادة التوليد…' : 'إعادة توليد المعروض'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
