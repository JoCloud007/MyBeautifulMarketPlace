import { useState, useMemo } from 'react';
import { useProducts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Filter, ChevronDown, ChevronRight } from 'lucide-react';
import type { Product, ProductLifecycle, LifecyclePhase } from '@cloudmarket/shared-types';

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
};

function getFamilyLabel(family: string | null) {
  return familyConfig[family || ''] || { label: family || 'OTHER', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' };
}

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

/* ── Gantt Bar ─────────────────────────────────────────────────── */

function GanttBar({ lc, yearStart, yearEnd }: { lc: ProductLifecycle; yearStart: number; yearEnd: number }) {
  const totalYears = yearEnd - yearStart;
  const releaseDate = new Date(lc.releaseDate);
  const normalEnd = new Date(lc.normalSupportEnd);
  const extendedEnd = new Date(lc.extendedSupportEnd);
  const eolDate = new Date(lc.eolDate);

  const releaseYear = releaseDate.getFullYear();
  const normalYear = normalEnd.getFullYear();
  const extendedYear = extendedEnd.getFullYear();
  const eolYear = eolDate.getFullYear();

  if (isNaN(releaseYear) || totalYears <= 0) return null;

  const leftPct = (y: number) => Math.max(0, Math.min(100, ((y - yearStart) / totalYears) * 100));
  const widthPct = (from: number, to: number) => Math.max(0.5, Math.min(100, ((to - from) / totalYears) * 100));

  const rLeft = leftPct(releaseYear);
  const nLeft = leftPct(normalYear);
  const eLeft = leftPct(extendedYear);
  const xLeft = leftPct(eolYear);

  return (
    <div className="flex-1 relative h-5 bg-slate-900/80 rounded overflow-hidden">
      {/* Released */}
      {rLeft < nLeft && (
        <div
          className="absolute h-full bg-emerald-500/80"
          style={{ left: `${rLeft}%`, width: `${widthPct(releaseYear, normalYear)}%` }}
          title={`Released: ${releaseDate.toLocaleDateString()} → ${normalEnd.toLocaleDateString()}`}
        />
      )}
      {/* Normal Support */}
      {nLeft < eLeft && (
        <div
          className="absolute h-full bg-blue-500/80"
          style={{ left: `${nLeft}%`, width: `${widthPct(normalYear, extendedYear)}%` }}
          title={`Normal Support: ${normalEnd.toLocaleDateString()} → ${extendedEnd.toLocaleDateString()}`}
        />
      )}
      {/* Extended Support */}
      {eLeft < xLeft && (
        <div
          className="absolute h-full bg-amber-500/80"
          style={{ left: `${eLeft}%`, width: `${widthPct(extendedYear, eolYear)}%` }}
          title={`Extended Support: ${extendedEnd.toLocaleDateString()} → ${eolDate.toLocaleDateString()}`}
        />
      )}
      {/* EOL tail */}
      {xLeft < 100 && (
        <div
          className="absolute h-full bg-red-500/60"
          style={{ left: `${xLeft}%`, width: `${widthPct(eolYear, yearEnd)}%` }}
          title={`EOL: ${eolDate.toLocaleDateString()}`}
        />
      )}
    </div>
  );
}

/* ── Year Axis ─────────────────────────────────────────────────── */

function YearAxis({ yearStart, yearEnd }: { yearStart: number; yearEnd: number }) {
  const years: number[] = [];
  for (let y = yearStart; y <= yearEnd; y++) years.push(y);

  return (
    <div className="flex ml-[240px] border-b border-slate-700 pb-1 mb-2 text-[11px] text-slate-500 font-mono">
      {years.map((year) => (
        <div key={year} className="flex-1 text-center">
          {year}
        </div>
      ))}
    </div>
  );
}

/* ── Version Row ───────────────────────────────────────────────── */

function VersionRow({ lc, yearStart, yearEnd }: { lc: ProductLifecycle; yearStart: number; yearEnd: number }) {
  const phase = phaseConfig[lc.phase];
  return (
    <div className="flex items-center gap-3 h-7">
      <div className="w-[240px] flex items-center gap-2 shrink-0">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${phase.bg}`} />
        <span className="text-xs text-slate-300 font-medium truncate">{lc.osName || lc.version}</span>
        <span className="text-[10px] text-slate-500 ml-auto">
          {new Date(lc.releaseDate).getFullYear()} → {new Date(lc.eolDate).getFullYear()}
        </span>
      </div>
      <GanttBar lc={lc} yearStart={yearStart} yearEnd={yearEnd} />
    </div>
  );
}

/* ── Product Section ───────────────────────────────────────────── */

function ProductSection({ product, yearStart, yearEnd }: { product: Product; yearStart: number; yearEnd: number }) {
  const [expanded, setExpanded] = useState(true);
  const lifecycles = product.lifecycles || [];

  // Group lifecycles by osFamily — must be before any conditional return
  const families = useMemo(() => {
    const groups: Record<string, ProductLifecycle[]> = {};
    for (const lc of lifecycles) {
      const fam = lc.osFamily || 'OTHER';
      if (!groups[fam]) groups[fam] = [];
      groups[fam].push(lc);
    }
    return groups;
  }, [lifecycles]);

  if (lifecycles.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-left group w-full"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
        <h4 className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">{product.name}</h4>
        <Badge variant="outline" className="text-[10px] h-5">{lifecycles.length} versions</Badge>
      </button>

      {expanded && (
        <div className="ml-5 space-y-3">
          {Object.entries(families).map(([family, lcs]) => {
            const famCfg = getFamilyLabel(family);
            return (
              <div key={family}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${famCfg.color} ${famCfg.bg}`}>
                    {famCfg.label}
                  </span>
                  <span className="text-[10px] text-slate-500">{lcs.length} version{lcs.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-1">
                  {lcs.map((lc) => (
                    <VersionRow key={lc.id} lc={lc} yearStart={yearStart} yearEnd={yearEnd} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Category Section ──────────────────────────────────────────── */

function CategorySection({ category, products, yearStart, yearEnd }: { category: string; products: Product[]; yearStart: number; yearEnd: number }) {
  const [expanded, setExpanded] = useState(true);
  const totalVersions = products.reduce((sum, p) => sum + (p.lifecycles?.length || 0), 0);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 text-left group w-full"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-cyan-500" /> : <ChevronRight className="h-4 w-4 text-cyan-500" />}
        <h3 className="text-sm font-semibold text-cyan-400 uppercase tracking-wide">{category}</h3>
        <span className="text-[11px] text-slate-500">{products.length} product{products.length > 1 ? 's' : ''} · {totalVersions} version{totalVersions > 1 ? 's' : ''}</span>
      </button>

      {expanded && (
        <div className="ml-4">
          {products.map((product) => (
            <ProductSection key={product.id} product={product} yearStart={yearStart} yearEnd={yearEnd} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function Roadmap() {
  const { data: products, isLoading, error, refetch } = useProducts();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedFamily, setSelectedFamily] = useState('');
  const [timeRange, setTimeRange] = useState<'3y' | '5y' | '10y'>('5y');

  const now = new Date().getFullYear();
  const rangeMap = { '3y': 3, '5y': 5, '10y': 10 };
  const yearStart = now - 1;
  const yearEnd = now + rangeMap[timeRange];

  const allCategories = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(products.map((p) => p.category?.name).filter(Boolean))) as string[];
  }, [products]);

  const allFamilies = useMemo(() => {
    if (!products) return [];
    return Array.from(new Set(
      products.flatMap((p) => (p.lifecycles || []).map((lc) => lc.osFamily).filter((f): f is string => !!f))
    ));
  }, [products]);

  const filtered = useMemo(() => {
    if (!products) return [];
    let result = products.filter((p) => (p.lifecycles || []).length > 0);
    if (selectedCategory) result = result.filter((p) => p.category?.name === selectedCategory);
    if (selectedFamily) {
      result = result.filter((p) =>
        (p.lifecycles || []).some((lc) => lc.osFamily === selectedFamily)
      );
    }
    return result;
  }, [products, selectedCategory, selectedFamily]);

  const categories = useMemo(() => {
    const groups: Record<string, Product[]> = {};
    for (const p of filtered) {
      const cat = p.category?.name || 'Uncategorized';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(p);
    }
    return groups;
  }, [filtered]);

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

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <AnimatedSection>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Product Lifecycle Roadmap</h1>
          <p className="text-slate-400">Visual timeline of product lifecycles and support phases</p>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={100}>
        <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400 font-medium">Filters</span>
          </div>

          <Select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="min-w-[160px]"
          >
            <option value="">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </Select>

          <Select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="min-w-[140px]"
          >
            <option value="">All OS Families</option>
            {allFamilies.map((fam) => (
              <option key={fam} value={fam}>{fam}</option>
            ))}
          </Select>

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
          <YearAxis yearStart={yearStart} yearEnd={yearEnd} />

          {Object.keys(categories).length === 0 ? (
            <div className="text-slate-500 text-center py-12">No lifecycles match your filters</div>
          ) : (
            Object.entries(categories).map(([category, catProducts]) => (
              <CategorySection
                key={category}
                category={category}
                products={catProducts}
                yearStart={yearStart}
                yearEnd={yearEnd}
              />
            ))
          )}
        </div>
      </AnimatedSection>
    </div>
  );
}
