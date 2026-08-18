import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProductDetail from '@/pages/ProductDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseProduct = vi.fn();
const mockUseProducts = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useProduct: (slug: string) => mockUseProduct(slug),
  useProducts: (filters?: any) => mockUseProducts(filters),
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
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={['/products/compute-iaas']}>
        <Routes>
          <Route path="/products/:slug" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const computeCategory = {
  id: 'cat-1',
  name: 'Compute',
  slug: 'compute',
  description: null,
  icon: 'Cpu',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const storageCategory = {
  id: 'cat-2',
  name: 'Storage',
  slug: 'storage',
  description: null,
  icon: 'Database',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const flavors = [
  { id: 'fl-1', name: 'Small', vcpu: 2, ramGb: 4, description: '2 vCPU, 4 GB RAM', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
  { id: 'fl-2', name: 'Medium', vcpu: 4, ramGb: 8, description: '4 vCPU, 8 GB RAM', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' },
];

const osWindows = { id: 'os-1', family: 'WINDOWS', name: 'Windows', slug: 'windows', isActive: true, versions: [], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' };
const osDebian = { id: 'os-2', family: 'DEBIAN', name: 'Debian', slug: 'debian', isActive: true, versions: [], createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' };

const ws2022 = {
  id: 'ver-1',
  osId: 'os-1',
  os: osWindows,
  version: 'Windows Server 2022',
  releaseDate: '2021-08-18',
  normalSupportEnd: '2026-10-13',
  extendedSupportEnd: '2031-10-14',
  eolDate: '2031-10-14',
  phase: 'NORMAL_SUPPORT' as const,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const debian12 = {
  id: 'ver-2',
  osId: 'os-2',
  os: osDebian,
  version: 'Debian 12 (Bookworm)',
  releaseDate: '2023-06-10',
  normalSupportEnd: '2026-06-10',
  extendedSupportEnd: '2028-06-10',
  eolDate: '2028-06-10',
  phase: 'RELEASED' as const,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const variants = [
  {
    id: 'var-1',
    productId: 'prod-1',
    product: null as any,
    name: 'Windows Server 2022 - Small',
    osId: 'os-1',
    os: osWindows,
    osVersionId: 'ver-1',
    osVersion: ws2022,
    flavorId: 'fl-1',
    flavor: flavors[0],
    availabilityZones: [
      {
        id: 'az-1',
        availabilityZoneId: 'az-1',
        availabilityZone: {
          id: 'az-1',
          code: 'eu-west-1a',
          name: 'Ireland',
          city: 'Dublin',
          country: 'IE',
          region: 'eu-west-1',
          latitude: 53.3,
          longitude: -6.2,
          isActive: true,
          createdAt: '2024-01-01T00:00:00Z',
          updatedAt: '2024-01-01T00:00:00Z',
        },
        variantId: 'var-1',
        variant: null as any,
        createdAt: '2024-01-01T00:00:00Z',
      },
    ],
    continuityLevelId: null,
    continuityLevel: null,
    instances: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'var-2',
    productId: 'prod-1',
    product: null as any,
    name: 'Debian 12 - Medium',
    osId: 'os-2',
    os: osDebian,
    osVersionId: 'ver-2',
    osVersion: debian12,
    flavorId: 'fl-2',
    flavor: flavors[1],
    availabilityZones: [],
    continuityLevelId: null,
    continuityLevel: null,
    instances: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const computeProduct: any = {
  id: 'prod-1',
  name: 'Compute IaaS',
  slug: 'compute-iaas',
  description: 'Infra as a Service',
  category: computeCategory,
  computeType: 'VIRTUAL',
  variants,
  dependencies: [],
  dependentProducts: [],
  upgradeFrom: [],
  upgradeTo: [],
  documentation: '## Docs\n\nSome docs.',
  roadmap: null,
  os: null,
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const storageProduct: any = {
  id: 'prod-3',
  name: 'Object Storage',
  slug: 'object-storage',
  description: 'S3-like storage',
  category: storageCategory,
  computeType: null,
  variants: [],
  dependencies: [],
  dependentProducts: [],
  upgradeFrom: [],
  upgradeTo: [],
  documentation: null,
  roadmap: '## Roadmap\n\n- Feature A',
  os: 'Linux',
  isActive: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const relatedProducts = [
  {
    id: 'prod-4',
    name: 'Block Storage',
    slug: 'block-storage',
    description: 'Fast block storage',
    category: storageCategory,
    computeType: null,
    variants: [],
    dependencies: [],
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

function setLoadingState() {
  mockUseProduct.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
  mockUseProducts.mockReturnValue({ data: undefined, isLoading: false, isError: false });
}

function setErrorState() {
  mockUseProduct.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
  mockUseProducts.mockReturnValue({ data: undefined, isLoading: false, isError: false });
}

function setProductState(product: any) {
  mockUseProduct.mockReturnValue({ data: product, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseProducts.mockReturnValue({ data: relatedProducts, isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ProductDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading & Error States', () => {
    it('renders skeleton loaders while loading', () => {
      setLoadingState();
      const { container } = render(<ProductDetail />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when loading fails', () => {
      setErrorState();
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText(/Unable to load this product/i)).toBeInTheDocument();
    });

    it('shows product not found when data is null', () => {
      mockUseProduct.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() });
      mockUseProducts.mockReturnValue({ data: [], isLoading: false, isError: false });
      render(<ProductDetail />, { wrapper: Wrapper });
      expect(screen.getByText('Product not found')).toBeInTheDocument();
    });
  });

  describe('Non-Compute Product', () => {
    it('renders overview without variants tab', async () => {
      setProductState(storageProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Object Storage')).toBeInTheDocument());

      expect(screen.queryByText('Variants')).not.toBeInTheDocument();
      expect(screen.getAllByText('Linux').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Overview')).toBeInTheDocument();
    });

    it('shows roadmap content when available', async () => {
      setProductState(storageProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Object Storage')).toBeInTheDocument());

      const roadmapTab = screen.getAllByText('Roadmap').find((el) => el.tagName === 'BUTTON');
      expect(roadmapTab).toBeDefined();
      await userEvent.click(roadmapTab!);

      await waitFor(() => {
        expect(screen.getByText('Feature A')).toBeInTheDocument();
      });
    });

    it('shows empty documentation state when missing', async () => {
      setProductState(storageProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Object Storage')).toBeInTheDocument());

      const docTab = screen.getAllByText('Documentation').find((el) => el.tagName === 'BUTTON');
      expect(docTab).toBeDefined();
      await userEvent.click(docTab!);

      await waitFor(() => {
        expect(screen.getByText('No documentation available for this product.')).toBeInTheDocument();
      });
    });
  });

  describe('Compute Product', () => {
    it('renders variants tab and metadata cards', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const variantsTab = screen.getAllByText('Variants').find((el) => el.tagName === 'BUTTON');
      expect(variantsTab).toBeInTheDocument();
      expect(screen.getByText('2 configurations')).toBeInTheDocument();
      expect(screen.getByText('VIRTUAL')).toBeInTheDocument();
    });

    it('shows flavor spec bars in overview', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      expect(screen.getByText('Available flavors')).toBeInTheDocument();
      expect(screen.getByText('Small')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
    });

    it('switches to variants tab and lists all variants', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const variantsTab = screen.getAllByText('Variants').find((el) => el.tagName === 'BUTTON');
      expect(variantsTab).toBeDefined();
      await userEvent.click(variantsTab!);

      await waitFor(() => {
        expect(screen.getByText('Windows Server 2022 - Small')).toBeInTheDocument();
        expect(screen.getByText('Debian 12 - Medium')).toBeInTheDocument();
      });
    });

    it('filters variants by OS select', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const variantsTab = screen.getAllByText('Variants').find((el) => el.tagName === 'BUTTON');
      await userEvent.click(variantsTab!);

      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(1);

      fireEvent.change(selects[0], { target: { value: 'os-1' } });

      await waitFor(() => {
        expect(screen.getByText('Windows Server 2022 - Small')).toBeInTheDocument();
        expect(screen.queryByText('Debian 12 - Medium')).not.toBeInTheDocument();
      });
    });

    it('selects a variant and shows detail card', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const variantsTab = screen.getAllByText('Variants').find((el) => el.tagName === 'BUTTON');
      await userEvent.click(variantsTab!);

      await userEvent.click(screen.getByText('Windows Server 2022 - Small'));

      await waitFor(() => {
        expect(screen.getByText(/Request this variant/i)).toBeInTheDocument();
        expect(screen.getAllByText('eu-west-1a').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows empty state when compute product has no variants', async () => {
      const noVariantProduct = { ...computeProduct, variants: [] };
      setProductState(noVariantProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const variantsTab = screen.getAllByText('Variants').find((el) => el.tagName === 'BUTTON');
      await userEvent.click(variantsTab!);

      await waitFor(() => {
        expect(screen.getByText(/No variants match the selected filters/i)).toBeInTheDocument();
      });
    });

    it('shows documentation tab with markdown content', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const docTab = screen.getAllByText('Documentation').find((el) => el.tagName === 'BUTTON');
      expect(docTab).toBeDefined();
      await userEvent.click(docTab!);

      await waitFor(() => {
        expect(screen.getByText('Some docs.')).toBeInTheDocument();
      });
    });

    it('shows dependencies tab with empty state', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const depTab = screen.getAllByText('Dependencies').find((el) => el.tagName === 'BUTTON');
      expect(depTab).toBeDefined();
      await userEvent.click(depTab!);

      await waitFor(() => {
        expect(screen.getByText('No dependencies declared for this product.')).toBeInTheDocument();
      });
    });

    it('shows upgrade paths tab with empty state', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      const upTab = screen.getAllByText('Upgrade Paths').find((el) => el.tagName === 'BUTTON');
      expect(upTab).toBeDefined();
      await userEvent.click(upTab!);

      await waitFor(() => {
        expect(screen.getByText('No upgrade paths declared for this product.')).toBeInTheDocument();
      });
    });

    it('renders related products section', async () => {
      setProductState(computeProduct);
      render(<ProductDetail />, { wrapper: Wrapper });
      await waitFor(() => expect(screen.getByText('Compute IaaS')).toBeInTheDocument());

      await waitFor(() => {
        expect(screen.getByText('Similar products')).toBeInTheDocument();
        expect(screen.getByText('Block Storage')).toBeInTheDocument();
      });
    });
  });
});
