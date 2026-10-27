/**
 * Compatibility engine — spec "Stacks de produits & matrice de compatibilité"
 * §2 (constraint grammar) and §3 (verdict computation). Pure functions only:
 * no Prisma, no I/O — the components API, the rules API and the matrix all
 * consume these from plain data (rule rows are plain objects structurally
 * compatible with the `CompatibilityRule` model).
 *
 * Grammar (§2): a constraint is `operator + version`, one operator per rule
 * (`null`/empty = all versions):
 *
 *   =9.4  !=10  >=9.2  >9.2  <=10  <10
 *
 * Versions are normalised to tuples via `./version` (`major[.minor[.patch]]`,
 * missing segments = 0); comparisons run on tuples.
 */

import { compareVersionTuples, parseVersionTuple, type VersionTuple } from './version';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Verdict = 'VALID' | 'WARNING' | 'BLOCKED';

export type ConstraintOperator = '=' | '!=' | '>=' | '>' | '<=' | '<';

/** A parsed §2 constraint. `ANY` is produced for null/empty constraints. */
export interface ParsedConstraint {
  kind: 'ANY' | 'RANGE';
  operator: ConstraintOperator;
  tuple: VersionTuple;
  /** The original constraint string (`''` for ANY). */
  raw: string;
}

/** Structural shape of a `CompatibilityRule` row (Prisma-free). */
export interface CompatibilityRuleInput {
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

/** One product + version tuple as evaluated. */
export interface ComponentInput {
  productId: string;
  tuple: VersionTuple | null;
}

/** A verdict finding: the motivating rule (name + constraint) and outcome. */
export interface CompatibilityFinding {
  ruleId: string;
  ruleName: string;
  fromProductId: string;
  fromVersionConstraint: string | null;
  toProductId: string;
  toVersionConstraint: string | null;
  kind: 'REQUIRES' | 'FORBIDS';
  severity: 'HARD' | 'SOFT';
  satisfied: boolean;
  /** Machine-readable reason, for API/UI detail. */
  reason:
    | 'required-missing'
    | 'required-version-out-of-range'
    | 'forbidden-co-occurrence'
    | 'pair-out-of-scope'
    | 'ok';
}

export interface EvaluationResult {
  verdict: Verdict;
  findings: CompatibilityFinding[];
}

// ---------------------------------------------------------------------------
// §2 Constraint grammar
// ---------------------------------------------------------------------------

const CONSTRAINT_RE = /^(<=|>=|!=|=|<|>)\s*(\d+(?:\.\d+){0,2})$/;
const OPERATORS = new Set<string>(['=', '!=', '>=', '>', '<=', '<']);

/** True when the string is a parseable §2 constraint (null/empty included). */
export function isValidConstraint(constraint: string | null | undefined): boolean {
  if (constraint == null) return true;
  const trimmed = constraint.trim();
  if (trimmed.length === 0) return true;
  return CONSTRAINT_RE.test(trimmed) && parseVersionTuple(extractVersion(trimmed)) !== null;
}

/**
 * Parse a §2 constraint against normalised tuples.
 * - `null` or empty string → `{ kind: 'ANY' }` (all versions);
 * - `=9.4 | !=10 | >=9.2 | >9.2 | <=10 | <10` → `{ kind: 'RANGE', operator, tuple }`;
 * - anything else (unknown operator, non-numeric version segment, >3 segments)
 *   throws — unparsable strings are rejected, never silently coerced.
 */
export function parseConstraint(constraint: string | null | undefined): ParsedConstraint {
  if (constraint == null || constraint.trim().length === 0) {
    return { kind: 'ANY', operator: '=', tuple: { major: 0, minor: 0, patch: 0 }, raw: '' };
  }
  const trimmed = constraint.trim();
  const match = CONSTRAINT_RE.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid version constraint: ${JSON.stringify(constraint)}`);
  }
  const operator = match[1] as ConstraintOperator;
  if (!OPERATORS.has(operator)) {
    throw new Error(`Invalid version constraint: ${JSON.stringify(constraint)}`);
  }
  const tuple = parseVersionTuple(match[2]);
  if (!tuple) {
    throw new Error(`Invalid version constraint: ${JSON.stringify(constraint)}`);
  }
  return { kind: 'RANGE', operator, tuple, raw: trimmed };
}

/** Extract the version part of a constraint string (helper for validation). */
function extractVersion(constraint: string): string {
  const match = CONSTRAINT_RE.exec(constraint.trim());
  return match ? match[2] : '';
}

/**
 * Test a tuple against a parsed constraint.
 * - ANY → always satisfied;
 * - a null (non-normalisable) tuple only satisfies ANY (phase 1 rule: range
 *   rules simply do not apply to non-normalisable versions);
 * - `!=` between tuples is the exact negation of `=`.
 */
export function satisfiesConstraint(
  constraint: ParsedConstraint,
  tuple: VersionTuple | null | undefined
): boolean {
  if (constraint.kind === 'ANY') return true;
  if (!tuple) return false;
  const cmp = compareVersionTuples(tuple, constraint.tuple);
  switch (constraint.operator) {
    case '=':
      return cmp === 0;
    case '!=':
      return cmp !== 0;
    case '>':
      return cmp === 1;
    case '>=':
      return cmp !== -1;
    case '<':
      return cmp === -1;
    case '<=':
      return cmp !== 1;
    default:
      return false;
  }
}

/** Convenience: evaluate a raw constraint string against a tuple. */
export function versionMatchesConstraint(
  constraint: string | null | undefined,
  tuple: VersionTuple | null | undefined
): boolean {
  return satisfiesConstraint(parseConstraint(constraint), tuple);
}

// ---------------------------------------------------------------------------
// §2 Rule-scope resolution
// ---------------------------------------------------------------------------

const ruleIsUsable = (rule: CompatibilityRuleInput): boolean => rule.isActive !== false;

/**
 * True when `scoped` allows strictly more than `global` (relaxation): it is a
 * superset of the global applicability for at least one version tuple. Used by
 * the rules API to require `justification` on relaxing overrides; here it is
 * pure (probe tuples + boundary probes around the global bounds).
 */
export function isRelaxingOverride(
  scoped: CompatibilityRuleInput,
  global: CompatibilityRuleInput
): boolean {
  let scopedFrom: ParsedConstraint;
  let scopedTo: ParsedConstraint;
  let globalFrom: ParsedConstraint;
  let globalTo: ParsedConstraint;
  try {
    scopedFrom = parseConstraint(scoped.fromVersionConstraint);
    scopedTo = parseConstraint(scoped.toVersionConstraint);
    globalFrom = parseConstraint(global.fromVersionConstraint);
    globalTo = parseConstraint(global.toVersionConstraint);
  } catch {
    return false;
  }
  if (scoped.kind !== global.kind) return false;

  const notCoveredByGlobal = (from: VersionTuple, to: VersionTuple): boolean =>
    !satisfiesConstraint(globalFrom, from) || !satisfiesConstraint(globalTo, to);
  const allowedByScoped = (from: VersionTuple, to: VersionTuple): boolean =>
    satisfiesConstraint(scopedFrom, from) && satisfiesConstraint(scopedTo, to);

  for (const probe of relaxationProbes(globalFrom, globalTo)) {
    if (allowedByScoped(probe.from, probe.to) && notCoveredByGlobal(probe.from, probe.to)) {
      return true;
    }
  }
  return false;
}

const probeBase = (): VersionTuple => ({ major: 1, minor: 0, patch: 0 });

/** Probe tuples around the global bounds to detect a strictly wider range. */
function relaxationProbes(
  globalFrom: ParsedConstraint,
  globalTo: ParsedConstraint
): Array<{ from: VersionTuple; to: VersionTuple }> {
  const froms = boundaryProbes(globalFrom);
  const tos = boundaryProbes(globalTo);
  const probes: Array<{ from: VersionTuple; to: VersionTuple }> = [];
  for (const from of froms) {
    for (const to of tos) probes.push({ from, to });
  }
  return probes;
}

function boundaryProbes(constraint: ParsedConstraint): VersionTuple[] {
  const base = probeBase();
  if (constraint.kind === 'ANY') return [base];
  const t = constraint.tuple;
  const minus: VersionTuple = { major: t.major, minor: t.minor, patch: t.patch - 1 };
  const plus: VersionTuple = { major: t.major, minor: t.minor, patch: t.patch + 1 };
  return [base, t, minus, plus];
}

/**
 * §2 override resolution. For an evaluation in the context of container
 * product P:
 *
 * 1. `scopeType=PRODUCT, scopeProductId=P` rules override the GLOBAL rule of
 *    the same (fromProductId, toProductId) pair — scoped wins entirely;
 * 2. scoped rules of other products are ignored;
 * 3. inactive rules are dropped.
 *
 * A pair scoped to P that carries no GLOBAL counterpart is kept as-is (it is
 * a contextual extra restriction, not an override).
 */
export function resolveRules(
  rules: CompatibilityRuleInput[],
  containerProductId: string | null | undefined
): CompatibilityRuleInput[] {
  const usable = rules.filter(ruleIsUsable);
  const scopedByPair = new Map<string, CompatibilityRuleInput[]>();
  const globals: CompatibilityRuleInput[] = [];

  for (const rule of usable) {
    if (rule.scopeType === 'PRODUCT') {
      // Scoped to a different product: not relevant in this context.
      if (!containerProductId || rule.scopeProductId !== containerProductId) continue;
      const key = pairKey(rule.fromProductId, rule.toProductId);
      const list = scopedByPair.get(key);
      if (list) list.push(rule);
      else scopedByPair.set(key, [rule]);
    } else {
      globals.push(rule);
    }
  }

  const resolved: CompatibilityRuleInput[] = [];
  for (const global of globals) {
    const key = pairKey(global.fromProductId, global.toProductId);
    if (scopedByPair.has(key)) continue; // overridden inside P's context
    resolved.push(global);
  }
  for (const list of scopedByPair.values()) resolved.push(...list);

  return resolved;
}

function pairKey(fromProductId: string, toProductId: string): string {
  return `${fromProductId}\u0000${toProductId}`;
}

// ---------------------------------------------------------------------------
// §3 Verdict computation
// ---------------------------------------------------------------------------

function findingFor(
  rule: CompatibilityRuleInput,
  satisfied: boolean,
  reason: CompatibilityFinding['reason']
): CompatibilityFinding {
  return {
    ruleId: rule.id,
    ruleName: rule.name,
    fromProductId: rule.fromProductId,
    fromVersionConstraint: rule.fromVersionConstraint ?? null,
    toProductId: rule.toProductId,
    toVersionConstraint: rule.toVersionConstraint ?? null,
    kind: rule.kind,
    severity: rule.severity,
    satisfied,
    reason,
  };
}

/** BLOCKED when a HARD rule is unsatisfied, WARNING when only SOFT ones are. */
function verdictFor(findings: CompatibilityFinding[]): Verdict {
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

function constraintPairs(
  rule: CompatibilityRuleInput
): { from: ParsedConstraint; to: ParsedConstraint } {
  return {
    from: parseConstraint(rule.fromVersionConstraint),
    to: parseConstraint(rule.toVersionConstraint),
  };
}

/**
 * Evaluate one product pair (a, b) under the effective rules of context
 * `ctxProductId`. Each applicable rule yields a finding with `satisfied` and
 * the motivating rule (name + constraints). Rules out of the pair's scope
 * contribute nothing.
 */
export function evaluatePair(
  ctxProductId: string | null | undefined,
  a: ComponentInput,
  b: ComponentInput,
  rules: CompatibilityRuleInput[]
): EvaluationResult {
  return evaluatePairResolved(resolveRules(rules, ctxProductId), a, b);
}

/**
 * `evaluatePair` on already-resolved rules (matrix cells avoid re-resolving
 * per row). Directional: rule (A → B) is evaluated with a = A side, b = B side.
 */
export function evaluatePairResolved(
  resolvedRules: CompatibilityRuleInput[],
  a: ComponentInput,
  b: ComponentInput
): EvaluationResult {
  const findings: CompatibilityFinding[] = [];

  for (const rule of resolvedRules) {
    const aIsFrom = a.productId === rule.fromProductId && b.productId === rule.toProductId;
    const aIsTo = a.productId === rule.toProductId && b.productId === rule.fromProductId;
    if (!aIsFrom && !aIsTo) continue;

    const fromComp = aIsFrom ? a : b;
    const toComp = aIsFrom ? b : a;
    const { from, to } = constraintPairs(rule);

    // Rule evaluated only when the `from` product is present with a version in
    // `fromVersionConstraint` (§2 semantics).
    if (!satisfiesConstraint(from, fromComp.tuple)) {
      findings.push(findingFor(rule, true, 'pair-out-of-scope'));
      continue;
    }

    if (rule.kind === 'REQUIRES') {
      const satisfied = satisfiesConstraint(to, toComp.tuple);
      findings.push(
        findingFor(rule, satisfied, satisfied ? 'ok' : 'required-version-out-of-range')
      );
    } else {
      // FORBIDS: no co-occurrence in the forbidden range.
      const forbidden = satisfiesConstraint(to, toComp.tuple);
      findings.push(findingFor(rule, !forbidden, forbidden ? 'forbidden-co-occurrence' : 'ok'));
    }
  }

  return { verdict: verdictFor(findings), findings };
}

/**
 * Evaluate a full composition: the container version's components under the
 * effective rules of the container product. Covers every unordered pair plus
 * presence requirements (REQUIRES with an absent `to` product).
 *
 * Each REQUIRES rule fires exactly once: when the `to` product is co-present
 * it is evaluated on the pair; when it is absent it yields
 * `required-missing`. FORBIDS rules only concern co-occurrence and are
 * evaluated per pair.
 */
export function evaluateComposition(
  containerVersion: { productId: string; versionId?: string | null; tuple?: VersionTuple | null },
  components: ComponentInput[],
  rules: CompatibilityRuleInput[]
): EvaluationResult {
  const resolved = resolveRules(rules, containerVersion.productId);
  return evaluateCompositionResolved(resolved, components);
}

/** `evaluateComposition` on already-resolved rules (live validation path). */
export function evaluateCompositionResolved(
  resolvedRules: CompatibilityRuleInput[],
  components: ComponentInput[]
): EvaluationResult {
  const findings: CompatibilityFinding[] = [];

  // All unordered product pairs.
  for (let i = 0; i < components.length; i += 1) {
    for (let j = i + 1; j < components.length; j += 1) {
      findings.push(...evaluatePairResolved(resolvedRules, components[i], components[j]).findings);
    }
  }

  // Presence requirements (REQUIRES with the `to` product absent).
  for (const rule of resolvedRules) {
    if (rule.kind !== 'REQUIRES') continue;
    const fromComp = components.find((c) => c.productId === rule.fromProductId);
    if (!fromComp) continue;
    const { from } = constraintPairs(rule);
    if (!satisfiesConstraint(from, fromComp.tuple)) continue; // out of scope
    const toComp = components.find((c) => c.productId === rule.toProductId);
    if (!toComp) {
      findings.push(findingFor(rule, false, 'required-missing'));
    }
    // co-present `to` products (satisfied or not) are reported by the pair pass
  }

  return { verdict: verdictFor(findings), findings };
}
