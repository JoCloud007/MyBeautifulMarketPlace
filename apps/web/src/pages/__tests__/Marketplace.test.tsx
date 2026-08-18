import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Marketplace from '@/pages/Marketplace';
import { useAppStore } from '@/stores/useAppStore';

// ─── Mocks ────────────────────────────────────────────────────────────────

vi.mock('@/hooks/useScrollReveal', () => ({
  useScrollReveal: () => ({ ref: { current: null }, isVisible: true }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      <QueryClientProvider client={createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const categories = [
  { id: 'cat-1', name: 'Compute', slug: 'compute', description: null, icon: 'Cpu', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'cat-2', name: 'Storage', slug: 'storage', description: null, icon: 'Database', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const products = [
  {
    id: 'prod-1',
    name: 'Compute IaaS',
    slug: 'compute-iaas',
    description: 'Infra as a Service',
    category: categories[0],
    computeType: 'VIRTUAL',
    variants: [{ id: 'v1' }, { id: 'v2' }],
    dependencies: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'prod-2',
    name: 'Bare Metal',
    slug: 'bare-metal',
    description: 'Physical servers',
    category: categories[0],
    computeType: 'PHYSICAL',
    variants: [],
    dependencies: [],
    isActive: true,
    createdAt: '2024-02-01T00:00:00Z',
  },
  {
    id: 'prod-3',
    name: 'Object Storage',
    slug: 'object-storage',
    description: 'S3-like storage',
    category: categories[1],
    computeType: null,
    variants: [],
    os: 'Linux',
    dependencies: [],
    isActive: true,
    createdAt: '2024-03-01T00:00:00Z',
  },
];

function jsonResponse(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
  } as Response);
}

function errorResponse(status = 500) {
  return Promise.resolve({
    ok: false,
    status,
    statusText: 'Internal Server Error',
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: { get: () => '' },
  } as Response);
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Marketplace Page', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    useAppStore.setState({ filters: {}, sortBy: 'newest', viewMode: 'flat' });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setupFetch(loadProducts = products, loadCategories = categories) {
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/products')) return jsonResponse(loadProducts);
      if (url.includes('/api/categories')) {
        const cats = loadCategories.map((c: any) => ({
          ...c,
          _count: { products: loadProducts.filter((p: any) => p.category?.slug === c.slug).length },
        }));
        return jsonResponse(cats);
      }
      return Promise.reject(new Error('Unknown URL: ' + url));
    });
  }

  describe('Initial Render', () => {
    it('renders header and search controls', () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      expect(screen.getByText('Marketplace')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Search for a product/i)).toBeInTheDocument();
    });

    it('shows skeleton loaders while loading', () => {
      mockFetch.mockReturnValue(new Promise(() => {}));
      const { container } = render(<Marketplace />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when fetch fails', async () => {
      mockFetch.mockReturnValue(errorResponse());
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText(/Unable to load catalog/i)).toBeInTheDocument());
    });
  });

  describe('Product Cards', () => {
    it('renders all product cards in flat view', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());
      expect(screen.getByText('Bare Metal')).toBeInTheDocument();
      expect(screen.getByText('Object Storage')).toBeInTheDocument();
    });

    it('shows computeType badge and variants count for compute products', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());
      expect(screen.getByText('VIRTUAL')).toBeInTheDocument();
      expect(screen.getByText('2 variants')).toBeInTheDocument();
    });

    it('shows OS badge for non-compute products', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Object Storage')).toBeInTheDocument());
      expect(screen.getAllByText('Linux').length).toBeGreaterThanOrEqual(1);
    });

    it('links each card to the correct product detail page', async () => {
      setupFetch();
      const { container } = render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());
      expect(container.querySelector('a[href="/products/compute-iaas"]')).toBeInTheDocument();
      expect(container.querySelector('a[href="/products/object-storage"]')).toBeInTheDocument();
    });
  });

  describe('Filtering & Sorting', () => {
    it('filters products by search query', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const input = screen.getByPlaceholderText(/Search for a product/i);
      await userEvent.type(input, 'Storage');

      await waitFor(() => {
        expect(screen.queryByText('Object Storage')).toBeInTheDocument();
        expect(screen.queryByText('Compute IaaS')).not.toBeInTheDocument();
      });
    });

    it('filters products by category pill click', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const computePill = screen.getAllByText('Compute').find((el) => el.tagName === 'BUTTON')!;
      await userEvent.click(computePill);

      await waitFor(() => {
        expect(screen.queryByText('Compute IaaS')).toBeInTheDocument();
        expect(screen.queryByText('Object Storage')).not.toBeInTheDocument();
      });
    });

    it('sorts products by name', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const sortSelect = screen.getByDisplayValue('Newest');
      fireEvent.change(sortSelect, { target: { value: 'name' } });

      await waitFor(() => {
        const links = screen.getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/products/'));
        expect(links[0].textContent).toContain('Bare Metal');
        expect(links[1].textContent).toContain('Compute IaaS');
        expect(links[2].textContent).toContain('Object Storage');
      });
    });

    it('shows empty state when search yields no results', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const input = screen.getByPlaceholderText(/Search for a product/i);
      await userEvent.type(input, 'xyz-nonexistent');

      await waitFor(() => expect(screen.getByText('No products found')).toBeInTheDocument());
    });

    it('shows active filter chips and allows reset', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const computePill = screen.getAllByText('Compute').find((el) => el.tagName === 'BUTTON')!;
      await userEvent.click(computePill);

      await waitFor(() => expect(screen.getByText('Active filters:')).toBeInTheDocument());

      const resetBtn = screen.getByText('Reset');
      await userEvent.click(resetBtn);

      await waitFor(() => expect(screen.getByText('Object Storage')).toBeInTheDocument());
    });
  });

  describe('View Modes', () => {
    it('renders grouped view with category accordions', async () => {
      useAppStore.setState({ viewMode: 'grouped' });
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      expect(screen.getByText('2 products')).toBeInTheDocument();
      expect(screen.getByText('1 product')).toBeInTheDocument();
      expect(screen.getByText('Compute IaaS')).toBeInTheDocument();
      expect(screen.getByText('Bare Metal')).toBeInTheDocument();
    });

    it('toggles from flat to grouped view via button', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const groupedBtn = screen.getByText('Grouped');
      await userEvent.click(groupedBtn);

      await waitFor(() => {
        expect(screen.getByText('2 products')).toBeInTheDocument();
      });
    });

    it('shows expand/collapse controls in grouped view', async () => {
      useAppStore.setState({ viewMode: 'grouped' });
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      expect(screen.getByText('Expand')).toBeInTheDocument();
      expect(screen.getByText('Collapse')).toBeInTheDocument();
    });
  });

  describe('Category Pills', () => {
    it('displays product counts on category pills', async () => {
      setupFetch();
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const computePill = screen.getAllByText('Compute').find((el) => el.tagName === 'BUTTON');
      expect(computePill?.textContent).toContain('2');
      const storagePill = screen.getAllByText('Storage').find((el) => el.tagName === 'BUTTON');
      expect(storagePill?.textContent).toContain('1');
    });
  });
});
