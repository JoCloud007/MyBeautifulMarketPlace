import { useState } from 'react';
import type { Product, ProductVariant, Transition } from '@cloudmarket/shared-types';
import { phaseLabel, phaseColorClass } from '@/components/LifecycleTimeline';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Monitor,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ---------- helpers ---------- */

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

interface OsGroup {
  os: NonNullable<ProductVariant['os']>;
  versions: NonNullable<ProductVariant['osVersion']>[];
  variantCount: number;
}

/** Group variants by OS + OS version (derived from the product's variants). */
export function groupOsFromVariants(variants: ProductVariant[]): OsGroup[] {
  const byOs = new Map<string, OsGroup>();
  for (const v of variants) {
    if (!v.os || !v.osVersion) continue;
    const os = v.os;
    const osVersion = v.osVersion;
    let group = byOs.get(os.id);
    if (!group) {
      group = { os, versions: [], variantCount: 0 };
      byOs.set(os.id, group);
    }
    if (!group.versions.some((ov) => ov.id === osVersion.id)) {
      group.versions.push(osVersion);
    }
    group.variantCount += 1;
  }
  for (const group of byOs.values()) {
    group.versions.sort(
      (a, b) => new Date(b.releaseDate).getTime() - new Date(a.releaseDate).getTime()
    );
  }
  return Array.from(byOs.values()).sort((a, b) =>
    a.os.family === b.os.family
      ? a.os.name.localeCompare(b.os.name)
      : a.os.family.localeCompare(b.os.family)
  );
}

/** A transition is an "OS transition" when both endpoints are OS versions of this product. */
export function filterOsTransitions(
  transitions: Transition[],
  variants: ProductVariant[]
): Transition[] {
  const osVersionStrings = new Set<string>();
  for (const v of variants) {
    if (v.osVersion?.version) osVersionStrings.add(v.osVersion.version);
  }
  return transitions.filter(
    (t) => osVersionStrings.has(t.fromVersion) && osVersionStrings.has(t.toVersion)
  );
}

const availabilityTypeBadge: Record<string, string> = {
  STANDARD: 'border-slate-700 text-slate-400 bg-slate-800/50',
  RECOMMENDED: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10',
  RESTRICTED: 'border-red-500/20 text-red-500 bg-red-500/10',
  ON_DEMAND: 'border-amber-500/20 text-amber-500 bg-amber-500/10',
};

/**
 * Full display label for an OS version: "Debian 12 (Bookworm)", "Windows Server 2019".
 * Drops words duplicated between the OS name tail and the version head
 * (e.g. "Windows Server" + "Server 2019" -> "Windows Server 2019").
 */
export function osVersionLabel(osName: string | null | undefined, version: string): string {
  if (!osName) return version;
  const osWords = osName.split(' ');
  const vWords = version.split(' ');
  let overlap = 0;
  while (
    overlap < osWords.length &&
    overlap < vWords.length &&
    osWords[osWords.length - 1 - overlap].toLowerCase() === vWords[overlap].toLowerCase()
  ) {
    overlap += 1;
  }
  return overlap === 0 ? `${osName} ${version}` : [...osWords, ...vWords.slice(overlap)].join(' ');
}

/* ---------- lifecycle bar (mini gantt per OS version) ---------- */

function LifecycleBar({
  version,
  minStart,
  maxEnd,
}: {
  version: NonNullable<ProductVariant['osVersion']>;
  minStart: number;
  maxEnd: number;
}) {
  const span = Math.max(maxEnd - minStart, 1);
  const start = new Date(version.releaseDate).getTime();
  const normal = new Date(version.normalSupportEnd).getTime();
  const extended = new Date(version.extendedSupportEnd).getTime();
  const eol = new Date(version.eolDate).getTime();
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - minStart) / span) * 100))}%`;
  const today = Date.now();

  return (
    <div className="relative h-2.5 flex-1 min-w-[80px] rounded-full bg-slate-800 overflow-hidden">
      {/* Normal support */}
      <div
        className="absolute top-0 bottom-0 bg-blue-500"
        style={{ left: pct(start), width: `calc(${pct(normal)} - ${pct(start)})` }}
      />
      {/* Extended support */}
      {extended > normal && (
        <div
          className="absolute top-0 bottom-0 bg-amber-500"
          style={{ left: pct(normal), width: `calc(${pct(extended)} - ${pct(normal)})` }}
        />
      )}
      {/* No support */}
      {eol > extended && (
        <div
          className="absolute top-0 bottom-0 bg-rose-500"
          style={{ left: pct(extended), width: `calc(${pct(eol)} - ${pct(extended)})` }}
        />
      )}
      {/* Today marker */}
      {today >= start && today <= eol && (
        <div
          className="absolute top-[-2px] bottom-[-2px] w-px bg-white"
          style={{ left: pct(today) }}
        />
      )}
    </div>
  );
}

/* ---------- OS card (one per OperatingSystem) ---------- */

function OsCard({ group }: { group: OsGroup }) {
  const [open, setOpen] = useState(false);
  const starts = group.versions.map((v) => new Date(v.releaseDate).getTime());
  const ends = group.versions.map((v) => new Date(v.eolDate).getTime());
  const minStart = Math.min(...starts);
  const maxEnd = Math.max(...ends);

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-900/60"
      >
        <Monitor className="h-4 w-4 shrink-0 text-cyan-400" />
        <span className="text-sm font-semibold text-white">{group.os.name}</span>
        <span className="text-[10px] text-slate-500">{group.os.family}</span>
        {group.os.availabilityType && group.os.availabilityType !== 'STANDARD' && (
          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', availabilityTypeBadge[group.os.availabilityType])}>
            {group.os.availabilityType.replace('_', ' ')}
          </Badge>
        )}
        <span className="ml-auto text-[11px] text-slate-500">
          {group.versions.length} version{group.versions.length !== 1 ? 's' : ''} · {group.variantCount} variant{group.variantCount !== 1 ? 's' : ''}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </button>

      {open && (
        <div className="space-y-2.5 border-t border-slate-800 px-4 py-3">
          {group.versions.map((v) => (
            <div key={v.id} className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
              <span className="w-32 shrink-0 truncate text-xs font-medium text-slate-200" title={v.version}>
                {v.version}
              </span>
              <LifecycleBar version={v} minStart={minStart} maxEnd={maxEnd} />
              <span className="w-40 shrink-0 text-right text-[10px] text-slate-500">
                {formatDate(v.releaseDate)} → {formatDate(v.eolDate)}
              </span>
              <Badge variant="outline" className={cn('text-[10px] shrink-0', phaseColorClass(v.phase))}>
                {phaseLabel(v.phase)}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- main tab content ---------- */

export default function OsLifecycleTab({
  product,
  variants,
}: {
  product: Product;
  variants: ProductVariant[];
}) {
  const osGroups = groupOsFromVariants(variants);
  const totalVersions = osGroups.reduce((acc, g) => acc + g.versions.length, 0);

  if (osGroups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-12 text-center animate-fade-in">
        <Monitor className="mx-auto h-12 w-12 text-slate-600" />
        <p className="mt-4 text-lg font-medium text-slate-300">No operating systems</p>
        <p className="mt-1 text-slate-500">No OS is associated with this product's variants yet.</p>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-6 animate-fade-in">
      {/* Available OS */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Monitor className="h-5 w-5 text-blue-500" />
            Available OS
          </CardTitle>
          <CardDescription className="text-slate-400">
            {osGroups.length} operating system{osGroups.length !== 1 ? 's' : ''} · {totalVersions} version{totalVersions !== 1 ? 's' : ''} available for {product.name}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {osGroups.map((group) => (
            <OsCard key={group.os.id} group={group} />
          ))}
          <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-slate-500">
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-blue-500" />Normal support</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-500" />Extended support</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-500" />No support</span>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
