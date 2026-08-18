import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Check } from 'lucide-react';

interface MultiPickupInputProps {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  options: { id: string; label: string }[];
  placeholder?: string;
}

export function MultiPickupInput({
  label,
  values,
  onChange,
  options,
  placeholder,
}: MultiPickupInputProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOptions = options.filter((o) => values.includes(o.id));
  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function toggleOption(id: string) {
    if (values.includes(id)) {
      onChange(values.filter((v) => v !== id));
    } else {
      onChange([...values, id]);
    }
  }

  function removeValue(id: string) {
    onChange(values.filter((v) => v !== id));
  }

  return (
    <div className="flex-1" ref={containerRef}>
      <label className="text-xs text-slate-500 mb-1 block">{label}</label>
      <div className="relative">
        {/* Selected badges */}
        {selectedOptions.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {selectedOptions.map((opt) => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1 rounded-md bg-blue-900/40 text-blue-200 text-xs px-2 py-1 border border-blue-800"
              >
                {opt.label}
                <button
                  onClick={() => removeValue(opt.id)}
                  className="text-blue-300 hover:text-white"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder={placeholder || `Search ${label.toLowerCase()}...`}
            className="w-full rounded-md border border-slate-700 bg-slate-950 pl-9 pr-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500 min-h-[40px]"
          />
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        </div>
        {/* Dropdown */}
        {open && (
          <div className="absolute z-10 mt-1 w-full max-h-48 overflow-auto rounded-md border border-slate-700 bg-slate-900 shadow-lg">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                {options.length === 0 ? 'No options available' : 'No results'}
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => { toggleOption(opt.id); setQuery(''); }}
                  className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                  type="button"
                >
                  <div className={`h-4 w-4 rounded border flex items-center justify-center ${values.includes(opt.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                    {values.includes(opt.id) && <Check className="h-3 w-3 text-white" />}
                  </div>
                  {opt.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
