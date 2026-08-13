import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TopologyPage from '@/pages/Topology';

// ─── Mocks ────────────────────────────────────────────────────────────────

const mockUseTopology = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@/hooks/useApi', () => ({
  useTopology: () => mockUseTopology(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
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

const appNode = (id: string, name: string, continuityLevel: string, continuityColor: string, instanceCount: number) => ({
  id,
  name,
  type: 'APPLICATION' as const,
  continuityLevel,
  continuityColor,
  instanceCount,
});

const productNode = (id: string, name: string, category: string, instanceCount: number) => ({
  id,
  name,
  type: 'PRODUCT' as const,
  category,
  instanceCount,
});

const topologyData = {
  nodes: [
    appNode('a1', 'E-Commerce', 'SERIOUS', 'orange', 2),
    appNode('a2', 'Analytics', 'MODERATE', 'yellow', 1),
    appNode('a3', 'DevTools', 'LOW', 'green', 0),
    productNode('p1', 'VM Debian 12', 'Compute', 2),
    productNode('p2', 'Object Storage', 'Data', 1),
    productNode('p3', 'Load Balancer', 'Network', 0),
  ],
  edges: [
    { id: 'inst-a1-p1', source: 'a1', target: 'p1', type: 'INSTANCE' as const, label: 'uses' },
    { id: 'inst-a1-p2', source: 'a1', target: 'p2', type: 'INSTANCE' as const, label: 'uses' },
    { id: 'inst-a2-p1', source: 'a2', target: 'p1', type: 'INSTANCE' as const, label: 'uses' },
    { id: 'dep-p1-p2', source: 'p1', target: 'p2', type: 'DEPENDENCY' as const, label: 'required' },
    { id: 'rel-a1-a2', source: 'a1', target: 'a2', type: 'RELATED' as const, label: 'shared product' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────

function setLoadingState() {
  mockUseTopology.mockReturnValue({ data: undefined, isLoading: true, isError: false });
}

function setErrorState() {
  mockUseTopology.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
}

function setLoadedState(data = topologyData) {
  mockUseTopology.mockReturnValue({ data, isLoading: false, isError: false });
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Topology Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Loading State ────────────────────────────────────────────────────
  describe('Loading State', () => {
    it('shows skeleton loaders while data is loading', () => {
      setLoadingState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const skeletons = container.querySelectorAll('.animate-pulse-soft');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('renders page title even while loading', () => {
      setLoadingState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('Dependency Topology')).toBeInTheDocument();
    });

    it('renders description while loading', () => {
      setLoadingState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText(/interactive graph of application-to-application/i)).toBeInTheDocument();
    });
  });

  // ─── Error State ──────────────────────────────────────────────────────
  describe('Error State', () => {
    it('shows QueryError when loading fails', () => {
      setErrorState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText(/unable to load topology data/i)).toBeInTheDocument();
    });
  });

  // ─── Stats Cards ──────────────────────────────────────────────────────
  describe('Stats Cards', () => {
    it('renders all 5 stat cards', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      // Use getAllByText because labels also appear in filter buttons
      expect(screen.getAllByText('Applications').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Products').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('App→Product').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('Product→Product').length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText('App→App').length).toBeGreaterThanOrEqual(1);
    });

    it('shows correct application count', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      // First 'Applications' is in the stat cards grid
      const appCard = screen.getAllByText('Applications')[0].closest('div')?.parentElement;
      expect(appCard?.textContent).toContain('3');
    });

    it('shows correct product count', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const prodCard = screen.getAllByText('Products')[0].closest('div')?.parentElement;
      expect(prodCard?.textContent).toContain('3');
    });

    it('shows correct instance edge count', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const instCard = screen.getAllByText('App→Product')[0].closest('div')?.parentElement;
      expect(instCard?.textContent).toContain('3');
    });

    it('shows correct dependency edge count', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const depCard = screen.getAllByText('Product→Product')[0].closest('div')?.parentElement;
      expect(depCard?.textContent).toContain('1');
    });

    it('shows correct related edge count', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const relCard = screen.getAllByText('App→App')[0].closest('div')?.parentElement;
      expect(relCard?.textContent).toContain('1');
    });

    it('shows zero counts for empty topology', () => {
      setLoadedState({ nodes: [], edges: [] });
      render(<TopologyPage />, { wrapper: Wrapper });
      const appCard = screen.getAllByText('Applications')[0].closest('div')?.parentElement;
      expect(appCard?.textContent).toContain('0');
    });
  });

  // ─── Filter Controls ──────────────────────────────────────────────────
  describe('Filter Controls', () => {
    it('renders node filter buttons', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByRole('button', { name: /Applications/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Products/i })).toBeInTheDocument();
    });

    it('renders edge filter buttons', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByRole('button', { name: /App→Product/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Product→Product/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /App→App/i })).toBeInTheDocument();
    });

    it('renders zoom and reset controls', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByTitle('Zoom in')).toBeInTheDocument();
      expect(screen.getByTitle('Zoom out')).toBeInTheDocument();
      expect(screen.getByTitle('Reset view')).toBeInTheDocument();
    });

    it('toggles Applications filter off when clicked', async () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const appBtn = screen.getByRole('button', { name: /Applications/i });
      await userEvent.click(appBtn);
      // After clicking, the button should reflect off state
      expect(appBtn).toHaveClass('bg-slate-800');
    });

    it('toggles Products filter off when clicked', async () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const prodBtn = screen.getByRole('button', { name: /Products/i });
      await userEvent.click(prodBtn);
      expect(prodBtn).toHaveClass('bg-slate-800');
    });

    it('toggles App→App related edges on when clicked', async () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      const relBtn = screen.getByRole('button', { name: /App→App/i });
      // Initially off (hidden by default)
      expect(relBtn).toHaveClass('bg-slate-800');
      await userEvent.click(relBtn);
      // After clicking, should be active
      expect(relBtn).toHaveClass('bg-slate-500/10');
    });
  });

  // ─── Graph Rendering ──────────────────────────────────────────────────
  describe('Graph Rendering', () => {
    it('renders an SVG element', () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('renders nodes as circles in the SVG', () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const circles = container.querySelectorAll('circle');
      // Each node has 2 circles (glow + body) = 6 nodes * 2 = 12, plus some edge cases
      expect(circles.length).toBeGreaterThanOrEqual(6);
    });

    it('renders node labels', () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const textElements = container.querySelectorAll('text');
      const labels = Array.from(textElements).map((t) => t.textContent);
      expect(labels.some((l) => l?.includes('E-Commerce'))).toBe(true);
      expect(labels.some((l) => l?.includes('VM Debian 12'))).toBe(true);
    });

    it('renders edge lines', () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const lines = container.querySelectorAll('line');
      // 3 instance + 1 dependency + 1 related = 5 edges
      expect(lines.length).toBeGreaterThanOrEqual(5);
    });

    it('hides application nodes when Apps filter is off', async () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const appBtn = screen.getByRole('button', { name: /Applications/i });
      await userEvent.click(appBtn);
      // Scope to the graph SVG only (ignore icons in filter buttons/legend)
      const graphSvg = container.querySelector('svg[viewBox="0 0 900 600"]');
      const circles = graphSvg?.querySelectorAll('circle') || [];
      // Only product nodes remain: 3 products * 2 circles = 6
      expect(circles.length).toBe(6);
    });

    it('hides product nodes when Products filter is off', async () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const prodBtn = screen.getByRole('button', { name: /Products/i });
      await userEvent.click(prodBtn);
      const graphSvg = container.querySelector('svg[viewBox="0 0 900 600"]');
      const circles = graphSvg?.querySelectorAll('circle') || [];
      // Only app nodes remain: 3 apps * 2 circles = 6
      expect(circles.length).toBe(6);
    });

    it('hides all nodes when both filters are off', async () => {
      setLoadedState();
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      await userEvent.click(screen.getByRole('button', { name: /Applications/i }));
      await userEvent.click(screen.getByRole('button', { name: /Products/i }));
      const graphSvg = container.querySelector('svg[viewBox="0 0 900 600"]');
      const circles = graphSvg?.querySelectorAll('circle') || [];
      expect(circles.length).toBe(0);
    });
  });

  // ─── Legend ───────────────────────────────────────────────────────────
  describe('Legend', () => {
    it('renders legend section', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('Legend')).toBeInTheDocument();
    });

    it('shows node type legend items', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('Application')).toBeInTheDocument();
      expect(screen.getByText('Product')).toBeInTheDocument();
    });

    it('shows continuity level colors', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('green')).toBeInTheDocument();
      expect(screen.getByText('yellow')).toBeInTheDocument();
      expect(screen.getByText('orange')).toBeInTheDocument();
      expect(screen.getByText('red')).toBeInTheDocument();
    });

    it('shows edge type descriptions', () => {
      setLoadedState();
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('App uses Product')).toBeInTheDocument();
      expect(screen.getByText('Product depends on Product')).toBeInTheDocument();
      expect(screen.getByText('Apps share Product')).toBeInTheDocument();
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────
  describe('Edge Cases', () => {
    it('handles empty topology gracefully', () => {
      setLoadedState({ nodes: [], edges: [] });
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('Dependency Topology')).toBeInTheDocument();
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('handles topology with only applications', () => {
      setLoadedState({
        nodes: [appNode('a1', 'Solo App', 'LOW', 'green', 0)],
        edges: [],
      });
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('Solo App')).toBeInTheDocument();
    });

    it('handles topology with only products', () => {
      setLoadedState({
        nodes: [productNode('p1', 'Solo Product', 'Compute', 0)],
        edges: [],
      });
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('Solo Product')).toBeInTheDocument();
    });

    it('handles nodes with missing continuityColor', () => {
      setLoadedState({
        nodes: [
          { id: 'a1', name: 'NoColor', type: 'APPLICATION', continuityLevel: 'UNKNOWN', instanceCount: 0 },
        ],
        edges: [],
      });
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('NoColor')).toBeInTheDocument();
    });

    it('handles nodes with missing category', () => {
      setLoadedState({
        nodes: [
          { id: 'p1', name: 'NoCategory', type: 'PRODUCT', instanceCount: 0 },
        ],
        edges: [],
      });
      render(<TopologyPage />, { wrapper: Wrapper });
      expect(screen.getByText('NoCategory')).toBeInTheDocument();
    });

    it('handles very long node names by truncating', () => {
      setLoadedState({
        nodes: [
          appNode('a1', 'This is a very long application name that should be truncated', 'LOW', 'green', 1),
        ],
        edges: [],
      });
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const textElements = container.querySelectorAll('text');
      const labels = Array.from(textElements).map((t) => t.textContent);
      expect(labels.some((l) => l?.includes('…'))).toBe(true);
    });

    it('handles nodes with zero instances', () => {
      setLoadedState({
        nodes: [
          appNode('a1', 'ZeroInst', 'LOW', 'green', 0),
        ],
        edges: [],
      });
      render(<TopologyPage />, { wrapper: Wrapper });
      const appCard = screen.getAllByText('Applications')[0].closest('div')?.parentElement;
      expect(appCard?.textContent).toContain('1');
    });

    it('handles multiple edges between same node pair', () => {
      setLoadedState({
        nodes: [
          appNode('a1', 'App1', 'LOW', 'green', 1),
          productNode('p1', 'Prod1', 'Compute', 1),
        ],
        edges: [
          { id: 'e1', source: 'a1', target: 'p1', type: 'INSTANCE', label: 'uses' },
          { id: 'e2', source: 'a1', target: 'p1', type: 'INSTANCE', label: 'uses' },
        ],
      });
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      // Scope to graph SVG to avoid legend/edge-style divs with lines
      const graphSvg = container.querySelector('svg[viewBox="0 0 900 600"]');
      const lines = graphSvg?.querySelectorAll('line') || [];
      expect(lines.length).toBe(2);
    });

    it('navigates to application detail on app node click', async () => {
      setLoadedState({
        nodes: [appNode('a1', 'ClickableApp', 'LOW', 'green', 1)],
        edges: [],
      });
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const nodeGroup = container.querySelector('g.cursor-pointer');
      expect(nodeGroup).toBeInTheDocument();
      if (nodeGroup) {
        await userEvent.click(nodeGroup);
      }
      expect(mockNavigate).toHaveBeenCalledWith('/applications/a1');
    });

    it('navigates to marketplace on product node click', async () => {
      setLoadedState({
        nodes: [productNode('p1', 'ClickableProd', 'Compute', 1)],
        edges: [],
      });
      const { container } = render(<TopologyPage />, { wrapper: Wrapper });
      const nodeGroup = container.querySelector('g.cursor-pointer');
      expect(nodeGroup).toBeInTheDocument();
      if (nodeGroup) {
        await userEvent.click(nodeGroup);
      }
      expect(mockNavigate).toHaveBeenCalledWith('/marketplace');
    });
  });
});
