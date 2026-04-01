import { render } from '@testing-library/react';
import VoiceMode from '../src/app/(app)/oracle/voice-mode';
import { vi, describe, it, expect, beforeEach, afterEach, type MockInstance } from 'vitest';
import * as UseMobileHook from '../src/hooks/use-mobile';

// Mocks
vi.mock('../src/hooks/use-supertonic', () => ({
  useSupertonic: () => ({
    status: 'ready',
    loadingProgress: 0,
    numericProgress: 0,
    speak: vi.fn(),
    stop: vi.fn(),
    playbackVolume: 0,
  }),
}));

vi.mock('@ricky0123/vad-react', () => ({
  useMicVAD: () => ({
    start: vi.fn(),
    pause: vi.fn(),
  }),
}));

// Mock VoiceMode Context
vi.mock('../src/app/services/chat-provider', () => ({
  useVoiceMode: () => ({
    isOpen: true,
    isMinimized: false,
    setIsOpen: vi.fn(),
    setIsMinimized: vi.fn(),
    lastAssistantMessage: null,
    isStreaming: false,
    sendMessage: vi.fn(),
    stop: vi.fn(),
  }),
}));

// Mock Orb component to avoid canvas/webgl issues in test
vi.mock('../src/components/ui/operational/Orb', () => ({
  default: () => <div data-testid="orb-mock" />
}));

describe('VoiceMode Mobile Integration', () => {
  let useMobileSpy: MockInstance;

  beforeEach(() => {
    vi.clearAllMocks();
    useMobileSpy = vi.spyOn(UseMobileHook, 'useMobile') as unknown as MockInstance;

    // Mock AudioContext
    window.AudioContext = vi.fn().mockImplementation(() => ({
      createAnalyser: vi.fn(() => ({
        connect: vi.fn(),
        frequencyBinCount: 32,
        getByteFrequencyData: vi.fn(),
      })),
      createMediaStreamSource: vi.fn(() => ({
        connect: vi.fn(),
      })),
      close: vi.fn(),
    })) as unknown as typeof AudioContext;

    // Mock getUserMedia
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }],
        }),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should NOT initialize AudioContext on mobile', () => {
    // Force mobile
    useMobileSpy.mockReturnValue(true);

    render(
      <VoiceMode />
    );

    // Check if AudioContext was NOT instantiated
    expect(navigator.mediaDevices.getUserMedia).not.toHaveBeenCalled();
  });

  it('should initialize AudioContext on desktop', async () => {
    // Force desktop
    useMobileSpy.mockReturnValue(false);

    render(
      <VoiceMode />
    );

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalled();
  });
});
