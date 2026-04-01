import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/migrations/..._separate_pet_items.sql
 * And: src/app/(app)/shop/shop-client-page.tsx
 */
function canPetUseItem(petSpecies: string, itemAllowedSpecies: string[] | null) {
  // NULL means the item is universal
  if (!itemAllowedSpecies || itemAllowedSpecies.length === 0) {
    return true;
  }
  return itemAllowedSpecies.includes(petSpecies);
}

describe('Logic: Pet Species Gating', () => {
  it('should allow universal items for any species', () => {
    expect(canPetUseItem('chicken', null)).toBe(true);
    expect(canPetUseItem('wolf', [])).toBe(true);
  });

  it('should allow species-specific items for matching pet', () => {
    const dogItems = ['dog', 'wolf'];
    expect(canPetUseItem('dog', dogItems)).toBe(true);
    expect(canPetUseItem('wolf', dogItems)).toBe(true);
  });

  it('should reject species-specific items for non-matching pet', () => {
    const catItems = ['cat'];
    expect(canPetUseItem('dog', catItems)).toBe(false);
    expect(canPetUseItem('chicken', catItems)).toBe(false);
  });
});
