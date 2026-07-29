import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Layout from '@/components/Layout';

describe('Layout - Frontend Shell', () => {
  let scrollToSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    Object.defineProperty(window, 'scrollY', { value: 0, writable: true });
  });

  afterEach(() => {
    scrollToSpy.mockRestore();
  });

  it('renders the shell with children', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div data-testid="child-content">Hello</div>
        </Layout>
      </MemoryRouter>
    );
    expect(screen.getByTestId('child-content')).toBeInTheDocument();
  });

  it('renders CloudMarket branding in navbar', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    expect(screen.getByText('CloudMarket')).toBeInTheDocument();
  });

  it('renders all navigation links', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    const texts = links.map(l => l.textContent);
    expect(texts.some(t => t?.includes('Accueil'))).toBe(true);
    expect(texts.some(t => t?.includes('Marketplace'))).toBe(true);
    expect(texts.some(t => t?.includes('Forecasts'))).toBe(true);
    expect(texts.some(t => t?.includes('Admin'))).toBe(true);
  });

  it('has correct hrefs for nav links', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    const home = links.find(l => l.textContent?.includes('Accueil'));
    const marketplace = links.find(l => l.textContent?.includes('Marketplace'));
    const forecasts = links.find(l => l.textContent?.includes('Forecasts'));
    const admin = links.find(l => l.textContent?.includes('Admin'));
    expect(home).toHaveAttribute('href', '/');
    expect(marketplace).toHaveAttribute('href', '/marketplace');
    expect(forecasts).toHaveAttribute('href', '/forecasts');
    expect(admin).toHaveAttribute('href', '/admin');
  });

  it('highlights active route link', () => {
    render(
      <MemoryRouter initialEntries={['/marketplace']}>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    const marketplaceLink = links.find(l => l.textContent?.includes('Marketplace'));
    expect(marketplaceLink?.className).toContain('bg-blue-500/10');
    expect(marketplaceLink?.className).toContain('text-blue-400');
  });

  it('non-active links have muted styling', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link');
    const adminLink = links.find(l => l.textContent?.includes('Admin'));
    expect(adminLink?.className).toContain('text-slate-400');
  });

  it('renders mobile menu button with aria attributes', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const menuBtn = screen.getByRole('button', { name: /ouvrir le menu/i });
    expect(menuBtn).toBeInTheDocument();
    expect(menuBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('toggles mobile menu open and closed', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const menuBtn = screen.getByRole('button', { name: /ouvrir le menu/i });
    await user.click(menuBtn);
    expect(screen.getByRole('button', { name: /fermer le menu/i })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /fermer le menu/i }));
    expect(screen.getByRole('button', { name: /ouvrir le menu/i })).toBeInTheDocument();
  });

  it('closes mobile menu on navigation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const menuBtn = screen.getByRole('button', { name: /ouvrir le menu/i });
    await user.click(menuBtn);
    const links = screen.getAllByRole('link');
    const marketplaceLink = links.find(l => l.textContent?.includes('Marketplace'));
    await user.click(marketplaceLink!);
    expect(screen.queryByRole('button', { name: /fermer le menu/i })).not.toBeInTheDocument();
  });

  it('applies dark theme classes to root wrapper', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const root = container.firstChild as HTMLElement;
    expect(root.classList.contains('min-h-screen')).toBe(true);
    expect(root.classList.contains('bg-slate-950')).toBe(true);
    expect(root.classList.contains('text-slate-50')).toBe(true);
  });

  it('renders footer with branding and stack info', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    expect(screen.getByText(/CloudMarket IaaS/i)).toBeInTheDocument();
    expect(screen.getByText(/React 18 \+ TypeScript \+ Tailwind CSS \+ shadcn\/ui/i)).toBeInTheDocument();
  });

  it('navbar is sticky positioned', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const nav = container.querySelector('nav');
    expect(nav?.classList.contains('sticky')).toBe(true);
    expect(nav?.classList.contains('top-0')).toBe(true);
  });

  it('has high z-index on navbar', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const nav = container.querySelector('nav');
    expect(nav?.classList.contains('z-50')).toBe(true);
  });

  it('scrolls to top on initial mount', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    expect(scrollToSpy).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
  });

  it('mobile menu button has minimum touch target size', () => {
    render(
      <MemoryRouter>
        <Layout><div /></Layout>
      </MemoryRouter>
    );
    const menuBtn = screen.getByRole('button', { name: /ouvrir le menu/i });
    expect(menuBtn.classList.contains('min-h-[44px]')).toBe(true);
    expect(menuBtn.classList.contains('min-w-[44px]')).toBe(true);
  });

  it('main content has max-width container', () => {
    const { container } = render(
      <MemoryRouter>
        <Layout><div data-testid="content" /></Layout>
      </MemoryRouter>
    );
    const main = container.querySelector('main');
    expect(main?.classList.contains('max-w-7xl')).toBe(true);
    expect(main?.classList.contains('mx-auto')).toBe(true);
  });
});
