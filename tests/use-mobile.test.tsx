import { renderHook, act } from '@testing-library/react';
import { useMobile } from '../src/hooks/use-mobile';
import { describe, it, expect, beforeEach } from 'vitest';

describe('useMobile Hook', () => {
  beforeEach(() => {
    // Default to desktop size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    });
    
    // Mock addEventListener/removeEventListener if necessary, 
    // but JSDOM handles them. We just need to trigger 'resize'.
  });

  it('should return false for desktop width (> 768px)', () => {
    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(false);
  });

  it('should return true for mobile width (< 768px)', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useMobile());
    expect(result.current).toBe(true);
  });

  it('should update when window resizes', () => {
    const { result } = renderHook(() => useMobile());
    
    // Initial: Desktop
    expect(result.current).toBe(false);

    // Resize to Mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(true);

    // Resize back to Desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      });
      window.dispatchEvent(new Event('resize'));
    });

    expect(result.current).toBe(false);
  });
});
