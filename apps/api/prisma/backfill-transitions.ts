/**
 * Data migration — backfill UpgradePath → Transition.
 *
 * Transition is the single source of truth for product transitions; the legacy
 * UpgradePath table kept receiving writes from old seeds and MCP tools, which
 * is why some transitions showed in the product drawer but not on the
 * Transitions page. This copies every UpgradePath row that has no Transition
 * yet with the same (fromProductId, toProductId, fromVersion, toVersion) pair.
 *
 * Insert-only and idempotent: a re-run finds the pairs already present and
 * creates nothing.
 *
 * Run from the host (docker tsx breaks on the esbuild platform mismatch):
 *   cd apps/api && DATABASE_URL="postgresql://cloudmarket:cloudmarket_secret@localhost:5433/cloudmarket?schema=public" npx tsx prisma/backfill-transitions.ts
 */
import { PrismaClient } from '@prisma/client';
import { autoTransitionName } from '../src/lib/transition-name';

const prisma = new PrismaClient();

/** Slug is unique on Transition — suffix with the row id segment on collision. */
async function uniqueSlug(name: string, fallbackSeed: string): Promise<string> {
  const base = `trn-${name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
  const candidate = await prisma.transition.findUnique({ where: { slug: base } });
  if (!candidate) return base;
  return `${base}-${fallbackSeed.slice(0, 8)}`;
}

async function main() {
  const paths = await prisma.upgradePath.findMany({
    include: {
      fromProduct: { select: { id: true, name: true } },
      toProduct: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  let created = 0;
  let skipped = 0;

  for (const up of paths) {
    const existing = await prisma.transition.findFirst({
      where: {
        fromProductId: up.fromProductId,
        toProductId: up.toProductId,
        fromVersion: up.fromVersion,
        toVersion: up.toVersion,
      },
    });
    if (existing) {
      skipped++;
      console.log(
        `  skipped (pair already in Transition): ${up.fromProduct?.name} ${up.fromVersion} → ${up.toVersion} [${existing.name}]`
      );
      continue;
    }

    const name = autoTransitionName({
      fromProductName: up.fromProduct?.name ?? 'Unknown product',
      toProductName: up.toProduct?.name ?? 'Unknown product',
      fromVersion: up.fromVersion,
      toVersion: up.toVersion,
    });
    const slug = await uniqueSlug(name, up.id);

    await prisma.transition.create({
      data: {
        name,
        slug,
        description: null,
        fromProductId: up.fromProductId,
        toProductId: up.toProductId,
        fromVersion: up.fromVersion,
        toVersion: up.toVersion,
        migrationType: up.migrationType,
        status: 'AVAILABLE',
        notes: up.notes,
        createdAt: up.createdAt,
      },
    });
    created++;
    console.log(`  created: ${name} [${slug}] (${up.migrationType})`);
  }

  console.log(`backfill done — ${created} created, ${skipped} already present (${paths.length} UpgradePath rows scanned)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
