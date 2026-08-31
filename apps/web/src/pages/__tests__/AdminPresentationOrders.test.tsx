import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import AdminPresentationOrders from '../AdminPresentationOrders';

beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

vi.mock('@/hooks/useApi', () => ({
  usePresentationOrders: () => ({
    data: [
      {
        id: '1',
        name: 'Location First',
        description: 'Geo-first browsing',
        isActive: true,
        isDefault: true,
        steps: [
          { id: 's1', orderId: '1', stepType: 'COUNTRY', position: 0, label: 'Country', filterRule: null, createdAt: '', updatedAt: '' },
          { id: 's2', orderId: '1', stepType: 'ZONE', position: 1, label: 'Zone', filterRule: null, createdAt: '', updatedAt: '' },
        ],
        createdAt: '',
        updatedAt: '',
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useCreatePresentationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdatePresentationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeletePresentationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('AdminPresentationOrders', () => {
  it('renders presentation orders', () => {
    render(
      <MemoryRouter>
        <AdminPresentationOrders />
      </MemoryRouter>
    );
    expect(screen.getByText('Location First')).toBeInTheDocument();
    expect(screen.getByText('Geo-first browsing')).toBeInTheDocument();
  });

  it('opens create modal', () => {
    render(
      <MemoryRouter>
        <AdminPresentationOrders />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText(/New Order/));
    expect(screen.getByText('New Presentation Order')).toBeInTheDocument();
  });
});
