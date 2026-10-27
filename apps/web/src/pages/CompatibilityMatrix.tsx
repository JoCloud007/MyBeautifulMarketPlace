/**
 * CompatibilityMatrix — public /compatibility page.
 * Spec "Stacks de produits & matrice de compatibilité"; work unit "admin-ui"
 * (owner of this file only).
 *
 * Main-product selector + multi-axis selection (other products and/or OS).
 * The table is modeled on MarketplaceMatrix: grouped axis headers (one group
 * per axis product / OS, in selection order) over version columns, rows = the
 * main product's versions. Cells are colored with the same three states as the
 * Availability Matrix — green VALID, orange WARNING (!), red BLOCKED (✗) — and
 * clicking a cell opens a popover listing the motivating rules (name +
 * constraint, satisfied/violated). Phase 2 migration is a disabled
 * "Migrer depuis cette version" placeholder.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';
import { useProducts, useOperatingSystems } from '@/hooks/useApi';
import {
  useCompatibilityMatrix,
  type CompatibilityVerdict,
  type MatrixAxisGroup,
  type MatrixCellResult,
} from '@/hooks/useCompatibility';
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Grid3x3,
  X,
} from 'lucide-react';

const VERDICT_CELL: Record<
  CompatibilityVerdict,
  { icon: typeof CheckCircle; glyph: string; label: string; className: string }
> = {
  VALID: {
    icon: CheckCircle,
    glyph: '✓',
    label: 'Compatible',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/40',
  },
  WARNING: {
    icon: AlertTriangle,
    glyph: '!',
    label: 'Avertissement',
    className: 'bg-orange-500/20 text-orange-300 border-orange-400/40',
  },
  BLOCKED: {
    icon: XCircle,
    glyph: '✗',
    label: 'Incompatible',
    className: 'bg-red-500/20 text-red-300 border-red-400/40',
  },
};

function VerdictGlyph({ verdict, compact = false }: { verdict: CompatibilityVerdict; compact?: boolean }) {
  const config = VERDICT_CELL[verdict];
  return (
    <div
      className={`inline-flex items-center justify-center rounded border ${config.className} ${
        compact
          ? 'h-7 w-7 text-sm font-bold leading-none'
          : 'h-8 w-8 text-base font-bold leading-none'
      }`}
      title={config.label}
      aria-label={config.label}
    >
      {config.glyph}
    </div>
  );
}

/** Popover listing the motivating rules of one cell (name + constraint). */
function RulesPopover({
  anchorLabel,
  cell,
  onClose,
}: {
  anchorLabel: string;
  cell: MatrixCellResult;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        role="dialog"
        aria-label={`Règles de compatibilité — ${anchorLabel}`}
        className="relative z-10 w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">Règles motivantes</h3>
            <p className="mt-1 text-sm text-slate-400">{anchorLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded p-1 text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <VerdictGlyph verdict={cell.verdict} compact />
          <span className="text-sm font-medium text-slate-200">{VERDICT_CELL[cell.verdict].label}</span>
        </div>

        {cell.findings.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Aucune règle de compatibilité déclarée pour cette paire.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {cell.findings.map((finding, i) => {
              const from = finding.fromVersionConstraint || 'toutes versions';
              const to = finding.toVersionConstraint || 'toutes versions';
              return (
                <li key={`${finding.ruleId}-${i}`} className="flex items-start gap-2">
                  {finding.satisfied ? (
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-sm ${finding.satisfied ? 'text-slate-300' : 'text-red-300'}`}>
                      {finding.ruleName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {finding.kind} · {finding.severity} · {from} → {to} ·{' '}
                      {finding.satisfied ? 'satisfaite' : 'violée'}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/** Multi-select chip list for the axis products. */
function AxisPicker({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.length === 0 ? (
          <span className="text-sm text-slate-500">Aucune option</span>
        ) : (
          options.map((option) => {
            const active = selected.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(option.id)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                  active
                    ? 'border-blue-500/60 bg-blue-500/15 text-blue-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                }`}
              >
                {option.label}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CompatibilityMatrix() {
  const { data: products, isLoading: productsLoading, isError: productsError, refetch: refetchProducts } =
    useProducts();
  const { data: osList } = useOperatingSystems();

  const [mainProductId, setMainProductId] = useState('');
  const [axisProductIds, setAxisProductIds] = useState<string[]>([]);
  const [axisOsIds, setAxisOsIds] = useState<string[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    rowLabel: string;
    colLabel: string;
    cell: MatrixCellResult;
  } | null>(null);

  const productOptions = useMemo(
    () =>
      (products ?? [])
        .map((p) => ({ id: p.id, label: p.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [products]
  );

  const osOptions = useMemo(
    () =>
      (osList ?? [])
        .filter((os) => os.isActive !== false)
        .map((os) => ({ id: os.id, label: os.name }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [osList]
  );

  // Default the main product once the catalog is loaded.
  useEffect(() => {
    if (!mainProductId && productOptions.length > 0) setMainProductId(productOptions[0].id);
  }, [productOptions, mainProductId]);

  const axisIdsSelected = axisProductIds.length + axisOsIds.length > 0;

  const {
    data: matrix,
    isLoading: matrixLoading,
    isError: matrixError,
    refetch: refetchMatrix,
  } = useCompatibilityMatrix(mainProductId, axisProductIds, axisOsIds);

  const mainProduct = products?.find((p) => p.id === mainProductId);

  if (productsError) {
    return (
      <div className="space-y-6">
        <QueryError message="Unable to load the product catalog." onRetry={refetchProducts} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <Link
          to="/marketplace"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-blue-400 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to marketplace
        </Link>
        <h1 className="mt-2 flex items-center gap-3 text-2xl font-bold text-white">
          <Grid3x3 className="h-7 w-7 text-blue-500" />
          Matrice de compatibilité
        </h1>
        <p className="mt-1 text-slate-400">
          Versions du produit principal (lignes) × produits et OS comparés (colonnes groupées).
          Chaque cellule évalue la paire selon les règles de compatibilité déclarées.
        </p>
      </div>

      {/* Selectors */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Sélection</CardTitle>
          <CardDescription className="text-slate-400">
            Choisissez le produit principal, puis les axes de comparaison (plusieurs produits et/ou OS).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="main-product" className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Produit principal
            </label>
            <select
              id="main-product"
              value={mainProductId}
              onChange={(e) => setMainProductId(e.target.value)}
              disabled={productsLoading}
              className="w-full h-11 rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              {productOptions.length === 0 && <option value="">Aucun produit</option>}
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <AxisPicker
            title="Produits comparés"
            options={productOptions.filter((p) => p.id !== mainProductId)}
            selected={axisProductIds}
            onChange={setAxisProductIds}
          />
          <AxisPicker title="Systèmes d’exploitation comparés" options={osOptions} selected={axisOsIds} onChange={setAxisOsIds} />
        </CardContent>
      </Card>

      {/* Matrix */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          {!mainProductId || !axisIdsSelected ? (
            <div className="text-center py-12">
              <Grid3x3 className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-slate-400">
                Sélectionnez un produit principal et au moins un axe de comparaison.
              </p>
            </div>
          ) : matrixLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg bg-slate-800" />
              ))}
            </div>
          ) : matrixError ? (
            <QueryError message="Unable to load the compatibility matrix." onRetry={refetchMatrix} />
          ) : matrix && matrix.axisGroups.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  {/* Grouped header: one group per axis (product or OS), in selection order */}
                  <tr className="border-b border-slate-800">
                    <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left font-medium text-slate-400">
                      {mainProduct?.name ?? 'Produit'}
                    </th>
                    {matrix.axisGroups.map((group: MatrixAxisGroup) => (
                      <th
                        key={group.key}
                        colSpan={Math.max(group.columns.length, 1)}
                        className="px-3 py-2 text-center font-semibold text-blue-300 border-l border-slate-800"
                      >
                        {group.label}
                        <span className="ml-2 text-[10px] font-normal uppercase text-slate-500">
                          {group.type === 'product' ? 'produit' : 'os'}
                        </span>
                      </th>
                    ))}
                  </tr>
                  <tr className="border-b border-slate-800">
                    <th className="sticky left-0 z-10 bg-slate-900 px-3 py-2 text-left text-xs text-slate-500">
                      Version
                    </th>
                    {matrix.axisGroups.map((group) =>
                      group.columns.length === 0 ? (
                        <th key={`${group.key}-empty`} className="border-l border-slate-800 px-3 py-2 text-xs text-slate-600">
                          —
                        </th>
                      ) : (
                        group.columns.map((column) => (
                          <th
                            key={column.id}
                            className="border-l border-slate-800 px-2 py-2 text-center text-xs font-medium text-slate-400"
                          >
                            {column.version}
                          </th>
                        ))
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {matrix.rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="sticky left-0 z-10 bg-slate-900 px-3 py-2 font-medium text-white">
                        {row.version}
                      </td>
                      {matrix.axisGroups.map((group) =>
                        group.columns.length === 0 ? (
                          <td key={`${group.key}-empty`} className="border-l border-slate-800 px-3 py-2 text-center text-slate-600">
                            —
                          </td>
                        ) : (
                          group.columns.map((column) => {
                            const cell = matrix.cells[row.id]?.[column.id] ?? {
                              verdict: 'VALID' as CompatibilityVerdict,
                              findings: [],
                            };
                            return (
                              <td
                                key={column.id}
                                className="border-l border-slate-800/50 p-2 text-center"
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedCell({
                                      rowLabel: `${mainProduct?.name ?? ''} ${row.version}`.trim(),
                                      colLabel: `${group.label} ${column.version}`.trim(),
                                      cell,
                                    })
                                  }
                                  aria-label={`${VERDICT_CELL[cell.verdict].label} — ${row.version} / ${group.label} ${column.version}`}
                                  className="mx-auto block cursor-pointer"
                                >
                                  <VerdictGlyph verdict={cell.verdict} />
                                </button>
                              </td>
                            );
                          })
                        )
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Legend — same three states as the Availability Matrix */}
              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" /> Compatible (✓)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-orange-400" /> Avertissement (!)
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-400" /> Incompatible (✗)
                </span>
                <span className="ml-auto">Cliquez sur une cellule pour voir les règles motivantes.</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <Grid3x3 className="mx-auto h-10 w-10 text-slate-700" />
              <p className="mt-3 text-slate-400">Aucune colonne d’axe disponible pour cette sélection.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Phase 2 placeholder — migration planner is out of scope. */}
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled
          title="Planificateur de migration — phase 2 (à venir)"
          className="bg-slate-800 text-slate-500 cursor-not-allowed min-h-[44px]"
        >
          Migrer depuis cette version
        </Button>
        <Badge variant="outline" className="border-slate-700 text-slate-500">
          Phase 2 — bientôt disponible
        </Badge>
      </div>

      {selectedCell && (
        <RulesPopover
          anchorLabel={`${selectedCell.rowLabel} × ${selectedCell.colLabel}`}
          cell={selectedCell.cell}
          onClose={() => setSelectedCell(null)}
        />
      )}
    </div>
  );
}
