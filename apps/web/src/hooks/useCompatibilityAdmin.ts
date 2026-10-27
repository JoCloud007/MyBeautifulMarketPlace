/**
 * Compatibility admin hooks — spec "Stacks de produits & matrice de compatibilité".
 * Work unit: "admin-ui" (owner of this file only). Kept separate from
 * hooks/useApi.ts on purpose so that shared file is never touched.
 *
 * Covers the admin surfaces:
 *  - compatibility rule CRUD against /api/compatibility-rules;
 *  - stack components of a product version against /api/product-versions/:id/components;
 *  - live validation against /api/compatibility/validate (used by StackComposerModal).
 *
 * All API errors (400 findings, missing justification, …) surface through the
 * existing toast system (useToastStore) without breaking the calling sections.
 */

import axios from 'axios';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/stores/useToastStore';

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '' : 'http://localhost:3001');

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: { 'Content-Type': 'application/json' },
});

// ---------------------------------------------------------------------------
// Types (structural shapes of the Prisma rows / engine results)
// ---------------------------------------------------------------------------

export type RuleKind = 'REQUIRES' | 'FORBIDS';
export type RuleSeverity = 'HARD' | 'SOFT';
export type RuleScope = 'GLOBAL' | 'PRODUCT';

export interface CompatibilityRule {
  id: string;
  name: string;
  description?: string | null;
  fromProductId: string;
  fromVersionConstraint?: string | null;
  toProductId: string;
  toVersionConstraint?: string | null;
  kind: RuleKind;
  severity: RuleSeverity;
  scopeType: RuleScope;
  scopeProductId?: string | null;
  justification?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
  fromProduct?: { id: string; name: string; slug?: string } | null;
  toProduct?: { id: string; name: string; slug?: string } | null;
  scopeProduct?: { id: string; name: string; slug?: string } | null;
}

export type CompatibilityVerdict = 'VALID' | 'WARNING' | 'BLOCKED';

export type CompatibilityFindingReason =
  | 'required-missing'
  | 'required-version-out-of-range'
  | 'forbidden-co-occurrence'
  | 'pair-out-of-scope'
  | 'ok';

export interface CompatibilityFinding {
  ruleId: string;
  ruleName: string;
  fromProductId: string;
  fromVersionConstraint: string | null;
  toProductId: string;
  toVersionConstraint: string | null;
  kind: RuleKind;
  severity: RuleSeverity;
  satisfied: boolean;
  reason: CompatibilityFindingReason;
  overridden?: boolean;
}

export interface CompatibilityEvaluation {
  verdict: CompatibilityVerdict;
  findings: CompatibilityFinding[];
}

export interface StackComponentRow {
  id: string;
  containerVersionId: string;
  componentProductId: string;
  componentVersionId: string;
  createdAt?: string;
  componentProduct?: { id: string; name: string; slug?: string; categoryId?: string } | null;
  componentVersion?: {
    id: string;
    productId: string;
    version: string;
    versionMajor?: number | null;
    versionMinor?: number | null;
    versionPatch?: number | null;
    phase?: string;
    isActive?: boolean;
  } | null;
  /** Aliases exposed by the API (presentRow). */
  product?: { id: string; name: string; slug?: string } | null;
  version?: { id: string; productId: string; version: string } | null;
}

export interface ComponentRequest {
  componentProductId: string;
  componentVersionId: string;
}

export interface ReplaceComponentsResult {
  components: StackComponentRow[];
  verdict: CompatibilityVerdict;
  findings: CompatibilityFinding[];
  violations: CompatibilityFinding[];
  forced?: boolean;
  justification?: string;
  override?: { forced: boolean; severity: 'SOFT'; justification: string };
}

// ---------------------------------------------------------------------------
// Client-side constraint validation (§2 grammar, mirrored from the API)
// ---------------------------------------------------------------------------

const CONSTRAINT_RE = /^(<=|>=|!=|=|<|>)\s*(\d+(?:\.\d+){0,2})$/;

/** True when a constraint field value is valid on input (null/empty = any). */
export function isValidConstraintInput(value: string | null | undefined): boolean {
  if (value == null) return true;
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return CONSTRAINT_RE.test(trimmed);
}

/** True when the whole rule draft is valid (used to enable the Save button). */
export function isRuleDraftValid(draft: {
  name: string;
  fromProductId: string;
  toProductId: string;
  fromVersionConstraint: string;
  toVersionConstraint: string;
  scopeType: RuleScope;
  scopeProductId: string;
}): boolean {
  return (
    draft.name.trim().length > 0 &&
    draft.fromProductId.length > 0 &&
    draft.toProductId.length > 0 &&
    draft.fromProductId !== draft.toProductId &&
    isValidConstraintInput(draft.fromVersionConstraint) &&
    isValidConstraintInput(draft.toVersionConstraint) &&
    (draft.scopeType !== 'PRODUCT' || draft.scopeProductId.length > 0)
  );
}

// ---------------------------------------------------------------------------
// Error → toast
// ---------------------------------------------------------------------------

function errorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.error ||
    anyErr?.response?.data?.message ||
    anyErr?.message ||
    fallback
  );
}

/** Validation details from a 400 body, flattened for the toast message. */
function detailedErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  const details = anyErr?.response?.data?.details;
  if (Array.isArray(details) && details.length > 0) {
    const messages = details
      .map((d: any) => (typeof d?.message === 'string' ? d.message : null))
      .filter(Boolean);
    if (messages.length > 0) return `${errorMessage(err, fallback)}: ${messages.join(' · ')}`;
  }
  return errorMessage(err, fallback);
}

// ---------------------------------------------------------------------------
// Compatibility rules CRUD
// ---------------------------------------------------------------------------

export function useCompatibilityRules(filters?: {
  fromProductId?: string;
  toProductId?: string;
  scopeProductId?: string;
  scopeType?: RuleScope;
  kind?: RuleKind;
  severity?: RuleSeverity;
}) {
  return useQuery<CompatibilityRule[]>({
    queryKey: ['compatibility-rules', filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      Object.entries(filters ?? {}).forEach(([k, v]) => {
        if (v) params[k] = String(v);
      });
      const { data } = await api.get('/compatibility-rules', { params });
      return data;
    },
    retry: 1,
  });
}

export function useCreateCompatibilityRule() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (payload: Partial<CompatibilityRule>) => {
      const { data } = await api.post('/compatibility-rules', payload);
      return data as CompatibilityRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compatibility-rules'] });
      addToast('Compatibility rule created', 'success');
    },
    onError: (err: unknown) => {
      addToast(detailedErrorMessage(err, 'Error creating compatibility rule'), 'error');
    },
  });
}

export function useUpdateCompatibilityRule() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: string } & Partial<CompatibilityRule>) => {
      const { data } = await api.patch(`/compatibility-rules/${id}`, payload);
      return data as CompatibilityRule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compatibility-rules'] });
      addToast('Compatibility rule updated', 'success');
    },
    onError: (err: unknown) => {
      addToast(detailedErrorMessage(err, 'Error updating compatibility rule'), 'error');
    },
  });
}

export function useDeleteCompatibilityRule() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/compatibility-rules/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compatibility-rules'] });
      addToast('Compatibility rule deleted', 'success');
    },
    onError: (err: unknown) => {
      addToast(errorMessage(err, 'Unable to delete this compatibility rule'), 'error');
    },
  });
}

// ---------------------------------------------------------------------------
// Stack components (per product version)
// ---------------------------------------------------------------------------

export function useProductVersionComponents(productVersionId: string | null | undefined) {
  return useQuery<StackComponentRow[]>({
    queryKey: ['product-version-components', productVersionId],
    queryFn: async () => {
      const { data } = await api.get(`/product-versions/${productVersionId}/components`);
      return Array.isArray(data) ? data : [];
    },
    enabled: !!productVersionId,
    retry: 1,
  });
}

export interface ReplaceComponentsOptions {
  force?: boolean;
  justification?: string;
}

/**
 * PUT /api/product-versions/:id/components — replaces the whole list.
 * Rejects (and toasts) on 400: consistency errors, HARD rule violations
 * (`verdict: 'BLOCKED'` + findings) and forced saves without justification.
 */
export function useReplaceProductVersionComponents() {
  const queryClient = useQueryClient();
  const addToast = useToastStore((s) => s.addToast);
  return useMutation({
    mutationFn: async ({
      productVersionId,
      components,
      options,
    }: {
      productVersionId: string;
      components: ComponentRequest[];
      options?: ReplaceComponentsOptions;
    }) => {
      const body: Record<string, unknown> = { components };
      if (options?.justification) body.justification = options.justification;
      if (options?.force) body.force = true;
      const { data } = await api.put(
        `/product-versions/${productVersionId}/components`,
        body,
        { params: options?.force ? { force: 'true' } : undefined }
      );
      return data as ReplaceComponentsResult;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['product-version-components', variables.productVersionId],
      });
      queryClient.invalidateQueries({ queryKey: ['compatibility-matrix'] });
      addToast(
        data?.forced ? 'Stack saved with a forced SOFT override' : 'Stack components saved',
        data?.forced ? 'warning' : 'success'
      );
    },
    onError: (err: unknown) => {
      addToast(errorMessage(err, 'Unable to save stack components'), 'error');
    },
  });
}

// ---------------------------------------------------------------------------
// Live validation (StackComposerModal)
// ---------------------------------------------------------------------------

export interface ValidateCompositionBody {
  containerProductId: string;
  components: { productId: string; versionId: string }[];
}

/** POST /api/compatibility/validate — write-free, used on every composer change. */
export function useValidateComposition() {
  return useMutation<CompatibilityEvaluation, unknown, ValidateCompositionBody>({
    mutationFn: async (body: ValidateCompositionBody) => {
      const { data } = await api.post('/compatibility/validate', body);
      return data as CompatibilityEvaluation;
    },
  });
}
