import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/functions/create-checkout/index.ts
 */
function resolvePriceId(productType: string | undefined, bodyPriceId: string | undefined, env: any) {
  const proPriceId = env.PRO_SUBSCRIPTION_PRICE_ID;
  
  if (productType === 'dungeon_key') {
      return env.DUNGEON_KEY_PRICE_ID;
  } else if (productType === 'pet_energy_refill') {
      return env.ENERGY_REFILL_PRICE_ID;
  } else if (!bodyPriceId) {
      return proPriceId;
  }
  return bodyPriceId;
}

describe('Stripe: Price ID Resolution', () => {
  const mockEnv = {
    PRO_SUBSCRIPTION_PRICE_ID: 'price_pro_123',
    DUNGEON_KEY_PRICE_ID: 'price_key_456',
    ENERGY_REFILL_PRICE_ID: 'price_refill_789'
  };

  it('should default to Pro Subscription if nothing provided', () => {
    expect(resolvePriceId(undefined, undefined, mockEnv)).toBe('price_pro_123');
  });

  it('should resolve Dungeon Key correctly', () => {
    expect(resolvePriceId('dungeon_key', undefined, mockEnv)).toBe('price_key_456');
  });

  it('should resolve Pet Energy correctly', () => {
    expect(resolvePriceId('pet_energy_refill', undefined, mockEnv)).toBe('price_refill_789');
  });

  it('should allow overriding with a specific bodyPriceId', () => {
    expect(resolvePriceId(undefined, 'custom_price', mockEnv)).toBe('custom_price');
  });
});
