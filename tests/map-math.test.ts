import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: src/components/procedural-map.tsx
 */
function createRandom(seed: number) {
    let s = seed;
    return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };
}

function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
    const l2 = Math.pow(x1 - x2, 2) + Math.pow(y1 - y2, 2);
    if (l2 === 0) return Math.sqrt(Math.pow(px - x1, 2) + Math.pow(py - y1, 2));
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.sqrt(Math.pow(px - projX, 2) + Math.pow(py - projY, 2));
}

describe('Map Math: PRNG & Geometry', () => {
  it('should produce the same sequence for the same seed', () => {
    const gen1 = createRandom(12345);
    const gen2 = createRandom(12345);
    expect(gen1()).toBe(gen2());
    expect(gen1()).toBe(gen2());
  });

  it('should produce different sequences for different seeds', () => {
    const gen1 = createRandom(123);
    const gen2 = createRandom(456);
    expect(gen1()).not.toBe(gen2());
  });

  it('should correctly calculate distance from a point to a line segment', () => {
    // Segment from (0,0) to (10,0)
    // Point at (5, 5) should be distance 5
    expect(distToSegment(5, 5, 0, 0, 10, 0)).toBe(5);
    
    // Point at (15, 0) should be distance 5 (distance to end of segment)
    expect(distToSegment(15, 0, 0, 0, 10, 0)).toBe(5);
  });
});
