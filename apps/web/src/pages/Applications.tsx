import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApplications, useContinuityLevels, useInstances, useForecasts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Layers,
  Search,
  Filter,
  Shield,
  Server,
  BarChart3,
  ArrowRight,
  User,
  Clock,
} from 'lucide-react';
import type { Application } from '@cloudmarket/shared-types';

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

function ApplicationCard({ app, instances, forecasts }: { app: Application; instances: number; forecasts: number }) {
  const cl = app.continuityLevel;
  return (
    <Link
      to={`/applications/${app.id}`}
      className="block rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition-all duration-200 hover:border-slate-600 hover:bg-slate-800/50 sm:hidden"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{app.name}</p>
          {app.description && <p className="text-sm text-slate-400 line-clamp-1">{app.description}</p>}
        </div>
        <ArrowRight className="h-4 w-4 text-slate-600 shrink-0 ml-2 mt-1" />
      </div>
      <div className="mt-3 flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className={continuityColor[cl?.name || ''] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
          {cl?.name || 'Unknown'}
        </Badge>
        <span className="text-xs text-slate-500 flex items-center gap-1">
          <User className="h-3 w-3" />
          {app.owner}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Server className="h-3 w-3" />
          {instances} instances
        </span>
        <span className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          {forecasts} forecasts
        </span>
      </div>
    </Link>
  );
}

export default function ApplicationsPage() {
  const { data: applications, isLoading: appsLoading, isError: appsError, refetch } = useApplications();
  const { data: continuityLevels, isLoading: clLoading } = useContinuityLevels();
  const { data: instances } = useInstances();
  const { data: forecasts } = useForecasts();

  const [searchQuery, setSearchQuery] = useState('');
  const [clFilter, setClFilter] = useState<string>('ALL');

  const filteredApps = useMemo(() => {
    if (!applications) return [];
    return applications.filter((app) => {
      const matchesSearch =
        !searchQuery ||
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.owner.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCl = clFilter === 'ALL' || app.continuityLevelId === clFilter;
      return matchesSearch && matchesCl;
    });
  }, [applications, searchQuery, clFilter]);

  const stats = useMemo(() => {
    if (!applications || !continuityLevels) return null;
    const total = applications.length;
    const byLevel = continuityLevels.map((cl) => ({
      ...cl,
      count: applications.filter((a) => a.continuityLevelId === cl.id).length,
    }));
    return { total, byLevel };
  }, [applications, continuityLevels]);

  const instanceCounts = useMemo(() => {
    if (!instances) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const i of instances) {
      map.set(i.applicationId, (map.get(i.applicationId) || 0) + 1);
    }
    return map;
  }, [instances]);

  const forecastCounts = useMemo(() => {
    if (!forecasts) return new Map<string, number>();
    const map = new Map<string, number>();
    for (const f of forecasts) {
      if (f.applicationId) {
        map.set(f.applicationId, (map.get(f.applicationId) || 0) + 1);
      }
    }
    return map;
  }, [forecasts]);

  const isLoading = appsLoading || clLoading;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Application Hub</h1>
          <p className="text-slate-400">
            Browse and manage applications, their resilience tiers, and provisioned resources.
          </p>
        </div>
      </AnimatedSection>

      {appsError ? (
        <QueryError message="Unable to load applications." onRetry={refetch} />
      ) : (
        <>
          {/* Stats Cards */}
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-lg bg-slate-800 animate-pulse-soft" />
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <AnimatedSection delay={0}>
                <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
                  <CardContent className="flex items-center gap-4 py-5">
                    <Layers className="h-8 w-8 text-blue-400" />
                    <div>
                      <p className="text-xs text-slate-500">Total Applications</p>
                      <p className="text-2xl font-bold text-white">{stats?.total ?? 0}</p>
                    </div>
                  </CardContent>
                </Card>
              </AnimatedSection>
              {stats?.byLevel.map((cl, i) => (
                <AnimatedSection key={cl.id} delay={(i + 1) * 60}>
                  <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
                    <CardContent className="flex items-center gap-4 py-5">
                      <Shield className={`h-8 w-8 ${cl.name === 'LOW' ? 'text-green-400' : cl.name === 'MODERATE' ? 'text-yellow-400' : cl.name === 'SERIOUS' ? 'text-orange-400' : 'text-red-400'}`} />
                      <div>
                        <p className="text-xs text-slate-500">{cl.name}</p>
                        <p className="text-2xl font-bold text-white">{cl.count}</p>
                        <p className="text-[10px] text-slate-600">RTO {cl.rtoMinutes}m</p>
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              ))}
            </div>
          )}

          {/* Filters */}
          <AnimatedSection delay={100}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search by name, description, or owner..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <Select
                      value={clFilter}
                      onChange={(e) => setClFilter(e.target.value)}
                      className="w-48 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All continuity levels</option>
                      {continuityLevels?.map((cl) => (
                        <option key={cl.id} value={cl.id}>{cl.name} (RTO {cl.rtoMinutes}m)</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Applications List */}
          <AnimatedSection delay={150}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Layers className="h-5 w-5 text-blue-500" />
                    Applications
                  </span>
                  <span className="text-sm font-normal text-slate-500">
                    {filteredApps.length} result(s)
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
                ) : filteredApps.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <Layers className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No applications found</p>
                    <p className="text-slate-500">
                      {searchQuery || clFilter !== 'ALL'
                        ? 'Try adjusting your filters.'
                        : 'Applications will appear here once created.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="space-y-3 sm:hidden">
                      {filteredApps.map((app) => (
                        <ApplicationCard
                          key={app.id}
                          app={app}
                          instances={instanceCounts.get(app.id) || 0}
                          forecasts={forecastCounts.get(app.id) || 0}
                        />
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="pb-3 text-left font-medium text-slate-400">Name</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Owner</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Continuity</th>
                            <th className="pb-3 text-left font-medium text-slate-400">RTO / RPO</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Instances</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Forecasts</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Created</th>
                            <th className="pb-3 text-right font-medium text-slate-400">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredApps.map((app) => {
                            const cl = app.continuityLevel;
                            return (
                              <tr key={app.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3">
                                  <div className="font-medium text-white">{app.name}</div>
                                  {app.description && (
                                    <div className="text-xs text-slate-500 line-clamp-1">{app.description}</div>
                                  )}
                                </td>
                                <td className="py-3 text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <User className="h-3 w-3 text-slate-600" />
                                    {app.owner}
                                  </span>
                                </td>
                                <td className="py-3">
                                  <Badge
                                    variant="outline"
                                    className={continuityColor[cl?.name || ''] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}
                                  >
                                    {cl?.name || 'Unknown'}
                                  </Badge>
                                </td>
                                <td className="py-3 text-slate-400 text-xs">
                                  {cl ? (
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3 text-slate-600" />
                                      {cl.rtoMinutes}m / {cl.rpoMinutes}m
                                    </span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="py-3 text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <Server className="h-3 w-3 text-slate-600" />
                                    {instanceCounts.get(app.id) || 0}
                                  </span>
                                </td>
                                <td className="py-3 text-slate-400">
                                  <span className="flex items-center gap-1">
                                    <BarChart3 className="h-3 w-3 text-slate-600" />
                                    {forecastCounts.get(app.id) || 0}
                                  </span>
                                </td>
                                <td className="py-3 text-slate-500 text-xs">
                                  {new Date(app.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-3 text-right">
                                  <Link
                                    to={`/applications/${app.id}`}
                                    className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
                                  >
                                    View
                                    <ArrowRight className="h-3 w-3" />
                                  </Link>
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
