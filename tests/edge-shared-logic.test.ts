import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/_shared/llm.ts
 * Manual JSON Balancer logic
 */
function simulateJsonBalancing(buffer: string) {
    let openBrace = buffer.indexOf('{');
    if (openBrace === -1) return null;
    
    let balance = 0;
    let endIndex = -1;
    let inString = false;
    let escape = false;

    for (let i = openBrace; i < buffer.length; i++) {
        const char = buffer[i];
        if (escape) { escape = false; continue; }
        if (char === '\\') { escape = true; continue; }
        if (char === '"') { inString = !inString; continue; }
        if (!inString) {
            if (char === '{') balance++;
            else if (char === '}') {
                balance--;
                if (balance === 0) { endIndex = i; break; }
            }
        }
    }

    if (endIndex !== -1) {
        return buffer.substring(openBrace, endIndex + 1);
    }
    return null;
}

describe('Edge Shared Logic: Manual JSON Balancer', () => {
  it('should detect a complete simple JSON object', () => {
    const input = '... { "status": "ok" } ...';
    expect(simulateJsonBalancing(input)).toBe('{ "status": "ok" }');
  });

  it('should detect nested JSON objects correctly', () => {
    const input = '{ "data": { "value": 10 }, "msg": "hi" }';
    expect(simulateJsonBalancing(input)).toBe(input);
  });

  it('should ignore braces inside strings', () => {
    const input = '{ "text": "here is a brace { and another }" }';
    expect(simulateJsonBalancing(input)).toBe(input);
  });

  it('should return null for incomplete objects', () => {
    const input = '{ "status": "incomp...';
    expect(simulateJsonBalancing(input)).toBeNull();
  });
});
