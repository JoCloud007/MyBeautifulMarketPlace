import { ChevronRight } from 'lucide-react';

interface GeoBreadcrumbProps {
  steps: { type: string; label: string }[];
  activeStep: number;
  selections: Record<string, string>;
  onStepClick?: (stepIndex: number) => void;
}

export default function GeoBreadcrumb({ steps, activeStep, selections, onStepClick }: GeoBreadcrumbProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {steps.map((step, index) => {
        const isActive = index === activeStep;
        const isPast = index < activeStep;
        const selectedValue = selections[step.type];
        const clickable = isPast && onStepClick;

        return (
          <div key={step.type} className="flex items-center gap-2">
            {index > 0 && <ChevronRight className="h-4 w-4 text-slate-600" />}
            <button
              onClick={() => clickable && onStepClick?.(index)}
              disabled={!clickable}
              className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
                  : isPast
                    ? 'border-slate-700 bg-slate-800/50 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-800 bg-slate-900/50 text-slate-600'
              } ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {isPast && selectedValue ? (
                <span>{selectedValue}</span>
              ) : (
                <span>{step.label}</span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
