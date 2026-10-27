/**
 * Stack composition API — spec "Stacks de produits & matrice de compatibilité"
 * §1.2 (stack components) + §3 live validation for the composer.
 * Work unit: "stack-components" (owner of this file only).
 *
 * Endpoints:
 *   GET  /api/product-versions/:id/components
 *        → the component list of a product version, each row carrying its
 *          linked component product + component version rows.
 *   PUT  /api/product-versions/:id/components
 *        → replaces the list from [{componentProductId, componentVersionId}].
 *          400 on the §1.2 consistency rules (version↔product coherence, no
 *          self-composition, no duplicate component products) and on a
 *          composition that violates a HARD compatibility rule (findings are
 *          returned in the 400 body). `?force=true` + a body `justification`
 *          forces a SOFT-level override: the list is saved, HARD findings are
 *          downgraded to SOFT (flagged `overridden`), the justification is
 *          echoed in the response and logged.
 *   POST /api/compatibility/validate
 *        → write-free live validation for the composer:
 *          {containerProductId, components:[{productId, versionId}]} →
 *          {verdict, findings} computed by `evaluateComposition` (pure, no
 *          write on this path).
 *
 * Route registration exposes the canonical paths above plus aliases so the
 * integration layer may mount this router at `/api`, `/api/product-versions`,
 * `/api/product-versions/:id/components` or `/api/compatibility` without
 * changes here. Pure evaluation lives in ../lib/compatibility (Prisma-free);
 * this file only reads rows, validates consistency, gates HARD violations and
 * persists the component list.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { prisma } from '../db';
import { parseVersionTuple, type VersionTuple } from '../lib/version';
import {
  evaluateComposition,
  type CompatibilityFinding,
  type CompatibilityRuleInput,
  type ComponentInput,
} from '../lib/compatibility';

const router = Router({ mergeParams: true });

/**
 * The §1.2/§1.3 Prisma delegates (`productVersionComponent`,
 * `compatibilityRule`) land in the generated client at `prisma generate` time.
 * Access them structurally so this module also compiles against a client
 * generated before the schema refresh.
 */
const db = prisma as any;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface RequestedComponent {
  productId: string;
  versionId: string;
}

interface VersionRow {
  id: string;
  productId: string;
  version: string;
  versionMajor?: number | null;
  versionMinor?: number | null;
  versionPatch?: number | null;
}

/** A finding after a forced-SOFT override (carries the override marker). */
export type OverriddenFinding = CompatibilityFinding & {
  overridden?: boolean;
};

/** Normalised tuple of a version row: stored tuple first, else derive (§1.1). */
function tupleFromRow(row: VersionRow | undefined | null): VersionTuple | null {
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

const COMPONENT_INCLUDE = {
  componentProduct: { select: { id: true, name: true, slug: true, categoryId: true } },
  componentVersion: {
    select: {
      id: true,
      productId: true,
      version: true,
      versionMajor: true,
      versionMinor: true,
      versionPatch: true,
      phase: true,
      isActive: true,
    },
  },
};

function validationError(res: Response, message: string, path = 'body'): Response {
  return res.status(400).json({
    error: 'Validation Error',
    details: [{ path, message }],
  });
}

function parseRequestedItems(raw: unknown): { error: string } | { items: RequestedComponent[] } {
  if (!Array.isArray(raw)) {
    return { error: 'Expected an array of {componentProductId, componentVersionId}' };
  }
  const items: RequestedComponent[] = [];
  for (const entry of raw) {
    const record = (entry ?? {}) as Record<string, unknown>;
    const productId = record.componentProductId ?? record.productId;
    const versionId = record.componentVersionId ?? record.versionId;
    if (typeof productId !== 'string' || productId.length === 0) {
      return { error: 'Each component requires a componentProductId' };
    }
    if (typeof versionId !== 'string' || versionId.length === 0) {
      return { error: 'Each component requires a componentVersionId' };
    }
    items.push({ productId, versionId });
  }
  return { items };
}

/**
 * §1.2 consistency rules (400 on violation):
 *  1. a component version must belong to its declared component product
 *     (unknown version ids are rejected too — they belong to no product);
 *  2. no self-composition (the container as its own component);
 *  3. one component per product (no duplicate component products).
 */
function checkRequestedShape(
  container: { id?: string; productId: string },
  items: RequestedComponent[]
): { error: string } | null {
  const seenProducts = new Set<string>();
  for (const item of items) {
    if (item.productId === container.productId || (container.id && item.versionId === container.id)) {
      return {
        error: 'Self-composition is not allowed: a product version cannot be its own component',
      };
    }
    if (seenProducts.has(item.productId)) {
      return { error: 'Duplicate component products are not allowed' };
    }
    seenProducts.add(item.productId);
  }
  return null;
}

async function loadVersionRows(items: RequestedComponent[]): Promise<Map<string, VersionRow>> {
  const versionIds = [...new Set(items.map((item) => item.versionId))];
  const rows =
    versionIds.length > 0 && typeof db.productVersion?.findMany === 'function'
      ? await db.productVersion.findMany({ where: { id: { in: versionIds } } })
      : [];
  const list: VersionRow[] = Array.isArray(rows) ? rows : [];
  return new Map<string, VersionRow>(list.map((row) => [row.id, row]));
}

/** Unsatisfied findings (the ones a composer must fix). */
function violationsOf(findings: CompatibilityFinding[]): CompatibilityFinding[] {
  return findings.filter((finding) => !finding.satisfied);
}

/**
 * Forced-SOFT override: every unsatisfied HARD finding is downgraded to SOFT
 * (the composition is saved with a warning instead of being blocked).
 */
function softOverrideFindings(findings: CompatibilityFinding[]): OverriddenFinding[] {
  return findings.map((finding): OverriddenFinding =>
    !finding.satisfied && finding.severity === 'HARD'
      ? { ...finding, severity: 'SOFT', overridden: true }
      : finding
  );
}

function forceFlag(req: Request): boolean {
  const query = String((req.query as any)?.force ?? '').toLowerCase();
  if (query === 'true' || query === '1') return true;
  const body = req.body;
  if (Array.isArray(body) || !body) return false;
  return body.force === true || body.force === 'true' || body.force === 1;
}

/**
 * Component row as returned to clients: the linked rows are exposed both under
 * their relation names (`componentProduct` / `componentVersion`) and as
 * `product` / `version` aliases ("components with their linked product/version
 * rows").
 */
function presentRow(row: any) {
  return {
    ...row,
    product: row?.componentProduct ?? null,
    version: row?.componentVersion ?? null,
  };
}

function justificationOf(req: Request): string {
  const body = req.body;
  const fromBody =
    !Array.isArray(body) && !!body && typeof body.justification === 'string'
      ? body.justification
      : '';
  const fromQuery =
    typeof (req.query as any)?.justification === 'string' ? (req.query as any).justification : '';
  return String(fromBody || fromQuery).trim();
}

// ---------------------------------------------------------------------------
// GET /product-versions/:id/components
// ---------------------------------------------------------------------------

async function listComponents(req: Request, res: Response, next: NextFunction) {
  try {
    const id = (req.params as any).id as string | undefined;
    if (!id) return next(); // alias mount without :id — not our route

    const rows = await db.productVersionComponent.findMany({
      where: { containerVersionId: id },
      orderBy: { createdAt: 'asc' },
      include: COMPONENT_INCLUDE,
    });

    res.json((Array.isArray(rows) ? rows : []).map(presentRow));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PUT /product-versions/:id/components (replace the list)
// ---------------------------------------------------------------------------

async function replaceComponents(req: Request, res: Response, next: NextFunction) {
  try {
    const id = (req.params as any).id as string | undefined;
    if (!id) return next(); // alias mount without :id — not our route

    const rawBody = req.body;
    const itemsRaw = Array.isArray(rawBody)
      ? rawBody
      : rawBody && typeof rawBody === 'object'
        ? (rawBody as any).components ?? (rawBody as any).items
        : undefined;

    const parsedItems = parseRequestedItems(itemsRaw);
    if ('error' in parsedItems) {
      return validationError(res, parsedItems.error, 'components');
    }
    const items = parsedItems.items;

    const container = await db.productVersion.findUnique({ where: { id } });
    if (!container) {
      return res.status(404).json({ error: 'Version not found' });
    }

    // §1.2 consistency (shape rules need no I/O).
    const shapeError = checkRequestedShape({ id: container.id, productId: container.productId }, items);
    if (shapeError) {
      return res.status(400).json({ error: shapeError.error });
    }

    // Version ↔ product coherence (persisted links must be real and owned).
    const versionsById = await loadVersionRows(items);
    for (const item of items) {
      const version = versionsById.get(item.versionId);
      if (!version) {
        return res.status(400).json({ error: `Component version not found: ${item.versionId}` });
      }
      if (version.productId !== item.productId) {
        return res.status(400).json({
          error: `Component version ${item.versionId} does not belong to component product ${item.productId}`,
        });
      }
    }

    // §3 HARD gate — evaluate the composition against the effective rules.
    // The container is an evaluated member so container→component rules fire.
    const rules = await loadRules();
    const componentInputs: ComponentInput[] = [
      {
        productId: container.productId,
        tuple: tupleFromRow(container as VersionRow),
      },
      ...items.map((item) => ({
        productId: item.productId,
        tuple: tupleFromRow(versionsById.get(item.versionId)),
      })),
    ];
    const evaluation = evaluateComposition(
      {
        productId: container.productId,
        versionId: container.id,
        tuple: tupleFromRow(container as VersionRow),
      },
      componentInputs,
      rules
    );

    const force = forceFlag(req);
    const justification = justificationOf(req);
    let findings: OverriddenFinding[] = evaluation.findings;
    let verdict = evaluation.verdict;
    let forced = false;

    if (evaluation.verdict === 'BLOCKED') {
      const violations = violationsOf(evaluation.findings);
      if (!force) {
        return res.status(400).json({
          error: 'Composition violates HARD compatibility rules',
          verdict: 'BLOCKED',
          findings: evaluation.findings,
          violations,
        });
      }
      if (justification.length === 0) {
        return res.status(400).json({
          error: 'A justification is required to force a HARD compatibility override',
          verdict: 'BLOCKED',
          findings: evaluation.findings,
          violations,
          forced: true,
        });
      }
      // Forced-SOFT override: save with the HARD findings downgraded to SOFT.
      forced = true;
      verdict = 'WARNING';
      findings = softOverrideFindings(evaluation.findings);
      // eslint-disable-next-line no-console
      console.log(
        `[stack-components] forced SOFT override on product version ${id} (container ${container.productId}): ${justification}`
      );
    }

    // Replace the list: clear then insert the requested rows.
    await db.productVersionComponent.deleteMany({ where: { containerVersionId: id } });
    if (items.length > 0) {
      await db.productVersionComponent.createMany({
        data: items.map((item) => ({
          containerVersionId: id,
          componentProductId: item.productId,
          componentVersionId: item.versionId,
        })),
      });
    }

    const rows = await db.productVersionComponent.findMany({
      where: { containerVersionId: id },
      orderBy: { createdAt: 'asc' },
      include: COMPONENT_INCLUDE,
    });

    return res.json({
      components: (Array.isArray(rows) ? rows : []).map(presentRow),
      verdict,
      findings,
      violations: violationsOf(findings),
      ...(forced
        ? {
            forced: true,
            justification,
            override: { forced: true, severity: 'SOFT', justification },
          }
        : justification.length > 0
          ? { justification }
          : {}),
    });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /compatibility/validate — write-free live validation
// ---------------------------------------------------------------------------

async function validateComposition(req: Request, res: Response, next: NextFunction) {
  try {
    const raw = (req.body ?? {}) as Record<string, unknown>;
    const containerProductId = raw.containerProductId;
    if (typeof containerProductId !== 'string' || containerProductId.length === 0) {
      return validationError(res, 'containerProductId is required', 'containerProductId');
    }

    const rawComponents = Array.isArray(raw.components) ? raw.components : undefined;
    if (!rawComponents) {
      return validationError(res, 'components must be an array', 'components');
    }
    const parsedItems = parseRequestedItems(
      rawComponents.map((entry: any) => ({
        componentProductId: entry?.productId ?? entry?.componentProductId,
        componentVersionId: entry?.versionId ?? entry?.componentVersionId,
      }))
    );
    if ('error' in parsedItems) {
      return validationError(res, parsedItems.error, 'components');
    }
    const items = parsedItems.items;

    // Shape rules (self-composition, duplicates) — consistent with the PUT.
    const shapeError = checkRequestedShape({ productId: containerProductId }, items);
    if (shapeError) {
      return res.status(400).json({ error: shapeError.error });
    }

    // Version↔product coherence for the versions that exist; this is a pure
    // preview of a composer draft, so unknown version ids are evaluated with
    // a null tuple rather than rejected.
    const versionsById = await loadVersionRows(items);
    for (const item of items) {
      const version = versionsById.get(item.versionId);
      if (version && version.productId !== item.productId) {
        return res.status(400).json({
          error: `Component version ${item.versionId} does not belong to component product ${item.productId}`,
        });
      }
    }

    const rules = await loadRules();
    // The container is an evaluated member so container→component rules fire;
    // its tuple is unknown here (no version id in the body) → null.
    const componentInputs: ComponentInput[] = [
      { productId: containerProductId, tuple: null },
      ...items.map((item) => ({
        productId: item.productId,
        tuple: tupleFromRow(versionsById.get(item.versionId)),
      })),
    ];

    // Read-only: evaluateComposition is pure — no write happens on this path.
    const evaluation = evaluateComposition({ productId: containerProductId }, componentInputs, rules);

    return res.json({ verdict: evaluation.verdict, findings: evaluation.findings });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Route registration — canonical paths + nested-mount aliases
// ---------------------------------------------------------------------------

// Canonical (mount at `/api`).
router.get('/product-versions/:id/components', listComponents);
router.put('/product-versions/:id/components', replaceComponents);
router.post('/compatibility/validate', validateComposition);

// Alias (mount at `/api/product-versions`).
router.get('/:id/components', listComponents);
router.put('/:id/components', replaceComponents);

// Alias (mount at `/api/product-versions/:id/components`) — falls through when
// :id is absent so sibling routers (e.g. compatibility rules) are not shadowed.
router.get('/', listComponents);
router.put('/', replaceComponents);

// Alias (mount at `/api/compatibility`).
router.post('/validate', validateComposition);

export { router as stackComponentRoutes };
export { router as stackComponentsRoutes };
export { router as productVersionComponentRoutes };
