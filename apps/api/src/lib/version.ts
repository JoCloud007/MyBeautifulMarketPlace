/**
 * Version tuple normalisation — spec "Stacks de produits & matrice de
 * compatibilité" §1.1. The `version` string stays the display source; the
 * (major, minor, patch) tuple powers range comparisons for compatibility
 * rules. Shared by routes (write-time derivation) and the backfill script.
 *
 * Rules:
 * - strip an optional `v` prefix, split on `.` (3 segments max);
 * - missing segments default to 0 (`"16.3"` → 16/3/0, `"v3"` → 3/0/0);
 * - any non-numeric segment → null tuple (range rules simply do not apply to
 *   those products; only exact version-id equality works — phase 1).
 */

export interface VersionTuple {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a version string into a normalised tuple, or null when the string
 * cannot be normalised (empty, or any non-numeric segment).
 */
export function parseVersionTuple(version: string | null | undefined): VersionTuple | null {
  if (version == null) return null;
  const stripped = version.trim().replace(/^[vV]/, '');
  if (stripped.length === 0) return null;

  const segments = stripped.split('.');
  if (segments.length > 3) return null;

  const numbers: number[] = [];
  for (const segment of segments) {
    if (!/^\d+$/.test(segment)) return null;
    numbers.push(Number(segment));
  }
  while (numbers.length < 3) numbers.push(0);

  return { major: numbers[0], minor: numbers[1], patch: numbers[2] };
}

/**
 * Tuple columns for a Prisma write. Non-parseable versions produce three nulls
 * (columns are nullable — nothing is enforced on pre-existing data).
 */
export function versionTupleFields(
  version: string | null | undefined
): { versionMajor: number | null; versionMinor: number | null; versionPatch: number | null } {
  const tuple = parseVersionTuple(version);
  return {
    versionMajor: tuple ? tuple.major : null,
    versionMinor: tuple ? tuple.minor : null,
    versionPatch: tuple ? tuple.patch : null,
  };
}

/**
 * Compare two tuples: -1 when a < b, 0 when equal, 1 when a > b.
 * A null tuple is not comparable — it is ordered after every real tuple
 * (deterministic sort) and equals only another null tuple.
 */
export function compareVersionTuples(
  a: VersionTuple | null | undefined,
  b: VersionTuple | null | undefined
): -1 | 0 | 1 {
  if (!a && !b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;
  return 0;
}
