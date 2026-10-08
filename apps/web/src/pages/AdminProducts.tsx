import { useState, useMemo } from 'react';
import { PickupList, productStatusPicklist } from '@/components/ui/pickup-list';
import {
  useAdminProducts,
  useAdminCategories,
  useCreateProduct,
  useUpdateProduct,
  useDeleteProduct,
  useProductVariants,
  useCreateProductVariant,
  useUpdateProductVariant,
  useDeleteProductVariant,
  useOperatingSystems,
  useOsVersions,
  useFlavors,
  useContinuityLevels,
  useAvailabilityZones,
  useProductVersions,
  useRegions,
  useZones,
} from '@/hooks/useApi';
import QueryError from '@/components/QueryError';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Pencil, Trash2, Server, X } from 'lucide-react';
import type { Product, ProductVariant, AvailabilitySchedule, AvailabilityType } from '@cloudmarket/shared-types';

function cn(...inputs: (string | undefined | false | null)[]) {
  return inputs.filter(Boolean).join(' ');
}

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

/* Product form modal */
function ProductModal({
  open,
  onClose,
  editing,
  categories,
}: {
  open: boolean;
  onClose: () => void;
  editing: Product | null;
  categories: any[];
}) {
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const { data: regionList } = useRegions();
  const { data: azList } = useAvailabilityZones();
  const { data: zoneList } = useZones();

  const [form, setForm] = useState({
    name: editing?.name || '',
    description: editing?.description || '',
    categoryId: editing?.categoryId || '',
    computeType: editing?.computeType || '',
    documentation: editing?.documentation || '',
    roadmap: editing?.roadmap || '',
    isActive: editing?.isActive ?? true,
    initialReleaseDate: editing?.initialReleaseDate ? editing.initialReleaseDate.slice(0, 10) : '',
    productEOLDate: editing?.productEOLDate ? editing.productEOLDate.slice(0, 10) : '',
    status: editing?.status || 'AVAILABLE',
    regionIds: editing?.regions?.map((r) => r.regionId) || [] as string[],
    availabilityZoneIds: editing?.availabilityZones?.map((az) => az.availabilityZoneId) || [] as string[],
    zoneIds: editing?.zones?.map((z) => z.zoneId) || [] as string[],
    schedules: editing?.availabilitySchedules ? [...editing.availabilitySchedules] : [] as Partial<AvailabilitySchedule>[],
  });

  const selectedCategory = categories?.find((c) => c.id === form.categoryId);
  const isCompute = selectedCategory?.name.toLowerCase() === 'compute';

  const selectedRegionIds = form.regionIds;
  const selectedAzIds = form.availabilityZoneIds;

  const filteredAzs = useMemo(() => {
    if (!azList) return [];
    if (selectedRegionIds.length === 0) return azList;
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
        ...form,
        regionIds: form.regionIds,
        availabilityZoneIds: form.availabilityZoneIds,
        zoneIds: form.zoneIds,
        schedules: form.schedules,
      };
      if (!isCompute) {
        payload.computeType = null;
      } else if (!payload.computeType) {
        payload.computeType = 'VIRTUAL';
      }
      if (payload.initialReleaseDate) payload.initialReleaseDate = new Date(payload.initialReleaseDate).toISOString();
      else delete payload.initialReleaseDate;
      if (payload.productEOLDate) payload.productEOLDate = new Date(payload.productEOLDate).toISOString();
      else delete payload.productEOLDate;
      if (editing) {
        await updateProduct.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createProduct.mutateAsync(payload);
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
          <DialogTitle className="text-white">{editing ? 'Edit Product' : 'New Product'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              required
              className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="">Select...</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {isCompute && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Compute Type</label>
              <select
                value={form.computeType || ''}
                onChange={(e) => setForm({ ...form, computeType: e.target.value })}
                className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
              >
                <option value="">Select...</option>
                <option value="VIRTUAL">Virtual</option>
                <option value="PHYSICAL">Physical</option>
              </select>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Description</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="bg-slate-950 border-slate-700 text-white" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Initial Release Date</label>
              <Input type="date" value={form.initialReleaseDate} onChange={(e) => setForm({ ...form, initialReleaseDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Product EOL Date</label>
              <Input type="date" value={form.productEOLDate} onChange={(e) => setForm({ ...form, productEOLDate: e.target.value })} className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Status</label>
            <PickupList
              options={productStatusPicklist}
              value={form.status}
              onChange={(v) => setForm({ ...form, status: v })}
            />
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
            getLabel={(az) => (az.name ? `${az.name} (${az.code})` : az.code)}
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

          <div className="flex items-center gap-2">
            <input type="checkbox" id="prod-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-700 bg-slate-950" />
            <label htmlFor="prod-active" className="text-sm text-slate-300">Active</label>
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

/* Variant modal */
function VariantModal({
  open,
  onClose,
  productId,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  editing: ProductVariant | null;
}) {
  const createVariant = useCreateProductVariant();
  const updateVariant = useUpdateProductVariant();
  const { data: osList } = useOperatingSystems();
  const { data: flavorList } = useFlavors();
  const { data: clList } = useContinuityLevels();
  const { data: azList } = useAvailabilityZones();

  const [form, setForm] = useState({
    name: editing?.name || '',
    osId: editing?.osId || '',
    osVersionId: editing?.osVersionId || '',
    flavorId: editing?.flavorId || '',
    availabilityZoneIds: editing?.availabilityZones?.map((az) => az.availabilityZoneId) || [] as string[],
    continuityLevelId: editing?.continuityLevelId || '',
    productVersionId: editing?.productVersionId || '',
    isActive: editing?.isActive ?? true,
  });

  const { data: versions } = useOsVersions(form.osId || undefined);
  const { data: productVersions } = useProductVersions(productId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        continuityLevelId: form.continuityLevelId || null,
        productVersionId: form.productVersionId || null,
      };
      if (editing) {
        await updateVariant.mutateAsync({ id: editing.id, ...payload });
      } else {
        await createVariant.mutateAsync({ productId, ...payload });
      }
      onClose();
    } catch {
      /* handled by hook */
    }
  };

  const toggleAz = (azId: string) => {
    setForm((prev) => ({
      ...prev,
      availabilityZoneIds: prev.availabilityZoneIds.includes(azId)
        ? prev.availabilityZoneIds.filter((id) => id !== azId)
        : [...prev.availabilityZoneIds, azId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="bg-slate-900 border-slate-800 text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white">{editing ? 'Edit Variant' : 'New Variant'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Name</label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className="bg-slate-950 border-slate-700 text-white min-h-[44px]" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Operating System</label>
            <select
              value={form.osId}
              onChange={(e) => setForm({ ...form, osId: e.target.value, osVersionId: '' })}
              required
              className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="">Select OS...</option>
              {osList?.map((os) => (
                <option key={os.id} value={os.id}>
                  {os.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">OS Version</label>
            <select
              value={form.osVersionId}
              onChange={(e) => setForm({ ...form, osVersionId: e.target.value })}
              required
              disabled={!form.osId}
              className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white disabled:opacity-50"
            >
              <option value="">Select Version...</option>
              {versions?.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Flavor</label>
            <select
              value={form.flavorId}
              onChange={(e) => setForm({ ...form, flavorId: e.target.value })}
              required
              className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="">Select Flavor...</option>
              {flavorList?.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.vcpu} vCPU, {f.ramGb} GB)
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Continuity Level</label>
            <select
              value={form.continuityLevelId}
              onChange={(e) => setForm({ ...form, continuityLevelId: e.target.value })}
              className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="">None</option>
              {clList?.map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Product Version</label>
            <select
              value={form.productVersionId}
              onChange={(e) => setForm({ ...form, productVersionId: e.target.value })}
              className="w-full h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
            >
              <option value="">None</option>
              {productVersions?.map((pv) => (
                <option key={pv.id} value={pv.id}>
                  {pv.version}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Availability Zones</label>
            <div className="flex flex-wrap gap-2">
              {azList?.map((az) => (
                <button
                  key={az.id}
                  type="button"
                  onClick={() => toggleAz(az.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium border transition-colors',
                    form.availabilityZoneIds.includes(az.id)
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                      : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-600'
                  )}
                >
                  {az.name ? `${az.name} (${az.code})` : az.code}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="variant-active" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} className="rounded border-slate-700 bg-slate-950" />
            <label htmlFor="variant-active" className="text-sm text-slate-300">Active</label>
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

/* Product drawer */
function ProductDrawer({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { data: variants, isLoading: variantsLoading } = useProductVariants(product.id);
  const deleteVariant = useDeleteProductVariant();

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  const isCompute = product.category?.name.toLowerCase() === 'compute';

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-xl font-bold text-white">{product.name}</h2>
            <p className="text-sm text-slate-400">{product.category?.name}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6 space-y-6">
          {isCompute ? (
            <>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-blue-500/20 text-blue-400">
                  {product.computeType}
                </Badge>
                <Badge variant="outline" className={product.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-500" />
                    Variants ({variants?.length ?? 0})
                  </h3>
                  <Button size="sm" onClick={() => { setEditingVariant(null); setVariantModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white">
                    <Plus className="mr-1 h-4 w-4" /> Add Variant
                  </Button>
                </div>

                <Card className="bg-slate-950 border-slate-800">
                  <CardContent className="p-0">
                    {variantsLoading ? (
                      <div className="p-4 space-y-3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <Skeleton key={i} className="h-14 rounded-lg bg-slate-800" />
                        ))}
                      </div>
                    ) : variants && variants.length > 0 ? (
                      <div className="divide-y divide-slate-800">
                        {variants.map((v) => (
                          <div key={v.id} className="flex items-center justify-between px-4 py-3">
                            <div className="space-y-1">
                              <p className="text-sm font-medium text-white">{v.name}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                  {v.os?.name} {v.osVersion?.version}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                  {v.flavor?.name}
                                </Badge>
                                <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
                                  {(v as any)._count?.instances ?? 0} instances
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {v.availabilityZones?.map((az) => (
                                  <span key={az.availabilityZoneId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">
                                    {az.availabilityZone?.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setEditingVariant(v); setVariantModalOpen(true); }} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: v.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-slate-500">No variants for this product.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Description</label>
                <p className="text-sm text-slate-400">{product.description || '—'}</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Status</label>
                <Badge variant="outline" className={product.isActive ? 'border-emerald-500/20 text-emerald-500' : 'border-slate-600 text-slate-500'}>
                  {product.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
          )}
        </div>
      </div>

      <VariantModal key={editingVariant?.id ?? 'new'} open={variantModalOpen} onClose={() => setVariantModalOpen(false)} productId={product.id} editing={editingVariant} />

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        title="Delete Variant"
        description="Are you sure you want to delete this variant? This action cannot be undone."
        onConfirm={async () => {
          if (confirmDelete.id) await deleteVariant.mutateAsync(confirmDelete.id);
          setConfirmDelete({ open: false, id: null });
        }}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}

export default function AdminProducts() {
  const { data: products, isLoading, isError, refetch } = useAdminProducts();
  const { data: categories } = useAdminCategories();
  const deleteProduct = useDeleteProduct();

  const [productModalOpen, setProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [drawerProduct, setDrawerProduct] = useState<Product | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });

  if (isError) return <QueryError message="Unable to load products." onRetry={refetch} />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditingProduct(null); setProductModalOpen(true); }} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="mr-2 h-4 w-4" /> Add Product
        </Button>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 sm:p-6">
          <ResponsiveTable
            headers={['Name', 'Category', 'Compute Type', 'Variants', 'Regions', 'AZs', 'Active']}
            isLoading={isLoading}
            emptyMessage="No products"
          >
            {products?.map((product) => (
              <tr
                key={product.id}
                className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                onClick={() => setDrawerProduct(product)}
              >
                <td className="py-3 font-medium text-white">{product.name}</td>
                <td className="py-3 text-slate-400">{product.category?.name}</td>
                <td className="py-3">
                  {product.computeType ? (
                    <Badge variant="outline" className="border-blue-500/20 text-blue-400">
                      {product.computeType}
                    </Badge>
                  ) : (
                    <span className="text-slate-500">—</span>
                  )}
                </td>
                <td className="py-3 text-slate-400">
                  {(product as any)._count?.variants ?? product.variants?.length ?? 0}
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.regions?.map((r) => (
                      <span key={r.regionId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">{r.region?.name}</span>
                    ))}
                  </div>
                </td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-1">
                    {product.availabilityZones?.map((az) => (
                      <span key={az.availabilityZoneId} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-slate-500 border border-slate-800">{az.availabilityZone?.name}</span>
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
                    <Button size="sm" variant="ghost" onClick={() => { setEditingProduct(product); setProductModalOpen(true); }} className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ open: true, id: product.id })} className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </ResponsiveTable>
        </CardContent>
      </Card>

      <ProductModal key={editingProduct?.id ?? 'new'} open={productModalOpen} onClose={() => setProductModalOpen(false)} editing={editingProduct} categories={categories || []} />

      {drawerProduct && <ProductDrawer product={drawerProduct} onClose={() => setDrawerProduct(null)} />}

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ open, id: null })}
        title="Delete Product"
        description="Are you sure you want to delete this product? This action cannot be undone."
        onConfirm={async () => {
          if (confirmDelete.id) await deleteProduct.mutateAsync(confirmDelete.id);
          setConfirmDelete({ open: false, id: null });
        }}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </div>
  );
}
