/**
 * Data migration — normalisation des flavors storage (convention client, 2026-10-13).
 *
 * Problème : les flavors NAS portaient la TAILLE dans leur nom (NAS 1TB/10TB/50TB/100TB)
 * et des vcpu/ramGb à 0 — absurde : vCPU/RAM ne concernent que le compute.
 * Convention retenue :
 *   - Une flavor storage = une CLASSE DE SERVICE (tier), pas une taille.
 *   - La taille (maxGb) et les IOPS sont des variables saisies à la demande
 *     (ForecastLine.metadata), pas des propriétés de flavor.
 *
 * Actions (idempotent) :
 *   1. Rattachement des flavors storage sans catégorie à la catégorie "Data".
 *   2. Renommage NAS <taille> → classes de service NAS (Basic / Standard / Premium / Extreme)
 *      mappées depuis les IOPS du nom d'origine.
 *   3. Attributes normalisés { tier, iops } — suppression de vcpu/ramGb/maxGb,
 *      et remise à NULL des colonnes vcpu/ramGb (0 n'a pas de sens).
 *   4. Les flavors Object * existantes reçoivent { tier, iops } cohérent.
 *   5. netGb par défaut SUGGÉRÉ dans description (aide à la saisie, non contraignant).
 *
 * Idempotent : rejouable sans effet sur une base déjà migrée.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** NAS size-name → service class. IOPS values are the class baseline. */
const NAS_RENAMES: Record<string, { name: string; tier: string; iops: number; suggestedGb: number }> = {
  'NAS 1TB': { name: 'NAS Basic', tier: 'Standard', iops: 1000, suggestedGb: 1000 },
  'NAS 10TB': { name: 'NAS Standard', tier: 'Standard', iops: 5000, suggestedGb: 10000 },
  'NAS 50TB': { name: 'NAS Premium', tier: 'Premium', iops: 20000, suggestedGb: 50000 },
  'NAS 100TB': { name: 'NAS Extreme', tier: 'Premium', iops: 100000, suggestedGb: 100000 },
};

const OBJECT_TIERS: Record<string, { tier: string; iops: number }> = {
  'Object Standard': { tier: 'Standard', iops: 5000 },
  'Object Cold': { tier: 'Cold', iops: 1000 },
  'Object Archive': { tier: 'Archive', iops: 100 },
  'S3-Standard': { tier: 'Standard', iops: 3000 },
};

/** Stable compare: sort keys so JSONB key order (Postgres) doesn't defeat idempotence. */
function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
}

async function main() {
  const dataCategory = await prisma.category.findFirst({ where: { name: 'Data' } });
  if (!dataCategory) throw new Error('Category "Data" not found — run migrate-flavor-fields first');

  // 1. Storage flavors (NAS + Object + S3) currently uncategorized → Data
  const storageNames = [...Object.keys(NAS_RENAMES), ...Object.keys(OBJECT_TIERS)];
  const flavors = await prisma.flavor.findMany({
    where: { name: { in: storageNames } },
    include: { category: true },
  });

  let renamed = 0;
  let normalized = 0;

  for (const f of flavors) {
    const updates: Record<string, unknown> = {};

    if (!f.categoryId) updates.categoryId = dataCategory.id;

    // 2. Rename NAS sizes → service classes
    const rename = NAS_RENAMES[f.name];
    if (rename && f.name !== rename.name) {
      const clash = await prisma.flavor.findUnique({ where: { name: rename.name } });
      if (clash && clash.id !== f.id) {
        console.warn(`  SKIP rename ${f.name} → ${rename.name}: target name already exists`);
      } else {
        updates.name = rename.name;
        renamed++;
      }
    }

    // 3-4. Normalize attributes to { tier, iops }
    const tierSource = rename?.tier ?? OBJECT_TIERS[f.name]?.tier ?? OBJECT_TIERS[rename?.name ?? '']?.tier;
    const iopsSource = rename?.iops ?? OBJECT_TIERS[f.name]?.iops;
    const existing = (f.attributes as Record<string, unknown>) || {};
    const tier = tierSource ?? (typeof existing.tier === 'string' ? existing.tier : 'Standard');
    const iops = iopsSource ?? (typeof existing.iops === 'number' ? existing.iops : undefined);

    const attrs: Record<string, unknown> = { tier };
    if (iops !== undefined) attrs.iops = iops;
    updates.attributes = attrs as any;
    const attrsEqual =
      JSON.stringify(sortKeys(attrs)) === JSON.stringify(sortKeys(existing));

    // vcpu/ramGb = 0 has no meaning for storage → NULL
    if (f.vcpu === 0) updates.vcpu = null;
    if (f.ramGb === 0) updates.ramGb = null;

    const changed =
      (updates.categoryId !== undefined && f.categoryId !== updates.categoryId) ||
      (updates.name !== undefined && updates.name !== f.name) ||
      !attrsEqual ||
      f.vcpu === 0 ||
      f.ramGb === 0;

    if (changed) {
      await prisma.flavor.update({ where: { id: f.id }, data: updates as any });
      normalized++;
      console.log(`  normalized ${f.name}${updates.name && updates.name !== f.name ? ` → ${updates.name}` : ''}: ${JSON.stringify(attrs)}`);
    }
  }

  // 5. Suggested size documented in description (idempotent update)
  for (const [, spec] of Object.entries(NAS_RENAMES)) {
    const target = await prisma.flavor.findFirst({ where: { name: spec.name } });
    if (!target) continue;
    const desc = `Shared file storage — ${spec.tier} class, baseline ${spec.iops.toLocaleString('en-US')} IOPS. Capacity is chosen per request (typical: ${spec.suggestedGb.toLocaleString('en-US')} GB).`;
    if (target.description !== desc) {
      await prisma.flavor.update({ where: { id: target.id }, data: { description: desc } });
    }
  }

  console.log(`storage flavors: ${renamed} renamed, ${normalized} normalized (${flavors.length} scanned)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
