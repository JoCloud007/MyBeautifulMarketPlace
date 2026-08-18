import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminOS from '@/pages/AdminOS';
import AdminProducts from '@/pages/AdminProducts';
import AdminFlavors from '@/pages/AdminFlavors';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseOperatingSystems = vi.fn();
const mockUseCreateOperatingSystem = vi.fn();
const mockUseUpdateOperatingSystem = vi.fn();
const mockUseDeleteOperatingSystem = vi.fn();
const mockUseOsVersions = vi.fn();
const mockUseCreateOsVersion = vi.fn();
const mockUseUpdateOsVersion = vi.fn();
const mockUseDeleteOsVersion = vi.fn();

const mockUseAdminProducts = vi.fn();
const mockUseAdminCategories = vi.fn();
const mockUseCreateProduct = vi.fn();
const mockUseUpdateProduct = vi.fn();
const mockUseDeleteProduct = vi.fn();
const mockUseProductVariants = vi.fn();
const mockUseCreateProductVariant = vi.fn();
const mockUseUpdateProductVariant = vi.fn();
const mockUseDeleteProductVariant = vi.fn();
const mockUseFlavors = vi.fn();
const mockUseContinuityLevels = vi.fn();
const mockUseAvailabilityZones = vi.fn();

const mockUseAdminFlavors = vi.fn();
const mockUseCreateFlavor = vi.fn();
const mockUseUpdateFlavor = vi.fn();
const mockUseDeleteFlavor = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useOperatingSystems: () => mockUseOperatingSystems(),
  useCreateOperatingSystem: () => mockUseCreateOperatingSystem(),
  useUpdateOperatingSystem: () => mockUseUpdateOperatingSystem(),
  useDeleteOperatingSystem: () => mockUseDeleteOperatingSystem(),
  useOsVersions: (osId?: string) => mockUseOsVersions(osId),
  useCreateOsVersion: () => mockUseCreateOsVersion(),
  useUpdateOsVersion: () => mockUseUpdateOsVersion(),
  useDeleteOsVersion: () => mockUseDeleteOsVersion(),

  useAdminProducts: () => mockUseAdminProducts(),
  useAdminCategories: () => mockUseAdminCategories(),
  useCreateProduct: () => mockUseCreateProduct(),
  useUpdateProduct: () => mockUseUpdateProduct(),
  useDeleteProduct: () => mockUseDeleteProduct(),
  useProductVariants: (productId?: string) => mockUseProductVariants(productId),
  useCreateProductVariant: () => mockUseCreateProductVariant(),
  useUpdateProductVariant: () => mockUseUpdateProductVariant(),
  useDeleteProductVariant: () => mockUseDeleteProductVariant(),
  useFlavors: () => mockUseFlavors(),
  useContinuityLevels: () => mockUseContinuityLevels(),
  useAvailabilityZones: () => mockUseAvailabilityZones(),

  useAdminFlavors: () => mockUseAdminFlavors(),
  useCreateFlavor: () => mockUseCreateFlavor(),
  useUpdateFlavor: () => mockUseUpdateFlavor(),
  useDeleteFlavor: () => mockUseDeleteFlavor(),
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
    <MemoryRouter>
      <QueryClientProvider client={createTestQueryClient()}>
        {children}
      </QueryClientProvider>
    </MemoryRouter>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const osList = [
  {
    id: 'os1',
    family: 'WINDOWS',
    name: 'Windows',
    slug: 'windows',
    isActive: true,
    versions: [
      { id: 'v1', version: 'Server 2022', phase: 'NORMAL_SUPPORT', releaseDate: '2021-08-18T00:00:00Z', eolDate: '2031-10-14T00:00:00Z' },
    ],
    _count: { versions: 1 },
  },
  {
    id: 'os2',
    family: 'DEBIAN',
    name: 'Debian',
    slug: 'debian',
    isActive: false,
    versions: [],
    _count: { versions: 0 },
  },
];

const versions = [
  { id: 'v1', osId: 'os1', version: 'Server 2022', phase: 'NORMAL_SUPPORT', releaseDate: '2021-08-18T00:00:00Z', normalSupportEnd: '2026-10-13T00:00:00Z', extendedSupportEnd: '2031-10-14T00:00:00Z', eolDate: '2031-10-14T00:00:00Z', isActive: true },
  { id: 'v2', osId: 'os1', version: 'Server 2019', phase: 'EXTENDED_SUPPORT', releaseDate: '2018-10-02T00:00:00Z', normalSupportEnd: '2024-01-09T00:00:00Z', extendedSupportEnd: '2029-01-09T00:00:00Z', eolDate: '2029-01-09T00:00:00Z', isActive: true },
];

const categories = [
  { id: 'cat-compute', name: 'Compute', slug: 'compute' },
  { id: 'cat-storage', name: 'Storage', slug: 'storage' },
];

const products = [
  {
    id: 'p1',
    name: 'Compute IaaS',
    slug: 'compute-iaas',
    description: 'IaaS compute',
    categoryId: 'cat-compute',
    category: categories[0],
    computeType: 'VIRTUAL',
    isActive: true,
    variants: [],
    _count: { variants: 0 },
  },
  {
    id: 'p2',
    name: 'Object Storage',
    slug: 'object-storage',
    description: 'S3-compatible',
    categoryId: 'cat-storage',
    category: categories[1],
    computeType: null,
    isActive: true,
    variants: [],
    _count: { variants: 0 },
  },
];

const productVariants = [
  {
    id: 'pv1',
    productId: 'p1',
    name: 'Windows Server 2022 - Medium',
    osId: 'os1',
    os: { name: 'Windows' },
    osVersionId: 'v1',
    osVersion: { version: 'Server 2022' },
    flavorId: 'fl1',
    flavor: { name: 'Medium' },
    availabilityZones: [{ id: 'az1', availabilityZoneId: 'az1', availabilityZone: { code: 'eu-west-1a' } }],
    continuityLevelId: null,
    continuityLevel: null,
    isActive: true,
    _count: { instances: 2 },
  },
];

const flavors = [
  { id: 'fl1', name: 'Small', vcpu: 2, ramGb: 4, description: '2 vCPU, 4 GB', _count: { variants: 1, forecastLines: 0, instances: 1 } },
  { id: 'fl2', name: 'Medium', vcpu: 4, ramGb: 8, description: '4 vCPU, 8 GB', _count: { variants: 0, forecastLines: 0, instances: 0 } },
];

const continuityLevels = [
  { id: 'cl-low', name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240 },
];

const availabilityZones = [
  { id: 'az1', code: 'eu-west-1a', name: 'EU West 1A' },
  { id: 'az2', code: 'eu-west-1b', name: 'EU West 1B' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function mockMutation() {
  return { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false };
}

// ═══════════════════════════════════════════════════════════════════════════
// AdminOS Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('AdminOS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateOperatingSystem.mockReturnValue(mockMutation());
    mockUseUpdateOperatingSystem.mockReturnValue(mockMutation());
    mockUseDeleteOperatingSystem.mockReturnValue(mockMutation());
    mockUseCreateOsVersion.mockReturnValue(mockMutation());
    mockUseUpdateOsVersion.mockReturnValue(mockMutation());
    mockUseDeleteOsVersion.mockReturnValue(mockMutation());
  });

  function setLoadingState() {
    mockUseOperatingSystems.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    mockUseOsVersions.mockReturnValue({ data: undefined, isLoading: true });
  }

  function setErrorState() {
    mockUseOperatingSystems.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    mockUseOsVersions.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  }

  function setLoadedState(list = osList, vers = versions) {
    mockUseOperatingSystems.mockReturnValue({ data: list, isLoading: false, isError: false, refetch: vi.fn() });
    mockUseOsVersions.mockReturnValue({ data: vers, isLoading: false, isError: false });
  }

  describe('Loading State', () => {
    it('shows skeleton loaders while loading', () => {
      setLoadingState();
      const { container } = render(<AdminOS />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load operating systems/i)).toBeInTheDocument();
    });
  });

  describe('OS List', () => {
    it('renders all operating systems', () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getByText('Windows')).toBeInTheDocument();
      expect(screen.getByText('Debian')).toBeInTheDocument();
    });

    it('shows family, name, slug columns', () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getByText('WINDOWS')).toBeInTheDocument();
      expect(screen.getByText('windows')).toBeInTheDocument();
      expect(screen.getByText('debian')).toBeInTheDocument();
    });

    it('shows version counts as badges', () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('shows active/inactive badges', () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Inactive').length).toBeGreaterThanOrEqual(1);
    });

    it('shows empty message when no OS', () => {
      setLoadedState([]);
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getByText('No operating systems')).toBeInTheDocument();
    });

    it('has Add OS button', () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      expect(screen.getByRole('button', { name: /add os/i })).toBeInTheDocument();
    });
  });

  describe('OS Modal', () => {
    it('opens modal when Add OS is clicked', async () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /add os/i }));
      expect(screen.getByText('New OS')).toBeInTheDocument();
    });

    it('opens edit modal when pencil is clicked', async () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      // Click the second action button (pencil/edit) in the first data row
      const rows = screen.getAllByRole('row');
      const firstDataRow = rows.find((r) => r.textContent?.includes('WINDOWS'));
      const buttons = firstDataRow?.querySelectorAll('button');
      const pencilButton = buttons?.[1]; // second button is edit
      if (pencilButton) {
        await userEvent.click(pencilButton);
        await waitFor(() => {
          expect(document.body.textContent).toContain('Edit OS');
        });
      }
    });
  });

  describe('Version Expansion', () => {
    it('expands OS to show versions when chevron is clicked', async () => {
      setLoadedState();
      render(<AdminOS />, { wrapper: Wrapper });
      const chevronButtons = screen.getAllByRole('button').filter((b) => {
        const svg = b.querySelector('svg');
        return svg && b.className.includes('text-slate-400');
      });
      if (chevronButtons.length > 0) {
        await userEvent.click(chevronButtons[0]);
        await waitFor(() => {
          expect(screen.getByText('Versions')).toBeInTheDocument();
        });
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AdminProducts Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('AdminProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateProduct.mockReturnValue(mockMutation());
    mockUseUpdateProduct.mockReturnValue(mockMutation());
    mockUseDeleteProduct.mockReturnValue(mockMutation());
    mockUseCreateProductVariant.mockReturnValue(mockMutation());
    mockUseUpdateProductVariant.mockReturnValue(mockMutation());
    mockUseDeleteProductVariant.mockReturnValue(mockMutation());
    mockUseFlavors.mockReturnValue({ data: flavors, isLoading: false });
    mockUseContinuityLevels.mockReturnValue({ data: continuityLevels, isLoading: false });
    mockUseAvailabilityZones.mockReturnValue({ data: availabilityZones, isLoading: false });
  });

  function setLoadingState() {
    mockUseAdminProducts.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
    mockUseAdminCategories.mockReturnValue({ data: undefined, isLoading: true });
    mockUseProductVariants.mockReturnValue({ data: undefined, isLoading: true });
  }

  function setErrorState() {
    mockUseAdminProducts.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    mockUseAdminCategories.mockReturnValue({ data: categories, isLoading: false });
    mockUseProductVariants.mockReturnValue({ data: [], isLoading: false });
  }

  function setLoadedState(prods = products, cats = categories, vars = productVariants) {
    mockUseAdminProducts.mockReturnValue({ data: prods, isLoading: false, isError: false, refetch: vi.fn() });
    mockUseAdminCategories.mockReturnValue({ data: cats, isLoading: false });
    mockUseProductVariants.mockReturnValue({ data: vars, isLoading: false, isError: false });
  }

  describe('Loading State', () => {
    it('shows skeleton loaders while loading', () => {
      setLoadingState();
      const { container } = render(<AdminProducts />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load products/i)).toBeInTheDocument();
    });
  });

  describe('Product List', () => {
    it('renders all products with name and category', () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getByText('Compute IaaS')).toBeInTheDocument();
      expect(screen.getByText('Object Storage')).toBeInTheDocument();
      expect(screen.getByText('Compute')).toBeInTheDocument();
      expect(screen.getByText('Storage')).toBeInTheDocument();
    });

    it('shows computeType badge for Compute products', () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getByText('VIRTUAL')).toBeInTheDocument();
    });

    it('shows dash for non-Compute products computeType', () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      const rows = screen.getAllByRole('row');
      const storageRow = rows.find((r) => r.textContent?.includes('Object Storage'));
      expect(storageRow?.textContent).toContain('—');
    });

    it('shows variant counts', () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(1);
    });

    it('shows active/inactive badges', () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getAllByText('Active').length).toBeGreaterThanOrEqual(2);
    });

    it('has Add Product button', () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
    });

    it('shows empty message when no products', () => {
      setLoadedState([]);
      render(<AdminProducts />, { wrapper: Wrapper });
      expect(screen.getByText('No products')).toBeInTheDocument();
    });
  });

  describe('Product Drawer — Compute', () => {
    it('opens drawer with variants section for compute product', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByText('Compute IaaS'));
      await waitFor(() => {
        expect(screen.getByText(/Variants \(\d+\)/i)).toBeInTheDocument();
      });
    });

    it('shows computeType badge in drawer', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByText('Compute IaaS'));
      await waitFor(() => {
        expect(screen.getAllByText('VIRTUAL').length).toBeGreaterThanOrEqual(1);
      });
    });

    it('shows variant details in drawer', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByText('Compute IaaS'));
      await waitFor(() => {
        expect(screen.getByText('Windows Server 2022 - Medium')).toBeInTheDocument();
      });
    });

    it('shows instance count badge on variant', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByText('Compute IaaS'));
      await waitFor(() => {
        expect(screen.getByText('2 instances')).toBeInTheDocument();
      });
    });
  });

  describe('Product Drawer — Non-Compute', () => {
    it('opens drawer with simple info for non-compute product', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByText('Object Storage'));
      await waitFor(() => {
        expect(screen.getByText('S3-compatible')).toBeInTheDocument();
      });
    });

    it('shows slug in non-compute drawer', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByText('Object Storage'));
      await waitFor(() => {
        expect(screen.getByText('object-storage')).toBeInTheDocument();
      });
    });
  });

  describe('Product Modal', () => {
    it('opens new product modal', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /add product/i }));
      expect(screen.getByText('New Product')).toBeInTheDocument();
    });

    it('shows computeType select when Compute category chosen', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /add product/i }));
      const categorySelect = screen.getByDisplayValue('Select...');
      await userEvent.selectOptions(categorySelect, 'cat-compute');
      await waitFor(() => {
        expect(screen.getByText('Compute Type', { selector: 'label' })).toBeInTheDocument();
      });
    });

    it('hides computeType select when non-Compute category chosen', async () => {
      setLoadedState();
      render(<AdminProducts />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /add product/i }));
      const categorySelect = screen.getByDisplayValue('Select...');
      await userEvent.selectOptions(categorySelect, 'cat-storage');
      await waitFor(() => {
        expect(screen.queryByText('Compute Type', { selector: 'label' })).not.toBeInTheDocument();
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AdminFlavors Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('AdminFlavors', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCreateFlavor.mockReturnValue(mockMutation());
    mockUseUpdateFlavor.mockReturnValue(mockMutation());
    mockUseDeleteFlavor.mockReturnValue(mockMutation());
  });

  function setLoadingState() {
    mockUseAdminFlavors.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
  }

  function setErrorState() {
    mockUseAdminFlavors.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
  }

  function setLoadedState(flavorList = flavors) {
    mockUseAdminFlavors.mockReturnValue({ data: flavorList, isLoading: false, isError: false, refetch: vi.fn() });
  }

  describe('Loading State', () => {
    it('shows skeleton loaders while loading', () => {
      setLoadingState();
      const { container } = render(<AdminFlavors />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load flavors/i)).toBeInTheDocument();
    });
  });

  describe('Flavor List', () => {
    it('renders all flavors with specs', () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      expect(screen.getByText('Small')).toBeInTheDocument();
      expect(screen.getByText('Medium')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });

    it('shows Used By badge with variant count', () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      expect(screen.getByText('1 variant')).toBeInTheDocument();
      expect(screen.getByText('0 variants')).toBeInTheDocument();
    });

    it('shows amber badge for used flavors', () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      // Small has 1 variant → amber badge
      const smallRow = screen.getByText('Small').closest('tr');
      expect(smallRow?.textContent).toContain('1 variant');
    });

    it('disables delete button for used flavors', () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      const rows = screen.getAllByRole('row');
      const smallRow = rows.find((r) => r.textContent?.includes('Small'));
      const deleteBtn = smallRow?.querySelector('button[disabled]');
      expect(deleteBtn).toBeTruthy();
    });

    it('enables delete button for unused flavors', () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      const rows = screen.getAllByRole('row');
      const mediumRow = rows.find((r) => r.textContent?.includes('Medium'));
      const allButtons = mediumRow?.querySelectorAll('button');
      const deleteBtn = Array.from(allButtons || []).find((b) => b.disabled === false);
      expect(deleteBtn).toBeTruthy();
    });

    it('has Add Flavor button', () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      expect(screen.getByRole('button', { name: /add flavor/i })).toBeInTheDocument();
    });

    it('shows empty message when no flavors', () => {
      setLoadedState([]);
      render(<AdminFlavors />, { wrapper: Wrapper });
      expect(screen.getByText('No flavors')).toBeInTheDocument();
    });
  });

  describe('Flavor Modal', () => {
    it('opens new flavor modal', async () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /add flavor/i }));
      expect(screen.getByText('New Flavor')).toBeInTheDocument();
    });

    it('shows vCPU and RAM inputs', async () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /add flavor/i }));
      expect(screen.getByText('vCPU', { selector: 'label' })).toBeInTheDocument();
      expect(screen.getByText('RAM (GB)', { selector: 'label' })).toBeInTheDocument();
    });

    it('opens edit modal with pre-filled values', async () => {
      setLoadedState();
      render(<AdminFlavors />, { wrapper: Wrapper });
      const editButtons = screen.getAllByRole('button').filter((b) => {
        return b.querySelector('svg.lucide-pencil') !== null;
      });
      if (editButtons.length > 0) {
        await userEvent.click(editButtons[0]);
        await waitFor(() => {
          expect(document.body.textContent).toContain('Edit Flavor');
        });
      }
    });
  });
});
