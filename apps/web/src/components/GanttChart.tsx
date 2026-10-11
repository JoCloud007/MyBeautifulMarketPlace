import * as React from 'react';
import { cn } from '@/lib/utils';

export interface GanttBarData {
  id: string;
  label: string;
  sublabel?: string;
  badge?: { label: string; className?: string };
  start: Date;
  end: Date;
  /** Optional segment boundaries inside the bar (e.g. support phases) */
  segments?: { end: Date; className: string; label: string }[];
  barClass?: string;
  /** Optional expandable detail rendered under this bar's row (collapsed by default) */
  detail?: React.ReactNode;
}

interface GanttChartProps {
  bars: GanttBarData[];
  /** Month marks are computed automatically from the bars' range */
  today?: boolean;
  className?: string;
  /** Optional shared scale: fix the chart's time window so several charts align.
   *  When omitted, the range is derived from the bars themselves (previous behaviour). */
  minDate?: Date;
  maxDate?: Date;
}

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthDiff(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function addMonths(d: Date, n: number) {
  const out = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return out;
}

function niceLabel(d: Date) {
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * Lightweight horizontal Gantt: one row per bar, shared time axis on top,
 * "today" marker, optional multi-phase segments per bar.
 */
export default function GanttChart({ bars, today = true, className, minDate, maxDate }: GanttChartProps) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);
  const { min, max, ticks } = React.useMemo(() => {
    if (bars.length === 0) return { min: new Date(), max: new Date(), ticks: [] as Date[] };
    const starts = bars.map((b) => b.start.getTime());
    const ends = bars.map((b) => b.end.getTime());
    // Round to month boundaries (shared min/max take precedence when provided)
    const earliest = new Date(Math.min(...starts, minDate?.getTime() ?? Infinity));
    const minRounded = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
    const latest = new Date(Math.max(...ends, maxDate?.getTime() ?? -Infinity));
    const maxRounded = new Date(latest.getFullYear(), latest.getMonth() + 1, 0);
    // monthDiff(min, max) counts full months between month starts; maxRounded is the
    // last DAY of the final month, so the covered span is totalMonths + 1 month cells.
    const totalMonths = Math.max(1, monthDiff(minRounded, maxRounded) + 1);
    // ~8 ticks max
    const step = Math.max(1, Math.ceil(totalMonths / 8));
    const t: Date[] = [];
    for (let m = 0; m <= totalMonths; m += step) t.push(addMonths(minRounded, m));
    return { min: minRounded, max: maxRounded, ticks: t };
  }, [bars, minDate, maxDate]);

  const totalMs = Math.max(1, max.getTime() - min.getTime());

  const pct = (d: Date) => {
    const clamped = Math.min(Math.max(d.getTime(), min.getTime()), max.getTime());
    return ((clamped - min.getTime()) / totalMs) * 100;
  };

  const now = new Date();
  const todayPct = pct(now);
  const showToday = today && todayPct > 0 && todayPct < 100;

  if (bars.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950 py-10 text-center text-sm text-slate-500">
        No timeline data to display.
      </div>
    );
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <div className="min-w-[640px]">
        {/* Time axis */}
        <div className="relative ml-0 flex border-b border-slate-800 pb-1 text-[10px] text-slate-500">
          <div className="w-60 shrink-0" />
          <div className="relative flex-1">
            {ticks.map((t, i) => (
              <span
                key={i}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap"
                style={{ left: `${pct(t)}%` }}
              >
                {niceLabel(t)}
              </span>
            ))}
          </div>
        </div>

        {/* Rows */}
        <div className="relative">
          {showToday && (
            <div
              className="pointer-events-none absolute bottom-0 top-0 z-10 w-px bg-rose-400/60"
              style={{ left: `calc(15rem + ${todayPct} * (100% - 15rem) / 100)` }}
            >
              <span className="absolute -top-0.5 left-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-rose-400" />
            </div>
          )}
          {bars.map((bar) => {
            const left = pct(bar.start);
            const right = pct(bar.end);
            const width = Math.max(1, right - left);
            const expandable = Boolean(bar.detail);
            const expanded = expandable && expandedId === bar.id;
            return (
              <div key={bar.id}>
              <div
                role={expandable ? 'button' : undefined}
                tabIndex={expandable ? 0 : undefined}
                onClick={expandable ? () => setExpandedId(expanded ? null : bar.id) : undefined}
                onKeyDown={expandable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedId(expanded ? null : bar.id); } } : undefined}
                className={cn(
                  'flex items-center border-b border-slate-800/60 py-1.5 last:border-b-0',
                  expandable && 'cursor-pointer transition-colors hover:bg-slate-800/40'
                )}
              >
                {/* Label column */}
                <div className="w-60 shrink-0 pr-3">
                  <div className="flex items-center min-w-0">
                    <span className="truncate text-xs font-medium text-slate-200" title={bar.label}>{bar.label}</span>
                  </div>
                  {bar.sublabel && (
                    <p className="truncate text-[10px] text-slate-500" title={bar.sublabel}>{bar.sublabel}</p>
                  )}
                  {bar.badge && (
                    <div className="mt-0.5 flex items-center">
                      <span className={cn('shrink-0 rounded-full border px-1.5 py-0 text-[9px] leading-4', bar.badge.className)}>
                        {bar.badge.label}
                      </span>
                    </div>
                  )}
                </div>
                  {/* Bar track */}
                  <div className="relative h-5 flex-1">
                    <div
                      className={cn('absolute top-0.5 h-4 rounded-sm', bar.barClass || 'bg-blue-500/80')}
                      style={{ left: `${left}%`, width: `${width}%` }}
                      title={`${niceLabel(bar.start)} → ${niceLabel(bar.end)}`}
                    >
                      {bar.segments && bar.segments.length > 0 && (
                        <div className="flex h-full w-full overflow-hidden rounded-sm">
                          {bar.segments.map((seg, i) => {
                            const prevEnd = i === 0 ? bar.start : bar.segments![i - 1].end;
                            const rel = bar.end.getTime() - bar.start.getTime();
                            const wPct = rel > 0 ? ((seg.end.getTime() - prevEnd.getTime()) / rel) * 100 : 0;
                            return (
                              <div
                                key={i}
                                className={cn('h-full', seg.className)}
                                style={{ width: `${wPct}%` }}
                                title={`${seg.label}: ${niceLabel(prevEnd)} → ${niceLabel(seg.end)}`}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
              </div>
              {/* Expandable detail — rendered under this row's bar, inside the row */}
              {expanded && bar.detail && (
                <div className="border-b border-slate-800/60 bg-slate-900/40 px-4 py-3">
                  {bar.detail}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
