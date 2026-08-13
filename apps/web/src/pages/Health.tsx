import { useState, useMemo } from 'react';
import { useHealthChecks, useHealthCheckStats, useInstances } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Activity,
  Search,
  Filter,
  HeartPulse,
  AlertTriangle,
  XCircle,
  CheckCircle,
  Timer,
  Cpu,
  HardDrive,
  MemoryStick,
} from 'lucide-react';
import type { HealthCheck, HealthStatus } from '@cloudmarket/shared-types';

const statusConfig: Record<HealthStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  HEALTHY: { label: 'Healthy', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  DEGRADED: { label: 'Degraded', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: AlertTriangle },
  UNHEALTHY: { label: 'Unhealthy', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
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

function HealthCard({ check }: { check: HealthCheck }) {
  const status = statusConfig[check.status];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{check.instance?.name}</p>
          <p className="text-sm text-slate-400">{check.instance?.application?.name} · {check.instance?.product?.name}</p>
        </div>
        <Badge variant="outline" className={`gap-1 shrink-0 ml-2 ${status.color}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Cpu className="h-3 w-3" />
          <span>{check.cpuPercent.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <MemoryStick className="h-3 w-3" />
          <span>{check.memoryPercent.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <HardDrive className="h-3 w-3" />
          <span>{check.diskPercent.toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Timer className="h-3 w-3" />
          <span>{check.responseTimeMs}ms</span>
        </div>
      </div>
    </div>
  );
}

export default function HealthPage() {
  const { data: checks, isLoading, isError, refetch } = useHealthChecks();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useHealthCheckStats();
  const { data: instances } = useInstances();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<HealthStatus | 'ALL'>('ALL');
  const [instanceFilter, setInstanceFilter] = useState<string>('ALL');

  const filteredChecks = useMemo(() => {
    if (!checks) return [];
    return checks.filter((c) => {
      const matchesSearch =
        !searchQuery ||
        c.instance?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.instance?.hostname?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
      const matchesInstance = instanceFilter === 'ALL' || c.instanceId === instanceFilter;
      return matchesSearch && matchesStatus && matchesInstance;
    });
  }, [checks, searchQuery, statusFilter, instanceFilter]);

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: Activity, color: 'text-blue-400' },
    { label: 'Healthy', value: stats?.healthy ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Degraded', value: stats?.degraded ?? 0, icon: AlertTriangle, color: 'text-amber-400' },
    { label: 'Unhealthy', value: stats?.unhealthy ?? 0, icon: XCircle, color: 'text-red-400' },
  ];

  const hasError = isError || statsError;

  return (
    <div className="space-y-6 sm:space-y-8">
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Health Monitoring</h1>
          <p className="text-slate-400">
            Real-time health status and performance metrics for all instances.
          </p>
        </div>
      </AnimatedSection>

      {hasError ? (
        <QueryError message="Unable to load health data." onRetry={refetch} />
      ) : (
        <>
          {/* Stats Cards */}
          {statsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg bg-slate-800 animate-pulse-soft" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                        </div>
                      </CardContent>
                    </Card>
                  </AnimatedSection>
                );
              })}
            </div>
          )}

          {/* Filters */}
          <AnimatedSection delay={100}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search by instance name or hostname..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as HealthStatus | 'ALL')}
                      className="w-36 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="HEALTHY">Healthy</option>
                      <option value="DEGRADED">Degraded</option>
                      <option value="UNHEALTHY">Unhealthy</option>
                    </Select>
                    <Select
                      value={instanceFilter}
                      onChange={(e) => setInstanceFilter(e.target.value)}
                      className="w-44 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All instances</option>
                      {instances?.map((inst) => (
                        <option key={inst.id} value={inst.id}>{inst.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Health Checks Table / Cards */}
          <AnimatedSection delay={150}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <HeartPulse className="h-5 w-5 text-blue-500" />
                    Instance Health
                  </span>
                  <span className="text-sm font-normal text-slate-500">
                    {filteredChecks.length} result(s)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
                    ))}
                  </div>
                ) : filteredChecks.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <Activity className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No health checks</p>
                    <p className="text-slate-500">
                      {searchQuery || statusFilter !== 'ALL' || instanceFilter !== 'ALL'
                        ? 'Try adjusting your filters.'
                        : 'Health checks will appear here once recorded.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="space-y-3 sm:hidden">
                      {filteredChecks.map((check) => (
                        <HealthCard key={check.id} check={check} />
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="pb-3 text-left font-medium text-slate-400">Instance</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Application</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                            <th className="pb-3 text-left font-medium text-slate-400">CPU</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Memory</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Disk</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Latency</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Checked</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredChecks.map((check) => {
                            const status = statusConfig[check.status];
                            const StatusIcon = status.icon;
                            return (
                              <tr key={check.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3">
                                  <div className="font-medium text-white">{check.instance?.name}</div>
                                  <div className="text-xs text-slate-500">{check.instance?.hostname}</div>
                                </td>
                                <td className="py-3 text-slate-400">{check.instance?.application?.name}</td>
                                <td className="py-3">
                                  <Badge variant="outline" className={`gap-1 ${status.color}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${check.cpuPercent > 80 ? 'bg-red-500' : check.cpuPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${check.cpuPercent}%` }}
                                      />
                                    </div>
                                    <span className="text-slate-400 text-xs">{check.cpuPercent.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${check.memoryPercent > 80 ? 'bg-red-500' : check.memoryPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${check.memoryPercent}%` }}
                                      />
                                    </div>
                                    <span className="text-slate-400 text-xs">{check.memoryPercent.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${check.diskPercent > 80 ? 'bg-red-500' : check.diskPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                                        style={{ width: `${check.diskPercent}%` }}
                                      />
                                    </div>
                                    <span className="text-slate-400 text-xs">{check.diskPercent.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="py-3 text-slate-400">{check.responseTimeMs}ms</td>
                                <td className="py-3 text-slate-500 text-xs">
                                  {new Date(check.checkedAt).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </AnimatedSection>
        </>
      )}
    </div>
  );
}
