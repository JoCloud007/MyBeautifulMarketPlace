import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Diagnostic seeds...\n');

  const osCount = await prisma.operatingSystem.count();
  const osVersionCount = await prisma.osVersion.count();
  const productVersionCount = await prisma.productVersion.count();
  const productVariantCount = await prisma.productVariant.count();
  const variantWithoutDates = await prisma.productVariant.count({ where: { releaseDate: null } });
  const pvWithoutDates = await prisma.productVersion.count({ where: { releaseDate: null } });

  console.log(`OperatingSystem:     ${osCount}`);
  console.log(`OsVersion:           ${osVersionCount}`);
  console.log(`ProductVersion:      ${productVersionCount}`);
  console.log(`ProductVariant:      ${productVariantCount}`);
  console.log(`Variant sans dates:  ${variantWithoutDates}`);
  console.log(`PV sans dates:       ${pvWithoutDates}`);

  if (productVersionCount === 0) {
    console.log('\n⚠️  AUCUN ProductVersion — la page "Products versions" est vide car seed-incremental.ts ne les crée pas.');
    console.log('   → Solution: exécuter le seed complet (destructif) ou créer les versions via l\'admin.');
  }

  if (productVariantCount === 0) {
    console.log('\n⚠️  AUCUN ProductVariant — la Roadmap est vide car il n\'y a pas de variant à afficher.');
    console.log('   → Solution: exécuter le seed complet (destructif) ou créer les variants via l\'admin.');
  }

  if (variantWithoutDates > 0) {
    console.log(`\n⚠️  ${variantWithoutDates} ProductVariant sans dates de cycle de vie.`);
    console.log('   → Solution: make backfill-variants (copie les dates depuis OsVersion)');
  }

  if (pvWithoutDates > 0) {
    console.log(`\n⚠️  ${pvWithoutDates} ProductVersion sans dates de cycle de vie.`);
    console.log('   → Solution: les renseigner via l\'admin ou un script.');
  }

  if (productVersionCount > 0 && productVariantCount > 0 && variantWithoutDates === 0 && pvWithoutDates === 0) {
    console.log('\n✅ Toutes les données semblent présentes.');
    console.log('   Si la roadmap est toujours vide, vérifiez les filtres actifs sur la page.');
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
