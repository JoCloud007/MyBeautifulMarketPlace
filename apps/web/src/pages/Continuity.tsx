import { useMemo } from 'react';
import { useApplications, useContinuityLevels, useInstances, useHealthChecks, useMaintenanceWindows } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Calendar,
  Server,
  TrendingUp,
  Activity,
} from 'lucide-react';
import type { HealthStatus } from '@cloudmarket/shared-types';

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

const healthColor: Record<HealthStatus, string> = {
  HEALTHY: 'text-emerald-500',
  DEGRADED: 'text-amber-500',
  UNHEALTHY: 'text-red-500',
};

const continuityColor: Record<string, string> = {
  LOW: 'bg-green-500/10 text-green-500 border-green-500/20',
  MODERATE: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  SERIOUS: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  EXTREME: 'bg-red-500/10 text-red-500 border-red-500/20',
};

export default function ContinuityPage() {
  const { data: applications, isLoading: appsLoading, isError: appsError } = useApplications();
  const { data: continuityLevels, isLoading: clLoading } = useContinuityLevels();
  const { data: instances, isLoading: instLoading } = useInstances();
  const { data: healthChecks, isLoading: hcLoading } = useHealthChecks();
  const { data: maintenanceWindows, isLoading: mwLoading } = useMaintenanceWindows();

  const isLoading = appsLoading || clLoading || instLoading || hcLoading || mwLoading;
  const isError = appsError;

  const stats = useMemo(() => {
    if (!applications || !instances || !healthChecks || !maintenanceWindows) return null;

    const appHealthMap = new Map<string, HealthStatus>();
    for (const check of healthChecks) {
      const appId = check.instance?.applicationId;
      if (!appId) continue;
      const current = appHealthMap.get(appId);
      if (!current || (current === 'HEALTHY' && check.status !== 'HEALTHY') || (current === 'DEGRADED' && check.status === 'UNHEALTHY')) {
        appHealthMap.set(appId, check.status);
      }
    }

    const healthyApps = Array.from(appHealthMap.values()).filter((s) => s === 'HEALTHY').length;
    const degradedApps = Array.from(appHealthMap.values()).filter((s) => s === 'DEGRADED').length;
    const unhealthyApps = Array.from(appHealthMap.values()).filter((s) => s === 'UNHEALTHY').length;

    const now = new Date();
    const upcomingMw = maintenanceWindows.filter((w) => new Date(w.startTime) > now && w.status !== 'CANCELLED');

    return {
      totalApps: applications.length,
      totalInstances: instances.length,
      healthyApps,
      degradedApps,
      unhealthyApps,
      upcomingMaintenance: upcomingMw.length,
      avgRto: continuityLevels ? Math.round(continuityLevels.reduce((sum, cl) => sum + cl.rtoMinutes, 0) / (continuityLevels.length || 1)) : 0,
    };
  }, [applications, instances, healthChecks, maintenanceWindows, continuityLevels]);

  const appsByContinuity = useMemo(() => {
    if (!applications || !continuityLevels) return [];
    return continuityLevels.map((cl) => ({
      ...cl,
      apps: applications.filter((a) => a.continuityLevelId === cl.id),
    }));
  }, [applications, continuityLevels]);

  const upcomingMaintenance = useMemo(() => {
    if (!maintenanceWindows) return [];
    const now = new Date();
    return maintenanceWindows
      .filter((w) => new Date(w.startTime) > now && w.status !== 'CANCELLED')
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      .slice(0, 5);
  }, [maintenanceWindows]);

  if (isError) {
    return <QueryError message="Unable to load continuity dashboard." />;
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Continuity Dashboard</h1>
          <p className="text-slate-400">
            Overview of application resilience, health status, and operational continuity.
          </p>
        </div>
      </AnimatedSection>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AnimatedSection delay={0}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Applications</CardTitle>
                <Shield className="h-4 w-4 text-blue-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.totalApps}</div>
                <p className="text-xs text-slate-500 mt-1">{stats?.totalInstances} instances total</p>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={60}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Healthy</CardTitle>
                <CheckCircle className="h-4 w-4 text-emerald-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.healthyApps}</div>
                <p className="text-xs text-slate-500 mt-1">All systems operational</p>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={120}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Needs Attention</CardTitle>
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{(stats?.degradedApps ?? 0) + (stats?.unhealthyApps ?? 0)}</div>
                <p className="text-xs text-slate-500 mt-1">
                  {stats?.degradedApps} degraded · {stats?.unhealthyApps} unhealthy
                </p>
              </CardContent>
            </Card>
          </AnimatedSection>
          <AnimatedSection delay={180}>
            <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">Upcoming Maintenance</CardTitle>
                <Calendar className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-white">{stats?.upcomingMaintenance}</div>
                <p className="text-xs text-slate-500 mt-1">Scheduled windows</p>
              </CardContent>
            </Card>
          </AnimatedSection>
        </div>
      )}

      {/* Continuity Levels */}
      <AnimatedSection delay={200}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Resilience by Continuity Level
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg bg-slate-800 animate-pulse-soft" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {appsByContinuity.map((cl) => (
                  <div key={cl.id} className="rounded-lg border border-slate-800 bg-slate-950/50 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className={continuityColor[cl.name] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
                          {cl.name}
                        </Badge>
                        <span className="text-sm text-slate-400">
                          RTO {cl.rtoMinutes}m · RPO {cl.rpoMinutes}m
                        </span>
                      </div>
                      <span className="text-sm font-medium text-white">{cl.apps.length} apps</span>
                    </div>
                    {cl.apps.length === 0 ? (
                      <p className="text-sm text-slate-600">No applications assigned</p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {cl.apps.map((app) => {
                          const appInstances = instances?.filter((i) => i.applicationId === app.id) ?? [];
                          const appHealth = healthChecks?.filter((h) => h.instance?.applicationId === app.id) ?? [];
                          const worstHealth = appHealth.length > 0
                            ? appHealth.some((h) => h.status === 'UNHEALTHY')
                              ? 'UNHEALTHY'
                              : appHealth.some((h) => h.status === 'DEGRADED')
                              ? 'DEGRADED'
                              : 'HEALTHY'
                            : null;
                          return (
                            <div key={app.id} className="flex items-center gap-3 rounded-md bg-slate-900 px-3 py-2 border border-slate-800">
                              <div className={`w-2 h-2 rounded-full ${worstHealth === 'UNHEALTHY' ? 'bg-red-500' : worstHealth === 'DEGRADED' ? 'bg-amber-500' : worstHealth === 'HEALTHY' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-white truncate">{app.name}</p>
                                <p className="text-xs text-slate-500">{appInstances.length} instances</p>
                              </div>
                              {worstHealth && (
                                <span className={`text-xs ${healthColor[worstHealth]}`}>
                                  {worstHealth === 'HEALTHY' ? <CheckCircle className="h-3.5 w-3.5" /> : worstHealth === 'DEGRADED' ? <AlertTriangle className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Upcoming Maintenance */}
      <AnimatedSection delay={250}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-500" />
              Upcoming Maintenance
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
                ))}
              </div>
            ) : upcomingMaintenance.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-2 text-sm text-slate-500">No upcoming maintenance scheduled</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingMaintenance.map((w) => (
                  <div key={w.id} className="flex items-center gap-4 rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                      <Clock className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white">{w.title}</p>
                      <p className="text-xs text-slate-500">
                        {w.instance ? (
                          <span className="flex items-center gap-1 inline-flex">
                            <Server className="h-3 w-3" />
                            {w.instance.name}
                          </span>
                        ) : w.application ? (
                          <span className="flex items-center gap-1 inline-flex">
                            <Activity className="h-3 w-3" />
                            {w.application.name}
                          </span>
                        ) : (
                          'Global'
                        )}
                        {' · '}
                        {new Date(w.startTime).toLocaleDateString()} {new Date(w.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <Badge variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0">
                      Scheduled
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
