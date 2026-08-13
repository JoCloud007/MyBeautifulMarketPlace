import { useState, useMemo } from 'react';
import { useMaintenanceWindows, useMaintenanceWindowStats } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Wrench,
  Search,
  Filter,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Server,
  AppWindow,
} from 'lucide-react';
import type { MaintenanceWindow, MaintenanceStatus } from '@cloudmarket/shared-types';

const statusConfig: Record<MaintenanceStatus, { label: string; color: string; icon: typeof CheckCircle }> = {
  SCHEDULED: { label: 'Scheduled', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Calendar },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Play },
  COMPLETED: { label: 'Completed', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
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

function WindowCard({ window }: { window: MaintenanceWindow }) {
  const status = statusConfig[window.status];
  const StatusIcon = status.icon;
  const start = new Date(window.startTime);
  const end = new Date(window.endTime);
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{window.title}</p>
          {window.instance && (
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <Server className="h-3 w-3" />
              {window.instance.name}
            </p>
          )}
          {window.application && (
            <p className="text-sm text-slate-400 flex items-center gap-1">
              <AppWindow className="h-3 w-3" />
              {window.application.name}
            </p>
          )}
        </div>
        <Badge variant="outline" className={`gap-1 shrink-0 ml-2 ${status.color}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      {window.description && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{window.description}</p>
      )}
      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {start.toLocaleDateString()}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {durationHours.toFixed(1)}h
        </span>
      </div>
    </div>
  );
}

export default function MaintenancePage() {
  const { data: windows, isLoading, isError, refetch } = useMaintenanceWindows();
  const { data: stats, isLoading: statsLoading, isError: statsError } = useMaintenanceWindowStats();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<MaintenanceStatus | 'ALL'>('ALL');

  const filteredWindows = useMemo(() => {
    if (!windows) return [];
    return windows.filter((w) => {
      const matchesSearch =
        !searchQuery ||
        w.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        w.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || w.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [windows, searchQuery, statusFilter]);

  const upcomingWindows = useMemo(() => {
    const now = new Date();
    return filteredWindows.filter((w) => new Date(w.startTime) > now && w.status !== 'CANCELLED');
  }, [filteredWindows]);

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: Wrench, color: 'text-blue-400' },
    { label: 'Scheduled', value: stats?.scheduled ?? 0, icon: Calendar, color: 'text-blue-400' },
    { label: 'In Progress', value: stats?.inProgress ?? 0, icon: Play, color: 'text-amber-400' },
    { label: 'Completed', value: stats?.completed ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
  ];

  const hasError = isError || statsError;

  return (
    <div className="space-y-6 sm:space-y-8">
      <AnimatedSection>
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold text-white">Maintenance Windows</h1>
          <p className="text-slate-400">
            Scheduled and completed maintenance activities across your infrastructure.
          </p>
        </div>
      </AnimatedSection>

      {hasError ? (
        <QueryError message="Unable to load maintenance data." onRetry={refetch} />
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

          {/* Upcoming banner */}
          {upcomingWindows.length > 0 && (
            <AnimatedSection delay={80}>
              <Card className="bg-amber-950/20 border-amber-500/20">
                <CardContent className="p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-amber-400">{upcomingWindows.length} upcoming maintenance {upcomingWindows.length === 1 ? 'window' : 'windows'}</p>
                    <p className="text-sm text-amber-500/70 mt-1">
                      Next: {upcomingWindows[0]?.title} on {new Date(upcomingWindows[0]?.startTime).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>
          )}

          {/* Filters */}
          <AnimatedSection delay={100}>
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      placeholder="Search maintenance windows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-500" />
                    <Select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as MaintenanceStatus | 'ALL')}
                      className="w-40 bg-slate-950 border-slate-700 text-white min-h-[44px]"
                    >
                      <option value="ALL">All statuses</option>
                      <option value="SCHEDULED">Scheduled</option>
                      <option value="IN_PROGRESS">In Progress</option>
                      <option value="COMPLETED">Completed</option>
                      <option value="CANCELLED">Cancelled</option>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          </AnimatedSection>

          {/* Maintenance Windows Table / Cards */}
          <AnimatedSection delay={150}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-blue-500" />
                    Maintenance Windows
                  </span>
                  <span className="text-sm font-normal text-slate-500">
                    {filteredWindows.length} result(s)
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
                ) : filteredWindows.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <Wrench className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No maintenance windows</p>
                    <p className="text-slate-500">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'Try adjusting your filters.'
                        : 'Maintenance windows will appear here once scheduled.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="space-y-3 sm:hidden">
                      {filteredWindows.map((w) => (
                        <WindowCard key={w.id} window={w} />
                      ))}
                    </div>

                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="pb-3 text-left font-medium text-slate-400">Title</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Scope</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Start</th>
                            <th className="pb-3 text-left font-medium text-slate-400">End</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Duration</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredWindows.map((w) => {
                            const status = statusConfig[w.status];
                            const StatusIcon = status.icon;
                            const start = new Date(w.startTime);
                            const end = new Date(w.endTime);
                            const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
                            return (
                              <tr key={w.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3">
                                  <div className="font-medium text-white">{w.title}</div>
                                  {w.description && (
                                    <div className="text-xs text-slate-500 line-clamp-1">{w.description}</div>
                                  )}
                                </td>
                                <td className="py-3 text-slate-400">
                                  {w.instance ? (
                                    <span className="flex items-center gap-1">
                                      <Server className="h-3 w-3" />
                                      {w.instance.name}
                                    </span>
                                  ) : w.application ? (
                                    <span className="flex items-center gap-1">
                                      <AppWindow className="h-3 w-3" />
                                      {w.application.name}
                                    </span>
                                  ) : (
                                    <span className="text-slate-600">Global</span>
                                  )}
                                </td>
                                <td className="py-3">
                                  <Badge variant="outline" className={`gap-1 ${status.color}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="py-3 text-slate-400">
                                  {start.toLocaleString()}
                                </td>
                                <td className="py-3 text-slate-400">
                                  {end.toLocaleString()}
                                </td>
                                <td className="py-3 text-slate-500">
                                  {durationHours.toFixed(1)}h
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
