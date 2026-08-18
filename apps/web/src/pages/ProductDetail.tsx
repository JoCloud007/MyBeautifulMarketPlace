import * as React from 'react';
import { useParams, Link } from 'react-router-dom';
import type { Product, Dependency, Flavor, ProductVariant, OperatingSystem, OsVersion } from '@cloudmarket/shared-types';
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
  Map as MapIcon,
  GitBranch,
  ArrowUpRight,
  ArrowRight,
  Calendar,
  Box,
  Layers,
  Send,
  Filter,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Cpu,
  Database,
  Server,
  Monitor,
};

const phaseColors: Record<string, string> = {
  RELEASED: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  NORMAL_SUPPORT: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  EXTENDED_SUPPORT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NO_SUPPORT: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  EOL: 'bg-red-500/10 text-red-400 border-red-500/20',
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

/* Flavor spec bar */
function SpecBar({ label, value, max, unit, color }: { label: string; value: number; max: number; unit: string; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-12 text-slate-500 text-xs">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-16 text-right text-slate-300 text-xs">
        {value} {unit}
      </span>
    </div>
  );
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

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError, refetch } = useProduct(slug || '');

  // Fetch related products (same category, excluding current)
  const { data: relatedProducts } = useProducts(
    product ? { category: product.category?.slug } : undefined
  );

  // Variant filters for compute products
  const [selectedOs, setSelectedOs] = React.useState('');
  const [selectedVersion, setSelectedVersion] = React.useState('');
  const [selectedFlavor, setSelectedFlavor] = React.useState('');
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | null>(null);

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

  // Unique flavors from variants for compute overview
  const uniqueFlavors = React.useMemo(() => {
    if (!isCompute || !product.variants) return [];
    const map = new Map<string, Flavor>();
    product.variants.forEach((v: ProductVariant) => {
      if (v.flavor && !map.has(v.flavor.id)) map.set(v.flavor.id, v.flavor);
    });
    return Array.from(map.values());
  }, [isCompute, product.variants]);

  const maxVcpu = Math.max(...(uniqueFlavors.map((f) => f.vcpu) ?? [1]));
  const maxRam = Math.max(...(uniqueFlavors.map((f) => f.ramGb) ?? [1]));

  // Filtered variants
  const filteredVariants = React.useMemo(() => {
    if (!isCompute || !product.variants) return [];
    return product.variants.filter((v: ProductVariant) => {
      if (selectedOs && v.osId !== selectedOs) return false;
      if (selectedVersion && v.osVersionId !== selectedVersion) return false;
      if (selectedFlavor && v.flavorId !== selectedFlavor) return false;
      return true;
    });
  }, [isCompute, product.variants, selectedOs, selectedVersion, selectedFlavor]);

  // Unique filter options
  const osOptions = React.useMemo(() => {
    if (!isCompute || !product.variants) return [];
    const map = new Map<string, OperatingSystem>();
    product.variants.forEach((v: ProductVariant) => {
      if (v.os && !map.has(v.os.id)) map.set(v.os.id, v.os);
    });
    return Array.from(map.values());
  }, [isCompute, product.variants]);

  const versionOptions = React.useMemo(() => {
    if (!isCompute || !product.variants) return [];
    const map = new Map<string, OsVersion>();
    product.variants.forEach((v: ProductVariant) => {
      if (v.osVersion && (!selectedOs || v.osId === selectedOs) && !map.has(v.osVersion.id)) {
        map.set(v.osVersion.id, v.osVersion);
      }
    });
    return Array.from(map.values());
  }, [isCompute, product.variants, selectedOs]);

  const flavorOptions = React.useMemo(() => {
    if (!isCompute || !product.variants) return [];
    const map = new Map<string, Flavor>();
    product.variants.forEach((v: ProductVariant) => {
      if (v.flavor && !map.has(v.flavor.id)) map.set(v.flavor.id, v.flavor);
    });
    return Array.from(map.values());
  }, [isCompute, product.variants]);

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
                  <Badge variant="outline" className="border-blue-500/50 text-blue-400">
                    {product.computeType}
                  </Badge>
                )}
                {!isCompute && product.os && (
                  <Badge variant="outline" className="border-slate-700 text-slate-400">
                    {product.os}
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
            <>
              <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
                <CardContent className="flex items-center gap-3 py-4">
                  <Box className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-slate-500">Variants</p>
                    <p className="text-sm font-medium text-white">{product.variants?.length || 0} configurations</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
                <CardContent className="flex items-center gap-3 py-4">
                  <Server className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-xs text-slate-500">Instances</p>
                    <p className="text-sm font-medium text-white">{(product as any)._count?.instances || 0} deployed</p>
                  </div>
                </CardContent>
              </Card>
            </>
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
      <AnimatedSection delay={150}>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Overview</TabsTrigger>
            {isCompute && (
              <TabsTrigger value="variants" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Variants</TabsTrigger>
            )}
            <TabsTrigger value="documentation" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Documentation</TabsTrigger>
            <TabsTrigger value="roadmap" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Roadmap</TabsTrigger>
            <TabsTrigger value="upgrade-paths" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Upgrade Paths</TabsTrigger>
            <TabsTrigger value="dependencies" className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px]">Dependencies</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="mt-4 space-y-6 animate-fade-in">
            {isCompute ? (
              <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <FileText className="h-5 w-5 text-blue-500" />
                      Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-slate-400 leading-relaxed">{product.description}</p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Cpu className="h-5 w-5 text-blue-500" />
                      Available flavors
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {uniqueFlavors.map((flavor) => (
                        <div
                          key={flavor.id}
                          className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-white">{flavor.name}</span>
                            <span className="text-xs text-slate-500">{flavor.description}</span>
                          </div>
                          {flavor.vcpu > 0 && (
                            <SpecBar label="vCPU" value={flavor.vcpu} max={maxVcpu} unit="cores" color="bg-blue-500" />
                          )}
                          {flavor.ramGb > 0 && (
                            <SpecBar label="RAM" value={flavor.ramGb} max={maxRam} unit="GB" color="bg-emerald-500" />
                          )}
                          {flavor.vcpu === 0 && flavor.ramGb === 0 && (
                            <p className="text-xs text-slate-500">{flavor.description}</p>
                          )}
                        </div>
                      ))}
                      {uniqueFlavors.length === 0 && (
                        <div className="text-center py-8">
                          <Cpu className="mx-auto h-8 w-8 text-slate-700" />
                          <p className="mt-2 text-sm text-slate-500">No flavors configured.</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <FileText className="h-5 w-5 text-blue-500" />
                    Description
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-400 leading-relaxed">{product.description}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Variants */}
          {isCompute && (
            <TabsContent value="variants" className="mt-4 space-y-6 animate-fade-in">
              {/* Filters */}
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white text-base">
                    <Filter className="h-4 w-4 text-blue-500" />
                    Filter variants
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Operating System</label>
                      <select
                        className="w-full h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedOs}
                        onChange={(e) => { setSelectedOs(e.target.value); setSelectedVersion(''); }}
                      >
                        <option value="">All OS</option>
                        {osOptions.map((os) => (
                          <option key={os.id} value={os.id}>{os.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Version</label>
                      <select
                        className="w-full h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedVersion}
                        onChange={(e) => setSelectedVersion(e.target.value)}
                      >
                        <option value="">All versions</option>
                        {versionOptions.map((v) => (
                          <option key={v.id} value={v.id}>{v.version}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs text-slate-500">Flavor</label>
                      <select
                        className="w-full h-10 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        value={selectedFlavor}
                        onChange={(e) => setSelectedFlavor(e.target.value)}
                      >
                        <option value="">All flavors</option>
                        {flavorOptions.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Variant grid */}
              {filteredVariants.length > 0 ? (
                <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredVariants.map((variant: ProductVariant) => (
                    <Card
                      key={variant.id}
                      className={cn(
                        'bg-slate-900 border-slate-800 transition-all cursor-pointer',
                        selectedVariantId === variant.id
                          ? 'border-blue-500/50 ring-1 ring-blue-500/20'
                          : 'hover:border-slate-700'
                      )}
                      onClick={() => setSelectedVariantId(selectedVariantId === variant.id ? null : variant.id)}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                            {variant.os?.name}
                          </Badge>
                          {variant.isActive ? (
                            <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                              Active
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-500 border-slate-700">
                              Inactive
                            </Badge>
                          )}
                        </div>
                        <CardTitle className="text-base text-white mt-2">{variant.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4 pt-0">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Version</span>
                            <span className="text-white">{variant.osVersion?.version}</span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-slate-500">Flavor</span>
                            <span className="text-white">{variant.flavor?.name}</span>
                          </div>
                          {variant.flavor && (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">vCPU</span>
                                <span className="text-white">{variant.flavor.vcpu} cores</span>
                              </div>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-500">RAM</span>
                                <span className="text-white">{variant.flavor.ramGb} GB</span>
                              </div>
                            </>
                          )}
                          {variant.continuityLevel && (
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-500">Continuity</span>
                              <span className="text-white">{variant.continuityLevel.name}</span>
                            </div>
                          )}
                        </div>

                        {variant.availabilityZones && variant.availabilityZones.length > 0 && (
                          <div className="pt-3 border-t border-slate-800">
                            <p className="text-xs text-slate-500 mb-2">Availability zones</p>
                            <div className="flex flex-wrap gap-1.5">
                              {variant.availabilityZones.map((az: any) => (
                                <Badge
                                  key={az.availabilityZone?.id || az.availabilityZoneId}
                                  variant="outline"
                                  className="text-[10px] border-slate-700 text-slate-400"
                                >
                                  {az.availabilityZone?.code || 'AZ'}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {variant.osVersion?.phase && (
                          <div className="pt-1">
                            <Badge
                              variant="outline"
                              className={cn('text-[10px]', phaseColors[variant.osVersion.phase] || 'border-slate-700 text-slate-400')}
                            >
                              {variant.osVersion.phase.replace('_', ' ')}
                            </Badge>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Selected Variant Detail */}
                {selectedVariantId && (() => {
                  const variant = filteredVariants.find((v: ProductVariant) => v.id === selectedVariantId);
                  if (!variant) return null;
                  return (
                    <Card className="bg-slate-900 border-blue-500/30 mt-6 animate-fade-in">
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-white flex items-center gap-2 text-base">
                            <Server className="h-5 w-5 text-blue-500" />
                            {variant.name} — Detail
                          </CardTitle>
                          <Button variant="ghost" size="sm" onClick={() => setSelectedVariantId(null)} className="text-slate-400 hover:text-white">
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Operating System</p>
                            <p className="text-sm font-medium text-white">{variant.os?.name}</p>
                            <p className="text-xs text-slate-400">{variant.osVersion?.version}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Flavor</p>
                            <p className="text-sm font-medium text-white">{variant.flavor?.name}</p>
                            <p className="text-xs text-slate-400">{variant.flavor?.vcpu} vCPU · {variant.flavor?.ramGb} GB RAM</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Availability Zones</p>
                            <div className="flex flex-wrap gap-1">
                              {variant.availabilityZones && variant.availabilityZones.length > 0 ? (
                                variant.availabilityZones.map((az: any) => (
                                  <Badge key={az.availabilityZone?.id || az.availabilityZoneId} variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                    {az.availabilityZone?.code || 'AZ'}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-xs text-slate-600">None</span>
                              )}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-500 mb-1">Lifecycle Phase</p>
                            {variant.osVersion?.phase ? (
                              <Badge variant="outline" className={cn('text-[10px]', phaseColors[variant.osVersion.phase] || 'border-slate-700 text-slate-400')}>
                                {variant.osVersion.phase.replace('_', ' ')}
                              </Badge>
                            ) : (
                              <span className="text-xs text-slate-600">—</span>
                            )}
                          </div>
                        </div>
                        {variant.continuityLevel && (
                          <div className="mt-4 pt-4 border-t border-slate-800">
                            <p className="text-xs text-slate-500 mb-1">Continuity Level</p>
                            <p className="text-sm font-medium text-white">{variant.continuityLevel.name}</p>
                            <p className="text-xs text-slate-400">RTO: {variant.continuityLevel.rtoMinutes}min · RPO: {variant.continuityLevel.rpoMinutes}min</p>
                          </div>
                        )}
                        <div className="mt-4 pt-4 border-t border-slate-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant={variant.isActive ? 'secondary' : 'outline'} className={variant.isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'text-slate-500 border-slate-700'}>
                              {variant.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                          <Link to={`/forecasts`}>
                            <Button size="sm" className="gap-2 bg-blue-500 hover:bg-blue-600 min-h-[44px]">
                              <Send className="h-4 w-4" />
                              Request this variant
                            </Button>
                          </Link>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </>
              ) : (
                <div className="text-center py-12">
                  <Box className="mx-auto h-10 w-10 text-slate-700" />
                  <p className="mt-3 text-slate-500">No variants match the selected filters.</p>
                </div>
              )}
            </TabsContent>
          )}

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
                  <div className="prose prose-invert max-w-none">
                    <MarkdownContent text={product.documentation} />
                  </div>
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
          <TabsContent value="roadmap" className="mt-4 animate-fade-in">
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <MapIcon className="h-5 w-5 text-blue-500" />
                  Roadmap
                </CardTitle>
              </CardHeader>
              <CardContent>
                {product.roadmap ? (
                  <div className="prose prose-invert max-w-none">
                    <MarkdownContent text={product.roadmap} />
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <MapIcon className="mx-auto h-10 w-10 text-slate-700" />
                    <p className="mt-3 text-slate-500">No roadmap available for this product.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

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
