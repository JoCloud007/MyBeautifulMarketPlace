import { useState, useEffect, useRef } from 'react';
import { useCreateForecast, useUpdateForecast, useDeleteForecast } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Server,
  Database,
  HardDrive,
  Cloud,
  Box,
  Cpu,
  Layers,
  Monitor,
  Globe,
  MapPin,
  Check,
} from 'lucide-react';

import type { ApprovalStatus } from '@cloudmarket/shared-types';

const statusConfig: Record<ApprovalStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'Pending', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  APPROVED: { label: 'Approved', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  REJECTED: { label: 'Rejected', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
};

const OS_VERSIONS: Record<string, string[]> = {
  Linux: ['Debian 12', 'Ubuntu 22.04 LTS', 'Red Hat Enterprise Linux 9', 'CentOS Stream 9'],
  Windows: ['Windows Server 2022', 'Windows Server 2019'],
};

function getCategoryIcon(categoryName?: string | null) {
  if (!categoryName) return Server;
  const name = categoryName.toLowerCase();
  if (name.includes('compute') || name.includes('vm') || name.includes('server')) return Server;
  if (name.includes('database') || name.includes('db')) return Database;
  if (name.includes('storage')) return HardDrive;
  if (name.includes('cloud')) return Cloud;
  if (name.includes('container') || name.includes('kubernetes') || name.includes('k8s')) return Box;
  if (name.includes('network')) return Globe;
  if (name.includes('monitor') || name.includes('observ')) return Monitor;
  if (name.includes('ai') || name.includes('ml') || name.includes('gpu')) return Cpu;
  return Layers;
}

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
  const [lines, setLines] = useState<Array<{ productId: string; flavorId: string; azCode: string; quantity: number; osVersion?: string }>>([]);
  const [draftLine, setDraftLine] = useState({ productId: '', flavorId: '', azCode: '', quantity: 1, osVersion: '' });

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
      lines: lines.map((l) => ({ productId: l.productId, flavorId: l.flavorId, azCode: l.azCode, quantity: l.quantity, metadata: l.osVersion ? { osVersion: l.osVersion } : undefined })),
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
    const payload: { productId: string; flavorId: string; azCode: string; quantity: number; osVersion?: string } = {
      productId: draftLine.productId,
      flavorId: draftLine.flavorId,
      azCode: draftLine.azCode,
      quantity: draftLine.quantity,
    };
    if (draftLine.osVersion) {
      payload.osVersion = draftLine.osVersion;
    }
    setLines([...lines, payload]);
    setDraftLine({ productId: '', flavorId: '', azCode: '', quantity: 1, osVersion: '' });
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

  const availableZones = zones?.filter(z =>
    selectedDraftProduct?.availabilityZones?.some(
      az => az.availabilityZone?.code === z.code || (az as any).code === z.code
    )
  );

  const canAddLine = draftLine.productId && draftLine.flavorId && draftLine.azCode;

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
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'ALL')}
                        className="bg-slate-950 border border-slate-700 text-white min-h-[44px] rounded-md px-3 py-2 text-sm"
                      >
                        <option value="ALL">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Approved</option>
                        <option value="REJECTED">Rejected</option>
                      </select>
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
                          </div>
                        ))}
                      </div>

                      {/* Desktop Table */}
                      <div className="hidden sm:block overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-700">
                              <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium">Products</th>
                              <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium">Requester</th>
                              <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium">Status</th>
                              <th className="text-left py-3 px-4 text-xs text-slate-500 font-medium">Date</th>
                              <th className="text-right py-3 px-4 text-xs text-slate-500 font-medium">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredForecasts?.map((forecast) => (
                              <tr key={forecast.id} className="border-b border-slate-800 hover:bg-slate-800/30 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="text-white font-medium">
                                    {forecast.lines?.map((l) => `${l.product?.name} (${l.flavor?.name})`).join(', ') || 'N/A'}
                                  </div>
                                </td>
                                <td className="py-3 px-4 text-slate-400">{forecast.requestedBy}</td>
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
                {/* Add Line Wizard */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold">+</div>
                    <label className="text-sm font-semibold text-slate-200">Add Line</label>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-5">
                    {/* Step 1: Product */}
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center">1</span>
                        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Choose Product</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {products?.map((p) => {
                          const Icon = getCategoryIcon(p.category?.name);
                          const isSelected = draftLine.productId === p.id;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setDraftLine({ productId: p.id, flavorId: '', azCode: '', quantity: 1, osVersion: '' })}
                              className={`relative flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                                  : 'border-slate-700 bg-slate-950 hover:border-slate-600 hover:bg-slate-900'
                              }`}
                            >
                              {isSelected && (
                                <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                  <Check className="w-2.5 h-2.5 text-white" />
                                </div>
                              )}
                              <Icon className={`w-5 h-5 mb-2 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                              <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{p.name}</span>
                              <span className="text-[10px] text-slate-500 mt-0.5">{p.category?.name}</span>
                              {p.os && (
                                <Badge variant="outline" className="mt-1.5 text-[10px] px-1.5 py-0 h-4 border-slate-700 text-slate-400">
                                  {p.os}
                                </Badge>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Step 2: Flavor */}
                    {selectedDraftProduct && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center">2</span>
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Choose Flavor</span>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                          {selectedDraftProduct.flavors.map((f: Flavor) => {
                            const isSelected = draftLine.flavorId === f.id;
                            return (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => setDraftLine({ ...draftLine, flavorId: f.id, azCode: '', osVersion: '' })}
                                className={`relative flex flex-col items-start p-3 rounded-lg border text-left transition-all ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                                    : 'border-slate-700 bg-slate-950 hover:border-slate-600 hover:bg-slate-900'
                                }`}
                              >
                                {isSelected && (
                                  <div className="absolute top-2 right-2 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                                    <Check className="w-2.5 h-2.5 text-white" />
                                  </div>
                                )}
                                <Cpu className={`w-4 h-4 mb-2 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                                <span className={`text-sm font-medium ${isSelected ? 'text-white' : 'text-slate-300'}`}>{f.name}</span>
                                <span className="text-[10px] text-slate-500 mt-0.5">{f.vcpu} vCPU · {f.ramGb} GB</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Step 3: OS Version */}
                    {selectedDraftProduct?.os && (selectedDraftProduct.os === 'Linux' || selectedDraftProduct.os === 'Windows') && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center">3</span>
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">OS Version</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {OS_VERSIONS[selectedDraftProduct.os]?.map((osVer) => {
                            const isSelected = draftLine.osVersion === osVer;
                            return (
                              <button
                                key={osVer}
                                type="button"
                                onClick={() => setDraftLine({ ...draftLine, osVersion: osVer })}
                                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500 text-white'
                                    : 'border-slate-700 bg-slate-950 hover:border-slate-600 hover:bg-slate-900 text-slate-300'
                                }`}
                              >
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                                <span>{osVer}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Step 4: Region & Quantity */}
                    {draftLine.flavorId && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full bg-blue-600 text-[10px] font-bold flex items-center justify-center`}>
                            {selectedDraftProduct?.os && (selectedDraftProduct.os === 'Linux' || selectedDraftProduct.os === 'Windows') ? '4' : '3'}
                          </span>
                          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wide">Region & Quantity</span>
                        </div>
                        <div className="space-y-2">
                          {availableZones && availableZones.length > 0 ? (
                            availableZones.map((z) => {
                              const isSelected = draftLine.azCode === z.code;
                              return (
                                <div key={z.id} className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setDraftLine({ ...draftLine, azCode: isSelected ? '' : z.code })}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all text-sm min-w-[160px] ${
                                      isSelected
                                        ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500 text-white'
                                        : 'border-slate-700 bg-slate-950 hover:border-slate-600 hover:bg-slate-900 text-slate-300'
                                    }`}
                                  >
                                    <MapPin className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                                    <span className="text-sm">{z.name}</span>
                                    {isSelected && <Check className="w-3 h-3 text-blue-400 ml-auto" />}
                                  </button>
                                  {isSelected && (
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-500">Qty</span>
                                      <Input
                                        type="number"
                                        min={1}
                                        value={draftLine.quantity}
                                        onChange={(e) => setDraftLine({ ...draftLine, quantity: parseInt(e.target.value) || 1 })}
                                        className="w-20 bg-slate-950 border-slate-700 text-white text-center h-9"
                                      />
                                    </div>
                                  )}
                                </div>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500">No availability zones for this product.</p>
                          )}
                        </div>
                      </div>
                    )}

                    <Button
                      type="button"
                      onClick={addLine}
                      disabled={!canAddLine}
                      className="bg-blue-600 hover:bg-blue-700 text-white w-full min-h-[44px] disabled:opacity-40"
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
                                <td className="py-2 px-3 text-white">
                                  {line.osVersion ? `${p?.name} ${line.osVersion}` : p?.name}
                                </td>
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
                          <span className="text-white font-medium">
                            {line.osVersion ? `${p?.name} ${line.osVersion}` : p?.name}
                          </span>
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
