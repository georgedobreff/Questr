import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: src/app/(app)/character/page.tsx
 */
function aggregateStats(baseStats: any[], equippedItems: any[]) {
  const statsMap = new Map<string, { baseValue: number, buff: number }>();
  
  baseStats.forEach((stat) => {
      statsMap.set(stat.name, { baseValue: stat.value, buff: 0 });
  });

  equippedItems.forEach((item) => {
      const buffs = item.shop_items?.stat_buffs;
      if (buffs) {
          for (const [statName, buffValue] of Object.entries(buffs)) {
              const value = buffValue as number;
              const existingStat = statsMap.get(statName);
              if (existingStat) {
                  existingStat.buff += value;
              } else {
                  // Handle case where an item buffs a stat the player doesn't have yet
                  statsMap.set(statName, { baseValue: 0, buff: value });
              }
          }
      }
  });

  return Array.from(statsMap.entries()).map(([name, { baseValue, buff }]) => ({
      name,
      value: baseValue + buff,
      buff,
  }));
}

describe('Logic: Character Stat Aggregator', () => {
  const baseStats = [
    { name: 'Strength', value: 10 },
    { name: 'Intellect', value: 15 }
  ];

  it('should correctly sum multiple buffs for the same stat', () => {
    const equipped = [
      { shop_items: { stat_buffs: { Strength: 2 } } },
      { shop_items: { stat_buffs: { Strength: 3 } } }
    ];
    const result = aggregateStats(baseStats, equipped);
    const strength = result.find(s => s.name === 'Strength');
    expect(strength?.value).toBe(15); // 10 + 2 + 3
    expect(strength?.buff).toBe(5);
  });

  it('should handle negative buffs correctly', () => {
    const equipped = [
      { shop_items: { stat_buffs: { Intellect: -5 } } }
    ];
    const result = aggregateStats(baseStats, equipped);
    const intellect = result.find(s => s.name === 'Intellect');
    expect(intellect?.value).toBe(10); // 15 - 5
  });

  it('should create new stat entries for item-only buffs', () => {
    const equipped = [
      { shop_items: { stat_buffs: { Luck: 7 } } }
    ];
    const result = aggregateStats(baseStats, equipped);
    const luck = result.find(s => s.name === 'Luck');
    expect(luck).toBeDefined();
    expect(luck?.value).toBe(7);
  });
});
