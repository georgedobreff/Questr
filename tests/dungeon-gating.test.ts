import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/migrations/..._add_dungeon_keys.sql
 */
function canEnterDungeon(ap: number, keys: number, subStatus: string) {
  const validStatuses = ['active', 'trialing', 'pro'];
  
  if (!validStatuses.includes(subStatus)) {
    return { success: false, error: 'Pro Subscription required' };
  }

  if (ap < 12) {
    return { success: false, error: 'Not enough Action Points (12 required)' };
  }

  if (keys < 1) {
    return { success: false, error: 'No Dungeon Keys remaining' };
  }

  return { success: true };
}

describe('Logic: Dungeon Entry Gating', () => {
  it('should reject users without a Pro subscription', () => {
    const result = canEnterDungeon(100, 10, 'free');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Pro Subscription required');
  });

  it('should reject users with insufficient AP', () => {
    const result = canEnterDungeon(5, 10, 'pro');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Action Points');
  });

  it('should reject users with no keys', () => {
    const result = canEnterDungeon(20, 0, 'pro');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Dungeon Keys');
  });

  it('should allow entry for pro users with sufficient resources', () => {
    const result = canEnterDungeon(12, 1, 'trialing');
    expect(result.success).toBe(true);
  });
});
