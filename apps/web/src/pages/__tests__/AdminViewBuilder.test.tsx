import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import AdminViewBuilder from '../AdminViewBuilder';

beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any;
});

vi.mock('@/hooks/useApi', () => ({
  usePresentationOrder: () => ({
    data: {
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
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useUpdatePresentationSteps: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

describe('AdminViewBuilder', () => {
  it('renders flow steps', () => {
    render(
      <MemoryRouter initialEntries={['/admin/view-builder/1']}>
        <Routes>
          <Route path="/admin/view-builder/:id" element={<AdminViewBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Edit Flow')).toBeInTheDocument();
    expect(screen.getByText('Location First')).toBeInTheDocument();
    expect(screen.getAllByText('Country').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Zone').length).toBeGreaterThanOrEqual(1);
  });

  it('adds a step from palette', () => {
    render(
      <MemoryRouter initialEntries={['/admin/view-builder/1']}>
        <Routes>
          <Route path="/admin/view-builder/:id" element={<AdminViewBuilder />} />
        </Routes>
      </MemoryRouter>
    );
    fireEvent.click(screen.getAllByText('Click to add')[0]);
    expect(screen.getAllByText('Country').length).toBeGreaterThanOrEqual(2);
  });
});
