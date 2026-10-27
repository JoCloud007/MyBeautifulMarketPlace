/**
 * Compatibility rules API — spec "Stacks de produits & matrice de compatibilité"
 * §1.3 (rule persistence) + §2 registration validation.
 * Work unit: "compatibility-rules" (owner of this file only).
 *
 * Endpoints (canonical mount: `/api/compatibility-rules`):
 *   GET    /api/compatibility-rules
 *          → all rules (admin listing). Filters: fromProductId, toProductId,
 *            scopeType, scopeProductId, kind, severity; `?activeOnly=1` (alias
 *            `?effective=1`) keeps only isActive rules.
 *   GET    /api/compatibility-rules/effective
 *          → the effective rule set served to evaluation consumers:
 *            isActive=false rules are EXCLUDED (resolveRules drops them too).
 *            `?containerProductId=P` additionally applies §2 override
 *            resolution (scoped rules win over GLOBAL for the same pair).
 *   GET    /api/compatibility-rules/:id
 *   POST   /api/compatibility-rules
 *          → creates a rule. Registration validation (400):
 *            - version constraints must follow the §2 grammar
 *              (`=9.4 | !=10 | >=9.2 | >9.2 | <=10 | <10`, null/empty = any);
 *            - fromProductId and toProductId must be distinct products;
 *            - kind/severity/scopeType must be valid enum values;
 *            - a scopeType=PRODUCT rule that RELAXES the matching GLOBAL rule
 *              of the same (fromProductId, toProductId) pair requires a
 *              non-empty `justification` (server-side range comparison via
 *              `isRelaxingOverride` against the stored GLOBAL rules).
 *   PATCH  /api/compatibility-rules/:id  (partial update, same validation on
 *          the merged result; unknown id → 404)
 *   DELETE /api/compatibility-rules/:id  (unknown id → 404)
 *
 * Route registration exposes the canonical bare paths (mount at
 * `/api/compatibility-rules`) plus `/compatibility-rules`-prefixed aliases
 * (mount at `/api`) so the integration layer may wire this router either way
 * without changes here; bare handlers fall through when the router is mounted
 * under another prefix. Pure evaluation lives in ../lib/compatibility
 * (Prisma-free); this file only validates payloads and persists rows.
 */

import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db';
import {
  isRelaxingOverride,
  isValidConstraint,
  resolveRules,
  type CompatibilityRuleInput,
} from '../lib/compatibility';

const router = Router({ mergeParams: true });

/**
 * The §1.3 Prisma delegate (`compatibilityRule`) lands in the generated client
 * at `prisma generate` time. Access it structurally so this module also
 * compiles against a client generated before the schema refresh.
 */
const db = prisma as any;

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const RULE_KINDS = ['REQUIRES', 'FORBIDS'] as const;
const RULE_SEVERITIES = ['HARD', 'SOFT'] as const;
const RULE_SCOPES = ['GLOBAL', 'PRODUCT'] as const;

/** A §2 constraint: nullable, trimmed, empty = "all versions". */
const constraintField = z.string().trim().max(200).nullable().optional();
const justificationField = z.string().trim().max(2000).nullable().optional();

const createRuleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  description: z.string().max(2000).nullable().optional(),
  fromProductId: z.string().trim().min(1, 'fromProductId is required'),
  fromVersionConstraint: constraintField,
  toProductId: z.string().trim().min(1, 'toProductId is required'),
  toVersionConstraint: constraintField,
  kind: z.enum(RULE_KINDS).default('REQUIRES'),
  severity: z.enum(RULE_SEVERITIES).default('HARD'),
  scopeType: z.enum(RULE_SCOPES).default('GLOBAL'),
  scopeProductId: z.string().trim().min(1).nullable().optional(),
  justification: justificationField,
  isActive: z.boolean().optional(),
});

/** Partial update: every field optional, no defaults (undefined = unchanged). */
const updateRuleSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  fromProductId: z.string().trim().min(1).optional(),
  fromVersionConstraint: constraintField,
  toProductId: z.string().trim().min(1).optional(),
  toVersionConstraint: constraintField,
  kind: z.enum(RULE_KINDS).optional(),
  severity: z.enum(RULE_SEVERITIES).optional(),
  scopeType: z.enum(RULE_SCOPES).optional(),
  scopeProductId: z.string().trim().min(1).nullable().optional(),
  justification: justificationField,
  isActive: z.boolean().optional(),
});

const listQuerySchema = z.object({
  fromProductId: z.string().optional(),
  toProductId: z.string().optional(),
  scopeProductId: z.string().optional(),
  scopeType: z.enum(RULE_SCOPES).optional(),
  kind: z.enum(RULE_KINDS).optional(),
  severity: z.enum(RULE_SEVERITIES).optional(),
  containerProductId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Conventional zod-shaped 400 (matches the global error handler format). */
function validationError(res: Response, message: string, path = 'body'): Response {
  return res.status(400).json({
    error: 'Validation Error',
    details: [{ path, message }],
  });
}

/** Domain-rule 400: descriptive top-level error (repo convention). */
function ruleError(res: Response, message: string, path = 'body'): Response {
  return res.status(400).json({
    error: message,
    details: [{ path, message }],
  });
}

function zodError400(res: Response, error: z.ZodError): Response {
  return res.status(400).json({
    error: 'Validation Error',
    details: error.errors.map((e) => ({
      path: e.path.join('.'),
      message: e.message,
    })),
  });
}

/** null/empty/whitespace constraints mean "all versions" — stored as null. */
function normalizeConstraint(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * §2 grammar check on one constraint field. Returns the error message or null.
 * `null`/empty is valid (any version); anything unparsable is rejected — never
 * silently coerced (pinned-1 `isValidConstraint` semantics).
 */
function constraintError(field: string, value: string | null | undefined): string | null {
  const normalized = normalizeConstraint(value);
  if (normalized === null) return null;
  if (isValidConstraint(normalized)) return null;
  return (
    `Invalid version constraint for ${field}: ${JSON.stringify(value)} — ` +
    'expected the §2 grammar (=9.4, !=10, >=9.2, >9.2, <=10, <10)'
  );
}

interface RuleRow {
  id: string;
  name: string;
  description?: string | null;
  fromProductId: string;
  fromVersionConstraint?: string | null;
  toProductId: string;
  toVersionConstraint?: string | null;
  kind: 'REQUIRES' | 'FORBIDS';
  severity: 'HARD' | 'SOFT';
  scopeType: 'GLOBAL' | 'PRODUCT';
  scopeProductId?: string | null;
  justification?: string | null;
  isActive?: boolean;
}

/** The merged draft a POST/PATCH would persist (structural engine input). */
interface RuleDraft {
  id: string;
  name: string;
  description?: string | null;
  fromProductId: string;
  fromVersionConstraint?: string | null;
  toProductId: string;
  toVersionConstraint?: string | null;
  kind: 'REQUIRES' | 'FORBIDS';
  severity: 'HARD' | 'SOFT';
  scopeType: 'GLOBAL' | 'PRODUCT';
  scopeProductId?: string | null;
  justification?: string | null;
  isActive?: boolean;
}

/**
 * Structural shape checks shared by POST and PATCH (on the merged draft):
 * §2 constraint grammar + distinct products + scope coherence. Returns the
 * error message or null.
 */
function structuralError(draft: {
  fromProductId: string;
  fromVersionConstraint?: string | null;
  toProductId: string;
  toVersionConstraint?: string | null;
  scopeType: 'GLOBAL' | 'PRODUCT';
  scopeProductId?: string | null;
}): { message: string; path: string } | null {
  const fromError = constraintError('fromVersionConstraint', draft.fromVersionConstraint);
  if (fromError) return { message: fromError, path: 'fromVersionConstraint' };
  const toError = constraintError('toVersionConstraint', draft.toVersionConstraint);
  if (toError) return { message: toError, path: 'toVersionConstraint' };

  if (draft.fromProductId === draft.toProductId) {
    return {
      message:
        'fromProductId and toProductId must be distinct products: a compatibility rule relates two different products',
      path: 'toProductId',
    };
  }

  if (draft.scopeType === 'PRODUCT' && !draft.scopeProductId) {
    return {
      message: 'scopeProductId is required when scopeType is PRODUCT',
      path: 'scopeProductId',
    };
  }
  return null;
}

/**
 * Mandatory justification (spec §2 resolution rule 2): a PRODUCT-scoped rule
 * that relaxes the matching GLOBAL rule of the same (fromProductId,
 * toProductId) pair must carry a non-empty justification. Range comparison is
 * server-side against the stored GLOBAL rules (`isRelaxingOverride`, pinned-1).
 * Returns the error message or null.
 */
async function relaxationError(draft: RuleDraft): Promise<string | null> {
  if (draft.scopeType !== 'PRODUCT') return null;
  const justification = (draft.justification ?? '').trim();
  if (justification.length > 0) return null;

  const globals = await loadGlobalRulesForPair(draft.fromProductId, draft.toProductId, draft.id);
  for (const global of globals) {
    if (isRelaxingOverride(draft as CompatibilityRuleInput, global)) {
      return (
        'justification is required: this PRODUCT-scoped rule relaxes the matching GLOBAL rule ' +
        `for the pair (${draft.fromProductId} → ${draft.toProductId})`
      );
    }
  }
  return null;
}

/** ACTIVE GLOBAL rules of one (fromProductId, toProductId) pair, self excluded. */
async function loadGlobalRulesForPair(
  fromProductId: string,
  toProductId: string,
  excludeId?: string
): Promise<CompatibilityRuleInput[]> {
  if (typeof db.compatibilityRule?.findMany !== 'function') return [];
  const rows = await db.compatibilityRule.findMany({
    where: {
      fromProductId,
      toProductId,
      scopeType: 'GLOBAL',
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  });
  return (Array.isArray(rows) ? rows : []).filter(
    (row: RuleRow) => row.isActive !== false && row.id !== excludeId
  ) as CompatibilityRuleInput[];
}

function flagOn(value: unknown): boolean {
  const raw = String(value ?? '').toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

/**
 * The effective rule set for evaluation consumers: isActive=false rows are
 * excluded (the engine's resolveRules drops them as well). When
 * `containerProductId` is given, §2 override resolution is applied (scoped
 * rules win over the GLOBAL rule of the same pair inside that context).
 */
async function loadEffectiveRules(
  containerProductId?: string | null
): Promise<CompatibilityRuleInput[]> {
  if (typeof db.compatibilityRule?.findMany !== 'function') return [];
  const rows = await db.compatibilityRule.findMany({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  const active = (Array.isArray(rows) ? rows : []) as CompatibilityRuleInput[];
  return containerProductId ? resolveRules(active, containerProductId) : active;
}

// ---------------------------------------------------------------------------
// GET /compatibility-rules — list (admin) with filters
// ---------------------------------------------------------------------------

async function listRules(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = listQuerySchema.safeParse(req.query);
    if (!parsed.success) return zodError400(res, parsed.error);
    const query = parsed.data;

    const where: Record<string, unknown> = {};
    if (query.fromProductId) where.fromProductId = query.fromProductId;
    if (query.toProductId) where.toProductId = query.toProductId;
    if (query.scopeProductId) where.scopeProductId = query.scopeProductId;
    if (query.scopeType) where.scopeType = query.scopeType;
    if (query.kind) where.kind = query.kind;
    if (query.severity) where.severity = query.severity;

    // `?activeOnly=1` / `?effective=1`: effective rule set (isActive=true).
    const activeOnly = flagOn(req.query.activeOnly) || flagOn(req.query.effective);
    if (activeOnly) where.isActive = true;

    const rows = await db.compatibilityRule.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
    const list = (Array.isArray(rows) ? rows : []) as RuleRow[];

    // `?containerProductId=P` on an effective listing: §2 override resolution.
    if (activeOnly && typeof query.containerProductId === 'string' && query.containerProductId) {
      return res.json(resolveRules(list as CompatibilityRuleInput[], query.containerProductId));
    }
    return res.json(list);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /compatibility-rules/effective — effective rule set for consumers
// ---------------------------------------------------------------------------

async function listEffectiveRules(req: Request, res: Response, next: NextFunction) {
  try {
    const containerProductId =
      typeof req.query.containerProductId === 'string' ? req.query.containerProductId : null;
    const rows = await loadEffectiveRules(containerProductId);
    return res.json(rows);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// GET /compatibility-rules/:id
// ---------------------------------------------------------------------------

async function getRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String((req.params as any).id ?? '');
    if (id.length === 0) return validationError(res, 'id is required', 'id');

    const rule = await db.compatibilityRule.findUnique({ where: { id } });
    if (!rule) {
      return res.status(404).json({ error: 'Compatibility rule not found' });
    }
    return res.json(rule);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// POST /compatibility-rules — create
// ---------------------------------------------------------------------------

async function createRule(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createRuleSchema.safeParse(req.body);
    if (!parsed.success) return zodError400(res, parsed.error);
    const data = parsed.data;

    const scopeType = data.scopeType;
    const scopeProductId = scopeType === 'PRODUCT' ? data.scopeProductId ?? null : null;

    const draft: RuleDraft = {
      id: '',
      name: data.name,
      description: data.description ?? null,
      fromProductId: data.fromProductId,
      fromVersionConstraint: normalizeConstraint(data.fromVersionConstraint),
      toProductId: data.toProductId,
      toVersionConstraint: normalizeConstraint(data.toVersionConstraint),
      kind: data.kind,
      severity: data.severity,
      scopeType,
      scopeProductId,
      justification: data.justification?.trim() ? data.justification.trim() : null,
      isActive: data.isActive,
    };

    const structural = structuralError(draft);
    if (structural) return ruleError(res, structural.message, structural.path);

    const relaxation = await relaxationError(draft);
    if (relaxation) return ruleError(res, relaxation, 'justification');

    const rule = await db.compatibilityRule.create({
      data: {
        name: draft.name,
        description: draft.description ?? null,
        fromProductId: draft.fromProductId,
        fromVersionConstraint: draft.fromVersionConstraint,
        toProductId: draft.toProductId,
        toVersionConstraint: draft.toVersionConstraint,
        kind: draft.kind,
        severity: draft.severity,
        scopeType: draft.scopeType,
        scopeProductId: draft.scopeProductId,
        justification: draft.justification ?? null,
        ...(draft.isActive === undefined ? {} : { isActive: draft.isActive }),
      },
    });

    return res.status(201).json(rule);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// PATCH /compatibility-rules/:id — partial update
// ---------------------------------------------------------------------------

async function updateRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String((req.params as any).id ?? '');
    if (id.length === 0) return validationError(res, 'id is required', 'id');

    const parsed = updateRuleSchema.safeParse(req.body);
    if (!parsed.success) return zodError400(res, parsed.error);
    const patch = parsed.data;

    const existing = await db.compatibilityRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Compatibility rule not found' });
    }

    // Merge: PATCH fields win, everything else is kept (validation on the
    // result so partial edits cannot leave an inconsistent rule behind).
    const scopeType = patch.scopeType ?? (existing as RuleRow).scopeType;
    const scopeProductId =
      scopeType === 'PRODUCT'
        ? patch.scopeProductId !== undefined
          ? patch.scopeProductId
          : (existing as RuleRow).scopeProductId ?? null
        : null;

    const draft: RuleDraft = {
      id,
      name: patch.name ?? (existing as RuleRow).name,
      description:
        patch.description !== undefined ? patch.description : (existing as RuleRow).description ?? null,
      fromProductId: patch.fromProductId ?? (existing as RuleRow).fromProductId,
      fromVersionConstraint:
        patch.fromVersionConstraint !== undefined
          ? normalizeConstraint(patch.fromVersionConstraint)
          : normalizeConstraint((existing as RuleRow).fromVersionConstraint),
      toProductId: patch.toProductId ?? (existing as RuleRow).toProductId,
      toVersionConstraint:
        patch.toVersionConstraint !== undefined
          ? normalizeConstraint(patch.toVersionConstraint)
          : normalizeConstraint((existing as RuleRow).toVersionConstraint),
      kind: patch.kind ?? (existing as RuleRow).kind,
      severity: patch.severity ?? (existing as RuleRow).severity,
      scopeType,
      scopeProductId,
      justification:
        patch.justification !== undefined
          ? patch.justification?.trim()
            ? patch.justification.trim()
            : null
          : (existing as RuleRow).justification ?? null,
      isActive: patch.isActive ?? (existing as RuleRow).isActive,
    };

    const structural = structuralError(draft);
    if (structural) return ruleError(res, structural.message, structural.path);

    const relaxation = await relaxationError(draft);
    if (relaxation) return ruleError(res, relaxation, 'justification');

    const rule = await db.compatibilityRule.update({
      where: { id },
      data: {
        name: draft.name,
        description: draft.description ?? null,
        fromProductId: draft.fromProductId,
        fromVersionConstraint: draft.fromVersionConstraint,
        toProductId: draft.toProductId,
        toVersionConstraint: draft.toVersionConstraint,
        kind: draft.kind,
        severity: draft.severity,
        scopeType: draft.scopeType,
        scopeProductId: draft.scopeProductId,
        justification: draft.justification ?? null,
        ...(patch.isActive === undefined ? {} : { isActive: patch.isActive }),
      },
    });

    return res.json(rule);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// DELETE /compatibility-rules/:id
// ---------------------------------------------------------------------------

async function deleteRule(req: Request, res: Response, next: NextFunction) {
  try {
    const id = String((req.params as any).id ?? '');
    if (id.length === 0) return validationError(res, 'id is required', 'id');

    const existing = await db.compatibilityRule.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Compatibility rule not found' });
    }

    await db.compatibilityRule.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Route registration — canonical bare paths + nested-mount aliases
// ---------------------------------------------------------------------------

/**
 * Bare handlers only serve when this router is mounted on the
 * `/compatibility-rules` prefix (e.g. `/api/compatibility-rules`); under any
 * other mount they fall through so sibling routers are not shadowed.
 */
function mountedAtCompatibilityRules(req: Request): boolean {
  return /\/compatibility-rules\/?$/.test(req.baseUrl || '');
}

function bare(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!mountedAtCompatibilityRules(req)) return next();
    return handler(req, res, next);
  };
}

// Alias (mount at `/api`) — canonical REST paths under the collection name.
router.get('/compatibility-rules', listRules);
router.get('/compatibility-rules/effective', listEffectiveRules);
router.post('/compatibility-rules', createRule);
router.get('/compatibility-rules/:id', getRule);
router.patch('/compatibility-rules/:id', updateRule);
router.delete('/compatibility-rules/:id', deleteRule);

// Canonical (mount at `/api/compatibility-rules`).
router.get('/', bare(listRules));
router.get('/effective', bare(listEffectiveRules));
router.post('/', bare(createRule));
router.get('/:id', bare(getRule));
router.patch('/:id', bare(updateRule));
router.delete('/:id', bare(deleteRule));

export { router as compatibilityRuleRoutes };
export { router as compatibilityRulesRoutes };
export { router as compatibilityRulesRouter };
export { loadEffectiveRules };
export default router;
