import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GeoBreadcrumb from '../GeoBreadcrumb';

describe('GeoBreadcrumb', () => {
  const steps = [
    { type: 'COUNTRY', label: 'Country' },
    { type: 'ZONE', label: 'Zone' },
    { type: 'PRODUCT', label: 'Product' },
  ];

  it('renders steps', () => {
    render(<GeoBreadcrumb steps={steps} activeStep={1} selections={{}} />);
    expect(screen.getByText('Country')).toBeInTheDocument();
    expect(screen.getByText('Zone')).toBeInTheDocument();
  });

  it('shows selected value for past steps', () => {
    render(
      <GeoBreadcrumb
        steps={steps}
        activeStep={2}
        selections={{ COUNTRY: 'France' }}
      />
    );
    expect(screen.getByText('France')).toBeInTheDocument();
  });

  it('calls onStepClick when clicking past step', () => {
    const onStepClick = vi.fn();
    render(
      <GeoBreadcrumb
        steps={steps}
        activeStep={2}
        selections={{ COUNTRY: 'France' }}
        onStepClick={onStepClick}
      />
    );
    fireEvent.click(screen.getByText('France'));
    expect(onStepClick).toHaveBeenCalledWith(0);
  });
});
