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
  MapPin,
  Check,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import { useAvailabilityZones } from '@/hooks/useApi';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { AvailabilityZone } from '@cloudmarket/shared-types';

const iconMap: Record<string, React.ElementType> = {
  Cpu,
  Database,
  Server,
  Monitor,
};

const osOptions = ['Linux', 'Windows', 'ESXi'];
const flavorOptions = ['Small', 'Medium', 'Large', 'XL'];

const sortLabels: Record<string, string> = {
  newest: 'Newest',
  name: 'Name (A-Z)',
  category: 'Category',
};

const regionColors: Record<string, string> = {
  Europe: '#3b82f6',
  'North America': '#10b981',
  'Asia-Pacific': '#f59e0b',
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
  const { filters, sortBy, setFilters, removeFilter, clearFilters, setSortBy } = useAppStore();
  const [products, setProducts] = useState<any[] | null>(null);
  const [categories, setCategories] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [azDropdownOpen, setAzDropdownOpen] = useState(false);
  const azDropdownRef = useRef<HTMLDivElement>(null);

  const { data: zones, isLoading: zonesLoading } = useAvailabilityZones();

  const selectedAzIds = filters.availabilityZoneIds ? filters.availabilityZoneIds.split(',') : [];

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    Promise.all([
      fetch('/api/products').then(r => r.ok ? r.json() : Promise.reject(new Error('products failed'))),
      fetch('/api/categories').then(r => r.ok ? r.json() : Promise.reject(new Error('categories failed')))
    ])
      .then(([productsData, categoriesData]) => {
        if (!cancelled) {
          setProducts(productsData);
          setCategories(categoriesData);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (azDropdownRef.current && !azDropdownRef.current.contains(e.target as Node)) {
        setAzDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const filteredProducts = products?.filter((p: any) => {
    if (filters.category && p.category?.slug !== filters.category) return false;
    if (filters.os && p.os !== filters.os) return false;
    if (filters.search && !p.name.toLowerCase().includes(filters.search.toLowerCase())) return false;
    if (filters.flavor && !p.flavors?.some((f: any) => f.name === filters.flavor)) return false;
    if (selectedAzIds.length > 0) {
      const productAzIds = p.availabilityZones?.map((az: any) => az.availabilityZoneId) ?? [];
      const hasMatch = selectedAzIds.some((id) => productAzIds.includes(id));
      if (!hasMatch) return false;
    }
    return true;
  }) ?? [];

  const sortedProducts =
    filteredProducts.slice().sort((a: any, b: any) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'category') return (a.category?.name || '').localeCompare(b.category?.name || '');
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const hasError = error && !products;

  const refetch = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetch('/api/products').then(r => r.ok ? r.json() : Promise.reject(new Error('products failed'))),
      fetch('/api/categories').then(r => r.ok ? r.json() : Promise.reject(new Error('categories failed')))
    ])
      .then(([productsData, categoriesData]) => {
        setProducts(productsData);
        setCategories(categoriesData);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  const toggleAz = (id: string) => {
    const next = selectedAzIds.includes(id)
      ? selectedAzIds.filter((azId) => azId !== id)
      : [...selectedAzIds, id];
    setFilters({ availabilityZoneIds: next.length > 0 ? next.join(',') : undefined });
  };

  const getAzLabel = (id: string) => {
    const zone = zones?.find((z) => z.id === id);
    return zone ? zone.name : id;
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
                  value={filters.os || ''}
                  onChange={(e) => setFilters({ os: e.target.value || undefined })}
                  className="h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                >
                  <option value="">All OS</option>
                  {osOptions.map((os) => (
                    <option key={os} value={os}>
                      {os}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.flavor || ''}
                  onChange={(e) => setFilters({ flavor: e.target.value || undefined })}
                  className="h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-900 px-3 text-sm text-white"
                >
                  <option value="">All flavors</option>
                  {flavorOptions.map((fl) => (
                    <option key={fl} value={fl}>
                      {fl}
                    </option>
                  ))}
                </select>

                {/* AZ Multi-select Dropdown */}
                <div className="relative" ref={azDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setAzDropdownOpen(!azDropdownOpen)}
                    className={cn(
                      'h-10 min-h-[44px] rounded-md border bg-slate-900 px-3 text-sm text-white flex items-center gap-2 transition-colors',
                      selectedAzIds.length > 0
                        ? 'border-blue-500/50 text-blue-300'
                        : 'border-slate-700'
                    )}
                  >
                    <MapPin className="h-4 w-4 text-slate-500" />
                    {selectedAzIds.length === 0
                      ? 'All regions'
                      : `${selectedAzIds.length} AZ${selectedAzIds.length > 1 ? 's' : ''}`}
                  </button>
                  {azDropdownOpen && (
                    <div className="absolute z-20 mt-1 w-56 rounded-md border border-slate-700 bg-slate-900 shadow-lg">
                      <div className="max-h-60 overflow-y-auto p-1">
                        {zonesLoading ? (
                          <div className="px-3 py-2 text-xs text-slate-500">Loading...</div>
                        ) : !zones || zones.length === 0 ? (
                          <div className="px-3 py-2 text-xs text-slate-500">No zones</div>
                        ) : (
                          zones.map((zone) => (
                            <label
                              key={zone.id}
                              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
                            >
                              <div
                                className={cn(
                                  'flex h-4 w-4 items-center justify-center rounded border',
                                  selectedAzIds.includes(zone.id)
                                    ? 'border-blue-500 bg-blue-500'
                                    : 'border-slate-600'
                                )}
                              >
                                {selectedAzIds.includes(zone.id) && (
                                  <Check className="h-3 w-3 text-white" />
                                )}
                              </div>
                              <input
                                type="checkbox"
                                className="sr-only"
                                checked={selectedAzIds.includes(zone.id)}
                                onChange={() => toggleAz(zone.id)}
                              />
                              <span className="flex-1 truncate">{zone.name}</span>
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: regionColors[zone.region] || '#64748b' }}
                              />
                            </label>
                          ))
                        )}
                      </div>
                      {selectedAzIds.length > 0 && (
                        <div className="border-t border-slate-800 p-1">
                          <button
                            type="button"
                            onClick={() => setFilters({ availabilityZoneIds: undefined })}
                            className="w-full rounded px-2 py-1.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white text-left"
                          >
                            Clear selection
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

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
                  if (key === 'availabilityZoneIds') {
                    const names = selectedAzIds.map(getAzLabel);
                    label = names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
                  }
                  return (
                    <Badge
                      key={key}
                      variant="secondary"
                      className="cursor-pointer bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
                      onClick={() => removeFilter(key as keyof typeof filters)}
                    >
                      {key === 'search' ? `Search: "${label}"` : key === 'availabilityZoneIds' ? `AZ: ${label}` : label}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })}
              </div>
            )}

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

          {/* Product Grid */}
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
          ) : (
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {sortedProducts.map((product, i) => {
                const Icon = iconMap[product.category?.icon || ''] || Server;
                const productAzs = product.availabilityZones?.map((az: any) => az.availabilityZone) ?? [];
                return (
                  <AnimatedCard key={product.id} delay={Math.min(i * 80, 400)}>
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
                            {product.os && (
                              <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                                {product.os}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                              {product.flavors?.length || 0} flavors
                            </Badge>
                            {product.dependencies && product.dependencies.length > 0 && (
                              <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">
                                {product.dependencies.length} dependency{product.dependencies.length > 1 ? 's' : ''}
                              </Badge>
                            )}
                          </div>
                          {/* AZ badges */}
                          {productAzs.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                              {productAzs.slice(0, 3).map((az: AvailabilityZone) => (
                                <Badge
                                  key={az.id}
                                  variant="outline"
                                  className="text-[10px] border-slate-700"
                                  style={{
                                    color: regionColors[az.region] || '#94a3b8',
                                    borderColor: `${regionColors[az.region] || '#334155'}40`,
                                  }}
                                >
                                  {az.code}
                                </Badge>
                              ))}
                              {productAzs.length > 3 && (
                                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
                                  +{productAzs.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                          <div className="mt-4 flex items-center text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            View details
                            <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  </AnimatedCard>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
