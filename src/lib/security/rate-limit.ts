/**
 * تحديد المعدّل — docs/SECURITY.md §5 · docs/DECISIONS.md #D-017
 *
 * التنفيذ الحالي في الذاكرة: كافٍ للتطوير ولنشر عملية واحدة.
 * الإنتاج متعدد العمليات يحتاج تنفيذ Redis — يُستبدل عبر `setRateLimiter`
 * بلا تغيير في أي نقطة استدعاء.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** بالثواني حتى إعادة المحاولة — 0 إن كان مسموحاً. */
  retryAfter: number;
}

export interface RateLimiterPort {
  consume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
  reset(key: string): Promise<void>;
}

/** نافذة منزلقة بطوابع زمنية — أدق من العدّاد الثابت عند حدود النافذة. */
class InMemoryRateLimiter implements RateLimiterPort {
  private readonly hits = new Map<string, number[]>();
  private lastSweep = Date.now();

  async consume(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);

    const windowStart = now - windowMs;
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart);

    if (timestamps.length >= limit) {
      const oldest = timestamps[0] ?? now;
      const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.hits.set(key, timestamps);
      return { allowed: false, remaining: 0, retryAfter };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    return {
      allowed: true,
      remaining: Math.max(0, limit - timestamps.length),
      retryAfter: 0,
    };
  }

  async reset(key: string): Promise<void> {
    this.hits.delete(key);
  }

  /** تنظيف دوري يمنع تسرّب الذاكرة من مفاتيح لم تعد نشطة. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;

    const cutoff = now - 60 * 60_000;
    for (const [key, timestamps] of this.hits) {
      const alive = timestamps.filter((t) => t > cutoff);
      if (alive.length === 0) this.hits.delete(key);
      else this.hits.set(key, alive);
    }
  }
}

let limiter: RateLimiterPort = new InMemoryRateLimiter();

export function setRateLimiter(next: RateLimiterPort): void {
  limiter = next;
}

export function getRateLimiter(): RateLimiterPort {
  return limiter;
}

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

/**
 * يستهلك محاولة ويُرجع النتيجة.
 * `scope` يفصل العدّادات: 'login' لا يشارك 'generate' نفس المفتاح.
 */
export async function rateLimit(
  scope: string,
  identifier: string,
  rule: RateLimitRule,
): Promise<RateLimitResult> {
  return limiter.consume(`${scope}:${identifier}`, rule.limit, rule.windowMs);
}

/** عنوان العميل من ترويسات الوكيل العكسي، مع تراجع آمن. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}
