import { CheckCircle, Circle, Clock, XCircle } from 'lucide-react';
import { ForecastStatus, type ForecastTransition } from '@cloudmarket/shared-types';

export const LIFECYCLE_STEPS: { status: ForecastStatus; label: string }[] = [
  { status: ForecastStatus.DRAFT, label: 'Draft' },
  { status: ForecastStatus.PENDING_TECH, label: 'Tech review' },
  { status: ForecastStatus.PENDING_MANAGER, label: 'Manager' },
  { status: ForecastStatus.PENDING_BUDGET, label: 'Budget' },
  { status: ForecastStatus.APPROVED, label: 'Approved' },
];

const STEP_COLORS: Record<string, string> = {
  DRAFT: 'text-slate-400 border-slate-600 bg-slate-800',
  PENDING_TECH: 'text-violet-400 border-violet-500 bg-violet-500/20',
  PENDING_MANAGER: 'text-amber-400 border-amber-500 bg-amber-500/20',
  PENDING_BUDGET: 'text-cyan-400 border-cyan-500 bg-cyan-500/20',
  APPROVED: 'text-emerald-400 border-emerald-500 bg-emerald-500/20',
};

export const STATUS_BADGE: Record<ForecastStatus, { label: string; color: string }> = {
  [ForecastStatus.DRAFT]: { label: 'Draft', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  [ForecastStatus.PENDING_TECH]: { label: 'Tech review', color: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  [ForecastStatus.PENDING_MANAGER]: { label: 'Manager approval', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  [ForecastStatus.PENDING_BUDGET]: { label: 'Budget validation', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' },
  [ForecastStatus.APPROVED]: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  [ForecastStatus.REJECTED]: { label: 'Rejected', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
  [ForecastStatus.CANCELLED]: { label: 'Cancelled', color: 'bg-slate-600/10 text-slate-500 border-slate-600/20' },
};

interface LifecycleStepperProps {
  status: ForecastStatus;
  transitions?: ForecastTransition[];
}

/**
 * Horizontal stepper visualizing the forecast lifecycle. Shows the current
 * position, and per-step actor/date from the transition audit trail.
 */
export function LifecycleStepper({ status, transitions }: LifecycleStepperProps) {
  const currentIndex = LIFECYCLE_STEPS.findIndex((s) => s.status === status);
  const isTerminal = status === ForecastStatus.REJECTED || status === ForecastStatus.CANCELLED;

  // Last transition reaching each step (for actor/date under the dots)
  const stepMeta = new Map<ForecastStatus, ForecastTransition>();
  for (const t of transitions || []) {
    if (!stepMeta.has(t.toStatus) || stepMeta.get(t.toStatus)!.action === 'APPROVE') {
      stepMeta.set(t.toStatus, t);
    }
  }

  return (
    <div>
      <div className="flex items-center">
        {LIFECYCLE_STEPS.map((step, i) => {
          const reached = !isTerminal && currentIndex >= i;
          const isCurrent = !isTerminal && currentIndex === i;
          const meta = stepMeta.get(step.status);
          const icon = isCurrent ? (
            <Clock className="h-4 w-4 animate-pulse-soft" />
          ) : reached ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Circle className="h-4 w-4 opacity-40" />
          );
          return (
            <div key={step.status} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1 min-w-[72px]">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                    reached ? STEP_COLORS[step.status] : 'border-slate-700 bg-slate-900 text-slate-600'
                  }`}
                >
                  {icon}
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap ${reached ? 'text-slate-200' : 'text-slate-600'}`}>
                  {step.label}
                </span>
                {meta && reached && (
                  <span className="text-[10px] text-slate-500 whitespace-nowrap">
                    {meta.actorName.split(' ')[0]} · {new Date(meta.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
              {i < LIFECYCLE_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 mx-1 rounded ${!isTerminal && currentIndex > i ? 'bg-blue-500' : 'bg-slate-700'}`} />
              )}
            </div>
          );
        })}
      </div>
      {isTerminal && (
        <div className="mt-3 flex items-center gap-2">
          {status === ForecastStatus.REJECTED ? (
            <XCircle className="h-4 w-4 text-red-400" />
          ) : (
            <Circle className="h-4 w-4 text-slate-500" />
          )}
          <span className={`text-sm font-medium ${status === ForecastStatus.REJECTED ? 'text-red-400' : 'text-slate-400'}`}>
            {STATUS_BADGE[status].label}
          </span>
        </div>
      )}
    </div>
  );
}
