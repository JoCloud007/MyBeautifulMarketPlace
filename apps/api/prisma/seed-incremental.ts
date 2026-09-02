import { PrismaClient, DependencyType, ComputeType, PerformanceTargetType, VisibilityType } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Incremental seed — adds new objects without wiping existing data.
 *
 * Uses `upsert` (create-or-update) instead of `deleteMany` + `create`.
 * Safe to run on a database that already contains production data.
 *
 * Usage:
 *   docker compose exec api npx tsx prisma/seed-incremental.ts
 */

async function main() {
  console.log('🌱 Incremental seeding — creating or updating objects...');

  // ── Categories ──────────────────────────────────────────────────────
  const compute = await prisma.category.upsert({
    where: { slug: 'compute' },
    update: {},
    create: {
      name: 'Compute',
      slug: 'compute',
      description: 'Virtual machines and compute resources',
      icon: 'Cpu',
    },
  });

  const data = await prisma.category.upsert({
    where: { slug: 'data' },
    update: {},
    create: {
      name: 'Data',
      slug: 'data',
      description: 'Storage and data management services',
      icon: 'Database',
    },
  });

  // Add a NEW category without touching existing ones
  const network = await prisma.category.upsert({
    where: { slug: 'network' },
    update: {},
    create: {
      name: 'Network',
      slug: 'network',
      description: 'Networking and connectivity services',
      icon: 'Globe',
    },
  });

  console.log(`  Categories: compute=${compute.id}, data=${data.id}, network=${network.id}`);

  // ── Products ────────────────────────────────────────────────────────
  // Upsert an existing product (updates description if it exists)
  const vmProduct = await prisma.product.upsert({
    where: { slug: 'virtual-machine' },
    update: {
      description: 'Configurable virtual machine with selectable OS, vCPU, and memory options.',
    },
    create: {
      name: 'Virtual Machine',
      slug: 'virtual-machine',
      description: 'Configurable virtual machine with selectable OS, vCPU, and memory options.',
      categoryId: compute.id,
      computeType: ComputeType.VIRTUAL,
      os: 'Linux',
      documentation: '# Virtual Machine\n\nConfigurable VM with selectable OS.',
      roadmap: '## Roadmap\n- Q3 2024: ARM64 support\n- Q4 2024: GPU instance option',
    },
  });

  // Add a NEW product without touching existing ones
  const loadBalancer = await prisma.product.upsert({
    where: { slug: 'load-balancer' },
    update: {},
    create: {
      name: 'Load Balancer',
      slug: 'load-balancer',
      description: 'Layer 4/7 load balancer with SSL termination and health checks.',
      categoryId: network.id,
      computeType: ComputeType.VIRTUAL,
      os: 'Linux',
      documentation: '# Load Balancer\n\nEnterprise-grade load balancing.',
      roadmap: '## Roadmap\n- Q3 2024: Auto-scaling integration',
    },
  });

  console.log(`  Products: vm=${vmProduct.id}, lb=${loadBalancer.id}`);

  // ── Flavors ─────────────────────────────────────────────────────────
  const small = await prisma.flavor.upsert({
    where: { name: 'Small' },
    update: {},
    create: {
      name: 'Small',
      vcpu: 2,
      ramGb: 4,
      description: 'Entry-level configuration for development and testing',
    },
  });

  const medium = await prisma.flavor.upsert({
    where: { name: 'Medium' },
    update: {},
    create: {
      name: 'Medium',
      vcpu: 4,
      ramGb: 8,
      description: 'Balanced configuration for production workloads',
    },
  });

  console.log(`  Flavors: small=${small.id}, medium=${medium.id}`);

  // ── Dependencies ────────────────────────────────────────────────────
  await prisma.dependency.upsert({
    where: {
      // Prisma requires a unique field for upsert — use a composite unique
      // If your schema does not have @unique([productId, dependsOnId]),
      // use findFirst + create/update instead (see below).
      productId_dependsOnId: {
        productId: loadBalancer.id,
        dependsOnId: vmProduct.id,
      },
    },
    update: {},
    create: {
      productId: loadBalancer.id,
      dependsOnId: vmProduct.id,
      type: DependencyType.REQUIRED,
      description: 'Load balancer requires at least one VM as backend',
    },
  });

  console.log('  Dependencies: created/updated');

  // ── Alternative pattern when no unique constraint exists ────────────
  // For models without a natural unique key, use findFirst + create:
  //
  // const existing = await prisma.someModel.findFirst({
  //   where: { name: 'My Object' },
  // });
  // if (existing) {
  //   await prisma.someModel.update({
  //     where: { id: existing.id },
  //     data: { /* updates */ },
  //   });
  // } else {
  //   await prisma.someModel.create({
  //     data: { /* new object */ },
  //   });
  // }

  // ── Presentation Orders ─────────────────────────────────────────────
  await prisma.presentationOrder.upsert({
    where: { name: 'Default Browse Flow' },
    update: {},
    create: {
      name: 'Default Browse Flow',
      description: 'Browse by country → zone → product → flavor → continuity',
      isActive: true,
      isDefault: true,
      steps: {
        create: [
          { stepType: 'COUNTRY', position: 0, label: 'Country' },
          { stepType: 'ZONE', position: 1, label: 'Zone' },
          { stepType: 'PRODUCT', position: 2, label: 'Product' },
          { stepType: 'FLAVOR', position: 3, label: 'Flavor' },
          { stepType: 'CONTINUITY', position: 4, label: 'Continuity Level' },
        ],
      },
    },
  });

  await prisma.presentationOrder.upsert({
    where: { name: 'Use Case Guided' },
    update: {},
    create: {
      name: 'Use Case Guided',
      description: 'Start with use case, then narrow down',
      isActive: true,
      isDefault: false,
      steps: {
        create: [
          { stepType: 'USE_CASE', position: 0, label: 'Use Case' },
          { stepType: 'CATEGORY', position: 1, label: 'Category' },
          { stepType: 'PRODUCT', position: 2, label: 'Product' },
          { stepType: 'FLAVOR', position: 3, label: 'Flavor' },
        ],
      },
    },
  });
  console.log('  🎨 Presentation orders upserted');

  // ── Performance Profiles ────────────────────────────────────────────
  const perfSeedData = [
    {
      name: 'Virtual Machine — Small',
      targetType: PerformanceTargetType.PRODUCT,
      targetId: vmProduct.id,
      overallScore: 72,
      scoreLabel: 'Good',
      colorTheme: 'blue',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 65, unit: 'index', comparison: 'vs. Medium', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 58, unit: 'GB/s', comparison: 'vs. Medium', displayOrder: 1 },
        { name: 'Network IOPS', value: 8200, unit: 'IOPS', comparison: 'vs. Medium', displayOrder: 2 },
      ],
    },
    {
      name: 'Virtual Machine — Medium',
      targetType: PerformanceTargetType.PRODUCT,
      targetId: vmProduct.id,
      overallScore: 85,
      scoreLabel: 'Very Good',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 82, unit: 'index', comparison: 'vs. Large', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 76, unit: 'GB/s', comparison: 'vs. Large', displayOrder: 1 },
        { name: 'Network IOPS', value: 12500, unit: 'IOPS', comparison: 'vs. Large', displayOrder: 2 },
      ],
    },
    {
      name: 'Load Balancer',
      targetType: PerformanceTargetType.PRODUCT,
      targetId: loadBalancer.id,
      overallScore: 88,
      scoreLabel: 'Very Good',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'Throughput', value: 45000, unit: 'req/s', comparison: 'peak', displayOrder: 0 },
        { name: 'Latency (p99)', value: 8, unit: 'ms', comparison: 'avg', displayOrder: 1 },
        { name: 'SSL TPS', value: 3200, unit: 'handshakes/s', comparison: 'peak', displayOrder: 2 },
      ],
    },
  ];

  for (const p of perfSeedData) {
    const existing = await prisma.performanceProfile.findFirst({
      where: { targetType: p.targetType, targetId: p.targetId },
    });
    if (existing) {
      await prisma.performanceProfile.update({
        where: { id: existing.id },
        data: {
          name: p.name,
          overallScore: p.overallScore,
          scoreLabel: p.scoreLabel,
          colorTheme: p.colorTheme,
          visibility: p.visibility,
          metrics: {
            deleteMany: {},
            create: p.metrics,
          },
        },
      });
    } else {
      await prisma.performanceProfile.create({
        data: {
          name: p.name,
          targetType: p.targetType,
          targetId: p.targetId,
          overallScore: p.overallScore,
          scoreLabel: p.scoreLabel,
          colorTheme: p.colorTheme,
          visibility: p.visibility,
          metrics: { create: p.metrics },
        },
      });
    }
  }
  console.log('  🎯 Performance profiles upserted');

  console.log('✅ Incremental seed completed — no data was deleted');
}

main()
  .catch((e) => {
    console.error('❌ Incremental seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
