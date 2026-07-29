import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QueryError from '@/components/QueryError';

describe('QueryError', () => {
  it('renders default error message', () => {
    render(<QueryError />);
    expect(screen.getByText(/erreur de chargement/i)).toBeInTheDocument();
    expect(screen.getByText(/impossible de charger les données/i)).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<QueryError message="Custom error message" />);
    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('displays error icon', () => {
    const { container } = render(<QueryError />);
    expect(container.querySelector('.text-red-500')).toBeInTheDocument();
  });

  it('does not show retry button when onRetry is not provided', () => {
    render(<QueryError />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<QueryError onRetry={onRetry} />);
    expect(screen.getByRole('button', { name: /réessayer/i })).toBeInTheDocument();
  });

  it('calls onRetry when retry button clicked', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();
    render(<QueryError onRetry={onRetry} />);

    const retryBtn = screen.getByRole('button', { name: /réessayer/i });
    await user.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('has dark theme styling', () => {
    const { container } = render(<QueryError />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('bg-slate-900/50')).toBe(true);
    expect(wrapper.classList.contains('border-slate-800')).toBe(true);
  });

  it('has rounded corners', () => {
    const { container } = render(<QueryError />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('rounded-xl')).toBe(true);
  });

  it('has fade-in animation class', () => {
    const { container } = render(<QueryError />);
    expect(container.querySelector('.animate-fade-in')).toBeInTheDocument();
  });

  it('is centered with flex layout', () => {
    const { container } = render(<QueryError />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('flex')).toBe(true);
    expect(wrapper.classList.contains('items-center')).toBe(true);
    expect(wrapper.classList.contains('justify-center')).toBe(true);
  });

  it('retry button has outline style', async () => {
    const onRetry = vi.fn();
    render(<QueryError onRetry={onRetry} />);
    const retryBtn = screen.getByRole('button', { name: /réessayer/i });
    expect(retryBtn.classList.contains('border-slate-700')).toBe(true);
  });
});
