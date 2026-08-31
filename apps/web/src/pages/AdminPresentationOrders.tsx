import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  usePresentationOrders,
  useCreatePresentationOrder,
  useUpdatePresentationOrder,
  useDeletePresentationOrder,
} from '@/hooks/useApi';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import QueryError from '@/components/QueryError';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRight,
  LayoutList,
} from 'lucide-react';
import type { PresentationOrder } from '@cloudmarket/shared-types';

const stepColors: Record<string, string> = {
  COUNTRY: 'border-blue-500/20 text-blue-400 bg-blue-500/10',
  ZONE: 'border-blue-500/20 text-blue-400 bg-blue-500/10',
  PRODUCT: 'border-purple-500/20 text-purple-400 bg-purple-500/10',
  FLAVOR: 'border-purple-500/20 text-purple-400 bg-purple-500/10',
  USE_CASE: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
  CATEGORY: 'border-pink-500/20 text-pink-400 bg-pink-500/10',
};

function AnimatedSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, isVisible } = useScrollReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5'}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

export default function AdminPresentationOrders() {
  const navigate = useNavigate();
  const { data: orders, isLoading, isError, refetch } = usePresentationOrders();
  const createOrder = useCreatePresentationOrder();
  const updateOrder = useUpdatePresentationOrder();
  const deleteOrder = useDeletePresentationOrder();

  const [isOpen, setIsOpen] = useState(false);
  const [editing, setEditing] = useState<PresentationOrder | null>(null);
  const [form, setForm] = useState({ name: '', description: '', isActive: true, isDefault: false });
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const resetForm = () => {
    setForm({ name: '', description: '', isActive: true, isDefault: false });
    setEditing(null);
  };
  const openCreate = () => { resetForm(); setIsOpen(true); };
  const openEdit = (order: PresentationOrder) => {
    setEditing(order);
    setForm({ name: order.name, description: order.description || '', isActive: order.isActive, isDefault: order.isDefault });
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateOrder.mutateAsync({ id: editing.id, ...form });
      } else {
        await createOrder.mutateAsync(form);
      }
      setIsOpen(false);
      resetForm();
    } catch {
      // handled by hook
    }
  };

  const handleDelete = async () => {
    try {
      if (confirmDelete.id) await deleteOrder.mutateAsync(confirmDelete.id);
    } catch {
      // handled by hook
    }
    setConfirmDelete({ open: false, id: null });
  };

  if (isError) return <QueryError message="Unable to load presentation orders." onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Presentation Orders</h1>
          <p className="mt-2 text-slate-400">Define how customers discover products.</p>
        </div>
        <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> New Order
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-lg bg-slate-800" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="text-center py-12">
              <LayoutList className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-4 text-lg font-medium text-slate-300">No presentation orders</p>
              <p className="mt-1 text-slate-500">Create your first order to customize product discovery.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order, i) => (
                <AnimatedSection key={order.id} delay={i * 80}>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-4 transition-colors hover:border-slate-700">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold text-white">{order.name}</span>
                          {order.isDefault && (
                            <Badge variant="outline" className="border-blue-500/20 text-blue-400 bg-blue-500/10">
                              Default
                            </Badge>
                          )}
                          <Badge variant="outline" className={order.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                            {order.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        {order.description && (
                          <p className="mt-1 text-sm text-slate-400">{order.description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {order.steps
                            .sort((a, b) => a.position - b.position)
                            .map((step, idx) => (
                              <div key={step.id} className="flex items-center gap-2">
                                <Badge
                                  variant="outline"
                                  className={stepColors[step.stepType] || 'border-slate-700 text-slate-400'}
                                >
                                  {step.label}
                                </Badge>
                                {idx < order.steps.length - 1 && (
                                  <ArrowRight className="h-3 w-3 text-slate-600" />
                                )}
                              </div>
                            ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(`/admin/view-builder/${order.id}`)}
                          className="h-8 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                        >
                          Edit Flow
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEdit(order)}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmDelete({ open: true, id: order.id })}
                          className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? 'Edit Presentation Order' : 'New Presentation Order'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                placeholder="e.g. Location First"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
                placeholder="Optional description"
              />
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-950"
                />
                Active
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-950"
                />
                Default
              </label>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">
                {editing ? 'Save' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: open ? confirmDelete.id : null })}
        title="Delete Presentation Order"
        description="Are you sure you want to delete this presentation order? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}
