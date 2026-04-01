import { describe, it, expect } from 'vitest';
import * as z from 'zod';

/**
 * REPLICATED SCHEMA FROM: src/app/(app)/new-path/page.tsx
 */
const goalSchema = z.object({
  goal_text: z.string().min(10).max(1000),
});

describe('Validation: New Journey Goal Text', () => {
  it('should accept a valid goal string', () => {
    const result = goalSchema.safeParse({ goal_text: 'I want to learn advanced mathematics' });
    expect(result.success).toBe(true);
  });

  it('should reject a goal that is too short', () => {
    const result = goalSchema.safeParse({ goal_text: 'Learn' }); // 5 chars
    expect(result.success).toBe(false);
  });

  it('should reject a goal that is too long', () => {
    const longGoal = 'a'.repeat(1001);
    const result = goalSchema.safeParse({ goal_text: longGoal });
    expect(result.success).toBe(false);
  });
});
