import { describe, it, expect } from 'vitest';

/**
 * REPLICATED LOGIC FROM: src/components/pwa-provider.tsx
 */
function getPwaStatus(userAgent: string, isStandalone: boolean, hasDeferredPrompt: boolean) {
  const ua = userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  
  // Installable if: 
  // 1. Android/Desktop with a prompt 
  // 2. OR iOS and NOT already standalone
  const isInstallable = (hasDeferredPrompt || (isIOS && !isStandalone)) && !isStandalone;

  return { isIOS, isInstallable };
}

describe('PWA: Platform & Installability Logic', () => {
  const IOS_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)';
  const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 11; SM-G991B)';

  it('should detect iOS correctly', () => {
    const status = getPwaStatus(IOS_UA, false, false);
    expect(status.isIOS).toBe(true);
  });

  it('should mark iOS as installable if not in standalone mode', () => {
    const status = getPwaStatus(IOS_UA, false, false);
    expect(status.isInstallable).toBe(true);
  });

  expect('should mark iOS as NOT installable if already standalone', () => {
    const status = getPwaStatus(IOS_UA, true, false);
    expect(status.isInstallable).toBe(false);
  });

  it('should mark Android as installable only if prompt is present', () => {
    const noPrompt = getPwaStatus(ANDROID_UA, false, false);
    const withPrompt = getPwaStatus(ANDROID_UA, false, true);
    
    expect(noPrompt.isInstallable).toBe(false);
    expect(withPrompt.isInstallable).toBe(true);
  });
});
