import { Link } from 'react-router-dom';
import {
  Search,
  Cpu,
  Database,
  Server,
  Monitor,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  PackageOpen,
  ChevronRight,
  LayoutGrid,
  List,
} from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const iconMap: Record<string, React.ElementType> = {
  Cpu,
  Database,
  Server,
  Monitor,
};

const sortLabels: Record<string, string> = {
  newest: 'Newest',
  name: 'Name (A-Z)',
  category: 'Category',
};

function AnimatedCard({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Marketplace() {
  const { filters, sortBy, viewMode, setFilters, removeFilter, clearFilters, setSortBy, setViewMode } = useAppStore();
  const [products, setProducts] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [_expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const expandAll = () => {
    const expanded: Record<string, boolean> = {};
    categories?.forEach((cat: any) => { expanded[cat.name] = true; });
    expanded["Uncategorized"] = true;
    setExpandedCategories(expanded);
  };

  const collapseAll = () => { setExpandedCategories({}); };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    const apiBase = import.meta.env.VITE_API_URL || '';
    Promise.all([
      fetch(`${apiBase}/api/products`).then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw new Error(`Products request failed: ${r.status} ${r.statusText}${text ? ' - ' + text.slice(0, 100) : ''}`);
        }
        return r.json();
      }),
      fetch(`${apiBase}/api/categories`).then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw new Error(`Categories request failed: ${r.status} ${r.statusText}${text ? ' - ' + text.slice(0, 100) : ''}`);
        }
        return r.json();
      }),
    ])
      .then(([productsData, categoriesData]) => {
        if (!cancelled) {
          setProducts(productsData);
          setCategories(categoriesData);
          // Default expand all categories in grouped mode
          const expanded: Record<string, boolean> = {};
          categoriesData.forEach((cat: any) => {
            expanded[cat.name] = true;
          });
          setExpandedCategories(expanded);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Marketplace load error:', err);
          setError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filteredProducts = products?.filter((p: any) => {
    if (filters.category && p.category?.slug !== filters.category) return false;
    if (filters.computeType && p.computeType !== filters.computeType) return false;
    if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    return true;
  }) ?? [];

  const sortedProducts =
    filteredProducts.slice().sort((a: any, b: any) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return (a.category?.name || '').localeCompare(b.category?.name || '');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const groupedProducts = useMemo(() => {
    if (!groupByCategory) return null;
    const map: Record<string, any[]> = {};
    for (const p of sortedProducts) {
      const cat = p.category?.name || 'Uncategorized';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [sortedProducts, groupByCategory]);

  const hasError = error && !products;

  const refetch = () => {
    setLoading(true);
    setError(false);
    const apiBase = import.meta.env.VITE_API_URL || '';
    Promise.all([
      fetch(`${apiBase}/api/products`).then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw new Error(`Products request failed: ${r.status} ${r.statusText}${text ? ' - ' + text.slice(0, 100) : ''}`);
        }
        return r.json();
      }),
      fetch(`${apiBase}/api/categories`).then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => '');
          throw new Error(`Categories request failed: ${r.status} ${r.statusText}${text ? ' - ' + text.slice(0, 100) : ''}`);
        }
        return r.json();
      }),
    ])
      .then(([productsData, categoriesData]) => {
        setProducts(productsData);
        setCategories(categoriesData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Marketplace load error:', err);
        setError(true);
        setLoading(false);
      });
  };

  const renderProductCard = (product: any, index: number) => {
    const Icon = iconMap[product.category?.icon || ''] || Server;
    const isCompute = product.category?.slug === 'compute';
    const variantCount = product.variants?.length ?? 0;
    return (
      <AnimatedCard key={product.id} delay={Math.min(index * 80, 400)}>
        <Link to={`/products/${product.slug}`} className="group block h-full">
          <Card className="h-full bg-slate-900 border-slate-800 transition-all duration-300 hover:border-blue-500/40 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                  <Icon className="h-5 w-5 text-blue-500 transition-transform group-hover:scale-110" />
                </div>
                <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                  {product.category?.name}
                </Badge>
              </div>
              <CardTitle className="text-lg text-white mt-3 group-hover:text-blue-400 transition-colors">
                {product.name}
              </CardTitle>
              <CardDescription className="text-slate-400 line-clamp-2">
                {product.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-2">
                {isCompute && product.computeType && (
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {product.computeType}
                  </Badge>
                )}
                {isCompute && (
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {variantCount} variant{variantCount !== 1 ? 's' : ''}
                  </Badge>
                )}
                {product.dependencies && product.dependencies.length > 0 && (
                  <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                    {product.dependencies.length} dependency{product.dependencies.length > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>
              <div className="mt-4 flex items-center text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                View details
                <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </div>
            </CardContent>
          </Card>
        </Link>
      </AnimatedCard>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white">Marketplace</h1>
        <p className="text-slate-400">
          Browse our cloud infrastructure product catalog.
        </p>
      </div>

      {hasError ? (
        <QueryError
          message="Unable to load catalog. Check your connection or try again."
          onRetry={refetch}
        />
      ) : (
        <>
          {/* Search & Controls */}
          <div className="flex flex-col gap-4 animate-fade-in-up stagger-1">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search for a product..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters({ search: e.target.value || undefined })}
                  className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <select
                  value={filters.computeType || ''}
                  onChange={(e) => setFilters({ computeType: e.target.value || undefined })}
                  className="h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                >
                  <option value="">All Types</option>
                  <option value="PHYSICAL">Physical</option>
                  <option value="VIRTUAL">Virtual</option>
                </select>
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                    className="h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-900 pl-8 pr-3 text-sm text-white appearance-none"
                  >
                    {Object.entries(sortLabels).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <ArrowUpDown className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 pointer-events-none" />
                </div>
                <Button
                  size="sm"
                  variant={groupByCategory ? 'default' : 'outline'}
                  onClick={() => setGroupByCategory(!groupByCategory)}
                  className={cn(
                    'min-h-[36px]',
                    groupByCategory
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  Group by Category
                </Button>
                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-400 hover:text-white min-h-[44px]">
                    <X className="h-4 w-4 mr-1" />
                    Reset
                  </Button>
                )}
              </div>
            </div>

            {/* Category Pills */}
            {!loading && categories && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={!filters.category ? 'default' : 'outline'}
                  onClick={() => removeFilter('category')}
                  className={cn(
                    'min-h-[36px]',
                    !filters.category
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                  )}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                  All
                </Button>
                {categories.map((cat) => {
                  const Icon = iconMap[cat.icon || ''] || Server;
                  const active = filters.category === cat.slug;
                  return (
                    <Button
                      key={cat.id}
                      size="sm"
                      variant={active ? 'default' : 'outline'}
                      onClick={() => setFilters({ category: active ? undefined : cat.slug })}
                      className={cn(
                        'min-h-[36px]',
                        active
                          ? 'bg-blue-500 hover:bg-blue-600 text-white'
                          : 'border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 mr-1.5" />
                      {cat.name}
                      <span
                        className={cn(
                          'ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none',
                          active ? 'bg-blue-400/30 text-blue-100' : 'bg-slate-800 text-slate-400'
                        )}
                      >
                        {(cat as any)._count?.products ?? 0}
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}

            {/* View Toggle + Active Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">View:</span>
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-md overflow-hidden">
                  <button
                    onClick={() => setViewMode('flat')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                      viewMode === 'flat'
                        ? 'bg-slate-800 text-blue-400'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <List className="h-3.5 w-3.5" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('grouped')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                      viewMode === 'grouped'
                        ? 'bg-slate-800 text-blue-400'
                        : 'text-slate-400 hover:text-slate-200'
                    )}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    Grouped
                  </button>
                </div>
                {viewMode === 'grouped' && !loading && (
                  <div className="flex items-center gap-1 ml-2">
                    <button onClick={expandAll} className="text-[10px] text-slate-500 hover:text-blue-400 uppercase tracking-wide">Expand</button>
                    <span className="text-slate-700">·</span>
                    <button onClick={collapseAll} className="text-[10px] text-slate-500 hover:text-blue-400 uppercase tracking-wide">Collapse</button>
                  </div>
                )}
              </div>

              {/* Active Filter Chips */}
              {activeFilterCount > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Active filters:</span>
                  {Object.entries(filters).map(([key, value]) => {
                    if (!value) return null;
                    let label = String(value);
                    if (key === 'category') {
                      const cat = categories?.find((c) => c.slug === value);
                      if (cat) label = cat.name;
                    }
                    return (
                      <Badge
                        key={key}
                        variant="secondary"
                        className="cursor-pointer bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                        onClick={() => removeFilter(key as keyof typeof filters)}
                      >
                        {key === 'search' ? `Search: "${label}"` : label}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Results count */}
            <div className="text-sm text-slate-500">
              {loading ? (
                <Skeleton className="h-4 w-32" />
              ) : (
                <span>
                  <span className="font-medium text-slate-300">{sortedProducts.length}</span> product
                  {sortedProducts.length !== 1 ? 's' : ''} found
                </span>
              )}
            </div>
          </div>

          {/* Product Grid / Grouped View */}
          {loading ? (
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-56 rounded-lg bg-slate-800 animate-pulse-soft" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 sm:p-16 text-center animate-fade-in">
              <PackageOpen className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-lg font-medium text-slate-300">No products found</p>
              <p className="mt-1 text-slate-500">No products match your search criteria.</p>
              {activeFilterCount > 0 && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4 border-slate-700 text-slate-300 hover:bg-slate-800 min-h-[44px]">
                  Reset filters
                </Button>
              )}
            </div>
          ) : groupByCategory && groupedProducts ? (
            <div className="space-y-8 animate-fade-in">
              {Object.entries(groupedProducts).map(([categoryName, catProducts]) => (
                <div key={categoryName}>
                  <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    {categoryName}
                    <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                      {catProducts.length}
                    </Badge>
                  </h2>
                  <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
                    {catProducts.map((product, i) => renderProductCard(product, i))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedProducts.map((product, i) => renderProductCard(product, i))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
