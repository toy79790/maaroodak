import type {
  AnswerMap,
  ConditionRule,
  EngineInput,
  EngineState,
  EngineStep,
  QuestionDef,
} from '@/types/questions';
import { evaluateRule, isEmptyValue } from '@/services/questions/conditions';

/**
 * محرك الأسئلة — docs/ARCHITECTURE.md §5
 *
 * دالة نقية واحدة: (أسئلة + شروط + إجابات) ⟶ حالة.
 * لا حالة داخلية ولا آثار جانبية، فكل خطأ قابل لإعادة الإنتاج بمدخل واحد.
 *
 * إعادة الحساب كاملة بعد كل إجابة (docs/DECISIONS.md #D-014): عدد الأسئلة
 * بالعشرات فالتكلفة مهملة، والمكسب أن حالة فاسدة لا يمكن أن تتراكم.
 */

const MAX_QUESTIONS_PER_STEP = 2;

// ---------------------------------------------------------------------------
// دمج النطاقات
// ---------------------------------------------------------------------------

/**
 * يُزيل تكرار المفاتيح مع أولوية الأخص.
 *
 * مثال: سؤال «المدينة» معرّف عاماً، ومعرّف مرة أخرى خصيصاً لوزارة الإسكان
 * بصياغة مختلفة. الأخص يفوز، ولا يظهر السؤال مرتين.
 */
export function dedupeByScope(questions: readonly QuestionDef[]): QuestionDef[] {
  const winners = new Map<string, QuestionDef>();

  for (const question of questions) {
    const current = winners.get(question.key);
    if (!current || question.scopeSpecificity > current.scopeSpecificity) {
      winners.set(question.key, question);
    }
  }

  return [...winners.values()].sort(
    (a, b) => a.order - b.order || a.key.localeCompare(b.key),
  );
}

// ---------------------------------------------------------------------------
// حساب الرؤية
// ---------------------------------------------------------------------------

interface Visibility {
  visible: Set<string>;
  requiredOverrides: Map<string, boolean>;
}

/**
 * يحسب أي الأسئلة مرئية وأيها مطلوب.
 *
 * الشروط قد تتسلسل (أ يُظهر ب، وب يُظهر ج)، ولا نعرف ترتيب الحل مسبقاً،
 * فنكرّر حتى الاستقرار. عدد التكرارات محدود بعدد الأسئلة، فلا حلقة لا نهائية
 * حتى مع قاعدة دائرية تسرّبت من فحص الحفظ.
 */
function computeVisibility(
  questions: readonly QuestionDef[],
  conditions: readonly ConditionRule[],
  answers: AnswerMap,
): Visibility {
  const rulesByTarget = new Map<string, ConditionRule[]>();
  for (const rule of conditions) {
    const list = rulesByTarget.get(rule.targetQuestionKey) ?? [];
    list.push(rule);
    rulesByTarget.set(rule.targetQuestionKey, list);
  }

  // البداية: كل سؤال بلا قاعدة SHOW يكون مرئياً.
  const visible = new Set<string>();
  for (const question of questions) {
    const rules = rulesByTarget.get(question.key) ?? [];
    const hasShowRule = rules.some((rule) => rule.action === 'SHOW');
    if (!hasShowRule) visible.add(question.key);
  }

  const requiredOverrides = new Map<string, boolean>();
  const maxPasses = questions.length + 1;

  for (let pass = 0; pass < maxPasses; pass += 1) {
    let changed = false;
    const isSourceVisible = (key: string) => visible.has(key);

    for (const question of questions) {
      const rules = (rulesByTarget.get(question.key) ?? [])
        .slice()
        .sort((a, b) => a.order - b.order);

      if (rules.length === 0) continue;

      let nextVisible = rules.some((r) => r.action === 'SHOW')
        ? false
        : visible.has(question.key);

      for (const rule of rules) {
        const matched = evaluateRule(rule, answers, isSourceVisible);
        if (!matched) continue;

        switch (rule.action) {
          case 'SHOW':
            nextVisible = true;
            break;
          case 'HIDE':
            // HIDE يُطبَّق بعد SHOW في الترتيب ⇒ يفوز عند التعارض.
            nextVisible = false;
            break;
          case 'REQUIRE':
            requiredOverrides.set(question.key, true);
            break;
          case 'OPTIONAL':
            requiredOverrides.set(question.key, false);
            break;
        }
      }

      if (nextVisible !== visible.has(question.key)) {
        if (nextVisible) visible.add(question.key);
        else visible.delete(question.key);
        changed = true;
      }
    }

    if (!changed) break;
  }

  return { visible, requiredOverrides };
}

// ---------------------------------------------------------------------------
// تجميع الخطوات
// ---------------------------------------------------------------------------

/** أنواع قصيرة يمكن ضمّ سؤالين منها في شاشة واحدة بلا ازدحام. */
const COMPACT_TYPES = new Set(['TEXT', 'NUMBER', 'DATE', 'YES_NO', 'SELECT']);

export function buildSteps(visible: readonly QuestionDef[]): EngineStep[] {
  const steps: EngineStep[] = [];
  let buffer: QuestionDef[] = [];
  let bufferGroup: string | null = null;

  const flush = () => {
    if (buffer.length === 0) return;
    steps.push({ index: steps.length, questions: buffer });
    buffer = [];
    bufferGroup = null;
  };

  for (const question of visible) {
    const group = question.groupKey ?? null;
    const isCompact = COMPACT_TYPES.has(question.type);

    const canJoin =
      buffer.length > 0 &&
      buffer.length < MAX_QUESTIONS_PER_STEP &&
      group !== null &&
      group === bufferGroup &&
      isCompact &&
      buffer.every((q) => COMPACT_TYPES.has(q.type));

    if (!canJoin) flush();

    buffer.push(question);
    bufferGroup = group;

    if (buffer.length >= MAX_QUESTIONS_PER_STEP || group === null || !isCompact) {
      flush();
    }
  }

  flush();
  return steps;
}

// ---------------------------------------------------------------------------
// المحرك
// ---------------------------------------------------------------------------

export function isAnswered(answers: AnswerMap, key: string): boolean {
  return !isEmptyValue(answers[key]);
}

export function computeState(input: EngineInput): EngineState {
  const questions = dedupeByScope(input.questions);
  const { visible: visibleKeys, requiredOverrides } = computeVisibility(
    questions,
    input.conditions,
    input.answers,
  );

  const visible = questions
    .filter((question) => visibleKeys.has(question.key))
    .map((question) => {
      const override = requiredOverrides.get(question.key);
      return override === undefined
        ? question
        : { ...question, required: override };
    });

  const steps = buildSteps(visible);
  const totalSteps = steps.length;

  const missingRequired = visible.filter(
    (question) => question.required && !isAnswered(input.answers, question.key),
  );

  const answeredCount = visible.filter((question) =>
    isAnswered(input.answers, question.key),
  ).length;

  // تصحيح الخطوة: قد تتقلّص الخطوات بعد تغيير إجابة أخفت فرعاً كاملاً.
  const requested = input.currentStepIndex ?? 0;
  const currentStepIndex =
    totalSteps === 0 ? 0 : Math.min(Math.max(requested, 0), totalSteps);

  const isComplete = totalSteps === 0 || missingRequired.length === 0;

  const currentStep = steps[currentStepIndex];
  const canGoNext =
    currentStep === undefined ||
    currentStep.questions.every(
      (question) => !question.required || isAnswered(input.answers, question.key),
    );

  return {
    visible,
    steps,
    currentStepIndex,
    totalSteps,
    progress: totalSteps === 0 ? 1 : Math.min(currentStepIndex / totalSteps, 1),
    isComplete,
    missingRequired,
    answeredCount,
    canGoBack: currentStepIndex > 0,
    canGoNext,
  };
}

/**
 * الخطوة التالية بعد إجابة.
 * تتخطى الخطوات المكتملة تلقائياً — لو أخفت إجابةٌ فرعاً وعاد المستخدم
 * لخطوة مُجاب عنها مسبقاً، لا معنى لإيقافه عندها.
 */
export function nextStepIndex(state: EngineState, answers: AnswerMap): number {
  for (let index = state.currentStepIndex + 1; index < state.totalSteps; index += 1) {
    const step = state.steps[index];
    if (!step) continue;
    const allAnswered = step.questions.every((question) =>
      isAnswered(answers, question.key),
    );
    if (!allAnswered) return index;
  }
  // تجاوز آخر خطوة يعني الوصول إلى المراجعة.
  return state.totalSteps;
}

export function previousStepIndex(state: EngineState): number {
  return Math.max(0, state.currentStepIndex - 1);
}

/**
 * الإجابات المرئية فقط — هذه هي التي تُرسل للذكاء الاصطناعي.
 * إجابة سؤال أُخفي لاحقاً تبقى محفوظة لكنها لا تدخل المعروض
 * (docs/DECISIONS.md #D-015).
 */
export function visibleAnswers(
  state: EngineState,
  answers: AnswerMap,
): AnswerMap {
  const result: AnswerMap = {};
  for (const question of state.visible) {
    const value = answers[question.key];
    if (!isEmptyValue(value)) result[question.key] = value as never;
  }
  return result;
}
