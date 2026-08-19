import * as React from 'react';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Product, Dependency, ProductVariant } from '@cloudmarket/shared-types';
import { useProduct, useProducts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
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
  ArrowRight,
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
  Shield,
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

/* Simple markdown-like renderer for docs/roadmap */
function MarkdownContent({ text }: { text: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let inList = false;
  let listItems: React.ReactNode[] = [];

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

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      elements.push(<div key={`sp-${i}`} className="h-3" />);
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${i}`} className="text-xl font-bold text-white mt-6 mb-3">
          {trimmed.slice(3)}
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
          {trimmed.slice(2)}
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
        {trimmed}
      </p>
    );
  });

  flushList();

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

/* Variant branch card — left flavor, right 3 tiles */
function VariantBranchCard({ variant, product }: { variant: ProductVariant; product: Product }) {
  // Derive all unique zones for this variant from: variant zones, product zones, flavor zones, OS zones
  const variantZoneMap = new Map((variant.zones || []).map((vz: any) => [vz.zoneId, vz.zone]));
  const productZoneMap = new Map((product.zones || []).map((pz: any) => [pz.zoneId, pz.zone]));
  const flavorZoneMap = new Map((variant.flavor?.zones || []).map((fz: any) => [fz.zoneId, fz.zone]));
  const osZoneMap = new Map((variant.os?.zones || []).map((oz: any) => [oz.zoneId, oz.zone]));
  const allZoneEntries = [...variantZoneMap, ...productZoneMap, ...flavorZoneMap, ...osZoneMap];
  const uniqueZones = Array.from(new Map(allZoneEntries).values());

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Left — Flavor */}
        <div className="lg:w-48 shrink-0 flex flex-col items-center justify-center rounded-lg bg-slate-900 border border-slate-800 p-4 text-center">
          <Cpu className="h-8 w-8 text-blue-500 mb-2" />
          <span className="font-bold text-white text-lg">{variant.flavor?.name}</span>
          <span className="text-sm text-slate-400 mt-1">{variant.flavor?.vcpu} vCPU · {variant.flavor?.ramGb} GB</span>
        </div>
        {/* Right — 3 tiles */}
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Zones tile */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Box className="h-4 w-4 text-indigo-400" />
              <span className="text-sm font-medium text-white">Zones</span>
            </div>
            <div className="space-y-2">
              {uniqueZones.length === 0 ? (
                <p className="text-xs text-slate-500">No zones assigned</p>
              ) : (
                uniqueZones.map((zone: any) => {
                  const zoneAzIds = new Set((zone.availabilityZones || []).map((zaz: any) => zaz.availabilityZoneId));
                  const intersectingAzs = (variant.availabilityZones || []).filter((az: any) => zoneAzIds.has(az.availabilityZoneId));
                  return (
                    <div key={zone.id} className="space-y-1">
                      <p className="text-xs font-medium text-slate-300">{zone.name}</p>
                      <div className="flex flex-wrap gap-1">
                        {intersectingAzs.length === 0 ? (
                          <span className="text-[10px] text-slate-600">No shared AZs</span>
                        ) : (
                          intersectingAzs.map((az: any) => (
                            <Badge key={az.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">
                              <MapPin className="h-2.5 w-2.5 mr-0.5" />
                              {az.availabilityZone?.code}
                            </Badge>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* Continuity tile */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-rose-400" />
              <span className="text-sm font-medium text-white">Continuity</span>
            </div>
            {variant.continuityLevel ? (
              <div className="space-y-1">
                <Badge variant="outline" className="text-xs" style={{ color: variant.continuityLevel.color, borderColor: `${variant.continuityLevel.color}40` }}>
                  {variant.continuityLevel.name}
                </Badge>
                <p className="text-xs text-slate-400">RTO {variant.continuityLevel.rtoMinutes}m · RPO {variant.continuityLevel.rpoMinutes}m</p>
              </div>
            ) : (
              <p className="text-xs text-slate-500">No continuity level</p>
            )}
          </div>
          {/* OS tile */}
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Monitor className="h-4 w-4 text-cyan-400" />
              <span className="text-sm font-medium text-white">OS</span>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-white">{variant.os?.name} {variant.osVersion?.version}</p>
              {variant.availabilityType && variant.availabilityType !== 'STANDARD' && (
                <Badge variant="outline" className={cn(
                  'text-xs',
                  variant.availabilityType === 'RECOMMENDED' && 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10',
                  variant.availabilityType === 'RESTRICTED' && 'border-red-500/20 text-red-500 bg-red-500/10',
                  variant.availabilityType === 'ON_DEMAND' && 'border-amber-500/20 text-amber-500 bg-amber-500/10',
                )}>
                  {variant.availabilityType.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, refetch } = useProduct(slug || '');

  // Fetch related products (same category, excluding current)
  const { data: relatedProducts } = useProducts(
    product ? { category: product.category?.slug } : undefined
  );

  // Variant filters for compute products
  const [osFilter, setOsFilter] = useState('');
  const [versionFilter, setVersionFilter] = useState('');
  const [flavorFilter, setFlavorFilter] = useState('');
  const [azFilter, setAzFilter] = useState('');
  const [zoneFilter, setZoneFilter] = useState('');

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

  const isCompute = product.category?.slug === 'compute';
  const Icon = iconMap[product.category?.icon || ''] || Server;
  const variants: ProductVariant[] = product.variants || [];

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

  // Collect all AZs from all variants
  const allAzs = variants.flatMap((v) =>
    (v.availabilityZones || []).map((az: any) => az.availabilityZone)
  );
  const uniqueAzs = Array.from(new Map(allAzs.map((az: any) => [az.id, az])).values());

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

      {/* Filters — always visible for compute products */}
      {isCompute && (
        <AnimatedSection delay={150}>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Filter className="h-4 w-4 text-blue-500" />
                Filter Variants
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                  options={flavorOptions.map((f) => ({ id: f.id, label: `${f.name} (${f.vcpu}vCPU, ${f.ramGb}GB)` }))}
                  placeholder="Search flavor..."
                />
                <PickupInput
                  label="Availability Zone"
                  value={azFilter}
                  onChange={setAzFilter}
                  options={uniqueAzs.map((az: any) => ({ id: az.id, label: `${az.code} (${az.region})` }))}
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
              <div className="mt-3 text-sm text-slate-500">
                Showing <span className="text-slate-300 font-medium">{filteredVariants.length}</span> of{' '}
                <span className="text-slate-300 font-medium">{variants.length}</span> variants
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {/* Tabs */}
      <AnimatedSection delay={150}>
        <Tabs defaultValue={isCompute ? 'variants' : 'overview'} className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Overview</TabsTrigger>
            {isCompute && (
              <TabsTrigger value="variants" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Variants</TabsTrigger>
            )}
            <TabsTrigger value="documentation" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Documentation</TabsTrigger>
            <TabsTrigger value="roadmap" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Roadmap</TabsTrigger>
            {isCompute && (
              <TabsTrigger value="variants" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Variants</TabsTrigger>
            )}
            <TabsTrigger value="upgrade-paths" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Upgrade Paths</TabsTrigger>
            <TabsTrigger value="dependencies" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Dependencies</TabsTrigger>
            {uniqueAzs.length > 0 && (
              <TabsTrigger value="availability" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Availability</TabsTrigger>
            )}
          </TabsList>

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
                            <span className="text-sm text-slate-400 mt-1">{flavor.vcpu} vCPU · {flavor.ramGb} GB</span>
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
                  <MarkdownContent text={product.documentation} />
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
                  Roadmap
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.roadmap ? (
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
                    Release Timeline
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    OS version release history for this product
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-0">
                    {Array.from(new Map(variants.map(v => [v.osVersionId, v])).values())
                      .filter((v: any) => v.osVersion?.releaseDate)
                      .sort((a: any, b: any) => new Date(b.osVersion.releaseDate).getTime() - new Date(a.osVersion.releaseDate).getTime())
                      .map((v: any, idx: number, arr: any[]) => (
                        <div key={v.osVersionId} className="flex gap-4 relative">
                          {/* Timeline line */}
                          {idx < arr.length - 1 && (
                            <div className="absolute left-[7px] top-6 bottom-0 w-px bg-slate-700" />
                          )}
                          <div className="flex flex-col items-center">
                            <div className="h-3.5 w-3.5 rounded-full bg-blue-500 border-2 border-slate-900" />
                          </div>
                          <div className="pb-6 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-white">{v.os?.name} {v.osVersion?.version}</span>
                              <span className="text-xs text-slate-500">
                                Released {formatDate(v.osVersion.releaseDate)}
                              </span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs">
                              <span className={cn(
                                v.osVersion.phase === 'EOL' ? 'text-red-400' :
                                v.osVersion.phase === 'NO_SUPPORT' ? 'text-orange-400' :
                                v.osVersion.phase === 'EXTENDED_SUPPORT' ? 'text-amber-400' :
                                v.osVersion.phase === 'NORMAL_SUPPORT' ? 'text-blue-400' :
                                'text-emerald-400'
                              )}>
                                {v.osVersion.phase.replace('_', ' ')}
                              </span>
                              <span className="text-slate-600">·</span>
                              <span className="text-slate-500">EOL {formatDate(v.osVersion.eolDate)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Variants (Compute only) */}
          {isCompute && (
            <TabsContent value="variants" className="mt-4 space-y-6 animate-fade-in">
              {filteredVariants.length > 0 ? (
                <div className="space-y-8">
                  {/* Grouped by zone */}
                  {uniqueZones.filter((z: any) => filteredVariants.some((v) => {
                    const derivedZoneIds = new Set([
                      ...(v.zones || []).map((vz: any) => vz.zoneId),
                      ...(product.zones || []).map((pz: any) => pz.zoneId),
                      ...(v.flavor?.zones || []).map((fz: any) => fz.zoneId),
                      ...(v.os?.zones || []).map((oz: any) => oz.zoneId),
                    ]);
                    return derivedZoneIds.has(z.id);
                  })).map((zone: any) => {
                    const zoneVariants = filteredVariants.filter((v) => {
                      const derivedZoneIds = new Set([
                        ...(v.zones || []).map((vz: any) => vz.zoneId),
                        ...(product.zones || []).map((pz: any) => pz.zoneId),
                        ...(v.flavor?.zones || []).map((fz: any) => fz.zoneId),
                        ...(v.os?.zones || []).map((oz: any) => oz.zoneId),
                      ]);
                      return derivedZoneIds.has(zone.id);
                    });
                    return (
                      <div key={zone.id} className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Box className="h-5 w-5 text-indigo-400" />
                          <h3 className="text-lg font-semibold text-white">{zone.name}</h3>
                          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{zoneVariants.length} variant{zoneVariants.length !== 1 ? 's' : ''}</Badge>
                        </div>
                        <div className="space-y-4">
                          {zoneVariants.map((variant) => (
                            <VariantBranchCard key={variant.id} variant={variant} product={product} />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Ungrouped variants */}
                  {filteredVariants.some((v) => {
                    const derivedZoneIds = new Set([
                      ...(v.zones || []).map((vz: any) => vz.zoneId),
                      ...(product.zones || []).map((pz: any) => pz.zoneId),
                      ...(v.flavor?.zones || []).map((fz: any) => fz.zoneId),
                      ...(v.os?.zones || []).map((oz: any) => oz.zoneId),
                    ]);
                    return derivedZoneIds.size === 0;
                  }) && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-slate-400" />
                        <h3 className="text-lg font-semibold text-white">Other / Ungrouped</h3>
                      </div>
                      <div className="space-y-4">
                        {filteredVariants.filter((v) => {
                          const derivedZoneIds = new Set([
                            ...(v.zones || []).map((vz: any) => vz.zoneId),
                            ...(product.zones || []).map((pz: any) => pz.zoneId),
                            ...(v.flavor?.zones || []).map((fz: any) => fz.zoneId),
                            ...(v.os?.zones || []).map((oz: any) => oz.zoneId),
                          ]);
                          return derivedZoneIds.size === 0;
                        }).map((variant) => (
                          <VariantBranchCard key={variant.id} variant={variant} product={product} />
                        ))}
                      </div>
                    </div>
                  )}
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

          {/* Upgrade Paths */}
          <TabsContent value="upgrade-paths" className="mt-4 animate-fade-in">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <ArrowUpRight className="h-5 w-5 text-blue-500" />
                  Upgrade Paths
                </CardTitle>
              </CardHeader>
              <CardContent>
                {((product as any).upgradeFrom?.length > 0 || (product as any).upgradeTo?.length > 0) ? (
                  <div className="space-y-3">
                    {(product as any).upgradeFrom?.map((up: any) => (
                      <div key={up.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
                        <span className="text-slate-400 text-sm">{up.fromVersion}</span>
                        <ArrowRight className="h-4 w-4 text-cyan-500" />
                        <span className="text-white font-medium text-sm">{up.toVersion}</span>
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-700 ml-2">{up.migrationType}</Badge>
                        {up.toProduct && up.toProduct.id !== product.id && (
                          <Link to={`/products/${up.toProduct.slug}`} className="ml-auto text-xs text-blue-400 hover:underline">{up.toProduct.name}</Link>
                        )}
                      </div>
                    ))}
                    {(product as any).upgradeTo?.map((up: any) => (
                      <div key={up.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
                        <span className="text-slate-400 text-sm">{up.fromVersion}</span>
                        <ArrowRight className="h-4 w-4 text-cyan-500" />
                        <span className="text-white font-medium text-sm">{up.toVersion}</span>
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-700 ml-2">{up.migrationType}</Badge>
                        {up.fromProduct && up.fromProduct.id !== product.id && (
                          <span className="ml-auto text-xs text-slate-500">from {up.fromProduct.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <ArrowUpRight className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-slate-500">No upgrade paths declared for this product.</p>
                  </div>
                )}
              </CardContent>
            </Card>
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
                              <span className="text-xs text-slate-500">{az.city}, {az.country}</span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px]"
                              style={{
                                borderColor: `${regionColors[az.region] || '#334155'}40`,
                                color: regionColors[az.region] || '#94a3b8',
                              }}
                            >
                              {az.code}
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
                    <div className="relative h-[300px] w-full bg-slate-950 flex items-center justify-center">
                      <div className="text-center">
                        <Globe className="mx-auto h-12 w-12 text-slate-700" />
                        <p className="mt-3 text-sm text-slate-500">{uniqueAzs.length} availability zones</p>
                        <div className="mt-2 flex flex-wrap gap-2 justify-center">
                          {uniqueAzs.map((az: any) => (
                            <span key={az.id} className="text-xs px-2 py-1 rounded bg-slate-900 text-slate-400 border border-slate-800">
                              {az.code}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </AnimatedSection>

      {/* Related Products */}
      {related.length > 0 && (
        <AnimatedSection delay={200}>
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Similar products</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((rel: Product) => {
                const RelIcon = iconMap[rel.category?.icon || ''] || Server;
                const relIsCompute = rel.category?.slug === 'compute';
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
