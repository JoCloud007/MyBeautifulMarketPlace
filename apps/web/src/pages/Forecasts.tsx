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

function ForecastCard({ forecast, onApprove, onReject, onDelete }: {
  forecast: Forecast;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const status = statusConfig[forecast.status];
  const StatusIcon = status.icon;

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:hidden">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{forecast.product?.name}</p>
          <p className="text-sm text-slate-400">{forecast.flavor?.name} × {forecast.quantity}</p>
        </div>
        <Badge variant="outline" className={`gap-1 shrink-0 ml-2 ${status.color}`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-400">
        <p>{forecast.requestedBy}</p>
        <p className="text-xs text-slate-600">{forecast.requesterEmail}</p>
      </div>
      {forecast.justification && (
        <p className="mt-2 text-xs text-slate-500 line-clamp-2">{forecast.justification}</p>
      )}
      <div className="mt-3 flex items-center justify-end gap-1">
        {forecast.status === 'PENDING' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => onApprove(forecast.id)} className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10">
              <CheckCircle className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onReject(forecast.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10">
              <XCircle className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => onDelete(forecast.id)} className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
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
    productId: '',
    flavorId: '',
    requestedBy: '',
    requesterEmail: '',
    quantity: 1,
    targetDate: '',
    availabilityZones: [] as string[],
    justification: '',
  });

  const selectedProduct = products?.find((p) => p.id === formData.productId);
  const selectedFlavor = selectedProduct?.flavors.find((f: Flavor) => f.id === formData.flavorId);

  const filteredForecasts = forecasts?.filter((f) => {
    const matchesSearch =
      !searchQuery ||
      f.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.requestedBy?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.requesterEmail?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createForecast.mutateAsync(formData);
    setIsCreateOpen(false);
    setFormData({
      productId: '',
      flavorId: '',
      requestedBy: '',
      requesterEmail: '',
      quantity: 1,
      targetDate: '',
      availabilityZones: [],
      justification: '',
    });
  };

  const handleApprove = async (id: string) => {
    await updateForecast.mutateAsync({
      id,
      status: 'APPROVED' as ApprovalStatus,
      reviewedBy: 'Admin',
    });
  };

  const handleReject = async (id: string) => {
    await updateForecast.mutateAsync({
      id,
      status: 'REJECTED' as ApprovalStatus,
      reviewedBy: 'Admin',
      rejectionReason: 'Rejected via dashboard',
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this request?')) {
      await deleteForecast.mutateAsync(id);
    }
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: BarChart3, color: 'text-blue-400' },
    { label: 'Pending', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-400' },
    { label: 'Approved', value: stats?.approved ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Rejected', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-400' },
  ];

  const hasError = error && !forecasts;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Forecast Dashboard</h1>
            <p className="mt-2 text-slate-400">
              Track the status of your provisioning requests.
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

      {hasError ? (
        <QueryError
          message="Unable to load dashboard data."
          onRetry={loadData}
        />
      ) : (
        <>
          {/* Stats Cards */}
          {loading ? (
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
                        <CardTitle className="text-sm font-medium text-slate-400">
                          {stat.label}
                        </CardTitle>
                        <Icon className={`h-4 w-4 ${stat.color}`} />
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold text-white">
                          <AnimatedCounter value={stat.value} />
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <Input
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'ALL')}
                  className="w-40 bg-slate-900 border-slate-700 text-white min-h-[44px]"
                >
                  <option value="ALL">All statuses</option>
                  <option value="PENDING">Pending</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </Select>
              </div>
            </div>
          </AnimatedSection>

          {/* Forecasts Table / Cards */}
          <AnimatedSection delay={150}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Requests</span>
                  <span className="text-sm font-normal text-slate-500">
                    {filteredForecasts?.length ?? 0} result(s)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
                    ))}
                  </div>
                ) : filteredForecasts?.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <BarChart3 className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">No requests</p>
                    <p className="text-slate-500">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'Try adjusting your filters.'
                        : 'Create your first provisioning request.'}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile card view */}
                    <div className="space-y-3 sm:hidden">
                      {filteredForecasts?.map((forecast) => (
                        <ForecastCard
                          key={forecast.id}
                          forecast={forecast}
                          onApprove={handleApprove}
                          onReject={handleReject}
                          onDelete={handleDelete}
                        />
                      ))}
                    </div>
                    {/* Desktop table view */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-slate-800">
                            <th className="pb-3 text-left font-medium text-slate-400">Product</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Flavor</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Qty</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Requester</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Justification</th>
                            <th className="pb-3 text-right font-medium text-slate-400">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                          {filteredForecasts?.map((forecast) => {
                            const status = statusConfig[forecast.status];
                            const StatusIcon = status.icon;
                            return (
                              <tr key={forecast.id} className="hover:bg-slate-800/50 transition-colors">
                                <td className="py-3 font-medium text-white">{forecast.product?.name}</td>
                                <td className="py-3 text-slate-400">{forecast.flavor?.name}</td>
                                <td className="py-3 text-slate-400">{forecast.quantity}</td>
                                <td className="py-3 text-slate-400">
                                  <div>{forecast.requestedBy}</div>
                                  <div className="text-xs text-slate-600">{forecast.requesterEmail}</div>
                                </td>
                                <td className="py-3">
                                  <Badge variant="outline" className={`gap-1 ${status.color}`}>
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                  </Badge>
                                </td>
                                <td className="py-3 max-w-xs truncate text-slate-500">
                                  {forecast.justification || '—'}
                                </td>
                                <td className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    {forecast.status === 'PENDING' && (
                                      <>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleApprove(forecast.id)}
                                          className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                                        >
                                          <CheckCircle className="h-4 w-4" />
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          onClick={() => handleReject(forecast.id)}
                                          className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"
                                        >
                                          <XCircle className="h-4 w-4" />
                                        </Button>
                                      </>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDelete(forecast.id)}
                                      className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
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

      {/* Create Forecast Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-4xl max-h-[90vh] overflow-y-auto p-0">
          <div className="grid grid-cols-1 lg:grid-cols-3">
            {/* LEFT: Form */}
            <div className="lg:col-span-2 p-6 space-y-6">
              <DialogHeader className="pb-2">
                <DialogTitle className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">New Provisioning Request</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Configure your infrastructure deployment across regions
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-5">
                {/* Step 1: Product */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">1</div>
                    <label className="text-sm font-semibold text-slate-200">Select Product</label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {products?.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, productId: p.id, flavorId: '' })}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          formData.productId === p.id
                            ? 'border-blue-500 bg-blue-500/10'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-lg">💻</div>
                          <div>
                            <div className="text-sm font-semibold text-white">{p.name}</div>
                            <div className="text-xs text-slate-400">{p.category?.name} · {p.os || 'N/A'}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Flavor */}
                {selectedProduct && selectedProduct.flavors.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">2</div>
                      <label className="text-sm font-semibold text-slate-200">Choose Flavor</label>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {selectedProduct.flavors.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, flavorId: f.id })}
                          className={`p-3 rounded-xl border text-center transition-all ${
                            formData.flavorId === f.id
                              ? 'border-blue-500 bg-blue-500/10'
                              : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                          }`}
                        >
                          <div className="text-sm font-bold text-white">{f.name}</div>
                          <div className="text-xs text-slate-400 mt-1">{f.vcpu} vCPU · {f.ramGb} GB</div>
                          <div className="text-[10px] text-slate-500 mt-0.5">{f.description?.slice(0, 20) || ''}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Step 3: Region & Schedule */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">3</div>
                    <label className="text-sm font-semibold text-slate-200">Region & Schedule</label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">Availability Zones</label>
                      <div className="flex flex-wrap gap-1.5">
                        {zones?.map((z) => (
                          <button
                            key={z.id}
                            type="button"
                            onClick={() => {
                              const codes = formData.availabilityZones;
                              const newCodes = codes.includes(z.code)
                                ? codes.filter((c) => c !== z.code)
                                : [...codes, z.code];
                              setFormData({ ...formData, availabilityZones: newCodes });
                            }}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                              formData.availabilityZones.includes(z.code)
                                ? 'bg-blue-500/20 border border-blue-500 text-blue-400'
                                : 'bg-slate-800 border border-slate-700 text-slate-400 hover:border-slate-500'
                            }`}
                          >
                            {formData.availabilityZones.includes(z.code) ? '✓ ' : ''}{z.name}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wide mb-2 block">Target Date</label>
                      <Input
                        type="date"
                        value={formData.targetDate}
                        onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 4: Request Details */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">4</div>
                    <label className="text-sm font-semibold text-slate-200">Request Details</label>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Quantity</label>
                      <Input
                        type="number"
                        min={1}
                        value={formData.quantity}
                        onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                        required
                        className="bg-slate-950 border-slate-700 text-white min-h-[44px] text-center"
                      />
                    </div>
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
                  <div>
                    <label className="text-xs text-slate-400 uppercase tracking-wide mb-1.5 block">Justification</label>
                    <Textarea
                      value={formData.justification}
                      onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                      placeholder="Why do you need this product?"
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
                    disabled={createForecast.isPending || !formData.productId || !formData.flavorId}
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
                  {selectedProduct && (
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-lg">💻</div>
                      <div>
                        <div className="text-sm font-semibold text-white">{selectedProduct.name}</div>
                        <div className="text-xs text-slate-400">{selectedProduct.category?.name} · {selectedProduct.os || 'N/A'}</div>
                      </div>
                    </div>
                  )}

                  {selectedFlavor && (
                    <>
                      <div className="h-px bg-slate-700" />
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Flavor</span>
                        <span className="font-medium text-white">{selectedFlavor.name}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Specs</span>
                        <span className="font-medium text-white">{selectedFlavor.vcpu} vCPU · {selectedFlavor.ramGb} GB</span>
                      </div>
                    </>
                  )}

                  {formData.availabilityZones.length > 0 && (
                    <>
                      <div className="h-px bg-slate-700" />
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Regions</span>
                        <span className="font-medium text-white text-right">{formData.availabilityZones.join(', ')}</span>
                      </div>
                    </>
                  )}

                  {formData.targetDate && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Target Date</span>
                      <span className="font-medium text-white">{new Date(formData.targetDate).toLocaleDateString()}</span>
                    </div>
                  )}

                  {formData.quantity > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-400">Quantity</span>
                      <span className="font-medium text-white">{formData.quantity} instances</span>
                    </div>
                  )}

                  {selectedFlavor && formData.quantity > 0 && (
                    <>
                      <div className="h-px bg-slate-700" />
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-200">Total Resources</span>
                        <span className="text-lg font-bold text-blue-400">
                          {selectedFlavor.vcpu * formData.quantity} vCPU · {selectedFlavor.ramGb * formData.quantity} GB
                        </span>
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
