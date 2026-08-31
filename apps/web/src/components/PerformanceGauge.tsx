import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { PerformanceProfile } from '@cloudmarket/shared-types';

interface PerformanceGaugeProps {
  profile: PerformanceProfile;
}

const colorMap: Record<string, { bar: string; bg: string; text: string; border: string }> = {
  green: {
    bar: 'bg-emerald-500',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-500',
    border: 'border-emerald-500/20',
  },
  yellow: {
    bar: 'bg-amber-500',
    bg: 'bg-amber-500/10',
    text: 'text-amber-500',
    border: 'border-amber-500/20',
  },
  red: {
    bar: 'bg-red-500',
    bg: 'bg-red-500/10',
    text: 'text-red-500',
    border: 'border-red-500/20',
  },
  blue: {
    bar: 'bg-blue-500',
    bg: 'bg-blue-500/10',
    text: 'text-blue-500',
    border: 'border-blue-500/20',
  },
};

export default function PerformanceGauge({ profile }: PerformanceGaugeProps) {
  const theme = colorMap[profile.colorTheme] || colorMap.blue;
  const score = Math.max(0, Math.min(100, profile.overallScore));

  const metrics = [...profile.metrics].sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800">
              <span className="text-lg">📊</span>
            </div>
            <div>
              <CardTitle className="text-base text-white">Performance Score</CardTitle>
              <p className="text-xs text-slate-500">Compared to all flavors in this product family</p>
            </div>
          </div>
          <div className="text-right">
            <div className={`text-3xl font-extrabold ${theme.text}`}>
              {score}<span className="text-sm font-medium text-slate-500">/100</span>
            </div>
            <div className={`text-xs font-semibold ${theme.text}`}>★ {profile.scoreLabel.toUpperCase()}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Gauge Bar */}
        <div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800 relative">
            <div className="absolute left-0 top-0 h-full w-1/3 bg-red-500/10" />
            <div className="absolute left-1/3 top-0 h-full w-1/3 bg-amber-500/10" />
            <div className="absolute left-2/3 top-0 h-full w-1/3 bg-emerald-500/10" />
            <div
              className={`h-full rounded-full ${theme.bar} relative transition-all duration-1000 ease-out`}
              style={{ width: `${score}%` }}
            >
              <div className="absolute right-0 top-1/2 h-4 w-4 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-md" style={{ boxShadow: `0 0 0 3px var(--tw-bg-opacity, 1) currentColor` }} />
            </div>
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-slate-500">
            <span>0 — Low</span>
            <span>50 — Average</span>
            <span>100 — Top Tier</span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-lg border border-slate-800 bg-slate-950 p-4">
              <div className="text-[11px] text-slate-500">{metric.name}</div>
              <div className="mt-1 text-lg font-bold text-white">
                {metric.value}
                {metric.unit && <span className="ml-1 text-xs font-normal text-slate-400">{metric.unit}</span>}
              </div>
              <div className={`mt-1 text-[11px] font-medium ${metric.comparison.startsWith('↑') ? 'text-emerald-400' : metric.comparison.startsWith('↓') ? 'text-red-400' : 'text-amber-400'}`}>
                {metric.comparison}
              </div>
            </div>
          ))}
          {metrics.length === 0 && (
            <div className="col-span-full rounded-lg border border-slate-800 bg-slate-950 p-4 text-center text-sm text-slate-500">
              No metrics defined for this profile.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
