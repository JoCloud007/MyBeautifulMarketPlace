import { useState } from 'react';
import {
  useOperatingSystems,
  useCreateOperatingSystem,
  useUpdateOperatingSystem,
  useDeleteOperatingSystem,
  useOsVersions,
  useCreateOsVersion,
  useUpdateOsVersion,
  useDeleteOsVersion,
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
import { Plus, Pencil, Trash2, Monitor, ChevronDown, ChevronUp } from 'lucide-react';
import * as React from 'react';
import type { OperatingSystem, OsVersion } from '@cloudmarket/shared-types';

const phaseColors: Record<string, string> = {
  RELEASED: 'border-blue-500/20 text-blue-500',
  NORMAL_SUPPORT: 'border-emerald-500/20 text-emerald-500',
  EXTENDED_SUPPORT: 'border-amber-500/20 text-amber-500',
  NO_SUPPORT: 'border-orange-500/20 text-orange-500',
  EOL: 'border-red-500/20 text-red-500',
};

/* Responsive table wrapper */
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

/* OS Modal */
function OSModal({
  open,
  onClose,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  editing: OperatingSystem | null;
}) {
  const createOS = useCreateOperatingSystem();
  const updateOS = useUpdateOperatingSystem();
  const [form, setForm] = useState({
    family: editing?.family || '',
    name: editing?.name || '',
    slug: editing?.slug || '',
    isActive: editing?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await updateOS.mutateAsync({ id: editing.id, ...form });
      } else {
        await createOS.mutateAsync(form);
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
          <DialogTitle className="text-white">{editing ? 'Edit OS' : 'New OS'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Family</label>
            <Input
              value={form.family}
              onChange={(e) => setForm({ ...form, family: e.target.value })}
              required
              className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Slug</label>
            <Input
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              required
              className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="os-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950"
            />
            <label htmlFor="os-active" className="text-sm text-slate-300">
              Active
            </label>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* Version Modal */
function VersionModal({
  open,
  onClose,
  osId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  osId: string;
  editing: OsVersion | null;
}) {
  const createVersion = useCreateOsVersion();
  const updateVersion = useUpdateOsVersion();
  const [form, setForm] = useState({
    version: editing?.version || '',
    releaseDate: editing ? new Date(editing.releaseDate).toISOString().split('T')[0] : '',
    normalSupportEnd: editing ? new Date(editing.normalSupportEnd).toISOString().split('T')[0] : '',
    extendedSupportEnd: editing ? new Date(editing.extendedSupportEnd).toISOString().split('T')[0] : '',
    eolDate: editing ? new Date(editing.eolDate).toISOString().split('T')[0] : '',
    phase: editing?.phase || 'RELEASED',
    isActive: editing?.isActive ?? true,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        releaseDate: new Date(form.releaseDate).toISOString(),
        normalSupportEnd: new Date(form.normalSupportEnd).toISOString(),
        extendedSupportEnd: new Date(form.extendedSupportEnd).toISOString(),
        eolDate: new Date(form.eolDate).toISOString(),
      };
      const phase = form.phase as any;
      const typedPayload = { ...payload, phase };
      if (editing) {
        await updateVersion.mutateAsync({ osId, versionId: editing.id, ...typedPayload });
      } else {
        await createVersion.mutateAsync({ osId, ...typedPayload });
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
          <DialogTitle className="text-white">{editing ? 'Edit Version' : 'New Version'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Version</label>
            <Input
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              required
              className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Release Date</label>
              <Input
                type="date"
                value={form.releaseDate}
                onChange={(e) => setForm({ ...form, releaseDate: e.target.value })}
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Normal Support End</label>
              <Input
                type="date"
                value={form.normalSupportEnd}
                onChange={(e) => setForm({ ...form, normalSupportEnd: e.target.value })}
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Extended Support End</label>
              <Input
                type="date"
                value={form.extendedSupportEnd}
                onChange={(e) => setForm({ ...form, extendedSupportEnd: e.target.value })}
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">EOL Date</label>
              <Input
                type="date"
                value={form.eolDate}
                onChange={(e) => setForm({ ...form, eolDate: e.target.value })}
                required
                className="bg-slate-950 border-slate-700 text-white min-h-[44px]"
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Phase</label>
            <select
              value={form.phase}
              onChange={(e) => setForm({ ...form, phase: e.target.value })}
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
            <input
              type="checkbox"
              id="version-active"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="rounded border-slate-700 bg-slate-950"
            />
            <label htmlFor="version-active" className="text-sm text-slate-300">
              Active
            </label>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800 w-full sm:w-auto min-h-[44px]">
              Cancel
            </Button>
            <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white w-full sm:w-auto min-h-[44px]">
              {editing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminOS() {
  const { data: osList, isLoading, isError, refetch } = useOperatingSystems();
  const deleteOS = useDeleteOperatingSystem();
  const deleteVersion = useDeleteOsVersion();

  const [osModalOpen, setOsModalOpen] = useState(false);
  const [editingOs, setEditingOs] = useState<OperatingSystem | null>(null);

  const [versionModalOpen, setVersionModalOpen] = useState(false);
  const [versionModalOsId, setVersionModalOsId] = useState('');
  const [editingVersion, setEditingVersion] = useState<OsVersion | null>(null);

  const [expandedOs, setExpandedOs] = useState<string | null>(null);

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null; type: 'os' | 'version'; osId?: string }>({
    open: false,
    id: null,
    type: 'os',
  });

  const { data: versions } = useOsVersions(expandedOs || undefined);

  const handleDelete = async () => {
    try {
      if (confirmDelete.type === 'os' && confirmDelete.id) {
        await deleteOS.mutateAsync(confirmDelete.id);
      } else if (confirmDelete.type === 'version' && confirmDelete.id && confirmDelete.osId) {
        await deleteVersion.mutateAsync({ osId: confirmDelete.osId, versionId: confirmDelete.id });
      }
    } catch {
      /* handled by hook */
    }
    setConfirmDelete({ open: false, id: null, type: 'os' });
  };

  if (isError) return <QueryError message="Unable to load operating systems." onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            setEditingOs(null);
            setOsModalOpen(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]"
        >
          <Plus className="mr-2 h-4 w-4" /> Add OS
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable headers={['Family', 'Name', 'Slug', 'Versions', 'Active']} isLoading={isLoading} emptyMessage="No operating systems">
            {osList?.map((os) => (
              <React.Fragment key={os.id}>
                <tr className="hover:bg-slate-800/50 transition-colors">
                  <td className="py-3 font-medium text-white">{os.family}</td>
                  <td className="py-3 text-slate-400">{os.name}</td>
                  <td className="py-3 text-slate-400">{os.slug}</td>
                  <td className="py-3 text-slate-400">
                    <Badge variant="outline" className="border-slate-700 text-slate-400">
                      {(os as any)._count?.versions ?? os.versions?.length ?? 0}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <Badge
                      variant="outline"
                      className={os.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}
                    >
                      {os.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setVersionModalOsId(os.id);
                          setEditingVersion(null);
                          setVersionModalOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                        title="Add version"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingOs(os);
                          setOsModalOpen(true);
                        }}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDelete({ open: true, id: os.id, type: 'os' })}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedOs(expandedOs === os.id ? null : os.id)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200"
                      >
                        {expandedOs === os.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandedOs === os.id && (
                  <tr>
                    <td colSpan={6} className="py-0">
                      <div className="bg-slate-950/50 rounded-lg m-2 p-4">
                        <h4 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-blue-500" />
                          Versions
                        </h4>
                        {versions && versions.length > 0 ? (
                          <div className="space-y-2">
                            {versions.map((v) => (
                              <div
                                key={v.id}
                                className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
                              >
                                <div className="flex items-center gap-3 flex-wrap">
                                  <span className="text-sm text-white font-medium">{v.version}</span>
                                  <Badge variant="outline" className={phaseColors[v.phase] || 'border-slate-600 text-slate-400'}>
                                    {v.phase}
                                  </Badge>
                                  <span className="text-xs text-slate-500">
                                    EOL: {new Date(v.eolDate).toLocaleDateString()}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setVersionModalOsId(os.id);
                                      setEditingVersion(v);
                                      setVersionModalOpen(true);
                                    }}
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setConfirmDelete({ open: true, id: v.id, type: 'version', osId: os.id })
                                    }
                                    className="h-7 w-7 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-slate-500">No versions for this OS.</p>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <OSModal
        key={editingOs?.id ?? 'new'}
        open={osModalOpen}
        onClose={() => setOsModalOpen(false)}
        editing={editingOs}
      />

      <VersionModal
        key={editingVersion?.id ?? 'new'}
        open={versionModalOpen}
        onClose={() => setVersionModalOpen(false)}
        osId={versionModalOsId}
        editing={editingVersion}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null, type: 'os' })}
        title={confirmDelete.type === 'os' ? 'Delete OS' : 'Delete Version'}
        description="Are you sure? This action cannot be undone."
        onConfirm={handleDelete}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}
