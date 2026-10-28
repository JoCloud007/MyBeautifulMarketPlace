/**
 * CompatibilityRuleModal — rule composer expressed as a sentence.
 * Redesign (2026-10-28): the client rejected the source/target + kind/severity
 * form. A rule now reads as: "Quand la STACK est X dans les versions <range>,
 * elle exige/interdit le COMPOSANT Y dans les versions <range>" — consequence
 * Bloquant (HARD) or Avertissement (SOFT). The persisted payload and the
 * RuleFormValues contract are unchanged (Admin.tsx keeps working).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  isRuleDraftValid,
  isValidConstraintInput,
  type CompatibilityRule,
  type RuleKind,
  type RuleScope,
  type RuleSeverity,
} from '@/hooks/useCompatibilityAdmin';

export interface RuleFormValues {
  name: string;
  description: string;
  fromProductId: string;
  fromVersionConstraint: string;
  toProductId: string;
  toVersionConstraint: string;
  kind: RuleKind;
  severity: RuleSeverity;
  scopeType: RuleScope;
  scopeProductId: string;
  justification: string;
  isActive: boolean;
}

export interface ProductOption {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Sentence vocabulary (client wording — maps onto the engine enums)
// ---------------------------------------------------------------------------

export const CONSTRAINT_OPERATORS = ['>=', '>', '=', '!=', '<=', '<'] as const;
type ConstraintOperator = (typeof CONSTRAINT_OPERATORS)[number];

/** ">=17" → { op: '>=', version: '17' }; empty → { op: '>=', version: '' }. */
export function splitConstraint(constraint: string | null | undefined): {
  op: ConstraintOperator;
  version: string;
} {
  const trimmed = (constraint ?? '').trim();
  if (trimmed.length === 0) return { op: '>=', version: '' };
  const match = /^(<=|>=|!=|=|<|>)\s*(\d+(?:\.\d+){0,2})$/.exec(trimmed);
  if (!match) return { op: '>=', version: '' };
  return { op: match[1] as ConstraintOperator, version: match[2] };
}

export function joinConstraint(op: ConstraintOperator, version: string): string {
  const v = version.trim();
  return v.length === 0 ? '' : `${op}${v}`;
}

/** Human constraint rendering: ">= 4", "= 9.4", "toutes versions" when empty. */
export function constraintLabel(constraint: string | null | undefined): string {
  const trimmed = (constraint ?? '').trim();
  if (trimmed.length === 0) return 'toutes versions';
  const { op, version } = splitConstraint(trimmed);
  return version ? `${op} ${version}` : trimmed;
}

// ---------------------------------------------------------------------------
// RuleSentence — read a rule as a sentence (used by the cell panel too)
// ---------------------------------------------------------------------------

interface RuleSentenceProps {
  rule: {
    name: string;
    fromProductId?: string;
    fromVersionConstraint?: string | null;
    toProductId?: string;
    toVersionConstraint?: string | null;
    kind: RuleKind;
    severity: RuleSeverity;
    scopeType?: RuleScope;
    scopeProductId?: string | null;
  };
  /** Resolve product ids to display names (stack + component sides). */
  productName: (id: string) => string;
}

const CHIP = 'inline-flex items-center rounded-md border border-blue-500/50 bg-blue-500/15 px-2 py-0.5 font-semibold text-blue-300';

/** Reads a rule as one sentence — also used by the cell panel of the designer. */
export function RuleSentenceText({ rule, productName }: RuleSentenceProps) {
  const requires = rule.kind === 'REQUIRES';
  return (
    <span className="leading-relaxed">
      Quand la <span className="font-bold text-blue-300">stack</span> est{' '}
      <span className={CHIP}>{productName(rule.fromProductId ?? '')}</span>{' '}
      dans les versions <span className={CHIP}>{constraintLabel(rule.fromVersionConstraint)}</span>,
      elle{' '}
      <span className={requires ? 'font-bold text-emerald-400' : 'font-bold text-red-400'}>
        {requires ? 'exige' : 'interdit'}
      </span>{' '}
      le composant <span className={CHIP}>{productName(rule.toProductId ?? '')}</span>{' '}
      dans les versions <span className={CHIP}>{constraintLabel(rule.toVersionConstraint)}</span>.
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form
// ---------------------------------------------------------------------------

interface CompatibilityRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode. */
  rule: CompatibilityRule | null;
  products: ProductOption[];
  onSubmit: (values: RuleFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
  /** Pre-fill the pair from a clicked matrix cell (stack × component). */
  defaultPair?: { fromProductId?: string; toProductId?: string } | null;
}

const OPERATOR_OPTIONS: { value: ConstraintOperator; label: string }[] = [
  { value: '>=', label: '≥' },
  { value: '>', label: '>' },
  { value: '=', label: '=' },
  { value: '!=', label: '≠' },
  { value: '<=', label: '≤' },
  { value: '<', label: '<' },
];

function emptyForm(): RuleFormValues {
  return {
    name: '',
    description: '',
    fromProductId: '',
    fromVersionConstraint: '',
    toProductId: '',
    toVersionConstraint: '',
    kind: 'REQUIRES',
    severity: 'HARD',
    scopeType: 'GLOBAL',
    scopeProductId: '',
    justification: '',
    isActive: true,
  };
}

function formFromRule(rule: CompatibilityRule): RuleFormValues {
  return {
    name: rule.name ?? '',
    description: rule.description ?? '',
    fromProductId: rule.fromProductId ?? '',
    fromVersionConstraint: rule.fromVersionConstraint ?? '',
    toProductId: rule.toProductId ?? '',
    toVersionConstraint: rule.toVersionConstraint ?? '',
    kind: rule.kind,
    severity: rule.severity,
    scopeType: rule.scopeType,
    scopeProductId: rule.scopeProductId ?? '',
    justification: rule.justification ?? '',
    isActive: rule.isActive !== false,
  };
}

/** Auto rule name: "PG 17+ exige VM >=4" — enough for findings and lists. */
function autoName(form: RuleFormValues, nameOf: (id: string) => string): string {
  const from = nameOf(form.fromProductId) || 'Stack';
  const to = nameOf(form.toProductId) || 'Composant';
  const fromC = form.fromVersionConstraint.trim();
  const toC = form.toVersionConstraint.trim();
  const verb = form.kind === 'REQUIRES' ? 'exige' : 'interdit';
  return `${from}${fromC ? ` ${fromC}` : ''} ${verb} ${to}${toC ? ` ${toC}` : ''}`;
}

function VersionRangePicker({
  id,
  op,
  version,
  onOpChange,
  onVersionChange,
  label,
}: {
  id: string;
  op: ConstraintOperator;
  version: string;
  onOpChange: (op: ConstraintOperator) => void;
  onVersionChange: (version: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <select
        aria-label={`${label} — opérateur`}
        value={op}
        onChange={(e) => onOpChange(e.target.value as ConstraintOperator)}
        className="h-10 min-h-[40px] rounded-md border border-slate-700 bg-slate-950 px-2 text-sm font-bold text-blue-300"
      >
        {OPERATOR_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Input
        id={id}
        value={version}
        onChange={(e) => onVersionChange(e.target.value)}
        placeholder="toutes"
        inputMode="decimal"
        className={`h-10 min-h-[40px] w-24 bg-slate-950 border-slate-700 text-white ${
          isValidConstraintInput(joinConstraint(op, version))
            ? ''
            : 'border-red-500 focus-visible:ring-red-500'
        }`}
      />
      <span className="text-xs text-slate-500">— vide = toutes les versions</span>
    </div>
  );
}

export default function CompatibilityRuleModal({
  open,
  onOpenChange,
  rule,
  products,
  onSubmit,
  isSubmitting = false,
  defaultPair,
}: CompatibilityRuleModalProps) {
  const [form, setForm] = useState<RuleFormValues>(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      const base = rule ? formFromRule(rule) : emptyForm();
      if (!rule && defaultPair) {
        if (defaultPair.fromProductId) base.fromProductId = defaultPair.fromProductId;
        if (defaultPair.toProductId) base.toProductId = defaultPair.toProductId;
      }
      setForm(base);
      setTouched(false);
    }
  }, [open, rule, defaultPair]);

  const productOptions = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );
  const nameOf = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p.name]));
    return (id: string) => map.get(id) ?? '';
  }, [products]);

  const fromRange = splitConstraint(form.fromVersionConstraint);
  const toRange = splitConstraint(form.toVersionConstraint);

  const draftWithAutoName = useMemo(
    () => ({ ...form, name: form.name.trim() || autoName(form, nameOf) }),
    [form, nameOf]
  );

  const constraintsValid =
    isValidConstraintInput(form.fromVersionConstraint) &&
    isValidConstraintInput(form.toVersionConstraint);
  const valid = isRuleDraftValid(draftWithAutoName) && constraintsValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    await onSubmit(draftWithAutoName);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {rule ? 'Modifier la règle' : 'Nouvelle règle'}
          </DialogTitle>
        </DialogHeader>

        {/* Live sentence preview */}
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-[15px] text-slate-100">
          <RuleSentenceText
            rule={{
              name: draftWithAutoName.name,
              fromProductId: form.fromProductId,
              fromVersionConstraint: form.fromVersionConstraint,
              toProductId: form.toProductId,
              toVersionConstraint: form.toVersionConstraint,
              kind: form.kind,
              severity: form.severity,
            }}
            productName={nameOf}
          />
          {form.scopeType === 'PRODUCT' && form.scopeProductId && (
            <span className="block pt-1 text-xs text-slate-400">
              (uniquement pour la stack « {nameOf(form.scopeProductId)} »)
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* When */}
          <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Quand la stack
            </div>
            <select
              aria-label="Stack"
              value={form.fromProductId}
              onChange={(e) => setForm({ ...form, fromProductId: e.target.value })}
              required
              className="w-full h-11 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white"
            >
              <option value="">Choisir une stack…</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <VersionRangePicker
              id="rule-from-version"
              label="dans les versions"
              op={fromRange.op}
              version={fromRange.version}
              onOpChange={(op) =>
                setForm({ ...form, fromVersionConstraint: joinConstraint(op, fromRange.version) })
              }
              onVersionChange={(version) =>
                setForm({ ...form, fromVersionConstraint: joinConstraint(fromRange.op, version) })
              }
            />
          </div>

          {/* Then */}
          <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Elle</span>
              <div className="flex overflow-hidden rounded-full border border-slate-700">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: 'REQUIRES' })}
                  aria-pressed={form.kind === 'REQUIRES'}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    form.kind === 'REQUIRES'
                      ? 'bg-emerald-500/20 text-emerald-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ● exige
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, kind: 'FORBIDS' })}
                  aria-pressed={form.kind === 'FORBIDS'}
                  className={`px-4 py-2 text-sm font-semibold transition-colors ${
                    form.kind === 'FORBIDS'
                      ? 'bg-red-500/20 text-red-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  ○ interdit
                </button>
              </div>
              <span className="text-xs text-slate-500">le composant</span>
            </div>

            <select
              aria-label="Composant"
              value={form.toProductId}
              onChange={(e) => setForm({ ...form, toProductId: e.target.value })}
              required
              className="w-full h-11 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm font-semibold text-white"
            >
              <option value="">Choisir un composant…</option>
              {productOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {touched && form.fromProductId && form.fromProductId === form.toProductId && (
              <p className="text-xs text-red-400">
                La stack et le composant doivent être deux produits différents.
              </p>
            )}

            <VersionRangePicker
              id="rule-to-version"
              label="dans les versions"
              op={toRange.op}
              version={toRange.version}
              onOpChange={(op) =>
                setForm({ ...form, toVersionConstraint: joinConstraint(op, toRange.version) })
              }
              onVersionChange={(version) =>
                setForm({ ...form, toVersionConstraint: joinConstraint(toRange.op, version) })
              }
            />
          </div>

          {/* Consequence */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Conséquence
            </span>
            <div className="flex overflow-hidden rounded-full border border-slate-700">
              <button
                type="button"
                onClick={() => setForm({ ...form, severity: 'HARD' })}
                aria-pressed={form.severity === 'HARD'}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  form.severity === 'HARD'
                    ? 'bg-red-500/20 text-red-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ● Bloquant
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, severity: 'SOFT' })}
                aria-pressed={form.severity === 'SOFT'}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  form.severity === 'SOFT'
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ○ Avertissement
              </button>
            </div>
            <span className="text-xs text-slate-500">
              {form.severity === 'HARD'
                ? 'empêche d’enregistrer une composition non conforme'
                : 'signale un risque, sans bloquer'}
            </span>
          </div>

          {/* Scope */}
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Portée
            </span>
            <div className="flex overflow-hidden rounded-full border border-slate-700">
              <button
                type="button"
                onClick={() => setForm({ ...form, scopeType: 'GLOBAL', scopeProductId: '' })}
                aria-pressed={form.scopeType === 'GLOBAL'}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  form.scopeType === 'GLOBAL'
                    ? 'bg-blue-500/20 text-blue-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Partout
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, scopeType: 'PRODUCT' })}
                aria-pressed={form.scopeType === 'PRODUCT'}
                className={`px-4 py-2 text-sm font-semibold transition-colors ${
                  form.scopeType === 'PRODUCT'
                    ? 'bg-purple-500/20 text-purple-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Seulement pour une stack
              </button>
            </div>
            {form.scopeType === 'PRODUCT' && (
              <select
                aria-label="Stack concernée par la portée"
                value={form.scopeProductId}
                onChange={(e) => setForm({ ...form, scopeProductId: e.target.value })}
                required
                className="h-10 min-h-[40px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="">Choisir la stack…</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Note + justification */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="rule-description" className="text-sm font-medium text-slate-300">
                Note (facultatif)
              </label>
              <Textarea
                id="rule-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={2}
                placeholder="« PG 17 a besoin de la génération VM v4 »"
                className="bg-slate-950 border-slate-700 text-white"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="rule-justification" className="text-sm font-medium text-slate-300">
                Justification
              </label>
              <Textarea
                id="rule-justification"
                value={form.justification}
                onChange={(e) => setForm({ ...form, justification: e.target.value })}
                rows={2}
                placeholder="Obligatoire si cette règle assouplit une règle globale"
                className="bg-slate-950 border-slate-700 text-white"
              />
              <p className="text-xs text-slate-500">
                Obligatoire quand une règle par stack assouplit une règle globale (l’API refuse sinon).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rule-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950"
            />
            <label htmlFor="rule-active" className="text-sm text-slate-300">
              Règle active
            </label>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={!valid || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]"
            >
              {rule ? 'Enregistrer' : 'Créer la règle'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
