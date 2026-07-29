import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Skeleton } from '@/components/ui/skeleton';

describe('Skeleton', () => {
  it('renders a div element', () => {
    const { container } = render(<Skeleton />);
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('has animate-pulse class', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains('animate-pulse')).toBe(true);
  });

  it('has rounded-md class', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains('rounded-md')).toBe(true);
  });

  it('has bg-muted class', () => {
    const { container } = render(<Skeleton />);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains('bg-muted')).toBe(true);
  });

  it('merges custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-32" />);
    const div = container.firstChild as HTMLElement;
    expect(div.classList.contains('h-4')).toBe(true);
    expect(div.classList.contains('w-32')).toBe(true);
    expect(div.classList.contains('animate-pulse')).toBe(true);
  });

  it('forwards additional props', () => {
    const { container } = render(<Skeleton data-testid="skeleton-test" aria-label="Loading" />);
    const div = container.firstChild as HTMLElement;
    expect(div).toHaveAttribute('data-testid', 'skeleton-test');
    expect(div).toHaveAttribute('aria-label', 'Loading');
  });

  it('renders children if provided', () => {
    const { getByText } = render(<Skeleton>Loading content</Skeleton>);
    expect(getByText('Loading content')).toBeInTheDocument();
  });
});
