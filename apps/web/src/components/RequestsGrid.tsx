import { useMemo, useState } from 'react';
import type { Forecast } from '@cloudmarket/shared-types';
import { ForecastStatus } from '@cloudmarket/shared-types';
import { useAvailabilityZones } from '@/hooks/useApi';
import { STATUS_BADGE } from '@/components/LifecycleStepper';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Search,
  Columns3,
  ChevronUp,
  ChevronDown,
  ArrowRight,
  Table2,
  Sheet,
  Download,
} from 'lucide-react';

const formatCost = (cost: number | null | undefined, currency = 'EUR') => {
  if (cost == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cost);
};

const shortId = (id: string) => `FC-${id.slice(0, 4).toUpperCase()}`;
const fmtDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

type Line = NonNullable<Forecast['lines']>[number];

/** A grid row = a forecast, optionally exploded to one of its lines. */
interface Row {
  f: Forecast;
  line?: Line;
}

type ViewMode = 'standard' | 'excel';

/* ---------- Column model ---------- */

interface ColumnDef {
  key: string;
  label: string;
  /** Line-level column: value comes from the exploded forecast line. */
  lineLevel?: boolean;
  width?: string;
  numeric?: boolean;
  render: (row: Row) => React.ReactNode;
  sortValue: (row: Row) => string | number;
}

/** Plain-text cell value used for Excel export (mirrors render()). */
function cellText(c: ColumnDef, row: Row, zoneByCode: Map<string, { region: string; country: string }>): string | number {
  const { f, line } = row;
  switch (c.key) {
    case 'ref': return shortId(f.id);
    case 'requestedBy': return f.requestedBy ?? '';
    case 'status': return STATUS_BADGE[f.status]?.label ?? f.status;
    case 'environment': return f.environment;
    case 'application': return f.application?.name ?? '';
    case 'product': return line?.product?.name ?? '';
    case 'flavor': return line ? `${line.flavor?.name ?? ''} (${line.flavor?.vcpu ?? 0}c/${line.flavor?.ramGb ?? 0}G)` : '';
    case 'az': return line?.azCode ?? '';
    case 'region': return line ? zoneByCode.get(line.azCode)?.region ?? '' : '';
    case 'country': return line ? zoneByCode.get(line.azCode)?.country ?? '' : '';
    case 'quantity': return line?.quantity ?? '';
    case 'lines': return f.lines?.length ?? 0;
    case 'cost': return f.estimatedCost ?? '';
    case 'targetDate': return f.targetDate ? f.targetDate.split('T')[0] : '';
    case 'createdAt': return f.createdAt ? f.createdAt.split('T')[0] : '';
    case 'reviewedBy': return f.reviewedBy ?? '';
    default: return '';
  }
}

/** Build a SpreadsheetML 2003 workbook (opens natively in Excel / LibreOffice). */
function buildExcelXml(
  sheets: { name: string; headers: string[]; rows: (string | number)[][] }[]
): string {
  const esc = (v: string | number) =>
    String(v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  const sheetXml = sheets.map((s) => `
  <Worksheet ss:Name="${esc(s.name).slice(0, 31)}">
    <Table>
      <Row>${s.headers.map((h) => `<Cell ss:StyleID="hdr"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('')}</Row>
      ${s.rows
        .map(
          (r) =>
            `<Row>${r
              .map((v) =>
                typeof v === 'number'
                  ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
                  : `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`
              )
              .join('')}</Row>`
        )
        .join('\n      ')}
    </Table>
  </Worksheet>`)
    .join('\n');
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="hdr"><Font ss:Bold="1"/><Interior ss:Color="#DDEBF7" ss:Pattern="Solid"/></Style>
 </Styles>
${sheetXml}
</Workbook>`;
}

function downloadExcel(rows: Row[], cols: ColumnDef[], zoneByCode: Map<string, { region: string; country: string }>) {
  const xml = buildExcelXml([
    {
      name: 'Requests',
      headers: cols.map((c) => c.label),
      rows: rows.map((r) => cols.map((c) => cellText(c, r, zoneByCode))),
    },
  ]);
  const blob = new Blob(['\ufeff' + xml], { type: 'application/vnd.ms-excel;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `forecast-requests-${new Date().toISOString().split('T')[0]}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

const colLetter = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : `A${String.fromCharCode(65 + i - 26)}`);

function makeColumns(zoneByCode: Map<string, { region: string; country: string }>): ColumnDef[] {
  return [
    {
      key: 'ref',
      label: 'Ref',
      width: '90px',
      render: ({ f }) => <span className="font-mono text-xs text-blue-400">{shortId(f.id)}</span>,
      sortValue: ({ f }) => f.id,
    },
    {
      key: 'requestedBy',
      label: 'Requested by',
      render: ({ f }) => (
        <div>
          <div className="text-slate-200">{f.requestedBy}</div>
          <div className="text-xs text-slate-500">{f.requesterEmail}</div>
        </div>
      ),
      sortValue: ({ f }) => f.requestedBy?.toLowerCase() ?? '',
    },
    {
      key: 'status',
      label: 'Status',
      width: '110px',
      render: ({ f }) => (
        <Badge variant="outline" className={STATUS_BADGE[f.status]?.color}>
          {STATUS_BADGE[f.status]?.label ?? f.status}
        </Badge>
      ),
      sortValue: ({ f }) => f.status,
    },
    {
      key: 'environment',
      label: 'Env',
      width: '60px',
      render: ({ f }) => <span className="text-slate-400">{f.environment}</span>,
      sortValue: ({ f }) => f.environment,
    },
    {
      key: 'application',
      label: 'Application',
      render: ({ f }) => <span className="text-slate-300">{f.application?.name || '—'}</span>,
      sortValue: ({ f }) => f.application?.name ?? '',
    },
    {
      key: 'product',
      label: 'Product',
      lineLevel: true,
      render: ({ line }) => <span className="text-slate-200">{line?.product?.name ?? '—'}</span>,
      sortValue: ({ line }) => line?.product?.name ?? '',
    },
    {
      key: 'flavor',
      label: 'Flavor',
      lineLevel: true,
      render: ({ line }) => (
        <span className="text-slate-400">
          {line?.flavor?.name ?? '—'}
          {line?.flavor && <span className="text-slate-600"> ({line.flavor.vcpu}c/{line.flavor.ramGb}G)</span>}
        </span>
      ),
      sortValue: ({ line }) => line?.flavor?.name ?? '',
    },
    {
      key: 'az',
      label: 'AZ',
      lineLevel: true,
      width: '100px',
      render: ({ line }) => <span className="font-mono text-xs text-slate-300">{line?.azCode ?? '—'}</span>,
      sortValue: ({ line }) => line?.azCode ?? '',
    },
    {
      key: 'region',
      label: 'Region',
      lineLevel: true,
      width: '100px',
      render: ({ line }) => (
        <span className="text-slate-400">{line ? zoneByCode.get(line.azCode)?.region ?? '—' : '—'}</span>
      ),
      sortValue: ({ line }) => (line ? zoneByCode.get(line.azCode)?.region ?? '' : ''),
    },
    {
      key: 'country',
      label: 'Country',
      lineLevel: true,
      width: '90px',
      render: ({ line }) => (
        <span className="text-slate-400">{line ? zoneByCode.get(line.azCode)?.country ?? '—' : '—'}</span>
      ),
      sortValue: ({ line }) => (line ? zoneByCode.get(line.azCode)?.country ?? '' : ''),
    },
    {
      key: 'quantity',
      label: 'Qty',
      lineLevel: true,
      width: '55px',
      numeric: true,
      render: ({ line }) => <span className="font-mono text-xs text-slate-300">{line?.quantity ?? '—'}</span>,
      sortValue: ({ line }) => line?.quantity ?? 0,
    },
    {
      key: 'lines',
      label: 'Lines',
      width: '55px',
      numeric: true,
      render: ({ f }) => <span className="text-slate-400">{f.lines?.length ?? 0}</span>,
      sortValue: ({ f }) => f.lines?.length ?? 0,
    },
    {
      key: 'cost',
      label: 'Est. cost',
      width: '100px',
      numeric: true,
      render: ({ f }) => <span className="font-mono text-xs text-slate-300">{formatCost(f.estimatedCost, f.costCurrency)}</span>,
      sortValue: ({ f }) => f.estimatedCost ?? 0,
    },
    {
      key: 'targetDate',
      label: 'Target date',
      width: '100px',
      render: ({ f }) => <span className="text-slate-400">{fmtDate(f.targetDate)}</span>,
      sortValue: ({ f }) => f.targetDate ?? '',
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '100px',
      render: ({ f }) => <span className="text-slate-400">{fmtDate(f.createdAt)}</span>,
      sortValue: ({ f }) => f.createdAt,
    },
    {
      key: 'reviewedBy',
      label: 'Reviewed by',
      render: ({ f }) => <span className="text-slate-400">{f.reviewedBy || '—'}</span>,
      sortValue: ({ f }) => f.reviewedBy ?? '',
    },
  ];
}

const DEFAULT_VISIBLE = [
  'ref', 'requestedBy', 'status', 'environment', 'application',
  'product', 'az', 'region', 'quantity', 'cost', 'targetDate', 'createdAt',
];

const STATUS_FILTERS: { value: ForecastStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'All statuses' },
  { value: ForecastStatus.DRAFT, label: 'Draft' },
  { value: ForecastStatus.PENDING_TECH, label: 'Tech review' },
  { value: ForecastStatus.PENDING_MANAGER, label: 'Manager approval' },
  { value: ForecastStatus.PENDING_BUDGET, label: 'Budget validation' },
  { value: ForecastStatus.APPROVED, label: 'Approved' },
  { value: ForecastStatus.REJECTED, label: 'Rejected' },
  { value: ForecastStatus.CANCELLED, label: 'Cancelled' },
];

const PAGE_SIZES = [25, 50, 100];

const lineValue = (l: Line, key: string, zoneByCode: Map<string, { region: string; country: string }>): string | number => {
  switch (key) {
    case 'product': return l.product?.name ?? '';
    case 'flavor': return l.flavor?.name ?? '';
    case 'az': return l.azCode ?? '';
    case 'region': return zoneByCode.get(l.azCode)?.region ?? '';
    case 'country': return zoneByCode.get(l.azCode)?.country ?? '';
    case 'quantity': return l.quantity ?? 0;
    default: return '';
  }
};

export default function RequestsGrid({
  forecasts,
  onOpen,
}: {
  forecasts: Forecast[];
  onOpen: (f: Forecast) => void;
}) {
  const { data: zones } = useAvailabilityZones();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ForecastStatus | 'ALL'>('ALL');
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(DEFAULT_VISIBLE));
  const [colsOpen, setColsOpen] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const zoneByCode = useMemo(
    () => new Map((zones ?? []).map((z) => [z.code, { region: z.region, country: z.country }])),
    [zones]
  );
  const COLUMNS = useMemo(() => makeColumns(zoneByCode), [zoneByCode]);

  const isExcel = viewMode === 'excel';

  /* Explode forecasts into rows when line-level columns are selected.
     Dedup: one row per unique tuple of the VISIBLE line-level values. */
  const rows = useMemo<Row[]>(() => {
    const lineKeys = COLUMNS.filter((c) => c.lineLevel && visibleCols.has(c.key)).map((c) => c.key);
    const out: Row[] = [];
    for (const f of forecasts) {
      const lines = f.lines ?? [];
      if (lineKeys.length === 0 || lines.length === 0) {
        out.push({ f });
        continue;
      }
      const seen = new Set<string>();
      for (const l of lines) {
        const key = lineKeys.map((k) => String(lineValue(l, k, zoneByCode))).join('\u0000');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ f, line: l });
      }
    }
    return out;
  }, [forecasts, COLUMNS, visibleCols, zoneByCode]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = rows.filter(({ f, line }) => {
      if (statusFilter !== 'ALL' && f.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        f.id,
        f.requestedBy,
        f.requesterEmail,
        f.application?.name,
        f.reviewedBy,
        line?.product?.name,
        line?.flavor?.name,
        line?.azCode,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });

    if (sortKey) {
      const col = COLUMNS.find((c) => c.key === sortKey);
      if (col) {
        list = [...list].sort((a, b) => {
          const av = col.sortValue(a);
          const bv = col.sortValue(b);
          const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
          return sortDir === 'asc' ? cmp : -cmp;
        });
      }
    }
    return list;
  }, [rows, search, statusFilter, sortKey, sortDir, COLUMNS]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const shownCols = COLUMNS.filter((c) => visibleCols.has(c.key));

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const toggleCol = (key: string) => {
    setVisibleCols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setPage(1);
  };

  /* ---------- Shared cell pieces ---------- */

  const sortIcon = (c: ColumnDef) =>
    sortKey === c.key ? (
      sortDir === 'asc' ? <ChevronUp className="h-3 w-3 text-blue-400" /> : <ChevronDown className="h-3 w-3 text-blue-400" />
    ) : null;

  const headerCellClass = isExcel
    ? 'border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-300'
    : 'px-3 py-2.5 text-xs font-semibold text-slate-400';

  const dataCellClass = (c: ColumnDef) =>
    isExcel
      ? `border border-slate-800 px-2 py-1 text-xs ${c.numeric ? 'text-right font-mono' : ''}`
      : 'px-3 py-2.5';

  const lettersHeaderRow = isExcel ? (
    <tr>
      <th className={`${headerCellClass} w-10 text-center text-slate-500`} />
      {shownCols.map((_, i) => (
        <th key={i} className={`${headerCellClass} text-center font-mono text-[10px] text-slate-500`}>
          {colLetter(i)}
        </th>
      ))}
      <th className={headerCellClass} />
    </tr>
  ) : null;

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            placeholder="Search in all columns…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-600"
          />
        </div>

        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as ForecastStatus | 'ALL');
            setPage(1);
          }}
          className="w-44 bg-slate-950 border-slate-700 text-white"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </Select>

        {/* Export Excel */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => downloadExcel(filtered, shownCols, zoneByCode)}
          title="Export the filtered rows to Excel"
          className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          <Download className="mr-2 h-4 w-4" />
          Export Excel
        </Button>

        {/* View mode toggle */}
        <div className="flex overflow-hidden rounded-lg border border-slate-700" style={{ width: 'fit-content' }}>
          <button
            onClick={() => setViewMode('standard')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              viewMode === 'standard' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Table2 className="h-3.5 w-3.5" />
            Standard
          </button>
          <button
            onClick={() => setViewMode('excel')}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
              viewMode === 'excel' ? 'bg-blue-600 text-white' : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            <Sheet className="h-3.5 w-3.5" />
            Excel
          </button>
        </div>

        {/* Column picker */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setColsOpen((o) => !o)}
            className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            <Columns3 className="mr-2 h-4 w-4" />
            Columns ({visibleCols.size})
          </Button>
          {colsOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setColsOpen(false)} />
              <div className="absolute left-0 top-full z-40 mt-1 w-60 rounded-xl border border-slate-600 bg-slate-800 py-2 shadow-2xl">
                <div className="mb-1 flex items-center justify-between px-3">
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">Columns</span>
                  <button
                    className="text-[11px] text-blue-400 hover:text-blue-300"
                    onClick={() => setVisibleCols(new Set(DEFAULT_VISIBLE))}
                  >
                    Reset
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {COLUMNS.map((c) => (
                    <label
                      key={c.key}
                      className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-700/50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.has(c.key)}
                        onChange={() => toggleCol(c.key)}
                        className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-950"
                      />
                      {c.label}
                      {c.lineLevel && (
                        <span className="ml-auto rounded bg-slate-700 px-1 text-[10px] text-slate-400">line</span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="mt-1 border-t border-slate-700 px-3 pt-2 text-[10px] leading-snug text-slate-500">
                  Selecting a "line" column expands each request into one row per unique value (deduplicated).
                </p>
              </div>
            </>
          )}
        </div>

        <div className="ml-auto text-xs text-slate-500">
          {filtered.length} row{filtered.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Grid */}
      <div className={isExcel ? 'overflow-x-auto border border-slate-700' : 'overflow-x-auto rounded-lg border border-slate-800'}>
        <table className={`w-full min-w-[900px] ${isExcel ? 'border-collapse text-xs' : 'text-sm'}`}>
          <thead>
            {lettersHeaderRow}
            <tr className={isExcel ? '' : 'border-b border-slate-800 bg-slate-900 text-left'}>
              {isExcel && <th className={`${headerCellClass} w-10 text-center text-slate-500`} />}
              {shownCols.map((c) => (
                <th
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                  className={`${headerCellClass} cursor-pointer select-none hover:text-slate-100`}
                  onClick={() => toggleSort(c.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {c.label}
                    {sortIcon(c)}
                  </span>
                </th>
              ))}
              <th className={headerCellClass} />
            </tr>
          </thead>
          <tbody className={isExcel ? '' : 'divide-y divide-slate-800/60'}>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={shownCols.length + (isExcel ? 2 : 1)} className={`px-3 text-center text-slate-500 ${isExcel ? 'py-8' : 'py-10'}`}>
                  No request matches the current filters.
                </td>
              </tr>
            ) : (
              pageRows.map((row, idx) => (
                <tr
                  key={`${row.f.id}-${row.line?.id ?? 'root'}-${idx}`}
                  className={isExcel ? 'bg-slate-950/40 hover:bg-slate-900' : 'bg-slate-950/40 transition-colors hover:bg-slate-900/60'}
                >
                  {isExcel && (
                    <td className="border border-slate-800 bg-slate-900 px-1 py-1 text-center font-mono text-[10px] text-slate-600">
                      {(safePage - 1) * pageSize + idx + 1}
                    </td>
                  )}
                  {shownCols.map((c) => (
                    <td key={c.key} className={dataCellClass(c)}>{c.render(row)}</td>
                  ))}
                  <td className={dataCellClass(COLUMNS[0]) + ' text-right'}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpen(row.f)}
                      title="Open detail"
                      className={isExcel ? 'h-5 w-5 p-0 text-slate-600 hover:bg-slate-800 hover:text-blue-400' : 'h-7 w-7 p-0 text-slate-500 hover:bg-slate-800 hover:text-blue-400'}
                    >
                      <ArrowRight className={isExcel ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span>Rows per page</span>
          <Select
            value={String(pageSize)}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(1);
            }}
            className="h-8 w-20 bg-slate-950 border-slate-700 text-white text-xs"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="h-7 border-slate-700 bg-slate-950 px-2 text-slate-300 disabled:opacity-40"
          >
            ←
          </Button>
          <span className="px-2">Page {safePage} / {totalPages}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="h-7 border-slate-700 bg-slate-950 px-2 text-slate-300 disabled:opacity-40"
          >
            →
          </Button>
        </div>
      </div>
    </div>
  );
}
