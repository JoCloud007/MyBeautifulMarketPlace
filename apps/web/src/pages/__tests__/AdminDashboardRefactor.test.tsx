import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Admin from '@/pages/Admin';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseAdminDashboard = vi.fn();
const mockUseAdminProducts = vi.fn();
const mockUseAdminCategories = vi.fn();
const mockUseAdminFlavors = vi.fn();
const mockUseOperatingSystems = vi.fn();
const mockUseProductVariants = vi.fn();
const mockUseFlavors = vi.fn();
const mockUseAvailabilityZones = vi.fn();
const mockUseContinuityLevels = vi.fn();

const mockMutateAsync = vi.fn();
const mockMutate = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useAdminDashboard: () => mockUseAdminDashboard(),
  useAdminProducts: () => mockUseAdminProducts(),
  useAdminCategories: () => mockUseAdminCategories(),
  useAdminFlavors: () => mockUseAdminFlavors(),
  useAdminDependencies: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useAdminForecasts: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useAdminUsers: () => ({ data: [], isLoading: false, isError: false, refetch: vi.fn() }),
  useOperatingSystems: () => mockUseOperatingSystems(),
  useCreateOS: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateOS: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteOS: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateOSVersion: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateOSVersion: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useProductVariants: (productId: string) => mockUseProductVariants(productId),
  useCreateVariant: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateVariant: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteVariant: () => ({ mutate: mockMutate, isPending: false }),
  useFlavors: () => mockUseFlavors(),
  useAvailabilityZones: () => mockUseAvailabilityZones(),
  useContinuityLevels: () => mockUseContinuityLevels(),
  useCreateProduct: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateProduct: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteProduct: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateFlavor: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateFlavor: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteFlavor: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateCategory: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateCategory: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteCategory: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateDependency: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateDependency: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteDependency: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateUser: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateUser: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteUser: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateApplication: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateApplication: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteApplication: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateForecast: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteForecast: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useCreateInstance: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateInstance: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteInstance: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateContinuityLevel: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useInstances: () => ({ data: [], isLoading: false }),
  useApplications: () => ({ data: [], isLoading: false }),
  useCreateAvailabilityZone: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useUpdateAvailabilityZone: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
  useDeleteAvailabilityZone: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
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

const computeCategory = { id: 'cat-compute', name: 'Compute', slug: 'compute' };
const dataCategory = { id: 'cat-data', name: 'Data', slug: 'data' };

const products = [
  {
    id: 'p-vm',
    name: 'Virtual Machine',
    slug: 'virtual-machine',
    description: 'A VM',
    categoryId: computeCategory.id,
    category: computeCategory,
    computeType: 'VIRTUAL',
    isActive: true,
    variants: [
      { id: 'v1', name: 'Debian 12 - Small', os: { name: 'Debian' }, osVersion: { version: '12' }, flavor: { name: 'Small' } },
      { id: 'v2', name: 'Windows 2022 - Medium', os: { name: 'Windows' }, osVersion: { version: 'Server 2022' }, flavor: { name: 'Medium' } },
    ],
  },
  {
    id: 'p-storage',
    name: 'Object Storage',
    slug: 'object-storage',
    description: 'S3-compatible',
    categoryId: dataCategory.id,
    category: dataCategory,
    computeType: null,
    isActive: true,
    variants: [],
  },
];

const osList = [
  {
    id: 'os-windows',
    family: 'WINDOWS',
    name: 'Windows',
    slug: 'windows',
    isActive: true,
    versions: [
      { id: 'ver-2022', version: 'Server 2022', phase: 'RELEASED', releaseDate: '2021-08-18T00:00:00Z' },
      { id: 'ver-2019', version: 'Server 2019', phase: 'EXTENDED_SUPPORT', releaseDate: '2018-10-02T00:00:00Z' },
    ],
    _count: { variants: 4 },
  },
  {
    id: 'os-debian',
    family: 'LINUX',
    name: 'Debian',
    slug: 'debian',
    isActive: true,
    versions: [
      { id: 'ver-12', version: '12 (Bookworm)', phase: 'RELEASED', releaseDate: '2023-06-10T00:00:00Z' },
    ],
    _count: { variants: 3 },
  },
];

const flavors = [
  { id: 'f-small', name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry-level', _count: { variants: 5, forecastLines: 2 } },
  { id: 'f-medium', name: 'Medium', vcpu: 4, ramGb: 8, description: 'Balanced', _count: { variants: 3, forecastLines: 1 } },
];

const variants = [
  {
    id: 'v1',
    name: 'Debian 12 - Small',
    osId: 'os-debian',
    osVersionId: 'ver-12',
    flavorId: 'f-small',
    os: { name: 'Debian' },
    osVersion: { version: '12 (Bookworm)', phase: 'RELEASED' },
    flavor: { name: 'Small' },
    availabilityZones: [{ availabilityZoneId: 'az1', availabilityZone: { code: 'eu-west-par1' } }],
    continuityLevel: { name: 'MODERATE', color: 'yellow' },
    isActive: true,
  },
];

const allFlavors = [
  { id: 'f-small', name: 'Small', vcpu: 2, ramGb: 4 },
  { id: 'f-medium', name: 'Medium', vcpu: 4, ramGb: 8 },
];

const allAZs = [
  { id: 'az1', code: 'eu-west-par1', name: 'Paris AZ1' },
  { id: 'az2', code: 'eu-west-par2', name: 'Paris AZ2' },
];

const allCL = [
  { id: 'cl-low', name: 'LOW', color: 'green' },
  { id: 'cl-mod', name: 'MODERATE', color: 'yellow' },
];

function setupDefaultMocks() {
  mockUseAdminDashboard.mockReturnValue({
    data: { counts: { products: 8, categories: 4, forecasts: 3, users: 2, applications: 3, continuityLevels: 4 }, recentForecasts: [] },
    isLoading: false, isError: false, refetch: vi.fn(),
  });
  mockUseAdminProducts.mockReturnValue({ data: products, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseAdminCategories.mockReturnValue({ data: [computeCategory, dataCategory], isLoading: false });
  mockUseAdminFlavors.mockReturnValue({ data: flavors, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseOperatingSystems.mockReturnValue({ data: osList, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseProductVariants.mockReturnValue({ data: variants, isLoading: false });
  mockUseFlavors.mockReturnValue({ data: allFlavors, isLoading: false });
  mockUseAvailabilityZones.mockReturnValue({ data: allAZs, isLoading: false });
  mockUseContinuityLevels.mockReturnValue({ data: allCL, isLoading: false });
}

// Helper: assert text exists somewhere on page (handles mobile+desktop duplicates)
function expectTextOnPage(text: string) {
  expect(screen.queryAllByText(text).length).toBeGreaterThan(0);
}

// Helper: find tab button by index (0=dashboard, 1=products, 2=os, 3=categories, 4=flavors, ...)
function getTabButton(index: number) {
  const buttons = screen.getAllByRole('button');
  // Filter to only tab buttons (they have specific class patterns or are inside TabsList)
  // The tabs are the first N buttons in the document
  return buttons[index];
}

// Helper: click a product row in the desktop table
function clickProductRow(productName: string) {
  const rows = screen.getAllByRole('row');
  const row = rows.find((r) => r.textContent?.includes(productName));
  if (!row) throw new Error(`Product row not found: ${productName}`);
  fireEvent.click(row);
}

// ═══════════════════════════════════════════════════════════════════════════
// ADMIN DASHBOARD REFACTOR — FRONTEND TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Admin Dashboard Refactor — Frontend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  describe('Tab Navigation', () => {
    it('renders the OS tab', () => {
      render(<Admin />, { wrapper: Wrapper });
      expectTextOnPage('OS');
    });

    it('renders the Products tab', () => {
      render(<Admin />, { wrapper: Wrapper });
      expectTextOnPage('Products');
    });

    it('renders the Flavors tab', () => {
      render(<Admin />, { wrapper: Wrapper });
      expectTextOnPage('Flavors');
    });

    it('switches to OS tab when clicked', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(2));
      await waitFor(() => expectTextOnPage('Windows'), { timeout: 3000 });
    });

    it('switches to Flavors tab when clicked', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(4));
      await waitFor(() => expectTextOnPage('Small'), { timeout: 3000 });
    });
  });

  describe('Products Tab — Refactored', () => {
    it('shows product name, category, and active status', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => {
        expectTextOnPage('Virtual Machine');
        expectTextOnPage('Object Storage');
      }, { timeout: 3000 });
    });

    it('shows computeType for Compute products', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const vmRow = rows.find((r) => r.textContent?.includes('Virtual Machine'));
        expect(vmRow).toBeDefined();
        expect(vmRow!.textContent).toContain('VIRTUAL');
      }, { timeout: 3000 });
    });

    it('shows "—" for Type on non-Compute products', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const storageRow = rows.find((r) => r.textContent?.includes('Object Storage'));
        expect(storageRow).toBeDefined();
        expect(storageRow!.textContent).toContain('—');
      }, { timeout: 3000 });
    });

    it('shows variant count in products table', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const vmRow = rows.find((r) => r.textContent?.includes('Virtual Machine'));
        expect(vmRow!.textContent).toContain('2');
      }, { timeout: 3000 });
    });

    it('opens product detail drawer on row click', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Virtual Machine'), { timeout: 3000 });
      clickProductRow('Virtual Machine');
      await waitFor(() => expectTextOnPage('Variants'), { timeout: 3000 });
    });
  });

  describe('Product Detail Drawer — Compute vs Non-Compute', () => {
    it('shows Variants section for Compute product', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Virtual Machine'), { timeout: 3000 });
      clickProductRow('Virtual Machine');
      await waitFor(() => {
        expectTextOnPage('Variants');
        expectTextOnPage('Add Variant');
        expectTextOnPage('Debian 12 - Small');
      }, { timeout: 3000 });
    });

    it('shows variant details with OS, version, flavor, AZ badges', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Virtual Machine'), { timeout: 3000 });
      clickProductRow('Virtual Machine');
      await waitFor(() => {
        // OS + version shown together in one badge: "Debian 12 (Bookworm)"
        expect(screen.queryAllByText(/Debian/).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/12 \(Bookworm\)/).length).toBeGreaterThan(0);
        expect(screen.queryAllByText(/Small/).length).toBeGreaterThan(0);
        expectTextOnPage('MODERATE');
        expectTextOnPage('eu-west-par1');
      }, { timeout: 3000 });
    });

    it('shows simple Product Details for non-Compute product', async () => {
      mockUseProductVariants.mockReturnValue({ data: [], isLoading: false });
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Object Storage'), { timeout: 3000 });
      clickProductRow('Object Storage');
      await waitFor(() => {
        expectTextOnPage('Product Details');
        expect(screen.queryAllByText('Add Variant').length).toBe(0);
      }, { timeout: 3000 });
    });

    it('shows Compute Type in product detail for Compute', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Virtual Machine'), { timeout: 3000 });
      clickProductRow('Virtual Machine');
      await waitFor(() => expectTextOnPage('Compute Type:'), { timeout: 3000 });
    });
  });

  describe('OS Tab', () => {
    it('lists OS families with version counts', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(2));
      await waitFor(() => {
        expectTextOnPage('Windows');
        expectTextOnPage('Debian');
      }, { timeout: 3000 });
    });

    it('shows version lifecycle phases', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(2));
      await waitFor(() => {
        expectTextOnPage('Server 2022');
        expectTextOnPage('Server 2019');
      }, { timeout: 3000 });
    });
  });

  describe('Flavors Tab — Global', () => {
    it('lists flavors with vCPU, RAM, and Used By count', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(4));
      await waitFor(() => {
        expectTextOnPage('Small');
        expectTextOnPage('Medium');
      }, { timeout: 3000 });
    });

    it('shows correct Used By (variant count) for each flavor', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(4));
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        const smallRow = rows.find((r) => r.textContent?.includes('Small') && r.textContent?.includes('2'));
        expect(smallRow).toBeDefined();
      }, { timeout: 3000 });
    });

    it('shows Add Flavor button', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(4));
      await waitFor(() => expectTextOnPage('Add Flavor'), { timeout: 3000 });
    });
  });

  describe('Product Form — computeType constraint', () => {
    it('shows computeType select when Compute category is chosen', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Add Product'), { timeout: 3000 });
      // Find Add Product button by its Plus icon
      const buttons = screen.getAllByRole('button');
      const addBtn = buttons.find((b) => b.textContent?.includes('Add Product'));
      expect(addBtn).toBeDefined();
      fireEvent.click(addBtn!);
      await waitFor(() => expectTextOnPage('New product'), { timeout: 3000 });
      // Find the Category <select> by its options
      const selects = document.querySelectorAll('select');
      const categorySelect = Array.from(selects).find((s) =>
        Array.from(s.options).some((o) => o.text === 'Compute')
      );
      expect(categorySelect).toBeDefined();
      fireEvent.change(categorySelect!, { target: { value: computeCategory.id } });
      await waitFor(() => {
        expectTextOnPage('Compute Type');
      }, { timeout: 3000 });
    });

    it('does not show computeType select when non-Compute category is chosen', async () => {
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Add Product'), { timeout: 3000 });
      const buttons = screen.getAllByRole('button');
      const addBtn = buttons.find((b) => b.textContent?.includes('Add Product'));
      fireEvent.click(addBtn!);
      await waitFor(() => expectTextOnPage('New product'), { timeout: 3000 });
      const selects = document.querySelectorAll('select');
      const categorySelect = Array.from(selects).find((s) =>
        Array.from(s.options).some((o) => o.text === 'Compute')
      );
      fireEvent.change(categorySelect!, { target: { value: dataCategory.id } });
      await waitFor(() => {
        expect(screen.queryAllByText('Compute Type').length).toBe(0);
      }, { timeout: 3000 });
    });
  });

  describe('Edge Cases', () => {
    it('shows skeletons when products are loading', () => {
      mockUseAdminProducts.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      // ResponsiveTable shows skeleton divs when loading
      const skeletons = document.querySelectorAll('[class*="animate-pulse"]');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state for OS tab', async () => {
      mockUseOperatingSystems.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(2));
      await waitFor(() => {
        expect(screen.getByText('Unable to load OS.')).toBeInTheDocument();
      }, { timeout: 3000 });
    });

    it('shows empty variants message for Compute product with no variants', async () => {
      mockUseProductVariants.mockReturnValue({ data: [], isLoading: false });
      render(<Admin />, { wrapper: Wrapper });
      fireEvent.click(getTabButton(1));
      await waitFor(() => expectTextOnPage('Virtual Machine'), { timeout: 3000 });
      clickProductRow('Virtual Machine');
      await waitFor(() => {
        expect(screen.getByText('No variants for this product.')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });
});
