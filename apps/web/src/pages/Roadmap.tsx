import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useProducts, useTransitions, useInfraVersions, useRegions } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Filter, ChevronDown, ChevronRight, BarChart3, Table, LayoutGrid,
  Crosshair, Eye, EyeOff, ZoomIn, ZoomOut, ArrowUpDown
} from 'lucide-react';
import type { Product, ProductVariant, ProductVersion, Transition, InfraVersion, AvailabilityZone } from '@cloudmarket/shared-types';
import { LifecyclePhase } from '@cloudmarket/shared-types';

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

type Axis = 'FAMILY' | 'OS' | 'PHASE' | 'VERSION' | 'CATEGORY' | 'PRODUCT' | 'FLAVOR' | 'REGION' | 'COUNTRY' | 'AZ' | 'ZONE' | 'PRODUCT_VERSION' | 'OS_VERSION' | 'INFRA_VERSION';
type RoadmapPerspective = 'product' | 'compute' | 'infra';
type Scale = 'month' | 'quarter' | 'year';
type ViewMode = 'grouped' | 'flat';
type RoadmapDesign = 'gantt' | 'cards';
type EntityType = 'product' | 'flavor' | 'os';

const axisLabels: Record<Axis, string> = {
  FAMILY: 'Family',
  OS: 'OS',
  PHASE: 'Phase',
  VERSION: 'Version',
  CATEGORY: 'Category',
  PRODUCT: 'Product',
  FLAVOR: 'Flavor',
  REGION: 'Region',
  COUNTRY: 'Country',
  AZ: 'AZ',
  ZONE: 'Zone',
  PRODUCT_VERSION: 'Product Version',
  OS_VERSION: 'OS Version',
  INFRA_VERSION: 'Infra Version',
};

/* ── Unified Roadmap Version ───────────────────────────────────── */

interface RoadmapVersion {
  id: string;
  name: string;
  osVersionName: string;
  releaseDate: string;
  normalSupportEnd: string;
  extendedSupportEnd: string;
  eolDate: string;
  phase: LifecyclePhase;
  family: string;
  os: string;
  category: string;
  product: string;
  flavor: string;
  status: string;
  transitionsTo: string[];
  transitionsFrom: string[];
  type: 'os' | 'product' | 'product-version' | 'flavor' | 'infra';
  regions: string[];
  countries: string[];
  azs: string[];
  zones: string[];
  infraVersion: string;
}

// AZ.region stores the region *slug* ("eu-west"); the roadmap labels must show
// the region *name* ("EMEA"). Resolved via the regions list at render time.
let regionNameBySlug = new Map<string, string>();
export function setRegionNameIndex(regions: { name: string; slug: string }[] | undefined) {
  regionNameBySlug = new Map((regions || []).map((r) => [r.slug, r.name]));
}
function regionLabel(slugOrName: string): string {
  return regionNameBySlug.get(slugOrName) || slugOrName;
}

function productTransitions(product: Product): { to: string[]; from: string[] } {
  return {
    to: [...new Set((product.upgradeTo || []).map((u) => u.toProduct?.name).filter(Boolean))] as string[],
    from: [...new Set((product.upgradeFrom || []).map((u) => u.fromProduct?.name).filter(Boolean))] as string[],
  };
}

function productVariantToRoadmap(product: Product, variant: ProductVariant): RoadmapVersion {
  const transitions = productTransitions(product);
  const azList = variant.availabilityZones?.map((z) => z.availabilityZone) || [];
  const zoneList = variant.zones?.map((z) => z.zone) || [];
  return {
    id: variant.id,
    name: variant.name,
    osVersionName: variant.osVersion?.version || variant.name,
    // Lifecycle dates: variant-level first, then the required OsVersion dates.
    // Missing dates stay empty — no frame is drawn for a period we have no
    // real date for; never substitute eolDate/createdAt for another phase's end.
    releaseDate: variant.releaseDate || variant.osVersion?.releaseDate || '',
    normalSupportEnd: variant.normalSupportEnd || variant.osVersion?.normalSupportEnd || '',
    extendedSupportEnd: variant.extendedSupportEnd || variant.osVersion?.extendedSupportEnd || '',
    eolDate: variant.eolDate || variant.osVersion?.eolDate || '',
    phase: variant.phase,
    family: variant.os?.family || 'OTHER',
    os: variant.os?.name || '—',
    category: product.category?.name || 'OTHER',
    product: product.name,
    flavor: variant.flavor?.name || '—',
    status: product.status || 'AVAILABLE',
    transitionsTo: transitions.to,
    transitionsFrom: transitions.from,
    type: 'product',
    regions: [...new Set(azList.map((az) => regionLabel(az.region)).filter(Boolean))],
    countries: [...new Set(azList.map((az) => az.country).filter(Boolean))],
    azs: [...new Set(azList.map((az) => az.code).filter(Boolean))],
    zones: [...new Set(zoneList.map((z) => z.name).filter(Boolean))],
    infraVersion: '—',
  };
}

function productVersionToRoadmap(product: Product, pv: ProductVersion): RoadmapVersion {
  const transitions = productTransitions(product);
  const azList = [
    ...(pv.availabilityZones?.map((z) => z.availabilityZone).filter(Boolean) || []),
    ...(pv.variants?.flatMap((v) => v.availabilityZones?.map((z) => z.availabilityZone) || []) || []),
  ];
  const zoneList = [
    ...(pv.zones?.map((z) => z.zone).filter(Boolean) || []),
    ...(pv.variants?.flatMap((v) => v.zones?.map((z) => z.zone) || []) || []),
  ];
  const regionNames = [
    ...(pv.regions?.map((r) => r.region?.name).filter((n): n is string => Boolean(n)) || []),
    ...azList.map((az) => az!.region).filter((n): n is string => Boolean(n)).map(regionLabel),
  ];
  return {
    id: pv.id,
    name: pv.version,
    osVersionName: pv.version,
    // Real dates only for their own frame; missing dates stay empty and
    // render no frame instead of a fabricated one anchored on eolDate/createdAt.
    releaseDate: pv.releaseDate || '',
    normalSupportEnd: pv.normalSupportEnd || '',
    extendedSupportEnd: pv.extendedSupportEnd || '',
    eolDate: pv.eolDate || '',
    phase: pv.phase,
    family: pv.variants?.[0]?.os?.family || product.variants?.[0]?.os?.family || 'OTHER',
    os: pv.variants?.[0]?.os?.name || product.variants?.[0]?.os?.name || '—',
    category: product.category?.name || 'OTHER',
    product: product.name,
    flavor: '—',
    status: product.status || 'AVAILABLE',
    transitionsTo: transitions.to,
    transitionsFrom: transitions.from,
    type: 'product-version',
    regions: [...new Set(regionNames)],
    countries: [...new Set(azList.map((az) => az!.country).filter((c): c is string => Boolean(c)))],
    azs: [...new Set(azList.map((az) => az!.code).filter((c): c is string => Boolean(c)))],
    zones: [...new Set(zoneList.map((z) => z!.name).filter((n): n is string => Boolean(n)))],
    infraVersion: '—',
  };
}

function infraVersionToRoadmap(iv: InfraVersion): RoadmapVersion {
  const azList: AvailabilityZone[] = iv.availabilityZones?.map((z: any) => z.availabilityZone).filter(Boolean) || [];
  return {
    id: iv.id,
    name: iv.code,
    osVersionName: iv.code,
    releaseDate: iv.releaseDate || '',
    normalSupportEnd: iv.normalSupportEnd || '',
    extendedSupportEnd: iv.extendedSupportEnd || '',
    eolDate: iv.eolDate || '',
    phase: iv.phase,
    family: 'INFRA',
    os: iv.name,
    category: 'Infrastructure',
    product: iv.name,
    flavor: '—',
    status: iv.isActive ? 'AVAILABLE' : 'CANCELLED',
    transitionsTo: [],
    transitionsFrom: [],
    type: 'infra',
    regions: [...new Set(azList.map((az: any) => regionLabel(az.region)).filter(Boolean))],
    countries: [...new Set(azList.map((az: any) => az.country).filter(Boolean))],
    azs: [...new Set(azList.map((az: any) => az.code).filter(Boolean))],
    zones: [],
    infraVersion: iv.code,
  };
}

const axisOptionsProduct: { value: Axis; label: string }[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'PRODUCT_VERSION', label: 'Product Version' },
  { value: 'PHASE', label: 'Phase' },
  { value: 'CATEGORY', label: 'Category' },
  { value: 'REGION', label: 'Region' },
  { value: 'COUNTRY', label: 'Country' },
  { value: 'AZ', label: 'AZ' },
  { value: 'ZONE', label: 'Zone' },
];

const axisOptionsCompute: { value: Axis; label: string }[] = [
  { value: 'PRODUCT', label: 'Product' },
  { value: 'OS', label: 'OS' },
  { value: 'OS_VERSION', label: 'OS Version' },
  { value: 'FLAVOR', label: 'Flavor' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'PHASE', label: 'Phase' },
  { value: 'REGION', label: 'Region' },
  { value: 'COUNTRY', label: 'Country' },
  { value: 'AZ', label: 'AZ' },
  { value: 'ZONE', label: 'Zone' },
];

const axisOptionsInfra: { value: Axis; label: string }[] = [
  { value: 'INFRA_VERSION', label: 'Infra Version' },
  { value: 'PHASE', label: 'Phase' },
  { value: 'REGION', label: 'Region' },
  { value: 'COUNTRY', label: 'Country' },
  { value: 'AZ', label: 'AZ' },
];

const scaleOptions: { value: Scale; label: string }[] = [
  { value: 'year', label: 'Year' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'month', label: 'Month' },
];

const entityTypeOptions: { value: '' | EntityType; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'product', label: 'Product' },
  { value: 'flavor', label: 'Flavor' },
  { value: 'os', label: 'OS' },
];

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
        <div className="absolute z-50 mt-1 min-w-[140px] rounded-lg border border-slate-500 bg-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.5)] py-1">
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

/* ── Timeline Axis ─────────────────────────────────────────────── */

const monthInitials = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

interface TimelineRow {
  label: string;
  leftPct: number;
  widthPct: number;
  isMajor?: boolean;
}

function TimelineAxis({ timelineStart, timelineEnd, scale, labelWidth, onResizeLabel }: { timelineStart: Date; timelineEnd: Date; scale: Scale; labelWidth: number; onResizeLabel?: (e: React.MouseEvent) => void }) {
  const rows = useMemo(() => {
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    const toPct = (d: Date) => ((d.getTime() - timelineStart.getTime()) / totalMs) * 100;

    const makeYearRow = (): TimelineRow[] => {
      const segs: TimelineRow[] = [];
      const startYear = timelineStart.getFullYear();
      const endYear = timelineEnd.getFullYear();
      for (let y = startYear; y < endYear; y++) {
        const yStart = new Date(y, 0, 1);
        const yEnd = new Date(y + 1, 0, 1);
        const left = Math.max(0, toPct(yStart));
        const right = Math.min(100, toPct(yEnd));
        const width = right - left;
        if (width > 0) segs.push({ label: String(y), leftPct: left, widthPct: width, isMajor: true });
      }
      return segs;
    };

    const makeQuarterRow = (): TimelineRow[] => {
      const segs: TimelineRow[] = [];
      let d = new Date(timelineStart);
      d = new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
      while (d < timelineEnd) {
        const qStart = new Date(d);
        const qEnd = new Date(d.getFullYear(), d.getMonth() + 3, 1);
        const left = Math.max(0, toPct(qStart));
        const right = Math.min(100, toPct(qEnd));
        const width = right - left;
        if (width > 0) {
          const qNum = Math.floor(qStart.getMonth() / 3) + 1;
          segs.push({ label: `Q${qNum}`, leftPct: left, widthPct: width, isMajor: qStart.getMonth() === 0 });
        }
        d = qEnd;
      }
      return segs;
    };

    const makeMonthRow = (): TimelineRow[] => {
      const segs: TimelineRow[] = [];
      let d = new Date(timelineStart);
      d = new Date(d.getFullYear(), d.getMonth(), 1);
      while (d < timelineEnd) {
        const mStart = new Date(d);
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const left = Math.max(0, toPct(mStart));
        const right = Math.min(100, toPct(mEnd));
        const width = right - left;
        if (width > 0) {
          segs.push({
            label: monthInitials[mStart.getMonth()],
            leftPct: left,
            widthPct: width,
            isMajor: mStart.getMonth() === 0,
          });
        }
        d = mEnd;
      }
      return segs;
    };

    if (scale === 'year') return [makeYearRow()];
    if (scale === 'quarter') return [makeYearRow(), makeQuarterRow()];
    return [makeYearRow(), makeQuarterRow(), makeMonthRow()];
  }, [timelineStart, timelineEnd, scale]);

  const rowHeight = scale === 'month' ? 18 : scale === 'quarter' ? 18 : 20;
  const totalHeight = rows.length * rowHeight;

  return (
    <div className="relative" style={{ marginLeft: labelWidth }}>
      {onResizeLabel && (
        <div
          className="absolute left-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-blue-500/50 z-20 -translate-x-full"
          onMouseDown={onResizeLabel}
        />
      )}
      <div className="relative border-b border-slate-700 pb-1 mb-2 text-[11px] text-slate-500 font-mono select-none" style={{ height: `${totalHeight}px` }}>
        {rows.map((row, rowIdx) =>
          row.map((seg, i) => (
            <div
              key={`${rowIdx}-${i}`}
              className={`absolute flex items-center justify-center border-l ${seg.isMajor ? 'border-slate-500' : 'border-slate-700/30'} ${rowIdx < rows.length - 1 ? 'border-b border-slate-700/30' : ''}`}
              style={{ left: `${seg.leftPct}%`, width: `${seg.widthPct}%`, top: `${rowIdx * rowHeight}px`, height: `${rowHeight}px` }}
            >
              <span className="truncate px-1">{seg.label}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ── Gantt Bar ─────────────────────────────────────────────────── */

function GanttBar({ version, timelineStart, timelineEnd, showTodayBar }: { version: RoadmapVersion; timelineStart: Date; timelineEnd: Date; showTodayBar: boolean }) {
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  const toPct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - timelineStart.getTime()) / totalMs) * 100));

  const releaseDate = new Date(version.releaseDate);
  const normalEnd = new Date(version.normalSupportEnd);
  const extendedEnd = new Date(version.extendedSupportEnd);
  const eolDate = new Date(version.eolDate);

  const releasePct = toPct(releaseDate);
  const normalPct = toPct(normalEnd);
  const extendedPct = toPct(extendedEnd);
  const eolPct = toPct(eolDate);
  const phaseCfg = getPhaseConfig(version.phase);

  return (
    <div className="flex-1 h-4 relative rounded overflow-hidden bg-slate-800">
      <div className="absolute top-0 h-full bg-emerald-500/60" style={{ left: `${releasePct}%`, width: `${Math.max(0, normalPct - releasePct)}%` }} />
      <div className="absolute top-0 h-full bg-blue-500/60" style={{ left: `${normalPct}%`, width: `${Math.max(0, extendedPct - normalPct)}%` }} />
      <div className="absolute top-0 h-full bg-amber-500/60" style={{ left: `${extendedPct}%`, width: `${Math.max(0, eolPct - extendedPct)}%` }} />
      <div className={`absolute top-0 h-full ${phaseCfg.bg} opacity-80`} style={{ left: `${releasePct}%`, width: `${Math.max(0, eolPct - releasePct)}%` }} />
      {showTodayBar && (
        <div className="absolute top-0 h-full w-0.5 bg-white/80 z-10" style={{ left: `${toPct(new Date())}%` }} />
      )}
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
      return { id: version.os, label: version.os };
    case 'PHASE':
      return { id: version.phase, label: getPhaseConfig(version.phase).label };
    case 'VERSION':
      return { id: version.osVersionName, label: version.osVersionName };
    case 'OS_VERSION':
      return { id: version.osVersionName, label: version.osVersionName };
    case 'CATEGORY':
      return { id: version.category, label: version.category };
    case 'PRODUCT':
      return { id: version.product, label: version.product };
    case 'FLAVOR':
      return { id: version.flavor, label: version.flavor };
    case 'PRODUCT_VERSION':
      return { id: version.osVersionName, label: version.osVersionName };
    case 'REGION': {
      const val = version.regions.join(', ') || '—';
      return { id: val, label: val };
    }
    case 'COUNTRY': {
      const val = version.countries.join(', ') || '—';
      return { id: val, label: val };
    }
    case 'AZ': {
      const val = version.azs.join(', ') || '—';
      return { id: val, label: val };
    }
    case 'INFRA_VERSION':
      return { id: version.infraVersion, label: version.infraVersion };
    case 'ZONE': {
      const val = version.zones.join(', ') || '—';
      return { id: val, label: val };
    }
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
  timelineStart,
  timelineEnd,
  showTodayBar,
  depth = 0,
  labelWidth = 240,
}: {
  node: TreeNode;
  timelineStart: Date;
  timelineEnd: Date;
  showTodayBar: boolean;
  depth?: number;
  labelWidth?: number;
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
            <TreeNodeRow key={child.id} node={child} timelineStart={timelineStart} timelineEnd={timelineEnd} showTodayBar={showTodayBar} depth={depth + 1} labelWidth={labelWidth} />
          ))}
          {isLeaf && (
            <div className="ml-5 space-y-1">
              {(() => {
                // Group versions by osVersionName
                const groups = new Map<string, RoadmapVersion[]>();
                for (const v of node.versions) {
                  const key = v.osVersionName;
                  if (!groups.has(key)) groups.set(key, []);
                  groups.get(key)!.push(v);
                }
                const rows: React.ReactNode[] = [];
                for (const [, versions] of groups) {
                  if (versions.length === 1) {
                    rows.push(
                      <VersionRow
                        key={versions[0].id}
                        version={versions[0]}
                        timelineStart={timelineStart}
                        timelineEnd={timelineEnd}
                        showTodayBar={showTodayBar}
                        displayAxis={node.axis}
                        labelWidth={labelWidth}
                      />
                    );
                  } else {
                    // Check if all dates are identical
                    const allSame = versions.every((v) =>
                      v.releaseDate === versions[0].releaseDate &&
                      v.normalSupportEnd === versions[0].normalSupportEnd &&
                      v.extendedSupportEnd === versions[0].extendedSupportEnd &&
                      v.eolDate === versions[0].eolDate
                    );
                    if (allSame) {
                      rows.push(
                        <VersionRow
                          key={versions[0].id}
                          version={versions[0]}
                          timelineStart={timelineStart}
                          timelineEnd={timelineEnd}
                          showTodayBar={showTodayBar}
                          displayAxis={node.axis}
                          labelWidth={labelWidth}
                        />
                      );
                    } else {
                      for (const v of versions) {
                        rows.push(
                          <VersionRow
                            key={v.id}
                            version={v}
                            timelineStart={timelineStart}
                            timelineEnd={timelineEnd}
                            showTodayBar={showTodayBar}
                            displayAxis={node.axis}
                            subtitle={v.flavor}
                            labelWidth={labelWidth}
                          />
                        );
                      }
                    }
                  }
                }
                return rows;
              })()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Version Row ───────────────────────────────────────────────── */

function VersionRow({ version, timelineStart, timelineEnd, showTodayBar, displayAxis, subtitle, labelWidth = 240 }: { version: RoadmapVersion; timelineStart: Date; timelineEnd: Date; showTodayBar: boolean; displayAxis?: Axis; subtitle?: string; labelWidth?: number }) {
  const phase = getPhaseConfig(version.phase);
  const label = displayAxis ? getAxisValue(version, displayAxis).label : version.name;
  return (
    <div className="flex items-center gap-3 h-7">
      <div className="flex items-center gap-2 shrink-0" style={{ width: labelWidth }}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${phase.bg}`} />
        <span className="text-xs text-slate-300 font-medium truncate">{label}</span>
        {subtitle && <span className="text-[10px] text-slate-500">({subtitle})</span>}
        <span className="text-[10px] text-slate-500 ml-auto">
          {(() => {
            const r = new Date(version.releaseDate);
            const e = new Date(version.eolDate);
            const from = isNaN(r.getTime()) ? '?' : r.getFullYear();
            const to = isNaN(e.getTime()) ? '?' : e.getFullYear();
            return `${from} → ${to}`;
          })()}
        </span>
      </div>
      <GanttBar version={version} timelineStart={timelineStart} timelineEnd={timelineEnd} showTodayBar={showTodayBar} />
    </div>
  );
}

/* ── Flat Row ──────────────────────────────────────────────────── */

interface FlatRow {
  version: RoadmapVersion;
  labels: { axis: Axis; label: string }[];
}

function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce((acc, curr) => {
    return acc.flatMap(a => curr.map(c => [...a, c]));
  }, [[]] as T[][]);
}

function buildFlatRows(versions: RoadmapVersion[], axes: Axis[]): FlatRow[] {
  const arrayAxisMap: Record<string, keyof RoadmapVersion> = {
    REGION: 'regions',
    COUNTRY: 'countries',
    AZ: 'azs',
    ZONE: 'zones',
  };

  // Step 1: Explode versions by array axes
  const exploded: FlatRow[] = [];
  for (const version of versions) {
    const arrayAxes = axes.filter(axis => arrayAxisMap[axis]);
    if (arrayAxes.length === 0) {
      exploded.push({
        version,
        labels: axes.map((axis) => ({
          axis,
          label: getAxisValue(version, axis).label,
        })),
      });
      continue;
    }

    const arrayValues = arrayAxes.map(axis => {
      const key = arrayAxisMap[axis]!;
      const vals = (version[key] as string[]).filter(Boolean);
      return vals.length > 0 ? vals : ['—'];
    });

    const combinations = cartesianProduct(arrayValues);
    for (const combo of combinations) {
      const labels = axes.map((axis) => {
        const arrayIdx = arrayAxes.indexOf(axis);
        if (arrayIdx >= 0) {
          return { axis, label: combo[arrayIdx] };
        }
        return { axis, label: getAxisValue(version, axis).label };
      });
      exploded.push({ version, labels });
    }
  }

  // Step 2: Merge rows with same labels and same dates
  const merged = new Map<string, FlatRow>();
  for (const row of exploded) {
    const dateKey = `${row.version.releaseDate}|${row.version.normalSupportEnd}|${row.version.extendedSupportEnd}|${row.version.eolDate}`;
    const labelKey = row.labels.map(l => `${l.axis}:${l.label}`).join('|');
    const key = `${labelKey}|${dateKey}`;
    if (!merged.has(key)) {
      merged.set(key, row);
    }
  }

  const time = (d: string) => { const t = new Date(d).getTime(); return isNaN(t) ? Infinity : t; };
  return Array.from(merged.values())
    .sort((a, b) => time(a.version.releaseDate) - time(b.version.releaseDate));
}

function FlatTable({
  rows,
  axes,
  timelineStart,
  timelineEnd,
  showTodayBar,
  columnWidths,
  onResizeColumn,
}: {
  rows: FlatRow[];
  axes: Axis[];
  timelineStart: Date;
  timelineEnd: Date;
  showTodayBar: boolean;
  columnWidths: number[];
  onResizeColumn: (index: number, e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex border-b border-slate-700 pb-1 mb-2 select-none">
        {axes.map((axis, i) => (
          <div
            key={axis}
            className="relative text-[11px] text-blue-400 font-semibold px-1 flex items-center"
            style={{ width: columnWidths[i], minWidth: columnWidths[i] }}
          >
            {axisLabels[axis]}
            <div
              className="resize-handle absolute top-0 h-full w-3 cursor-col-resize z-20 flex items-center justify-center -right-1.5"
              onMouseDown={(e) => onResizeColumn(i, e)}
            >
              <div className="w-px h-5 bg-slate-500/60 hover:bg-blue-400 transition-colors rounded-full" />
            </div>
          </div>
        ))}
        <div className="flex-1" />
      </div>

      {/* Rows */}
      <div className="space-y-1">
        {(() => {
          // Group rows by their label values
          const groups = new Map<string, FlatRow[]>();
          for (const row of rows) {
            const key = row.labels.map((l) => l.label).join('|');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key)!.push(row);
          }

          const rendered: React.ReactNode[] = [];
          for (const [, groupRows] of groups) {
            if (groupRows.length === 1) {
              const row = groupRows[0];
              rendered.push(
                <div key={row.version.id} className="flex items-center h-7">
                  {axes.length === 0 ? (
                    <div className="flex items-center gap-2 px-1" style={{ width: 130, minWidth: 130 }}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full ${getPhaseConfig(row.version.phase).bg}`} />
                      <span className="text-xs text-slate-300 font-medium truncate">{row.version.name}</span>
                    </div>
                  ) : (
                    row.labels.map((label, i) => (
                      <div key={i} className="px-1 text-xs text-slate-300 truncate" style={{ width: columnWidths[i], minWidth: columnWidths[i] }}>
                        {label.label}
                      </div>
                    ))
                  )}
                  <div className="flex-1">
                    <GanttBar version={row.version} timelineStart={timelineStart} timelineEnd={timelineEnd} showTodayBar={showTodayBar} />
                  </div>
                </div>
              );
            } else {
              // Check if all dates are identical
              const allSame = groupRows.every((r) =>
                r.version.releaseDate === groupRows[0].version.releaseDate &&
                r.version.normalSupportEnd === groupRows[0].version.normalSupportEnd &&
                r.version.extendedSupportEnd === groupRows[0].version.extendedSupportEnd &&
                r.version.eolDate === groupRows[0].version.eolDate
              );
              if (allSame) {
                const row = groupRows[0];
                rendered.push(
                  <div key={row.version.id} className="flex items-center h-7">
                    {axes.length === 0 ? (
                      <div className="flex items-center gap-2 px-1" style={{ width: 130, minWidth: 130 }}>
                        <span className={`inline-block w-1.5 h-1.5 rounded-full ${getPhaseConfig(row.version.phase).bg}`} />
                        <span className="text-xs text-slate-300 font-medium truncate">{row.version.name}</span>
                        <span className="text-[10px] text-slate-500">({groupRows.length})</span>
                      </div>
                    ) : (
                      <>
                        {row.labels.map((label, i) => (
                          <div key={i} className="px-1 text-xs text-slate-300 truncate" style={{ width: columnWidths[i], minWidth: columnWidths[i] }}>
                            {label.label}
                          </div>
                        ))}
                        <div className="px-1 text-[10px] text-slate-500">({groupRows.length})</div>
                      </>
                    )}
                    <div className="flex-1">
                      <GanttBar version={row.version} timelineStart={timelineStart} timelineEnd={timelineEnd} showTodayBar={showTodayBar} />
                    </div>
                  </div>
                );
              } else {
                for (const row of groupRows) {
                  rendered.push(
                    <div key={row.version.id} className="flex items-center h-7">
                      {axes.length === 0 ? (
                        <div className="flex items-center gap-2 px-1" style={{ width: 130, minWidth: 130 }}>
                          <span className={`inline-block w-1.5 h-1.5 rounded-full ${getPhaseConfig(row.version.phase).bg}`} />
                          <span className="text-xs text-slate-300 font-medium truncate">{row.version.name}</span>
                          <span className="text-[10px] text-slate-500">
                            ({row.version.flavor}{row.version.name && row.version.name !== '—' ? ` · ${row.version.name}` : ''})
                          </span>
                        </div>
                      ) : (
                        <>
                          {row.labels.map((label, i) => (
                            <div key={i} className="px-1 text-xs text-slate-300 truncate" style={{ width: columnWidths[i], minWidth: columnWidths[i] }}>
                              {label.label}
                            </div>
                          ))}
                          <div className="px-1 text-[10px] text-slate-500">
                            ({row.version.flavor}{row.version.name && row.version.name !== '—' ? ` · ${row.version.name}` : ''})
                          </div>
                        </>
                      )}
                      <div className="flex-1">
                        <GanttBar version={row.version} timelineStart={timelineStart} timelineEnd={timelineEnd} showTodayBar={showTodayBar} />
                      </div>
                    </div>
                  );
                }
              }
            }
          }
          return rendered;
        })()}
      </div>
    </div>
  );
}

/* ── Cards Design (screenshot style) ───────────────────────────── */

const CARDS_LEFT_WIDTH = 56; // px for scope label cell

interface CardsPhaseStyle {
  cardBorder: string;
  labelColor: string;
  cellBorder: string;
  cellBg: string;
}

const cardsPhaseStyles: Record<string, CardsPhaseStyle> = {
  RELEASED: { cardBorder: 'border-emerald-500', labelColor: 'text-emerald-400', cellBorder: 'border-emerald-500/40', cellBg: 'bg-emerald-500/10' },
  NORMAL_SUPPORT: { cardBorder: 'border-emerald-500', labelColor: 'text-emerald-400', cellBorder: 'border-emerald-500/40', cellBg: 'bg-emerald-500/10' },
  EXTENDED_SUPPORT: { cardBorder: 'border-amber-500', labelColor: 'text-amber-400', cellBorder: 'border-amber-500/40', cellBg: 'bg-amber-500/10' },
  NO_SUPPORT: { cardBorder: 'border-red-500', labelColor: 'text-red-400', cellBorder: 'border-red-500/40', cellBg: 'bg-red-500/10' },
  EOL: { cardBorder: 'border-red-500', labelColor: 'text-red-400', cellBorder: 'border-red-500/40', cellBg: 'bg-red-500/10' },
};

const cardsDefaultStyle: CardsPhaseStyle = cardsPhaseStyles.NORMAL_SUPPORT;

function getCardsStyle(phase: LifecyclePhase | string | undefined): CardsPhaseStyle {
  return cardsPhaseStyles[phase as string] || cardsDefaultStyle;
}

/* ── Card design: configurable field mapping ──────────────────── */

type CardField = 'NONE' | 'OS' | 'PRODUCT' | 'FAMILY' | 'PHASE' | 'OS_VERSION' | 'ZONE' | 'REGION' | 'COUNTRY' | 'AZ' | 'FLAVOR' | 'STATUS' | 'INFRA_VERSION';

const cardFieldOptions: { value: CardField; label: string }[] = [
  { value: 'NONE', label: '— Nothing —' },
  { value: 'OS', label: 'OS' },
  { value: 'PRODUCT', label: 'Product' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'PHASE', label: 'Phase' },
  { value: 'OS_VERSION', label: 'Version' },
  { value: 'ZONE', label: 'Zone' },
  { value: 'REGION', label: 'Region' },
  { value: 'COUNTRY', label: 'Country' },
  { value: 'AZ', label: 'AZ' },
  { value: 'FLAVOR', label: 'Flavor' },
  { value: 'STATUS', label: 'Status' },
  { value: 'INFRA_VERSION', label: 'Infra Version' },
];

interface CardDesignConfig {
  headerLabel: CardField; // left cell of the card header
  title: CardField;       // center of the card header (aggregation level)
  rowLabel: CardField;    // left cell of each row
  cell1: CardField;       // first (blue) cell
  cell2: CardField;       // second (red/orange) cell
}

const defaultCardConfig: CardDesignConfig = {
  headerLabel: 'ZONE',
  title: 'OS',
  rowLabel: 'REGION',
  cell1: 'OS_VERSION',
  cell2: 'NONE',
};

interface CardDesignPreset {
  id: string;
  name: string;
  config: CardDesignConfig;
}

const CARD_DESIGNS_STORAGE_KEY = 'roadmap-card-designs';

const validCardFields = new Set(cardFieldOptions.map((o) => o.value));

function loadCardDesigns(): CardDesignPreset[] {
  try {
    const raw = localStorage.getItem(CARD_DESIGNS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as CardDesignPreset[];
      if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((d) => d.id && d.name && d.config)) {
        // Fields removed from the catalog (e.g. PHASE_END) fall back to NONE
        const sanitized = parsed.map((d) => ({
          ...d,
          config: Object.fromEntries(
            Object.entries(d.config).map(([slot, field]) => [slot, validCardFields.has(field as CardField) ? field : 'NONE'])
          ) as CardDesignConfig,
        }));
        return sanitized;
      }
    }
  } catch { /* corrupted storage — fall through to default */ }
  return [{ id: 'default', name: 'Default', config: defaultCardConfig }];
}

function saveCardDesigns(designs: CardDesignPreset[]) {
  try {
    localStorage.setItem(CARD_DESIGNS_STORAGE_KEY, JSON.stringify(designs));
  } catch { /* storage unavailable — designs stay in memory for the session */ }
}

function getCardFieldValue(v: RoadmapVersion, field: CardField): string {
  switch (field) {
    case 'NONE': return '';
    case 'OS': return v.os;
    case 'PRODUCT': return v.product;
    case 'FAMILY': return getFamilyLabel(v.family).label;
    case 'PHASE': return getPhaseConfig(v.phase).label;
    case 'OS_VERSION': return v.osVersionName;
    case 'ZONE': return v.zones.length > 0 ? v.zones.join(', ') : 'ALL';
    case 'REGION': return v.regions.length > 0 ? v.regions.join(', ') : 'ALL';
    case 'COUNTRY': return v.countries.length > 0 ? v.countries.join(', ') : 'ALL';
    case 'AZ': return v.azs.length > 0 ? v.azs.join(', ') : 'ALL';
    case 'FLAVOR': return v.flavor;
    case 'STATUS': return v.status || 'AVAILABLE';
    case 'INFRA_VERSION': return v.infraVersion;
  }
}

/* Status config matching the screenshot legend */
export const productStatusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  BACKLOG: { label: 'Backlog', color: 'text-slate-300', bg: 'bg-slate-500', border: 'border-slate-500/40' },
  OPPORTUNITY: { label: 'Opportunity / Study / PoC / MVP', color: 'text-purple-300', bg: 'bg-purple-500', border: 'border-purple-500/40' },
  AVAILABLE: { label: 'Available', color: 'text-emerald-300', bg: 'bg-emerald-500', border: 'border-emerald-500/40' },
  AVAILABLE_PILOT_PENDING: { label: 'Available (waiting for pilot client)', color: 'text-yellow-300', bg: 'bg-yellow-400', border: 'border-yellow-400/40' },
  DELAY_PENDING: { label: 'Delay / Pending', color: 'text-orange-300', bg: 'bg-orange-500', border: 'border-orange-500/40' },
  CANCELLED: { label: 'Cancelled / Confined / Closed', color: 'text-red-300', bg: 'bg-red-500', border: 'border-red-500/40' },
};

function getStatusConfig(status: string | undefined) {
  return productStatusConfig[status || 'AVAILABLE'] || productStatusConfig.AVAILABLE;
}

const cardSlotLabels: Record<keyof CardDesignConfig, string> = {
  headerLabel: 'Header label',
  title: 'Card title',
  rowLabel: 'Row label',
  cell1: 'Cell 1',
  cell2: 'Cell 2',
};

const phaseSeverity: Record<string, number> = {
  RELEASED: 0, NORMAL_SUPPORT: 1, EXTENDED_SUPPORT: 2, NO_SUPPORT: 3, EOL: 4,
};

function worstPhase(versions: RoadmapVersion[]): LifecyclePhase | string | undefined {
  let worst: RoadmapVersion | undefined;
  for (const v of versions) {
    if (!worst || (phaseSeverity[v.phase] ?? 0) > (phaseSeverity[worst.phase] ?? 0)) worst = v;
  }
  return worst?.phase;
}

/* One card row per version, with its own lifecycle dates */
interface CardRow {
  label: string;
  cell1: string;
  cell1Status?: string;
  cell2: string;
  cell2Status?: string;
  dates: { release: string; normalEnd: string; extendedEnd: string; eol: string };
}

function buildCardRows(versions: RoadmapVersion[], config: CardDesignConfig, sortNewest = true): CardRow[] {
  // One row per VERSION (cells + real lifecycle dates). Variants of the same
  // OS version that share all displayed values are aggregated, and their row
  // labels (e.g. regions) are merged by union — variant-level geo quirks must
  // not split a single OS version into several rows.
  const byKey = new Map<string, { row: CardRow; labels: Set<string> }>();
  for (const v of versions) {
    const cell1 = getCardFieldValue(v, config.cell1);
    const cell2 = getCardFieldValue(v, config.cell2);
    const key = [
      cell1, cell2,
      v.releaseDate, v.normalSupportEnd, v.extendedSupportEnd, v.eolDate,
    ].join('§');
    const label = getCardFieldValue(v, config.rowLabel);
    const existing = byKey.get(key);
    if (existing) {
      // Split compound labels ("EMEA, AMER") so individual names dedupe
      label.split(',').map((s) => s.trim()).filter(Boolean).forEach((s) => existing.labels.add(s));
      continue;
    }
    byKey.set(key, {
      row: {
        label,
        cell1,
        cell1Status: config.cell1 === 'STATUS' ? v.status : config.cell1 === 'PHASE' ? v.phase : undefined,
        cell2,
        cell2Status: config.cell2 === 'STATUS' ? v.status : config.cell2 === 'PHASE' ? v.phase : undefined,
        dates: {
          release: v.releaseDate,
          normalEnd: v.normalSupportEnd,
          extendedEnd: v.extendedSupportEnd,
          eol: v.eolDate,
        },
      },
      labels: new Set(label.split(',').map((s) => s.trim()).filter(Boolean)),
    });
  }
  // Sort rows by release date (newest version first by default, e.g.
  // Windows Server 2025 → 2022 → 2019). Versions without a release date
  // always sink to the bottom of the card.
  const time = (r: CardRow) => {
    const x = new Date(r.dates.release).getTime();
    return isNaN(x) ? (sortNewest ? -Infinity : Infinity) : x;
  };
  return Array.from(byKey.values())
    .map(({ row, labels }) => ({
      ...row,
      label: [...labels].sort().join(', '),
    }))
    .sort((a, b) => (sortNewest ? time(b) - time(a) : time(a) - time(b)));
}

/* ── Transition row rendered inside a product card ─────────────── */

function TransitionRow({ transition }: { transition: Transition }) {
  const status = getStatusConfig(transition.status);
  return (
    <div className="flex border-b border-cyan-500/20 last:border-b-0">
      <div className="shrink-0 px-2 py-1 text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border-r border-cyan-500/20 flex items-center" style={{ minWidth: CARDS_LEFT_WIDTH }}>
        → TRN
      </div>
      <div className="flex-1 px-2 py-1 flex items-center gap-2 flex-wrap">
        <span className="text-[11px] text-cyan-300 border border-cyan-600/70 rounded px-2 py-0.5">
          {transition.fromVersion} → {transition.toVersion} {transition.toProduct?.name && transition.toProduct.name !== transition.fromProduct?.name ? `(${transition.toProduct.name})` : ''}
        </span>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.color} ${status.border}`} style={{ background: 'rgba(2, 6, 23, 0.6)' }}>
          <span className={`inline-block w-2 h-2 rounded-full ${status.bg}`} />
          {status.label}
        </span>
        {transition.availableFrom && (
          <span className="text-[10px] text-slate-400">available from {new Date(transition.availableFrom).toLocaleDateString()}</span>
        )}
      </div>
    </div>
  );
}

/* ── Cards View ────────────────────────────────────────────────── */

function CardsTimelineHeader({ timelineStart, timelineEnd }: { timelineStart: Date; timelineEnd: Date }) {
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  const toPct = (d: Date) => ((d.getTime() - timelineStart.getTime()) / totalMs) * 100;

  const bands: { left: number; width: number; label: string; muted?: boolean }[] = [];
  for (let y = timelineStart.getFullYear(); y < timelineEnd.getFullYear(); y++) {
    const yStart = new Date(y, 0, 1);
    const yEnd = new Date(y + 1, 0, 1);
    const left = Math.max(0, toPct(yStart));
    const right = Math.min(100, toPct(yEnd));
    if (right - left > 0) {
      bands.push({ left, width: right - left, label: String(y), muted: y > new Date().getFullYear() });
    }
  }

  const quarters: { left: number; width: number; label: string; muted?: boolean }[] = [];
  {
    let d = new Date(timelineStart.getFullYear(), Math.floor(timelineStart.getMonth() / 3) * 3, 1);
    while (d < timelineEnd) {
      const qEnd = new Date(d.getFullYear(), d.getMonth() + 3, 1);
      const left = Math.max(0, toPct(d));
      const right = Math.min(100, toPct(qEnd));
      if (right - left > 0) {
        const qNum = Math.floor(d.getMonth() / 3) + 1;
        quarters.push({ left, width: right - left, label: `Q${qNum}`, muted: d > new Date() });
      }
      d = qEnd;
    }
  }

  return (
    <div className="mb-4 select-none">
      {/* Year band */}
      <div className="relative h-8 mb-1">
        {bands.map((b) => (
          <div
            key={b.label}
            className={`absolute top-0 h-full flex items-center justify-center rounded-md text-sm font-bold text-white ${
              b.muted ? 'bg-emerald-700/70' : 'bg-emerald-600'
            }`}
            style={{ left: `${b.left}%`, width: `calc(${b.width}% - 2px)` }}
          >
            {b.label}
          </div>
        ))}
      </div>
      {/* Quarter band */}
      <div className="relative h-6">
        {quarters.map((q, i) => (
          <div
            key={i}
            className={`absolute top-0 h-full flex items-center justify-center rounded text-[11px] font-semibold text-emerald-100 ${
              q.muted ? 'bg-emerald-800/70' : 'bg-emerald-700'
            }`}
            style={{ left: `${q.left}%`, width: `calc(${q.width}% - 2px)` }}
          >
            {q.label}
          </div>
        ))}
      </div>
    </div>
  );
}

/* Lifecycle timeline of ONE version, aligned on the real timeline:
   blue = release → normal support end, amber = → extended end, red = → EOL.
   Computed in absolute timeline % so it stays aligned with the year bands
   when the timeline is dragged or rescaled. */
function LifecycleBar({ dates, toPct, cardStartPct, cardWidthPct }: {
  dates: { release: string; normalEnd: string; extendedEnd: string; eol: string };
  toPct: (d: Date) => number;
  cardStartPct: number; // absolute timeline % where the card begins
  cardWidthPct: number; // absolute timeline % width of the card
}) {
  const t = (s: string) => { const x = new Date(s).getTime(); return isNaN(x) ? null : x; };
  const release = t(dates.release), normalEnd = t(dates.normalEnd), extendedEnd = t(dates.extendedEnd), eol = t(dates.eol);
  if (release === null || eol === null || eol <= release) return null;
  // Absolute timeline % clamped to the visible window, then expressed as a
  // card-local % so each version's bar starts at its REAL release position
  // on the shared timeline (Server 2019 starts before Server 2025, etc.).
  const cardSpan = Math.max(1, cardWidthPct);
  const rel = (time: number) => {
    const abs = Math.max(0, Math.min(100, toPct(new Date(time))));
    return Math.max(0, Math.min(100, ((abs - cardStartPct) / cardSpan) * 100));
  };
  const startRel = rel(release);
  const endRel = rel(eol);
  if (endRel - startRel <= 0) return null;
  const ne = normalEnd !== null ? rel(normalEnd) : null;
  const ee = extendedEnd !== null ? rel(extendedEnd) : null;
  // Once the version has passed its EOL date, the whole bar turns red: the
  // lifecycle is over, the bar must SAY "End of Life" even when extendedEnd
  // == eol leaves the classical red segment zero-width (e.g. Debian LTS).
  const isPastEol = Date.now() >= eol;
  // Where "support actually stopped": extended end if present, else normal end.
  const supportEnd = ee ?? ne;
  return (
    <div className="relative h-2 mx-2 mb-1 rounded-sm overflow-hidden bg-slate-800/60">
      {!isPastEol && (
        <>
          <div className="absolute top-0 h-full bg-blue-500/70" style={{ left: `${startRel}%`, width: `${Math.max(0, (ne ?? endRel) - startRel)}%` }} />
          {supportEnd !== null && supportEnd > (ne ?? 0) && (
            <div className="absolute top-0 h-full bg-amber-500/70" style={{ left: `${Math.max(startRel, ne ?? 0)}%`, width: `${Math.max(0, supportEnd - Math.max(startRel, ne ?? 0))}%` }} />
          )}
          {/* after support ends → No Support (orange, matches the phase legend) */}
          <div className="absolute top-0 h-full bg-orange-500/70" style={{ left: `${supportEnd ?? (ne ?? endRel)}%`, width: `${Math.max(0, endRel - (supportEnd ?? (ne ?? endRel)))}%` }} />
        </>
      )}
      {isPastEol && (
        <>
          {/* Dead version: support spans (release → support end) dimmed, everything
              after the support end painted in the No-Support orange up to the bar end. */}
          <div className="absolute top-0 h-full bg-blue-500/40" style={{ left: `${startRel}%`, width: `${Math.max(0, Math.min(ne ?? endRel, supportEnd ?? endRel) - startRel)}%` }} />
          {supportEnd !== null && (ne ?? 0) < supportEnd && (
            <div className="absolute top-0 h-full bg-amber-500/40" style={{ left: `${Math.max(startRel, ne ?? 0)}%`, width: `${Math.max(0, supportEnd - Math.max(startRel, ne ?? 0))}%` }} />
          )}
          <div className="absolute top-0 h-full bg-orange-500/80" style={{ left: `${Math.max(startRel, supportEnd ?? startRel)}%`, width: `${Math.max(0, endRel - Math.max(startRel, supportEnd ?? startRel))}%` }} />
        </>
      )}
      {/* EOL milestone: thick marker with dark outline so it reads clearly
          even on top of the orange No-Support segment. */}
      <div
        className="absolute top-[-2px] h-[calc(100%+4px)] w-[4px] rounded-sm bg-red-500 ring-1 ring-slate-950"
        style={{ left: `calc(${Math.max(0, Math.min(100, endRel))}% - 2px)` }}
      />
    </div>
  );
}

function SupportCard({ group, timelineStart, timelineEnd, showTodayBar, indentPct, widthPct, config, productTransitionsMap, showLifecycleBar = true, sortNewest = true }: {
  group: RoadmapVersion[];
  timelineStart: Date;
  timelineEnd: Date;
  showTodayBar: boolean;
  indentPct: number;
  widthPct: number;
  config: CardDesignConfig;
  productTransitionsMap?: { from: Map<string, Transition[]>; to: Map<string, Transition[]> };
  showLifecycleBar?: boolean;
  sortNewest?: boolean;
}) {
  // The card represents the whole family. The border reflects the BEST phase
  // available among its versions (best case): if any version is still in
  // normal support the family is green, even though a legacy version is in
  // extended support or EOL — those facts live on their own lifecycle bars.
  const bestVersions = group.filter((v) => v.phase !== 'EOL');
  let phase: LifecyclePhase | string | undefined;
  if (bestVersions.length > 0) {
    phase = bestVersions.reduce((best, v) =>
      (phaseSeverity[v.phase] ?? 0) < (phaseSeverity[best.phase] ?? 0) ? v : best
    ).phase;
  } else {
    phase = worstPhase(group); // everything EOL → red
  }
  const style = getCardsStyle(phase);
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  const toPct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - timelineStart.getTime()) / totalMs) * 100));

  const title = getCardFieldValue(group[0], config.title);
  const headerLabel = getCardFieldValue(group[0], config.headerLabel);
  const rows = buildCardRows(group, config, sortNewest);
  const cardStatus = getStatusConfig(group[0].status);
  // Transition entities attached to this product (from + to), rendered as rows in the card
  const groupTransitions: Transition[] = [
    ...(productTransitionsMap?.from.get(group[0].product) || []),
    ...(productTransitionsMap?.to.get(group[0].product) || []),
  ];
  const isEol = phase === 'EOL' || phase === 'NO_SUPPORT';

  return (
    <div
      className="relative mb-3"
      style={{ marginLeft: `${indentPct}%`, width: `${widthPct}%` }}
    >
      {/* background support span */}
      <div
        className="absolute -z-10 rounded-md"
        style={{
          left: 0,
          width: '100%',
          top: -4,
          bottom: -4,
          background: isEol ? 'transparent' : 'rgba(234, 220, 90, 0.14)',
          border: isEol ? 'none' : '1px solid rgba(234, 220, 90, 0.25)',
        }}
      />
      <div className={`border-2 ${style.cardBorder} rounded-lg overflow-hidden bg-slate-900/90 shadow-[0_4px_14px_rgba(0,0,0,0.4)]`}>
        {/* header row: left label + aggregated title */}
        <div className={`flex border-b ${style.cellBorder}`}>
          <div className={`shrink-0 px-2 py-1.5 text-[11px] font-bold ${style.labelColor} ${style.cellBg} border-r ${style.cellBorder}`} style={{ minWidth: CARDS_LEFT_WIDTH }}>
            {headerLabel}
          </div>
          <div className="flex-1 px-3 py-1.5 text-xs font-semibold text-white text-center flex items-center justify-center gap-1.5 flex-wrap">
            <span>{title}</span>
            {phase === 'RELEASED' && <span className="text-emerald-400">✓</span>}
            {/* status chip with the legend label */}
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cardStatus.color} ${cardStatus.border}`}
              style={{ background: 'rgba(2, 6, 23, 0.6)' }}
            >
              <span className={`inline-block w-2 h-2 rounded-full ${cardStatus.bg}`} />
              {cardStatus.label}
            </span>
          </div>
        </div>
        {/* mapped rows */}
        {rows.map((row, i) => (
          <div key={i} className={`border-b ${style.cellBorder} last:border-b-0`}>
            {/* version cells */}
            <div className="flex">
              <div className={`shrink-0 px-2 py-1 text-[10px] font-bold text-slate-400 border-r ${style.cellBorder} flex items-center`} style={{ minWidth: CARDS_LEFT_WIDTH }}>
                {row.label}
              </div>
              <div className={row.cell2 ? 'flex-1 min-w-0 px-2 py-1' : 'flex-1 px-2 py-1 basis-full'}>
                {row.cell1 && (
                  <span className={`inline-block w-full text-[11px] text-center rounded px-2 py-0.5 border ${
                    row.cell1Status
                      ? (row.cell1Status in phaseConfig
                          ? `${phaseConfig[row.cell1Status as LifecyclePhase].color} ${phaseConfig[row.cell1Status as LifecyclePhase].border}`
                          : `${getStatusConfig(row.cell1Status).color} ${getStatusConfig(row.cell1Status).border} ${getStatusConfig(row.cell1Status).bg}/10`)
                      : 'text-cyan-300 border-cyan-600/70'
                  }`}>
                    {row.cell1}
                  </span>
                )}
              </div>
              {row.cell2 && (
                <div className="shrink-0 min-w-0 px-2 py-1 flex items-center justify-end" style={{ flex: '0 0 auto', width: '11rem' }}>
                  <span className={`inline-block max-w-full text-[10px] text-center rounded px-1.5 py-0.5 border ${
                    row.cell2Status
                      ? (row.cell2Status in phaseConfig
                          ? `${phaseConfig[row.cell2Status as LifecyclePhase].color} ${phaseConfig[row.cell2Status as LifecyclePhase].border}`
                          : `${getStatusConfig(row.cell2Status).color} ${getStatusConfig(row.cell2Status).border} ${getStatusConfig(row.cell2Status).bg}/10`)
                      : 'text-slate-300 border-slate-600/70'
                  }`}>
                    {row.cell2}
                  </span>
                </div>
              )}
            </div>
            {/* lifecycle timeline of THIS version: blue normal, amber extended, red EOL */}
            {showLifecycleBar && <LifecycleBar dates={row.dates} toPct={toPct} cardStartPct={indentPct} cardWidthPct={widthPct} />}
          </div>
        ))}
        {/* transitions as rows inside the card */}
        {groupTransitions.length > 0 && groupTransitions.map((t) => (
          <TransitionRow key={t.id} transition={t} />
        ))}
      </div>
      {showTodayBar && (
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white/70 z-10 pointer-events-none"
          style={{ left: `${toPct(new Date())}%` }}
        />
      )}
    </div>
  );
}

function CardsView({ versions, timelineStart, timelineEnd, showTodayBar }: {
  versions: RoadmapVersion[];
  timelineStart: Date;
  timelineEnd: Date;
  showTodayBar: boolean;
}) {
  const totalMs = timelineEnd.getTime() - timelineStart.getTime();
  const toPct = (d: Date) => Math.max(0, Math.min(100, ((d.getTime() - timelineStart.getTime()) / totalMs) * 100));

  // Multi-design presets, persisted in localStorage
  const [designs, setDesigns] = useState<CardDesignPreset[]>(loadCardDesigns);
  const [activeDesignId, setActiveDesignId] = useState<string>(() => loadCardDesigns()[0]?.id || 'default');
  const [editDesign, setEditDesign] = useState(false);
  const [showLifecycleBars, setShowLifecycleBars] = useState(true);
  // Row order inside each card: newest release first (default) or oldest first
  const [sortNewest, setSortNewest] = useState(true);

  const activeDesign = designs.find((d) => d.id === activeDesignId) || designs[0];
  const designConfig = activeDesign.config;

  const updateDesigns = (next: CardDesignPreset[]) => {
    setDesigns(next);
    saveCardDesigns(next);
  };

  const patchConfig = (slot: keyof CardDesignConfig, field: CardField) => {
    updateDesigns(designs.map((d) => d.id === activeDesign.id ? { ...d, config: { ...d.config, [slot]: field } } : d));
  };

  const createDesign = () => {
    const baseName = 'Design';
    let n = designs.length + 1;
    while (designs.some((d) => d.name === `${baseName} ${n}`)) n++;
    const newDesign: CardDesignPreset = {
      id: `design-${Date.now()}`,
      name: `${baseName} ${n}`,
      config: { ...activeDesign.config },
    };
    updateDesigns([...designs, newDesign]);
    setActiveDesignId(newDesign.id);
  };

  const renameDesign = (id: string, name: string) => {
    updateDesigns(designs.map((d) => d.id === id ? { ...d, name } : d));
  };

  const deleteDesign = (id: string) => {
    const next = designs.filter((d) => d.id !== id);
    const final = next.length > 0 ? next : [{ id: 'default', name: 'Default', config: defaultCardConfig }];
    updateDesigns(final);
    if (activeDesignId === id) setActiveDesignId(final[0].id);
  };

  const resetConfig = () => {
    updateDesigns(designs.map((d) => d.id === activeDesign.id ? { ...d, config: { ...defaultCardConfig } } : d));
  };

  // Aggregate by the chosen title field (e.g. one card per OS)
  const byTitle = new Map<string, RoadmapVersion[]>();
  for (const v of versions) {
    const key = getCardFieldValue(v, designConfig.title);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key)!.push(v);
  }
  const cards = Array.from(byTitle.values())
    .sort((a, b) => new Date(a[0].releaseDate).getTime() - new Date(b[0].releaseDate).getTime());

  // Transitions render as rows inside their product cards, indexed by product name
  const { data: allTransitions } = useTransitions();
  const productTransitionsMap = useMemo(() => {
    const from = new Map<string, Transition[]>();
    const to = new Map<string, Transition[]>();
    for (const t of allTransitions || []) {
      const fromKey = t.fromProduct?.name;
      const toKey = t.toProduct?.name;
      if (fromKey) from.set(fromKey, [...(from.get(fromKey) || []), t]);
      if (toKey && toKey !== fromKey) to.set(toKey, [...(to.get(toKey) || []), t]);
    }
    return { from, to };
  }, [allTransitions]);

  return (
    <div>
      <CardsTimelineHeader timelineStart={timelineStart} timelineEnd={timelineEnd} />

      {/* Design selector bar */}
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <LayoutGrid className="h-3.5 w-3.5 text-slate-500" />
        <span className="text-xs text-slate-500">Design:</span>
        {designs.map((d) => (
          <button
            key={d.id}
            onClick={() => setActiveDesignId(d.id)}
            onDoubleClick={() => renameDesign(d.id, window.prompt('Design name', d.name) || d.name)}
            title={d.id === activeDesignId ? 'Active design (double-click to rename)' : 'Switch to this design (double-click to rename)'}
            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              d.id === activeDesignId
                ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {d.name}
          </button>
        ))}
        <button
          onClick={createDesign}
          className="px-2 py-1 rounded-md border border-dashed border-slate-600 text-xs text-slate-400 hover:border-slate-400 hover:text-slate-300 transition-colors"
          title="Create a new design from the current one"
        >
          + Design
        </button>
        {designs.length > 1 && (
          <button
            onClick={() => deleteDesign(activeDesign.id)}
            className="px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs text-slate-400 hover:text-red-400 hover:border-red-500/40 transition-colors"
            title="Delete the active design"
          >
            Delete
          </button>
        )}

        <button
          onClick={() => setShowLifecycleBars((v) => !v)}
          className={`ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            showLifecycleBars
              ? 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
              : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
          }`}
          title="Show or hide the lifecycle bars under each version"
        >
          {showLifecycleBars ? 'Hide lifecycle bars' : 'Show lifecycle bars'}
        </button>

        <button
          onClick={() => setSortNewest((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 transition-colors"
          title="Sort the version rows inside each card by release date"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortNewest ? 'Newest first' : 'Oldest first'}
        </button>

        <button
          onClick={() => setEditDesign((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
            editDesign
              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Edit design
        </button>
      </div>

      {/* Field mapping editor for the active design */}
      {editDesign && (
        <div className="mb-4 p-3 rounded-lg bg-slate-900/80 border border-cyan-500/30 flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-cyan-400">{activeDesign.name} — fields</span>
          {(['headerLabel', 'title', 'rowLabel', 'cell1', 'cell2'] as const).map((slot) => (
            <div key={slot} className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-500">{cardSlotLabels[slot]}:</span>
              <PickUpList
                options={cardFieldOptions}
                value={designConfig[slot]}
                onChange={(v) => patchConfig(slot, v)}
              />
            </div>
          ))}
          <button
            onClick={resetConfig}
            className="ml-auto text-[11px] px-2 py-1 rounded-md bg-slate-800 border border-slate-700 text-slate-400 hover:bg-slate-700 transition-colors"
          >
            Reset
          </button>
        </div>
      )}

      <div className="relative" style={{ minHeight: 120 }}>
        {cards.length === 0 ? (
          <div className="text-slate-500 text-center py-12">No versions match your filters</div>
        ) : (
          cards.map((group) => {
            // Card spans the group's REAL date bounds: earliest release → latest EOL
            const times = group
              .map((v) => ({ release: new Date(v.releaseDate).getTime(), eol: new Date(v.eolDate).getTime() }))
              .filter((t) => !isNaN(t.release) && !isNaN(t.eol));
            const releaseTime = times.length > 0 ? Math.min(...times.map((t) => t.release)) : NaN;
            const eolTime = times.length > 0 ? Math.max(...times.map((t) => t.eol)) : NaN;
            const releaseDateObj = isNaN(releaseTime) ? null : new Date(releaseTime);
            const eolDateObj = isNaN(eolTime) ? null : new Date(eolTime);
            // Missing dates → card spans the whole timeline rather than a fabricated position
            const releasePct = releaseDateObj ? toPct(releaseDateObj) : 0;
            const eolPct = eolDateObj ? toPct(eolDateObj) : 100;
            const indentPct = Math.min(releasePct, 85);
            return (
              <SupportCard
                key={group[0].id}
                group={group}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                showTodayBar={showTodayBar}
                indentPct={indentPct}
                widthPct={Math.max(10, Math.min(eolPct - releasePct, 100 - indentPct))}
                config={designConfig}
                productTransitionsMap={productTransitionsMap}
                showLifecycleBar={showLifecycleBars}
                sortNewest={sortNewest}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function Roadmap() {
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<LifecyclePhase | ''>('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedAZ, setSelectedAZ] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedInfraVersion, setSelectedInfraVersion] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<'' | EntityType>('');
  const [timeSpan, setTimeSpan] = useState(5);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [design, setDesign] = useState<RoadmapDesign>('gantt');
  const [rowAxes, setRowAxes] = useState<Axis[]>(['PRODUCT', 'PRODUCT_VERSION', 'PHASE']);
  const [scale, setScale] = useState<Scale>('year');
  const [showTodayBar, setShowTodayBar] = useState(true);
  const [timelineStart, setTimelineStart] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear() - 1, 0, 1);
  });
  const [columnWidths, setColumnWidths] = useState<number[]>([]);
  const [labelColumnWidth, setLabelColumnWidth] = useState(240);

  const timelineEnd = useMemo(() => {
    const d = new Date(timelineStart);
    d.setFullYear(d.getFullYear() + timeSpan);
    return d;
  }, [timelineStart, timeSpan]);

  // Update column widths when axes change
  useEffect(() => {
    setColumnWidths(rowAxes.map(() => 130));
  }, [rowAxes]);

  // Drag state for timeline panning
  const [dragState, setDragState] = useState<{
    startX: number;
    startDate: number;
    pixelsPerMs: number;
  } | null>(null);

  useEffect(() => {
    if (!dragState) return;
    const handleMove = (e: MouseEvent) => {
      const dx = e.clientX - dragState.startX;
      const msDelta = dx / dragState.pixelsPerMs;
      const newStartMs = dragState.startDate + msDelta;
      const minMs = new Date('2000-01-01').getTime();
      const maxMs = new Date().getFullYear() + 20;
      const clampedMs = Math.max(minMs, Math.min(new Date(maxMs, 11, 31).getTime(), newStartMs));
      setTimelineStart(new Date(clampedMs));
    };
    const handleUp = () => setDragState(null);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState]);

  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('.resize-handle') || target.closest('.no-drag')) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const totalMs = timelineEnd.getTime() - timelineStart.getTime();
    const pixelsPerMs = rect.width / totalMs;
    setDragState({
      startX: e.clientX,
      startDate: timelineStart.getTime(),
      pixelsPerMs,
    });
  }, [timelineStart, timelineEnd]);

  const handleResetToday = () => {
    const now = new Date();
    setTimelineStart(new Date(now.getFullYear() - 1, 0, 1));
  };

  const handleResizeColumn = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[index];

    const handleMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(60, startWidth + delta);
      setColumnWidths((prev) => {
        const next = [...prev];
        next[index] = newWidth;
        return next;
      });
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleResizeLabel = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = labelColumnWidth;

    const handleMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.max(120, startWidth + delta);
      setLabelColumnWidth(newWidth);
    };

    const handleUp = () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const [perspective, setPerspective] = useState<RoadmapPerspective>('product');
  const { data: infraVersions } = useInfraVersions();
  const { data: regions } = useRegions();
  useMemo(() => setRegionNameIndex(regions), [regions]);

  const allVersions = useMemo(() => {
    const versions: RoadmapVersion[] = [];
    if (perspective === 'infra') {
      for (const iv of infraVersions || []) {
        versions.push(infraVersionToRoadmap(iv));
      }
      return versions;
    }
    if (products) {
      for (const product of products) {
        if (perspective === 'compute') {
          // Compute view: only compute product variants
          if (product.computeType) {
            for (const variant of product.variants || []) {
              if (variant.releaseDate) {
                versions.push(productVariantToRoadmap(product, variant));
              }
            }
          }
        } else {
          // Product view: only product versions
          for (const pv of product.productVersions || []) {
            if (pv.releaseDate) {
              versions.push(productVersionToRoadmap(product, pv));
            }
          }
        }
      }
    }
    return versions;
  }, [products, infraVersions, perspective, regions]);

  const allFamilies = useMemo(() => {
    return Array.from(new Set(allVersions.map((v) => v.family).filter(Boolean)));
  }, [allVersions]);

  const allCategories = useMemo(() => {
    return Array.from(new Set(allVersions.map((v) => v.category).filter(Boolean)));
  }, [allVersions]);

  const allInfraVersions = useMemo(() => {
    return Array.from(new Set(allVersions.map((v) => v.infraVersion).filter((iv) => iv && iv !== '—')));
  }, [allVersions]);

  const allRegions = useMemo(() => {
    return Array.from(new Set(allVersions.flatMap((v) => v.regions)));
  }, [allVersions]);

  const allCountries = useMemo(() => {
    return Array.from(new Set(allVersions.flatMap((v) => v.countries)));
  }, [allVersions]);

  const allAZs = useMemo(() => {
    return Array.from(new Set(allVersions.flatMap((v) => v.azs)));
  }, [allVersions]);

  const allZones = useMemo(() => {
    return Array.from(new Set(allVersions.flatMap((v) => v.zones)));
  }, [allVersions]);

  const filtered = useMemo(() => {
    let result = [...allVersions];
    if (selectedFamily) {
      result = result.filter((v) => v.family === selectedFamily);
    }
    if (selectedPhase) {
      result = result.filter((v) => v.phase === selectedPhase);
    }
    if (selectedStatus) {
      result = result.filter((v) => (v.status || 'AVAILABLE') === selectedStatus);
    }
    if (selectedCategory) {
      result = result.filter((v) => v.category === selectedCategory);
    }
    if (selectedRegion) {
      result = result.filter((v) => v.regions.includes(selectedRegion));
    }
    if (selectedCountry) {
      result = result.filter((v) => v.countries.includes(selectedCountry));
    }
    if (selectedAZ) {
      result = result.filter((v) => v.azs.includes(selectedAZ));
    }
    if (selectedZone) {
      result = result.filter((v) => v.zones.includes(selectedZone));
    }
    if (selectedInfraVersion) {
      result = result.filter((v) => v.infraVersion === selectedInfraVersion);
    }
    if (selectedEntityType) {
      result = result.filter((v) => {
        if (selectedEntityType === 'product') return v.type === 'product' || v.type === 'product-version';
        if (selectedEntityType === 'flavor') return v.type === 'flavor';
        if (selectedEntityType === 'os') return v.type === 'os';
        return true;
      });
    }
    return result;
  }, [allVersions, selectedFamily, selectedPhase, selectedStatus, selectedCategory, selectedRegion, selectedCountry, selectedAZ, selectedZone, selectedEntityType, selectedInfraVersion]);

  const tree = useMemo(() => buildTree(filtered, rowAxes), [filtered, rowAxes]);
  const flatRows = useMemo(() => buildFlatRows(filtered, rowAxes), [filtered, rowAxes]);

  const axisOptions = perspective === 'product' ? axisOptionsProduct : perspective === 'infra' ? axisOptionsInfra : axisOptionsCompute;

  const handlePerspectiveChange = (newPerspective: RoadmapPerspective) => {
    setPerspective(newPerspective);
    setRowAxes(newPerspective === 'product' ? ['PRODUCT', 'PRODUCT_VERSION', 'PHASE'] : newPerspective === 'infra' ? ['INFRA_VERSION', 'PHASE'] : ['PRODUCT', 'OS', 'OS_VERSION']);
    setSelectedFamily('');
    setSelectedCategory('');
    setSelectedPhase('');
    setSelectedRegion('');
    setSelectedCountry('');
    setSelectedAZ('');
    setSelectedZone('');
    setSelectedInfraVersion('');
    setSelectedEntityType('');
  };

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

  const isLoading = productsLoading;
  const isError = productsError;
  const refetch = () => { refetchProducts(); };

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
          <p className="text-slate-400">Visual timeline of product lifecycles and support phases</p>
        </div>
      </AnimatedSection>

      {/* Toolbar */}
      <AnimatedSection delay={100} className="relative z-[60]">
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-400">FILTERS</span>
          </div>

          <span className="text-xs text-slate-500">Type:</span>
          <PickUpList
            options={entityTypeOptions}
            value={selectedEntityType}
            onChange={(v) => setSelectedEntityType(v as '' | EntityType)}
          />

          {perspective === 'compute' && (
            <>
              <span className="text-xs text-slate-500">Family:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allFamilies.map((f) => ({ value: f, label: f }))]}
                value={selectedFamily}
                onChange={(v) => setSelectedFamily(v)}
              />
            </>
          )}

          {perspective === 'product' && (
            <>
              <span className="text-xs text-slate-500">Category:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allCategories.map((c) => ({ value: c, label: c }))]}
                value={selectedCategory}
                onChange={(v) => setSelectedCategory(v)}
              />
            </>
          )}

          <span className="text-xs text-slate-500">Phase:</span>
          <PickUpList
            options={[
              { value: '', label: 'All' },
              ...Object.keys(phaseConfig).map((p) => ({ value: p as LifecyclePhase, label: phaseConfig[p as LifecyclePhase].label })),
            ]}
            value={selectedPhase}
            onChange={(v) => setSelectedPhase(v)}
          />

          <span className="text-xs text-slate-500">Status:</span>
          <PickUpList
            options={[
              { value: '', label: 'All' },
              ...Object.keys(productStatusConfig).map((s) => ({ value: s, label: productStatusConfig[s].label })),
            ]}
            value={selectedStatus}
            onChange={(v) => setSelectedStatus(v)}
          />

          {allZones.length > 0 && (
            <>
              <span className="text-xs text-slate-500">Zone:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allZones.map((z) => ({ value: z, label: z }))]}
                value={selectedZone}
                onChange={(v) => setSelectedZone(v)}
              />
            </>
          )}

          {allInfraVersions.length > 0 && (
            <>
              <span className="text-xs text-slate-500">Infra Version:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allInfraVersions.map((iv) => ({ value: iv, label: iv }))]}
                value={selectedInfraVersion}
                onChange={(v) => setSelectedInfraVersion(v)}
              />
            </>
          )}

          {allRegions.length > 0 && (
            <>
              <span className="text-xs text-slate-500">Region:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allRegions.map((r) => ({ value: r, label: r }))]}
                value={selectedRegion}
                onChange={(v) => setSelectedRegion(v)}
              />
            </>
          )}

          {allCountries.length > 0 && (
            <>
              <span className="text-xs text-slate-500">Country:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allCountries.map((c) => ({ value: c, label: c }))]}
                value={selectedCountry}
                onChange={(v) => setSelectedCountry(v)}
              />
            </>
          )}

          {allAZs.length > 0 && (
            <>
              <span className="text-xs text-slate-500">AZ:</span>
              <PickUpList
                options={[{ value: '', label: 'All' }, ...allAZs.map((z) => ({ value: z, label: z }))]}
                value={selectedAZ}
                onChange={(v) => setSelectedAZ(v)}
              />
            </>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Scale */}
          <span className="text-xs text-slate-500">Scale:</span>
          <PickUpList
            options={scaleOptions}
            value={scale}
            onChange={(v) => setScale(v)}
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setTimeSpan((s) => Math.max(1, s - 1))}
              className="p-1.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <span className="text-xs text-slate-400 w-8 text-center">{timeSpan}y</span>
            <button
              onClick={() => setTimeSpan((s) => Math.min(20, s + 1))}
              className="p-1.5 rounded-md bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700 transition-colors"
              title="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex gap-1">
            {[3, 5, 10].map((years) => (
              <button
                key={years}
                onClick={() => setTimeSpan(years)}
                className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeSpan === years
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {years}y
              </button>
            ))}
          </div>

          <div className="h-4 w-px bg-slate-700" />

          {/* Today bar toggle */}
          <button
            onClick={() => setShowTodayBar((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              showTodayBar
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
            }`}
            title="Toggle today bar"
          >
            {showTodayBar ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            Today
          </button>

          {/* Reset to today */}
          <button
            onClick={handleResetToday}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700"
            title="Reset to today"
          >
            <Crosshair className="h-3.5 w-3.5" />
            Center
          </button>
        </div>
      </AnimatedSection>

      {/* View Mode + Axes */}
      <AnimatedSection delay={150} className="relative z-50">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Perspective toggle */}
          <div className="flex rounded-md border border-slate-700 overflow-hidden">
            <button
              onClick={() => handlePerspectiveChange('product')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                perspective === 'product'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Product
            </button>
            <button
              onClick={() => handlePerspectiveChange('compute')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                perspective === 'compute'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Compute
            </button>
            <button
              onClick={() => handlePerspectiveChange('infra')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                perspective === 'infra'
                  ? 'bg-purple-500/10 text-purple-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              Infra
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700" />

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

          {/* Design toggle */}
          <span className="text-xs text-slate-500">Design:</span>
          <div className="flex rounded-md border border-slate-700 overflow-hidden">
            <button
              onClick={() => setDesign('gantt')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                design === 'gantt'
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Gantt
            </button>
            <button
              onClick={() => setDesign('cards')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                design === 'cards'
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Cards
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
        {/* Product status legend (screenshot top-right) */}
        <div className="flex flex-wrap gap-4 mb-4 text-xs">
          {Object.entries(productStatusConfig).map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full border ${cfg.bg} ${cfg.border}`} />
              <span className="text-slate-400">{cfg.label}</span>
            </div>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection delay={300}>
        <div
          className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 overflow-x-auto"
          onMouseDown={handleTimelineMouseDown}
          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
        >
          <div className="min-w-[600px]">
            {design === 'cards' ? (
              <CardsView
                versions={filtered}
                timelineStart={timelineStart}
                timelineEnd={timelineEnd}
                showTodayBar={showTodayBar}
              />
            ) : (
              <>
                <TimelineAxis
                  timelineStart={timelineStart}
                  timelineEnd={timelineEnd}
                  scale={scale}
                  labelWidth={viewMode === 'flat' ? columnWidths.reduce((a, b) => a + b, 0) : labelColumnWidth}
                  onResizeLabel={viewMode === 'grouped' ? handleResizeLabel : undefined}
                />

                {viewMode === 'grouped' && (
              <>
                {tree.length === 0 ? (
                  <div className="text-slate-500 text-center py-12">No versions match your filters</div>
                ) : (
                  tree.map((node) => (
                    <TreeNodeRow key={node.id} node={node} timelineStart={timelineStart} timelineEnd={timelineEnd} showTodayBar={showTodayBar} labelWidth={labelColumnWidth} />
                  ))
                )}
              </>
            )}

            {viewMode === 'flat' && (
              <>
                {flatRows.length === 0 ? (
                  <div className="text-slate-500 text-center py-12">No versions match your filters</div>
                ) : (
                  <FlatTable
                    rows={flatRows}
                    axes={rowAxes}
                    timelineStart={timelineStart}
                    timelineEnd={timelineEnd}
                    showTodayBar={showTodayBar}
                    columnWidths={columnWidths}
                    onResizeColumn={handleResizeColumn}
                  />
                )}
              </>
            )}
              </>
            )}
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
