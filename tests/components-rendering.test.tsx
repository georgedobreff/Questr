import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PetInventory from '@/app/services/pet-inventory';
import { UserPetInventoryItem } from '@/lib/types';

// Mock Next.js Router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

// Mock Supabase Client
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    rpc: vi.fn().mockResolvedValue({ data: 'Used item', error: null }),
  }),
}));

describe('Component: PetInventory', () => {
  const mockItems: UserPetInventoryItem[] = [
    {
      id: 1,
      user_id: 'user-1',
      pet_item_id: 101,
      quantity: 5,
      pet_items: {
        id: 101,
        name: 'Meaty Bone',
        description: 'Tasty',
        cost: 10,
        asset_url: 'bone.png',
        pet_species: null,
        item_tier: 1,
        effect_health: 20,
        effect_happiness: 10
      }
    }
  ];

  it('should render items correctly', () => {
    render(<PetInventory items={mockItems} />);
    expect(screen.getByText('Meaty Bone')).toBeInTheDocument();
    expect(screen.getByText('x5')).toBeInTheDocument();
  });

  it('should display an empty message when no items are provided', () => {
    render(<PetInventory items={[]} />);
    expect(screen.getByText(/You have no treats/i)).toBeInTheDocument();
  });

  it('should disable the use button for non-pro users', () => {
    render(<PetInventory items={mockItems} isPro={false} />);
    const useButton = screen.getByRole('button', { name: /Use/i });
    expect(useButton).toBeDisabled();
  });
});
