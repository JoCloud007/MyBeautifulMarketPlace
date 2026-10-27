/**
 * Data migration — backfill version tuples (spec: Stacks de produits §1.1).
 *
 * The `versionMajor` / `versionMinor` / `versionPatch` columns on
 * ProductVersion and OsVersion are added nullable; this script derives them
 * for every existing row through the shared parser (apps/api/src/lib/version.ts)
 * so rows written before the columns existed are comparable by range rules.
 *
 * Idempotent: a row is only written when its stored tuple differs from the
 * one derived from `version` (including clearing a stale tuple back to null
 * for non-numeric versions). A re-run after everything is in sync writes
 * nothing.
 *
 * Run from the host (docker tsx breaks on the esbuild platform mismatch):
 *   cd apps/api && DATABASE_URL="postgresql://cloudmarket:cloudmarket_secret@localhost:5433/cloudmarket?schema=public" npx tsx prisma/backfill-version-tuples.ts
 */
import { PrismaClient } from '@prisma/client';
import { versionTupleFields } from '../src/lib/version';

const prisma = new PrismaClient();

interface TupleRow {
  id: string;
  version: string;
  versionMajor: number | null;
  versionMinor: number | null;
  versionPatch: number | null;
}

async function backfillTable(
  label: string,
  rows: TupleRow[],
  update: (id: string, fields: ReturnType<typeof versionTupleFields>) => Promise<unknown>
): Promise<number> {
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const fields = versionTupleFields(row.version);
    const unchanged =
      row.versionMajor === fields.versionMajor &&
      row.versionMinor === fields.versionMinor &&
      row.versionPatch === fields.versionPatch;
    if (unchanged) {
      skipped++;
      continue;
    }
    await update(row.id, fields);
    updated++;
    console.log(
      `  updated: ${label} ${row.id} (${row.version}) → ` +
        `(${fields.versionMajor ?? 'null'}, ${fields.versionMinor ?? 'null'}, ${fields.versionPatch ?? 'null'})`
    );
  }

  console.log(
    `  ${label}: ${updated} updated, ${skipped} already in sync (${rows.length} rows scanned)`
  );
  return updated;
}

async function main() {
  const productVersions = await prisma.productVersion.findMany({
    select: {
      id: true,
      version: true,
      versionMajor: true,
      versionMinor: true,
      versionPatch: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const osVersions = await prisma.osVersion.findMany({
    select: {
      id: true,
      version: true,
      versionMajor: true,
      versionMinor: true,
      versionPatch: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const pvUpdated = await backfillTable('ProductVersion', productVersions, (id, fields) =>
    prisma.productVersion.update({ where: { id }, data: fields })
  );
  const osUpdated = await backfillTable('OsVersion', osVersions, (id, fields) =>
    prisma.osVersion.update({ where: { id }, data: fields })
  );

  console.log(
    `backfill done — ${pvUpdated + osUpdated} rows updated, ` +
      `${productVersions.length + osVersions.length} rows scanned`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
