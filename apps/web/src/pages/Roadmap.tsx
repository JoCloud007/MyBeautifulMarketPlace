import { useState } from 'react';
import { useProducts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Clock, Calendar, ArrowRight, Filter } from 'lucide-react';
import type { Product, ProductLifecycle, LifecyclePhase } from '@cloudmarket/shared-types';

const phaseConfig: Record<LifecyclePhase, { label: string; color: string; bg: string }> = {
  RELEASED: { label: 'Released', color: 'text-emerald-400', bg: 'bg-emerald-500/20' },
  NORMAL_SUPPORT: { label: 'Normal Support', color: 'text-blue-400', bg: 'bg-blue-500/20' },
  EXTENDED_SUPPORT: { label: 'Extended Support', color: 'text-amber-400', bg: 'bg-amber-500/20' },
  NO_SUPPORT: { label: 'No Support', color: 'text-orange-400', bg: 'bg-orange-500/20' },
  EOL: { label: 'End of Life', color: 'text-red-400', bg: 'bg-red-500/20' },
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

function LifecycleBar({ lifecycle, yearStart, yearEnd }: { lifecycle: ProductLifecycle; yearStart: number; yearEnd: number }) {
  const totalYears = yearEnd - yearStart;
  const releaseDate = new Date(lifecycle.releaseDate);
  const eolDate = new Date(lifecycle.eolDate);
  const releaseYear = releaseDate.getFullYear();
  const eolYear = eolDate.getFullYear();

  if (isNaN(releaseYear) || isNaN(eolYear) || totalYears <= 0) {
    return null;
  }

  const leftPercent = Math.max(0, Math.min(100, ((releaseYear - yearStart) / totalYears) * 100));
  const rawWidth = ((eolYear - releaseYear) / totalYears) * 100;
  const widthPercent = isNaN(rawWidth) ? 3 : Math.max(3, Math.min(100 - leftPercent, rawWidth));
  const phase = phaseConfig[lifecycle.phase];

  return (
    <div
      className={`absolute h-7 rounded-md flex items-center px-2 text-xs font-medium whitespace-nowrap overflow-hidden ${phase.bg} ${phase.color} border border-white/10`}
      style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: '60px' }}
      title={`${lifecycle.version}: ${releaseDate.toLocaleDateString()} → ${eolDate.toLocaleDateString()}`}
    >
      <span className="truncate">{lifecycle.version}</span>
    </div>
  );
}

function ProductTimeline({ product, yearStart, yearEnd }: { product: Product; yearStart: number; yearEnd: number }) {
  const [expanded, setExpanded] = useState(false);
  const lifecycles = product.lifecycles || [];
  if (lifecycles.length === 0) return null;

  const upgradeFrom = (product as any).upgradeFrom || [];
  const upgradeTo = (product as any).upgradeTo || [];
  const allUpgrades = [...upgradeFrom, ...upgradeTo];

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 text-left group"
      >
        <ArrowRight className={`h-4 w-4 text-slate-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        <h3 className="text-white font-semibold group-hover:text-cyan-400 transition-colors">{product.name}</h3>
        <Badge variant="outline" className="text-xs">{lifecycles.length} versions</Badge>
      </button>

      <div className="relative ml-6">
        <div className="relative h-10 mb-2">
          {lifecycles.map((lc) => (
            <LifecycleBar key={lc.id} lifecycle={lc} yearStart={yearStart} yearEnd={yearEnd} />
          ))}
        </div>

        {allUpgrades.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {allUpgrades.map((up: any) => (
              <div key={up.id} className="inline-flex items-center gap-1 text-xs bg-slate-800 border border-slate-700 rounded-md px-2 py-1">
                <span className="text-slate-400">{up.fromVersion}</span>
                <ArrowRight className="h-3 w-3 text-cyan-500" />
                <span className="text-slate-300">{up.toVersion}</span>
                <span className="text-slate-500 ml-1">({up.migrationType})</span>
              </div>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-3 grid gap-2">
            {lifecycles.map((lc) => {
              const phase = phaseConfig[lc.phase];
              return (
                <div key={lc.id} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-slate-900/50 border border-slate-800">
                  <span className={`inline-block w-2 h-2 rounded-full ${phase.bg.replace('/20', '')}`} />
                  <span className="font-medium text-slate-200 w-20">{lc.version}</span>
                  <Badge variant="outline" className={`text-xs ${phase.color} ${phase.bg}`}>
                    {phase.label}
                  </Badge>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(lc.releaseDate).toLocaleDateString()} → {new Date(lc.eolDate).toLocaleDateString()}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function YearAxis({ yearStart, yearEnd }: { yearStart: number; yearEnd: number }) {
  const years: number[] = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  if (years.length <= 1) {
    return (
      <div className="relative h-8 mb-2 border-b border-slate-700">
        <div className="absolute text-xs text-slate-500 font-mono" style={{ left: '0%' }}>
          {years[0] ?? yearStart}
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-8 mb-2 border-b border-slate-700">
      {years.map((year, i) => (
        <div
          key={year}
          className="absolute text-xs text-slate-500 font-mono"
          style={{ left: `${(i / (years.length - 1)) * 100}%`, transform: 'translateX(-50%)' }}
        >
          {year}
        </div>
      ))}
    </div>
  );
}

export default function Roadmap() {
  const { data: products, isLoading, error, refetch } = useProducts();
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedPhase, setSelectedPhase] = useState<LifecyclePhase | ''>('');
  const [timeRange, setTimeRange] = useState<'1y' | '3y' | '5y' | 'all'>('3y');

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-12 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (error) return <QueryError message="Unable to load roadmap data" onRetry={refetch} />;
  if (!products) return <div className="text-slate-400 text-center py-12">No products available</div>;

  const now = new Date().getFullYear();
  const rangeMap = { '1y': 1, '3y': 3, '5y': 5, 'all': 10 };
  const yearStart = now - 1;
  const yearEnd = now + rangeMap[timeRange];

  let filtered = products.filter((p) => (p.lifecycles || []).length > 0);
  if (selectedProduct) filtered = filtered.filter((p) => p.id === selectedProduct);
  if (selectedPhase) {
    filtered = filtered.filter((p) =>
      (p.lifecycles || []).some((lc) => lc.phase === selectedPhase)
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <AnimatedSection>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Product Roadmap</h1>
          <p className="text-slate-400">Visual timeline of product lifecycles and support phases</p>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={100}>
        <div className="flex flex-wrap gap-3 mb-8 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400 font-medium">Filters</span>
          </div>

          <Select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="min-w-[180px]"
          >
            <option value="">All Products</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>

          <Select
            value={selectedPhase}
            onChange={(e) => setSelectedPhase(e.target.value as LifecyclePhase)}
            className="min-w-[160px]"
          >
            <option value="">All Phases</option>
            {Object.entries(phaseConfig).map(([phase, cfg]) => (
              <option key={phase} value={phase}>{cfg.label}</option>
            ))}
          </Select>

          <div className="flex gap-1 ml-auto">
            {(['1y', '3y', '5y', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  timeRange === range
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                }`}
              >
                {range === 'all' ? 'All' : range}
              </button>
            ))}
          </div>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={200}>
        <div className="p-6 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-4 mb-6 flex-wrap">
            {Object.entries(phaseConfig).map(([phase, cfg]) => (
              <div key={phase} className="flex items-center gap-2">
                <span className={`inline-block w-3 h-3 rounded-sm ${cfg.bg}`} />
                <span className="text-xs text-slate-400">{cfg.label}</span>
              </div>
            ))}
          </div>

          <YearAxis yearStart={yearStart} yearEnd={yearEnd} />

          {filtered.length === 0 ? (
            <div className="text-slate-500 text-center py-12">No lifecycles match your filters</div>
          ) : (
            filtered.map((product) => (
              <ProductTimeline key={product.id} product={product} yearStart={yearStart} yearEnd={yearEnd} />
            ))
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection delay={300}>
        <div className="mt-8 p-4 rounded-lg bg-slate-900/30 border border-slate-800/50">
          <div className="flex items-start gap-3">
            <Clock className="h-5 w-5 text-slate-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-slate-300">About Lifecycle Phases</h4>
              <p className="text-sm text-slate-500 mt-1">
                Each product version follows a standard lifecycle: Released → Normal Support → Extended Support → No Support → End of Life.
                Upgrade paths are available to migrate between versions with minimal disruption.
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </div>
  );
}
