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
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
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

/* ── Component ─────────────────────────────────────────────────── */

export default function MarketplaceMatrix() {
  /* Data hooks */
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } = useProducts();
  const { data: zones, isLoading: zonesLoading } = useZones();
  const { data: azs, isLoading: azsLoading } = useAvailabilityZones();

  /* UI state */
  const [viewMode, setViewMode] = useState<ViewMode>('grouped');
  const [rowAxes, setRowAxes] = useState<RowAxis[]>(['PRODUCT', 'FLAVOR']);
  const [colAxes, setColAxes] = useState<ColAxis[]>(['ZONE', 'AZ']);
  const row1 = rowAxes[0] || 'NONE';
  const row2 = rowAxes[1] || 'NONE';
  const col1 = colAxes[0] || 'NONE';
  const col2 = colAxes[1] || 'NONE';
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  /* Column widths for resizing */
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [showEmptyCols, setShowEmptyCols] = useState(false);
  const resizeRef = useRef<{ move: (e: MouseEvent) => void; up: () => void } | null>(null);

  useEffect(() => {
    if (viewMode === 'grouped' && rowAxes.filter((r) => r !== 'NONE').length <= 1) {
      setViewMode('flat');
    }
  }, [rowAxes, viewMode]);

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
    const cols: { id: string; label: string; group?: string }[] = [];
    const c1 = colAxes[0];
    const c2 = colAxes[1];
    if (!c1 || c1 === 'NONE') return cols;
    if (c1 === 'ZONE' && zones) {
      if (c2 === 'REGION' || c2 === 'COUNTRIES') {
        const seen = new Set<string>();
        for (const z of zones) {
          for (const za of z.availabilityZones || []) {
            const r = (c2 === 'COUNTRIES' ? za.availabilityZone.country : za.availabilityZone.region) || 'Unknown';
            if (!seen.has(r)) {
              seen.add(r);
              cols.push({ id: r, label: r });
            }
          }
        }
      } else {
        for (const z of zones) {
          if (c2 === 'AZ') {
            for (const za of z.availabilityZones || []) {
              const a = za.availabilityZone;
              cols.push({ id: `${z.id}|${a.id}`, label: a.code, group: z.name });
            }
          } else {
            cols.push({ id: z.id, label: z.name });
          }
        }
      }
    } else if (c1 === 'AZ' && zones) {
      if (c2 === 'ZONE') {
        if (showEmptyCols && azs) {
          const azToZone = new Map<string, string>();
          for (const z of zones) {
            for (const za of z.availabilityZones || []) {
              azToZone.set(za.availabilityZone.id, z.name);
            }
          }
          for (const a of azs) {
            cols.push({ id: a.id, label: azToZone.get(a.id) || '-', group: a.code });
          }
        } else {
          for (const z of zones) {
            for (const za of z.availabilityZones || []) {
              const a = za.availabilityZone;
              cols.push({ id: `${z.id}|${a.id}`, label: z.name, group: a.code });
            }
          }
        }
      } else if (c2 === 'REGION' || c2 === 'COUNTRIES') {
        const regionAzs = new Map<string, AvailabilityZone[]>();
        for (const z of zones) {
          for (const za of z.availabilityZones || []) {
            const r = (c2 === 'COUNTRIES' ? za.availabilityZone.country : za.availabilityZone.region) || 'Unknown';
            if (!regionAzs.has(r)) regionAzs.set(r, []);
            regionAzs.get(r)!.push(za.availabilityZone);
          }
        }
        for (const [region, azList] of regionAzs) {
          for (const a of azList) {
            cols.push({ id: `${region}|${a.id}`, label: a.code, group: region });
          }
        }
      } else {
        for (const a of azs || []) {
          cols.push({ id: a.id, label: a.code });
        }
      }
    } else if ((c1 === 'REGION' || c1 === 'COUNTRIES') && zones) {
      const seen = new Set<string>();
      for (const z of zones) {
        for (const za of z.availabilityZones || []) {
          const r = (c1 === 'COUNTRIES' ? za.availabilityZone.country : za.availabilityZone.region) || 'Unknown';
          if (!seen.has(r)) {
            seen.add(r);
            cols.push({ id: r, label: r });
          }
        }
      }
    }
    return cols;
  }, [zones, azs, colAxes, showEmptyCols]);

  /* Build matrix rows */
  const rows = useMemo(() => {
    if (!products) return [];
    const matrixRows: MatrixRow[] = [];

    for (const product of products) {
      if (!product.isActive) continue;
      if (categoryFilter && product.category?.name !== categoryFilter) continue;
      if (search && !product.name.toLowerCase().includes(search.toLowerCase())) continue;

      const variants = product.variants || [];
      if (row2 === 'FLAVOR') {
        for (const variant of variants) {
          if (!variant.isActive) continue;
          const row: MatrixRow = {
            id: `${product.id}|${variant.id}`,
            labels: [
              { axis: row1, label: product.name, id: product.id },
              { axis: 'FLAVOR', label: variant.flavor?.name || variant.name, id: variant.id },
            ],
            productId: product.id,
            cells: {},
          };
          for (const col of columns) {
            const cell = computeCell(variant, col, col1, col2);
            if (statusFilter && cell.status !== statusFilter) continue;
            row.cells[col.id] = cell;
          }
          matrixRows.push(row);
        }
      } else if (row2 === 'OS') {
        const byOS = new Map<string, ProductVariant[]>();
        for (const v of variants) {
          const osName = v.os?.name || 'Unknown';
          if (!byOS.has(osName)) byOS.set(osName, []);
          byOS.get(osName)!.push(v);
        }
        for (const [osName, osVariants] of byOS) {
          const row: MatrixRow = {
            id: `${product.id}|${osName}`,
            labels: [
              { axis: row1, label: product.name, id: product.id },
              { axis: 'OS', label: osName, id: osName },
            ],
            productId: product.id,
            cells: {},
          };
          for (const col of columns) {
            let bestCell: MatrixCell = { status: 'NONE' };
            for (const v of osVariants) {
              const cell = computeCell(v, col, col1, col2);
              if (({ AVAILABLE: 4, RESTRICTED: 3, ON_DEMAND: 2, UNAVAILABLE: 1, NONE: 0 } as const)[cell.status] > ({ AVAILABLE: 4, RESTRICTED: 3, ON_DEMAND: 2, UNAVAILABLE: 1, NONE: 0 } as const)[bestCell.status]) {
                bestCell = cell;
              }
            }
            row.cells[col.id] = bestCell;
          }
          matrixRows.push(row);
        }
      } else {
        // Row2 = NONE → aggregate at product level
        const row: MatrixRow = {
          id: product.id,
          labels: [
            { axis: row1, label: product.name, id: product.id },
          ],
          productId: product.id,
          cells: {},
        };
        for (const col of columns) {
          let bestCell: MatrixCell = { status: 'NONE' };
          for (const v of variants) {
            const cell = computeCell(v, col, col1, col2);
            if (({ AVAILABLE: 4, RESTRICTED: 3, ON_DEMAND: 2, UNAVAILABLE: 1, NONE: 0 } as const)[cell.status] > ({ AVAILABLE: 4, RESTRICTED: 3, ON_DEMAND: 2, UNAVAILABLE: 1, NONE: 0 } as const)[bestCell.status]) {
              bestCell = cell;
            }
          }
          row.cells[col.id] = bestCell;
        }
        matrixRows.push(row);
      }
    }
    return matrixRows;
  }, [products, columns, row2, search, categoryFilter, statusFilter]);

  /* Group rows by row1 for grouped view */
  const groupedRows = useMemo(() => {
    const groups = new Map<string, MatrixRow[]>();
    for (const row of rows) {
      if (!groups.has(row.labels[0]?.label)) groups.set(row.labels[0]?.label, []);
      groups.get(row.labels[0]?.label)!.push(row);
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

  /* Loading & error */
  const isLoading = productsLoading || zonesLoading || azsLoading;
  if (productsError) return <QueryError message="Unable to load catalog data." onRetry={refetchProducts} />;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white">Availability Matrix</h1>
          <p className="mt-1 text-slate-400">Multi-dimensional catalog view — see what's available where</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode('grouped')}
              disabled={rowAxes.filter((r) => r !== 'NONE').length <= 1}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                viewMode === 'grouped' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              } ${rowAxes.filter((r) => r !== 'NONE').length <= 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              <Table className="h-3.5 w-3.5" /> Grouped
            </button>
            <button
              onClick={() => setViewMode('flat')}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors border-l border-slate-800 ${
                viewMode === 'flat' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" /> Flat
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showEmptyCols}
              onChange={(e) => setShowEmptyCols(e.target.checked)}
              className="rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500"
            />
            Show empty
          </label>
          <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </div>

      {/* Filters & Axes */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold uppercase tracking-wider">Filters</span>
            </div>
            <PickUpList
              options={[{ value: '', label: 'All' }, ...categories.map((c) => ({ value: c, label: c }))]}
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v)}
              color="slate"
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
              color="slate"
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
          </div>
        </CardContent>
      </Card>

      {/* Matrix Table */}
      <Card className="bg-slate-900 border-slate-800 overflow-hidden">
        <CardContent className="p-0">
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
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <thead>
                  {/* Col 1 headers (groups) */}
                  {viewMode === 'grouped' && columns.length > 0 && (
                    <tr className="bg-slate-950">
                      <th className="border-b border-r border-slate-800 sticky left-0 bg-slate-950 z-20 min-w-[160px]"></th>
                      {(() => {
                        const groups: { label: string; count: number }[] = [];
                        let currentGroup = '';
                        let count = 0;
                        for (const col of columns) {
                          if (col.group !== currentGroup) {
                            if (count > 0) groups.push({ label: currentGroup, count });
                            currentGroup = col.group || '';
                            count = 1;
                          } else {
                            count++;
                          }
                        }
                        if (count > 0) groups.push({ label: currentGroup, count });
                        if (groups.length === 0) {
                          return (
                            <th colSpan={columns.length} className="text-center text-xs text-red-400 border-b border-slate-800">
                              No groups
                            </th>
                          );
                        }
                        return groups.map((g, i) => (
                          <th
                            key={i}
                            colSpan={g.count}
                            className="text-center p-2 text-purple-400 font-semibold border-b border-slate-800 border-r-2 border-r-slate-700"
                          >
                            {g.label}
                          </th>
                        ));
                      })()}
                    </tr>
                  )}
                  {/* Col 2 headers (actual columns) */}
                  <tr className="bg-slate-950">
                    {viewMode === 'flat' && rowAxes.filter((r) => r !== 'NONE').map((axis, i) => (
                      <th
                        key={i}
                        className="text-left p-3 text-blue-400 font-semibold border-b border-r border-slate-800 sticky bg-slate-950 z-20 min-w-[140px]"
                        style={{ left: i === 0 ? 0 : 140 * i }}
                      >
                        {axis}
                      </th>
                    ))}
                    {viewMode === 'grouped' && (
                      <th className="text-left p-3 text-slate-500 font-semibold border-b border-r border-slate-800 sticky left-0 bg-slate-950 z-20 min-w-[160px]">
                        {row2 !== 'NONE' ? `${row1} / ${row2}` : row1}
                      </th>
                    )}
                    {columns.map((col) => (
                      <th
                        key={col.id}
                        className="text-center p-2 text-slate-400 font-medium border-b border-slate-800 min-w-[65px] relative"
                        style={{ width: colWidths[col.id] || 90 }}
                      >
                        {viewMode === 'flat' && col.group ? col.group : col.label}
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
                              colSpan={columns.length + 2}
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
                                <td key={col.id} className="p-2 text-center border-r border-slate-800/50" style={{ width: colWidths[col.id] || 90 }}>
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
                              className={`p-3 text-slate-300 font-medium sticky bg-slate-900 z-10 border-r border-slate-800 ${i === 0 ? 'left-0' : ''}`}
                              style={{ left: i * 140, width: i === 0 ? 140 : 140 }}
                            >
                              {lab.label}
                            </td>
                          ))}
                          {columns.map((col) => (
                            <td key={col.id} className="p-2 text-center border-r border-slate-800/50" style={{ width: colWidths[col.id] || 90 }}>
                              {getStatusBadge(row.cells[col.id]?.status, row.cells[col.id]?.releaseDate)}
                            </td>
                          ))}
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-6 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Available (Live)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" /> Restricted (+ date)</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400" /> On Demand</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" /> Unavailable</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-slate-700" /> No data (-)</span>
      </div>
    </div>
  );
}

/* ── Cell computation ──────────────────────────────────────────── */

function computeCell(
  variant: ProductVariant,
  col: { id: string; label: string; group?: string },
  col1: ColAxis,
  col2: ColAxis
): MatrixCell {
  if (col2 === 'AZ' && col1 === 'ZONE') {
    // col.id = "zoneId|azId"
    const [zoneId, azId] = col.id.split('|');
    const inZone = variant.zones?.some((z: any) => z.zoneId === zoneId || z.id === zoneId);
    const inAZ = variant.availabilityZones?.some((a: any) => a.availabilityZoneId === azId || a.id === azId);
    if (inZone && inAZ) {
      return {
        status: getStatusFromVariant(variant),
        releaseDate: variant.availabilityType === 'RESTRICTED' ? formatReleaseDate(variant.osVersion?.releaseDate) : undefined,
        variantName: variant.name,
      };
    }
    return { status: 'NONE' };
  }

  if (col1 === 'ZONE') {
    const inZone = variant.zones?.some((z: any) => z.zoneId === col.id || z.id === col.id);
    if (inZone) {
      return {
        status: getStatusFromVariant(variant),
        releaseDate: variant.availabilityType === 'RESTRICTED' ? formatReleaseDate(variant.osVersion?.releaseDate) : undefined,
        variantName: variant.name,
      };
    }
    return { status: 'NONE' };
  }

  if (col1 === 'AZ') {
    const inAZ = variant.availabilityZones?.some((a: any) => a.availabilityZoneId === col.id || a.id === col.id);
    if (inAZ) {
      return {
        status: getStatusFromVariant(variant),
        releaseDate: variant.availabilityType === 'RESTRICTED' ? formatReleaseDate(variant.osVersion?.releaseDate) : undefined,
        variantName: variant.name,
      };
    }
    return { status: 'NONE' };
  }

  return { status: 'NONE' };
}
