import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PerformanceGauge from '../PerformanceGauge';
import type { PerformanceProfile } from '@cloudmarket/shared-types';

const mockProfile: PerformanceProfile = {
  id: '1',
  name: 'Standard Profile',
  targetType: 'PRODUCT',
  targetId: 'prod-1',
  overallScore: 87,
  scoreLabel: 'High Performer',
  colorTheme: 'green',
  visibility: 'SHOW_ALL',
  metrics: [
    { id: 'm1', profileId: '1', name: 'CPU Benchmark', value: 42300, unit: 'points', comparison: '↑ 12% vs avg', displayOrder: 0, createdAt: '', updatedAt: '' },
    { id: 'm2', profileId: '1', name: 'Memory Bandwidth', value: 186, unit: 'GB/s', comparison: '↑ 8% vs avg', displayOrder: 1, createdAt: '', updatedAt: '' },
    { id: 'm3', profileId: '1', name: 'Disk IOPS', value: 95000, unit: null, comparison: '≈ Avg', displayOrder: 2, createdAt: '', updatedAt: '' },
  ],
  createdAt: '',
  updatedAt: '',
};

describe('PerformanceGauge', () => {
  it('renders score and label', () => {
    render(<PerformanceGauge profile={mockProfile} />);
    expect(screen.getByText('87')).toBeInTheDocument();
    expect(screen.getByText(/HIGH PERFORMER/)).toBeInTheDocument();
  });

  it('renders metrics', () => {
    render(<PerformanceGauge profile={mockProfile} />);
    expect(screen.getByText('CPU Benchmark')).toBeInTheDocument();
    expect(screen.getByText('42300')).toBeInTheDocument();
    expect(screen.getByText('Memory Bandwidth')).toBeInTheDocument();
  });

  it('shows empty state when no metrics', () => {
    const profile = { ...mockProfile, metrics: [] };
    render(<PerformanceGauge profile={profile} />);
    expect(screen.getByText(/No metrics defined/)).toBeInTheDocument();
  });
});
