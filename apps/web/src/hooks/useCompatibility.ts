/**
 * Compatibility (public/front) hooks — spec "Stacks de produits & matrice de
 * compatibilité". Work unit: "admin-ui" (owner of this file only). Kept
 * separate from hooks/useApi.ts on purpose so that shared file is never
 * touched; write paths and admin CRUD live in useCompatibilityAdmin.ts.
 *
 * Covers the front surfaces:
 *  - the calculated matrix (GET /api/compatibility/matrix) for /compatibility;
 *  - the product-detail "Stack" tab: the version's components plus per-component
 *    verdicts derived from the live validation endpoint.
 */

import axios from 'axios';
import { useQuery, useQueries } from '@tanstack/react-query';
import {
  useProductVersionComponents,
  type CompatibilityEvaluation,
  type CompatibilityFinding,
  type CompatibilityVerdict,
  type StackComponentRow,
} from './useCompatibilityAdmin';

// Re-export the shared shapes so front consumers need one import.
export type {
  CompatibilityRule,
  CompatibilityVerdict,
  CompatibilityFinding,
  CompatibilityFindingReason,
  CompatibilityEvaluation,
  StackComponentRow,
  RuleKind,
  RuleSeverity,
  RuleScope,
} from './useCompatibilityAdmin';
export {
  useProductVersionComponents,
  useValidateComposition,
  isValidConstraintInput,
} from './useCompatibilityAdmin';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Calculated matrix (GET /api/compatibility/matrix)
// ---------------------------------------------------------------------------

export interface MatrixColumn {
  id: string;
  productId: string | null;
  osId: string | null;
  version: string;
  phase?: string;
  isActive?: boolean;
  releaseDate?: string | null;
  eolDate?: string | null;
}

export interface MatrixAxisGroup {
  key: string;
  type: 'product' | 'os';
  productId: string | null;
  osId: string | null;
  label: string;
  columns: MatrixColumn[];
}

export interface MatrixCellResult {
  verdict: CompatibilityVerdict;
  findings: CompatibilityFinding[];
}

export interface CompatibilityMatrix {
  product: { id: string; name: string; slug?: string };
  rows: {
    id: string;
    productId: string;
    version: string;
    phase?: string;
    isActive?: boolean;
    releaseDate?: string | null;
    eolDate?: string | null;
  }[];
  axisGroups: MatrixAxisGroup[];
  cells: Record<string, Record<string, MatrixCellResult>>;
}

/**
 * Versions of the main product as rows × grouped axis columns (axis products
 * first, in request order, then the OS groups). Cells hold the evaluatePair
 * verdict plus findings — calculated on the API side, cached here.
 */
export function useCompatibilityMatrix(
  productId: string | null | undefined,
  axisProductIds: string[] = [],
  axisOsIds: string[] = []
) {
  return useQuery<CompatibilityMatrix>({
    queryKey: ['compatibility-matrix', productId, axisProductIds, axisOsIds],
    queryFn: async () => {
      const params: Record<string, string> = { productId: String(productId) };
      if (axisProductIds.length > 0) params.axisProductIds = axisProductIds.join(',');
      if (axisOsIds.length > 0) params.axisOsIds = axisOsIds.join(',');
      const { data } = await api.get('/compatibility/matrix', { params });
      return data as CompatibilityMatrix;
    },
    enabled: !!productId && axisProductIds.length + axisOsIds.length > 0,
    retry: 1,
  });
}

// ---------------------------------------------------------------------------
// N-product grid (matrix designer): one matrix call per row product, stacked.
// ---------------------------------------------------------------------------

export interface MatrixGridRowGroup {
  /** The row product this group of version-rows belongs to. */
  productId: string;
  productName: string;
  rows: CompatibilityMatrix['rows'];
}

export interface CompatibilityMatrixGrid {
  rowGroups: MatrixGridRowGroup[];
  axisGroups: MatrixAxisGroup[];
  /** cells[rowId][columnId] — same shape as the single matrix call. */
  cells: Record<string, Record<string, MatrixCellResult>>;
  /** Per-row-product context (rules are resolved in the row product's context). */
  rowProductById: Record<string, { id: string; name: string; slug?: string }>;
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

/**
 * Stack several matrix calls vertically: one per row product (the designer's
 * "N products in rows"). Column axis groups are the same for every call.
 */
export function useCompatibilityMatrixGrid(
  rowProductIds: string[],
  axisProductIds: string[] = [],
  axisOsIds: string[] = [],
  productNames: Record<string, string> = {}
): CompatibilityMatrixGrid {
  const enabled = rowProductIds.length > 0 && axisProductIds.length + axisOsIds.length > 0;
  const queries = useQueries({
    queries: rowProductIds.map((rowProductId) => ({
      queryKey: ['compatibility-matrix', rowProductId, axisProductIds, axisOsIds],
      queryFn: async () => {
        const params: Record<string, string> = { productId: String(rowProductId) };
        if (axisProductIds.length > 0) params.axisProductIds = axisProductIds.join(',');
        if (axisOsIds.length > 0) params.axisOsIds = axisOsIds.join(',');
        const { data } = await api.get('/compatibility/matrix', { params });
        return data as CompatibilityMatrix;
      },
      enabled,
      retry: 1,
    })),
  });

  const rowGroups: MatrixGridRowGroup[] = [];
  const cells: Record<string, Record<string, MatrixCellResult>> = {};
  const rowProductById: Record<string, { id: string; name: string; slug?: string }> = {};
  let axisGroups: MatrixAxisGroup[] = [];

  queries.forEach((query: { data?: CompatibilityMatrix | undefined }, index: number) => {
    const rowProductId = rowProductIds[index];
    const data = query.data;
    if (!data) return;
    if (axisGroups.length === 0) axisGroups = data.axisGroups ?? [];
    rowProductById[rowProductId] = data.product;
    rowGroups.push({
      productId: rowProductId,
      productName: data.product?.name ?? productNames[rowProductId] ?? rowProductId,
      rows: data.rows ?? [],
    });
    Object.assign(cells, data.cells ?? {});
  });

  return {
    rowGroups,
    axisGroups,
    cells,
    rowProductById,
    isLoading: queries.some((q: { isLoading: boolean }) => q.isLoading),
    isError: queries.some((q: { isError: boolean }) => q.isError),
    refetch: () => {
      queries.forEach((q: { refetch: () => void }) => q.refetch());
    },
  };
}

// ---------------------------------------------------------------------------
// Verdict helpers (mirror the engine's verdictFor for client-side derivation)
// ---------------------------------------------------------------------------

/** BLOCKED when a HARD finding is unsatisfied, WARNING when only SOFT are, else VALID. */
export function verdictForFindings(findings: CompatibilityFinding[]): CompatibilityVerdict {
  let hard = false;
  let soft = false;
  for (const finding of findings) {
    if (finding.satisfied) continue;
    if (finding.severity === 'HARD') hard = true;
    else soft = true;
  }
  if (hard) return 'BLOCKED';
  if (soft) return 'WARNING';
  return 'VALID';
}

/** Findings that involve the given product (either side of the rule pair). */
export function findingsForProduct(
  findings: CompatibilityFinding[],
  productId: string
): CompatibilityFinding[] {
  return findings.filter(
    (f) => f.fromProductId === productId || f.toProductId === productId
  );
}

// ---------------------------------------------------------------------------
// Product-detail "Stack" tab: components + per-component verdicts
// ---------------------------------------------------------------------------

export interface VersionStackComponent {
  row: StackComponentRow;
  componentProductId: string;
  componentVersionId: string;
  productName: string;
  versionLabel: string;
  verdict: CompatibilityVerdict;
  findings: CompatibilityFinding[];
}

export interface VersionStack {
  components: VersionStackComponent[];
  verdict: CompatibilityVerdict;
  findings: CompatibilityFinding[];
  isLoading: boolean;
}

/**
 * The stack of one product version: its components (GET
 * /product-versions/:id/components) evaluated against the live validation
 * endpoint (POST /compatibility/validate, write-free) so each component shows
 * its own verdict plus the motivating rules.
 */
export function useVersionStack(
  productVersionId: string | null | undefined,
  containerProductId: string | null | undefined
): VersionStack {
  const componentsQuery = useProductVersionComponents(productVersionId);
  const components = componentsQuery.data ?? [];

  const requested = components.map((row) => ({
    productId: row.componentProductId,
    versionId: row.componentVersionId,
  }));

  const evaluationQuery = useQuery<CompatibilityEvaluation>({
    queryKey: [
      'compatibility-evaluation',
      containerProductId,
      requested.map((r) => `${r.productId}:${r.versionId}`).sort().join('|'),
    ],
    queryFn: async () => {
      const { data } = await api.post('/compatibility/validate', {
        containerProductId,
        components: requested,
      });
      return data as CompatibilityEvaluation;
    },
    enabled: !!containerProductId && requested.length > 0,
    retry: 1,
  });

  const findings = evaluationQuery.data?.findings ?? [];
  const verdict =
    evaluationQuery.data?.verdict ??
    (componentsQuery.isLoading ? 'VALID' : verdictForFindings(findings));

  const list: VersionStackComponent[] = components.map((row) => {
    const componentProductId = row.componentProductId;
    const productFindings = findingsForProduct(findings, componentProductId);
    return {
      row,
      componentProductId,
      componentVersionId: row.componentVersionId,
      productName: row.componentProduct?.name ?? row.product?.name ?? componentProductId,
      versionLabel: row.componentVersion?.version ?? row.version?.version ?? '—',
      verdict: verdictForFindings(productFindings),
      findings: productFindings,
    };
  });

  return {
    components: list,
    verdict,
    findings,
    isLoading: componentsQuery.isLoading || evaluationQuery.isLoading,
  };
}
