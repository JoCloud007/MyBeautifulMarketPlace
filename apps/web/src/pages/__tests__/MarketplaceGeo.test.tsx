import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import MarketplaceGeo from '../MarketplaceGeo';

vi.mock('@/hooks/useApi', () => ({
  usePresentationOrders: () => ({
    data: [
      {
        id: '1',
        name: 'Location First',
        description: 'Browse by location',
        isActive: true,
        isDefault: true,
        steps: [
          { id: 's1', orderId: '1', stepType: 'COUNTRY', position: 0, label: 'Country', filterRule: null, createdAt: '', updatedAt: '' },
          { id: 's2', orderId: '1', stepType: 'ZONE', position: 1, label: 'Zone', filterRule: null, createdAt: '', updatedAt: '' },
          { id: 's3', orderId: '1', stepType: 'PRODUCT', position: 2, label: 'Product', filterRule: null, createdAt: '', updatedAt: '' },
        ],
        createdAt: '',
        updatedAt: '',
      },
    ],
    isLoading: false,
    isError: false,
    refetch: vi.fn(),
  }),
  useBrowsePresentation: () => ({
    data: {
      items: [
        { id: 'FR', name: 'France', description: 'French regions', meta: { badge: '3 zones' } },
        { id: 'DE', name: 'Germany', description: 'German regions', meta: { badge: '2 zones' } },
      ],
    },
    isLoading: false,
    isError: false,
  }),
}));

vi.mock('@/stores/useAppStore', () => ({
  useAppStore: () => ({
    geoOrderId: null,
    setGeoOrderId: vi.fn(),
  }),
}));

describe('MarketplaceGeo', () => {
  it('renders presentation order name', () => {
    render(
      <MemoryRouter>
        <MarketplaceGeo />
      </MemoryRouter>
    );
    expect(screen.getByText('Location First')).toBeInTheDocument();
    expect(screen.getByText('Browse by location')).toBeInTheDocument();
  });

  it('renders step items', () => {
    render(
      <MemoryRouter>
        <MarketplaceGeo />
      </MemoryRouter>
    );
    expect(screen.getByText('France')).toBeInTheDocument();
    expect(screen.getByText('Germany')).toBeInTheDocument();
  });

  it('advances step on item click', () => {
    render(
      <MemoryRouter>
        <MarketplaceGeo />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByText('France'));
    expect(screen.getByText(/Step 2 of 3/)).toBeInTheDocument();
  });
});
