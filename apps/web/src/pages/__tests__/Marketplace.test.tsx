import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Marketplace from '@/pages/Marketplace';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockSetFilters = vi.fn();
const mockRemoveFilter = vi.fn();
const mockClearFilters = vi.fn();
const mockSetSortBy = vi.fn();

const mockUseAppStore = vi.fn(() => ({
  filters: {},
  sortBy: 'newest',
  setFilters: mockSetFilters,
  removeFilter: mockRemoveFilter,
  clearFilters: mockClearFilters,
  setSortBy: mockSetSortBy,
}));

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: () => mockUseAppStore(),
}));

vi.mock('@/hooks/useScrollReveal', () => ({
  useScrollReveal: () => ({ ref: { current: null }, isVisible: true }),
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <MemoryRouter>
      {children}
    </MemoryRouter>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const categories = [
  { id: 'cat-1', name: 'Compute', slug: 'compute', icon: 'Cpu', _count: { products: 2 } },
  { id: 'cat-2', name: 'Data', slug: 'data', icon: 'Database', _count: { products: 1 } },
];

const products = [
  {
    id: 'prod-1',
    name: 'Virtual Machine',
    slug: 'virtual-machine',
    description: 'Configurable VM',
    category: categories[0],
    computeType: 'VIRTUAL',
    variants: [{ id: 'v1' }, { id: 'v2' }],
    dependencies: [],
    createdAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 'prod-2',
    name: 'Bare Metal HPC',
    slug: 'bare-metal-hpc',
    description: 'Dedicated servers',
    category: categories[0],
    computeType: 'PHYSICAL',
    variants: [{ id: 'v3' }],
    dependencies: [],
    createdAt: '2024-02-20T00:00:00Z',
  },
  {
    id: 'prod-3',
    name: 'Object Storage',
    slug: 'object-storage',
    description: 'S3-compatible storage',
    category: categories[1],
    computeType: null,
    variants: [],
    dependencies: [{ id: 'd1' }],
    createdAt: '2024-03-10T00:00:00Z',
  },
];

// Helper to mock global fetch
function mockFetch(responseMap: Record<string, any>) {
  global.fetch = vi.fn((url: string) => {
    for (const [key, value] of Object.entries(responseMap)) {
      if (url.includes(key)) {
        return Promise.resolve({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { get: (h: string) => h === 'content-type' ? 'application/json' : null },
          json: () => Promise.resolve(value),
          text: () => Promise.resolve(JSON.stringify(value)),
        } as unknown as Response);
      }
    }
    return Promise.resolve({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: { get: (h: string) => h === 'content-type' ? 'application/json' : null },
      json: () => Promise.resolve({ error: 'Not found' }),
      text: () => Promise.resolve('Not found'),
    } as unknown as Response);
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Marketplace — Prisma Schema Refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAppStore.mockReturnValue({
      filters: {},
      sortBy: 'newest',
      setFilters: mockSetFilters,
      removeFilter: mockRemoveFilter,
      clearFilters: mockClearFilters,
      setSortBy: mockSetSortBy,
    });
  });

  describe('Loading State', () => {
    it('renders skeleton loaders while fetching', async () => {
      let resolveResponse: (v: any) => void;
      const responsePromise = new Promise<Response>((r) => { resolveResponse = r; });
      global.fetch = vi.fn(() => responsePromise as any);

      const { container } = render(<Marketplace />, { wrapper: Wrapper });
      expect(container.querySelectorAll('.animate-pulse-soft').length).toBeGreaterThan(0);
      resolveResponse!({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { get: (h: string) => h === 'content-type' ? 'application/json' : null },
        json: () => Promise.resolve(products),
        text: () => Promise.resolve(JSON.stringify(products)),
      } as unknown as Response);
    });
  });

  describe('Catalog Display', () => {
    beforeEach(() => {
      mockFetch({ '/api/products': products, '/api/categories': categories });
    });

    it('renders all product cards', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });
      expect(screen.getByText('Bare Metal HPC')).toBeInTheDocument();
      expect(screen.getByText('Object Storage')).toBeInTheDocument();
    });

    it('shows category badges on products', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Compute')).toBeInTheDocument();
      });
      expect(screen.getAllByText('Compute').length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText('Data')).toBeInTheDocument();
    });

    it('shows computeType badges only for Compute products', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('VIRTUAL')).toBeInTheDocument();
      });
      expect(screen.getByText('PHYSICAL')).toBeInTheDocument();
      expect(screen.queryAllByText('null').length).toBe(0);
    });

    it('shows variant counts for Compute products', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/2 variants/)).toBeInTheDocument();
      });
      expect(screen.getByText(/1 variant/)).toBeInTheDocument();
    });

    it('shows dependency counts when present', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/1 dependency/)).toBeInTheDocument();
      });
    });

    it('displays product count summary', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/3\s*products?\s*found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Group by Category Toggle', () => {
    beforeEach(() => {
      mockFetch({ '/api/products': products, '/api/categories': categories });
    });

    it('toggles group by category mode', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });

      const toggleBtn = screen.getByRole('button', { name: /group by category/i });
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /compute/i })).toBeInTheDocument();
      });
      expect(screen.getByRole('heading', { name: /data/i })).toBeInTheDocument();
    });

    it('shows category product counts in grouped mode', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });

      const toggleBtn = screen.getByRole('button', { name: /group by category/i });
      fireEvent.click(toggleBtn);

      await waitFor(() => {
        const computeHeading = screen.getByRole('heading', { name: /compute/i });
        expect(computeHeading?.parentElement?.textContent).toContain('2');
      });
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      mockFetch({ '/api/products': products, '/api/categories': categories });
    });

    it('filters by computeType via dropdown', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('All Types');
      fireEvent.change(select, { target: { value: 'VIRTUAL' } });
      expect(mockSetFilters).toHaveBeenCalledWith({ computeType: 'VIRTUAL' });
    });

    it('filters by search term', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search for a product/i);
      fireEvent.change(input, { target: { value: 'storage' } });
      expect(mockSetFilters).toHaveBeenCalledWith({ search: 'storage' });
    });

    it('filters by category via pill buttons', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });

      const computePill = screen.getByRole('button', { name: /compute/i });
      fireEvent.click(computePill);
      expect(mockSetFilters).toHaveBeenCalledWith({ category: 'compute' });
    });

    it('shows reset button when filters active', async () => {
      mockUseAppStore.mockReturnValue({
        filters: { search: 'vm' },
        sortBy: 'newest',
        setFilters: mockSetFilters,
        removeFilter: mockRemoveFilter,
        clearFilters: mockClearFilters,
        setSortBy: mockSetSortBy,
      });
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
      });
    });
  });

  describe('Sorting', () => {
    beforeEach(() => {
      mockFetch({ '/api/products': products, '/api/categories': categories });
    });

    it('changes sort order via dropdown', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      });

      const select = screen.getByDisplayValue('Newest');
      fireEvent.change(select, { target: { value: 'name' } });
      expect(mockSetSortBy).toHaveBeenCalledWith('name');
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      mockFetch({ '/api/products': [], '/api/categories': categories });
    });

    it('shows empty message when no products', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/no products found/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          headers: { get: () => 'application/json' },
          text: () => Promise.resolve('Internal error'),
        } as Response)
      );
    });

    it('shows error message on fetch failure', async () => {
      render(<Marketplace />, { wrapper: Wrapper });
      await waitFor(() => {
        expect(screen.getByText(/unable to load catalog/i)).toBeInTheDocument();
      });
    });
  });
});
