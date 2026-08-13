import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  useAvailabilityZones,
} from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Globe,
  MapPin,
  Server,
  X,
  ChevronRight,
  Radio,
  RadioTower,
} from 'lucide-react';
import type { AvailabilityZone } from '@cloudmarket/shared-types';

const regions = ['All', 'Europe', 'North America', 'Asia-Pacific'];

const regionColors: Record<string, string> = {
  Europe: '#3b82f6',
  'North America': '#10b981',
  'Asia-Pacific': '#f59e0b',
};

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

export default function AvailabilityZonesPage() {
  const { data: zones, isLoading, isError, refetch } = useAvailabilityZones();
  const [selectedRegion, setSelectedRegion] = useState('All');
  const [selectedZone, setSelectedZone] = useState<AvailabilityZone | null>(null);

  const filteredZones = useMemo(() => {
    if (!zones) return [];
    if (selectedRegion === 'All') return zones;
    return zones.filter((z) => z.region === selectedRegion);
  }, [zones, selectedRegion]);

  const activeCount = useMemo(() => filteredZones.filter((z) => z.isActive).length, [filteredZones]);

  if (isError) {
    return (
      <div className="space-y-6">
        <AnimatedSection>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold text-white">Regions & Availability Zones</h1>
            <p className="text-slate-400">
              Explore CloudMarket's global infrastructure footprint.
            </p>
          </div>
        </AnimatedSection>
        <QueryError message="Unable to load availability zones." onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Regions & Availability Zones</h1>
          <p className="text-slate-400">
            Explore CloudMarket's global infrastructure footprint.
          </p>
        </div>
      </AnimatedSection>

      {/* Stats */}
      <AnimatedSection delay={80}>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Globe className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-xs text-slate-500">Total AZs</p>
                <p className="text-2xl font-bold text-white">{isLoading ? <Skeleton className="h-8 w-12 bg-slate-800" /> : filteredZones.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Radio className="h-8 w-8 text-emerald-500" />
              <div>
                <p className="text-xs text-slate-500">Active</p>
                <p className="text-2xl font-bold text-white">{isLoading ? <Skeleton className="h-8 w-12 bg-slate-800" /> : activeCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <RadioTower className="h-8 w-8 text-amber-500" />
              <div>
                <p className="text-xs text-slate-500">Regions</p>
                <p className="text-2xl font-bold text-white">{isLoading ? <Skeleton className="h-8 w-12 bg-slate-800" /> : new Set(filteredZones.map((z) => z.region)).size}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedSection>

      {/* Region Tabs */}
      <AnimatedSection delay={120}>
        <Tabs value={selectedRegion} onValueChange={setSelectedRegion}>
          <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
            {regions.map((region) => (
              <TabsTrigger
                key={region}
                value={region}
                className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[36px] text-xs sm:text-sm"
              >
                {region}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </AnimatedSection>

      {/* Detail Panel */}
      <AnimatedSection delay={160}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Map Placeholder */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <MapPin className="h-5 w-5 text-blue-500" />
                Global Map
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <Skeleton className="h-[400px] w-full bg-slate-800" />
              ) : (
                <div className="relative h-[400px] w-full bg-slate-950 flex items-center justify-center">
                  <div className="text-center">
                    <Globe className="mx-auto h-16 w-16 text-slate-700" />
                    <p className="mt-4 text-sm text-slate-500">Interactive map coming soon</p>
                    <p className="text-xs text-slate-600 mt-1">{filteredZones.length} zones across {new Set(filteredZones.map(z => z.region)).size} regions</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detail Panel */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-white text-base">
                <Server className="h-5 w-5 text-blue-500" />
                {selectedZone ? selectedZone.name : 'Zone Details'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-3/4 bg-slate-800" />
                  <Skeleton className="h-4 w-1/2 bg-slate-800" />
                  <Skeleton className="h-20 w-full bg-slate-800" />
                </div>
              ) : selectedZone ? (
                <div className="space-y-4 animate-fade-in">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className="text-xs"
                        style={{ borderColor: regionColors[selectedZone.region] || '#64748b', color: regionColors[selectedZone.region] || '#64748b' }}
                      >
                        {selectedZone.region}
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedZone(null)}
                        className="h-7 w-7 p-0 text-slate-400 hover:text-white"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm text-slate-400">
                      {selectedZone.city}, {selectedZone.country}
                    </p>
                    <p className="text-xs font-mono text-slate-500">{selectedZone.code}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-slate-950 p-2">
                      <p className="text-slate-500">Latitude</p>
                      <p className="text-white font-medium">{selectedZone.latitude.toFixed(4)}</p>
                    </div>
                    <div className="rounded-md bg-slate-950 p-2">
                      <p className="text-slate-500">Longitude</p>
                      <p className="text-white font-medium">{selectedZone.longitude.toFixed(4)}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Available Products</p>
                    {selectedZone.productAvailabilities && selectedZone.productAvailabilities.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {selectedZone.productAvailabilities.map((pa: any) => (
                          <Link
                            key={pa.id}
                            to={`/products/${pa.product.slug}`}
                            className="flex items-center justify-between rounded-md bg-slate-950 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-blue-400 transition-colors"
                          >
                            <span className="truncate">{pa.product.name}</span>
                            <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-600">No products linked.</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <MapPin className="mx-auto h-10 w-10 text-slate-700" />
                  <p className="mt-3 text-sm text-slate-500">
                    Select a zone from the list below to view details and available products.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </AnimatedSection>

      {/* AZ List */}
      <AnimatedSection delay={200}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Availability Zones</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filteredZones.map((zone) => (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedZone(zone)}
                    className={`text-left rounded-lg border px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 ${
                      selectedZone?.id === zone.id
                        ? 'border-blue-500/40 bg-blue-500/5'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white">{zone.name}</span>
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ borderColor: regionColors[zone.region] || '#64748b', color: regionColors[zone.region] || '#64748b' }}
                      >
                        {zone.region}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {zone.city}, {zone.country} · {zone.code}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {zone.productAvailabilities?.length ?? 0} products
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
