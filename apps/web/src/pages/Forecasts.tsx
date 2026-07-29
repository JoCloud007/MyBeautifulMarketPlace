import { useState, useEffect, useRef } from 'react';
import { useForecasts, useForecastStats, useCreateForecast, useUpdateForecast, useDeleteForecast, useProducts } from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
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
import type { ApprovalStatus, Forecast } from '@cloudmarket/shared-types';

const statusConfig: Record<ApprovalStatus, { label: string; color: string; icon: typeof Clock }> = {
  PENDING: { label: 'En attente', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20', icon: Clock },
  APPROVED: { label: 'Approuvé', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle },
  REJECTED: { label: 'Rejeté', color: 'bg-red-500/10 text-red-500 border-red-500/20', icon: XCircle },
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
  const { data: forecasts, isLoading: forecastsLoading, isError: forecastsError, refetch: refetchForecasts } = useForecasts();
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useForecastStats();
  const { data: products } = useProducts();
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
    justification: '',
  });

  const selectedProduct = products?.find((p) => p.id === formData.productId);

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
      rejectionReason: 'Rejeté via dashboard',
    });
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette demande ?')) {
      await deleteForecast.mutateAsync(id);
    }
  };

  const statCards = [
    { label: 'Total', value: stats?.total ?? 0, icon: BarChart3, color: 'text-blue-400' },
    { label: 'En attente', value: stats?.pending ?? 0, icon: Clock, color: 'text-amber-400' },
    { label: 'Approuvés', value: stats?.approved ?? 0, icon: CheckCircle, color: 'text-emerald-400' },
    { label: 'Rejetés', value: stats?.rejected ?? 0, icon: XCircle, color: 'text-red-400' },
  ];

  const hasError = forecastsError || statsError;

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <AnimatedSection>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Forecast Dashboard</h1>
            <p className="mt-2 text-slate-400">
              Suivez l'état de vos demandes de provisionnement.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nouvelle demande
          </Button>
        </div>
      </AnimatedSection>

      {hasError ? (
        <QueryError
          message="Impossible de charger les données du dashboard."
          onRetry={() => {
            if (forecastsError) refetchForecasts();
            if (statsError) refetchStats();
          }}
        />
      ) : (
        <>
          {/* Stats Cards */}
          {statsLoading ? (
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
                  placeholder="Rechercher..."
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
                  <option value="ALL">Tous les statuts</option>
                  <option value="PENDING">En attente</option>
                  <option value="APPROVED">Approuvé</option>
                  <option value="REJECTED">Rejeté</option>
                </Select>
              </div>
            </div>
          </AnimatedSection>

          {/* Forecasts Table / Cards */}
          <AnimatedSection delay={150}>
            <Card className="bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-white flex items-center justify-between">
                  <span>Demandes</span>
                  <span className="text-sm font-normal text-slate-500">
                    {filteredForecasts?.length ?? 0} résultat(s)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {forecastsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
                    ))}
                  </div>
                ) : filteredForecasts?.length === 0 ? (
                  <div className="text-center py-12 animate-fade-in">
                    <BarChart3 className="mx-auto h-12 w-12 text-slate-700" />
                    <p className="mt-4 text-lg font-medium text-slate-400">Aucune demande</p>
                    <p className="text-slate-500">
                      {searchQuery || statusFilter !== 'ALL'
                        ? 'Essayez de modifier vos filtres.'
                        : 'Créez votre première demande de provisionnement.'}
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
                            <th className="pb-3 text-left font-medium text-slate-400">Produit</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Flavor</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Qté</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Demandeur</th>
                            <th className="pb-3 text-left font-medium text-slate-400">Statut</th>
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
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">Nouvelle demande</DialogTitle>
            <DialogDescription className="text-slate-400">
              Créez une demande de provisionnement pour un produit.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Produit</label>
              <Select
                value={formData.productId}
                onChange={(e) =>
                  setFormData({ ...formData, productId: e.target.value, flavorId: '' })
                }
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
              >
                <option value="">Choisir un produit...</option>
                {products?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            {selectedProduct && selectedProduct.flavors.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Flavor</label>
                <Select
                  value={formData.flavorId}
                  onChange={(e) => setFormData({ ...formData, flavorId: e.target.value })}
                  required
                  className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                >
                  <option value="">Choisir un flavor...</option>
                  {selectedProduct.flavors.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name} ({f.vcpu} vCPU, {f.ramGb} GB)
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Demandeur</label>
                <Input
                  value={formData.requestedBy}
                  onChange={(e) => setFormData({ ...formData, requestedBy: e.target.value })}
                  placeholder="Nom"
                  required
                  className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Email</label>
                <Input
                  type="email"
                  value={formData.requesterEmail}
                  onChange={(e) => setFormData({ ...formData, requesterEmail: e.target.value })}
                  placeholder="email@exemple.com"
                  required
                  className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600 min-h-[44px]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Quantité</label>
              <Input
                type="number"
                min={1}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Justification</label>
              <Textarea
                value={formData.justification}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
                placeholder="Pourquoi avez-vous besoin de ce produit ?"
                rows={3}
                className="bg-slate-950 border-slate-700 text-white placeholder:text-slate-600"
              />
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white w-full sm:w-auto min-h-[44px]"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={createForecast.isPending}
                className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]"
              >
                {createForecast.isPending ? 'Création...' : 'Créer la demande'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


