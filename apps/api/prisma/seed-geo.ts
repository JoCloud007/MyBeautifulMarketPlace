import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const productFirst = await prisma.presentationOrder.upsert({
    where: { name: 'Product First' },
    update: {},
    create: {
      name: 'Product First',
      description: 'Browse by category, then product, then flavor',
      isActive: true,
      isDefault: true,
      steps: {
        create: [
          { stepType: 'CATEGORY', position: 0, label: 'Category' },
          { stepType: 'PRODUCT', position: 1, label: 'Product' },
          { stepType: 'FLAVOR', position: 2, label: 'Flavor' },
        ],
      },
    },
    include: { steps: true },
  });

  const locationFirst = await prisma.presentationOrder.upsert({
    where: { name: 'Location First' },
    update: {},
    create: {
      name: 'Location First',
      description: 'Browse by country, then zone, then product, then flavor',
      isActive: true,
      isDefault: false,
      steps: {
        create: [
          { stepType: 'COUNTRY', position: 0, label: 'Country' },
          { stepType: 'ZONE', position: 1, label: 'Zone' },
          { stepType: 'PRODUCT', position: 2, label: 'Product' },
          { stepType: 'FLAVOR', position: 3, label: 'Flavor' },
        ],
      },
    },
    include: { steps: true },
  });

  console.log('Seeded presentation orders:');
  console.log('- Product First:', productFirst.id);
  console.log('- Location First:', locationFirst.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
