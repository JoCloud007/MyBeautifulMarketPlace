import { PrismaClient, LifecyclePhase, ComputeType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Repairing missing seed data...\n');

  // ── Ensure base data exists (regions, zones, categories, continuity levels) ──
  const regionEuWest = await prisma.region.upsert({
    where: { slug: 'eu-west' },
    update: {},
    create: { name: 'Europe', slug: 'eu-west', description: 'European region', isActive: true },
  });
  const regionUsEast = await prisma.region.upsert({
    where: { slug: 'us-east' },
    update: {},
    create: { name: 'North America', slug: 'us-east', description: 'North American region', isActive: true },
  });
  const regionApSouth = await prisma.region.upsert({
    where: { slug: 'ap-south' },
    update: {},
    create: { name: 'Asia-Pacific', slug: 'ap-south', description: 'Asia-Pacific region', isActive: true },
  });

  let zoneToto = await prisma.zone.findFirst({ where: { name: 'bubble-toto' } });
  if (!zoneToto) {
    zoneToto = await prisma.zone.create({ data: { name: 'bubble-toto', slug: 'bubble-toto', isActive: true } });
  }
  let zoneProd = await prisma.zone.findFirst({ where: { name: 'bubble-prod' } });
  if (!zoneProd) {
    zoneProd = await prisma.zone.create({ data: { name: 'bubble-prod', slug: 'bubble-prod', isActive: true } });
  }

  const compute = await prisma.category.upsert({
    where: { slug: 'compute' },
    update: {},
    create: { name: 'Compute', slug: 'compute', description: 'Virtual machines and compute resources', icon: 'Cpu' },
  });
  const data = await prisma.category.upsert({
    where: { slug: 'data' },
    update: {},
    create: { name: 'Data', slug: 'data', description: 'Storage and data management services', icon: 'Database' },
  });
  const hypervisor = await prisma.category.upsert({
    where: { slug: 'hypervisor' },
    update: {},
    create: { name: 'Hypervisor', slug: 'hypervisor', description: 'Virtualization platforms', icon: 'Server' },
  });
  const citrix = await prisma.category.upsert({
    where: { slug: 'citrix' },
    update: {},
    create: { name: 'Citrix', slug: 'citrix', description: 'Citrix virtualization and VDI solutions', icon: 'Monitor' },
  });

  const clLow = await prisma.continuityLevel.upsert({
    where: { name: 'LOW' },
    update: {},
    create: { name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240, description: 'Basic backup', color: 'green' },
  });
  const clModerate = await prisma.continuityLevel.upsert({
    where: { name: 'MODERATE' },
    update: {},
    create: { name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60, description: 'HA pair', color: 'yellow' },
  });
  const clSerious = await prisma.continuityLevel.upsert({
    where: { name: 'SERIOUS' },
    update: {},
    create: { name: 'SERIOUS', rtoMinutes: 240, rpoMinutes: 15, description: 'Multi-AZ', color: 'orange' },
  });
  const clExtreme = await prisma.continuityLevel.upsert({
    where: { name: 'EXTREME' },
    update: {},
    create: { name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5, description: 'Active-Active', color: 'red' },
  });

  // ── Operating Systems ──
  const osWindows = await prisma.operatingSystem.upsert({
    where: { slug: 'windows' },
    update: {},
    create: { family: 'WINDOWS', name: 'Windows', slug: 'windows', isActive: true, availabilityType: 'STANDARD', zones: { create: [{ zoneId: zoneToto.id }] } },
  });
  const osDebian = await prisma.operatingSystem.upsert({
    where: { slug: 'debian' },
    update: {},
    create: { family: 'LINUX', name: 'Debian', slug: 'debian', isActive: true, availabilityType: 'RECOMMENDED', zones: { create: [{ zoneId: zoneToto.id }, { zoneId: zoneProd.id }] } },
  });
  const osRedhat = await prisma.operatingSystem.upsert({
    where: { slug: 'rhel' },
    update: {},
    create: { family: 'LINUX', name: 'Red Hat Enterprise Linux', slug: 'rhel', isActive: true, availabilityType: 'RESTRICTED', zones: { create: [{ zoneId: zoneProd.id }] } },
  });

  // ── OS Versions ──
  const osVersions = [
    { osId: osWindows.id, version: 'Server 2022', releaseDate: new Date('2021-08-18'), normalSupportEnd: new Date('2026-10-13'), extendedSupportEnd: new Date('2031-10-14'), eolDate: new Date('2033-10-14'), phase: LifecyclePhase.RELEASED },
    { osId: osWindows.id, version: 'Server 2019', releaseDate: new Date('2018-10-02'), normalSupportEnd: new Date('2024-01-09'), extendedSupportEnd: new Date('2029-01-09'), eolDate: new Date('2031-01-09'), phase: LifecyclePhase.EXTENDED_SUPPORT },
    { osId: osWindows.id, version: '11', releaseDate: new Date('2021-10-05'), normalSupportEnd: new Date('2025-10-14'), extendedSupportEnd: new Date('2028-10-10'), eolDate: new Date('2030-10-10'), phase: LifecyclePhase.NORMAL_SUPPORT },
    { osId: osDebian.id, version: '12 (Bookworm)', releaseDate: new Date('2023-06-10'), normalSupportEnd: new Date('2026-06-10'), extendedSupportEnd: new Date('2028-06-10'), eolDate: new Date('2030-06-10'), phase: LifecyclePhase.RELEASED },
    { osId: osDebian.id, version: '11 (Bullseye)', releaseDate: new Date('2021-08-14'), normalSupportEnd: new Date('2024-08-14'), extendedSupportEnd: new Date('2026-08-14'), eolDate: new Date('2028-08-14'), phase: LifecyclePhase.NORMAL_SUPPORT },
    { osId: osRedhat.id, version: '9', releaseDate: new Date('2022-05-18'), normalSupportEnd: new Date('2027-05-31'), extendedSupportEnd: new Date('2031-05-31'), eolDate: new Date('2033-05-31'), phase: LifecyclePhase.RELEASED },
    { osId: osRedhat.id, version: '8', releaseDate: new Date('2019-05-07'), normalSupportEnd: new Date('2024-05-31'), extendedSupportEnd: new Date('2026-05-31'), eolDate: new Date('2028-05-31'), phase: LifecyclePhase.EXTENDED_SUPPORT },
  ];

  const osVersionRecords: Record<string, any> = {};
  for (const ov of osVersions) {
    const key = `${ov.osId}-${ov.version}`;
    const existing = await prisma.osVersion.findFirst({ where: { osId: ov.osId, version: ov.version } });
    if (existing) {
      osVersionRecords[key] = existing;
    } else {
      const created = await prisma.osVersion.create({ data: { ...ov, isActive: true } });
      osVersionRecords[key] = created;
      console.log(`  Created OsVersion: ${ov.version}`);
    }
  }

  // ── Flavors ──
  const flavorData = [
    { name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry-level configuration for development and testing', zoneId: zoneToto.id },
    { name: 'Medium', vcpu: 4, ramGb: 8, description: 'Balanced configuration for production workloads', zoneId: zoneToto.id },
    { name: 'Large', vcpu: 8, ramGb: 16, description: 'High-performance configuration for demanding applications', zoneId: zoneToto.id },
    { name: 'XL', vcpu: 16, ramGb: 32, description: 'Maximum performance for enterprise workloads', zoneId: zoneToto.id },
  ];

  const flavorRecords: Record<string, any> = {};
  for (const f of flavorData) {
    const existing = await prisma.flavor.findFirst({ where: { name: f.name } });
    if (existing) {
      flavorRecords[f.name] = existing;
    } else {
      const created = await prisma.flavor.create({ data: { name: f.name, vcpu: f.vcpu, ramGb: f.ramGb, description: f.description, zones: { create: [{ zoneId: f.zoneId }] } } });
      flavorRecords[f.name] = created;
      console.log(`  Created Flavor: ${f.name}`);
    }
  }

  // ── Products ──
  const products = [
    { slug: 'virtual-machine', name: 'Virtual Machine', categoryId: compute.id, computeType: ComputeType.VIRTUAL, os: 'Linux', regionId: regionEuWest.id, roadmap: '## Roadmap\n- Q3 2024: ARM64 support\n- Q4 2024: GPU instance option\n- Q1 2025: Confidential computing' },
    { slug: 'bare-metal-hpc', name: 'Bare Metal HPC', categoryId: compute.id, computeType: ComputeType.PHYSICAL, os: 'Linux', regionId: regionUsEast.id, roadmap: '## Roadmap\n- Q3 2024: NVIDIA H200 support\n- Q4 2024: Liquid cooling option' },
    { slug: 'object-storage', name: 'Object Storage', categoryId: data.id, computeType: null, os: null, regionId: regionApSouth.id, roadmap: '## Roadmap\n- Q3 2024: Glacier-like archive tier\n- Q4 2024: Object lock (WORM)' },
    { slug: 'nas-storage', name: 'NAS Storage', categoryId: data.id, computeType: null, os: null, regionId: regionEuWest.id, roadmap: '## Roadmap\n- Q3 2024: NVMe-oF support\n- Q4 2024: Automated tiering' },
    { slug: 'vmware-vsphere', name: 'VMware vSphere', categoryId: hypervisor.id, computeType: null, os: 'ESXi', regionId: regionUsEast.id, roadmap: '## Roadmap\n- Q3 2024: vSphere 8.0 U3\n- Q4 2024: Confidential VMs' },
    { slug: 'citrix-vdi', name: 'Citrix VDI', categoryId: citrix.id, computeType: null, os: 'Windows', regionId: regionApSouth.id, roadmap: '## Roadmap\n- Q3 2024: Citrix DaaS integration\n- Q4 2024: WebRTC redirection' },
  ];

  const productRecords: Record<string, any> = {};
  for (const p of products) {
    const existing = await prisma.product.findFirst({ where: { slug: p.slug } });
    if (existing) {
      productRecords[p.slug] = existing;
    } else {
      const created = await prisma.product.create({ data: { ...p, description: `${p.name} product`, isActive: true } });
      productRecords[p.slug] = created;
      console.log(`  Created Product: ${p.name}`);
    }
  }

  // ── Product Versions ──
  const productVersions = [
    { productSlug: 'virtual-machine', version: '1.0.0', releaseDate: new Date('2023-01-15'), normalSupportEnd: new Date('2025-01-15'), extendedSupportEnd: new Date('2027-01-15'), eolDate: new Date('2028-01-15'), phase: LifecyclePhase.NORMAL_SUPPORT, regionId: regionEuWest.id },
    { productSlug: 'virtual-machine', version: '2.0.0', releaseDate: new Date('2024-06-01'), normalSupportEnd: new Date('2026-06-01'), extendedSupportEnd: new Date('2028-06-01'), eolDate: new Date('2029-06-01'), phase: LifecyclePhase.RELEASED, regionId: regionApSouth.id },
    { productSlug: 'bare-metal-hpc', version: '2024-R1', releaseDate: new Date('2024-03-01'), normalSupportEnd: new Date('2026-03-01'), extendedSupportEnd: new Date('2028-03-01'), eolDate: new Date('2029-03-01'), phase: LifecyclePhase.RELEASED, regionId: regionUsEast.id },
    { productSlug: 'object-storage', version: '3.2.1', releaseDate: new Date('2024-01-01'), normalSupportEnd: new Date('2025-01-01'), extendedSupportEnd: new Date('2027-01-01'), eolDate: new Date('2028-01-01'), phase: LifecyclePhase.NORMAL_SUPPORT, regionId: regionApSouth.id },
    { productSlug: 'nas-storage', version: '2024.1', releaseDate: new Date('2024-02-15'), normalSupportEnd: new Date('2026-02-15'), extendedSupportEnd: new Date('2028-02-15'), eolDate: new Date('2029-02-15'), phase: LifecyclePhase.RELEASED, regionId: regionEuWest.id },
  ];

  for (const pv of productVersions) {
    const product = productRecords[pv.productSlug];
    if (!product) continue;
    const existing = await prisma.productVersion.findFirst({ where: { productId: product.id, version: pv.version } });
    if (!existing) {
      await prisma.productVersion.create({
        data: {
          productId: product.id,
          version: pv.version,
          releaseDate: pv.releaseDate,
          normalSupportEnd: pv.normalSupportEnd,
          extendedSupportEnd: pv.extendedSupportEnd,
          eolDate: pv.eolDate,
          phase: pv.phase,
          isActive: true,
          regionId: pv.regionId,
        },
      });
      console.log(`  Created ProductVersion: ${pv.productSlug} ${pv.version}`);
    }
  }

  // ── Product Variants ──
  const vmProduct = productRecords['virtual-machine'];
  const hpcProduct = productRecords['bare-metal-hpc'];

  if (vmProduct) {
    for (const osVer of [osVersionRecords[`${osDebian.id}-12 (Bookworm)`], osVersionRecords[`${osDebian.id}-11 (Bullseye)`], osVersionRecords[`${osWindows.id}-Server 2022`], osVersionRecords[`${osRedhat.id}-9`]]) {
      if (!osVer) continue;
      for (const flavorName of ['Small', 'Medium', 'Large']) {
        const variantName = `${osVer.version} - ${flavorName}`;
        const existing = await prisma.productVariant.findFirst({ where: { productId: vmProduct.id, name: variantName } });
        if (!existing) {
          const isRecommended = osVer.version === '12 (Bookworm)' && flavorName === 'Large';
          const isRestricted = osVer.version === '9';
          await prisma.productVariant.create({
            data: {
              productId: vmProduct.id,
              name: variantName,
              osId: osVer.osId,
              osVersionId: osVer.id,
              flavorId: flavorRecords[flavorName].id,
              continuityLevelId: clModerate.id,
              isActive: true,
              availabilityType: isRecommended ? 'RECOMMENDED' : isRestricted ? 'RESTRICTED' : 'STANDARD',
              releaseDate: osVer.releaseDate,
              normalSupportEnd: osVer.normalSupportEnd,
              extendedSupportEnd: osVer.extendedSupportEnd,
              eolDate: osVer.eolDate,
              phase: osVer.phase,
            },
          });
          console.log(`  Created ProductVariant: ${variantName}`);
        }
      }
    }
  }

  if (hpcProduct) {
    for (const osVer of [osVersionRecords[`${osDebian.id}-12 (Bookworm)`], osVersionRecords[`${osRedhat.id}-9`]]) {
      if (!osVer) continue;
      for (const flavorName of ['Large', 'XL']) {
        const variantName = `${osVer.version} - ${flavorName}`;
        const existing = await prisma.productVariant.findFirst({ where: { productId: hpcProduct.id, name: variantName } });
        if (!existing) {
          const isOnDemand = flavorName === 'XL';
          await prisma.productVariant.create({
            data: {
              productId: hpcProduct.id,
              name: variantName,
              osId: osVer.osId,
              osVersionId: osVer.id,
              flavorId: flavorRecords[flavorName].id,
              continuityLevelId: clSerious.id,
              isActive: true,
              availabilityType: isOnDemand ? 'ON_DEMAND' : 'RECOMMENDED',
              releaseDate: osVer.releaseDate,
              normalSupportEnd: osVer.normalSupportEnd,
              extendedSupportEnd: osVer.extendedSupportEnd,
              eolDate: osVer.eolDate,
              phase: osVer.phase,
            },
          });
          console.log(`  Created ProductVariant: ${variantName}`);
        }
      }
    }
  }

  // ── Backfill any variants still missing dates ──
  const variantsWithoutDates = await prisma.productVariant.findMany({
    where: { releaseDate: null },
    include: { osVersion: true },
  });

  if (variantsWithoutDates.length > 0) {
    console.log(`\n📅 Backfilling ${variantsWithoutDates.length} ProductVariant lifecycle dates...`);
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
    console.log('  ✅ Dates backfilled');
  }

  console.log('\n✅ Repair completed. Restart the API to clear caches: make restart-api');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
