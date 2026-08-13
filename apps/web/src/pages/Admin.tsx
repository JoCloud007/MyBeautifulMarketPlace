import { useState } from 'react';
import {
  useAdminDashboard,
  useAdminProducts,
  useAdminCategories,
  useAdminFlavors,
  useAdminDependencies,
  useAdminForecasts,
  useAdminUsers,
  useAdminAvailabilityZones,
  useCreateAvailabilityZone,
  useUpdateAvailabilityZone,
  useDeleteAvailabilityZone,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
  useCreateFlavor,
  useUpdateFlavor,
  useDeleteFlavor,
  useCreateDependency,
  useUpdateDependency,
  useDeleteDependency,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useUpdateForecast,
  useDeleteForecast,
} from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  Globe,
} from 'lucide-react';
import type { ApprovalStatus, Product, Category, Flavor, Dependency, User, Forecast, AvailabilityZone } from '@cloudmarket/shared-types';

const statusConfig: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'border-amber-500/20 text-amber-500' },
  APPROVED: { label: 'Approved', color: 'border-emerald-500/20 text-emerald-500' },
  REJECTED: { label: 'Rejected', color: 'border-red-500/20 text-red-500' },
};

const azRegionColors: Record<string, string> = {
  Europe: '#3b82f6',
  'North America': '#10b981',
  'Asia-Pacific': '#f59e0b',
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

  if (!children || (Array.isArray(children) && children.length === 0)) {
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
function DashboardSection() {
  const { data: dashboard, isLoading, isError, refetch } = useAdminDashboard();

  const countCards = [
    { label: 'Products', value: dashboard?.counts.products ?? 0, icon: Package, color: 'text-blue-400' },
    { label: 'Categories', value: dashboard?.counts.categories ?? 0, icon: Layers, color: 'text-purple-400' },
    { label: 'Forecasts', value: dashboard?.counts.forecasts ?? 0, icon: BarChart3, color: 'text-amber-400' },
    { label: 'Users', value: dashboard?.counts.users ?? 0, icon: Users, color: 'text-emerald-400' },
    { label: 'Regions', value: dashboard?.counts.availabilityZones ?? 0, icon: Globe, color: 'text-cyan-400' },
  ];

  if (isError) {
    return <QueryError message="Unable to load dashboard." onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {countCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <AnimatedSection key={card.label} delay={i * 80}>
                <Card className="bg-slate-900 border-slate-800 transition-all duration-300 hover:border-slate-700 hover:-translate-y-0.5">
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
          ) : dashboard?.recentForecasts?.length === 0 ? (
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
                  {dashboard?.recentForecasts?.map((forecast: Forecast) => (
                    <tr key={forecast.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-3 font-medium text-white">{forecast.product?.name}</td>
                      <td className="py-3 text-slate-400">{forecast.flavor?.name}</td>
                      <td className="py-3 text-slate-400">{forecast.azDetails?.reduce((s, d) => s + d.quantity, 0) || 0}</td>
                      <td className="py-3">
                        <Badge variant="outline" className={statusConfig[forecast.status].color}>
                          {statusConfig[forecast.status].label}
                        </Badge>
                      </td>
                      <td className="py-3 text-slate-500">
                        {new Date(forecast.createdAt).toLocaleDateString('fr-FR')}
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

// ============ PRODUCTS SECTION ============
function ProductsSection() {
  const { data: products, isLoading, isError, refetch } = useAdminProducts();
  const { data: categories } = useAdminCategories();
  const { data: availabilityZones } = useAdminAvailabilityZones();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', slug: '', description: '', categoryId: '', os: '', documentation: '', roadmap: '', isActive: true, availabilityZoneIds: [] as string[],
  });

  const resetForm = () => {
    setForm({ name: '', slug: '', description: '', categoryId: '', os: '', documentation: '', roadmap: '', isActive: true, availabilityZoneIds: [] });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name, slug: product.slug, description: product.description || '',
      categoryId: product.categoryId, os: product.os || '', documentation: product.documentation || '',
      roadmap: product.roadmap || '', isActive: product.isActive,
      availabilityZoneIds: product.availabilityZones?.map((az) => az.availabilityZoneId) || [],
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-') };
      if (editing) await updateProduct.mutateAsync({ id: editing.id, ...payload });
      else await createProduct.mutateAsync(payload);
      setIsOpen(false); resetForm();
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this product?')) return;
    try {
      await deleteProduct.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load products." onRetry={refetch} />;

  const mobileCards = products?.map((product: Product) => (
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
        {product.os && <span>OS: {product.os} · </span>}
        <span>{product.flavors?.length ?? 0} flavors</span>
      </div>
      <div className="mt-3 flex justify-end gap-1">
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
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable
            headers={['Name', 'Category', 'OS', 'Flavors', 'Active']}
            isLoading={isLoading}
            emptyMessage="No products"
            mobileCards={mobileCards}
          >
            {products?.map((product: Product) => (
              <tr key={product.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{product.name}</td>
                <td className="py-3 text-slate-400">{product.category?.name}</td>
                <td className="py-3 text-slate-400">{product.os || '—'}</td>
                <td className="py-3 text-slate-400">{product.flavors?.length ?? 0}</td>
                <td className="py-3">
                  <Badge variant="outline" className={product.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {product.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
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
              <label className="text-sm font-medium text-slate-300">Slug</label>
              <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if empty" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Category</label>
              <Select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Choose...</option>
                {categories?.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
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
              <label className="text-sm font-medium text-slate-300">Availability Zones</label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto rounded-md border border-slate-700 bg-slate-950 p-2">
                {availabilityZones?.map((az: AvailabilityZone) => (
                  <label key={az.id} className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.availabilityZoneIds.includes(az.id)}
                      onChange={(e) => {
                        const ids = new Set(form.availabilityZoneIds);
                        if (e.target.checked) ids.add(az.id);
                        else ids.delete(az.id);
                        setForm({ ...form, availabilityZoneIds: Array.from(ids) });
                      }}
                      className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600"
                    />
                    <span className="truncate">{az.name}</span>
                  </label>
                ))}
              </div>
            </div>
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
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '' });

  const resetForm = () => { setForm({ name: '', slug: '', description: '', icon: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (c: Category) => { setEditing(c); setForm({ name: c.name, slug: c.slug, description: c.description || '', icon: c.icon || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { ...form, slug: form.slug || form.name.toLowerCase().replace(/\s+/g, '-'), icon: form.icon || undefined };
      if (editing) await updateCategory.mutateAsync({ id: editing.id, ...payload });
      else await createCategory.mutateAsync(payload);
      setIsOpen(false); resetForm();
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this category?')) return;
    try {
      await deleteCategory.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load categories." onRetry={refetch} />;

  const mobileCards = categories?.map((cat: Category) => (
    <MobileCard key={cat.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{cat.name}</p>
          <p className="text-sm text-slate-400">{cat.slug}</p>
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
          <ResponsiveTable headers={['Name', 'Slug', 'Description', 'Products']} isLoading={isLoading} emptyMessage="No categories" mobileCards={mobileCards}>
            {categories?.map((cat: Category) => (
              <tr key={cat.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{cat.name}</td>
                <td className="py-3 text-slate-400">{cat.slug}</td>
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
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Slug</label><Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generated if empty" className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white" /></div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Icon (Cpu, Database, Server, Monitor)</label><Input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ FLAVORS SECTION ============
function FlavorsSection() {
  const { data: flavors, isLoading, isError, refetch } = useAdminFlavors();
  const { data: products } = useAdminProducts();
  const createFlavor = useCreateFlavor();
  const updateFlavor = useUpdateFlavor();
  const deleteFlavor = useDeleteFlavor();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Flavor | null>(null);
  const [form, setForm] = useState({ name: '', productId: '', vcpu: 0, ramGb: 0, description: '' });

  const resetForm = () => { setForm({ name: '', productId: '', vcpu: 0, ramGb: 0, description: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (f: Flavor) => { setEditing(f); setForm({ name: f.name, productId: f.productId, vcpu: f.vcpu, ramGb: f.ramGb, description: f.description || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateFlavor.mutateAsync({ id: editing.id, ...form });
      else await createFlavor.mutateAsync(form);
      setIsOpen(false); resetForm();
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this flavor?')) return;
    try {
      await deleteFlavor.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load flavors." onRetry={refetch} />;

  const mobileCards = flavors?.map((flavor: Flavor) => (
    <MobileCard key={flavor.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{flavor.name}</p>
          <p className="text-sm text-slate-400">{(flavor as any).product?.name}</p>
        </div>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        {flavor.vcpu} vCPU · {flavor.ramGb} GB RAM
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
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'Product', 'vCPU', 'RAM', 'Description']} isLoading={isLoading} emptyMessage="No flavors" mobileCards={mobileCards}>
            {flavors?.map((flavor: Flavor) => (
              <tr key={flavor.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{flavor.name}</td>
                <td className="py-3 text-slate-400">{(flavor as any).product?.name}</td>
                <td className="py-3 text-slate-400">{flavor.vcpu}</td>
                <td className="py-3 text-slate-400">{flavor.ramGb} GB</td>
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
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Product</label>
              <Select value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Choose...</option>
                {products?.map((p: Product) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">vCPU</label><Input type="number" value={form.vcpu} onChange={(e) => setForm({ ...form, vcpu: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">RAM (GB)</label><Input type="number" value={form.ramGb} onChange={(e) => setForm({ ...form, ramGb: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Description</label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white" /></div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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

  const resetForm = () => { setForm({ productId: '', dependsOnId: '', type: 'REQUIRED', description: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (d: Dependency) => { setEditing(d); setForm({ productId: d.productId, dependsOnId: d.dependsOnId, type: d.type, description: d.description || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateDependency.mutateAsync({ id: editing.id, ...form, type: form.type as Dependency['type'] });
      else await createDependency.mutateAsync({ ...form, type: form.type as Dependency['type'] });
      setIsOpen(false); resetForm();
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this dependency?')) return;
    try {
      await deleteDependency.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load dependencies." onRetry={refetch} />;

  const mobileCards = dependencies?.map((dep: Dependency) => (
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
            {dependencies?.map((dep: Dependency) => (
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
                {products?.map((p: Product) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </Select>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Depends on</label>
              <Select value={form.dependsOnId} onChange={(e) => setForm({ ...form, dependsOnId: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]">
                <option value="">Choose...</option>
                {products?.filter((p: Product) => p.id !== form.productId).map((p: Product) => (<option key={p.id} value={p.id}>{p.name}</option>))}
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
    </div>
  );
}

// ============ FORECASTS ADMIN SECTION ============
function ForecastsAdminSection() {
  const { data: forecasts, isLoading, isError, refetch } = useAdminForecasts();
  const updateForecast = useUpdateForecast();
  const deleteForecast = useDeleteForecast();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('ALL');

  const filtered = forecasts?.filter((f: Forecast) => {
    const matchesSearch = !searchQuery || f.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.requestedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (id: string) => {
    try {
      await updateForecast.mutateAsync({ id, status: 'APPROVED' as Forecast['status'], reviewedBy: 'Admin' });
    } catch {
      // error already toasted by mutation
    }
  };

  const handleReject = async (id: string) => {
    try {
      await updateForecast.mutateAsync({ id, status: 'REJECTED' as Forecast['status'], reviewedBy: 'Admin', rejectionReason: 'Rejected via admin' });
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this request?')) return;
    try {
      await deleteForecast.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load forecasts." onRetry={refetch} />;

  const mobileCards = filtered?.map((forecast: Forecast) => (
    <MobileCard key={forecast.id}>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-white truncate">{forecast.product?.name}</p>
          <p className="text-sm text-slate-400">{forecast.flavor?.name} × {forecast.azDetails?.reduce((s, d) => s + d.quantity, 0) || 0}</p>
        </div>
        <Badge variant="outline" className={statusConfig[forecast.status].color + ' shrink-0 ml-2'}>
          {statusConfig[forecast.status].label}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-400">
        <p>{forecast.requestedBy}</p>
        <p className="text-xs text-slate-600">{new Date(forecast.createdAt).toLocaleDateString('fr-FR')}</p>
      </div>
      <div className="mt-3 flex justify-end gap-1">
        {forecast.status === 'PENDING' && (
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
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as ApprovalStatus | 'ALL')} className="w-40 bg-slate-900 border-slate-700 text-white min-h-[44px]">
          <option value="ALL">All statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
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
                    {filtered?.map((forecast: Forecast) => (
                      <tr key={forecast.id} className="hover:bg-slate-800/50 transition-colors">
                        <td className="py-3 font-medium text-white">{forecast.product?.name}</td>
                        <td className="py-3 text-slate-400">{forecast.flavor?.name}</td>
                        <td className="py-3 text-slate-400">{forecast.azDetails?.reduce((s, d) => s + d.quantity, 0) || 0}</td>
                        <td className="py-3 text-slate-400">{forecast.requestedBy}</td>
                        <td className="py-3">
                          <Badge variant="outline" className={statusConfig[forecast.status].color}>
                            {statusConfig[forecast.status].label}
                          </Badge>
                        </td>
                        <td className="py-3 text-slate-500">{new Date(forecast.createdAt).toLocaleDateString('fr-FR')}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {forecast.status === 'PENDING' && (
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

  const resetForm = () => { setForm({ email: '', name: '', role: 'USER' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setForm({ email: u.email, name: u.name, role: u.role }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateUser.mutateAsync({ id: editing.id, ...form });
      else await createUser.mutateAsync(form);
      setIsOpen(false); resetForm();
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    try {
      await deleteUser.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load users." onRetry={refetch} />;

  const mobileCards = users?.map((u: User) => (
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
      <p className="mt-2 text-xs text-slate-500">{new Date(u.createdAt).toLocaleDateString('fr-FR')}</p>
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
            {users?.map((u: User) => (
              <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{u.name}</td>
                <td className="py-3 text-slate-400">{u.email}</td>
                <td className="py-3">
                  <Badge variant="outline" className={u.role === 'ADMIN' ? 'border-purple-500/20 text-purple-500' : 'border-slate-600 text-slate-400'}>
                    {u.role}
                  </Badge>
                </td>
                <td className="py-3 text-slate-400">{new Date(u.createdAt).toLocaleDateString('fr-FR')}</td>
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
    </div>
  );
}

// ============ AVAILABILITY ZONES SECTION ============
function AvailabilityZonesSection() {
  const { data: zones, isLoading, isError, refetch } = useAdminAvailabilityZones();
  const createAz = useCreateAvailabilityZone();
  const updateAz = useUpdateAvailabilityZone();
  const deleteAz = useDeleteAvailabilityZone();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilityZone | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', city: '', country: '', region: 'Europe', latitude: 0, longitude: 0, isActive: true,
  });

  const resetForm = () => {
    setForm({ code: '', name: '', city: '', country: '', region: 'Europe', latitude: 0, longitude: 0, isActive: true });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (az: AvailabilityZone) => {
    setEditing(az);
    setForm({
      code: az.code, name: az.name, city: az.city, country: az.country,
      region: az.region, latitude: az.latitude, longitude: az.longitude, isActive: az.isActive,
    });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) await updateAz.mutateAsync({ id: editing.id, ...form });
      else await createAz.mutateAsync(form);
      setIsOpen(false); resetForm();
    } catch {
      // error already toasted by mutation
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this availability zone?')) return;
    try {
      await deleteAz.mutateAsync(id);
    } catch {
      // error already toasted by mutation
    }
  };

  if (isError) return <QueryError message="Unable to load availability zones." onRetry={refetch} />;

  const mobileCards = zones?.map((az: AvailabilityZone) => (
    <MobileCard key={az.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{az.name}</p>
          <p className="text-sm text-slate-400">{az.code}</p>
        </div>
        <Badge variant="outline" className={az.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {az.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-slate-500">{az.city}, {az.country} &middot; {az.region}</p>
      <div className="mt-3 flex justify-end gap-1">
        <Button size="sm" variant="ghost" onClick={() => openEdit(az)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="ghost" onClick={() => handleDelete(az.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </MobileCard>
  ));

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable
            headers={['Code', 'Name', 'City', 'Region', 'Active']}
            isLoading={isLoading}
            emptyMessage="No availability zones"
            mobileCards={mobileCards}
          >
            {zones?.map((az: AvailabilityZone) => (
              <tr key={az.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-mono text-xs text-slate-300">{az.code}</td>
                <td className="py-3 font-medium text-white">{az.name}</td>
                <td className="py-3 text-slate-400">{az.city}, {az.country}</td>
                <td className="py-3">
                  <Badge variant="outline" className="text-xs" style={{ borderColor: `${azRegionColors[az.region] || '#334155'}40`, color: azRegionColors[az.region] || '#94a3b8' }}>
                    {az.region}
                  </Badge>
                </td>
                <td className="py-3">
                  <Badge variant="outline" className={az.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                    {az.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(az)} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(az.id)} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{editing ? 'Edit availability zone' : 'New availability zone'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Code</label>
                <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Name</label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">City</label>
                <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Country</label>
                <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Region</label>
              <select
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                required
                className="h-10 min-h-[44px] w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                {(['Europe', 'North America', 'Asia-Pacific'].includes(form.region) ? [] : [form.region]).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value="Europe">Europe</option>
                <option value="North America">North America</option>
                <option value="Asia-Pacific">Asia-Pacific</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Latitude</label>
                <Input type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Longitude</label>
                <Input type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="az-active"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-500"
              />
              <label htmlFor="az-active" className="text-sm text-slate-300">Active</label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============ MAIN ADMIN PAGE ============
export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { value: 'products', label: 'Products', icon: Package },
    { value: 'categories', label: 'Categories', icon: Layers },
    { value: 'flavors', label: 'Flavors', icon: Cpu },
    { value: 'dependencies', label: 'Dependencies', icon: Link2 },
    { value: 'availability-zones', label: 'Regions', icon: Globe },
    { value: 'forecasts', label: 'Forecasts', icon: Activity },
    { value: 'users', label: 'Users', icon: UserCog },
  ];

  return (
    <div className="space-y-6">
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white">Administration</h1>
        <p className="mt-2 text-slate-400">Manage the CloudMarket platform.</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-slate-900 border border-slate-800 flex-wrap h-auto gap-1 p-1">
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

        <TabsContent value="dashboard" className="animate-fade-in"><DashboardSection /></TabsContent>
        <TabsContent value="products" className="animate-fade-in"><ProductsSection /></TabsContent>
        <TabsContent value="categories" className="animate-fade-in"><CategoriesSection /></TabsContent>
        <TabsContent value="flavors" className="animate-fade-in"><FlavorsSection /></TabsContent>
        <TabsContent value="dependencies" className="animate-fade-in"><DependenciesSection /></TabsContent>
        <TabsContent value="forecasts" className="animate-fade-in"><ForecastsAdminSection /></TabsContent>
        <TabsContent value="availability-zones" className="animate-fade-in"><AvailabilityZonesSection /></TabsContent>
        <TabsContent value="users" className="animate-fade-in"><UsersSection /></TabsContent>
      </Tabs>
    </div>
  );
}
