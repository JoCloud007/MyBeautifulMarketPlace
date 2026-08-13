import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NotFound from '@/pages/NotFound';

describe('NotFound', () => {
  it('renders 404 heading', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText('404')).toBeInTheDocument();
  });

  it('renders page not found message', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText(/page not found/i)).toBeInTheDocument();
  });

  it('renders description text', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(screen.getByText(/the page you are looking for does not exist/i)).toBeInTheDocument();
  });

  it('has link to home page', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const homeLink = screen.getByRole('link', { name: /back to home/i });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('has link to marketplace', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const marketplaceLink = screen.getByRole('link', { name: /explore catalog/i });
    expect(marketplaceLink).toHaveAttribute('href', '/marketplace');
  });

  it('has fade-in-up animation', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('animate-fade-in-up')).toBe(true);
  });

  it('has pulse-soft animation on icon', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container.querySelector('.animate-pulse-soft')).toBeInTheDocument();
  });

  it('is responsive (has sm: breakpoints)', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('py-16')).toBe(true);
    expect(wrapper.classList.contains('sm:py-24')).toBe(true);
  });

  it('has responsive heading size', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const heading = screen.getByText('404');
    expect(heading.classList.contains('text-5xl')).toBe(true);
    expect(heading.classList.contains('sm:text-6xl')).toBe(true);
  });

  it('has responsive button layout', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const btnContainer = container.querySelector('.flex.flex-col.sm\\:flex-row');
    expect(btnContainer).toBeInTheDocument();
  });

  it('buttons have min touch target size', () => {
    render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      expect(btn.classList.contains('min-h-[44px]')).toBe(true);
    });
  });

  it('has dark theme icon container', () => {
    const { container } = render(
      <MemoryRouter>
        <NotFound />
      </MemoryRouter>
    );
    expect(container.querySelector('.bg-slate-900')).toBeInTheDocument();
    expect(container.querySelector('.border-slate-800')).toBeInTheDocument();
  });
});
