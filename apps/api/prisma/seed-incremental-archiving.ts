import { PrismaClient, ComputeType, DependencyType, InstanceStatus, LifecyclePhase } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Incremental seed — adds Archiving as a Service to existing databases.
 *
 * Safe to run on a database that already contains production data.
 *
 * Usage:
 *   docker compose exec api npx tsx prisma/seed-incremental-archiving.ts
 */

async function main() {
  console.log('🌱 Incremental seeding — adding Archiving as a Service...');

  // ── Fetch existing objects ──────────────────────────────────────────
  const zoneToto = await prisma.zone.findUnique({ where: { slug: 'bubble-toto' } });
  const zoneProd = await prisma.zone.findUnique({ where: { slug: 'bubble-prod' } });
  if (!zoneToto || !zoneProd) {
    console.error('❌ Required zones not found. Make sure base seed has run.');
    process.exit(1);
  }

  const dataCategory = await prisma.category.findUnique({ where: { slug: 'data' } });
  if (!dataCategory) {
    console.error('❌ Category "data" not found. Make sure base seed has run.');
    process.exit(1);
  }

  const osDebian = await prisma.operatingSystem.findUnique({ where: { slug: 'debian' } });
  if (!osDebian) {
    console.error('❌ OS "debian" not found. Make sure base seed has run.');
    process.exit(1);
  }

  const debian12 = await prisma.osVersion.findFirst({
    where: { osId: osDebian.id, version: '12 (Bookworm)' },
  });
  if (!debian12) {
    console.error('❌ OS Version "Debian 12" not found. Make sure base seed has run.');
    process.exit(1);
  }

  const clModerate = await prisma.continuityLevel.findUnique({ where: { name: 'MODERATE' } });
  if (!clModerate) {
    console.error('❌ ContinuityLevel "MODERATE" not found. Make sure base seed has run.');
    process.exit(1);
  }

  const appEcommerce = await prisma.application.findFirst({ where: { name: 'E-Commerce Platform' } });
  if (!appEcommerce) {
    console.error('❌ Application "E-Commerce Platform" not found. Make sure base seed has run.');
    process.exit(1);
  }

  const objectStorage = await prisma.product.findUnique({ where: { slug: 'object-storage' } });
  if (!objectStorage) {
    console.error('❌ Product "object-storage" not found. Make sure base seed has run.');
    process.exit(1);
  }

  // ── Availability Zones ──────────────────────────────────────────────
  const parisAz1 = await prisma.availabilityZone.findUnique({ where: { code: 'eu-west-par1' } });
  const parisAz2 = await prisma.availabilityZone.findUnique({ where: { code: 'eu-west-par2' } });
  const singapore = await prisma.availabilityZone.findUnique({ where: { code: 'ap-south-sin1' } });
  const newYork = await prisma.availabilityZone.findUnique({ where: { code: 'us-east-nyc1' } });
  if (!parisAz1 || !parisAz2 || !singapore || !newYork) {
    console.error('❌ Required availability zones not found. Make sure base seed has run.');
    process.exit(1);
  }

  // ── Flavors ─────────────────────────────────────────────────────────
  const archivingFlavors = [
    { name: 'Archive Basic', vcpu: 2, ramGb: 4, description: '1TB storage, 1 year retention' },
    { name: 'Archive Standard', vcpu: 4, ramGb: 8, description: '5TB storage, 7 years retention (legal compliance)' },
    { name: 'Archive Enterprise', vcpu: 8, ramGb: 16, description: '20TB storage, 10 years retention, WORM immutability' },
    { name: 'Archive Compliance', vcpu: 16, ramGb: 32, description: '100TB storage, unlimited retention, WORM + legal hold' },
  ];

  const flavorRecords: Record<string, { id: string; name: string; vcpu: number; ramGb: number; description: string }> = {};
  for (const f of archivingFlavors) {
    const existing = await prisma.flavor.findUnique({ where: { name: f.name } });
    if (existing) {
      flavorRecords[f.name] = existing;
      console.log(`  Flavor "${f.name}" already exists — skipped`);
    } else {
      const rec = await prisma.flavor.create({
        data: {
          ...f,
          zones: { create: [{ zoneId: zoneToto.id }, { zoneId: zoneProd.id }] },
        },
      });
      flavorRecords[f.name] = rec;
      console.log(`  Created flavor "${f.name}"`);
    }
  }

  // ── Product ─────────────────────────────────────────────────────────
  const archivingProduct = await prisma.product.upsert({
    where: { slug: 'archiving-as-a-service' },
    update: {},
    create: {
      name: 'Archiving as a Service',
      slug: 'archiving-as-a-service',
      description: 'Enterprise-grade archiving with regulatory compliance (GDPR, SEC 17a-4), WORM immutability, legal hold, and AES-256 encryption.',
      categoryId: dataCategory.id,
      computeType: ComputeType.VIRTUAL,
      os: 'Linux',
      zones: { create: [{ zoneId: zoneToto.id }, { zoneId: zoneProd.id }] },
      documentation: '# Archiving as a Service\n\n## Overview\nEnterprise-grade long-term archiving solution with full regulatory compliance.\n\n## Features\n- **WORM Immutability**: Write-Once-Read-Many protection\n- **Legal Hold**: Litigation-ready retention policies\n- **AES-256 Encryption**: At-rest and in-transit encryption\n- **Compliance**: GDPR, SEC 17a-4, HIPAA, FINRA ready\n- **Retention Policies**: Configurable from 1 year to unlimited\n- **AI Classification**: Automatic data categorization (roadmap)\n\n## Tiers\n| Tier | Capacity | Retention | Features |\n|------|----------|-----------|----------|\n| Basic | 1 TB | 1 year | Standard encryption |\n| Standard | 5 TB | 7 years | Legal compliance |\n| Enterprise | 20 TB | 10 years | WORM immutability |\n| Compliance | 100 TB | Unlimited | WORM + legal hold |\n\n## APIs\n- S3-compatible API\n- REST API for policy management\n- Webhook notifications for retention events',
      roadmap: '## Roadmap\n- Q4 2024: AI-powered data classification\n- Q1 2025: Blockchain anchoring for tamper-proof audit trails\n- Q2 2025: Cross-region replication\n- Q3 2025: Automated legal hold via eDiscovery integration',
    },
  });
  console.log(`  Product "${archivingProduct.name}" ready (id=${archivingProduct.id})`);

  // ── Variants ────────────────────────────────────────────────────────
  const archivingVariants: { id: string; name: string; flavorId: string }[] = [];
  for (const flavorName of ['Archive Basic', 'Archive Standard', 'Archive Enterprise', 'Archive Compliance']) {
    const variantName = `${debian12.version} - ${flavorName}`;
    const existing = await prisma.productVariant.findFirst({
      where: { productId: archivingProduct.id, name: variantName },
    });
    if (existing) {
      archivingVariants.push(existing);
      console.log(`  Variant "${variantName}" already exists — skipped`);
    } else {
      const isRecommended = flavorName === 'Archive Standard';
      const isOnDemand = flavorName === 'Archive Compliance';
      const variant = await prisma.productVariant.create({
        data: {
          productId: archivingProduct.id,
          name: variantName,
          osId: osDebian.id,
          osVersionId: debian12.id,
          flavorId: flavorRecords[flavorName].id,
          continuityLevelId: clModerate.id,
          isActive: true,
          availabilityType: isRecommended ? 'RECOMMENDED' : isOnDemand ? 'ON_DEMAND' : 'STANDARD',
          availabilityZones: {
            create: [
              { availabilityZoneId: parisAz1.id },
              { availabilityZoneId: parisAz2.id },
              { availabilityZoneId: singapore.id },
              { availabilityZoneId: newYork.id },
            ],
          },
          zones: { create: [{ zoneId: zoneToto.id }, { zoneId: zoneProd.id }] },
        },
      });
      archivingVariants.push(variant);
      console.log(`  Created variant "${variantName}"`);
    }
  }

  // ── Dependencies ────────────────────────────────────────────────────
  const existingDep = await prisma.dependency.findFirst({
    where: { productId: archivingProduct.id, dependsOnId: objectStorage.id },
  });
  if (existingDep) {
    console.log('  Dependency to Object Storage already exists — skipped');
  } else {
    await prisma.dependency.create({
      data: {
        productId: archivingProduct.id,
        dependsOnId: objectStorage.id,
        type: DependencyType.RECOMMENDED,
        description: 'Recommended for staging area and active archive tier before long-term retention',
      },
    });
    console.log('  Created dependency: Archiving → Object Storage (recommended)');
  }

  // ── Upgrade Path ────────────────────────────────────────────────────
  const existingUpgrade = await prisma.upgradePath.findFirst({
    where: { fromProductId: objectStorage.id, toProductId: archivingProduct.id },
  });
  if (existingUpgrade) {
    console.log('  Upgrade path Object Storage → Archiving already exists — skipped');
  } else {
    await prisma.upgradePath.create({
      data: {
        fromProductId: objectStorage.id,
        toProductId: archivingProduct.id,
        fromVersion: '1.0',
        toVersion: '1.0',
        migrationType: 'SNAPSHOT',
        notes: 'Migrate objects to archive tier via snapshot transfer with policy-based lifecycle transition',
      },
    });
    console.log('  Created upgrade path: Object Storage → Archiving as a Service');
  }

  // ── Instance ────────────────────────────────────────────────────────
  const archivingStandardVariant = archivingVariants.find((v) => v.name.includes('Archive Standard'));
  if (archivingStandardVariant) {
    const existingInstance = await prisma.instance.findFirst({
      where: { name: 'archive-compliance-01' },
    });
    if (existingInstance) {
      console.log('  Instance "archive-compliance-01" already exists — skipped');
    } else {
      await prisma.instance.create({
        data: {
          name: 'archive-compliance-01',
          description: 'Financial records archive with SEC 17a-4 compliance',
          applicationId: appEcommerce.id,
          productId: archivingProduct.id,
          variantId: archivingStandardVariant.id,
          flavorId: archivingStandardVariant.flavorId,
          azCode: 'eu-west-par1',
          status: InstanceStatus.RUNNING,
          environment: 'PRD',
          ipAddress: '10.0.6.60',
          hostname: 'archive-compliance-01.par1.cloudmarket.local',
          startedAt: new Date('2024-04-01'),
          metadata: { osVersion: 'debian-12', compliance: 'SEC-17a-4', retentionYears: 7 },
        },
      });
      console.log('  Created instance: archive-compliance-01');
    }
  }

  console.log('✅ Archiving as a Service seeded successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
