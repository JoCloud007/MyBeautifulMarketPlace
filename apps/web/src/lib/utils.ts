import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Flavor } from '@cloudmarket/shared-types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Format a flavor's attributes for display, using the category's field definitions when available
export function formatFlavorAttrs(flavor: Flavor | undefined | null, defs?: any[] | null): string {
  if (!flavor) return '—';
  const attrs = (flavor.attributes || {}) as Record<string, string | number>;
  const keys = defs && defs.length > 0 ? defs.map((d: any) => d.key) : Object.keys(attrs);
  const parts = keys
    .filter((k) => attrs[k] !== undefined && attrs[k] !== null && attrs[k] !== '')
    .map((k) => {
      const def = defs?.find((d: any) => d.key === k);
      const unit = def?.unit;
      return unit ? `${attrs[k]} ${unit}` : String(attrs[k]);
    });
  if (parts.length > 0) return parts.join(' · ');
  // Fallback for flavors without attributes (legacy vcpu/ramGb columns)
  const legacy = [flavor.vcpu != null ? `${flavor.vcpu} vCPU` : null, flavor.ramGb != null ? `${flavor.ramGb} GB` : null].filter(Boolean);
  return legacy.join(' · ') || '—';
}
