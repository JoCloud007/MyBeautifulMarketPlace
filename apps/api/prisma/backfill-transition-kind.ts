/**
 * Data migration — backfill Transition.kind + OS version FKs.
 *
 * When a Transition's fromVersion / toVersion match two OsVersion rows
 * reachable through the products' variants (ProductVariant.osVersionId), the
 * row becomes kind=OS with fromOsVersionId / toOsVersionId filled; every
 * other row is left (or reset) to kind=PRODUCT with null OS FKs. The legacy
 * free-text strings are kept unchanged — they already match by construction.
 *
 * Idempotent and re-runnable: rows already in the target state are not
 * touched, nothing is ever deleted, no raw SQL or destructive flag is used.
 *
 * Run via `make update` (step 6/6) or `make fix-client-db-transition-kind`
 * (step 3/3). Direct invocation:
 *   docker compose exec -T api npx tsx prisma/backfill-transition-kind.ts
 */
import { PrismaClient } from '@prisma/client';

// Module-level client, Prisma only — no raw SQL anywhere in this script.
const prisma = new PrismaClient();

/** OsVersion ids reachable through the product's variants, keyed by version string. */
async function reachableOsVersions(productId: string): Promise<Map<string, string>> {
  const byVersion = new Map<string, string>();
  const variants = await prisma.productVariant.findMany({
    where: { productId, osVersionId: { not: null } },
    select: { osVersion: { select: { id: true, version: true } } },
  });
  for (const { osVersion } of variants) {
    if (osVersion && !byVersion.has(osVersion.version)) byVersion.set(osVersion.version, osVersion.id);
  }
  return byVersion;
}

/**
 * Fallback match: both version strings resolve to two OsVersion rows of the
 * SAME OS in the catalog. Needed because transitions like "RHEL 8 → 9" can
 * exist on a product whose variants reference other OSes (demo data: the
 * Virtual Machine variants only use FictionalOS). Only a unique OS match is
 * accepted — ambiguous strings are left untouched.
 */
async function uniqueOsPair(fromVersion: string, toVersion: string): Promise<{ fromId: string; toId: string } | null> {
  const rows = await prisma.osVersion.findMany({
    where: { OR: [{ version: fromVersion }, { version: toVersion }] },
    select: { id: true, version: true, osId: true },
  });
  const byOs = new Map<string, { from?: string; to?: string }>();
  for (const r of rows) {
    const slot = byOs.get(r.osId) || {};
    if (r.version === fromVersion && !slot.from) slot.from = r.id;
    if (r.version === toVersion && !slot.to) slot.to = r.id;
    byOs.set(r.osId, slot);
  }
  const pairs: { fromId: string; toId: string }[] = [];
  for (const slot of byOs.values()) {
    if (slot.from && slot.to) pairs.push({ fromId: slot.from, toId: slot.to });
  }
  return pairs.length === 1 ? pairs[0] : null;
}

async function main() {
  const transitions = await prisma.transition.findMany({
    include: {
      fromProduct: { select: { id: true, name: true } },
      toProduct: { select: { id: true, name: true } },
      fromOsVersion: { select: { id: true, version: true } },
      toOsVersion: { select: { id: true, version: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let promoted = 0;
  let reset = 0;
  let untouched = 0;

  for (const t of transitions) {
    // OsVersion rows reachable through each product's variants
    // (ProductVariant.osVersionId), keyed by version string.
    const fromCandidates = await reachableOsVersions(t.fromProductId);
    const toCandidates = await reachableOsVersions(t.toProductId);
    let fromId = fromCandidates.get(t.fromVersion);
    let toId = toCandidates.get(t.toVersion);

    if (!fromId || !toId) {
      // Fallback: the version strings may name OS versions not bound to any
      // variant of the product. Both must resolve to the same OS, uniquely.
      const pair = await uniqueOsPair(t.fromVersion, t.toVersion);
      if (pair) {
        fromId = pair.fromId;
        toId = pair.toId;
      }
    }

    if (!fromId || !toId) {
      // No match on both sides: leave the row — or reset it — as
      // kind=PRODUCT with null OS FKs. Nothing is ever deleted.
      if (t.kind === 'PRODUCT' && !t.fromOsVersionId && !t.toOsVersionId) {
        untouched++;
        continue;
      }
      await prisma.transition.update({
        where: { id: t.id },
        data: { kind: 'PRODUCT', fromOsVersionId: null, toOsVersionId: null },
      });
      reset++;
      console.log(`  reset to PRODUCT: ${t.fromProduct?.name} ${t.fromVersion} → ${t.toVersion} [${t.name}]`);
      continue;
    }

    // Re-runs stay stable: an OS FK already matching its own string is kept
    // even when several OsVersion rows share the same version string.
    const stableFromId = t.fromOsVersionId && t.fromOsVersion?.version === t.fromVersion ? t.fromOsVersionId : fromId;
    const stableToId = t.toOsVersionId && t.toOsVersion?.version === t.toVersion ? t.toOsVersionId : toId;

    if (t.kind === 'OS' && t.fromOsVersionId === stableFromId && t.toOsVersionId === stableToId) {
      untouched++;
      continue;
    }

    await prisma.transition.update({
      where: { id: t.id },
      data: { kind: 'OS', fromOsVersionId: stableFromId, toOsVersionId: stableToId },
    });
    promoted++;
    console.log(`  kind=OS: ${t.fromProduct?.name} ${t.fromVersion} → ${t.toVersion} [${t.name}]`);
  }
  console.log(`backfill done — ${promoted} set to kind=OS, ${reset} reset to kind=PRODUCT, ${untouched} untouched (${transitions.length} Transition rows scanned)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
