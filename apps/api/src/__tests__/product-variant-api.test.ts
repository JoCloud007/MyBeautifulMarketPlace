import { readFileSync } from 'fs';
import { resolve } from 'path';

const API_URL = process.env.API_URL || 'http://localhost:3001';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function api(method: string, path: string, body?: any) {
  const url = `${API_URL}${path}`;
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  const res = await fetch(url, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data, headers: res.headers };
}

const get = (path: string) => api('GET', path);
const post = (path: string, body: any) => api('POST', path, body);
const patch = (path: string, body: any) => api('PATCH', path, body);
const put = (path: string, body: any) => api('PUT', path, body);
const del = (path: string) => api('DELETE', path);

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('Product Variant API', () => {
  const cleanup: { type: string; id: string }[] = [];

  afterAll(async () => {
    for (const item of [...cleanup].reverse()) {
      try {
        await del(`/api/${item.type}/${item.id}`);
      } catch {
        /* ignore cleanup errors */
      }
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1 — Schema assertions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Phase 1 — Schema', () => {
    const schema = readFileSync(resolve(__dirname, '../../prisma/schema.prisma'), 'utf-8');

    test('OperatingSystem model exists with required fields', () => {
      expect(schema).toContain('model OperatingSystem');
      expect(schema).toContain('family    String');
      expect(schema).toContain('name      String');
      expect(schema).toContain('slug      String          @unique');
      expect(schema).toContain('versions  OsVersion[]');
    });

    test('OsVersion model exists with lifecycle dates', () => {
      expect(schema).toContain('model OsVersion');
      expect(schema).toContain('releaseDate        DateTime');
      expect(schema).toContain('normalSupportEnd   DateTime');
      expect(schema).toContain('extendedSupportEnd DateTime');
      expect(schema).toContain('eolDate            DateTime');
      expect(schema).toContain('phase              LifecyclePhase');
    });

    test('Product has computeType and variants relation', () => {
      expect(schema).toContain('computeType       ComputeType?');
      expect(schema).toContain('variants          ProductVariant[]');
    });

    test('ProductVariant links OS, Version, Flavor, AZs, Zones', () => {
      expect(schema).toContain('model ProductVariant');
      expect(schema).toContain('osId              String');
      expect(schema).toContain('osVersionId       String');
      expect(schema).toContain('flavorId          String');
      expect(schema).toContain('availabilityZones ProductVariantAvailabilityZone[]');
      expect(schema).toContain('zones             ProductVariantZone[]');
    });

    test('Zone model exists with required fields', () => {
      expect(schema).toContain('model Zone');
      expect(schema).toContain('name                String');
      expect(schema).toContain('slug                String');
      expect(schema).toContain('isActive            Boolean');
      expect(schema).toContain('availabilityZones   ZoneAvailabilityZone[]');
      expect(schema).toContain('variants            ProductVariantZone[]');
    });

    test('ZoneAvailabilityZone join table exists', () => {
      expect(schema).toContain('model ZoneAvailabilityZone');
      expect(schema).toContain('@@id([zoneId, availabilityZoneId])');
    });

    test('ProductVariantZone join table exists', () => {
      expect(schema).toContain('model ProductVariantZone');
      expect(schema).toContain('@@id([variantId, zoneId])');
    });

    test('Flavor is global (no productId)', () => {
      expect(schema).toContain('model Flavor');
      const flavorSection = schema.slice(schema.indexOf('model Flavor'), schema.indexOf('model', schema.indexOf('model Flavor') + 1));
      expect(flavorSection).not.toMatch(/productId\s+String/);
    });

    test('ComputeType enum exists', () => {
      expect(schema).toContain('enum ComputeType');
      expect(schema).toContain('PHYSICAL');
      expect(schema).toContain('VIRTUAL');
    });

    test('Old models removed', () => {
      expect(schema).not.toContain('model ProductOption');
      expect(schema).not.toContain('model ProductLifecycle');
      expect(schema).not.toContain('model ProductAvailabilityZone');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 — OS CRUD & Versions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Phase 2 — OS CRUD & Versions', () => {
    let osId: string;
    let versionId: string;

    test('GET /api/os returns seeded OS families', async () => {
      const { status, data } = await get('/api/os');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      const families = data.map((o: any) => o.family);
      expect(families).toEqual(expect.arrayContaining(['WINDOWS', 'LINUX']));
      const windows = data.find((o: any) => o.slug === 'windows');
      expect(windows).toBeDefined();
      expect(windows.versions.length).toBeGreaterThanOrEqual(3);
    });

    test('POST /api/os creates an OS', async () => {
      const { status, data } = await post('/api/os', {
        family: 'LINUX',
        name: 'Ubuntu',
        slug: 'ubuntu',
        isActive: true,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      osId = data.id;
      cleanup.push({ type: 'os', id: osId });
    });

    test('POST /api/os rejects duplicate slug with 409', async () => {
      const { status, data } = await post('/api/os', {
        family: 'LINUX',
        name: 'Ubuntu Duplicate',
        slug: 'ubuntu',
      });
      expect(status).toBe(409);
      expect(data.error).toMatch(/already exists/i);
    });

    test('GET /api/os/:id returns OS with versions', async () => {
      const { status, data } = await get(`/api/os/${osId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(osId);
      expect(Array.isArray(data.versions)).toBe(true);
    });

    test('PUT /api/os/:id updates fields', async () => {
      const { status, data } = await put(`/api/os/${osId}`, { name: 'Ubuntu LTS' });
      expect(status).toBe(200);
      expect(data.name).toBe('Ubuntu LTS');
    });

    test('POST /api/os/:id/versions creates a version with lifecycle dates', async () => {
      const { status, data } = await post(`/api/os/${osId}/versions`, {
        version: '24.04',
        releaseDate: '2024-04-25T00:00:00.000Z',
        normalSupportEnd: '2029-04-25T00:00:00.000Z',
        extendedSupportEnd: '2031-04-25T00:00:00.000Z',
        eolDate: '2034-04-25T00:00:00.000Z',
        phase: 'RELEASED',
        isActive: true,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      versionId = data.id;
    });

    test('POST /api/os/:id/versions rejects out-of-order dates with 400', async () => {
      const { status, data } = await post(`/api/os/${osId}/versions`, {
        version: 'bad-dates',
        releaseDate: '2025-01-01T00:00:00.000Z',
        normalSupportEnd: '2024-01-01T00:00:00.000Z',
        extendedSupportEnd: '2026-01-01T00:00:00.000Z',
        eolDate: '2027-01-01T00:00:00.000Z',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('PUT /api/os/:id/versions/:versionId updates version', async () => {
      const { status, data } = await put(`/api/os/${osId}/versions/${versionId}`, { phase: 'NORMAL_SUPPORT' });
      expect(status).toBe(200);
      expect(data.phase).toBe('NORMAL_SUPPORT');
    });

    test('DELETE /api/os/:id/versions/:versionId removes version', async () => {
      const { status } = await del(`/api/os/${osId}/versions/${versionId}`);
      expect(status).toBe(204);
    });

    test('DELETE /api/os/:id removes OS without variants', async () => {
      const { status } = await del(`/api/os/${osId}`);
      expect(status).toBe(204);
      const idx = cleanup.findIndex((c) => c.id === osId);
      if (idx >= 0) cleanup.splice(idx, 1);
    });

    test('DELETE /api/os/:id rejects when variants exist', async () => {
      const { data: osList } = await get('/api/os');
      const windows = osList.find((o: any) => o.slug === 'windows');
      if (!windows) {
        console.warn('Skipping: windows OS not found');
        return;
      }
      const { status, data } = await del(`/api/os/${windows.id}`);
      expect(status).toBe(409);
      expect(data.error).toMatch(/Cannot delete OS with existing variants/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 (continued) — Product Refonte
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Phase 2 — Product Refonte', () => {
    let computeCatId: string;
    let dataCatId: string;
    let testProductId: string;

    beforeAll(async () => {
      const { data: cats } = await get('/api/categories');
      computeCatId = cats.find((c: any) => c.slug === 'compute')?.id;
      dataCatId = cats.find((c: any) => c.slug === 'data')?.id;
    });

    test('POST /api/products allows computeType for Compute category', async () => {
      const { status, data } = await post('/api/products', {
        name: 'Compute Test Product',
        slug: 'compute-test-product',
        categoryId: computeCatId,
        computeType: 'VIRTUAL',
      });
      expect(status).toBe(201);
      expect(data.computeType).toBe('VIRTUAL');
      testProductId = data.id;
      cleanup.push({ type: 'products', id: testProductId });
    });

    test('POST /api/products rejects computeType for non-Compute category', async () => {
      const { status, data } = await post('/api/products', {
        name: 'Data Test Product',
        slug: 'data-test-product',
        categoryId: dataCatId,
        computeType: 'VIRTUAL',
      });
      expect(status).toBe(400);
      expect(data.error).toMatch(/computeType can only be set for Compute category/i);
    });

    test('PATCH /api/products allows setting computeType on Compute product', async () => {
      const { status, data } = await patch(`/api/products/${testProductId}`, { computeType: 'PHYSICAL' });
      expect(status).toBe(200);
      expect(data.computeType).toBe('PHYSICAL');
    });

    test('PATCH /api/products rejects computeType on non-Compute product', async () => {
      const { data: products } = await get('/api/products?category=data');
      const storage = products[0];
      if (!storage) {
        console.warn('Skipping: no data product found');
        return;
      }
      const { status, data } = await patch(`/api/products/${storage.id}`, { computeType: 'VIRTUAL' });
      expect(status).toBe(400);
      expect(data.error).toMatch(/computeType can only be set for Compute category/i);
    });

    test('GET /api/products includes variants for Compute products', async () => {
      const { data: products } = await get('/api/products?category=compute');
      for (const p of products) {
        expect(Array.isArray(p.variants)).toBe(true);
      }
    });

    test('GET /api/products/:slug returns product with _count.variants', async () => {
      const { data } = await get('/api/products/virtual-machine');
      expect(typeof data._count.variants).toBe('number');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 (continued) — ProductVariant CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Phase 2 — ProductVariant CRUD', () => {
    let computeProductId: string;
    let nonComputeProductId: string;
    let osId: string;
    let osVersionId: string;
    let flavorId: string;
    let variantId: string;
    let azId: string;

    beforeAll(async () => {
      const { data: products } = await get('/api/products');
      computeProductId = products.find((p: any) => p.category.slug === 'compute')?.id;
      nonComputeProductId = products.find((p: any) => p.category.slug === 'data')?.id;

      const { data: osList } = await get('/api/os');
      osId = osList[0].id;
      osVersionId = osList[0].versions[0].id;

      const { data: flavors } = await get('/api/flavors');
      flavorId = flavors[0].id;

      const { data: azs } = await get('/api/availability-zones');
      azId = azs[0].id;
    });

    test('POST /api/products/:id/variants rejects for non-Compute product', async () => {
      const { status, data } = await post(`/api/products/${nonComputeProductId}/variants`, {
        name: 'Bad Variant',
        osId,
        osVersionId,
        flavorId,
      });
      expect(status).toBe(400);
      expect(data.error).toMatch(/Variants can only be created for Compute products/i);
    });

    test('POST /api/products/:id/variants creates a variant for Compute product', async () => {
      const { status, data } = await post(`/api/products/${computeProductId}/variants`, {
        name: 'Test Variant',
        osId,
        osVersionId,
        flavorId,
        availabilityZoneIds: [azId],
        isActive: true,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.productId).toBe(computeProductId);
      expect(data.os.id).toBe(osId);
      expect(data.flavor.id).toBe(flavorId);
      expect(data.availabilityZones.length).toBe(1);
      variantId = data.id;
      cleanup.push({ type: 'variants', id: variantId });
    });

    test('GET /api/products/:id/variants returns variants', async () => {
      const { status, data } = await get(`/api/products/${computeProductId}/variants`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.some((v: any) => v.id === variantId)).toBe(true);
    });

    test('GET /api/variants/:id returns variant', async () => {
      const { status, data } = await get(`/api/variants/${variantId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(variantId);
    });

    test('PUT /api/variants/:id updates variant fields', async () => {
      const { status, data } = await put(`/api/variants/${variantId}`, { name: 'Updated Variant' });
      expect(status).toBe(200);
      expect(data.name).toBe('Updated Variant');
    });

    test('PUT /api/variants/:id updates availability zones', async () => {
      const { data: azs } = await get('/api/availability-zones');
      const newAzId = azs[1]?.id || azId;
      const { status, data } = await put(`/api/variants/${variantId}`, {
        availabilityZoneIds: [newAzId],
      });
      expect(status).toBe(200);
      expect(data.availabilityZones.map((z: any) => z.availabilityZoneId)).toContain(newAzId);
    });

    test('DELETE /api/variants/:id removes variant without instances', async () => {
      const { status } = await del(`/api/variants/${variantId}`);
      expect(status).toBe(204);
      const idx = cleanup.findIndex((c) => c.id === variantId);
      if (idx >= 0) cleanup.splice(idx, 1);
    });

    test('DELETE /api/variants/:id rejects when instances exist', async () => {
      const { data: variants } = await get(`/api/variants/product/${computeProductId}`);
      const withInstances = variants.find((v: any) => (v._count?.instances || 0) > 0);
      if (!withInstances) {
        console.warn('Skipping: no variant with instances found');
        return;
      }
      const { status, data } = await del(`/api/variants/${withInstances.id}`);
      expect(status).toBe(409);
      expect(data.error).toMatch(/Cannot delete variant with existing instances/i);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2 (continued) — Flavor Global CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Phase 2 — Global Flavor CRUD', () => {
    let testFlavorId: string;

    test('GET /api/flavors returns global flavors with usage counts', async () => {
      const { status, data } = await get('/api/flavors');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      for (const f of data) {
        expect(f._count).toBeDefined();
        expect(typeof f._count.variants).toBe('number');
        expect(typeof f._count.forecastLines).toBe('number');
      }
    });

    test('POST /api/flavors creates a global flavor', async () => {
      const { status, data } = await post('/api/flavors', {
        name: 'GlobalFlavorJest',
        vcpu: 8,
        ramGb: 16,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('GlobalFlavorJest');
      testFlavorId = data.id;
      cleanup.push({ type: 'flavors', id: testFlavorId });
    });

    test('GET /api/flavors/:id includes variants using the flavor', async () => {
      const { status, data } = await get(`/api/flavors/${testFlavorId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(testFlavorId);
      expect(Array.isArray(data.variants)).toBe(true);
    });

    test('PATCH /api/flavors/:id updates fields', async () => {
      const { status, data } = await patch(`/api/flavors/${testFlavorId}`, { ramGb: 32 });
      expect(status).toBe(200);
      expect(data.ramGb).toBe(32);
    });

    test('DELETE /api/flavors/:id rejects when variants exist', async () => {
      const { data: flavors } = await get('/api/flavors');
      const withVariants = flavors.find((f: any) => (f._count?.variants || 0) > 0);
      if (!withVariants) {
        console.warn('Skipping: no flavor with variants found');
        return;
      }
      const { status, data } = await del(`/api/flavors/${withVariants.id}`);
      expect(status).toBe(409);
      expect(data.error).toMatch(/Cannot delete flavor with existing/i);
    });

    test('DELETE /api/flavors/:id removes unused flavor', async () => {
      const { status } = await del(`/api/flavors/${testFlavorId}`);
      expect(status).toBe(204);
      const idx = cleanup.findIndex((c) => c.id === testFlavorId);
      if (idx >= 0) cleanup.splice(idx, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5 — Seed Data Verification
  // ═══════════════════════════════════════════════════════════════════════════
  describe('Phase 5 — Seed Data', () => {
    test('Windows OS has Server 2022, 2019, 11 versions', async () => {
      const { data } = await get('/api/os');
      const windows = data.find((o: any) => o.slug === 'windows');
      expect(windows).toBeDefined();
      const versions = windows.versions.map((v: any) => v.version);
      expect(versions).toEqual(expect.arrayContaining(['Server 2022', 'Server 2019', '11']));
    });

    test('Debian OS has 12 and 11 versions', async () => {
      const { data } = await get('/api/os');
      const debian = data.find((o: any) => o.slug === 'debian');
      expect(debian).toBeDefined();
      const versions = debian.versions.map((v: any) => v.version);
      expect(versions).toEqual(expect.arrayContaining(['12 (Bookworm)', '11 (Bullseye)']));
    });

    test('RHEL OS has 9 and 8 versions', async () => {
      const { data } = await get('/api/os');
      const rhel = data.find((o: any) => o.slug === 'rhel');
      expect(rhel).toBeDefined();
      const versions = rhel.versions.map((v: any) => v.version);
      expect(versions).toEqual(expect.arrayContaining(['9', '8']));
    });

    test('OS versions have realistic lifecycle dates', async () => {
      const { data } = await get('/api/os');
      for (const os of data) {
        for (const v of os.versions) {
          const release = new Date(v.releaseDate).getTime();
          const normal = new Date(v.normalSupportEnd).getTime();
          const extended = new Date(v.extendedSupportEnd).getTime();
          const eol = new Date(v.eolDate).getTime();
          expect(release).toBeLessThan(normal);
          expect(normal).toBeLessThan(extended);
          expect(extended).toBeLessThan(eol);
        }
      }
    });
  });
});
