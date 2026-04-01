import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/pet-mission-manager/index.ts
 */
function filterValidLoot(petSpecies: string, allItems: any[]) {
  return allItems.filter(item => {
    // Universal items have null or empty pet_species
    const isUniversal = !item.pet_species || item.pet_species.length === 0;
    // Species-specific match
    const isSpeciesMatch = item.pet_species && item.pet_species.includes(petSpecies);
    
    return isUniversal || isSpeciesMatch;
  });
}

describe('Logic: Pet Mission Loot Filtering', () => {
  const mockCatalog = [
    { id: 1, name: 'Water', pet_species: null },
    { id: 2, name: 'Dog Kibble', pet_species: ['dog', 'wolf'] },
    { id: 3, name: 'Bird Seed', pet_species: ['chicken', 'chick'] }
  ];

  it('should include universal items for any species', () => {
    const results = filterValidLoot('dog', mockCatalog);
    expect(results.find(i => i.name === 'Water')).toBeDefined();
  });

  it('should include dog-specific items for a wolf', () => {
    const results = filterValidLoot('wolf', mockCatalog);
    expect(results.find(i => i.name === 'Dog Kibble')).toBeDefined();
    expect(results.find(i => i.name === 'Bird Seed')).toBeUndefined();
  });

  it('should exclude bird items for a dog', () => {
    const results = filterValidLoot('dog', mockCatalog);
    expect(results.find(i => i.name === 'Bird Seed')).toBeUndefined();
  });
});
