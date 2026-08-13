import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import ApplicationsPage from '@/pages/Applications';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseApplications = vi.fn();
const mockUseContinuityLevels = vi.fn();
const mockUseInstances = vi.fn();
const mockUseForecasts = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useApplications: () => mockUseApplications(),
  useContinuityLevels: () => mockUseContinuityLevels(),
  useInstances: () => mockUseInstances(),
  useForecasts: () => mockUseForecasts(),
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

const continuityLevels = [
  { id: 'cl-low', name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240, description: 'Basic backup', color: 'green' },
  { id: 'cl-mod', name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60, description: 'HA pair', color: 'yellow' },
  { id: 'cl-ser', name: 'SERIOUS', rtoMinutes: 240, rpoMinutes: 15, description: 'Multi-AZ', color: 'orange' },
  { id: 'cl-ext', name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5, description: 'Active-Active', color: 'red' },
];

const applications = [
  {
    id: 'a1',
    name: 'Alpha App',
    description: 'The first app',
    continuityLevelId: 'cl-low',
    continuityLevel: continuityLevels[0],
    owner: 'Alice',
    createdAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'a2',
    name: 'Beta App',
    description: 'The second app',
    continuityLevelId: 'cl-ext',
    continuityLevel: continuityLevels[3],
    owner: 'Bob',
    createdAt: '2024-02-20T14:30:00Z',
  },
];

const instances = [
  { id: 'i1', name: 'inst1', applicationId: 'a1', product: { name: 'VM' }, flavor: { name: 'Small' }, az: { code: 'eu-west-1a' }, status: 'RUNNING', environment: 'PRD', ipAddress: '10.0.0.1' },
  { id: 'i2', name: 'inst2', applicationId: 'a1', product: { name: 'VM' }, flavor: { name: 'Large' }, az: { code: 'eu-west-1b' }, status: 'RUNNING', environment: 'PRD', ipAddress: '10.0.0.2' },
  { id: 'i3', name: 'inst3', applicationId: 'a2', product: { name: 'DB' }, flavor: { name: 'Medium' }, az: { code: 'us-east-1a' }, status: 'PENDING', environment: 'DEV', ipAddress: null },
];

const forecasts = [
  { id: 'f1', applicationId: 'a1', status: 'APPROVED', environment: 'PRD', lines: [{ id: 'fl1' }], targetDate: '2024-12-01', requestedAt: '2024-01-01T00:00:00Z' },
  { id: 'f2', applicationId: 'a1', status: 'PENDING', environment: 'DEV', lines: [], targetDate: null, requestedAt: '2024-01-02T00:00:00Z' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function setLoadingState() {
  mockUseApplications.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
  mockUseContinuityLevels.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseInstances.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseForecasts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
}

function setErrorState() {
  mockUseApplications.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
  mockUseContinuityLevels.mockReturnValue({ data: continuityLevels, isLoading: false, isError: false });
  mockUseInstances.mockReturnValue({ data: instances, isLoading: false, isError: false });
  mockUseForecasts.mockReturnValue({ data: forecasts, isLoading: false, isError: false });
}

function setLoadedState(
  apps = applications,
  levels = continuityLevels,
  insts = instances,
  fcs = forecasts
) {
  mockUseApplications.mockReturnValue({ data: apps, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseContinuityLevels.mockReturnValue({ data: levels, isLoading: false, isError: false });
  mockUseInstances.mockReturnValue({ data: insts, isLoading: false, isError: false });
  mockUseForecasts.mockReturnValue({ data: fcs, isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Applications Page (List)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows skeleton loaders while data is loading', () => {
      setLoadingState();
      const { container } = render(<ApplicationsPage />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders page title even while loading', () => {
      setLoadingState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getByText('Application Hub')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load applications/i)).toBeInTheDocument();
    });
  });

  describe('Stats Cards', () => {
    it('renders total applications stat', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getByText('Total Applications')).toBeInTheDocument();
      const totalCard = screen.getByText('Total Applications').closest('div')?.parentElement;
      expect(totalCard?.textContent).toContain('2');
    });

    it('renders continuity level counts', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getAllByText('LOW').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('EXTREME').length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Applications List', () => {
    it('renders all applications in desktop table', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getAllByText('Alpha App').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Beta App').length).toBeGreaterThanOrEqual(1);
    });

    it('shows owner names', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getAllByText('Alice').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Bob').length).toBeGreaterThanOrEqual(1);
    });

    it('shows instance counts per app', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find((r) => r.textContent?.includes('Alpha App'));
      expect(alphaRow?.textContent).toContain('2');
      const betaRow = rows.find((r) => r.textContent?.includes('Beta App'));
      expect(betaRow?.textContent).toContain('1');
    });

    it('shows forecast counts per app', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      const rows = screen.getAllByRole('row');
      const alphaRow = rows.find((r) => r.textContent?.includes('Alpha App'));
      expect(alphaRow?.textContent).toContain('2');
      const betaRow = rows.find((r) => r.textContent?.includes('Beta App'));
      expect(betaRow?.textContent).toContain('0');
    });

    it('shows continuity badges with correct names', () => {
      setLoadedState();
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getAllByText('LOW').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('EXTREME').length).toBeGreaterThanOrEqual(1);
    });

    it('has View links with correct hrefs', () => {
      setLoadedState();
      const { container } = render(<ApplicationsPage />, { wrapper: Wrapper });
      const alphaLinks = container.querySelectorAll('a[href="/applications/a1"]');
      expect(alphaLinks.length).toBeGreaterThanOrEqual(1);
      const betaLinks = container.querySelectorAll('a[href="/applications/a2"]');
      expect(betaLinks.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Empty State', () => {
    it('shows empty message when no applications exist', () => {
      setLoadedState([], continuityLevels, [], []);
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getByText('No applications found')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles application without description', () => {
      const apps = [{ ...applications[0], description: null }];
      setLoadedState(apps, continuityLevels, [], []);
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getAllByText('Alpha App').length).toBeGreaterThanOrEqual(1);
      expect(screen.queryByText('The first app')).not.toBeInTheDocument();
    });

    it('handles missing continuity level gracefully', () => {
      const apps = [{ ...applications[0], continuityLevel: null, continuityLevelId: 'unknown' }];
      setLoadedState(apps, continuityLevels, [], []);
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getAllByText('Unknown').length).toBeGreaterThanOrEqual(1);
    });

    it('shows filter hint in empty state when filters applied', () => {
      setLoadedState([], continuityLevels, [], []);
      render(<ApplicationsPage />, { wrapper: Wrapper });
      expect(screen.getByText(/applications will appear here once created/i)).toBeInTheDocument();
    });
  });
});
