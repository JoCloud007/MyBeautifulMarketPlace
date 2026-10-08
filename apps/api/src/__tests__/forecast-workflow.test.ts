import {
  resolveTransition,
  TransitionError,
  estimateLineCost,
  governanceDefinition,
} from '../lib/forecast-workflow';
import { Role } from '@prisma/client';

jest.mock('@prisma/client', () => ({
  ForecastStatus: {
    DRAFT: 'DRAFT', PENDING_TECH: 'PENDING_TECH', PENDING_MANAGER: 'PENDING_MANAGER',
    PENDING_BUDGET: 'PENDING_BUDGET', APPROVED: 'APPROVED', REJECTED: 'REJECTED', CANCELLED: 'CANCELLED',
  },
  ForecastAction: {
    CREATE: 'CREATE', UPDATE: 'UPDATE', SUBMIT: 'SUBMIT', APPROVE: 'APPROVE',
    REJECT: 'REJECT', CANCEL: 'CANCEL', RESUBMIT: 'RESUBMIT',
  },
  Role: {
    ADMIN: 'ADMIN', REQUESTER: 'REQUESTER', TECH_LEAD: 'TECH_LEAD', MANAGER: 'MANAGER', FINANCE: 'FINANCE',
  },
}));

const actor = (roles: Role[], extra: Partial<{ isRequesterManager: boolean }> = {}) => ({
  name: 'Test Actor',
  email: 'actor@example.com',
  roles,
  ...extra,
});

describe('forecast-workflow state machine', () => {
  describe('legal transitions', () => {
    it('SUBMIT: DRAFT → PENDING_TECH for a REQUESTER', () => {
      const t = resolveTransition('DRAFT', 'SUBMIT', actor([Role.REQUESTER]));
      expect(t.to).toBe('PENDING_TECH');
    });

    it('APPROVE: PENDING_TECH → PENDING_MANAGER for a TECH_LEAD', () => {
      const t = resolveTransition('PENDING_TECH', 'APPROVE', actor([Role.TECH_LEAD]));
      expect(t.to).toBe('PENDING_MANAGER');
    });

    it('APPROVE: PENDING_MANAGER → PENDING_BUDGET for the requester manager', () => {
      const t = resolveTransition('PENDING_MANAGER', 'APPROVE', actor([Role.MANAGER], { isRequesterManager: true }));
      expect(t.to).toBe('PENDING_BUDGET');
    });

    it('APPROVE: PENDING_BUDGET → APPROVED for FINANCE', () => {
      const t = resolveTransition('PENDING_BUDGET', 'APPROVE', actor([Role.FINANCE]));
      expect(t.to).toBe('APPROVED');
    });

    it('RESUBMIT: REJECTED → PENDING_TECH for a REQUESTER', () => {
      const t = resolveTransition('REJECTED', 'RESUBMIT', actor([Role.REQUESTER]));
      expect(t.to).toBe('PENDING_TECH');
    });

    it('CANCEL: DRAFT, PENDING_TECH, PENDING_MANAGER → CANCELLED for a REQUESTER', () => {
      for (const from of ['DRAFT', 'PENDING_TECH', 'PENDING_MANAGER'] as const) {
        const t = resolveTransition(from, 'CANCEL', actor([Role.REQUESTER]));
        expect(t.to).toBe('CANCELLED');
      }
    });
  });

  describe('forbidden transitions (400)', () => {
    it('SUBMIT from PENDING_TECH is forbidden', () => {
      expect(() => resolveTransition('PENDING_TECH', 'SUBMIT', actor([Role.REQUESTER]))).toThrow(TransitionError);
    });

    it('APPROVE from DRAFT is forbidden', () => {
      expect(() => resolveTransition('DRAFT', 'APPROVE', actor([Role.TECH_LEAD]))).toThrow(TransitionError);
    });

    it('RESUBMIT from APPROVED is forbidden', () => {
      expect(() => resolveTransition('APPROVED', 'RESUBMIT', actor([Role.REQUESTER]))).toThrow(TransitionError);
    });

    it('APPROVE from APPROVED (terminal) is forbidden', () => {
      expect(() => resolveTransition('APPROVED', 'APPROVE', actor([Role.ADMIN]))).toThrow(TransitionError);
    });
  });

  describe('role enforcement (403)', () => {
    it('TECH step refuses a non-TECH_LEAD actor', () => {
      expect(() => resolveTransition('PENDING_TECH', 'APPROVE', actor([Role.FINANCE]))).toThrow(TransitionError);
      try {
        resolveTransition('PENDING_TECH', 'APPROVE', actor([Role.FINANCE]));
      } catch (e) {
        expect((e as TransitionError).status).toBe(403);
      }
    });

    it('BUDGET step refuses a non-FINANCE actor', () => {
      expect(() => resolveTransition('PENDING_BUDGET', 'APPROVE', actor([Role.TECH_LEAD]))).toThrow(TransitionError);
    });

    it('MANAGER step refuses a MANAGER who is not the requester manager', () => {
      expect(() => resolveTransition('PENDING_MANAGER', 'APPROVE', actor([Role.MANAGER], { isRequesterManager: false }))).toThrow(TransitionError);
    });

    it('MANAGER step refuses an actor without the MANAGER role even if bound', () => {
      expect(() => resolveTransition('PENDING_MANAGER', 'APPROVE', actor([Role.REQUESTER], { isRequesterManager: true }))).toThrow(TransitionError);
    });
  });

  describe('ADMIN bypass', () => {
    it('ADMIN can approve every step', () => {
      expect(resolveTransition('PENDING_TECH', 'APPROVE', actor([Role.ADMIN])).to).toBe('PENDING_MANAGER');
      expect(resolveTransition('PENDING_MANAGER', 'APPROVE', actor([Role.ADMIN])).to).toBe('PENDING_BUDGET');
      expect(resolveTransition('PENDING_BUDGET', 'APPROVE', actor([Role.ADMIN])).to).toBe('APPROVED');
    });
  });

  describe('cost estimation', () => {
    it('uses the 10 €/vCPU + 3 €/GB barème times quantity', () => {
      // (2×10 + 4×3) × 3 = 96
      expect(estimateLineCost(2, 4, 3)).toBe(96);
      // zero-vCPU storage flavor: (0 + 2×3) × 5 = 30
      expect(estimateLineCost(0, 2, 5)).toBe(30);
      expect(estimateLineCost(8, 16, 1)).toBe(128);
    });
  });

  describe('governance definition', () => {
    it('exposes 7 steps, rules including HA/AZ and SLA entries', () => {
      const gov = governanceDefinition();
      expect(gov.steps).toHaveLength(7);
      expect(gov.rules.some((r) => r.id === 'resiliency-ha')).toBe(true);
      expect(gov.rules.some((r) => r.id === 'manager-binding')).toBe(true);
      expect(gov.sla).toHaveLength(3);
    });
  });
});
