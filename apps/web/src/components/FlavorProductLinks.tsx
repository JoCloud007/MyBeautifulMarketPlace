import { useState } from 'react';
import {
  useProducts,
  useCreateProductVariant,
  useDeleteProductVariant,
} from '@/hooks/useApi';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, X } from 'lucide-react';
import type { Flavor, Product, ProductVariant } from '@cloudmarket/shared-types';

/**
 * Attach a flavor to products: a flavor is bound to a product through a
 * ProductVariant. This section lists the current links (one per variant)
 * and lets the user attach to another product or detach — the flavor-side
 * end of the Product detail "Add Variant" flow.
 *
 * The create/delete variant hooks already invalidate ['products'], which is
 * the list this component reads — attach/detach appear immediately.
 */
export default function FlavorProductLinks({ flavor }: { flavor: Flavor }) {
  const { data: products, isLoading } = useProducts();
  const [selected, setSelected] = useState('');
  const createVariant = useCreateProductVariant();
  const deleteVariant = useDeleteProductVariant();

  if (!flavor.id) return null;

  const linked: { product: Product; variant: ProductVariant }[] = (products ?? [])
    .flatMap((p: Product) => (p.variants ?? []).map((v: ProductVariant) => ({ product: p, variant: v })))
    .filter((x: { product: Product; variant: ProductVariant }) => x.variant.flavorId === flavor.id);

  const attach = async () => {
    if (!selected) return;
    const productName = products?.find((p: Product) => p.id === selected)?.name ?? 'product';
    await createVariant.mutateAsync({
      productId: selected,
      name: `${flavor.name} on ${productName}`,
      flavorId: flavor.id,
      availabilityType: 'STANDARD',
    } as any);
    setSelected('');
  };

  const detach = async (variantId: string) => {
    await deleteVariant.mutateAsync(variantId);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">Products using this flavor</label>
      <p className="text-xs text-slate-500">
        A flavor is attached to a product through a variant — detach here or manage variants in the product page.
      </p>
      {isLoading ? (
        <Skeleton className="h-10 rounded-md bg-slate-800" />
      ) : linked.length > 0 ? (
        <div className="space-y-2">
          {linked.map(({ product, variant }) => (
            <div key={variant.id} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
              <div>
                <p className="text-sm text-white">{product.name}</p>
                <p className="text-xs text-slate-500">{variant.name}</p>
              </div>
              <Button type="button" size="sm" variant="ghost" onClick={() => detach(variant.id)} className="h-8 px-2 text-slate-400 hover:text-red-400">
                <X className="h-3.5 w-3.5 mr-1" /> Detach
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500">Not attached to any product yet.</p>
      )}
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 h-10 min-h-[44px] rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white"
        >
          <option value="">Select product to attach...</option>
          {(products ?? [])
            .filter((p: Product) => !linked.some((l: { product: Product }) => l.product.id === p.id))
            .map((p: Product) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
        <Button type="button" size="sm" onClick={attach} disabled={!selected || createVariant.isPending} className="bg-blue-600 hover:bg-blue-700 text-white min-h-[44px]">
          <Plus className="h-4 w-4 mr-1" /> Attach
        </Button>
      </div>
    </div>
  );
}
