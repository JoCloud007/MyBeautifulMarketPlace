import { Card, CardContent, CardTitle } from '@/components/ui/card';
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

  const isFlavor = profile.targetType === 'FLAVOR';

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4 space-y-3">
        {/* Compact header: title + score on one line, gauge directly under */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800">
              <span className="text-sm">📊</span>
            </div>
            <div className="min-w-0">
              <CardTitle className="truncate text-sm text-white">{profile.name || 'Performance Score'}</CardTitle>
              <p className="truncate text-[11px] text-slate-500">
                {isFlavor ? 'Flavor benchmark — compared within its product family' : 'Compared to all flavors in this product family'}
              </p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className={`text-xl font-extrabold leading-none ${theme.text}`}>
              {score}<span className="text-xs font-medium text-slate-500">/100</span>
            </div>
            <div className={`mt-0.5 text-[10px] font-semibold ${theme.text}`}>★ {profile.scoreLabel?.toUpperCase() || 'N/A'}</div>
          </div>
        </div>

        {/* Gauge Bar — thinner, no scale legend */}
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="absolute left-0 top-0 h-full w-1/3 bg-red-500/10" />
          <div className="absolute left-1/3 top-0 h-full w-1/3 bg-amber-500/10" />
          <div className="absolute left-2/3 top-0 h-full w-1/3 bg-emerald-500/10" />
          <div
            className={`relative h-full rounded-full ${theme.bar} transition-all duration-1000 ease-out`}
            style={{ width: `${score}%` }}
          >
            <div className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-white shadow-md" />
          </div>
        </div>

        {/* Metrics — single compact row */}
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((metric) => (
            <div key={metric.id} className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
              <div className="truncate text-[10px] text-slate-500">{metric.name}</div>
              <div className="mt-0.5 text-sm font-bold text-white">
                {String(metric.value)}
                {metric.unit && <span className="ml-1 text-[10px] font-normal text-slate-400">{metric.unit}</span>}
              </div>
              <div className={`truncate text-[10px] font-medium ${metric.comparison?.startsWith('↑') ? 'text-emerald-400' : metric.comparison?.startsWith('↓') ? 'text-red-400' : 'text-amber-400'}`}>
                {metric.comparison || '—'}
              </div>
            </div>
          ))}
          {metrics.length === 0 && (
            <div className="col-span-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-center text-xs text-slate-500">
              No metrics defined for this profile.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
