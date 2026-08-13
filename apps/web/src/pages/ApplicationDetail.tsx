import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApplication, useInstances, useForecasts, useContinuityLevels } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Layers,
  Shield,
  Server,
  BarChart3,
  User,
  Clock,
  Calendar,
  CheckCircle,
  XCircle,
  Clock4,
  AlertTriangle,
} from 'lucide-react';
import { ApprovalStatus, InstanceStatus } from '@cloudmarket/shared-types';

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

const continuityColor: Record<string, string> = {
  LOW: 'bg-green-500/10 text-green-500 border-green-500/20',
  MODERATE: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  SERIOUS: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
  EXTREME: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const statusConfig: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' },
  APPROVED: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  REJECTED: { label: 'Rejected', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

const instanceStatusConfig: Record<InstanceStatus, { label: string; color: string; icon: typeof Clock4 }> = {
  PENDING: { label: 'Pending', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Clock4 },
  PROVISIONING: { label: 'Provisioning', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock4 },
  RUNNING: { label: 'Running', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  STOPPED: { label: 'Stopped', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle },
  TERMINATED: { label: 'Terminated', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

const envConfig: Record<string, { label: string; color: string }> = {
  PRD: { label: 'Production', color: 'border-red-500/20 text-red-500' },
  DEV: { label: 'Development', color: 'border-blue-500/20 text-blue-400' },
  STG: { label: 'Staging', color: 'border-purple-500/20 text-purple-400' },
};

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: application,
    isLoading: appLoading,
    isError: appError,
    refetch: refetchApp,
  } = useApplication(id || '');
  const { data: allInstances, isLoading: instLoading } = useInstances();
  const { data: allForecasts, isLoading: forecastLoading } = useForecasts();
  useContinuityLevels();

  const instances = useMemo(() => {
    if (!allInstances || !id) return [];
    return allInstances.filter((i) => i.applicationId === id);
  }, [allInstances, id]);

  const forecasts = useMemo(() => {
    if (!allForecasts || !id) return [];
    return allForecasts.filter((f) => f.applicationId === id);
  }, [allForecasts, id]);

  const isLoading = appLoading || instLoading || forecastLoading;

  if (appError) {
    return <QueryError message="Unable to load application." onRetry={refetchApp} />;
  }

  if (!isLoading && !application) {
    return (
      <div className="text-center py-12">
        <Layers className="mx-auto h-12 w-12 text-slate-700" />
        <p className="mt-4 text-lg font-medium text-slate-400">Application not found</p>
        <Link to="/applications" className="mt-4 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>
      </div>
    );
  }

  const cl = application?.continuityLevel;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Back link */}
      <AnimatedSection>
        <Link
          to="/applications"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Applications
        </Link>
      </AnimatedSection>

      {/* Header */}
      <AnimatedSection delay={50}>
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <Skeleton className="h-10 w-64 rounded-lg bg-slate-800 animate-pulse-soft" />
          ) : (
            <h1 className="text-3xl font-bold text-white">{application?.name}</h1>
          )}
          {isLoading ? (
            <Skeleton className="h-5 w-96 rounded-lg bg-slate-800 animate-pulse-soft" />
          ) : (
            <p className="text-slate-400">{application?.description || 'No description provided.'}</p>
          )}
        </div>
      </AnimatedSection>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatedSection delay={100}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <User className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-xs text-slate-500">Owner</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <p className="text-lg font-bold text-white">{application?.owner}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={150}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Shield className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-xs text-slate-500">Continuity Level</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <Badge
                    variant="outline"
                    className={continuityColor[cl?.name || ''] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}
                  >
                    {cl?.name || 'Unknown'}
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={200}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Clock className="h-8 w-8 text-amber-400" />
              <div>
                <p className="text-xs text-slate-500">RTO / RPO</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <p className="text-lg font-bold text-white">
                    {cl ? `${cl.rtoMinutes}m / ${cl.rpoMinutes}m` : '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={250}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Calendar className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-500">Created</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-32 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <p className="text-lg font-bold text-white">
                    {application ? new Date(application.createdAt).toLocaleDateString() : '-'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      {/* Continuity Description */}
      {cl?.description && (
        <AnimatedSection delay={300}>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-purple-500" />
                Resilience Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400">{cl.description}</p>
              <div className="mt-3 flex gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recovery Time Objective: <span className="text-slate-300 font-medium">{cl.rtoMinutes} minutes</span>
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Recovery Point Objective: <span className="text-slate-300 font-medium">{cl.rpoMinutes} minutes</span>
                </span>
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {/* Forecasts */}
      <AnimatedSection delay={350}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-500" />
                Forecasts
              </span>
              <span className="text-sm font-normal text-slate-500">{forecasts.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {forecastLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
                ))}
              </div>
            ) : forecasts.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-2 text-sm text-slate-500">No forecasts for this application</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="pb-3 text-left font-medium text-slate-400">ID</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Environment</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Lines</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Target Date</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Requested</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {forecasts.map((f) => {
                      const status = statusConfig[f.status];
                      const env = envConfig[f.environment] || { label: f.environment, color: 'border-slate-600 text-slate-500' };
                      return (
                        <tr key={f.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3 font-mono text-xs text-slate-400">{f.id.slice(0, 8)}...</td>
                          <td className="py-3">
                            <Badge variant="outline" className={status.color}>
                              {status.label}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className={`text-[10px] ${env.color}`}>
                              {env.label}
                            </Badge>
                          </td>
                          <td className="py-3 text-slate-400">{f.lines.length}</td>
                          <td className="py-3 text-slate-400">
                            {f.targetDate ? new Date(f.targetDate).toLocaleDateString() : '-'}
                          </td>
                          <td className="py-3 text-slate-500 text-xs">
                            {new Date(f.requestedAt).toLocaleDateString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Instances */}
      <AnimatedSection delay={400}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Server className="h-5 w-5 text-emerald-500" />
                Instances
              </span>
              <span className="text-sm font-normal text-slate-500">{instances.length} total</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {instLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
                ))}
              </div>
            ) : instances.length === 0 ? (
              <div className="text-center py-8">
                <Server className="mx-auto h-10 w-10 text-slate-700" />
                <p className="mt-2 text-sm text-slate-500">No instances for this application</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="pb-3 text-left font-medium text-slate-400">Name</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Product</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Flavor</th>
                      <th className="pb-3 text-left font-medium text-slate-400">AZ</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Environment</th>
                      <th className="pb-3 text-left font-medium text-slate-400">IP</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {instances.map((inst) => {
                      const status = instanceStatusConfig[inst.status];
                      const StatusIcon = status.icon;
                      const env = envConfig[inst.environment] || { label: inst.environment, color: 'border-slate-600 text-slate-500' };
                      return (
                        <tr key={inst.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-3">
                            <div className="font-medium text-white">{inst.name}</div>
                            {inst.description && <div className="text-xs text-slate-500">{inst.description}</div>}
                          </td>
                          <td className="py-3 text-slate-400">{inst.product?.name}</td>
                          <td className="py-3 text-slate-400">{inst.flavor?.name}</td>
                          <td className="py-3 text-slate-400">{inst.az?.code}</td>
                          <td className="py-3">
                            <Badge variant="outline" className={`gap-1 ${status.color}`}>
                              <StatusIcon className="h-3 w-3" />
                              {status.label}
                            </Badge>
                          </td>
                          <td className="py-3">
                            <Badge variant="outline" className={`text-[10px] ${env.color}`}>
                              {env.label}
                            </Badge>
                          </td>
                          <td className="py-3 text-slate-500 text-xs font-mono">
                            {inst.ipAddress || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
