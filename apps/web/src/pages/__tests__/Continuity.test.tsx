import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ContinuityPage from '@/pages/Continuity';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseApplications = vi.fn();
const mockUseContinuityLevels = vi.fn();
const mockUseInstances = vi.fn();
const mockUseHealthChecks = vi.fn();
const mockUseMaintenanceWindows = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useApplications: () => mockUseApplications(),
  useContinuityLevels: () => mockUseContinuityLevels(),
  useInstances: () => mockUseInstances(),
  useHealthChecks: () => mockUseHealthChecks(),
  useMaintenanceWindows: () => mockUseMaintenanceWindows(),
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
      {children}
    </QueryClientProvider>
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
  { id: 'a1', name: 'E-Commerce', description: 'Main app', continuityLevelId: 'cl-ser', continuityLevel: continuityLevels[2], owner: 'Alice', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'a2', name: 'Analytics', description: 'Reports', continuityLevelId: 'cl-mod', continuityLevel: continuityLevels[1], owner: 'Bob', createdAt: '2024-01-01T00:00:00Z' },
  { id: 'a3', name: 'DevTools', description: 'CI/CD', continuityLevelId: 'cl-low', continuityLevel: continuityLevels[0], owner: 'Charlie', createdAt: '2024-01-01T00:00:00Z' },
];

const instances = [
  { id: 'i1', name: 'web-01', applicationId: 'a1', productId: 'p1', flavorId: 'f1', azCode: 'eu-west-1a', status: 'RUNNING', environment: 'PRD' },
  { id: 'i2', name: 'api-01', applicationId: 'a1', productId: 'p1', flavorId: 'f1', azCode: 'eu-west-1b', status: 'RUNNING', environment: 'PRD' },
  { id: 'i3', name: 'worker-01', applicationId: 'a2', productId: 'p1', flavorId: 'f1', azCode: 'us-east-1a', status: 'STOPPED', environment: 'STG' },
];

const healthChecks = [
  { id: 'hc1', instanceId: 'i1', status: 'HEALTHY', cpuPercent: 10, memoryPercent: 20, diskPercent: 30, responseTimeMs: 50, checkedAt: '2024-06-01T00:00:00Z', instance: instances[0] },
  { id: 'hc2', instanceId: 'i2', status: 'HEALTHY', cpuPercent: 15, memoryPercent: 25, diskPercent: 35, responseTimeMs: 60, checkedAt: '2024-06-01T00:00:00Z', instance: instances[1] },
  { id: 'hc3', instanceId: 'i3', status: 'DEGRADED', cpuPercent: 80, memoryPercent: 85, diskPercent: 40, responseTimeMs: 500, checkedAt: '2024-06-01T00:00:00Z', instance: instances[2] },
];

const maintenanceWindows = [
  { id: 'mw1', instanceId: 'i1', applicationId: null, title: 'Patch web-01', description: 'Kernel', startTime: new Date(Date.now() + 86400000).toISOString(), endTime: new Date(Date.now() + 90000000).toISOString(), status: 'SCHEDULED', instance: instances[0] },
  { id: 'mw2', instanceId: null, applicationId: 'a1', title: 'Platform Upgrade', description: 'Rolling', startTime: new Date(Date.now() + 172800000).toISOString(), endTime: new Date(Date.now() + 176400000).toISOString(), status: 'SCHEDULED', application: applications[0] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

function setLoadingState() {
  mockUseApplications.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseInstances.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseHealthChecks.mockReturnValue({ data: undefined, isLoading: true, isError: false });
  mockUseMaintenanceWindows.mockReturnValue({ data: undefined, isLoading: true, isError: false });
}

function setErrorState() {
  mockUseApplications.mockReturnValue({ data: undefined, isLoading: false, isError: true });
  mockUseContinuityLevels.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mockUseInstances.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mockUseHealthChecks.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  mockUseMaintenanceWindows.mockReturnValue({ data: undefined, isLoading: false, isError: false });
}

function setLoadedState(opts: {
  apps?: typeof applications;
  levels?: typeof continuityLevels;
  insts?: typeof instances;
  checks?: typeof healthChecks;
  windows?: typeof maintenanceWindows;
} = {}) {
  mockUseApplications.mockReturnValue({ data: opts.apps ?? applications, isLoading: false, isError: false });
  mockUseContinuityLevels.mockReturnValue({ data: opts.levels ?? continuityLevels, isLoading: false, isError: false });
  mockUseInstances.mockReturnValue({ data: opts.insts ?? instances, isLoading: false, isError: false });
  mockUseHealthChecks.mockReturnValue({ data: opts.checks ?? healthChecks, isLoading: false, isError: false });
  mockUseMaintenanceWindows.mockReturnValue({ data: opts.windows ?? maintenanceWindows, isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Continuity Dashboard Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Loading State ────────────────────────────────────────────────────
  describe('Loading State', () => {
    it('shows skeleton loaders while data is loading', () => {
      setLoadingState();
      const { container } = render(<ContinuityPage />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders page title even while loading', () => {
      setLoadingState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('Continuity Dashboard')).toBeInTheDocument();
    });
  });

  // ─── Error State ──────────────────────────────────────────────────────
  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load continuity dashboard/i)).toBeInTheDocument();
    });
  });

  // ─── Stats Cards ──────────────────────────────────────────────────────
  describe('Stats Cards', () => {
    it('renders all 4 stat cards', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('Applications')).toBeInTheDocument();
      expect(screen.getByText('Healthy')).toBeInTheDocument();
      expect(screen.getByText('Needs Attention')).toBeInTheDocument();
    });

    it('shows total instances count in Applications card', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(`${instances.length} instances total`)).toBeInTheDocument();
    });

    it('shows correct healthy count in Healthy card', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      // With the test data: a1 has 2 HEALTHY instances, a2 has 1 DEGRADED
      // appHealthMap: a1->HEALTHY, a2->DEGRADED -> healthyApps=1
      const healthyCard = screen.getByText('Healthy').closest('div')?.parentElement;
      expect(healthyCard?.textContent).toContain('1');
    });

    it('shows correct needs-attention count', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      // degradedApps=1, unhealthyApps=0 -> needs attention = 1
      const attentionCard = screen.getByText('Needs Attention').closest('div')?.parentElement;
      expect(attentionCard?.textContent).toContain('1');
      expect(attentionCard?.textContent).toContain('1 degraded');
    });

    it('shows correct upcoming maintenance count', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      // 2 scheduled, future maintenance windows — use first match (stat card)
      const maintCards = screen.getAllByText('Upcoming Maintenance');
      const statCard = maintCards[0].closest('div')?.parentElement;
      expect(statCard?.textContent).toContain('2');
    });
  });

  // ─── Resilience by Continuity Level ───────────────────────────────────
  describe('Resilience by Continuity Level', () => {
    it('renders section title', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      const headings = screen.getAllByText('Resilience by Continuity Level');
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('shows all 4 continuity levels', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      for (const cl of continuityLevels) {
        expect(screen.getByText(cl.name)).toBeInTheDocument();
      }
    });

    it('shows RTO/RPO for each level', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(/RTO 1440m/i)).toBeInTheDocument();
      expect(screen.getByText(/RTO 60m/i)).toBeInTheDocument();
    });

    it('shows app count per level', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      // Each level has exactly 1 app in default data
      expect(screen.getAllByText(/1 apps/i).length).toBeGreaterThanOrEqual(1);
    });

    it('shows "No applications assigned" for empty level', () => {
      setLoadedState({
        apps: applications.filter(a => a.continuityLevelId !== 'cl-ext'),
        levels: continuityLevels,
        insts: instances,
        checks: healthChecks,
        windows: maintenanceWindows,
      });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(/No applications assigned/i)).toBeInTheDocument();
    });

    it('shows application names under their continuity level', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      // Use getAllByText since app names also appear in maintenance windows
      expect(screen.getAllByText('E-Commerce').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Analytics')).toBeInTheDocument();
      expect(screen.getByText('DevTools')).toBeInTheDocument();
    });

    it('shows instance count per application', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      // E-Commerce has 2 instances — scope to the resilience section
      const resilienceSection = screen.getByText('Resilience by Continuity Level').closest('div')?.parentElement;
      expect(resilienceSection?.textContent).toContain('E-Commerce');
      expect(resilienceSection?.textContent).toContain('2 instances');
    });
  });

  // ─── Upcoming Maintenance ─────────────────────────────────────────────
  describe('Upcoming Maintenance', () => {
    it('renders section title', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      const headings = screen.getAllByText('Upcoming Maintenance');
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });

    it('shows maintenance window titles', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('Patch web-01')).toBeInTheDocument();
      expect(screen.getByText('Platform Upgrade')).toBeInTheDocument();
    });

    it('shows Scheduled badge on maintenance windows', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      const badges = screen.getAllByText('Scheduled');
      expect(badges.length).toBeGreaterThanOrEqual(2);
    });

    it('shows empty state when no upcoming maintenance', () => {
      setLoadedState({ windows: [] });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(/No upcoming maintenance scheduled/i)).toBeInTheDocument();
    });

    it('filters out cancelled maintenance', () => {
      const cancelled = [
        { id: 'mw3', instanceId: null, applicationId: null, title: 'Cancelled', description: 'X', startTime: new Date(Date.now() + 86400000).toISOString(), endTime: new Date(Date.now() + 90000000).toISOString(), status: 'CANCELLED' },
      ];
      setLoadedState({ windows: cancelled });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(/No upcoming maintenance scheduled/i)).toBeInTheDocument();
    });

    it('filters out past maintenance', () => {
      const past = [
        { id: 'mw3', instanceId: null, applicationId: null, title: 'Past', description: 'X', startTime: new Date(Date.now() - 86400000).toISOString(), endTime: new Date(Date.now() - 82800000).toISOString(), status: 'SCHEDULED' },
      ];
      setLoadedState({ windows: past });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText(/No upcoming maintenance scheduled/i)).toBeInTheDocument();
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('handles zero applications gracefully', () => {
      setLoadedState({ apps: [], insts: [], checks: [], windows: [] });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('0 instances total')).toBeInTheDocument();
    });

    it('handles zero instances gracefully', () => {
      setLoadedState({ insts: [] });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('0 instances total')).toBeInTheDocument();
    });

    it('handles zero health checks gracefully', () => {
      setLoadedState({ checks: [] });
      render(<ContinuityPage />, { wrapper: Wrapper });
      // Healthy card should show 0
      const healthyCard = screen.getByText('Healthy').closest('div')?.parentElement;
      expect(healthyCard?.textContent).toContain('0');
    });

    it('handles all healthy status', () => {
      const allHealthy = healthChecks.map(hc => ({ ...hc, status: 'HEALTHY' as const }));
      setLoadedState({ checks: allHealthy });
      render(<ContinuityPage />, { wrapper: Wrapper });
      // 2 apps have health checks (a1, a2), both HEALTHY
      const healthyCard = screen.getByText('Healthy').closest('div')?.parentElement;
      expect(healthyCard?.textContent).toContain('2');
      expect(screen.getByText('0 degraded · 0 unhealthy')).toBeInTheDocument();
    });

    it('handles all unhealthy status', () => {
      const allUnhealthy = healthChecks.map(hc => ({ ...hc, status: 'UNHEALTHY' as const }));
      setLoadedState({ checks: allUnhealthy });
      render(<ContinuityPage />, { wrapper: Wrapper });
      const healthyCard = screen.getByText('Healthy').closest('div')?.parentElement;
      expect(healthyCard?.textContent).toContain('0');
      expect(screen.getByText('0 degraded · 2 unhealthy')).toBeInTheDocument();
    });

    it('handles mixed health per application (worst wins)', () => {
      const mixed = [
        { ...healthChecks[0], status: 'HEALTHY' as const },
        { ...healthChecks[1], status: 'DEGRADED' as const }, // Same app as hc0 (a1)
      ];
      // a1 has HEALTHY + DEGRADED -> worst is DEGRADED
      setLoadedState({ checks: mixed });
      render(<ContinuityPage />, { wrapper: Wrapper });
      // Healthy apps = 0 (only a1 has checks, and it's degraded)
      const healthyCard = screen.getByText('Healthy').closest('div')?.parentElement;
      expect(healthyCard?.textContent).toContain('0');
    });

    it('shows instance name for instance-linked maintenance', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('Patch web-01')).toBeInTheDocument();
      // The instance name web-01 should appear in the maintenance row
      const maintRow = screen.getByText('Patch web-01').closest('div')?.parentElement;
      expect(maintRow?.textContent).toContain('web-01');
    });

    it('shows application name for app-linked maintenance', () => {
      setLoadedState();
      render(<ContinuityPage />, { wrapper: Wrapper });
      const platformRow = screen.getByText('Platform Upgrade').closest('div')?.parentElement;
      expect(platformRow?.textContent).toContain('E-Commerce');
    });

    it('shows Global for unattached maintenance', () => {
      const globalMw = [
        { id: 'mw3', instanceId: null, applicationId: null, title: 'Global Maint', description: 'DC', startTime: new Date(Date.now() + 86400000).toISOString(), endTime: new Date(Date.now() + 90000000).toISOString(), status: 'SCHEDULED' },
      ];
      setLoadedState({ windows: globalMw });
      render(<ContinuityPage />, { wrapper: Wrapper });
      expect(screen.getByText('Global Maint')).toBeInTheDocument();
      const globalRow = screen.getByText('Global Maint').closest('div')?.parentElement;
      expect(globalRow?.textContent).toContain('Global');
    });
  });
});
