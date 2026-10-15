/**
 * Resiliency availability resolution.
 *
 * Levels are admin-configurable (ResiliencyLevelConfig). Availability is
 * resolved per (product, flavor?, az?) against fine-grained ResiliencyScope
 * rules, with the most specific matching rule winning:
 *
 *   1. FLAVOR              (level, productId?, FLAVOR, flavorId)
 *   2. AVAILABILITY_ZONE   (level, productId?, AVAILABILITY_ZONE, azCode)
 *   3. ZONE                (level, productId?, ZONE, zoneId)      — zone of the AZ
 *   4. REGION              (level, productId?, REGION, regionName) — region of the AZ
 *   5. ProductResiliency   (product-level association)
 *   6. Default             — all active levels allowed
 *
 * A rule without productId is a catalog-wide rule; a product-specific rule of
 * the same scopeType beats the global one. The first rule found for a level
 * decides allow/deny; levels with no matching rule fall through to (5) then (6).
 */
import type { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

export interface ResiliencyContext {
  productId: string;
  flavorId?: string | null;
  azCode?: string | null;
}

export interface ResolvedLevel {
  code: string;
  name: string;
  minAz: number;
  rank: number;
}

const SCOPE_PRECEDENCE = ['FLAVOR', 'AVAILABILITY_ZONE', 'ZONE', 'REGION'] as const;

export async function resolveAllowedResiliency(
  tx: Tx,
  ctx: ResiliencyContext
): Promise<ResolvedLevel[]> {
  const { productId, flavorId, azCode } = ctx;

  const activeLevels = await tx.resiliencyLevelConfig.findMany({
    where: { isActive: true },
    orderBy: { rank: 'asc' },
  });

  // Resolve geography of the AZ once (zone + region)
  let azRegion: string | null = null;
  let azZoneIds: string[] = [];
  if (azCode) {
    const az = await tx.availabilityZone.findUnique({
      where: { code: azCode },
      select: { region: true, zones: { select: { zoneId: true } } },
    });
    azRegion = az?.region ?? null;
    azZoneIds = az?.zones.map((z) => z.zoneId) ?? [];
  }

  // Commercial regions of the product (ProductRegion): a REGION rule targets
  // either the AZ technical region (eu-west…) or the product's commercial
  // region name (EMEA/APAC/AMER) — products without AZ geography (platform)
  // are scoped through the latter.
  const productCommercialRegions = new Set<string>(
    (await tx.productRegion.findMany({ where: { productId }, select: { region: { select: { name: true } } } }))
      .map((r) => r.region.name)
  );

  // Product-level association (precedence 5)
  const associations = await tx.productResiliency.findMany({ where: { productId } });
  const assocCodes =
    associations.length > 0 ? new Set(associations.map((a) => a.levelCode)) : null;

  // All scope rules relevant to this product (specific + global)
  const rules = await tx.resiliencyScope.findMany({
    where: { level: { isActive: true }, OR: [{ productId }, { productId: null }] },
  });

  const matched = new Map<string, boolean>();
  for (const level of activeLevels) {
    for (const scopeType of SCOPE_PRECEDENCE) {
      // Most specific rule wins: product-specific first, then global
      const candidates = rules
        .filter((r) => r.levelCode === level.code && r.scopeType === scopeType)
        .sort((a, b) => (a.productId ? 0 : 1) - (b.productId ? 0 : 1));
      const rule = candidates.find((r) => {
        switch (scopeType) {
          case 'FLAVOR': return !!flavorId && r.scopeId === flavorId;
          case 'AVAILABILITY_ZONE': return !!azCode && r.scopeId === azCode;
          case 'ZONE': return azZoneIds.includes(r.scopeId);
          case 'REGION': return (!!azRegion && r.scopeId === azRegion) || productCommercialRegions.has(r.scopeId);
        }
      });
      if (rule) {
        matched.set(level.code, rule.allowed);
        break;
      }
    }
  }

  const result: ResolvedLevel[] = [];
  for (const level of activeLevels) {
    if (matched.has(level.code)) {
      if (matched.get(level.code)!) {
        result.push({ code: level.code, name: level.name, minAz: level.minAz, rank: level.rank });
      }
      continue;
    }
    if (assocCodes) {
      // Precedence 5: product association governs unmatched levels
      if (assocCodes.has(level.code)) {
        result.push({ code: level.code, name: level.name, minAz: level.minAz, rank: level.rank });
      }
      continue;
    }
    // Precedence 6: default allow
    result.push({ code: level.code, name: level.name, minAz: level.minAz, rank: level.rank });
  }
  return result;
}

/** Intersect resolved levels across multiple AZ selections (form uses this). */
export function intersectResolved(levelsPerAz: ResolvedLevel[][]): ResolvedLevel[] {
  if (levelsPerAz.length === 0) return [];
  const first = levelsPerAz[0];
  return first.filter((lvl) =>
    levelsPerAz.every((set) => set.some((l) => l.code === lvl.code))
  );
}
