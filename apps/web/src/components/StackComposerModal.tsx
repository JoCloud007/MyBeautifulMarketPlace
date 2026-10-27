/**
 * StackComposerModal — per-version "Composants (stack)" editor.
 * Spec "Stacks de produits & matrice de compatibilité"; work unit "admin-ui"
 * (owner of this file only).
 *
 * Add a component with a product picker, then a version picker filtered to
 * that product's versions; remove components; the live verdict from
 * POST /api/compatibility/validate updates on every change: a global badge
 * ✓ / ! / ✗ plus the findings list with the motivating rules (name +
 * constraints, satisfied/violated). Saving persists through
 * PUT /api/product-versions/:id/components; API errors (400 findings, missing
 * justification on a forced save) surface through the toast system.
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
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, XCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import {
  useReplaceProductVersionComponents,
  useValidateComposition,
  type CompatibilityFinding,
  type CompatibilityVerdict,
  type ComponentRequest,
  type StackComponentRow,
} from '@/hooks/useCompatibilityAdmin';

export interface ComposerProductOption {
  id: string;
  name: string;
  versions: { id: string; version: string }[];
}

interface StackComposerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Container product version being composed. */
  productVersionId: string;
  containerProductId: string;
  containerLabel: string;
  /** Candidate component products (the container product is excluded). */
  products: ComposerProductOption[];
  /** Current persisted components (preloaded into the draft). */
  initialComponents?: StackComponentRow[];
  onSaved?: () => void;
}

interface DraftComponent {
  productId: string;
  versionId: string;
}

const VERDICT_BADGE: Record<
  CompatibilityVerdict,
  { icon: typeof CheckCircle; label: string; className: string }
> = {
  VALID: {
    icon: CheckCircle,
    label: '✓ Compatible',
    className: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  },
  WARNING: {
    icon: AlertTriangle,
    label: '! Avertissement',
    className: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  },
  BLOCKED: {
    icon: XCircle,
    label: '✗ Incompatible',
    className: 'border-red-500/30 text-red-400 bg-red-500/10',
  },
};

/** Rule display line: name + constraint(s) + satisfied/violated state. */
export function FindingRuleLine({ finding }: { finding: CompatibilityFinding }) {
  const from = finding.fromVersionConstraint || 'toutes versions';
  const to = finding.toVersionConstraint || 'toutes versions';
  return (
    <li className="flex items-start gap-2 text-sm">
      {finding.satisfied ? (
        <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
      )}
      <div className="min-w-0">
        <p className={finding.satisfied ? 'text-slate-300' : 'text-red-300'}>
          {finding.ruleName}
          <span className="ml-2 text-xs text-slate-500">
            ({finding.kind} · {finding.severity} · {from} → {to})
          </span>
        </p>
        <p className="text-xs text-slate-500">
          {finding.satisfied ? 'satisfaite' : 'violée'}
          {finding.overridden ? ' · surchargée (SOFT)' : ''}
          {finding.reason !== 'ok' ? ` · ${finding.reason}` : ''}
        </p>
      </div>
    </li>
  );
}

export default function StackComposerModal({
  open,
  onOpenChange,
  productVersionId,
  containerProductId,
  containerLabel,
  products,
  initialComponents = [],
  onSaved,
}: StackComposerModalProps) {
  const [draft, setDraft] = useState<DraftComponent[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [justification, setJustification] = useState('');

  const validate = useValidateComposition();
  const saveComponents = useReplaceProductVersionComponents();

  // Stable signature of the persisted list (the array identity is not stable).
  const initialSignature = initialComponents
    .map((row) => `${row.componentProductId}:${row.componentVersionId}`)
    .sort()
    .join('|');

  // Reset the draft whenever the modal opens for this version or the persisted
  // list changes (not on every render — the identity of initialComponents is
  // not stable, so the effect keys off the signature).
  useEffect(() => {
    if (!open) return;
    setDraft(
      initialSignature.length === 0
        ? []
        : initialSignature.split('|').map((entry) => {
            const [productId, versionId] = entry.split(':');
            return { productId, versionId };
          })
    );
    setSelectedProductId('');
    setSelectedVersionId('');
    setShowOverride(false);
    setJustification('');
  }, [open, productVersionId, initialSignature]);

  // Live validation on every draft change (write-free endpoint).
  useEffect(() => {
    if (!open) return;
    validate.mutate({
      containerProductId,
      components: draft.map((c) => ({ productId: c.productId, versionId: c.versionId })),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, containerProductId, draft]);

  const productOptions = useMemo(
    () => [...products].sort((a, b) => a.name.localeCompare(b.name)),
    [products]
  );

  const versionOptions = useMemo(() => {
    const product = productOptions.find((p) => p.id === selectedProductId);
    return product?.versions ?? [];
  }, [productOptions, selectedProductId]);

  const usedProductIds = useMemo(() => new Set(draft.map((c) => c.productId)), [draft]);

  const evaluation = validate.data;
  const verdict: CompatibilityVerdict = evaluation?.verdict ?? 'VALID';
  const findings = evaluation?.findings ?? [];
  const unsatisfied = findings.filter((f) => !f.satisfied);
  const hasBlocked = verdict === 'BLOCKED';

  const addComponent = () => {
    if (!selectedProductId || !selectedVersionId) return;
    if (usedProductIds.has(selectedProductId)) return;
    setDraft([...draft, { productId: selectedProductId, versionId: selectedVersionId }]);
    setSelectedProductId('');
    setSelectedVersionId('');
  };

  const removeComponent = (index: number) => {
    setDraft(draft.filter((_, i) => i !== index));
  };

  const buildPayload = (): ComponentRequest[] =>
    draft.map((c) => ({
      componentProductId: c.productId,
      componentVersionId: c.versionId,
    }));

  const persist = async (options?: { force: boolean; justification: string }) => {
    try {
      await saveComponents.mutateAsync({
        productVersionId,
        components: buildPayload(),
        options,
      });
      // Saved (plain or forced-SOFT override) — close and let the caller refetch.
      onOpenChange(false);
      onSaved?.();
    } catch {
      // 400 findings / missing justification are toasted by the mutation hook.
      // A HARD block keeps the modal open so the user can fix the stack or
      // request the forced-SOFT override.
    }
  };

  const handleSave = () => persist(undefined);

  const handleForceSubmit = () => {
    if (justification.trim().length === 0) return;
    void persist({ force: true, justification: justification.trim() });
  };

  const VerdictIcon = VERDICT_BADGE[verdict].icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">
            Composants (stack) — {containerLabel}
          </DialogTitle>
        </DialogHeader>

        {/* Live verdict: global badge ✓ / ! / ✗ */}
        <div
          data-testid="stack-composer-verdict"
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${VERDICT_BADGE[verdict].className}`}
        >
          <VerdictIcon className="h-5 w-5" />
          <span className="text-sm font-semibold">{VERDICT_BADGE[verdict].label}</span>
          {validate.isPending && (
            <span className="ml-auto text-xs text-slate-400">validation…</span>
          )}
        </div>

        {/* Add component: product picker then version picker */}
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Ajouter un composant
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              aria-label="Component product"
              value={selectedProductId}
              onChange={(e) => {
                setSelectedProductId(e.target.value);
                setSelectedVersionId('');
              }}
              className="h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="">Produit…</option>
              {productOptions
                .filter((p) => !usedProductIds.has(p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Component version"
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              disabled={!selectedProductId || versionOptions.length === 0}
              className="h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white disabled:opacity-50"
            >
              <option value="">
                {selectedProductId ? 'Version…' : 'Choisissez d’abord un produit'}
              </option>
              {versionOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version}
                </option>
              ))}
            </select>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={addComponent}
            disabled={!selectedProductId || !selectedVersionId}
            className="border-slate-700 text-slate-300 hover:bg-slate-800 min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Ajouter
          </Button>
        </div>

        {/* Draft component list */}
        <div className="space-y-2">
          {draft.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun composant dans cette version.</p>
          ) : (
            draft.map((component, index) => {
              const product = productOptions.find((p) => p.id === component.productId);
              const version = product?.versions.find((v) => v.id === component.versionId);
              return (
                <div
                  key={`${component.productId}:${component.versionId}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">
                      {product?.name ?? component.productId}
                    </p>
                    <p className="text-xs text-slate-400">{version?.version ?? component.versionId}</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeComponent(index)}
                    aria-label="Retirer ce composant"
                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })
          )}
        </div>

        {/* Findings list with the motivating rules */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Règles motivantes
          </p>
          {findings.length === 0 ? (
            <p className="text-sm text-slate-500">
              Aucune règle de compatibilité applicable à cette composition.
            </p>
          ) : (
            <ul className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              {findings.map((finding, i) => (
                <FindingRuleLine key={`${finding.ruleId}-${i}`} finding={finding} />
              ))}
            </ul>
          )}
          {unsatisfied.length > 0 && (
            <p className="text-xs text-amber-400">
              {unsatisfied.length} règle(s) non satisfaite(s) — une règle HARD bloque
              l’enregistrement (surcharge possible avec justification).
            </p>
          )}
        </div>

        {/* Forced-SOFT override (Phase 1: HARD gate → override with justification) */}
        {hasBlocked && (
          <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 p-3">
            <p className="text-sm text-red-300">
              Cette composition viole une règle HARD. Enregistrement bloqué.
            </p>
            {!showOverride ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowOverride(true)}
                className="border-red-500/40 text-red-300 hover:bg-red-500/10 min-h-[44px]"
              >
                Forcer (surcharge SOFT)…
              </Button>
            ) : (
              <div className="space-y-2">
                <Textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={3}
                  placeholder="Justification obligatoire pour forcer une règle HARD"
                  className="bg-slate-950 border-slate-700 text-white"
                />
                <Button
                  type="button"
                  onClick={handleForceSubmit}
                  disabled={justification.trim().length === 0}
                  className="bg-amber-600 hover:bg-amber-700 text-white min-h-[44px]"
                >
                  Enregistrer avec surcharge
                </Button>
                {justification.trim().length === 0 && (
                  <p className="text-xs text-red-400">
                    A justification is required to force a HARD compatibility override.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

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
            type="button"
            onClick={handleSave}
            disabled={saveComponents.isPending || hasBlocked}
            className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]"
          >
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
