import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utility: cn (Class Merger)', () => {
  it('should merge tailwind classes correctly', () => {
    expect(cn('bg-red-500', 'p-4')).toBe('bg-red-500 p-4');
  });

  it('should handle conditional classes', () => {
    expect(cn('bg-red-500', true && 'p-4', false && 'm-2')).toBe('bg-red-500 p-4');
  });

  it('should resolve tailwind conflicts (last one wins)', () => {
    expect(cn('p-4', 'p-8')).toBe('p-8');
  });
});

describe('Logic: XP Threshold Calculation', () => {
  // Replicating the DB formula: 100 * (Level ^ 1.5)
  const getXpThreshold = (level: number) => Math.floor(100 * Math.pow(level, 1.5));

  it('should calculate correct XP for level 1', () => {
    expect(getXpThreshold(1)).toBe(100);
  });

  it('should calculate correct XP for level 2', () => {
    expect(getXpThreshold(2)).toBe(282); // floor(100 * 2^1.5) = 282.84 -> 282
  });

  it('should calculate correct XP for level 10', () => {
    expect(getXpThreshold(10)).toBe(3162); // floor(100 * 10^1.5) = 3162.27 -> 3162
  });
});
