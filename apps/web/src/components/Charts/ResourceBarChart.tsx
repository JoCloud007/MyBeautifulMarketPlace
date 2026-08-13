import { useResourcesByZone } from '@/hooks/useApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';

export default function ResourceBarChart() {
  const { data, isLoading, error, refetch } = useResourcesByZone();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) return <QueryError message="Unable to load resource data" onRetry={refetch} />;
  if (!data || data.length === 0) return <div className="text-slate-400 text-center py-12">No resource data available</div>;

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="azCode" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
          />
          <Legend />
          <Bar dataKey="vcpu" name="vCPU" fill="#38bdf8" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ramGb" name="RAM (GB)" fill="#a78bfa" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
