import { PrismaClient, DependencyType, ApprovalStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean existing data (ignore if tables don't exist yet on first run)
  try {
    await prisma.forecast.deleteMany();
    await prisma.dependency.deleteMany();
    await prisma.flavor.deleteMany();
    await prisma.productAvailabilityZone.deleteMany();
    await prisma.product.deleteMany();
    await prisma.availabilityZone.deleteMany();
    await prisma.category.deleteMany();
    await prisma.user.deleteMany();
  } catch (e: any) {
    if (e.code === 'P2021') {
      console.log('  Tables do not exist yet — make sure to run "npx prisma db push" first');
      throw e;
    }
    throw e;
  }

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

  // Create Products
  const vmDebian = await prisma.product.create({
    data: {
      name: 'VM Debian 12',
      slug: 'vm-debian-12',
      description: 'Virtual machine running Debian 12 (Bookworm) with latest security patches and cloud-init support.',
      categoryId: compute.id,
      os: 'Linux',
      documentation: '# VM Debian 12\n\n## Overview\nPre-configured Debian 12 virtual machine optimized for cloud workloads.\n\n## Specifications\n- OS: Debian 12 (Bookworm)\n- Kernel: 6.1 LTS\n- Cloud-init enabled\n- QEMU Guest Agent pre-installed',
      roadmap: '## Roadmap\n- Q3 2024: Debian 12.2 update\n- Q4 2024: ARM64 support\n- Q1 2025: Debian 13 preview',
    },
  });

  const vmWindows = await prisma.product.create({
    data: {
      name: 'VM Windows Server 2022',
      slug: 'vm-windows-server-2022',
      description: 'Windows Server 2022 Datacenter edition with RDS support and Active Directory integration.',
      categoryId: compute.id,
      os: 'Windows',
      documentation: '# VM Windows Server 2022\n\n## Overview\nEnterprise-grade Windows Server 2022 virtual machine.\n\n## Specifications\n- Edition: Datacenter\n- License: Included\n- RDS: 50 CALs included',
      roadmap: '## Roadmap\n- Q3 2024: Windows Server 2025 preview\n- Q4 2024: Enhanced Azure AD integration',
    },
  });

  const vmRedHat = await prisma.product.create({
    data: {
      name: 'VM RedHat Enterprise Linux 9',
      slug: 'vm-rhel-9',
      description: 'RHEL 9 with Satellite integration and comprehensive support subscription.',
      categoryId: compute.id,
      os: 'Linux',
      documentation: '# VM RHEL 9\n\n## Overview\nRed Hat Enterprise Linux 9 for mission-critical workloads.\n\n## Specifications\n- OS: RHEL 9.3\n- Kernel: 5.14\n- Subscription: Included',
      roadmap: '## Roadmap\n- Q3 2024: RHEL 9.4 update\n- Q4 2024: Real-time kernel option',
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

  // Create Availability Zones
  const azParis1 = await prisma.availabilityZone.create({
    data: { code: 'eu-west-par1', name: 'Paris AZ1', city: 'Paris', country: 'France', region: 'Europe', latitude: 48.8566, longitude: 2.3522, isActive: true },
  });
  const azParis2 = await prisma.availabilityZone.create({
    data: { code: 'eu-west-par2', name: 'Paris AZ2', city: 'Paris', country: 'France', region: 'Europe', latitude: 48.8566, longitude: 2.3522 + 0.02, isActive: true },
  });
  const azLondon = await prisma.availabilityZone.create({
    data: { code: 'eu-west-lon1', name: 'London', city: 'London', country: 'United Kingdom', region: 'Europe', latitude: 51.5074, longitude: -0.1278, isActive: true },
  });
  const azNewYork = await prisma.availabilityZone.create({
    data: { code: 'us-east-nyc1', name: 'New York', city: 'New York', country: 'United States', region: 'North America', latitude: 40.7128, longitude: -74.006, isActive: true },
  });
  const azSingapore = await prisma.availabilityZone.create({
    data: { code: 'ap-south-sin1', name: 'Singapore', city: 'Singapore', country: 'Singapore', region: 'Asia-Pacific', latitude: 1.3521, longitude: 103.8198, isActive: true },
  });
  const azHongKong = await prisma.availabilityZone.create({
    data: { code: 'ap-east-hkg1', name: 'Hong Kong', city: 'Hong Kong', country: 'China', region: 'Asia-Pacific', latitude: 22.3193, longitude: 114.1694, isActive: true },
  });

  // Link products to availability zones (region logic: all products available in Europe and North America; compute and storage also in Asia-Pacific)
  const europeAzs = [azParis1, azParis2, azLondon];
  const northAmericaAzs = [azNewYork];
  const asiaPacificAzs = [azSingapore, azHongKong];

  const computeProducts = [vmDebian, vmWindows, vmRedHat, bareMetalHpc];
  const storageProducts = [objectStorage, nas];
  const otherProducts = [vmware, citrixVdi];
  const allProducts = [...computeProducts, ...storageProducts, ...otherProducts];

  // All products in Europe and North America
  for (const product of allProducts) {
    for (const az of europeAzs) {
      await prisma.productAvailabilityZone.create({
        data: { productId: product.id, availabilityZoneId: az.id },
      });
    }
    for (const az of northAmericaAzs) {
      await prisma.productAvailabilityZone.create({
        data: { productId: product.id, availabilityZoneId: az.id },
      });
    }
  }

  // Compute and storage also in Asia-Pacific
  for (const product of [...computeProducts, ...storageProducts]) {
    for (const az of asiaPacificAzs) {
      await prisma.productAvailabilityZone.create({
        data: { productId: product.id, availabilityZoneId: az.id },
      });
    }
  }

  // Create Flavors for each product
  const flavors = [
    { name: 'Small', vcpu: 2, ramGb: 4, description: 'Entry-level configuration for development and testing' },
    { name: 'Medium', vcpu: 4, ramGb: 8, description: 'Balanced configuration for production workloads' },
    { name: 'Large', vcpu: 8, ramGb: 16, description: 'High-performance configuration for demanding applications' },
    { name: 'XL', vcpu: 16, ramGb: 32, description: 'Maximum performance for enterprise workloads' },
  ];

  const products = [vmDebian, vmWindows, vmRedHat, bareMetalHpc, vmware, citrixVdi];
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
      productId: vmDebian.id,
      dependsOnId: objectStorage.id,
      type: DependencyType.RECOMMENDED,
      description: 'Recommended for backup and archive storage',
    },
  });

  await prisma.dependency.create({
    data: {
      productId: vmWindows.id,
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

  // Create Users
  await prisma.user.create({
    data: { email: 'admin@cloudmarket.local', name: 'System Administrator', role: 'ADMIN' },
  });
  await prisma.user.create({
    data: { email: 'user@cloudmarket.local', name: 'Demo User', role: 'USER' },
  });

  // Create Sample Forecasts
  const allFlavors = await prisma.flavor.findMany();
  const vmDebianFlavors = allFlavors.filter(f => f.productId === vmDebian.id);

  await prisma.forecast.create({
    data: {
      productId: vmDebian.id,
      flavorId: vmDebianFlavors[1].id,
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      quantity: 5,
      status: ApprovalStatus.PENDING,
      justification: 'Need VMs for development team expansion',
    },
  });

  await prisma.forecast.create({
    data: {
      productId: vmWindows.id,
      flavorId: allFlavors.find(f => f.productId === vmWindows.id && f.name === 'Medium')!.id,
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      quantity: 3,
      status: ApprovalStatus.APPROVED,
      justification: 'Windows servers for finance department',
      reviewedBy: 'System Administrator',
      reviewedAt: new Date(),
    },
  });

  await prisma.forecast.create({
    data: {
      productId: bareMetalHpc.id,
      flavorId: allFlavors.find(f => f.productId === bareMetalHpc.id && f.name === 'XL')!.id,
      requestedBy: 'Demo User',
      requesterEmail: 'user@cloudmarket.local',
      quantity: 2,
      status: ApprovalStatus.REJECTED,
      justification: 'HPC nodes for ML training',
      reviewedBy: 'System Administrator',
      reviewedAt: new Date(),
      rejectionReason: 'Budget constraints for Q3. Please resubmit in Q4.',
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
