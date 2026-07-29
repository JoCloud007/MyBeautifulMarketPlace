import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

describe('useReducedMotion', () => {
  let matchMediaMock: ReturnType<typeof vi.fn>;
  let listeners: Array<(e: { matches: boolean }) => void> = [];

  beforeEach(() => {
    listeners = [];
    matchMediaMock = vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn((event: string, handler: (e: { matches: boolean }) => void) => {
        listeners.push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: (e: { matches: boolean }) => void) => {
        listeners = listeners.filter((l) => l !== handler);
      }),
      dispatchEvent: vi.fn(),
    }));
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns false when prefers-reduced-motion is not set', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when prefers-reduced-motion is set', () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn((event: string, handler: (e: { matches: boolean }) => void) => {
        listeners.push(handler);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('listens to media query changes', () => {
    renderHook(() => useReducedMotion());
    expect(matchMediaMock).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('updates state when media query changes', () => {
    const { result, rerender } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    // Simulate change event
    if (listeners.length > 0) {
      listeners[0]({ matches: true });
    }
    rerender();
    expect(result.current).toBe(true);
  });

  it('cleans up listener on unmount', () => {
    const removeListenerMock = vi.fn();
    matchMediaMock.mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: removeListenerMock,
      dispatchEvent: vi.fn(),
    }));

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(removeListenerMock).toHaveBeenCalled();
  });

  it('matches CSS media query string exactly', () => {
    renderHook(() => useReducedMotion());
    const calls = matchMediaMock.mock.calls;
    expect(calls[0][0]).toBe('(prefers-reduced-motion: reduce)');
  });
});
