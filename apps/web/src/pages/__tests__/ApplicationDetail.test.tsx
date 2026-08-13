import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ApplicationDetailPage from '@/pages/ApplicationDetail';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseApplication = vi.fn();
const mockUseInstances = vi.fn();
const mockUseForecasts = vi.fn();
const mockUseContinuityLevels = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useApplication: (id: string) => mockUseApplication(id),
  useInstances: () => mockUseInstances(),
  useForecasts: () => mockUseForecasts(),
  useContinuityLevels: () => mockUseContinuityLevels(),
}));

vi.mock('@/hooks/useScrollReveal', () => ({
  useScrollReveal: () => ({ ref: { current: null }, isVisible: true }),
}));

vi.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }: any) => {
    return <a href={to} {...props}>{children}</a>;
  },
  useParams: () => ({ id: 'a1' }),
}));

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={createTestQueryClient()}>
      {children}
    </QueryClientProvider>
  );
}

// ─── Test Data ────────────────────────────────────────────────────────────

const continuityLevel = {
  id: 'cl-mod',
  name: 'MODERATE',
  rtoMinutes: 480,
  rpoMinutes: 60,
  description: 'HA pair',
  color: 'yellow',
};

const application = {
  id: 'a1',
  name: 'Alpha App',
  description: 'The first app',
  continuityLevelId: continuityLevel.id,
  continuityLevel,
  owner: 'Alice',
  createdAt: '2024-01-15T10:00:00Z',
};

const instances = [
  { id: 'i1', name: 'inst1', applicationId: 'a1', product: { name: 'VM' }, flavor: { name: 'Small' }, az: { code: 'eu-west-1a' }, status: 'RUNNING', environment: 'PRD', ipAddress: '10.0.0.1', description: null },
];

const forecasts = [
  { id: 'f1', applicationId: 'a1', status: 'APPROVED', environment: 'PRD', lines: [{ id: 'fl1' }], targetDate: '2024-12-01', requestedAt: '2024-01-01T00:00:00Z' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function setLoadingState() {
  mockUseApplication.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
  mockUseInstances.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseForecasts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: [continuityLevel], isLoading: false, isError: false });
}

function setErrorState() {
  mockUseApplication.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
  mockUseInstances.mockReturnValue({ data: instances, isLoading: false, isError: false });
  mockUseForecasts.mockReturnValue({ data: forecasts, isLoading: false, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: [continuityLevel], isLoading: false, isError: false });
}

function setLoadedState(
  app = application,
  insts = instances,
  fcs = forecasts
) {
  mockUseApplication.mockReturnValue({ data: app, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseInstances.mockReturnValue({ data: insts, isLoading: false, isError: false });
  mockUseForecasts.mockReturnValue({ data: fcs, isLoading: false, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: [continuityLevel], isLoading: false, isError: false });
}

function setNotFoundState() {
  mockUseApplication.mockReturnValue({ data: null, isLoading: false, isError: false, refetch: vi.fn() });
  mockUseInstances.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseForecasts.mockReturnValue({ data: [], isLoading: false, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: [continuityLevel], isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Application Detail Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('shows skeleton loaders while loading', () => {
      setLoadingState();
      const { container } = render(<ApplicationDetailPage />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders back link while loading', () => {
      setLoadingState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText(/back to applications/i)).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load application/i)).toBeInTheDocument();
    });
  });

  describe('Not Found State', () => {
    it('shows not found message when application does not exist', () => {
      setNotFoundState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Application not found')).toBeInTheDocument();
      expect(screen.getByText(/back to applications/i)).toBeInTheDocument();
    });
  });

  describe('Application Info', () => {
    it('renders application name and description', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Alpha App')).toBeInTheDocument();
      expect(screen.getByText('The first app')).toBeInTheDocument();
    });

    it('renders owner info card', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Owner')).toBeInTheDocument();
      const ownerCard = screen.getByText('Owner').closest('div')?.parentElement;
      expect(ownerCard?.textContent).toContain('Alice');
    });

    it('renders continuity level badge', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Continuity Level')).toBeInTheDocument();
      expect(screen.getAllByText('MODERATE').length).toBeGreaterThanOrEqual(1);
    });

    it('renders RTO / RPO values', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText(/480m \/ 60m/)).toBeInTheDocument();
    });

    it('renders created date', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Created')).toBeInTheDocument();
      const createdCard = screen.getByText('Created').closest('div')?.parentElement;
      expect(createdCard?.textContent).toContain('1/15/2024');
    });
  });

  describe('Resilience Profile', () => {
    it('renders resilience profile section when description exists', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Resilience Profile')).toBeInTheDocument();
      expect(screen.getByText('HA pair')).toBeInTheDocument();
    });
  });

  describe('Forecasts Section', () => {
    it('renders forecasts table with data', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Forecasts')).toBeInTheDocument();
      expect(screen.getByText('1 total')).toBeInTheDocument();
      // Status badge
      expect(screen.getByText('Approved')).toBeInTheDocument();
      // Environment badge
      expect(screen.getByText('Production')).toBeInTheDocument();
    });

    it('shows empty message when no forecasts', () => {
      setLoadedState(application, instances, []);
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText(/no forecasts for this application/i)).toBeInTheDocument();
    });
  });

  describe('Instances Section', () => {
    it('renders instances table with data', () => {
      setLoadedState();
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Instances')).toBeInTheDocument();
      expect(screen.getByText('1 total')).toBeInTheDocument();
      expect(screen.getByText('inst1')).toBeInTheDocument();
      expect(screen.getByText('10.0.0.1')).toBeInTheDocument();
    });

    it('shows empty message when no instances', () => {
      setLoadedState(application, [], forecasts);
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText(/no instances for this application/i)).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles null description gracefully', () => {
      setLoadedState({ ...application, description: null }, instances, forecasts);
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Alpha App')).toBeInTheDocument();
      expect(screen.getByText(/no description provided/i)).toBeInTheDocument();
    });

    it('handles missing continuity level gracefully', () => {
      setLoadedState({ ...application, continuityLevel: null, continuityLevelId: 'unknown' }, instances, forecasts);
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      expect(screen.getByText('Unknown')).toBeInTheDocument();
    });

    it('renders forecast with null targetDate as dash', () => {
      const fcs = [{ ...forecasts[0], targetDate: null }];
      setLoadedState(application, instances, fcs);
      render(<ApplicationDetailPage />, { wrapper: Wrapper });
      const forecastsSection = screen.getByText('Forecasts').closest('div')?.parentElement;
      expect(forecastsSection?.textContent).toContain('-');
    });
  });
});
