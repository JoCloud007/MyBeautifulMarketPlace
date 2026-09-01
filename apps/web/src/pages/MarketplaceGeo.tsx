import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePresentationOrders, useBrowsePresentation } from '@/hooks/useApi';
import { useAppStore } from '@/stores/useAppStore';
import QueryError from '@/components/QueryError';
import PerformanceGauge from '@/components/PerformanceGauge';
import GeoBreadcrumb from '@/components/GeoBreadcrumb';
import PresentationModeToggle from '@/components/PresentationModeToggle';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Server, MapPin, Globe, Cpu, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const stepIcons: Record<string, React.ElementType> = {
  COUNTRY: Globe,
  ZONE: MapPin,
  PRODUCT: Server,
  FLAVOR: Cpu,
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

  const { data: stepData, isLoading: stepLoading, isError: stepError } = useBrowsePresentation(
    activeOrder?.id || '',
    stepType || '',
    browseParams
  );

  const handleSelect = (item: StepData) => {
    const newSelections = { ...selections, [stepType]: item.id };
    setSelections(newSelections);
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBreadcrumbClick = (stepIndex: number) => {
    const newSelections: Record<string, string> = {};
    steps.slice(0, stepIndex).forEach((s) => {
      if (selections[s.stepType]) {
        newSelections[s.stepType] = selections[s.stepType];
      }
    });
    setSelections(newSelections);
    setCurrentStep(stepIndex);
  };

  const handleOrderChange = (orderId: string) => {
    setGeoOrderId(orderId);
    setSelections({});
    setCurrentStep(0);
  };

  if (ordersLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64 bg-slate-800" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  const items: StepData[] = stepData?.items || [];

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
        <QueryError message="Unable to load items for this step." onRetry={() => {}} />
      )}

      {/* Items Grid */}
      {stepLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg bg-slate-800" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-12 text-center">
          <p className="text-lg font-medium text-slate-300">No items found</p>
          <p className="mt-1 text-slate-500">Nothing matches your current selections.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, index) => {
            const Icon = stepIcons[stepType] || Server;
            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className="group cursor-pointer"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                <Card className="h-full bg-slate-900 border-slate-800 transition-all duration-300 hover:border-blue-500/40 hover:bg-slate-800/50 hover:-translate-y-1">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 transition-colors group-hover:bg-blue-500/20">
                        <Icon className="h-5 w-5 text-blue-500 transition-transform group-hover:scale-110" />
                      </div>
                      {item.meta?.badge && (
                        <Badge variant="secondary" className="text-xs bg-slate-800 text-slate-300 border-slate-700">
                          {item.meta.badge}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg text-white mt-3 group-hover:text-blue-400 transition-colors">
                      {item.name}
                    </CardTitle>
                    {item.description && (
                      <p className="text-sm text-slate-400 line-clamp-2">{item.description}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {item.meta && (
                      <div className="flex flex-wrap items-center gap-2">
                        {Object.entries(item.meta)
                          .filter(([k]) => k !== 'badge')
                          .map(([k, v]) => (
                            <Badge key={k} variant="outline" className="text-xs border-slate-700 text-slate-400">
                              {String(v)}
                            </Badge>
                          ))}
                      </div>
                    )}
                    <div className="mt-4 flex items-center text-xs text-blue-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      Select
                      <ChevronRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* Final Step: Performance Gauge */}
      {isLastStep && selections[stepType] && stepData?.profile && (
        <div className="mt-8 animate-fade-in">
          <PerformanceGauge profile={stepData.profile} />
        </div>
      )}
    </div>
  );
}
