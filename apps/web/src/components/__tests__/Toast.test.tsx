import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastContainer from '@/components/Toast';
import { useToastStore } from '@/stores/useToastStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing when no toasts exist', () => {
    const { container } = render(<ToastContainer />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a toast with message', () => {
    useToastStore.getState().addToast('Hello World', 'info');
    render(<ToastContainer />);
    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('renders correct icon per toast type', () => {
    const { addToast } = useToastStore.getState();
    addToast('Success', 'success');
    addToast('Error', 'error');
    addToast('Warning', 'warning');
    addToast('Info', 'info');
    render(<ToastContainer />);
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
  });

  it('applies correct style classes per type', () => {
    const { addToast } = useToastStore.getState();
    addToast('Success toast', 'success');
    const { container } = render(<ToastContainer />);
    const toastEl = container.querySelector('[class*="border-emerald-500"]');
    expect(toastEl).toBeInTheDocument();
  });

  it('dismisses toast when close button clicked', async () => {
    const user = userEvent.setup();
    const { addToast } = useToastStore.getState();
    addToast('Dismiss me', 'info');
    render(<ToastContainer />);
    expect(screen.getByText('Dismiss me')).toBeInTheDocument();
    const closeBtn = screen.getByRole('button');
    await user.click(closeBtn);
    await waitFor(() => {
      expect(screen.queryByText('Dismiss me')).not.toBeInTheDocument();
    });
  });

  it('renders multiple toasts stacked', () => {
    const { addToast } = useToastStore.getState();
    addToast('First', 'info');
    addToast('Second', 'error');
    addToast('Third', 'success');
    render(<ToastContainer />);
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('auto-dismisses toast after duration', async () => {
    const { addToast } = useToastStore.getState();
    addToast('Auto', 'info', 50);
    render(<ToastContainer />);
    expect(screen.getByText('Auto')).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(screen.queryByText('Auto')).not.toBeInTheDocument();
  });

  it('positions fixed at bottom-right', () => {
    useToastStore.getState().addToast('Position test', 'info');
    const { container } = render(<ToastContainer />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('fixed')).toBe(true);
    expect(wrapper.classList.contains('bottom-4')).toBe(true);
    expect(wrapper.classList.contains('right-4')).toBe(true);
  });

  it('has high z-index', () => {
    useToastStore.getState().addToast('Z-index test', 'info');
    const { container } = render(<ToastContainer />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.classList.contains('z-[100]')).toBe(true);
  });
});
