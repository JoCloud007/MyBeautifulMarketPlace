/**
 * CompatibilityMatrix — matrix DESIGNER (redesign 2026-10-28).
 *
 * The client rejected the read-only matrix + select controls. This page is a
 * visual designer: a product tray to drag onto "rows" and "columns" shelves
 * (N products each, keyboard/button fallback included), a live calculated
 * matrix below (one matrix API call per row product, stacked), and a cell
 * panel that reads the motivating rules as sentences ("When the stack is X
 * in versions ≥ 17, it requires the component Y …") and can create a new
 * rule pre-filled from the clicked cell.
 *
 * Client vocabulary: Stack (rule source) / Composant (rule target) /
 * requires (REQUIRES) / forbids (FORBIDS) / Blocking (HARD) / Warning (SOFT).
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';
import { useProducts, useOperatingSystems } from '@/hooks/useApi';
import {
  useCompatibilityMatrixGrid,
  type CompatibilityVerdict,
  type MatrixAxisGroup,
  type MatrixCellResult,
} from '@/hooks/useCompatibility';
import {
  useCreateCompatibilityRule,
  useUpdateCompatibilityRule,
} from '@/hooks/useCompatibilityAdmin';
import CompatibilityRuleModal, {
  RuleSentenceText,
  type ProductOption,
  type RuleFormValues,
} from '@/components/CompatibilityRuleModal';
import { useToastStore } from '@/stores/useToastStore';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  GripVertical,
  Plus,
  X,
  RotateCcw,
  Save,
  ArrowRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Verdict visuals — four states (a cell without any rule is NOT "valid")
// ---------------------------------------------------------------------------

const VERDICT_CELL: Record<
  CompatibilityVerdict,
  { icon: typeof CheckCircle; glyph: string; label: string; className: string }
> = {
  VALID: {
    icon: CheckCircle,
    glyph: '✓',
    label: 'Valid',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  },
  WARNING: {
    icon: AlertTriangle,
    glyph: '!',
    label: 'Warning',
    className: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
  },
  BLOCKED: {
    icon: XCircle,
    glyph: '✗',
    label: 'Blocked',
    className: 'bg-red-500/20 text-red-300 border-red-400/40',
  },
};

const NO_RULE = {
  glyph: '—',
  label: 'No rule',
  className: 'bg-slate-900 text-slate-600 border-dashed border-slate-800',
};

function cellState(cell: MatrixCellResult | undefined): {
  glyph: string;
  label: string;
  className: string;
  verdict: CompatibilityVerdict | 'NONE';
} {
  if (!cell || cell.findings.length === 0) return { ...NO_RULE, verdict: 'NONE' };
  return { ...VERDICT_CELL[cell.verdict], verdict: cell.verdict };
}

// ---------------------------------------------------------------------------
// Designer state (localStorage-persisted view)
// ---------------------------------------------------------------------------

interface DesignerState {
  rowProductIds: string[];
  axisProductIds: string[];
  axisOsIds: string[];
}

const STORAGE_KEY = 'cloudmarket.matrix-designer.v1';

function loadDesignerState(): DesignerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { rowProductIds: [], axisProductIds: [], axisOsIds: [] };
    const parsed = JSON.parse(raw) as Partial<DesignerState>;
    return {
      rowProductIds: Array.isArray(parsed.rowProductIds) ? parsed.rowProductIds : [],
      axisProductIds: Array.isArray(parsed.axisProductIds) ? parsed.axisProductIds : [],
      axisOsIds: Array.isArray(parsed.axisOsIds) ? parsed.axisOsIds : [],
    };
  } catch {
    return { rowProductIds: [], axisProductIds: [], axisOsIds: [] };
  }
}

type DropKind = 'product' | 'os';
const DND_MIME = 'application/x-cloudmarket-chip';

// ---------------------------------------------------------------------------
// Chips
// ---------------------------------------------------------------------------

function TrayChip({
  kind,
  id,
  label,
  onAddRow,
  onAddColumn,
}: {
  kind: DropKind;
  id: string;
  label: string;
  onAddRow?: () => void;
  onAddColumn: () => void;
}) {
  return (
    <span
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DND_MIME, JSON.stringify({ kind, id }));
        e.dataTransfer.effectAllowed = 'copy';
      }}
      className="inline-flex cursor-grab items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 hover:border-slate-600 active:cursor-grabbing"
    >
      <GripVertical className="h-4 w-4 text-slate-500" aria-hidden />
      {label}
      {onAddRow && (
        <button
          type="button"
          onClick={onAddRow}
          title="Add to rows"
          aria-label={`Add ${label} to rows`}
          className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-blue-500/15 hover:text-blue-300"
        >
          +rows
        </button>
      )}
      <button
        type="button"
        onClick={onAddColumn}
        title="Add to columns"
        aria-label={`Add ${label} to columns`}
        className="rounded px-1.5 py-0.5 text-xs text-slate-400 hover:bg-blue-500/15 hover:text-blue-300"
      >
        +columns
      </button>
    </span>
  );
}

function ShelfChip({
  label,
  onRemove,
  onMoveLeft,
  onMoveRight,
}: {
  label: string;
  onRemove: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/50 bg-blue-500/15 px-3 py-2 text-sm font-semibold text-blue-300">
      {label}
      {onMoveLeft && (
        <button
          type="button"
          onClick={onMoveLeft}
          title="Move left"
          aria-label={`Move ${label} left`}
          className="rounded p-0.5 text-blue-300/70 hover:bg-blue-500/20 hover:text-blue-200"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
      )}
      {onMoveRight && (
        <button
          type="button"
          onClick={onMoveRight}
          title="Move right"
          aria-label={`Move ${label} right`}
          className="rounded p-0.5 text-blue-300/70 hover:bg-blue-500/20 hover:text-blue-200"
        >
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        title="Remove"
        aria-label={`Remove ${label}`}
        className="rounded p-0.5 text-blue-300/70 hover:bg-red-500/20 hover:text-red-300"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

/** Drop shelf for rows or columns, with drag & drop + button fallback. */
function Shelf({
  title,
  hint,
  accent,
  acceptKinds,
  children,
  onDropChip,
  emptyLabel,
}: {
  title: string;
  hint: string;
  accent: 'blue' | 'purple';
  acceptKinds: DropKind[];
  children: React.ReactNode;
  onDropChip: (kind: DropKind, id: string) => void;
  emptyLabel: string;
}) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(DND_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const raw = e.dataTransfer.getData(DND_MIME);
        if (!raw) return;
        e.preventDefault();
        try {
          const chip = JSON.parse(raw) as { kind: DropKind; id: string };
          if (acceptKinds.includes(chip.kind)) onDropChip(chip.kind, chip.id);
        } catch {
          /* foreign payload — ignore */
        }
      }}
      className={`rounded-xl border-2 border-dashed p-4 transition-colors ${
        over
          ? accent === 'blue'
            ? 'border-blue-400 bg-blue-500/10'
            : 'border-purple-400 bg-purple-500/10'
          : accent === 'blue'
            ? 'border-slate-700 bg-slate-900/60'
            : 'border-slate-700 bg-slate-900/60'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p
          className={`text-xs font-semibold uppercase tracking-wider ${
            accent === 'blue' ? 'text-blue-300' : 'text-purple-300'
          }`}
        >
          {title}
        </p>
        <p className="text-xs text-slate-500">{hint}</p>
      </div>
      <div className="mt-3 flex min-h-[44px] flex-wrap items-center gap-2">
        {children}
        <span
          className={`rounded-lg border border-dashed px-4 py-2 text-xs ${
            over ? 'border-blue-400 text-blue-300' : 'border-slate-700 text-slate-500'
          }`}
        >
          {emptyLabel}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cell panel — motivating rules as sentences + rule creation
// ---------------------------------------------------------------------------

function CellPanel({
  rowLabel,
  columnLabel,
  cell,
  nameOf,
  onClose,
  onCreateRule,
  onDeactivateRule,
}: {
  rowLabel: string;
  columnLabel: string;
  cell: MatrixCellResult;
  nameOf: (id: string) => string;
  onClose: () => void;
  onCreateRule: () => void;
  onDeactivateRule: (ruleId: string) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const state = cellState(cell);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Rules — ${rowLabel} × ${columnLabel}`}
        className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">Cell</p>
            <p className="mt-1 text-base font-semibold text-white">
              {rowLabel} <span className="text-slate-500">×</span> {columnLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span
            className={`inline-flex h-8 w-8 items-center justify-center rounded border text-base font-bold leading-none ${state.className}`}
            title={state.label}
            aria-label={state.label}
          >
            {state.glyph}
          </span>
          <span className="text-sm font-medium text-slate-200">{state.label}</span>
        </div>

        {cell.findings.length === 0 ? (
          <div className="mt-5 rounded-lg border border-dashed border-slate-700 bg-slate-950/50 p-4">
            <p className="text-sm text-slate-400">
              No rule for this pair. Create one to state what is expected.
            </p>
          </div>
        ) : (
          <ul className="mt-5 space-y-3">
            {cell.findings.map((finding, i) => (
              <li
                key={`${finding.ruleId}-${i}`}
                className={`rounded-lg border p-3 ${
                  finding.satisfied
                    ? 'border-slate-800 bg-slate-950/40'
                    : finding.severity === 'HARD'
                      ? 'border-red-500/40 bg-red-500/5'
                      : 'border-orange-500/40 bg-orange-500/5'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                      finding.severity === 'HARD'
                        ? 'bg-red-500/15 text-red-300'
                        : 'bg-orange-500/15 text-orange-300'
                    }`}
                  >
                    {finding.severity === 'HARD' ? 'Blocking' : 'Warning'}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] ${
                      finding.satisfied
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : 'bg-red-500/15 text-red-300'
                    }`}
                  >
                    {finding.satisfied ? '✓ satisfied' : '✗ violated'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onDeactivateRule(finding.ruleId)}
                    className="ml-auto rounded border border-slate-700 px-2 py-1 text-xs text-slate-400 hover:border-slate-600 hover:text-slate-200"
                  >
                    Deactivate
                  </button>
                </div>
                <p className="mt-2 text-sm text-slate-200">
                  <RuleSentenceText
                    rule={{
                      name: finding.ruleName,
                      fromProductId: finding.fromProductId,
                      fromVersionConstraint: finding.fromVersionConstraint,
                      toProductId: finding.toProductId,
                      toVersionConstraint: finding.toVersionConstraint,
                      kind: finding.kind,
                      severity: finding.severity,
                    }}
                    productName={nameOf}
                  />
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5">
          <Button
            type="button"
            onClick={onCreateRule}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
          >
            <Plus className="mr-1 h-4 w-4" />
            Create a rule for this pair
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — the designer
// ---------------------------------------------------------------------------

interface SelectedCell {
  rowProductId: string;
  rowLabel: string;
  columnProductId: string | null;
  columnLabel: string;
  cell: MatrixCellResult;
}

export default function CompatibilityMatrix() {
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } =
    useProducts();
  const { data: osList } = useOperatingSystems();
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);

  const [design, setDesign] = useState<DesignerState>(loadDesignerState);
  const [selected, setSelected] = useState<SelectedCell | null>(null);
  const [ruleModalOpen, setRuleModalOpen] = useState(false);
  const [ruleDefaultPair, setRuleDefaultPair] = useState<{ fromProductId: string; toProductId: string } | null>(null);

  const createRule = useCreateCompatibilityRule();
  const updateRule = useUpdateCompatibilityRule();

  // Persist the design silently on every change (the Save button confirms it).
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
    } catch {
      /* private mode — design stays session-local */
    }
  }, [design]);

  const productOptions = useMemo<ProductOption[]>(
    () =>
      ((products ?? []) as { id: string; name: string }[])
        .map((p) => ({ id: p.id, name: p.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );
  const nameOf = useMemo(() => {
    const map = new Map(productOptions.map((p) => [p.id, p.name]));
    for (const os of (osList ?? []) as { id: string; name: string }[]) map.set(os.id, os.name);
    return (id: string) => map.get(id) ?? id;
  }, [productOptions, osList]);

  const osOptions = useMemo(
    () =>
      ((osList ?? []) as { id: string; name: string }[])
        .map((os) => ({ id: os.id, name: os.name }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [osList]
  );

  const grid = useCompatibilityMatrixGrid(
    design.rowProductIds,
    design.axisProductIds,
    design.axisOsIds,
    Object.fromEntries(productOptions.map((p) => [p.id, p.name]))
  );

  // ---- shelf mutations ----
  const addToRows = useCallback((id: string) => {
    setDesign((d) =>
      d.rowProductIds.includes(id) ? d : { ...d, rowProductIds: [...d.rowProductIds, id] }
    );
  }, []);
  const addToColumns = useCallback((kind: DropKind, id: string) => {
    setDesign((d) => {
      if (kind === 'os') {
        return d.axisOsIds.includes(id) ? d : { ...d, axisOsIds: [...d.axisOsIds, id] };
      }
      return d.axisProductIds.includes(id) ? d : { ...d, axisProductIds: [...d.axisProductIds, id] };
    });
  }, []);
  const removeFromRows = useCallback((id: string) => {
    setDesign((d) => ({ ...d, rowProductIds: d.rowProductIds.filter((x) => x !== id) }));
  }, []);
  const removeFromColumns = useCallback((kind: DropKind, id: string) => {
    setDesign((d) =>
      kind === 'os'
        ? { ...d, axisOsIds: d.axisOsIds.filter((x) => x !== id) }
        : { ...d, axisProductIds: d.axisProductIds.filter((x) => x !== id) }
    );
  }, []);
  const moveInList = useCallback(
    (list: 'rows' | 'columns', index: number, delta: number) => {
      setDesign((d) => {
        const arr = list === 'rows' ? [...d.rowProductIds] : [...d.axisProductIds];
        const target = index + delta;
        if (target < 0 || target >= arr.length) return d;
        [arr[index], arr[target]] = [arr[target], arr[index]];
        return list === 'rows' ? { ...d, rowProductIds: arr } : { ...d, axisProductIds: arr };
      });
    },
    []
  );

  const reset = () => {
    setDesign({ rowProductIds: [], axisProductIds: [], axisOsIds: [] });
    setSelected(null);
    addToast('Designer reset', 'success');
  };
  const saveView = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(design));
      addToast('View saved', 'success');
    } catch {
      addToast('Unable to save the view in this browser', 'error');
    }
  };

  // ---- cell click → panel → rule creation ----
  const handleCreateRuleFromCell = (cell: SelectedCell) => {
    if (cell.columnProductId) {
      setRuleDefaultPair({ fromProductId: cell.rowProductId, toProductId: cell.columnProductId });
    } else {
      setRuleDefaultPair(null);
    }
    setRuleModalOpen(true);
  };

  const submitRule = async (values: RuleFormValues) => {
    const payload = {
      name: values.name,
      description: values.description || null,
      fromProductId: values.fromProductId,
      fromVersionConstraint: values.fromVersionConstraint || null,
      toProductId: values.toProductId,
      toVersionConstraint: values.toVersionConstraint || null,
      kind: values.kind,
      severity: values.severity,
      scopeType: values.scopeType,
      scopeProductId: values.scopeType === 'PRODUCT' ? values.scopeProductId : null,
      justification: values.justification || null,
      isActive: values.isActive,
    };
    await createRule.mutateAsync(payload);
    queryClient.invalidateQueries({ queryKey: ['compatibility-matrix'] });
    setRuleModalOpen(false);
  };

  const deactivateRule = async (ruleId: string) => {
    await updateRule.mutateAsync({ id: ruleId, isActive: false });
    queryClient.invalidateQueries({ queryKey: ['compatibility-matrix'] });
    setSelected((current) => {
      if (!current) return current;
      return {
        ...current,
        cell: {
          ...current.cell,
          findings: current.cell.findings.map((f) =>
            f.ruleId === ruleId ? { ...f, satisfied: true } : f
          ),
        },
      };
    });
  };

  // ---- render ----
  const trayProducts = productOptions.filter(
    (p) => !design.rowProductIds.includes(p.id) && !design.axisProductIds.includes(p.id)
  );
  const trayOs = osOptions.filter((os) => !design.axisOsIds.includes(os.id));
  const hasAnyAxis = design.axisProductIds.length + design.axisOsIds.length > 0;
  const hasRows = design.rowProductIds.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/marketplace" className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200">
            <ArrowLeft className="h-4 w-4" />
            Back to marketplace
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-white">Matrix designer</h1>
          <p className="mt-1 text-sm text-slate-400">
            Drag products onto the shelves — the compatibility matrix is calculated live,
            for N stacks and N components.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={reset}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 min-h-[44px]"
          >
            <RotateCcw className="mr-1 h-4 w-4" />
            Reset
          </Button>
          <Button onClick={saveView} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
            <Save className="mr-1 h-4 w-4" />
            Save view
          </Button>
        </div>
      </div>

      {productsError ? (
        <QueryError message="Unable to load the products." onRetry={refetchProducts} />
      ) : productsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl bg-slate-800" />
          <Skeleton className="h-64 rounded-xl bg-slate-800" />
        </div>
      ) : (
        <>
          {/* Product tray */}
          <Card className="border-slate-800 bg-slate-900">
            <CardContent className="p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Product tray — drag these
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {trayProducts.map((p) => (
                  <TrayChip
                    key={p.id}
                    kind="product"
                    id={p.id}
                    label={p.name}
                    onAddRow={() => addToRows(p.id)}
                    onAddColumn={() => addToColumns('product', p.id)}
                  />
                ))}
                {trayOs.map((os) => (
                  <TrayChip
                    key={os.id}
                    kind="os"
                    id={os.id}
                    label={os.name}
                    onAddColumn={() => addToColumns('os', os.id)}
                  />
                ))}
                {trayProducts.length === 0 && trayOs.length === 0 && (
                  <span className="text-sm text-slate-500">All products are on the shelves.</span>
                )}
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Operating systems can only be dropped on the columns shelf.
              </p>
            </CardContent>
          </Card>

          {/* Shelves */}
          <div className="grid gap-3 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <Shelf
                title="In rows — the stacks"
                hint={`${design.rowProductIds.length} product(s)`}
                accent="blue"
                acceptKinds={['product']}
                onDropChip={(_kind, id) => addToRows(id)}
                emptyLabel="drop a stack here"
              >
                {design.rowProductIds.map((id, index) => (
                  <ShelfChip
                    key={id}
                    label={nameOf(id)}
                    onRemove={() => removeFromRows(id)}
                    onMoveLeft={index > 0 ? () => moveInList('rows', index, -1) : undefined}
                    onMoveRight={
                      index < design.rowProductIds.length - 1
                        ? () => moveInList('rows', index, 1)
                        : undefined
                    }
                  />
                ))}
              </Shelf>
            </div>
            <div className="lg:col-span-3">
              <Shelf
                title="In columns — the components"
                hint={`${design.axisProductIds.length + design.axisOsIds.length} product(s)`}
                accent="purple"
                acceptKinds={['product', 'os']}
                onDropChip={(kind, id) => addToColumns(kind, id)}
                emptyLabel="drop a component here"
              >
                {[
                  ...design.axisProductIds.map((id) => ({ kind: 'product' as DropKind, id })),
                  ...design.axisOsIds.map((id) => ({ kind: 'os' as DropKind, id })),
                ].map((entry, index) => (
                  <ShelfChip
                    key={`${entry.kind}-${entry.id}`}
                    label={nameOf(entry.id)}
                    onRemove={() => removeFromColumns(entry.kind, entry.id)}
                    onMoveLeft={index > 0 ? () => moveInList('columns', index, -1) : undefined}
                    onMoveRight={
                      index < design.axisProductIds.length + design.axisOsIds.length - 1
                        ? () => moveInList('columns', index, 1)
                        : undefined
                    }
                  />
                ))}
              </Shelf>
            </div>
          </div>

          {/* Live matrix */}
          {!hasRows || !hasAnyAxis ? (
            <Card className="border-slate-800 bg-slate-900">
              <CardContent className="p-10 text-center">
                <p className="text-slate-400">
                  Drop at least one stack in rows and one component in columns to see the matrix.
                </p>
              </CardContent>
            </Card>
          ) : grid.isError ? (
            <QueryError message="Unable to compute the matrix." onRetry={grid.refetch} />
          ) : (
            <Card className="border-slate-800 bg-slate-900">
              <CardContent className="p-0 overflow-x-auto">
                {grid.isLoading ? (
                  <div className="space-y-2 p-6">
                    <Skeleton className="h-10 rounded bg-slate-800" />
                    <Skeleton className="h-10 rounded bg-slate-800" />
                    <Skeleton className="h-10 rounded bg-slate-800" />
                  </div>
                ) : (
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      {/* Column group headers (one per axis product / OS) */}
                      <tr>
                        <th className="sticky left-0 z-10 bg-slate-900 p-3" />
                        {grid.axisGroups.map((group: MatrixAxisGroup) => (
                          <th
                            key={group.key}
                            colSpan={Math.max(group.columns.length, 1)}
                            className={`border-b p-2 text-xs font-semibold uppercase tracking-wider ${
                              group.type === 'product'
                                ? 'border-blue-800/60 text-blue-300'
                                : 'border-purple-800/60 text-purple-300'
                            }`}
                          >
                            {group.label}
                            {group.columns.length === 0 && (
                              <span className="block text-[10px] text-slate-600">aucune version</span>
                            )}
                          </th>
                        ))}
                      </tr>
                      {/* Column versions */}
                      <tr>
                        <th className="sticky left-0 z-10 bg-slate-900 p-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                          Stacks ↓ / Components →
                        </th>
                        {grid.axisGroups.map((group: MatrixAxisGroup) =>
                          group.columns.map((column) => (
                            <th key={column.id} className="border-b border-slate-800 p-2 text-xs font-medium text-slate-400">
                              {column.version}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {grid.rowGroups.map((rowGroup) => (
                        <>
                          {/* Row group header: the stack product */}
                          <tr key={`group-${rowGroup.productId}`}>
                            <td
                              colSpan={1 + grid.axisGroups.reduce((n, g) => n + Math.max(g.columns.length, 1), 0)}
                              className="sticky left-0 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-blue-300"
                            >
                              {rowGroup.productName}
                            </td>
                          </tr>
                          {rowGroup.rows.map((row) => (
                            <tr key={row.id} className="hover:bg-slate-800/30">
                              <th className="sticky left-0 z-10 whitespace-nowrap bg-slate-900 p-3 text-left font-medium text-slate-200">
                                {row.version}
                              </th>
                              {grid.axisGroups.map((group: MatrixAxisGroup) =>
                                group.columns.map((column) => {
                                  const cell = grid.cells[row.id]?.[column.id];
                                  const state = cellState(cell);
                                  return (
                                    <td key={column.id} className="border-t border-slate-800/60 p-1 text-center">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSelected({
                                            rowProductId: rowGroup.productId,
                                            rowLabel: `${rowGroup.productName} ${row.version}`,
                                            columnProductId: group.type === 'product' ? group.productId : null,
                                            columnLabel: `${group.label} ${column.version}`,
                                            cell: cell ?? { verdict: 'VALID', findings: [] },
                                          })
                                        }
                                        title={`${state.label} — see the rules`}
                                        aria-label={`${rowGroup.productName} ${row.version} × ${group.label} ${column.version} : ${state.label}`}
                                        className={`inline-flex h-9 w-full min-w-[44px] items-center justify-center rounded-md border text-sm font-bold leading-none transition-transform hover:scale-105 ${state.className}`}
                                      >
                                        {state.glyph}
                                      </button>
                                    </td>
                                  );
                                })
                              )}
                            </tr>
                          ))}
                        </>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-emerald-400/40 bg-emerald-500/20 font-bold text-emerald-300">✓</span>
              valid
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-orange-400/40 bg-orange-500/20 font-bold text-orange-300">!</span>
              warning
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-red-400/40 bg-red-500/20 font-bold text-red-300">✗</span>
              blocked
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-dashed border-slate-800 bg-slate-900 font-bold text-slate-600">—</span>
              no rule (yours to create)
            </span>
            <span className="ml-auto">
              Keyboard/touch fallback: use the “+rows / +columns” buttons on each tray product.
            </span>
          </div>
        </>
      )}

      {/* Cell panel */}
      {selected && (
        <CellPanel
          rowLabel={selected.rowLabel}
          columnLabel={selected.columnLabel}
          cell={selected.cell}
          nameOf={nameOf}
          onClose={() => setSelected(null)}
          onCreateRule={() => handleCreateRuleFromCell(selected)}
          onDeactivateRule={deactivateRule}
        />
      )}

      {/* Sentence-based rule composer */}
      <CompatibilityRuleModal
        open={ruleModalOpen}
        onOpenChange={(open) => {
          setRuleModalOpen(open);
          if (!open) setRuleDefaultPair(null);
        }}
        rule={null}
        products={productOptions}
        defaultPair={ruleDefaultPair}
        onSubmit={submitRule}
        isSubmitting={createRule.isPending}
      />
    </div>
  );
}
