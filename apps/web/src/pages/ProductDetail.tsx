import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Product, Dependency, ProductVariant, Flavor } from '@cloudmarket/shared-types';
import { formatFlavorAttrs } from '@/lib/utils';
import { useProduct, useProducts, usePerformanceProfiles, useProductTransitions } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import PerformanceGauge from '@/components/PerformanceGauge';
import WorldMap from '@/components/WorldMap';
import GanttChart, { type GanttBarData } from '@/components/GanttChart';
import OsLifecycleTab, { osVersionLabel } from '@/components/OsLifecycleTab';
import UpgradesTransitionsTab from '@/components/UpgradesTransitionsTab';
import { phaseLabel, phaseColorClass } from '@/components/LifecycleTimeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Cpu,
  Database,
  Server,
  Monitor,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  FileText,
  GitBranch,
  ArrowUpRight,
  Calendar,
  Clock,
  Box,
  Layers,
  Send,
  Globe,
  MapPin,
  Filter,
  HardDrive,
  X,
  Search,
  ChevronDown,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Cpu,
  Database,
  Server,
  Monitor,
};

const regionColors: Record<string, string> = {
  'eu-west': '#3b82f6',
  'eu-central': '#60a5fa',
  'us-east': '#10b981',
  'us-west': '#34d399',
  'ap-south': '#f59e0b',
  'ap-east': '#f59e0b',
  'ap-southeast': '#fbbf24',
  'ap-northeast': '#fbbf24',
  'sa-east': '#ef4444',
  'af-south': '#a855f7',
  'me-south': '#ec4899',
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Compact date for tight spots (Gantt sublabels): "Aug 9, 2025" instead of "August 9, 2025"
function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function slugifyHeading(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

/* Table of contents tiles for product documentation */
function DocTableOfContents({ text }: { text: string }) {
  const sections = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('## '))
    .map((l) => l.slice(3).trim());
  if (sections.length === 0) return null;

  const iconFor = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('description') || t.includes('overview')) return FileText;
    if (t.includes('access')) return Globe;
    if (t.includes('api')) return Zap;
    if (t.includes('code') || t.includes('terraform') || t.includes('iac')) return Cpu;
    if (t.includes('limit')) return AlertTriangle;
    return FileText;
  };

  const goTo = (title: string) => {
    document.getElementById(`sec-${slugifyHeading(title)}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mb-6">
      {sections.map((s) => {
        const Icon = iconFor(s);
        return (
          <button
            key={s}
            onClick={() => goTo(s)}
            className="flex items-center gap-2 px-3 py-3 rounded-lg bg-slate-900 border border-slate-800 text-left text-sm text-slate-300 hover:border-blue-500/60 hover:text-blue-300 hover:bg-slate-800/60 transition-colors"
          >
            <Icon className="h-4 w-4 shrink-0 text-blue-500" />
            <span className="truncate">{s}</span>
          </button>
        );
      })}
    </div>
  );
}

/* Simple markdown-like renderer for docs/roadmap */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let codeLang = '';
  let tableRows: string[][] = [];

  const renderInline = (s: string): React.ReactNode => {
    const parts = s.split(/(`[^`]+`)/g);
    return parts.map((part, j) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 2 ? (
        <code key={j} className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 text-[0.85em] font-mono">
          {part.slice(1, -1)}
        </code>
      ) : (
        part
      )
    );
  };

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="list-disc pl-5 space-y-1 my-3">
          {listItems}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushCode = () => {
    if (!inCode) return;
    if (codeLines.length > 0) {
      elements.push(
        <pre key={`pre-${elements.length}`} className="my-3 rounded-lg bg-slate-900 border border-slate-800 p-4 overflow-x-auto">
          {codeLang && (
            <div className="text-xs text-slate-500 font-mono mb-2">{codeLang}</div>
          )}
          <code className="text-sm text-slate-200 font-mono leading-relaxed whitespace-pre">
            {codeLines.join('\n')}
          </code>
        </pre>
      );
    }
    codeLines = [];
    codeLang = '';
    inCode = false;
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const [header, ...body] = tableRows;
    elements.push(
      <div key={`tbl-${elements.length}`} className="my-3 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {header.map((cell, j) => (
                <th key={j} className="text-left px-3 py-2 bg-slate-900 border border-slate-800 text-white font-semibold">
                  {renderInline(cell)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, r) => (
              <tr key={r}>
                {row.map((cell, j) => (
                  <td key={j} className="text-left px-3 py-2 border border-slate-800 text-slate-300">
                    {renderInline(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();

    // Code fences
    if (trimmed.startsWith('```')) {
      if (inCode) {
        flushCode();
      } else {
        flushList();
        flushTable();
        inCode = true;
        codeLang = trimmed.slice(3).trim();
      }
      return;
    }
    if (inCode) {
      codeLines.push(line);
      return;
    }

    // Tables
    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      const cells = trimmed.slice(1, -1).split('|').map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) return; // separator row
      if (tableRows.length === 0) flushList();
      tableRows.push(cells);
      return;
    } else if (tableRows.length > 0) {
      flushTable();
    }

    if (!trimmed) {
      flushList();
      flushTable();
      elements.push(<div key={`sp-${i}`} className="h-3" />);
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      const heading = trimmed.slice(3);
      elements.push(
        <h2 key={`h2-${i}`} id={`sec-${slugifyHeading(heading)}`} className="text-xl font-bold text-white mt-6 mb-3 scroll-mt-24">
          {heading}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith('# ')) {
      flushList();
      elements.push(
        <h1 key={`h1-${i}`} className="text-2xl font-bold text-white mt-6 mb-3">
          {trimmed.slice(2)}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      inList = true;
      listItems.push(
        <li key={`li-${i}`} className="text-slate-300">
          {renderInline(trimmed.slice(2))}
        </li>
      );
      return;
    }
    if (inList && !trimmed.startsWith('- ') && !trimmed.startsWith('* ')) {
      flushList();
    }

    flushList();
    elements.push(
      <p key={`p-${i}`} className="text-slate-300 leading-relaxed">
        {renderInline(trimmed)}
      </p>
    );
  });

  flushList();
  flushCode();
  flushTable();

  return <div className="space-y-1">{elements}</div>;
}

/* Simple dependency graph */
function DependencyGraph({
  productName,
  dependencies,
}: {
  productName: string;
  dependencies: { id: string; type: string; dependsOn?: { name: string; slug: string; category?: { icon?: string | null } | null } | null }[];
}) {
  if (!dependencies.length) return null;

  const width = 600;
  const height = Math.max(200, dependencies.length * 80 + 40);
  const centerX = 160;
  const startY = 40;
  const gapY = 80;

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full max-w-xl" style={{ minWidth: 320 }}>
        {/* Lines */}
        {dependencies.map((dep, i) => {
          const y = startY + i * gapY + 20;
          const targetX = 380;
          const isRequired = dep.type === 'REQUIRED';
          return (
            <g key={dep.id}>
              <line
                x1={centerX + 80}
                y1={height / 2}
                x2={targetX - 20}
                y2={y}
                stroke={isRequired ? '#f59e0b' : '#10b981'}
                strokeWidth={2}
                strokeDasharray={isRequired ? undefined : '6 4'}
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {/* Arrow marker */}
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#64748b" />
          </marker>
        </defs>

        {/* Center node (current product) */}
        <rect x={centerX - 80} y={height / 2 - 25} width={160} height={50} rx={8} fill="#1e293b" stroke="#3b82f6" strokeWidth={2} />
        <text x={centerX} y={height / 2 - 2} textAnchor="middle" fill="#93c5fd" fontSize={12} fontWeight={600}>
          {productName.length > 18 ? productName.slice(0, 18) + '…' : productName}
        </text>
        <text x={centerX} y={height / 2 + 14} textAnchor="middle" fill="#64748b" fontSize={10}>
          Current product
        </text>

        {/* Dependency nodes */}
        {dependencies.map((dep, i) => {
          const y = startY + i * gapY;
          const isRequired = dep.type === 'REQUIRED';
          return (
            <g key={`node-${dep.id}`}>
              <rect x={380} y={y} width={180} height={40} rx={6} fill="#0f172a" stroke={isRequired ? '#f59e0b' : '#10b981'} strokeWidth={1.5} />
              <text x={390} y={y + 16} fill="#e2e8f0" fontSize={11} fontWeight={500}>
                {dep.dependsOn?.name || 'Product'}
              </text>
              <text x={390} y={y + 30} fill={isRequired ? '#fbbf24' : '#34d399'} fontSize={9} fontWeight={600}>
                {isRequired ? 'REQUIRED' : 'RECOMMENDED'}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Variant card for compute products */
function PickupInput({
  label,
  value,
  onChange,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.id === value);
  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex-1" ref={containerRef}>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <div className="relative">
        {selected ? (
          <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 min-h-[40px]">
            <span className="text-sm text-white flex-1">{selected.label}</span>
            <button
              onClick={() => { onChange(''); setQuery(''); }}
              className="text-slate-500 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder={placeholder || `Search ${label.toLowerCase()}...`}
              className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 min-h-[40px]"
            />
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          </div>
        )}
        {open && !selected && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">No results</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { onChange(opt.id); setQuery(''); setOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-white hover:bg-slate-800 transition-colors"
                >
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* Variant row — compact one-line-per-variant */
function VariantRow({ variant, product, count = 1, osEntries = [], flavorFieldDefs = [] }: { variant: ProductVariant; product: Product; count?: number; osEntries?: { id: string; label: string; availabilityType?: string }[]; flavorFieldDefs?: any[] }) {
  // Derive all unique zones for this variant from: variant zones, product zones, flavor zones, OS zones
  const variantZoneMap = new Map((variant.zones || []).map((vz: any) => [vz.zoneId, vz.zone]));
  const productZoneMap = new Map((product.zones || []).map((pz: any) => [pz.zoneId, pz.zone]));
  const flavorZoneMap = new Map((variant.flavor?.zones || []).map((fz: any) => [fz.zoneId, fz.zone]));
  const osZoneMap = new Map((variant.os?.zones || []).map((oz: any) => [oz.zoneId, oz.zone]));
  const allZoneEntries = [...variantZoneMap, ...productZoneMap, ...flavorZoneMap, ...osZoneMap];
  const uniqueZones = Array.from(new Map(allZoneEntries).values());

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-1.5 transition-colors hover:border-slate-700 md:min-h-14 md:flex-row md:items-center md:gap-4">
      {/* Flavor */}
      <div className="flex items-center gap-2 md:w-40 md:shrink-0">
        <Cpu className="h-4 w-4 shrink-0 text-blue-500" />
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-white">
            {variant.flavor?.name}
            {count > 1 && (
              <Badge variant="outline" className="shrink-0 border-blue-500/20 bg-blue-500/10 px-1.5 py-0 text-[10px] text-blue-400">
                ×{count}
              </Badge>
            )}
          </p>
          <p className="text-[11px] text-slate-500">{formatFlavorAttrs(variant.flavor as Flavor, flavorFieldDefs)}</p>
        </div>
      </div>
      {/* OS — compact tags; when the OS column is hidden, shows all OS versions the
          row covers (aggregated for ×N groups), with a colored dot for the availability type
          (legend under the filters: green = Recommended, red = Restricted, amber = On demand) */}
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        <Monitor className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
        {osEntries.map((entry) => (
          <span
            key={entry.id}
            title={entry.availabilityType && entry.availabilityType !== 'STANDARD' ? entry.availabilityType.replace('_', ' ') : undefined}
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300"
          >
            {entry.availabilityType && entry.availabilityType !== 'STANDARD' && (
              <span className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                entry.availabilityType === 'RECOMMENDED' && 'bg-emerald-500',
                entry.availabilityType === 'RESTRICTED' && 'bg-red-500',
                entry.availabilityType === 'ON_DEMAND' && 'bg-amber-500',
              )} />
            )}
            <span className="truncate">{entry.label}</span>
          </span>
        ))}
      </div>
      {/* Zones + AZs — single line, truncated, so all rows keep the same height */}
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden whitespace-nowrap px-1">
        {uniqueZones.length === 0 ? (
          <span className="text-[11px] text-slate-600">No zones assigned</span>
        ) : (
          uniqueZones.map((zone: any) => {
            const zoneAzIds = new Set((zone.availabilityZones || []).map((zaz: any) => zaz.availabilityZoneId));
            const intersectingAzs = (variant.availabilityZones || []).filter((az: any) => zoneAzIds.has(az.availabilityZoneId));
            return (
              <span key={zone.id} className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300">
                <Box className="h-2.5 w-2.5 shrink-0 text-indigo-400" />
                <span className="truncate">{zone.name}</span>
                {intersectingAzs.length > 0 && (
                  <span className="truncate text-slate-500">· {intersectingAzs.map((az: any) => az.availabilityZone?.name).join(', ')}</span>
                )}
              </span>
            );
          })
        )}
      </div>
      {/* Continuity */}
      <div className="flex items-center gap-2 md:shrink-0 md:justify-end">
        {variant.continuityLevel ? (
          <>
            <Badge variant="outline" className="text-[10px]" style={{ color: variant.continuityLevel.color, borderColor: `${variant.continuityLevel.color}40` }}>
              {variant.continuityLevel.name}
            </Badge>
            <span className="hidden text-[11px] text-slate-500 xl:inline">RTO {variant.continuityLevel.rtoMinutes}m · RPO {variant.continuityLevel.rpoMinutes}m</span>
          </>
        ) : (
          <span className="text-[11px] text-slate-600">No continuity level</span>
        )}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, refetch } = useProduct(slug || '');

  // Fetch performance profiles for this product
  const { data: perfProfiles } = usePerformanceProfiles(
    product ? 'PRODUCT' : undefined,
    product?.id
  );

  // Per-flavor performance profiles: derive the flavor ids from this product's variants,
  // then fetch all FLAVOR-targeted profiles and keep those flavors.
  const flavorIds = Array.from(
    new Set((product?.variants || []).map((v: any) => v.flavor?.id).filter(Boolean))
  ) as string[];
  const { data: allFlavorProfiles } = usePerformanceProfiles(
    flavorIds.length > 0 ? 'FLAVOR' : undefined
  );
  const flavorProfiles = (allFlavorProfiles || []).filter((p) => flavorIds.includes(p.targetId));

  // Fetch related products (same category, excluding current)
  const { data: relatedProducts } = useProducts(
    product ? { category: product.category?.slug } : undefined
  );

  // Fetch declared transitions (used by the compute-only OS tab)
  const { data: productTransitions } = useProductTransitions(product?.id || '');

  // Variant filters for compute products
  const [osFilter, setOsFilter] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [flavorFilter, setFlavorFilter] = useState('');
  const [azFilter, setAzFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');
  // Presentation option: OS column hidden by default in the Variants list (lighter rows)
  const [showOsColumn, setShowOsColumn] = useState(false);
  const [selectedMapZone, setSelectedMapZone] = useState<any>(null);
  // Active tab (controlled) — used to show the variant filters only on the Variants tab.
  // Initial value matches the Tabs defaultValue ('variants' for compute, 'overview' otherwise);
  // Tabs syncs it on mount via onValueChange when the user first switches.
  const [activeTab, setActiveTab] = useState<string>('variants');

  // Reset filters when product changes
  useEffect(() => {
    setOsFilter('');
    setVersionFilter('');
    setFlavorFilter('');
    setAzFilter('');
    setZoneFilter('');
  }, [slug]);

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <Skeleton className="h-32 rounded-lg bg-slate-800" />
        <Skeleton className="h-48 rounded-lg bg-slate-800" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-6">
        <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-blue-400 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>
        <QueryError
          message="Unable to load this product. It may have been removed from the catalog."
          onRetry={() => refetch()}
        />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-12 text-center animate-fade-in">
        <Box className="mx-auto h-12 w-12 text-slate-600" />
        <p className="mt-4 text-lg font-medium text-slate-300">Product not found</p>
        <p className="mt-1 text-slate-500">This product does not exist or has been removed from the catalog.</p>
        <Link to="/marketplace">
          <Button variant="outline" className="mt-6 border-slate-700 text-slate-300 hover:bg-slate-800 min-h-[44px]">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to marketplace
          </Button>
        </Link>
      </div>
    );
  }

  const variants: ProductVariant[] = product.variants || [];
  const flavorFieldDefs: any[] = product.category?.flavorFieldDefinitions ?? [];
  const isCompute = flavorFieldDefs.length > 0 || variants.length > 0;
  const Icon = iconMap[product.category?.icon || ''] || Server;
  // Merge outgoing + incoming transitions; a self-transition (fromProduct === toProduct)
  // appears in both lists, so deduplicate by id.
  const allTransitions = productTransitions
    ? Array.from(
        new Map(
          [...(productTransitions.outgoing || []), ...(productTransitions.incoming || [])].map((t) => [t.id, t])
        ).values()
      )
    : [];
  // All declared transitions (merged outgoing + incoming) — used by the unified
  // Upgrades & Transitions tab, which classifies Platform vs OS itself.


  // Compute unique filter options from variants
  const osOptions = Array.from(new Map(variants.map(v => [v.osId, v.os])).values());
  const flavorOptions = Array.from(new Map(variants.map(v => [v.flavorId, v.flavor])).values());

  const filteredVariants = variants.filter((v) => {
    if (osFilter && v.osId !== osFilter) return false;
    if (versionFilter && v.osVersionId !== versionFilter) return false;
    if (flavorFilter && v.flavorId !== flavorFilter) return false;
    if (azFilter && !v.availabilityZones?.some((az: any) => az.availabilityZoneId === azFilter)) return false;
    if (zoneFilter) {
      const derivedZoneIds = new Set([
        ...(v.zones || []).map((z: any) => z.zoneId),
        ...(product.zones || []).map((z: any) => z.zoneId),
        ...(v.flavor?.zones || []).map((z: any) => z.zoneId),
        ...(v.os?.zones || []).map((z: any) => z.zoneId),
      ]);
      if (!derivedZoneIds.has(zoneFilter)) return false;
    }
    return true;
  });

  // When the OS column is hidden, rows that differ only by OS become visually identical.
  // Collapse them into one row per unique (flavor + zones + AZs + continuity) combo, with a ×N badge.
  const dedupeKey = (v: ProductVariant) => {
    // Key on what the row actually DISPLAYS: merged zones (variant + product + flavor + OS),
    // otherwise rows with identical pills but different underlying zone links stay split.
    const zoneIds = Array.from(new Set([
      ...(v.zones || []).map((z: any) => z.zoneId),
      ...(product.zones || []).map((z: any) => z.zoneId),
      ...(v.flavor?.zones || []).map((z: any) => z.zoneId),
      ...(v.os?.zones || []).map((z: any) => z.zoneId),
    ])).sort().join(',');
    const azIds = (v.availabilityZones || []).map((az: any) => az.availabilityZoneId).sort().join(',');
    return [v.flavorId, zoneIds, azIds, v.continuityLevelId || ''].join('|');
  };
  const displayVariants: { variant: ProductVariant; count: number; osEntries: { id: string; label: string; availabilityType?: string }[] }[] = showOsColumn
    ? filteredVariants.map((v) => ({
        variant: v,
        count: 1,
        osEntries: v.osVersion
          ? [{ id: v.osVersion.id, label: osVersionLabel(v.os?.name, v.osVersion.version), availabilityType: v.availabilityType }]
          : [],
      }))
    : Object.values(
        filteredVariants.reduce<Record<string, { variant: ProductVariant; count: number; osEntries: { id: string; label: string; availabilityType?: string }[] }>>((acc, v) => {
          const key = dedupeKey(v);
          if (!acc[key]) {
            acc[key] = { variant: v, count: 1, osEntries: [] };
          }
          acc[key].count += 1;
          if (v.osVersion && !acc[key].osEntries.some((e) => e.id === v.osVersion.id)) {
            // Use THIS variant's OS name — grouped variants may reference different OSes
            acc[key].osEntries.push({
              id: v.osVersion.id,
              label: osVersionLabel(v.os?.name, v.osVersion.version),
              availabilityType: v.availabilityType,
            });
          }
          return acc;
        }, {})
      );

  // Available versions based on selected OS — build full labels with OS name
  const availableVersions = osFilter
    ? variants.filter(v => v.osId === osFilter).map(v => v.osVersion)
    : variants.map(v => v.osVersion);
  const versionOptions = Array.from(new Map(availableVersions.map(v => [v.id, v])).values());
  const versionLabels = new Map<string, string>();
  for (const v of variants) {
    if (v.osVersion && !versionLabels.has(v.osVersion.id)) {
      versionLabels.set(v.osVersion.id, `${v.os?.name || 'OS'} ${v.osVersion.version}`);
    }
  }

  // Collect all AZs from every declared path: variant links, product links,
  // and the product's Zones (each logical Zone aggregates its own AZs).
  const allAzs: any[] = [
    ...variants.flatMap((v) => (v.availabilityZones || []).map((az: any) => az.availabilityZone)),
    ...(product.availabilityZones || []).map((az: any) => az.availabilityZone),
    ...(product.zones || []).flatMap((pz: any) =>
      ((pz.zone?.availabilityZones as any[]) || []).map((zaz) => zaz.availabilityZone)
    ),
  ];
  const uniqueAzs = Array.from(new Map(allAzs.filter(Boolean).map((az: any) => [az.id, az])).values());

  // Collect all Zones from all variants (variant zones + product zones + flavor zones + OS zones)
  const allZones = variants.flatMap((v) => {
    const vZones = (v.zones || []).map((z: any) => z.zone);
    const pZones = (product.zones || []).map((z: any) => z.zone);
    const fZones = (v.flavor?.zones || []).map((z: any) => z.zone);
    const oZones = (v.os?.zones || []).map((z: any) => z.zone);
    return [...vZones, ...pZones, ...fZones, ...oZones];
  });
  const uniqueZones = Array.from(new Map(allZones.map((z: any) => [z.id, z])).values());

  const related = relatedProducts?.filter((p: Product) => p.id !== product.id).slice(0, 3) ?? [];

  // Phase color segments shared by both Gantt views (blue = normal, amber = extended, rose = no support)
  const phaseSegments = (dates: { normalSupportEnd?: string | null; extendedSupportEnd?: string | null; eolDate?: string | null }) => {
    const segs: GanttBarData['segments'] = [];
    if (dates.normalSupportEnd && dates.extendedSupportEnd) {
      segs.push({ end: new Date(dates.normalSupportEnd), className: 'bg-blue-500', label: 'Normal support' });
      segs.push({ end: new Date(dates.extendedSupportEnd), className: 'bg-amber-500', label: 'Extended support' });
      if (dates.eolDate) {
        segs.push({ end: new Date(dates.eolDate), className: 'bg-rose-500', label: 'No support' });
      }
    }
    return segs;
  };

  // Shared time range so the Roadmap and Release Timeline charts use the same scale —
  // tick positions and the "today" marker line up vertically between the two tiles.
  const ganttRange = (() => {
    const all = [...(product.productVersions || []), ...variants.map((v) => v.osVersion)];
    const starts = all.filter((pv) => pv?.releaseDate).map((pv) => new Date(pv.releaseDate!).getTime());
    const ends = all.filter((pv) => pv?.eolDate).map((pv) => new Date(pv.eolDate!).getTime());
    return {
      min: starts.length ? new Date(Math.min(...starts)) : undefined,
      max: ends.length ? new Date(Math.max(...ends)) : undefined,
    };
  })();

  // "Upcoming releases" is auto-generated from ProductVersions whose release date is in the
  // future — announced versions appear both as Gantt bars and in the release list, no manual
  // roadmap markdown needed.
  const upcomingReleases = (product.productVersions || [])
    .filter((pv) => pv.releaseDate && new Date(pv.releaseDate).getTime() > Date.now())
    .sort((a, b) => new Date(a.releaseDate!).getTime() - new Date(b.releaseDate!).getTime());

  // Gantt 1 — product versions (Roadmap tab). Rows are expandable: clicking one reveals
  // the version's changelog and its variants (content formerly in "Versions & Lifecycle").
  const productVersionBars: GanttBarData[] = (product.productVersions || [])
    .filter((pv) => pv.releaseDate && pv.eolDate)
    .sort((a, b) => new Date(b.releaseDate!).getTime() - new Date(a.releaseDate!).getTime())
    .map((pv) => {
      const pvVariants: ProductVariant[] = pv.variants || [];
      return {
        id: pv.id,
        label: `Version ${pv.version}`,
        sublabel: `Released ${formatShortDate(pv.releaseDate ?? '')} · EOL ${formatShortDate(pv.eolDate ?? '')}`,
        badge: { label: phaseLabel(pv.phase), className: phaseColorClass(pv.phase) },
        start: new Date(pv.releaseDate!),
        end: new Date(pv.eolDate!),
        segments: phaseSegments(pv),
        detail: (
          <div className="space-y-3 text-xs">
            {pv.changelog && (
              <div>
                <p className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                  <FileText className="h-3 w-3 text-blue-500" /> Changelog
                </p>
                <MarkdownContent text={pv.changelog} />
              </div>
            )}
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-slate-300">
                <Box className="h-3 w-3 text-blue-500" /> Variants ({pvVariants.length})
              </p>
              {pvVariants.length === 0 ? (
                <p className="text-slate-500">No variants associated with this version.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {pvVariants.map((v) => (
                    <span key={v.id} className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] text-slate-300">
                      <Cpu className="h-2.5 w-2.5 text-blue-500" />
                      {v.flavor?.name} — {osVersionLabel(v.os?.name, v.osVersion?.version || '')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ),
      };
    });

  // Gantt 2 — OS versions backing this product's variants (Release Timeline tab, compute only).
  // Grouped per OS so OS releases are visually distinct from product versions.
  // NOTE: osVersion.os is not included in the API payload, so take the OS name from the variant.
  const osNameById = new Map(variants.map((v) => [v.osVersionId, v.os?.name]));
  const osVersionBars: GanttBarData[] = Array.from(
    new Map(variants.filter((v) => v.osVersion?.releaseDate && v.osVersion?.eolDate).map((v) => [v.osVersionId, v.osVersion])).values()
  )
    .sort((a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime())
    .map((osv) => ({
      id: osv.id,
      label: osVersionLabel(osNameById.get(osv.id), osv.version),
      sublabel: `Released ${formatShortDate(osv.releaseDate)} · EOL ${formatShortDate(osv.eolDate)}`,
      badge: { label: phaseLabel(osv.phase), className: phaseColorClass(osv.phase) },
      start: new Date(osv.releaseDate),
      end: new Date(osv.eolDate),
      segments: phaseSegments(osv),
      barClass: 'bg-indigo-500/70',
    }));

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Breadcrumb & Header */}
      <AnimatedSection>
        <div>
          <Link
            to="/marketplace"
            className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-blue-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
          <div className="mt-4 flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-blue-500/10">
              <Icon className="h-7 w-7 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-bold text-white">{product.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-slate-800 text-slate-300 border-slate-700">
                  {product.category?.name}
                </Badge>
                {isCompute && product.computeType && (
                  <Badge variant="outline" className="border-slate-700 text-slate-400">
                    {product.computeType}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn(
                    'border-slate-700',
                    product.isActive ? 'text-emerald-400' : 'text-slate-500'
                  )}
                >
                  {product.isActive ? 'Available' : 'Unavailable'}
                </Badge>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Link to="/forecasts">
                <Button size="sm" className="gap-2 bg-blue-500 hover:bg-blue-600 min-h-[44px]">
                  <Send className="h-4 w-4" />
                  Request this product
                </Button>
              </Link>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-slate-400">{product.description}</p>
        </div>
      </AnimatedSection>

      {/* Metadata cards */}
      <AnimatedSection delay={100}>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
            <CardContent className="flex items-center gap-3 py-4">
              <Layers className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-slate-500">Category</p>
                <p className="text-sm font-medium text-white">{product.category?.name}</p>
              </div>
            </CardContent>
          </Card>
          {isCompute ? (
            <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
              <CardContent className="flex items-center gap-3 py-4">
                <Cpu className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-slate-500">Type</p>
                  <p className="text-sm font-medium text-white">{product.computeType || '—'}</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
              <CardContent className="flex items-center gap-3 py-4">
                <Monitor className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-slate-500">Operating system</p>
                  <p className="text-sm font-medium text-white">{product.os || 'N/A'}</p>
                </div>
              </CardContent>
            </Card>
          )}
          <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
            <CardContent className="flex items-center gap-3 py-4">
              <Zap className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-slate-500">{isCompute ? 'Variants' : 'Configurations'}</p>
                <p className="text-sm font-medium text-white">
                  {isCompute ? `${variants.length} variants` : 'Standard'}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
            <CardContent className="flex items-center gap-3 py-4">
              <Calendar className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-xs text-slate-500">Added on</p>
                <p className="text-sm font-medium text-white">{formatDate(product.createdAt)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedSection>

      {/* Tabs */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue={isCompute ? 'variants' : 'overview'} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Overview</TabsTrigger>
            <TabsTrigger value="documentation" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Documentation</TabsTrigger>
            {isCompute && (
              <TabsTrigger value="variants" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Variants</TabsTrigger>
            )}
            {isCompute && (
              <TabsTrigger value="os" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">OS</TabsTrigger>
            )}
            <TabsTrigger value="roadmap" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Roadmap</TabsTrigger>
            <TabsTrigger value="upgrade-paths" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Upgrades &amp; Transitions</TabsTrigger>
            <TabsTrigger value="dependencies" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Dependencies</TabsTrigger>
            {uniqueAzs.length > 0 && (
              <TabsTrigger value="availability" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Availability</TabsTrigger>
            )}
            <TabsTrigger value="performance" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Performance</TabsTrigger>
          </TabsList>

          {/* Variant filters — shown only while the Variants tab is active */}
          {isCompute && activeTab === 'variants' && (
            <div className="mt-4">
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="pt-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <PickupInput
                      label="Operating System"
                      value={osFilter}
                      onChange={(val) => { setOsFilter(val); setVersionFilter(''); }}
                      options={osOptions.map((os) => ({ id: os.id, label: `${os.name} (${os.family})` }))}
                      placeholder="Search OS..."
                    />
                    <PickupInput
                      label="Version"
                      value={versionFilter}
                      onChange={setVersionFilter}
                      options={versionOptions.map((v) => ({ id: v.id, label: versionLabels.get(v.id) || v.version }))}
                      placeholder="Search version..."
                    />
                    <PickupInput
                      label="Flavor"
                      value={flavorFilter}
                      onChange={setFlavorFilter}
                      options={flavorOptions.map((f) => {
                        const attrs = formatFlavorAttrs(f as Flavor, flavorFieldDefs);
                        return { id: f.id, label: attrs !== '—' ? `${f.name} (${attrs})` : f.name };
                      })}
                      placeholder="Search flavor..."
                    />
                    <PickupInput
                      label="Availability Zone"
                      value={azFilter}
                      onChange={setAzFilter}
                      options={uniqueAzs.map((az: any) => ({ id: az.id, label: `${az.name} (${az.code})` }))}
                      placeholder="Search AZ..."
                    />
                    <PickupInput
                      label="Zone"
                      value={zoneFilter}
                      onChange={setZoneFilter}
                      options={uniqueZones.map((z: any) => ({ id: z.id, label: z.name }))}
                      placeholder="Search zone..."
                    />
                    {(osFilter || versionFilter || flavorFilter || azFilter || zoneFilter) && (
                      <div className="flex items-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setOsFilter(''); setVersionFilter(''); setFlavorFilter(''); setAzFilter(''); setZoneFilter(''); }}
                          className="text-slate-400 hover:text-white min-h-[40px]"
                        >
                          <X className="h-4 w-4 mr-1" />
                          Reset
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>
                      Showing <span className="text-slate-300 font-medium">{filteredVariants.length}</span> of{' '}
                      <span className="text-slate-300 font-medium">{variants.length}</span> variants
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowOsColumn((s) => !s)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-400 transition-colors hover:border-slate-600 hover:text-white"
                    >
                      <Monitor className="h-3 w-3" />
                      {showOsColumn ? 'Hide OS' : 'Show OS'}
                    </button>
                  </div>
                  {/* OS availability legend — the colored dots on OS tags (green = Recommended, red = Restricted, amber = On demand) */}
                  <div className="mt-2 flex flex-wrap items-center gap-4 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />Recommended</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-500" />Restricted</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-500" />On demand</span>
                    <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-600" />Standard (no dot)</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Overview */}
          <TabsContent value="overview" className="mt-4 space-y-6 animate-fade-in">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.documentation ? (
                  <MarkdownContent text={product.documentation} />
                ) : (
                  <p className="text-slate-500">No detailed overview available for this product.</p>
                )}
              </CardContent>
            </Card>

            {isCompute && variants.length > 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <HardDrive className="h-5 w-5 text-blue-500" />
                    Available Configurations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Array.from(new Map(variants.map(v => [v.flavorId, v.flavor])).values()).map((flavor: any) => {
                      const flavorVariants = variants.filter(v => v.flavorId === flavor.id);
                      const osList = Array.from(new Map(flavorVariants.map(v => [v.osId, { name: v.os?.name, version: v.osVersion?.version }])).values());
                      return (
                        <div key={flavor.id} className="flex flex-col sm:flex-row gap-3 rounded-lg border border-slate-800 bg-slate-950 p-4">
                          {/* Flavor - big square on the left */}
                          <div className="sm:w-48 shrink-0 flex flex-col items-center justify-center rounded-lg bg-slate-900 border border-slate-800 p-4 text-center">
                            <Cpu className="h-8 w-8 text-blue-500 mb-2" />
                            <span className="font-bold text-white text-lg">{flavor.name}</span>
                            <span className="text-sm text-slate-400 mt-1">{formatFlavorAttrs(flavor as Flavor, flavorFieldDefs)}</span>
                          </div>
                          {/* OS options - small rectangles on the right */}
                          <div className="flex-1 flex flex-wrap gap-2 items-center content-center">
                            {osList.map((os: any, i: number) => (
                              <Badge
                                key={i}
                                variant="outline"
                                className="text-xs border-slate-700 text-slate-300 bg-slate-900 px-3 py-1.5"
                              >
                                {os.name} {os.version}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-sm text-slate-500 text-center">
                      See the Variants tab for full details and filtering.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Documentation */}
          <TabsContent value="documentation" className="mt-4 animate-fade-in">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <FileText className="h-5 w-5 text-blue-500" />
                  Documentation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.documentation ? (
                  <>
                    <DocTableOfContents text={product.documentation} />
                    <MarkdownContent text={product.documentation} />
                  </>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-slate-500">No documentation available for this product.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Roadmap */}
          <TabsContent value="roadmap" className="mt-4 space-y-6 animate-fade-in">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  Product Roadmap
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Product version lifecycle timeline — click a row to see its changelog and variants
                </CardDescription>
              </CardHeader>
              <CardContent>
                {productVersionBars.length > 0 ? (
                  <>
                    {upcomingReleases.length > 0 && (
                      <div className="mb-4 border-b border-slate-800 pb-4">
                        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-white">
                          <Clock className="h-4 w-4 text-blue-500" /> Upcoming releases
                        </p>
                        <ul className="space-y-1 text-xs text-slate-400">
                          {upcomingReleases.map((pv) => (
                            <li key={pv.id} className="flex items-center gap-2">
                              <span className="font-medium text-slate-200">{pv.version}</span>
                              <span className="text-slate-500">
                                {formatShortDate(pv.releaseDate!)} — {pv.changelog ? pv.changelog.split('\n').filter((l) => l && !l.startsWith('#')).map((l) => l.replace(/^- /, '')).join(' · ') : 'Announced'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <GanttChart bars={productVersionBars} minDate={ganttRange.min} maxDate={ganttRange.max} />
                  </>
                  ) : product.roadmap ? (
                  <MarkdownContent text={product.roadmap} />
                ) : (
                  <div className="text-center py-12">
                    <Calendar className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-slate-500">No roadmap available for this product.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {isCompute && variants.length > 0 && (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Clock className="h-5 w-5 text-blue-500" />
                    OS Roadmap
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    OS version support windows for this product, grouped by operating system
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <GanttChart bars={osVersionBars} minDate={ganttRange.min} maxDate={ganttRange.max} />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Variants (Compute only) */}
          {isCompute && (
            <TabsContent value="variants" className="mt-4 space-y-6">
              {filteredVariants.length > 0 ? (
                /* Flat list — zone/flavor info stays on each row's tags */
                <div className="space-y-4">
                  {displayVariants.map(({ variant, count, osEntries }) => (
                    <VariantRow key={variant.id} variant={variant} product={product} count={count} osEntries={osEntries} flavorFieldDefs={flavorFieldDefs} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 rounded-lg border border-slate-800 bg-slate-950">
                  <Filter className="mx-auto h-10 w-10 text-slate-700" />
                  <p className="mt-3 text-slate-500">No variants match the selected filters.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setOsFilter(''); setVersionFilter(''); setFlavorFilter(''); setAzFilter(''); setZoneFilter(''); }}
                    className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800"
                  >
                    Clear filters
                  </Button>
                </div>
              )}
            </TabsContent>
          )}

          {/* OS (Compute only) */}
          {isCompute && (
            <TabsContent value="os">
              <OsLifecycleTab product={product} variants={variants} />
            </TabsContent>
          )}

          {/* Upgrades & Transitions — unified view (platform + OS migrations) */}
          <TabsContent value="upgrade-paths" className="mt-4 animate-fade-in">
            <UpgradesTransitionsTab product={product} variants={variants} transitions={allTransitions} />
          </TabsContent>

          {/* Dependencies */}
          <TabsContent value="dependencies" className="mt-4 space-y-6 animate-fade-in">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <GitBranch className="h-5 w-5 text-blue-500" />
                  Dependencies
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Products required or recommended to use {product.name}.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {product.dependencies && product.dependencies.length > 0 ? (
                  <>
                    <DependencyGraph productName={product.name} dependencies={product.dependencies} />
                    <div className="space-y-3">
                      {product.dependencies.map((dep: Dependency) => (
                        <div
                          key={dep.id}
                          className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3"
                        >
                          {dep.type === 'REQUIRED' ? (
                            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
                          ) : (
                            <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{dep.dependsOn?.name}</span>
                              <Badge
                                variant={dep.type === 'REQUIRED' ? 'destructive' : 'secondary'}
                                className="text-xs"
                              >
                                {dep.type === 'REQUIRED' ? 'Required' : 'Recommended'}
                              </Badge>
                            </div>
                            {dep.description && (
                              <p className="mt-1 text-sm text-slate-500">{dep.description}</p>
                            )}
                          </div>
                          {dep.dependsOn?.slug && (
                            <Link to={`/products/${dep.dependsOn.slug}`}>
                              <Button variant="ghost" size="sm" className="shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 min-h-[44px]">
                                View
                                <ArrowUpRight className="ml-1 h-3 w-3" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <GitBranch className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-slate-500">No dependencies declared for this product.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Availability */}
          {uniqueAzs.length > 0 && (
            <TabsContent value="availability" className="mt-4 space-y-6 animate-fade-in">
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Globe className="h-5 w-5 text-blue-500" />
                      Available in
                    </CardTitle>
                    <CardDescription className="text-slate-400">
                      {uniqueAzs.length} availability zone{uniqueAzs.length !== 1 ? 's' : ''} across{' '}
                      {new Set(uniqueAzs.map((az: any) => az.region)).size} region
                      {new Set(uniqueAzs.map((az: any) => az.region)).size !== 1 ? 's' : ''}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {uniqueAzs.map((az: any) => (
                          <Link
                            key={az.id}
                            to="/availability-zones"
                            className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-slate-800"
                            style={{
                              borderColor: `${regionColors[az.region] || '#334155'}40`,
                              color: regionColors[az.region] || '#94a3b8',
                            }}
                          >
                            <MapPin className="h-3 w-3" />
                            {az.name}
                          </Link>
                        ))}
                      </div>
                      <div className="mt-4 space-y-2">
                        {uniqueAzs.map((az: any) => (
                          <div
                            key={az.id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: regionColors[az.region] || '#64748b' }}
                              />
                              <span className="text-sm text-white">{az.name}</span>
                              <span className="text-xs text-slate-500">{az.code} — {az.city}, {az.country}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{
                                borderColor: `${regionColors[az.region] || '#334155'}40`,
                                color: regionColors[az.region] || '#94a3b8',
                              }}
                            >
                              {az.region}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mini Map */}
                <Card className="bg-slate-900 border-slate-800 overflow-hidden">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-white text-base">
                      <MapPin className="h-5 w-5 text-blue-500" />
                      Zone Map
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[300px] w-full bg-slate-950">
                      <WorldMap
                        zones={uniqueAzs as any}
                        selectedZone={selectedMapZone}
                        onSelectZone={setSelectedMapZone}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}

          {/* Performance */}
          <TabsContent value="performance" className="mt-4 space-y-6 animate-fade-in">
            {flavorProfiles.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Performance by flavor</h3>
                {flavorProfiles.map((profile) => (
                  <PerformanceGauge key={profile.id} profile={profile} />
                ))}
              </div>
            )}
            {perfProfiles && perfProfiles.length > 0 ? (
              <div className="space-y-4">
                {flavorProfiles.length > 0 && (
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Product performance</h3>
                )}
                {perfProfiles.map((profile) => (
                  <PerformanceGauge key={profile.id} profile={profile} />
                ))}
              </div>
            ) : flavorProfiles.length === 0 ? (
              <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center">
                <Zap className="mx-auto h-12 w-12 text-slate-600" />
                <p className="mt-4 text-lg font-medium text-slate-300">No performance data</p>
                <p className="mt-1 text-slate-500">Performance profiles for this product will appear here.</p>
              </div>
            ) : null}
          </TabsContent>

        </Tabs>
      </div>

      {/* Related Products */}
      {related.length > 0 && (
        <AnimatedSection delay={200}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Similar products</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel: Product) => {
                const RelIcon = iconMap[rel.category?.icon || ''] || Server;
                const relIsCompute = (rel.category?.flavorFieldDefinitions?.length ?? 0) > 0 || (rel.variants?.length ?? 0) > 0;
                const relVariantCount = rel.variants?.length ?? 0;
                return (
                  <Link key={rel.id} to={`/products/${rel.slug}`} className="group">
                    <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-blue-500/40 hover:bg-slate-800/50 hover:-translate-y-1">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <RelIcon className="h-5 w-5 text-blue-500 transition-transform group-hover:scale-110" />
                          <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                            {rel.category?.name}
                          </Badge>
                        </div>
                        <CardTitle className="text-base text-white mt-2 group-hover:text-blue-400 transition-colors">
                          {rel.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-slate-400 line-clamp-2">{rel.description}</p>
                        {relIsCompute && relVariantCount > 0 && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                              {relVariantCount} variant{relVariantCount !== 1 ? 's' : ''}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </AnimatedSection>
      )}
    </div>
  );
}
