import { PrismaClient, DependencyType, ApprovalStatus, LifecyclePhase, InstanceStatus, HealthStatus, MaintenanceStatus, ComputeType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data
  try {
    await prisma.productVariantZone.deleteMany();
    await prisma.zoneAvailabilityZone.deleteMany();
    await prisma.zone.deleteMany();
    await prisma.forecast.deleteMany();
    await prisma.healthCheck.deleteMany();
    await prisma.maintenanceWindow.deleteMany();
    await prisma.instance.deleteMany();
    await prisma.dependency.deleteMany();
    await prisma.upgradePath.deleteMany();
    await prisma.productVariantAvailabilityZone.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.osVersion.deleteMany();
    await prisma.operatingSystem.deleteMany();
    await prisma.flavor.deleteMany();
    await prisma.availabilityZone.deleteMany();
    await prisma.product.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
    await prisma.application.deleteMany();
    await prisma.continuityLevel.deleteMany();
  } catch (e: any) {
    if (e.code === 'P2021') {
      console.log('  Tables do not exist yet — make sure to run "npx prisma db push" first');
      throw e;
    }
    throw e;
  }

  // Create Availability Zones
  const parisAz1 = await prisma.availabilityZone.create({
    data: { code: 'eu-west-par1', name: 'Paris AZ1', city: 'Paris', country: 'France', region: 'eu-west', latitude: 48.8566, longitude: 2.3522, isActive: true },
  });
  const parisAz2 = await prisma.availabilityZone.create({
    data: { code: 'eu-west-par2', name: 'Paris AZ2', city: 'Paris', country: 'France', region: 'eu-west', latitude: 48.8566, longitude: 2.3522, isActive: true },
  });
  const london = await prisma.availabilityZone.create({
    data: { code: 'eu-west-lon1', name: 'London', city: 'London', country: 'UK', region: 'eu-west', latitude: 51.5074, longitude: -0.1278, isActive: true },
  });
  const newYork = await prisma.availabilityZone.create({
    data: { code: 'us-east-nyc1', name: 'New York', city: 'New York', country: 'USA', region: 'us-east', latitude: 40.7128, longitude: -74.006, isActive: true },
  });
  const singapore = await prisma.availabilityZone.create({
    data: { code: 'ap-south-sin1', name: 'Singapore', city: 'Singapore', country: 'Singapore', region: 'ap-south', latitude: 1.3521, longitude: 103.8198, isActive: true },
  });
  const hongKong = await prisma.availabilityZone.create({
    data: { code: 'ap-south-hk1', name: 'Hong Kong', city: 'Hong Kong', country: 'China', region: 'ap-south', latitude: 22.3193, longitude: 114.1694, isActive: true },
  });

  const allAzs = [parisAz1, parisAz2, london, newYork, singapore, hongKong];

  // Create Zones
  const zoneToto = await prisma.zone.create({
    data: { name: 'bubble-toto', slug: 'bubble-toto', isActive: true }
  });
  const zoneProd = await prisma.zone.create({
    data: { name: 'bubble-prod', slug: 'bubble-prod', isActive: true }
  });

  // Link zones to AZs
  await prisma.zoneAvailabilityZone.create({ data: { zoneId: zoneToto.id, availabilityZoneId: parisAz1.id } });
  await prisma.zoneAvailabilityZone.create({ data: { zoneId: zoneProd.id, availabilityZoneId: parisAz2.id } });

  // Create Continuity Levels
  const clLow = await prisma.continuityLevel.create({
    data: { name: 'LOW', rtoMinutes: 1440, rpoMinutes: 240, description: 'Basic backup', color: 'green' },
  });
  const clModerate = await prisma.continuityLevel.create({
    data: { name: 'MODERATE', rtoMinutes: 480, rpoMinutes: 60, description: 'HA pair', color: 'yellow' },
  });
  const clSerious = await prisma.continuityLevel.create({
    data: { name: 'SERIOUS', rtoMinutes: 240, rpoMinutes: 15, description: 'Multi-AZ', color: 'orange' },
  });
  const clExtreme = await prisma.continuityLevel.create({
    data: { name: 'EXTREME', rtoMinutes: 60, rpoMinutes: 5, description: 'Active-Active', color: 'red' },
  });

  // Create Categories
  const compute = await prisma.category.create({
    data: { name: 'Compute', slug: 'compute', description: 'Virtual machines and compute resources', icon: 'Cpu' },
  });
  const data = await prisma.category.create({
    data: { name: 'Data', slug: 'data', description: 'Storage and data management services', icon: 'Database' },
  });
  const hypervisor = await prisma.category.create({
    data: { name: 'Hypervisor', slug: 'hypervisor', description: 'Virtualization platforms', icon: 'Server' },
  });
  const citrix = await prisma.category.create({
    data: { name: 'Citrix', slug: 'citrix', description: 'Citrix virtualization and VDI solutions', icon: 'Monitor' },
  });

  // Create Operating Systems
  const osWindows = await prisma.operatingSystem.create({
    data: { family: 'WINDOWS', name: 'Windows', slug: 'windows', isActive: true, availabilityType: 'STANDARD' },
  });
  const osDebian = await prisma.operatingSystem.create({
    data: { family: 'LINUX', name: 'Debian', slug: 'debian', isActive: true, availabilityType: 'RECOMMENDED' },
  });
  const osRedhat = await prisma.operatingSystem.create({
    data: { family: 'LINUX', name: 'Red Hat Enterprise Linux', slug: 'rhel', isActive: true, availabilityType: 'RESTRICTED' },
  });

  // Create OS Versions
  const win2022 = await prisma.osVersion.create({
    data: {
      osId: osWindows.id,
      version: 'Server 2022',
      releaseDate: new Date('2021-08-18'),
      normalSupportEnd: new Date('2026-10-13'),
      extendedSupportEnd: new Date('2031-10-14'),
      eolDate: new Date('2033-10-14'),
      phase: LifecyclePhase.RELEASED,
      isActive: true,
    },
  });
  const win2019 = await prisma.osVersion.create({
    data: {
      osId: osWindows.id,
      version: 'Server 2019',
      releaseDate: new Date('2018-10-02'),
      normalSupportEnd: new Date('2024-01-09'),
      extendedSupportEnd: new Date('2029-01-09'),
      eolDate: new Date('2031-01-09'),
      phase: LifecyclePhase.EXTENDED_SUPPORT,
      isActive: true,
    },
  });
  const win11 = await prisma.osVersion.create({
    data: {
      osId: osWindows.id,
      version: '11',
      releaseDate: new Date('2021-10-05'),
      normalSupportEnd: new Date('2025-10-14'),
      extendedSupportEnd: new Date('2028-10-10'),
      eolDate: new Date('2030-10-10'),
      phase: LifecyclePhase.NORMAL_SUPPORT,
      isActive: true,
    },
  });
  const debian12 = await prisma.osVersion.create({
    data: {
      osId: osDebian.id,
      version: '12 (Bookworm)',
      releaseDate: new Date('2023-06-10'),
      normalSupportEnd: new Date('2026-06-10'),
      extendedSupportEnd: new Date('2028-06-10'),
      eolDate: new Date('2030-06-10'),
      phase: LifecyclePhase.RELEASED,
      isActive: true,
    },
  });
  const debian11 = await prisma.osVersion.create({
    data: {
      osId: osDebian.id,
      version: '11 (Bullseye)',
      releaseDate: new Date('2021-08-14'),
      normalSupportEnd: new Date('2024-08-14'),
      extendedSupportEnd: new Date('2026-08-14'),
      eolDate: new Date('2028-08-14'),
      phase: LifecyclePhase.NORMAL_SUPPORT,
      isActive: true,
    },
  });
  const rhel9 = await prisma.osVersion.create({
    data: {
      osId: osRedhat.id,
      version: '9',
      releaseDate: new Date('2022-05-18'),
      normalSupportEnd: new Date('2027-05-31'),
      extendedSupportEnd: new Date('2031-05-31'),
      eolDate: new Date('2033-05-31'),
      phase: LifecyclePhase.RELEASED,
      isActive: true,
    },
  });
  const rhel8 = await prisma.osVersion.create({
    data: {
      osId: osRedhat.id,
      version: '8',
      releaseDate: new Date('2019-05-07'),
      normalSupportEnd: new Date('2024-05-31'),
      extendedSupportEnd: new Date('2026-05-31'),
      eolDate: new Date('2028-05-31'),
      phase: LifecyclePhase.EXTENDED_SUPPORT,
      isActive: true,
    },
  });

  // Create global Flavors
  const computeFlavors = [
    { name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry-level configuration for development and testing' },
    { name: 'Medium', vcpu: 4, ramGb: 8, description: 'Balanced configuration for production workloads' },
    { name: 'Large', vcpu: 8, ramGb: 16, description: 'High-performance configuration for demanding applications' },
    { name: 'XL', vcpu: 16, ramGb: 32, description: 'Maximum performance for enterprise workloads' },
  ];

  const storageFlavors = [
    { name: 'Storage Small', vcpu: 0, ramGb: 0, description: '1TB storage, 1000 IOPS' },
    { name: 'Storage Medium', vcpu: 0, ramGb: 0, description: '5TB storage, 5000 IOPS' },
    { name: 'Storage Large', vcpu: 0, ramGb: 0, description: '20TB storage, 20000 IOPS' },
    { name: 'Storage XL', vcpu: 0, ramGb: 0, description: '100TB storage, 100000 IOPS' },
  ];

  const flavorRecords: Record<string, typeof computeFlavors[0] & { id: string }> = {};
  for (const f of computeFlavors) {
    const rec = await prisma.flavor.create({ data: f });
    flavorRecords[rec.name] = rec;
  }
  for (const f of storageFlavors) {
    const rec = await prisma.flavor.create({ data: f });
    flavorRecords[`storage-${f.name}`] = rec;
  }

  // Create Products
  const vmProduct = await prisma.product.create({
    data: {
      name: 'Virtual Machine',
      slug: 'virtual-machine',
      description: 'Configurable virtual machine with selectable OS, vCPU, and memory options.',
      categoryId: compute.id,
      computeType: ComputeType.VIRTUAL,
      os: 'Linux',
      documentation: '# Virtual Machine\n\n## Overview\nConfigurable virtual machine with selectable operating system.\n\n## Specifications\n- OS: selectable (Debian, Windows Server, RHEL)\n- vCPU: 2–16\n- RAM: 4–32 GB',
      roadmap: '## Roadmap\n- Q3 2024: ARM64 support\n- Q4 2024: GPU instance option\n- Q1 2025: Confidential computing',
    },
  });

  const bareMetalHpc = await prisma.product.create({
    data: {
      name: 'Bare Metal HPC',
      slug: 'bare-metal-hpc',
      description: 'High-performance computing bare metal servers with InfiniBand networking and GPU options.',
      categoryId: compute.id,
      computeType: ComputeType.PHYSICAL,
      os: 'Linux',
      documentation: '# Bare Metal HPC\n\n## Overview\nDedicated bare metal servers for HPC workloads.\n\n## Specifications\n- CPU: AMD EPYC / Intel Xeon\n- GPU: NVIDIA A100/H100 options\n- Network: InfiniBand HDR',
      roadmap: '## Roadmap\n- Q3 2024: NVIDIA H200 support\n- Q4 2024: Liquid cooling option',
    },
  });

  const objectStorage = await prisma.product.create({
    data: {
      name: 'Object Storage',
      slug: 'object-storage',
      description: 'S3-compatible object storage with 99.999999999% durability and global CDN integration.',
      categoryId: data.id,
      documentation: '# Object Storage\n\n## Overview\nScalable S3-compatible object storage service.\n\n## Features\n- S3 API compatible\n- Multi-region replication\n- Lifecycle policies\n- Versioning support',
      roadmap: '## Roadmap\n- Q3 2024: Glacier-like archive tier\n- Q4 2024: Object lock (WORM)',
    },
  });

  const nas = await prisma.product.create({
    data: {
      name: 'NAS Storage',
      slug: 'nas-storage',
      description: 'Network Attached Storage with NFS, SMB, and iSCSI protocols.',
      categoryId: data.id,
      documentation: '# NAS Storage\n\n## Overview\nEnterprise NAS with multiple protocol support.\n\n## Features\n- NFS v4.2\n- SMB 3.1.1\n- iSCSI\n- Snapshots & replication',
      roadmap: '## Roadmap\n- Q3 2024: NVMe-oF support\n- Q4 2024: Automated tiering',
    },
  });

  const vmware = await prisma.product.create({
    data: {
      name: 'VMware vSphere',
      slug: 'vmware-vsphere',
      description: 'VMware vSphere 8.0 virtualization platform with vCenter management.',
      categoryId: hypervisor.id,
      os: 'ESXi',
      documentation: '# VMware vSphere\n\n## Overview\nEnterprise virtualization platform.\n\n## Specifications\n- Version: vSphere 8.0 U2\n- vCenter included\n- vSAN ready',
      roadmap: '## Roadmap\n- Q3 2024: vSphere 8.0 U3\n- Q4 2024: Confidential VMs',
    },
  });

  const citrixVdi = await prisma.product.create({
    data: {
      name: 'Citrix VDI',
      slug: 'citrix-vdi',
      description: 'Citrix Virtual Apps and Desktops service with HDX optimization.',
      categoryId: citrix.id,
      os: 'Windows',
      documentation: '# Citrix VDI\n\n## Overview\nVirtual desktop infrastructure powered by Citrix.\n\n## Features\n- HDX protocol\n- GPU acceleration\n- Multi-site brokering',
      roadmap: '## Roadmap\n- Q3 2024: Citrix DaaS integration\n- Q4 2024: WebRTC redirection',
    },
  });

  // Create Product Variants (only for Compute products)
  const vmVariants: any[] = [];
  for (const osVer of [debian12, debian11, win2022, rhel9]) {
    for (const flavorName of ['Small', 'Medium', 'Large']) {
      const isRecommended = osVer === debian12 && flavorName === 'Large';
      const isRestricted = osVer === rhel9;
      const variant = await prisma.productVariant.create({
        data: {
          productId: vmProduct.id,
          name: `${osVer.version} - ${flavorName}`,
          osId: osVer.osId,
          osVersionId: osVer.id,
          flavorId: flavorRecords[flavorName].id,
          continuityLevelId: clModerate.id,
          isActive: true,
          availabilityType: isRecommended ? 'RECOMMENDED' : isRestricted ? 'RESTRICTED' : 'STANDARD',
          availabilityZones: {
            create: [
              { availabilityZoneId: parisAz1.id },
              { availabilityZoneId: parisAz2.id },
              { availabilityZoneId: singapore.id },
            ],
          },
          zones: { create: [{ zoneId: zoneToto.id }] },
        },
      });
      vmVariants.push(variant);
    }
  }

  const hpcVariants: any[] = [];
  for (const osVer of [debian12, rhel9]) {
    for (const flavorName of ['Large', 'XL']) {
      const isOnDemand = flavorName === 'XL';
      const variant = await prisma.productVariant.create({
        data: {
          productId: bareMetalHpc.id,
          name: `${osVer.version} - ${flavorName}`,
          osId: osVer.osId,
          osVersionId: osVer.id,
          flavorId: flavorRecords[flavorName].id,
          continuityLevelId: clSerious.id,
          isActive: true,
          availabilityType: isOnDemand ? 'ON_DEMAND' : 'RECOMMENDED',
          availabilityZones: {
            create: [
              { availabilityZoneId: parisAz1.id },
              { availabilityZoneId: newYork.id },
            ],
          },
          zones: { create: [{ zoneId: zoneProd.id }] },
        },
      });
      hpcVariants.push(variant);
    }
  }

  // Create Dependencies
  await prisma.dependency.create({
    data: {
      productId: vmProduct.id,
      dependsOnId: objectStorage.id,
      type: DependencyType.RECOMMENDED,
      description: 'Recommended for backup and archive storage',
    },
  });
  await prisma.dependency.create({
    data: {
      productId: bareMetalHpc.id,
      dependsOnId: objectStorage.id,
      type: DependencyType.RECOMMENDED,
      description: 'Recommended for dataset storage and results archiving',
    },
  });
  await prisma.dependency.create({
    data: {
      productId: citrixVdi.id,
      dependsOnId: vmware.id,
      type: DependencyType.REQUIRED,
      description: 'Citrix VDI requires VMware vSphere as underlying hypervisor',
    },
  });

  // Create Upgrade Paths
  await prisma.upgradePath.create({
    data: {
      fromProductId: vmProduct.id,
      toProductId: vmProduct.id,
      fromVersion: '11.0',
      toVersion: '12.0',
      migrationType: 'IN_PLACE',
      notes: 'In-place upgrade via apt full-upgrade',
    },
  });
  await prisma.upgradePath.create({
    data: {
      fromProductId: vmProduct.id,
      toProductId: vmProduct.id,
      fromVersion: '2019',
      toVersion: '2022',
      migrationType: 'BLUE_GREEN',
      notes: 'Blue-green migration recommended for zero downtime',
    },
  });

  // Create Users
  await prisma.user.create({
    data: { email: 'admin@cloudmarket.local', name: 'System Administrator', role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { email: 'user@cloudmarket.local', name: 'Demo User', role: 'USER' },
  });

  // Create Applications
  const appEcommerce = await prisma.application.create({
    data: { name: 'E-Commerce Platform', description: 'Main customer-facing e-commerce application', continuityLevelId: clSerious.id, owner: 'Demo User' },
  });
  const appAnalytics = await prisma.application.create({
    data: { name: 'Analytics Engine', description: 'Internal analytics and reporting platform', continuityLevelId: clModerate.id, owner: 'Demo User' },
  });
  const appDevTools = await prisma.application.create({
    data: { name: 'Developer Portal', description: 'Developer tools and CI/CD portal', continuityLevelId: clLow.id, owner: 'Demo User' },
  });

  // Create Sample Forecasts
  await prisma.forecast.create({
    data: {
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      status: ApprovalStatus.PENDING,
      justification: 'Need VMs for development team expansion',
      applicationId: appDevTools.id,
      environment: 'DEV',
      lines: {
        create: [{
          productId: vmProduct.id,
          flavorId: flavorRecords['Medium'].id,
          azCode: 'ap-south-sin1',
          quantity: 5,
          resiliency: 'STANDARD',
          metadata: { osVersion: 'debian-12', variantId: vmVariants.find(v => v.name.includes('Debian 12') && v.name.includes('Medium'))?.id },
        }],
      },
    },
  });

  await prisma.forecast.create({
    data: {
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      status: ApprovalStatus.APPROVED,
      justification: 'Windows servers for finance department',
      reviewedBy: 'System Administrator',
      reviewedAt: new Date(),
      applicationId: appEcommerce.id,
      environment: 'PRD',
      lines: {
        create: [{
          productId: vmProduct.id,
          flavorId: flavorRecords['Medium'].id,
          azCode: 'ap-south-sin1',
          quantity: 3,
          resiliency: 'HA',
          metadata: { osVersion: 'windows-server-2022', variantId: vmVariants.find(v => v.name.includes('Server 2022') && v.name.includes('Medium'))?.id },
        }],
      },
    },
  });

  await prisma.forecast.create({
    data: {
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      status: ApprovalStatus.REJECTED,
      lines: {
        create: [
          {
            productId: bareMetalHpc.id,
            flavorId: flavorRecords['XL'].id,
            azCode: 'ap-south-sin1',
            quantity: 1,
            resiliency: 'MULTI_AZ',
          },
          {
            productId: bareMetalHpc.id,
            flavorId: flavorRecords['XL'].id,
            azCode: 'ap-south-hk1',
            quantity: 1,
            resiliency: 'MULTI_AZ',
          },
        ],
      },
      justification: 'HPC nodes for ML training',
      reviewedBy: 'System Administrator',
      reviewedAt: new Date(),
      rejectionReason: 'Budget constraints for Q3. Please resubmit in Q4.',
      applicationId: appAnalytics.id,
      environment: 'STG',
    },
  });

  // Create Sample Instances (using variantId instead of lifecycleId)
  const vmSmallVariant = vmVariants.find((v) => v.name.includes('12 (Bookworm)') && v.name.includes('Small'));
  const vmMediumVariant = vmVariants.find((v) => v.name.includes('Server 2022') && v.name.includes('Medium'));
  const vmLargeVariant = vmVariants.find((v) => v.name.includes('9') && v.name.includes('Large') && !v.name.includes('8'));
  const hpcXlVariant = hpcVariants.find((v) => v.name.includes('9') && v.name.includes('XL') && !v.name.includes('8'));

  if (vmSmallVariant) {
    await prisma.instance.create({
      data: {
        name: 'ecom-web-01',
        description: 'E-commerce web frontend',
        applicationId: appEcommerce.id,
        productId: vmProduct.id,
        variantId: vmSmallVariant.id,
        flavorId: vmSmallVariant.flavorId,
        azCode: 'ap-south-sin1',
        status: InstanceStatus.RUNNING,
        environment: 'PRD',
        ipAddress: '10.0.1.10',
        hostname: 'ecom-web-01.sin1.cloudmarket.local',
        startedAt: new Date('2024-01-15'),
        metadata: { osVersion: 'debian-12' },
      },
    });
  }

  if (vmMediumVariant) {
    await prisma.instance.create({
      data: {
        name: 'ecom-api-01',
        description: 'E-commerce API server',
        applicationId: appEcommerce.id,
        productId: vmProduct.id,
        variantId: vmMediumVariant.id,
        flavorId: vmMediumVariant.flavorId,
        azCode: 'eu-west-par1',
        status: InstanceStatus.RUNNING,
        environment: 'PRD',
        ipAddress: '10.0.2.20',
        hostname: 'ecom-api-01.par1.cloudmarket.local',
        startedAt: new Date('2024-02-01'),
        metadata: { osVersion: 'windows-server-2022' },
      },
    });
  }

  if (vmLargeVariant) {
    await prisma.instance.create({
      data: {
        name: 'analytics-worker-01',
        description: 'Analytics batch worker',
        applicationId: appAnalytics.id,
        productId: vmProduct.id,
        variantId: vmLargeVariant.id,
        flavorId: vmLargeVariant.flavorId,
        azCode: 'us-east-nyc1',
        status: InstanceStatus.STOPPED,
        environment: 'STG',
        ipAddress: '10.0.3.30',
        hostname: 'analytics-worker-01.nyc1.cloudmarket.local',
        startedAt: new Date('2024-03-10'),
        stoppedAt: new Date('2024-06-01'),
        metadata: { osVersion: 'rhel-9' },
      },
    });
  }

  if (hpcXlVariant) {
    await prisma.instance.create({
      data: {
        name: 'dev-build-01',
        description: 'CI/CD build agent',
        applicationId: appDevTools.id,
        productId: bareMetalHpc.id,
        variantId: hpcXlVariant.id,
        flavorId: hpcXlVariant.flavorId,
        azCode: 'eu-west-lon1',
        status: InstanceStatus.PROVISIONING,
        environment: 'DEV',
        ipAddress: '10.0.4.40',
        hostname: 'dev-build-01.lon1.cloudmarket.local',
      },
    });
  }

  if (vmSmallVariant) {
    await prisma.instance.create({
      data: {
        name: 'ecom-cache-01',
        description: 'Redis cache node',
        applicationId: appEcommerce.id,
        productId: vmProduct.id,
        variantId: vmSmallVariant.id,
        flavorId: vmSmallVariant.flavorId,
        azCode: 'ap-south-hk1',
        status: InstanceStatus.PENDING,
        environment: 'PRD',
        metadata: { osVersion: 'debian-12' },
      },
    });
  }

  if (vmMediumVariant) {
    await prisma.instance.create({
      data: {
        name: 'analytics-db-01',
        description: 'Analytics database server',
        applicationId: appAnalytics.id,
        productId: vmProduct.id,
        variantId: vmMediumVariant.id,
        flavorId: vmMediumVariant.flavorId,
        azCode: 'ap-south-sin1',
        status: InstanceStatus.TERMINATED,
        environment: 'DEV',
        ipAddress: '10.0.5.50',
        hostname: 'analytics-db-01.sin1.cloudmarket.local',
        startedAt: new Date('2024-01-01'),
        stoppedAt: new Date('2024-04-01'),
        terminatedAt: new Date('2024-05-01'),
        metadata: { osVersion: 'windows-server-2022' },
      },
    });
  }

  // Create Sample Health Checks
  const allInstances = await prisma.instance.findMany();
  for (const instance of allInstances) {
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

  // Create Sample Maintenance Windows
  const now = new Date();
  await prisma.maintenanceWindow.create({
    data: {
      instanceId: allInstances.find(i => i.name === 'ecom-web-01')?.id,
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
      instanceId: allInstances.find(i => i.name === 'analytics-worker-01')?.id,
      title: 'Analytics Worker – Disk Expansion',
      description: 'Expand local storage from 500GB to 1TB',
      startTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      status: MaintenanceStatus.COMPLETED,
    },
  });
  await prisma.maintenanceWindow.create({
    data: {
      title: 'Network Maintenance – Singapore AZ',
      description: 'Core router firmware upgrade in Singapore datacenter',
      startTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      endTime: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000),
      status: MaintenanceStatus.SCHEDULED,
    },
  });

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
