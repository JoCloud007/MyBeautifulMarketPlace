/**
 * CompatibilityRuleModal — create/edit modal for a compatibility rule.
 * Spec "Stacks de produits & matrice de compatibilité"; work unit "admin-ui"
 * (owner of this file only).
 *
 * Product selectors (source / target / scope) + constraint fields validated on
 * input against the §2 grammar (mirrored by isValidConstraintInput): the Save
 * button stays disabled while a field is invalid, and inline helper text marks
 * the offending field. API-side errors (400 findings, mandatory justification
 * on a relaxing override, …) are surfaced through the caller's mutation toast.
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

interface CompatibilityRuleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = create mode. */
  rule: CompatibilityRule | null;
  products: ProductOption[];
  onSubmit: (values: RuleFormValues) => void | Promise<void>;
  isSubmitting?: boolean;
}

const CONSTRAINT_HINT = 'Format: =9.4, !=10, >=9.2, >9.2, <=10 or <10 — empty = all versions';

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

function ConstraintField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = isValidConstraintInput(value);
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="text-sm font-medium text-slate-300">
        {label}
      </label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder=">=9.2"
        aria-invalid={!valid}
        className={`bg-slate-950 border-slate-700 text-white min-h-[44px] ${
          valid ? '' : 'border-red-500 focus-visible:ring-red-500'
        }`}
      />
      <p className={`text-xs ${valid ? 'text-slate-500' : 'text-red-400'}`}>
        {valid ? CONSTRAINT_HINT : `Invalid constraint — ${CONSTRAINT_HINT}`}
      </p>
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
}: CompatibilityRuleModalProps) {
  const [form, setForm] = useState<RuleFormValues>(emptyForm);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(rule ? formFromRule(rule) : emptyForm());
      setTouched(false);
    }
  }, [open, rule]);

  const productOptions = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const constraintsValid =
    isValidConstraintInput(form.fromVersionConstraint) &&
    isValidConstraintInput(form.toVersionConstraint);
  const valid = isRuleDraftValid(form) && constraintsValid;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    await onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            {rule ? 'Edit compatibility rule' : 'New compatibility rule'}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="rule-name" className="text-sm font-medium text-slate-300">
              Name
            </label>
            <Input
              id="rule-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
            />
            {touched && form.name.trim().length === 0 && (
              <p className="text-xs text-red-400">A rule name is required.</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="rule-from-product" className="text-sm font-medium text-slate-300">
                Produit source
              </label>
              <select
                id="rule-from-product"
                value={form.fromProductId}
                onChange={(e) => setForm({ ...form, fromProductId: e.target.value })}
                required
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="">Select product...</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <ConstraintField
              id="rule-from-constraint"
              label="Contrainte (source)"
              value={form.fromVersionConstraint}
              onChange={(value) => setForm({ ...form, fromVersionConstraint: value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="rule-to-product" className="text-sm font-medium text-slate-300">
                Produit cible
              </label>
              <select
                id="rule-to-product"
                value={form.toProductId}
                onChange={(e) => setForm({ ...form, toProductId: e.target.value })}
                required
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="">Select product...</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {touched && form.fromProductId && form.fromProductId === form.toProductId && (
                <p className="text-xs text-red-400">
                  Source and target products must be different.
                </p>
              )}
            </div>
            <ConstraintField
              id="rule-to-constraint"
              label="Contrainte (cible)"
              value={form.toVersionConstraint}
              onChange={(value) => setForm({ ...form, toVersionConstraint: value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="rule-kind" className="text-sm font-medium text-slate-300">
                Kind
              </label>
              <select
                id="rule-kind"
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as RuleKind })}
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="REQUIRES">REQUIRES</option>
                <option value="FORBIDS">FORBIDS</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="rule-severity" className="text-sm font-medium text-slate-300">
                Severity
              </label>
              <select
                id="rule-severity"
                value={form.severity}
                onChange={(e) => setForm({ ...form, severity: e.target.value as RuleSeverity })}
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="HARD">HARD</option>
                <option value="SOFT">SOFT</option>
              </select>
            </div>
            <div className="space-y-2">
              <label htmlFor="rule-scope" className="text-sm font-medium text-slate-300">
                Scope
              </label>
              <select
                id="rule-scope"
                value={form.scopeType}
                onChange={(e) => setForm({ ...form, scopeType: e.target.value as RuleScope })}
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="GLOBAL">GLOBAL</option>
                <option value="PRODUCT">PRODUCT</option>
              </select>
            </div>
          </div>

          {form.scopeType === 'PRODUCT' && (
            <div className="space-y-2">
              <label htmlFor="rule-scope-product" className="text-sm font-medium text-slate-300">
                Scope product (contexte)
              </label>
              <select
                id="rule-scope-product"
                value={form.scopeProductId}
                onChange={(e) => setForm({ ...form, scopeProductId: e.target.value })}
                required
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="">Select product...</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {touched && form.scopeProductId.length === 0 && (
                <p className="text-xs text-red-400">
                  A PRODUCT-scoped rule requires a scope product.
                </p>
              )}
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="rule-justification" className="text-sm font-medium text-slate-300">
              Justification
            </label>
            <Textarea
              id="rule-justification"
              value={form.justification}
              onChange={(e) => setForm({ ...form, justification: e.target.value })}
              rows={3}
              placeholder="Required when this PRODUCT-scoped rule relaxes a GLOBAL rule of the same pair"
              className="bg-slate-950 border-slate-700 text-white"
            />
            <p className="text-xs text-slate-500">
              Mandatory when a PRODUCT-scoped rule relaxes a matching GLOBAL rule (the API
              rejects otherwise with a 400).
            </p>
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
              Active
            </label>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!valid || isSubmitting}
              className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]"
            >
              {rule ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
