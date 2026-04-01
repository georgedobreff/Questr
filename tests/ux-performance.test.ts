import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: src/app/(app)/oracle/chat-client-page.tsx
 */
function getTypingDelay(fullContentLength: number, displayedLength: number) {
  const backlog = fullContentLength - displayedLength;
  if (backlog > 100) return 5;
  if (backlog > 20) return 15;
  return 30;
}

describe('UX Logic: Dynamic Typing Delay', () => {
  it('should use fast delay for large backlogs', () => {
    expect(getTypingDelay(200, 50)).toBe(5); // 150 char backlog
  });

  it('should use moderate delay for medium backlogs', () => {
    expect(getTypingDelay(100, 50)).toBe(15); // 50 char backlog
  });

  it('should use natural reading speed for small backlogs', () => {
    expect(getTypingDelay(60, 50)).toBe(30); // 10 char backlog
  });
});
