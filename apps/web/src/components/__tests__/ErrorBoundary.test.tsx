import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import ErrorBoundary from '@/components/ErrorBoundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test crash');
  }
  return <div data-testid="safe-content">Safe content</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByTestId('safe-content')).toBeInTheDocument();
    expect(screen.queryByText(/error has occurred/i)).not.toBeInTheDocument();
  });

  it('renders fallback UI when child throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    expect(screen.getByText(/an error has occurred/i)).toBeInTheDocument();
    expect(screen.queryByTestId('safe-content')).not.toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('displays the error message in a pre block', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    const pre = screen.getByText('Test crash');
    expect(pre.tagName).toBe('PRE');
    consoleSpy.mockRestore();
  });

  it('has refresh button that reloads the page', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const reloadSpy = vi.fn();
    Object.defineProperty(window, 'location', {
      value: { reload: reloadSpy },
      writable: true,
    });
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );

    const refreshBtn = screen.getByRole('button', { name: /refresh/i });
    expect(refreshBtn).toBeInTheDocument();
    await user.click(refreshBtn);
    expect(reloadSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('has home link button', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    const homeBtn = screen.getByRole('link', { name: /accueil/i });
    expect(homeBtn).toBeInTheDocument();
    expect(homeBtn).toHaveAttribute('href', '/');
    consoleSpy.mockRestore();
  });

  it('uses dark theme styling in fallback UI', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    const fallback = container.querySelector('.min-h-\\[60vh\\]');
    expect(fallback).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it('has red-themed error icon container', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { container } = render(
      <MemoryRouter>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </MemoryRouter>
    );
    const iconContainer = container.querySelector('.bg-red-500\\/10');
    expect(iconContainer).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
