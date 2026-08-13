import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import InstanceDetailPage, { getEolWarning } from '@/pages/InstanceDetail';
import type { Instance } from '@cloudmarket/shared-types';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseInstance = vi.fn();
const mockUseApplication = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useInstance: (id: string) => mockUseInstance(id),
  useApplication: (_id: string, _opts?: any) => mockUseApplication(),
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
      <MemoryRouter initialEntries={['/instances/test-id']}>
        <Routes>
          <Route path="/instances/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const baseInstance: Instance = {
  id: 'test-id',
  name: 'test-server',
  description: 'A test server',
  status: 'RUNNING',
  environment: 'PRD',
  applicationId: 'app-1',
  productId: 'prod-1',
  flavorId: 'flavor-1',
  azCode: 'eu-west-1a',
  application: { id: 'app-1', name: 'MyApp' },
  product: { id: 'prod-1', name: 'Virtual Machine' },
  flavor: { id: 'flavor-1', name: 'Medium', vcpu: 4, ramGb: 16 },
  az: { id: 'az-1', code: 'eu-west-1a', name: 'Ireland', city: 'Dublin', country: 'IE', region: 'eu-west-1', latitude: 53.3, longitude: -6.2, isActive: true },
  forecast: null,
  ipAddress: '10.0.0.1',
  hostname: 'test.example.com',
  createdAt: new Date('2024-01-01').toISOString(),
  updatedAt: new Date('2024-01-01').toISOString(),
} as Instance;

function setLoadingState() {
  mockUseInstance.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
}

function setErrorState() {
  mockUseInstance.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
}

function setInstanceState(instance: Instance) {
  mockUseInstance.mockReturnValue({ data: instance, isLoading: false, isError: false, refetch: vi.fn() });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('InstanceDetail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading & Error States', () => {
    it('renders skeleton loaders while loading', () => {
      setLoadingState();
      const { container } = render(<InstanceDetailPage />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('shows error state when loading fails', () => {
      setErrorState();
      render(<InstanceDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load instance/i)).toBeInTheDocument();
    });
  });

  describe('Instance without Lifecycle', () => {
    it('renders instance details without lifecycle section', () => {
      setInstanceState(baseInstance);
      const { container } = render(<InstanceDetailPage />, { wrapper: Wrapper });

      expect(screen.getByText('test-server')).toBeInTheDocument();
      expect(screen.getByText('A test server')).toBeInTheDocument();
      expect(screen.getByText('MyApp')).toBeInTheDocument();
      expect(screen.getByText('Virtual Machine')).toBeInTheDocument();

      // Lifecycle section should NOT be present
      expect(container.textContent).not.toContain('Lifecycle & EOL');
    });
  });

  describe('Instance with Lifecycle', () => {
    it('renders lifecycle section with version and phase', () => {
      const instance = {
        ...baseInstance,
        lifecycle: {
          id: 'lc-1',
          version: 'Debian 12',
          phase: 'NORMAL_SUPPORT' as const,
          releaseDate: new Date('2023-01-01').toISOString(),
          normalSupportEnd: new Date('2026-01-01').toISOString(),
          extendedSupportEnd: new Date('2028-01-01').toISOString(),
          eolDate: new Date('2028-06-01').toISOString(),
        },
      };
      setInstanceState(instance as Instance);
      render(<InstanceDetailPage />, { wrapper: Wrapper });

      expect(screen.getByText('Lifecycle & EOL')).toBeInTheDocument();
      expect(screen.getByText('Debian 12')).toBeInTheDocument();
      expect(screen.getByText('Normal Support')).toBeInTheDocument();
    });

    it('renders EOL warning for product approaching EOL within 90 days', () => {
      const now = new Date();
      const eolDate = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 60 days from now

      const instance = {
        ...baseInstance,
        lifecycle: {
          id: 'lc-2',
          version: 'Debian 11',
          phase: 'NO_SUPPORT' as const,
          releaseDate: new Date('2021-01-01').toISOString(),
          normalSupportEnd: new Date('2023-01-01').toISOString(),
          extendedSupportEnd: new Date('2024-01-01').toISOString(),
          eolDate: eolDate.toISOString(),
        },
      };
      setInstanceState(instance as Instance);
      render(<InstanceDetailPage />, { wrapper: Wrapper });

      expect(screen.getByText(/EOL in \d+ days/)).toBeInTheDocument();
      expect(screen.getByText(/No Support/)).toBeInTheDocument();
    });

    it('renders EOL warning for product with EOL passed', () => {
      const now = new Date();
      const eolDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

      const instance = {
        ...baseInstance,
        lifecycle: {
          id: 'lc-3',
          version: 'Debian 10',
          phase: 'EOL' as const,
          releaseDate: new Date('2019-01-01').toISOString(),
          normalSupportEnd: new Date('2022-01-01').toISOString(),
          extendedSupportEnd: new Date('2024-01-01').toISOString(),
          eolDate: eolDate.toISOString(),
        },
      };
      setInstanceState(instance as Instance);
      render(<InstanceDetailPage />, { wrapper: Wrapper });

      expect(screen.getByText(/EOL passed \d+ days ago/)).toBeInTheDocument();
      expect(screen.getByText('End of Life')).toBeInTheDocument();
    });

    it('renders safe EOL warning for product with EOL far in future', () => {
      const now = new Date();
      const eolDate = new Date(now.getTime() + 500 * 24 * 60 * 60 * 1000); // ~1.4 years from now

      const instance = {
        ...baseInstance,
        lifecycle: {
          id: 'lc-4',
          version: 'Debian 13',
          phase: 'RELEASED' as const,
          releaseDate: new Date('2025-01-01').toISOString(),
          normalSupportEnd: new Date('2027-01-01').toISOString(),
          extendedSupportEnd: new Date('2029-01-01').toISOString(),
          eolDate: eolDate.toISOString(),
        },
      };
      setInstanceState(instance as Instance);
      render(<InstanceDetailPage />, { wrapper: Wrapper });

      // Should show a warning but with green/safe color
      expect(screen.getByText(/EOL in/)).toBeInTheDocument();
      expect(screen.getByText('Released')).toBeInTheDocument();
    });
  });
});

// ─── getEolWarning Pure Function Tests ────────────────────────────────────

describe('getEolWarning', () => {
  it('returns null for empty/invalid date', () => {
    expect(getEolWarning('')).toBeNull();
  });

  it('returns CRITICAL warning when EOL has passed', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL passed');
    expect(result!.text).toContain('10 days ago');
    expect(result!.color).toBe('text-red-400');
  });

  it('returns CRITICAL warning when EOL is within 90 days', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000).toISOString();
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL in 45 days');
    expect(result!.color).toBe('text-red-400');
  });

  it('returns AMBER warning when EOL is within 365 days', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000).toISOString();
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL in 6 months');
    expect(result!.color).toBe('text-amber-400');
  });

  it('returns SAFE warning when EOL is more than 365 days away', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() + 730 * 24 * 60 * 60 * 1000).toISOString();
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL in 2 years');
    expect(result!.color).toBe('text-emerald-400');
  });

  it('handles EOL exactly today as passed', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() - 1).toISOString(); // just passed
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL passed');
  });

  it('handles EOL exactly 90 days from now as critical', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString();
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL in 90 days');
    expect(result!.color).toBe('text-red-400');
  });

  it('handles EOL exactly 365 days from now as amber', () => {
    const now = new Date();
    const eolDate = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
    const result = getEolWarning(eolDate);
    expect(result).not.toBeNull();
    expect(result!.text).toContain('EOL in 12 months');
    expect(result!.color).toBe('text-amber-400');
  });
});
