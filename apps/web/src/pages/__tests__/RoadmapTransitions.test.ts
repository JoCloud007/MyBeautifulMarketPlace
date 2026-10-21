import { describe, it, expect } from 'vitest';
import type { Transition, MigrationType, ProductStatus } from '@cloudmarket/shared-types';
import { transitionInCardScope, collectCardTransitions } from '@/pages/Roadmap';

function osTransition(osName: string, fromVersion: string, toVersion: string): Transition {
  return {
    id: `t-${osName}-${fromVersion}`,
    name: `${osName} ${fromVersion} → ${toVersion}`,
    slug: 'slug',
    description: null,
    fromProductId: 'p1',
    fromProduct: { id: 'p1', name: 'Virtual Machine', slug: 'virtual-machine' },
    toProductId: 'p1',
    toProduct: { id: 'p1', name: 'Virtual Machine', slug: 'virtual-machine' },
    fromVersion,
    toVersion,
    kind: 'OS',
    fromOsVersionId: 'f',
    toOsVersionId: 't',
    fromOsVersion: { id: 'f', version: fromVersion, osId: 'os1', os: { id: 'os1', name: osName, family: 'LINUX' } },
    toOsVersion: { id: 't', version: toVersion, osId: 'os1', os: { id: 'os1', name: osName, family: 'LINUX' } },
    migrationType: 'REBUILD' as MigrationType,
    status: 'AVAILABLE' as ProductStatus,
    availableFrom: null,
    eolDate: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function productTransition(fromVersion: string, toVersion: string): Transition {
  return {
    id: `t-product-${fromVersion}`,
    name: `${fromVersion} → ${toVersion}`,
    slug: 'slug',
    description: null,
    fromProductId: 'p1',
    fromProduct: { id: 'p1', name: 'Virtual Machine', slug: 'virtual-machine' },
    toProductId: 'p1',
    toProduct: { id: 'p1', name: 'Virtual Machine', slug: 'virtual-machine' },
    fromVersion,
    toVersion,
    kind: 'PRODUCT',
    fromOsVersionId: null,
    toOsVersionId: null,
    migrationType: 'IN_PLACE' as MigrationType,
    status: 'AVAILABLE' as ProductStatus,
    availableFrom: null,
    eolDate: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

const fictionalCard = {
  osNames: new Set(['FictionalOS']),
  osVersions: new Set(['1.0 (Fictive)']),
};

const rhelCard = {
  osNames: new Set(['Red Hat Enterprise Linux']),
  osVersions: new Set(['8', '9']),
};

describe('transitionInCardScope', () => {
  it('hides an OS transition from a card running a different OS', () => {
    const rhel = osTransition('Red Hat Enterprise Linux', '8', '9');
    expect(transitionInCardScope(rhel, fictionalCard.osNames, fictionalCard.osVersions)).toBe(false);
  });

  it('keeps an OS transition on the card of its own OS', () => {
    const rhel = osTransition('Red Hat Enterprise Linux', '8', '9');
    expect(transitionInCardScope(rhel, rhelCard.osNames, rhelCard.osVersions)).toBe(true);
  });

  it('keeps a PRODUCT transition on every card of the product', () => {
    const gen = productTransition('gen7', 'gen8');
    expect(transitionInCardScope(gen, fictionalCard.osNames, fictionalCard.osVersions)).toBe(true);
    expect(transitionInCardScope(gen, rhelCard.osNames, rhelCard.osVersions)).toBe(true);
    // Storage-style card with no OS at all still shows platform transitions
    expect(transitionInCardScope(gen, new Set(), new Set(['v2', 'v3']))).toBe(true);
  });

  it('shows an OS transition on any card running one of its endpoint OSes', () => {
    const cross = osTransition('Debian', '11 (Bullseye)', '12 (Bookworm)');
    const toRhel = {
      ...cross,
      toOsVersion: { id: 't', version: '9', osId: 'os2', os: { id: 'os2', name: 'Red Hat Enterprise Linux', family: 'LINUX' } },
    };
    expect(transitionInCardScope(toRhel, rhelCard.osNames, rhelCard.osVersions)).toBe(true);
    expect(transitionInCardScope(toRhel, fictionalCard.osNames, fictionalCard.osVersions)).toBe(false);
  });

  it('falls back to version strings for legacy OS transitions without OsVersion links', () => {
    const legacy = {
      ...osTransition('unknown', '8', '9'),
      fromOsVersion: null,
      toOsVersion: null,
      fromOsVersionId: null,
      toOsVersionId: null,
    } as Transition;
    expect(transitionInCardScope(legacy, rhelCard.osNames, rhelCard.osVersions)).toBe(true);
    expect(transitionInCardScope(legacy, fictionalCard.osNames, fictionalCard.osVersions)).toBe(false);
  });

  it('respects the explicit PRODUCT kind over version-string heuristics', () => {
    // A PRODUCT transition whose version strings happen to be OS versions
    // stays visible on every card — kind wins.
    const osStrings = new Set(['8', '9']);
    const gen = productTransition('8', '9');
    expect(transitionInCardScope(gen, fictionalCard.osNames, fictionalCard.osVersions, osStrings)).toBe(true);
  });
});

describe('collectCardTransitions', () => {
  const debian11to12 = osTransition('Debian', '11 (Bullseye)', '12 (Bookworm)');
  const rhel8to9 = osTransition('Red Hat Enterprise Linux', '8', '9');
  const gen7to8 = productTransition('gen7', 'gen8');
  const bmGen2to3 = { ...productTransition('bm-gen2', 'bm-gen3'), id: 't-bm', fromProduct: { id: 'p2', name: 'Bare Metal', slug: 'bare-metal' }, toProduct: { id: 'p2', name: 'Bare Metal', slug: 'bare-metal' } } as Transition;

  // Mirrors the live seed: OS migrations are DECLARED on Virtual Machine but
  // BELONG to their OS. The map indexes products (from/to) and OSes (byOs).
  const map = {
    from: new Map<string, Transition[]>([
      ['Virtual Machine', [debian11to12, rhel8to9, gen7to8]],
      ['Bare Metal', [bmGen2to3]],
    ]),
    to: new Map<string, Transition[]>(),
    byOs: new Map<string, Transition[]>([
      ['Debian', [debian11to12]],
      ['Red Hat Enterprise Linux', [rhel8to9]],
    ]),
  };

  it('shows only OS-relevant rows on a FictionalOS card (regression: was listing Debian/RHEL/Windows)', () => {
    // Live card: 22 "1.0 (Fictive)" rows, all Virtual Machine — must show only
    // the VM platform transition, never the Debian/RHEL/Windows OS migrations.
    const group = [{ product: 'Virtual Machine', os: 'FictionalOS', osVersionName: '1.0 (Fictive)' }];
    const result = collectCardTransitions(group, map);
    expect(result.map((t) => t.id)).toEqual(['t-product-gen7']);
  });

  it('shows each covered product\'s own platform transitions on a multi-product card', () => {
    const group = [
      { product: 'Virtual Machine', os: 'FictionalOS', osVersionName: '1.0 (Fictive)' },
      { product: 'Bare Metal', os: 'FictionalOS', osVersionName: '1.0 (Fictive)' },
    ];
    const ids = collectCardTransitions(group, map).map((t) => t.id).sort();
    expect(ids).toEqual(['t-bm', 't-product-gen7'].sort());
  });

  it('shows the Debian OS migration on the Debian card even though it is declared on Virtual Machine (regression)', () => {
    // Debian card: rows from Virtual Machine AND from another product — the
    // old group[0].product indexing missed the migration entirely.
    const group = [
      { product: 'Bare Metal', os: 'Debian', osVersionName: '12 (Bookworm)' },
      { product: 'Virtual Machine', os: 'Debian', osVersionName: '12 (Bookworm)' },
    ];
    const result = collectCardTransitions(group, map);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('t-Debian-11 (Bullseye)');
    expect(ids).toContain('t-product-gen7'); // VM platform transition (from product index)
    expect(ids).toContain('t-bm'); // Bare Metal platform transition
    expect(ids).not.toContain('t-Red Hat Enterprise Linux-8'); // no RHEL rows here
  });

  it('keeps the RHEL migration on the RHEL card', () => {
    const group = [{ product: 'Virtual Machine', os: 'Red Hat Enterprise Linux', osVersionName: '8' }];
    const result = collectCardTransitions(group, map);
    const ids = result.map((t) => t.id);
    expect(ids).toContain('t-Red Hat Enterprise Linux-8');
    expect(ids).not.toContain('t-Debian-11 (Bullseye)');
  });

  it('respects the Product/OS kind filter on top of card scoping', () => {
    const group = [{ product: 'Virtual Machine', os: 'Red Hat Enterprise Linux', osVersionName: '8' }];
    expect(collectCardTransitions(group, map, 'OS').map((t) => t.id)).toEqual(['t-Red Hat Enterprise Linux-8']);
    expect(collectCardTransitions(group, map, 'PRODUCT').map((t) => t.id)).toEqual(['t-product-gen7']);
  });
});
