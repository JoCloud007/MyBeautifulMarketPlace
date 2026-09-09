import * as React from 'react';
import type { Product, ProductVersion, ProductVariant } from '@cloudmarket/shared-types';
import { LifecyclePhase } from '@cloudmarket/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, ChevronDown, ChevronUp, Box, Cpu } from 'lucide-react';
import { cn } from '@/lib/utils';

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function phaseLabel(phase: LifecyclePhase) {
  switch (phase) {
    case LifecyclePhase.RELEASED:
      return 'Released';
    case LifecyclePhase.NORMAL_SUPPORT:
      return 'Normal Support';
    case LifecyclePhase.EXTENDED_SUPPORT:
      return 'Extended Support';
    case LifecyclePhase.NO_SUPPORT:
      return 'No Support';
    case LifecyclePhase.EOL:
      return 'EOL';
    default:
      return phase;
  }
}

function phaseColorClass(phase: LifecyclePhase) {
  switch (phase) {
    case LifecyclePhase.RELEASED:
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case LifecyclePhase.NORMAL_SUPPORT:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case LifecyclePhase.EXTENDED_SUPPORT:
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case LifecyclePhase.NO_SUPPORT:
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case LifecyclePhase.EOL:
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    default:
      return 'bg-slate-500/10 text-slate-400 border-slate-500/20';
  }
}

function progressSegments(version: ProductVersion) {
  const { releaseDate, normalSupportEnd, extendedSupportEnd, eolDate } = version;
  const total = eolDate && releaseDate
    ? new Date(eolDate).getTime() - new Date(releaseDate).getTime()
    : 0;
  if (total <= 0) {
    return [
      { label: 'Normal', width: '33.33%', color: 'bg-blue-500' },
      { label: 'Extended', width: '33.33%', color: 'bg-amber-500' },
      { label: 'No Support', width: '33.34%', color: 'bg-rose-500' },
    ];
  }
  const r = new Date(releaseDate!).getTime();
  const n = normalSupportEnd ? new Date(normalSupportEnd).getTime() : r + total * 0.4;
  const e = extendedSupportEnd ? new Date(extendedSupportEnd).getTime() : r + total * 0.7;
  const end = new Date(eolDate!).getTime();
  const w1 = Math.max(0, ((n - r) / total) * 100);
  const w2 = Math.max(0, ((e - n) / total) * 100);
  const w3 = Math.max(0, ((end - e) / total) * 100);
  const sum = w1 + w2 + w3;
  const scale = sum > 0 ? 100 / sum : 1;
  return [
    { label: 'Normal', width: `${w1 * scale}%`, color: 'bg-blue-500' },
    { label: 'Extended', width: `${w2 * scale}%`, color: 'bg-amber-500' },
    { label: 'No Support', width: `${w3 * scale}%`, color: 'bg-rose-500' },
  ];
}

function LifecycleProgressBar({ version }: { version: ProductVersion }) {
  const segments = progressSegments(version);
  return (
    <div className="mt-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
        {segments.map((seg, i) => (
          <div
            key={i}
            className={cn('h-full', seg.color)}
            style={{ width: seg.width }}
            title={seg.label}
          />
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>Release {formatDate(version.releaseDate)}</span>
        <span>Normal {formatDate(version.normalSupportEnd)}</span>
        <span>Extended {formatDate(version.extendedSupportEnd)}</span>
        <span>EOL {formatDate(version.eolDate)}</span>
      </div>
    </div>
  );
}

function VariantRow({ variant, version }: { variant: ProductVariant; version: ProductVersion }) {
  const releaseDate = variant.releaseDate || version.releaseDate;
  const normalSupportEnd = variant.normalSupportEnd || version.normalSupportEnd;
  const extendedSupportEnd = variant.extendedSupportEnd || version.extendedSupportEnd;
  const eolDate = variant.eolDate || version.eolDate;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <div className="flex items-center gap-3">
        <Cpu className="h-4 w-4 text-slate-400 shrink-0" />
        <div>
          <p className="text-sm text-white">{variant.name}</p>
          <p className="text-xs text-slate-500">
            {variant.flavor?.name ?? 'Unknown flavor'} · {variant.os?.name ?? 'Unknown OS'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Badge variant="outline" className={cn('text-[10px]', phaseColorClass(variant.phase))}>
          {phaseLabel(variant.phase)}
        </Badge>
        {eolDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            EOL {formatDate(eolDate)}
          </span>
        )}
        {normalSupportEnd && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Normal {formatDate(normalSupportEnd)}
          </span>
        )}
        {extendedSupportEnd && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Extended {formatDate(extendedSupportEnd)}
          </span>
        )}
        {releaseDate && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            Release {formatDate(releaseDate)}
          </span>
        )}
      </div>
    </div>
  );
}

function VersionCard({ version, variants }: { version: ProductVersion; variants: ProductVariant[] }) {
  const [open, setOpen] = React.useState(true);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-wrap">
            <CardTitle className="text-white text-lg">Version {version.version}</CardTitle>
            <Badge variant="outline" className={cn('text-xs', phaseColorClass(version.phase))}>
              {phaseLabel(version.phase)}
            </Badge>
          </div>
          {variants.length > 0 && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="text-slate-400 hover:text-white"
              aria-label={open ? 'Collapse variants' : 'Expand variants'}
            >
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400">
          {version.releaseDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Release {formatDate(version.releaseDate)}
            </span>
          )}
          {version.normalSupportEnd && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Normal Support {formatDate(version.normalSupportEnd)}
            </span>
          )}
          {version.extendedSupportEnd && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Extended Support {formatDate(version.extendedSupportEnd)}
            </span>
          )}
          {version.eolDate && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              EOL {formatDate(version.eolDate)}
            </span>
          )}
        </div>
        <LifecycleProgressBar version={version} />
      </CardHeader>
      <CardContent className="space-y-3">
        {version.changelog && (
          <div className="rounded-md border border-slate-800 bg-slate-950 p-3">
            <p className="text-xs font-medium text-slate-300 mb-1">Changelog</p>
            <p className="text-xs text-slate-400 whitespace-pre-line">{version.changelog}</p>
          </div>
        )}
        {variants.length > 0 && open && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-slate-300 flex items-center gap-2">
              <Box className="h-3 w-3" />
              Variants ({variants.length})
            </p>
            {variants.map((variant) => (
              <VariantRow key={variant.id} variant={variant} version={version} />
            ))}
          </div>
        )}
        {variants.length === 0 && (
          <p className="text-xs text-slate-500">No variants associated with this version.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LifecycleTimeline({ product }: { product: Product }) {
  const versions = React.useMemo(() => {
    const list = product.productVersions || [];
    return [...list].sort((a, b) => {
      const da = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const db = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return db - da; // newest first
    });
  }, [product.productVersions]);

  const variantsByVersion = React.useMemo(() => {
    const map = new Map<string, ProductVariant[]>();
    (product.variants || []).forEach((v) => {
      const key = v.productVersionId || 'unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return map;
  }, [product.variants]);

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 rounded-lg border border-slate-800 bg-slate-950">
        <Clock className="mx-auto h-10 w-10 text-slate-700" />
        <p className="mt-3 text-slate-500">No versions or lifecycle data for this product.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {versions.map((version) => (
        <VersionCard
          key={version.id}
          version={version}
          variants={variantsByVersion.get(version.id) || []}
        />
      ))}
    </div>
  );
}
