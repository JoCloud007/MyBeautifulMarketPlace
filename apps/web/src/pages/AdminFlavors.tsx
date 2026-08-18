import { useState } from 'react';
import {
  useAdminFlavors,
  useCreateFlavor,
  useUpdateFlavor,
  useDeleteFlavor,
} from '@/hooks/useApi';
import QueryError from '@/components/QueryError';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import type { Flavor } from '@cloudmarket/shared-types';

function ResponsiveTable({
  headers,
  children,
  isLoading,
  emptyMessage,
}: {
  headers: string[];
  children: React.ReactNode;
  isLoading: boolean;
  emptyMessage: string;
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

  if (!children || (Array.isArray(children) && children.length === 0) || (Array.isArray(children) && children.filter(Boolean).length === 0)) {
    return (
      <div className="text-center py-12">
        <p className="text-lg font-medium text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
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
  );
}

function FlavorModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: Flavor | null;
}) {
  const createFlavor = useCreateFlavor();
  const updateFlavor = useUpdateFlavor();
  const [form, setForm] = useState({
    name: editing?.name || '',
    vcpu: editing?.vcpu ?? 0,
    ramGb: editing?.ramGb ?? 0,
    description: editing?.description || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateFlavor.mutateAsync({ id: editing.id, ...form });
      } else {
        await createFlavor.mutateAsync(form);
      }
      onClose();
    } catch {
      /* handled by hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">{editing ? 'Edit Flavor' : 'New Flavor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">vCPU</label>
              <Input type="number" min={0} value={form.vcpu} onChange={(e) => setForm({ ...form, vcpu: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">RAM (GB)</label>
              <Input type="number" min={0} value={form.ramGb} onChange={(e) => setForm({ ...form, ramGb: parseInt(e.target.value) || 0 })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Description</label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">Cancel</Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">{editing ? 'Save' : 'Create'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminFlavors() {
  const { data: flavors, isLoading, isError, refetch } = useAdminFlavors();
  const deleteFlavor = useDeleteFlavor();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flavor | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  if (isError) return <QueryError message="Unable to load flavors." onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Add Flavor
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Name', 'vCPU', 'RAM', 'Used By', 'Description']} isLoading={isLoading} emptyMessage="No flavors">
            {flavors?.map((flavor) => {
              const usedBy = (flavor as any)._count?.variants ?? 0;
              return (
                <tr key={flavor.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 font-medium text-white">{flavor.name}</td>
                  <td className="py-3 text-slate-400">{flavor.vcpu}</td>
                  <td className="py-3 text-slate-400">{flavor.ramGb} GB</td>
                  <td className="py-3">
                    <Badge variant="outline" className={usedBy > 0 ? 'border-amber-500/20 text-amber-500' : 'border-slate-700 text-slate-500'}>
                      {usedBy} variant{usedBy !== 1 ? 's' : ''}
                    </Badge>
                  </td>
                  <td className="py-3 text-slate-400">{flavor.description || '—'}</td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(flavor); setModalOpen(true); }} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: flavor.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10" disabled={usedBy > 0}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <FlavorModal key={editing?.id ?? 'new'} open={modalOpen} onClose={() => setModalOpen(false)} editing={editing} />

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        title="Delete Flavor"
        description="Are you sure you want to delete this flavor? This action cannot be undone."
        onConfirm={async () => {
          if (confirmDelete.id) await deleteFlavor.mutateAsync(confirmDelete.id);
          setConfirmDelete({ open: false, id: null });
        }}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}
