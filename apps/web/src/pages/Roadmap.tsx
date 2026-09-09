import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useProducts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Filter, ChevronDown, ChevronRight, BarChart3, Table,
  Crosshair, Eye, EyeOff, ZoomIn, ZoomOut
} from 'lucide-react';
import type { Product, ProductVariant, ProductVersion } from '@cloudmarket/shared-types';
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

type Axis = 'FAMILY' | 'OS' | 'PHASE' | 'VERSION' | 'CATEGORY' | 'PRODUCT' | 'FLAVOR' | 'REGION' | 'COUNTRY' | 'AZ' | 'ZONE' | 'PRODUCT_VERSION' | 'OS_VERSION';
type RoadmapPerspective = 'product' | 'compute';
type Scale = 'month' | 'quarter' | 'year';
type ViewMode = 'grouped' | 'flat';
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
  type: 'os' | 'product' | 'product-version' | 'flavor';
  regions: string[];
  countries: string[];
  azs: string[];
  zones: string[];
}

function productVariantToRoadmap(product: Product, variant: ProductVariant): RoadmapVersion {
  const azList = variant.availabilityZones?.map((z) => z.availabilityZone) || [];
  const zoneList = variant.zones?.map((z) => z.zone) || [];
  return {
    id: variant.id,
    name: variant.name,
    osVersionName: variant.osVersion?.version || variant.name,
    releaseDate: variant.releaseDate || product.createdAt,
    normalSupportEnd: variant.normalSupportEnd || variant.eolDate || product.createdAt,
    extendedSupportEnd: variant.extendedSupportEnd || variant.eolDate || product.createdAt,
    eolDate: variant.eolDate || product.createdAt,
    phase: variant.phase,
    family: variant.os?.family || 'OTHER',
    os: variant.os?.name || '—',
    category: product.category?.name || 'OTHER',
    product: product.name,
    flavor: variant.flavor?.name || '—',
    type: 'product',
    regions: [...new Set(azList.map((az) => az.region).filter(Boolean))],
    countries: [...new Set(azList.map((az) => az.country).filter(Boolean))],
    azs: [...new Set(azList.map((az) => az.code).filter(Boolean))],
    zones: [...new Set(zoneList.map((z) => z.name).filter(Boolean))],
  };
}

function productVersionToRoadmap(product: Product, pv: ProductVersion): RoadmapVersion {
  const azList = pv.variants?.flatMap((v) => v.availabilityZones?.map((z) => z.availabilityZone) || []) || [];
  const zoneList = pv.variants?.flatMap((v) => v.zones?.map((z) => z.zone) || []) || [];
  return {
    id: pv.id,
    name: pv.version,
    osVersionName: pv.version,
    releaseDate: pv.releaseDate || product.createdAt,
    normalSupportEnd: pv.normalSupportEnd || pv.eolDate || product.createdAt,
    extendedSupportEnd: pv.extendedSupportEnd || pv.eolDate || product.createdAt,
    eolDate: pv.eolDate || product.createdAt,
    phase: pv.phase,
    family: pv.variants?.[0]?.os?.family || product.variants?.[0]?.os?.family || 'OTHER',
    os: pv.variants?.[0]?.os?.name || product.variants?.[0]?.os?.name || '—',
    category: product.category?.name || 'OTHER',
    product: product.name,
    flavor: '—',
    type: 'product-version',
    regions: [...new Set(azList.map((az) => az.region).filter(Boolean))],
    countries: [...new Set(azList.map((az) => az.country).filter(Boolean))],
    azs: [...new Set(azList.map((az) => az.code).filter(Boolean))],
    zones: [...new Set(zoneList.map((z) => z.name).filter(Boolean))],
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
          {new Date(version.releaseDate).getFullYear()} → {new Date(version.eolDate).getFullYear()}
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

  return Array.from(merged.values())
    .sort((a, b) => new Date(a.version.releaseDate).getTime() - new Date(b.version.releaseDate).getTime());
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

/* ── Main Page ─────────────────────────────────────────────────── */

export default function Roadmap() {
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const [selectedFamily, setSelectedFamily] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<LifecyclePhase | ''>('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedAZ, setSelectedAZ] = useState('');
  const [selectedZone, setSelectedZone] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState<'' | EntityType>('');
  const [timeSpan, setTimeSpan] = useState(5);
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
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

  const allVersions = useMemo(() => {
    const versions: RoadmapVersion[] = [];
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
  }, [products, perspective]);

  const allFamilies = useMemo(() => {
    return Array.from(new Set(allVersions.map((v) => v.family).filter(Boolean)));
  }, [allVersions]);

  const allCategories = useMemo(() => {
    return Array.from(new Set(allVersions.map((v) => v.category).filter(Boolean)));
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
    if (selectedEntityType) {
      result = result.filter((v) => {
        if (selectedEntityType === 'product') return v.type === 'product' || v.type === 'product-version';
        if (selectedEntityType === 'flavor') return v.type === 'flavor';
        if (selectedEntityType === 'os') return v.type === 'os';
        return true;
      });
    }
    return result;
  }, [allVersions, selectedFamily, selectedPhase, selectedCategory, selectedRegion, selectedCountry, selectedAZ, selectedZone, selectedEntityType]);

  const tree = useMemo(() => buildTree(filtered, rowAxes), [filtered, rowAxes]);
  const flatRows = useMemo(() => buildFlatRows(filtered, rowAxes), [filtered, rowAxes]);

  const axisOptions = perspective === 'product' ? axisOptionsProduct : axisOptionsCompute;

  const handlePerspectiveChange = (newPerspective: RoadmapPerspective) => {
    setPerspective(newPerspective);
    setRowAxes(newPerspective === 'product' ? ['PRODUCT', 'PRODUCT_VERSION', 'PHASE'] : ['PRODUCT', 'OS', 'OS_VERSION']);
    setSelectedFamily('');
    setSelectedCategory('');
    setSelectedPhase('');
    setSelectedRegion('');
    setSelectedCountry('');
    setSelectedAZ('');
    setSelectedZone('');
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
        <div
          className="p-5 rounded-xl bg-slate-900/50 border border-slate-800 overflow-x-auto"
          onMouseDown={handleTimelineMouseDown}
          style={{ cursor: dragState ? 'grabbing' : 'grab' }}
        >
          <div className="min-w-[600px]">
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
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
