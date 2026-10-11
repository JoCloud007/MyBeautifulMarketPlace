/**
 * Data migration — flavors data-driven par catégorie.
 * 1. Backfill de Flavor.attributes scopé par catégorie :
 *    - flavor avec catégorie → seules les clés définies par cette catégorie sont conservées
 *      (Compute : vcpu/ramGb ; Data : ramGb existant mappé vers maxGb, vcpu supprimé)
 *    - flavor sans catégorie (legacy) → clés vcpu/ramGb conservées telles quelles
 * 2. Seed des FlavorFieldDefinition :
 *    - Compute : vcpu (number, vCPU) + ramGb (number, GB) — required
 *    - Data : maxGb (number, GB, required) + iops (number, IOPS) + tier (enum)
 * Idempotent (upsert sur @@unique([categoryId, key]) ; backfill normalisant).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 0. S'assurer que les définitions existent avant le backfill (le scoping en dépend)
  const defs: { category: string; key: string; label: string; unit?: string; type: string; required?: boolean; order: number; options?: string[] }[] = [
    { category: 'Compute', key: 'vcpu', label: 'vCPU', unit: 'vCPU', type: 'number', required: true, order: 0 },
    { category: 'Compute', key: 'ramGb', label: 'RAM', unit: 'GB', type: 'number', required: true, order: 1 },
    { category: 'Data', key: 'maxGb', label: 'Max capacity', unit: 'GB', type: 'number', required: true, order: 0 },
    { category: 'Data', key: 'iops', label: 'IOPS', unit: 'IOPS', type: 'number', order: 1 },
    { category: 'Data', key: 'tier', label: 'Storage tier', type: 'enum', order: 2, options: ['Standard', 'Cold', 'Archive'] },
  ];

  for (const def of defs) {
    const category = await prisma.category.findFirst({ where: { name: def.category } });
    if (!category) {
      console.log(`category "${def.category}" not found — skipping ${def.key}`);
      continue;
    }
    await prisma.flavorFieldDefinition.upsert({
      where: { categoryId_key: { categoryId: category.id, key: def.key } },
      update: { label: def.label, unit: def.unit, type: def.type, required: def.required ?? false, order: def.order, options: def.options ?? undefined },
      create: {
        categoryId: category.id,
        key: def.key,
        label: def.label,
        unit: def.unit,
        type: def.type,
        required: def.required ?? false,
        order: def.order,
        options: def.options ?? undefined,
      },
    });
    console.log(`field definition ${def.category}/${def.key} ensured`);
  }

  // 1. Backfill / normalisation des attributes, scopé par catégorie
  const categories = await p_categoryMap();
  const flavors = await prisma.flavor.findMany({ include: { category: { include: { flavorFieldDefinitions: true } } } });
  let normalized = 0;

  for (const f of flavors) {
    const existing = (f.attributes as Record<string, unknown>) || {};
    const catName = f.category?.name ?? null;
    const catDefs = f.category?.flavorFieldDefinitions ?? [];
    let attrs: Record<string, unknown>;

    if (catName === 'Data') {
      // Legacy Data flavors stockaient la capacité dans ramGb → mapper vers maxGb, vcpu n'a pas de sens
      const maxGb = existing.maxGb ?? (f.ramGb != null ? f.ramGb : existing.ramGb);
      if (maxGb === undefined) {
        // Aucune source de capacité : ne pas créer un attributes vide silencieusement —
        // ce flavor échouera la validation required à la prochaine sauvegarde, on le signale.
        console.warn(`  WARNING: Data flavor "${f.name}" has no capacity source (no attributes.maxGb, no ramGb) — required "maxGb" left unbackfilled, it must be set manually or the flavor updated.`);
        attrs = { ...existing };
        delete attrs.vcpu;
        delete attrs.ramGb;
      } else {
        attrs = { ...existing, maxGb };
        delete attrs.vcpu;
        delete attrs.ramGb;
      }
    } else if (catName === 'Compute' || !catName) {
      // Compute ou flavor legacy sans catégorie : clés vcpu/ramGb
      attrs = { ...existing };
      if (f.vcpu != null && attrs.vcpu == null) attrs.vcpu = f.vcpu;
      if (f.ramGb != null && attrs.ramGb == null) attrs.ramGb = f.ramGb;
    } else {
      // Autre catégorie : conserver tel quel (pas de définition connue)
      attrs = { ...existing };
    }

    // Scopage final : si la catégorie a des définitions, ne garder que les clés définies
    if (catDefs.length > 0) {
      const validKeys = new Set(catDefs.map((d) => d.key));
      attrs = Object.fromEntries(Object.entries(attrs).filter(([k]) => validKeys.has(k)));
    }

    const changed = JSON.stringify(attrs) !== JSON.stringify(existing);
    if (changed) {
      await prisma.flavor.update({ where: { id: f.id }, data: { attributes: attrs as any } });
      normalized++;
      console.log(`  normalized ${f.name} (${catName ?? 'no category'}): ${JSON.stringify(attrs)}`);
    }
  }
  console.log(`attributes normalized on ${normalized} flavor(s) (${flavors.length} scanned)`);
}

async function p_categoryMap() {
  return prisma.category.findMany();
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
