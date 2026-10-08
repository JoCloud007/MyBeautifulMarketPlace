import { useState, useEffect, useRef } from 'react';
import {
  useForecasts, useForecastStats, useForecastQueue, useGovernance,
  useCreateForecast, useForecastAction, useDeleteForecast,
  useProducts, useApplications, useContinuityLevels, useFlavors, useAvailabilityZones,
  useServiceNowStatus, useServiceNowSync,
} from '@/hooks/useApi';
import { useAuthStore } from '@/stores/useAuthStore';
import { TrendChart, StatusDonut, ResourceBarChart, DemandHeatmap } from '@/components/Charts';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { LifecycleStepper, STATUS_BADGE, LIFECYCLE_STEPS } from '@/components/LifecycleStepper';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Clock,
  CheckCircle,
  XCircle,
  BarChart3,
  Plus,
  Search,
  Trash2,
  ShieldCheck,
  FileText,
  Inbox,
  Send,
  Ban,
  RotateCcw,
  Scale,
  ExternalLink,
} from 'lucide-react';
import { ForecastStatus, Role, type Forecast, type ForecastTransition } from '@cloudmarket/shared-types';

type Tab = 'mine' | 'queues' | 'analytics' | 'governance';

const STEP_ROLE: Partial<Record<ForecastStatus, Role>> = {
  [ForecastStatus.PENDING_TECH]: Role.TECH_LEAD,
  [ForecastStatus.PENDING_MANAGER]: Role.MANAGER,
  [ForecastStatus.PENDING_BUDGET]: Role.FINANCE,
};

const ROLE_QUEUE_LABEL: Partial<Record<Role, { status: ForecastStatus; label: string }>> = {
  [Role.TECH_LEAD]: { status: ForecastStatus.PENDING_TECH, label: 'To review technically' },
  [Role.MANAGER]: { status: ForecastStatus.PENDING_MANAGER, label: 'To approve (manager)' },
  [Role.FINANCE]: { status: ForecastStatus.PENDING_BUDGET, label: 'To validate (budget)' },
};

const REJECTABLE: ForecastStatus[] = [
  ForecastStatus.PENDING_TECH,
  ForecastStatus.PENDING_MANAGER,
  ForecastStatus.PENDING_BUDGET,
];

function formatCost(cost: number | null | undefined, currency = 'EUR') {
  if (cost == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(cost);
}

/* Animated counter for stat cards */
function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(0);

  useEffect(() => {
    startValue.current = display;
    startTime.current = null;
    let raf: number;

    const animate = (timestamp: number) => {
      if (!startTime.current) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue.current + (value - startValue.current) * eased);
      setDisplay(current);
      if (progress < 1) {
        raf = requestAnimationFrame(animate);
      }
    };

    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span>{display}</span>;
}

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'} ${className || ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* ---------- Forecast detail panel with stepper ---------- */

function ForecastDetail({ forecast, onClose, canReject }: {
  forecast: Forecast;
  onClose: () => void;
  canReject: boolean;
}) {
  const reject = useForecastAction('reject');
  const [rejectReason, setRejectReason] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <Dialog open={!!forecast} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-3">
            Forecast detail
            <Badge variant="outline" className={STATUS_BADGE[forecast.status].color}>
              {STATUS_BADGE[forecast.status].label}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {forecast.requestedBy} · {forecast.requesterEmail} · {forecast.application?.name} · {forecast.environment}
            {forecast.targetDate && ` · target ${new Date(forecast.targetDate).toLocaleDateString('en-US')}`}
          </DialogDescription>
        </DialogHeader>

        {/* Lifecycle stepper */}
        <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
          <LifecycleStepper status={forecast.status} transitions={forecast.transitions} />
        </div>

        {/* Rejection reason banner */}
        {forecast.status === ForecastStatus.REJECTED && forecast.rejectionReason && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            <span className="font-medium">Rejection reason:</span> {forecast.rejectionReason}
            {forecast.reviewedBy && <span className="text-red-400/70"> — {forecast.reviewedBy}</span>}
          </div>
        )}

        {/* Lines */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">Lines</h4>
          <div className="rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="px-3 py-2">Product</th>
                  <th className="px-3 py-2">Flavor</th>
                  <th className="px-3 py-2">AZ</th>
                  <th className="px-3 py-2">Resiliency</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Unit cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {forecast.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-slate-200">{l.product?.name}</td>
                    <td className="px-3 py-2 text-slate-400">{l.flavor?.name} <span className="text-slate-600">({l.flavor?.vcpu} vCPU · {l.flavor?.ramGb} GB)</span></td>
                    <td className="px-3 py-2 text-slate-400">{l.azCode}</td>
                    <td className="px-3 py-2 text-slate-400">{l.resiliency}</td>
                    <td className="px-3 py-2 text-right text-slate-200">{l.quantity}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{formatCost(l.unitPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-between rounded-lg bg-slate-950/70 px-4 py-3">
            <span className="text-sm font-medium text-slate-300">Total estimated cost</span>
            <span className="text-lg font-bold text-blue-400">{formatCost(forecast.estimatedCost, forecast.costCurrency)}</span>
          </div>
        </div>

        {forecast.justification && (
          <div className="rounded-lg bg-slate-950/70 px-4 py-3 text-sm text-slate-400">
            <span className="font-medium text-slate-300">Justification:</span> {forecast.justification}
          </div>
        )}

        {/* Audit trail */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-slate-200">Audit trail</h4>
          <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-3">
            {(forecast.transitions || []).length === 0 && (
              <p className="text-xs text-slate-600">No transitions recorded.</p>
            )}
            {(forecast.transitions || []).map((t: ForecastTransition) => (
              <div key={t.id} className="flex items-start gap-2 text-xs">
                <span className="mt-0.5 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{t.action}</span>
                <span className="text-slate-300">{t.actorName}</span>
                {t.actorRole && <span className="rounded bg-blue-500/10 px-1.5 text-[10px] text-blue-400">{t.actorRole}</span>}
                <span className="text-slate-600">{t.fromStatus} → {t.toStatus}</span>
                {t.comment && <span className="min-w-0 flex-1 truncate text-slate-500" title={t.comment}>“{t.comment}”</span>}
                <span className="ml-auto shrink-0 text-slate-600">{new Date(t.createdAt).toLocaleString('en-US')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        {canReject && REJECTABLE.includes(forecast.status) && (
          <DialogFooter>
            {rejectOpen ? (
              <div className="w-full space-y-2">
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Rejection reason (mandatory)"
                  rows={2}
                  className="bg-slate-950 border-slate-700 text-white"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => setRejectOpen(false)} className="border-slate-700 text-slate-300">Cancel</Button>
                  <Button
                    size="sm"
                    disabled={!rejectReason.trim() || reject.isPending}
                    onClick={async () => {
                      await reject.mutateAsync({ id: forecast.id, comment: rejectReason.trim() });
                      setRejectOpen(false);
                      setRejectReason('');
                      onClose();
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    Confirm rejection
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setRejectOpen(true)} className="border-red-500/40 text-red-400 hover:bg-red-500/10">
                <XCircle className="mr-2 h-4 w-4" />
                Reject at this step
              </Button>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Forecast row (shared table cell content) ---------- */

function ForecastActions({ forecast, role }: { forecast: Forecast; role: Role | null }) {
  const approve = useForecastAction('approve');
  const cancel = useForecastAction('cancel');
  const resubmit = useForecastAction('resubmit');
  const submitAction = useForecastAction('submit');
  const [detailOpen, setDetailOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState('');
  const reject = useForecastAction('reject');

  const isRequester = role === Role.REQUESTER;
  const stepRole = STEP_ROLE[forecast.status];
  const canApprove = stepRole && (role === stepRole || role === Role.ADMIN);
  const canCancel = isRequester && [ForecastStatus.DRAFT, ForecastStatus.PENDING_TECH, ForecastStatus.PENDING_MANAGER].includes(forecast.status);
  const canResubmit = isRequester && forecast.status === ForecastStatus.REJECTED;
  const canSubmit = isRequester && forecast.status === ForecastStatus.DRAFT;

  return (
    <div className="flex items-center justify-end gap-1">
      {canSubmit && (
        <Button size="sm" variant="ghost" title="Submit for review" onClick={() => submitLater(forecast.id)} className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10">
          <Send className="h-4 w-4" />
        </Button>
      )}
      {canApprove && (
        <Button size="sm" variant="ghost" title="Approve" disabled={approve.isPending}
          onClick={() => approve.mutate({ id: forecast.id })}
          className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10">
          <CheckCircle className="h-4 w-4" />
        </Button>
      )}
      {canApprove && (
        <Button size="sm" variant="ghost" title="Reject (reason required)" onClick={() => setRejectOpen(true)} className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10">
          <XCircle className="h-4 w-4" />
        </Button>
      )}
      {canResubmit && (
        <Button size="sm" variant="ghost" title="Resubmit" disabled={resubmit.isPending}
          onClick={() => resubmit.mutate({ id: forecast.id })}
          className="h-8 w-8 p-0 text-blue-400 hover:bg-blue-500/10">
          <RotateCcw className="h-4 w-4" />
        </Button>
      )}
      {canCancel && (
        <Button size="sm" variant="ghost" title="Cancel" disabled={cancel.isPending}
          onClick={() => cancel.mutate({ id: forecast.id })}
          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-400 hover:bg-slate-500/10">
          <Ban className="h-4 w-4" />
        </Button>
      )}
      <Button size="sm" variant="ghost" title="Detail" onClick={() => setDetailOpen(true)} className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-500/10">
        <ExternalLink className="h-4 w-4" />
      </Button>

      {rejectOpen && (
        <div className="absolute right-4 z-10 w-64 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <p className="mb-2 text-xs font-medium text-slate-300">Rejection reason</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} className="mb-2 bg-slate-950 border-slate-700 text-white text-xs" placeholder="Why is this rejected?" />
          <div className="flex justify-end gap-1">
            <Button size="sm" variant="ghost" onClick={() => setRejectOpen(false)} className="h-7 px-2 text-xs text-slate-400">Cancel</Button>
            <Button size="sm" disabled={!reason.trim()} onClick={async () => { await reject.mutateAsync({ id: forecast.id, comment: reason.trim() }); setRejectOpen(false); setReason(''); }} className="h-7 bg-red-600 px-2 text-xs text-white hover:bg-red-700">Reject</Button>
          </div>
        </div>
      )}

      {detailOpen && <ForecastDetailWithRole forecast={forecast} onClose={() => setDetailOpen(false)} role={role} />}
    </div>
  );

  function submitLater(id: string) {
    submitAction.mutate({ id });
  }
}

// Separate small component so ForecastActions keeps its hooks tidy
function ForecastDetailWithRole({ forecast, onClose, role }: { forecast: Forecast; onClose: () => void; role: Role | null }) {
  const stepRole = STEP_ROLE[forecast.status];
  const canReject = !!stepRole && (role === stepRole || role === Role.ADMIN);
  return <ForecastDetail forecast={forecast} onClose={onClose} canReject={canReject} />;
}

/* ---------- Governance tab ---------- */

function GovernanceTab() {
  const { data: gov, isLoading, isError, refetch } = useGovernance();
  const { data: snow } = useServiceNowStatus();
  const sync = useServiceNowSync();

  if (isLoading) return <Skeleton className="h-96 rounded-xl bg-slate-800" />;
  if (isError) return <QueryError message="Unable to load governance data." onRetry={refetch} />;

  const stepMeta = new Map(gov?.steps.map((s) => [s.status, s]));

  return (
    <div className="space-y-6">
      {/* Lifecycle diagram */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-blue-500" />
            Lifecycle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {LIFECYCLE_STEPS.map((step, i) => (
              <div key={step.status} className="flex items-center gap-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3">
                  <p className="text-sm font-medium text-slate-200">{step.label}</p>
                  <p className="text-xs text-slate-500">
                    {gov?.steps.find((s) => s.status === step.status)?.role?.replace('_', ' ') || '—'}
                  </p>
                </div>
                {i < LIFECYCLE_STEPS.length - 1 && <span className="text-slate-600">→</span>}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            REJECTED possible at every approval step (reason mandatory, resubmittable) · CANCELLED by the requester (Draft → Manager step).
          </p>
        </CardContent>
      </Card>

      {/* Rules */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <Scale className="h-5 w-5 text-blue-500" />
            Governance rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {gov?.rules.map((rule) => (
              <div key={rule.id} className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-sm font-medium text-slate-200">{rule.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{rule.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Who approves what + SLA */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">Approval matrix</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2">Step</th>
                  <th className="pb-2">Responsible role</th>
                  <th className="pb-2 text-right">SLA target</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {gov?.sla.map((s) => (
                  <tr key={s.step}>
                    <td className="py-2 text-slate-200">{stepMeta.get(s.step)?.label || s.step}</td>
                    <td className="py-2"><Badge variant="outline" className="border-blue-500/20 text-blue-400">{stepMeta.get(s.step)?.role?.replace('_', ' ') || '—'}</Badge></td>
                    <td className="py-2 text-right text-slate-400">{s.targetDays} days</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white text-base">ServiceNow integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!snow || !snow.configured ? (
              <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-sm text-slate-300">ServiceNow: not configured</p>
                <p className="mt-1 text-xs text-slate-500">
                  Optional. Configure the instance URL, username and password in Admin → the application list can then be imported from the CMDB (cmdb_ci_appl).
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                <p className="text-sm text-slate-200">
                  Instance: <span className="text-slate-400">{snow.instanceUrl}</span>
                  <Badge variant="outline" className={`ml-2 ${snow.enabled ? 'border-emerald-500/20 text-emerald-400' : 'border-slate-500/20 text-slate-500'}`}>
                    {snow.enabled ? 'enabled' : 'disabled'}
                  </Badge>
                </p>
                <p className="text-xs text-slate-500">Table: {snow.snowTable} · last sync: {snow.lastSyncAt ? new Date(snow.lastSyncAt).toLocaleString('en-US') : 'never'}</p>
                {snow.lastSyncStatus === 'ERROR' && snow.lastSyncError && (
                  <p className="text-xs text-red-400">Last sync error: {snow.lastSyncError}</p>
                )}
                <Button size="sm" disabled={!snow.enabled || sync.isPending} onClick={() => sync.mutate()} className="bg-blue-600 text-white hover:bg-blue-700">
                  Sync now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent transitions (global audit) */}
      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white text-base">Recent transitions (global audit)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1.5">
            {(gov?.recentTransitions || []).length === 0 && <p className="text-xs text-slate-600">No transitions yet.</p>}
            {(gov?.recentTransitions || []).map((t) => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">{t.action}</span>
                <span className="text-slate-300">{t.actorName}</span>
                {t.actorRole && <span className="rounded bg-blue-500/10 px-1.5 text-[10px] text-blue-400">{t.actorRole}</span>}
                <span className="text-slate-600">{t.fromStatus} → {t.toStatus}</span>
                <span className="ml-auto text-slate-600">{new Date(t.createdAt).toLocaleString('en-US')}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------- Queues tab (role-based) ---------- */

function QueueSection({ role, onOpen }: { role: Role; onOpen: (f: Forecast) => void }) {
  const queue = ROLE_QUEUE_LABEL[role]!;
  const { data: forecasts, isLoading } = useForecastQueue(queue.status);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base text-white">
          <span className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-blue-500" />
            {queue.label}
          </span>
          <Badge variant="outline" className="border-blue-500/20 text-blue-400">{role.replace('_', ' ')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-24 rounded-lg bg-slate-800" />
        ) : (forecasts || []).length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-600">Empty queue — nothing waiting for this role.</p>
        ) : (
          <div className="space-y-2">
            {forecasts!.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpen(f)}>
                  <p className="truncate text-sm font-medium text-white">{f.lines?.[0]?.product?.name} × {f.lines?.[0]?.quantity}</p>
                  <p className="truncate text-xs text-slate-500">
                    {f.requestedBy} · {f.application?.name} · {formatCost(f.estimatedCost, f.costCurrency)} · waiting since {new Date(f.submittedAt || f.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <ForecastActions forecast={f} role={role} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Main page ---------- */

export default function Forecasts() {
  const { user } = useAuthStore();
  const { data: forecasts, isLoading: forecastsLoading, isError: forecastsError, refetch: refetchForecasts } = useForecasts();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useForecastStats();
  const { data: products } = useProducts();
  const { data: applications } = useApplications();
  const { data: continuityLevels } = useContinuityLevels();
  const { data: allFlavors } = useFlavors();
  const { data: zones } = useAvailabilityZones();
  const createForecast = useCreateForecast();
  const deleteForecast = useDeleteForecast();

  const [tab, setTab] = useState<Tab>('mine');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ForecastStatus | 'ALL'>('ALL');
  const [analyticsDays, setAnalyticsDays] = useState(30);
  const [detail, setDetail] = useState<Forecast | null>(null);

  const activeRole = user?.roles?.[0] || Role.REQUESTER;
  const roleQueues = (user?.roles || []).filter((r) => ROLE_QUEUE_LABEL[r]);

  const [formData, setFormData] = useState({
    requestedBy: '',
    requesterEmail: '',
    targetDate: new Date().toISOString().split('T')[0],
    justification: '',
    applicationId: '',
    environment: 'DEV' as 'PRD' | 'DEV' | 'STG',
  });
  const [lines, setLines] = useState<Array<{ productId: string; flavorId: string; azCode: string; quantity: number; osVersion?: string; resiliency?: 'STANDARD' | 'HA' | 'MULTI_AZ' }>>([]);
  const [draftLine, setDraftLine] = useState({ productId: '', flavorId: '', azSelections: {} as Record<string, number>, osVersion: '', resiliency: 'STANDARD' as 'STANDARD' | 'HA' | 'MULTI_AZ' });
  const [submitAfterCreate, setSubmitAfterCreate] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const selectedDraftProduct = products?.find((p) => p.id === draftLine.productId);
  const selectedDraftFlavor = allFlavors?.find((f) => f.id === draftLine.flavorId);
  const selectedApp = applications?.find((a) => a.id === formData.applicationId);
  const appContinuityLevel = continuityLevels?.find((cl) => cl.id === selectedApp?.continuityLevelId);

  const myForecasts = (forecasts || []).filter(
    (f) => user && (f.requesterEmail === user.email || f.requestedBy === user.name)
  );

  const filteredMine = myForecasts.filter((f) => {
    const matchesSearch =
      !searchQuery ||
      f.lines?.some((l) => l.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      f.requestedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pre-fill requester from the simulated identity
  useEffect(() => {
    if (user) {
      setFormData((prev) => ({ ...prev, requestedBy: user.name, requesterEmail: user.email }));
    }
  }, [user]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createForecast.mutateAsync({
      ...formData,
      submit: submitAfterCreate,
      lines: lines.map((l) => ({
        productId: l.productId,
        flavorId: l.flavorId,
        azCode: l.azCode,
        quantity: typeof l.quantity === 'string' ? parseInt(l.quantity, 10) : l.quantity,
        metadata: l.osVersion ? { osVersion: l.osVersion } : undefined,
        resiliency: l.resiliency || 'STANDARD',
      })),
    } as any);
    setIsCreateOpen(false);
    setLines([]);
  };

  const addLine = () => {
    if (!draftLine.productId || !draftLine.flavorId || Object.keys(draftLine.azSelections).length === 0) return;
    const newLines = Object.entries(draftLine.azSelections).map(([azCode, quantity]) => ({
      productId: draftLine.productId,
      flavorId: draftLine.flavorId,
      azCode,
      quantity,
      osVersion: draftLine.osVersion || undefined,
      resiliency: draftLine.resiliency,
    }));
    setLines([...lines, ...newLines]);
    setDraftLine({ productId: '', flavorId: '', azSelections: {}, osVersion: '', resiliency: 'STANDARD' });
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteForecast.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: BarChart3, color: 'text-blue-400' },
    { label: 'In review', value: (stats?.byStatus || []).filter((s) => s.status.startsWith('PENDING')).reduce((sum, s) => sum + s.count, 0), icon: Clock, color: 'text-amber-400' },
    { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Est. total cost', value: 0, display: formatCost(stats?.totalEstimatedCost), icon: Scale, color: 'text-cyan-400' },
  ];

  const hasError = forecastsError || statsError;
  const tabs: { key: Tab; label: string; icon: typeof FileText; badge?: number }[] = [
    { key: 'mine', label: 'My requests', icon: FileText },
    ...(roleQueues.length > 0 ? [{ key: 'queues' as Tab, label: 'Approval queues', icon: Inbox, badge: roleQueues.length }] : []),
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
    { key: 'governance', label: 'Governance', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Forecast</h1>
            <p className="mt-2 text-slate-400">
              {user ? (
                <>Acting as <span className="font-medium text-slate-200">{user.name}</span> · roles: {user.roles.join(', ').replace(/_/g, ' ')}</>
              ) : (
                'Pick an identity (top-right) to create requests and work approval queues.'
              )}
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            New request
          </Button>
        </div>
      </AnimatedSection>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-slate-800 pb-px">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-blue-500 bg-slate-900/50 text-white'
                  : 'text-slate-400 hover:bg-slate-900/30 hover:text-slate-200'
              }`}
            >
              <Icon className="h-4 w-4" />
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="rounded-full bg-red-500/20 px-1.5 text-[10px] font-semibold text-red-400">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>

      {hasError && tab !== 'governance' ? (
        <QueryError
          message="Unable to load dashboard data."
          onRetry={() => {
            if (forecastsError) refetchForecasts();
            if (statsError) refetchStats();
          }}
        />
      ) : (
        <>
          {/* ============ TAB: MY REQUESTS ============ */}
          {tab === 'mine' && (
            <div className="space-y-4">
              {/* Stats Cards */}
              {statsLoading ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-28 rounded-lg bg-slate-800 animate-pulse-soft" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {statCards.map((stat, i) => {
                    const Icon = stat.icon;
                    return (
                      <AnimatedSection key={stat.label} delay={i * 80}>
                        <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
                          <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium text-slate-400">{stat.label}</CardTitle>
                            <Icon className={`h-4 w-4 ${stat.color}`} />
                          </CardHeader>
                          <CardContent>
                            <div className="text-3xl font-bold text-white">
                              {stat.display ?? <AnimatedCounter value={stat.value} />}
                            </div>
                          </CardContent>
                        </Card>
                      </AnimatedSection>
                    );
                  })}
                </div>
              )}

              {/* Search + filter */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <Input placeholder="Search product or requester..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 min-h-[44px]" />
                </div>
                <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ForecastStatus | 'ALL')} className="w-48 bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="ALL">All statuses</option>
                  <option value="DRAFT">Draft</option>
                  <option value="PENDING_TECH">Tech review</option>
                  <option value="PENDING_MANAGER">Manager approval</option>
                  <option value="PENDING_BUDGET">Budget validation</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="CANCELLED">Cancelled</option>
                </Select>
              </div>

              {/* Request list */}
              {forecastsLoading ? (
                <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg bg-slate-800" />)}</div>
              ) : filteredMine.length === 0 ? (
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="py-12 text-center">
                    <FileText className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No requests yet</p>
                    <p className="mt-1 text-sm text-slate-600">Create your first forecast request with the button above.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {filteredMine.map((f) => (
                    <Card key={f.id} className="bg-slate-900 border-slate-800 transition-colors hover:border-slate-700">
                      <CardContent className="flex items-center gap-3 p-4">
                        <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetail(f)}>
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium text-white">{f.lines?.[0]?.product?.name} × {f.lines?.[0]?.quantity}</p>
                            <Badge variant="outline" className={`shrink-0 ${STATUS_BADGE[f.status].color}`}>
                              {STATUS_BADGE[f.status].label}
                            </Badge>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-slate-500">
                            {f.application?.name} · {f.lines?.length} line(s) · {formatCost(f.estimatedCost, f.costCurrency)} · {new Date(f.createdAt).toLocaleDateString('en-US')}
                          </p>
                          {f.status === ForecastStatus.REJECTED && f.rejectionReason && (
                            <p className="mt-1 truncate text-xs text-red-400">Rejection: {f.rejectionReason}</p>
                          )}
                        </div>
                        <ForecastActions forecast={f} role={Role.REQUESTER} />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ============ TAB: QUEUES ============ */}
          {tab === 'queues' && (
            <div className="space-y-4">
              {roleQueues.length === 0 ? (
                <Card className="bg-slate-900 border-slate-800">
                  <CardContent className="py-12 text-center">
                    <Inbox className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No approval queue for this identity</p>
                    <p className="mt-1 text-sm text-slate-600">Switch to a TECH_LEAD, MANAGER or FINANCE identity to see approval queues.</p>
                  </CardContent>
                </Card>
              ) : (
                roleQueues.map((r) => <QueueSection key={r} role={r} onOpen={setDetail} />)
              )}
            </div>
          )}

          {/* ============ TAB: ANALYTICS ============ */}
          {tab === 'analytics' && (
            <AnimatedSection delay={100}>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-blue-500" />
                      Analytics
                    </span>
                    <div className="flex gap-1">
                      {[7, 30, 90].map((d) => (
                        <button
                          key={d}
                          onClick={() => setAnalyticsDays(d)}
                          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                            analyticsDays === d
                              ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {d}d
                        </button>
                      ))}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 lg:grid-cols-2">
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Request Trends</h4>
                      <TrendChart days={analyticsDays} />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Status Distribution</h4>
                      <StatusDonut />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Resources by Zone</h4>
                      <ResourceBarChart />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-400 mb-3">Product Demand Heatmap</h4>
                      <DemandHeatmap />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          )}

          {/* ============ TAB: GOVERNANCE ============ */}
          {tab === 'governance' && <GovernanceTab />}
        </>
      )}

      {/* ============ CREATE DIALOG (template conservé) ============ */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden bg-slate-900 border-slate-700 p-0">
          <DialogHeader className="border-b border-slate-800 p-6 pb-4">
            <DialogTitle className="text-white">New forecast request</DialogTitle>
            <DialogDescription className="text-slate-400">
              The request is created as a draft — submit it when ready, or submit directly.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="grid max-h-[60vh] overflow-y-auto md:grid-cols-[1fr_260px]">
              {/* LEFT: builder */}
              <div className="space-y-5 p-6">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">1</div>
                  <label className="text-sm font-semibold text-slate-200">Lines</label>
                </div>
                <div className="space-y-3">
                  <Select value={draftLine.productId} onChange={(e) => setDraftLine({ ...draftLine, productId: e.target.value, flavorId: '', azSelections: {} })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                    <option value="">1. Select product...</option>
                    {products?.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </Select>

                  {selectedDraftProduct && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase tracking-wide">2. Flavor</label>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {allFlavors?.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setDraftLine({ ...draftLine, flavorId: f.id, azSelections: {} })}
                            className={`rounded-lg border p-3 text-left transition-all ${
                              draftLine.flavorId === f.id
                                ? 'border-blue-500 bg-blue-500/10 text-blue-300'
                                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                            }`}
                          >
                            <div className="text-sm font-bold text-white">{f.name}</div>
                            <div className="text-xs text-slate-400 mt-1">{f.vcpu} vCPU · {f.ramGb} GB</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedDraftProduct && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase tracking-wide">3. Operating System Version</label>
                      <Input
                        value={draftLine.osVersion}
                        onChange={(e) => setDraftLine({ ...draftLine, osVersion: e.target.value })}
                        placeholder="e.g. debian-12, windows-server-2022"
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      />
                    </div>
                  )}

                  {selectedDraftFlavor && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase tracking-wide">4. Resiliency</label>
                      <div className="flex gap-2">
                        {(['STANDARD', 'HA', 'MULTI_AZ'] as const).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setDraftLine({ ...draftLine, resiliency: r })}
                            className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              draftLine.resiliency === r
                                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {r === 'STANDARD' ? 'Standard' : r === 'HA' ? 'HA' : 'Multi-AZ'}
                          </button>
                        ))}
                      </div>
                      {draftLine.resiliency !== 'STANDARD' && (
                        <p className="text-xs text-amber-400">Requires at least 2 distinct availability zones</p>
                      )}
                    </div>
                  )}

                  {selectedDraftFlavor && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-400 uppercase tracking-wide">5. Regions & Quantities</label>
                      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                        {zones?.map((z) => {
                          const isSelected = draftLine.azSelections[z.code] !== undefined;
                          return (
                            <div key={z.id} className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const newSelections = { ...draftLine.azSelections };
                                  if (isSelected) {
                                    delete newSelections[z.code];
                                  } else {
                                    newSelections[z.code] = 1;
                                  }
                                  setDraftLine({ ...draftLine, azSelections: newSelections });
                                }}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all text-left ${
                                  isSelected
                                    ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                                    : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                                }`}
                              >
                                {isSelected ? '✓ ' : ''}{z.name}
                              </button>
                              {isSelected && (
                                <Input
                                  type="number"
                                  min={1}
                                  value={draftLine.azSelections[z.code]}
                                  onChange={(e) => {
                                    const qty = parseInt(e.target.value) || 1;
                                    setDraftLine({
                                      ...draftLine,
                                      azSelections: { ...draftLine.azSelections, [z.code]: qty },
                                    });
                                  }}
                                  className="w-20 bg-slate-950 border-slate-700 text-white text-center text-sm h-9 px-1"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <Button
                    type="button"
                    onClick={addLine}
                    disabled={!draftLine.productId || !draftLine.flavorId || Object.keys(draftLine.azSelections).length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full min-h-[44px]"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">i</div>
                  <label className="text-sm font-semibold text-slate-200">Request Info</label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Requester</label>
                    <Input
                      value={formData.requestedBy}
                      onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                      placeholder="Name"
                      required
                      className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Email</label>
                    <Input
                      type="email"
                      value={formData.requesterEmail}
                      onChange={(e) => setFormData({ ...formData, requesterEmail: e.target.value })}
                      placeholder="email@example.com"
                      required
                      className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 min-h-[44px]"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Application</label>
                    <Select
                      value={formData.applicationId}
                      onChange={(e) => setFormData({ ...formData, applicationId: e.target.value })}
                      required
                      className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="">Select application...</option>
                      {applications?.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.source === 'SNOW' ? ' (SNOW)' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Target Date</label>
                    <Input
                      type="date"
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                      className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    />
                  </div>
                </div>
                {appContinuityLevel && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-xs text-slate-500">Continuity:</span>
                    <Badge variant="outline" className={
                      appContinuityLevel.color === 'red' ? 'border-red-500/20 text-red-500' :
                      appContinuityLevel.color === 'orange' ? 'border-orange-500/20 text-orange-500' :
                      appContinuityLevel.color === 'yellow' ? 'border-yellow-500/20 text-yellow-500' :
                      'border-green-500/20 text-green-500'
                    }>
                      {appContinuityLevel.name}
                    </Badge>
                    <span className="text-xs text-slate-500">RTO {appContinuityLevel.rtoMinutes}m · RPO {appContinuityLevel.rpoMinutes}m</span>
                  </div>
                )}
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Environment</label>
                  <div className="flex gap-2">
                    {(['DEV', 'STG', 'PRD'] as const).map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => setFormData({ ...formData, environment: env })}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          formData.environment === env
                            ? env === 'PRD' ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                            : 'bg-slate-800 text-slate-400 border border-slate-700 hover:bg-slate-700'
                        }`}
                      >
                        {env}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Justification</label>
                  <Textarea
                    value={formData.justification}
                    onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                    placeholder="Why do you need this?"
                    rows={3}
                    className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={submitAfterCreate}
                    onChange={(e) => setSubmitAfterCreate(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950"
                  />
                  Submit immediately (otherwise saved as draft)
                </label>
              </div>

              {/* RIGHT: summary */}
              <div className="bg-slate-800/30 border-l border-slate-800 p-4">
                <div className="sticky top-6 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200">Summary</h3>
                  {lines.length === 0 && <p className="text-sm text-slate-500">Add lines to see the summary</p>}
                  {lines.map((line, idx) => {
                    const p = products?.find((pr) => pr.id === line.productId);
                    const f = allFlavors?.find((fl) => fl.id === line.flavorId);
                    const lineCost = f ? (f.vcpu * 10 + f.ramGb * 3) * line.quantity : 0;
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium truncate">{p?.name}</span>
                          <button type="button" onClick={() => removeLine(idx)} className="ml-1 shrink-0 text-slate-600 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>
                        <div className="text-xs text-slate-400">{f?.name} · {line.azCode} · x{line.quantity}</div>
                        <div className="text-xs text-slate-500">{formatCost(lineCost)}/mo</div>
                        {idx < lines.length - 1 && <div className="h-px bg-slate-700 my-2" />}
                      </div>
                    );
                  })}
                  {lines.length > 0 && (
                    <>
                      <div className="h-px bg-slate-700" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-200">Total est.</span>
                        <span className="text-lg font-bold text-blue-400">
                          {formatCost(lines.reduce((sum, l) => {
                            const f = allFlavors?.find((fl) => fl.id === l.flavorId);
                            return sum + (f ? (f.vcpu * 10 + f.ramGb * 3) * l.quantity : 0);
                          }, 0))}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600">10 €/vCPU + 3 €/GB per month</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter className="border-t border-slate-800 p-4">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white min-h-[44px]">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createForecast.isPending || lines.length === 0}
                className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
              >
                {createForecast.isPending ? 'Creating...' : submitAfterCreate ? 'Create & Submit' : 'Save Draft'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Detail dialog (from My requests) */}
      {detail && <ForecastDetailWithRole forecast={detail} onClose={() => setDetail(null)} role={activeRole} />}

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Request"
        description="Are you sure you want to delete this request? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}
