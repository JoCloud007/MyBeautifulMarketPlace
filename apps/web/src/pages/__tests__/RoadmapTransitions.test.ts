import { describe, it, expect } from 'vitest';
import type { Transition, MigrationType, ProductStatus } from '@cloudmarket/shared-types';
import { transitionInCardScope } from '@/pages/Roadmap';

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
