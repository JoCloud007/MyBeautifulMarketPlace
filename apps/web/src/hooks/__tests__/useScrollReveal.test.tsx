import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { useScrollReveal } from '@/hooks/useScrollReveal';

function TestComponent(options: Parameters<typeof useScrollReveal>[0] = {}) {
  const { ref, isVisible } = useScrollReveal(options);
  return <div ref={ref} data-testid="target" data-visible={isVisible} />;
}

describe('useScrollReveal', () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let unobserveMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;
  let intersectionCallback: IntersectionObserverCallback | null = null;

  beforeEach(() => {
    observeMock = vi.fn();
    unobserveMock = vi.fn();
    disconnectMock = vi.fn();

    // Use a regular function so it can be used with `new`
    const ctor = function(callback: IntersectionObserverCallback) {
      intersectionCallback = callback;
      return {
        observe: observeMock,
        unobserve: unobserveMock,
        disconnect: disconnectMock,
        takeRecords: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
      };
    };
    global.IntersectionObserver = vi.fn(ctor) as unknown as typeof IntersectionObserver;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    intersectionCallback = null;
  });

  it('returns ref and initial isVisible=false', () => {
    render(<TestComponent />);
    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('data-visible', 'false');
  });

  it('observes element when mounted', () => {
    render(<TestComponent />);
    expect(observeMock).toHaveBeenCalled();
    expect(observeMock).toHaveBeenCalledWith(screen.getByTestId('target'));
  });

  it('sets isVisible=true when element intersects', () => {
    render(<TestComponent />);
    const target = screen.getByTestId('target');
    expect(target).toHaveAttribute('data-visible', 'false');

    act(() => {
      if (intersectionCallback) {
        intersectionCallback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    });

    expect(screen.getByTestId('target')).toHaveAttribute('data-visible', 'true');
  });

  it('unobserves element after first intersection when triggerOnce=true', () => {
    render(<TestComponent triggerOnce />);
    const target = screen.getByTestId('target');

    act(() => {
      if (intersectionCallback) {
        intersectionCallback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    });

    expect(unobserveMock).toHaveBeenCalledWith(target);
  });

  it('does not unobserve when triggerOnce=false', () => {
    render(<TestComponent triggerOnce={false} />);
    const target = screen.getByTestId('target');

    act(() => {
      if (intersectionCallback) {
        intersectionCallback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    });

    expect(unobserveMock).not.toHaveBeenCalled();
  });

  it('sets isVisible=false when element leaves viewport with triggerOnce=false', () => {
    render(<TestComponent triggerOnce={false} />);
    const target = screen.getByTestId('target');

    // Enter viewport
    act(() => {
      if (intersectionCallback) {
        intersectionCallback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    });
    expect(screen.getByTestId('target')).toHaveAttribute('data-visible', 'true');

    // Leave viewport
    act(() => {
      if (intersectionCallback) {
        intersectionCallback(
          [{ isIntersecting: false, target } as IntersectionObserverEntry],
          {} as IntersectionObserver
        );
      }
    });
    expect(screen.getByTestId('target')).toHaveAttribute('data-visible', 'false');
  });

  it('uses custom threshold', () => {
    render(<TestComponent threshold={0.5} />);
    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ threshold: 0.5 })
    );
  });

  it('uses custom rootMargin', () => {
    render(<TestComponent rootMargin="100px" />);
    expect(IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ rootMargin: '100px' })
    );
  });

  it('disconnects observer on unmount', () => {
    const { unmount } = render(<TestComponent />);
    unmount();
    expect(disconnectMock).toHaveBeenCalled();
  });
});
