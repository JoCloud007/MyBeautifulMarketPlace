/**
 * Compatibility matrix API — spec "Stacks de produits & matrice de compatibilité"
 * §4 (calculated matrix). Work unit: "admin-ui" (owner of this file only).
 *
 * Endpoint:
 *   GET /api/compatibility/matrix?productId=<P>&axisProductIds=<Q,R>&axisOsIds=<S>
 *        → versions of P as rows × grouped axis columns (Q's versions first,
 *          then R's, then the OS groups). Each cell holds the `evaluatePair`
 *          verdict plus findings for (P-version, axis-version) under the
 *          effective rules resolved in P's context. Axis columns reuse the same
 *          listing semantics as `products/:id/versions` and `os/:id/versions`.
 *
 * Nothing is persisted here: the matrix is calculated on read from the rule
 * rows (pure engine, ../lib/compatibility — Prisma-free). Route registration
 * exposes the canonical path above plus aliases so the integration layer may
 * mount this router at `/api`, `/api/compatibility` or `/api/compatibility/matrix`
 * without changes here.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../db';
import { parseVersionTuple, type VersionTuple } from '../lib/version';
import {
  evaluatePairResolved,
  resolveRules,
  type CompatibilityFinding,
  type CompatibilityRuleInput,
  type ComponentInput,
  type Verdict,
} from '../lib/compatibility';

const router = Router({ mergeParams: true });

/**
 * The §1.1/§1.3 Prisma delegates land in the generated client at
 * `prisma generate` time; access them structurally so this module compiles
 * against a client generated before the schema refresh (same pattern as
 * stack-components.ts / compatibility-rules.ts).
 */
const db = prisma as any;

// ---------------------------------------------------------------------------
// Types (response shape of the calculated matrix)
// ---------------------------------------------------------------------------

interface MatrixVersionRow {
  id: string;
  productId?: string;
  osId?: string;
  version: string;
  phase?: string;
  isActive?: boolean;
  releaseDate?: string | Date | null;
  eolDate?: string | Date | null;
  versionMajor?: number | null;
  versionMinor?: number | null;
  versionPatch?: number | null;
}

interface MatrixColumn {
  id: string;
  productId: string | null;
  osId: string | null;
  version: string;
  phase?: string;
  isActive?: boolean;
  releaseDate?: string | Date | null;
  eolDate?: string | Date | null;
  versionMajor?: number | null;
  versionMinor?: number | null;
  versionPatch?: number | null;
}

interface MatrixAxisGroup {
  key: string;
  type: 'product' | 'os';
  productId: string | null;
  osId: string | null;
  label: string;
  columns: MatrixColumn[];
}

export interface MatrixCellResult {
  verdict: Verdict;
  findings: CompatibilityFinding[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal shape carried by rows/columns for tuple derivation (§1.1). */
interface TupleCarrier {
  version: string | null;
  versionMajor?: number | null;
  versionMinor?: number | null;
  versionPatch?: number | null;
}

/** Normalised tuple of a version row: stored tuple first, else derive (§1.1). */
function tupleFromRow(row: TupleCarrier | undefined | null): VersionTuple | null {
  if (!row) return null;
  const hasStored =
    row.versionMajor != null || row.versionMinor != null || row.versionPatch != null;
  if (hasStored) {
    return {
      major: row.versionMajor ?? 0,
      minor: row.versionMinor ?? 0,
      patch: row.versionPatch ?? 0,
    };
  }
  return parseVersionTuple(row.version ?? null);
}

/** All compatibility rules as plain rows — resolveRules does the filtering. */
async function loadRules(): Promise<CompatibilityRuleInput[]> {
  if (typeof db.compatibilityRule?.findMany !== 'function') return [];
  const rows = await db.compatibilityRule.findMany();
  return Array.isArray(rows) ? (rows as CompatibilityRuleInput[]) : [];
}

/** Comma-separated id list → deduplicated non-empty ids. */
function parseIdList(raw: unknown): string[] {
  if (typeof raw !== 'string') return [];
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (id.length > 0) seen.add(id);
  }
  return [...seen];
}

function validationError(res: Response, message: string, path: string): Response {
  return res.status(400).json({
    error: 'Validation Error',
    details: [{ path, message }],
  });
}

function toColumn(row: MatrixVersionRow): MatrixColumn {
  return {
    id: row.id,
    productId: row.productId ?? null,
    osId: row.osId ?? null,
    version: row.version,
    phase: row.phase,
    isActive: row.isActive,
    releaseDate: row.releaseDate ?? null,
    eolDate: row.eolDate ?? null,
    versionMajor: row.versionMajor ?? null,
    versionMinor: row.versionMinor ?? null,
    versionPatch: row.versionPatch ?? null,
  };
}

// ---------------------------------------------------------------------------
// GET /compatibility/matrix
// ---------------------------------------------------------------------------

async function getMatrix(req: Request, res: Response, next: NextFunction) {
  try {
    const productId = typeof req.query.productId === 'string' ? req.query.productId.trim() : '';
    if (productId.length === 0) {
      return validationError(res, 'productId is required', 'productId');
    }

    const axisProductIds = parseIdList(req.query.axisProductIds);
    const axisOsIds = parseIdList(req.query.axisOsIds);

    const product =
      typeof db.product?.findUnique === 'function'
        ? await db.product.findUnique({
            where: { id: productId },
            select: { id: true, name: true, slug: true },
          })
        : null;
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Rows: the versions of P — same listing semantics as products/:id/versions.
    const rowList: MatrixVersionRow[] =
      typeof db.productVersion?.findMany === 'function'
        ? await db.productVersion.findMany({
            where: { productId },
            orderBy: [{ releaseDate: 'desc' }, { version: 'asc' }],
          })
        : [];
    const rows = Array.isArray(rowList) ? rowList : [];

    // Axis groups: Q then R (request order), each group = one axis product's
    // versions (products/:id/versions semantics), then the OS groups
    // (os/:id/versions semantics).
    const axisGroups: MatrixAxisGroup[] = [];

    for (const axisProductId of axisProductIds) {
      const axisProduct =
        typeof db.product?.findUnique === 'function'
          ? await db.product.findUnique({
              where: { id: axisProductId },
              select: { id: true, name: true },
            })
          : null;
      const colList: MatrixVersionRow[] =
        typeof db.productVersion?.findMany === 'function'
          ? await db.productVersion.findMany({
              where: { productId: axisProductId },
              orderBy: [{ releaseDate: 'asc' }, { version: 'asc' }],
            })
          : [];
      axisGroups.push({
        key: `product:${axisProductId}`,
        type: 'product',
        productId: axisProductId,
        osId: null,
        label: axisProduct?.name ?? axisProductId,
        columns: (Array.isArray(colList) ? colList : []).map(toColumn),
      });
    }

    for (const axisOsId of axisOsIds) {
      const axisOs =
        typeof db.operatingSystem?.findUnique === 'function'
          ? await db.operatingSystem.findUnique({
              where: { id: axisOsId },
              select: { id: true, name: true },
            })
          : null;
      const colList: MatrixVersionRow[] =
        typeof db.osVersion?.findMany === 'function'
          ? await db.osVersion.findMany({
              where: { osId: axisOsId },
              orderBy: [{ releaseDate: 'asc' }, { version: 'asc' }],
            })
          : [];
      axisGroups.push({
        key: `os:${axisOsId}`,
        type: 'os',
        productId: null,
        osId: axisOsId,
        label: axisOs?.name ?? axisOsId,
        columns: (Array.isArray(colList) ? colList : []).map(toColumn),
      });
    }

    // Effective rules in P's context (§2 override resolution), resolved once.
    const resolvedRules = resolveRules(await loadRules(), productId);

    // Cells: evaluatePair for every (P-version × axis-version) pair.
    const cells: Record<string, Record<string, MatrixCellResult>> = {};
    for (const row of rows) {
      const a: ComponentInput = { productId, tuple: tupleFromRow(row) };
      const rowCells: Record<string, MatrixCellResult> = {};
      for (const group of axisGroups) {
        for (const column of group.columns) {
          const b: ComponentInput = {
            productId: group.type === 'product' ? (column.productId ?? group.productId ?? '') : (column.osId ?? group.osId ?? ''),
            tuple: tupleFromRow(column),
          };
          const evaluation = evaluatePairResolved(resolvedRules, a, b);
          rowCells[column.id] = {
            verdict: evaluation.verdict,
            findings: evaluation.findings,
          };
        }
      }
      cells[row.id] = rowCells;
    }

    return res.json({
      product,
      rows: rows.map((row) => ({
        id: row.id,
        productId: row.productId ?? productId,
        version: row.version,
        phase: row.phase,
        isActive: row.isActive,
        releaseDate: row.releaseDate ?? null,
        eolDate: row.eolDate ?? null,
      })),
      axisGroups,
      cells,
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Route registration — canonical path + nested-mount aliases
// ---------------------------------------------------------------------------

/** True when `req.baseUrl` matches `re` (nested-mount guard, as in compatibility-rules.ts). */
function mountedAt(req: Request, re: RegExp): boolean {
  return re.test(req.baseUrl || '');
}

function bare(
  re: RegExp,
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!mountedAt(req, re)) return next();
    return handler(req, res, next);
  };
}

// Canonical (mount at `/api`).
router.get('/compatibility/matrix', getMatrix);

// Alias (mount at `/api/compatibility`).
router.get('/matrix', bare(/\/compatibility\/?$/, getMatrix));

// Alias (mount at `/api/compatibility/matrix`) — falls through when this router
// is mounted elsewhere so sibling routers are not shadowed.
router.get('/', bare(/\/compatibility\/matrix\/?$/, getMatrix));

export { router as compatibilityMatrixRoutes };
export { router as compatibilityMatrixRoute };
export { router as compatibilityMatrixRouter };
export default router;
