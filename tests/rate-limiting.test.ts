import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/plan-generator/index.ts
 */
function checkRateLimit(now: Date, periodStart: Date, count: number, lastGenTime: number) {
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const debounceTime = 60 * 1000;
  const weeklyLimit = 3;

  // Weekly Reset Check
  let currentCount = count;
  let currentPeriodStart = periodStart;
  if (now.getTime() - periodStart.getTime() > sevenDays) {
    currentCount = 0;
    currentPeriodStart = now;
  }

  // Debounce Check
  if (now.getTime() - lastGenTime < debounceTime) {
    return { allowed: false, error: 'DEBOUNCE' };
  }

  // Quota Check
  if (currentCount >= weeklyLimit) {
    return { allowed: false, error: 'QUOTA_EXCEEDED' };
  }

  return { allowed: true, newCount: currentCount + 1, periodStart: currentPeriodStart };
}

describe('Infrastructure: AI Rate Limiting', () => {
  const periodStart = new Date('2026-01-01T00:00:00Z');
  const lastGen = new Date('2026-01-01T12:00:00Z').getTime();

  it('should allow generation within limits', () => {
    const now = new Date('2026-01-01T13:00:00Z');
    const result = checkRateLimit(now, periodStart, 1, lastGen);
    expect(result.allowed).toBe(true);
    expect(result.newCount).toBe(2);
  });

  it('should block rapid-fire requests (Debounce)', () => {
    const now = new Date('2026-01-01T12:00:30Z'); // Only 30s later
    const result = checkRateLimit(now, periodStart, 1, lastGen);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('DEBOUNCE');
  });

  it('should block users exceeding the weekly limit', () => {
    const now = new Date('2026-01-01T15:00:00Z');
    const result = checkRateLimit(now, periodStart, 3, lastGen);
    expect(result.allowed).toBe(false);
    expect(result.error).toBe('QUOTA_EXCEEDED');
  });

  it('should reset the counter after 7 days', () => {
    const now = new Date('2026-01-10T00:00:00Z'); // 9 days later
    const result = checkRateLimit(now, periodStart, 3, lastGen);
    expect(result.allowed).toBe(true);
    expect(result.newCount).toBe(1);
  });
});
