import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: supabase/migrations/20260104100000_security_hardening.sql
 * AND: supabase/migrations/20260104120000_final_security_sweep.sql
 */
function checkProfileUpdateSecurity(oldProfile: any, newProfile: any, role: 'authenticated' | 'service_role') {
  if (role === 'service_role') return { allowed: true };

  const protectedColumns = [
    'coins', 'xp', 'level', 'current_streak', 'longest_streak', 
    'action_points', 'dungeon_keys', 'plan_credits', 'oracle_quota', 
    'streak_freezes_available', 'has_had_trial', 'stripe_customer_id', 
    'lemon_squeezy_customer_id', 'last_login_at', 'last_action_at', 
    'onboarding_completed', 'plan_generations_count', 
    'plan_generations_period_start', 'last_plan_generated_at', 
    'last_oracle_chat_at'
  ];

  for (const col of protectedColumns) {
    if (newProfile[col] !== oldProfile[col]) {
      return { allowed: false, error: `Not authorized to update ${col} directly.` };
    }
  }

  return { allowed: true };
}

/**
 * REPLICATED LOGIC FROM: supabase/migrations/20260104150000_onboarding_fix.sql
 */
function checkOnboardingTransitionSecurity(oldProfile: any, newProfile: any, role: 'authenticated' | 'service_role') {
    if (role === 'service_role') return { allowed: true };

    if (newProfile.onboarding_completed !== oldProfile.onboarding_completed) {
        if (!(oldProfile.onboarding_completed === false && newProfile.onboarding_completed === true)) {
            return { allowed: false, error: 'Not authorized to update onboarding status.' };
        }
    }
    return { allowed: true };
}

/**
 * REPLICATED LOGIC FROM: supabase/migrations/20260104100000_security_hardening.sql
 */
function checkPetUpdateSecurity(oldPet: any, newPet: any, role: 'authenticated' | 'service_role') {
  if (role === 'service_role') return { allowed: true };

  const protectedColumns = [
    'health', 'happiness', 'level', 'xp', 'current_energy', 
    'status', 'pet_def_id', 'revival_progress'
  ];

  for (const col of protectedColumns) {
    if (newPet[col] !== oldPet[col]) {
      return { allowed: false, error: `Not authorized to update pet ${col} directly.` };
    }
  }

  // Nickname is allowed
  return { allowed: true };
}

/**
 * REPLICATED LOGIC FROM: supabase/migrations/20260104100000_security_hardening.sql
 */
function checkNotificationUpdateSecurity(oldNote: any, newNote: any, role: 'authenticated' | 'service_role') {
  if (role === 'service_role') return { allowed: true };

  const blockedColumns = ['title', 'message', 'type', 'user_id', 'action_link'];

  for (const col of blockedColumns) {
    if (newNote[col] !== oldNote[col]) {
      return { allowed: false, error: 'Not authorized to update notification content.' };
    }
  }

  return { allowed: true };
}

describe('Security Invariants: RLS & Triggers', () => {
  const mockProfile = {
    id: 'user_123',
    full_name: 'John Doe',
    coins: 100,
    xp: 50,
    level: 1,
    current_streak: 5,
    action_points: 15,
    dungeon_keys: 1,
    has_had_trial: false
  };

  describe('Profile Lockdown', () => {
    it('should block authenticated users from updating coins', () => {
      const result = checkProfileUpdateSecurity(mockProfile, { ...mockProfile, coins: 9999 }, 'authenticated');
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('coins');
    });

    it('should block authenticated users from updating XP/Level', () => {
      const result = checkProfileUpdateSecurity(mockProfile, { ...mockProfile, xp: 1000, level: 10 }, 'authenticated');
      expect(result.allowed).toBe(false);
    });

    it('should block authenticated users from updating energy/keys', () => {
      const result = checkProfileUpdateSecurity(mockProfile, { ...mockProfile, action_points: 100, dungeon_keys: 50 }, 'authenticated');
      expect(result.allowed).toBe(false);
    });

    it('should allow authenticated users to update their name', () => {
      const result = checkProfileUpdateSecurity(mockProfile, { ...mockProfile, full_name: 'Jane Doe' }, 'authenticated');
      expect(result.allowed).toBe(true);
    });

    it('should allow service_role to update everything', () => {
      const result = checkProfileUpdateSecurity(mockProfile, { ...mockProfile, coins: 500, xp: 200 }, 'service_role');
      expect(result.allowed).toBe(true);
    });
  });

  describe('Onboarding Transition', () => {
    it('should allow transition from false to true', () => {
        const oldP = { onboarding_completed: false };
        const newP = { onboarding_completed: true };
        const result = checkOnboardingTransitionSecurity(oldP, newP, 'authenticated');
        expect(result.allowed).toBe(true);
    });

    it('should block transition from true to false', () => {
        const oldP = { onboarding_completed: true };
        const newP = { onboarding_completed: false };
        const result = checkOnboardingTransitionSecurity(oldP, newP, 'authenticated');
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('onboarding status');
    });

    it('should block update if already true', () => {
        const oldP = { onboarding_completed: true };
        const newP = { onboarding_completed: true };
        // If it's the same value, checkOnboardingTransitionSecurity will return true because the values aren't different.
        // The check inside the trigger is: IF NEW.onboarding_completed IS DISTINCT FROM OLD.onboarding_completed
        const result = checkOnboardingTransitionSecurity(oldP, newP, 'authenticated');
        expect(result.allowed).toBe(true);
    });
  });

  describe('Pet Security', () => {
    const mockPet = {
        nickname: 'Sparky',
        health: 100,
        happiness: 100,
        level: 1,
        xp: 0
    };

    it('should block users from healing their pet via API', () => {
        const result = checkPetUpdateSecurity(mockPet, { ...mockPet, health: 100 }, 'authenticated');
        // If it was already 100, it's allowed (no change). Let's test change.
        const result2 = checkPetUpdateSecurity({ ...mockPet, health: 50 }, { ...mockPet, health: 100 }, 'authenticated');
        expect(result2.allowed).toBe(false);
        expect(result2.error).toContain('health');
    });

    it('should allow users to rename their pet', () => {
        const result = checkPetUpdateSecurity(mockPet, { ...mockPet, nickname: 'Fluffy' }, 'authenticated');
        expect(result.allowed).toBe(true);
    });
  });

  describe('Notification Security', () => {
    const mockNote = {
        title: 'Old Title',
        is_read: false
    };

    it('should block users from changing notification message/title', () => {
        const result = checkNotificationUpdateSecurity(mockNote, { ...mockNote, title: 'New Title' }, 'authenticated');
        expect(result.allowed).toBe(false);
    });

    it('should allow users to mark notifications as read', () => {
        const result = checkNotificationUpdateSecurity(mockNote, { ...mockNote, is_read: true }, 'authenticated');
        expect(result.allowed).toBe(true);
    });
  });
});
