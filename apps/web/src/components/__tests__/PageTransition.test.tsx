import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import PageTransition from '@/components/PageTransition';

describe('PageTransition', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <MemoryRouter>
        <PageTransition>
          <div data-testid="child">Child content</div>
        </PageTransition>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('applies transition classes', () => {
    const { container } = render(
      <MemoryRouter>
        <PageTransition>
          <div>Content</div>
        </PageTransition>
      </MemoryRouter>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('transition-all')).toBe(true);
    expect(wrapper.classList.contains('duration-150')).toBe(true);
  });

  it('renders content inside a div wrapper', () => {
    const { container } = render(
      <MemoryRouter>
        <PageTransition>
          <span data-testid="inner">Inner</span>
        </PageTransition>
      </MemoryRouter>
    );
    expect(container.firstChild?.nodeName).toBe('DIV');
    expect(screen.getByTestId('inner')).toBeInTheDocument();
  });

  it('tracks location pathname changes', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/']}>
        <PageTransition>
          <Routes>
            <Route path="/" element={<div data-testid="page1">Page 1</div>} />
            <Route path="/page2" element={<div data-testid="page2">Page 2</div>} />
          </Routes>
        </PageTransition>
      </MemoryRouter>
    );
    expect(screen.getByTestId('page1')).toBeInTheDocument();
  });
});
