import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { usePresentationOrder, useUpdatePresentationSteps } from '@/hooks/useApi';
import QueryError from '@/components/QueryError';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Settings,
  Globe,
  MapPin,
  Server,
  Cpu,
  Target,
  Layers,
} from 'lucide-react';
import type { PresentationStep } from '@cloudmarket/shared-types';
import * as SharedTypes from '@cloudmarket/shared-types';
const PresentationStepType = SharedTypes.PresentationStepType;

type EditableStep = Omit<PresentationStep, 'id'> & { id?: string };

const stepPalette: { type: PresentationStepType; label: string; icon: React.ElementType; color: string }[] = [
  { type: PresentationStepType.COUNTRY, label: 'Country', icon: Globe, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { type: PresentationStepType.ZONE, label: 'Zone', icon: MapPin, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { type: PresentationStepType.PRODUCT, label: 'Product', icon: Server, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { type: PresentationStepType.FLAVOR, label: 'Flavor', icon: Cpu, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20' },
  { type: PresentationStepType.USE_CASE, label: 'Use Case', icon: Target, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { type: PresentationStepType.CATEGORY, label: 'Category', icon: Layers, color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
];

export default function AdminViewBuilder() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: order, isLoading, isError, refetch } = usePresentationOrder(id || '');
  const updateSteps = useUpdatePresentationSteps();

  const [localSteps, setLocalSteps] = useState<EditableStep[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingRule, setEditingRule] = useState<{ index: number; rule: string } | null>(null);

  // Sync local steps when order loads
  if (order && localSteps.length === 0 && !hasChanges) {
    setLocalSteps([...order.steps].sort((a, b) => a.position - b.position));
  }

  const addStep = (type: PresentationStepType) => {
    const paletteItem = stepPalette.find((p) => p.type === type);
    const newStep: PresentationStep = {
      id: `temp-${Date.now()}`,
      orderId: id || '',
      stepType: type,
      position: localSteps.length,
      label: paletteItem?.label || type,
      filterRule: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...localSteps, newStep].map((s, idx) => ({ ...s, position: idx }));
    setLocalSteps(updated);
    setHasChanges(true);
  };

  const removeStep = (index: number) => {
    const updated = localSteps.filter((_, i) => i !== index).map((s, idx) => ({ ...s, position: idx }));
    setLocalSteps(updated);
    setHasChanges(true);
  };

  const moveStep = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === localSteps.length - 1) return;
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const updated = [...localSteps];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    setLocalSteps(updated.map((s, idx) => ({ ...s, position: idx })));
    setHasChanges(true);
  };

  const updateRule = (index: number, rule: string) => {
    const updated = [...localSteps];
    updated[index] = { ...updated[index], filterRule: rule || null };
    setLocalSteps(updated);
    setHasChanges(true);
    setEditingRule(null);
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      await updateSteps.mutateAsync({
        id,
        steps: localSteps.map((s): EditableStep => {
          const { id: stepId, ...rest } = s as any;
          return {
            ...rest,
            id: stepId.startsWith('temp-') ? undefined : stepId,
          } as EditableStep;
        }),
      });
      setHasChanges(false);
    } catch {
      // handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 bg-slate-800" />
        <div className="grid grid-cols-[240px_1fr] gap-6">
          <Skeleton className="h-96 rounded-lg bg-slate-800" />
          <Skeleton className="h-96 rounded-lg bg-slate-800" />
        </div>
      </div>
    );
  }

  if (isError) return <QueryError message="Unable to load presentation order." onRetry={refetch} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin')}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-white">Edit Flow</h1>
            <p className="text-sm text-slate-400">{order?.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setLocalSteps([...(order?.steps || [])].sort((a, b) => a.position - b.position));
              setHasChanges(false);
            }}
            disabled={!hasChanges}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateSteps.isPending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Save Flow
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Palette */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Available Steps
          </h3>
          <div className="space-y-2">
            {stepPalette.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.type}
                  onClick={() => addStep(item.type)}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-800"
                >
                  <div className={`flex h-8 w-8 items-center justify-center rounded-md border ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">{item.label}</div>
                    <div className="text-[11px] text-slate-500">Click to add</div>
                  </div>
                  <Plus className="ml-auto h-4 w-4 text-slate-600" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas */}
        <div>
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Flow Steps
          </h3>
          <div className="space-y-2">
            {localSteps.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
                <p className="text-slate-500">No steps yet. Add steps from the palette.</p>
              </div>
            ) : (
              localSteps.map((step, index) => {
                const paletteItem = stepPalette.find((p) => p.type === step.stepType);
                const Icon = paletteItem?.icon || Server;
                const color = paletteItem?.color || 'text-slate-400 bg-slate-800 border-slate-700';

                return (
                  <div key={step.id}>
                    <Card className="bg-slate-950 border-slate-800">
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-700 text-xs font-bold text-slate-400">
                          {index + 1}
                        </div>
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold text-white">{step.label}</div>
                          <div className="text-xs text-slate-500">{step.stepType}</div>
                          {step.filterRule && (
                            <div className="mt-1 text-[11px] text-slate-600 truncate">
                              Rule: {step.filterRule}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingRule({ index, rule: step.filterRule || '' })}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveStep(index, 'up')}
                            disabled={index === 0}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => moveStep(index, 'down')}
                            disabled={index === localSteps.length - 1}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-blue-400 hover:bg-blue-500/10"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeStep(index)}
                            className="h-8 w-8 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                    {index < localSteps.length - 1 && (
                      <div className="flex justify-center py-1">
                        <div className="h-6 w-0.5 bg-slate-800" />
                      </div>
                    )}
                  </div>
                );
              })
            )}
            {/* End node */}
            {localSteps.length > 0 && (
              <div className="flex items-center gap-4 pt-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-500/30 text-xs font-bold text-emerald-500">
                  ✓
                </div>
                <span className="text-sm text-slate-500">End — Customer sees matching offers</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rule Editor Modal */}
      {editingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6">
            <h3 className="text-lg font-semibold text-white">Edit Filter Rule</h3>
            <p className="mt-1 text-sm text-slate-400">Enter a JSON filter rule for this step.</p>
            <textarea
              value={editingRule.rule}
              onChange={(e) => setEditingRule({ ...editingRule, rule: e.target.value })}
              rows={5}
              className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white font-mono"
              placeholder='{"mustHaveProducts": true}'
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditingRule(null)} className="border-slate-700 text-slate-300">
                Cancel
              </Button>
              <Button
                onClick={() => updateRule(editingRule.index, editingRule.rule)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save Rule
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
