import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/adventure-dm/index.ts
 */
function resolveRoll(userMessage: string, lastAssistantAction: { dc: number, stat: string } | null) {
  if (userMessage.startsWith("Rolled a ") && lastAssistantAction) {
    const rollValue = parseInt(userMessage.replace("Rolled a ", ""));
    const dc = lastAssistantAction.dc;
    const isSuccess = rollValue >= dc;
    
    return {
      success: isSuccess,
      roll: rollValue,
      dc: dc,
      stat: lastAssistantAction.stat
    };
  }
  return null;
}

describe('Adventure DM: Roll Resolution', () => {
  const lastAction = { stat: 'Strength', dc: 14 };

  it('should resolve a high roll as a success', () => {
    const result = resolveRoll("Rolled a 15", lastAction);
    expect(result?.success).toBe(true);
  });

  it('should resolve a roll exactly equal to DC as a success', () => {
    const result = resolveRoll("Rolled a 14", lastAction);
    expect(result?.success).toBe(true);
  });

  it('should resolve a low roll as a failure', () => {
    const result = resolveRoll("Rolled a 2", lastAction);
    expect(result?.success).toBe(false);
  });

  it('should ignore messages that are not rolls', () => {
    const result = resolveRoll("I try to break the door", lastAction);
    expect(result).toBeNull();
  });
});
