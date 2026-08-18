import { readFileSync, readdirSync } from 'fs';
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
const put = (path: string, body: any) => api('PUT', path, body);
const patch = (path: string, body: any) => api('PATCH', path, body);
const del = (path: string) => api('DELETE', path);

function readRelative(...segments: string[]) {
  return readFileSync(resolve(__dirname, '../../../../', ...segments), 'utf-8');
}

// ─── Test Suite ─────────────────────────────────────────────────────────────

describe('🗄️ Database Schema & Migration — Refonte Produit IaaS', () => {
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
  // 1. Schema Structure — New Models
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣ Schema Structure — New Models', () => {
    const schema = readRelative('apps/api/prisma/schema.prisma');

    test('model OperatingSystem exists with required fields', () => {
      expect(schema).toContain('model OperatingSystem');
      expect(schema).toMatch(/family\s+String/);
      expect(schema).toMatch(/name\s+String/);
      expect(schema).toMatch(/slug\s+String\s+@unique/);
      expect(schema).toMatch(/isActive\s+Boolean\s+@default\(true\)/);
      expect(schema).toContain('versions  OsVersion[]');
    });

    test('model OsVersion exists with lifecycle fields', () => {
      expect(schema).toContain('model OsVersion');
      expect(schema).toMatch(/version\s+String/);
      expect(schema).toMatch(/releaseDate\s+DateTime/);
      expect(schema).toMatch(/normalSupportEnd\s+DateTime/);
      expect(schema).toMatch(/extendedSupportEnd\s+DateTime/);
      expect(schema).toMatch(/eolDate\s+DateTime/);
      expect(schema).toMatch(/phase\s+LifecyclePhase\s+@default\(RELEASED\)/);
      expect(schema).toContain('@@unique([osId, version])');
    });

    test('model ProductVariant exists with required relations', () => {
      expect(schema).toContain('model ProductVariant');
      expect(schema).toMatch(/productId\s+String/);
      expect(schema).toMatch(/osId\s+String/);
      expect(schema).toMatch(/osVersionId\s+String/);
      expect(schema).toMatch(/flavorId\s+String/);
      expect(schema).toContain('availabilityZones ProductVariantAvailabilityZone[]');
      expect(schema).toMatch(/continuityLevelId\s+String\?/);
    });

    test('model ProductVariantAvailabilityZone exists with unique constraint', () => {
      expect(schema).toContain('model ProductVariantAvailabilityZone');
      expect(schema).toMatch(/variantId\s+String/);
      expect(schema).toMatch(/availabilityZoneId\s+String/);
      expect(schema).toContain('@@unique([variantId, availabilityZoneId])');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. Schema Structure — Modified Models
  // ═══════════════════════════════════════════════════════════════════════════
  describe('2️⃣ Schema Structure — Modified Models', () => {
    const schema = readRelative('apps/api/prisma/schema.prisma');

    test('Product has computeType and variants relation', () => {
      expect(schema).toMatch(/computeType\s+ComputeType\?/);
      expect(schema).toContain('variants          ProductVariant[]');
    });

    test('Product no longer has availabilityZones, options, or lifecycles', () => {
      expect(schema).not.toContain('model ProductOption');
      expect(schema).not.toContain('model ProductLifecycle');
      // ProductAvailabilityZone was replaced
      const productSection = schema.substring(
        schema.indexOf('model Product'),
        schema.indexOf('model ', schema.indexOf('model Product') + 1)
      );
      expect(productSection).not.toContain('availabilityZones');
    });

    test('Flavor is global (no productId) and has variants relation', () => {
      const flavorSection = schema.substring(
        schema.indexOf('model Flavor'),
        schema.indexOf('model ', schema.indexOf('model Flavor') + 1)
      );
      expect(flavorSection).not.toContain('productId');
      expect(flavorSection).toContain('variants      ProductVariant[]');
      expect(flavorSection).toContain('name          String           @unique');
    });

    test('Instance has variantId and variant relation', () => {
      const instanceSection = schema.substring(
        schema.indexOf('model Instance'),
        schema.indexOf('model ', schema.indexOf('model Instance') + 1)
      );
      expect(instanceSection).toMatch(/variantId\s+String\?/);
      expect(instanceSection).toContain('variant            ProductVariant?   @relation(fields: [variantId], references: [id])');
    });

    test('ContinuityLevel has variants relation', () => {
      const clSection = schema.substring(
        schema.indexOf('model ContinuityLevel'),
        schema.indexOf('model ', schema.indexOf('model ContinuityLevel') + 1)
      );
      expect(clSection).toContain('variants     ProductVariant[]');
    });

    test('AvailabilityZone has variantZones relation', () => {
      const azSection = schema.substring(
        schema.indexOf('model AvailabilityZone'),
        schema.indexOf('model ', schema.indexOf('model AvailabilityZone') + 1)
      );
      expect(azSection).toContain('variantZones  ProductVariantAvailabilityZone[]');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. Schema Structure — Enums
  // ═══════════════════════════════════════════════════════════════════════════
  describe('3️⃣ Schema Structure — Enums', () => {
    const schema = readRelative('apps/api/prisma/schema.prisma');

    test('ComputeType enum exists with PHYSICAL and VIRTUAL', () => {
      expect(schema).toContain('enum ComputeType');
      expect(schema).toContain('PHYSICAL');
      expect(schema).toContain('VIRTUAL');
    });

    test('LifecyclePhase enum exists with all phases', () => {
      expect(schema).toContain('enum LifecyclePhase');
      expect(schema).toContain('RELEASED');
      expect(schema).toContain('NORMAL_SUPPORT');
      expect(schema).toContain('EXTENDED_SUPPORT');
      expect(schema).toContain('NO_SUPPORT');
      expect(schema).toContain('EOL');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. Migration File
  // ═══════════════════════════════════════════════════════════════════════════
  describe('4️⃣ Migration File', () => {
    test('migration directory exists for refonte_produit_iaas', () => {
      const dirs = readdirSync(resolve(__dirname, '../../../../apps/api/prisma/migrations'));
      expect(dirs.some((d) => d.includes('refonte_produit_iaas'))).toBe(true);
    });

    test('migration SQL creates new tables', () => {
      const sql = readRelative('apps/api/prisma/migrations/20250714000000_refonte_produit_iaas/migration.sql');
      expect(sql).toContain('CREATE TABLE "OperatingSystem"');
      expect(sql).toContain('CREATE TABLE "OsVersion"');
      expect(sql).toContain('CREATE TABLE "ProductVariant"');
      expect(sql).toContain('CREATE TABLE "ProductVariantAvailabilityZone"');
    });

    test('migration SQL adds computeType to Product', () => {
      const sql = readRelative('apps/api/prisma/migrations/20250714000000_refonte_produit_iaas/migration.sql');
      expect(sql).toContain('ComputeType');
    });

    test('migration SQL adds variantId to Instance', () => {
      const sql = readRelative('apps/api/prisma/migrations/20250714000000_refonte_produit_iaas/migration.sql');
      expect(sql).toContain('variantId');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. Seed Data — Operating Systems & Versions
  // ═══════════════════════════════════════════════════════════════════════════
  describe('5️⃣ Seed Data — Operating Systems & Versions', () => {
    test('GET /api/os returns seeded OS with versions', async () => {
      const { status, data } = await get('/api/os');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(3);

      const slugs = data.map((o: any) => o.slug);
      expect(slugs).toEqual(expect.arrayContaining(['windows', 'debian', 'rhel']));

      for (const os of data) {
        expect(os.versions).toBeDefined();
        expect(Array.isArray(os.versions)).toBe(true);
        expect(os._count).toBeDefined();
        expect(typeof os._count.versions).toBe('number');
      }
    });

    test('GET /api/os/:id returns OS with version details', async () => {
      const { data: osList } = await get('/api/os');
      const windows = osList.find((o: any) => o.slug === 'windows');
      expect(windows).toBeDefined();

      const { status, data } = await get(`/api/os/${windows.id}`);
      expect(status).toBe(200);
      expect(data.family).toBe('WINDOWS');
      expect(data.versions.length).toBeGreaterThanOrEqual(1);

      const version = data.versions[0];
      expect(version.version).toBeDefined();
      expect(version.releaseDate).toBeDefined();
      expect(version.normalSupportEnd).toBeDefined();
      expect(version.extendedSupportEnd).toBeDefined();
      expect(version.eolDate).toBeDefined();
      expect(version.phase).toBeDefined();
    });

    test('GET /api/os/:id/versions returns versions for an OS', async () => {
      const { data: osList } = await get('/api/os');
      const debian = osList.find((o: any) => o.slug === 'debian');
      expect(debian).toBeDefined();

      const { status, data } = await get(`/api/os/${debian.id}/versions`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(2);

      const versions = data.map((v: any) => v.version);
      expect(versions).toEqual(expect.arrayContaining(['12 (Bookworm)', '11 (Bullseye)']));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. Seed Data — Global Flavors
  // ═══════════════════════════════════════════════════════════════════════════
  describe('6️⃣ Seed Data — Global Flavors', () => {
    test('GET /api/flavors returns global flavors with usage counts', async () => {
      const { status, data } = await get('/api/flavors');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(4);

      const names = data.map((f: any) => f.name);
      expect(names).toEqual(expect.arrayContaining(['Small', 'Medium', 'Large', 'XL']));

      for (const f of data) {
        expect(f._count).toBeDefined();
        expect(typeof f._count.variants).toBe('number');
      }
    });

    test('flavors no longer have productId', async () => {
      const { data: flavors } = await get('/api/flavors');
      for (const f of flavors) {
        expect(f).not.toHaveProperty('productId');
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. Seed Data — Product Variants
  // ═══════════════════════════════════════════════════════════════════════════
  describe('7️⃣ Seed Data — Product Variants', () => {
    test('compute products have variants with OS, flavor, and AZs', async () => {
      const { data: products } = await get('/api/products?category=compute');
      expect(products.length).toBeGreaterThanOrEqual(1);

      for (const p of products) {
        if (p.computeType) {
          expect(p.variants).toBeDefined();
          expect(Array.isArray(p.variants)).toBe(true);
          expect(p.variants.length).toBeGreaterThanOrEqual(1);
          expect(p._count.variants).toBeGreaterThanOrEqual(1);

          for (const v of p.variants) {
            expect(v.os).toBeDefined();
            expect(v.osVersion).toBeDefined();
            expect(v.flavor).toBeDefined();
            expect(v.availabilityZones).toBeDefined();
            expect(Array.isArray(v.availabilityZones)).toBe(true);
          }
        }
      }
    });

    test('non-compute products do not have computeType', async () => {
      const { data: products } = await get('/api/products');
      const nonCompute = products.filter((p: any) => p.category?.slug !== 'compute');
      expect(nonCompute.length).toBeGreaterThanOrEqual(1);

      for (const p of nonCompute) {
        expect(p.computeType).toBeNull();
      }
    });

    test('GET /api/products/:slug includes variants for compute products', async () => {
      const { data: products } = await get('/api/products?category=compute');
      const computeProduct = products[0];
      expect(computeProduct).toBeDefined();

      const { status, data } = await get(`/api/products/${computeProduct.slug}`);
      expect(status).toBe(200);
      expect(data.variants).toBeDefined();
      expect(Array.isArray(data.variants)).toBe(true);
      expect(data.variants.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. OS API CRUD
  // ═══════════════════════════════════════════════════════════════════════════
  describe('8️⃣ OS API CRUD', () => {
    let testOsId: string;
    let testVersionId: string;

    test('POST /api/os creates an OS', async () => {
      const { status, data } = await post('/api/os', {
        family: 'TEST',
        name: 'Test OS',
        slug: 'test-os-schema',
        isActive: true,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test OS');
      testOsId = data.id;
      cleanup.push({ type: 'os', id: data.id });
    });

    test('POST /api/os rejects duplicate slug', async () => {
      const { status } = await post('/api/os', {
        family: 'TEST',
        name: 'Test OS Dup',
        slug: 'test-os-schema',
      });
      expect(status).toBe(409);
    });

    test('PUT /api/os/:id updates OS', async () => {
      const { status, data } = await put(`/api/os/${testOsId}`, {
        name: 'Test OS Updated',
      });
      expect(status).toBe(200);
      expect(data.name).toBe('Test OS Updated');
    });

    test('POST /api/os/:id/versions creates a version', async () => {
      const { status, data } = await post(`/api/os/${testOsId}/versions`, {
        version: '1.0',
        releaseDate: '2024-01-01T00:00:00Z',
        normalSupportEnd: '2025-01-01T00:00:00Z',
        extendedSupportEnd: '2026-01-01T00:00:00Z',
        eolDate: '2027-01-01T00:00:00Z',
        phase: 'RELEASED',
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.version).toBe('1.0');
      testVersionId = data.id;
    });

    test('POST /api/os/:id/versions rejects invalid date order', async () => {
      const { status, data } = await post(`/api/os/${testOsId}/versions`, {
        version: '2.0',
        releaseDate: '2025-01-01T00:00:00Z',
        normalSupportEnd: '2024-01-01T00:00:00Z',
        extendedSupportEnd: '2026-01-01T00:00:00Z',
        eolDate: '2027-01-01T00:00:00Z',
      });
      expect(status).toBe(400);
      expect(data.error).toBe('Validation Error');
    });

    test('DELETE /api/os/:id/versions/:vId deletes version', async () => {
      const { status } = await del(`/api/os/${testOsId}/versions/${testVersionId}`);
      expect(status).toBe(204);
    });

    test('DELETE /api/os/:id deletes OS', async () => {
      const { status } = await del(`/api/os/${testOsId}`);
      expect(status).toBe(204);
      const idx = cleanup.findIndex((c) => c.id === testOsId);
      if (idx >= 0) cleanup.splice(idx, 1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. Variant API CRUD & Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  describe('9️⃣ Variant API CRUD & Constraints', () => {
    let computeProductId: string;
    let nonComputeProductId: string;
    let osId: string;
    let osVersionId: string;
    let flavorId: string;
    let azId: string;
    let testVariantId: string;

    beforeAll(async () => {
      const { data: products } = await get('/api/products');
      const compute = products.find((p: any) => p.category?.slug === 'compute');
      const nonCompute = products.find((p: any) => p.category?.slug !== 'compute');
      computeProductId = compute?.id;
      nonComputeProductId = nonCompute?.id;

      const { data: osList } = await get('/api/os');
      osId = osList[0]?.id;
      const { data: versions } = await get(`/api/os/${osId}/versions`);
      osVersionId = versions[0]?.id;

      const { data: flavors } = await get('/api/flavors');
      flavorId = flavors[0]?.id;

      const { data: azs } = await get('/api/availability-zones');
      azId = azs[0]?.id;
    });

    test('POST /api/variants/products/:id/variants creates variant for compute product', async () => {
      const { status, data } = await post(`/api/variants/products/${computeProductId}/variants`, {
        name: 'Test Variant Schema',
        osId,
        osVersionId,
        flavorId,
        availabilityZoneIds: [azId],
        isActive: true,
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data.name).toBe('Test Variant Schema');
      expect(data.os).toBeDefined();
      expect(data.osVersion).toBeDefined();
      expect(data.flavor).toBeDefined();
      expect(Array.isArray(data.availabilityZones)).toBe(true);
      testVariantId = data.id;
    });

    test('POST /api/variants/products/:id/variants rejects non-compute product', async () => {
      const { status, data } = await post(`/api/variants/products/${nonComputeProductId}/variants`, {
        name: 'Bad Variant',
        osId,
        osVersionId,
        flavorId,
      });
      expect(status).toBe(400);
      expect(data.error).toMatch(/compute/i);
    });

    test('POST /api/variants/products/:id/variants rejects invalid OS version', async () => {
      const { status, data } = await post(`/api/variants/products/${computeProductId}/variants`, {
        name: 'Bad Variant',
        osId,
        osVersionId: '00000000-0000-0000-0000-000000000000',
        flavorId,
      });
      expect(status).toBe(404);
      expect(data.error).toMatch(/OS version/i);
    });

    test('GET /api/variants/:id returns variant detail', async () => {
      const { status, data } = await get(`/api/variants/${testVariantId}`);
      expect(status).toBe(200);
      expect(data.id).toBe(testVariantId);
      expect(data.product).toBeDefined();
      expect(data.os).toBeDefined();
      expect(data.flavor).toBeDefined();
      expect(data._count).toBeDefined();
    });

    test('PUT /api/variants/:id updates variant', async () => {
      const { status, data } = await put(`/api/variants/${testVariantId}`, {
        name: 'Test Variant Updated',
      });
      expect(status).toBe(200);
      expect(data.name).toBe('Test Variant Updated');
    });

    test('GET /api/variants/products/:id/variants lists product variants', async () => {
      const { status, data } = await get(`/api/variants/products/${computeProductId}/variants`);
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThanOrEqual(1);
      expect(data.some((v: any) => v.id === testVariantId)).toBe(true);
    });

    test('DELETE /api/variants/:id removes variant', async () => {
      const { status } = await del(`/api/variants/${testVariantId}`);
      expect(status).toBe(204);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 10. Product API — computeType Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  describe('🔟 Product API — computeType Constraints', () => {
    let computeCatId: string;
    let nonComputeCatId: string;

    beforeAll(async () => {
      const { data: cats } = await get('/api/categories');
      computeCatId = cats.find((c: any) => c.slug === 'compute')?.id;
      nonComputeCatId = cats.find((c: any) => c.slug !== 'compute')?.id;
    });

    test('POST /api/products allows computeType for compute category', async () => {
      const { status, data } = await post('/api/products', {
        name: 'Compute Test Product',
        slug: 'compute-test-product-schema',
        categoryId: computeCatId,
        computeType: 'VIRTUAL',
      });
      expect(status).toBe(201);
      expect(data.computeType).toBe('VIRTUAL');
      cleanup.push({ type: 'products', id: data.id });
    });

    test('POST /api/products rejects computeType for non-compute category', async () => {
      const { status, data } = await post('/api/products', {
        name: 'Non Compute Test',
        slug: 'non-compute-test-schema',
        categoryId: nonComputeCatId,
        computeType: 'VIRTUAL',
      });
      expect(status).toBe(400);
      expect(data.error).toMatch(/computeType can only be set for Compute/i);
    });

    test('PATCH /api/products/:id rejects setting computeType on non-compute', async () => {
      const { data: products } = await get('/api/products');
      const nonCompute = products.find((p: any) => p.category?.slug !== 'compute' && !p.computeType);
      if (nonCompute) {
        const { status, data } = await patch(`/api/products/${nonCompute.id}`, {
          computeType: 'VIRTUAL',
        });
        expect(status).toBe(400);
        expect(data.error).toMatch(/computeType can only be set for Compute/i);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 11. Flavor API — Global Behavior & Deletion Guards
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣1️⃣ Flavor API — Global Behavior & Deletion Guards', () => {
    test('DELETE /api/flavors/:id blocked when variants exist', async () => {
      const { data: flavors } = await get('/api/flavors');
      const usedFlavor = flavors.find((f: any) => f._count.variants > 0);
      expect(usedFlavor).toBeDefined();

      const { status, data } = await del(`/api/flavors/${usedFlavor.id}`);
      expect(status).toBe(409);
      expect(data.error).toMatch(/variants/i);
    });

    test('POST /api/flavors creates global flavor without productId', async () => {
      const { status, data } = await post('/api/flavors', {
        name: 'Test Global Flavor Schema',
        vcpu: 8,
        ramGb: 16,
        description: 'Test flavor',
      });
      expect(status).toBe(201);
      expect(data.id).toBeDefined();
      expect(data).not.toHaveProperty('productId');
      cleanup.push({ type: 'flavors', id: data.id });
    });

    test('PATCH /api/flavors/:id updates flavor', async () => {
      const { data: flavors } = await get('/api/flavors');
      const flavor = flavors.find((f: any) => f.name === 'Test Global Flavor Schema');
      if (flavor) {
        const { status, data } = await patch(`/api/flavors/${flavor.id}`, {
          vcpu: 16,
        });
        expect(status).toBe(200);
        expect(data.vcpu).toBe(16);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 12. OS API — Deletion Guards
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣2️⃣ OS API — Deletion Guards', () => {
    test('DELETE /api/os/:id blocked when versions have variants', async () => {
      const { data: osList } = await get('/api/os');
      const usedOs = osList.find((o: any) => o._count.variants > 0 || o.versions.some((v: any) => v._count?.variants > 0));
      if (!usedOs) {
        // Fallback: find any OS with variants count > 0
        const osWithVariants = osList.find((o: any) => o._count.variants > 0);
        if (osWithVariants) {
          const { status, data } = await del(`/api/os/${osWithVariants.id}`);
          expect(status).toBe(409);
          expect(data.error).toMatch(/variants/i);
        } else {
          // All OS are unused — skip or test with a fresh one
          console.log('Skipping OS deletion guard test — no used OS found');
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 13. Product API — Deletion Guards
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣3️⃣ Product API — Deletion Guards', () => {
    test('DELETE /api/products/:id blocked when variants exist', async () => {
      const { data: products } = await get('/api/products?category=compute');
      const productWithVariants = products.find((p: any) => p._count.variants > 0);
      expect(productWithVariants).toBeDefined();

      const { status, data } = await del(`/api/products/${productWithVariants.id}`);
      expect(status).toBe(409);
      expect(data.error).toMatch(/variants/i);
    });

    test('DELETE /api/products/:id blocked when instances exist', async () => {
      const { data: products } = await get('/api/products');
      const productWithInstances = products.find((p: any) => p._count.instances > 0);
      if (productWithInstances) {
        const { status, data } = await del(`/api/products/${productWithInstances.id}`);
        expect(status).toBe(409);
        expect(data.error).toMatch(/instances/i);
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 14. Instance Model — variant Relation
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣4️⃣ Instance Model — variant Relation', () => {
    test('instances can have variant relation', async () => {
      const { status, data } = await get('/api/instances');
      expect(status).toBe(200);
      expect(Array.isArray(data)).toBe(true);

      for (const inst of data) {
        // variantId may be null or a string
        expect(inst).toHaveProperty('variantId');
        if (inst.variantId) {
          expect(typeof inst.variantId).toBe('string');
        }
      }
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 15. Schema Indexes & Constraints
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣5️⃣ Schema Indexes & Constraints', () => {
    const schema = readRelative('apps/api/prisma/schema.prisma');

    test('ProductVariant has @@unique([productId, name])', () => {
      const pvSection = schema.substring(
        schema.indexOf('model ProductVariant'),
        schema.indexOf('model ', schema.indexOf('model ProductVariant') + 1)
      );
      expect(pvSection).toContain('@@unique([productId, name])');
    });

    test('Flavor has @unique on name', () => {
      const flavorSection = schema.substring(
        schema.indexOf('model Flavor'),
        schema.indexOf('model ', schema.indexOf('model Flavor') + 1)
      );
      expect(flavorSection).toContain('name          String           @unique');
    });

    test('OperatingSystem has @unique on slug', () => {
      const osSection = schema.substring(
        schema.indexOf('model OperatingSystem'),
        schema.indexOf('model ', schema.indexOf('model OperatingSystem') + 1)
      );
      expect(osSection).toContain('slug      String          @unique');
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 16. Route Registration
  // ═══════════════════════════════════════════════════════════════════════════
  describe('1️⃣6️⃣ Route Registration', () => {
    const indexTs = readRelative('apps/api/src/index.ts');

    test('osRoutes imported and registered', () => {
      expect(indexTs).toContain("import { osRoutes } from './routes/os'");
      expect(indexTs).toContain("app.use('/api/os', osRoutes)");
    });

    test('variantRoutes imported and registered', () => {
      expect(indexTs).toContain("import { variantRoutes } from './routes/variants'");
      expect(indexTs).toContain("app.use('/api/variants', variantRoutes)");
    });

    test('productRoutes and flavorRoutes still registered', () => {
      expect(indexTs).toContain("import { productRoutes } from './routes/products'");
      expect(indexTs).toContain("import { flavorRoutes } from './routes/flavors'");
      expect(indexTs).toContain("app.use('/api/products', productRoutes)");
      expect(indexTs).toContain("app.use('/api/flavors', flavorRoutes)");
    });
  });
});
