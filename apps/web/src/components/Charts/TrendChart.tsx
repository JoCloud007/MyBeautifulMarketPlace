import { useForecastTrends } from '@/hooks/useApi';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';

interface TrendChartProps {
  days?: number;
}

export default function TrendChart({ days = 30 }: TrendChartProps) {
  const { data, isLoading, error, refetch } = useForecastTrends(days);

  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (error) return <QueryError message="Unable to load trend data" onRetry={refetch} />;
  if (!data || data.length === 0) return <div className="text-slate-400 text-center py-12">No trend data available</div>;

  return (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey="date" stroke="#94a3b8" tickFormatter={(val) => new Date(val).toLocaleDateString()} />
          <YAxis stroke="#94a3b8" allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #334155', borderRadius: '8px' }}
            labelFormatter={(val) => new Date(String(val)).toLocaleDateString()}
          />
          <Legend />
          <Line type="monotone" dataKey="created" name="Created" stroke="#38bdf8" strokeWidth={2} dot={{ r: 3 }} />
          <Line type="monotone" dataKey="approved" name="Approved" stroke="#34d399" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
