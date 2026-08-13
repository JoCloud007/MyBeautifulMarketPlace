import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useInstance, useApplication } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  Server,
  Activity,
  Pause,
  XCircle,
  Loader2,
  Calendar,
  Globe,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Layers,
  Package,
  Cpu,
  Shield,
  Clock4,
} from 'lucide-react';
import { InstanceStatus, LifecyclePhase } from '@cloudmarket/shared-types';

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

const statusConfig: Record<InstanceStatus, { label: string; color: string; icon: typeof Activity }> = {
  PENDING: { label: 'Pending', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Clock4 },
  PROVISIONING: { label: 'Provisioning', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Loader2 },
  RUNNING: { label: 'Running', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  STOPPED: { label: 'Stopped', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Pause },
  TERMINATED: { label: 'Terminated', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

const envConfig: Record<string, { label: string; color: string }> = {
  PRD: { label: 'Production', color: 'border-red-500/20 text-red-500' },
  DEV: { label: 'Development', color: 'border-blue-500/20 text-blue-400' },
  STG: { label: 'Staging', color: 'border-purple-500/20 text-purple-400' },
};

const phaseConfig: Record<LifecyclePhase, { label: string; color: string }> = {
  RELEASED: { label: 'Released', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  NORMAL_SUPPORT: { label: 'Normal Support', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  EXTENDED_SUPPORT: { label: 'Extended Support', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  NO_SUPPORT: { label: 'No Support', color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' },
  EOL: { label: 'End of Life', color: 'bg-red-500/10 text-red-500 border-red-500/20' },
};

export function getEolWarning(eolDate: string): { text: string; color: string; icon: typeof AlertTriangle | typeof CheckCircle } | null {
  const now = new Date();
  const eol = new Date(eolDate);
  if (isNaN(eol.getTime())) {
    return null;
  }
  const diffMs = eol.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) {
    return { text: `EOL passed ${Math.abs(diffDays)} days ago`, color: 'text-red-400', icon: AlertTriangle };
  }
  if (diffDays <= 90) {
    return { text: `EOL in ${diffDays} days`, color: 'text-red-400', icon: AlertTriangle };
  }
  if (diffDays <= 365) {
    return { text: `EOL in ${Math.round(diffDays / 30)} months`, color: 'text-amber-400', icon: AlertTriangle };
  }
  return { text: `EOL in ${Math.round(diffDays / 365)} years`, color: 'text-emerald-400', icon: CheckCircle };
}

export default function InstanceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const {
    data: instance,
    isLoading,
    isError,
    refetch,
  } = useInstance(id || '');
  useApplication(instance?.applicationId || '', {
    enabled: !!instance?.applicationId,
  });

  const eolWarning = useMemo(() => {
    if (!instance?.lifecycle?.eolDate) return null;
    const warning = getEolWarning(instance.lifecycle.eolDate);
    return warning;
  }, [instance?.lifecycle?.eolDate]);

  if (isError) {
    return <QueryError message="Unable to load instance." onRetry={refetch} />;
  }

  if (!isLoading && !instance) {
    return (
      <div className="text-center py-12">
        <Server className="mx-auto h-12 w-12 text-slate-700" />
        <p className="mt-4 text-lg font-medium text-slate-400">Instance not found</p>
        <Link to="/instances" className="mt-4 inline-flex items-center gap-1 text-blue-400 hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" />
          Back to Instances
        </Link>
      </div>
    );
  }

  const status = instance ? statusConfig[instance.status] : null;
  const StatusIcon = status?.icon || Clock4;
  const env = instance ? envConfig[instance.environment] || { label: instance.environment, color: 'border-slate-600 text-slate-500' } : null;
  const phase = instance?.lifecycle?.phase ? phaseConfig[instance.lifecycle.phase] : null;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Back link */}
      <AnimatedSection>
        <Link
          to="/instances"
          className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Instances
        </Link>
      </AnimatedSection>

      {/* Header */}
      <AnimatedSection delay={50}>
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <Skeleton className="h-10 w-64 rounded-lg bg-slate-800 animate-pulse-soft" />
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-3xl font-bold text-white">{instance?.name}</h1>
              {status && (
                <Badge variant="outline" className={`gap-1 ${status.color}`}>
                  <StatusIcon className="h-3 w-3" />
                  {status.label}
                </Badge>
              )}
            </div>
          )}
          {isLoading ? (
            <Skeleton className="h-5 w-96 rounded-lg bg-slate-800 animate-pulse-soft" />
          ) : (
            <p className="text-slate-400">{instance?.description || 'No description provided.'}</p>
          )}
        </div>
      </AnimatedSection>

      {/* Info Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AnimatedSection delay={100}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Layers className="h-8 w-8 text-blue-400" />
              <div>
                <p className="text-xs text-slate-500">Application</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <Link
                    to={`/applications/${instance?.applicationId}`}
                    className="text-lg font-bold text-white hover:text-blue-400 transition-colors"
                  >
                    {instance?.application?.name || '—'}
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={150}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Package className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-xs text-slate-500">Product</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <p className="text-lg font-bold text-white">{instance?.product?.name || '—'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={200}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Cpu className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-500">Flavor</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <p className="text-lg font-bold text-white">{instance?.flavor?.name || '—'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>

        <AnimatedSection delay={250}>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="flex items-center gap-4 py-5">
              <Globe className="h-8 w-8 text-cyan-400" />
              <div>
                <p className="text-xs text-slate-500">Availability Zone</p>
                {isLoading ? (
                  <Skeleton className="h-6 w-24 rounded bg-slate-800 animate-pulse-soft" />
                ) : (
                  <p className="text-lg font-bold text-white">{instance?.az?.code || '—'}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimatedSection>
      </div>

      {/* Lifecycle & EOL */}
      {instance?.lifecycle && (
        <AnimatedSection delay={300}>
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Shield className="h-4 w-4 text-purple-500" />
                Lifecycle & EOL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Version</p>
                  <p className="text-lg font-bold text-white">{instance.lifecycle.version}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Phase</p>
                  {phase && (
                    <Badge variant="outline" className={phase.color}>
                      {phase.label}
                    </Badge>
                  )}
                </div>
                <div>
                  <p className="text-xs text-slate-500">Normal Support End</p>
                  <p className="text-sm text-slate-300">
                    {new Date(instance.lifecycle.normalSupportEnd).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Extended Support End</p>
                  <p className="text-sm text-slate-300">
                    {new Date(instance.lifecycle.extendedSupportEnd).toLocaleDateString()}
                  </p>
                </div>
              </div>
              {eolWarning && (
                <div className={`mt-4 flex items-center gap-2 rounded-lg border px-4 py-3 ${eolWarning.color.replace('text-', 'border-').replace('400', '500/20')} ${eolWarning.color.replace('text-', 'bg-').replace('400', '500/10')}`}>
                  <eolWarning.icon className={`h-5 w-5 ${eolWarning.color}`} />
                  <span className={`text-sm font-medium ${eolWarning.color}`}>{eolWarning.text}</span>
                  <span className="text-xs text-slate-500 ml-auto">
                    EOL: {new Date(instance.lifecycle.eolDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedSection>
      )}

      {/* Network & Environment */}
      <AnimatedSection delay={350}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Monitor className="h-4 w-4 text-blue-500" />
              Network & Environment
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Environment</p>
                {env && (
                  <Badge variant="outline" className={`text-[10px] ${env.color}`}>
                    {env.label}
                  </Badge>
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">IP Address</p>
                <p className="text-sm font-mono text-slate-300">{instance?.ipAddress || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Hostname</p>
                <p className="text-sm font-mono text-slate-300">{instance?.hostname || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Forecast</p>
                <p className="text-sm text-slate-300">
                  {instance?.forecastId ? (
                    <span className="font-mono text-xs">{instance.forecastId.slice(0, 8)}…</span>
                  ) : (
                    'None'
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>

      {/* Timeline */}
      <AnimatedSection delay={400}>
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4 text-emerald-500" />
              Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-slate-500">Created</p>
                <p className="text-sm text-slate-300">
                  {instance ? new Date(instance.createdAt).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Started</p>
                <p className="text-sm text-slate-300">
                  {instance?.startedAt ? new Date(instance.startedAt).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Stopped</p>
                <p className="text-sm text-slate-300">
                  {instance?.stoppedAt ? new Date(instance.stoppedAt).toLocaleString() : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Terminated</p>
                <p className="text-sm text-slate-300">
                  {instance?.terminatedAt ? new Date(instance.terminatedAt).toLocaleString() : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </AnimatedSection>
    </div>
  );
}
