import type { PresentationOrder } from '@cloudmarket/shared-types';

interface PresentationModeToggleProps {
  orders: PresentationOrder[];
  activeOrderId: string | null;
  onChange: (orderId: string) => void;
}

const orderIcons: Record<string, string> = {
  'Location First': '🌍',
  'Product First': '📦',
  'Use Case First': '🎯',
};

export default function PresentationModeToggle({ orders, activeOrderId, onChange }: PresentationModeToggleProps) {
  const activeOrders = orders.filter((o) => o.isActive);
  if (activeOrders.length <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">View:</span>
      <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
        {activeOrders.map((order) => {
          const isActive = order.id === activeOrderId || (activeOrderId === null && order.isDefault);
          return (
            <button
              key={order.id}
              onClick={() => onChange(order.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-slate-800 text-blue-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="mr-1">{orderIcons[order.name] || '📋'}</span>
              {order.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
