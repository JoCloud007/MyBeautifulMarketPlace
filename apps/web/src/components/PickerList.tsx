import { useMemo, useState } from 'react';
import { Search, Check } from 'lucide-react';

export interface PickerItem {
  id: string;
  /** Main label */
  name: string;
  /** Secondary line */
  description?: string | null;
  /** Right-aligned meta chip (e.g. "8 vCPU · 32 GB") */
  meta?: string | null;
}

/**
 * Pickup list: searchable, scrollable panel of clickable cards.
 * Replaces native <select> in the forecast form for richer choices.
 * Multi mode: checkboxes + Select all — onChange receives the whole set.
 */
export default function PickerList({
  items,
  value = null,
  onChange,
  multi = false,
  selectedIds,
  onMultiChange,
  placeholder = 'Search…',
  emptyLabel = 'No options',
  maxHeight = '14rem',
}: {
  items: PickerItem[];
  value?: string | null;
  /** Single-select callback (required unless multi is used). */
  onChange?: (id: string) => void;
  multi?: boolean;
  selectedIds?: Set<string>;
  onMultiChange?: (ids: Set<string>) => void;
  placeholder?: string;
  emptyLabel?: string;
  maxHeight?: string;
}) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || (i.description ?? '').toLowerCase().includes(q)
    );
  }, [items, query]);

  const visibleIds = filtered.map((i) => i.id);
  const allVisibleSelected = multi && visibleIds.length > 0 && visibleIds.every((id) => selectedIds?.has(id));

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950">
      <div className="relative border-b border-slate-800">
        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2 pl-9 pr-3 text-sm text-white placeholder:text-slate-600 focus:outline-none"
        />
        {multi && visibleIds.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (!selectedIds) return;
              const next = new Set(selectedIds);
              if (allVisibleSelected) visibleIds.forEach((id) => next.delete(id));
              else visibleIds.forEach((id) => next.add(id));
              // Route through single-select onChange per id is awkward; multi
              // callers observe selectedIds — emit a synthetic event instead.
              onMultiChange?.(next);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-1.5 py-0.5 text-[10px] font-medium text-blue-400 hover:bg-slate-800"
          >
            {allVisibleSelected ? 'Clear' : 'All'}
          </button>
        )}
      </div>
      <div className="overflow-y-auto p-1.5" style={{ maxHeight }}>
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-600">{emptyLabel}</p>
        ) : (
          filtered.map((item) => {
            const selected = multi ? !!selectedIds?.has(item.id) : item.id === value;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (multi && selectedIds && onMultiChange) {
                    const next = new Set(selectedIds);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    onMultiChange(next);
                  } else {
                    onChange?.(item.id);
                  }
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors ${
                  selected
                    ? 'bg-blue-500/15 border border-blue-500/40'
                    : 'border border-transparent hover:bg-slate-900'
                }`}
              >
                {multi && (
                  <input
                    type="checkbox"
                    checked={selected}
                    tabIndex={-1}
                    readOnly
                    className="h-3.5 w-3.5 shrink-0 rounded border-slate-600 bg-slate-950"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${selected ? 'text-blue-300' : 'text-slate-200'}`}>
                    {item.name}
                  </div>
                  {item.description && (
                    <div className="truncate text-xs text-slate-500">{item.description}</div>
                  )}
                </div>
                {item.meta && (
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                    {item.meta}
                  </span>
                )}
                {!multi && selected && <Check className="h-4 w-4 shrink-0 text-blue-400" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
