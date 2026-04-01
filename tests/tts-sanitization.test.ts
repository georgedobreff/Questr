import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/generate-speech/index.ts
 */
function sanitizeForTTS(text: string) {
  // First pass: remove bold stars and bracketed metadata
  let cleaned = text.replace(/\*\*/g, '').replace(/\[.*?\]/g, '').trim();
  // Second pass: remove words between single asterisks (italics)
  cleaned = cleaned.replace(/\*.*?\*/g, '').trim();
  return cleaned;
}

describe('Logic: TTS Text Sanitization', () => {
  it('should strip bold markdown asterisks', () => {
    const input = 'You have **Mastered** the skill.';
    expect(sanitizeForTTS(input)).toBe('You have Mastered the skill.');
  });

  it('should strip bracketed action markers AND their content', () => {
    const input = 'The Orc attacks! [ROLL REQUIRED] What do you do?';
    expect(sanitizeForTTS(input)).toBe('The Orc attacks!  What do you do?');
  });

  it('should strip italic markdown AND the words inside', () => {
    const input = 'The Oracle *whispers* to you.';
    expect(sanitizeForTTS(input)).toBe('The Oracle  to you.');
  });

  it('should handle combined markdown correctly (stripping all metadata)', () => {
    const input = '**Warning**: [TRAP DETECTED] Be *careful*.';
    expect(sanitizeForTTS(input)).toBe('Warning:  Be .');
  });
});
