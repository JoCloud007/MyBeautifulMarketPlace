import { PrismaClient, DependencyType, ComputeType } from '@prisma/client';

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
