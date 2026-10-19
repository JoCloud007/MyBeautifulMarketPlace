import { useState } from 'react';
import {
  Package,
  Layers,
  Box,
  Boxes,
  Cpu,
  Monitor,
  Network,
  Globe,
  MapPin,
  Shield,
  ShieldCheck,
  TrendingUp,
  Activity,
  UserCog,
  BarChart3,
  Link2,
  ArrowRightLeft,
  ServerCog,
  Workflow,
  ChevronRight,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// ============ ADMIN ARCHITECTURE VIEW ============
// Pedagogical dependency & workflow map of the CloudMarket data model.
// Purely static SVG (no external graph library), boxes navigate to admin tabs.

interface NodeSpec {
  id: string;
  label: string;
  table: string;
  note: string;
  icon: typeof Package;
  tab?: string; // admin tab value to navigate to
}

interface BandSpec {
  id: string;
  title: string;
  color: string;
  border: string;
  nodes: NodeSpec[];
}

const BANDS: BandSpec[] = [
  {
    id: 'catalog',
    title: '1 · Product catalogue',
    color: '#60a5fa',
    border: '#1e3a5f',
    nodes: [
      { id: 'category', label: 'Category', table: 'Category', note: 'Groups products (Compute, Data, Network…)', icon: Layers, tab: 'categories' },
      { id: 'flavor-profile', label: 'FlavorProfile', table: 'FlavorProfile', note: 'CPU/RAM/storage shape of a flavor', icon: Boxes, tab: 'flavor-profiles' },
      { id: 'flavor', label: 'Flavor', table: 'Flavor', note: 'Machine size (Small, Medium…) → profile', icon: Cpu, tab: 'flavors' },
      { id: 'product', label: 'Product', table: 'Product', note: 'A commercial product in the catalogue', icon: Package, tab: 'products' },
      { id: 'product-version', label: 'ProductVersion', table: 'ProductVersion', note: 'Versioned lifecycle (release/EOL dates)', icon: Box, tab: 'product-versions' },
      { id: 'os', label: 'OS / OsVersion', table: 'OsVersion', note: 'Guest OS families and their versions', icon: Monitor, tab: 'os' },
      { id: 'variant', label: 'ProductVariant', table: 'ProductVariant', note: 'The SKU: Product × Flavor × OS version', icon: Network, tab: 'variants' },
    ],
  },
  {
    id: 'geo',
    title: '2 · Geography & infra',
    color: '#34d399',
    border: '#14532d',
    nodes: [
      { id: 'country', label: 'Country', table: '—', note: 'ISO country code (derived from AZ city)', icon: Globe, tab: 'availability-zones' },
      { id: 'region', label: 'Region', table: 'Region', note: 'Commercial/technical region', icon: Globe, tab: 'regions' },
      { id: 'zone', label: 'Zone', table: 'Zone', note: 'Sub-region grouping AZs', icon: Box, tab: 'zones' },
      { id: 'az', label: 'AvailabilityZone', table: 'AvailabilityZone', note: 'Physical AZ — the unit of availability', icon: MapPin, tab: 'availability-zones' },
      { id: 'infra-version', label: 'InfraVersion', table: 'InfraVersion', note: 'Infra lifecycle hosted per AZ', icon: Boxes, tab: 'infra-versions' },
    ],
  },
  {
    id: 'availability',
    title: '3 · Availability & rules — how “is it available?” is decided',
    color: '#fbbf24',
    border: '#78350f',
    nodes: [
      { id: 'm2m', label: 'Static M2M joins', table: 'productRegions, variantAvailabilityZones…', note: 'Product/Version/Variant/Flavor × Region/Zone/AZ', icon: Link2 },
      { id: 'schedule', label: 'AvailabilitySchedule', table: 'AvailabilitySchedule', note: 'Time windows + status: STANDARD / RESTRICTED / ON_DEMAND', icon: BarChart3 },
      { id: 'resiliency-rules', label: 'ResiliencyLevel + Scope', table: 'ResiliencyLevelConfig, ResiliencyScope', note: 'rank/minAz + allow/deny rules, precedence FLAVOR > AZ > ZONE > REGION', icon: ShieldCheck, tab: 'resiliency' },
    ],
  },
  {
    id: 'consumption',
    title: '4 · Consumption — demand → provisioning',
    color: '#a78bfa',
    border: '#4c1d95',
    nodes: [
      { id: 'user', label: 'User', table: 'User', note: 'REQUESTER / TECH_LEAD / MANAGER / FINANCE / ADMIN', icon: UserCog, tab: 'users' },
      { id: 'forecast', label: 'Forecast', table: 'Forecast', note: 'A capacity request in a workflow state', icon: Activity, tab: 'forecasts' },
      { id: 'forecast-line', label: 'ForecastLine', table: 'ForecastLine', note: 'One line: product/variant/flavor + AZs + resiliency', icon: ArrowRightLeft, tab: 'forecasts' },
      { id: 'instance', label: 'Instance', table: 'Instance', note: 'Provisioned instance of an approved line', icon: ServerCog },
      { id: 'application', label: 'Application', table: 'Application', note: 'Business app owning instances', icon: Shield, tab: 'applications' },
      { id: 'continuity', label: 'ContinuityLevel', table: 'ContinuityLevel', note: 'RTO/RPO objectives of the application', icon: TrendingUp, tab: 'continuity-levels' },
    ],
  },
];

interface WorkflowStep {
  status: string;
  label: string;
  role: string;
}

const FORECAST_FLOW: WorkflowStep[] = [
  { status: 'DRAFT', label: 'Draft', role: 'REQUESTER' },
  { status: 'PENDING_TECH', label: 'Technical review', role: 'TECH_LEAD' },
  { status: 'PENDING_MANAGER', label: 'Manager approval', role: 'MANAGER' },
  { status: 'PENDING_BUDGET', label: 'Budget validation', role: 'FINANCE' },
  { status: 'APPROVED', label: 'Approved', role: '—' },
];

const RESOLUTION_FLOW: WorkflowStep[] = [
  { status: 'Input', label: 'product + flavor + selected AZs', role: 'ForecastLine' },
  { status: 'M2M joins', label: 'static availability joins', role: 'Product/Variant × Region/Zone/AZ' },
  { status: 'Schedule', label: 'AvailabilitySchedule windows', role: 'STANDARD / RESTRICTED / ON_DEMAND' },
  { status: 'Resiliency', label: 'resolveAllowedResiliency()', role: 'FLAVOR > AZ > ZONE > REGION' },
  { status: 'Output', label: 'allowed levels + status', role: 'fit verdict' },
];

export default function AdminArchitecture({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const [hovered, setHovered] = useState<NodeSpec | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
          <Network className="h-6 w-6 text-blue-400" />
          Architecture — data model &amp; workflows
        </h2>
        <p className="mt-1 text-slate-400">
          How CloudMarket objects relate to each other and how a request flows through the platform. Click any box to open its admin section.
        </p>
      </div>

      {/* Dependency bands */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Dependency map</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="min-w-[720px] space-y-4">
              {BANDS.map((band) => (
                <div
                  key={band.id}
                  className="rounded-xl p-3 border"
                  style={{ borderColor: band.border, background: 'rgba(15,23,42,0.6)' }}
                >
                  <div className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: band.color }}>
                    {band.title}
                  </div>
                  <div className="flex flex-wrap items-stretch gap-2">
                    {band.nodes.map((node, i) => {
                      const Icon = node.icon;
                      return (
                        <div key={node.id} className="flex items-center gap-2">
                          <button
                            type="button"
                            onMouseEnter={() => setHovered(node)}
                            onMouseLeave={() => setHovered((h) => (h?.id === node.id ? null : h))}
                            onFocus={() => setHovered(node)}
                            onBlur={() => setHovered((h) => (h?.id === node.id ? null : h))}
                            onClick={() => node.tab && onNavigate(node.tab)}
                            className={`group flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                              node.tab
                                ? 'cursor-pointer hover:-translate-y-0.5 hover:border-blue-400'
                                : 'cursor-default'
                            } ${reduceMotion ? '' : 'transition-transform'}`}
                            style={{ borderColor: band.color + '55', background: '#1e293b', minWidth: 150 }}
                          >
                            <span className="flex items-center gap-1.5 text-sm font-semibold text-white">
                              <Icon className="h-3.5 w-3.5" style={{ color: band.color }} />
                              {node.label}
                            </span>
                            <span className="text-[11px] leading-tight text-slate-400">{node.note}</span>
                            {node.tab && (
                              <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-blue-400 opacity-0 transition-opacity group-hover:opacity-100">
                                Open section <ChevronRight className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                          {i < band.nodes.length - 1 && (
                            <span aria-hidden className="text-slate-600">→</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tooltip */}
          {hovered && (
            <div className="mt-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-300">
              <span className="font-semibold text-white">{hovered.label}</span>
              {hovered.table !== '—' && <span className="text-slate-500"> · Prisma: {hovered.table}</span>}
              <div className="text-slate-400">{hovered.note}</div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Forecast workflow */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Workflow className="h-5 w-5 text-violet-400" />
            Workflow — forecast request lifecycle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex min-w-[720px] items-center gap-2">
              {FORECAST_FLOW.map((step, i) => (
                <div key={step.status} className="flex items-center gap-2">
                  <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">
                    <div className="text-xs font-semibold text-white">{step.status}</div>
                    <div className="text-[11px] text-slate-400">{step.label}</div>
                    <div className="text-[10px] text-slate-500">{step.role}</div>
                  </div>
                  {i < FORECAST_FLOW.length - 1 && <ChevronRight className="h-4 w-4 text-slate-600" />}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            REJECTED (mandatory reason) → RESUBMIT → PENDING_TECH · CANCELLED by the requester at any pre-approval step · every transition is tracked in <span className="text-slate-300">ForecastTransition</span>.
          </p>
        </CardContent>
      </Card>

      {/* Availability resolution flow */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <BarChart3 className="h-5 w-5 text-amber-400" />
            Flow — availability resolution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="flex min-w-[720px] items-center gap-2">
              {RESOLUTION_FLOW.map((step, i) => (
                <div key={step.status} className="flex items-center gap-2">
                  <div className="rounded-lg border border-amber-500/30 bg-slate-950 px-3 py-2">
                    <div className="text-xs font-semibold text-amber-300">{step.status}</div>
                    <div className="text-[11px] text-slate-300">{step.label}</div>
                    <div className="text-[10px] text-slate-500">{step.role}</div>
                  </div>
                  {i < RESOLUTION_FLOW.length - 1 && <ChevronRight className="h-4 w-4 text-slate-600" />}
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            Precedence: a rule on FLAVOR beats AZ beats ZONE beats REGION. Multiple AZs are intersected; a level is allowed only if every selected AZ admits it (minAz enforced on the forecast line).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
