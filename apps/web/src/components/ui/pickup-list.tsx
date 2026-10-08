import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface PickupOption {
  value: string;
  label: string;
  dotColor?: string;
}

/* Product status options with legend colors — shared across admin forms */
export const productStatusPicklist: PickupOption[] = [
  { value: 'BACKLOG', label: 'Backlog', dotColor: 'bg-slate-500' },
  { value: 'OPPORTUNITY', label: 'Opportunity / Study / PoC / MVP', dotColor: 'bg-purple-500' },
  { value: 'AVAILABLE', label: 'Available', dotColor: 'bg-emerald-500' },
  { value: 'AVAILABLE_PILOT_PENDING', label: 'Available (waiting for pilot client)', dotColor: 'bg-yellow-400' },
  { value: 'DELAY_PENDING', label: 'Delay / Pending', dotColor: 'bg-orange-500' },
  { value: 'CANCELLED', label: 'Cancelled / Confined / Closed', dotColor: 'bg-red-500' },
];

interface PickupListProps {
  options: PickupOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/* Single-select dropdown picklist with optional colored dots */
export function PickupList({ options, value, onChange, placeholder = 'Select...' }: PickupListProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selected = options.find((o) => o.value === value);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 min-h-[44px] text-sm text-white hover:border-slate-500 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {selected?.dotColor && <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${selected.dotColor}`} />}
          <span className="truncate">{selected?.label || placeholder}</span>
        </span>
        <ChevronDown className={`h-4 w-4 text-slate-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[200px] rounded-lg border border-slate-700 bg-slate-900 shadow-[0_8px_30px_rgb(0,0,0,0.5)] py-1 max-h-72 overflow-y-auto">
          {options.map((opt) => (
            <button
              type="button"
              key={opt.value}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                opt.value === value ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {opt.dotColor && <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${opt.dotColor}`} />}
              <span className="truncate">{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
