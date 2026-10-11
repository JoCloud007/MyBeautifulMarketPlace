import { useState } from 'react';
import type { Product, ProductVariant, Transition } from '@cloudmarket/shared-types';
import { osVersionLabel } from '@/components/OsLifecycleTab';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/* ---------- helpers ---------- */

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * A transition is an "OS" migration when both endpoints are OS versions of this
 * product's variants; anything else (gen7 → gen8, cross-product…) is "Platform".
 */
function isOsTransition(t: { fromVersion: string; toVersion: string }, osVersionStrings: Set<string>) {
  return osVersionStrings.has(t.fromVersion) && osVersionStrings.has(t.toVersion);
}

const statusBadge: Record<string, string> = {
  AVAILABLE: 'border-emerald-500/20 text-emerald-500 bg-emerald-500/10',
  PLANNED: 'border-blue-500/20 text-blue-500 bg-blue-500/10',
  DEPRECATED: 'border-amber-500/20 text-amber-500 bg-amber-500/10',
  ARCHIVED: 'border-slate-600/30 text-slate-500 bg-slate-800/50',
};

/* ---------- unified row model ---------- */

interface UnifiedTransition {
  key: string;
  kind: 'OS' | 'PLATFORM';
  fromVersion: string;
  toVersion: string;
  fromProductId: string;
  toProductId: string;
  fromProductName?: string;
  toProductName?: string;
  toProductSlug?: string;
  migrationType: string;
  status?: string;
  description?: string | null;
  notes?: string | null;
  availableFrom?: string | null;
}

/** Pair key used to collapse UpgradePath rows already covered by a richer Transition. */
function pairKey(t: { fromVersion: string; toVersion: string; fromProductId: string; toProductId: string }) {
  return `${t.fromProductId}|${t.toProductId}|${t.fromVersion}|${t.toVersion}`;
}

/* ---------- row render ---------- */

function TransitionRow({
  t,
  product,
  versionOsNames,
}: {
  t: UnifiedTransition;
  product: Product;
  versionOsNames: Map<string, string>;
}) {
  const label = (version: string) => osVersionLabel(versionOsNames.get(version), version);
  const isCrossFrom = t.fromProductId !== product.id;
  const isCrossTo = t.toProductId !== product.id;
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200">
          {label(t.fromVersion)}
        </span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-cyan-500" />
        <span className="rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1 text-xs text-slate-200">
          {label(t.toVersion)}
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          {t.status && (
            <Badge variant="outline" className={cn('text-[10px]', statusBadge[t.status] || statusBadge.ARCHIVED)}>
              {t.status}
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] border-blue-500/20 text-blue-500 bg-blue-500/10">
            {t.migrationType.replace('_', '-')}
          </Badge>
        </span>
      </div>
      {(t.description || t.notes || t.availableFrom || isCrossFrom || isCrossTo) && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {t.availableFrom && <span>Available since {formatDate(t.availableFrom)} · </span>}
          {t.description}
          {t.description && t.notes && ' — '}
          {t.notes}
          {isCrossTo && t.toProductSlug && (
            <Link to={`/products/${t.toProductSlug}`} className="ml-1.5 text-blue-400 hover:underline">
              {t.toProductName}
            </Link>
          )}
          {isCrossFrom && t.fromProductName && (
            <span className="ml-1.5">from {t.fromProductName}</span>
          )}
        </p>
      )}
    </div>
  );
}

/* ---------- main tab content ---------- */

type Filter = 'ALL' | 'PLATFORM' | 'OS';

export default function UpgradesTransitionsTab({
  product,
  variants,
  transitions,
}: {
  product: Product;
  variants: ProductVariant[];
  transitions: Transition[];
}) {
  const [filter, setFilter] = useState<Filter>('ALL');

  const osVersionStrings = new Set<string>();
  const versionOsNames = new Map<string, string>();
  for (const v of variants) {
    if (v.osVersion?.version) osVersionStrings.add(v.osVersion.version);
    if (v.os?.name && v.osVersion?.version && !versionOsNames.has(v.osVersion.version)) {
      versionOsNames.set(v.osVersion.version, v.os.name);
    }
  }

  // Unified list: rich Transition rows first, then UpgradePath rows not already
  // covered by a Transition with the same version pair (Transition is the richer source).
  const items: UnifiedTransition[] = [];
  const seenPairs = new Set<string>();
  for (const t of transitions) {
    seenPairs.add(pairKey(t));
    items.push({
      key: `t-${t.id}`,
      kind: isOsTransition(t, osVersionStrings) ? 'OS' : 'PLATFORM',
      fromVersion: t.fromVersion,
      toVersion: t.toVersion,
      fromProductId: t.fromProductId,
      toProductId: t.toProductId,
      fromProductName: t.fromProduct?.name,
      toProductName: t.toProduct?.name,
      toProductSlug: t.toProduct?.slug,
      migrationType: t.migrationType,
      status: t.status,
      description: t.description,
      notes: t.notes,
      availableFrom: t.availableFrom,
    });
  }
  const upgradePaths = [...(product as any).upgradeFrom || [], ...(product as any).upgradeTo || []];
  const seenUp = new Set<string>();
  for (const up of upgradePaths) {
    if (seenUp.has(up.id) || seenPairs.has(pairKey(up))) continue;
    seenUp.add(up.id);
    items.push({
      key: `up-${up.id}`,
      kind: isOsTransition(up, osVersionStrings) ? 'OS' : 'PLATFORM',
      fromVersion: up.fromVersion,
      toVersion: up.toVersion,
      fromProductId: up.fromProductId,
      toProductId: up.toProductId,
      fromProductName: up.fromProduct?.name,
      toProductName: up.toProduct?.name,
      toProductSlug: up.toProduct?.slug,
      migrationType: up.migrationType,
      status: undefined,
      description: up.notes,
      notes: null,
      availableFrom: null,
    });
  }

  const osCount = items.filter((i) => i.kind === 'OS').length;
  const platformCount = items.length - osCount;
  const filtered = filter === 'ALL' ? items : items.filter((i) => i.kind === filter);

  const chip = (f: Filter, label: string, count: number) => (
    <button
      key={f}
      type="button"
      onClick={() => setFilter(f)}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors',
        filter === f
          ? 'border-blue-500/40 bg-blue-500/10 text-blue-400'
          : 'border-slate-700 text-slate-400 hover:border-slate-600 hover:text-white'
      )}
    >
      {label}
      <span className={cn('rounded-full px-1.5 text-[10px]', filter === f ? 'bg-blue-500/20' : 'bg-slate-800')}>{count}</span>
    </button>
  );

  return (
    <Card className="bg-slate-900 border-slate-800 animate-fade-in">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <ArrowLeftRight className="h-5 w-5 text-blue-500" />
          Upgrades &amp; Transitions
        </CardTitle>
        <CardDescription className="text-slate-400">
          Platform and OS migration paths for {product.name}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {chip('ALL', 'All', items.length)}
          {chip('PLATFORM', 'Platform', platformCount)}
          {chip('OS', 'OS', osCount)}
        </div>
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <ArrowLeftRight className="mx-auto h-10 w-10 text-slate-700" />
            <p className="mt-3 text-slate-500">No transitions declared for this product.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((t) => (
              <TransitionRow key={t.key} t={t} product={product} versionOsNames={versionOsNames} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
