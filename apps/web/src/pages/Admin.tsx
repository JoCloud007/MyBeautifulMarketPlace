import { useState } from 'react';
import {
  useAdminDashboard,
  useAdminProducts,
  useAdminCategories,
  useAdminFlavors,
  useAdminDependencies,
  useAdminForecasts,
  useAdminUsers,
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
  useAvailabilityZones,
  useCreateAvailabilityZone,
  useUpdateAvailabilityZone,
  useDeleteAvailabilityZone,
  useInstances,
  useCreateInstance,
  useUpdateInstance,
  useDeleteInstance,
  useApplications,
  useProducts,
} from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
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
  MapPin,
  Server,
} from 'lucide-react';
import type { ApprovalStatus, Product, Category, Flavor, Dependency, User, Forecast, AvailabilityZone, Instance, InstanceStatus, Environment } from '@cloudmarket/shared-types';

const statusConfig: Record<ApprovalStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'border-amber-500/20 text-amber-500' },
  APPROVED: { label: 'Approved', color: 'border-emerald-500/20 text-emerald-500' },
  REJECTED: { label: 'Rejected', color: 'border-red-500/20 text-red-500' },
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

  if (!children) {
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

  const counts = (dashboard as any)?.counts ?? {};
  const countCards = [
    { label: 'Products', value: counts.products ?? 0, icon: Package, color: 'text-blue-400' },
    { label: 'Categories', value: counts.categories ?? 0, icon: Layers, color: 'text-purple-400' },
    { label: 'Forecasts', value: counts.forecasts ?? 0, icon: BarChart3, color: 'text-amber-400' },
    { label: 'Users', value: counts.users ?? 0, icon: Users, color: 'text-emerald-400' },
    { label: 'Applications', value: counts.applications ?? 0, icon: Activity, color: 'text-cyan-400' },
    { label: 'Continuity Levels', value: counts.continuityLevels ?? 0, icon: CheckCircle, color: 'text-rose-400' },
  ];

  if (isError) {
    return <QueryError message="Unable to load dashboard." onRetry={refetch} />;
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg bg-slate-800 animate-pulse-soft" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
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

// ============ PRODUCTS SECTION ============
function ProductsSection() {
  const { data: products, isLoading, isError, refetch } = useAdminProducts();
  const { data: categories } = useAdminCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '', slug: '', description: '', categoryId: '', os: '', documentation: '', roadmap: '', isActive: true,
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setForm({ name: '', slug: '', description: '', categoryId: '', os: '', documentation: '', roadmap: '', isActive: true });
    setEditing(null);
  };

  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      name: product.name, slug: product.slug, description: product.description || '',
      categoryId: product.categoryId, os: product.os || '', documentation: product.documentation || '',
      roadmap: product.roadmap || '', isActive: product.isActive,
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

  if (isError) return <QueryError message="Unable to load products." onRetry={refetch} />;

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
            {products?.map((product) => (
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
                {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
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

// ============ CATEGORIES SECTION ============
function CategoriesSection() {
  const { data: categories, isLoading, isError, refetch } = useAdminCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '' });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

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
            {categories?.map((cat) => (
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
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => { setForm({ name: '', productId: '', vcpu: 0, ramGb: 0, description: '' }); setEditing(null); };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (f: Flavor) => { setEditing(f); setForm({ name: f.name, productId: f.productId, vcpu: f.vcpu, ramGb: f.ramGb, description: f.description || '' }); setIsOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editing) await updateFlavor.mutateAsync({ id: editing.id, ...form });
    else await createFlavor.mutateAsync(form);
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

  if (isError) return <QueryError message="Unable to load flavors." onRetry={refetch} />;

  const mobileCards = flavors?.map((flavor) => (
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
            {flavors?.map((flavor) => (
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
                {products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
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
  const [statusFilter, setStatusFilter] = useState<ApprovalStatus | 'ALL'>('ALL');
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const filtered = forecasts?.filter((f) => {
    const matchesSearch = !searchQuery || f.lines?.[0]?.product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || f.requestedBy?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || f.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (id: string) => {
    await updateForecast.mutateAsync({ id, status: 'APPROVED' as Forecast['status'], reviewedBy: 'Admin' });
  };

  const handleReject = async (id: string) => {
    await updateForecast.mutateAsync({ id, status: 'REJECTED' as Forecast['status'], reviewedBy: 'Admin', rejectionReason: 'Rejected via admin' });
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

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<AvailabilityZone | null>(null);
  const [form, setForm] = useState({
    code: '', name: '', city: '', country: '', region: '', latitude: '', longitude: '', isActive: true,
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setForm({ code: '', name: '', city: '', country: '', region: '', latitude: '', longitude: '', isActive: true });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (z: AvailabilityZone) => {
    setEditing(z);
    setForm({
      code: z.code, name: z.name, city: z.city, country: z.country, region: z.region,
      latitude: String(z.latitude), longitude: String(z.longitude), isActive: z.isActive,
    });
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
    z.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    z.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isError) return <QueryError message="Unable to load availability zones." onRetry={refetch} />;

  const mobileCards = filtered?.map((z) => (
    <MobileCard key={z.id}>
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-white">{z.name}</p>
          <p className="text-sm text-slate-400">{z.code}</p>
        </div>
        <Badge variant="outline" className={z.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
          {z.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        <p>{z.city}, {z.country}</p>
        <p>Region: {z.region}</p>
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
          <Input placeholder="Search by code or name..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 min-h-[44px]" />
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"><Plus className="mr-2 h-4 w-4" /> Add</Button>
      </div>
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Code', 'Name', 'City', 'Country', 'Region', 'Status']} isLoading={isLoading} emptyMessage="No availability zones" mobileCards={mobileCards}>
            {filtered?.map((z) => (
              <tr key={z.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{z.code}</td>
                <td className="py-3 text-slate-400">{z.name}</td>
                <td className="py-3 text-slate-400">{z.city}</td>
                <td className="py-3 text-slate-400">{z.country}</td>
                <td className="py-3 text-slate-400">{z.region}</td>
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
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Code</label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Name</label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">City</label><Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Country</label><Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Region</label><Input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Latitude</label><Input type="number" step="any" min="-90" max="90" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2"><label className="text-sm font-medium text-slate-300">Longitude</label><Input type="number" step="any" min="-180" max="180" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" /></div>
              <div className="space-y-2 flex items-center gap-2 pt-6">
                <input type="checkbox" id="az-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="h-4 w-4 rounded border-slate-600 bg-slate-950 text-blue-600" />
                <label htmlFor="az-active" className="text-sm font-medium text-slate-300">Active</label>
              </div>
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

// ============ INSTANCES SECTION ============
const instanceStatusConfig: Record<InstanceStatus, { label: string; color: string }> = {
  PENDING: { label: 'Pending', color: 'border-slate-500/20 text-slate-400' },
  PROVISIONING: { label: 'Provisioning', color: 'border-blue-500/20 text-blue-400' },
  RUNNING: { label: 'Running', color: 'border-emerald-500/20 text-emerald-500' },
  STOPPED: { label: 'Stopped', color: 'border-amber-500/20 text-amber-500' },
  TERMINATED: { label: 'Terminated', color: 'border-red-500/20 text-red-500' },
};

function InstancesSection() {
  const { data: instances, isLoading, isError, refetch } = useInstances();
  const { data: applications } = useApplications();
  const { data: products } = useProducts();
  const { data: zones } = useAvailabilityZones();
  const createInstance = useCreateInstance();
  const updateInstance = useUpdateInstance();
  const deleteInstance = useDeleteInstance();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<Instance | null>(null);
  const [form, setForm] = useState<{
    name: string; description: string; applicationId: string; productId: string; flavorId: string; azCode: string;
    status: InstanceStatus; environment: Environment; ipAddress: string; hostname: string;
  }>({
    name: '', description: '', applicationId: '', productId: '', flavorId: '', azCode: '',
    status: 'PENDING' as InstanceStatus, environment: 'DEV' as Environment, ipAddress: '', hostname: '',
  });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [searchQuery, setSearchQuery] = useState('');

  const resetForm = () => {
    setForm({ name: '', description: '', applicationId: '', productId: '', flavorId: '', azCode: '',
      status: 'PENDING' as InstanceStatus, environment: 'DEV' as Environment, ipAddress: '', hostname: '' });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (instance: Instance) => {
    setEditing(instance);
    setForm({
      name: instance.name, description: instance.description || '', applicationId: instance.applicationId,
      productId: instance.productId, flavorId: instance.flavorId, azCode: instance.azCode,
      status: instance.status, environment: instance.environment, ipAddress: instance.ipAddress || '',
      hostname: instance.hostname || '',
    });
    setIsOpen(true);
  };

  const selectedProduct = products?.find((p) => p.id === form.productId);
  const availableFlavors = selectedProduct?.flavors || [];

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
          <p className="text-sm text-slate-400">{instance.product?.name} · {instance.flavor?.name}</p>
        </div>
        <Badge variant="outline" className={instanceStatusConfig[instance.status].color}>
          {instanceStatusConfig[instance.status].label}
        </Badge>
      </div>
      <div className="mt-2 text-sm text-slate-500">
        <p>{instance.application?.name}</p>
        <p>{instance.az?.code} · {instance.environment}</p>
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
          <ResponsiveTable headers={['Name', 'Application', 'Product', 'Flavor', 'AZ', 'Status', 'Env']} isLoading={isLoading} emptyMessage="No instances" mobileCards={mobileCards}>
            {filtered?.map((instance) => (
              <tr key={instance.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="py-3 font-medium text-white">{instance.name}</td>
                <td className="py-3 text-slate-400">{instance.application?.name}</td>
                <td className="py-3 text-slate-400">{instance.product?.name}</td>
                <td className="py-3 text-slate-400">{instance.flavor?.name}</td>
                <td className="py-3 text-slate-400">{instance.az?.code}</td>
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
                  {availableFlavors.map((f) => <option key={f.id} value={f.id}>{f.name} ({f.vcpu}vCPU, {f.ramGb}GB)</option>)}
                </Select>
              </div>
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
                  <option value="TERMINATED">Terminated</option>
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

// ============ MAIN ADMIN PAGE ============
export default function Admin() {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { value: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { value: 'products', label: 'Products', icon: Package },
    { value: 'categories', label: 'Categories', icon: Layers },
    { value: 'flavors', label: 'Flavors', icon: Cpu },
    { value: 'dependencies', label: 'Dependencies', icon: Link2 },
    { value: 'forecasts', label: 'Forecasts', icon: Activity },
    { value: 'users', label: 'Users', icon: UserCog },
    { value: 'availability-zones', label: 'Availability Zones', icon: MapPin },
    { value: 'instances', label: 'Instances', icon: Server },
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
        <TabsContent value="users" className="animate-fade-in"><UsersSection /></TabsContent>
        <TabsContent value="availability-zones" className="animate-fade-in"><AvailabilityZonesSection /></TabsContent>
        <TabsContent value="instances" className="animate-fade-in"><InstancesSection /></TabsContent>
      </Tabs>
    </div>
  );
}
