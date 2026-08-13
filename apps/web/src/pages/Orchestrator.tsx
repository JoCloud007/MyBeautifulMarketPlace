import { useState, useMemo } from 'react';
import {
  useMaintenanceAlerts,
  useMaintenanceSchedule,
  useMaintenanceImpact,
  useOrchestratorStats,
  useApplications,
  useInstances,
} from '@/hooks/useApi';
import { useToastStore } from '@/stores/useToastStore';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BrainCircuit,
  AlertTriangle,
  AlertCircle,
  Info,
  Calendar,
  Clock,
  Wrench,
  ShieldAlert,
  Activity,
  MapPin,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Zap,
  CheckCircle,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import type { MaintenanceAlert, AlertSeverity, AlertCategory, MaintenanceRecommendation } from '@cloudmarket/shared-types';

const severityConfig: Record<AlertSeverity, { label: string; color: string; icon: typeof AlertTriangle }> = {
  CRITICAL: { label: 'Critical', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: ShieldAlert },
  WARNING: { label: 'Warning', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle },
  INFO: { label: 'Info', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Info },
};

const categoryConfig: Record<AlertCategory, { label: string; color: string }> = {
  LIFECYCLE: { label: 'Lifecycle', color: 'border-purple-500/20 text-purple-400' },
  COMPLIANCE: { label: 'Compliance', color: 'border-red-500/20 text-red-400' },
  HEALTH: { label: 'Health', color: 'border-emerald-500/20 text-emerald-400' },
  SCHEDULING: { label: 'Scheduling', color: 'border-blue-500/20 text-blue-400' },
  MAINTENANCE: { label: 'Maintenance', color: 'border-amber-500/20 text-amber-400' },
};

const impactConfig: Record<string, { label: string; color: string }> = {
  LOW: { label: 'Low Impact', color: 'border-emerald-500/20 text-emerald-400' },
  MEDIUM: { label: 'Medium Impact', color: 'border-amber-500/20 text-amber-400' },
  HIGH: { label: 'High Impact', color: 'border-red-500/20 text-red-400' },
};

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

function AlertCard({ alert }: { alert: MaintenanceAlert }) {
  const severity = severityConfig[alert.severity];
  const SeverityIcon = severity.icon;
  const category = categoryConfig[alert.category];
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SeverityIcon className={`h-5 w-5 shrink-0 mt-0.5 ${alert.severity === 'CRITICAL' ? 'text-red-500' : alert.severity === 'WARNING' ? 'text-amber-500' : 'text-blue-400'}`} />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">{alert.title}</p>
            <p className="text-sm text-slate-400 mt-0.5">{alert.message}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`gap-1 ${severity.color}`}>
            {severity.label}
          </Badge>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={`text-[10px] ${category.color}`}>
          {category.label}
        </Badge>
        <span className="text-xs text-slate-600">
          {alert.affectedResource.type}: {alert.affectedResource.name}
        </span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 animate-fade-in">
          <p className="text-sm text-slate-400">
            <span className="font-medium text-slate-300">Suggested action:</span> {alert.suggestedAction}
          </p>
          {alert.expiresAt && (
            <p className="text-xs text-slate-500 mt-1">
              Expires: {new Date(alert.expiresAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: MaintenanceRecommendation }) {
  const impact = impactConfig[rec.estimatedImpact];
  const [expanded, setExpanded] = useState(false);
  const start = new Date(rec.suggestedWindow.startTime);
  const end = new Date(rec.suggestedWindow.endTime);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 hover:border-slate-700 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${rec.priority <= 2 ? 'bg-red-500/10 text-red-500' : rec.priority <= 3 ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium text-white">{rec.title}</p>
            <p className="text-sm text-slate-400 mt-0.5">{rec.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="outline" className={`text-[10px] ${impact.color}`}>
            {impact.label}
          </Badge>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-slate-800 text-slate-500 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {start.toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
        <span className="flex items-center gap-1">
          <ArrowRight className="h-3 w-3" />
          {rec.suggestedWindow.durationHours}h
        </span>
      </div>
      {expanded && (
        <div className="mt-3 pt-3 border-t border-slate-800 animate-fade-in space-y-2">
          <div>
            <p className="text-xs font-medium text-slate-400 mb-1">Rationale:</p>
            <ul className="space-y-1">
              {rec.rationale.map((r, i) => (
                <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                  <CheckCircle className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default function OrchestratorPage() {
  const { data: alerts, isLoading: alertsLoading, isError: alertsError, refetch: refetchAlerts } = useMaintenanceAlerts();
  const { data: schedule, isLoading: scheduleLoading, isError: scheduleError, refetch: refetchSchedule } = useMaintenanceSchedule();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useOrchestratorStats();
  const { data: applications } = useApplications();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { data: _instances } = useInstances();

  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | 'ALL'>('ALL');

  // Impact analyzer state
  const [impactAppId, setImpactAppId] = useState('');
  const [impactStart, setImpactStart] = useState('');
  const [impactEnd, setImpactEnd] = useState('');
  const [impactResult, setImpactResult] = useState<any>(null);

  const impactMutation = useMaintenanceImpact();

  const filteredAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a) => {
      const matchesSearch =
        !searchQuery ||
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.message.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSeverity = severityFilter === 'ALL' || a.severity === severityFilter;
      const matchesCategory = categoryFilter === 'ALL' || a.category === categoryFilter;
      return matchesSearch && matchesSeverity && matchesCategory;
    });
  }, [alerts, searchQuery, severityFilter, categoryFilter]);

  const criticalCount = alerts?.filter((a) => a.severity === 'CRITICAL').length ?? 0;
  const warningCount = alerts?.filter((a) => a.severity === 'WARNING').length ?? 0;
  const infoCount = alerts?.filter((a) => a.severity === 'INFO').length ?? 0;

  const hasError = alertsError || scheduleError || statsError;

  const handleImpactAnalyze = async () => {
    if (!impactAppId || !impactStart || !impactEnd) return;
    try {
      const result = await impactMutation.mutateAsync({
        applicationId: impactAppId,
        startTime: new Date(impactStart).toISOString(),
        endTime: new Date(impactEnd).toISOString(),
      });
      setImpactResult(result);
    } catch (err: any) {
      setImpactResult(null);
      const addToast = useToastStore.getState().addToast;
      addToast(err?.message || 'Impact analysis failed', 'error');
    }
  };

  const statCards = [
    { label: 'Total Alerts', value: stats?.totalAlerts ?? 0, icon: AlertCircle, color: 'text-blue-400', sub: `${stats?.criticalAlerts ?? 0} critical` },
    { label: 'Critical', value: stats?.criticalAlerts ?? 0, icon: ShieldAlert, color: 'text-red-400', sub: 'Needs immediate action' },
    { label: 'Warnings', value: stats?.warningAlerts ?? 0, icon: AlertTriangle, color: 'text-amber-400', sub: 'Review recommended' },
    { label: 'Upcoming', value: stats?.upcomingMaintenanceWindows ?? 0, icon: Calendar, color: 'text-emerald-400', sub: 'Scheduled windows' },
    { label: 'Overdue', value: stats?.overdueWindows ?? 0, icon: Clock, color: 'text-red-400', sub: 'Past due' },
    { label: 'Lifecycle (30d)', value: stats?.lifecycleTransitions30Days ?? 0, icon: Activity, color: 'text-purple-400', sub: 'Transitions ahead' },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BrainCircuit className="h-8 w-8 text-blue-500" />
            Maintenance Orchestrator
          </h1>
          <p className="text-slate-400">
            Lifecycle-aware scheduling, intelligent alerting, and impact analysis for your infrastructure maintenance.
          </p>
        </div>
      </AnimatedSection>

      {hasError ? (
        <QueryError message="Unable to load orchestrator data." onRetry={() => { refetchAlerts(); refetchSchedule(); }} />
      ) : (
        <>
          {/* Stats Cards */}
          {statsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg bg-slate-800 animate-pulse-soft" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {statCards.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <AnimatedSection key={stat.label} delay={i * 60}>
                    <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
                      <CardContent className="flex items-center gap-4 py-5">
                        <Icon className={`h-8 w-8 ${stat.color}`} />
                        <div>
                          <p className="text-xs text-slate-500">{stat.label}</p>
                          <p className="text-2xl font-bold text-white">{stat.value}</p>
                          <p className="text-[10px] text-slate-600">{stat.sub}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedSection>
                );
              })}
            </div>
          )}

          {/* Two-column layout: Alerts + Recommendations */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Alerts Panel */}
            <AnimatedSection delay={100}>
              <Card className="bg-slate-900 border-slate-800 h-full">
                <CardHeader>
                  <CardTitle className="text-white flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-red-500" />
                      Active Alerts
                    </span>
                    <div className="flex items-center gap-1.5">
                      {criticalCount > 0 && (
                        <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20 text-[10px]">
                          {criticalCount} critical
                        </Badge>
                      )}
                      {warningCount > 0 && (
                        <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 text-[10px]">
                          {warningCount} warning
                        </Badge>
                      )}
                      {infoCount > 0 && (
                        <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 text-[10px]">
                          {infoCount} info
                        </Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Filters */}
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <Input
                        placeholder="Search alerts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-slate-500" />
                      <Select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'ALL')}
                        className="w-28 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      >
                        <option value="ALL">All</option>
                        <option value="CRITICAL">Critical</option>
                        <option value="WARNING">Warning</option>
                        <option value="INFO">Info</option>
                      </Select>
                      <Select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as AlertCategory | 'ALL')}
                        className="w-32 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      >
                        <option value="ALL">All cats</option>
                        <option value="LIFECYCLE">Lifecycle</option>
                        <option value="COMPLIANCE">Compliance</option>
                        <option value="HEALTH">Health</option>
                        <option value="SCHEDULING">Scheduling</option>
                        <option value="MAINTENANCE">Maint</option>
                      </Select>
                    </div>
                  </div>

                  {/* Alert list */}
                  {alertsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-lg bg-slate-800 animate-pulse-soft" />
                      ))}
                    </div>
                  ) : filteredAlerts.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckCircle className="mx-auto h-10 w-10 text-emerald-500/50" />
                      <p className="mt-3 text-sm font-medium text-slate-400">No alerts match your filters</p>
                      <p className="text-xs text-slate-600">
                        {searchQuery || severityFilter !== 'ALL' || categoryFilter !== 'ALL'
                          ? 'Try adjusting your filters.'
                          : 'All systems look good!'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                      {filteredAlerts.map((alert) => (
                        <AlertCard key={alert.id} alert={alert} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Recommendations + Impact Analyzer */}
            <div className="space-y-6">
              <AnimatedSection delay={120}>
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Intelligent Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {scheduleLoading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-24 rounded-lg bg-slate-800 animate-pulse-soft" />
                        ))}
                      </div>
                    ) : !schedule || schedule.length === 0 ? (
                      <div className="text-center py-8">
                        <Wrench className="mx-auto h-10 w-10 text-slate-700" />
                        <p className="mt-3 text-sm font-medium text-slate-400">No recommendations yet</p>
                        <p className="text-xs text-slate-600">Recommendations appear when applications need maintenance.</p>
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
                        {schedule.map((rec) => (
                          <RecommendationCard key={rec.id} rec={rec} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </AnimatedSection>

              {/* Impact Analyzer */}
              <AnimatedSection delay={140}>
                <Card className="bg-slate-900 border-slate-800">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-blue-500" />
                      Impact Analyzer
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Application</label>
                        <Select
                          value={impactAppId}
                          onChange={(e) => setImpactAppId(e.target.value)}
                          className="w-full bg-slate-950 border-slate-700 text-white min-h-[44px]"
                        >
                          <option value="">Select application</option>
                          {applications?.map((app) => (
                            <option key={app.id} value={app.id}>{app.name}</option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Start Time</label>
                        <Input
                          type="datetime-local"
                          value={impactStart}
                          onChange={(e) => setImpactStart(e.target.value)}
                          className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">End Time</label>
                        <Input
                          type="datetime-local"
                          value={impactEnd}
                          onChange={(e) => setImpactEnd(e.target.value)}
                          className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          onClick={handleImpactAnalyze}
                          disabled={!impactAppId || !impactStart || !impactEnd || impactMutation.isPending}
                          className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md text-sm font-medium transition-colors min-h-[44px]"
                        >
                          {impactMutation.isPending ? 'Analyzing...' : 'Analyze Impact'}
                        </button>
                      </div>
                    </div>

                    {impactResult && (
                      <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950 p-4 animate-fade-in space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {impactResult.canProceed ? (
                              <CheckCircle className="h-5 w-5 text-emerald-500" />
                            ) : (
                              <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className={`font-medium ${impactResult.canProceed ? 'text-emerald-400' : 'text-red-400'}`}>
                              {impactResult.canProceed ? 'Maintenance can proceed' : 'Maintenance blocked'}
                            </span>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              impactResult.riskLevel === 'CRITICAL'
                                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                : impactResult.riskLevel === 'HIGH'
                                  ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                  : impactResult.riskLevel === 'MEDIUM'
                                    ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                    : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                            }
                          >
                            {impactResult.riskLevel} Risk
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div className="bg-slate-900 rounded p-2">
                            <p className="text-xs text-slate-500">Current Compliance</p>
                            <p className="font-medium text-white">{impactResult.complianceImpact.currentScore}/100</p>
                          </div>
                          <div className="bg-slate-900 rounded p-2">
                            <p className="text-xs text-slate-500">Projected Compliance</p>
                            <p className={`font-medium ${impactResult.complianceImpact.projectedScore < impactResult.complianceImpact.currentScore ? 'text-red-400' : 'text-emerald-400'}`}>
                              {impactResult.complianceImpact.projectedScore}/100
                            </p>
                          </div>
                        </div>

                        {impactResult.conflictingWindows.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-red-400 mb-1">Conflicting Windows:</p>
                            {impactResult.conflictingWindows.map((w: any) => (
                              <p key={w.id} className="text-xs text-slate-500">• {w.title}: {new Date(w.startTime).toLocaleString()}</p>
                            ))}
                          </div>
                        )}

                        {impactResult.lifecycleWarnings.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-amber-400 mb-1">Lifecycle Warnings:</p>
                            {impactResult.lifecycleWarnings.map((lw: any, i: number) => (
                              <p key={i} className="text-xs text-slate-500">• {lw.warning}</p>
                            ))}
                          </div>
                        )}

                        {impactResult.recommendations.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-blue-400 mb-1">Recommendations:</p>
                            {impactResult.recommendations.map((r: string, i: number) => (
                              <p key={i} className="text-xs text-slate-500">• {r}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </AnimatedSection>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
