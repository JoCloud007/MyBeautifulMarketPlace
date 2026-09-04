import { useState, useMemo, useRef, useEffect } from 'react';
import { useOperatingSystems, useProducts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Filter, ChevronDown, ChevronRight, BarChart3, Table,
} from 'lucide-react';
import type { OsVersion, LifecyclePhase, OperatingSystem, Product, ProductVariant } from '@cloudmarket/shared-types';

/* ── Phase config ──────────────────────────────────────────────── */

const phaseConfig: Record<LifecyclePhase, { label: string; color: string; bg: string; border: string }> = {
  RELEASED: { label: 'Released', color: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30' },
  NORMAL_SUPPORT: { label: 'Normal Support', color: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500/30' },
  EXTENDED_SUPPORT: { label: 'Extended Support', color: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30' },
  NO_SUPPORT: { label: 'No Support', color: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/30' },
  EOL: { label: 'End of Life', color: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30' },
};

const familyConfig: Record<string, { label: string; color: string; bg: string }> = {
  LINUX: { label: 'LINUX', color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/30' },
  WINDOWS: { label: 'WINDOWS', color: 'text-sky-400', bg: 'bg-sky-500/10 border-sky-500/30' },
  HYPERVISOR: { label: 'HYPERVISOR', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' },
  DEBIAN: { label: 'DEBIAN', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' },
  REDHAT: { label: 'REDHAT', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30' },
};

function getFamilyLabel(family: string | null) {
  return familyConfig[family || ''] || { label: family || 'OTHER', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' };
}

const defaultPhaseConfig = { label: 'Unknown', color: 'text-slate-400', bg: 'bg-slate-500', border: 'border-slate-500/30' };

function getPhaseConfig(phase: LifecyclePhase | string | undefined) {
  return phaseConfig[phase as LifecyclePhase] ?? defaultPhaseConfig;
}

/* ── Axis config ───────────────────────────────────────────────── */

type Axis = 'FAMILY' | 'OS' | 'PHASE' | 'VERSION';

const axisLabels: Record<Axis, string> = {
  FAMILY: 'Family',
  OS: 'OS',
  PHASE: 'Phase',
  VERSION: 'Version',
};

/* ── Unified Roadmap Version ───────────────────────────────────── */

interface RoadmapVersion {
  id: string;
  name: string;
  releaseDate: string;
  normalSupportEnd: string;
  extendedSupportEnd: string;
  eolDate: string;
  phase: LifecyclePhase;
  family: string;
  group: string;
  type: 'os' | 'product';
}

function osVersionToRoadmap(os: OperatingSystem, version: OsVersion): RoadmapVersion {
  return {
    id: version.id,
    name: version.version,
    releaseDate: version.releaseDate,
    normalSupportEnd: version.normalSupportEnd,
    extendedSupportEnd: version.extendedSupportEnd,
    eolDate: version.eolDate,
    phase: version.phase,
    family: os.family || 'OTHER',
    group: os.name,
    type: 'os',
  };
}

function productVariantToRoadmap(product: Product, variant: ProductVariant): RoadmapVersion {
  return {
    id: variant.id,
    name: variant.name,
    releaseDate: variant.releaseDate || product.createdAt,
    normalSupportEnd: variant.normalSupportEnd || variant.eolDate || product.createdAt,
    extendedSupportEnd: variant.extendedSupportEnd || variant.eolDate || product.createdAt,
    eolDate: variant.eolDate || product.createdAt,
    phase: variant.phase,
    family: product.category?.name || product.name,
    group: product.name,
    type: 'product',
  };
}

const axisOptions: { value: Axis; label: string }[] = [
  { value: 'FAMILY', label: 'Family' },
  { value: 'OS', label: 'OS' },
  { value: 'PHASE', label: 'Phase' },
  { value: 'VERSION', label: 'Version' },
];

type ViewMode = 'grouped' | 'flat';

/* ── AnimatedSection ───────────────────────────────────────────── */

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className || ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ── PickUpList (reused from Matrix) ───────────────────────────── */

function PickUpList<T extends string>({
  options,
  value,
  onChange,
  color = 'slate',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  color?: 'slate' | 'blue' | 'purple';
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const colorMap = {
    slate: { btn: 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700' },
    blue: { btn: 'bg-blue-500/10 border-blue-500/30 text-blue-400 hover:bg-blue-500/20' },
    purple: { btn: 'bg-purple-500/10 border-purple-500/30 text-purple-400 hover:bg-purple-500/20' },
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${colorMap[color].btn}`}
      >
        {options.find((o) => o.value === value)?.label || value}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[120px] rounded-md border border-slate-600 bg-slate-950 shadow-2xl py-1">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${
                opt.value === value ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-950 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Gantt Bar ─────────────────────────────────────────────────── */

function GanttBar({ version, yearStart, yearEnd }: { version: RoadmapVersion; yearStart: number; yearEnd: number }) {
  const totalYears = yearEnd - yearStart + 1;
  const releaseDate = new Date(version.releaseDate);
  const normalEnd = new Date(version.normalSupportEnd);
  const extendedEnd = new Date(version.extendedSupportEnd);
  const eolDate = new Date(version.eolDate);

  const toPct = (d: Date) => {
    const years = d.getFullYear() + (d.getMonth() / 12) - yearStart;
    return Math.max(0, Math.min(100, (years / totalYears) * 100));
  };

  const releasePct = toPct(releaseDate);
  const normalPct = toPct(normalEnd);
  const extendedPct = toPct(extendedEnd);
  const eolPct = toPct(eolDate);
  const phaseCfg = getPhaseConfig(version.phase);

  return (
    <div className="flex-1 h-4 relative rounded overflow-hidden bg-slate-800">
      <div
        className="absolute top-0 h-full bg-emerald-500/60"
        style={{ left: `${releasePct}%`, width: `${Math.max(0, normalPct - releasePct)}%` }}
      />
      <div
        className="absolute top-0 h-full bg-blue-500/60"
        style={{ left: `${normalPct}%`, width: `${Math.max(0, extendedPct - normalPct)}%` }}
      />
      <div
        className="absolute top-0 h-full bg-amber-500/60"
        style={{ left: `${extendedPct}%`, width: `${Math.max(0, eolPct - extendedPct)}%` }}
      />
      <div
        className={`absolute top-0 h-full ${phaseCfg.bg} opacity-80`}
        style={{ left: `${releasePct}%`, width: `${Math.max(0, eolPct - releasePct)}%` }}
      />
      <div
        className={`absolute top-0 h-full w-0.5 ${phaseCfg.bg}`}
        style={{ left: `${toPct(new Date())}%` }}
      />
    </div>
  );
}

/* ── Year Axis ─────────────────────────────────────────────────── */

function YearAxis({ yearStart, yearEnd, labelWidth = 240 }: { yearStart: number; yearEnd: number; labelWidth?: number }) {
  const years: number[] = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  return (
    <div className="flex border-b border-slate-700 pb-1 mb-2 text-[11px] text-slate-500 font-mono" style={{ marginLeft: labelWidth }}>
      {years.map((year) => (
        <div key={year} className="flex-1 text-center">
          {year}
        </div>
      ))}
    </div>
  );
}

/* ── Tree helpers ──────────────────────────────────────────────── */

interface TreeNode {
  id: string;
  label: string;
  axis: Axis;
  children: TreeNode[];
  versions: RoadmapVersion[];
}

function getAxisValue(version: RoadmapVersion, axis: Axis): { id: string; label: string } {
  switch (axis) {
    case 'FAMILY':
      return { id: version.family, label: getFamilyLabel(version.family).label };
    case 'OS':
      return { id: version.group, label: version.group };
    case 'PHASE':
      return { id: version.phase, label: getPhaseConfig(version.phase).label };
    case 'VERSION':
      return { id: version.id, label: version.name };
  }
}

function buildTree(versions: RoadmapVersion[], axes: Axis[]): TreeNode[] {
  if (axes.length === 0) return [];

  type InternalNode = {
    id: string;
    label: string;
    axis: Axis;
    children: Map<string, InternalNode>;
    versions: RoadmapVersion[];
  };

  const root: Map<string, InternalNode> = new Map();

  for (const version of versions) {
    let currentLevel = root;
    let path = '';

    for (let i = 0; i < axes.length; i++) {
      const axis = axes[i];
      const { id, label } = getAxisValue(version, axis);
      path = path ? `${path}|${id}` : id;

      if (!currentLevel.has(path)) {
        currentLevel.set(path, {
          id: path,
          label,
          axis,
          children: new Map(),
          versions: [],
        });
      }

      const node = currentLevel.get(path)!;

      if (i === axes.length - 1) {
        node.versions.push(version);
      } else {
        currentLevel = node.children;
      }
    }
  }

  function mapToArray(levelMap: Map<string, InternalNode>): TreeNode[] {
    return Array.from(levelMap.values()).map((node) => ({
      id: node.id,
      label: node.label,
      axis: node.axis,
      children: mapToArray(node.children),
      versions: node.versions,
    }));
  }

  return mapToArray(root);
}

/* ── Grouped Tree Node ─────────────────────────────────────────── */

function TreeNodeRow({
  node,
  yearStart,
  yearEnd,
  depth = 0,
}: {
  node: TreeNode;
  yearStart: number;
  yearEnd: number;
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isLeaf = !hasChildren && node.versions.length > 0;

  return (
    <div className={depth > 0 ? 'ml-4' : ''}>
      <button
        onClick={() => hasChildren && setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-left group w-full"
      >
        {hasChildren && (
          expanded
            ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" />
            : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />
        )}
        {!hasChildren && <span className="w-3.5" />}
        <span className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
          {node.label}
        </span>
        {node.axis === 'FAMILY' && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getFamilyLabel(node.label).color} ${getFamilyLabel(node.label).bg}`}>
            {node.label}
          </span>
        )}
        {node.axis === 'PHASE' && (
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getPhaseConfig(node.label).color} ${getPhaseConfig(node.label).border}`}>
            {node.label}
          </span>
        )}
        {node.versions.length > 0 && (
          <Badge variant="outline" className="text-[10px] h-5">{node.versions.length} version{node.versions.length > 1 ? 's' : ''}</Badge>
        )}
      </button>

      {expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeRow key={child.id} node={child} yearStart={yearStart} yearEnd={yearEnd} depth={depth + 1} />
          ))}
          {isLeaf && (
            <div className="ml-5 space-y-1">
              {node.versions.map((version) => (
                <VersionRow key={version.id} version={version} yearStart={yearStart} yearEnd={yearEnd} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Version Row ───────────────────────────────────────────────── */

function VersionRow({ version, yearStart, yearEnd }: { version: RoadmapVersion; yearStart: number; yearEnd: number }) {
  const phase = getPhaseConfig(version.phase);
  return (
    <div className="flex items-center gap-3 h-7">
      <div className="w-[240px] flex items-center gap-2 shrink-0">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${phase.bg}`} />
        <span className="text-xs text-slate-300 font-medium truncate">{version.name}</span>
        <span className="text-[10px] text-slate-500 ml-auto">
          {new Date(version.releaseDate).getFullYear()} → {new Date(version.eolDate).getFullYear()}
        </span>
      </div>
      <GanttBar version={version} yearStart={yearStart} yearEnd={yearEnd} />
    </div>
  );
}

/* ── Flat Row ──────────────────────────────────────────────────── */

interface FlatRow {
  version: RoadmapVersion;
  labels: { axis: Axis; label: string }[];
}

function buildFlatRows(versions: RoadmapVersion[], axes: Axis[]): FlatRow[] {
  return versions
    .map((version) => ({
      version,
      labels: axes.map((axis) => ({
        axis,
        label: getAxisValue(version, axis).label,
      })),
    }))
    .sort((a, b) => new Date(a.version.releaseDate).getTime() - new Date(b.version.releaseDate).getTime());
}

function FlatTable({
  rows,
  axes,
  yearStart,
  yearEnd,
}: {
  rows: FlatRow[];
  axes: Axis[];
  yearStart: number;
  yearEnd: number;
}) {
  const colWidth = 130;

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex border-b border-slate-700 pb-1 mb-2">
        {axes.map((axis) => (
          <div key={axis} className="text-[11px] text-blue-400 font-semibold px-1" style={{ width: colWidth, minWidth: colWidth }}>
            {axisLabels[axis]}
          </div>
        ))}
        <div className="flex-1 text-[11px] text-slate-500 font-mono text-center">Timeline</div>
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {rows.map((row, idx) => (
          <div key={row.version.id + idx} className="flex items-center h-7">
            {axes.length === 0 ? (
              <div className="flex items-center gap-2 px-1" style={{ width: colWidth, minWidth: colWidth }}>
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${getPhaseConfig(row.version.phase).bg}`} />
                <span className="text-xs text-slate-300 font-medium truncate">{row.version.name}</span>
              </div>
            ) : (
              row.labels.map((label, i) => (
                <div key={i} className="px-1 text-xs text-slate-300 truncate" style={{ width: colWidth, minWidth: colWidth }}>
                  {label.label}
                </div>
              ))
            )}
            <div className="flex-1">
              <GanttBar version={row.version} yearStart={yearStart} yearEnd={yearEnd} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function Roadmap() {
  const { data: osList, isLoading: osLoading, isError: osError, refetch: refetchOs } = useOperatingSystems();
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<LifecyclePhase | ''>('');
  const [timeRange, setTimeRange] = useState<'3y' | '5y' | '10y'>('5y');
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [rowAxes, setRowAxes] = useState<Axis[]>(['FAMILY', 'OS', 'VERSION']);

  const now = new Date().getFullYear();
  const rangeMap = { '3y': 3, '5y': 5, '10y': 10 };
  const yearStart = now - 1;
  const yearEnd = now + rangeMap[timeRange];

  const allVersions = useMemo(() => {
    const versions: RoadmapVersion[] = [];
    if (osList) {
      for (const os of osList) {
        for (const version of os.versions || []) {
          versions.push(osVersionToRoadmap(os, version));
        }
      }
    }
    if (products) {
      for (const product of products) {
        for (const variant of product.variants || []) {
          if (variant.releaseDate) {
            versions.push(productVariantToRoadmap(product, variant));
          }
        }
      }
    }
    return versions;
  }, [osList, products]);

  const allFamilies = useMemo(() => {
    return Array.from(new Set(allVersions.map((v) => v.family).filter(Boolean)));
  }, [allVersions]);

  const filtered = useMemo(() => {
    let result = [...allVersions];
    if (selectedFamily) {
      result = result.filter((v) => v.family === selectedFamily);
    }
    if (selectedPhase) {
      result = result.filter((v) => v.phase === selectedPhase);
    }
    return result;
  }, [allVersions, selectedFamily, selectedPhase]);

  const tree = useMemo(() => buildTree(filtered, rowAxes), [filtered, rowAxes]);
  const flatRows = useMemo(() => buildFlatRows(filtered, rowAxes), [filtered, rowAxes]);

  const addAxis = () => {
    const used = new Set(rowAxes);
    const next = axisOptions.find((a) => !used.has(a.value));
    if (next) setRowAxes([...rowAxes, next.value]);
  };

  const removeAxis = (idx: number) => {
    setRowAxes(rowAxes.filter((_, i) => i !== idx));
  };

  const changeAxis = (idx: number, value: Axis) => {
    const next = [...rowAxes];
    next[idx] = value;
    setRowAxes(next);
  };

  const isLoading = osLoading || productsLoading;
  const isError = osError || productsError;
  const refetch = () => { refetchOs(); refetchProducts(); };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-300 p-4 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) return <QueryError message="Unable to load roadmap data" onRetry={refetch} />;
  if (!allVersions.length) return <div className="text-slate-400 text-center py-12">No roadmap data available</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 space-y-4">
      <AnimatedSection>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Product Lifecycle Roadmap</h1>
          <p className="text-slate-400">Visual timeline of OS version lifecycles and support phases</p>
        </div>
      </AnimatedSection>

      {/* Toolbar */}
      <AnimatedSection delay={100} className="relative z-50">
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-400">FILTERS</span>
          </div>

          <span className="text-xs text-slate-500">Family:</span>
          <PickUpList
            options={[{ value: '', label: 'All' }, ...allFamilies.map((f) => ({ value: f, label: f }))]}
            value={selectedFamily}
            onChange={(v) => setSelectedFamily(v)}
          />

          <span className="text-xs text-slate-500">Phase:</span>
          <PickUpList
            options={[
              { value: '', label: 'All' },
              ...Object.keys(phaseConfig).map((p) => ({ value: p as LifecyclePhase, label: phaseConfig[p as LifecyclePhase].label })),
            ]}
            value={selectedPhase}
            onChange={(v) => setSelectedPhase(v)}
          />

          <div className="flex gap-1 ml-auto">
            {(['3y', '5y', '10y'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {range === '10y' ? '10y' : range}
              </button>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* View Mode + Axes */}
      <AnimatedSection delay={150} className="relative z-50">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* View mode toggle */}
          <div className="flex rounded-md border border-slate-700 overflow-hidden">
            <button
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'grouped'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Grouped
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'flat'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Table className="h-3.5 w-3.5" />
              Flat
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Row axes */}
          <span className="text-xs text-slate-500">Group by:</span>
          {rowAxes.map((axis, i) => (
            <div key={`${axis}-${i}`} className="flex items-center gap-1 relative z-[9999]">
              <PickUpList
                options={axisOptions.filter((a) => !rowAxes.slice(0, i).includes(a.value) || a.value === axis)}
                value={axis}
                onChange={(v) => changeAxis(i, v)}
                color="blue"
              />
              <button
                onClick={() => removeAxis(i)}
                className="text-slate-500 hover:text-red-400 transition-colors text-xs px-1"
                title="Remove axis"
              >
                ×
              </button>
            </div>
          ))}
          {rowAxes.length < axisOptions.length && (
            <button
              onClick={addAxis}
              className="px-2 py-1 rounded-md border border-dashed border-slate-600 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-300 transition-colors"
            >
              + Axis
            </button>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection delay={200}>
        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          {Object.entries(phaseConfig).map(([phase, cfg]) => (
            <div key={phase} className="flex items-center gap-1.5">
              <span className={`inline-block w-3 h-3 rounded-sm ${cfg.bg}`} />
              <span className="text-slate-400">{cfg.label}</span>
            </div>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection delay={300}>
        <div className="p-5 rounded-xl bg-slate-900/50 border border-slate-800">
          <YearAxis yearStart={yearStart} yearEnd={yearEnd} labelWidth={viewMode === 'flat' ? Math.max(240, rowAxes.length * 130) : 240} />

          {viewMode === 'grouped' && (
            <>
              {tree.length === 0 ? (
                <div className="text-slate-500 text-center py-12">No versions match your filters</div>
              ) : (
                tree.map((node) => (
                  <TreeNodeRow key={node.id} node={node} yearStart={yearStart} yearEnd={yearEnd} />
                ))
              )}
            </>
          )}

          {viewMode === 'flat' && (
            <>
              {flatRows.length === 0 ? (
                <div className="text-slate-500 text-center py-12">No versions match your filters</div>
              ) : (
                <FlatTable rows={flatRows} axes={rowAxes} yearStart={yearStart} yearEnd={yearEnd} />
              )}
            </>
          )}
        </div>
      </AnimatedSection>
    </div>
  );
}
