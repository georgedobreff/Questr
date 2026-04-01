import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/continue-plan/index.ts
 */
function getHistoricalContextStrategy(lastCompletedModule: number) {
  if (lastCompletedModule === 1) {
    return 'FETCH_PREVIOUS_QUESTS'; // Just finished first week, plenty of token room
  } else if (lastCompletedModule > 1) {
    return 'SUMMARIZE_AND_FETCH_RECENT'; // Finished multiple weeks, need a summary to save tokens
  }
  return 'NO_CONTEXT';
}

describe('Narrative Strategy: Context Assembly', () => {
  it('should use raw quests for the second module', () => {
    expect(getHistoricalContextStrategy(1)).toBe('FETCH_PREVIOUS_QUESTS');
  });

  it('should use summarization for deeper modules', () => {
    expect(getHistoricalContextStrategy(2)).toBe('SUMMARIZE_AND_FETCH_RECENT');
    expect(getHistoricalContextStrategy(10)).toBe('SUMMARIZE_AND_FETCH_RECENT');
  });

  it('should return no context for new plans', () => {
    expect(getHistoricalContextStrategy(0)).toBe('NO_CONTEXT');
  });
});
