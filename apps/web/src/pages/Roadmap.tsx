import { useState, useMemo } from 'react';
import { useOperatingSystems } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Select } from '@/components/ui/select';
import { Filter, ChevronDown, ChevronRight } from 'lucide-react';
import type { OperatingSystem, OsVersion, LifecyclePhase } from '@cloudmarket/shared-types';

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

function GanttBar({ version, yearStart, yearEnd }: { version: OsVersion; yearStart: number; yearEnd: number }) {
  const totalYears = yearEnd - yearStart;
  const releaseDate = new Date(version.releaseDate);
  const normalEnd = new Date(version.normalSupportEnd);
  const extendedEnd = new Date(version.extendedSupportEnd);
  const eolDate = new Date(version.eolDate);

  const toPct = (d: Date) => {
    const years = d.getFullYear() + (d.getMonth() / 12) - yearStart;
    return Math.max(0, Math.min(100, (years / totalYears) * 100));
  };

  const releasePct = toPct(releaseDate);
  const normalPct = toPct(normalEnd);
  const extendedPct = toPct(extendedEnd);
  const eolPct = toPct(eolDate);

  const phaseCfg = phaseConfig[version.phase];

  return (
    <div className="flex-1 h-4 relative rounded overflow-hidden bg-slate-800">
      {/* Released → Normal Support */}
      <div
        className="absolute top-0 h-full bg-emerald-500/60"
        style={{ left: `${releasePct}%`, width: `${Math.max(0, normalPct - releasePct)}%` }}
      />
      {/* Normal Support → Extended Support */}
      <div
        className="absolute top-0 h-full bg-blue-500/60"
        style={{ left: `${normalPct}%`, width: `${Math.max(0, extendedPct - normalPct)}%` }}
      />
      {/* Extended Support → EOL */}
      <div
        className="absolute top-0 h-full bg-amber-500/60"
        style={{ left: `${extendedPct}%`, width: `${Math.max(0, eolPct - extendedPct)}%` }}
      />
      {/* Current phase indicator */}
      <div
        className={`absolute top-0 h-full ${phaseCfg.bg} opacity-80`}
        style={{ left: `${releasePct}%`, width: `${Math.max(0, eolPct - releasePct)}%` }}
      />
      {/* Phase marker */}
      <div
        className={`absolute top-0 h-full w-0.5 ${phaseCfg.bg}`}
        style={{ left: `${toPct(new Date())}%` }}
      />
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

function VersionRow({ version, yearStart, yearEnd }: { version: OsVersion; yearStart: number; yearEnd: number }) {
  const phase = phaseConfig[version.phase];
  return (
    <div className="flex items-center gap-3 h-7">
      <div className="w-[240px] flex items-center gap-2 shrink-0">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${phase.bg}`} />
        <span className="text-xs text-slate-300 font-medium truncate">{version.version}</span>
        <span className="text-[10px] text-slate-500 ml-auto">
          {new Date(version.releaseDate).getFullYear()} → {new Date(version.eolDate).getFullYear()}
        </span>
      </div>
      <GanttBar version={version} yearStart={yearStart} yearEnd={yearEnd} />
    </div>
  );
}

/* ── OS Section ────────────────────────────────────────────────── */

function OsSection({ os, yearStart, yearEnd }: { os: OperatingSystem; yearStart: number; yearEnd: number }) {
  const [expanded, setExpanded] = useState(true);
  const versions = os.versions || [];

  if (versions.length === 0) return null;

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-2 text-left group w-full"
      >
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> : <ChevronRight className="h-3.5 w-3.5 text-slate-500" />}
        <h4 className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">{os.name}</h4>
        <Badge variant="outline" className="text-[10px] h-5">{versions.length} versions</Badge>
      </button>

      {expanded && (
        <div className="ml-5 space-y-1">
          {versions.map((version) => (
            <VersionRow key={version.id} version={version} yearStart={yearStart} yearEnd={yearEnd} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Family Section ────────────────────────────────────────────── */

function FamilySection({ family, osList, yearStart, yearEnd }: { family: string; osList: OperatingSystem[]; yearStart: number; yearEnd: number }) {
  const [expanded, setExpanded] = useState(true);
  const totalVersions = osList.reduce((sum, os) => sum + (os.versions?.length || 0), 0);

  const famCfg = getFamilyLabel(family);

  return (
    <div className="mb-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 mb-3 text-left group w-full"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-cyan-500" /> : <ChevronRight className="h-4 w-4 text-cyan-500" />}
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${famCfg.color} ${famCfg.bg}`}>
          {famCfg.label}
        </span>
        <span className="text-[11px] text-slate-500">{osList.length} OS{osList.length > 1 ? 's' : ''} · {totalVersions} version{totalVersions > 1 ? 's' : ''}</span>
      </button>

      {expanded && (
        <div className="ml-4">
          {osList.map((os) => (
            <OsSection key={os.id} os={os} yearStart={yearStart} yearEnd={yearEnd} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────── */

export default function Roadmap() {
  const { data: operatingSystems, isLoading, error, refetch } = useOperatingSystems();
  const [selectedFamily, setSelectedFamily] = useState('');
  const [timeRange, setTimeRange] = useState<'3y' | '5y' | '10y'>('5y');

  const now = new Date().getFullYear();
  const rangeMap = { '3y': 3, '5y': 5, '10y': 10 };
  const yearStart = now - 1;
  const yearEnd = now + rangeMap[timeRange];

  const allFamilies = useMemo(() => {
    if (!operatingSystems) return [];
    return Array.from(new Set(operatingSystems.map((os) => os.family).filter(Boolean))) as string[];
  }, [operatingSystems]);

  const filtered = useMemo(() => {
    if (!operatingSystems) return [];
    let result = operatingSystems.filter((os) => (os.versions || []).length > 0);
    if (selectedFamily) result = result.filter((os) => os.family === selectedFamily);
    return result;
  }, [operatingSystems, selectedFamily]);

  const families = useMemo(() => {
    const groups: Record<string, OperatingSystem[]> = {};
    for (const os of filtered) {
      const fam = os.family || 'OTHER';
      if (!groups[fam]) groups[fam] = [];
      groups[fam].push(os);
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
  if (!operatingSystems) return <div className="text-slate-400 text-center py-12">No operating systems available</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <AnimatedSection>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">OS Lifecycle Roadmap</h1>
          <p className="text-slate-400">Visual timeline of operating system lifecycles and support phases</p>
        </div>
      </AnimatedSection>

      <AnimatedSection delay={100}>
        <div className="flex flex-wrap gap-3 mb-6 p-4 rounded-xl bg-slate-900/50 border border-slate-800">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-400" />
            <span className="text-sm text-slate-400 font-medium">Filters</span>
          </div>

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

          {Object.keys(families).length === 0 ? (
            <div className="text-slate-500 text-center py-12">No lifecycles match your filters</div>
          ) : (
            Object.entries(families).map(([family, osList]) => (
              <FamilySection
                key={family}
                family={family}
                osList={osList}
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
