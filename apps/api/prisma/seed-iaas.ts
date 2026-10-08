import { PrismaClient, DependencyType, ForecastStatus, LifecyclePhase, InstanceStatus, HealthStatus, MaintenanceStatus, ComputeType, PerformanceTargetType, VisibilityType, AvailabilityType } from '@prisma/client';

const prisma = new PrismaClient();

/** Compute lifecycle phase from the real dates, relative to today. */
function phaseFor(releaseDate: Date, normalSupportEnd: Date, extendedSupportEnd: Date, eolDate: Date): LifecyclePhase {
  const now = new Date();
  if (now >= eolDate) return LifecyclePhase.EOL;
  if (now >= extendedSupportEnd) return LifecyclePhase.NO_SUPPORT;
  if (now >= normalSupportEnd) return LifecyclePhase.EXTENDED_SUPPORT;
  if (now >= releaseDate) return LifecyclePhase.NORMAL_SUPPORT;
  return LifecyclePhase.RELEASED;
}

function d(s: string): Date {
  return new Date(s);
}

async function main() {
  console.log('🌱 Seeding CloudMarket IaaS portfolio...');

  // Clean existing data (order matters for FK constraints)
  try {
    await prisma.availabilitySchedule.deleteMany();
    await prisma.azInfraVersion.deleteMany();
    await prisma.infraVersion.deleteMany();
    await prisma.productVersionAvailabilityZone.deleteMany();
    await prisma.productVersionRegion.deleteMany();
    await prisma.productVersionZone.deleteMany();
    await prisma.productZone.deleteMany();
    await prisma.productRegion.deleteMany();
    await prisma.flavorZone.deleteMany();
    await prisma.flavorRegion.deleteMany();
    await prisma.flavorAvailabilityZone.deleteMany();
    await prisma.operatingSystemZone.deleteMany();
    await prisma.productVariantZone.deleteMany();
    await prisma.productVariantAvailabilityZone.deleteMany();
    await prisma.zoneAvailabilityZone.deleteMany();
    await prisma.zone.deleteMany();
    await prisma.forecast.deleteMany();
    await prisma.presentationStep.deleteMany();
    await prisma.presentationOrder.deleteMany();
    await prisma.performanceMetric.deleteMany();
    await prisma.performanceProfile.deleteMany();
    await prisma.healthCheck.deleteMany();
    await prisma.maintenanceWindow.deleteMany();
    await prisma.instance.deleteMany();
    await prisma.dependency.deleteMany();
    await prisma.transition.deleteMany();
    await prisma.upgradePath.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.productVersion.deleteMany();
    await prisma.osVersion.deleteMany();
    await prisma.operatingSystem.deleteMany();
    await prisma.flavor.deleteMany();
    await prisma.availabilityZone.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await prisma.application.deleteMany();
    await prisma.continuityLevel.deleteMany();
    await prisma.region.deleteMany();
    await prisma.country.deleteMany();
  } catch (e: any) {
    if (e.code === 'P2021') {
      console.log('  Tables do not exist yet — make sure to run "npx prisma db push" first');
    }
    throw e;
  }

  // ===================== GEO =====================
  console.log('  🌍 Regions, countries, availability zones...');

  // Countries used by the portfolio (full ISO list available via seed-countries-regions.ts)
  const countries = [
    { code: 'US', name: 'United States', flagEmoji: '🇺🇸' },
    { code: 'FR', name: 'France', flagEmoji: '🇫🇷' },
    { code: 'GB', name: 'United Kingdom', flagEmoji: '🇬🇧' },
    { code: 'HK', name: 'Hong Kong', flagEmoji: '🇭🇰' },
    { code: 'SG', name: 'Singapore', flagEmoji: '🇸🇬' },
  ];
  for (const c of countries) {
    await prisma.country.upsert({ where: { code: c.code }, update: {}, create: c });
  }

  // Regions: slugs align with the frontend WorldMap mappings
  // (eu-west → EMEA, us-east → AMER, ap-south → APAC)
  const regionAmer = await prisma.region.create({ data: { name: 'AMER', slug: 'us-east', description: 'Americas — New York metro', isActive: true } });
  const regionEmea = await prisma.region.create({ data: { name: 'EMEA', slug: 'eu-west', description: 'Europe, Middle East & Africa — Paris, London', isActive: true } });
  const regionApac = await prisma.region.create({ data: { name: 'APAC', slug: 'ap-south', description: 'Asia-Pacific — Hong Kong, Singapore', isActive: true } });

  // ===================== INFRA VERSIONS =====================
  console.log('  🏗️ Infra Versions IV1 / IV2...');

  const iv1Phase = phaseFor(d('2019-01-15'), d('2025-01-15'), d('2027-01-15'), d('2028-01-15'));
  const iv2Phase = phaseFor(d('2024-06-01'), d('2029-06-01'), d('2032-06-01'), d('2033-06-01'));

  const iv1 = await prisma.infraVersion.create({
    data: {
      code: 'IV1',
      name: 'Infrastructure Generation 1',
      description: 'First generation datacenter platform (legacy sites). 10G fabric, air-cooled halls, pre-2020 hardware.',
      releaseDate: d('2019-01-15'),
      normalSupportEnd: d('2025-01-15'),
      extendedSupportEnd: d('2027-01-15'),
      eolDate: d('2028-01-15'),
      phase: iv1Phase,
      isActive: true,
      changelog: '## IV1\n- Initial datacenter generation\n- 10G network fabric\n- Air cooling',
    },
  });
  const iv2 = await prisma.infraVersion.create({
    data: {
      code: 'IV2',
      name: 'Infrastructure Generation 2',
      description: 'Second generation datacenter platform. 100G spine-leaf fabric, liquid cooling ready, GPU-dense halls.',
      releaseDate: d('2024-06-01'),
      normalSupportEnd: d('2029-06-01'),
      extendedSupportEnd: d('2032-06-01'),
      eolDate: d('2033-06-01'),
      phase: iv2Phase,
      isActive: true,
      changelog: '## IV2\n- 100G spine-leaf fabric\n- Liquid cooling ready\n- GPU-dense halls\n- SmartNIC offload',
    },
  });

  // ===================== AVAILABILITY ZONES =====================
  // Each AZ hosts one or both generations (many-to-many AzInfraVersion).
  type AzSpec = { code: string; name: string; city: string; country: string; region: string; lat: number; lon: number; ivs: ('IV1' | 'IV2')[] };
  const azSpecs: AzSpec[] = [
    { code: 'us-east-nyc1', name: 'New York 1', city: 'New York', country: 'United States', region: 'us-east', lat: 40.7128, lon: -74.006, ivs: ['IV1'] },
    { code: 'us-east-nyc2', name: 'New York 2', city: 'New York', country: 'United States', region: 'us-east', lat: 40.7128, lon: -74.006, ivs: ['IV1', 'IV2'] },
    { code: 'us-east-nyc3', name: 'New York 3', city: 'New York', country: 'United States', region: 'us-east', lat: 40.7128, lon: -74.006, ivs: ['IV2'] },
    { code: 'eu-west-par1', name: 'Paris 1', city: 'Paris', country: 'France', region: 'eu-west', lat: 48.8566, lon: 2.3522, ivs: ['IV1'] },
    { code: 'eu-west-par2', name: 'Paris 2', city: 'Paris', country: 'France', region: 'eu-west', lat: 48.8566, lon: 2.3522, ivs: ['IV1', 'IV2'] },
    { code: 'eu-west-par3', name: 'Paris 3', city: 'Paris', country: 'France', region: 'eu-west', lat: 48.8566, lon: 2.3522, ivs: ['IV2'] },
    { code: 'eu-west-lon1', name: 'London 1', city: 'London', country: 'United Kingdom', region: 'eu-west', lat: 51.5074, lon: -0.1278, ivs: ['IV1'] },
    { code: 'eu-west-lon2', name: 'London 2', city: 'London', country: 'United Kingdom', region: 'eu-west', lat: 51.5074, lon: -0.1278, ivs: ['IV1', 'IV2'] },
    { code: 'eu-west-lon3', name: 'London 3', city: 'London', country: 'United Kingdom', region: 'eu-west', lat: 51.5074, lon: -0.1278, ivs: ['IV2'] },
    { code: 'ap-east-hk1', name: 'Hong Kong 1', city: 'Hong Kong', country: 'Hong Kong', region: 'ap-south', lat: 22.3193, lon: 114.1694, ivs: ['IV1'] },
    { code: 'ap-east-hk2', name: 'Hong Kong 2', city: 'Hong Kong', country: 'Hong Kong', region: 'ap-south', lat: 22.3193, lon: 114.1694, ivs: ['IV1', 'IV2'] },
    { code: 'ap-southeast-sg1', name: 'Singapore 1', city: 'Singapore', country: 'Singapore', region: 'ap-south', lat: 1.3521, lon: 103.8198, ivs: ['IV1'] },
    { code: 'ap-southeast-sg2', name: 'Singapore 2', city: 'Singapore', country: 'Singapore', region: 'ap-south', lat: 1.3521, lon: 103.8198, ivs: ['IV1'] },
    { code: 'ap-southeast-sg3', name: 'Singapore 3', city: 'Singapore', country: 'Singapore', region: 'ap-south', lat: 1.3521, lon: 103.8198, ivs: ['IV2'] },
  ];

  const azs: Record<string, { id: string; code: string; region: string }> = {};
  for (const spec of azSpecs) {
    const az = await prisma.availabilityZone.create({
      data: {
        code: spec.code,
        name: spec.name,
        city: spec.city,
        country: spec.country,
        region: spec.region,
        latitude: spec.lat,
        longitude: spec.lon,
        isActive: true,
      },
    });
    azs[spec.code] = { id: az.id, code: az.code, region: az.region };
    // Link AZ to its hosted infra generations (many AZs host IV1 AND IV2)
    for (const iv of spec.ivs) {
      await prisma.azInfraVersion.create({
        data: { availabilityZoneId: az.id, infraVersionId: iv === 'IV1' ? iv1.id : iv2.id },
      });
    }
  }
  const allAzs = Object.values(azs);
  const azByIv = (iv: 'IV1' | 'IV2') => allAzs.filter((_, i) => azSpecs[i].ivs.includes(iv));

  // ===================== ZONES (logical groupings) =====================
  const zoneGeneral = await prisma.zone.create({ data: { name: 'general-purpose', slug: 'general-purpose', description: 'General purpose workloads', isActive: true } });
  const zoneProd = await prisma.zone.create({ data: { name: 'production', slug: 'production', description: 'Production-critical workloads', isActive: true } });
  await prisma.zoneAvailabilityZone.createMany({ data: allAzs.map((az) => ({ zoneId: zoneGeneral.id, availabilityZoneId: az.id })) });
  for (const az of azByIv('IV2')) {
    await prisma.zoneAvailabilityZone.create({ data: { zoneId: zoneProd.id, availabilityZoneId: az.id } });
  }

  // ===================== CONTINUITY LEVELS =====================
  const clLow = await prisma.continuityLevel.create({ data: { name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240, description: 'Basic backup', color: 'green' } });
  const clModerate = await prisma.continuityLevel.create({ data: { name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60, description: 'HA pair', color: 'yellow' } });
  const clSerious = await prisma.continuityLevel.create({ data: { name: 'SERIOUS', rtoMinutes: 240, rpoMinutes: 15, description: 'Multi-AZ', color: 'orange' } });
  const clExtreme = await prisma.continuityLevel.create({ data: { name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5, description: 'Active-Active', color: 'red' } });

  // ===================== CATEGORIES =====================
  const compute = await prisma.category.create({ data: { name: 'Compute', slug: 'compute', description: 'Virtual machines, bare metal and HPC compute resources', icon: 'Cpu' } });
  const data = await prisma.category.create({ data: { name: 'Data', slug: 'data', description: 'Storage and data management services', icon: 'Database' } });
  const platform = await prisma.category.create({ data: { name: 'Platform', slug: 'platform', description: 'Virtualization and desktop platforms', icon: 'Server' } });

  // ===================== OS + REAL LIFECYCLE =====================
  console.log('  💻 Operating systems with real lifecycle...');

  const osDebian = await prisma.operatingSystem.create({ data: { family: 'LINUX', name: 'Debian', slug: 'debian', isActive: true, availabilityType: AvailabilityType.RECOMMENDED, zones: { create: [{ zoneId: zoneGeneral.id }, { zoneId: zoneProd.id }] } } });
  const osWindows = await prisma.operatingSystem.create({ data: { family: 'WINDOWS', name: 'Windows Server', slug: 'windows-server', isActive: true, availabilityType: AvailabilityType.STANDARD, zones: { create: [{ zoneId: zoneGeneral.id }] } } });
  const osRedhat = await prisma.operatingSystem.create({ data: { family: 'REDHAT', name: 'Red Hat Enterprise Linux', slug: 'rhel', isActive: true, availabilityType: AvailabilityType.RESTRICTED, zones: { create: [{ zoneId: zoneProd.id }] } } });

  type OsVerSpec = { osId: string; version: string; release: string; normalEnd: string; extendedEnd: string; eol: string };
  const osVerSpecs: OsVerSpec[] = [
    // Debian — real dates (wiki.debian.org/LTS)
    { osId: osDebian.id, version: '11 (Bullseye)', release: '2021-08-14', normalEnd: '2024-08-14', extendedEnd: '2026-08-31', eol: '2026-08-31' },
    { osId: osDebian.id, version: '12 (Bookworm)', release: '2023-06-10', normalEnd: '2026-06-10', extendedEnd: '2028-06-10', eol: '2028-06-10' },
    { osId: osDebian.id, version: '13 (Trixie)', release: '2025-08-09', normalEnd: '2028-08-09', extendedEnd: '2030-08-09', eol: '2030-08-09' },
    // Windows Server — real dates (learn.microsoft.com/lifecycle)
    { osId: osWindows.id, version: 'Server 2019', release: '2018-11-13', normalEnd: '2024-01-09', extendedEnd: '2029-01-09', eol: '2029-01-09' },
    { osId: osWindows.id, version: 'Server 2022', release: '2021-08-18', normalEnd: '2026-10-13', extendedEnd: '2031-10-14', eol: '2031-10-14' },
    { osId: osWindows.id, version: 'Server 2025', release: '2024-11-01', normalEnd: '2029-11-09', extendedEnd: '2034-10-10', eol: '2034-10-10' },
    // RHEL — real dates (access.redhat.com/support/policy/updates/errata)
    { osId: osRedhat.id, version: '8', release: '2019-05-07', normalEnd: '2024-05-31', extendedEnd: '2029-05-31', eol: '2029-05-31' },
    { osId: osRedhat.id, version: '9', release: '2022-05-17', normalEnd: '2027-05-31', extendedEnd: '2032-05-31', eol: '2032-05-31' },
    { osId: osRedhat.id, version: '10', release: '2025-05-20', normalEnd: '2030-05-31', extendedEnd: '2035-05-31', eol: '2035-05-31' },
  ];
  const osVersions: Record<string, { id: string; osId: string; version: string; phase: LifecyclePhase; releaseDate: Date; normalSupportEnd: Date; extendedSupportEnd: Date; eolDate: Date }> = {};
  for (const spec of osVerSpecs) {
    const phase = phaseFor(d(spec.release), d(spec.normalEnd), d(spec.extendedEnd), d(spec.eol));
    const rec = await prisma.osVersion.create({
      data: {
        osId: spec.osId,
        version: spec.version,
        releaseDate: d(spec.release),
        normalSupportEnd: d(spec.normalEnd),
        extendedSupportEnd: d(spec.extendedEnd),
        eolDate: d(spec.eol),
        phase,
        isActive: true,
      },
    });
    osVersions[spec.version] = { ...rec, phase, releaseDate: d(spec.release), normalSupportEnd: d(spec.normalEnd), extendedSupportEnd: d(spec.extendedEnd), eolDate: d(spec.eol) };
  }
  const debian11 = osVersions['11 (Bullseye)'];
  const debian12 = osVersions['12 (Bookworm)'];
  const debian13 = osVersions['13 (Trixie)'];
  const win2019 = osVersions['Server 2019'];
  const win2022 = osVersions['Server 2022'];
  const win2025 = osVersions['Server 2025'];
  const rhel8 = osVersions['8'];
  const rhel9 = osVersions['9'];
  const rhel10 = osVersions['10'];

  // ===================== FLAVORS =====================
  console.log('  ⚙️ Flavors...');

  type FlavorSpec = { name: string; vcpu: number; ramGb: number; description: string };
  const flavorSpecs: FlavorSpec[] = [
    // VM sizes
    { name: 'Small', vcpu: 2, ramGb: 4, description: '2 vCPU / 4 GB — entry-level, dev & test' },
    { name: 'Medium', vcpu: 4, ramGb: 8, description: '4 vCPU / 8 GB — balanced production workloads' },
    { name: 'Large', vcpu: 8, ramGb: 16, description: '8 vCPU / 16 GB — demanding applications' },
    { name: 'XL', vcpu: 16, ramGb: 32, description: '16 vCPU / 32 GB — enterprise workloads' },
    // Bare Metal
    { name: 'BM Medium', vcpu: 16, ramGb: 64, description: 'Dedicated 16 cores / 64 GB — single-tenant' },
    { name: 'BM Large', vcpu: 32, ramGb: 128, description: 'Dedicated 32 cores / 128 GB — single-tenant' },
    { name: 'BM XL', vcpu: 64, ramGb: 256, description: 'Dedicated 64 cores / 256 GB — single-tenant' },
    // HPC
    { name: 'HPC Compute', vcpu: 96, ramGb: 192, description: '96 high-frequency cores / 192 GB — compute-bound' },
    { name: 'HPC Memory', vcpu: 128, ramGb: 1024, description: '128 cores / 1 TB — memory-bound' },
    { name: 'HPC GPU', vcpu: 96, ramGb: 512, description: '96 cores / 512 GB + 4× GPU — IV2 halls only' },
    // NAS
    { name: 'NAS 1TB', vcpu: 0, ramGb: 0, description: '1 TB shared storage — 1000 IOPS' },
    { name: 'NAS 10TB', vcpu: 0, ramGb: 0, description: '10 TB shared storage — 5000 IOPS' },
    { name: 'NAS 50TB', vcpu: 0, ramGb: 0, description: '50 TB shared storage — 20000 IOPS' },
    { name: 'NAS 100TB', vcpu: 0, ramGb: 0, description: '100 TB shared storage — 100000 IOPS' },
    // Object Storage tiers
    { name: 'Object Standard', vcpu: 0, ramGb: 0, description: 'Hot tier — frequent access, 99.999999999% durability' },
    { name: 'Object Cold', vcpu: 0, ramGb: 0, description: 'Cold tier — infrequent access, lower cost' },
    { name: 'Object Archive', vcpu: 0, ramGb: 0, description: 'Archive tier — long-term retention, retrieval in hours' },
  ];

  const flavors: Record<string, { id: string; name: string }> = {};
  for (const spec of flavorSpecs) {
    const rec = await prisma.flavor.create({ data: spec });
    flavors[spec.name] = { id: rec.id, name: rec.name };
  }

  // Flavor geo spread — realistic differentiated availability
  const flavorAzMap: Record<string, string[]> = {
    'Small': ['us-east-nyc1', 'us-east-nyc2', 'us-east-nyc3', 'eu-west-par1', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon1', 'eu-west-lon2', 'ap-east-hk1', 'ap-east-hk2', 'ap-southeast-sg1', 'ap-southeast-sg2', 'ap-southeast-sg3'],
    'Medium': ['us-east-nyc1', 'us-east-nyc2', 'us-east-nyc3', 'eu-west-par1', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon1', 'eu-west-lon2', 'eu-west-lon3', 'ap-east-hk1', 'ap-east-hk2', 'ap-southeast-sg1', 'ap-southeast-sg2', 'ap-southeast-sg3'],
    'Large': ['us-east-nyc2', 'us-east-nyc3', 'eu-west-par1', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon2', 'eu-west-lon3', 'ap-east-hk2', 'ap-southeast-sg2', 'ap-southeast-sg3'],
    'XL': ['us-east-nyc3', 'eu-west-par3', 'eu-west-lon3', 'ap-southeast-sg3'],
    'BM Medium': ['us-east-nyc2', 'eu-west-par2', 'eu-west-lon2', 'ap-southeast-sg2'],
    'BM Large': ['us-east-nyc3', 'eu-west-par3', 'eu-west-lon3'],
    'BM XL': ['us-east-nyc3', 'eu-west-par3'],
    'HPC Compute': ['us-east-nyc3', 'eu-west-par3'],
    'HPC Memory': ['eu-west-par3'],
    'HPC GPU': ['us-east-nyc3', 'eu-west-par3', 'ap-southeast-sg3'],
    'NAS 1TB': ['us-east-nyc1', 'us-east-nyc2', 'eu-west-par1', 'eu-west-par2', 'eu-west-lon1', 'ap-east-hk1', 'ap-southeast-sg1'],
    'NAS 10TB': ['us-east-nyc2', 'us-east-nyc3', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon2', 'ap-southeast-sg2'],
    'NAS 50TB': ['us-east-nyc3', 'eu-west-par3', 'ap-southeast-sg3'],
    'NAS 100TB': ['eu-west-par3'],
    'Object Standard': ['us-east-nyc1', 'us-east-nyc2', 'us-east-nyc3', 'eu-west-par1', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon1', 'eu-west-lon2', 'eu-west-lon3', 'ap-east-hk1', 'ap-east-hk2', 'ap-southeast-sg1', 'ap-southeast-sg2', 'ap-southeast-sg3'],
    'Object Cold': ['us-east-nyc2', 'us-east-nyc3', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon2', 'ap-southeast-sg2', 'ap-southeast-sg3'],
    'Object Archive': ['us-east-nyc3', 'eu-west-par3', 'ap-southeast-sg3'],
  };

  for (const [flavorName, azCodes] of Object.entries(flavorAzMap)) {
    await prisma.flavorAvailabilityZone.createMany({
      data: azCodes.map((code) => ({ flavorId: flavors[flavorName].id, availabilityZoneId: azs[code].id })),
    });
  }

  // ===================== PRODUCTS =====================
  console.log('  📦 Products & versions...');

  const vmProduct = await prisma.product.create({
    data: {
      name: 'Virtual Machine',
      slug: 'virtual-machine',
      description: 'Configurable virtual machine with selectable OS (Debian, Windows Server, RHEL), 2–16 vCPU and 4–32 GB RAM. Live migration, snapshots and HA options.',
      categoryId: compute.id,
      computeType: ComputeType.VIRTUAL,
      os: 'Debian, Windows Server, RHEL',
      initialReleaseDate: d('2019-03-01'),
      documentation: '# Virtual Machine\n\n## Overview\nGeneral-purpose virtual machine with selectable operating system.\n\n## Specifications\n- OS: Debian 11/12/13, Windows Server 2019/2022/2025, RHEL 8/9/10\n- vCPU: 2–16\n- RAM: 4–32 GB\n- Live migration & snapshots included',
      roadmap: '## Roadmap\n- 2026 Q4: Confidential computing (IV2 only)\n- 2027 Q1: ARM64 flavors',
      zones: { create: [{ zoneId: zoneGeneral.id }, { zoneId: zoneProd.id }] },
      regions: { create: [{ regionId: regionAmer.id }, { regionId: regionEmea.id }, { regionId: regionApac.id }] },
    },
  });

  const bmProduct = await prisma.product.create({
    data: {
      name: 'Bare Metal',
      slug: 'bare-metal',
      description: 'Single-tenant dedicated servers. 16 to 64 dedicated cores, 64–256 GB RAM, full hardware control. Ideal for licensing-bound and latency-sensitive workloads.',
      categoryId: compute.id,
      computeType: ComputeType.PHYSICAL,
      os: 'Debian, Windows Server, RHEL',
      initialReleaseDate: d('2020-06-01'),
      documentation: '# Bare Metal\n\n## Overview\nDedicated single-tenant servers.\n\n## Specifications\n- Cores: 16–64 dedicated\n- RAM: 64–256 GB\n- Redundant power, IPMI access',
      roadmap: '## Roadmap\n- 2026 Q4: EPYC Turin generation (IV2)',
      zones: { create: [{ zoneId: zoneProd.id }] },
      regions: { create: [{ regionId: regionAmer.id }, { regionId: regionEmea.id }] },
    },
  });

  const hpcProduct = await prisma.product.create({
    data: {
      name: 'HPC Cluster',
      slug: 'hpc-cluster',
      description: 'High-performance computing clusters with Slurm orchestration, high-frequency cores, up to 1 TB RAM per node and GPU options on IV2 halls. InfiniBand interconnect.',
      categoryId: compute.id,
      computeType: ComputeType.PHYSICAL,
      os: 'RHEL',
      initialReleaseDate: d('2022-09-01'),
      documentation: '# HPC Cluster\n\n## Overview\nManaged HPC clusters with Slurm.\n\n## Specifications\n- CPU: high-frequency EPYC/Xeon\n- GPU: NVIDIA options (IV2 halls only)\n- Interconnect: InfiniBand HDR\n- Scheduler: Slurm',
      roadmap: '## Roadmap\n- 2026 Q4: H200 GPU option (IV2)\n- 2027 Q2: Multi-cluster bursting',
      zones: { create: [{ zoneId: zoneProd.id }] },
      regions: { create: [{ regionId: regionAmer.id }, { regionId: regionEmea.id }, { regionId: regionApac.id }] },
    },
  });

  const nasProduct = await prisma.product.create({
    data: {
      name: 'NAS Storage',
      slug: 'nas-storage',
      description: 'Network Attached Storage with NFS v4.2, SMB 3.1.1 and iSCSI. Snapshots, replication and automated tiering. 1–100 TB shares.',
      categoryId: data.id,
      initialReleaseDate: d('2020-01-01'),
      documentation: '# NAS Storage\n\n## Overview\nEnterprise NAS with multiple protocol support.\n\n## Features\n- NFS v4.2\n- SMB 3.1.1\n- iSCSI\n- Snapshots & replication',
      roadmap: '## Roadmap\n- 2026 Q4: NVMe-oF support\n- 2027 Q1: Automated tiering GA',
      zones: { create: [{ zoneId: zoneGeneral.id }] },
      regions: { create: [{ regionId: regionAmer.id }, { regionId: regionEmea.id }, { regionId: regionApac.id }] },
    },
  });

  const objectProduct = await prisma.product.create({
    data: {
      name: 'Object Storage',
      slug: 'object-storage',
      description: 'S3-compatible object storage with 99.999999999% durability. Standard, cold and archive tiers, lifecycle policies, versioning and object lock (WORM).',
      categoryId: data.id,
      initialReleaseDate: d('2021-04-01'),
      documentation: '# Object Storage\n\n## Overview\nScalable S3-compatible object storage service.\n\n## Features\n- S3 API compatible\n- Multi-region replication\n- Lifecycle policies\n- Versioning & object lock',
      roadmap: '## Roadmap\n- 2026 Q4: Object lock (WORM) GA\n- 2027 Q1: Cross-region replication UI',
      zones: { create: [{ zoneId: zoneGeneral.id }, { zoneId: zoneProd.id }] },
      regions: { create: [{ regionId: regionAmer.id }, { regionId: regionEmea.id }, { regionId: regionApac.id }] },
    },
  });

  const vmwareProduct = await prisma.product.create({
    data: {
      name: 'VMware vSphere',
      slug: 'vmware-vsphere',
      description: 'VMware vSphere 8.0 virtualization platform with vCenter management, vSAN ready. Hosted on IV2 halls for new deployments.',
      categoryId: platform.id,
      os: 'ESXi',
      initialReleaseDate: d('2019-05-01'),
      documentation: '# VMware vSphere\n\n## Overview\nEnterprise virtualization platform.\n\n## Specifications\n- Version: vSphere 8.0 U3\n- vCenter included\n- vSAN ready',
      roadmap: '## Roadmap\n- 2026 Q4: vSphere 9.0 evaluation\n- 2027 Q1: Confidential VMs',
      zones: { create: [{ zoneId: zoneProd.id }] },
      regions: { create: [{ regionId: regionAmer.id }, { regionId: regionEmea.id }] },
    },
  });

  const citrixProduct = await prisma.product.create({
    data: {
      name: 'Citrix VDI',
      slug: 'citrix-vdi',
      description: 'Citrix Virtual Apps and Desktops service with HDX optimization and GPU acceleration. Requires VMware vSphere.',
      categoryId: platform.id,
      os: 'Windows',
      initialReleaseDate: d('2021-01-01'),
      documentation: '# Citrix VDI\n\n## Overview\nVirtual desktop infrastructure powered by Citrix.\n\n## Features\n- HDX protocol\n- GPU acceleration\n- Multi-site brokering',
      roadmap: '## Roadmap\n- 2026 Q4: WebRTC redirection\n- 2027 Q1: DaaS integration',
      zones: { create: [{ zoneId: zoneProd.id }] },
      regions: { create: [{ regionId: regionEmea.id }, { regionId: regionApac.id }] },
    },
  });

  // ===================== PRODUCT VERSIONS =====================
  type PvSpec = { productId: string; version: string; release: string; normalEnd: string; extendedEnd: string; eol: string; changelog: string; azCodes: string[]; regionIds: string[] };
  const pvSpecs: PvSpec[] = [
    // Virtual Machine generations
    { productId: vmProduct.id, version: 'gen7', release: '2021-03-01', normalEnd: '2026-03-01', extendedEnd: '2027-06-30', eol: '2028-06-30', changelog: '## gen7\n- Initial VM platform generation\n- Legacy host fleet (IV1)', azCodes: ['us-east-nyc1', 'us-east-nyc2', 'eu-west-par1', 'eu-west-par2', 'eu-west-lon1', 'ap-east-hk1', 'ap-southeast-sg1'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    { productId: vmProduct.id, version: 'gen8', release: '2024-06-01', normalEnd: '2029-06-01', extendedEnd: '2031-06-30', eol: '2032-06-30', changelog: '## gen8\n- Current VM platform generation\n- Live migration improvements\n- NVMe local storage', azCodes: ['us-east-nyc2', 'us-east-nyc3', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon2', 'eu-west-lon3', 'ap-east-hk2', 'ap-southeast-sg2', 'ap-southeast-sg3'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    { productId: vmProduct.id, version: 'gen9', release: '2026-10-01', normalEnd: '2031-10-01', extendedEnd: '2033-12-31', eol: '2034-12-31', changelog: '## gen9\n- Next generation (preview)\n- Confidential computing\n- DPU offload', azCodes: ['us-east-nyc3', 'eu-west-par3', 'ap-southeast-sg3'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    // Bare Metal
    { productId: bmProduct.id, version: 'bm-gen2', release: '2022-01-15', normalEnd: '2027-01-15', extendedEnd: '2028-06-30', eol: '2029-06-30', changelog: '## bm-gen2\n- EPYC Milan generation\n- 25G uplinks', azCodes: ['us-east-nyc2', 'eu-west-par2', 'eu-west-lon2', 'ap-southeast-sg2'], regionIds: [regionAmer.id, regionEmea.id] },
    { productId: bmProduct.id, version: 'bm-gen3', release: '2025-02-01', normalEnd: '2030-02-01', extendedEnd: '2032-06-30', eol: '2033-06-30', changelog: '## bm-gen3\n- EPYC Turin generation\n- 100G uplinks (IV2)\n- TPM 2.0 by default', azCodes: ['us-east-nyc3', 'eu-west-par3', 'eu-west-lon3'], regionIds: [regionAmer.id, regionEmea.id] },
    // HPC
    { productId: hpcProduct.id, version: 'slurm-22.05', release: '2022-09-01', normalEnd: '2026-09-01', extendedEnd: '2028-03-31', eol: '2029-03-31', changelog: '## slurm-22.05\n- Slurm 22.05 scheduler\n- InfiniBand HDR', azCodes: ['us-east-nyc3', 'eu-west-par3'], regionIds: [regionAmer.id, regionEmea.id] },
    { productId: hpcProduct.id, version: 'slurm-24.11', release: '2025-06-01', normalEnd: '2030-06-01', extendedEnd: '2032-12-31', eol: '2033-12-31', changelog: '## slurm-24.11\n- Slurm 24.11 scheduler\n- GPU scheduling improvements\n- IV2 GPU halls', azCodes: ['us-east-nyc3', 'eu-west-par3', 'ap-southeast-sg3'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    // NAS
    { productId: nasProduct.id, version: '2024.1', release: '2024-02-15', normalEnd: '2027-02-15', extendedEnd: '2029-02-15', eol: '2030-02-15', changelog: '## 2024.1\n- NVMe-oF support\n- Automated tiering\n- SMB 3.1.1', azCodes: ['us-east-nyc1', 'us-east-nyc2', 'us-east-nyc3', 'eu-west-par1', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon1', 'eu-west-lon2', 'ap-east-hk1', 'ap-southeast-sg1', 'ap-southeast-sg2', 'ap-southeast-sg3'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    // Object Storage
    { productId: objectProduct.id, version: 'v2', release: '2023-04-01', normalEnd: '2027-04-01', extendedEnd: '2029-04-01', eol: '2030-04-01', changelog: '## v2\n- Multi-region replication\n- Lifecycle policies\n- Versioning', azCodes: ['us-east-nyc1', 'us-east-nyc2', 'eu-west-par1', 'eu-west-par2', 'eu-west-lon1', 'ap-east-hk1', 'ap-southeast-sg1', 'ap-southeast-sg2'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    { productId: objectProduct.id, version: 'v3', release: '2026-01-15', normalEnd: '2030-01-15', extendedEnd: '2032-06-30', eol: '2033-06-30', changelog: '## v3\n- Object lock (WORM)\n- Cross-region replication\n- IV2 rollout first', azCodes: ['us-east-nyc3', 'eu-west-par3', 'eu-west-lon3', 'ap-southeast-sg3'], regionIds: [regionAmer.id, regionEmea.id, regionApac.id] },
    // VMware
    { productId: vmwareProduct.id, version: '7.0 U3', release: '2020-03-01', normalEnd: '2025-04-02', extendedEnd: '2027-04-02', eol: '2028-04-02', changelog: '## 7.0 U3\n- ESXi 7.0 U3\n- vCenter 7.0 U3', azCodes: ['us-east-nyc1', 'us-east-nyc2', 'eu-west-par1', 'eu-west-par2'], regionIds: [regionAmer.id, regionEmea.id] },
    { productId: vmwareProduct.id, version: '8.0 U3', release: '2024-07-01', normalEnd: '2029-07-01', extendedEnd: '2031-07-01', eol: '2032-07-01', changelog: '## 8.0 U3\n- ESXi 8.0 U3\n- vCenter 8.0 U3\n- DPU support', azCodes: ['us-east-nyc2', 'us-east-nyc3', 'eu-west-par2', 'eu-west-par3', 'eu-west-lon2', 'eu-west-lon3'], regionIds: [regionAmer.id, regionEmea.id] },
    // Citrix
    { productId: citrixProduct.id, version: '2203 LTSR', release: '2022-04-01', normalEnd: '2027-04-01', extendedEnd: '2029-04-01', eol: '2030-04-01', changelog: '## 2203 LTSR\n- LTSR baseline\n- HDX improvements', azCodes: ['eu-west-par1', 'eu-west-par2', 'eu-west-lon1', 'ap-east-hk1', 'ap-southeast-sg1'], regionIds: [regionEmea.id, regionApac.id] },
    { productId: citrixProduct.id, version: '2402 LTSR', release: '2024-05-01', normalEnd: '2029-05-01', extendedEnd: '2031-05-01', eol: '2032-05-01', changelog: '## 2402 LTSR\n- GPU acceleration\n- Multi-site brokering', azCodes: ['eu-west-par2', 'eu-west-par3', 'eu-west-lon2', 'eu-west-lon3', 'ap-east-hk2', 'ap-southeast-sg2', 'ap-southeast-sg3'], regionIds: [regionEmea.id, regionApac.id] },
  ];

  for (const spec of pvSpecs) {
    await prisma.productVersion.create({
      data: {
        productId: spec.productId,
        version: spec.version,
        releaseDate: d(spec.release),
        normalSupportEnd: d(spec.normalEnd),
        extendedSupportEnd: d(spec.extendedEnd),
        eolDate: d(spec.eol),
        phase: phaseFor(d(spec.release), d(spec.normalEnd), d(spec.extendedEnd), d(spec.eol)),
        isActive: true,
        changelog: spec.changelog,
        regions: { create: spec.regionIds.map((rid) => ({ regionId: rid })) },
        availabilityZones: { create: spec.azCodes.map((code) => ({ availabilityZoneId: azs[code].id })) },
      },
    });
  }

  // ===================== VARIANTS =====================
  console.log('  🔀 Product variants...');

  type VariantSpec = { productId: string; name: string; osVer: typeof debian12; flavorName: string; availabilityType: AvailabilityType; continuityLevelId: string; azCodes: string[]; productVersionName?: string };
  const variantSpecs: VariantSpec[] = [];

  // VM variants: OS version × flavor
  const vmOsFlavors: [typeof debian12, string[]][] = [
    [debian11, ['Small', 'Medium']],
    [debian12, ['Small', 'Medium', 'Large', 'XL']],
    [debian13, ['Medium', 'Large']],
    [win2019, ['Small', 'Medium']],
    [win2022, ['Small', 'Medium', 'Large', 'XL']],
    [win2025, ['Medium', 'Large']],
    [rhel8, ['Small', 'Medium']],
    [rhel9, ['Medium', 'Large', 'XL']],
    [rhel10, ['Large']],
  ];
  for (const [osVer, flavorNames] of vmOsFlavors) {
    for (const flavorName of flavorNames) {
      const isRestricted = osVer === rhel8 || osVer === win2019;
      const isRecommended = osVer === debian12 || osVer === rhel10;
      const pvName = osVer.releaseDate >= d('2024-06-01') ? 'gen8' : 'gen7';
      variantSpecs.push({
        productId: vmProduct.id,
        name: `${osVer.version} - ${flavorName}`,
        osVer,
        flavorName,
        availabilityType: isRecommended ? AvailabilityType.RECOMMENDED : isRestricted ? AvailabilityType.RESTRICTED : AvailabilityType.STANDARD,
        continuityLevelId: clModerate.id,
        azCodes: flavors[flavorName] ? flavorAzMap[flavorName].filter((c) => osVer.releaseDate >= d('2024-06-01') ? azs[c].code !== 'us-east-nyc1' && azs[c].code !== 'eu-west-par1' && azs[c].code !== 'eu-west-lon1' : true) : [],
        productVersionName: pvName,
      });
    }
  }

  // Bare Metal variants
  const bmOsFlavors: [typeof debian12, string[]][] = [
    [debian12, ['BM Medium']],
    [rhel9, ['BM Medium', 'BM Large']],
    [rhel10, ['BM Large', 'BM XL']],
    [win2022, ['BM Medium', 'BM Large']],
  ];
  for (const [osVer, flavorNames] of bmOsFlavors) {
    for (const flavorName of flavorNames) {
      variantSpecs.push({
        productId: bmProduct.id,
        name: `${osVer.version} - ${flavorName}`,
        osVer,
        flavorName,
        availabilityType: AvailabilityType.STANDARD,
        continuityLevelId: clSerious.id,
        azCodes: flavorAzMap[flavorName],
        productVersionName: 'bm-gen3',
      });
    }
  }

  // HPC variants (RHEL only — HPC product OS)
  const hpcOsFlavors: [typeof debian12, string[]][] = [
    [rhel9, ['HPC Compute', 'HPC Memory', 'HPC GPU']],
    [rhel10, ['HPC Compute', 'HPC GPU']],
  ];
  for (const [osVer, flavorNames] of hpcOsFlavors) {
    for (const flavorName of flavorNames) {
      variantSpecs.push({
        productId: hpcProduct.id,
        name: `${osVer.version} - ${flavorName}`,
        osVer,
        flavorName,
        availabilityType: flavorName === 'HPC GPU' ? AvailabilityType.RESTRICTED : AvailabilityType.ON_DEMAND,
        continuityLevelId: clSerious.id,
        azCodes: flavorAzMap[flavorName],
        productVersionName: 'slurm-24.11',
      });
    }
  }

  const variants: any[] = [];
  for (const spec of variantSpecs) {
    if (spec.azCodes.length === 0) continue;
    // Link variant to its product version
    const pv = spec.productVersionName
      ? await prisma.productVersion.findFirst({ where: { productId: spec.productId, version: spec.productVersionName } })
      : null;
    const variant = await prisma.productVariant.create({
      data: {
        productId: spec.productId,
        name: spec.name,
        osId: spec.osVer.osId,
        osVersionId: spec.osVer.id,
        flavorId: flavors[spec.flavorName].id,
        continuityLevelId: spec.continuityLevelId,
        productVersionId: pv?.id,
        isActive: true,
        availabilityType: spec.availabilityType,
        releaseDate: spec.osVer.releaseDate,
        normalSupportEnd: spec.osVer.normalSupportEnd,
        extendedSupportEnd: spec.osVer.extendedSupportEnd,
        eolDate: spec.osVer.eolDate,
        phase: spec.osVer.phase,
        availabilityZones: { create: spec.azCodes.map((code) => ({ availabilityZoneId: azs[code].id })) },
        zones: { create: [{ zoneId: zoneGeneral.id }] },
      },
    });
    variants.push(variant);
  }

  // ===================== AVAILABILITY SCHEDULES =====================
  console.log('  📅 Availability schedules...');

  // HPC GPU flavor is reserved to IV2 halls (uses the new INFRA_VERSION-aware schedule)
  await prisma.availabilitySchedule.create({
    data: {
      targetType: 'FLAVOR',
      targetId: flavors['HPC GPU'].id,
      infraVersionId: iv2.id,
      status: AvailabilityType.STANDARD,
      availableFrom: d('2024-06-01'),
    },
  });
  // Object Storage v3 rollout: IV2 only initially
  await prisma.availabilitySchedule.create({
    data: {
      targetType: 'PRODUCT_VERSION',
      targetId: (await prisma.productVersion.findFirst({ where: { productId: objectProduct.id, version: 'v3' } }))!.id,
      infraVersionId: iv2.id,
      status: AvailabilityType.RESTRICTED,
      availableFrom: d('2026-01-15'),
    },
  });

  // ===================== DEPENDENCIES =====================
  await prisma.dependency.create({ data: { productId: vmProduct.id, dependsOnId: objectProduct.id, type: DependencyType.RECOMMENDED, description: 'Recommended for backup and archive storage' } });
  await prisma.dependency.create({ data: { productId: bmProduct.id, dependsOnId: nasProduct.id, type: DependencyType.RECOMMENDED, description: 'Shared storage for provisioning images' } });
  await prisma.dependency.create({ data: { productId: hpcProduct.id, dependsOnId: nasProduct.id, type: DependencyType.REQUIRED, description: 'Dataset staging storage for HPC workloads' } });
  await prisma.dependency.create({ data: { productId: hpcProduct.id, dependsOnId: objectProduct.id, type: DependencyType.RECOMMENDED, description: 'Results archiving' } });
  await prisma.dependency.create({ data: { productId: citrixProduct.id, dependsOnId: vmwareProduct.id, type: DependencyType.REQUIRED, description: 'Citrix VDI requires VMware vSphere as underlying hypervisor' } });

  // ===================== UPGRADE PATHS & TRANSITIONS =====================
  await prisma.upgradePath.create({ data: { fromProductId: vmProduct.id, toProductId: vmProduct.id, fromVersion: 'gen7', toVersion: 'gen8', migrationType: 'IN_PLACE', notes: 'Live migration from IV1 to IV2 host fleet' } });
  await prisma.upgradePath.create({ data: { fromProductId: bmProduct.id, toProductId: bmProduct.id, fromVersion: 'bm-gen2', toVersion: 'bm-gen3', migrationType: 'REBUILD', notes: 'Reprovision on IV2 hardware' } });
  await prisma.upgradePath.create({ data: { fromProductId: objectProduct.id, toProductId: objectProduct.id, fromVersion: 'v2', toVersion: 'v3', migrationType: 'BLUE_GREEN', notes: 'Bucket-level copy, cutover per region' } });

  await prisma.transition.create({ data: { name: 'VM gen7 → gen8', slug: 'vm-gen7-to-gen8', description: 'Migrate legacy VMs from the gen7 (IV1) platform to gen8 (IV2).', fromProductId: vmProduct.id, toProductId: vmProduct.id, fromVersion: 'gen7', toVersion: 'gen8', migrationType: 'IN_PLACE', status: 'AVAILABLE', availableFrom: d('2024-06-01'), eolDate: d('2028-06-30'), notes: 'Live migration supported between AZs hosting both generations.' } });
  await prisma.transition.create({ data: { name: 'Windows Server 2019 → 2022', slug: 'windows-2019-to-2022', description: 'Windows Server 2019 exits normal support (2024-01-09). Migrate to Server 2022.', fromProductId: vmProduct.id, toProductId: vmProduct.id, fromVersion: 'Server 2019', toVersion: 'Server 2022', migrationType: 'BLUE_GREEN', status: 'AVAILABLE', availableFrom: d('2024-01-09'), notes: 'Blue-green migration recommended for zero downtime.' } });
  await prisma.transition.create({ data: { name: 'Debian 11 → 12', slug: 'debian-11-to-12', description: 'Debian 11 LTS ends 2026-08-31. Migrate to Debian 12.', fromProductId: vmProduct.id, toProductId: vmProduct.id, fromVersion: '11 (Bullseye)', toVersion: '12 (Bookworm)', migrationType: 'REBUILD', status: 'AVAILABLE', availableFrom: d('2023-06-10'), notes: 'Rebuild recommended; in-place apt upgrade possible.' } });
  await prisma.transition.create({ data: { name: 'RHEL 8 → 9', slug: 'rhel-8-to-9', description: 'RHEL 8 maintenance support ended 2024-05-31. Migrate to RHEL 9.', fromProductId: vmProduct.id, toProductId: vmProduct.id, fromVersion: '8', toVersion: '9', migrationType: 'REBUILD', status: 'AVAILABLE', availableFrom: d('2022-05-17'), notes: 'Leapp in-place upgrade supported.' } });

  // ===================== USERS (forecast lifecycle roles) =====================
  const managerUser = await prisma.user.create({ data: { email: 'manager@cloudmarket.local', name: 'Carol Manager', role: 'USER', roles: ['MANAGER'] } });
  await prisma.user.create({ data: { email: 'techlead@cloudmarket.local', name: 'Trevor TechLead', role: 'USER', roles: ['TECH_LEAD'] } });
  await prisma.user.create({ data: { email: 'finance@cloudmarket.local', name: 'Fiona Finance', role: 'USER', roles: ['FINANCE'] } });
  await prisma.user.create({ data: { email: 'admin@cloudmarket.local', name: 'System Administrator', role: 'ADMIN', roles: ['ADMIN', 'REQUESTER', 'TECH_LEAD', 'MANAGER', 'FINANCE'] } });
  await prisma.user.create({ data: { email: 'user@cloudmarket.local', name: 'Demo User', role: 'USER', roles: ['REQUESTER'], managerId: managerUser.id } });

  // ===================== APPLICATIONS =====================
  const appEcommerce = await prisma.application.create({ data: { name: 'E-Commerce Platform', description: 'Main customer-facing e-commerce application', continuityLevelId: clSerious.id, owner: 'Demo User' } });
  const appAnalytics = await prisma.application.create({ data: { name: 'Analytics Engine', description: 'Internal analytics and reporting platform', continuityLevelId: clModerate.id, owner: 'Demo User' } });
  const appDevTools = await prisma.application.create({ data: { name: 'Developer Portal', description: 'Developer tools and CI/CD portal', continuityLevelId: clLow.id, owner: 'Demo User' } });
  const appHpc = await prisma.application.create({ data: { name: 'Genomics Pipeline', description: 'Bioinformatics batch processing on HPC', continuityLevelId: clExtreme.id, owner: 'System Administrator' } });

  // ===================== FORECASTS =====================
  const vmMediumDebian12 = variants.find((v) => v.name === '12 (Bookworm) - Medium');
  const vmMediumWin2022 = variants.find((v) => v.name === 'Server 2022 - Medium');
  const hpcGpuRhel9 = variants.find((v) => v.name === '9 - HPC GPU');

  await prisma.forecast.create({
    data: {
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      status: ForecastStatus.PENDING_TECH,
      submittedAt: new Date(),
      justification: 'Need VMs for development team expansion',
      applicationId: appDevTools.id,
      environment: 'DEV',
      lines: { create: [{ productId: vmProduct.id, variantId: vmMediumDebian12?.id, flavorId: flavors['Medium'].id, azCode: 'ap-southeast-sg2', quantity: 5, resiliency: 'STANDARD', metadata: { osVersion: 'debian-12' } }] },
    },
  });
  await prisma.forecast.create({
    data: {
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      status: ForecastStatus.APPROVED,
      submittedAt: new Date(),
      justification: 'Windows servers for finance department',
      reviewedBy: 'System Administrator',
      reviewedAt: new Date(),
      applicationId: appEcommerce.id,
      environment: 'PRD',
      lines: { create: [{ productId: vmProduct.id, variantId: vmMediumWin2022?.id, flavorId: flavors['Medium'].id, azCode: 'eu-west-par2', quantity: 3, resiliency: 'HA', metadata: { osVersion: 'windows-server-2022' } }] },
    },
  });
  await prisma.forecast.create({
    data: {
      requestedBy: 'System Administrator',
      requesterEmail: 'admin@cloudmarket.local',
      status: ForecastStatus.REJECTED,
      submittedAt: new Date(),
      justification: 'HPC GPU nodes for genomics ML training',
      reviewedBy: 'System Administrator',
      reviewedAt: new Date(),
      rejectionReason: 'IV2 GPU hall capacity not yet available in requested region. Resubmit for Q1.',
      applicationId: appHpc.id,
      environment: 'STG',
      lines: { create: [{ productId: hpcProduct.id, variantId: hpcGpuRhel9?.id, flavorId: flavors['HPC GPU'].id, azCode: 'ap-southeast-sg3', quantity: 2, resiliency: 'MULTI_AZ' }] },
    },
  });

  // ===================== INSTANCES =====================
  const instanceSpecs = [
    { name: 'ecom-web-01', desc: 'E-commerce web frontend', appId: appEcommerce.id, variantName: '12 (Bookworm) - Small', flavorName: 'Small', azCode: 'ap-southeast-sg2', status: InstanceStatus.RUNNING, env: 'PRD', ip: '10.0.1.10' },
    { name: 'ecom-api-01', desc: 'E-commerce API server', appId: appEcommerce.id, variantName: 'Server 2022 - Medium', flavorName: 'Medium', azCode: 'eu-west-par2', status: InstanceStatus.RUNNING, env: 'PRD', ip: '10.0.2.20' },
    { name: 'ecom-api-02', desc: 'E-commerce API server (replica)', appId: appEcommerce.id, variantName: 'Server 2022 - Medium', flavorName: 'Medium', azCode: 'eu-west-par3', status: InstanceStatus.RUNNING, env: 'PRD', ip: '10.0.2.21' },
    { name: 'analytics-worker-01', desc: 'Analytics batch worker', appId: appAnalytics.id, variantName: '9 - Large', flavorName: 'Large', azCode: 'us-east-nyc2', status: InstanceStatus.STOPPED, env: 'STG', ip: '10.0.3.30' },
    { name: 'dev-build-01', desc: 'CI/CD build agent', appId: appDevTools.id, variantName: '12 (Bookworm) - Small', flavorName: 'Small', azCode: 'us-east-nyc1', status: InstanceStatus.PROVISIONING, env: 'DEV', ip: '10.0.4.40' },
    { name: 'ecom-cache-01', desc: 'Redis cache node', appId: appEcommerce.id, variantName: '12 (Bookworm) - Small', flavorName: 'Small', azCode: 'ap-east-hk2', status: InstanceStatus.PENDING, env: 'PRD', ip: null },
    { name: 'analytics-db-01', desc: 'Analytics database server', appId: appAnalytics.id, variantName: 'Server 2022 - Large', flavorName: 'Large', azCode: 'ap-southeast-sg3', status: InstanceStatus.TERMINATED, env: 'DEV', ip: '10.0.5.50' },
    { name: 'bm-license-01', desc: 'License server on dedicated hardware', appId: appDevTools.id, variantName: '12 (Bookworm) - BM Medium', flavorName: 'BM Medium', azCode: 'eu-west-par2', status: InstanceStatus.RUNNING, env: 'PRD', ip: '10.0.6.60' },
    { name: 'hpc-genomics-01', desc: 'Genomics HPC GPU node', appId: appHpc.id, variantName: '9 - HPC GPU', flavorName: 'HPC GPU', azCode: 'eu-west-par3', status: InstanceStatus.RUNNING, env: 'PRD', ip: '10.0.7.70' },
    { name: 'hpc-genomics-02', desc: 'Genomics HPC GPU node', appId: appHpc.id, variantName: '9 - HPC GPU', flavorName: 'HPC GPU', azCode: 'us-east-nyc3', status: InstanceStatus.RUNNING, env: 'PRD', ip: '10.0.7.71' },
  ];

  const createdInstances: { id: string; name: string }[] = [];
  for (const spec of instanceSpecs) {
    const variant = variants.find((v) => v.name === spec.variantName);
    if (!variant) continue;
    const inst = await prisma.instance.create({
      data: {
        name: spec.name,
        description: spec.desc,
        applicationId: spec.appId,
        productId: variant.productId,
        variantId: variant.id,
        flavorId: variant.flavorId,
        azCode: spec.azCode,
        status: spec.status,
        environment: spec.env as any,
        ipAddress: spec.ip,
        hostname: `${spec.name}.${spec.azCode}.cloudmarket.local`,
        startedAt: spec.status === InstanceStatus.RUNNING || spec.status === InstanceStatus.STOPPED ? d('2025-03-01') : null,
        stoppedAt: spec.status === InstanceStatus.STOPPED ? d('2026-06-01') : null,
        terminatedAt: spec.status === InstanceStatus.TERMINATED ? d('2026-07-01') : null,
        metadata: { osVersion: variant.name.split(' - ')[0].toLowerCase().replace(/\s+/g, '-') },
      },
    });
    createdInstances.push({ id: inst.id, name: inst.name });
  }

  // ===================== HEALTH CHECKS =====================
  for (const instance of createdInstances) {
    const statuses = [HealthStatus.HEALTHY, HealthStatus.HEALTHY, HealthStatus.DEGRADED, HealthStatus.HEALTHY, HealthStatus.UNHEALTHY];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    await prisma.healthCheck.create({
      data: {
        instanceId: instance.id,
        status,
        cpuPercent: Math.random() * 100,
        memoryPercent: Math.random() * 100,
        diskPercent: Math.random() * 100,
        responseTimeMs: Math.floor(Math.random() * 500) + 20,
        checkedAt: new Date(),
      },
    });
  }

  // ===================== MAINTENANCE WINDOWS =====================
  const now = new Date();
  await prisma.maintenanceWindow.create({
    data: {
      instanceId: createdInstances.find((i) => i.name === 'ecom-web-01')?.id,
      title: 'Security Patch – ecom-web-01',
      description: 'Apply critical kernel security patches',
      startTime: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 26 * 60 * 60 * 1000),
      status: MaintenanceStatus.SCHEDULED,
    },
  });
  await prisma.maintenanceWindow.create({
    data: {
      applicationId: appEcommerce.id,
      title: 'E-Commerce Platform Upgrade',
      description: 'Platform-wide OS version upgrade with rolling restart',
      startTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000 + 4 * 60 * 60 * 1000),
      status: MaintenanceStatus.SCHEDULED,
    },
  });
  await prisma.maintenanceWindow.create({
    data: {
      instanceId: createdInstances.find((i) => i.name === 'analytics-worker-01')?.id,
      title: 'Analytics Worker – Disk Expansion',
      description: 'Expand local storage from 500GB to 1TB',
      startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      status: MaintenanceStatus.COMPLETED,
    },
  });
  await prisma.maintenanceWindow.create({
    data: {
      title: 'IV1 → IV2 Migration Wave 1 — Paris',
      description: 'Migrate par1 IV1 workloads to par2/par3 IV2 halls',
      startTime: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 16 * 24 * 60 * 60 * 1000),
      status: MaintenanceStatus.SCHEDULED,
    },
  });

  // ===================== PRESENTATION ORDERS =====================
  await prisma.presentationOrder.create({
    data: {
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
  await prisma.presentationOrder.create({
    data: {
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

  // ===================== PERFORMANCE PROFILES =====================
  const perfProfiles = [
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
      name: 'Bare Metal — BM Large',
      targetType: PerformanceTargetType.PRODUCT,
      targetId: bmProduct.id,
      overallScore: 92,
      scoreLabel: 'Excellent',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'vCPU Performance', value: 94, unit: 'index', comparison: 'vs. BM XL', displayOrder: 0 },
        { name: 'Memory Bandwidth', value: 108, unit: 'GB/s', comparison: 'vs. BM XL', displayOrder: 1 },
        { name: 'Network Throughput', value: 25, unit: 'Gbps', comparison: 'uplink', displayOrder: 2 },
      ],
    },
    {
      name: 'HPC Cluster — GPU',
      targetType: PerformanceTargetType.PRODUCT,
      targetId: hpcProduct.id,
      overallScore: 96,
      scoreLabel: 'Excellent',
      colorTheme: 'green',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'GPU Compute', value: 94, unit: 'TFLOPS', comparison: 'peak', displayOrder: 0 },
        { name: 'Interconnect', value: 200, unit: 'Gb/s', comparison: 'InfiniBand HDR', displayOrder: 1 },
        { name: 'Memory Bandwidth', value: 112, unit: 'GB/s', comparison: 'vs. BM XL', displayOrder: 2 },
      ],
    },
    {
      name: 'Object Storage',
      targetType: PerformanceTargetType.PRODUCT,
      targetId: objectProduct.id,
      overallScore: 78,
      scoreLabel: 'Good',
      colorTheme: 'yellow',
      visibility: VisibilityType.SHOW_ALL,
      metrics: [
        { name: 'Read Throughput', value: 3200, unit: 'MB/s', comparison: 'peak', displayOrder: 0 },
        { name: 'Write Throughput', value: 2100, unit: 'MB/s', comparison: 'peak', displayOrder: 1 },
        { name: 'Latency (p99)', value: 12, unit: 'ms', comparison: 'avg', displayOrder: 2 },
      ],
    },
  ];

  for (const profile of perfProfiles) {
    const { metrics, ...profileData } = profile;
    await prisma.performanceProfile.create({ data: { ...profileData, metrics: { create: metrics } } });
  }

  console.log('  📊 Summary:');
  const [azCount, ivCount, osCount, flavorCount, productCount, versionCount, variantCount] = await Promise.all([
    prisma.availabilityZone.count(),
    prisma.infraVersion.count(),
    prisma.osVersion.count(),
    prisma.flavor.count(),
    prisma.product.count(),
    prisma.productVersion.count(),
    prisma.productVariant.count(),
  ]);
  console.log(`    ${azCount} AZs, ${ivCount} infra versions, ${osCount} OS versions, ${flavorCount} flavors, ${productCount} products, ${versionCount} product versions, ${variantCount} variants`);
  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
