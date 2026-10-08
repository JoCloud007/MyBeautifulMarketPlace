import { useState, useMemo, Children, useEffect } from 'react';
import { PickupList, productStatusPicklist } from '@/components/ui/pickup-list';
import {
  useAdminDashboard,
  useAdminProducts,
  useTransitions,
  useCreateTransition,
  useUpdateTransition,
  useDeleteTransition,
  useAdminCategories,
  useAdminDependencies,
  useAdminForecasts,
  useAdminUsers,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateDependency,
  useUpdateDependency,
  useDeleteDependency,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useUpdateForecast,
  useDeleteForecast,
  useAvailabilityZones,
  useCreateAvailabilityZone,
  useUpdateAvailabilityZone,
  useDeleteAvailabilityZone,
  useCountries,
  useRegions,
  useCreateRegion,
  useUpdateRegion,
  useDeleteRegion,
  useZones,
  useCreateZone,
  useUpdateZone,
  useDeleteZone,
  useInstances,
  useCreateInstance,
  useUpdateInstance,
  useDeleteInstance,
  useApplications,
  useCreateApplication,
  useUpdateApplication,
  useDeleteApplication,
  useContinuityLevels,
  useUpdateContinuityLevel,
  useOperatingSystems,
  useCreateOS,
  useUpdateOS,
  useDeleteOS,
  useCreateOSVersion,
  useUpdateOSVersion,
  useCreateProductVersion,
  useUpdateProductVersion,
  useDeleteProductVersion,
  useProductVariants,
  useCreateVariant,
  useUpdateVariant,
  useDeleteVariant,
  useFlavors,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useAdminFlavors,
  useCreateFlavor,
  useUpdateFlavor,
  useDeleteFlavor,
  usePerformanceProfiles,
  useCreatePerformanceProfile,
  useUpdatePerformanceProfile,
  useDeletePerformanceProfile,
  useInfraVersions,
  useCreateInfraVersion,
  useUpdateInfraVersion,
  useDeleteInfraVersion,
} from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MultiPickupInput } from '@/components/ui/multi-pickup';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import AdminPresentationOrders from './AdminPresentationOrders';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Package,
  Layers,
  BarChart3,
  Users,
  Activity,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  Link2,
  UserCog,
  Cpu,
  MapPin,
  Shield,
  TrendingUp,
  Monitor,
  ChevronRight,
  Box,
  LayoutList,
  Globe,
  Clock,
  AlertTriangle,
  X,
  ArrowRightLeft,
  Boxes,
} from 'lucide-react';
import type { ForecastStatus, Product, Category, Flavor, Dependency, User, Forecast, AvailabilityZone, Zone, Instance, InstanceStatus, Environment, OperatingSystem, OsVersion, ProductVariant, AvailabilityType, AvailabilitySchedule, ProductVersion, Region, Transition, InfraVersion } from '@cloudmarket/shared-types';
import { LifecyclePhase } from '@cloudmarket/shared-types';
import { PerformanceTargetType, VisibilityType } from '@cloudmarket/shared-types';

const statusConfig: Record<ForecastStatus, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'border-slate-500/20 text-slate-400' },
  PENDING_TECH: { label: 'Tech review', color: 'border-violet-500/20 text-violet-400' },
  PENDING_MANAGER: { label: 'Manager approval', color: 'border-amber-500/20 text-amber-500' },
  PENDING_BUDGET: { label: 'Budget validation', color: 'border-cyan-500/20 text-cyan-400' },
  APPROVED: { label: 'Approved', color: 'border-emerald-500/20 text-emerald-500' },
  REJECTED: { label: 'Rejected', color: 'border-red-500/20 text-red-500' },
  CANCELLED: { label: 'Cancelled', color: 'border-slate-600/20 text-slate-500' },
};

function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(' ');
}

function AnimatedSection({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn(
        'transition-all duration-500',
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        className
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

/* Reusable mobile card for table rows */
function MobileCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-slate-800 bg-slate-900/50 p-4 sm:hidden', className)}>
      {children}
    </div>
  );
}

/* Responsive table wrapper - shows cards on mobile, table on desktop */
function ResponsiveTable({
  headers,
  children,
  isLoading,
  emptyMessage,
  mobileCards,
}: {
  headers: string[];
  children: React.ReactNode;
  isLoading: boolean;
  emptyMessage: string;
  mobileCards?: React.ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg bg-slate-800 animate-pulse-soft" />
        ))}
      </div>
    );
  }

  if (Children.count(children) === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      {mobileCards && <div className="space-y-3 sm:hidden">{mobileCards}</div>}
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800">
              {headers.map((h) => (
                <th key={h} className="pb-3 text-left font-medium text-slate-400">
                  {h}
                </th>
              ))}
              <th className="pb-3 text-right font-medium text-slate-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">{children}</tbody>
        </table>
      </div>
    </>
  );
}

// ============ DASHBOARD SECTION ============
function DashboardSection({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { data: dashboard, isLoading, isError, refetch } = useAdminDashboard();
  const { data: products } = useAdminProducts();
  const { data: flavors } = useAdminFlavors();

  const counts = (dashboard as any)?.counts ?? {};
  const countCards = [
    { label: 'Products', value: counts.products ?? 0, icon: Package, color: 'text-blue-400', tab: 'products' },
    { label: 'Categories', value: counts.categories ?? 0, icon: Layers, color: 'text-purple-400', tab: 'categories' },
    { label: 'Forecasts', value: counts.forecasts ?? 0, icon: BarChart3, color: 'text-amber-400', tab: 'forecasts' },
    { label: 'Users', value: counts.users ?? 0, icon: Users, color: 'text-emerald-400', tab: 'users' },
    { label: 'Applications', value: counts.applications ?? 0, icon: Activity, color: 'text-cyan-400', tab: 'applications' },
    { label: 'Continuity Levels', value: counts.continuityLevels ?? 0, icon: CheckCircle, color: 'text-rose-400', tab: 'continuity-levels' },
    { label: 'Zones', value: counts.zones ?? 0, icon: Box, color: 'text-indigo-400', tab: 'zones' },
  ];

  const versionsEndingSoon = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const list: { id: string; productName: string; version: string; normalSupportEnd: string; daysLeft: number }[] = [];
    products?.forEach((p) => {
      p.productVersions?.forEach((v) => {
        if (v.normalSupportEnd) {
          const end = new Date(v.normalSupportEnd);
          if (end > now && end < cutoff) {
            const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            list.push({ id: v.id, productName: p.name, version: v.version, normalSupportEnd: v.normalSupportEnd, daysLeft });
          }
        }
      });
    });
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [products]);

  const flavorsRetiringSoon = useMemo(() => {
    const now = new Date();
    const cutoff = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
    const list: { id: string; name: string; eolDate: string; daysLeft: number }[] = [];
    flavors?.forEach((f) => {
      if (f.eolDate) {
        const end = new Date(f.eolDate);
        if (end > now && end < cutoff) {
          const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          list.push({ id: f.id, name: f.name, eolDate: f.eolDate, daysLeft });
        }
      }
    });
    return list.sort((a, b) => a.daysLeft - b.daysLeft);
  }, [flavors]);

  const phaseCounters = useMemo(() => {
    const counts: Record<LifecyclePhase, number> = {
      RELEASED: 0,
      NORMAL_SUPPORT: 0,
      EXTENDED_SUPPORT: 0,
      NO_SUPPORT: 0,
      EOL: 0,
    };
    products?.forEach((p) => {
      p.productVersions?.forEach((v) => {
        counts[v.phase] = (counts[v.phase] || 0) + 1;
      });
    });
    return counts;
  }, [products]);

  if (isError) {
    return <QueryError message="Unable to load dashboard." onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7">
          {countCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <AnimatedSection key={card.label} delay={i * 80}>
                <Card
                  className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5 cursor-pointer"
                  onClick={() => onNavigate(card.tab)}
                >
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-sm font-medium text-slate-400">{card.label}</CardTitle>
                    <Icon className={cn('h-4 w-4', card.color)} />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-white">{card.value}</div>
                  </CardContent>
                </Card>
              </AnimatedSection>
            );
          })}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Clock className="h-5 w-5 text-amber-500" />
              Versions ending support soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {versionsEndingSoon.length === 0 ? (
              <p className="text-sm text-slate-500">No versions ending support in the next 90 days.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {versionsEndingSoon.map((v) => (
                  <div key={v.id} className="flex items-center justify-between rounded-md bg-slate-800/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{v.productName} — {v.version}</p>
                      <p className="text-xs text-slate-400">Ends {new Date(v.normalSupportEnd).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className="border-amber-500/20 text-amber-500">
                      {v.daysLeft} days
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Flavors retiring soon
            </CardTitle>
          </CardHeader>
          <CardContent>
            {flavorsRetiringSoon.length === 0 ? (
              <p className="text-sm text-slate-500">No flavors retiring in the next 90 days.</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {flavorsRetiringSoon.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-md bg-slate-800/50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-white">{f.name}</p>
                      <p className="text-xs text-slate-400">EOL {new Date(f.eolDate).toLocaleDateString()}</p>
                    </div>
                    <Badge variant="outline" className="border-red-500/20 text-red-500">
                      {f.daysLeft} days
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Activity className="h-5 w-5 text-blue-500" />
            Lifecycle Phase Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Object.entries(phaseCounters).map(([phase, count]) => (
              <div key={phase} className="rounded-lg bg-slate-800/50 p-3 text-center">
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-xs text-slate-400 mt-1">{phase.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Activity className="h-5 w-5 text-blue-500" />
            Recent forecasts
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg bg-slate-800" />
              ))}
            </div>
          ) : (dashboard as any)?.recentForecasts?.length === 0 ? (
            <p className="text-center text-slate-500 py-8">No recent activity.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800">
                    <th className="pb-3 text-left font-medium text-slate-400">Product</th>
                    <th className="pb-3 text-left font-medium text-slate-400">Flavor</th>
                    <th className="pb-3 text-left font-medium text-slate-400">Qty</th>
                    <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                    <th className="pb-3 text-left font-medium text-slate-400">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {(dashboard as any)?.recentForecasts?.map((forecast: Forecast) => (
                    <tr key={forecast.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 font-medium text-white">{forecast.lines?.[0]?.product?.name}</td>
                      <td className="py-3 text-slate-400">{forecast.lines?.[0]?.flavor?.name}</td>
                      <td className="py-3 text-slate-400">{forecast.lines?.[0]?.quantity}</td>
                      <td className="py-3">
                        <Badge variant="outline" className={statusConfig[forecast.status].color}>
                          {statusConfig[forecast.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500">
                        {new Date(forecast.createdAt).toLocaleDateString('en-US')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ============ OS SECTION ============
function OSSection() {
  const { data: osList, isLoading, isError, refetch } = useOperatingSystems();
  const { data: allZones } = useZones();
  const createOS = useCreateOS();
  const updateOS = useUpdateOS();
  const deleteOS = useDeleteOS();
  const createVersion = useCreateOSVersion();
  const updateVersion = useUpdateOSVersion();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<OperatingSystem | null>(null);
  const [form, setForm] = useState({ family: '', name: '', isActive: true, availabilityType: 'STANDARD' as AvailabilityType, zoneIds: [] as string[] });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const [versionOpen, setVersionOpen] = useState(false);
  const [versionOSId, setVersionOSId] = useState('');
  const [editingVersion, setEditingVersion] = useState<OsVersion | null>(null);
  const [versionForm, setVersionForm] = useState({
    version: '', releaseDate: '', normalSupportEnd: '', extendedSupportEnd: '', eolDate: '', phase: 'RELEASED', isActive: true,
  });

  const resetForm = () => { setForm({ family: '', name: '', isActive: true, availabilityType: 'STANDARD' as AvailabilityType, zoneIds: [] }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (os: OperatingSystem) => {
    setEditing(os);
    setForm({ family: os.family, name: os.name, isActive: os.isActive, availabilityType: os.availabilityType || 'STANDARD', zoneIds: os.zones?.map((z: any) => z.zoneId) ?? [] });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateOS.mutateAsync({ id: editing.id, ...form });
      else await createOS.mutateAsync(form);
      setIsOpen(false); resetForm();
    } catch { /* handled by hook */ }
  };

  const handleDelete = (id: string) => { setConfirmDelete({ open: true, id }); };
  const handleConfirmDelete = async () => {
    try { if (confirmDelete.id) await deleteOS.mutateAsync(confirmDelete.id); } catch { }
    setConfirmDelete({ open: false, id: null });
  };

  const openVersionModal = (osId: string, v?: OsVersion) => {
    setVersionOSId(osId);
    if (v) {
      setEditingVersion(v);
      setVersionForm({
        version: v.version,
        releaseDate: v.releaseDate.slice(0, 10),
        normalSupportEnd: v.normalSupportEnd.slice(0, 10),
        extendedSupportEnd: v.extendedSupportEnd.slice(0, 10),
        eolDate: v.eolDate.slice(0, 10),
        phase: v.phase,
        isActive: v.isActive,
      });
    } else {
      setEditingVersion(null);
      setVersionForm({ version: '', releaseDate: '', normalSupportEnd: '', extendedSupportEnd: '', eolDate: '', phase: 'RELEASED', isActive: true });
    }
    setVersionOpen(true);
  };

  const handleVersionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...versionForm,
        phase: versionForm.phase as import('@cloudmarket/shared-types').LifecyclePhase,
        releaseDate: new Date(versionForm.releaseDate).toISOString(),
        normalSupportEnd: new Date(versionForm.normalSupportEnd).toISOString(),
        extendedSupportEnd: new Date(versionForm.extendedSupportEnd).toISOString(),
        eolDate: new Date(versionForm.eolDate).toISOString(),
      };
      if (editingVersion) await updateVersion.mutateAsync({ osId: versionOSId, versionId: editingVersion.id, ...payload });
      else await createVersion.mutateAsync({ osId: versionOSId, ...payload });
      setVersionOpen(false);
    } catch { /* handled by hook */ }
  };

  if (isError) return <QueryError message="Unable to load OS list." onRetry={refetch} />;

  const mobileCards = osList?.map((os) => (
    <MobileCard key={os.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{os.name}</p>
          <p className="text-sm text-slate-400">{os.family}</p>
        </div>
        <Badge variant="outline" className={os.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {os.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-slate-500">{os.versions?.length ?? 0} versions</span>
        <Badge variant="outline" className={
          os.availabilityType === 'RECOMMENDED' ? 'text-xs border-emerald-500/20 text-emerald-500' :
          os.availabilityType === 'RESTRICTED' ? 'text-xs border-red-500/20 text-red-500' :
          os.availabilityType === 'ON_DEMAND' ? 'text-xs border-amber-500/20 text-amber-500' :
          'text-xs border-slate-600 text-slate-400'
        }>
          {os.availabilityType?.replace('_', ' ') || 'Standard'}
        </Badge>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {os.zones?.map((z: any) => (
          <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openVersionModal(os.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Plus className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => openEdit(os)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(os.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add OS</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Family', 'Versions', 'Availability', 'Zones', 'Active']} isLoading={isLoading} emptyMessage="No operating systems" mobileCards={mobileCards}>
            {osList?.map((os) => (
              <tr key={os.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{os.name}</td>
                <td className="py-3 text-slate-400">{os.family}</td>
                <td className="py-3 text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>{os.versions?.length ?? 0}</span>
                    <Button size="sm" variant="ghost" onClick={() => openVersionModal(os.id)} className="h-6 w-6 p-0 text-slate-400 hover:text-blue-400"><Plus className="h-3 w-3" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {os.versions?.slice(0, 3).map((v: OsVersion) => (
                      <Badge key={v.id} variant="outline" className="text-[10px] border-slate-700 text-slate-400 cursor-pointer" onClick={() => openVersionModal(os.id, v)}>
                        {v.version}
                      </Badge>
                    ))}
                    {(os.versions?.length ?? 0) > 3 && <span className="text-[10px] text-slate-500">+{(os.versions.length - 3)} more</span>}
                  </div>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={
                    os.availabilityType === 'RECOMMENDED' ? 'border-emerald-500/20 text-emerald-500' :
                    os.availabilityType === 'RESTRICTED' ? 'border-red-500/20 text-red-500' :
                    os.availabilityType === 'ON_DEMAND' ? 'border-amber-500/20 text-amber-500' :
                    'border-slate-600 text-slate-400'
                  }>
                    {os.availabilityType?.replace('_', ' ') || 'Standard'}
                  </Badge>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {os.zones?.map((z: any) => (
                      <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
                    ))}
                  </div>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={os.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {os.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(os)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(os.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit OS' : 'New OS'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Family</label><Input value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Availability</label>
              <Select value={form.availabilityType} onChange={(e) => setForm({ ...form, availabilityType: e.target.value as AvailabilityType })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="STANDARD">Standard</option>
                <option value="RECOMMENDED">Recommended</option>
                <option value="RESTRICTED">Restricted</option>
                <option value="ON_DEMAND">On Demand</option>
              </Select>
            </div>
            <MultiPickupInput
              label="Zones"
              values={form.zoneIds}
              onChange={(ids) => setForm({ ...form, zoneIds: ids })}
              options={allZones?.map((z) => ({ id: z.id, label: z.name })) ?? []}
            />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="osActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
              <label htmlFor="osActive" className="text-sm text-slate-300">Active</label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={versionOpen} onOpenChange={setVersionOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editingVersion ? 'Edit Version' : 'New Version'}</DialogTitle></DialogHeader>
          <form onSubmit={handleVersionSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Version</label><Input value={versionForm.version} onChange={(e) => setVersionForm({ ...versionForm, version: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Release Date</label><Input type="date" value={versionForm.releaseDate} onChange={(e) => setVersionForm({ ...versionForm, releaseDate: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Normal Support End</label><Input type="date" value={versionForm.normalSupportEnd} onChange={(e) => setVersionForm({ ...versionForm, normalSupportEnd: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Extended Support End</label><Input type="date" value={versionForm.extendedSupportEnd} onChange={(e) => setVersionForm({ ...versionForm, extendedSupportEnd: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">EOL Date</label><Input type="date" value={versionForm.eolDate} onChange={(e) => setVersionForm({ ...versionForm, eolDate: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phase</label>
              <Select value={versionForm.phase} onChange={(e) => setVersionForm({ ...versionForm, phase: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="RELEASED">Released</option>
                <option value="NORMAL_SUPPORT">Normal Support</option>
                <option value="EXTENDED_SUPPORT">Extended Support</option>
                <option value="NO_SUPPORT">No Support</option>
                <option value="EOL">EOL</option>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="vActive" checked={versionForm.isActive} onChange={(e) => setVersionForm({ ...versionForm, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
              <label htmlFor="vActive" className="text-sm text-slate-300">Active</label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setVersionOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editingVersion ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })} title="Delete OS" description="Are you sure you want to delete this OS? This action cannot be undone." onConfirm={handleConfirmDelete} confirmLabel="Delete" cancelLabel="Cancel" variant="destructive" />
    </div>
  );
}

// ============ PRODUCTS SECTION ============
function ProductsSection() {
  const { data: products, isLoading, isError, refetch } = useAdminProducts();
  const { data: categories } = useAdminCategories();
  const { data: allZones } = useZones();
  const { data: allRegions } = useRegions();
  const { data: allAzs } = useAvailabilityZones();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', categoryId: '', computeType: '', os: '', documentation: '', roadmap: '', status: 'AVAILABLE', isActive: true, zoneIds: [] as string[], regionIds: [] as string[], availabilityZoneIds: [] as string[], schedules: [] as (Partial<AvailabilitySchedule> & { deleted?: boolean })[],
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setForm({ name: '', description: '', categoryId: '', computeType: '', os: '', documentation: '', roadmap: '', status: 'AVAILABLE', isActive: true, zoneIds: [], regionIds: [], availabilityZoneIds: [], schedules: [] });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name, description: product.description || '',
      categoryId: product.categoryId, computeType: product.computeType || '', os: product.os || '',
      documentation: product.documentation || '', roadmap: product.roadmap || '', status: product.status || 'AVAILABLE', isActive: product.isActive,
      zoneIds: product.zones?.map((z: any) => z.zoneId) ?? [],
      regionIds: product.regions?.map((r: any) => r.regionId) ?? [],
      availabilityZoneIds: product.availabilityZones?.map((az: any) => az.availabilityZoneId) ?? [],
      schedules: product.availabilitySchedules ? [...product.availabilitySchedules] : [],
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (!payload.computeType) delete payload.computeType;
      if (payload.regionIds.length === 0) delete payload.regionIds;
      if (payload.availabilityZoneIds.length === 0) delete payload.availabilityZoneIds;
      if (payload.schedules.length === 0) delete payload.schedules;
      if (editing) await updateProduct.mutateAsync({ id: editing.id, ...payload });
      else await createProduct.mutateAsync(payload);
      setIsOpen(false); resetForm();
    } catch {
      /* mutation error handled by hook onError */
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    try {
      if (confirmDelete.id) {
        await deleteProduct.mutateAsync(confirmDelete.id);
      }
    } catch {
      /* mutation error handled by hook onError */
    }
    setConfirmDelete({ open: false, id: null });
  };

  const filteredAzOptions = useMemo(() => {
    if (!allAzs) return [];
    if (form.regionIds.length === 0) return allAzs;
    const selectedRegionNames = allRegions?.filter((r) => form.regionIds.includes(r.id)).map((r) => r.name) || [];
    return allAzs.filter((az) => selectedRegionNames.includes(az.region));
  }, [allAzs, form.regionIds, allRegions]);

  const filteredZoneOptions = useMemo(() => {
    if (!allZones) return [];
    if (form.availabilityZoneIds.length === 0) return allZones;
    return allZones.filter((z) => z.availabilityZones?.some((za: any) => form.availabilityZoneIds.includes(za.availabilityZoneId)));
  }, [allZones, form.availabilityZoneIds]);

  if (isError) return <QueryError message="Unable to load products." onRetry={refetch} />;

  const isCompute = (p: Product) => p.category?.name.toLowerCase() === 'compute';

  const mobileCards = products?.map((product) => (
    <MobileCard key={product.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{product.name}</p>
          <p className="text-sm text-slate-400">{product.category?.name}</p>
        </div>
        <Badge variant="outline" className={product.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {product.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        {isCompute(product) && product.computeType && (
          <Badge variant="outline" className="text-xs border-slate-700 text-slate-400 mr-2">{product.computeType}</Badge>
        )}
        <span>{(product as any).variants?.length ?? 0} variants</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {product.regions?.map((r: any) => (
          <Badge key={r.regionId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{r.region?.name}</Badge>
        ))}
        {product.availabilityZones?.map((az: any) => (
          <Badge key={az.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{az.availabilityZone?.name}</Badge>
        ))}
        {product.zones?.map((z: any) => (
          <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => setDetailProduct(product)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => openEdit(product)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable
            headers={['Name', 'Category', 'Type', 'Variants', 'Regions', 'AZs', 'Zones', 'Active']}
            isLoading={isLoading}
            emptyMessage="No products"
            mobileCards={mobileCards}
          >
            {products?.map((product) => (
              <tr key={product.id} className="hover:bg-slate-800/50 transition-colors cursor-pointer" onClick={() => setDetailProduct(product)}>
                <td className="py-3 font-medium text-white">{product.name}</td>
                <td className="py-3 text-slate-400">{product.category?.name}</td>
                <td className="py-3 text-slate-400">
                  {isCompute(product) ? (product.computeType || '—') : '—'}
                </td>
                <td className="py-3 text-slate-400">{(product as any).variants?.length ?? 0}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.regions?.map((r: any) => (
                      <Badge key={r.regionId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{r.region?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.availabilityZones?.map((az: any) => (
                      <Badge key={az.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{az.availabilityZone?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.zones?.map((z: any) => (
                      <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
                    ))}
                  </div>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={product.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(product)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(product.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      {/* Product Detail Drawer */}
      <Dialog open={!!detailProduct} onOpenChange={(open) => !open && setDetailProduct(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Box className="h-5 w-5 text-blue-500" />
              {detailProduct?.name}
            </DialogTitle>
          </DialogHeader>
          {detailProduct && (
            <ProductDetailDrawer
              product={detailProduct}
              onClose={() => setDetailProduct(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? 'Edit product' : 'New product'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Category</label>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value, computeType: '' })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Choose...</option>
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            {categories?.find(c => c.id === form.categoryId)?.name.toLowerCase() === 'compute' && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Compute Type</label>
                <Select value={form.computeType} onChange={(e) => setForm({ ...form, computeType: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Select...</option>
                  <option value="PHYSICAL">Physical</option>
                  <option value="VIRTUAL">Virtual</option>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">OS</label>
              <Input value={form.os} onChange={(e) => setForm({ ...form, os: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Documentation</label>
              <Textarea value={form.documentation} onChange={(e) => setForm({ ...form, documentation: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Roadmap</label>
              <Textarea value={form.roadmap} onChange={(e) => setForm({ ...form, roadmap: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Status</label>
              <PickupList
                options={productStatusPicklist}
                value={form.status}
                onChange={(v) => setForm({ ...form, status: v })}
              />
            </div>
            <div className="space-y-2">
              <MultiPickupInput
                label="Regions"
                values={form.regionIds}
                onChange={(ids) => setForm({ ...form, regionIds: ids })}
                options={allRegions?.map((r) => ({ id: r.id, label: r.name })) ?? []}
              />
            </div>
            <div className="space-y-2">
              <MultiPickupInput
                label="Availability Zones"
                values={form.availabilityZoneIds}
                onChange={(ids) => setForm({ ...form, availabilityZoneIds: ids })}
                options={filteredAzOptions.map((az) => ({ id: az.id, label: az.name }))}
              />
            </div>
            <div className="space-y-2">
              <MultiPickupInput
                label="Zones"
                values={form.zoneIds}
                onChange={(ids) => setForm({ ...form, zoneIds: ids })}
                options={filteredZoneOptions.map((z) => ({ id: z.id, label: z.name }))}
              />
            </div>
            <ScheduleEditor
              schedules={form.schedules}
              onChange={(schedules) => setForm({ ...form, schedules })}
              regions={allRegions || []}
              azs={allAzs || []}
              zones={allZones || []}
            />
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
              <label htmlFor="isActive" className="text-sm text-slate-300">Active</label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ TRANSITIONS SECTION ============
function TransitionsAdminSection() {
  const { data: transitions, isLoading, isError, refetch } = useTransitions();
  const { data: products } = useAdminProducts();
  if (isError) return <QueryError message="Unable to load transitions." onRetry={refetch} />;
  const createTransition = useCreateTransition();
  const updateTransition = useUpdateTransition();
  const deleteTransition = useDeleteTransition();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Transition | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', fromProductId: '', toProductId: '',
    fromVersion: '', toVersion: '', migrationType: 'REBUILD', status: 'BACKLOG',
    availableFrom: '', notes: '',
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setForm({ name: '', description: '', fromProductId: '', toProductId: '', fromVersion: '', toVersion: '', migrationType: 'REBUILD', status: 'BACKLOG', availableFrom: '', notes: '' });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (t: Transition) => {
    setEditing(t);
    setForm({
      name: t.name, description: t.description || '',
      fromProductId: t.fromProductId, toProductId: t.toProductId,
      fromVersion: t.fromVersion, toVersion: t.toVersion,
      migrationType: t.migrationType, status: t.status,
      availableFrom: t.availableFrom ? t.availableFrom.slice(0, 10) : '',
      notes: t.notes || '',
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...form };
      if (payload.availableFrom) payload.availableFrom = new Date(payload.availableFrom).toISOString();
      else delete payload.availableFrom;
      if (editing) await updateTransition.mutateAsync({ id: editing.id, ...payload });
      else await createTransition.mutateAsync({ productId: form.fromProductId, ...payload });
      setIsOpen(false); resetForm();
    } catch {
      /* mutation error handled by hook onError */
    }
  };

  const handleConfirmDelete = async () => {
    try {
      if (confirmDelete.id) await deleteTransition.mutateAsync(confirmDelete.id);
    } catch {
      /* handled by hook */
    }
    setConfirmDelete({ open: false, id: null });
  };

  const statusCfg = (s: string) => {
    const opt = productStatusPicklist.find((o) => o.value === s);
    const colorMap: Record<string, string> = {
      BACKLOG: 'border-slate-500/40 text-slate-300', OPPORTUNITY: 'border-purple-500/40 text-purple-300',
      AVAILABLE: 'border-emerald-500/40 text-emerald-300', AVAILABLE_PILOT_PENDING: 'border-yellow-400/40 text-yellow-300',
      DELAY_PENDING: 'border-orange-500/40 text-orange-300', CANCELLED: 'border-red-500/40 text-red-300',
    };
    return { label: opt?.label || s, className: colorMap[s] || 'border-slate-600 text-slate-400' };
  };

  const mobileCards = transitions?.map((t) => (
    <MobileCard key={t.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{t.name}</p>
          <p className="text-sm text-slate-400">{t.fromProduct?.name} → {t.toProduct?.name}</p>
        </div>
        <Badge variant="outline" className={`text-xs ${statusCfg(t.status).className}`}>{statusCfg(t.status).label}</Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        {t.fromVersion} → {t.toVersion} · {t.migrationType.replace('_', '/')}
        {t.availableFrom && <span> · from {new Date(t.availableFrom).toLocaleDateString()}</span>}
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: t.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Add Transition
        </Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable
            headers={['Name', 'From', 'To', 'Versions', 'Migration', 'Status', 'Available From', '']}
            isLoading={isLoading}
            emptyMessage="No transitions"
            mobileCards={mobileCards}
          >
            {transitions?.map((t) => (
              <tr key={t.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{t.name}</td>
                <td className="py-3 text-slate-400">{t.fromProduct?.name}</td>
                <td className="py-3 text-cyan-300">{t.toProduct?.name}</td>
                <td className="py-3 text-slate-400">{t.fromVersion} → {t.toVersion}</td>
                <td className="py-3 text-slate-400">{t.migrationType.replace('_', ' ')}</td>
                <td className="py-3">
                  <Badge variant="outline" className={`text-xs ${statusCfg(t.status).className}`}>{statusCfg(t.status).label}</Badge>
                </td>
                <td className="py-3 text-slate-400">
                  {t.availableFrom ? new Date(t.availableFrom).toLocaleDateString() : '—'}
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(t)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: t.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: confirmDelete.id })}
        title="Delete transition"
        description="Are you sure you want to delete this transition? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />

      {/* Create/Edit Dialog */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? 'Edit transition' : 'New transition'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="e.g. RHEL 8 to 9 In-Place Upgrade" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">From Product</label>
                <Select value={form.fromProductId} onChange={(e) => setForm({ ...form, fromProductId: e.target.value })} required disabled={!!editing} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Choose...</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">To Product</label>
                <Select value={form.toProductId} onChange={(e) => setForm({ ...form, toProductId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Choose...</option>
                  {products?.filter((p) => p.id !== form.fromProductId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">From Version</label>
                <Input value={form.fromVersion} onChange={(e) => setForm({ ...form, fromVersion: e.target.value })} required placeholder="e.g. 8" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">To Version</label>
                <Input value={form.toVersion} onChange={(e) => setForm({ ...form, toVersion: e.target.value })} required placeholder="e.g. 9" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Migration Type</label>
                <Select value={form.migrationType} onChange={(e) => setForm({ ...form, migrationType: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="IN_PLACE">In-place</option>
                  <option value="REBUILD">Rebuild</option>
                  <option value="BLUE_GREEN">Blue/Green</option>
                  <option value="SNAPSHOT">Snapshot</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Status</label>
                <PickupList options={productStatusPicklist} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Available From</label>
              <Input type="date" value={form.availableFrom} onChange={(e) => setForm({ ...form, availableFrom: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="bg-slate-950 border-slate-700 text-white" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)} className="text-slate-400">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TransitionsSection({ productId }: { productId: string }) {
  const [paths, setPaths] = useState<{ outgoing: any[]; incoming: any[] }>({ outgoing: [], incoming: [] });
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [toProductId, setToProductId] = useState('');
  const [fromVersion, setFromVersion] = useState('');
  const [toVersion, setToVersion] = useState('');
  const [migrationType, setMigrationType] = useState('REBUILD');
  const { data: allProducts } = useAdminProducts();

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products/${productId}/upgrade-paths`);
      if (res.ok) setPaths(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [productId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products/${productId}/upgrade-paths`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toProductId, fromVersion, toVersion, migrationType }),
    });
    if (res.ok) {
      setFormOpen(false);
      setToProductId(''); setFromVersion(''); setToVersion('');
      load();
    }
  };

  const handleDelete = async (pathId: string) => {
    const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/products/${productId}/upgrade-paths/${pathId}`, { method: 'DELETE' });
    if (res.ok) load();
  };

  const targetProducts = allProducts?.filter((p) => p.id !== productId) || [];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-white">Transitions</h4>
        <Button size="sm" variant="ghost" onClick={() => setFormOpen((v) => !v)} className="text-blue-400 hover:bg-blue-500/10">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>

      {formOpen && (
        <form onSubmit={handleCreate} className="space-y-2 mb-3 p-3 rounded-md border border-slate-800 bg-slate-900">
          <Select value={toProductId} onChange={(e) => setToProductId(e.target.value)} required className="bg-slate-950 border-slate-700 text-white min-h-[40px]">
            <option value="">Transitions to product...</option>
            {targetProducts.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="From version (e.g. 1.0)" value={fromVersion} onChange={(e) => setFromVersion(e.target.value)} required className="bg-slate-950 border-slate-700 text-white min-h-[40px]" />
            <Input placeholder="To version (e.g. 2.0)" value={toVersion} onChange={(e) => setToVersion(e.target.value)} required className="bg-slate-950 border-slate-700 text-white min-h-[40px]" />
          </div>
          <Select value={migrationType} onChange={(e) => setMigrationType(e.target.value)} className="bg-slate-950 border-slate-700 text-white min-h-[40px]">
            <option value="IN_PLACE">In-place</option>
            <option value="REBUILD">Rebuild</option>
            <option value="BLUE_GREEN">Blue/Green</option>
            <option value="SNAPSHOT">Snapshot</option>
          </Select>
          <div className="flex gap-2">
            <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">Save</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setFormOpen(false)} className="text-slate-400">Cancel</Button>
          </div>
        </form>
      )}

      {loading ? (
        <Skeleton className="h-12 rounded-md bg-slate-800" />
      ) : paths.outgoing.length === 0 && paths.incoming.length === 0 ? (
        <p className="text-xs text-slate-500">No transitions declared for this product.</p>
      ) : (
        <div className="space-y-1.5">
          {paths.outgoing.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5">
              <span className="text-xs text-cyan-300">→ {p.toProduct?.name} <span className="text-slate-500">({p.fromVersion} → {p.toVersion} · {p.migrationType})</span></span>
              <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} className="h-6 w-6 p-0 text-slate-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
            </div>
          ))}
          {paths.incoming.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5">
              <span className="text-xs text-slate-400">← from {p.fromProduct?.name} <span className="text-slate-500">({p.fromVersion} → {p.toVersion})</span></span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductDetailDrawer({ product, onClose: _onClose }: { product: Product; onClose: () => void }) {
  const isCompute = product.category?.name.toLowerCase() === 'compute';
  const { data: variants, isLoading: variantsLoading } = useProductVariants(product.id);
  const { data: allFlavors } = useFlavors();
  const { data: allOS } = useOperatingSystems();
  const { data: allAZs } = useAvailabilityZones();
  const { data: allZones } = useZones();
  const { data: allCL } = useContinuityLevels();
  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();
  const deleteVariant = useDeleteVariant();

  const [variantOpen, setVariantOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [variantForm, setVariantForm] = useState({
    name: '', osId: '', osVersionId: '', flavorId: '', availabilityZoneIds: [] as string[], zoneIds: [] as string[], continuityLevelId: '', isActive: true, availabilityType: 'STANDARD' as AvailabilityType,
  });

  const resetVariantForm = () => {
    setVariantForm({ name: '', osId: '', osVersionId: '', flavorId: '', availabilityZoneIds: [], zoneIds: [], continuityLevelId: '', isActive: true, availabilityType: 'STANDARD' as AvailabilityType });
    setEditingVariant(null);
  };

  const openCreateVariant = () => { resetVariantForm(); setVariantOpen(true); };
  const openEditVariant = (v: ProductVariant) => {
    setEditingVariant(v);
    setVariantForm({
      name: v.name,
      osId: v.osId,
      osVersionId: v.osVersionId,
      flavorId: v.flavorId,
      availabilityZoneIds: v.availabilityZones?.map((az: any) => az.availabilityZoneId) ?? [],
      zoneIds: v.zones?.map((z: any) => z.zoneId) ?? [],
      continuityLevelId: v.continuityLevelId || '',
      isActive: v.isActive,
      availabilityType: (v.availabilityType as AvailabilityType) || 'STANDARD',
    });
    setVariantOpen(true);
  };

  const handleVariantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { ...variantForm };
      if (!payload.continuityLevelId) delete payload.continuityLevelId;
      if (editingVariant) await updateVariant.mutateAsync({ id: editingVariant.id, ...payload });
      else await createVariant.mutateAsync({ productId: product.id, ...payload });
      setVariantOpen(false); resetVariantForm();
    } catch {
      /* handled by hook */
    }
  };

  const selectedOS = allOS?.find(o => o.id === variantForm.osId);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-slate-500">Category:</span> <span className="text-white">{product.category?.name}</span></div>
        {isCompute && <div><span className="text-slate-500">Compute Type:</span> <span className="text-white">{product.computeType || '—'}</span></div>}
        <div><span className="text-slate-500">Status:</span> <Badge variant="outline" className={product.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>{product.isActive ? 'Active' : 'Inactive'}</Badge></div>
      </div>
      {product.description && <p className="text-sm text-slate-400">{product.description}</p>}

      {isCompute ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Variants</h3>
            <Button onClick={openCreateVariant} size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-1 h-3 w-3" /> Add Variant
            </Button>
          </div>
          {variantsLoading ? (
            <div className="space-y-3"><Skeleton className="h-14 rounded-lg bg-slate-800" /><Skeleton className="h-14 rounded-lg bg-slate-800" /></div>
          ) : variants && variants.length > 0 ? (
            <div className="space-y-3">
              {variants.map((v: ProductVariant) => (
                <div key={v.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="font-medium text-white">{v.name}</span>
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{v.os?.name} {v.osVersion?.version}</Badge>
                      <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{v.flavor?.name}</Badge>
                      {v.continuityLevel && <Badge variant="outline" className="text-xs border-slate-700" style={{ color: v.continuityLevel.color, borderColor: `${v.continuityLevel.color}40` }}>{v.continuityLevel.name}</Badge>}
                      {v.availabilityType && v.availabilityType !== 'STANDARD' && (
                        <Badge variant="outline" className={
                          v.availabilityType === 'RECOMMENDED' ? 'text-xs border-emerald-500/20 text-emerald-500' :
                          v.availabilityType === 'RESTRICTED' ? 'text-xs border-red-500/20 text-red-500' :
                          'text-xs border-amber-500/20 text-amber-500'
                        }>{v.availabilityType.replace('_', ' ')}</Badge>
                      )}
                      <Badge variant="outline" className={v.isActive ? 'text-xs border-emerald-500/20 text-emerald-500' : 'text-xs border-slate-600 text-slate-500'}>{v.isActive ? 'Active' : 'Inactive'}</Badge>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEditVariant(v)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400"><Pencil className="h-3 w-3" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteVariant.mutate(v.id)} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400"><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {v.availabilityZones?.map((az: any) => (
                      <Badge key={az.id} variant="secondary" className="text-[10px] bg-slate-900 text-slate-400 border-slate-800">{az.availabilityZone?.name}</Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 rounded-lg border border-slate-800 bg-slate-950">
              <p className="text-slate-500">No variants for this product.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">Product Details</h3>
          <div className="space-y-2 text-sm text-slate-400">
            {product.documentation && <div><span className="text-slate-500">Documentation:</span> Available</div>}
            {product.os && <div><span className="text-slate-500">OS:</span> {product.os}</div>}
          </div>
          {product.roadmap && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h4 className="text-sm font-medium text-white mb-3">Roadmap</h4>
              <div className="text-sm text-slate-300 whitespace-pre-line">{product.roadmap}</div>
            </div>
          )}
          {variants && variants.length > 0 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <h4 className="text-sm font-medium text-white mb-3">Release Timeline</h4>
              <div className="space-y-3">
                {Array.from(new Map(variants.map((v: ProductVariant) => [v.osVersionId, v])).values())
                  .filter((v: any) => v.osVersion?.releaseDate)
                  .sort((a: any, b: any) => new Date(b.osVersion.releaseDate).getTime() - new Date(a.osVersion.releaseDate).getTime())
                  .map((v: any) => (
                    <div key={v.osVersionId} className="flex items-center gap-3">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-500 shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-white">{v.os?.name} {v.osVersion?.version}</p>
                        <p className="text-xs text-slate-500">
                          Released {new Date(v.osVersion.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                          {v.osVersion.phase !== 'ACTIVE' && ` · ${v.osVersion.phase}`}
                          {v.osVersion.eolDate && ` · EOL ${new Date(v.osVersion.eolDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`}
                        </p>
                      </div>
                      <Badge variant="outline" className={
                        v.osVersion.phase === 'EOL' ? 'text-xs text-red-400 border-red-500/30' :
                        v.osVersion.phase === 'DEPRECATED' ? 'text-xs text-amber-400 border-amber-500/30' :
                        'text-xs text-green-400 border-green-500/30'
                      }>{v.osVersion.phase}</Badge>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      <TransitionsSection productId={product.id} />

      <Dialog open={variantOpen} onOpenChange={setVariantOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editingVariant ? 'Edit Variant' : 'New Variant'}</DialogTitle></DialogHeader>
          <form onSubmit={handleVariantSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={variantForm.name} onChange={(e) => setVariantForm({ ...variantForm, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Operating System</label>
              <Select value={variantForm.osId} onChange={(e) => setVariantForm({ ...variantForm, osId: e.target.value, osVersionId: '' })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Select OS...</option>
                {allOS?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Version</label>
              <Select value={variantForm.osVersionId} onChange={(e) => setVariantForm({ ...variantForm, osVersionId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Select version...</option>
                {selectedOS?.versions?.map((v: OsVersion) => (
                  <option key={v.id} value={v.id}>{v.version} ({v.phase})</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Flavor</label>
              <Select value={variantForm.flavorId} onChange={(e) => setVariantForm({ ...variantForm, flavorId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Select flavor...</option>
                {allFlavors?.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.vcpu} vCPU, {f.ramGb} GB)</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Availability Zones</label>
              <div className="flex flex-wrap gap-2">
                {allAZs?.map((az) => (
                  <label key={az.id} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={variantForm.availabilityZoneIds.includes(az.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...variantForm.availabilityZoneIds, az.id]
                          : variantForm.availabilityZoneIds.filter((id) => id !== az.id);
                        setVariantForm({ ...variantForm, availabilityZoneIds: ids });
                      }}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600"
                    />
                    {az.name}
                  </label>
                ))}
              </div>
            </div>
            <MultiPickupInput
              label="Zones"
              values={variantForm.zoneIds}
              onChange={(ids) => setVariantForm({ ...variantForm, zoneIds: ids })}
              options={allZones?.map((z) => ({ id: z.id, label: z.name })) ?? []}
            />
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Continuity Level</label>
              <Select value={variantForm.continuityLevelId} onChange={(e) => setVariantForm({ ...variantForm, continuityLevelId: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">None</option>
                {allCL?.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="vIsActive" checked={variantForm.isActive} onChange={(e) => setVariantForm({ ...variantForm, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
              <label htmlFor="vIsActive" className="text-sm text-slate-300">Active</label>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Availability</label>
                <Select
                  value={variantForm.availabilityType}
                  onChange={(e) => setVariantForm({ ...variantForm, availabilityType: e.target.value as AvailabilityType })}
                  className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                >
                  <option value="STANDARD">Standard</option>
                  <option value="RECOMMENDED">Recommended</option>
                  <option value="RESTRICTED">Restricted</option>
                  <option value="ON_DEMAND">On Demand</option>
                </Select>
              </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setVariantOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editingVariant ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ CATEGORIES SECTION ============
function CategoriesSection() {
  const { data: categories, isLoading, isError, refetch } = useAdminCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', description: '', icon: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ name: '', description: '', icon: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name, description: c.description || '', icon: c.icon || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, icon: form.icon || undefined };
      if (editing) await updateCategory.mutateAsync({ id: editing.id, ...payload });
      else await createCategory.mutateAsync(payload);
      setIsOpen(false); resetForm();
    } catch {
      /* mutation error handled by hook onError */
    }
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    try {
      if (confirmDelete.id) {
        await deleteCategory.mutateAsync(confirmDelete.id);
      }
    } catch {
      /* mutation error handled by hook onError */
    }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load categories." onRetry={refetch} />;

  const mobileCards = categories?.map((cat) => (
    <MobileCard key={cat.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{cat.name}</p>
        </div>
        <span className="text-sm text-slate-500">{(cat as any)._count?.products ?? 0} products</span>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(cat)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Description', 'Products']} isLoading={isLoading} emptyMessage="No categories" mobileCards={mobileCards}>
            {categories?.map((cat) => (
              <tr key={cat.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{cat.name}</td>
                <td className="py-3 text-slate-400 max-w-xs truncate">{cat.description || '—'}</td>
                <td className="py-3 text-slate-400">{(cat as any)._count?.products ?? 0}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(cat)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(cat.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit category' : 'New category'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Icon (Cpu, Database, Server, Monitor)</label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Category"
        description="Are you sure you want to delete this category? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ PERFORMANCE PROFILES SECTION ============
function PerformanceProfilesSection() {
  const { data: profiles, isLoading, isError, refetch } = usePerformanceProfiles();
  const createProfile = useCreatePerformanceProfile();
  const updateProfile = useUpdatePerformanceProfile();
  const deleteProfile = useDeletePerformanceProfile();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    targetType: PerformanceTargetType.PRODUCT,
    targetId: '',
    overallScore: 50,
    scoreLabel: null as string | null,
    colorTheme: 'blue' as 'green' | 'yellow' | 'red' | 'blue',
    visibility: VisibilityType.SHOW_ALL,
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setForm({ name: '', targetType: PerformanceTargetType.PRODUCT, targetId: '', overallScore: 50, scoreLabel: null, colorTheme: 'blue', visibility: VisibilityType.SHOW_ALL });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      name: p.name,
      targetType: p.targetType,
      targetId: p.targetId,
      overallScore: p.overallScore,
      scoreLabel: p.scoreLabel || '',
      colorTheme: p.colorTheme || 'blue',
      visibility: p.visibility || VisibilityType.SHOW_ALL,
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateProfile.mutateAsync({ id: editing.id, ...form });
      else await createProfile.mutateAsync(form);
      setIsOpen(false); resetForm();
    } catch { /* handled by hook */ }
  };

  const handleDelete = (id: string) => { setConfirmDelete({ open: true, id }); };
  const handleConfirmDelete = async () => {
    try { if (confirmDelete.id) await deleteProfile.mutateAsync(confirmDelete.id); } catch { }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load performance profiles." onRetry={refetch} />;

  const colorMap: Record<string, string> = {
    green: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    yellow: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
    blue: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  };

  const mobileCards = profiles?.map((p) => (
    <MobileCard key={p.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{p.name}</p>
          <p className="text-sm text-slate-400">{p.targetType} · Score {p.overallScore}</p>
        </div>
        <Badge variant="outline" className={colorMap[p.colorTheme] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{p.colorTheme}</Badge>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(p)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add Profile</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Target', 'Score', 'Label', 'Theme', 'Visibility']} isLoading={isLoading} emptyMessage="No performance profiles" mobileCards={mobileCards}>
            {profiles?.map((p) => (
              <tr key={p.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{p.name}</td>
                <td className="py-3 text-slate-400">{p.targetType}<br/><span className="text-xs text-slate-600">{p.targetId.slice(0, 8)}...</span></td>
                <td className="py-3 text-slate-400">{p.overallScore}</td>
                <td className="py-3 text-slate-400">{p.scoreLabel || '—'}</td>
                <td className="py-3"><Badge variant="outline" className={colorMap[p.colorTheme] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{p.colorTheme}</Badge></td>
                <td className="py-3 text-slate-400">{p.visibility}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(p.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit Performance Profile' : 'New Performance Profile'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Target Type</label>
                <Select value={form.targetType} onChange={(e) => setForm({ ...form, targetType: e.target.value as PerformanceTargetType })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="PRODUCT">Product</option>
                  <option value="FLAVOR">Flavor</option>
                </Select>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Target ID (UUID)</label><Input value={form.targetId} onChange={(e) => setForm({ ...form, targetId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Overall Score (0-100)</label><Input type="number" min="0" max="100" value={form.overallScore} onChange={(e) => setForm({ ...form, overallScore: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Score Label</label><Input value={form.scoreLabel || ''} onChange={(e) => setForm({ ...form, scoreLabel: e.target.value || null })} placeholder="e.g. Excellent" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Color Theme</label>
                <Select value={form.colorTheme} onChange={(e) => setForm({ ...form, colorTheme: e.target.value as 'green' | 'yellow' | 'red' | 'blue' })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="green">Green</option>
                  <option value="yellow">Yellow</option>
                  <option value="red">Red</option>
                  <option value="blue">Blue</option>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Visibility</label>
                <Select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as VisibilityType })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="SHOW_ALL">Show All</option>
                  <option value="INTERNAL_ONLY">Internal Only</option>
                  <option value="HIDDEN">Hidden</option>
                </Select>
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })} title="Delete Performance Profile" description="Are you sure you want to delete this performance profile?" onConfirm={handleConfirmDelete} confirmLabel="Delete" cancelLabel="Cancel" variant="destructive" />
    </div>
  );
}

// ============ FLAVORS SECTION ============
function FlavorsSection() {
  const { data: flavors, isLoading, isError, refetch } = useAdminFlavors();
  const { data: allZones } = useZones();
  const { data: allRegions } = useRegions();
  const { data: allAzs } = useAvailabilityZones();
  const createFlavor = useCreateFlavor();
  const updateFlavor = useUpdateFlavor();
  const deleteFlavor = useDeleteFlavor();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Flavor | null>(null);
  const [form, setForm] = useState({ name: '', vcpu: 0, ramGb: 0, description: '', zoneIds: [] as string[], regionIds: [] as string[], availabilityZoneIds: [] as string[], schedules: [] as (Partial<AvailabilitySchedule> & { deleted?: boolean })[], releaseDate: '', deprecationDate: '', eolDate: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ name: '', vcpu: 0, ramGb: 0, description: '', zoneIds: [], regionIds: [], availabilityZoneIds: [], schedules: [], releaseDate: '', deprecationDate: '', eolDate: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (f: Flavor) => { setEditing(f); setForm({ name: f.name, vcpu: f.vcpu, ramGb: f.ramGb, description: f.description || '', zoneIds: f.zones?.map((z: any) => z.zoneId) ?? [], regionIds: f.regions?.map((r: any) => r.regionId) ?? [], availabilityZoneIds: f.availabilityZones?.map((az: any) => az.availabilityZoneId) ?? [], schedules: f.availabilitySchedules ? [...f.availabilitySchedules] : [], releaseDate: f.releaseDate ? f.releaseDate.slice(0, 10) : '', deprecationDate: f.deprecationDate ? f.deprecationDate.slice(0, 10) : '', eolDate: f.eolDate ? f.eolDate.slice(0, 10) : '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (payload.releaseDate) payload.releaseDate = new Date(payload.releaseDate).toISOString();
    else delete payload.releaseDate;
    if (payload.deprecationDate) payload.deprecationDate = new Date(payload.deprecationDate).toISOString();
    else delete payload.deprecationDate;
    if (payload.eolDate) payload.eolDate = new Date(payload.eolDate).toISOString();
    else delete payload.eolDate;
    if (payload.regionIds.length === 0) delete payload.regionIds;
    if (payload.availabilityZoneIds.length === 0) delete payload.availabilityZoneIds;
    if (payload.schedules.length === 0) delete payload.schedules;
    if (editing) await updateFlavor.mutateAsync({ id: editing.id, ...payload });
    else await createFlavor.mutateAsync(payload);
    setIsOpen(false); resetForm();
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteFlavor.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  const filteredAzOptions = useMemo(() => {
    if (!allAzs) return [];
    if (form.regionIds.length === 0) return allAzs;
    const selectedRegionNames = allRegions?.filter((r) => form.regionIds.includes(r.id)).map((r) => r.name) || [];
    return allAzs.filter((az) => selectedRegionNames.includes(az.region));
  }, [allAzs, form.regionIds, allRegions]);

  const filteredZoneOptions = useMemo(() => {
    if (!allZones) return [];
    if (form.availabilityZoneIds.length === 0) return allZones;
    return allZones.filter((z) => z.availabilityZones?.some((za: any) => form.availabilityZoneIds.includes(za.availabilityZoneId)));
  }, [allZones, form.availabilityZoneIds]);

  if (isError) return <QueryError message="Unable to load flavors." onRetry={refetch} />;

  const mobileCards = flavors?.map((flavor) => (
    <MobileCard key={flavor.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{flavor.name}</p>
          <p className="text-sm text-slate-400">{(flavor as any)._count?.variants ?? 0} variants</p>
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        {flavor.vcpu} vCPU · {flavor.ramGb} GB RAM
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {flavor.regions?.map((r: any) => (
          <Badge key={r.regionId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{r.region?.name}</Badge>
        ))}
        {flavor.availabilityZones?.map((az: any) => (
          <Badge key={az.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{az.availabilityZone?.name}</Badge>
        ))}
        {flavor.zones?.map((z: any) => (
          <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(flavor)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(flavor.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add Flavor</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'vCPU', 'RAM', 'Used By', 'Regions', 'AZs', 'Zones', 'Description']} isLoading={isLoading} emptyMessage="No flavors" mobileCards={mobileCards}>
            {flavors?.map((flavor) => (
              <tr key={flavor.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{flavor.name}</td>
                <td className="py-3 text-slate-400">{flavor.vcpu}</td>
                <td className="py-3 text-slate-400">{flavor.ramGb} GB</td>
                <td className="py-3 text-slate-400">{(flavor as any)._count?.variants ?? 0}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {flavor.regions?.map((r: any) => (
                      <Badge key={r.regionId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{r.region?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {flavor.availabilityZones?.map((az: any) => (
                      <Badge key={az.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{az.availabilityZone?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {flavor.zones?.map((z: any) => (
                      <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
                    ))}
                  </div>
                </td>
                <td className="py-3 text-slate-400 max-w-xs truncate">{flavor.description || '—'}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(flavor)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(flavor.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit flavor' : 'New flavor'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">vCPU</label><Input type="number" value={form.vcpu} onChange={(e) => setForm({ ...form, vcpu: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">RAM (GB)</label><Input type="number" value={form.ramGb} onChange={(e) => setForm({ ...form, ramGb: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white" /></div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Release Date</label><Input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Deprecation Date</label><Input type="date" value={form.deprecationDate} onChange={(e) => setForm({ ...form, deprecationDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">EOL Date</label><Input type="date" value={form.eolDate} onChange={(e) => setForm({ ...form, eolDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <MultiPickupInput
              label="Regions"
              values={form.regionIds}
              onChange={(ids) => setForm({ ...form, regionIds: ids })}
              options={allRegions?.map((r) => ({ id: r.id, label: r.name })) ?? []}
            />
            <MultiPickupInput
              label="Availability Zones"
              values={form.availabilityZoneIds}
              onChange={(ids) => setForm({ ...form, availabilityZoneIds: ids })}
              options={filteredAzOptions.map((az) => ({ id: az.id, label: az.name }))}
            />
            <MultiPickupInput
              label="Zones"
              values={form.zoneIds}
              onChange={(ids) => setForm({ ...form, zoneIds: ids })}
              options={filteredZoneOptions.map((z) => ({ id: z.id, label: z.name }))}
            />
            <ScheduleEditor
              schedules={form.schedules}
              onChange={(schedules) => setForm({ ...form, schedules })}
              regions={allRegions || []}
              azs={allAzs || []}
              zones={allZones || []}
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Flavor"
        description="Are you sure you want to delete this flavor? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

function ScheduleEditor({
  schedules,
  onChange,
  regions,
  azs,
  zones,
}: {
  schedules: (Partial<AvailabilitySchedule> & { deleted?: boolean })[];
  onChange: (schedules: (Partial<AvailabilitySchedule> & { deleted?: boolean })[]) => void;
  regions: any[];
  azs: any[];
  zones: any[];
}) {
  const addSchedule = () => {
    onChange([...schedules, { status: 'STANDARD' as AvailabilityType }]);
  };

  const updateSchedule = (index: number, field: string, value: any) => {
    const updated = [...schedules];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const removeSchedule = (index: number) => {
    const s = schedules[index];
    if (s.id) {
      const updated = [...schedules];
      updated[index] = { ...updated[index], deleted: true };
      onChange(updated);
    } else {
      onChange(schedules.filter((_, i) => i !== index));
    }
  };

  const visibleSchedules = schedules.filter((s) => !s.deleted);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Availability Schedules</label>
        <Button type="button" size="sm" variant="outline" onClick={addSchedule} className="border-slate-700 text-slate-300 hover:bg-slate-800">
          <Plus className="h-3 w-3 mr-1" /> Add
        </Button>
      </div>
      {visibleSchedules.length === 0 && (
        <p className="text-xs text-slate-500">No schedules. Add one to define granular availability dates.</p>
      )}
      {visibleSchedules.map((s) => {
        const realIndex = schedules.findIndex((x) => x === s);
        return (
          <div key={realIndex} className="grid grid-cols-12 gap-2 items-end bg-slate-950 border border-slate-800 rounded-md p-2">
            <div className="col-span-3">
              <select
                value={s.regionId || ''}
                onChange={(e) => updateSchedule(realIndex, 'regionId', e.target.value || null)}
                className="w-full h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
              >
                <option value="">Any Region</option>
                {regions?.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <select
                value={s.azId || ''}
                onChange={(e) => updateSchedule(realIndex, 'azId', e.target.value || null)}
                className="w-full h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
              >
                <option value="">Any AZ</option>
                {azs?.map((az) => (
                  <option key={az.id} value={az.id}>{az.name} ({az.code})</option>
                ))}
              </select>
            </div>
            <div className="col-span-3">
              <select
                value={s.zoneId || ''}
                onChange={(e) => updateSchedule(realIndex, 'zoneId', e.target.value || null)}
                className="w-full h-8 rounded border border-slate-700 bg-slate-900 px-2 text-xs text-white"
              >
                <option value="">Any Zone</option>
                {zones?.map((z) => (
                  <option key={z.id} value={z.id}>{z.name}</option>
                ))}
              </select>
            </div>
            <div className="col-span-1">
              <select
                value={s.status || 'STANDARD'}
                onChange={(e) => updateSchedule(realIndex, 'status', e.target.value)}
                className="w-full h-8 rounded border border-slate-700 bg-slate-900 px-1 text-xs text-white"
              >
                <option value="STANDARD">Std</option>
                <option value="RECOMMENDED">Rec</option>
                <option value="RESTRICTED">Res</option>
                <option value="ON_DEMAND">OnD</option>
              </select>
            </div>
            <div className="col-span-1">
              <Button type="button" size="sm" variant="ghost" onClick={() => removeSchedule(realIndex)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400">
                <X className="h-3 w-3" />
              </Button>
            </div>
            <div className="col-span-6">
              <Input
                type="date"
                value={s.availableFrom ? s.availableFrom.slice(0, 10) : ''}
                onChange={(e) => updateSchedule(realIndex, 'availableFrom', e.target.value ? new Date(e.target.value).toISOString() : null)}
                placeholder="From"
                className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
              />
            </div>
            <div className="col-span-6">
              <Input
                type="date"
                value={s.availableUntil ? s.availableUntil.slice(0, 10) : ''}
                onChange={(e) => updateSchedule(realIndex, 'availableUntil', e.target.value ? new Date(e.target.value).toISOString() : null)}
                placeholder="Until"
                className="bg-slate-900 border-slate-700 text-white h-8 text-xs"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ============ PRODUCT VERSIONS SECTION ============
function ProductVersionsSection() {
  const { data: products, isLoading, isError, refetch } = useAdminProducts();
  const { data: allZones } = useZones();
  const { data: allAzs } = useAvailabilityZones();
  const { data: allRegions } = useRegions();
  const createVersion = useCreateProductVersion();
  const updateVersion = useUpdateProductVersion();
  const deleteVersion = useDeleteProductVersion();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<ProductVersion | null>(null);
  const [form, setForm] = useState({ productId: '', version: '', releaseDate: '', normalSupportEnd: '', extendedSupportEnd: '', eolDate: '', phase: 'RELEASED' as LifecyclePhase, isActive: true, changelog: '', regionIds: [] as string[], zoneIds: [] as string[], availabilityZoneIds: [] as string[], schedules: [] as (Partial<AvailabilitySchedule> & { deleted?: boolean })[] });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const allVersions = useMemo(() => {
    const list: (ProductVersion & { productName: string })[] = [];
    products?.forEach((p) => {
      p.productVersions?.forEach((v) => {
        list.push({ ...v, productName: p.name });
      });
    });
    return list;
  }, [products]);

  const resetForm = () => { setForm({ productId: '', version: '', releaseDate: '', normalSupportEnd: '', extendedSupportEnd: '', eolDate: '', phase: LifecyclePhase.RELEASED, isActive: true, changelog: '', regionIds: [], zoneIds: [], availabilityZoneIds: [], schedules: [] }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (v: ProductVersion & { productName: string }) => {
    setEditing(v);
    setForm({
      productId: v.productId,
      version: v.version,
      releaseDate: v.releaseDate ? v.releaseDate.slice(0, 10) : '',
      normalSupportEnd: v.normalSupportEnd ? v.normalSupportEnd.slice(0, 10) : '',
      extendedSupportEnd: v.extendedSupportEnd ? v.extendedSupportEnd.slice(0, 10) : '',
      eolDate: v.eolDate ? v.eolDate.slice(0, 10) : '',
      phase: v.phase,
      isActive: v.isActive,
      changelog: v.changelog || '',
      regionIds: v.regions?.map((r: any) => r.regionId) ?? [],
      zoneIds: v.zones?.map((z: any) => z.zoneId) ?? [],
      availabilityZoneIds: v.availabilityZones?.map((az: any) => az.availabilityZoneId) ?? [],
      schedules: v.availabilitySchedules ? [...v.availabilitySchedules] : [],
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        version: form.version,
        releaseDate: form.releaseDate ? new Date(form.releaseDate).toISOString() : undefined,
        normalSupportEnd: form.normalSupportEnd ? new Date(form.normalSupportEnd).toISOString() : undefined,
        extendedSupportEnd: form.extendedSupportEnd ? new Date(form.extendedSupportEnd).toISOString() : undefined,
        eolDate: form.eolDate ? new Date(form.eolDate).toISOString() : undefined,
        phase: form.phase,
        isActive: form.isActive,
        changelog: form.changelog || undefined,
        regionIds: form.regionIds.length > 0 ? form.regionIds : undefined,
        zoneIds: form.zoneIds.length > 0 ? form.zoneIds : undefined,
        availabilityZoneIds: form.availabilityZoneIds.length > 0 ? form.availabilityZoneIds : undefined,
        schedules: form.schedules.length > 0 ? form.schedules : undefined,
      };
      if (editing) {
        await updateVersion.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createVersion.mutateAsync({ productId: form.productId, ...payload });
      }
      setIsOpen(false);
      resetForm();
    } catch { /* handled by hook */ }
  };

  const handleDelete = (id: string) => { setConfirmDelete({ open: true, id }); };
  const handleConfirmDelete = async () => {
    try { if (confirmDelete.id) await deleteVersion.mutateAsync(confirmDelete.id); } catch { }
    setConfirmDelete({ open: false, id: null });
  };

  const filteredAzOptions = useMemo(() => {
    if (!allAzs) return [];
    if (form.regionIds.length === 0) return allAzs;
    const selectedRegionNames = allRegions?.filter((r) => form.regionIds.includes(r.id)).map((r) => r.name) || [];
    return allAzs.filter((az) => selectedRegionNames.includes(az.region));
  }, [allAzs, form.regionIds, allRegions]);

  const filteredZoneOptions = useMemo(() => {
    if (!allZones) return [];
    if (form.availabilityZoneIds.length === 0) return allZones;
    return allZones.filter((z) => z.availabilityZones?.some((za: any) => form.availabilityZoneIds.includes(za.availabilityZoneId)));
  }, [allZones, form.availabilityZoneIds]);

  if (isError) return <QueryError message="Unable to load product versions." onRetry={refetch} />;

  const mobileCards = allVersions?.map((v) => (
    <MobileCard key={v.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{v.productName}</p>
          <p className="text-sm text-slate-400">{v.version}</p>
        </div>
        <Badge variant="outline" className={v.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {v.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">Phase: {v.phase.replace(/_/g, ' ')}</div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(v)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(v.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add Version</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Product', 'Version', 'Release Date', 'Normal Support End', 'Extended Support End', 'EOL Date', 'Phase', 'Active', 'Regions', 'Zones', 'AZ']} isLoading={isLoading} emptyMessage="No product versions" mobileCards={mobileCards}>
            {allVersions?.map((v) => (
              <tr key={v.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{v.productName}</td>
                <td className="py-3 text-slate-400">{v.version}</td>
                <td className="py-3 text-slate-400">{v.releaseDate ? new Date(v.releaseDate).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-slate-400">{v.normalSupportEnd ? new Date(v.normalSupportEnd).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-slate-400">{v.extendedSupportEnd ? new Date(v.extendedSupportEnd).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-slate-400">{v.eolDate ? new Date(v.eolDate).toLocaleDateString() : '—'}</td>
                <td className="py-3">
                  <Badge variant="outline" className="border-blue-500/20 text-blue-400">
                    {v.phase.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={v.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {v.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {v.regions?.map((r: any) => (
                      <Badge key={r.regionId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{r.region?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {v.zones?.map((z: any) => (
                      <Badge key={z.zoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.zone?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {v.availabilityZones?.map((az: any) => (
                      <Badge key={az.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{az.availabilityZone?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(v)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(v.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit Product Version' : 'New Product Version'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editing && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Product</label>
                <select
                  value={form.productId}
                  onChange={(e) => setForm({ ...form, productId: e.target.value })}
                  required
                  className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
                >
                  <option value="">Select Product...</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Version</label><Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Release Date</label><Input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Normal Support End</label><Input type="date" value={form.normalSupportEnd} onChange={(e) => setForm({ ...form, normalSupportEnd: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Extended Support End</label><Input type="date" value={form.extendedSupportEnd} onChange={(e) => setForm({ ...form, extendedSupportEnd: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">EOL Date</label><Input type="date" value={form.eolDate} onChange={(e) => setForm({ ...form, eolDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phase</label>
              <select
                value={form.phase}
                onChange={(e) => setForm({ ...form, phase: e.target.value as LifecyclePhase })}
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="RELEASED">Released</option>
                <option value="NORMAL_SUPPORT">Normal Support</option>
                <option value="EXTENDED_SUPPORT">Extended Support</option>
                <option value="NO_SUPPORT">No Support</option>
                <option value="EOL">EOL</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="pv-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-700 bg-slate-950" />
              <label htmlFor="pv-active" className="text-sm text-slate-300">Active</label>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Changelog</label><Textarea value={form.changelog} onChange={(e) => setForm({ ...form, changelog: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" /></div>
            <MultiPickupInput
              label="Regions"
              values={form.regionIds}
              onChange={(ids) => setForm({ ...form, regionIds: ids })}
              options={allRegions?.map((r) => ({ id: r.id, label: r.name })) ?? []}
            />
            <MultiPickupInput
              label="Availability Zones"
              values={form.availabilityZoneIds}
              onChange={(ids) => setForm({ ...form, availabilityZoneIds: ids })}
              options={filteredAzOptions?.map((az) => ({ id: az.id, label: az.name })) ?? []}
            />
            <MultiPickupInput
              label="Zones"
              values={form.zoneIds}
              onChange={(ids) => setForm({ ...form, zoneIds: ids })}
              options={filteredZoneOptions?.map((z) => ({ id: z.id, label: z.name })) ?? []}
            />
            <ScheduleEditor
              schedules={form.schedules}
              onChange={(schedules) => setForm({ ...form, schedules })}
              regions={allRegions || []}
              azs={allAzs || []}
              zones={allZones || []}
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Product Version"
        description="Are you sure you want to delete this product version? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ DEPENDENCIES SECTION ============
function DependenciesSection() {
  const { data: dependencies, isLoading, isError, refetch } = useAdminDependencies();
  const { data: products } = useAdminProducts();
  const createDependency = useCreateDependency();
  const updateDependency = useUpdateDependency();
  const deleteDependency = useDeleteDependency();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Dependency | null>(null);
  const [form, setForm] = useState({ productId: '', dependsOnId: '', type: 'REQUIRED' as 'REQUIRED' | 'RECOMMENDED', description: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ productId: '', dependsOnId: '', type: 'REQUIRED', description: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (d: Dependency) => { setEditing(d); setForm({ productId: d.productId, dependsOnId: d.dependsOnId, type: d.type, description: d.description || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateDependency.mutateAsync({ id: editing.id, ...form, type: form.type as Dependency['type'] });
    else await createDependency.mutateAsync({ ...form, type: form.type as Dependency['type'] });
    setIsOpen(false); resetForm();
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteDependency.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load dependencies." onRetry={refetch} />;

  const mobileCards = dependencies?.map((dep) => (
    <MobileCard key={dep.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{dep.product?.name}</p>
          <p className="text-sm text-slate-400">→ {dep.dependsOn?.name}</p>
        </div>
        <Badge variant="outline" className={dep.type === 'REQUIRED' ? 'border-amber-500/20 text-amber-500' : 'border-emerald-500/20 text-emerald-500'}>
          {dep.type === 'REQUIRED' ? 'Required' : 'Recommended'}
        </Badge>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(dep)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(dep.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Product', 'Depends on', 'Type', 'Description']} isLoading={isLoading} emptyMessage="No dependencies" mobileCards={mobileCards}>
            {dependencies?.map((dep) => (
              <tr key={dep.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{dep.product?.name}</td>
                <td className="py-3 text-slate-400">{dep.dependsOn?.name}</td>
                <td className="py-3">
                  <Badge variant="outline" className={dep.type === 'REQUIRED' ? 'border-amber-500/20 text-amber-500' : 'border-emerald-500/20 text-emerald-500'}>
                    {dep.type === 'REQUIRED' ? 'Required' : 'Recommended'}
                  </Badge>
                </td>
                <td className="py-3 text-slate-400 max-w-xs truncate">{dep.description || '—'}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(dep)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(dep.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit' : 'New dependency'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Product</label>
              <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Choose...</option>
                {products?.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Depends on</label>
              <Select value={form.dependsOnId} onChange={(e) => setForm({ ...form, dependsOnId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Choose...</option>
                {products?.filter(p => p.id !== form.productId).map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Type</label>
              <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as 'REQUIRED' | 'RECOMMENDED' })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="REQUIRED">Required</option>
                <option value="RECOMMENDED">Recommended</option>
              </Select>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white" /></div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Dependency"
        description="Are you sure you want to delete this dependency? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ FORECASTS ADMIN SECTION ============
function ForecastsAdminSection() {
  const { data: forecasts, isLoading, isError, refetch } = useAdminForecasts();
  const updateForecast = useUpdateForecast();
  const deleteForecast = useDeleteForecast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ForecastStatus | 'ALL'>('ALL');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const filtered = forecasts?.filter((f) => {
    const matchesSearch = !searchQuery || f.lines?.[0]?.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.requestedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (id: string) => {
    await updateForecast.mutateAsync({ id, status: 'APPROVED' as ForecastStatus, reviewedBy: 'Admin' });
  };

  const handleReject = async (id: string) => {
    await updateForecast.mutateAsync({ id, status: 'REJECTED' as ForecastStatus, reviewedBy: 'Admin', rejectionReason: 'Rejected via admin' });
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteForecast.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load forecasts." onRetry={refetch} />;

  const mobileCards = filtered?.map((forecast) => (
    <MobileCard key={forecast.id}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{forecast.lines?.[0]?.product?.name}</p>
          <p className="text-sm text-slate-400">{forecast.lines?.[0]?.flavor?.name} × {forecast.lines?.[0]?.quantity}</p>
        </div>
        <Badge variant="outline" className={statusConfig[forecast.status].color + ' shrink-0 ml-2'}>
          {statusConfig[forecast.status].label}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-400">
        <p>{forecast.requestedBy}</p>
        <p className="text-xs text-slate-600">{new Date(forecast.createdAt).toLocaleDateString('en-US')}</p>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        {forecast.status === 'PENDING_TECH' && (
          <>
            <Button size="sm" variant="ghost" onClick={() => handleApprove(forecast.id)} className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"><CheckCircle className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => handleReject(forecast.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"><XCircle className="h-4 w-4" /></Button>
          </>
        )}
        <Button size="sm" variant="ghost" onClick={() => handleDelete(forecast.id)} className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ForecastStatus | 'ALL')} className="w-48 bg-slate-900 border-slate-700 text-white min-h-[44px]">
          <option value="ALL">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_TECH">Tech review</option>
          <option value="PENDING_MANAGER">Manager approval</option>
          <option value="PENDING_BUDGET">Budget validation</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </Select>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-14 rounded-lg bg-slate-800" />))}
            </div>
          ) : filtered?.length === 0 ? (
            <div className="text-center py-12">
              <BarChart3 className="mx-auto h-12 w-12 text-slate-700" />
              <p className="mt-4 text-lg font-medium text-slate-400">No requests</p>
            </div>
          ) : (
            <>
              <div className="space-y-3 sm:hidden">{mobileCards}</div>
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800">
                      <th className="pb-3 text-left font-medium text-slate-400">Product</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Flavor</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Qty</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Requester</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Status</th>
                      <th className="pb-3 text-left font-medium text-slate-400">Date</th>
                      <th className="pb-3 text-right font-medium text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filtered?.map((forecast) => (
                      <tr key={forecast.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 font-medium text-white">{forecast.lines?.[0]?.product?.name}</td>
                        <td className="py-3 text-slate-400">{forecast.lines?.[0]?.flavor?.name}</td>
                        <td className="py-3 text-slate-400">{forecast.lines?.[0]?.quantity}</td>
                        <td className="py-3 text-slate-400">{forecast.requestedBy}</td>
                        <td className="py-3">
                          <Badge variant="outline" className={statusConfig[forecast.status].color}>
                            {statusConfig[forecast.status].label}
                          </Badge>
                        </td>
                        <td className="py-3 text-slate-500">{new Date(forecast.createdAt).toLocaleDateString('en-US')}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {forecast.status === 'PENDING_TECH' && (
                              <>
                                <Button size="sm" variant="ghost" onClick={() => handleApprove(forecast.id)} className="h-8 w-8 p-0 text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"><CheckCircle className="h-4 w-4" /></Button>
                                <Button size="sm" variant="ghost" onClick={() => handleReject(forecast.id)} className="h-8 w-8 p-0 text-red-500 hover:text-red-400 hover:bg-red-500/10"><XCircle className="h-4 w-4" /></Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(forecast.id)} className="h-8 w-8 p-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
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

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Forecast Request"
        description="Are you sure you want to delete this forecast request? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ USERS SECTION ============
function UsersSection() {
  const { data: users, isLoading, isError, refetch } = useAdminUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState({ email: '', name: '', role: 'USER' as 'ADMIN' | 'USER' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ email: '', name: '', role: 'USER' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setForm({ email: u.email, name: u.name, role: u.role }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateUser.mutateAsync({ id: editing.id, ...form });
    else await createUser.mutateAsync(form);
    setIsOpen(false); resetForm();
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteUser.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load users." onRetry={refetch} />;

  const mobileCards = users?.map((u) => (
    <MobileCard key={u.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{u.name}</p>
          <p className="text-sm text-slate-400">{u.email}</p>
        </div>
        <Badge variant="outline" className={u.role === 'ADMIN' ? 'border-purple-500/20 text-purple-500' : 'border-slate-600 text-slate-400'}>
          {u.role}
        </Badge>
      </div>
      <p className="mt-2 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString('en-US')}</p>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(u)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Email', 'Role', 'Date']} isLoading={isLoading} emptyMessage="No users" mobileCards={mobileCards}>
            {users?.map((u) => (
              <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{u.name}</td>
                <td className="py-3 text-slate-400">{u.email}</td>
                <td className="py-3">
                  <Badge variant="outline" className={u.role === 'ADMIN' ? 'border-purple-500/20 text-purple-500' : 'border-slate-600 text-slate-400'}>
                    {u.role}
                  </Badge>
                </td>
                <td className="py-3 text-slate-400">{new Date(u.createdAt).toLocaleDateString('en-US')}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(u)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit' : 'New user'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Email</label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Role</label>
              <Select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'ADMIN' | 'USER' })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="USER">User</option>
                <option value="ADMIN">Administrator</option>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ AVAILABILITY ZONES SECTION ============
function AvailabilityZonesSection() {
  const { data: zones, isLoading, isError, refetch } = useAvailabilityZones();
  const createZone = useCreateAvailabilityZone();
  const updateZone = useUpdateAvailabilityZone();
  const deleteZone = useDeleteAvailabilityZone();
  const { data: countries } = useCountries();
  const { data: regions } = useRegions();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilityZone | null>(null);
  const { data: infraVersions } = useInfraVersions();

  const [form, setForm] = useState({
    name: '', city: '', country: '', region: '', latitude: '', longitude: '', isActive: true, infraVersionIds: [] as string[],
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [countryQuery, setCountryQuery] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);

  const resetForm = () => {
    setForm({ name: '', city: '', country: '', region: '', latitude: '', longitude: '', isActive: true, infraVersionIds: [] });
    setCountryQuery('');
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (z: AvailabilityZone) => {
    setEditing(z);
    setForm({
      name: z.name, city: z.city, country: z.country, region: z.region,
      latitude: String(z.latitude), longitude: String(z.longitude), isActive: z.isActive,
      infraVersionIds: (z as any).infraVersions?.map((iv: any) => iv.infraVersionId) ?? [],
    });
    setCountryQuery(z.country);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
    };
    if (editing) await updateZone.mutateAsync({ id: editing.id, ...payload });
    else await createZone.mutateAsync(payload);
    setIsOpen(false); resetForm();
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteZone.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  const filtered = zones?.filter((z) =>
    z.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) return <QueryError message="Unable to load availability zones." onRetry={refetch} />;

  const mobileCards = filtered?.map((z) => (
    <MobileCard key={z.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{z.name}</p>
        </div>
        <Badge variant="outline" className={z.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {z.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        <p>{z.city}, {countries?.find((c) => c.name === z.country)?.flagEmoji || ''} {z.country}</p>
        <p>Region: {regions?.find((r) => r.name === z.region)?.name || z.region}</p>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(z)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(z.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]" />
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'City', 'Country', 'Region', 'Status']} isLoading={isLoading} emptyMessage="No availability zones" mobileCards={mobileCards}>
            {filtered?.map((z) => (
              <tr key={z.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{z.name}</td>
                <td className="py-3 text-slate-400">{z.city}</td>
                <td className="py-3 text-slate-400">{countries?.find((c) => c.name === z.country)?.flagEmoji || ''} {z.country}</td>
                <td className="py-3 text-slate-400">{regions?.find((r) => r.name === z.region)?.name || z.region}</td>
                <td className="py-3">
                  <Badge variant="outline" className={z.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {z.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(z)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(z.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit availability zone' : 'New availability zone'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">City</label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2 relative">
                <label className="text-sm font-medium text-slate-300">Country</label>
                <Input
                  value={countryQuery}
                  onChange={(e) => { setCountryQuery(e.target.value); setShowCountryDropdown(true); setForm({ ...form, country: e.target.value }); }}
                  onFocus={() => setShowCountryDropdown(true)}
                  placeholder="Search country..."
                  required
                  className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                />
                {showCountryDropdown && countries && (
                  <div className="absolute z-50 mt-1 w-full max-h-48 overflow-auto bg-slate-900 border border-slate-700 rounded-md shadow-lg">
                    {countries
                      .filter((c) => c.name.toLowerCase().includes(countryQuery.toLowerCase()))
                      .map((c) => (
                        <div
                          key={c.code}
                          className="px-3 py-2 cursor-pointer hover:bg-slate-800 text-white text-sm flex items-center gap-2"
                          onClick={() => {
                            setForm({ ...form, country: c.name });
                            setCountryQuery(c.name);
                            setShowCountryDropdown(false);
                          }}
                        >
                          <span className="text-base">{c.flagEmoji}</span>
                          <span>{c.name}</span>
                        </div>
                      ))}
                    {countries.filter((c) => c.name.toLowerCase().includes(countryQuery.toLowerCase())).length === 0 && (
                      <div className="px-3 py-2 text-slate-500 text-sm">No countries found</div>
                    )}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Region</label>
                <select
                  value={form.region}
                  onChange={(e) => setForm({ ...form, region: e.target.value })}
                  required
                  className="w-full h-[44px] px-3 bg-slate-950 border border-slate-700 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select a region</option>
                  {regions?.map((r) => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Latitude</label><Input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Longitude</label><Input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2 flex items-center gap-2 pt-6">
                <input type="checkbox" id="az-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
                <label htmlFor="az-active" className="text-sm font-medium text-slate-300">Active</label>
              </div>
            </div>
            <MultiPickupInput
              label="Hosted Infra Versions (an AZ can host IV1 and IV2)"
              values={form.infraVersionIds}
              onChange={(ids) => setForm({ ...form, infraVersionIds: ids })}
              options={infraVersions?.map((iv) => ({ id: iv.id, label: iv.code })) ?? []}
            />
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Availability Zone"
        description="Are you sure you want to delete this availability zone? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ ZONES SECTION ============
function RegionsSection() {
  const { data: azs } = useAvailabilityZones();
  const { data: regionsList, isLoading, isError, refetch } = useRegions();
  const createRegion = useCreateRegion();
  const updateRegion = useUpdateRegion();
  const deleteRegion = useDeleteRegion();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRegion, setExpandedRegion] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Region | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ name: '', description: '', isActive: true }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (region: Region) => {
    setEditing(region);
    setForm({ name: region.name, description: region.description || '', isActive: region.isActive });
    setIsOpen(true);
  };

  const handleDelete = async () => {
    try {
      if (confirmDelete.id) await deleteRegion.mutateAsync(confirmDelete.id);
    } catch { /* handled by hook */ }
    setConfirmDelete({ open: false, id: null });
  };

  const filtered = regionsList?.filter((r) =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase())
  ) ?? [];

  if (isError) return <QueryError message="Unable to load regions." onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search region..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]" />
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-12 text-center">
            <p className="text-slate-500">No regions found.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((region) => {
            const regionAZs = azs?.filter((az) => az.region === region.name) ?? [];
            return (
            <Card key={region.id} className="bg-slate-900 border-slate-800 transition-all hover:border-slate-700">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-400" />
                    {region.name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="border-blue-500/20 text-blue-400">
                      {regionAZs.length} AZ{regionAZs.length > 1 ? 's' : ''}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(region)} className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: region.id })} className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <button
                  onClick={() => setExpandedRegion(expandedRegion === region.id ? null : region.id)}
                  className="text-xs text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1"
                >
                  <ChevronRight className={`h-3 w-3 transition-transform ${expandedRegion === region.id ? 'rotate-90' : ''}`} />
                  {expandedRegion === region.id ? 'Hide AZs' : 'Show AZs'}
                </button>
                {expandedRegion === region.id && (
                  <div className="mt-3 space-y-1.5">
                    {regionAZs.map((az) => (
                      <div key={az.id} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">{az.name}</span>
                        <Badge variant="outline" className={az.isActive ? 'border-emerald-500/20 text-emerald-500 text-[10px]' : 'border-slate-600 text-slate-500 text-[10px]'}>
                          {az.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );})}
        </div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit Region' : 'New Region'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="regionActive" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
              <label htmlFor="regionActive" className="text-sm text-slate-300">Active</label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <button type="button" onClick={() => setIsOpen(false)} className="inline-flex items-center justify-center rounded-md border border-slate-700 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 min-h-[44px]">Cancel</button>
              <button type="button" onClick={async () => {
                try {
                  if (editing) {
                    await updateRegion.mutateAsync({ id: editing.id, ...form });
                  } else {
                    await createRegion.mutateAsync(form);
                  }
                  setIsOpen(false);
                  resetForm();
                } catch (err) {
                  console.error('Region mutation error:', err);
                }
              }} className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 min-h-[44px]">{editing ? 'Save' : 'Create'}</button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })} title="Delete Region" description="Are you sure you want to delete this region?" onConfirm={handleDelete} confirmLabel="Delete" cancelLabel="Cancel" variant="destructive" />
    </div>
  );
}
function ZonesSection() {
  const { data: zones, isLoading, isError, refetch } = useZones();
  const { data: allAZs } = useAvailabilityZones();
  const createZone = useCreateZone();
  const updateZone = useUpdateZone();
  const deleteZone = useDeleteZone();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Zone | null>(null);
  const [form, setForm] = useState({
    name: '', description: '', isActive: true, availabilityZoneIds: [] as string[],
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setForm({ name: '', description: '', isActive: true, availabilityZoneIds: [] });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (z: Zone) => {
    setEditing(z);
    setForm({
      name: z.name,
      description: z.description || '',
      isActive: z.isActive,
      availabilityZoneIds: z.availabilityZones?.map((az: any) => az.availabilityZoneId) ?? [],
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: any = { ...form };
    if (!payload.description) delete payload.description;
    if (editing) await updateZone.mutateAsync({ id: editing.id, ...payload });
    else await createZone.mutateAsync(payload);
    setIsOpen(false); resetForm();
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteZone.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  const filtered = zones?.filter((z) =>
    z.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) return <QueryError message="Unable to load zones." onRetry={refetch} />;

  const mobileCards = filtered?.map((z) => (
    <MobileCard key={z.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{z.name}</p>
        </div>
        <Badge variant="outline" className={z.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {z.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        <p>{z.availabilityZones?.length ?? 0} AZ(s)</p>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(z)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(z.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search by name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]" />
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'AZs', 'Active']} isLoading={isLoading} emptyMessage="No zones" mobileCards={mobileCards}>
            {filtered?.map((z) => (
              <tr key={z.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{z.name}</td>
                <td className="py-3 text-slate-400">{z.availabilityZones?.length ?? 0}</td>
                <td className="py-3">
                  <Badge variant="outline" className={z.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {z.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(z)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(z.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit zone' : 'New zone'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Availability Zones</label>
              <div className="flex flex-wrap gap-2">
                {allAZs?.map((az) => (
                  <label key={az.id} className="flex items-center gap-1.5 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.availabilityZoneIds.includes(az.id)}
                      onChange={(e) => {
                        const ids = e.target.checked
                          ? [...form.availabilityZoneIds, az.id]
                          : form.availabilityZoneIds.filter((id) => id !== az.id);
                        setForm({ ...form, availabilityZoneIds: ids });
                      }}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600"
                    />
                    {az.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="zone-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
              <label htmlFor="zone-active" className="text-sm font-medium text-slate-300">Active</label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Zone"
        description="Are you sure you want to delete this zone? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ INSTANCES SECTION ============
const instanceStatusConfig: Record<InstanceStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'border-slate-500/20 text-slate-400' },
  PROVISIONING: { label: 'Provisioning', color: 'border-blue-500/20 text-blue-400' },
  RUNNING: { label: 'Running', color: 'border-emerald-500/20 text-emerald-500' },
  STOPPED: { label: 'Stopped', color: 'border-amber-500/20 text-amber-500' },
  TERMINATED: { label: 'Terminated', color: 'border-red-500/20 text-red-500' },
};

export function _InstancesSection() {
  const { data: instances, isLoading, isError, refetch } = useInstances();
  const { data: applications } = useApplications();
  const { data: products } = useAdminProducts();
  const { data: allFlavors } = useFlavors();
  const { data: zones } = useAvailabilityZones();
  const createInstance = useCreateInstance();
  const updateInstance = useUpdateInstance();
  const deleteInstance = useDeleteInstance();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [form, setForm] = useState<{
    name: string; description: string; applicationId: string; productId: string; flavorId: string; variantId: string; azCode: string;
    status: InstanceStatus; environment: Environment; ipAddress: string; hostname: string; metadata: { osVersion?: string };
  }>({
    name: '', description: '', applicationId: '', productId: '', flavorId: '', variantId: '', azCode: '',
    status: 'PENDING' as InstanceStatus, environment: 'DEV' as Environment, ipAddress: '', hostname: '', metadata: {},
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setForm({ name: '', description: '', applicationId: '', productId: '', flavorId: '', variantId: '', azCode: '',
      status: 'PENDING' as InstanceStatus, environment: 'DEV' as Environment, ipAddress: '', hostname: '', metadata: {} });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (instance: Instance) => {
    setEditing(instance);
    setForm({
      name: instance.name, description: instance.description || '', applicationId: instance.applicationId,
      productId: instance.productId, flavorId: instance.flavorId, variantId: instance.variantId || '', azCode: instance.azCode,
      status: instance.status, environment: instance.environment, ipAddress: instance.ipAddress || '',
      hostname: instance.hostname || '', metadata: (instance.metadata as { osVersion?: string }) || {},
    });
    setIsOpen(true);
  };

  const selectedProduct = products?.find((p) => p.id === form.productId);
  const isComputeProduct = selectedProduct?.category?.name.toLowerCase() === 'compute';
  const { data: productVariants } = useProductVariants(form.productId || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...form };
    if (editing) await updateInstance.mutateAsync({ id: editing.id, ...payload });
    else await createInstance.mutateAsync(payload);
    setIsOpen(false); resetForm();
  };

  const handleDelete = (id: string) => {
    setConfirmDelete({ open: true, id });
  };
  const handleConfirmDelete = async () => {
    if (confirmDelete.id) {
      await deleteInstance.mutateAsync(confirmDelete.id);
    }
    setConfirmDelete({ open: false, id: null });
  };

  const filtered = instances?.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.hostname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.ipAddress?.includes(searchQuery)
  );

  if (isError) return <QueryError message="Unable to load instances." onRetry={refetch} />;

  const mobileCards = filtered?.map((instance) => (
    <MobileCard key={instance.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{instance.name}</p>
          <p className="text-sm text-slate-400">{instance.product?.name} {instance.variant?.name ? `(${instance.variant.name})` : ''} · {instance.flavor?.name}</p>
        </div>
        <Badge variant="outline" className={instanceStatusConfig[instance.status].color}>
          {instanceStatusConfig[instance.status].label}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        <p>{instance.application?.name}</p>
        <p>{instance.az?.name} · {instance.environment}</p>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(instance)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(instance.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input placeholder="Search instances..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]" />
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Application', 'Product', 'Version', 'Flavor', 'AZ', 'Status', 'Env']} isLoading={isLoading} emptyMessage="No instances" mobileCards={mobileCards}>
            {filtered?.map((instance) => (
              <tr key={instance.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{instance.name}</td>
                <td className="py-3 text-slate-400">{instance.application?.name}</td>
                <td className="py-3 text-slate-400">{instance.product?.name}</td>
                <td className="py-3 text-slate-400">{instance.variant?.name || '—'}</td>
                <td className="py-3 text-slate-400">{instance.flavor?.name}</td>
                <td className="py-3 text-slate-400">{instance.az?.name}</td>
                <td className="py-3">
                  <Badge variant="outline" className={instanceStatusConfig[instance.status].color}>
                    {instanceStatusConfig[instance.status].label}
                  </Badge>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={
                    instance.environment === 'PRD' ? 'border-red-500/20 text-red-500' :
                    instance.environment === 'STG' ? 'border-purple-500/20 text-purple-400' :
                    'border-blue-500/20 text-blue-400'
                  }>
                    {instance.environment}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(instance)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(instance.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit instance' : 'New instance'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Application</label>
                <Select value={form.applicationId} onChange={(e) => setForm({ ...form, applicationId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Select...</option>
                  {applications?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Product</label>
                <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value, flavorId: '' })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Select...</option>
                  {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Flavor</label>
                <Select value={form.flavorId} onChange={(e) => setForm({ ...form, flavorId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Select...</option>
                  {allFlavors?.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.vcpu}vCPU, {f.ramGb}GB)</option>)}
                </Select>
              </div>
              {isComputeProduct && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-300">Variant</label>
                  <Select value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                    <option value="">None</option>
                    {productVariants?.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </Select>
                </div>
              )}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Availability Zone</label>
                <Select value={form.azCode} onChange={(e) => setForm({ ...form, azCode: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="">Select...</option>
                  {zones?.map((z) => <option key={z.id} value={z.code}>{z.name} ({z.code})</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Status</label>
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InstanceStatus })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="PENDING">Pending</option>
                  <option value="PROVISIONING">Provisioning</option>
                  <option value="RUNNING">Running</option>
                  <option value="STOPPED">Stopped</option>
                  {editing && <option value="TERMINATED">Terminated</option>}
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Environment</label>
                <Select value={form.environment} onChange={(e) => setForm({ ...form, environment: e.target.value as Environment })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                  <option value="DEV">Development</option>
                  <option value="STG">Staging</option>
                  <option value="PRD">Production</option>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">IP Address</label><Input value={form.ipAddress} onChange={(e) => setForm({ ...form, ipAddress: e.target.value })} placeholder="10.0.0.1" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Hostname</label><Input value={form.hostname} onChange={(e) => setForm({ ...form, hostname: e.target.value })} placeholder="host.cloudmarket.local" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">OS Version</label>
              <Input value={form.metadata?.osVersion || ''} onChange={(e) => setForm({ ...form, metadata: { ...form.metadata, osVersion: e.target.value } })} placeholder="e.g. Debian 12" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Instance"
        description="Are you sure you want to delete this instance? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

// ============ APPLICATIONS SECTION ============
function ApplicationsSection() {
  const { data: applications, isLoading, isError, refetch } = useApplications();
  const { data: continuityLevels } = useContinuityLevels();
  const createApplication = useCreateApplication();
  const updateApplication = useUpdateApplication();
  const deleteApplication = useDeleteApplication();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', description: '', continuityLevelId: '', owner: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ name: '', description: '', continuityLevelId: '', owner: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (app: any) => { setEditing(app); setForm({ name: app.name, description: app.description || '', continuityLevelId: app.continuityLevelId, owner: app.owner }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateApplication.mutateAsync({ id: editing.id, ...form });
    else await createApplication.mutateAsync(form);
    setIsOpen(false); resetForm();
  };

  const handleDelete = async () => {
    if (confirmDelete.id) await deleteApplication.mutateAsync(confirmDelete.id);
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load applications." onRetry={refetch} />;

  const clMap = new Map(continuityLevels?.map((cl) => [cl.id, cl]) ?? []);

  const mobileCards = applications?.map((app) => (
    <MobileCard key={app.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{app.name}</p>
          <p className="text-sm text-slate-400">{app.owner}</p>
        </div>
        <Badge variant="outline" className={clMap.get(app.continuityLevelId)?.color === 'red' ? 'border-red-500/20 text-red-500' : clMap.get(app.continuityLevelId)?.color === 'orange' ? 'border-orange-500/20 text-orange-500' : clMap.get(app.continuityLevelId)?.color === 'yellow' ? 'border-yellow-500/20 text-yellow-500' : 'border-green-500/20 text-green-500'}>
          {clMap.get(app.continuityLevelId)?.name || '—'}
        </Badge>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(app)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: app.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Owner', 'Continuity', 'Description']} isLoading={isLoading} emptyMessage="No applications" mobileCards={mobileCards}>
            {applications?.map((app) => (
              <tr key={app.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{app.name}</td>
                <td className="py-3 text-slate-400">{app.owner}</td>
                <td className="py-3">
                  <Badge variant="outline" className={clMap.get(app.continuityLevelId)?.color === 'red' ? 'border-red-500/20 text-red-500' : clMap.get(app.continuityLevelId)?.color === 'orange' ? 'border-orange-500/20 text-orange-500' : clMap.get(app.continuityLevelId)?.color === 'yellow' ? 'border-yellow-500/20 text-yellow-500' : 'border-green-500/20 text-green-500'}>
                    {clMap.get(app.continuityLevelId)?.name || '—'}
                  </Badge>
                </td>
                <td className="py-3 text-slate-400">{app.description || '—'}</td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(app)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: app.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit application' : 'New application'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Owner</label><Input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Continuity Level</label>
              <Select value={form.continuityLevelId} onChange={(e) => setForm({ ...form, continuityLevelId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Select...</option>
                {continuityLevels?.map((cl) => <option key={cl.id} value={cl.id}>{cl.name} (RTO {cl.rtoMinutes}m)</option>)}
              </Select>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" /></div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog open={confirmDelete.open} onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })} title="Delete Application" description="Are you sure you want to delete this application? This action cannot be undone." onConfirm={handleDelete} confirmLabel="Delete" cancelLabel="Cancel" variant="destructive" />
    </div>
  );
}

// ============ CONTINUITY LEVELS SECTION ============
function ContinuityLevelsSection() {
  const { data: levels, isLoading, isError, refetch } = useContinuityLevels();
  const updateLevel = useUpdateContinuityLevel();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ rtoMinutes: 0, rpoMinutes: 0, description: '', color: '' });

  const resetForm = () => { setForm({ rtoMinutes: 0, rpoMinutes: 0, description: '', color: '' }); setEditing(null); };
  const openEdit = (cl: any) => { setEditing(cl); setForm({ rtoMinutes: cl.rtoMinutes, rpoMinutes: cl.rpoMinutes, description: cl.description || '', color: cl.color || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateLevel.mutateAsync({ id: editing.id, ...form });
    setIsOpen(false); resetForm();
  };

  if (isError) return <QueryError message="Unable to load continuity levels." onRetry={refetch} />;

  const colorMap: Record<string, string> = {
    green: 'bg-green-500/10 text-green-500 border-green-500/20',
    yellow: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
    orange: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    red: 'bg-red-500/10 text-red-500 border-red-500/20',
  };

  const mobileCards = levels?.map((cl) => (
    <MobileCard key={cl.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{cl.name}</p>
          <p className="text-sm text-slate-400">RTO {cl.rtoMinutes}m · RPO {cl.rpoMinutes}m</p>
        </div>
        <Badge variant="outline" className={colorMap[cl.color] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>{cl.name}</Badge>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(cl)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'RTO', 'RPO', 'Description', 'Color']} isLoading={isLoading} emptyMessage="No continuity levels" mobileCards={mobileCards}>
            {levels?.map((cl) => (
              <tr key={cl.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{cl.name}</td>
                <td className="py-3 text-slate-400">{cl.rtoMinutes}m</td>
                <td className="py-3 text-slate-400">{cl.rpoMinutes}m</td>
                <td className="py-3 text-slate-400">{cl.description || '—'}</td>
                <td className="py-3">
                  <Badge variant="outline" className={colorMap[cl.color] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}>
                    {cl.color}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(cl)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader><DialogTitle className="text-white">Edit continuity level</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">RTO (minutes)</label><Input type="number" value={form.rtoMinutes} onChange={(e) => setForm({ ...form, rtoMinutes: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">RPO (minutes)</label><Input type="number" value={form.rpoMinutes} onChange={(e) => setForm({ ...form, rpoMinutes: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Color</label>
              <Select value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Select...</option>
                <option value="green">Green</option>
                <option value="yellow">Yellow</option>
                <option value="orange">Orange</option>
                <option value="red">Red</option>
              </Select>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ INFRA VERSIONS SECTION ============
function InfraVersionsSection() {
  const { data: infraVersions, isLoading, isError, refetch } = useInfraVersions();
  const { data: allAzs } = useAvailabilityZones();
  const createIV = useCreateInfraVersion();
  const updateIV = useUpdateInfraVersion();
  const deleteIV = useDeleteInfraVersion();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<InfraVersion | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', description: '', releaseDate: '', normalSupportEnd: '', extendedSupportEnd: '', eolDate: '',
    phase: 'RELEASED' as LifecyclePhase, isActive: true, changelog: '', availabilityZoneIds: [] as string[],
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setForm({ code: '', name: '', description: '', releaseDate: '', normalSupportEnd: '', extendedSupportEnd: '', eolDate: '', phase: LifecyclePhase.RELEASED, isActive: true, changelog: '', availabilityZoneIds: [] });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (iv: InfraVersion) => {
    setEditing(iv);
    setForm({
      code: iv.code,
      name: iv.name,
      description: iv.description || '',
      releaseDate: iv.releaseDate ? iv.releaseDate.slice(0, 10) : '',
      normalSupportEnd: iv.normalSupportEnd ? iv.normalSupportEnd.slice(0, 10) : '',
      extendedSupportEnd: iv.extendedSupportEnd ? iv.extendedSupportEnd.slice(0, 10) : '',
      eolDate: iv.eolDate ? iv.eolDate.slice(0, 10) : '',
      phase: iv.phase,
      isActive: iv.isActive,
      changelog: iv.changelog || '',
      availabilityZoneIds: iv.availabilityZones?.map((z: any) => z.availabilityZoneId) ?? [],
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code,
      name: form.name,
      description: form.description || undefined,
      releaseDate: form.releaseDate ? new Date(form.releaseDate).toISOString() : undefined,
      normalSupportEnd: form.normalSupportEnd ? new Date(form.normalSupportEnd).toISOString() : undefined,
      extendedSupportEnd: form.extendedSupportEnd ? new Date(form.extendedSupportEnd).toISOString() : undefined,
      eolDate: form.eolDate ? new Date(form.eolDate).toISOString() : undefined,
      phase: form.phase,
      isActive: form.isActive,
      changelog: form.changelog || undefined,
      availabilityZoneIds: form.availabilityZoneIds,
    };
    if (editing) await updateIV.mutateAsync({ id: editing.id, ...payload });
    else await createIV.mutateAsync(payload);
    setIsOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => { setConfirmDelete({ open: true, id }); };
  const handleConfirmDelete = async () => {
    try { if (confirmDelete.id) await deleteIV.mutateAsync(confirmDelete.id); } catch { }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load infra versions." onRetry={refetch} />;

  const mobileCards = infraVersions?.map((iv) => (
    <MobileCard key={iv.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{iv.name}</p>
          <p className="text-sm text-slate-400">{iv.code} — {iv.availabilityZones?.length ?? 0} AZ(s)</p>
        </div>
        <Badge variant="outline" className={iv.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {iv.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">Phase: {iv.phase.replace(/_/g, ' ')}</div>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(iv)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(iv.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add Infra Version</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Code', 'Name', 'Release Date', 'Normal Support End', 'Extended Support End', 'EOL Date', 'Phase', 'AZs', 'Active']} isLoading={isLoading} emptyMessage="No infra versions" mobileCards={mobileCards}>
            {infraVersions?.map((iv) => (
              <tr key={iv.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{iv.code}</td>
                <td className="py-3 text-slate-400">{iv.name}</td>
                <td className="py-3 text-slate-400">{iv.releaseDate ? new Date(iv.releaseDate).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-slate-400">{iv.normalSupportEnd ? new Date(iv.normalSupportEnd).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-slate-400">{iv.extendedSupportEnd ? new Date(iv.extendedSupportEnd).toLocaleDateString() : '—'}</td>
                <td className="py-3 text-slate-400">{iv.eolDate ? new Date(iv.eolDate).toLocaleDateString() : '—'}</td>
                <td className="py-3">
                  <Badge variant="outline" className="border-blue-500/20 text-blue-400">{iv.phase.replace(/_/g, ' ')}</Badge>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {iv.availabilityZones?.map((z: any) => (
                      <Badge key={z.availabilityZoneId} variant="secondary" className="text-[10px] bg-slate-800 text-slate-300 border-slate-700">{z.availabilityZone?.name}</Badge>
                    )) ?? <span className="text-slate-600">—</span>}
                  </div>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={iv.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {iv.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(iv)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"><Pencil className="h-4 w-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(iv.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-white">{editing ? 'Edit Infra Version' : 'New Infra Version'}</DialogTitle></DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Code</label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required disabled={!!editing} placeholder="IV3" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Infrastructure Generation 3" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="bg-slate-950 border-slate-700 text-white" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Release Date</label><Input type="date" value={form.releaseDate} onChange={(e) => setForm({ ...form, releaseDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Normal Support End</label><Input type="date" value={form.normalSupportEnd} onChange={(e) => setForm({ ...form, normalSupportEnd: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Extended Support End</label><Input type="date" value={form.extendedSupportEnd} onChange={(e) => setForm({ ...form, extendedSupportEnd: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">EOL Date</label><Input type="date" value={form.eolDate} onChange={(e) => setForm({ ...form, eolDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Phase</label>
              <select value={form.phase} onChange={(e) => setForm({ ...form, phase: e.target.value as LifecyclePhase })} className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white">
                <option value="RELEASED">Released</option>
                <option value="NORMAL_SUPPORT">Normal Support</option>
                <option value="EXTENDED_SUPPORT">Extended Support</option>
                <option value="NO_SUPPORT">No Support</option>
                <option value="EOL">EOL</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="iv-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-700 bg-slate-950" />
              <label htmlFor="iv-active" className="text-sm text-slate-300">Active</label>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Changelog</label><Textarea value={form.changelog} onChange={(e) => setForm({ ...form, changelog: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" /></div>
            <MultiPickupInput
              label="Hosted Availability Zones (an AZ can host IV1 and IV2)"
              values={form.availabilityZoneIds}
              onChange={(ids) => setForm({ ...form, availabilityZoneIds: ids })}
              options={allAzs?.map((az) => ({ id: az.id, label: az.name ? `${az.name} (${az.code})` : az.code })) ?? []}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(o) => setConfirmDelete((c) => ({ ...c, open: o }))}
        title="Delete Infra Version"
        description="Are you sure you want to delete this infra version? This action cannot be undone."
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </div>
  );
}

// ============ MAIN ADMIN PAGE ============
export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { value: 'products', label: 'Products', icon: Package },
    { value: 'transitions', label: 'Transitions', icon: ArrowRightLeft },
    { value: 'product-versions', label: 'Product Versions', icon: Box },
    { value: 'infra-versions', label: 'Infra Versions', icon: Boxes },
    { value: 'os', label: 'OS', icon: Monitor },
    { value: 'categories', label: 'Categories', icon: Layers },
    { value: 'flavors', label: 'Flavors', icon: Cpu },
    { value: 'dependencies', label: 'Dependencies', icon: Link2 },
    { value: 'applications', label: 'Applications', icon: Shield },
    { value: 'continuity-levels', label: 'Continuity', icon: TrendingUp },
    { value: 'forecasts', label: 'Forecasts', icon: Activity },
    { value: 'users', label: 'Users', icon: UserCog },
    { value: 'regions', label: 'Regions', icon: Globe },
    { value: 'zones', label: 'Zones', icon: Box },
    { value: 'availability-zones', label: 'Availability Zones', icon: MapPin },
    { value: 'performance-profiles', label: 'Performance', icon: BarChart3 },
    { value: 'presentation-orders', label: 'Presentation', icon: LayoutList },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white">Administration</h1>
        <p className="mt-2 text-slate-400">Manage the CloudMarket platform.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1 justify-center w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="data-[state=active]:bg-slate-800 data-[state=active]:text-blue-400 text-slate-400 min-h-[40px] text-xs sm:text-sm"
              >
                <Icon className="mr-1.5 sm:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.slice(0, 4)}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="dashboard" className="animate-fade-in"><DashboardSection onNavigate={setActiveTab} /></TabsContent>
        <TabsContent value="products" className="animate-fade-in"><ProductsSection /></TabsContent>
        <TabsContent value="transitions" className="animate-fade-in"><TransitionsAdminSection /></TabsContent>
        <TabsContent value="os" className="animate-fade-in"><OSSection /></TabsContent>
        <TabsContent value="categories" className="animate-fade-in"><CategoriesSection /></TabsContent>
        <TabsContent value="flavors" className="animate-fade-in"><FlavorsSection /></TabsContent>
        <TabsContent value="product-versions" className="animate-fade-in"><ProductVersionsSection /></TabsContent>
        <TabsContent value="infra-versions" className="animate-fade-in"><InfraVersionsSection /></TabsContent>
        <TabsContent value="dependencies" className="animate-fade-in"><DependenciesSection /></TabsContent>
        <TabsContent value="applications" className="animate-fade-in"><ApplicationsSection /></TabsContent>
        <TabsContent value="continuity-levels" className="animate-fade-in"><ContinuityLevelsSection /></TabsContent>
        <TabsContent value="forecasts" className="animate-fade-in"><ForecastsAdminSection /></TabsContent>
        <TabsContent value="users" className="animate-fade-in"><UsersSection /></TabsContent>
        <TabsContent value="regions" className="animate-fade-in"><RegionsSection /></TabsContent>
        <TabsContent value="zones" className="animate-fade-in"><ZonesSection /></TabsContent>
        <TabsContent value="availability-zones" className="animate-fade-in"><AvailabilityZonesSection /></TabsContent>
        <TabsContent value="performance-profiles" className="animate-fade-in"><PerformanceProfilesSection /></TabsContent>
        <TabsContent value="presentation-orders" className="animate-fade-in"><AdminPresentationOrders /></TabsContent>
      </Tabs>
    </div>
  );
}
