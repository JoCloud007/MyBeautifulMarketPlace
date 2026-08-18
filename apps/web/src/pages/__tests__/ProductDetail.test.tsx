import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetail from '@/pages/ProductDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseProduct = vi.fn();
const mockUseProducts = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useProduct: (slug: string) => mockUseProduct(slug),
  useProducts: () => mockUseProducts(),
}));

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
    <MemoryRouter initialEntries={['/products/vm']}>
      <QueryClientProvider client={createTestQueryClient()}>
        <Routes>
          <Route path="/products/:slug" element={children} />
        </Routes>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const computeCategory = { id: 'cat-1', name: 'Compute', slug: 'compute', icon: 'Cpu' };
const dataCategory = { id: 'cat-2', name: 'Data', slug: 'data', icon: 'Database' };

const debianOs = { id: 'os-debian', name: 'Debian', slug: 'debian' };
const winOs = { id: 'os-win', name: 'Windows', slug: 'windows' };

const debian12 = { id: 'ver-d12', version: '12 (Bookworm)', osId: debianOs.id, phase: 'RELEASED', releaseDate: '2023-06-10T00:00:00Z', eolDate: '2030-06-10T00:00:00Z' };
const win2022 = { id: 'ver-w22', version: 'Server 2022', osId: winOs.id, phase: 'NORMAL_SUPPORT', releaseDate: '2021-08-18T00:00:00Z', eolDate: '2033-10-14T00:00:00Z' };

const flavorSmall = { id: 'fl-sm', name: 'Small', vcpu: 2, ramGb: 4 };
const flavorLarge = { id: 'fl-lg', name: 'Large', vcpu: 8, ramGb: 16 };

const parisAz = { id: 'az-par', code: 'eu-west-par1', name: 'Paris AZ1', city: 'Paris', country: 'France', region: 'eu-west' };

const clModerate = { id: 'cl-mod', name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60, color: 'yellow' };

const computeProduct = {
  id: 'prod-vm',
  name: 'Virtual Machine',
  slug: 'vm',
  description: 'A compute product',
  category: computeCategory,
  computeType: 'VIRTUAL',
  os: 'Linux',
  documentation: '# Docs\n\nSome docs',
  roadmap: '# Roadmap\n\nSome roadmap',
  isActive: true,
  variants: [
    {
      id: 'var-1',
      name: 'Debian 12 - Small',
      osId: debianOs.id,
      os: debianOs,
      osVersionId: debian12.id,
      osVersion: debian12,
      flavorId: flavorSmall.id,
      flavor: flavorSmall,
      availabilityZones: [{ availabilityZone: parisAz }],
      continuityLevel: clModerate,
      isActive: true,
    },
    {
      id: 'var-2',
      name: 'Windows Server 2022 - Large',
      osId: winOs.id,
      os: winOs,
      osVersionId: win2022.id,
      osVersion: win2022,
      flavorId: flavorLarge.id,
      flavor: flavorLarge,
      availabilityZones: [{ availabilityZone: parisAz }],
      continuityLevel: clModerate,
      isActive: true,
    },
  ],
  dependencies: [],
  dependentProducts: [],
  upgradeFrom: [],
  upgradeTo: [],
  _count: { variants: 2, instances: 1 },
};

const nonComputeProduct = {
  id: 'prod-storage',
  name: 'Object Storage',
  slug: 'object-storage',
  description: 'A storage product',
  category: dataCategory,
  computeType: null,
  os: null,
  documentation: '# Storage Docs',
  roadmap: '# Storage Roadmap',
  isActive: true,
  variants: [],
  dependencies: [],
  dependentProducts: [],
  upgradeFrom: [],
  upgradeTo: [],
  _count: { variants: 0, instances: 0 },
};

const relatedProducts = [computeProduct, nonComputeProduct];

function setLoadingState() {
  mockUseProduct.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseProducts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
}

function setErrorState() {
  mockUseProduct.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  mockUseProducts.mockReturnValue({ data: [], isLoading: false, isError: false });
}

function setComputeState() {
  mockUseProduct.mockReturnValue({ data: computeProduct, isLoading: false, isError: false });
  mockUseProducts.mockReturnValue({ data: relatedProducts, isLoading: false, isError: false });
}

function setNonComputeState() {
  mockUseProduct.mockReturnValue({ data: nonComputeProduct, isLoading: false, isError: false });
  mockUseProducts.mockReturnValue({ data: relatedProducts, isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ProductDetail — Prisma Schema Refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('renders skeleton while loading', () => {
      setLoadingState();
      const { container } = render(<ProductDetail />, { wrapper: Wrapper });
      expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows QueryError on failure', () => {
      setErrorState();
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load this product/i)).toBeInTheDocument();
    });
  });

  describe('Compute Product Detail', () => {
    beforeEach(() => setComputeState());

    it('renders product name and category', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      expect(screen.getAllByText('Compute').length).toBeGreaterThanOrEqual(1);
    });

    it('shows computeType badge for Compute products', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('VIRTUAL')).toBeInTheDocument();
    });

    it('shows the Variants tab for Compute products', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Variants')).toBeInTheDocument();
    });

    it('displays variant filter controls (OS, Version, Flavor)', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(3);
    });

    it('shows variant count in info card', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('2 variants')).toBeInTheDocument();
    });

    it('displays variant cards with OS and flavor info', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Debian 12 - Small')).toBeInTheDocument();
      expect(screen.getByText('Windows Server 2022 - Large')).toBeInTheDocument();
    });

    it('shows availability zones for variants', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('eu-west-par1')).toBeInTheDocument();
    });

    it('shows Type info card with computeType value', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Type')).toBeInTheDocument();
      expect(screen.getAllByText('VIRTUAL').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Non-Compute Product Detail', () => {
    beforeEach(() => setNonComputeState());

    it('renders product name without computeType badge', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Object Storage')).toBeInTheDocument();
      expect(screen.queryByText('PHYSICAL')).not.toBeInTheDocument();
      expect(screen.queryByText('VIRTUAL')).not.toBeInTheDocument();
    });

    it('does NOT show the Variants tab for non-Compute products', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.queryByText('Variants')).not.toBeInTheDocument();
    });

    it('shows default tab as Overview for non-Compute', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    it('shows "Standard" configurations text instead of variants', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Standard')).toBeInTheDocument();
    });

    it('renders documentation tab content', () => {
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Documentation')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles Compute product with no variants gracefully', () => {
      const noVariantProduct = { ...computeProduct, variants: [], _count: { variants: 0, instances: 0 } };
      mockUseProduct.mockReturnValue({ data: noVariantProduct, isLoading: false, isError: false });
      mockUseProducts.mockReturnValue({ data: relatedProducts, isLoading: false, isError: false });
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('0 variants')).toBeInTheDocument();
    });

    it('handles product without documentation', () => {
      const noDocs = { ...nonComputeProduct, documentation: null };
      mockUseProduct.mockReturnValue({ data: noDocs, isLoading: false, isError: false });
      mockUseProducts.mockReturnValue({ data: relatedProducts, isLoading: false, isError: false });
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Object Storage')).toBeInTheDocument();
    });

    it('shows computeType as dash when null on Compute product', () => {
      const noType = { ...computeProduct, computeType: null };
      mockUseProduct.mockReturnValue({ data: noType, isLoading: false, isError: false });
      mockUseProducts.mockReturnValue({ data: relatedProducts, isLoading: false, isError: false });
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });
});
