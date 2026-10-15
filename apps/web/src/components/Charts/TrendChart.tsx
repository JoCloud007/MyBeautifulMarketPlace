import { useMemo, useState } from 'react';
import { useForecastTrends } from '@/hooks/useApi';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import QueryError from '@/components/QueryError';

interface TrendChartProps {
  days?: number;
  onDaysChange?: (days: number) => void;
}

type SeriesKey = 'created' | 'submitted' | 'approved' | 'rejected';

interface SeriesDef {
  key: SeriesKey;
  label: string;
  color: string;
  stroke: number;
  dashed?: boolean;
}

const SERIES: SeriesDef[] = [
  { key: 'created', label: 'Created', color: '#38bdf8', stroke: 2.5 },
  { key: 'submitted', label: 'Submitted', color: '#fbbf24', stroke: 2 },
  { key: 'approved', label: 'Approved', color: '#34d399', stroke: 2.5 },
  { key: 'rejected', label: 'Rejected', color: '#f87171', stroke: 2, dashed: true },
];

const RANGE_OPTIONS = [7, 30, 90, 365];
const rangeLabel = (d: number) => (d === 365 ? 'YTD' : `${d}d`);

interface TooltipDatum {
  date: string;
  created: number;
  submitted: number;
  approved: number;
  rejected: number;
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: { payload: TooltipDatum }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  const date = new Date(d.date + 'T00:00:00');
  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-semibold text-slate-100">
        {date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
      </p>
      {SERIES.map((s) => (
        <p key={s.key} className="flex items-center gap-2 text-slate-300">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
          {s.label}
          <span className="ml-auto pl-3 font-mono text-slate-100">{d[s.key]}</span>
        </p>
      ))}
    </div>
  );
}

export default function TrendChart({ days = 30, onDaysChange }: TrendChartProps) {
  const { data, isLoading, error, refetch } = useForecastTrends(days);
  const [visible, setVisible] = useState<Record<SeriesKey, boolean>>({
    created: true,
    submitted: true,
    approved: true,
    rejected: true,
  });

  const summary = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totals = data.reduce(
      (acc, d) => ({
        created: acc.created + d.created,
        approved: acc.approved + d.approved,
        rejected: acc.rejected + d.rejected,
      }),
      { created: 0, approved: 0, rejected: 0 }
    );
    const decided = totals.approved + totals.rejected;
    const peak = data.reduce((best, d) => (d.created > best.created ? d : best), data[0]);
    return {
      avgPerDay: (totals.created / data.length).toFixed(1),
      approvalRate: decided > 0 ? Math.round((totals.approved / decided) * 100) : null,
      peakDay: peak.created > 0 ? peak : null,
    };
  }, [data]);

  if (isLoading) return <Skeleton className="h-80 w-full rounded-lg" />;
  if (error) return <QueryError message="Unable to load trend data" onRetry={refetch} />;
  if (!data || data.length === 0) return <div className="text-slate-400 text-center py-12">No trend data available</div>;

  return (
    <div className="space-y-3">
      {/* Range selector */}
      {onDaysChange && (
        <div className="flex overflow-hidden rounded-lg border border-slate-700" style={{ width: 'fit-content' }}>
          {RANGE_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => onDaysChange(d)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                days === d
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-950 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              {rangeLabel(d)}
            </button>
          ))}
        </div>
      )}

      {/* Series toggles */}
      <div className="flex flex-wrap items-center gap-3 text-xs">
        {SERIES.map((s) => (
          <button
            key={s.key}
            onClick={() => setVisible((v) => ({ ...v, [s.key]: !v[s.key] }))}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1 transition-opacity ${
              visible[s.key] ? 'opacity-100' : 'opacity-40 hover:opacity-70'
            }`}
            style={{ color: s.color }}
          >
            <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} />
            {s.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="h-80 rounded-lg border border-slate-800 bg-slate-950/50 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
            <defs>
              {SERIES.map((s) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              stroke="#64748b"
              tick={{ fontSize: 10 }}
              /* Show every date of the period; thin out only for long
                 ranges so labels remain readable, with tilted ticks. */
              interval={days > 30 ? Math.ceil(data.length / 30) - 1 : 0}
              angle={days > 30 ? -40 : 0}
              textAnchor={days > 30 ? 'end' : 'middle'}
              height={days > 30 ? 52 : 30}
              tickFormatter={(val: string) =>
                new Date(val + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
              }
              tickLine={false}
              axisLine={{ stroke: '#334155' }}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              width={32}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#475569', strokeDasharray: '3 3' }} />
            {SERIES.filter((s) => visible[s.key]).map((s) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={s.stroke}
                strokeDasharray={s.dashed ? '4 4' : undefined}
                fill={`url(#grad-${s.key})`}
                dot={data.length <= 31 ? { r: 2.5, strokeWidth: 0, fill: s.color } : false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#0f172a' }}
                animationDuration={400}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Summary strip */}
      {summary && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Avg / day</div>
            <div className="text-lg font-bold text-sky-400">{summary.avgPerDay}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Approval rate</div>
            <div className="text-lg font-bold text-emerald-400">
              {summary.approvalRate != null ? `${summary.approvalRate}%` : '—'}
            </div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-4 py-3">
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Peak day</div>
            <div className="text-lg font-bold text-slate-200">
              {summary.peakDay
                ? new Date(summary.peakDay.date + 'T00:00:00').toLocaleDateString('en-US', { day: 'numeric', month: 'short' })
                : '—'}
              {summary.peakDay && (
                <span className="ml-2 text-xs font-medium text-slate-500">{summary.peakDay.created} requests</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
