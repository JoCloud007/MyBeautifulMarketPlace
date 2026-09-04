import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationOrders, useBrowsePresentation, usePerformanceProfiles } from '@/hooks/useApi';
import { useAppStore } from '@/stores/useAppStore';
import QueryError from '@/components/QueryError';
import PerformanceGauge from '@/components/PerformanceGauge';
import GeoBreadcrumb from '@/components/GeoBreadcrumb';
import PresentationModeToggle from '@/components/PresentationModeToggle';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Server, MapPin, Globe, Cpu, Shield, Monitor } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getCountryFlag, getFlagEmoji } from '@/lib/countryFlags';

const stepIcons: Record<string, React.ElementType> = {
  COUNTRY: Globe,
  ZONE: MapPin,
  PRODUCT: Server,
  FLAVOR: Cpu,
  CONTINUITY: Shield,
  OS: Monitor,
};

interface StepData {
  id: string;
  name: string;
  description?: string;
  meta?: Record<string, any>;
}

export default function MarketplaceGeo() {
  const navigate = useNavigate();
  const { geoOrderId, setGeoOrderId } = useAppStore();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [selectionNames, setSelectionNames] = useState<Record<string, string>>({});
  const [currentStep, setCurrentStep] = useState(0);

  const { data: orders, isLoading: ordersLoading, isError: ordersError, refetch: refetchOrders } = usePresentationOrders();

  const activeOrder = useMemo(() => {
    if (!orders) return null;
    if (geoOrderId) return orders.find((o) => o.id === geoOrderId && o.isActive) || null;
    return orders.find((o) => o.isDefault && o.isActive) || orders.find((o) => o.isActive) || null;
  }, [orders, geoOrderId]);

  const steps = activeOrder?.steps || [];
  const stepType = steps[currentStep]?.stepType;

  const browseParams = useMemo(() => {
    const params: Record<string, string> = {};
    steps.slice(0, currentStep).forEach((s) => {
      if (selections[s.stepType]) {
        params[s.stepType.toLowerCase()] = selections[s.stepType];
      }
    });
    return params;
  }, [steps, currentStep, selections]);

  const { data: stepData, isLoading: stepLoading, isError: stepError, refetch: refetchStep } = useBrowsePresentation(
    activeOrder?.id || '',
    stepType || '',
    browseParams
  );

  const productId = selections['PRODUCT'];
  const { data: perfProfiles } = usePerformanceProfiles('PRODUCT', productId);
  const perfProfile = perfProfiles?.[0];

  const handleSelect = (item: StepData) => {
    const newSelections = { ...selections, [stepType]: item.id };
    const newNames = { ...selectionNames, [stepType]: item.name };
    setSelections(newSelections);
    setSelectionNames(newNames);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBreadcrumbClick = (stepIndex: number) => {
    const newSelections: Record<string, string> = {};
    const newNames: Record<string, string> = {};
    steps.slice(0, stepIndex).forEach((s) => {
      if (selections[s.stepType]) {
        newSelections[s.stepType] = selections[s.stepType];
        newNames[s.stepType] = selectionNames[s.stepType];
      }
    });
    setSelections(newSelections);
    setSelectionNames(newNames);
    setCurrentStep(stepIndex);
  };

  const handleOrderChange = (orderId: string) => {
    setGeoOrderId(orderId);
    setSelections({});
    setSelectionNames({});
    setCurrentStep(0);
  };

  if (ordersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg bg-slate-800" />
          ))}
        </div>
      </div>
    );
  }

  if (ordersError) {
    return <QueryError message="Unable to load presentation modes." onRetry={refetchOrders} />;
  }

  if (!activeOrder) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-slate-400">No active presentation order configured.</p>
        <button onClick={() => navigate('/marketplace')} className="mt-4 text-blue-400 hover:underline">
          Go to standard marketplace
        </button>
      </div>
    );
  }

  const isLastStep = currentStep === steps.length - 1;
  const items: StepData[] = Array.isArray(stepData) ? stepData : stepData?.items || [];

  const renderItems = () => {
    if (stepLoading) {
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg bg-slate-800" />
          ))}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <p className="text-lg font-medium text-slate-300">No items found</p>
          <p className="mt-1 text-slate-500">Nothing matches your current selections.</p>
        </div>
      );
    }
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item, index) => {
          const Icon = stepIcons[stepType] || Server;
          const continuityColor = stepType === 'CONTINUITY' && item.meta?.color ? String(item.meta.color) : null;
          const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
            red: { border: 'border-l-red-500', bg: 'bg-red-500/10 group-hover:bg-red-500/20', text: 'text-red-500' },
            green: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10 group-hover:bg-emerald-500/20', text: 'text-emerald-500' },
            yellow: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/10 group-hover:bg-yellow-500/20', text: 'text-yellow-500' },
            orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/10 group-hover:bg-orange-500/20', text: 'text-orange-500' },
          };
          const cs = continuityColor ? colorStyles[continuityColor] : null;
          return (
            <div
              key={item.id}
              onClick={() => handleSelect(item)}
              className="group cursor-pointer"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <Card className={`relative bg-slate-900 border-slate-800 transition-all duration-300 hover:border-blue-500/40 hover:bg-slate-800/50 hover:-translate-y-1 ${cs ? `border-l-4 ${cs.border}` : ''}`}>
                <div className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`shrink-0 flex h-6 w-6 items-center justify-center rounded transition-colors ${cs ? cs.bg : 'bg-blue-500/10 group-hover:bg-blue-500/20'}`}>
                      <Icon className={`h-3 w-3 transition-transform group-hover:scale-110 ${cs ? cs.text : 'text-blue-500'}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white group-hover:text-blue-400 transition-colors truncate">
                        {item.meta?.flag ? `${item.meta.flag} ` : ''}{item.name}
                      </div>
                      {item.description && (
                        <div className="text-[10px] text-slate-400 truncate">{item.description}</div>
                      )}
                    </div>
                  </div>
                  {item.meta && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-1">
                      {Object.entries(item.meta)
                        .filter(([k]) => k !== 'badge' && k !== 'flag' && k !== 'color')
                        .map(([k, v]) => (
                          <span key={k} className="inline-flex items-center text-[10px] px-1.5 py-0 rounded bg-slate-800 text-slate-400 border border-slate-700">
                            {String(v)}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-1.5 right-2 flex items-center text-[10px] text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  →
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="animate-fade-in-up">
        <h1 className="text-3xl font-bold text-white">{activeOrder.name}</h1>
        <p className="mt-2 text-slate-400">{activeOrder.description || 'Browse products by location.'}</p>
      </div>

      {/* Mode Toggle */}
      <PresentationModeToggle
        orders={orders || []}
        activeOrderId={activeOrder.id}
        onChange={handleOrderChange}
      />

      {/* Breadcrumb */}
      <GeoBreadcrumb
        steps={steps.map((s) => ({ type: s.stepType, label: s.label }))}
        activeStep={currentStep}
        selections={selections}
        selectionNames={selectionNames}
        onStepClick={handleBreadcrumbClick}
      />

      {/* Progress */}
      <div className="flex gap-2">
        {steps.map((_, index) => (
          <div
            key={index}
            className={cn(
              'h-1.5 flex-1 rounded-full transition-colors',
              index <= currentStep ? 'bg-blue-500' : 'bg-slate-800'
            )}
          />
        ))}
      </div>

      {/* Step Title */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Select {steps[currentStep]?.label || 'Item'}
        </h2>
        <span className="text-xs text-slate-500">
          Step {currentStep + 1} of {steps.length}
        </span>
      </div>

      {/* Step Error */}
      {stepError && (
        <QueryError message="Unable to load items for this step." onRetry={refetchStep} />
      )}

      {/* Summary when last step is selected */}
      {isLastStep && selections[stepType] && (
        <div className="space-y-6 animate-fade-in">
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Selection Summary</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {steps.map((s, idx) => {
                const name = selectionNames[s.stepType];
                const id = selections[s.stepType];
                const Icon = stepIcons[s.stepType] || Server;
                const isCurrent = idx === currentStep;
                const hasFlag = s.stepType === 'COUNTRY' && name;
                const continuityColor = s.stepType === 'CONTINUITY' && selections[s.stepType]
                  ? (() => {
                      const stepItems = Array.isArray(stepData) ? stepData : stepData?.items || [];
                      const selectedItem = stepItems.find((i: StepData) => i.id === selections[s.stepType]);
                      return selectedItem?.meta?.color ? String(selectedItem.meta.color) : null;
                    })()
                  : null;
                const colorStyles: Record<string, { border: string; bg: string; text: string }> = {
                  red: { border: 'border-l-red-500', bg: 'bg-red-500/10', text: 'text-red-500' },
                  green: { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-500' },
                  yellow: { border: 'border-l-yellow-500', bg: 'bg-yellow-500/10', text: 'text-yellow-500' },
                  orange: { border: 'border-l-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-500' },
                };
                const cs = continuityColor ? colorStyles[continuityColor] : null;
                return (
                  <Card key={s.stepType} className={`relative bg-slate-900 border-slate-800 ${cs ? `border-l-4 ${cs.border}` : ''} ${isCurrent ? 'ring-1 ring-blue-500/30' : ''}`}>
                    <div className="p-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`shrink-0 flex h-6 w-6 items-center justify-center rounded ${cs ? cs.bg : 'bg-slate-800'}`}>
                          <Icon className={`h-3 w-3 ${cs ? cs.text : 'text-slate-400'}`} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label || s.stepType}</div>
                          <div className="text-sm font-medium text-white truncate">
                            {hasFlag ? `${getCountryFlag(name) || getFlagEmoji(name) || '🌍'} ` : ''}{name || id || '—'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
            <button
              onClick={() => { setSelections({}); setSelectionNames({}); setCurrentStep(0); }}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
            >
              ← Start over
            </button>
          </div>

          {perfProfile && (
            <PerformanceGauge profile={perfProfile} />
          )}
        </div>
      )}

      {/* Items Grid — hidden when last step is already selected */}
      {!(isLastStep && selections[stepType]) && renderItems()}

    </div>
  );
}
