/**
 * Auto-generated display name for a Transition when the caller supplies none.
 * Intra-product transitions (same product, version bump) read like
 * "Bare Metal bm-gen2 → bm-gen3"; cross-product ones name both sides.
 */
export function autoTransitionName(input: {
  fromProductName: string;
  toProductName: string;
  fromVersion: string;
  toVersion: string;
}): string {
  const { fromProductName, toProductName, fromVersion, toVersion } = input;
  if (fromProductName === toProductName) {
    return `${fromProductName} ${fromVersion} → ${toVersion}`;
  }
  return `${fromProductName} ${fromVersion} → ${toProductName} ${toVersion}`;
}
