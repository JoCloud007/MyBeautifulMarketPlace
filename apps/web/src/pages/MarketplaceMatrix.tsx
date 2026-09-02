import { useState, useMemo, useEffect, useRef } from 'react';
import { BarChart3, Table, Filter, Download, Search, ChevronDown } from 'lucide-react';
import { useProducts, useZones, useAvailabilityZones } from '@/hooks/useApi';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';
import type { ProductVariant, AvailabilityZone } from '@cloudmarket/shared-types';

/* ── Types ─────────────────────────────────────────────────────── */

type Axis = 'PRODUCT' | 'FLAVOR' | 'OS' | 'ZONE' | 'AZ' | 'REGION' | 'COUNTRIES' | 'NONE';
type RowAxis = Axis;
type ColAxis = Axis;
type ViewMode = 'grouped' | 'flat';
type CellStatus = 'AVAILABLE' | 'RESTRICTED' | 'UNAVAILABLE' | 'ON_DEMAND' | 'NONE';

interface MatrixCell {
  status: CellStatus;
  releaseDate?: string;
  variantName?: string;
}

interface MatrixRow {
  id: string;
  labels: { axis: RowAxis; label: string; id: string }[];
  productId: string;
  cells: Record<string, MatrixCell>;
}

interface ColumnPathSegment {
  axis: ColAxis;
  id: string;
  label: string;
}

interface Column {
  id: string;
  path: ColumnPathSegment[];
}

/* ── PickUpList Component ──────────────────────────────────────── */

interface PickUpListProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  color?: 'blue' | 'purple' | 'slate';
}

function PickUpList<T extends string>({ options, value, onChange, color = 'slate' }: PickUpListProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  const colorMap = {
    blue: {
      btn: 'text-blue-300 border-blue-500/40 bg-blue-500/20 hover:bg-blue-500/30',
      active: 'bg-blue-600 text-white border-blue-500',
      item: 'text-blue-300 hover:bg-blue-500/20',
    },
    purple: {
      btn: 'text-purple-300 border-purple-500/40 bg-purple-500/20 hover:bg-purple-500/30',
      active: 'bg-purple-600 text-white border-purple-500',
      item: 'text-purple-300 hover:bg-purple-500/20',
    },
    slate: {
      btn: 'text-slate-300 border-slate-600 bg-slate-800 hover:bg-slate-700',
      active: 'bg-slate-600 text-white border-slate-500',
      item: 'text-slate-300 hover:bg-slate-700',
    },
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={`flex items-center gap-1 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${colorMap[color].btn}`}
      >
        {selected?.label}
        <ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute z-50 mt-1 min-w-[120px] rounded-md border border-slate-700 bg-slate-900 shadow-lg py-1">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
              className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                opt.value === value ? colorMap[color].active : colorMap[color].item
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Helpers ───────────────────────────────────────────────────── */

function getStatusFromVariant(variant: ProductVariant): CellStatus {
  if (!variant.isActive) return 'UNAVAILABLE';
  switch (variant.availabilityType) {
    case 'RECOMMENDED':
    case 'STANDARD':
      return 'AVAILABLE';
    case 'RESTRICTED':
      return 'RESTRICTED';
    case 'ON_DEMAND':
      return 'ON_DEMAND';
    default:
      return 'NONE';
  }
}

function formatReleaseDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  const year = d.getUTCFullYear();
  if (year > now.getUTCFullYear() || (year === now.getUTCFullYear() && q > Math.floor(now.getUTCMonth() / 3) + 1)) {
    return `Q${q} ${year}`;
  }
  return d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', year: 'numeric' });
}

function getStatusBadge(status: CellStatus, releaseDate?: string) {
  switch (status) {
    case 'AVAILABLE':
      return (
        <div className="bg-emerald-500/20 text-emerald-300 border-2 border-emerald-400/40 rounded px-1.5 py-1 text-[10px] font-bold leading-tight text-center shadow-[0_0_8px_rgba(16,185,129,0.15)]">
          <div>✓</div>
          <div className="text-[9px] text-emerald-200/80">Live</div>
        </div>
      );
    case 'RESTRICTED':
      return (
        <div className="bg-amber-500/20 text-amber-300 border-2 border-amber-400/40 rounded px-1.5 py-1 text-[10px] font-bold leading-tight text-center shadow-[0_0_8px_rgba(245,158,11,0.15)]">
          <div>⚠</div>
          {releaseDate && <div className="text-[9px] text-amber-200/80">{releaseDate}</div>}
        </div>
      );
    case 'ON_DEMAND':
      return (
        <div className="bg-blue-500/20 text-blue-300 border-2 border-blue-400/40 rounded px-1.5 py-1 text-[10px] font-bold leading-tight text-center shadow-[0_0_8px_rgba(59,130,246,0.15)]">
          <div>○</div>
          <div className="text-[9px] text-blue-200/80">On-Demand</div>
        </div>
      );
    case 'UNAVAILABLE':
      return (
        <div className="bg-red-500/20 text-red-300 border-2 border-red-400/40 rounded px-1.5 py-1 text-[10px] font-bold leading-tight text-center shadow-[0_0_8px_rgba(239,68,68,0.15)]">
          <div>✕</div>
          <div className="text-[9px] text-red-200/80">N/A</div>
        </div>
      );
    default:
      return <div className="text-slate-600 text-center text-sm">—</div>;
  }
}

/* ── Axis matching helpers ─────────────────────────────────────── */

function matchesAxis(
  variant: ProductVariant,
  axis: ColAxis | RowAxis,
  id: string,
  _zones?: any[],
  azs?: AvailabilityZone[]
): boolean {
  switch (axis) {
    case 'ZONE':
      return variant.zones?.some((z: any) => z.zoneId === id) ?? false;
    case 'AZ':
      return variant.availabilityZones?.some((a: any) => a.availabilityZoneId === id) ?? false;
    case 'REGION': {
      const regionAZs = new Set(azs?.filter((a) => a.region === id).map((a) => a.id) ?? []);
      return variant.availabilityZones?.some((a: any) => regionAZs.has(a.availabilityZoneId)) ?? false;
    }
    case 'COUNTRIES': {
      const countryAZs = new Set(azs?.filter((a) => a.country === id).map((a) => a.id) ?? []);
      return variant.availabilityZones?.some((a: any) => countryAZs.has(a.availabilityZoneId)) ?? false;
    }
    case 'PRODUCT':
      return variant.productId === id;
    case 'FLAVOR':
      return variant.flavorId === id || variant.flavor?.id === id;
    case 'OS':
      return variant.osId === id || variant.os?.id === id;
    case 'NONE':
    default:
      return true;
  }
}

function getAxisItems(axis: ColAxis, zones?: any[], azs?: AvailabilityZone[]): { id: string; label: string }[] {
  switch (axis) {
    case 'ZONE':
      return zones?.map((z: any) => ({ id: z.id, label: z.name })) ?? [];
    case 'AZ':
      return azs?.map((a: any) => ({ id: a.id, label: a.code })) ?? [];
    case 'REGION': {
      const seen = new Set<string>();
      const items: { id: string; label: string }[] = [];
      for (const z of zones ?? []) {
        for (const za of z.availabilityZones || []) {
          const r = za.availabilityZone.region || 'Unknown';
          if (!seen.has(r)) {
            seen.add(r);
            items.push({ id: r, label: r });
          }
        }
      }
      return items;
    }
    case 'COUNTRIES': {
      const seen = new Set<string>();
      const items: { id: string; label: string }[] = [];
      for (const z of zones ?? []) {
        for (const za of z.availabilityZones || []) {
          const c = za.availabilityZone.country || 'Unknown';
          if (!seen.has(c)) {
            seen.add(c);
            items.push({ id: c, label: c });
          }
        }
      }
      return items;
    }
    default:
      return [];
  }
}

/* ── Component ─────────────────────────────────────────────────── */

export default function MarketplaceMatrix() {
  /* Data hooks */
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const { data: zones, isLoading: zonesLoading } = useZones();
  const { data: azs, isLoading: azsLoading } = useAvailabilityZones();

  /* UI state */
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [rowAxes, setRowAxes] = useState<RowAxis[]>(['PRODUCT', 'FLAVOR']);
  const [colAxes, setColAxes] = useState<ColAxis[]>(['AZ', 'ZONE']);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /* Column widths for resizing */
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [showEmptyCols, setShowEmptyCols] = useState(false);
  const resizeRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  const activeRowAxes = useMemo(() => rowAxes.filter((r) => r !== 'NONE'), [rowAxes]);
  const activeColAxes = useMemo(() => colAxes.filter((c) => c !== 'NONE'), [colAxes]);

  useEffect(() => {
    if (viewMode === 'grouped' && activeRowAxes.length <= 1) {
      setViewMode('flat');
    }
  }, [activeRowAxes, viewMode]);

  useEffect(() => {
    return () => {
      if (resizeRef.current) {
        document.removeEventListener('mousemove', resizeRef.current.move);
        document.removeEventListener('mouseup', resizeRef.current.up);
        resizeRef.current = null;
      }
    };
  }, []);

  const startResize = (colId: string, startX: number, startWidth: number) => {
    if (resizeRef.current) {
      document.removeEventListener('mousemove', resizeRef.current.move);
      document.removeEventListener('mouseup', resizeRef.current.up);
    }
    const handleMove = (e: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + e.clientX - startX);
      setColWidths((prev) => ({ ...prev, [colId]: newWidth }));
    };
    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      resizeRef.current = null;
    };
    resizeRef.current = { move: handleMove, up: handleUp };
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
  };

  /* Build column headers */
  const columns = useMemo(() => {
    if (activeColAxes.length === 0) return [] as Column[];

    function buildColumns(index: number, parentPath: ColumnPathSegment[]): Column[] {
      if (index >= activeColAxes.length) {
        return [{ id: parentPath.map((p) => p.id).join('|'), path: parentPath }];
      }

      const axis = activeColAxes[index];
      const items = getAxisItems(axis, zones, azs);
      const results: Column[] = [];

      for (const item of items) {
        const newPath = [...parentPath, { axis, id: item.id, label: item.label }];
        const subCols = buildColumns(index + 1, newPath);
        results.push(...subCols);
      }

      return results;
    }

    let cols = buildColumns(0, []);

    // Apply showEmptyCols filter at leaf level
    if (!showEmptyCols && products && activeColAxes.length > 0) {
      cols = cols.filter((col) =>
        products.some((p) =>
          p.variants?.some((v) => {
            for (let i = 0; i < activeColAxes.length; i++) {
              const axis = activeColAxes[i];
              const segment = col.path[i];
              if (!matchesAxis(v, axis, segment.id, zones, azs)) {
                return false;
              }
            }
            return true;
          })
        )
      );
    }

    return cols;
  }, [zones, azs, products, activeColAxes, showEmptyCols]);

  /* Build matrix rows */
  const rows = useMemo(() => {
    if (!products) return [] as MatrixRow[];
    const matrixRows: MatrixRow[] = [];

    const statusRank: Record<CellStatus, number> = {
      AVAILABLE: 4,
      RESTRICTED: 3,
      ON_DEMAND: 2,
      UNAVAILABLE: 1,
      NONE: 0,
    };

    function groupVariantsByAxis(
      variants: ProductVariant[],
      axis: RowAxis,
      product: any
    ): Map<string, { id: string; label: string; variants: ProductVariant[] }> {
      const groups = new Map<string, { id: string; label: string; variants: ProductVariant[] }>();

      switch (axis) {
        case 'PRODUCT': {
          const key = product.id || 'unknown';
          if (!groups.has(key)) {
            groups.set(key, { id: key, label: product.name || 'Product', variants: [] });
          }
          groups.get(key)!.variants.push(...variants);
          break;
        }
        case 'FLAVOR':
          for (const v of variants) {
            const key = v.flavor?.name || v.name || 'Unknown';
            const id = v.flavor?.id || v.id || 'unknown';
            if (!groups.has(key)) {
              groups.set(key, { id, label: key, variants: [] });
            }
            groups.get(key)!.variants.push(v);
          }
          break;
        case 'OS':
          for (const v of variants) {
            const key = v.os?.name || 'Unknown';
            const id = v.os?.id || key;
            if (!groups.has(key)) {
              groups.set(key, { id, label: key, variants: [] });
            }
            groups.get(key)!.variants.push(v);
          }
          break;
        case 'ZONE':
          for (const v of variants) {
            for (const z of v.zones || []) {
              const zoneId = z.zoneId;
              const zoneName = zones?.find((zone: any) => zone.id === zoneId)?.name || 'Unknown';
              if (!groups.has(zoneId)) {
                groups.set(zoneId, { id: zoneId, label: zoneName, variants: [] });
              }
              groups.get(zoneId)!.variants.push(v);
            }
          }
          break;
        case 'AZ':
          for (const v of variants) {
            for (const a of v.availabilityZones || []) {
              const azId = a.availabilityZoneId;
              const azName = azs?.find((az: any) => az.id === azId)?.code || 'Unknown';
              if (!groups.has(azId)) {
                groups.set(azId, { id: azId, label: azName, variants: [] });
              }
              groups.get(azId)!.variants.push(v);
            }
          }
          break;
        case 'REGION':
          for (const v of variants) {
            const seenRegions = new Set<string>();
            for (const a of v.availabilityZones || []) {
              const azId = a.availabilityZoneId;
              const az = azs?.find((az: any) => az.id === azId);
              const region = az?.region || 'Unknown';
              if (seenRegions.has(region)) continue;
              seenRegions.add(region);
              if (!groups.has(region)) {
                groups.set(region, { id: region, label: region, variants: [] });
              }
              groups.get(region)!.variants.push(v);
            }
          }
          break;
        case 'COUNTRIES':
          for (const v of variants) {
            const seenCountries = new Set<string>();
            for (const a of v.availabilityZones || []) {
              const azId = a.availabilityZoneId;
              const az = azs?.find((az: any) => az.id === azId);
              const country = az?.country || 'Unknown';
              if (seenCountries.has(country)) continue;
              seenCountries.add(country);
              if (!groups.has(country)) {
                groups.set(country, { id: country, label: country, variants: [] });
              }
              groups.get(country)!.variants.push(v);
            }
          }
          break;
      }

      return groups;
    }

    function buildRows(
      rowIndex: number,
      parentLabels: MatrixRow['labels'],
      variants: ProductVariant[],
      product: any
    ): MatrixRow[] {
      if (rowIndex >= activeRowAxes.length) {
        // Leaf: compute cells
        const cells: Record<string, MatrixCell> = {};
        for (const col of columns) {
          let bestCell: MatrixCell = { status: 'NONE' };
          for (const v of variants) {
            const cell = computeCell(v, col, activeColAxes, zones, azs);
            if (statusRank[cell.status] > statusRank[bestCell.status]) {
              bestCell = cell;
            }
          }
          cells[col.id] = bestCell;
        }
        if (statusFilter) {
          const hasMatch = Object.values(cells).some((c) => c.status === statusFilter);
          if (!hasMatch) return [];
        }
        return [
          {
            id: parentLabels.map((l) => l.id).join('|'),
            labels: parentLabels,
            productId: parentLabels[0]?.id || 'unknown',
            cells,
          },
        ];
      }

      const axis = activeRowAxes[rowIndex];
      const groups = groupVariantsByAxis(variants, axis, product);
      const results: MatrixRow[] = [];

      for (const [_, group] of groups) {
        const label = { axis, label: group.label, id: group.id };
        const subRows = buildRows(rowIndex + 1, [...parentLabels, label], group.variants, product);
        results.push(...subRows);
      }

      return results;
    }

    for (const product of products) {
      if (!product.isActive) continue;
      if (categoryFilter && product.category?.name !== categoryFilter) continue;
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) continue;

      const variants = product.variants || [];
      const initialLabels: MatrixRow['labels'] = [];
      const startIndex = 0;

      const productRows = buildRows(startIndex, initialLabels, variants, product);
      matrixRows.push(...productRows);
    }

    return matrixRows;
  }, [products, columns, activeRowAxes, activeColAxes, search, categoryFilter, statusFilter, zones, azs]);

  /* Group rows by all labels except last */
  const groupedRows = useMemo(() => {
    const groups = new Map<string, MatrixRow[]>();
    for (const row of rows) {
      const groupKey = row.labels.slice(0, -1).map((l) => l.label).join(' / ') || 'All';
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey)!.push(row);
    }
    return groups;
  }, [rows]);

  /* Categories for filter */
  const categories = useMemo(() => {
    if (!products) return [];
    const cats = new Set<string>();
    for (const p of products) {
      if (p.category?.name) cats.add(p.category.name);
    }
    return Array.from(cats).sort();
  }, [products]);

  /* Sticky left offsets for flat mode row headers */
  const flatRowLefts = useMemo(() => {
    const lefts: number[] = [];
    let sum = 0;
    for (let i = 0; i < activeRowAxes.length; i++) {
      lefts.push(sum);
      sum += colWidths[`row-header-${i}`] || 140;
    }
    return lefts;
  }, [activeRowAxes, colWidths]);

  /* Loading state */
  const isLoading = productsLoading || zonesLoading || azsLoading;

  /* Error state */
  if (productsError) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <QueryError
          message="Unable to load catalog data."
          onRetry={() => refetchProducts()}
        />
      </div>
    );
  }

  /* Compute header rows for columns */
  const headerRows = useMemo(() => {
    if (activeColAxes.length === 0 || columns.length === 0) return [] as { level: number; groups: { label: string; count: number }[] }[];
    const rows: { level: number; groups: { label: string; count: number }[] }[] = [];

    for (let level = 0; level < activeColAxes.length - 1; level++) {
      const groups: { label: string; count: number }[] = [];
      let currentGroup = '';
      let count = 0;
      for (const col of columns) {
        const label = col.path[level]?.label || '';
        if (label !== currentGroup) {
          if (count > 0) groups.push({ label: currentGroup, count });
          currentGroup = label;
          count = 1;
        } else {
          count++;
        }
      }
      if (count > 0) groups.push({ label: currentGroup, count });
      rows.push({ level, groups });
    }

    return rows;
  }, [columns, activeColAxes]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 p-4 space-y-4">
      {/* Toolbar */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-medium text-slate-400">FILTERS</span>
          </div>

          <PickUpList
            options={[
              { value: '', label: 'All' },
              ...categories.map((c) => ({ value: c, label: c })),
            ]}
            value={categoryFilter}
            onChange={(v) => setCategoryFilter(v)}
          />

          <PickUpList
            options={[
              { value: '', label: 'All' },
              { value: 'AVAILABLE', label: 'Available' },
              { value: 'RESTRICTED', label: 'Restricted' },
              { value: 'ON_DEMAND', label: 'On Demand' },
              { value: 'UNAVAILABLE', label: 'Unavailable' },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v)}
          />

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              className="pl-8 bg-slate-950 border-slate-700 text-slate-300 text-xs h-8 w-48"
            />
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs">
            <span className="text-slate-500">Rows:</span>
            {rowAxes.map((axis, i) => (
              <div key={i} className="flex items-center gap-1">
                <PickUpList
                  options={[
                    { value: 'PRODUCT', label: 'Products' },
                    { value: 'FLAVOR', label: 'Flavors' },
                    { value: 'OS', label: 'OS' },
                    { value: 'ZONE', label: 'Zones' },
                    { value: 'AZ', label: 'AZs' },
                    { value: 'REGION', label: 'Regions' },
                    { value: 'COUNTRIES', label: 'Countries' },
                  ]}
                  value={axis}
                  onChange={(v) => {
                    const next = [...rowAxes];
                    next[i] = v as RowAxis;
                    setRowAxes(next);
                  }}
                  color="blue"
                />
                {rowAxes.length > 1 && (
                  <button
                    onClick={() => setRowAxes(rowAxes.filter((_, idx) => idx !== i))}
                    className="text-slate-500 hover:text-red-400 text-xs px-1"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {rowAxes.length < 3 && (
              <button
                onClick={() => setRowAxes([...rowAxes, 'FLAVOR'])}
                className="text-blue-400 hover:text-blue-300 text-xs border border-blue-500/30 rounded px-2 py-1"
              >
                + Row
              </button>
            )}
            <span className="text-slate-500 ml-2">Cols:</span>
            {colAxes.map((axis, i) => (
              <div key={i} className="flex items-center gap-1">
                <PickUpList
                  options={[
                    { value: 'PRODUCT', label: 'Products' },
                    { value: 'FLAVOR', label: 'Flavors' },
                    { value: 'OS', label: 'OS' },
                    { value: 'ZONE', label: 'Zones' },
                    { value: 'AZ', label: 'AZs' },
                    { value: 'REGION', label: 'Regions' },
                    { value: 'COUNTRIES', label: 'Countries' },
                  ]}
                  value={axis}
                  onChange={(v) => {
                    const next = [...colAxes];
                    next[i] = v as ColAxis;
                    setColAxes(next);
                  }}
                  color="purple"
                />
                {colAxes.length > 1 && (
                  <button
                    onClick={() => setColAxes(colAxes.filter((_, idx) => idx !== i))}
                    className="text-slate-500 hover:text-red-400 text-xs px-1"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {colAxes.length < 3 && (
              <button
                onClick={() => setColAxes([...colAxes, 'AZ'])}
                className="text-purple-400 hover:text-purple-300 text-xs border border-purple-500/30 rounded px-2 py-1"
              >
                + Col
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ml-4">
            <Button
              variant={viewMode === 'grouped' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setViewMode('grouped')}
              disabled={activeRowAxes.length <= 1}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1" />
              Grouped
            </Button>
            <Button
              variant={viewMode === 'flat' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-8"
              onClick={() => setViewMode('flat')}
            >
              <Table className="h-3.5 w-3.5 mr-1" />
              Flat
            </Button>
          </div>

          <div className="flex items-center gap-2 ml-4">
            <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showEmptyCols}
                onChange={(e) => setShowEmptyCols(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/20"
              />
              Show empty
            </label>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="text-xs h-8 ml-auto"
            onClick={() => {
              const csv = [
                ['Product', 'Flavor', ...columns.map((c) => c.path.map((p) => p.label).join(' / '))],
                ...rows.map((row) => [
                  row.labels[0]?.label || '',
                  row.labels[1]?.label || '',
                  ...columns.map((col) => row.cells[col.id]?.status || 'NONE'),
                ]),
              ]
                .map((row) => row.join(','))
                .join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = 'matrix.csv';
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Export
          </Button>
        </CardContent>
      </Card>

      {/* Matrix Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden flex flex-col">
        <CardContent className="p-0 flex flex-col flex-1 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 space-y-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-500">No products match your filters.</p>
            </div>
          ) : (
            <table className="w-full text-xs" style={{ width: '100%' }}>
              <thead>
                {/* Group header rows for multi-level columns */}
                {(viewMode === 'grouped' || (viewMode === 'flat' && activeColAxes.length > 1)) &&
                  columns.length > 0 &&
                  headerRows.map((headerRow, rowIdx) => (
                    <tr key={`header-${rowIdx}`} className="bg-slate-950">
                      {viewMode === 'grouped' ? (
                        <th
                          className="border-b border-r border-slate-800 sticky left-0 bg-slate-950 z-20 min-w-[180px]"
                          style={{ width: colWidths['row-header'] || 180 }}
                        ></th>
                      ) : (
                        activeRowAxes.map((_, i) => (
                          <th
                            key={i}
                            className="border-b border-r border-slate-800 sticky bg-slate-950 z-20"
                            style={{ left: flatRowLefts[i], width: colWidths[`row-header-${i}`] || 140 }}
                          ></th>
                        ))
                      )}
                      {headerRow.groups.map((g, i) => (
                        <th
                          key={i}
                          colSpan={g.count}
                          className="text-center p-2 text-purple-400 font-semibold border-b border-slate-800 border-r-2 border-r-slate-700"
                        >
                          {g.label}
                        </th>
                      ))}
                    </tr>
                  ))}
                {/* Column labels header row */}
                <tr className="bg-slate-950">
                  {viewMode === 'flat' &&
                    activeRowAxes.map((axis, i) => (
                      <th
                        key={i}
                        className="text-left p-3 text-blue-400 font-semibold border-b border-r border-slate-800 sticky bg-slate-950 z-20 min-w-[140px] relative"
                        style={{ left: flatRowLefts[i], width: colWidths[`row-header-${i}`] || 140 }}
                      >
                        {axis}
                        <div
                          className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-slate-600/40 hover:bg-blue-400 active:bg-blue-400 transition-colors"
                          title="Drag to resize"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            const th = e.currentTarget.parentElement;
                            if (th) startResize(`row-header-${i}`, e.clientX, th.getBoundingClientRect().width);
                          }}
                        />
                      </th>
                    ))}
                  {viewMode === 'grouped' && (
                    <th
                      className="text-left p-3 text-slate-500 font-semibold border-b border-r border-slate-800 sticky left-0 bg-slate-950 z-20 min-w-[180px] relative"
                      style={{ width: colWidths['row-header'] || 180 }}
                    >
                      {activeRowAxes.join(' / ')}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-slate-600/40 hover:bg-blue-400 active:bg-blue-400 transition-colors"
                        title="Drag to resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          if (th) startResize('row-header', e.clientX, th.getBoundingClientRect().width);
                        }}
                      />
                    </th>
                  )}
                  {columns.map((col) => (
                    <th
                      key={col.id}
                      className="text-center p-2 text-slate-400 font-medium border-b border-slate-800 min-w-[65px] relative"
                      style={{ width: colWidths[col.id] || undefined }}
                    >
                      {col.path[col.path.length - 1]?.label}
                      <div
                        className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize bg-slate-600/40 hover:bg-blue-400 active:bg-blue-400 transition-colors"
                        title="Drag to resize"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const th = e.currentTarget.parentElement;
                          if (th) startResize(col.id, e.clientX, th.getBoundingClientRect().width);
                        }}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {viewMode === 'grouped'
                  ? Array.from(groupedRows.entries()).map(([groupName, groupRows]) => (
                      <>
                        {/* Group header */}
                        <tr key={`group-${groupName}`} className="bg-slate-900/50">
                          <td
                            colSpan={columns.length + 1}
                            className="p-2.5 pl-4 text-sm font-bold text-blue-400 border-b border-slate-800"
                          >
                            <div className="flex items-center gap-2">
                              <ChevronDown className="h-3.5 w-3.5" />
                              {groupName}
                            </div>
                          </td>
                        </tr>
                        {/* Group rows */}
                        {groupRows.map((row) => (
                          <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                            <td className="p-3 pl-8 text-slate-300 sticky left-0 bg-slate-900 z-10 border-r border-slate-800">
                              {row.labels[row.labels.length - 1]?.label || ''}
                            </td>
                            {columns.map((col) => (
                              <td
                                key={col.id}
                                className="p-2 text-center border-r border-slate-800/50"
                                style={{ width: colWidths[col.id] || undefined }}
                              >
                                {getStatusBadge(row.cells[col.id]?.status, row.cells[col.id]?.releaseDate)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </>
                    ))
                  : rows.map((row) => (
                      <tr key={row.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        {row.labels.map((lab, i) => (
                          <td
                            key={i}
                            className="p-3 text-slate-300 font-medium sticky bg-slate-900 z-10 border-r border-slate-800"
                            style={{ left: flatRowLefts[i], width: colWidths[`row-header-${i}`] || 140 }}
                          >
                            {lab.label}
                          </td>
                        ))}
                        {columns.map((col) => (
                          <td
                            key={col.id}
                            className="p-2 text-center border-r border-slate-800/50"
                            style={{ width: colWidths[col.id] || undefined }}
                          >
                            {getStatusBadge(row.cells[col.id]?.status, row.cells[col.id]?.releaseDate)}
                          </td>
                        ))}
                      </tr>
                    ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400" /> Available (Live)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" /> Restricted (+ date)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-400" /> On Demand
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-400" /> Unavailable
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-slate-700" /> No data (-)
        </span>
      </div>
    </div>
  );
}

/* ── Cell computation ──────────────────────────────────────────── */

function computeCell(
  variant: ProductVariant,
  col: Column,
  colAxes: ColAxis[],
  zones?: any[],
  azs?: AvailabilityZone[]
): MatrixCell {
  for (let i = 0; i < colAxes.length; i++) {
    const axis = colAxes[i];
    const segment = col.path[i];
    if (!segment || !matchesAxis(variant, axis, segment.id, zones, azs)) {
      return { status: 'NONE' };
    }
  }
  return {
    status: getStatusFromVariant(variant),
    releaseDate: variant.availabilityType === 'RESTRICTED' ? formatReleaseDate(variant.osVersion?.releaseDate) : undefined,
    variantName: variant.name,
  };
}
