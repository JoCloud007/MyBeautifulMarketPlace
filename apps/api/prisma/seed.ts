import { PrismaClient, DependencyType, ApprovalStatus, LifecyclePhase, InstanceStatus, HealthStatus, MaintenanceStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (ignore if tables don't exist yet on first run)
  try {
    await prisma.forecast.deleteMany();
    await prisma.healthCheck.deleteMany();
    await prisma.maintenanceWindow.deleteMany();
    await prisma.instance.deleteMany();
    await prisma.dependency.deleteMany();
    await prisma.flavor.deleteMany();
    await prisma.productOption.deleteMany();
    await prisma.productLifecycle.deleteMany();
    await prisma.upgradePath.deleteMany();
    await prisma.productAvailabilityZone.deleteMany();
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

  // Create Products — unified Virtual Machine product with OS as options
  const vmProduct = await prisma.product.create({
    data: {
      name: 'Virtual Machine',
      slug: 'virtual-machine',
      description: 'Configurable virtual machine with selectable OS, vCPU, and memory options.',
      categoryId: compute.id,
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
      os: null,
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
      os: null,
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

  // Create Flavors for each product
  const flavors = [
    { name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry-level configuration for development and testing' },
    { name: 'Medium', vcpu: 4, ramGb: 8, description: 'Balanced configuration for production workloads' },
    { name: 'Large', vcpu: 8, ramGb: 16, description: 'High-performance configuration for demanding applications' },
    { name: 'XL', vcpu: 16, ramGb: 32, description: 'Maximum performance for enterprise workloads' },
  ];

  const products = [vmProduct, bareMetalHpc, vmware, citrixVdi];
  for (const product of products) {
    for (const flavor of flavors) {
      await prisma.flavor.create({
        data: { ...flavor, productId: product.id },
      });
    }
  }

  // Object Storage and NAS have their own flavor profiles
  const storageFlavors = [
    { name: 'Small', vcpu: 0, ramGb: 0, description: '1TB storage, 1000 IOPS' },
    { name: 'Medium', vcpu: 0, ramGb: 0, description: '5TB storage, 5000 IOPS' },
    { name: 'Large', vcpu: 0, ramGb: 0, description: '20TB storage, 20000 IOPS' },
    { name: 'XL', vcpu: 0, ramGb: 0, description: '100TB storage, 100000 IOPS' },
  ];

  for (const product of [objectStorage, nas]) {
    for (const flavor of storageFlavors) {
      await prisma.flavor.create({
        data: { ...flavor, productId: product.id },
      });
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

  // Create Product Options (VM as product, OS as option)
  await prisma.productOption.create({
    data: { productId: vmProduct.id, type: 'OS_VERSION', value: 'debian-12', label: 'Debian 12 (Bookworm)', isDefault: true },
  });
  await prisma.productOption.create({
    data: { productId: vmProduct.id, type: 'OS_VERSION', value: 'debian-11', label: 'Debian 11 (Bullseye)', isDefault: false },
  });
  await prisma.productOption.create({
    data: { productId: vmProduct.id, type: 'OS_VERSION', value: 'windows-server-2022', label: 'Windows Server 2022', isDefault: false },
  });
  await prisma.productOption.create({
    data: { productId: vmProduct.id, type: 'OS_VERSION', value: 'windows-server-2019', label: 'Windows Server 2019', isDefault: false },
  });
  await prisma.productOption.create({
    data: { productId: vmProduct.id, type: 'OS_VERSION', value: 'rhel-9', label: 'RHEL 9', isDefault: false },
  });
  await prisma.productOption.create({
    data: { productId: vmProduct.id, type: 'OS_VERSION', value: 'rhel-8', label: 'RHEL 8', isDefault: false },
  });

  // Create Product Lifecycles
  const debian12Lifecycle = await prisma.productLifecycle.create({
    data: {
      productId: vmProduct.id,
      version: '12.0',
      releaseDate: new Date('2023-06-10'),
      normalSupportEnd: new Date('2026-06-10'),
      extendedSupportEnd: new Date('2028-06-10'),
      eolDate: new Date('2030-06-10'),
      phase: LifecyclePhase.RELEASED,
      osFamily: 'LINUX',
      osName: 'Debian 12 (Bookworm)',
    },
  });
  const debian11Lifecycle = await prisma.productLifecycle.create({
    data: {
      productId: vmProduct.id,
      version: '11.0',
      releaseDate: new Date('2021-08-14'),
      normalSupportEnd: new Date('2024-08-14'),
      extendedSupportEnd: new Date('2026-08-14'),
      eolDate: new Date('2028-08-14'),
      phase: LifecyclePhase.NORMAL_SUPPORT,
      osFamily: 'LINUX',
      osName: 'Debian 11 (Bullseye)',
    },
  });
  const windows2022Lifecycle = await prisma.productLifecycle.create({
    data: {
      productId: vmProduct.id,
      version: '2022',
      releaseDate: new Date('2021-08-18'),
      normalSupportEnd: new Date('2026-10-13'),
      extendedSupportEnd: new Date('2031-10-14'),
      eolDate: new Date('2033-10-14'),
      phase: LifecyclePhase.RELEASED,
      osFamily: 'WINDOWS',
      osName: 'Windows Server 2022',
    },
  });
  const rhel9Lifecycle = await prisma.productLifecycle.create({
    data: {
      productId: vmProduct.id,
      version: '9.0',
      releaseDate: new Date('2022-05-18'),
      normalSupportEnd: new Date('2027-05-31'),
      extendedSupportEnd: new Date('2031-05-31'),
      eolDate: new Date('2033-05-31'),
      phase: LifecyclePhase.RELEASED,
      osFamily: 'LINUX',
      osName: 'RHEL 9',
    },
  });
  const vmware8Lifecycle = await prisma.productLifecycle.create({
    data: {
      productId: vmware.id,
      version: '8.0',
      releaseDate: new Date('2022-10-11'),
      normalSupportEnd: new Date('2027-10-11'),
      extendedSupportEnd: new Date('2030-10-11'),
      eolDate: new Date('2032-10-11'),
      phase: LifecyclePhase.RELEASED,
      osFamily: 'HYPERVISOR',
      osName: 'VMware vSphere 8.0',
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

  // Create ProductAvailabilityZones (all products in all zones)
  for (const product of [vmProduct, bareMetalHpc, objectStorage, nas, vmware, citrixVdi]) {
    for (const zone of [parisAz1, parisAz2, london, newYork, singapore, hongKong]) {
      await prisma.productAvailabilityZone.upsert({
        where: { productId_availabilityZoneId: { productId: product.id, availabilityZoneId: zone.id } },
        update: {},
        create: { productId: product.id, availabilityZoneId: zone.id },
      });
    }
  }

  // Create Sample Forecasts
  const allFlavors = await prisma.flavor.findMany();
  const vmFlavors = allFlavors.filter(f => f.productId === vmProduct.id);

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
          flavorId: vmFlavors[1].id,
          azCode: 'ap-south-sin1',
          quantity: 5,
          resiliency: 'STANDARD',
          metadata: { osVersion: 'debian-12' },
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
          flavorId: allFlavors.find(f => f.productId === vmProduct.id && f.name === 'Medium')!.id,
          azCode: 'ap-south-sin1',
          quantity: 3,
          resiliency: 'HA',
          metadata: { osVersion: 'windows-server-2022' },
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
            flavorId: allFlavors.find(f => f.productId === bareMetalHpc.id && f.name === 'XL')!.id,
            azCode: 'ap-south-sin1',
            quantity: 1,
            resiliency: 'MULTI_AZ',
          },
          {
            productId: bareMetalHpc.id,
            flavorId: allFlavors.find(f => f.productId === bareMetalHpc.id && f.name === 'XL')!.id,
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

  // Create Sample Instances
  const instanceFlavors = await prisma.flavor.findMany();
  const vmSmallFlavor = instanceFlavors.find(f => f.productId === vmProduct.id && f.name === 'Small');
  const vmMediumFlavor = instanceFlavors.find(f => f.productId === vmProduct.id && f.name === 'Medium');
  const vmLargeFlavor = instanceFlavors.find(f => f.productId === vmProduct.id && f.name === 'Large');
  const hpcFlavor = instanceFlavors.find(f => f.productId === bareMetalHpc.id && f.name === 'XL');

  if (vmSmallFlavor) {
    await prisma.instance.create({
      data: {
        name: 'ecom-web-01',
        description: 'E-commerce web frontend',
        applicationId: appEcommerce.id,
        productId: vmProduct.id,
        flavorId: vmSmallFlavor.id,
        lifecycleId: debian12Lifecycle.id,
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

  if (vmMediumFlavor) {
    await prisma.instance.create({
      data: {
        name: 'ecom-api-01',
        description: 'E-commerce API server',
        applicationId: appEcommerce.id,
        productId: vmProduct.id,
        flavorId: vmMediumFlavor.id,
        lifecycleId: windows2022Lifecycle.id,
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

  if (vmLargeFlavor) {
    await prisma.instance.create({
      data: {
        name: 'analytics-worker-01',
        description: 'Analytics batch worker',
        applicationId: appAnalytics.id,
        productId: vmProduct.id,
        flavorId: vmLargeFlavor.id,
        lifecycleId: rhel9Lifecycle.id,
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

  if (hpcFlavor) {
    await prisma.instance.create({
      data: {
        name: 'dev-build-01',
        description: 'CI/CD build agent',
        applicationId: appDevTools.id,
        productId: bareMetalHpc.id,
        flavorId: hpcFlavor.id,
        azCode: 'eu-west-lon1',
        status: InstanceStatus.PROVISIONING,
        environment: 'DEV',
        ipAddress: '10.0.4.40',
        hostname: 'dev-build-01.lon1.cloudmarket.local',
      },
    });
  }

  if (vmSmallFlavor) {
    await prisma.instance.create({
      data: {
        name: 'ecom-cache-01',
        description: 'Redis cache node',
        applicationId: appEcommerce.id,
        productId: vmProduct.id,
        flavorId: vmSmallFlavor.id,
        lifecycleId: debian12Lifecycle.id,
        azCode: 'ap-south-hk1',
        status: InstanceStatus.PENDING,
        environment: 'PRD',
        metadata: { osVersion: 'debian-12' },
      },
    });
  }

  if (vmMediumFlavor) {
    await prisma.instance.create({
      data: {
        name: 'analytics-db-01',
        description: 'Analytics database server',
        applicationId: appAnalytics.id,
        productId: vmProduct.id,
        flavorId: vmMediumFlavor.id,
        lifecycleId: windows2022Lifecycle.id,
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
