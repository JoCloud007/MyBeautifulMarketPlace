import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PresentationModeToggle from '../PresentationModeToggle';
import type { PresentationOrder } from '@cloudmarket/shared-types';

const mockOrders: PresentationOrder[] = [
  { id: '1', name: 'Location First', description: null, isActive: true, isDefault: true, steps: [], createdAt: '', updatedAt: '' },
  { id: '2', name: 'Product First', description: null, isActive: true, isDefault: false, steps: [], createdAt: '', updatedAt: '' },
];

describe('PresentationModeToggle', () => {
  it('renders active orders', () => {
    render(<PresentationModeToggle orders={mockOrders} activeOrderId="1" onChange={vi.fn()} />);
    expect(screen.getByText('Location First')).toBeInTheDocument();
    expect(screen.getByText('Product First')).toBeInTheDocument();
  });

  it('calls onChange when clicking different order', () => {
    const onChange = vi.fn();
    render(<PresentationModeToggle orders={mockOrders} activeOrderId="1" onChange={onChange} />);
    fireEvent.click(screen.getByText('Product First'));
    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('returns null when only one active order', () => {
    const { container } = render(
      <PresentationModeToggle orders={[mockOrders[0]]} activeOrderId="1" onChange={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });
});
