/**
 * Compatibility engine — unit tests (spec "Stacks de produits & matrice de
 * compatibilité" §2/§3). Pure functions only: no Prisma, no HTTP.
 */
import {
  evaluateComposition,
  evaluatePair,
  isRelaxingOverride,
  isValidConstraint,
  parseConstraint,
  resolveRules,
  satisfiesConstraint,
  versionMatchesConstraint,
  type CompatibilityRuleInput,
} from '../lib/compatibility';
import {
  compareVersionTuples,
  parseVersionTuple,
  versionTupleFields,
} from '../lib/version';

const PG = 'product-pg';
const VM = 'product-vm';
const OS = 'product-os';

function rule(overrides: Partial<CompatibilityRuleInput> & { id: string }): CompatibilityRuleInput {
  return {
    name: overrides.id,
    fromProductId: PG,
    toProductId: VM,
    kind: 'REQUIRES',
    severity: 'HARD',
    scopeType: 'GLOBAL',
    isActive: true,
    ...overrides,
  } as CompatibilityRuleInput;
}

describe('version tuples (§1.1)', () => {
  it('parses numeric versions, missing segments = 0', () => {
    expect(parseVersionTuple('16.3')).toEqual({ major: 16, minor: 3, patch: 0 });
    expect(parseVersionTuple('v3')).toEqual({ major: 3, minor: 0, patch: 0 });
    expect(parseVersionTuple('9.4.2')).toEqual({ major: 9, minor: 4, patch: 2 });
  });

  it('returns null for non-normalisable versions', () => {
    expect(parseVersionTuple('gen8')).toBeNull();
    expect(parseVersionTuple('11 (Bullseye)')).toBeNull();
    expect(parseVersionTuple('')).toBeNull();
    expect(parseVersionTuple(null)).toBeNull();
    expect(parseVersionTuple('1.2.3.4')).toBeNull();
  });

  it('derives null tuple columns for non-numeric versions', () => {
    expect(versionTupleFields('16.3')).toEqual({ versionMajor: 16, versionMinor: 3, versionPatch: 0 });
    expect(versionTupleFields('gen8')).toEqual({ versionMajor: null, versionMinor: null, versionPatch: null });
  });

  it('compares tuples deterministically', () => {
    expect(compareVersionTuples({ major: 2, minor: 0, patch: 0 }, { major: 3, minor: 0, patch: 0 })).toBe(-1);
    expect(compareVersionTuples({ major: 3, minor: 1, patch: 0 }, { major: 3, minor: 0, patch: 5 })).toBe(1);
    expect(compareVersionTuples({ major: 3, minor: 0, patch: 0 }, { major: 3, minor: 0, patch: 0 })).toBe(0);
    expect(compareVersionTuples(null, { major: 1, minor: 0, patch: 0 })).toBe(1);
  });
});

describe('§2 constraint grammar', () => {
  it('accepts the documented operators', () => {
    for (const c of ['=9.4', '!=10', '>=9.2', '>9.2', '<=10', '<10', '>=17']) {
      expect(isValidConstraint(c)).toBe(true);
    }
    expect(isValidConstraint(null)).toBe(true);
    expect(isValidConstraint('')).toBe(true);
  });

  it('rejects unparsable constraints', () => {
    for (const c of ['~9', '9.4+', '>=x', '>=1.2.3.4', '9.4']) {
      expect(isValidConstraint(c)).toBe(false);
    }
  });

  it('parses and compares ranges against tuples', () => {
    expect(versionMatchesConstraint('>=3', { major: 4, minor: 0, patch: 0 })).toBe(true);
    expect(versionMatchesConstraint('>=3', { major: 2, minor: 9, patch: 9 })).toBe(false);
    expect(versionMatchesConstraint('!=10', { major: 10, minor: 0, patch: 0 })).toBe(false);
    expect(versionMatchesConstraint('=9.4', { major: 9, minor: 4, patch: 0 })).toBe(true);
  });

  it('null/empty constraint is ANY; null tuple satisfies only ANY', () => {
    expect(satisfiesConstraint(parseConstraint(null), null)).toBe(true);
    expect(satisfiesConstraint(parseConstraint('>=3'), null)).toBe(false);
    expect(satisfiesConstraint(parseConstraint('>=3'), undefined)).toBe(false);
  });

  it('throws on unparsable constraints (never silently coerces)', () => {
    expect(() => parseConstraint('>=garbage')).toThrow();
    expect(() => parseConstraint('==9')).toThrow();
  });
});

describe('§3 evaluatePair', () => {
  const rules: CompatibilityRuleInput[] = [
    rule({ id: 'r1', name: 'PG>=17 REQUIRES VM>=4', fromVersionConstraint: '>=17', toVersionConstraint: '>=4' }),
  ];

  it('VALID when the requirement is satisfied', () => {
    const res = evaluatePair(PG, { productId: PG, tuple: { major: 17, minor: 1, patch: 0 } }, { productId: VM, tuple: { major: 4, minor: 0, patch: 0 } }, rules);
    expect(res.verdict).toBe('VALID');
    expect(res.findings.every((f) => f.satisfied)).toBe(true);
    expect(res.findings[0].ruleName).toBe('PG>=17 REQUIRES VM>=4');
  });

  it('BLOCKED when a HARD requirement is violated', () => {
    const res = evaluatePair(PG, { productId: PG, tuple: { major: 17, minor: 0, patch: 0 } }, { productId: VM, tuple: { major: 3, minor: 0, patch: 0 } }, rules);
    expect(res.verdict).toBe('BLOCKED');
    const finding = res.findings.find((f) => !f.satisfied);
    expect(finding?.reason).toBe('required-version-out-of-range');
    expect(finding?.severity).toBe('HARD');
    expect(finding?.toVersionConstraint).toBe('>=4');
  });

  it('WARNING when only SOFT rules are violated', () => {
    const soft = [rule({ id: 'r2', severity: 'SOFT', fromVersionConstraint: '<15', toVersionConstraint: '>=4', kind: 'FORBIDS' })];
    const res = evaluatePair(PG, { productId: PG, tuple: { major: 14, minor: 0, patch: 0 } }, { productId: VM, tuple: { major: 4, minor: 0, patch: 0 } }, soft);
    expect(res.verdict).toBe('WARNING');
  });

  it('rule out of from-scope contributes a satisfied pair-out-of-scope finding', () => {
    const res = evaluatePair(PG, { productId: PG, tuple: { major: 16, minor: 3, patch: 0 } }, { productId: VM, tuple: { major: 3, minor: 0, patch: 0 } }, rules);
    expect(res.verdict).toBe('VALID');
    expect(res.findings[0].reason).toBe('pair-out-of-scope');
  });

  it('FORBIDS blocks co-occurrence inside the forbidden range', () => {
    const forbids = [rule({ id: 'r3', kind: 'FORBIDS', severity: 'HARD', fromVersionConstraint: '<15', toVersionConstraint: '>=4' })];
    const blocked = evaluatePair(PG, { productId: PG, tuple: { major: 14, minor: 12, patch: 0 } }, { productId: VM, tuple: { major: 4, minor: 0, patch: 0 } }, forbids);
    expect(blocked.verdict).toBe('BLOCKED');
    expect(blocked.findings[0].reason).toBe('forbidden-co-occurrence');
    const ok = evaluatePair(PG, { productId: PG, tuple: { major: 14, minor: 12, patch: 0 } }, { productId: VM, tuple: { major: 2, minor: 0, patch: 0 } }, forbids);
    expect(ok.verdict).toBe('VALID');
  });

  it('a null (non-numeric) tuple satisfies only ANY constraints', () => {
    const res = evaluatePair(PG, { productId: PG, tuple: null }, { productId: VM, tuple: { major: 3, minor: 0, patch: 0 } }, rules);
    expect(res.verdict).toBe('VALID');
    expect(res.findings[0].reason).toBe('pair-out-of-scope');
  });

  it('rules on unrelated product pairs contribute nothing', () => {
    const res = evaluatePair(PG, { productId: PG, tuple: { major: 17, minor: 0, patch: 0 } }, { productId: OS, tuple: { major: 9, minor: 4, patch: 0 } }, rules);
    expect(res.findings).toHaveLength(0);
    expect(res.verdict).toBe('VALID');
  });
});

describe('§2 resolveRules — overrides', () => {
  it('a PRODUCT-scoped rule overrides the GLOBAL rule of the same pair inside its context', () => {
    const global = rule({ id: 'g', fromVersionConstraint: '>=17', toVersionConstraint: '>=4' });
    const scoped = rule({ id: 's', scopeType: 'PRODUCT', scopeProductId: PG, fromVersionConstraint: '>=17', toVersionConstraint: '>=3', justification: 'backport certifié' });

    const inPg = resolveRules([global, scoped], PG);
    expect(inPg.map((r) => r.id)).toEqual(['s']);

    const inOther = resolveRules([global, scoped], 'other-product');
    expect(inOther.map((r) => r.id)).toEqual(['g']);
  });

  it('inactive rules are dropped', () => {
    const disabled = rule({ id: 'off', isActive: false });
    expect(resolveRules([disabled], PG)).toHaveLength(0);
  });

  it('a scoped rule with no GLOBAL counterpart is kept as a contextual restriction', () => {
    const scoped = rule({ id: 's', scopeType: 'PRODUCT', scopeProductId: PG });
    expect(resolveRules([scoped], PG).map((r) => r.id)).toEqual(['s']);
    expect(resolveRules([scoped], 'other')).toHaveLength(0);
  });
});

describe('isRelaxingOverride (mandatory justification)', () => {
  it('detects a strictly wider scoped rule', () => {
    const global = rule({ id: 'g', fromVersionConstraint: '>=17', toVersionConstraint: '>=4' });
    const relax = rule({ id: 's', scopeType: 'PRODUCT', scopeProductId: PG, fromVersionConstraint: '>=17', toVersionConstraint: '>=3' });
    expect(isRelaxingOverride(relax, global)).toBe(true);
  });

  it('a tighter scoped rule is not a relaxation', () => {
    const global = rule({ id: 'g', fromVersionConstraint: '>=17', toVersionConstraint: '>=3' });
    const tighter = rule({ id: 's', scopeType: 'PRODUCT', scopeProductId: PG, fromVersionConstraint: '>=17', toVersionConstraint: '>=4' });
    expect(isRelaxingOverride(tighter, global)).toBe(false);
  });

  it('different kinds never relax each other', () => {
    const global = rule({ id: 'g', kind: 'REQUIRES' });
    const forbids = rule({ id: 's', kind: 'FORBIDS', scopeType: 'PRODUCT', scopeProductId: PG });
    expect(isRelaxingOverride(forbids, global)).toBe(false);
  });
});

describe('§3 evaluateComposition', () => {
  it('requires presence: an absent required component is a violation', () => {
    const rules = [rule({ id: 'r', fromVersionConstraint: '>=17', toVersionConstraint: '>=4' })];
    const res = evaluateComposition(
      { productId: PG, tuple: { major: 17, minor: 0, patch: 0 } },
      [{ productId: PG, tuple: { major: 17, minor: 0, patch: 0 } }],
      rules
    );
    expect(res.verdict).toBe('BLOCKED');
    const missing = res.findings.find((f) => f.reason === 'required-missing');
    expect(missing?.satisfied).toBe(false);
  });

  it('evaluates every unordered pair (PG + VM stack)', () => {
    const rules = [
      rule({ id: 'r1', fromVersionConstraint: '>=16', toVersionConstraint: '>=3' }),
    ];
    const valid = evaluateComposition(
      { productId: PG, tuple: { major: 16, minor: 3, patch: 0 } },
      [
        { productId: PG, tuple: { major: 16, minor: 3, patch: 0 } },
        { productId: VM, tuple: { major: 3, minor: 0, patch: 0 } },
      ],
      rules
    );
    expect(valid.verdict).toBe('VALID');

    const blocked = evaluateComposition(
      { productId: PG, tuple: { major: 16, minor: 3, patch: 0 } },
      [
        { productId: PG, tuple: { major: 16, minor: 3, patch: 0 } },
        { productId: VM, tuple: { major: 2, minor: 0, patch: 0 } },
      ],
      rules
    );
    expect(blocked.verdict).toBe('BLOCKED');
    const finding = blocked.findings.find((f) => !f.satisfied);
    expect(finding?.fromProductId).toBe(PG);
    expect(finding?.toProductId).toBe(VM);
    expect(finding?.toVersionConstraint).toBe('>=3');
  });
});
