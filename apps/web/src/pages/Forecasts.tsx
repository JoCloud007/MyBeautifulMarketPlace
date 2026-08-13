import { useState, useEffect, useRef } from 'react';
import { useCreateForecast, useUpdateForecast, useDeleteForecast } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product, Forecast, ForecastStats, AvailabilityZone, Flavor } from '@cloudmarket/shared-types';
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
  Filter,
} from 'lucide-react';

import type { ApprovalStatus } from '@cloudmarket/shared-types';

const statusConfig: Record<ApprovalStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

/* Animated counter for stat cards */
function AnimatedCounter({ value, duration = 800 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const startTime = useRef<number | null>(null);
  const startValue = useRef(0);

  useEffect(() => {
    startValue.current = display;
    startTime.current = null;
    let raf: number;

    const tick = (timestamp: number) => {
      if (startTime.current === null) startTime.current = timestamp;
      const elapsed = timestamp - startTime.current;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(startValue.current + (value - startValue.current) * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <span>{display}</span>;
}

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <Badge variant="outline" className={`${config.color} flex items-center gap-1`}>
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </Badge>
  );
}

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ease-out ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'} ${className || ''}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function Forecasts() {
  const [forecasts, setForecasts] = useState<Forecast[] | null>(null);
  const [stats, setStats] = useState<ForecastStats | null>(null);
  const [products, setProducts] = useState<Product[] | null>(null);
  const [zones, setZones] = useState<AvailabilityZone[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = () => {
    setLoading(true);
    setError(false);
    Promise.all([
      fetch('/api/forecasts').then(r => r.ok ? r.json() : Promise.reject(new Error('forecasts failed'))),
      fetch('/api/forecasts/stats').then(r => r.ok ? r.json() : Promise.reject(new Error('stats failed'))),
      fetch('/api/products').then(r => r.ok ? r.json() : Promise.reject(new Error('products failed'))),
      fetch('/api/availability-zones').then(r => r.ok ? r.json() : Promise.reject(new Error('zones failed')))
    ])
      .then(([forecastsData, statsData, productsData, zonesData]) => {
        setForecasts(forecastsData);
        setStats(statsData);
        setProducts(productsData);
        setZones(zonesData);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  const createForecast = useCreateForecast();
  const updateForecast = useUpdateForecast();
  const deleteForecast = useDeleteForecast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('ALL');

  const [formData, setFormData] = useState({
    requestedBy: '',
    requesterEmail: '',
    targetDate: '',
    justification: '',
  });
  const [lines, setLines] = useState<Array<{ productId: string; flavorId: string; azCode: string; quantity: number }>>([]);
  const [draftLine, setDraftLine] = useState({ productId: '', flavorId: '', azCode: '', quantity: 1 });

  const selectedDraftProduct = products?.find((p) => p.id === draftLine.productId);

  const filteredForecasts = forecasts?.filter((f) => {
    const matchesSearch =
      !searchQuery ||
      f.lines?.some((l) => l.product?.name?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      f.requestedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createForecast.mutateAsync({
      requestedBy: formData.requestedBy,
      requesterEmail: formData.requesterEmail,
      targetDate: formData.targetDate,
      lines: lines.map((l) => ({ productId: l.productId, flavorId: l.flavorId, azCode: l.azCode, quantity: l.quantity })),
      justification: formData.justification,
    } as any);
    setIsCreateOpen(false);
    setFormData({
      requestedBy: '',
      requesterEmail: '',
      targetDate: '',
      justification: '',
    });
    setLines([]);
  };

  const handleApprove = async (id: string) => {
    await updateForecast.mutateAsync({
      id,
      status: 'APPROVED' as ApprovalStatus,
      reviewedBy: 'Admin',
    });
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Reason for rejection?');
    if (!reason) return;
    await updateForecast.mutateAsync({
      id,
      status: 'REJECTED' as ApprovalStatus,
      reviewedBy: 'Admin',
      rejectionReason: reason,
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this forecast?')) return;
    await deleteForecast.mutateAsync(id);
  };

  const addLine = () => {
    if (!draftLine.productId || !draftLine.flavorId || !draftLine.azCode || draftLine.quantity < 1) return;
    setLines([...lines, { ...draftLine }]);
    setDraftLine({ productId: '', flavorId: '', azCode: '', quantity: 1 });
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const totalVcpu = lines.reduce((sum, line) => {
    const flavor = products?.find((p) => p.id === line.productId)?.flavors.find((f) => f.id === line.flavorId);
    return sum + (flavor?.vcpu || 0) * line.quantity;
  }, 0);

  const totalRam = lines.reduce((sum, line) => {
    const flavor = products?.find((p) => p.id === line.productId)?.flavors.find((f) => f.id === line.flavorId);
    return sum + (flavor?.ramGb || 0) * line.quantity;
  }, 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <AnimatedSection>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Forecast Dashboard
              </h1>
              <p className="text-slate-400 mt-1">Track and manage your infrastructure provisioning requests</p>
            </div>
            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              New request
            </Button>
          </div>
        </AnimatedSection>

        {error && (
          <AnimatedSection>
            <QueryError message="Unable to load forecast data." onRetry={loadData} />
          </AnimatedSection>
        )}

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="bg-slate-900 border-slate-800">
                <CardContent className="p-6">
                  <Skeleton className="h-8 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && !error && stats && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Total', value: stats.total, icon: BarChart3, color: 'text-blue-400' },
                { label: 'Pending', value: stats.pending, icon: Clock, color: 'text-amber-400' },
                { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-400' },
                { label: 'Rejected', value: stats.rejected, icon: XCircle, color: 'text-red-400' },
              ].map((stat, i) => (
                <AnimatedSection key={stat.label} delay={i * 100}>
                  <Card className="bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-slate-400 text-sm">{stat.label}</p>
                          <p className={`text-3xl font-bold mt-1 ${stat.color}`}>
                            <AnimatedCounter value={stat.value} />
                          </p>
                        </div>
                        <stat.icon className={`w-8 h-8 ${stat.color} opacity-20`} />
                      </div>
                    </CardContent>
                  </Card>
                </AnimatedSection>
              ))}
            </div>

            {/* Search & Filter */}
            <AnimatedSection delay={400}>
              <Card className="bg-slate-900 border-slate-800 mb-6">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        placeholder="Search by product or requester..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 min-h-[44px]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Filter className="w-4 h-4 text-slate-500" />
                      <Select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'ALL')}
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      >
                        <option value="ALL">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AnimatedSection>

            {/* Forecasts Table */}
            <AnimatedSection delay={500}>
              <Card className="bg-slate-900 border-slate-800">
                <CardHeader>
                  <CardTitle className="text-white">
                    Requests <span className="text-slate-500 text-sm font-normal">{filteredForecasts?.length || 0} result(s)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {filteredForecasts?.length === 0 ? (
                    <div className="text-center py-12">
                      <BarChart3 className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500">No forecasts found</p>
                    </div>
                  ) : (
                    <>
                      {/* Mobile Cards */}
                      <div className="sm:hidden space-y-3">
                        {filteredForecasts?.map((forecast) => (
                          <div key={forecast.id} className="bg-slate-950 rounded-lg p-4 border border-slate-800">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <p className="text-white font-medium text-sm">
                                  {forecast.lines?.map((l) => `${l.product?.name} (${l.flavor?.name})`).join(', ') || 'N/A'}
                                </p>
                                <p className="text-slate-500 text-xs mt-1">
                                  {new Date(forecast.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                              <StatusBadge status={forecast.status} />
                            </div>
                            <div className="text-sm text-slate-400 mb-2">{forecast.requestedBy}</div>
                            <div className="flex gap-2">
                              {forecast.status === 'PENDING' && (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApprove(forecast.id)}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                                  >
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleReject(forecast.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white h-8"
                                  >
                                    <XCircle className="w-3 h-3 mr-1" />
                                    Reject
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(forecast.id)}
                                className="border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 h-8"
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-slate-800">
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Lines</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Requester</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                              <th className="text-left py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                              <th className="text-right py-3 px-4 text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                            {filteredForecasts?.map((forecast) => (
                              <tr key={forecast.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="space-y-1">
                                    {forecast.lines?.map((line) => (
                                      <div key={line.id} className="text-sm text-white">
                                        {line.product?.name} · {line.flavor?.name} · {line.azCode} · {line.quantity}
                                      </div>
                                    )) || <span className="text-slate-500 text-sm">N/A</span>}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-400 text-sm">{forecast.requestedBy}</td>
                                <td className="py-3 px-4">
                                  <StatusBadge status={forecast.status} />
                                </td>
                                <td className="py-3 px-4 text-slate-500 text-sm">
                                  {new Date(forecast.createdAt).toLocaleDateString('fr-FR')}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="flex justify-end gap-2">
                                    {forecast.status === 'PENDING' && (
                                      <>
                                        <Button
                                          size="sm"
                                          onClick={() => handleApprove(forecast.id)}
                                          className="bg-emerald-600 hover:bg-emerald-700 text-white h-8"
                                        >
                                          <CheckCircle className="w-3 h-3" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          onClick={() => handleReject(forecast.id)}
                                          className="bg-red-600 hover:bg-red-700 text-white h-8"
                                        >
                                          <XCircle className="w-3 h-3" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleDelete(forecast.id)}
                                      className="border-slate-700 text-slate-400 hover:text-red-400 hover:border-red-500/50 h-8"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
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

      {/* Create Forecast Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* LEFT: Form */}
            <div className="lg:col-span-2 p-6 space-y-6">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">New Provisioning Request</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Add one or more lines to your forecast request
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-5">
                {/* Add Line */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">+</div>
                    <label className="text-sm font-semibold text-slate-200">Add Line</label>
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        value={draftLine.productId}
                        onChange={(e) => setDraftLine({ ...draftLine, productId: e.target.value, flavorId: '' })}
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      >
                        <option value="">Product...</option>
                        {products?.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                      <Select
                        value={draftLine.flavorId}
                        onChange={(e) => setDraftLine({ ...draftLine, flavorId: e.target.value })}
                        disabled={!selectedDraftProduct}
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      >
                        <option value="">Flavor...</option>
                        {selectedDraftProduct?.flavors.map((f: Flavor) => (
                          <option key={f.id} value={f.id}>{f.name} ({f.vcpu}v/{f.ramGb}GB)</option>
                        ))}
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Select
                        value={draftLine.azCode}
                        onChange={(e) => setDraftLine({ ...draftLine, azCode: e.target.value })}
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      >
                        <option value="">Region...</option>
                        {zones?.map((z) => (
                          <option key={z.id} value={z.code}>{z.name}</option>
                        ))}
                      </Select>
                      <Input
                        type="number"
                        min={1}
                        value={draftLine.quantity}
                        onChange={(e) => setDraftLine({ ...draftLine, quantity: parseInt(e.target.value) || 1 })}
                        placeholder="Quantity"
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px] text-center"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={addLine}
                      disabled={!draftLine.productId || !draftLine.flavorId || !draftLine.azCode}
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full min-h-[44px]"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Line
                    </Button>
                  </div>
                </div>

                {/* Lines Table */}
                {lines.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-200">Lines ({lines.length})</label>
                    <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-700">
                            <th className="text-left py-2 px-3 text-xs text-slate-500">Product</th>
                            <th className="text-left py-2 px-3 text-xs text-slate-500">Flavor</th>
                            <th className="text-left py-2 px-3 text-xs text-slate-500">Region</th>
                            <th className="text-center py-2 px-3 text-xs text-slate-500">Qty</th>
                            <th className="text-right py-2 px-3 text-xs text-slate-500"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {lines.map((line, idx) => {
                            const p = products?.find((pr) => pr.id === line.productId);
                            const f = p?.flavors.find((fl: Flavor) => fl.id === line.flavorId);
                            return (
                              <tr key={idx} className="border-b border-slate-800 last:border-0">
                                <td className="py-2 px-3 text-white">{p?.name}</td>
                                <td className="py-2 px-3 text-slate-400">{f?.name}</td>
                                <td className="py-2 px-3 text-slate-400">{line.azCode}</td>
                                <td className="py-2 px-3 text-center text-white">{line.quantity}</td>
                                <td className="py-2 px-3 text-right">
                                  <button
                                    type="button"
                                    onClick={() => removeLine(idx)}
                                    className="text-slate-500 hover:text-red-400 transition-colors"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Request Details */}
                <div className="space-y-3">
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
                      <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Target Date</label>
                      <Input
                        type="date"
                        value={formData.targetDate}
                        onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      />
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
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateOpen(false)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white w-full sm:w-auto min-h-[44px]"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createForecast.isPending || lines.length === 0}
                    className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]"
                  >
                    {createForecast.isPending ? 'Creating...' : 'Create Request'}
                  </Button>
                </DialogFooter>
              </form>
            </div>

            {/* RIGHT: Summary */}
            <div className="hidden lg:block bg-slate-800/30 border-l border-slate-800 p-6">
              <div className="sticky top-6 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200">Request Summary</h3>

                <div className="space-y-3">
                  {lines.length === 0 && (
                    <p className="text-sm text-slate-500">Add lines to see the summary</p>
                  )}
                  {lines.map((line, idx) => {
                    const p = products?.find((pr) => pr.id === line.productId);
                    const f = p?.flavors.find((fl: Flavor) => fl.id === line.flavorId);
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="text-white font-medium">{p?.name}</span>
                          <span className="text-slate-400">x{line.quantity}</span>
                        </div>
                        <div className="text-xs text-slate-400">{f?.name} · {line.azCode}</div>
                        <div className="text-xs text-slate-500">{f ? `${f.vcpu * line.quantity} vCPU · ${f.ramGb * line.quantity} GB` : ''}</div>
                        {idx < lines.length - 1 && <div className="h-px bg-slate-700 my-2" />}
                      </div>
                    );
                  })}

                  {lines.length > 0 && (
                    <>
                      <div className="h-px bg-slate-700" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-200">Total</span>
                        <span className="text-lg font-bold text-blue-400">{totalVcpu} vCPU · {totalRam} GB</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
