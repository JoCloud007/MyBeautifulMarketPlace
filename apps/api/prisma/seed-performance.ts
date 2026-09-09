import { PrismaClient, PerformanceTargetType, VisibilityType } from '@prisma/client';

const prisma = new PrismaClient();

function getScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Very Good';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Average';
  return 'Fair';
}

function getColorTheme(score: number): 'green' | 'blue' | 'yellow' | 'red' {
  if (score >= 80) return 'green';
  if (score >= 60) return 'blue';
  if (score >= 40) return 'yellow';
  return 'red';
}

function generateProductMetrics(score: number) {
  const base = score / 100;
  return [
    { name: 'Performance', value: Math.round((7 + base * 3) * 10) / 10, unit: '/10', comparison: 'industry avg', displayOrder: 0 },
    { name: 'Reliability', value: Math.round((7.5 + base * 2.5) * 10) / 10, unit: '/10', comparison: 'SLA 99.95%', displayOrder: 1 },
    { name: 'Scalability', value: Math.round((6.5 + base * 3.5) * 10) / 10, unit: '/10', comparison: 'horizontal', displayOrder: 2 },
    { name: 'Cost Efficiency', value: Math.round((5 + base * 4) * 10) / 10, unit: '/10', comparison: 'per vCPU/hr', displayOrder: 3 },
  ];
}

function generateFlavorMetrics(vcpu: number, ramGb: number) {
  const cpuScore = Math.min(10, Math.round((2 + vcpu * 0.5) * 10) / 10);
  const ramScore = Math.min(10, Math.round((2 + ramGb * 0.25) * 10) / 10);
  return [
    { name: 'CPU Power', value: cpuScore, unit: '/10', comparison: `${vcpu} vCPU`, displayOrder: 0 },
    { name: 'Memory', value: ramScore, unit: '/10', comparison: `${ramGb} GB`, displayOrder: 1 },
    { name: 'Price/Perf', value: Math.round((5 + Math.random() * 3) * 10) / 10, unit: '/10', comparison: 'best in class', displayOrder: 2 },
    { name: 'Energy Eff.', value: Math.round((6 + Math.random() * 3) * 10) / 10, unit: '/10', comparison: 'green compute', displayOrder: 3 },
  ];
}

async function main() {
  console.log('🌱 Seeding performance profiles...');

  // Clean existing performance profiles
  await prisma.performanceMetric.deleteMany();
  await prisma.performanceProfile.deleteMany();
  console.log('  ✓ Cleaned existing performance profiles');

  // Fetch all products
  const products = await prisma.product.findMany({
    select: { id: true, name: true, categoryId: true },
  });
  console.log(`  → Found ${products.length} products`);

  // Fetch all flavors
  const flavors = await prisma.flavor.findMany({
    select: { id: true, name: true, vcpu: true, ramGb: true },
  });
  console.log(`  → Found ${flavors.length} flavors`);

  // Generate deterministic scores based on product name
  const getProductScore = (name: string) => {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
    return 65 + (Math.abs(hash) % 30); // 65-95 range
  };

  // Create profiles for products
  for (const product of products) {
    const score = getProductScore(product.name);
    const profile = await prisma.performanceProfile.create({
      data: {
        name: `${product.name} Profile`,
        targetType: PerformanceTargetType.PRODUCT,
        targetId: product.id,
        overallScore: score,
        scoreLabel: getScoreLabel(score),
        colorTheme: getColorTheme(score),
        visibility: VisibilityType.SHOW_ALL,
        metrics: {
          create: generateProductMetrics(score),
        },
      },
    });
    console.log(`  ✓ Product profile: ${profile.name} (score: ${score})`);
  }

  // Create profiles for flavors
  for (const flavor of flavors) {
    const score = getProductScore(flavor.name);
    const profile = await prisma.performanceProfile.create({
      data: {
        name: `${flavor.name} Profile`,
        targetType: PerformanceTargetType.FLAVOR,
        targetId: flavor.id,
        overallScore: score,
        scoreLabel: getScoreLabel(score),
        colorTheme: getColorTheme(score),
        visibility: VisibilityType.SHOW_ALL,
        metrics: {
          create: generateFlavorMetrics(flavor.vcpu ?? 0, flavor.ramGb ?? 0),
        },
      },
    });
    console.log(`  ✓ Flavor profile: ${profile.name} (score: ${score})`);
  }

  console.log('🎉 Performance profiles seeded successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
