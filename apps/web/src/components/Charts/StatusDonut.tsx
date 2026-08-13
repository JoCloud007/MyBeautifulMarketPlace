import { useForecastStats } from '@/hooks/useApi';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';

const COLORS = {
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  total: '#64748b',
};

export default function StatusDonut() {
  const { data, isLoading, error, refetch } = useForecastStats();

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) return <QueryError message="Unable to load status data" onRetry={refetch} />;
  if (!data) return <div className="text-slate-400 text-center py-12">No status data available</div>;

  const chartData = [
    { name: 'Pending', value: data.pending, color: COLORS.pending },
    { name: 'Approved', value: data.approved, color: COLORS.approved },
    { name: 'Rejected', value: data.rejected, color: COLORS.rejected },
  ].filter((d) => d.value > 0);

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={4}
            dataKey="value"
            label={({ name, percent }: { name?: string; percent?: number }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
