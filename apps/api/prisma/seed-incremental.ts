import { PrismaClient, DependencyType, ComputeType, PerformanceTargetType, VisibilityType, Role } from '@prisma/client';

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

  // ── Flavor Profiles (Profile × Size grid) ───────────────────────────
  // Idempotent: upsert per (categoryId, slug), never overwrites admin edits (update: {}).
  const profileSpecs: { categorySlug: string; name: string; slug: string; description: string; icon: string; color: string; order: number }[] = [
    { categorySlug: 'compute', name: 'General purpose', slug: 'general-purpose', description: 'Balanced CPU/RAM for web servers, dev & test', icon: 'Server', color: 'blue', order: 0 },
    { categorySlug: 'compute', name: 'Compute oriented', slug: 'compute-oriented', description: 'High-frequency cores, compute-bound workloads', icon: 'Cpu', color: 'amber', order: 1 },
    { categorySlug: 'compute', name: 'Memory oriented', slug: 'memory-oriented', description: 'High RAM per core, in-memory databases and caching', icon: 'MemoryStick', color: 'violet', order: 2 },
    { categorySlug: 'compute', name: 'Storage optimized', slug: 'storage-optimized', description: 'Local NVMe and high sequential throughput', icon: 'HardDrive', color: 'green', order: 3 },
    { categorySlug: 'compute', name: 'Accelerated', slug: 'accelerated', description: 'GPU/FPGA accelerated computing', icon: 'Zap', color: 'red', order: 4 },
    { categorySlug: 'data', name: 'Throughput', slug: 'throughput', description: 'Sequential throughput oriented storage', icon: 'Gauge', color: 'blue', order: 0 },
    { categorySlug: 'data', name: 'IOPS', slug: 'iops', description: 'High random IOPS for transactional workloads', icon: 'Activity', color: 'amber', order: 1 },
    { categorySlug: 'data', name: 'Archive', slug: 'archive', description: 'Long-term retention, cold data', icon: 'Archive', color: 'violet', order: 2 },
  ];

  const profiles: Record<string, string> = {};
  for (const spec of profileSpecs) {
    const categoryId = spec.categorySlug === 'compute' ? compute.id : data.id;
    const rec = await prisma.flavorProfile.upsert({
      where: { categoryId_slug: { categoryId, slug: spec.slug } },
      update: {},
      create: {
        categoryId,
        name: spec.name,
        slug: spec.slug,
        description: spec.description,
        icon: spec.icon,
        color: spec.color,
        order: spec.order,
      },
    });
    profiles[spec.slug] = rec.id;
  }
  console.log(`  Flavor profiles: ${Object.keys(profiles).length} ensured`);

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

  const large = await prisma.flavor.upsert({
    where: { name: 'Large' },
    update: {},
    create: {
      name: 'Large',
      vcpu: 8,
      ramGb: 16,
      description: '8 vCPU / 16 GB — demanding applications',
    },
  });

  const xl = await prisma.flavor.upsert({
    where: { name: 'XL' },
    update: {},
    create: {
      name: 'XL',
      vcpu: 16,
      ramGb: 32,
      description: '16 vCPU / 32 GB — enterprise workloads',
    },
  });

  const bmMedium = await prisma.flavor.upsert({
    where: { name: 'BM Medium' },
    update: {},
    create: {
      name: 'BM Medium',
      vcpu: 16,
      ramGb: 64,
      description: 'Dedicated 16 cores / 64 GB — single-tenant',
    },
  });

  const bmLarge = await prisma.flavor.upsert({
    where: { name: 'BM Large' },
    update: {},
    create: {
      name: 'BM Large',
      vcpu: 32,
      ramGb: 128,
      description: 'Dedicated 32 cores / 128 GB — single-tenant',
    },
  });

  const bmXl = await prisma.flavor.upsert({
    where: { name: 'BM XL' },
    update: {},
    create: {
      name: 'BM XL',
      vcpu: 64,
      ramGb: 256,
      description: 'Dedicated 64 cores / 256 GB — single-tenant',
    },
  });

  console.log(`  Flavors: small=${small.id}, medium=${medium.id}, large=${large.id}, xl=${xl.id}, bm=${bmMedium.id}/${bmLarge.id}/${bmXl.id}`);

  // ── Flavor grid positioning ─────────────────────────────────────────
  // Idempotent: assigns profileId/sizeLabel/sizeRank to demo flavors.
  // Scoped to the grid columns only — never touches attributes or geo links.
  const gridPositioning: { name: string; categoryId: string; profileSlug: string; sizeLabel: string; sizeRank: number }[] = [
    { name: 'Small', categoryId: compute.id, profileSlug: 'general-purpose', sizeLabel: 'S', sizeRank: 1 },
    { name: 'Medium', categoryId: compute.id, profileSlug: 'general-purpose', sizeLabel: 'M', sizeRank: 2 },
    { name: 'Large', categoryId: compute.id, profileSlug: 'general-purpose', sizeLabel: 'L', sizeRank: 3 },
    { name: 'XL', categoryId: compute.id, profileSlug: 'general-purpose', sizeLabel: 'XL', sizeRank: 4 },
    { name: 'BM Medium', categoryId: compute.id, profileSlug: 'memory-oriented', sizeLabel: 'M', sizeRank: 2 },
    { name: 'BM Large', categoryId: compute.id, profileSlug: 'memory-oriented', sizeLabel: 'L', sizeRank: 3 },
    { name: 'BM XL', categoryId: compute.id, profileSlug: 'memory-oriented', sizeLabel: 'XL', sizeRank: 4 },
  ];

  for (const pos of gridPositioning) {
    await prisma.flavor.updateMany({
      where: { name: pos.name, categoryId: null }, // only position unpositioned flavors
      data: {
        categoryId: pos.categoryId,
        profileId: profiles[pos.profileSlug],
        sizeLabel: pos.sizeLabel,
        sizeRank: pos.sizeRank,
      },
    });
  }
  console.log(`  Flavor grid: positioned ${gridPositioning.length} demo flavors (only when previously unpositioned)`);

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
  // Note: VM/BM perf is expressed via per-FLAVOR profiles below; product-level
  // profiles are only for products whose performance is not per-flavor.
  const perfSeedData = [
    // ── Per-flavor profiles ──
    {
      name: 'Small',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: small.id,
      overallScore: 58,
      scoreLabel: 'Average',
      colorTheme: 'blue',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 62, unit: 'index', comparison: '2 vCPU · entry', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 48, unit: 'GB/s', comparison: '4 GB RAM', displayOrder: 1 },
        { name: 'Network IOPS', value: 6400, unit: 'IOPS', comparison: 'baseline', displayOrder: 2 },
      ],
    },
    {
      name: 'Medium',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: medium.id,
      overallScore: 71,
      scoreLabel: 'Good',
      colorTheme: 'blue',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 74, unit: 'index', comparison: '4 vCPU · balanced', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 66, unit: 'GB/s', comparison: '8 GB RAM', displayOrder: 1 },
        { name: 'Network IOPS', value: 9600, unit: 'IOPS', comparison: 'baseline ×1.5', displayOrder: 2 },
      ],
    },
    {
      name: 'Large',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: large.id,
      overallScore: 83,
      scoreLabel: 'Very Good',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 85, unit: 'index', comparison: '8 vCPU', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 82, unit: 'GB/s', comparison: '16 GB RAM', displayOrder: 1 },
        { name: 'Network IOPS', value: 14000, unit: 'IOPS', comparison: 'baseline ×2.2', displayOrder: 2 },
      ],
    },
    {
      name: 'XL',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: xl.id,
      overallScore: 91,
      scoreLabel: 'Excellent',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 93, unit: 'index', comparison: '16 vCPU', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 95, unit: 'GB/s', comparison: '32 GB RAM', displayOrder: 1 },
        { name: 'Network IOPS', value: 22000, unit: 'IOPS', comparison: 'baseline ×3.4', displayOrder: 2 },
      ],
    },
    {
      name: 'BM Medium',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: bmMedium.id,
      overallScore: 84,
      scoreLabel: 'Very Good',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 86, unit: 'index', comparison: '16 dedicated cores', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 88, unit: 'GB/s', comparison: '64 GB RAM', displayOrder: 1 },
        { name: 'Network Throughput', value: 10, unit: 'Gbps', comparison: 'uplink', displayOrder: 2 },
      ],
    },
    {
      name: 'BM Large',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: bmLarge.id,
      overallScore: 92,
      scoreLabel: 'Excellent',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 94, unit: 'index', comparison: '32 dedicated cores', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 108, unit: 'GB/s', comparison: '128 GB RAM', displayOrder: 1 },
        { name: 'Network Throughput', value: 25, unit: 'Gbps', comparison: 'uplink', displayOrder: 2 },
      ],
    },
    {
      name: 'BM XL',
      targetType: PerformanceTargetType.FLAVOR,
      targetId: bmXl.id,
      overallScore: 97,
      scoreLabel: 'Excellent',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 98, unit: 'index', comparison: '64 dedicated cores', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 122, unit: 'GB/s', comparison: '256 GB RAM', displayOrder: 1 },
        { name: 'Network Throughput', value: 50, unit: 'Gbps', comparison: 'uplink ×2', displayOrder: 2 },
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
      where: { targetType: p.targetType, targetId: p.targetId, name: p.name },
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

  // ── Users (forecast lifecycle roles) ────────────────────────────────
  // Idempotent upserts on the unique email — never deletes or downgrades
  // existing users. Creates the governance roles needed by the forecast
  // lifecycle (REQUESTER, TECH_LEAD, MANAGER, FINANCE, ADMIN).
  // Roles are UNIONED into existing users (never removed), so users that
  // predate the lifecycle feature (empty roles) are brought up to date.

  /** Add roles a user is missing. Additive only — existing roles are kept. */
  async function ensureUser(
    email: string,
    name: string,
    createData: { role: 'ADMIN' | 'USER'; roles: Role[]; managerId?: string },
  ) {
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, name, ...createData },
    });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const missing = createData.roles.filter((r) => !user.roles.includes(r as never));
    if (missing.length > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: { roles: { set: [...user.roles, ...(missing as Role[])] } },
      });
    }
    return user;
  }

  await ensureUser('admin@cloudmarket.local', 'System Administrator', {
    role: 'ADMIN',
    roles: ['ADMIN', 'REQUESTER', 'TECH_LEAD', 'MANAGER', 'FINANCE'],
  });

  const managerUser = await ensureUser('manager@cloudmarket.local', 'Carol Manager', {
    role: 'USER',
    roles: ['MANAGER'],
  });

  await ensureUser('techlead@cloudmarket.local', 'Trevor TechLead', {
    role: 'USER',
    roles: ['TECH_LEAD'],
  });

  await ensureUser('finance@cloudmarket.local', 'Fiona Finance', {
    role: 'USER',
    roles: ['FINANCE'],
  });

  await ensureUser('user@cloudmarket.local', 'Demo User', {
    role: 'USER',
    roles: ['REQUESTER'],
    managerId: managerUser.id,
  });

  console.log('  👥 Users with lifecycle roles upserted');

  // ── ProductVariant lifecycle dates ────────────────────────────────
  // Backfill releaseDate / support dates from OsVersion when missing
  const variantsWithoutDates = await prisma.productVariant.findMany({
    where: { releaseDate: null },
    include: { osVersion: true },
  });

  if (variantsWithoutDates.length > 0) {
    console.log(`  📅 Backfilling ${variantsWithoutDates.length} ProductVariant lifecycle dates from OsVersion...`);
    for (const pv of variantsWithoutDates) {
      if (pv.osVersion) {
        await prisma.productVariant.update({
          where: { id: pv.id },
          data: {
            releaseDate: pv.osVersion.releaseDate,
            normalSupportEnd: pv.osVersion.normalSupportEnd,
            extendedSupportEnd: pv.osVersion.extendedSupportEnd,
            eolDate: pv.osVersion.eolDate,
            phase: pv.osVersion.phase,
          },
        });
      }
    }
    console.log('  ✅ Lifecycle dates backfilled');
  } else {
    console.log('  ✅ All ProductVariants already have lifecycle dates');
  }

  // ── Product stacks & compatibility (demo, idempotent) ───────────────
  // Spec: Stacks de produits & matrice de compatibilité §7. A product stack
  // is a ProductVersion carrying pinned components (ProductVersionComponent);
  // compatibility verdicts are CALCULATED from CompatibilityRule rows.
  // Nothing is deleted; rules are upserted by fixed ids, versions by
  // (productId, version), component links only created when missing.
  {
    const { versionTupleFields } = require('../src/lib/version') as typeof import('../src/lib/version');

    // Demo products: a composite (Managed PostgreSQL) and its component (VM).
    const pgProduct = await prisma.product.upsert({
      where: { slug: 'managed-postgresql' },
      update: { description: 'Managed PostgreSQL database service — composed of a General Purpose VM (product stack).' },
      create: {
        name: 'Managed PostgreSQL',
        slug: 'managed-postgresql',
        description: 'Managed PostgreSQL database service — composed of a General Purpose VM (product stack).',
        categoryId: data.id,
        os: 'Linux',
      },
    });
    const gpVmProduct = await prisma.product.upsert({
      where: { slug: 'general-purpose-vm' },
      update: {},
      create: {
        name: 'General Purpose VM',
        slug: 'general-purpose-vm',
        description: 'General purpose virtual machine — atomic product (no stack component).',
        categoryId: compute.id,
        computeType: ComputeType.VIRTUAL,
        os: 'Linux',
      },
    });

    // Versions with NUMERIC versions so §2 range constraints apply.
    const pgVersions: Record<string, { id: string }> = {};
    for (const spec of [
      { version: '14.12', release: '2024-02-08', eol: '2026-11-21' },
      { version: '15.8', release: '2024-08-08', eol: '2027-11-11' },
      { version: '16.3', release: '2025-02-20', eol: '2028-11-09' },
      { version: '17.1', release: '2025-09-26', eol: '2029-11-08' },
    ]) {
      const rec = await prisma.productVersion.upsert({
        where: { productId_version: { productId: pgProduct.id, version: spec.version } },
        update: { ...versionTupleFields(spec.version) },
        create: {
          productId: pgProduct.id,
          version: spec.version,
          releaseDate: new Date(spec.release),
          eolDate: new Date(spec.eol),
          ...versionTupleFields(spec.version),
        },
      });
      pgVersions[spec.version] = { id: rec.id };
    }

    const vmVersions: Record<string, { id: string }> = {};
    for (const spec of [
      { version: 'v2', release: '2022-01-15', eol: '2027-01-15' },
      { version: 'v3', release: '2024-06-01', eol: '2029-06-01' },
      { version: 'v4', release: '2026-09-01', eol: '2031-09-01' },
    ]) {
      const rec = await prisma.productVersion.upsert({
        where: { productId_version: { productId: gpVmProduct.id, version: spec.version } },
        update: { ...versionTupleFields(spec.version) },
        create: {
          productId: gpVmProduct.id,
          version: spec.version,
          releaseDate: new Date(spec.release),
          eolDate: new Date(spec.eol),
          ...versionTupleFields(spec.version),
        },
      });
      vmVersions[spec.version] = { id: rec.id };
    }

    // Compatibility rules — fixed ids keep this idempotent.
    const ruleSpecs = [
      {
        id: 'seed-rule-pg17-vm4',
        name: 'PG 17 REQUIRES VM >= v4',
        description: 'PostgreSQL 17 needs the v4 VM generation (kernel >= 5.14).',
        fromProductId: pgProduct.id, fromVersionConstraint: '>=17',
        toProductId: gpVmProduct.id, toVersionConstraint: '>=4',
        kind: 'REQUIRES', severity: 'HARD', scopeType: 'GLOBAL',
      },
      {
        id: 'seed-rule-pg16-vm3',
        name: 'PG 16+ REQUIRES VM >= v3',
        description: 'PostgreSQL 16 and later need NVMe-backed VM generation v3+.',
        fromProductId: pgProduct.id, fromVersionConstraint: '>=16',
        toProductId: gpVmProduct.id, toVersionConstraint: '>=3',
        kind: 'REQUIRES', severity: 'HARD', scopeType: 'GLOBAL',
      },
      {
        id: 'seed-rule-pg14-vm4',
        name: 'PG 14 FORBIDS VM v4 (untested combination)',
        description: 'PG 14 was never certified on the v4 generation.',
        fromProductId: pgProduct.id, fromVersionConstraint: '<15',
        toProductId: gpVmProduct.id, toVersionConstraint: '>=4',
        kind: 'FORBIDS', severity: 'SOFT', scopeType: 'GLOBAL',
      },
    ];
    for (const spec of ruleSpecs) {
      await prisma.compatibilityRule.upsert({
        where: { id: spec.id },
        update: { description: spec.description },
        create: {
          id: spec.id,
          name: spec.name,
          description: spec.description,
          fromProductId: spec.fromProductId,
          fromVersionConstraint: spec.fromVersionConstraint,
          toProductId: spec.toProductId,
          toVersionConstraint: spec.toVersionConstraint,
          kind: spec.kind as any,
          severity: spec.severity as any,
          scopeType: spec.scopeType as any,
        },
      });
    }

    // Example stacks: each PG version pins one VM version.
    const stackSpecs = [
      { pg: '14.12', vm: 'v2' },
      { pg: '15.8', vm: 'v3' },
      { pg: '16.3', vm: 'v3' },
      { pg: '17.1', vm: 'v4' },
    ];
    for (const spec of stackSpecs) {
      const containerVersionId = pgVersions[spec.pg].id;
      const existing = await prisma.productVersionComponent.findFirst({
        where: { containerVersionId, componentProductId: gpVmProduct.id },
      });
      if (!existing) {
        await prisma.productVersionComponent.create({
          data: {
            containerVersionId,
            componentProductId: gpVmProduct.id,
            componentVersionId: vmVersions[spec.vm].id,
          },
        });
      }
    }

    console.log('  🧩 Product stacks & compatibility rules upserted (Managed PostgreSQL × General Purpose VM)');
  }

  // ── Resiliency levels (idempotent, separate script) ─────────────────
  // Spawned as a child to keep the resiliency seed standalone — it is also
  // runnable on its own. It creates STANDARD/HA/MULTI_AZ if missing.
  const { execSync } = require('child_process');
  try {
    execSync('npx tsx prisma/seed-resiliency-levels.ts', { stdio: 'inherit', cwd: __dirname + '/..' });
  } catch {
    console.log('  ⚠️ Resiliency levels seed failed — run it manually: npx tsx prisma/seed-resiliency-levels.ts');
  }

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
