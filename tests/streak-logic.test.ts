import { describe, it, expect } from 'vitest';

/**
 * SIMULATED LOGIC FROM: supabase/migrations/..._add_streaks_and_timezones.sql
 * Logic: v_today_local date := date(v_now_utc AT TIME ZONE p_timezone);
 */
function getLocalDateString(utcDate: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(utcDate);
}

describe('Streak Logic: Timezone Conversions', () => {
  const NEW_YORK = 'America/New_York';
  const TOKYO = 'Asia/Tokyo';

  it('should identify different local dates for the same UTC timestamp', () => {
    // 2026-01-02 01:00:00 UTC
    const date = new Date('2026-01-02T01:00:00Z');

    const nyDate = getLocalDateString(date, NEW_YORK); // Jan 1st (9pm)
    const tokyoDate = getLocalDateString(date, TOKYO); // Jan 2nd (10am)

    expect(nyDate).toBe('2026-01-01');
    expect(tokyoDate).toBe('2026-01-02');
  });

  it('should correctly identify "Yesterday" for streak increment', () => {
    const todayTokyo = new Date('2026-01-02T10:00:00Z');
    const lastLoginTokyo = new Date('2026-01-01T10:00:00Z');

    const todayStr = getLocalDateString(todayTokyo, TOKYO);
    const lastStr = getLocalDateString(lastLoginTokyo, TOKYO);

    const d1 = new Date(todayStr);
    const d2 = new Date(lastStr);
    const diffDays = (d1.getTime() - d2.getTime()) / (1000 * 3600 * 24);

    expect(diffDays).toBe(1); // Exactly 1 local day difference = Streak++
  });
});
