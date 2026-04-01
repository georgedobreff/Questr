import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/migrations/..._pet_death_logic.sql
 */
function checkRevivalStatus(currentModules: number, deathBaseline: number) {
  const modulesNeeded = 3;
  const progress = currentModules - deathBaseline;
  
  if (progress >= modulesNeeded) {
    return { canRevive: true, progress: 3, total: 3 };
  }
  return { canRevive: false, progress: Math.max(0, progress), total: 3 };
}

describe('Logic: Pet Revival Penance', () => {
  it('should prevent revival if no progress made', () => {
    const result = checkRevivalStatus(10, 10); // Died at module 10, still at 10
    expect(result.canRevive).toBe(false);
    expect(result.progress).toBe(0);
  });

  it('should show partial progress', () => {
    const result = checkRevivalStatus(12, 10); // Completed 2 modules
    expect(result.canRevive).toBe(false);
    expect(result.progress).toBe(2);
  });

  it('should allow revival after 3 modules', () => {
    const result = checkRevivalStatus(13, 10); // Completed 3 modules
    expect(result.canRevive).toBe(true);
  });

  it('should allow revival if user far exceeded progress', () => {
    const result = checkRevivalStatus(20, 10); 
    expect(result.canRevive).toBe(true);
  });
});
