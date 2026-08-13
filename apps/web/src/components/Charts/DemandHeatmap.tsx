import { useDemandHeatmap } from '@/hooks/useApi';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';

function getHeatColor(value: number, max: number): string {
  const intensity = max > 0 ? value / max : 0;
  if (intensity < 0.2) return 'bg-slate-800';
  if (intensity < 0.4) return 'bg-cyan-900';
  if (intensity < 0.6) return 'bg-cyan-800';
  if (intensity < 0.8) return 'bg-cyan-700';
  return 'bg-cyan-600';
}

export default function DemandHeatmap() {
  const { data, isLoading, error, refetch } = useDemandHeatmap();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) return <QueryError message="Unable to load demand data" onRetry={refetch} />;
  if (!data || data.length === 0) return <div className="text-slate-400 text-center py-12">No demand data available</div>;

  const products = Array.from(new Set(data.map((d) => d.productName))).sort();
  const zones = Array.from(new Set(data.map((d) => d.azCode))).sort();
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const matrix = products.map((product) =>
    zones.map((zone) => {
      const entry = data.find((d) => d.productName === product && d.azCode === zone);
      return entry?.count ?? 0;
    })
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <th className="text-left text-slate-400 font-medium p-2">Product</th>
            {zones.map((zone) => (
              <th key={zone} className="text-center text-slate-400 font-medium p-2 text-xs">{zone}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((product, pi) => (
            <tr key={product}>
              <td className="text-slate-300 p-2 font-medium whitespace-nowrap">{product}</td>
              {zones.map((zone, zi) => {
                const count = matrix[pi][zi];
                return (
                  <td key={zone} className="p-1">
                    <div
                      className={`w-10 h-10 mx-auto rounded flex items-center justify-center text-xs font-medium ${getHeatColor(count, maxCount)} ${count > 0 ? 'text-white' : 'text-slate-600'}`}
                      title={`${product} @ ${zone}: ${count}`}
                    >
                      {count > 0 ? count : '-'}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
