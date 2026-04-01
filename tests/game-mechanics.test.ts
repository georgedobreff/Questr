import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/pet-mission-manager/index.ts
 */
function getSuccessChance(level: number, difficulty: string): number {
  const cappedLevel = Math.min(15, level);
  let startChance: number;
  let capChance: number;

  if (difficulty === 'easy') {
    startChance = 0.70; capChance = 0.95;
  } else if (difficulty === 'medium') {
    startChance = 0.55; capChance = 0.90;
  } else {
    startChance = 0.40; capChance = 0.80;
  }

  if (cappedLevel >= 15) return capChance;
  const progress = (cappedLevel - 1) / 14.0;
  return startChance + (capChance - startChance) * progress;
}

describe('Game Mechanics: Pet Missions & Economy', () => {
  describe('Mission Success Chance', () => {
    it('should calculate base chance for level 1 (Easy)', () => {
      expect(getSuccessChance(1, 'easy')).toBe(0.70);
    });

    it('should calculate base chance for level 1 (Hard)', () => {
      expect(getSuccessChance(1, 'hard')).toBe(0.40);
    });

    it('should scale correctly at level 8 (Mid-point)', () => {
      // (8-1)/14 = 0.5 progress. 
      // Easy: 0.70 + (0.95-0.70)*0.5 = 0.825
      expect(getSuccessChance(8, 'easy')).toBeCloseTo(0.825);
    });

    it('should cap at level 15', () => {
      expect(getSuccessChance(15, 'medium')).toBe(0.90);
      expect(getSuccessChance(100, 'medium')).toBe(0.90);
    });
  });

  describe('Selling Logic', () => {
    const calculateSellPrice = (cost: number) => Math.floor(cost / 2);

    it('should calculate correct sell price (no decimals)', () => {
      expect(calculateSellPrice(100)).toBe(50);
      expect(calculateSellPrice(15)).toBe(7); // floor(7.5)
    });
  });
});
