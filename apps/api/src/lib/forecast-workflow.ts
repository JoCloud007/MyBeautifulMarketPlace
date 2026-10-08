import { ForecastStatus, ForecastAction, Role } from '@prisma/client';

/** € per vCPU-month and per GB RAM-month used for cost estimation (governance barème). */
export const COST_BAREME = { EUR_PER_VCPU_MONTH: 10, EUR_PER_GB_RAM_MONTH: 3 } as const;

export function estimateLineCost(vcpu: number, ramGb: number, quantity: number): number {
  return (vcpu * COST_BAREME.EUR_PER_VCPU_MONTH + ramGb * COST_BAREME.EUR_PER_GB_RAM_MONTH) * quantity;
}

/** The approval step that owns each in-progress status. */
export const STEP_ROLE: Partial<Record<ForecastStatus, Role>> = {
  [ForecastStatus.PENDING_TECH]: Role.TECH_LEAD,
  [ForecastStatus.PENDING_MANAGER]: Role.MANAGER,
  [ForecastStatus.PENDING_BUDGET]: Role.FINANCE,
};

/** Ordered lifecycle used for the stepper and governance page. */
export const LIFECYCLE_ORDER: ForecastStatus[] = [
  ForecastStatus.DRAFT,
  ForecastStatus.PENDING_TECH,
  ForecastStatus.PENDING_MANAGER,
  ForecastStatus.PENDING_BUDGET,
  ForecastStatus.APPROVED,
];

export class TransitionError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

type AllowedAction = 'SUBMIT' | 'APPROVE' | 'REJECT' | 'CANCEL' | 'RESUBMIT';

interface TransitionSpec {
  to: ForecastStatus;
  role: Role | null;
}

/** From-status -> actions permitted on it, with the resulting status and owning role. */
const TRANSITIONS: Record<string, Partial<Record<AllowedAction, TransitionSpec>>> = {
  [ForecastStatus.DRAFT]: {
    SUBMIT: { to: ForecastStatus.PENDING_TECH, role: Role.REQUESTER },
    CANCEL: { to: ForecastStatus.CANCELLED, role: Role.REQUESTER },
  },
  [ForecastStatus.PENDING_TECH]: {
    APPROVE: { to: ForecastStatus.PENDING_MANAGER, role: Role.TECH_LEAD },
    REJECT: { to: ForecastStatus.REJECTED, role: Role.TECH_LEAD },
    CANCEL: { to: ForecastStatus.CANCELLED, role: Role.REQUESTER },
  },
  [ForecastStatus.PENDING_MANAGER]: {
    APPROVE: { to: ForecastStatus.PENDING_BUDGET, role: Role.MANAGER },
    REJECT: { to: ForecastStatus.REJECTED, role: Role.MANAGER },
    CANCEL: { to: ForecastStatus.CANCELLED, role: Role.REQUESTER },
  },
  [ForecastStatus.PENDING_BUDGET]: {
    APPROVE: { to: ForecastStatus.APPROVED, role: Role.FINANCE },
    REJECT: { to: ForecastStatus.REJECTED, role: Role.FINANCE },
  },
  [ForecastStatus.REJECTED]: {
    RESUBMIT: { to: ForecastStatus.PENDING_TECH, role: Role.REQUESTER },
  },
};

export interface Actor {
  id?: string;
  name: string;
  email?: string;
  roles: Role[];
  /** Set when the actor is the manager of the requester (step 3). */
  isRequesterManager?: boolean;
}

/**
 * Resolve the transition for an action, throwing a TransitionError when the
 * action is not permitted from the current status or the actor lacks the role.
 */
export function resolveTransition(
  from: ForecastStatus,
  action: AllowedAction,
  actor: Actor,
): TransitionSpec {
  const fromTable = TRANSITIONS[from];
  if (!fromTable || !fromTable[action]) {
    throw new TransitionError(`Action ${action} is not permitted from status ${from}`);
  }
  const transition = fromTable[action]!;
  const required = transition.role;
  if (required) {
    const hasRole = actor.roles.includes(required) || actor.roles.includes(Role.ADMIN);
    if (from === ForecastStatus.PENDING_MANAGER && action === 'APPROVE') {
      // Step 3: must be the requester's manager (with MANAGER role) or an ADMIN
      const managerOk = (actor.isRequesterManager && actor.roles.includes(Role.MANAGER)) || actor.roles.includes(Role.ADMIN);
      if (!managerOk) {
        throw new TransitionError('Only the requester\'s manager (or an admin) can approve at the manager step', 403);
      }
    } else if (!hasRole) {
      throw new TransitionError(`Role ${required} is required for action ${action}`, 403);
    }
  }
  return transition;
}

export function governanceDefinition() {
  return {
    steps: [
      { status: 'DRAFT', label: 'Draft', description: 'Requester creates and edits the request. Not yet visible to approvers.', role: 'REQUESTER' },
      { status: 'PENDING_TECH', label: 'Technical review', description: 'Feasibility review: catalog fit, availability zones, resiliency rules.', role: 'TECH_LEAD' },
      { status: 'PENDING_MANAGER', label: 'Manager approval', description: 'Business validation by the requester\'s direct manager.', role: 'MANAGER' },
      { status: 'PENDING_BUDGET', label: 'Budget validation', description: 'Finance validates the estimated cost against the budget pool.', role: 'FINANCE' },
      { status: 'APPROVED', label: 'Approved', description: 'Request is approved and eligible for provisioning.', role: null },
      { status: 'REJECTED', label: 'Rejected', description: 'Rejected at any step with a mandatory reason. Requester can edit and resubmit.', role: null },
      { status: 'CANCELLED', label: 'Cancelled', description: 'Cancelled by the requester while in Draft or awaiting review.', role: 'REQUESTER' },
    ],
    rules: [
      { id: 'sequential', title: 'Strict sequential flow', description: 'Draft → Tech review → Manager → Budget → Approved. Each step waits for the previous one.' },
      { id: 'resiliency-ha', title: 'HA / Multi-AZ requires 2 distinct AZs', description: 'HA and MULTI_AZ lines require at least 2 distinct availability zones per product. STANDARD lines are ignored for this rule.' },
      { id: 'reject-reason', title: 'Rejection reason is mandatory', description: 'A rejection without a written reason is refused by the API. The reason is visible in the audit trail.' },
      { id: 'resubmit', title: 'Rejected requests can be resubmitted', description: 'A rejected request goes back to the requester who can edit it (Draft) and resubmit it. The full transition history is kept.' },
      { id: 'manager-binding', title: 'Manager approval is bound to the requester', description: 'Only the direct manager of the requester (or an admin) can approve the manager step.' },
      { id: 'cost-estimation', title: 'Automatic cost estimation', description: `Estimated cost is computed from the catalog: ${COST_BAREME.EUR_PER_VCPU_MONTH} €/vCPU-month + ${COST_BAREME.EUR_PER_GB_RAM_MONTH} €/GB RAM-month, multiplied by quantity. Displayed at the budget step.` },
    ],
    sla: [
      { step: 'PENDING_TECH', targetDays: 3 },
      { step: 'PENDING_MANAGER', targetDays: 5 },
      { step: 'PENDING_BUDGET', targetDays: 5 },
    ],
  };
}
