import { useState, useMemo } from 'react';
import { useInstances, useInstanceStats, useApplications, useProducts } from '@/hooks/useApi';
import { Link } from 'react-router-dom';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Server,
  Search,
  Filter,
  Activity,
  Clock,
  Play,
  Pause,
  XCircle,
  Loader2,
  Monitor,
} from 'lucide-react';
import type { Instance, InstanceStatus } from '@cloudmarket/shared-types';

const statusConfig: Record<InstanceStatus, { label: string; color: string; icon: typeof Activity }> = {
  PENDING: { label: 'Pending', color: 'bg-slate-500/10 text-slate-400 border-slate-500/20', icon: Clock },
  PROVISIONING: { label: 'Provisioning', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Loader2 },
  RUNNING: { label: 'Running', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: Play },
  STOPPED: { label: 'Stopped', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Pause },
  TERMINATED: { label: 'Terminated', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

const envConfig: Record<string, { label: string; color: string }> = {
  PRD: { label: 'Production', color: 'border-red-500/20 text-red-500' },
  DEV: { label: 'Development', color: 'border-blue-500/20 text-blue-400' },
  STG: { label: 'Staging', color: 'border-purple-500/20 text-purple-400' },
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

function InstanceCard({ instance }: { instance: Instance }) {
  const status = statusConfig[instance.status];
  const StatusIcon = status.icon;
  const env = envConfig[instance.environment] || { label: instance.environment, color: 'border-slate-600 text-slate-500' };

  return (
    <Link
      to={`/instances/${instance.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:hidden transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/50"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{instance.name}</p>
          <p className="text-sm text-slate-400">{instance.product?.name} · {instance.flavor?.name}</p>
        </div>
        <Badge variant="outline" className={`gap-1 shrink-0 ml-2 ${status.color}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-400">
        <p>{instance.application?.name}</p>
        <p className="text-xs text-slate-500">{instance.az?.name}</p>
      </div>
      {instance.lifecycle?.version && (
        <p className="mt-1 text-xs text-purple-400">v{instance.lifecycle.version}</p>
      )}
      {instance.description && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{instance.description}</p>
      )}
      <div className="mt-2 flex items-center gap-2">
        <Badge variant="outline" className={`text-[10px] ${env.color}`}>
          {env.label}
        </Badge>
        {instance.ipAddress && (
          <span className="text-xs text-slate-600 font-mono">{instance.ipAddress}</span>
        )}
      </div>
    </Link>
  );
}

export default function InstancesPage() {
  const { data: instances, isLoading, isError, refetch } = useInstances();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useInstanceStats();
  const { data: applications } = useApplications();
  const { data: products } = useProducts();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<InstanceStatus | 'ALL'>('ALL');
  const [envFilter, setEnvFilter] = useState<string>('ALL');
  const [appFilter, setAppFilter] = useState<string>('ALL');
  const [productFilter, setProductFilter] = useState<string>('ALL');

  const filteredInstances = useMemo(() => {
    if (!instances) return [];
    return instances.filter((i) => {
      const matchesSearch =
        !searchQuery ||
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.ipAddress?.includes(searchQuery);
      const matchesStatus = statusFilter === 'ALL' || i.status === statusFilter;
      const matchesEnv = envFilter === 'ALL' || i.environment === envFilter;
      const matchesApp = appFilter === 'ALL' || i.applicationId === appFilter;
      const matchesProduct = productFilter === 'ALL' || i.productId === productFilter;
      return matchesSearch && matchesStatus && matchesEnv && matchesApp && matchesProduct;
    });
  }, [instances, searchQuery, statusFilter, envFilter, appFilter, productFilter]);

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: Server, color: 'text-blue-400' },
    { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-slate-400' },
    { label: 'Provisioning', value: stats?.provisioning ?? 0, icon: Loader2, color: 'text-blue-400' },
    { label: 'Running', value: stats?.running ?? 0, icon: Play, color: 'text-emerald-400' },
    { label: 'Stopped', value: stats?.stopped ?? 0, icon: Pause, color: 'text-amber-400' },
    { label: 'Terminated', value: stats?.terminated ?? 0, icon: XCircle, color: 'text-red-400' },
  ];

  const hasError = isError || statsError;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Instances</h1>
          <p className="text-slate-400">
            View and manage provisioned compute instances across all applications.
          </p>
        </div>
      </AnimatedSection>

      {hasError ? (
        <QueryError message="Unable to load instances." onRetry={refetch} />
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
                      placeholder="Search by name, hostname, or IP..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                    />
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as InstanceStatus | 'ALL')}
                      className="w-36 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="PENDING">Pending</option>
                      <option value="PROVISIONING">Provisioning</option>
                      <option value="RUNNING">Running</option>
                      <option value="STOPPED">Stopped</option>
                      <option value="TERMINATED">Terminated</option>
                    </Select>
                    <Select
                      value={envFilter}
                      onChange={(e) => setEnvFilter(e.target.value)}
                      className="w-36 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All envs</option>
                      <option value="PRD">Production</option>
                      <option value="DEV">Development</option>
                      <option value="STG">Staging</option>
                    </Select>
                    <Select
                      value={appFilter}
                      onChange={(e) => setAppFilter(e.target.value)}
                      className="w-44 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All apps</option>
                      {applications?.map((app) => (
                        <option key={app.id} value={app.id}>{app.name}</option>
                      ))}
                    </Select>
                    <Select
                      value={productFilter}
                      onChange={(e) => setProductFilter(e.target.value)}
                      className="w-44 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All products</option>
                      {products?.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Instances Table / Cards */}
          <AnimatedSection delay={150}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-blue-500" />
                    Instance Registry
                  </span>
                  <span className="text-sm font-normal text-slate-500">
                    {filteredInstances.length} result(s)
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
                ) : filteredInstances.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <Server className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No instances</p>
                    <p className="text-slate-500">
                      {searchQuery || statusFilter !== 'ALL' || envFilter !== 'ALL' || appFilter !== 'ALL' || productFilter !== 'ALL'
                        ? 'Try adjusting your filters.'
                        : 'Instances will appear here once provisioned.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="space-y-3 sm:hidden">
                      {filteredInstances.map((instance) => (
                        <InstanceCard key={instance.id} instance={instance} />
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="pb-3 text-left font-medium text-slate-400">Name</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Application</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Product</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Version</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Flavor</th>
                            <th className="pb-3 text-left font-medium text-slate-400">AZ</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Env</th>
                            <th className="pb-3 text-left font-medium text-slate-400">IP / Hostname</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredInstances.map((instance) => {
                            const status = statusConfig[instance.status];
                            const StatusIcon = status.icon;
                            const env = envConfig[instance.environment] || { label: instance.environment, color: 'border-slate-600 text-slate-500' };
                            return (
                              <tr key={instance.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3">
                                  <Link
                                    to={`/instances/${instance.id}`}
                                    className="font-medium text-white hover:text-blue-400 transition-colors"
                                  >
                                    {instance.name}
                                  </Link>
                                  {instance.description && (
                                    <div className="text-xs text-slate-500">{instance.description}</div>
                                  )}
                                </td>
                                <td className="py-3 text-slate-400">{instance.application?.name}</td>
                                <td className="py-3 text-slate-400">{instance.product?.name}</td>
                                <td className="py-3 text-slate-400">
                                  {instance.lifecycle?.version ? (
                                    <span className="text-purple-400">{instance.lifecycle.version}</span>
                                  ) : (
                                    '—'
                                  )}
                                </td>
                                <td className="py-3 text-slate-400">{instance.flavor?.name}</td>
                                <td className="py-3 text-slate-400">{instance.az?.code}</td>
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
                                <td className="py-3 text-slate-500 text-xs">
                                  {instance.ipAddress && <div className="font-mono">{instance.ipAddress}</div>}
                                  {instance.hostname && <div className="text-slate-600">{instance.hostname}</div>}
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
