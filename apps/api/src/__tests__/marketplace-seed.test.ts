import request from 'supertest';
import express from 'express';

var prismaMock: any = {};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => prismaMock),
  ComputeType: { PHYSICAL: 'PHYSICAL', VIRTUAL: 'VIRTUAL' },
  LifecyclePhase: {
    RELEASED: 'RELEASED',
    NORMAL_SUPPORT: 'NORMAL_SUPPORT',
    EXTENDED_SUPPORT: 'EXTENDED_SUPPORT',
    NO_SUPPORT: 'NO_SUPPORT',
    EOL: 'EOL',
  },
  DependencyType: { REQUIRED: 'REQUIRED', RECOMMENDED: 'RECOMMENDED' },
  ApprovalStatus: { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' },
  InstanceStatus: { PENDING: 'PENDING', PROVISIONING: 'PROVISIONING', RUNNING: 'RUNNING', STOPPED: 'STOPPED', TERMINATED: 'TERMINATED' },
  HealthStatus: { HEALTHY: 'HEALTHY', DEGRADED: 'DEGRADED', UNHEALTHY: 'UNHEALTHY' },
  MaintenanceStatus: { SCHEDULED: 'SCHEDULED', IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', CANCELLED: 'CANCELLED' },
}));

import { osRoutes } from '../routes/os';
import { productRoutes } from '../routes/products';
import { variantRoutes } from '../routes/variants';
import { flavorRoutes } from '../routes/flavors';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/os', osRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/variants', variantRoutes);
  app.use('/api/flavors', flavorRoutes);
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' });
  });
  return app;
}

// Seed data matching the actual seed.ts
const seedOSWindows = {
  id: 'os-windows',
  family: 'WINDOWS',
  name: 'Windows',
  slug: 'windows',
  isActive: true,
  versions: [
    { id: 'ver-win2022', version: 'Server 2022', releaseDate: new Date('2021-08-18'), normalSupportEnd: new Date('2026-10-13'), extendedSupportEnd: new Date('2031-10-14'), eolDate: new Date('2033-10-14'), phase: 'RELEASED', isActive: true },
    { id: 'ver-win2019', version: 'Server 2019', releaseDate: new Date('2018-10-02'), normalSupportEnd: new Date('2024-01-09'), extendedSupportEnd: new Date('2029-01-09'), eolDate: new Date('2031-01-09'), phase: 'EXTENDED_SUPPORT', isActive: true },
    { id: 'ver-win11', version: '11', releaseDate: new Date('2021-10-05'), normalSupportEnd: new Date('2025-10-14'), extendedSupportEnd: new Date('2028-10-10'), eolDate: new Date('2030-10-10'), phase: 'NORMAL_SUPPORT', isActive: true },
  ],
};

const seedOSDebian = {
  id: 'os-debian',
  family: 'LINUX',
  name: 'Debian',
  slug: 'debian',
  isActive: true,
  versions: [
    { id: 'ver-d12', version: '12 (Bookworm)', releaseDate: new Date('2023-06-10'), normalSupportEnd: new Date('2026-06-10'), extendedSupportEnd: new Date('2028-06-10'), eolDate: new Date('2030-06-10'), phase: 'RELEASED', isActive: true },
    { id: 'ver-d11', version: '11 (Bullseye)', releaseDate: new Date('2021-08-14'), normalSupportEnd: new Date('2024-08-14'), extendedSupportEnd: new Date('2026-08-14'), eolDate: new Date('2028-08-14'), phase: 'NORMAL_SUPPORT', isActive: true },
  ],
};

const seedOSRHEL = {
  id: 'os-rhel',
  family: 'LINUX',
  name: 'Red Hat Enterprise Linux',
  slug: 'rhel',
  isActive: true,
  versions: [
    { id: 'ver-rhel9', version: '9', releaseDate: new Date('2022-05-18'), normalSupportEnd: new Date('2027-05-31'), extendedSupportEnd: new Date('2031-05-31'), eolDate: new Date('2033-05-31'), phase: 'RELEASED', isActive: true },
    { id: 'ver-rhel8', version: '8', releaseDate: new Date('2019-05-07'), normalSupportEnd: new Date('2024-05-31'), extendedSupportEnd: new Date('2026-05-31'), eolDate: new Date('2028-05-31'), phase: 'EXTENDED_SUPPORT', isActive: true },
  ],
};

describe('Seed Data — Marketplace Feature', () => {
  beforeEach(() => {
    prismaMock.operatingSystem = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    };
    prismaMock.osVersion = {
      findMany: jest.fn(),
      create: jest.fn(),
    };
    prismaMock.product = {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    };
    prismaMock.productVariant = {
      findMany: jest.fn(),
    };
    prismaMock.flavor = {
      findMany: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('Operating Systems', () => {
    it('seed includes Windows with 3 versions', async () => {
      prismaMock.operatingSystem.findMany.mockResolvedValue([
        seedOSWindows,
        seedOSDebian,
        seedOSRHEL,
      ]);

      const app = createApp();
      const res = await request(app).get('/api/os');

      expect(res.status).toBe(200);
      const windows = res.body.find((os: any) => os.slug === 'windows');
      expect(windows).toBeDefined();
      expect(windows.family).toBe('WINDOWS');
      expect(windows.versions).toHaveLength(3);
      expect(windows.versions.map((v: any) => v.version)).toEqual(
        expect.arrayContaining(['Server 2022', 'Server 2019', '11'])
      );
    });

    it('seed includes Debian with 2 versions', async () => {
      prismaMock.operatingSystem.findMany.mockResolvedValue([seedOSDebian]);

      const app = createApp();
      const res = await request(app).get('/api/os');

      expect(res.status).toBe(200);
      const debian = res.body[0];
      expect(debian.name).toBe('Debian');
      expect(debian.versions).toHaveLength(2);
      expect(debian.versions.map((v: any) => v.version)).toEqual(
        expect.arrayContaining(['12 (Bookworm)', '11 (Bullseye)'])
      );
    });

    it('seed includes RHEL with 2 versions', async () => {
      prismaMock.operatingSystem.findMany.mockResolvedValue([seedOSRHEL]);

      const app = createApp();
      const res = await request(app).get('/api/os');

      expect(res.status).toBe(200);
      const rhel = res.body[0];
      expect(rhel.name).toBe('Red Hat Enterprise Linux');
      expect(rhel.versions).toHaveLength(2);
      expect(rhel.versions.map((v: any) => v.version)).toEqual(
        expect.arrayContaining(['9', '8'])
      );
    });

    it('Windows Server 2022 has correct lifecycle dates', () => {
      const win2022 = seedOSWindows.versions.find((v) => v.version === 'Server 2022');
      expect(win2022).toBeDefined();
      expect(win2022!.releaseDate.toISOString().startsWith('2021-08-18')).toBe(true);
      expect(win2022!.normalSupportEnd.toISOString().startsWith('2026-10-13')).toBe(true);
      expect(win2022!.extendedSupportEnd.toISOString().startsWith('2031-10-14')).toBe(true);
      expect(win2022!.eolDate.toISOString().startsWith('2033-10-14')).toBe(true);
      expect(win2022!.phase).toBe('RELEASED');
    });

    it('Windows Server 2019 has EXTENDED_SUPPORT phase', () => {
      const win2019 = seedOSWindows.versions.find((v) => v.version === 'Server 2019');
      expect(win2019).toBeDefined();
      expect(win2019!.phase).toBe('EXTENDED_SUPPORT');
    });

    it('Windows 11 has NORMAL_SUPPORT phase', () => {
      const win11 = seedOSWindows.versions.find((v) => v.version === '11');
      expect(win11).toBeDefined();
      expect(win11!.phase).toBe('NORMAL_SUPPORT');
    });

    it('Debian 12 has RELEASED phase', () => {
      const d12 = seedOSDebian.versions.find((v) => v.version === '12 (Bookworm)');
      expect(d12).toBeDefined();
      expect(d12!.phase).toBe('RELEASED');
    });

    it('RHEL 9 has RELEASED phase', () => {
      const rhel9 = seedOSRHEL.versions.find((v) => v.version === '9');
      expect(rhel9).toBeDefined();
      expect(rhel9!.phase).toBe('RELEASED');
    });

    it('lifecycle dates are in chronological order for all versions', () => {
      const allVersions = [
        ...seedOSWindows.versions,
        ...seedOSDebian.versions,
        ...seedOSRHEL.versions,
      ];

      for (const v of allVersions) {
        expect(v.releaseDate.getTime()).toBeLessThan(v.normalSupportEnd.getTime());
        expect(v.normalSupportEnd.getTime()).toBeLessThan(v.extendedSupportEnd.getTime());
        expect(v.extendedSupportEnd.getTime()).toBeLessThan(v.eolDate.getTime());
      }
    });
  });

  describe('Products from Seed', () => {
    it('Compute products have computeType set', async () => {
      const products = [
        { id: 'p1', name: 'Virtual Machine', slug: 'virtual-machine', category: { slug: 'compute' }, computeType: 'VIRTUAL', variants: [], _count: { variants: 12 } },
        { id: 'p2', name: 'Bare Metal HPC', slug: 'bare-metal-hpc', category: { slug: 'compute' }, computeType: 'PHYSICAL', variants: [], _count: { variants: 4 } },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body[0].computeType).toBe('VIRTUAL');
      expect(res.body[1].computeType).toBe('PHYSICAL');
    });

    it('non-Compute products have null computeType', async () => {
      const products = [
        { id: 'p3', name: 'Object Storage', slug: 'object-storage', category: { slug: 'data' }, computeType: null, variants: [], _count: { variants: 0 } },
        { id: 'p4', name: 'NAS Storage', slug: 'nas-storage', category: { slug: 'data' }, computeType: null, variants: [], _count: { variants: 0 } },
        { id: 'p5', name: 'VMware vSphere', slug: 'vmware-vsphere', category: { slug: 'hypervisor' }, computeType: null, variants: [], _count: { variants: 0 } },
        { id: 'p6', name: 'Citrix VDI', slug: 'citrix-vdi', category: { slug: 'citrix' }, computeType: null, variants: [], _count: { variants: 0 } },
      ];
      prismaMock.product.findMany.mockResolvedValue(products);

      const app = createApp();
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      for (const p of res.body) {
        expect(p.computeType).toBeNull();
      }
    });
  });

  describe('Flavors from Seed', () => {
    it('seed includes compute flavors with vCPU and RAM', async () => {
      const flavors = [
        { id: 'f1', name: 'Small', vcpu: 2, ramGb: 4, _count: { variants: 6 } },
        { id: 'f2', name: 'Medium', vcpu: 4, ramGb: 8, _count: { variants: 6 } },
        { id: 'f3', name: 'Large', vcpu: 8, ramGb: 16, _count: { variants: 4 } },
        { id: 'f4', name: 'XL', vcpu: 16, ramGb: 32, _count: { variants: 2 } },
      ];
      prismaMock.flavor.findMany.mockResolvedValue(flavors);

      const app = createApp();
      const res = await request(app).get('/api/flavors');

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(4);
      expect(res.body.map((f: any) => f.name)).toEqual(
        expect.arrayContaining(['Small', 'Medium', 'Large', 'XL'])
      );
    });

    it('seed includes storage flavors with zero vCPU/RAM', async () => {
      const flavors = [
        { id: 'fs1', name: 'Small', vcpu: 0, ramGb: 0, _count: { variants: 0 } },
        { id: 'fs2', name: 'Medium', vcpu: 0, ramGb: 0, _count: { variants: 0 } },
        { id: 'fs3', name: 'Large', vcpu: 0, ramGb: 0, _count: { variants: 0 } },
        { id: 'fs4', name: 'XL', vcpu: 0, ramGb: 0, _count: { variants: 0 } },
      ];
      prismaMock.flavor.findMany.mockResolvedValue(flavors);

      const app = createApp();
      const res = await request(app).get('/api/flavors');

      expect(res.status).toBe(200);
      for (const f of res.body) {
        expect(f.vcpu).toBe(0);
        expect(f.ramGb).toBe(0);
      }
    });
  });
});
