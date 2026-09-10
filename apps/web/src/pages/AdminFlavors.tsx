import { useState, useMemo } from 'react';
import {
  useAdminFlavors,
  useCreateFlavor,
  useUpdateFlavor,
  useDeleteFlavor,
  useRegions,
  useAvailabilityZones,
  useZones,
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
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import type { Flavor, AvailabilitySchedule, AvailabilityType } from '@cloudmarket/shared-types';

function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(' ');
}

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

function MultiSelectToggle({
  label,
  options,
  selectedIds,
  onToggle,
  getLabel,
}: {
  label: string;
  options: { id: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  getLabel: (item: any) => string;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onToggle(opt.id)}
            className={cn(
              'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
              selectedIds.includes(opt.id)
                ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
            )}
          >
            {getLabel(opt)}
          </button>
        ))}
      </div>
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
                  <option key={az.id} value={az.id}>{az.code}</option>
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
  const { data: regionList } = useRegions();
  const { data: azList } = useAvailabilityZones();
  const { data: zoneList } = useZones();

  const [form, setForm] = useState({
    name: editing?.name || '',
    vcpu: editing?.vcpu ?? 0,
    ramGb: editing?.ramGb ?? 0,
    description: editing?.description || '',
    regionIds: editing?.regions?.map((r) => r.regionId) || [] as string[],
    availabilityZoneIds: editing?.availabilityZones?.map((az) => az.availabilityZoneId) || [] as string[],
    zoneIds: editing?.zones?.map((z) => z.zoneId) || [] as string[],
    schedules: editing?.availabilitySchedules ? [...editing.availabilitySchedules] : [] as Partial<AvailabilitySchedule>[],
  });

  const selectedRegionIds = form.regionIds;
  const selectedAzIds = form.availabilityZoneIds;

  const filteredAzs = useMemo(() => {
    if (!azList) return [];
    if (selectedRegionIds.length === 0) return azList;
    // Filter AZs by selected regions: az.region is a string (region name), not ID.
    // We need to map region IDs to region names first.
    const selectedRegionNames = regionList
      ?.filter((r) => selectedRegionIds.includes(r.id))
      .map((r) => r.name) || [];
    return azList.filter((az) => selectedRegionNames.includes(az.region));
  }, [azList, selectedRegionIds, regionList]);

  const filteredZones = useMemo(() => {
    if (!zoneList) return [];
    let result = zoneList;
    if (selectedAzIds.length > 0) {
      result = result.filter((z) =>
        z.availabilityZones?.some((za: any) => selectedAzIds.includes(za.availabilityZoneId))
      );
    }
    return result;
  }, [zoneList, selectedAzIds]);

  const toggleRegion = (id: string) => {
    setForm((prev) => ({
      ...prev,
      regionIds: prev.regionIds.includes(id)
        ? prev.regionIds.filter((x) => x !== id)
        : [...prev.regionIds, id],
    }));
  };

  const toggleAz = (id: string) => {
    setForm((prev) => ({
      ...prev,
      availabilityZoneIds: prev.availabilityZoneIds.includes(id)
        ? prev.availabilityZoneIds.filter((x) => x !== id)
        : [...prev.availabilityZoneIds, id],
    }));
  };

  const toggleZone = (id: string) => {
    setForm((prev) => ({
      ...prev,
      zoneIds: prev.zoneIds.includes(id)
        ? prev.zoneIds.filter((x) => x !== id)
        : [...prev.zoneIds, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        name: form.name,
        vcpu: form.vcpu,
        ramGb: form.ramGb,
        description: form.description,
        regionIds: form.regionIds,
        availabilityZoneIds: form.availabilityZoneIds,
        zoneIds: form.zoneIds,
        schedules: form.schedules,
      };
      if (editing) {
        await updateFlavor.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createFlavor.mutateAsync(payload);
      }
      onClose();
    } catch {
      /* handled by hook */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
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

          <MultiSelectToggle
            label="Regions"
            options={regionList || []}
            selectedIds={form.regionIds}
            onToggle={toggleRegion}
            getLabel={(r) => r.name}
          />

          <MultiSelectToggle
            label="Availability Zones"
            options={filteredAzs}
            selectedIds={form.availabilityZoneIds}
            onToggle={toggleAz}
            getLabel={(az) => az.code}
          />

          <MultiSelectToggle
            label="Zones"
            options={filteredZones}
            selectedIds={form.zoneIds}
            onToggle={toggleZone}
            getLabel={(z) => z.name}
          />

          <ScheduleEditor
            schedules={form.schedules}
            onChange={(schedules) => setForm({ ...form, schedules })}
            regions={regionList || []}
            azs={azList || []}
            zones={zoneList || []}
          />

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
          <ResponsiveTable headers={['Name', 'vCPU', 'RAM', 'Used By', 'Regions', 'AZs', 'Description']} isLoading={isLoading} emptyMessage="No flavors">
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
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {flavor.regions?.map((r) => (
                        <span key={r.regionId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">{r.region?.name}</span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-1">
                      {flavor.availabilityZones?.map((az) => (
                        <span key={az.availabilityZoneId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">{az.availabilityZone?.code}</span>
                      ))}
                    </div>
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
