import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import AdminPage from '@/pages/Admin';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockMutateAsync = vi.fn();
const mockMutate = vi.fn();

function createMockMutation(isPending = false) {
  return { mutateAsync: mockMutateAsync, mutate: mockMutate, isPending };
}

const mockUseAdminDashboard = vi.fn();
const mockUseAdminProducts = vi.fn();
const mockUseAdminCategories = vi.fn();
const mockUseAdminFlavors = vi.fn();
const mockUseAdminDependencies = vi.fn();
const mockUseAdminForecasts = vi.fn();
const mockUseAdminUsers = vi.fn();
const mockUseCreateProduct = vi.fn(() => createMockMutation());
const mockUseUpdateProduct = vi.fn(() => createMockMutation());
const mockUseDeleteProduct = vi.fn(() => createMockMutation());
const mockUseCreateCategory = vi.fn(() => createMockMutation());
const mockUseUpdateCategory = vi.fn(() => createMockMutation());
const mockUseDeleteCategory = vi.fn(() => createMockMutation());
const mockUseCreateFlavor = vi.fn(() => createMockMutation());
const mockUseUpdateFlavor = vi.fn(() => createMockMutation());
const mockUseDeleteFlavor = vi.fn(() => createMockMutation());
const mockUseCreateDependency = vi.fn(() => createMockMutation());
const mockUseUpdateDependency = vi.fn(() => createMockMutation());
const mockUseDeleteDependency = vi.fn(() => createMockMutation());
const mockUseCreateUser = vi.fn(() => createMockMutation());
const mockUseUpdateUser = vi.fn(() => createMockMutation());
const mockUseDeleteUser = vi.fn(() => createMockMutation());
const mockUseUpdateForecast = vi.fn(() => createMockMutation());
const mockUseDeleteForecast = vi.fn(() => createMockMutation());
const mockUseAvailabilityZones = vi.fn();
const mockUseCreateAvailabilityZone = vi.fn(() => createMockMutation());
const mockUseUpdateAvailabilityZone = vi.fn(() => createMockMutation());
const mockUseDeleteAvailabilityZone = vi.fn(() => createMockMutation());
const mockUseInstances = vi.fn();
const mockUseCreateInstance = vi.fn(() => createMockMutation());
const mockUseUpdateInstance = vi.fn(() => createMockMutation());
const mockUseDeleteInstance = vi.fn(() => createMockMutation());
const mockUseApplications = vi.fn();
const mockUseCreateApplication = vi.fn(() => createMockMutation());
const mockUseUpdateApplication = vi.fn(() => createMockMutation());
const mockUseDeleteApplication = vi.fn(() => createMockMutation());
const mockUseContinuityLevels = vi.fn();
const mockUseUpdateContinuityLevel = vi.fn(() => createMockMutation());
const mockUseOperatingSystems = vi.fn();
const mockUseCreateOS = vi.fn(() => createMockMutation());
const mockUseUpdateOS = vi.fn(() => createMockMutation());
const mockUseDeleteOS = vi.fn(() => createMockMutation());
const mockUseCreateOSVersion = vi.fn(() => createMockMutation());
const mockUseUpdateOSVersion = vi.fn(() => createMockMutation());
const mockUseProductVariants = vi.fn();
const mockUseCreateVariant = vi.fn(() => createMockMutation());
const mockUseUpdateVariant = vi.fn(() => createMockMutation());
const mockUseDeleteVariant = vi.fn(() => createMockMutation());
const mockUseFlavors = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useAdminDashboard: () => mockUseAdminDashboard(),
  useAdminProducts: () => mockUseAdminProducts(),
  useAdminCategories: () => mockUseAdminCategories(),
  useAdminFlavors: () => mockUseAdminFlavors(),
  useAdminDependencies: () => mockUseAdminDependencies(),
  useAdminForecasts: () => mockUseAdminForecasts(),
  useAdminUsers: () => mockUseAdminUsers(),
  useCreateProduct: () => mockUseCreateProduct(),
  useUpdateProduct: () => mockUseUpdateProduct(),
  useDeleteProduct: () => mockUseDeleteProduct(),
  useCreateCategory: () => mockUseCreateCategory(),
  useUpdateCategory: () => mockUseUpdateCategory(),
  useDeleteCategory: () => mockUseDeleteCategory(),
  useCreateFlavor: () => mockUseCreateFlavor(),
  useUpdateFlavor: () => mockUseUpdateFlavor(),
  useDeleteFlavor: () => mockUseDeleteFlavor(),
  useCreateDependency: () => mockUseCreateDependency(),
  useUpdateDependency: () => mockUseUpdateDependency(),
  useDeleteDependency: () => mockUseDeleteDependency(),
  useCreateUser: () => mockUseCreateUser(),
  useUpdateUser: () => mockUseUpdateUser(),
  useDeleteUser: () => mockUseDeleteUser(),
  useUpdateForecast: () => mockUseUpdateForecast(),
  useDeleteForecast: () => mockUseDeleteForecast(),
  useAvailabilityZones: () => mockUseAvailabilityZones(),
  useCreateAvailabilityZone: () => mockUseCreateAvailabilityZone(),
  useUpdateAvailabilityZone: () => mockUseUpdateAvailabilityZone(),
  useDeleteAvailabilityZone: () => mockUseDeleteAvailabilityZone(),
  useInstances: () => mockUseInstances(),
  useCreateInstance: () => mockUseCreateInstance(),
  useUpdateInstance: () => mockUseUpdateInstance(),
  useDeleteInstance: () => mockUseDeleteInstance(),
  useApplications: () => mockUseApplications(),
  useCreateApplication: () => mockUseCreateApplication(),
  useUpdateApplication: () => mockUseUpdateApplication(),
  useDeleteApplication: () => mockUseDeleteApplication(),
  useContinuityLevels: () => mockUseContinuityLevels(),
  useUpdateContinuityLevel: () => mockUseUpdateContinuityLevel(),
  useOperatingSystems: () => mockUseOperatingSystems(),
  useCreateOS: () => mockUseCreateOS(),
  useUpdateOS: () => mockUseUpdateOS(),
  useDeleteOS: () => mockUseDeleteOS(),
  useCreateOSVersion: () => mockUseCreateOSVersion(),
  useUpdateOSVersion: () => mockUseUpdateOSVersion(),
  useProductVariants: () => mockUseProductVariants(),
  useCreateVariant: () => mockUseCreateVariant(),
  useUpdateVariant: () => mockUseUpdateVariant(),
  useDeleteVariant: () => mockUseDeleteVariant(),
  useFlavors: () => mockUseFlavors(),
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

const computeCategory = { id: 'cat-1', name: 'Compute', slug: 'compute', icon: 'Cpu' };
const dataCategory = { id: 'cat-2', name: 'Data', slug: 'data', icon: 'Database' };

const products = [
  {
    id: 'prod-1',
    name: 'Virtual Machine',
    slug: 'virtual-machine',
    description: 'VM product',
    category: computeCategory,
    computeType: 'VIRTUAL',
    isActive: true,
    variants: [{ id: 'v1' }, { id: 'v2' }],
    _count: { variants: 2, instances: 1 },
  },
  {
    id: 'prod-2',
    name: 'Bare Metal HPC',
    slug: 'bare-metal-hpc',
    description: 'HPC product',
    category: computeCategory,
    computeType: 'PHYSICAL',
    isActive: true,
    variants: [{ id: 'v3' }],
    _count: { variants: 1, instances: 0 },
  },
  {
    id: 'prod-3',
    name: 'Object Storage',
    slug: 'object-storage',
    description: 'Storage product',
    category: dataCategory,
    computeType: null,
    isActive: true,
    variants: [],
    _count: { variants: 0, instances: 0 },
  },
];

const flavors = [
  { id: 'fl-1', name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry', _count: { variants: 3 } },
  { id: 'fl-2', name: 'Large', vcpu: 8, ramGb: 16, description: 'High perf', _count: { variants: 1 } },
];

const osList = [
  { id: 'os-1', family: 'WINDOWS', name: 'Windows', slug: 'windows', isActive: true, versions: [{ id: 'v1', version: 'Server 2022' }, { id: 'v2', version: 'Server 2019' }] },
  { id: 'os-2', family: 'LINUX', name: 'Debian', slug: 'debian', isActive: true, versions: [{ id: 'v3', version: '12' }] },
];

const variants = [
  { id: 'var-1', name: 'Debian 12 - Small', os: { name: 'Debian' }, osVersion: { version: '12' }, flavor: { name: 'Small' }, availabilityZones: [{ availabilityZone: { code: 'par1' } }], continuityLevel: { name: 'MODERATE' }, _count: { instances: 0 } },
];

const allFlavors = flavors;
const allOS = osList;
const allAZs = [{ id: 'az-1', code: 'par1', name: 'Paris' }];
const allCL = [{ id: 'cl-1', name: 'LOW' }];

function setLoadedState() {
  mockUseAdminDashboard.mockReturnValue({ data: { counts: { products: 3, categories: 2, forecasts: 0, users: 0 } }, isLoading: false, isError: false });
  mockUseAdminProducts.mockReturnValue({ data: products, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseAdminCategories.mockReturnValue({ data: [computeCategory, dataCategory], isLoading: false, isError: false });
  mockUseAdminFlavors.mockReturnValue({ data: flavors, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseAdminDependencies.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseAdminForecasts.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseAdminUsers.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseAvailabilityZones.mockReturnValue({ data: allAZs, isLoading: false, isError: false });
  mockUseInstances.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseApplications.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: allCL, isLoading: false, isError: false });
  mockUseOperatingSystems.mockReturnValue({ data: osList, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseProductVariants.mockReturnValue({ data: variants, isLoading: false, isError: false });
  mockUseFlavors.mockReturnValue({ data: allFlavors, isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Admin — Prisma Schema Refactor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setLoadedState();
  });

  describe('Dashboard', () => {
    it('renders admin page title', () => {
      render(<AdminPage />, { wrapper: Wrapper });
      expect(screen.getByText('Administration')).toBeInTheDocument();
    });

    it('shows product count in dashboard', () => {
      render(<AdminPage />, { wrapper: Wrapper });
      const productElements = screen.getAllByText('Products');
      expect(productElements.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  describe('Tab Navigation', () => {
    it('renders all tab triggers', () => {
      render(<AdminPage />, { wrapper: Wrapper });
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Products')).toBeInTheDocument();
      expect(screen.getByText('OS')).toBeInTheDocument();
      expect(screen.getByText('Flavors')).toBeInTheDocument();
    });
  });

  describe('OS Tab', () => {
    it('switches to OS tab and shows OS data', async () => {
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });

      const osTab = screen.getByText('OS');
      await user.click(osTab);

      await waitFor(() => {
        expect(screen.getByText('Windows')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(screen.getByText('Debian')).toBeInTheDocument();
      expect(screen.getByText('WINDOWS')).toBeInTheDocument();
      expect(screen.getByText('LINUX')).toBeInTheDocument();
    });

    it('shows Add OS button in OS tab', async () => {
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });
      await user.click(screen.getByText('OS'));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add os/i })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows QueryError when OS data fails to load', async () => {
      mockUseOperatingSystems.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });
      await user.click(screen.getByText('OS'));
      await waitFor(() => {
        expect(screen.getByText(/unable to load os list/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Products Tab', () => {
    it('switches to Products tab and shows product data', async () => {
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });

      await user.click(screen.getByText('Products'));
      await waitFor(() => {
        expect(screen.getByText('Virtual Machine')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(screen.getByText('VIRTUAL')).toBeInTheDocument();
      expect(screen.getByText('PHYSICAL')).toBeInTheDocument();
      expect(screen.getByText('Object Storage')).toBeInTheDocument();
    });

    it('shows Add Product button in Products tab', async () => {
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });
      await user.click(screen.getByText('Products'));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add product/i })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows QueryError when products fail to load', async () => {
      mockUseAdminProducts.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });
      await user.click(screen.getByText('Products'));
      await waitFor(() => {
        expect(screen.getByText(/unable to load products/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('Flavors Tab', () => {
    it('switches to Flavors tab and shows flavor data', async () => {
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });

      await user.click(screen.getByText('Flavors'));
      await waitFor(() => {
        expect(screen.getByText('Small')).toBeInTheDocument();
      }, { timeout: 3000 });
      expect(screen.getByText('Large')).toBeInTheDocument();
    });

    it('shows Add Flavor button in Flavors tab', async () => {
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });
      await user.click(screen.getByText('Flavors'));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /add flavor/i })).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows QueryError when flavors fail to load', async () => {
      mockUseAdminFlavors.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
      const user = userEvent.setup();
      render(<AdminPage />, { wrapper: Wrapper });
      await user.click(screen.getByText('Flavors'));
      await waitFor(() => {
        expect(screen.getByText(/unable to load flavors/i)).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
