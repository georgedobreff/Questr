import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/_shared/icon_utils.ts
 */
function findIconForItem(itemName: string, keywords: string[], tagsMap: { [key: string]: string[] }): string {
  let bestMatch = 'token.png';
  let maxScore = 0;

  const nameKeywords = new Set(itemName.toLowerCase().split(' '));
  const allKeywords = new Set([...nameKeywords, ...keywords.map(k => k.toLowerCase())]);

  for (const [icon, tags] of Object.entries(tagsMap)) {
    let currentScore = 0;
    const iconName = icon.replace('.png', '');

    for (const keyword of allKeywords) {
      const isPremiumKeyword = keywords.includes(keyword);
      if (iconName.includes(keyword)) {
        currentScore += isPremiumKeyword ? 5 : 2;
      }
      if (tags.includes(keyword)) {
        currentScore += isPremiumKeyword ? 3 : 1;
      }
    }

    if (currentScore > maxScore) {
      maxScore = currentScore;
      bestMatch = icon;
    }
  }
  return bestMatch;
}

describe('Asset Mapping: findIconForItem (Weighted Scoring)', () => {
  const mockTags = {
    'sword-steel.png': ['blade', 'weapon', 'sharp', 'warrior'],
    'shield-wood.png': ['defense', 'protection', 'wood'],
    'potion-red.png': ['heal', 'health', 'drink', 'liquid']
  };

  it('should prefer a filename match over a tag match', () => {
    // "sword" appears in filename of sword-steel.png
    const result = findIconForItem('Steel Sword', [], mockTags);
    expect(result).toBe('sword-steel.png');
  });

  it('should use LLM keywords to influence the result', () => {
    // "sharp" is a tag for the sword. 
    // Even if the item name is "Pointy Stick", the keyword "blade" should trigger the sword icon.
    const result = findIconForItem('Pointy Stick', ['blade'], mockTags);
    expect(result).toBe('sword-steel.png');
  });

  it('should correctly prioritize "premium" keywords from the LLM', () => {
    const complexTags = {
        'light-orb.png': ['magic', 'light'],
        'dark-orb.png': ['magic', 'dark']
    };
    // If name says light but keywords say dark, keywords (+5) should outweigh name (+2)
    const result = findIconForItem('Light Orb', ['dark'], complexTags);
    expect(result).toBe('dark-orb.png');
  });
});
